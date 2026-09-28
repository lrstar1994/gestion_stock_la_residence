-- FT-OP : reprise contrôlée des prix provisoires lors d'un versionnement.
-- Migration locale uniquement ; ne pas appliquer rétroactivement aux versions existantes.
begin;

alter table stock.recipe_ingredient_provisional_prices
  add column if not exists copied_from_recipe_id uuid references stock.recipes(id) on delete set null,
  add column if not exists copied_from_price_id uuid references stock.recipe_ingredient_provisional_prices(id) on delete set null;

create or replace function stock.create_recipe_version(
  p_parent_recipe_id uuid,
  p_recipe jsonb,
  p_ingredients jsonb,
  p_steps jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, stock, auth, extensions
as $$
declare
  v_actor uuid;
  v_parent stock.recipes%rowtype;
  v_root_id uuid;
  v_recipe_id uuid;
  v_version integer;
  v_current numeric;
begin
  if not stock.can_current_user_manage_recipes() then
    raise exception 'Permission insuffisante';
  end if;
  v_actor := stock.current_profile_id();
  if v_actor is null then
    raise exception 'Profil actif introuvable';
  end if;

  select * into v_parent from stock.recipes where id = p_parent_recipe_id for update;
  if v_parent.id is null or v_parent.status <> 'validee' then
    raise exception 'Seule une fiche validée peut être versionnée';
  end if;
  v_root_id := coalesce(v_parent.parent_version_id, v_parent.id);
  perform 1 from stock.recipes where id = v_root_id for update;
  select coalesce(max(version), 0) + 1 into v_version
  from stock.recipes
  where id = v_root_id or parent_version_id = v_root_id;

  if p_recipe ->> 'type' = 'BF' then
    raise exception 'Le type BF est historique et ne peut pas être créé';
  end if;

  insert into stock.recipes(
    code, name, type, sub_type, main_ingredient, portions, description, tags,
    total_cost, cost_per_portion, suggested_price, final_price, cost_ratio,
    margin_rate, margin_coefficient, yield_mode, yield_quantity, yield_unit_id,
    retained_sale_price_ttc, retained_sale_price_reason, dressing_photo_alt,
    dressing_photo_path, dressing_photo_url, status, workflow_status, version,
    parent_version_id, created_by, updated_by
  ) values (
    null, nullif(btrim(p_recipe ->> 'name'), ''), (p_recipe ->> 'type')::stock.recipe_type,
    nullif(btrim(p_recipe ->> 'sub_type'), ''), (p_recipe ->> 'main_ingredient')::stock.recipe_main_ingredient,
    coalesce((p_recipe ->> 'portions')::integer, 0), nullif(btrim(p_recipe ->> 'description'), ''),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_recipe -> 'tags', '[]'::jsonb)))::stock.recipe_tag[], '{}'::stock.recipe_tag[]),
    coalesce((p_recipe ->> 'total_cost')::numeric, 0), coalesce((p_recipe ->> 'cost_per_portion')::numeric, 0),
    coalesce((p_recipe ->> 'suggested_price')::numeric, 0), 0, coalesce((p_recipe ->> 'cost_ratio')::numeric, 0),
    coalesce((p_recipe ->> 'margin_rate')::numeric, 0), coalesce((p_recipe ->> 'margin_coefficient')::numeric, 3),
    coalesce(nullif(btrim(p_recipe ->> 'yield_mode'), ''), 'portions'), (p_recipe ->> 'yield_quantity')::numeric,
    nullif(btrim(p_recipe ->> 'yield_unit_id'), '')::uuid, null, null,
    nullif(btrim(p_recipe ->> 'dressing_photo_alt'), ''), nullif(btrim(p_recipe ->> 'dressing_photo_path'), ''),
    nullif(btrim(p_recipe ->> 'dressing_photo_url'), ''), 'brouillon', 'draft', v_version,
    v_root_id, v_actor, v_actor
  ) returning id into v_recipe_id;

  insert into stock.recipe_ingredients(
    recipe_id, article_id, imported_name, quantity, unit_id, unit_name, unit_price,
    total_cost, resolution_status, sort_order, quantity_display, unit_display,
    quantity_stored, unit_stored, conversion_factor, is_net_quantity, quantity_mode,
    trim_form_id, yield_percent_snapshot, line_kind, subrecipe_id,
    trim_form_name_snapshot, normalized_price_snapshot, price_effective_at_snapshot,
    subrecipe_cost_snapshot, economic_snapshot_at
  )
  select v_recipe_id, x.article_id, x.imported_name, x.quantity, x.unit_id, x.unit_name,
    coalesce(x.unit_price, 0), coalesce(x.total_cost, 0), coalesce(x.resolution_status::stock.pending_ingredient_status, 'resolved'),
    x.sort_order, x.quantity_display, x.unit_display, x.quantity_stored, x.unit_stored,
    x.conversion_factor, coalesce(x.is_net_quantity, false), coalesce(x.quantity_mode, 'brut'),
    x.trim_form_id, x.yield_percent_snapshot, coalesce(x.line_kind, 'article'), x.subrecipe_id,
    x.trim_form_name_snapshot, x.normalized_price_snapshot, x.price_effective_at_snapshot,
    x.subrecipe_cost_snapshot, x.economic_snapshot_at
  from jsonb_to_recordset(coalesce(p_ingredients, '[]'::jsonb)) as x(
    article_id uuid, imported_name text, quantity numeric, unit_id uuid, unit_name text,
    unit_price numeric, total_cost numeric, resolution_status text, sort_order integer,
    quantity_display numeric, unit_display uuid, quantity_stored numeric, unit_stored uuid,
    conversion_factor numeric, is_net_quantity boolean, quantity_mode text, trim_form_id uuid,
    yield_percent_snapshot numeric, line_kind text, subrecipe_id uuid,
    trim_form_name_snapshot text, normalized_price_snapshot numeric,
    price_effective_at_snapshot timestamptz, subrecipe_cost_snapshot numeric,
    economic_snapshot_at timestamptz
  );

  -- Un seul provisoire actif par article est repris. La copie est autorisée
  -- uniquement en l'absence totale de NORMAL Achats : un NORMAL non normalisable
  -- bloque donc toujours le coût sans fallback.
  insert into stock.recipe_ingredient_provisional_prices(
    recipe_id, article_id, amount_ttc, unit_id, normalized_amount_ttc,
    normalized_unit_id, conversion_factor_to_stock, observed_at, entered_by,
    source, observation, copied_from_recipe_id, copied_from_price_id
  )
  select v_recipe_id, p.article_id, p.amount_ttc, p.unit_id, p.normalized_amount_ttc,
    p.normalized_unit_id, p.conversion_factor_to_stock, p.observed_at, p.entered_by,
    p.source, p.observation, v_parent.id, p.id
  from (
    select distinct on (pp.article_id) pp.*
    from stock.recipe_ingredient_provisional_prices pp
    join stock.recipe_ingredients old_i
      on old_i.recipe_id = v_parent.id
     and old_i.article_id = pp.article_id
     and coalesce(old_i.line_kind, 'article') = 'article'
    where pp.recipe_id = v_parent.id
      and pp.normalized_amount_ttc is not null
      and exists (
        select 1
        from jsonb_to_recordset(coalesce(p_ingredients, '[]'::jsonb)) as new_i(
          article_id uuid, unit_id uuid, line_kind text
        )
        where new_i.article_id = pp.article_id
          and coalesce(new_i.line_kind, 'article') = 'article'
          and new_i.unit_id = old_i.unit_id
      )
      and pp.normalized_unit_id = (
        select a.unit_id from stock.articles a where a.id = pp.article_id
      )
      and coalesce(pp.conversion_factor_to_stock, 0) > 0
      and not exists (
        select 1
        from stock.purchase_actual_price_candidates normal_price
        where normal_price.article_id = pp.article_id
          and normal_price.classification = 'normal'
      )
    order by pp.article_id, pp.created_at desc, pp.id desc
  ) p;

  -- Réutilise le moteur canonique : la V2 brouillon expose immédiatement le
  -- coût et le PV calculables lorsque le provisoire repris est exploitable.
  perform stock.refresh_recipe_cost_status(v_recipe_id);
  v_current := stock.recipe_material_cost_with_provisional(v_recipe_id);
  if v_current is not null then
    update stock.recipes
    set total_cost = v_current,
        cost_per_portion = case when yield_mode = 'portions' then v_current / nullif(portions, 0) else v_current / nullif(yield_quantity, 0) end,
        suggested_price = case when yield_mode = 'portions' then v_current * 4 + 2000 * portions else 0 end,
        theoretical_sale_price_ttc = case when yield_mode = 'portions' then v_current * 4 + 2000 * portions else 0 end
    where id = v_recipe_id;
  end if;

  insert into stock.recipe_steps(
    recipe_id, step_order, title, instructions, active_duration_minutes,
    passive_duration_minutes, attention_points, observation, created_by, updated_by
  )
  select v_recipe_id, x.step_order, nullif(btrim(x.title), ''), x.instructions,
    x.active_duration_minutes, x.passive_duration_minutes, nullif(btrim(x.attention_points), ''),
    nullif(btrim(x.observation), ''), v_actor, v_actor
  from jsonb_to_recordset(coalesce(p_steps, '[]'::jsonb)) as x(
    step_order integer, title text, instructions text, active_duration_minutes numeric,
    passive_duration_minutes numeric, attention_points text, observation text
  );

  insert into stock.recipe_validation_history(recipe_id, action, actor_id, metadata)
  values (v_recipe_id, 'version_created', v_actor, jsonb_build_object(
    'parent_recipe_id', v_parent.id,
    'parent_version', v_parent.version,
    'version', v_version,
    'provisional_prices_carried', (
      select count(*) from stock.recipe_ingredient_provisional_prices
      where recipe_id = v_recipe_id and copied_from_recipe_id = v_parent.id
    )
  ));

  return v_recipe_id;
end;
$$;

revoke all on function stock.create_recipe_version(uuid, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function stock.create_recipe_version(uuid, jsonb, jsonb, jsonb)
  to authenticated;

commit;
