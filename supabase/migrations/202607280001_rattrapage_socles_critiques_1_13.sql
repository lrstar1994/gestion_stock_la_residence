-- Rattrapage local des socles critiques issus des patchs 1 a 13.
-- Statut : migration locale preparatoire uniquement.
-- Ne pas executer sur Supabase distant sans validation ecrite.

create schema if not exists stock;

alter table stock.profiles
  add column if not exists validation_pin_hash text,
  add column if not exists validation_pin_updated_at timestamptz,
  add column if not exists validation_pin_reset_required boolean not null default false,
  add column if not exists validation_pin_failed_attempts integer not null default 0;

create table if not exists stock.sensitive_action_registry (
  action_key text primary key,
  module_key text not null,
  label text not null,
  permission_key text,
  requires_pin boolean not null default true,
  requires_reason boolean not null default false,
  audit_required boolean not null default true,
  direction_validation_required boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists stock.sensitive_action_audit (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid,
  action_key text not null references stock.sensitive_action_registry(action_key) on delete restrict,
  actor_profile_id uuid references stock.profiles(id) on delete restrict,
  actor_user_id uuid,
  reference_type text,
  reference_id uuid,
  pin_verified boolean not null default false,
  success boolean not null,
  failure_reason text,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists sensitive_action_audit_actor_idx on stock.sensitive_action_audit(actor_profile_id, created_at desc);
create index if not exists sensitive_action_audit_reference_idx on stock.sensitive_action_audit(reference_type, reference_id);
create index if not exists sensitive_action_audit_batch_idx on stock.sensitive_action_audit(batch_id, created_at desc);

insert into stock.sensitive_action_registry (action_key, module_key, label, permission_key, requires_pin, requires_reason, audit_required)
values
  ('purchase_need.validate', 'achats', 'Valider une demande achat', 'purchase_needs.validate', true, false, true),
  ('purchase_need.refuse', 'achats', 'Refuser une demande achat', 'purchase_needs.validate', true, true, true),
  ('cash_purchase.validate', 'caisse', 'Valider un achat especes', 'cash_purchases.validate', true, false, true),
  ('cash_purchase.refuse', 'caisse', 'Refuser un achat especes', 'cash_purchases.validate', true, true, true),
  ('cash_difference.validate', 'caisse', 'Valider un ecart de caisse achat', 'cash_purchases.validate', true, true, true),
  ('purchase_order.validate', 'achats', 'Valider une commande fournisseur', 'purchase_orders.validate', true, false, true),
  ('purchase_order.cancel', 'achats', 'Annuler une commande fournisseur', 'purchase_orders.cancel', true, true, true),
  ('reception.validate', 'achats', 'Valider une reception', 'receptions.validate', true, false, true),
  ('reception.refuse', 'achats', 'Refuser une reception', 'receptions.validate', true, true, true),
  ('invoice.validate', 'factures', 'Valider une facture fournisseur', 'invoices.validate', true, false, true),
  ('invoice.payment.validate', 'factures', 'Valider un paiement fournisseur', 'invoices.payments.validate', true, false, true),
  ('invoice.payment.refuse', 'factures', 'Refuser un paiement fournisseur', 'invoices.payments.validate', true, true, true),
  ('stock.negative.authorize', 'stock', 'Autoriser une exception de stock negatif', 'stock.negative.authorize', true, true, true),
  ('stock.correction.validate', 'stock', 'Valider une correction de stock', 'stock.corrections.validate', true, true, true),
  ('stock.movement.retroactive.validate', 'stock', 'Valider un mouvement retroactif', 'stock.retroactive.validate', true, true, true),
  ('inventory.validate', 'inventaires', 'Valider un inventaire', 'inventories.validate', true, false, true),
  ('inventory.adjustment.validate', 'inventaires', 'Valider une correction inventaire', 'inventories.adjustments.validate', true, true, true),
  ('recipe.final_validate', 'fiches_techniques', 'Valider definitivement une fiche technique', 'recipes.final_validate', true, false, true),
  ('article_supplier_price.promo.override', 'achats', 'Retenir un prix promotionnel comme reference', 'prices.promo.override', true, true, true),
  ('validation_pin.set_own', 'securite', 'Modifier son PIN personnel', 'validation_pin.set_own', false, false, true),
  ('referential.archive', 'referentiels', 'Archiver un referentiel', 'referentials.archive', true, true, true),
  ('referential.merge', 'referentiels', 'Fusionner un referentiel', 'referentials.merge', true, true, true)
on conflict (action_key) do update set
  module_key = excluded.module_key,
  label = excluded.label,
  permission_key = excluded.permission_key,
  requires_pin = excluded.requires_pin,
  requires_reason = excluded.requires_reason,
  audit_required = excluded.audit_required,
  updated_at = now();

create or replace function stock.set_own_validation_pin(p_plain_pin text)
returns void
language plpgsql
security definer
set search_path = stock, public, extensions
as $$
declare
  v_profile stock.profiles%rowtype;
begin
  select *
  into v_profile
  from stock.profiles
  where user_id = auth.uid()
    and status = 'active'
  limit 1;

  if v_profile.id is null then
    raise exception 'Profil actif introuvable';
  end if;

  if p_plain_pin is null or length(trim(p_plain_pin)) < 4 or length(trim(p_plain_pin)) > 12 then
    raise exception 'Le PIN doit contenir entre 4 et 12 caracteres non vides';
  end if;

  update stock.profiles
  set validation_pin_hash = crypt(trim(p_plain_pin), gen_salt('bf')),
      validation_pin_updated_at = now(),
      validation_pin_reset_required = false,
      validation_pin_failed_attempts = 0,
      updated_at = now()
  where id = v_profile.id;

  insert into stock.sensitive_action_audit (action_key, actor_profile_id, actor_user_id, pin_verified, success, reason)
  values ('validation_pin.set_own', v_profile.id, auth.uid(), false, true, 'Mise a jour du PIN personnel');
end;
$$;

create or replace function stock.verify_validation_pin_for_action(
  p_action_key text,
  p_plain_pin text,
  p_reason text default null,
  p_reference_type text default null,
  p_reference_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = stock, public, extensions
as $$
declare
  v_profile stock.profiles%rowtype;
  v_action stock.sensitive_action_registry%rowtype;
  v_audit_id uuid;
begin
  select *
  into v_profile
  from stock.profiles
  where user_id = auth.uid()
    and status = 'active'
  limit 1;

  if v_profile.id is null then
    raise exception 'Profil actif introuvable';
  end if;

  select *
  into v_action
  from stock.sensitive_action_registry
  where action_key = p_action_key
    and active = true;

  if v_action.action_key is null then
    raise exception 'Action sensible inconnue ou inactive';
  end if;

  if v_action.requires_reason and nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'Motif obligatoire pour cette action';
  end if;

  if v_profile.validation_pin_hash is null or crypt(trim(coalesce(p_plain_pin, '')), v_profile.validation_pin_hash) <> v_profile.validation_pin_hash then
    update stock.profiles
    set validation_pin_failed_attempts = validation_pin_failed_attempts + 1,
        updated_at = now()
    where id = v_profile.id;

    insert into stock.sensitive_action_audit (action_key, actor_profile_id, actor_user_id, reference_type, reference_id, pin_verified, success, failure_reason, reason)
    values (p_action_key, v_profile.id, auth.uid(), p_reference_type, p_reference_id, false, false, 'pin_invalid', nullif(trim(coalesce(p_reason, '')), ''))
    returning id into v_audit_id;

    raise exception 'PIN invalide';
  end if;

  update stock.profiles
  set validation_pin_failed_attempts = 0,
      updated_at = now()
  where id = v_profile.id;

  insert into stock.sensitive_action_audit (action_key, actor_profile_id, actor_user_id, reference_type, reference_id, pin_verified, success, reason)
  values (p_action_key, v_profile.id, auth.uid(), p_reference_type, p_reference_id, true, true, nullif(trim(coalesce(p_reason, '')), ''))
  returning id into v_audit_id;

  return v_audit_id;
end;
$$;

create or replace function stock.verify_validation_pin_for_batch(
  p_plain_pin text,
  p_selected_elements jsonb
)
returns uuid
language plpgsql
security definer
set search_path = stock, public, extensions
as $$
declare
  v_profile stock.profiles%rowtype;
  v_batch_id uuid := gen_random_uuid();
  v_item jsonb;
  v_action stock.sensitive_action_registry%rowtype;
  v_action_key text;
  v_reference_type text;
  v_reference_id uuid;
  v_reason text;
begin
  select *
  into v_profile
  from stock.profiles
  where user_id = auth.uid()
    and status = 'active'
  limit 1;

  if v_profile.id is null then
    raise exception 'Profil actif introuvable';
  end if;

  if jsonb_typeof(p_selected_elements) <> 'array' or jsonb_array_length(p_selected_elements) = 0 then
    raise exception 'Selection vide';
  end if;

  if v_profile.validation_pin_hash is null or crypt(trim(coalesce(p_plain_pin, '')), v_profile.validation_pin_hash) <> v_profile.validation_pin_hash then
    update stock.profiles
    set validation_pin_failed_attempts = validation_pin_failed_attempts + 1,
        updated_at = now()
    where id = v_profile.id;

    insert into stock.sensitive_action_audit (batch_id, action_key, actor_profile_id, actor_user_id, pin_verified, success, failure_reason, reason)
    values (v_batch_id, 'validation_pin.set_own', v_profile.id, auth.uid(), false, false, 'pin_invalid_for_batch', 'Validation groupee refusee');

    raise exception 'PIN invalide';
  end if;

  update stock.profiles
  set validation_pin_failed_attempts = 0,
      updated_at = now()
  where id = v_profile.id;

  for v_item in select * from jsonb_array_elements(p_selected_elements)
  loop
    v_action_key := v_item ->> 'action_key';
    v_reference_type := v_item ->> 'reference_type';
    v_reference_id := nullif(v_item ->> 'reference_id', '')::uuid;
    v_reason := nullif(trim(coalesce(v_item ->> 'reason', '')), '');

    select *
    into v_action
    from stock.sensitive_action_registry
    where action_key = v_action_key
      and active = true;

    if v_action.action_key is null then
      raise exception 'Action sensible inconnue ou inactive : %', v_action_key;
    end if;

    if v_action.requires_reason and v_reason is null then
      raise exception 'Motif obligatoire pour : %', v_action_key;
    end if;

    insert into stock.sensitive_action_audit (
      batch_id,
      action_key,
      actor_profile_id,
      actor_user_id,
      reference_type,
      reference_id,
      pin_verified,
      success,
      reason
    )
    values (
      v_batch_id,
      v_action_key,
      v_profile.id,
      auth.uid(),
      v_reference_type,
      v_reference_id,
      true,
      true,
      v_reason
    );
  end loop;

  return v_batch_id;
end;
$$;

create table if not exists stock.article_suppliers (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references stock.articles(id) on delete restrict,
  supplier_id uuid not null references stock.suppliers(id) on delete restrict,
  supplier_unit_id uuid references stock.units(id) on delete restrict,
  packaging_label text,
  packaging_quantity numeric(14,4),
  conversion_factor_to_stock numeric(18,8) not null default 1 check (conversion_factor_to_stock > 0),
  supplier_reference text,
  is_preferred boolean not null default false,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references stock.profiles(id) on delete set null,
  updated_by uuid references stock.profiles(id) on delete set null
);

create unique index if not exists article_suppliers_active_unique
  on stock.article_suppliers(article_id, supplier_id, coalesce(supplier_reference, ''))
  where status = 'active';

create unique index if not exists article_suppliers_preferred_unique
  on stock.article_suppliers(article_id)
  where is_preferred = true and status = 'active';

create table if not exists stock.article_supplier_prices (
  id uuid primary key default gen_random_uuid(),
  article_supplier_id uuid not null references stock.article_suppliers(id) on delete restrict,
  source_type text not null check (source_type in ('indicative', 'real_reception', 'real_invoice', 'real_receipt', 'promo', 'manual_direction')),
  price_amount numeric(14,4) not null check (price_amount >= 0),
  price_unit_id uuid references stock.units(id) on delete restrict,
  conversion_factor_to_stock numeric(18,8) not null default 1 check (conversion_factor_to_stock > 0),
  price_per_stock_unit numeric(14,4) generated always as (price_amount / conversion_factor_to_stock) stored,
  valid_from date not null default current_date,
  valid_until date,
  reference_source_type text,
  reference_source_id uuid,
  direction_approved boolean not null default false,
  approval_audit_id uuid references stock.sensitive_action_audit(id) on delete restrict,
  status text not null default 'active' check (status in ('draft', 'active', 'superseded', 'rejected', 'archived')),
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references stock.profiles(id) on delete set null
);

create index if not exists article_supplier_prices_lookup_idx
  on stock.article_supplier_prices(article_supplier_id, source_type, status, valid_from desc);

create table if not exists stock.non_purchase_cash_disbursements (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  category text not null check (category in ('operations', 'personnel', 'remboursement', 'administration', 'fiscalite', 'divers', 'transfert_interne')),
  cash_source text not null,
  request_date date not null default current_date,
  requested_by uuid references stock.profiles(id) on delete restrict,
  reason text not null,
  amount_requested numeric(14,2) not null check (amount_requested > 0),
  amount_validated numeric(14,2) check (amount_validated is null or amount_validated >= 0),
  amount_given numeric(14,2) check (amount_given is null or amount_given >= 0),
  amount_justified numeric(14,2) check (amount_justified is null or amount_justified >= 0),
  status text not null default 'draft' check (status in ('draft', 'pending_direction', 'approved', 'cash_given', 'justified', 'closed', 'refused', 'cancelled')),
  validation_audit_id uuid references stock.sensitive_action_audit(id) on delete restrict,
  validated_by uuid references stock.profiles(id) on delete set null,
  validated_at timestamptz,
  validation_comment text,
  given_by uuid references stock.profiles(id) on delete set null,
  given_at timestamptz,
  closed_by uuid references stock.profiles(id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references stock.profiles(id) on delete set null,
  updated_by uuid references stock.profiles(id) on delete set null
);

create index if not exists non_purchase_cash_disbursements_report_idx
  on stock.non_purchase_cash_disbursements(request_date, cash_source, status);

create or replace view stock.purchase_history_view as
select
  pn.id,
  'purchase_need'::text as source_type,
  pn.created_at as event_at,
  pn.status,
  null::text as reference,
  pn.article_id,
  pn.supplier_id,
  pn.estimated_cost as amount,
  pn.created_by as profile_id
from stock.purchase_needs pn
union all
select
  cp.id,
  'cash_purchase'::text,
  cp.created_at,
  cp.status,
  cp.reference,
  null::uuid,
  null::uuid,
  cp.amount_requested,
  cp.created_by
from stock.cash_purchases cp
union all
select
  po.id,
  'purchase_order'::text,
  po.created_at,
  po.status,
  po.reference,
  null::uuid,
  po.supplier_id,
  po.total_amount,
  po.created_by
from stock.purchase_orders po
union all
select
  r.id,
  'reception'::text,
  r.created_at,
  r.status,
  r.reference,
  null::uuid,
  r.supplier_id,
  r.total_amount,
  r.created_by
from stock.receptions r
union all
select
  i.id,
  'invoice'::text,
  i.created_at,
  i.status,
  i.reference,
  null::uuid,
  i.supplier_id,
  i.amount_ttc,
  i.created_by
from stock.invoices i;

alter table stock.sensitive_action_registry enable row level security;
alter table stock.sensitive_action_audit enable row level security;
alter table stock.article_suppliers enable row level security;
alter table stock.article_supplier_prices enable row level security;
alter table stock.non_purchase_cash_disbursements enable row level security;

create policy "Active users can read sensitive action registry" on stock.sensitive_action_registry
  for select using (exists (select 1 from stock.profiles p where p.user_id = auth.uid() and p.status = 'active'));

create policy "Directors can read sensitive action audit" on stock.sensitive_action_audit
  for select using (stock.is_current_user_direction());

create policy "Active users can read article suppliers" on stock.article_suppliers
  for select using (exists (select 1 from stock.profiles p where p.user_id = auth.uid() and p.status = 'active'));

create policy "Directors and buyers can create article suppliers" on stock.article_suppliers
  for insert
  with check (exists (select 1 from stock.profiles p where p.user_id = auth.uid() and p.status = 'active' and p.role in ('direction', 'acheteur')));

create policy "Directors and buyers can update article suppliers" on stock.article_suppliers
  for update using (exists (select 1 from stock.profiles p where p.user_id = auth.uid() and p.status = 'active' and p.role in ('direction', 'acheteur')))
  with check (exists (select 1 from stock.profiles p where p.user_id = auth.uid() and p.status = 'active' and p.role in ('direction', 'acheteur')));

create policy "Active users can read article supplier prices" on stock.article_supplier_prices
  for select using (exists (select 1 from stock.profiles p where p.user_id = auth.uid() and p.status = 'active'));

create policy "Directors and buyers can create article supplier prices" on stock.article_supplier_prices
  for insert
  with check (exists (select 1 from stock.profiles p where p.user_id = auth.uid() and p.status = 'active' and p.role in ('direction', 'acheteur')));

create policy "Directors and buyers can update article supplier prices" on stock.article_supplier_prices
  for update using (exists (select 1 from stock.profiles p where p.user_id = auth.uid() and p.status = 'active' and p.role in ('direction', 'acheteur')))
  with check (exists (select 1 from stock.profiles p where p.user_id = auth.uid() and p.status = 'active' and p.role in ('direction', 'acheteur')));

create policy "Operational users can read non purchase disbursements" on stock.non_purchase_cash_disbursements
  for select using (exists (select 1 from stock.profiles p where p.user_id = auth.uid() and p.status = 'active' and p.role in ('direction', 'caisse', 'comptabilite')));

create policy "Cash and direction can create non purchase disbursements" on stock.non_purchase_cash_disbursements
  for insert with check (exists (select 1 from stock.profiles p where p.user_id = auth.uid() and p.status = 'active' and p.role in ('direction', 'caisse', 'comptabilite')));

create policy "Directors can manage non purchase disbursements" on stock.non_purchase_cash_disbursements
  for update using (stock.is_current_user_direction())
  with check (stock.is_current_user_direction());
