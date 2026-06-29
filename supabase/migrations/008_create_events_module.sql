create schema if not exists stock;
set search_path = stock, public, auth;

-- Migration : evenements, menus, buffets, besoins d'achat et production

create type stock.event_type as enum (
  'buffet', 'brunch', 'seminaire', 'business_lunch',
  'cocktail', 'take_away', 'patisserie', 'autre'
);

create type stock.event_status as enum (
  'planifie', 'en_production', 'termine', 'annule'
);

create type stock.service_type as enum ('assiette', 'buffet');
create type stock.interest_level as enum ('tres_demande', 'normal', 'complement', 'decouverte', 'appoint', 'condiment');
create type stock.purchase_need_status as enum ('a_faire', 'en_cours', 'termine', 'annule');

create table stock.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type stock.event_type not null,
  date timestamp with time zone not null,
  location text,
  description text,
  adults integer not null,
  children integer default 0,
  child_coefficient decimal(5, 2) default 0.5,
  total_equivalent decimal(10, 2),
  safety_margin decimal(5, 2) default 10,
  status stock.event_status default 'planifie',
  total_estimated_cost decimal(14, 2) default 0,
  total_real_cost decimal(14, 2) default 0,
  total_estimated_price decimal(14, 2) default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  created_by uuid references stock.profiles(id),
  updated_by uuid references stock.profiles(id)
);

alter table stock.events enable row level security;

create policy "Event managers can manage events"
  on stock.events for all
  using (
    exists (
      select 1 from stock.profiles
      where profiles.user_id = auth.uid()
        and profiles.role in ('direction', 'chef_cuisine', 'fiche_technique')
        and profiles.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from stock.profiles
      where profiles.user_id = auth.uid()
        and profiles.role in ('direction', 'chef_cuisine', 'fiche_technique')
        and profiles.status = 'active'
    )
  );

create policy "All active users can view events"
  on stock.events for select
  using (auth.uid() is not null);

create trigger update_events_updated_at
  before update on stock.events
  for each row execute function stock.update_updated_at_column();

create table stock.event_recipes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references stock.events(id) on delete cascade not null,
  recipe_id uuid references stock.recipes(id) not null,
  service_type stock.service_type default 'buffet',
  interest_level stock.interest_level default 'normal',
  suggested_coefficient decimal(7, 2),
  selected_coefficient decimal(7, 2),
  coefficient_modification_reason text,
  coefficient_modified_by uuid references stock.profiles(id),
  coefficient_modified_at timestamp with time zone,
  portions_planned decimal(10, 2),
  portions_produced decimal(10, 2) default 0,
  portions_consumed decimal(10, 2) default 0,
  portions_returned decimal(10, 2) default 0,
  portions_lost decimal(10, 2) default 0,
  portions_unsold decimal(10, 2) default 0,
  portions_additional decimal(10, 2) default 0,
  estimated_cost decimal(14, 2) default 0,
  real_cost decimal(14, 2) default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table stock.event_recipes enable row level security;

create policy "Event managers can manage event recipes"
  on stock.event_recipes for all
  using (
    exists (
      select 1 from stock.profiles
      where profiles.user_id = auth.uid()
        and profiles.role in ('direction', 'chef_cuisine', 'fiche_technique')
        and profiles.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from stock.profiles
      where profiles.user_id = auth.uid()
        and profiles.role in ('direction', 'chef_cuisine', 'fiche_technique')
        and profiles.status = 'active'
    )
  );

create policy "All active users can view event recipes"
  on stock.event_recipes for select
  using (auth.uid() is not null);

create trigger update_event_recipes_updated_at
  before update on stock.event_recipes
  for each row execute function stock.update_updated_at_column();

create table stock.buffet_coefficients (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  number_of_items integer not null,
  interest_level stock.interest_level not null,
  min_coefficient decimal(7, 2) not null,
  max_coefficient decimal(7, 2) not null,
  default_coefficient decimal(7, 2) not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  created_by uuid references stock.profiles(id)
);

alter table stock.buffet_coefficients enable row level security;

create policy "Chef and direction can manage buffet coefficients"
  on stock.buffet_coefficients for all
  using (
    exists (
      select 1 from stock.profiles
      where profiles.user_id = auth.uid()
        and profiles.role in ('direction', 'chef_cuisine')
        and profiles.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from stock.profiles
      where profiles.user_id = auth.uid()
        and profiles.role in ('direction', 'chef_cuisine')
        and profiles.status = 'active'
    )
  );

create policy "All active users can view buffet coefficients"
  on stock.buffet_coefficients for select
  using (auth.uid() is not null);

create trigger update_buffet_coefficients_updated_at
  before update on stock.buffet_coefficients
  for each row execute function stock.update_updated_at_column();

create table stock.purchase_needs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references stock.events(id) on delete cascade not null,
  article_id uuid references stock.articles(id) not null,
  quantity_needed decimal(14, 4) not null,
  unit_id uuid references stock.units(id) not null,
  estimated_cost decimal(14, 2) default 0,
  status stock.purchase_need_status default 'a_faire',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  created_by uuid references stock.profiles(id)
);

alter table stock.purchase_needs enable row level security;

create policy "Purchase staff can manage purchase needs"
  on stock.purchase_needs for all
  using (
    exists (
      select 1 from stock.profiles
      where profiles.user_id = auth.uid()
        and profiles.role in ('direction', 'chef_cuisine', 'magasinier')
        and profiles.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from stock.profiles
      where profiles.user_id = auth.uid()
        and profiles.role in ('direction', 'chef_cuisine', 'magasinier')
        and profiles.status = 'active'
    )
  );

create policy "All active users can view purchase needs"
  on stock.purchase_needs for select
  using (auth.uid() is not null);

create trigger update_purchase_needs_updated_at
  before update on stock.purchase_needs
  for each row execute function stock.update_updated_at_column();

create index idx_events_date on stock.events(date);
create index idx_events_type on stock.events(type);
create index idx_events_status on stock.events(status);
create index idx_event_recipes_event_id on stock.event_recipes(event_id);
create index idx_event_recipes_recipe_id on stock.event_recipes(recipe_id);
create index idx_purchase_needs_event_id on stock.purchase_needs(event_id);
create index idx_purchase_needs_article_id on stock.purchase_needs(article_id);

insert into stock.buffet_coefficients (category, number_of_items, interest_level, min_coefficient, max_coefficient, default_coefficient) values
  ('plat', 1, 'tres_demande', 90, 100, 95),
  ('plat', 1, 'normal', 80, 90, 85),
  ('plat', 2, 'tres_demande', 55, 65, 60),
  ('plat', 2, 'normal', 40, 55, 48),
  ('plat', 2, 'complement', 30, 40, 35),
  ('plat', 3, 'tres_demande', 45, 55, 50),
  ('plat', 3, 'normal', 30, 40, 35),
  ('plat', 3, 'complement', 20, 30, 25),
  ('plat', 3, 'decouverte', 15, 25, 20),
  ('plat', 4, 'tres_demande', 35, 45, 40),
  ('plat', 4, 'normal', 25, 35, 30),
  ('plat', 4, 'complement', 15, 25, 20),
  ('plat', 4, 'decouverte', 10, 20, 15),
  ('entree', 2, 'normal', 60, 70, 65),
  ('entree', 3, 'normal', 60, 70, 65),
  ('entree', 4, 'normal', 40, 50, 45),
  ('entree', 5, 'normal', 40, 50, 45),
  ('entree', 6, 'normal', 30, 40, 35),
  ('dessert', 2, 'normal', 50, 60, 55),
  ('dessert', 3, 'normal', 50, 60, 55),
  ('dessert', 4, 'normal', 35, 45, 40),
  ('dessert', 5, 'normal', 35, 45, 40),
  ('dessert', 6, 'normal', 25, 35, 30),
  ('amuse', 3, 'normal', 70, 80, 75),
  ('amuse', 4, 'normal', 70, 80, 75),
  ('amuse', 5, 'normal', 50, 60, 55),
  ('amuse', 8, 'normal', 50, 60, 55),
  ('amuse', 9, 'normal', 40, 50, 45);
