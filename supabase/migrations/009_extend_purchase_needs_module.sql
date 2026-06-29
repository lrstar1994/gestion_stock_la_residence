create schema if not exists stock;
set search_path = stock, public, auth;

-- Migration : module global des besoins d'achat
-- Etend la table purchase_needs creee par le module Evenements.

create type stock.need_origin as enum (
  'evenement', 'production', 'seuil_minimum',
  'maintenance', 'entretien', 'chambres',
  'administration', 'demande_manuelle'
);

create type stock.need_urgency as enum ('normal', 'urgent', 'tres_urgent');

alter type stock.purchase_need_status add value if not exists 'valide';
alter type stock.purchase_need_status add value if not exists 'regroupe';
alter type stock.purchase_need_status add value if not exists 'refuse';

alter table stock.purchase_needs
  alter column event_id drop not null,
  add column if not exists quantity decimal(14, 4),
  add column if not exists origin stock.need_origin not null default 'evenement',
  add column if not exists urgency stock.need_urgency default 'normal',
  add column if not exists estimated_price decimal(14, 2),
  add column if not exists budget decimal(14, 2),
  add column if not exists requested_date date,
  add column if not exists comment text,
  add column if not exists recipe_id uuid references stock.recipes(id),
  add column if not exists validated_by uuid references stock.profiles(id),
  add column if not exists validated_at timestamp with time zone,
  add column if not exists validation_comment text,
  add column if not exists group_id uuid,
  add column if not exists supplier_id uuid references stock.suppliers(id),
  add column if not exists updated_by uuid references stock.profiles(id);

update stock.purchase_needs
set
  quantity = coalesce(quantity, quantity_needed),
  estimated_price = coalesce(estimated_price, estimated_cost / nullif(quantity_needed, 0)),
  origin = coalesce(origin, 'evenement');

alter table stock.purchase_needs
  alter column quantity set not null;

create table if not exists stock.purchase_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  supplier_id uuid references stock.suppliers(id),
  total_estimated_cost decimal(14, 2) default 0,
  status text default 'en_cours',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  created_by uuid references stock.profiles(id)
);

alter table stock.purchase_groups enable row level security;

create policy "Purchase group managers can manage groups"
  on stock.purchase_groups for all
  using (
    exists (
      select 1 from stock.profiles
      where profiles.user_id = auth.uid()
        and profiles.role in ('direction', 'acheteur')
        and profiles.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from stock.profiles
      where profiles.user_id = auth.uid()
        and profiles.role in ('direction', 'acheteur')
        and profiles.status = 'active'
    )
  );

create policy "All active users can view purchase groups"
  on stock.purchase_groups for select
  using (auth.uid() is not null);

drop policy if exists "Purchase staff can manage purchase needs" on stock.purchase_needs;
drop policy if exists "All active users can view purchase needs" on stock.purchase_needs;

create policy "Directors can manage all purchase needs"
  on stock.purchase_needs for all
  using (
    exists (
      select 1 from stock.profiles
      where profiles.user_id = auth.uid()
        and profiles.role = 'direction'
        and profiles.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from stock.profiles
      where profiles.user_id = auth.uid()
        and profiles.role = 'direction'
        and profiles.status = 'active'
    )
  );

create policy "Operational staff can manage own purchase needs"
  on stock.purchase_needs for all
  using (
    exists (
      select 1 from stock.profiles current_profile
      where current_profile.user_id = auth.uid()
        and current_profile.role in ('chef_cuisine', 'fiche_technique', 'maintenance', 'magasinier')
        and current_profile.status = 'active'
        and current_profile.id = purchase_needs.created_by
    )
  )
  with check (
    exists (
      select 1 from stock.profiles current_profile
      where current_profile.user_id = auth.uid()
        and current_profile.role in ('chef_cuisine', 'fiche_technique', 'maintenance', 'magasinier')
        and current_profile.status = 'active'
        and current_profile.id = purchase_needs.created_by
    )
  );

create policy "Buyers can manage purchase needs"
  on stock.purchase_needs for all
  using (
    exists (
      select 1 from stock.profiles
      where profiles.user_id = auth.uid()
        and profiles.role = 'acheteur'
        and profiles.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from stock.profiles
      where profiles.user_id = auth.uid()
        and profiles.role = 'acheteur'
        and profiles.status = 'active'
    )
  );

create policy "All active users can view purchase needs"
  on stock.purchase_needs for select
  using (auth.uid() is not null);

create trigger update_purchase_groups_updated_at
  before update on stock.purchase_groups
  for each row execute function stock.update_updated_at_column();

create index if not exists idx_purchase_needs_status on stock.purchase_needs(status);
create index if not exists idx_purchase_needs_origin on stock.purchase_needs(origin);
create index if not exists idx_purchase_needs_urgency on stock.purchase_needs(urgency);
create index if not exists idx_purchase_needs_created_at on stock.purchase_needs(created_at);
create index if not exists idx_purchase_needs_group_id on stock.purchase_needs(group_id);
create index if not exists idx_purchase_needs_supplier_id on stock.purchase_needs(supplier_id);
