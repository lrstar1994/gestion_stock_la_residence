create schema if not exists stock;
set search_path = stock, public, auth;

-- Migration corrective
-- Corrige la récursion infinie RLS sur stock.profiles.

drop policy if exists "Directors can view all profiles" on stock.profiles;
drop policy if exists "Directors can update all profiles" on stock.profiles;

create or replace function stock.is_current_user_direction()
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
      and role = 'direction'
      and status = 'active'
  );
$$;

create policy "Directors can view all profiles"
  on stock.profiles for select
  using (stock.is_current_user_direction());

create policy "Directors can update all profiles"
  on stock.profiles for update
  using (stock.is_current_user_direction())
  with check (stock.is_current_user_direction());
