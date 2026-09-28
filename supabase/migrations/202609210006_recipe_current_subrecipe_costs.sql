-- FT A.1: coût courant récursif des sous-recettes sans création de version.
-- Cette migration est locale et ne doit pas être déployée sans audit dédié.

begin;

create or replace function stock.current_recipe_material_cost(
  p_recipe_id uuid,
  p_path uuid[] default '{}'::uuid[]
)
returns numeric
language plpgsql
security definer
set search_path = pg_catalog, stock, auth, extensions
as $$
declare
  v_recipe stock.recipes%rowtype;
  v_line stock.recipe_ingredients%rowtype;
  v_price numeric;
  v_child stock.recipes%rowtype;
  v_child_cost numeric;
  v_total numeric := 0;
begin
  if p_recipe_id = any(p_path) then
    raise exception 'Dépendance circulaire entre fiches techniques';
  end if;

  select * into v_recipe from stock.recipes where id = p_recipe_id;
  -- La recette racine peut être un brouillon lors de la readiness. Les
  -- sous-recettes restent contrôlées comme validées avant la récursion.
  if v_recipe.id is null then
    return null;
  end if;

  for v_line in
    select * from stock.recipe_ingredients where recipe_id = p_recipe_id order by sort_order, id
  loop
    if v_line.line_kind = 'subrecipe' then
      select * into v_child from stock.recipes where id = v_line.subrecipe_id;
      if v_child.id is null
        or v_child.status is distinct from 'validee'
        or v_child.yield_mode is distinct from 'rendement_produit'
        or coalesce(v_child.yield_quantity, 0) <= 0
        or v_line.unit_stored is distinct from v_child.yield_unit_id
        or coalesce(v_line.quantity_stored, 0) <= 0 then
        return null;
      end if;
      v_child_cost := stock.current_recipe_material_cost(v_child.id, p_path || p_recipe_id);
      if v_child_cost is null then return null; end if;
      v_total := v_total + v_line.quantity_stored * (v_child_cost / v_child.yield_quantity);
    else
      if v_line.article_id is null or coalesce(v_line.quantity_stored, 0) <= 0 then return null; end if;
      select c.normalized_unit_price into v_price
      from stock.purchase_actual_price_candidates c
      where c.article_id = v_line.article_id and c.classification = 'normal'
      order by c.effective_date desc nulls last
      limit 1;
      if v_price is null then return null; end if;
      v_total := v_total + v_line.quantity_stored * v_price;
    end if;
  end loop;

  return round(v_total, 2);
end;
$$;

create or replace function stock.assert_recipe_ready(p_recipe_id uuid)
returns numeric
language plpgsql
security definer
set search_path = pg_catalog, stock, auth, extensions
as $$
declare
  v_recipe stock.recipes%rowtype;
  v_cost numeric;
begin
  select * into v_recipe from stock.recipes where id = p_recipe_id for update;
  if v_recipe.id is null then raise exception 'Fiche technique introuvable'; end if;
  if nullif(btrim(v_recipe.name), '') is null then raise exception 'Le nom de la fiche est obligatoire'; end if;
  if v_recipe.yield_mode = 'portions' and coalesce(v_recipe.portions, 0) <= 0 then raise exception 'Le nombre de portions est invalide'; end if;
  if v_recipe.yield_mode = 'rendement_produit' and (coalesce(v_recipe.yield_quantity, 0) <= 0 or v_recipe.yield_unit_id is null) then raise exception 'Le rendement produit est incomplet'; end if;
  if exists (select 1 from stock.pending_ingredients p where p.recipe_id = p_recipe_id and p.status in ('pending','ambiguous')) then raise exception 'Des ingrédients restent à rapprocher'; end if;
  if not exists (select 1 from stock.recipe_ingredients i where i.recipe_id = p_recipe_id) then raise exception 'Ajoutez au moins un ingrédient'; end if;
  if exists (select 1 from stock.recipe_ingredients i where i.recipe_id = p_recipe_id and i.line_kind = 'article' and (i.article_id is null or i.unit_stored is null or coalesce(i.quantity_stored,0) <= 0)) then raise exception 'Une ligne ingrédient est incomplète'; end if;
  if exists (select 1 from stock.recipe_ingredients i where i.recipe_id = p_recipe_id and i.quantity_mode = 'net' and i.trim_form_id is null and not (coalesce(i.yield_percent_snapshot,0) > 0 and i.yield_percent_snapshot <= 100)) then raise exception 'Une ligne NET ne possède pas de rendement exploitable'; end if;
  if not exists (select 1 from stock.recipe_steps s where s.recipe_id = p_recipe_id and nullif(btrim(s.instructions), '') is not null) then raise exception 'Le procédé est incomplet'; end if;
  if exists (select 1 from stock.recipe_ingredients i where i.recipe_id=p_recipe_id and i.line_kind='article' and not exists (select 1 from stock.purchase_actual_price_candidates c where c.article_id=i.article_id and c.classification='normal')) then raise exception 'Prix NORMAL manquant pour un ingrédient'; end if;
  if exists (
    select 1 from stock.recipe_ingredients i
    left join lateral (
      select c.normalized_unit_price from stock.purchase_actual_price_candidates c
      where c.article_id = i.article_id and c.classification = 'normal'
      order by c.effective_date desc nulls last limit 1
    ) p on true
    where i.recipe_id = p_recipe_id and i.line_kind = 'article'
      and p.normalized_unit_price is null
  ) then raise exception 'Prix NORMAL existant mais coût normalisé incomplet'; end if;
  if exists (
    select 1
    from stock.recipe_ingredients i
    left join stock.recipes child on child.id = i.subrecipe_id
    where i.recipe_id = p_recipe_id and i.line_kind = 'subrecipe'
      and (i.subrecipe_id is null or i.article_id is not null or i.unit_stored is null or coalesce(i.quantity_stored, 0) <= 0 or child.id is null or child.status is distinct from 'validee' or child.yield_mode is distinct from 'rendement_produit' or coalesce(child.yield_quantity, 0) <= 0 or child.yield_unit_id is null or i.unit_stored is distinct from child.yield_unit_id)
  ) then raise exception 'Une sous-recette est incomplète, non validée ou son unité de rendement est inexploitable'; end if;
  if exists (
    with recursive dependency(recipe_id, subrecipe_id, path, has_cycle) as (
      select i.recipe_id, i.subrecipe_id, array[i.recipe_id, i.subrecipe_id], i.subrecipe_id = i.recipe_id
      from stock.recipe_ingredients i where i.recipe_id = p_recipe_id and i.line_kind = 'subrecipe'
      union all
      select d.recipe_id, i.subrecipe_id, d.path || i.subrecipe_id, i.subrecipe_id = any(d.path)
      from dependency d join stock.recipe_ingredients i on i.recipe_id = d.subrecipe_id
      where d.subrecipe_id is not null and not d.has_cycle and i.line_kind = 'subrecipe'
    ) select 1 from dependency where has_cycle
  ) then raise exception 'Dépendance circulaire entre fiches techniques'; end if;

  v_cost := stock.current_recipe_material_cost(p_recipe_id);
  if coalesce(v_cost, 0) <= 0 then raise exception 'Le coût matière est non calculable'; end if;
  return v_cost;
end;
$$;

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
  v_cost := stock.assert_recipe_ready(p_recipe_id);
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
  update stock.recipe_ingredients i
  set subrecipe_cost_snapshot = current_cost.total_cost / nullif(child.yield_quantity, 0),
    unit_price = current_cost.total_cost / nullif(child.yield_quantity, 0),
    total_cost = i.quantity_stored * (current_cost.total_cost / nullif(child.yield_quantity, 0)),
    economic_snapshot_at = now()
  from stock.recipes child
  cross join lateral (
    select stock.current_recipe_material_cost(child.id) as total_cost
  ) current_cost
  where i.recipe_id = p_recipe_id and i.line_kind = 'subrecipe' and child.id = i.subrecipe_id;
  update stock.recipes set status='validee',workflow_status='approved',validated_by=v_actor,validated_at=now(),direction_validated_by=v_actor,direction_validated_at=now(),
    material_cost_ht=v_cost,total_cost=v_cost,cost_per_portion=case when yield_mode='portions' then v_cost/nullif(portions,0) else v_cost/nullif(yield_quantity,0) end,
    theoretical_sale_price_ttc=v_theoretical,suggested_price=v_theoretical,retained_sale_price_ttc=p_retained_price,final_price=p_retained_price,retained_sale_price_reason=nullif(btrim(p_reason),''),
    validated_material_cost=v_cost,validated_cost_per_yield=case when yield_mode='portions' then v_cost/nullif(portions,0) else v_cost/nullif(yield_quantity,0) end,
    validated_theoretical_sale_price_ttc=v_theoretical,validated_retained_sale_price_ttc=p_retained_price,validated_snapshot_at=now(),updated_by=v_actor,updated_at=now()
  where id=p_recipe_id;
  insert into stock.recipe_validation_history(recipe_id,action,actor_id,comment,metadata) values(p_recipe_id,'final_validated',v_actor,nullif(btrim(p_reason),''),jsonb_build_object('material_cost',v_cost,'theoretical_price',v_theoretical,'retained_price',p_retained_price,'version',v_recipe.version));
end; $$;

revoke all on function stock.current_recipe_material_cost(uuid, uuid[]) from public, anon, authenticated;

commit;
