-- Local additive migration, intentionally held out of the active migration chain.
-- Cash handovers may designate a person without creating an Auth/profile account.

create table if not exists stock.cash_purchase_buyer_directory (
  id uuid primary key default gen_random_uuid(),
  first_name text not null check (btrim(first_name) <> ''),
  last_name text not null check (btrim(last_name) <> ''),
  phone text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid null references stock.profiles(id) on delete set null,
  archived_at timestamptz null,
  archived_by uuid null references stock.profiles(id) on delete set null,
  constraint cash_purchase_buyer_directory_archive_shape_check check ((is_active and archived_at is null and archived_by is null) or (not is_active and archived_at is not null))
);

create index if not exists cash_purchase_buyer_directory_active_name_idx on stock.cash_purchase_buyer_directory (lower(last_name), lower(first_name)) where is_active;

-- The directory is reachable only through the role-checked SECURITY DEFINER RPCs.
-- Keep the table owner able to serve those functions while removing direct client access.
alter table stock.cash_purchase_buyer_directory enable row level security;
revoke all on table stock.cash_purchase_buyer_directory from public, anon, authenticated;

alter table stock.cash_purchases
  alter column buyer_id drop not null,
  add column if not exists buyer_directory_id uuid null references stock.cash_purchase_buyer_directory(id) on delete restrict;

alter table stock.cash_purchases
  drop constraint if exists cash_purchases_buyer_reference_check,
  drop constraint if exists cash_purchases_buyer_exclusive_check,
  add constraint cash_purchases_buyer_exclusive_check
    check (buyer_id is null or buyer_directory_id is null);

alter table stock.financial_movements add column if not exists counterparty_buyer_directory_id uuid null references stock.cash_purchase_buyer_directory(id) on delete set null;
create index if not exists financial_movements_buyer_directory_idx on stock.financial_movements(counterparty_buyer_directory_id) where counterparty_buyer_directory_id is not null;

create or replace function stock.list_cash_purchase_buyers()
returns table (id uuid, full_name text, phone text, kind text, profile_id uuid, directory_id uuid, role text)
language plpgsql security definer set search_path = pg_catalog, stock, auth, extensions
as $$
declare v_profile stock.profiles%rowtype;
begin
  select p.* into v_profile from stock.profiles p where p.user_id = auth.uid() and p.status = 'active'::stock.user_status;
  if not found or v_profile.role not in ('caisse'::stock.user_role, 'direction'::stock.user_role, 'controleur'::stock.user_role) then raise exception 'Profil non autorisé'; end if;
  return query
  select p.id, p.full_name, null::text, 'profile'::text, p.id, null::uuid, p.role::text from stock.profiles p where p.role = 'acheteur'::stock.user_role and p.status = 'active'::stock.user_status
  union all
  select d.id, concat_ws(' ', d.first_name, d.last_name), d.phone, 'directory'::text, null::uuid, d.id, 'acheteur_sans_compte'::text from stock.cash_purchase_buyer_directory d where d.is_active
  order by 2;
end;
$$;

create or replace function stock.create_cash_purchase_buyer(p_first_name text, p_last_name text, p_phone text default null)
returns uuid language plpgsql security definer set search_path = pg_catalog, stock, auth, extensions
as $$
declare v_profile stock.profiles%rowtype; v_id uuid;
begin
  select p.* into v_profile from stock.profiles p where p.user_id = auth.uid() and p.status = 'active'::stock.user_status;
  if not found or v_profile.role not in ('caisse'::stock.user_role, 'direction'::stock.user_role) then raise exception 'Profil Caisse ou Direction actif requis'; end if;
  if nullif(btrim(p_first_name), '') is null or nullif(btrim(p_last_name), '') is null then raise exception 'Nom et prénom de l’acheteur obligatoires'; end if;
  insert into stock.cash_purchase_buyer_directory(first_name, last_name, phone, created_by) values (btrim(p_first_name), btrim(p_last_name), nullif(btrim(p_phone), ''), v_profile.id) returning id into v_id;
  return v_id;
end;
$$;

create or replace function stock.archive_cash_purchase_buyer(p_buyer_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog, stock, auth, extensions
as $$
declare v_profile stock.profiles%rowtype;
begin
  select p.* into v_profile from stock.profiles p where p.user_id = auth.uid() and p.status = 'active'::stock.user_status;
  if not found or v_profile.role <> 'direction'::stock.user_role then raise exception 'Profil Direction actif requis'; end if;
  update stock.cash_purchase_buyer_directory set is_active = false, archived_at = now(), archived_by = v_profile.id where id = p_buyer_id and is_active;
  if not found then raise exception 'Acheteur introuvable ou déjà archivé'; end if;
end;
$$;

create or replace function stock.disburse_cash_purchase(p_cash_purchase_id uuid, p_amount numeric, p_buyer_profile_id uuid, p_buyer_directory_id uuid, p_pin text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, stock, auth, extensions
as $$
declare
  v_profile_id uuid; v_purchase stock.cash_purchases%rowtype; v_account stock.financial_accounts%rowtype; v_existing_movement stock.financial_movements%rowtype;
  v_movement_id uuid; v_movement_count integer; v_idempotency_key text; v_given_at timestamptz; v_directory_name text;
begin
  select p.id into v_profile_id from stock.profiles p where p.user_id = auth.uid() and p.role = 'caisse'::stock.user_role and p.status = 'active'::stock.user_status;
  if v_profile_id is null then raise exception 'Profil Caisse actif requis'; end if;
  if (p_buyer_profile_id is null) = (p_buyer_directory_id is null) then raise exception 'Un seul acheteur doit être sélectionné'; end if;
  perform stock.assert_sensitive_action('cash_purchases.disburse', p_pin, 'cash_purchase.disburse', 'cash_purchase', p_cash_purchase_id, null, '{}'::jsonb);
  if p_buyer_profile_id is not null and not exists (select 1 from stock.profiles p where p.id = p_buyer_profile_id and p.role = 'acheteur'::stock.user_role and p.status = 'active'::stock.user_status) then raise exception 'Acheteur profil actif requis'; end if;
  if p_buyer_directory_id is not null then
    select concat_ws(' ', d.first_name, d.last_name) into v_directory_name from stock.cash_purchase_buyer_directory d where d.id = p_buyer_directory_id and d.is_active;
    if v_directory_name is null then raise exception 'Acheteur du répertoire introuvable ou archivé'; end if;
  end if;
  select * into v_purchase from stock.cash_purchases where id = p_cash_purchase_id for update;
  if not found then raise exception 'Dossier achat espèces introuvable'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Le montant remis doit être supérieur à 0'; end if;
  if coalesce(v_purchase.amount_given, 0) > 0 or v_purchase.given_at is not null then
    if v_purchase.amount_given is null or v_purchase.given_at is null or v_purchase.given_by is null or v_purchase.financial_account_id is null then raise exception 'Incohérence historique : remise journalisée incomplète'; end if;
    select fa.* into v_account from stock.financial_accounts fa where fa.id = v_purchase.financial_account_id and fa.active and fa.account_type = 'cash' and fa.currency = 'MGA';
    if not found then raise exception 'Le compte financier mémorisé est introuvable ou inactif'; end if;
    if not exists (select 1 from stock.financial_account_access faa where faa.account_id = v_purchase.financial_account_id and faa.profile_id = v_profile_id and faa.active) then raise exception 'Le compte financier de ce décaissement n’est pas affecté à cette Caisse'; end if;
    select fm.* into v_existing_movement from stock.financial_movements fm where fm.source_type = 'cash_purchase' and fm.event_type = 'cash_disbursed' and fm.source_id = v_purchase.id limit 1;
    if not found then raise exception 'Incohérence historique : remise enregistrée sans mouvement financier'; end if;
    select count(*) into v_movement_count from stock.financial_movements fm where fm.source_type = 'cash_purchase' and fm.event_type = 'cash_disbursed' and fm.source_id = v_purchase.id;
    if v_movement_count <> 1 then raise exception 'Incohérence historique : plusieurs mouvements de remise existent'; end if;
    if v_purchase.buyer_id is distinct from p_buyer_profile_id or v_purchase.buyer_directory_id is distinct from p_buyer_directory_id or v_existing_movement.counterparty_profile_id is distinct from p_buyer_profile_id or v_existing_movement.counterparty_buyer_directory_id is distinct from p_buyer_directory_id or v_existing_movement.account_id is distinct from v_purchase.financial_account_id or v_existing_movement.amount is distinct from v_purchase.amount_given or v_existing_movement.confirmed_by is distinct from v_purchase.given_by or v_existing_movement.direction is distinct from 'out' or v_existing_movement.currency is distinct from 'MGA' or v_existing_movement.payment_mode is distinct from 'especes' or p_amount is distinct from v_purchase.amount_given then raise exception 'La remise existe déjà avec des données différentes'; end if;
    return jsonb_build_object('cash_purchase_id', v_purchase.id, 'amount_given', v_purchase.amount_given, 'buyer_profile_id', p_buyer_profile_id, 'buyer_directory_id', p_buyer_directory_id, 'given_by', v_purchase.given_by, 'given_at', v_purchase.given_at, 'financial_account_id', v_purchase.financial_account_id, 'financial_movement_id', v_existing_movement.id);
  end if;
  if v_purchase.status <> 'valide'::stock.cash_purchase_status then raise exception 'Le décaissement n’est pas autorisé par la Direction'; end if;
  if v_purchase.cash_source <> 'caisse_principale'::stock.cash_purchase_source then raise exception 'Compte financier non configuré pour cette source de caisse'; end if;
  select fa.* into v_account from stock.financial_accounts fa where fa.code = 'CASH_MAIN' and fa.active and fa.account_type = 'cash' and fa.currency = 'MGA';
  if not found then raise exception 'Compte financier non configuré pour cette source de caisse'; end if;
  if not exists (select 1 from stock.financial_account_access faa where faa.account_id = v_account.id and faa.profile_id = v_profile_id and faa.active) then raise exception 'Le compte financier n’est pas affecté à cette Caisse'; end if;
  v_given_at := now(); v_idempotency_key := 'cash_purchase:' || v_purchase.id::text || ':cash_disbursed:' || v_account.id::text;
  update stock.cash_purchases set buyer_id = p_buyer_profile_id, buyer_directory_id = p_buyer_directory_id, amount_given = p_amount, given_by = v_profile_id, given_at = v_given_at, financial_account_id = v_account.id, status = 'especes_remises', cash_status = 'especes_remises', updated_by = v_profile_id, updated_at = v_given_at where id = v_purchase.id;
  insert into stock.financial_movements (account_id, direction, amount, currency, occurred_at, event_type, source_type, source_id, source_occurrence_id, idempotency_key, counterparty_profile_id, counterparty_buyer_directory_id, payment_mode, reference, description, confirmed_by, confirmed_at, created_by, metadata)
  values (v_account.id, 'out', p_amount, 'MGA', v_given_at, 'cash_disbursed', 'cash_purchase', v_purchase.id, null, v_idempotency_key, p_buyer_profile_id, p_buyer_directory_id, 'especes', v_purchase.reference, 'Remise espèces achat direct', v_profile_id, v_given_at, v_profile_id, jsonb_build_object('buyer_profile_id', p_buyer_profile_id, 'buyer_directory_id', p_buyer_directory_id)) returning id into v_movement_id;
  insert into stock.sensitive_action_audit (action_code, required_permission, actor_profile_id, entity_type, entity_id, outcome, reason, metadata) values ('cash_purchase.disbursed', 'cash_purchases.disburse', v_profile_id, 'cash_purchase', v_purchase.id, 'completed', null, jsonb_build_object('financial_account_id', v_account.id, 'amount_given', p_amount, 'buyer_profile_id', p_buyer_profile_id, 'buyer_directory_id', p_buyer_directory_id));
  return jsonb_build_object('cash_purchase_id', v_purchase.id, 'amount_given', p_amount, 'buyer_profile_id', p_buyer_profile_id, 'buyer_directory_id', p_buyer_directory_id, 'given_by', v_profile_id, 'given_at', v_given_at, 'financial_account_id', v_account.id, 'financial_movement_id', v_movement_id);
end;
$$;

revoke all on function stock.disburse_cash_purchase(uuid, numeric, text) from public, anon, authenticated;
do $$ begin if to_regprocedure('stock.disburse_cash_purchase(uuid,numeric,uuid,text)') is not null then revoke all on function stock.disburse_cash_purchase(uuid, numeric, uuid, text) from public, anon, authenticated; end if; end $$;
revoke all on function stock.disburse_cash_purchase(uuid, numeric, uuid, uuid, text) from public, anon, authenticated;
grant execute on function stock.disburse_cash_purchase(uuid, numeric, uuid, uuid, text) to authenticated;
grant execute on function stock.list_cash_purchase_buyers() to authenticated;
grant execute on function stock.create_cash_purchase_buyer(text, text, text) to authenticated;
grant execute on function stock.archive_cash_purchase_buyer(uuid) to authenticated;
