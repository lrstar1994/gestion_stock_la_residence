-- Justificatifs du contrôle 3B : réparation idempotente du schéma historique,
-- insertion Contrôleur, annulation logique et numérotation serveur.

-- Répare une éventuelle dérive du schéma TEST sans modifier les migrations historiques.
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

create sequence if not exists stock.purchase_document_internal_seq;

-- Conserve la numérotation ACH historique pour le backfill et les types génériques.
create or replace function stock.generate_purchase_document_internal_number()
returns text
language plpgsql
security definer
set search_path = pg_catalog, stock, auth, extensions
as $$
begin
  return 'ACH-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('stock.purchase_document_internal_seq'::regclass)::text, 4, '0');
end;
$$;
revoke all on function stock.generate_purchase_document_internal_number() from public, anon, authenticated;

-- Seules les valeurs absentes/vierges sont attribuées. Les numéros existants ne bougent pas.
update stock.cash_purchase_receipts
set internal_number = stock.generate_purchase_document_internal_number()
where internal_number is null or btrim(internal_number) = '';

alter table stock.cash_purchase_receipts
  alter column internal_number set not null;

create unique index if not exists cash_purchase_receipts_internal_number_unique
  on stock.cash_purchase_receipts(internal_number);
create index if not exists cash_purchase_receipts_document_lookup_idx
  on stock.cash_purchase_receipts(internal_number, document_type, document_date, supplier_id);

create table if not exists stock.cash_purchase_receipt_daily_counters (
  registration_date date not null,
  document_prefix text not null check (document_prefix in ('F', 'R')),
  last_number integer not null check (last_number > 0),
  primary key (registration_date, document_prefix)
);
revoke all on table stock.cash_purchase_receipt_daily_counters from public, anon, authenticated;

create or replace function stock.next_cash_purchase_receipt_number(p_prefix text, p_registration_date date)
returns text
language plpgsql
security definer
set search_path = pg_catalog, stock, auth, extensions
as $$
declare
  v_number integer;
  v_internal_number text;
begin
  if p_prefix is null or p_prefix not in ('F', 'R') or p_registration_date is null then
    raise exception 'Type de numéro de justificatif invalide';
  end if;

  loop
    insert into stock.cash_purchase_receipt_daily_counters(registration_date, document_prefix, last_number)
    values (p_registration_date, p_prefix, 1)
    on conflict (registration_date, document_prefix)
    do update set last_number = stock.cash_purchase_receipt_daily_counters.last_number + 1
    returning last_number into v_number;

    if v_number > 999 then
      raise exception 'Limite de 999 justificatifs journaliers atteinte pour le préfixe %', p_prefix;
    end if;

    v_internal_number := p_prefix || lpad(v_number::text, 3, '0') || '_' || to_char(p_registration_date, 'DD_MM_YY');
    exit when not exists (
      select 1 from stock.cash_purchase_receipts r where r.internal_number = v_internal_number
    );
  end loop;

  return v_internal_number;
end;
$$;
revoke all on function stock.next_cash_purchase_receipt_number(text, date) from public, anon, authenticated;

create or replace function stock.set_purchase_document_internal_number()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, stock, auth, extensions
as $$
declare
  v_registration_date date := (clock_timestamp() at time zone 'Indian/Antananarivo')::date;
begin
  -- Le numéro est toujours calculé par PostgreSQL, jamais accepté depuis le client.
  if new.document_type = 'facture' then
    new.internal_number := stock.next_cash_purchase_receipt_number('F', v_registration_date);
  elsif new.document_type = 'recu' then
    new.internal_number := stock.next_cash_purchase_receipt_number('R', v_registration_date);
  else
    -- Les types existants sans préfixe dédié conservent la numérotation ACH historique.
    new.internal_number := stock.generate_purchase_document_internal_number();
  end if;
  return new;
end;
$$;
revoke all on function stock.set_purchase_document_internal_number() from public, anon, authenticated;
drop trigger if exists cash_purchase_receipts_internal_number_trg on stock.cash_purchase_receipts;
create trigger cash_purchase_receipts_internal_number_trg
before insert on stock.cash_purchase_receipts
for each row execute function stock.set_purchase_document_internal_number();

create or replace function stock.prevent_cash_purchase_receipt_internal_number_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, stock, auth, extensions
as $$
begin
  if new.internal_number is distinct from old.internal_number then
    raise exception 'Le numéro interne du justificatif est immuable';
  end if;
  return new;
end;
$$;
revoke all on function stock.prevent_cash_purchase_receipt_internal_number_change() from public, anon, authenticated;
drop trigger if exists cash_purchase_receipts_internal_number_immutable_trg on stock.cash_purchase_receipts;
create trigger cash_purchase_receipts_internal_number_immutable_trg
before update of internal_number on stock.cash_purchase_receipts
for each row execute function stock.prevent_cash_purchase_receipt_internal_number_change();

create or replace function stock.can_insert_cash_purchase_receipt(
  p_cash_purchase_id uuid,
  p_line_ids uuid[],
  p_uploaded_by uuid
) returns boolean
language plpgsql
security definer
set search_path = pg_catalog, stock, auth, extensions
as $$
declare
  v_profile_id uuid;
  v_purchase_status stock.cash_purchase_status;
  v_controlled_at timestamptz;
  v_selected_line_id uuid;
  v_line_id uuid;
begin
  select p.id into v_profile_id
  from stock.profiles p
  where p.user_id = auth.uid() and p.role = 'controleur' and p.status = 'active';
  if v_profile_id is null or p_uploaded_by is distinct from v_profile_id then return false; end if;
  if p_line_ids is null or cardinality(p_line_ids) = 0 then return false; end if;
  select cp.status, cp.controlled_at into v_purchase_status, v_controlled_at
  from stock.cash_purchases cp where cp.id = p_cash_purchase_id for update;
  if not found or v_purchase_status <> 'especes_remises' or v_controlled_at is not null then return false; end if;

  if cardinality(p_line_ids) <> (select count(distinct selected.line_id) from unnest(p_line_ids) as selected(line_id)) then return false; end if;
  for v_selected_line_id in select selected.line_id from unnest(p_line_ids) as selected(line_id) loop
    if v_selected_line_id is null then return false; end if;
    select i.id into v_line_id from stock.cash_purchase_items i
    where i.id = v_selected_line_id and i.cash_purchase_id = p_cash_purchase_id for update;
    if not found then return false; end if;
  end loop;
  return true;
end;
$$;
revoke all on function stock.can_insert_cash_purchase_receipt(uuid, uuid[], uuid) from public, anon;
grant execute on function stock.can_insert_cash_purchase_receipt(uuid, uuid[], uuid) to authenticated;

drop policy if exists "Active controller can add purchase receipts" on stock.cash_purchase_receipts;
create policy "Active controller can add purchase receipts"
on stock.cash_purchase_receipts for insert to authenticated
with check (stock.can_insert_cash_purchase_receipt(cash_purchase_id, line_ids, uploaded_by));

-- Les rôles historiques conservent leurs policies RLS ; l'API ne reçoit aucun droit UPDATE/DELETE.
revoke all on table stock.cash_purchase_receipts from public, anon, authenticated;
grant select, insert on table stock.cash_purchase_receipts to authenticated;

create or replace function stock.cancel_cash_purchase_receipt(p_receipt_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, stock, auth, extensions
as $$
declare
  v_profile_id uuid;
  v_purchase_id uuid;
  v_controlled_at timestamptz;
  v_receipt stock.cash_purchase_receipts%rowtype;
begin
  select p.id into v_profile_id
  from stock.profiles p
  where p.user_id = auth.uid() and p.status = 'active' and p.role in ('direction', 'controleur');
  if v_profile_id is null then raise exception 'Profil Direction ou Contrôleur actif requis'; end if;
  if nullif(btrim(p_reason), '') is null then raise exception 'Motif d’annulation obligatoire'; end if;

  select r.cash_purchase_id into v_purchase_id
  from stock.cash_purchase_receipts r where r.id = p_receipt_id;
  if not found then raise exception 'Justificatif introuvable'; end if;

  -- Même verrou parent que la RPC de contrôle : l'annulation et le contrôle sont sérialisés.
  select cp.controlled_at into v_controlled_at
  from stock.cash_purchases cp where cp.id = v_purchase_id for update;
  if not found or v_controlled_at is not null then
    raise exception 'Le dossier a déjà été contrôlé';
  end if;

  select r.* into v_receipt
  from stock.cash_purchase_receipts r
  where r.id = p_receipt_id and r.cash_purchase_id = v_purchase_id
  for update;
  if not found then raise exception 'Justificatif introuvable'; end if;
  if v_receipt.cancelled_at is not null then raise exception 'Justificatif déjà annulé'; end if;

  update stock.cash_purchase_receipts
  set cancelled_at = clock_timestamp(), cancelled_by = v_profile_id, cancellation_reason = btrim(p_reason)
  where id = p_receipt_id;

  return jsonb_build_object(
    'id', p_receipt_id,
    'cash_purchase_id', v_receipt.cash_purchase_id,
    'cancelled_at', (select r.cancelled_at from stock.cash_purchase_receipts r where r.id = p_receipt_id),
    'cancelled_by', v_profile_id,
    'cancellation_reason', btrim(p_reason)
  );
end;
$$;
revoke all on function stock.cancel_cash_purchase_receipt(uuid, text) from public, anon;
grant execute on function stock.cancel_cash_purchase_receipt(uuid, text) to authenticated;

-- Bucket privé déjà existant : accès Contrôleur limité au bucket, au chemin du dossier et au statut d'upload.
create or replace function stock.can_upload_cash_purchase_receipt_object(p_object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, stock, auth, extensions
as $$
declare
  v_purchase_folder text := split_part(coalesce(p_object_name, ''), '/', 1);
begin
  if v_purchase_folder !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  return exists (
    select 1
    from stock.profiles p
    join stock.cash_purchases cp on cp.id = v_purchase_folder::uuid
    where p.user_id = auth.uid() and p.role = 'controleur' and p.status = 'active'
      and cp.status = 'especes_remises' and cp.controlled_at is null
  );
end;
$$;
revoke all on function stock.can_upload_cash_purchase_receipt_object(text) from public, anon;
grant execute on function stock.can_upload_cash_purchase_receipt_object(text) to authenticated;

create or replace function stock.can_upload_existing_operator_cash_receipt_object(p_object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, stock, auth, extensions
as $$
declare
  v_purchase_folder text := split_part(coalesce(p_object_name, ''), '/', 1);
begin
  if v_purchase_folder !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  return exists (
    select 1
    from stock.profiles p
    join stock.cash_purchases cp on cp.id = v_purchase_folder::uuid
    where p.user_id = auth.uid() and p.status = 'active'
      and p.role in ('direction', 'acheteur', 'caisse')
  );
end;
$$;
revoke all on function stock.can_upload_existing_operator_cash_receipt_object(text) from public, anon;
grant execute on function stock.can_upload_existing_operator_cash_receipt_object(text) to authenticated;

create or replace function stock.can_read_cash_purchase_receipt_object(p_object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, stock, auth, extensions
as $$
declare
  v_purchase_folder text := split_part(coalesce(p_object_name, ''), '/', 1);
begin
  if v_purchase_folder !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  return exists (
    select 1
    from stock.profiles p
    join stock.cash_purchases cp on cp.id = v_purchase_folder::uuid
    where p.user_id = auth.uid() and p.status = 'active'
      and p.role in ('direction', 'acheteur', 'controleur', 'caisse', 'comptabilite', 'magasinier')
  );
end;
$$;
revoke all on function stock.can_read_cash_purchase_receipt_object(text) from public, anon;
grant execute on function stock.can_read_cash_purchase_receipt_object(text) to authenticated;

drop policy if exists "Cash receipt authenticated readers" on storage.objects;
create policy "Cash receipt active workflow readers" on storage.objects for select to authenticated
using (
  bucket_id = 'cash-purchase-receipts'
  and stock.can_read_cash_purchase_receipt_object(name)
);

drop policy if exists "Cash receipt active operators upload" on storage.objects;
create policy "Cash receipt active operators upload" on storage.objects for insert to authenticated
with check (
  bucket_id = 'cash-purchase-receipts'
  and stock.can_upload_existing_operator_cash_receipt_object(name)
);

-- Les objets sont conservés après annulation ; aucun remplacement Storage n'est nécessaire.
drop policy if exists "Cash receipt active operators update" on storage.objects;
drop policy if exists "Active controller uploads eligible cash receipt files" on storage.objects;
create policy "Active controller uploads eligible cash receipt files" on storage.objects for insert to authenticated
with check (
  bucket_id = 'cash-purchase-receipts'
  and stock.can_upload_cash_purchase_receipt_object(name)
);

comment on function stock.cancel_cash_purchase_receipt(uuid, text) is
  'Annulation logique immuable d’un justificatif avant contrôle ; conserve la ligne pour audit.';
comment on table stock.cash_purchase_receipt_daily_counters is
  'Compteurs de numéros F/R par date locale de Madagascar ; accès client interdit.';
