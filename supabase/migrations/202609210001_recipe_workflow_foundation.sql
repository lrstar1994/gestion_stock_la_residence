-- Lot A - Fiches techniques / recettes. Additive local migration; not deployed by this change.
begin;

alter table stock.recipes
  add column if not exists yield_mode text not null default 'portions',
  add column if not exists yield_quantity numeric(14,3),
  add column if not exists yield_unit_id uuid,
  add column if not exists material_cost_ht numeric(14,2) not null default 0,
  add column if not exists theoretical_sale_price_ttc numeric(14,2) not null default 0,
  add column if not exists retained_sale_price_ttc numeric(14,2),
  add column if not exists retained_sale_price_reason text,
  add column if not exists workflow_status text,
  add column if not exists chef_validated_by uuid,
  add column if not exists chef_validated_at timestamptz,
  add column if not exists direction_validated_by uuid,
  add column if not exists direction_validated_at timestamptz,
  add column if not exists validation_comment text,
  add column if not exists dressing_photo_url text,
  add column if not exists dressing_photo_alt text;

alter table stock.recipes
  add constraint recipes_yield_mode_chk check (yield_mode in ('portions', 'rendement_produit')),
  add constraint recipes_yield_quantity_chk check (yield_quantity is null or yield_quantity > 0),
  add constraint recipes_workflow_status_chk check (workflow_status is null or workflow_status in ('draft','submitted','direction_review','approved','refused','to_produce'));

do $$ begin
  alter table stock.recipes add constraint recipes_yield_unit_id_fkey foreign key (yield_unit_id) references stock.units(id) on delete restrict;
exception when duplicate_object then null; end $$;

alter table stock.recipe_ingredients
  add column if not exists is_net_quantity boolean not null default false,
  add column if not exists quantity_mode text not null default 'brut',
  add column if not exists trim_form_id uuid,
  add column if not exists yield_percent_snapshot numeric(7,3),
  add column if not exists normalized_unit_price numeric(14,2),
  add column if not exists price_source_type text,
  add column if not exists price_source_id uuid,
  add column if not exists price_effective_at timestamptz,
  add column if not exists subrecipe_id uuid;

alter table stock.recipe_ingredients alter column article_id drop not null;
alter table stock.recipe_ingredients alter column unit_id drop not null;
alter table stock.recipe_ingredients alter column unit_price drop not null;
alter table stock.recipe_ingredients
  add constraint recipe_ingredients_article_or_subrecipe_chk check (article_id is not null or subrecipe_id is not null),
  add constraint recipe_ingredients_yield_snapshot_chk check (yield_percent_snapshot is null or (yield_percent_snapshot > 0 and yield_percent_snapshot <= 100)),
  add constraint recipe_ingredients_quantity_mode_chk check (quantity_mode in ('brut','net'));

do $$ begin
  alter table stock.recipe_ingredients add constraint recipe_ingredients_subrecipe_id_fkey foreign key (subrecipe_id) references stock.recipes(id) on delete restrict;
exception when duplicate_object then null; end $$;

create table if not exists stock.recipe_trim_forms (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references stock.articles(id) on delete restrict,
  name text not null,
  yield_percent numeric(7,3) not null check (yield_percent > 0 and yield_percent <= 100),
  notes text,
  is_active boolean not null default true,
  created_by uuid references stock.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  alter table stock.recipe_ingredients add constraint recipe_ingredients_trim_form_id_fkey foreign key (trim_form_id) references stock.recipe_trim_forms(id) on delete restrict;
exception when duplicate_object then null; end $$;

create unique index if not exists recipe_trim_forms_article_name_uidx on stock.recipe_trim_forms(article_id, lower(name));
create index if not exists recipe_trim_forms_article_idx on stock.recipe_trim_forms(article_id) where is_active;

create table if not exists stock.recipe_steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references stock.recipes(id) on delete cascade,
  step_order integer not null check (step_order > 0),
  title text not null,
  instructions text not null,
  duration_minutes numeric(8,2),
  temperature_c numeric(8,2),
  attention_points text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(recipe_id, step_order)
);

create table if not exists stock.recipe_validation_history (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references stock.recipes(id) on delete cascade,
  action text not null check (action in ('submitted','chef_validated','direction_validated','refused','archived')),
  actor_id uuid references stock.profiles(id) on delete set null,
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists recipe_steps_recipe_idx on stock.recipe_steps(recipe_id, step_order);
create index if not exists recipe_validation_history_recipe_idx on stock.recipe_validation_history(recipe_id, created_at desc);

drop trigger if exists recipe_trim_forms_updated_at on stock.recipe_trim_forms;
create trigger recipe_trim_forms_updated_at before update on stock.recipe_trim_forms for each row execute function stock.update_updated_at_column();
drop trigger if exists recipe_steps_updated_at on stock.recipe_steps;
create trigger recipe_steps_updated_at before update on stock.recipe_steps for each row execute function stock.update_updated_at_column();

grant select on stock.recipe_trim_forms, stock.recipe_steps, stock.recipe_validation_history to authenticated;
grant insert, update, delete on stock.recipe_trim_forms, stock.recipe_steps to authenticated;
grant insert on stock.recipe_validation_history to authenticated;
revoke all on stock.recipe_trim_forms, stock.recipe_steps, stock.recipe_validation_history from anon, public;

alter table stock.recipe_trim_forms enable row level security;
alter table stock.recipe_steps enable row level security;
alter table stock.recipe_validation_history enable row level security;

drop policy if exists recipe_trim_forms_read_active on stock.recipe_trim_forms;
create policy recipe_trim_forms_read_active on stock.recipe_trim_forms for select to authenticated using (is_active or stock.is_current_user_direction());
drop policy if exists recipe_trim_forms_manage on stock.recipe_trim_forms;
create policy recipe_trim_forms_manage on stock.recipe_trim_forms for all to authenticated using (stock.can_current_user_manage_recipes()) with check (stock.can_current_user_manage_recipes());
drop policy if exists recipe_steps_read on stock.recipe_steps;
create policy recipe_steps_read on stock.recipe_steps for select to authenticated using (true);
drop policy if exists recipe_steps_manage on stock.recipe_steps;
create policy recipe_steps_manage on stock.recipe_steps for all to authenticated using (stock.can_current_user_manage_recipes()) with check (stock.can_current_user_manage_recipes());
drop policy if exists recipe_validation_history_read on stock.recipe_validation_history;
create policy recipe_validation_history_read on stock.recipe_validation_history for select to authenticated using (true);
drop policy if exists recipe_validation_history_insert on stock.recipe_validation_history;
create policy recipe_validation_history_insert on stock.recipe_validation_history for insert to authenticated with check (actor_id = stock.current_profile_id());

commit;
