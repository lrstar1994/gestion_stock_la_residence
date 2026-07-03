create schema if not exists stock;
set search_path = stock, public, auth;

-- Migration Phase 1.2
-- Module : Articles, familles, unites et localisations

create type stock.article_status as enum ('active', 'inactive', 'archived');

create or replace function stock.can_current_user_manage_catalog()
returns boolean
language sql
security definer
set search_path = stock, public, auth
stable
as $$
  select exists (
    select 1
    from stock.profiles
    where user_id = auth.uid()
      and role in ('direction', 'chef_cuisine', 'magasinier', 'acheteur')
      and status = 'active'
  );
$$;

create table stock.families (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  created_by uuid references stock.profiles(id)
);

alter table stock.families enable row level security;

create policy "Directors can manage families"
  on stock.families for all
  using (stock.is_current_user_direction())
  with check (stock.is_current_user_direction());

create policy "All users can view families"
  on stock.families for select
  using (auth.uid() is not null);

create trigger update_families_updated_at
  before update on stock.families
  for each row
  execute function stock.update_updated_at_column();

create table stock.units (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  abbreviation text not null unique,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  created_by uuid references stock.profiles(id)
);

alter table stock.units enable row level security;

create policy "Directors can manage units"
  on stock.units for all
  using (stock.is_current_user_direction())
  with check (stock.is_current_user_direction());

create policy "All users can view units"
  on stock.units for select
  using (auth.uid() is not null);

create trigger update_units_updated_at
  before update on stock.units
  for each row
  execute function stock.update_updated_at_column();

create table stock.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_magasin_general boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  created_by uuid references stock.profiles(id)
);

alter table stock.locations enable row level security;

create policy "Directors can manage locations"
  on stock.locations for all
  using (stock.is_current_user_direction())
  with check (stock.is_current_user_direction());

create policy "All users can view locations"
  on stock.locations for select
  using (auth.uid() is not null);

create trigger update_locations_updated_at
  before update on stock.locations
  for each row
  execute function stock.update_updated_at_column();

create table stock.articles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  family_id uuid references stock.families(id) not null,
  sub_family text,
  unit_id uuid references stock.units(id) not null,
  packaging text,
  default_supplier text,
  min_stock decimal(10, 2) default 0,
  status stock.article_status default 'active',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  created_by uuid references stock.profiles(id),
  updated_by uuid references stock.profiles(id)
);

create index idx_articles_family_id on stock.articles(family_id);
create index idx_articles_unit_id on stock.articles(unit_id);
create index idx_articles_status on stock.articles(status);
create index idx_articles_name on stock.articles(name);

alter table stock.articles enable row level security;

create policy "Catalog managers can manage articles"
  on stock.articles for all
  using (stock.can_current_user_manage_catalog())
  with check (stock.can_current_user_manage_catalog());

create policy "All users can view articles"
  on stock.articles for select
  using (auth.uid() is not null);

create trigger update_articles_updated_at
  before update on stock.articles
  for each row
  execute function stock.update_updated_at_column();

create table stock.article_locations (
  id uuid primary key default gen_random_uuid(),
  article_id uuid references stock.articles(id) on delete cascade not null,
  location_id uuid references stock.locations(id) on delete cascade not null,
  created_at timestamp with time zone default now(),
  unique(article_id, location_id)
);

create index idx_article_locations_article_id on stock.article_locations(article_id);
create index idx_article_locations_location_id on stock.article_locations(location_id);

alter table stock.article_locations enable row level security;

create policy "Users can view article locations"
  on stock.article_locations for select
  using (auth.uid() is not null);

create policy "Catalog managers can manage article locations"
  on stock.article_locations for all
  using (stock.can_current_user_manage_catalog())
  with check (stock.can_current_user_manage_catalog());

-- Catégories
INSERT INTO stock.families (name)
VALUES
  ('épicerie'),
  ('produits frais'),
  ('boissons'),
  ('fruits'),
  ('légumes'),
  ('viandes'),
  ('FDM'),
  ('charcuterie'),
  ('produits laitiers'),
  ('café'),
  ('emballages'),
  ('energie'),
  ('matériels'),
  ('peinture'),
  ('produits d''entretien'),
  ('produits nettoyage'),
  ('produits phytosanitaire'),
  ('quincaillerie'),
  ('thé'),
  ('vin'),
  ('déco')
ON CONFLICT (name) DO NOTHING;


-- Sous-catégories
WITH data(category, sub_category) AS (
  VALUES
    ('épicerie', 'épices'),
    ('épicerie', 'conserves'),
    ('épicerie', 'patisserie'),
    ('épicerie', 'aromes'),
    ('épicerie', 'condiments'),
    ('épicerie', 'huile'),
    ('épicerie', 'farine'),
    ('épicerie', 'sauces'),
    ('épicerie', 'chocolat'),
    ('épicerie', 'café'),
    ('épicerie', 'divers'),
    ('épicerie', 'féculents'),
    ('épicerie', 'colorants'),
    ('épicerie', 'riz'),
    ('épicerie', 'sucre'),
    ('épicerie', 'thé'),

    ('produits frais', 'œufs'),

    ('boissons', 'alcools'),
    ('boissons', 'sirops'),
    ('boissons', 'Bières'),
    ('boissons', 'eau minérale'),
    ('boissons', 'gazeuses GM'),
    ('boissons', 'gazeuses PM'),
    ('boissons', 'jus'),

    ('fruits', 'fruits secs'),
    ('fruits', 'fruits'),

    ('légumes', 'brèdes'),
    ('légumes', 'aromates'),
    ('légumes', 'condiments'),
    ('légumes', 'féculents'),

    ('viandes', 'volailles'),
    ('viandes', 'zébu'),
    ('viandes', 'porc'),
    ('viandes', 'mouton'),

    ('FDM', 'filet de poisson'),
    ('FDM', 'poisson entier'),
    ('FDM', 'poisson en tranches'),
    ('FDM', 'crevettes'),
    ('FDM', 'calmars/encornets'),
    ('FDM', 'autres'),
    ('FDM', 'poisson entier PM'),

    ('charcuterie', 'porc'),
    ('charcuterie', 'bœuf'),
    ('charcuterie', 'volailles'),

    ('produits laitiers', 'beurre/margarine'),
    ('produits laitiers', 'lait'),
    ('produits laitiers', 'fromages'),
    ('produits laitiers', 'yaourts'),
    ('produits laitiers', 'autres'),
    ('produits laitiers', 'crème'),

    ('café', 'expresso'),

    ('emballages', 'boites'),
    ('emballages', 'couverts'),
    ('emballages', 'déco'),
    ('emballages', 'divers'),
    ('emballages', 'plaques'),
    ('emballages', 'sachets'),
    ('emballages', 'sacs poubelles'),

    ('energie', 'alcool à bruler'),
    ('energie', 'charbon'),
    ('energie', 'gaz'),

    ('matériels', 'cuisine'),
    ('matériels', 'divers'),
    ('matériels', 'internet'),
    ('matériels', 'jardin'),
    ('matériels', 'ménage'),
    ('matériels', 'travaux'),
    ('matériels', 'peinture'),
    ('matériels', 'sanitaires'),

    ('peinture', 'spray'),
    ('peinture', 'à l''eau'),
    ('peinture', 'à l''huile'),
    ('peinture', 'antirouille'),
    ('peinture', 'vernis'),
    ('peinture', 'teintes'),
    ('peinture', 'enduits'),

    ('produits d''entretien', 'peinture'),
    ('produits d''entretien', 'piscine'),

    ('produits nettoyage', 'accueil'),
    ('produits nettoyage', 'lingerie'),
    ('produits nettoyage', 'locaux'),
    ('produits nettoyage', 'piscine'),
    ('produits nettoyage', 'vaisselle'),
    ('produits nettoyage', 'voiture'),

    ('produits phytosanitaire', 'anti-mousiques'),
    ('produits phytosanitaire', 'anti-rats'),
    ('produits phytosanitaire', 'anti-mouches'),

    ('quincaillerie', 'électricité'),
    ('quincaillerie', 'étanchéité'),
    ('quincaillerie', 'fers'),
    ('quincaillerie', 'menuiserie'),
    ('quincaillerie', 'plomberie'),
    ('quincaillerie', 'visserie'),
    ('quincaillerie', 'divers'),
    ('quincaillerie', 'constructions'),

    ('thé', 'thé'),

    ('vin', 'blancs'),
    ('vin', 'blancs au verre'),
    ('vin', 'rouges'),
    ('vin', 'rouges au verre'),

    ('déco', 'alimentaire'),
    ('déco', 'non alimentaire')
)
INSERT INTO stock.sub_categories (family_id, name)
SELECT f.id, d.sub_category
FROM data d
JOIN stock.families f ON f.name = d.category
ON CONFLICT (family_id, name) DO NOTHING;

insert into stock.units (name, abbreviation) values
  ('Kilogramme', 'kg'),
  ('Gramme', 'g'),
  ('Litre', 'L'),
  ('Millilitre', 'mL'),
  ('Piece', 'pc'),
  ('Boite', 'boite'),
  ('Sac', 'sac'),
  ('Bouteille', 'bouteille'),
  ('Carton', 'carton'),
  ('Barquette', 'barquette'),
  ('Portion', 'portion')
on conflict (abbreviation) do nothing;

insert into stock.locations (name, description, is_magasin_general) values
  ('Magasin general', 'Localisation centrale de reception et de stockage', true),
  ('Chambre froide', 'Stockage refrigere', false),
  ('Cuisine', 'Cuisine principale', false),
  ('Patisserie', 'Atelier patisserie', false),
  ('Le Privilege', 'Point de vente restaurant', false),
  ('Piscine', 'Point de vente piscine', false),
  ('Reception', 'Accueil et reception', false),
  ('Chambres', 'Stock chambres', false),
  ('Maintenance', 'Stock maintenance', false),
  ('Administration', 'Stock administratif', false)
on conflict (name) do nothing;
