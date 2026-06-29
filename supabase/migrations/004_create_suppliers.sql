create schema if not exists stock;
set search_path = stock, public, auth;

-- Migration Phase 1.4
-- Module : Fournisseurs

create or replace function stock.can_current_user_manage_suppliers()
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
      and role in ('direction', 'acheteur')
      and status = 'active'
  );
$$;

create or replace function stock.can_current_user_view_suppliers()
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
      and role in ('direction', 'acheteur', 'comptabilite', 'chef_cuisine', 'magasinier')
      and status = 'active'
  );
$$;

create table stock.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  contact text,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  created_by uuid references stock.profiles(id),
  updated_by uuid references stock.profiles(id)
);

alter table stock.suppliers enable row level security;

create policy "Supplier managers can manage suppliers"
  on stock.suppliers for all
  using (stock.can_current_user_manage_suppliers())
  with check (stock.can_current_user_manage_suppliers());

create policy "Allowed users can view suppliers"
  on stock.suppliers for select
  using (stock.can_current_user_view_suppliers());

create trigger update_suppliers_updated_at
  before update on stock.suppliers
  for each row
  execute function stock.update_updated_at_column();

create index idx_suppliers_name on stock.suppliers(name);
