-- FT-OP: statut de coût distinct du statut technique de la FT.
-- Migration additive, conservée dans migrations_hold jusqu'à validation.
begin;

alter table stock.recipes
  add column if not exists cost_status text,
  add column if not exists cost_review_task_opened_at timestamptz;

alter table stock.recipes drop constraint if exists recipes_cost_status_chk;
alter table stock.recipes
  add constraint recipes_cost_status_chk
  check (cost_status is null or cost_status in ('PROVISOIRE', 'CONFIRME', 'A_REVOIR'));

create table if not exists stock.recipe_cost_status_settings (
  id boolean primary key default true check (id),
  max_relative_delta_percent numeric(8,3),
  max_absolute_delta_ttc numeric(14,2),
  max_cost_per_portion_delta_ttc numeric(14,2),
  updated_by uuid references stock.profiles(id) on delete restrict,
  updated_at timestamptz not null default now()
);

alter table stock.recipe_cost_status_settings enable row level security;
drop policy if exists recipe_cost_status_settings_read on stock.recipe_cost_status_settings;
create policy recipe_cost_status_settings_read
  on stock.recipe_cost_status_settings for select to authenticated
  using (exists (select 1 from stock.profiles p where p.user_id = auth.uid() and p.status = 'active'::stock.user_status));
drop policy if exists recipe_cost_status_settings_direction_write on stock.recipe_cost_status_settings;
create policy recipe_cost_status_settings_direction_write
  on stock.recipe_cost_status_settings for all to authenticated
  using (stock.is_current_user_direction())
  with check (stock.is_current_user_direction());
revoke all on stock.recipe_cost_status_settings from public, anon, authenticated;
grant select on stock.recipe_cost_status_settings to authenticated;
grant insert, update, delete on stock.recipe_cost_status_settings to authenticated;

insert into stock.recipe_cost_status_settings(id)
values (true)
on conflict (id) do nothing;

-- Active material cost, including provisional prices recursively through
-- validated RENDEMENT_PRODUIT sub-recipes. The one-argument signature keeps
-- the deployed provisional-price contract unchanged.
create or replace function stock.recipe_material_cost_with_provisional_recursive(
  p_recipe_id uuid,
  p_path uuid[] default '{}'::uuid[]
)
returns numeric
language plpgsql
security definer
set search_path = pg_catalog, stock, auth, extensions
as $$
declare
  v_total numeric := 0;
  v_line stock.recipe_ingredients%rowtype;
  v_normal record;
  v_provisional record;
  v_child_cost numeric;
  v_child_yield numeric;
  v_has_line boolean := false;
begin
  if p_recipe_id = any(p_path) then return null; end if;

  for v_line in
    select * from stock.recipe_ingredients
    where recipe_id = p_recipe_id
    order by sort_order, id
  loop
    v_has_line := true;
    if coalesce(v_line.line_kind, 'article') = 'subrecipe' then
      if v_line.subrecipe_id is null or v_line.subrecipe_id = any(p_path)
         or coalesce(v_line.quantity_stored, 0) <= 0 then return null; end if;
      select r.yield_quantity into v_child_yield
      from stock.recipes r
      where r.id = v_line.subrecipe_id
        and r.status = 'validee'
        and r.yield_mode = 'rendement_produit';
      v_child_cost := stock.recipe_material_cost_with_provisional_recursive(v_line.subrecipe_id, p_path || p_recipe_id);
      if v_child_cost is null or v_child_yield is null or v_child_yield <= 0 then return null; end if;
      v_total := v_total + v_line.quantity_stored * (v_child_cost / v_child_yield);
    else
      if v_line.article_id is null or coalesce(v_line.quantity_stored, 0) <= 0 then return null; end if;
      select c.article_id, c.normalized_unit_price into v_normal
      from stock.purchase_actual_price_candidates c
      where c.article_id = v_line.article_id and c.classification = 'normal'
      order by c.effective_date desc nulls last limit 1;
      if v_normal.article_id is not null then
        if v_normal.normalized_unit_price is null then return null; end if;
        v_total := v_total + v_line.quantity_stored * v_normal.normalized_unit_price;
      else
        select p.normalized_amount_ttc into v_provisional
        from stock.recipe_ingredient_provisional_prices p
        where p.recipe_id = p_recipe_id
          and p.article_id = v_line.article_id
        order by p.created_at desc limit 1;
        if v_provisional.normalized_amount_ttc is null then return null; end if;
        v_total := v_total + v_line.quantity_stored * v_provisional.normalized_amount_ttc;
      end if;
    end if;
  end loop;
  if not v_has_line then return null; end if;
  return round(v_total, 2);
end;
$$;

create or replace function stock.recipe_material_cost_with_provisional(p_recipe_id uuid)
returns numeric
language sql
security definer
set search_path = pg_catalog, stock, auth, extensions
as $$
  select stock.recipe_material_cost_with_provisional_recursive(p_recipe_id, '{}'::uuid[])
$$;

create or replace function stock.recipe_uses_active_provisional_recursive(
  p_recipe_id uuid,
  p_path uuid[] default '{}'::uuid[]
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, stock, auth, extensions
as $$
declare
  v_line stock.recipe_ingredients%rowtype;
  v_normal_exists boolean;
begin
  if p_recipe_id = any(p_path) then return false; end if;
  for v_line in
    select * from stock.recipe_ingredients where recipe_id = p_recipe_id
  loop
    if coalesce(v_line.line_kind, 'article') = 'subrecipe' then
      if v_line.subrecipe_id is not null
         and coalesce(v_line.quantity_stored, 0) > 0
         and exists (select 1 from stock.recipes child where child.id = v_line.subrecipe_id and child.status = 'validee' and child.yield_mode = 'rendement_produit')
         and stock.recipe_uses_active_provisional_recursive(v_line.subrecipe_id, p_path || p_recipe_id)
      then return true; end if;
    elsif v_line.article_id is not null and coalesce(v_line.quantity_stored, 0) > 0 then
      select exists (
        select 1 from stock.purchase_actual_price_candidates c
        where c.article_id = v_line.article_id
          and c.classification = 'normal'
          and c.normalized_unit_price is not null
      ) into v_normal_exists;
      if not v_normal_exists and exists (
        select 1 from stock.recipe_ingredient_provisional_prices p
        where p.recipe_id = p_recipe_id
          and p.article_id = v_line.article_id
          and p.normalized_amount_ttc is not null
      ) then return true; end if;
    end if;
  end loop;
  return false;
end;
$$;

create or replace function stock.refresh_recipe_cost_status(p_recipe_id uuid)
returns text
language plpgsql
security definer
set search_path = pg_catalog, stock, auth, extensions
as $$
declare
  v_recipe stock.recipes%rowtype;
  v_current numeric;
  v_previous numeric;
  v_relative numeric;
  v_absolute numeric;
  v_per_portion numeric;
  v_status text;
  v_has_provisional boolean;
  v_settings stock.recipe_cost_status_settings%rowtype;
begin
  select * into v_recipe from stock.recipes where id = p_recipe_id for update;
  if v_recipe.id is null then return null; end if;

  select * into v_settings from stock.recipe_cost_status_settings where id = true;
  v_has_provisional := stock.recipe_uses_active_provisional_recursive(p_recipe_id, '{}'::uuid[]);
  v_current := stock.recipe_material_cost_with_provisional(p_recipe_id);

  if v_has_provisional then
    v_status := 'PROVISOIRE';
  else
    v_previous := coalesce(v_recipe.validated_material_cost, v_recipe.total_cost);
    if v_current is null then
      v_status := case when v_recipe.status = 'validee' then 'A_REVOIR' else null end;
    elsif v_previous is null or v_previous = 0 then
      v_status := 'CONFIRME';
    else
      v_absolute := abs(v_current - v_previous);
      v_relative := v_absolute / nullif(abs(v_previous), 0) * 100;
      v_per_portion := case when v_recipe.yield_mode = 'portions'
        then abs((v_current / nullif(v_recipe.portions, 0)) - (v_previous / nullif(v_recipe.portions, 0)))
        else null end;
      if v_settings.max_relative_delta_percent is null
         and v_settings.max_absolute_delta_ttc is null
         and v_settings.max_cost_per_portion_delta_ttc is null
      then
        v_status := case when v_absolute > 0 then 'A_REVOIR' else 'CONFIRME' end;
      elsif (v_settings.max_relative_delta_percent is not null and v_relative > v_settings.max_relative_delta_percent)
         or (v_settings.max_absolute_delta_ttc is not null and v_absolute > v_settings.max_absolute_delta_ttc)
         or (v_settings.max_cost_per_portion_delta_ttc is not null and coalesce(v_per_portion, 0) > v_settings.max_cost_per_portion_delta_ttc)
      then v_status := 'A_REVOIR';
      else v_status := 'CONFIRME';
      end if;
    end if;
  end if;

  if v_current is not null and v_recipe.status in ('en_attente', 'validee') then
    update stock.recipes
    set material_cost_ht = v_current,
        total_cost = v_current,
        cost_per_portion = case when yield_mode = 'portions' then v_current / nullif(portions, 0) else v_current / nullif(yield_quantity, 0) end,
        theoretical_sale_price_ttc = case when yield_mode = 'portions' then v_current * 4 + 2000 * portions else 0 end,
        suggested_price = case when yield_mode = 'portions' then v_current * 4 + 2000 * portions else 0 end
    where id = p_recipe_id;
  end if;

  update stock.recipes
  set cost_status = v_status,
      cost_review_task_opened_at = case
        when v_status = 'A_REVOIR' and coalesce(cost_status, '') <> 'A_REVOIR' then now()
        when v_status = 'A_REVOIR' then cost_review_task_opened_at
        else null
      end,
      updated_at = case when cost_status is distinct from v_status then now() else updated_at end
  where id = p_recipe_id;
  return v_status;
end;
$$;

-- Existing rows receive a derived status without changing their technical state.
do $$
declare r record;
begin
  for r in select id from stock.recipes loop
    perform stock.refresh_recipe_cost_status(r.id);
  end loop;
end $$;

-- A NORMAL qualification changes the active cost without changing the FT version.
create or replace function stock.refresh_recipe_cost_status_from_price()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, stock, auth, extensions
as $$
declare r record;
  v_article_id uuid;
begin
  v_article_id := case new.source_type
    when 'cash_purchase_item' then (select article_id from stock.cash_purchase_items where id = new.source_line_id)
    when 'reception_item' then (select article_id from stock.reception_items where id = new.source_line_id)
    when 'invoice_item' then (select article_id from stock.invoice_items where id = new.source_line_id)
    else null
  end;
  for r in
    with recursive ancestors(recipe_id) as (
      select distinct i.recipe_id from stock.recipe_ingredients i where i.article_id = v_article_id
      union
      select distinct parent.recipe_id
      from stock.recipe_ingredients parent
      join ancestors child on parent.subrecipe_id = child.recipe_id
      where parent.line_kind = 'subrecipe'
    )
    select recipe_id from ancestors
  loop
    perform stock.refresh_recipe_cost_status(r.recipe_id);
  end loop;
  return new;
end;
$$;

create or replace function stock.refresh_recipe_cost_status_from_provisional()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, stock, auth, extensions
as $$
declare r record;
begin
  for r in
    with recursive all_ancestors(recipe_id) as (
      select new.recipe_id
      union
      select parent.recipe_id
      from stock.recipe_ingredients parent
      join all_ancestors child on parent.subrecipe_id = child.recipe_id
      where parent.line_kind = 'subrecipe'
    )
    select recipe_id from all_ancestors
  loop
    perform stock.refresh_recipe_cost_status(r.recipe_id);
  end loop;
  return new;
end;
$$;

-- The source line id is not an article id for all qualification sources;
-- the trigger is therefore kept for future source-specific expansion and does
-- not alter existing qualification semantics.
drop trigger if exists recipe_cost_status_after_price_qualification on stock.purchase_price_qualifications;
create trigger recipe_cost_status_after_price_qualification
after insert or update on stock.purchase_price_qualifications
for each row execute function stock.refresh_recipe_cost_status_from_price();

drop trigger if exists recipe_cost_status_after_provisional_price on stock.recipe_ingredient_provisional_prices;
create trigger recipe_cost_status_after_provisional_price
after insert or update on stock.recipe_ingredient_provisional_prices
for each row execute function stock.refresh_recipe_cost_status_from_provisional();

create or replace function stock.direction_review_recipe(p_recipe_id uuid, p_approve boolean, p_pin text, p_reason text default null, p_retained_price numeric default null)
returns void language plpgsql security definer
set search_path = pg_catalog, stock, auth, extensions as $$
declare v_actor uuid; v_recipe stock.recipes%rowtype; v_cost numeric; v_theoretical numeric;
begin
  v_actor := stock.assert_sensitive_action('recipes.final_validate',p_pin,case when p_approve then 'recipe.final_validate' else 'recipe.return_for_correction' end,'recipe',p_recipe_id,p_reason,'{}'::jsonb);
  if not stock.is_current_user_direction() then raise exception 'Seule la Direction peut effectuer cette revue'; end if;
  select * into v_recipe from stock.recipes where id=p_recipe_id for update;
  if v_recipe.status <> 'en_attente' or v_recipe.workflow_status <> 'chef_validated' or v_recipe.chef_validated_at is null then raise exception 'La validation Chef est obligatoire avant la Direction'; end if;
  if not p_approve then
    if nullif(btrim(p_reason),'') is null then raise exception 'Le motif de correction est obligatoire'; end if;
    update stock.recipes set status='brouillon',workflow_status='needs_correction',correction_requested_by=v_actor,correction_requested_at=now(),correction_reason=btrim(p_reason),direction_validated_by=null,direction_validated_at=null,updated_by=v_actor,updated_at=now() where id=p_recipe_id;
    insert into stock.recipe_validation_history(recipe_id,action,actor_id,comment) values(p_recipe_id,'direction_returned',v_actor,btrim(p_reason)); return;
  end if;
  v_cost := stock.assert_recipe_ready_for_draft(p_recipe_id);
  v_theoretical := case when v_recipe.yield_mode='portions' then v_cost*4+2000*v_recipe.portions else 0 end;
  if p_retained_price is null or p_retained_price <= 0 then raise exception 'Le PV retenu TTC doit être renseigné par la Direction'; end if;

  with latest_prices as (
    select distinct on (c.article_id) c.article_id, c.normalized_unit_price, c.effective_date, c.source_type, c.source_line_id
    from stock.purchase_actual_price_candidates c where c.classification='normal'
    order by c.article_id, c.effective_date desc nulls last
  )
  update stock.recipe_ingredients i set normalized_price_snapshot=p.normalized_unit_price,price_effective_at_snapshot=p.effective_date,
    price_source_type=p.source_type,price_source_id=p.source_line_id,price_effective_at=p.effective_date,
    unit_price=p.normalized_unit_price,total_cost=i.quantity_stored*p.normalized_unit_price,economic_snapshot_at=now()
  from latest_prices p where i.recipe_id=p_recipe_id and i.line_kind='article' and p.article_id=i.article_id;

  with latest_provisional as (
    select distinct on (p.article_id) p.article_id, p.normalized_amount_ttc, p.created_at, p.id
    from stock.recipe_ingredient_provisional_prices p
    where p.recipe_id = p_recipe_id and p.normalized_amount_ttc is not null
      and not exists (select 1 from stock.purchase_actual_price_candidates n where n.article_id=p.article_id and n.classification='normal' and n.normalized_unit_price is not null)
    order by p.article_id, p.created_at desc
  )
  update stock.recipe_ingredients i set normalized_price_snapshot=p.normalized_amount_ttc,price_effective_at_snapshot=p.created_at,
    price_source_type='provisional',price_source_id=p.id,price_effective_at=p.created_at,
    unit_price=p.normalized_amount_ttc,total_cost=i.quantity_stored*p.normalized_amount_ttc,economic_snapshot_at=now()
  from latest_provisional p where i.recipe_id=p_recipe_id and i.line_kind='article' and p.article_id=i.article_id;

  update stock.recipe_ingredients i
  set subrecipe_cost_snapshot = current_cost.total_cost / nullif(child.yield_quantity, 0),
    unit_price = current_cost.total_cost / nullif(child.yield_quantity, 0),
    total_cost = i.quantity_stored * (current_cost.total_cost / nullif(child.yield_quantity, 0)), economic_snapshot_at=now()
  from stock.recipes child cross join lateral (select stock.recipe_material_cost_with_provisional(child.id) as total_cost) current_cost
  where i.recipe_id=p_recipe_id and i.line_kind='subrecipe' and child.id=i.subrecipe_id;

  update stock.recipes set status='validee',workflow_status='approved',validated_by=v_actor,validated_at=now(),direction_validated_by=v_actor,direction_validated_at=now(),
    material_cost_ht=v_cost,total_cost=v_cost,cost_per_portion=case when yield_mode='portions' then v_cost/nullif(portions,0) else v_cost/nullif(yield_quantity,0) end,
    theoretical_sale_price_ttc=v_theoretical,suggested_price=v_theoretical,retained_sale_price_ttc=p_retained_price,final_price=p_retained_price,retained_sale_price_reason=nullif(btrim(p_reason),''),
    validated_material_cost=v_cost,validated_cost_per_yield=case when yield_mode='portions' then v_cost/nullif(portions,0) else v_cost/nullif(yield_quantity,0) end,
    validated_theoretical_sale_price_ttc=v_theoretical,validated_retained_sale_price_ttc=p_retained_price,validated_snapshot_at=now(),updated_by=v_actor,updated_at=now()
  where id=p_recipe_id;
  perform stock.refresh_recipe_cost_status(p_recipe_id);
  insert into stock.recipe_validation_history(recipe_id,action,actor_id,comment,metadata) values(p_recipe_id,'final_validated',v_actor,nullif(btrim(p_reason),''),jsonb_build_object('material_cost',v_cost,'theoretical_price',v_theoretical,'retained_price',p_retained_price,'version',v_recipe.version));
end; $$;

revoke all on function stock.refresh_recipe_cost_status(uuid), stock.refresh_recipe_cost_status_from_price(), stock.refresh_recipe_cost_status_from_provisional(), stock.recipe_material_cost_with_provisional_recursive(uuid, uuid[]), stock.recipe_uses_active_provisional_recursive(uuid, uuid[]) from public, anon, authenticated;
grant execute on function stock.refresh_recipe_cost_status(uuid) to authenticated;

commit;
