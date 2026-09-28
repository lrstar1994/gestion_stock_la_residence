-- Lot A5 - import Excel FT, métadonnées de rapprochement et alias confirmés. Local uniquement.
begin;

alter table stock.pending_ingredients
  add column if not exists quantity_mode text,
  add column if not exists trim_form_name text,
  add column if not exists imported_indicative_price numeric(14,2),
  add column if not exists import_observation text;

alter table stock.recipes
  add column if not exists import_observation text;

alter table stock.recipe_ingredients
  add column if not exists imported_indicative_price numeric(14,2),
  add column if not exists import_observation text;

alter table stock.pending_ingredients
  add constraint pending_ingredients_quantity_mode_chk
  check (quantity_mode is null or quantity_mode in ('brut','net'));

create table if not exists stock.recipe_import_aliases (
  id uuid primary key default gen_random_uuid(),
  source_label text not null,
  normalized_label text not null,
  article_id uuid not null references stock.articles(id) on delete restrict,
  is_active boolean not null default true,
  created_by uuid references stock.profiles(id) on delete set null,
  updated_by uuid references stock.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (nullif(btrim(source_label), '') is not null),
  check (nullif(btrim(normalized_label), '') is not null)
);

create unique index if not exists recipe_import_aliases_active_label_uidx
  on stock.recipe_import_aliases(normalized_label) where is_active;
create index if not exists recipe_import_aliases_article_idx
  on stock.recipe_import_aliases(article_id) where is_active;

drop trigger if exists recipe_import_aliases_updated_at on stock.recipe_import_aliases;
create trigger recipe_import_aliases_updated_at
before update on stock.recipe_import_aliases
for each row execute function stock.update_updated_at_column();

alter table stock.recipe_import_aliases enable row level security;
drop policy if exists recipe_import_aliases_read on stock.recipe_import_aliases;
create policy recipe_import_aliases_read on stock.recipe_import_aliases
for select to authenticated using (true);
drop policy if exists recipe_import_aliases_manage on stock.recipe_import_aliases;
create policy recipe_import_aliases_manage on stock.recipe_import_aliases
for all to authenticated
using (stock.can_current_user_manage_recipes())
with check (stock.can_current_user_manage_recipes());

revoke all on stock.recipe_import_aliases from public, anon;
grant select, insert, update on stock.recipe_import_aliases to authenticated;

create or replace function stock.import_recipe_draft(
  p_recipe jsonb,
  p_ingredients jsonb,
  p_pending jsonb,
  p_steps jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, stock, auth, extensions
as $$
declare
  v_profile_id uuid;
  v_recipe_id uuid;
begin
  if not stock.can_current_user_manage_recipes() then
    raise exception 'Vous n êtes pas autorisé à importer des fiches techniques';
  end if;
  v_profile_id := stock.current_profile_id();
  if v_profile_id is null then raise exception 'Profil actif introuvable'; end if;

  insert into stock.recipes(
    code, name, type, main_ingredient, portions, description, tags,
    total_cost, cost_per_portion, suggested_price, final_price,
    margin_coefficient, status, yield_mode, yield_quantity, yield_unit_id,
    retained_sale_price_ttc, workflow_status, import_observation, created_by, updated_by
  ) values (
    nullif(btrim(p_recipe ->> 'code'), ''), p_recipe ->> 'name',
    (p_recipe ->> 'type')::stock.recipe_type,
    (p_recipe ->> 'main_ingredient')::stock.recipe_main_ingredient,
    (p_recipe ->> 'portions')::integer, nullif(p_recipe ->> 'description', ''),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_recipe -> 'tags', '[]'::jsonb)))::stock.recipe_tag[], '{}'::stock.recipe_tag[]),
    0, 0, 0, 0,
    3, 'brouillon', p_recipe ->> 'yield_mode',
    (p_recipe ->> 'yield_quantity')::numeric, (p_recipe ->> 'yield_unit_id')::uuid,
    null, 'draft',
    nullif(p_recipe ->> 'import_observation', ''), v_profile_id, v_profile_id
  ) returning id into v_recipe_id;

  insert into stock.recipe_ingredients(
    recipe_id, article_id, imported_name, quantity, unit_id, unit_name,
    unit_price, total_cost, resolution_status, sort_order,
    quantity_display, unit_display, quantity_stored, unit_stored,
    conversion_factor, is_net_quantity, quantity_mode, trim_form_id,
    yield_percent_snapshot, line_kind, imported_indicative_price, import_observation
  )
  select v_recipe_id, x.article_id, x.imported_name, x.quantity_stored,
    x.unit_id, x.unit_name, null, 0, 'resolved', x.sort_order,
    x.quantity_display, x.unit_id, x.quantity_stored, x.unit_stored,
    x.conversion_factor, x.quantity_mode = 'net', x.quantity_mode,
    x.trim_form_id, x.yield_percent_snapshot, 'article',
    x.imported_indicative_price, x.import_observation
  from jsonb_to_recordset(coalesce(p_ingredients, '[]'::jsonb)) as x(
    article_id uuid, imported_name text, quantity_display numeric,
    quantity_stored numeric, unit_id uuid, unit_stored uuid, unit_name text,
    conversion_factor numeric, quantity_mode text, trim_form_id uuid,
    yield_percent_snapshot numeric, sort_order integer,
    imported_indicative_price numeric, import_observation text
  );

  insert into stock.pending_ingredients(
    recipe_id, imported_name, quantity, unit_name, unit_price, status,
    candidate_article_ids, created_by, quantity_mode, trim_form_name,
    imported_indicative_price, import_observation
  )
  select v_recipe_id, x.imported_name, x.quantity, x.unit_name, 0,
    x.status::stock.pending_ingredient_status, coalesce(x.candidate_article_ids, '{}'),
    v_profile_id, x.quantity_mode, x.trim_form_name,
    x.imported_indicative_price, x.import_observation
  from jsonb_to_recordset(coalesce(p_pending, '[]'::jsonb)) as x(
    imported_name text, quantity numeric, unit_name text, status text,
    candidate_article_ids uuid[], quantity_mode text, trim_form_name text,
    imported_indicative_price numeric, import_observation text
  );

  insert into stock.recipe_steps(
    recipe_id, step_order, title, instructions, active_duration_minutes,
    passive_duration_minutes, attention_points, observation, created_by, updated_by
  )
  select v_recipe_id, x.step_order, x.title, x.instructions,
    x.active_duration_minutes, x.passive_duration_minutes,
    x.attention_points, x.observation, v_profile_id, v_profile_id
  from jsonb_to_recordset(coalesce(p_steps, '[]'::jsonb)) as x(
    step_order integer, title text, instructions text,
    active_duration_minutes numeric, passive_duration_minutes numeric,
    attention_points text, observation text
  );

  return v_recipe_id;
end;
$$;

revoke all on function stock.import_recipe_draft(jsonb,jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function stock.import_recipe_draft(jsonb,jsonb,jsonb,jsonb) to authenticated;

commit;
