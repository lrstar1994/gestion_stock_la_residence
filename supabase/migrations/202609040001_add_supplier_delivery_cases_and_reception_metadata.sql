-- Lot achats 1 : socle commun des réceptions et livraison fournisseur au comptant.
-- Préparée localement uniquement. Ne pas exécuter sur un projet distant sans validation.

create table if not exists stock.supplier_delivery_cases (
  id uuid primary key default gen_random_uuid(), reference text not null unique,
  supplier_id uuid not null references stock.suppliers(id),
  created_by uuid references stock.profiles(id), authorized_by uuid references stock.profiles(id),
  authorized_at timestamptz, status text not null default 'en_attente',
  total_estimated numeric(14,2) not null default 0, payment_mode text, due_date date,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), closed_at timestamptz
);
create table if not exists stock.supplier_delivery_case_items (
  id uuid primary key default gen_random_uuid(),
  supplier_delivery_case_id uuid not null references stock.supplier_delivery_cases(id) on delete cascade,
  purchase_need_id uuid references stock.purchase_needs(id), article_id uuid not null references stock.articles(id),
  quantity_expected numeric(14,4) not null, unit_id uuid not null references stock.units(id),
  expected_unit_price numeric(14,2), total_expected numeric(14,2) not null default 0, comment text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists idx_supplier_delivery_cases_supplier_id on stock.supplier_delivery_cases(supplier_id);
create index if not exists idx_supplier_delivery_case_items_case_id on stock.supplier_delivery_case_items(supplier_delivery_case_id);
create index if not exists idx_supplier_delivery_case_items_purchase_need_id on stock.supplier_delivery_case_items(purchase_need_id);
alter table stock.receptions add column if not exists supplier_delivery_case_id uuid;
alter table stock.receptions add column if not exists presented_at timestamptz;
alter table stock.receptions add column if not exists received_by uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'receptions_supplier_delivery_case_id_fkey' and conrelid = 'stock.receptions'::regclass) then
    alter table stock.receptions add constraint receptions_supplier_delivery_case_id_fkey foreign key (supplier_delivery_case_id) references stock.supplier_delivery_cases(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'receptions_received_by_fkey' and conrelid = 'stock.receptions'::regclass) then
    alter table stock.receptions add constraint receptions_received_by_fkey foreign key (received_by) references stock.profiles(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'receptions_single_purchase_source_check' and conrelid = 'stock.receptions'::regclass) then
    alter table stock.receptions add constraint receptions_single_purchase_source_check check (((purchase_order_id is not null)::int + (cash_purchase_id is not null)::int + (supplier_delivery_case_id is not null)::int) <= 1) not valid;
  end if;
end $$;
create index if not exists idx_receptions_supplier_delivery_case_id on stock.receptions(supplier_delivery_case_id);
create index if not exists idx_receptions_presented_at on stock.receptions(presented_at);
alter table stock.supplier_delivery_cases enable row level security;
alter table stock.supplier_delivery_case_items enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='stock' and tablename='supplier_delivery_cases' and policyname='Active users can view supplier delivery cases') then
    create policy "Active users can view supplier delivery cases" on stock.supplier_delivery_cases for select using (auth.uid() is not null);
  end if;
  if not exists (select 1 from pg_policies where schemaname='stock' and tablename='supplier_delivery_case_items' and policyname='Active users can view supplier delivery case items') then
    create policy "Active users can view supplier delivery case items" on stock.supplier_delivery_case_items for select using (auth.uid() is not null);
  end if;
end $$;