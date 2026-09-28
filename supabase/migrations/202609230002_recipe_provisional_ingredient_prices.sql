-- Prix provisoires FT : saisie de travail, jamais une qualification Achats.
begin;

create table if not exists stock.recipe_ingredient_provisional_prices (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references stock.recipes(id) on delete cascade,
  article_id uuid not null references stock.articles(id) on delete restrict,
  amount_ttc numeric(14,2) not null check (amount_ttc >= 0),
  unit_id uuid not null references stock.units(id) on delete restrict,
  normalized_amount_ttc numeric(14,4),
  normalized_unit_id uuid references stock.units(id) on delete restrict,
  conversion_factor_to_stock numeric(18,8),
  observed_at timestamptz not null default now(),
  entered_by uuid not null references stock.profiles(id) on delete restrict,
  source text,
  observation text,
  created_at timestamptz not null default now()
);

create index if not exists recipe_ingredient_provisional_prices_lookup_idx
  on stock.recipe_ingredient_provisional_prices(recipe_id, article_id, created_at desc);

create index if not exists recipe_ingredient_provisional_prices_effective_lookup_idx
  on stock.recipe_ingredient_provisional_prices(recipe_id, article_id, created_at desc)
  where normalized_amount_ttc is not null;

alter table stock.recipe_ingredient_provisional_prices enable row level security;

drop policy if exists recipe_ingredient_provisional_prices_read on stock.recipe_ingredient_provisional_prices;
create policy recipe_ingredient_provisional_prices_read
  on stock.recipe_ingredient_provisional_prices
  for select to authenticated
  using (exists (
    select 1 from stock.profiles p
    where p.user_id = auth.uid()
      and p.status = 'active'::stock.user_status
  ));

revoke all on stock.recipe_ingredient_provisional_prices from public, anon, authenticated;
grant select on stock.recipe_ingredient_provisional_prices to authenticated;

create or replace function stock.record_recipe_ingredient_provisional_price(
  p_recipe_id uuid,
  p_article_id uuid,
  p_amount_ttc numeric,
  p_unit_id uuid,
  p_normalized_amount_ttc numeric,
  p_normalized_unit_id uuid,
  p_conversion_factor_to_stock numeric,
  p_source text default null,
  p_observation text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, stock, auth, extensions
as $$
declare
  v_actor uuid;
  v_recipe stock.recipes%rowtype;
  v_stock_unit_id uuid;
  v_id uuid;
begin
  v_actor := stock.current_profile_id();
  if v_actor is null or not stock.can_current_user_manage_recipes() then
    raise exception 'Permission insuffisante pour saisir un prix provisoire';
  end if;
  if p_amount_ttc is null or p_amount_ttc < 0
    or p_normalized_amount_ttc is null or p_normalized_amount_ttc < 0
    or p_normalized_unit_id is null
    or p_conversion_factor_to_stock is null or p_conversion_factor_to_stock <= 0 then
    raise exception 'Le prix provisoire doit être positif ou nul';
  end if;
  select a.unit_id into v_stock_unit_id from stock.articles a where a.id = p_article_id;
  if v_stock_unit_id is null then raise exception 'Article introuvable'; end if;
  if p_normalized_unit_id is distinct from v_stock_unit_id then
    raise exception 'L unité normalisée du prix provisoire doit être l unité stock de l article';
  end if;
  select * into v_recipe from stock.recipes where id = p_recipe_id for update;
  if v_recipe.id is null then raise exception 'Fiche technique introuvable'; end if;
  if v_recipe.status in ('en_attente','validee','archived') then
    raise exception 'Une fiche soumise, validée ou archivée ne peut pas recevoir ce prix';
  end if;
  if not exists (
    select 1 from stock.recipe_ingredients i
    where i.recipe_id = p_recipe_id and i.article_id = p_article_id and coalesce(i.line_kind,'article') = 'article'
  ) then raise exception 'Article absent de la fiche technique'; end if;
  insert into stock.recipe_ingredient_provisional_prices(
    recipe_id, article_id, amount_ttc, unit_id, normalized_amount_ttc,
    normalized_unit_id, conversion_factor_to_stock, entered_by, source, observation
  ) values (
    p_recipe_id, p_article_id, p_amount_ttc, p_unit_id, p_normalized_amount_ttc,
    p_normalized_unit_id, p_conversion_factor_to_stock, v_actor,
    nullif(btrim(p_source), ''), nullif(btrim(p_observation), '')
  ) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function stock.record_recipe_ingredient_provisional_price(uuid, uuid, numeric, uuid, numeric, uuid, numeric, text, text)
  from public, anon, authenticated;
grant execute on function stock.record_recipe_ingredient_provisional_price(uuid, uuid, numeric, uuid, numeric, uuid, numeric, text, text)
  to authenticated;

-- Brouillon/soumission : un prix provisoire rend le coût calculable pour le
-- travail du Chef, mais ne satisfait jamais la validation Direction.
create or replace function stock.recipe_material_cost_with_provisional(p_recipe_id uuid)
returns numeric
language plpgsql
security definer
set search_path = pg_catalog, stock, auth, extensions
as $$
declare
  v_strict numeric;
  v_total numeric;
  v_line numeric;
  v_ingredient stock.recipe_ingredients%rowtype;
  v_child_cost numeric;
  v_child_yield numeric;
  v_normal record;
  v_provisional record;
  v_has_line boolean := false;
begin
  v_strict := stock.current_recipe_material_cost(p_recipe_id);
  if v_strict is not null then return v_strict; end if;
  v_total := 0;
  for v_line in
    select i.quantity_stored from stock.recipe_ingredients i
    where i.recipe_id = p_recipe_id
  loop
    v_has_line := true;
  end loop;
  if not v_has_line then return null; end if;

  for v_ingredient in
    select * from stock.recipe_ingredients i where i.recipe_id = p_recipe_id order by i.sort_order, i.id
  loop
    if coalesce(v_ingredient.line_kind, 'article') = 'subrecipe' then
      if v_ingredient.subrecipe_id is null or coalesce(v_ingredient.quantity_stored, 0) <= 0 then return null; end if;
      v_child_cost := stock.current_recipe_material_cost(v_ingredient.subrecipe_id);
      select r.yield_quantity into v_child_yield from stock.recipes r where r.id = v_ingredient.subrecipe_id and r.status = 'validee';
      if v_child_cost is null or v_child_yield is null or v_child_yield <= 0 then return null; end if;
      v_total := v_total + v_ingredient.quantity_stored * (v_child_cost / v_child_yield);
      continue;
    end if;

    if v_ingredient.article_id is null or coalesce(v_ingredient.quantity_stored, 0) <= 0 then return null; end if;
    select c.article_id, c.normalized_unit_price into v_normal
    from stock.purchase_actual_price_candidates c
    where c.article_id = v_ingredient.article_id and c.classification = 'normal'
    order by c.effective_date desc nulls last limit 1;
    if v_normal.article_id is not null then
      if v_normal.normalized_unit_price is null then return null; end if;
      v_total := v_total + v_ingredient.quantity_stored * v_normal.normalized_unit_price;
    else
      select p.normalized_amount_ttc, p.amount_ttc, p.unit_id, p.normalized_unit_id
        into v_provisional
      from stock.recipe_ingredient_provisional_prices p
      where p.recipe_id = p_recipe_id and p.article_id = v_ingredient.article_id
      order by p.created_at desc limit 1;
      if v_provisional.normalized_amount_ttc is null then return null; end if;
      v_total := v_total + v_ingredient.quantity_stored * v_provisional.normalized_amount_ttc;
    end if;
  end loop;
  return round(v_total, 2);
end;
$$;

create or replace function stock.assert_recipe_ready_for_draft(p_recipe_id uuid)
returns numeric
language plpgsql
security definer
set search_path = pg_catalog, stock, auth, extensions
as $$
declare v_recipe stock.recipes%rowtype; v_cost numeric;
begin
  select * into v_recipe from stock.recipes where id = p_recipe_id for update;
  if v_recipe.id is null then raise exception 'Fiche technique introuvable'; end if;
  if nullif(btrim(v_recipe.name), '') is null then raise exception 'Le nom de la fiche est obligatoire'; end if;
  if v_recipe.yield_mode = 'portions' and coalesce(v_recipe.portions,0) <= 0 then raise exception 'Le nombre de portions est invalide'; end if;
  if v_recipe.yield_mode = 'rendement_produit' and (coalesce(v_recipe.yield_quantity,0) <= 0 or v_recipe.yield_unit_id is null) then raise exception 'Le rendement produit est incomplet'; end if;
  if exists (select 1 from stock.pending_ingredients p where p.recipe_id=p_recipe_id and p.status in ('pending','ambiguous')) then raise exception 'Des ingrédients restent à rapprocher'; end if;
  if not exists (select 1 from stock.recipe_ingredients i where i.recipe_id=p_recipe_id) then raise exception 'Ajoutez au moins un ingrédient'; end if;
  if exists (select 1 from stock.recipe_ingredients i where i.recipe_id=p_recipe_id and coalesce(i.line_kind,'article')='article' and (i.article_id is null or i.unit_stored is null or coalesce(i.quantity_stored,0)<=0)) then raise exception 'Une ligne ingrédient est incomplète'; end if;
  if exists (select 1 from stock.recipe_ingredients i where i.recipe_id=p_recipe_id and i.quantity_mode='net' and i.trim_form_id is null and not (coalesce(i.yield_percent_snapshot,0)>0 and i.yield_percent_snapshot<=100)) then raise exception 'Une ligne NET ne possède pas de rendement exploitable'; end if;
  if exists (select 1 from stock.recipe_ingredients i left join stock.recipes child on child.id=i.subrecipe_id where i.recipe_id=p_recipe_id and i.line_kind='subrecipe' and (i.subrecipe_id is null or i.article_id is not null or i.unit_stored is null or coalesce(i.quantity_stored,0)<=0 or child.id is null or child.status is distinct from 'validee' or child.yield_mode is distinct from 'rendement_produit' or coalesce(child.yield_quantity,0)<=0 or child.yield_unit_id is null or i.unit_stored is distinct from child.yield_unit_id)) then raise exception 'Une sous-recette est incomplète, non validée ou son unité de rendement est inexploitable'; end if;
  if exists (with recursive dependency(recipe_id, subrecipe_id, path, has_cycle) as (select i.recipe_id,i.subrecipe_id,array[i.recipe_id,i.subrecipe_id],i.subrecipe_id=i.recipe_id from stock.recipe_ingredients i where i.recipe_id=p_recipe_id and i.line_kind='subrecipe' union all select d.recipe_id,i.subrecipe_id,d.path||i.subrecipe_id,i.subrecipe_id=any(d.path) from dependency d join stock.recipe_ingredients i on i.recipe_id=d.subrecipe_id where d.subrecipe_id is not null and not d.has_cycle and i.line_kind='subrecipe') select 1 from dependency where has_cycle) then raise exception 'Dépendance circulaire entre fiches techniques'; end if;
  if not exists (select 1 from stock.recipe_steps s where s.recipe_id=p_recipe_id and nullif(btrim(s.instructions),'') is not null) then raise exception 'Le procédé est incomplet'; end if;
  if exists (select 1 from stock.recipe_ingredients i left join lateral (select c.article_id, c.normalized_unit_price from stock.purchase_actual_price_candidates c where c.article_id=i.article_id and c.classification='normal' order by c.effective_date desc nulls last limit 1) n on true where i.recipe_id=p_recipe_id and coalesce(i.line_kind,'article')='article' and ((n.article_id is not null and n.normalized_unit_price is null) or (n.article_id is null and not exists (select 1 from stock.recipe_ingredient_provisional_prices p where p.recipe_id=p_recipe_id and p.article_id=i.article_id and p.normalized_amount_ttc is not null)))) then raise exception 'Prix NORMAL manquant et aucun prix provisoire normalisé'; end if;
  v_cost := stock.recipe_material_cost_with_provisional(p_recipe_id);
  if coalesce(v_cost,0) <= 0 then raise exception 'Le coût matière est non calculable'; end if;
  return v_cost;
end;
$$;

create or replace function stock.submit_recipe_for_validation(p_recipe_id uuid)
returns void language plpgsql security definer
set search_path = pg_catalog, stock, auth, extensions as $$
declare v_actor uuid; v_recipe stock.recipes%rowtype; v_cost numeric;
begin
  if not stock.can_current_user_manage_recipes() then raise exception 'Permission insuffisante'; end if;
  v_actor := stock.current_profile_id();
  select * into v_recipe from stock.recipes where id=p_recipe_id for update;
  if v_recipe.status <> 'brouillon' or coalesce(v_recipe.workflow_status,'draft') not in ('draft','needs_correction') then raise exception 'Seule une fiche brouillon ou à corriger peut être soumise'; end if;
  v_cost := stock.assert_recipe_ready_for_draft(p_recipe_id);
  update stock.recipes set status='en_attente', workflow_status='submitted', submitted_by=v_actor, submitted_at=now(), chef_validated_by=null, chef_validated_at=null, direction_validated_by=null, direction_validated_at=null, correction_requested_by=null, correction_requested_at=null, correction_reason=null, material_cost_ht=v_cost, total_cost=v_cost, cost_per_portion=case when yield_mode='portions' then v_cost/nullif(portions,0) else v_cost/nullif(yield_quantity,0) end, theoretical_sale_price_ttc=case when yield_mode='portions' then v_cost*4+2000*portions else 0 end, updated_by=v_actor, updated_at=now() where id=p_recipe_id;
  insert into stock.recipe_validation_history(recipe_id,action,actor_id,metadata) values(p_recipe_id,'submitted',v_actor,jsonb_build_object('version',v_recipe.version,'uses_provisional_price',exists(select 1 from stock.recipe_ingredients i where i.recipe_id=p_recipe_id and coalesce(i.line_kind,'article')='article' and not exists (select 1 from stock.purchase_actual_price_candidates c where c.article_id=i.article_id and c.classification='normal' and c.normalized_unit_price is not null) and exists (select 1 from stock.recipe_ingredient_provisional_prices p where p.recipe_id=p_recipe_id and p.article_id=i.article_id and p.normalized_amount_ttc is not null))));
end; $$;

create or replace function stock.chef_review_recipe(p_recipe_id uuid, p_approve boolean, p_reason text default null)
returns void language plpgsql security definer
set search_path = pg_catalog, stock, auth, extensions as $$
declare v_actor uuid; v_role stock.user_role; v_recipe stock.recipes%rowtype;
begin
  select id,role into v_actor,v_role from stock.profiles where user_id=auth.uid() and status='active' limit 1;
  if v_actor is null or v_role <> 'chef_cuisine' then raise exception 'Seul un Chef cuisine actif peut effectuer cette revue'; end if;
  select * into v_recipe from stock.recipes where id=p_recipe_id for update;
  if v_recipe.status <> 'en_attente' or v_recipe.workflow_status <> 'submitted' then raise exception 'La fiche n attend pas la validation Chef'; end if;
  if p_approve then
    perform stock.assert_recipe_ready_for_draft(p_recipe_id);
    update stock.recipes set workflow_status='chef_validated',chef_validated_by=v_actor,chef_validated_at=now(),updated_by=v_actor,updated_at=now() where id=p_recipe_id;
    insert into stock.recipe_validation_history(recipe_id,action,actor_id) values(p_recipe_id,'chef_validated',v_actor);
  else
    if nullif(btrim(p_reason),'') is null then raise exception 'Le motif de correction est obligatoire'; end if;
    update stock.recipes set status='brouillon',workflow_status='needs_correction',correction_requested_by=v_actor,correction_requested_at=now(),correction_reason=btrim(p_reason),chef_validated_by=null,chef_validated_at=null,direction_validated_by=null,direction_validated_at=null,updated_by=v_actor,updated_at=now() where id=p_recipe_id;
    insert into stock.recipe_validation_history(recipe_id,action,actor_id,comment) values(p_recipe_id,'chef_returned',v_actor,btrim(p_reason));
  end if;
end; $$;

revoke all on function stock.recipe_material_cost_with_provisional(uuid), stock.assert_recipe_ready_for_draft(uuid), stock.submit_recipe_for_validation(uuid), stock.chef_review_recipe(uuid,boolean,text)
  from public, anon, authenticated;
grant execute on function stock.submit_recipe_for_validation(uuid), stock.chef_review_recipe(uuid,boolean,text) to authenticated;

commit;
