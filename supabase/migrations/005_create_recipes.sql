create schema if not exists stock;
set search_path = stock, public, auth;

-- Migration Phase 1.5
-- Module : Fiches techniques, recettes et import Excel

create type stock.recipe_type as enum (
  'EF', 'EC', 'PL', 'ACC', 'DS', 'PC-S', 'PC-SU',
  'CO-S', 'CO-SU', 'SAU', 'PREP', 'BOI', 'BF'
);

create type stock.recipe_main_ingredient as enum (
  'POU', 'ZEB', 'POR', 'POI', 'CRV', 'OEU',
  'LEG', 'FEC', 'FRO', 'FRU', 'CHO', 'VAN', 'MIX'
);

create type stock.recipe_status as enum (
  'brouillon', 'simulation', 'en_attente', 'validee', 'archived'
);

create type stock.recipe_tag as enum (
  'economique', 'festif', 'malagasy', 'enfant',
  'vegetarien', 'tres_apprecie', 'ameliorer'
);

create type stock.pending_ingredient_status as enum (
  'pending', 'resolved', 'ambiguous', 'new_created'
);

create or replace function stock.can_current_user_manage_recipes()
returns boolean
language sql
security definer
set search_path = stock, public, auth
stable
as $$
  select exists (
    select 1 from stock.profiles
    where user_id = auth.uid()
      and role in ('direction', 'chef_cuisine', 'fiche_technique')
      and status = 'active'
  );
$$;

create table stock.recipes (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name text not null,
  type stock.recipe_type not null,
  sub_type text,
  main_ingredient stock.recipe_main_ingredient not null,
  portions integer default 1,
  description text,
  tags stock.recipe_tag[] default '{}',
  total_cost decimal(10, 2) default 0,
  cost_per_portion decimal(10, 2) default 0,
  suggested_price decimal(10, 2) default 0,
  final_price decimal(10, 2) default 0,
  cost_ratio decimal(5, 2) default 0,
  margin_rate decimal(5, 2) default 0,
  margin_coefficient decimal(5, 2) default 3,
  status stock.recipe_status default 'brouillon',
  version integer default 1,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  created_by uuid references stock.profiles(id),
  updated_by uuid references stock.profiles(id),
  validated_by uuid references stock.profiles(id),
  validated_at timestamp with time zone,
  archived_at timestamp with time zone,
  parent_version_id uuid references stock.recipes(id)
);

alter table stock.recipes enable row level security;

create policy "Recipe managers can manage recipes"
  on stock.recipes for all
  using (stock.can_current_user_manage_recipes())
  with check (stock.can_current_user_manage_recipes());

create policy "All active users can view recipes"
  on stock.recipes for select
  using (auth.uid() is not null);

create trigger update_recipes_updated_at
  before update on stock.recipes
  for each row execute function stock.update_updated_at_column();

create table stock.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid references stock.recipes(id) on delete cascade not null,
  article_id uuid references stock.articles(id),
  imported_name text,
  quantity decimal(10, 2) not null,
  unit_id uuid references stock.units(id),
  unit_name text,
  unit_price decimal(10, 2) not null,
  total_cost decimal(10, 2) default 0,
  resolution_status stock.pending_ingredient_status default 'resolved',
  sort_order integer default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table stock.recipe_ingredients enable row level security;

create policy "Users can view recipe ingredients"
  on stock.recipe_ingredients for select
  using (auth.uid() is not null);

create policy "Recipe managers can manage recipe ingredients"
  on stock.recipe_ingredients for all
  using (stock.can_current_user_manage_recipes())
  with check (stock.can_current_user_manage_recipes());

create trigger update_recipe_ingredients_updated_at
  before update on stock.recipe_ingredients
  for each row execute function stock.update_updated_at_column();

create table stock.pending_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid references stock.recipes(id) on delete cascade not null,
  imported_name text not null,
  quantity decimal(10, 2) not null,
  unit_name text not null,
  unit_price decimal(10, 2) not null,
  status stock.pending_ingredient_status default 'pending',
  resolved_article_id uuid references stock.articles(id),
  candidate_article_ids uuid[] default '{}',
  created_by uuid references stock.profiles(id),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table stock.pending_ingredients enable row level security;

create policy "Users can view pending ingredients"
  on stock.pending_ingredients for select
  using (auth.uid() is not null);

create policy "Recipe managers can manage pending ingredients"
  on stock.pending_ingredients for all
  using (stock.can_current_user_manage_recipes())
  with check (stock.can_current_user_manage_recipes());

create trigger update_pending_ingredients_updated_at
  before update on stock.pending_ingredients
  for each row execute function stock.update_updated_at_column();

create or replace function stock.generate_recipe_code()
returns trigger as $$
declare
  max_num integer;
  next_num text;
begin
  if new.status = 'validee' and new.code is null then
    select coalesce(max(cast(substring(code from 8) as integer)), 0) + 1
    into max_num
    from stock.recipes
    where type = new.type
      and main_ingredient = new.main_ingredient
      and status = 'validee'
      and code is not null;

    next_num = lpad(max_num::text, 3, '0');
    new.code = new.type || '-' || new.main_ingredient || '-' || next_num;
  end if;

  return new;
end;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = stock, public, auth;

create trigger generate_recipe_code_before_insert
  before insert on stock.recipes
  for each row execute function stock.generate_recipe_code();

create trigger generate_recipe_code_before_update
  before update of status on stock.recipes
  for each row execute function stock.generate_recipe_code();

create or replace function stock.set_recipe_ingredient_total()
returns trigger as $$
begin
  new.total_cost = new.quantity * new.unit_price;
  return new;
end;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = stock, public, auth;

create trigger set_recipe_ingredient_total_trigger
  before insert or update on stock.recipe_ingredients
  for each row execute function stock.set_recipe_ingredient_total();

create or replace function stock.recalculate_recipe_costs(recipe_uuid uuid)
returns void as $$
declare
  total decimal(10, 2) := 0;
  recipe_record record;
  suggested decimal(10, 2) := 0;
begin
  select * into recipe_record from stock.recipes where id = recipe_uuid;

  select coalesce(sum(total_cost), 0) into total
  from stock.recipe_ingredients
  where recipe_id = recipe_uuid;

  suggested = total * coalesce(recipe_record.margin_coefficient, 3);

  update stock.recipes
  set
    total_cost = total,
    cost_per_portion = total / nullif(portions, 0),
    suggested_price = suggested,
    cost_ratio = case when final_price > 0 then (total / final_price) * 100 else 0 end,
    margin_rate = case when final_price > 0 then ((final_price - total) / final_price) * 100 else 0 end
  where id = recipe_uuid;
end;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = stock, public, auth;

create or replace function stock.recalculate_recipe_costs_trigger()
returns trigger as $$
begin
  perform stock.recalculate_recipe_costs(coalesce(new.recipe_id, old.recipe_id));
  return coalesce(new, old);
end;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = stock, public, auth;

create trigger recalculate_recipe_costs_after_ingredient_change
  after insert or update or delete on stock.recipe_ingredients
  for each row execute function stock.recalculate_recipe_costs_trigger();

create index idx_recipes_code on stock.recipes(code);
create index idx_recipes_type on stock.recipes(type);
create index idx_recipes_status on stock.recipes(status);
create index idx_recipes_main_ingredient on stock.recipes(main_ingredient);
create index idx_recipe_ingredients_recipe_id on stock.recipe_ingredients(recipe_id);
create index idx_recipe_ingredients_article_id on stock.recipe_ingredients(article_id);
create index idx_pending_ingredients_recipe_id on stock.pending_ingredients(recipe_id);
create index idx_pending_ingredients_status on stock.pending_ingredients(status);
