create schema if not exists stock;
set search_path = stock, public, auth;

-- Migration Phase 1.1
-- Module : Utilisateurs, roles et droits

create type stock.user_role as enum (
  'direction',
  'chef_cuisine',
  'fiche_technique',
  'magasinier',
  'caisse',
  'comptabilite',
  'acheteur',
  'point_vente',
  'maintenance',
  'consultation'
);

create type stock.user_status as enum (
  'pending_validation',
  'active',
  'inactive',
  'rejected'
);

create table stock.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique,
  email text not null,
  full_name text not null,
  role stock.user_role default 'consultation',
  status stock.user_status default 'pending_validation',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  validated_by uuid references stock.profiles(id),
  validated_at timestamp with time zone,
  rejected_at timestamp with time zone,
  rejection_reason text,
  created_by uuid references stock.profiles(id)
);

create or replace function stock.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = stock, public, auth;

create trigger update_profiles_updated_at
  before update on stock.profiles
  for each row
  execute function stock.update_updated_at_column();

create index idx_profiles_user_id on stock.profiles(user_id);
create index idx_profiles_email on stock.profiles(email);
create index idx_profiles_status on stock.profiles(status);
create index idx_profiles_role on stock.profiles(role);

alter table stock.profiles enable row level security;

create policy "Users can view own profile"
  on stock.profiles for select
  using (auth.uid() = user_id);

create policy "Users can update own profile"
  on stock.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Directors can view all profiles"
  on stock.profiles for select
  using (
    exists (
      select 1
      from stock.profiles director_profile
      where director_profile.user_id = auth.uid()
        and director_profile.role = 'direction'
        and director_profile.status = 'active'
    )
  );

create policy "Directors can update all profiles"
  on stock.profiles for update
  using (
    exists (
      select 1
      from stock.profiles director_profile
      where director_profile.user_id = auth.uid()
        and director_profile.role = 'direction'
        and director_profile.status = 'active'
    )
  )
  with check (
    exists (
      select 1
      from stock.profiles director_profile
      where director_profile.user_id = auth.uid()
        and director_profile.role = 'direction'
        and director_profile.status = 'active'
    )
  );

create or replace function stock.handle_new_user()
returns trigger as $$
begin
  insert into stock.profiles (user_id, email, full_name, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    'pending_validation'
  );
  return new;
end;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = stock, public, auth;

create trigger on_auth_user_created_stock_profile
  after insert on auth.users
  for each row
  execute function stock.handle_new_user();

