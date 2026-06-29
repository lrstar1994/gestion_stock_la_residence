create schema if not exists stock;
set search_path = stock, public, auth;

-- Migration : achats en especes

create type stock.cash_purchase_status as enum (
  'en_attente', 'valide', 'especes_remises',
  'retour_partiel', 'retour_complet', 'cloture', 'refuse'
);

create type stock.cash_purchase_source as enum (
  'caisse_principale', 'caisse_privilege', 'caisse_piscine'
);

create type stock.difference_type as enum (
  'change_not_returned', 'price_difference', 'quantity_missing',
  'product_not_conforming', 'invoice_error', 'advance_overrun'
);

create table stock.cash_purchases (
  id uuid primary key default gen_random_uuid(),
  reference text unique not null,
  buyer_id uuid references stock.profiles(id) not null,
  cash_source stock.cash_purchase_source not null,
  reason text not null,
  purchase_date date,
  request_date date default current_date,
  total_estimated decimal(14, 2) default 0,
  amount_requested decimal(14, 2) default 0,
  amount_validated decimal(14, 2) default 0,
  amount_given decimal(14, 2) default 0,
  total_purchased decimal(14, 2) default 0,
  change_expected decimal(14, 2) default 0,
  change_returned decimal(14, 2) default 0,
  difference decimal(14, 2) default 0,
  validated_by uuid references stock.profiles(id),
  validated_at timestamp with time zone,
  validation_comment text,
  given_by uuid references stock.profiles(id),
  given_at timestamp with time zone,
  closed_by uuid references stock.profiles(id),
  closed_at timestamp with time zone,
  closing_comment text,
  status stock.cash_purchase_status default 'en_attente',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  created_by uuid references stock.profiles(id),
  updated_by uuid references stock.profiles(id)
);

alter table stock.cash_purchases enable row level security;

create policy "Directors can manage all cash purchases"
  on stock.cash_purchases for all
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

create policy "Cash staff can manage cash purchases"
  on stock.cash_purchases for all
  using (
    exists (
      select 1 from stock.profiles current_profile
      where current_profile.user_id = auth.uid()
        and current_profile.role in ('acheteur', 'caisse')
        and current_profile.status = 'active'
        and (current_profile.id = cash_purchases.created_by or current_profile.id = cash_purchases.buyer_id)
    )
  )
  with check (
    exists (
      select 1 from stock.profiles current_profile
      where current_profile.user_id = auth.uid()
        and current_profile.role in ('acheteur', 'caisse')
        and current_profile.status = 'active'
        and (current_profile.id = cash_purchases.created_by or current_profile.id = cash_purchases.buyer_id)
    )
  );

create policy "All active users can view cash purchases"
  on stock.cash_purchases for select
  using (auth.uid() is not null);

create trigger update_cash_purchases_updated_at
  before update on stock.cash_purchases
  for each row execute function stock.update_updated_at_column();

create table stock.cash_purchase_items (
  id uuid primary key default gen_random_uuid(),
  cash_purchase_id uuid references stock.cash_purchases(id) on delete cascade not null,
  article_id uuid references stock.articles(id) not null,
  purchase_need_id uuid references stock.purchase_needs(id),
  quantity_planned decimal(14, 4) not null,
  quantity_bought decimal(14, 4) default 0,
  unit_id uuid references stock.units(id) not null,
  unit_price_estimated decimal(14, 2),
  unit_price_real decimal(14, 2),
  total_estimated decimal(14, 2) default 0,
  total_real decimal(14, 2) default 0,
  invoice_number text,
  invoice_date date,
  supplier text,
  comment text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table stock.cash_purchase_items enable row level security;

create policy "Cash purchase managers can manage items"
  on stock.cash_purchase_items for all
  using (
    exists (
      select 1 from stock.cash_purchases purchase
      join stock.profiles current_profile on current_profile.user_id = auth.uid()
      where purchase.id = cash_purchase_items.cash_purchase_id
        and current_profile.status = 'active'
        and (
          current_profile.role in ('direction', 'acheteur', 'caisse')
          or current_profile.id = purchase.created_by
          or current_profile.id = purchase.buyer_id
        )
    )
  );

create policy "All active users can view cash purchase items"
  on stock.cash_purchase_items for select
  using (auth.uid() is not null);

create trigger update_cash_purchase_items_updated_at
  before update on stock.cash_purchase_items
  for each row execute function stock.update_updated_at_column();

create table stock.cash_purchase_receipts (
  id uuid primary key default gen_random_uuid(),
  cash_purchase_id uuid references stock.cash_purchases(id) on delete cascade not null,
  file_url text not null,
  file_name text not null,
  file_size integer,
  mime_type text,
  description text,
  uploaded_at timestamp with time zone default now(),
  uploaded_by uuid references stock.profiles(id)
);

alter table stock.cash_purchase_receipts enable row level security;

create policy "Cash purchase managers can manage receipts"
  on stock.cash_purchase_receipts for all
  using (
    exists (
      select 1 from stock.cash_purchases purchase
      join stock.profiles current_profile on current_profile.user_id = auth.uid()
      where purchase.id = cash_purchase_receipts.cash_purchase_id
        and current_profile.status = 'active'
        and current_profile.role in ('direction', 'acheteur')
    )
  );

create policy "All active users can view cash purchase receipts"
  on stock.cash_purchase_receipts for select
  using (auth.uid() is not null);

create table stock.cash_purchase_differences (
  id uuid primary key default gen_random_uuid(),
  cash_purchase_id uuid references stock.cash_purchases(id) on delete cascade not null,
  difference_type stock.difference_type not null,
  amount decimal(14, 2) not null,
  description text not null,
  status text default 'a_justifier',
  justified_by uuid references stock.profiles(id),
  justified_at timestamp with time zone,
  justification text,
  validated_by uuid references stock.profiles(id),
  validated_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

alter table stock.cash_purchase_differences enable row level security;

create policy "Cash purchase managers can manage differences"
  on stock.cash_purchase_differences for all
  using (
    exists (
      select 1 from stock.cash_purchases purchase
      join stock.profiles current_profile on current_profile.user_id = auth.uid()
      where purchase.id = cash_purchase_differences.cash_purchase_id
        and current_profile.status = 'active'
        and current_profile.role in ('direction', 'acheteur')
    )
  );

create policy "All active users can view cash purchase differences"
  on stock.cash_purchase_differences for select
  using (auth.uid() is not null);

create index idx_cash_purchases_reference on stock.cash_purchases(reference);
create index idx_cash_purchases_status on stock.cash_purchases(status);
create index idx_cash_purchases_buyer_id on stock.cash_purchases(buyer_id);
create index idx_cash_purchases_created_at on stock.cash_purchases(created_at);
create index idx_cash_purchase_items_purchase_id on stock.cash_purchase_items(cash_purchase_id);
create index idx_cash_purchase_items_article_id on stock.cash_purchase_items(article_id);
