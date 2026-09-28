-- Correctifs locaux achats / justificatifs / fournisseurs.
-- Statut : migration locale preparatoire uniquement.
-- Ne pas executer sur Supabase reel sans validation ecrite.

create schema if not exists stock;

create sequence if not exists stock.purchase_document_internal_seq;

create or replace function stock.generate_purchase_document_internal_number()
returns text
language plpgsql
set search_path = stock, public
as $$
begin
  return 'ACH-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('stock.purchase_document_internal_seq')::text, 4, '0');
end;
$$;

alter table stock.cash_purchases
  add column if not exists supplier_id uuid references stock.suppliers(id) on delete restrict;

create index if not exists cash_purchases_supplier_idx on stock.cash_purchases(supplier_id);

alter table stock.cash_purchase_receipts
  add column if not exists internal_number text,
  add column if not exists document_type text not null default 'justificatif_achat',
  add column if not exists supplier_id uuid references stock.suppliers(id) on delete restrict,
  add column if not exists document_date date,
  add column if not exists document_amount numeric(14,2),
  add column if not exists line_ids uuid[] not null default '{}',
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references stock.profiles(id) on delete set null,
  add column if not exists cancellation_reason text;

update stock.cash_purchase_receipts
set internal_number = stock.generate_purchase_document_internal_number()
where internal_number is null;

alter table stock.cash_purchase_receipts
  alter column internal_number set not null;

create unique index if not exists cash_purchase_receipts_internal_number_unique
  on stock.cash_purchase_receipts(internal_number);

create index if not exists cash_purchase_receipts_document_lookup_idx
  on stock.cash_purchase_receipts(internal_number, document_type, document_date, supplier_id);

alter table stock.suppliers
  add column if not exists legal_name text,
  add column if not exists business_type text not null default 'a_verifier',
  add column if not exists usage_type text not null default 'occasionnel',
  add column if not exists fiscal_profile_status text not null default 'to_check',
  add column if not exists whatsapp text,
  add column if not exists payment_mode text,
  add column if not exists payment_terms text,
  add column if not exists aliases text,
  add column if not exists provided_services text[] not null default '{}',
  add column if not exists profile_to_complete boolean not null default false;

create index if not exists suppliers_aliases_notes_search_idx
  on stock.suppliers using gin (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(legal_name, '') || ' ' || coalesce(aliases, '') || ' ' || coalesce(notes, '')));

create index if not exists suppliers_provided_services_idx
  on stock.suppliers using gin (provided_services);

create or replace function stock.set_purchase_document_internal_number()
returns trigger
language plpgsql
set search_path = stock, public
as $$
begin
  if new.internal_number is null or trim(new.internal_number) = '' then
    new.internal_number := stock.generate_purchase_document_internal_number();
  end if;
  return new;
end;
$$;

drop trigger if exists cash_purchase_receipts_internal_number_trg on stock.cash_purchase_receipts;
create trigger cash_purchase_receipts_internal_number_trg
before insert on stock.cash_purchase_receipts
for each row execute function stock.set_purchase_document_internal_number();

comment on column stock.cash_purchase_receipts.internal_number is
  'Numero interne sequentiel ACH-YYYY-0001 a ecrire sur la piece papier avant scan/photo.';

comment on column stock.suppliers.provided_services is
  'Produits ou services fournis. Remplace une categorie fournisseur unique trop rigide.';

comment on column stock.suppliers.profile_to_complete is
  'Alerte fiche fournisseur a completer pour les fournisseurs provisoires.';

