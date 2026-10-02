-- ISOLATED LOCAL DATABASE ONLY. Minimal dependency fixture, not a production schema.
-- The runner imports the actual repository RES-1, access helpers and physical view.
create role postgres login nosuperuser bypassrls;
create role anon nologin nosuperuser nobypassrls;
create role authenticated nologin nosuperuser nobypassrls;
-- Test harness only: the non-superuser owner may impersonate client roles.
-- No privilege inheritance; neither client role gains membership in postgres.
-- anon is also exercised by the existing negative ACL tests.
grant authenticated, anon to postgres with inherit false, set true;
grant create on database postgres to postgres;
create schema extensions authorization postgres;
create extension pgcrypto with schema extensions;
create schema auth authorization postgres;
create schema stock authorization postgres;
grant usage on schema auth,stock to anon,authenticated;
set role postgres;
-- Fixture substitute for Supabase JWT extraction only; auth service is not reproduced.
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
create type stock.user_role as enum ('direction','chef_cuisine','magasinier','acheteur','controleur',
  'point_vente','fiche_technique','caisse','comptabilite','maintenance','consultation','administratif');
create table stock.profiles(id uuid primary key,user_id uuid unique,role stock.user_role,status text);
create table stock.units(id uuid primary key,name text);
create table stock.locations(id uuid primary key,name text,is_active boolean not null default true);
create table stock.articles(id uuid primary key,unit_id uuid references stock.units(id),
  status text not null default 'active',stockable boolean not null default true,
  locations_restricted boolean not null default false);
create table stock.article_locations(article_id uuid,location_id uuid);
create table stock.profile_location_access(profile_id uuid,location_id uuid,active boolean not null default true);
create table stock.stock_movements(id uuid primary key default gen_random_uuid(),article_id uuid,
  unit_id uuid,quantity numeric(14,4),from_location_id uuid,to_location_id uuid,
  movement_type text,status text not null default 'normal');
-- Valuation is not used by RES-2; the physical view itself is imported verbatim.
create view stock.stock_view as select id article_id,0::numeric average_price from stock.articles;
insert into stock.units values('10000000-0000-0000-0000-000000000001','unit');
insert into stock.locations(id,name) values
 ('20000000-0000-0000-0000-000000000001','A'),
 ('20000000-0000-0000-0000-000000000002','B'),
 ('20000000-0000-0000-0000-000000000003','forbidden');
insert into stock.articles(id,unit_id) values
 ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
insert into stock.profiles
select ('40000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,
       ('50000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,r::stock.user_role,'active'
from unnest(array['direction','chef_cuisine','magasinier','acheteur','controleur','point_vente',
  'fiche_technique','caisse','comptabilite','maintenance','consultation','administratif']) with ordinality t(r,i);
insert into stock.profile_location_access
select p.id,l.id,true from stock.profiles p cross join stock.locations l where l.name in ('A','B');
insert into stock.stock_movements(article_id,unit_id,quantity,to_location_id,movement_type)
select a.id,a.unit_id,6,l.id,'entree' from stock.articles a cross join stock.locations l where l.name in ('A','B');
