-- C1.2 : journal financier central, append-only.
-- Structure et mécanisme de contre-écriture uniquement : aucune donnée métier.

create table if not exists stock.financial_movements (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references stock.financial_accounts(id) on delete restrict,
  direction text not null check (direction in ('in', 'out')),
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'MGA' check (currency = 'MGA'),
  occurred_at timestamptz not null,
  event_type text not null check (event_type in (
    'cash_disbursed', 'cash_received', 'supplier_payment_executed',
    'non_purchase_cash_disbursed', 'refund_received', 'refund_paid',
    'opening_balance', 'transfer_out', 'transfer_in', 'reversal'
  )),
  source_type text not null,
  source_id uuid null,
  source_occurrence_id uuid null,
  idempotency_key text not null unique,
  counterparty_profile_id uuid null references stock.profiles(id) on delete set null,
  counterparty_name text null,
  payment_mode text null,
  reference text null,
  description text null,
  reversal_of uuid null references stock.financial_movements(id) on delete restrict,
  confirmed_by uuid not null references stock.profiles(id) on delete restrict,
  confirmed_at timestamptz not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references stock.profiles(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  constraint financial_movements_reversal_shape_check check (
    (reversal_of is null and event_type <> 'reversal')
    or (reversal_of is not null and event_type = 'reversal')
  ),
  constraint financial_movements_reversal_not_self_check check (
    reversal_of is null or reversal_of <> id
  ),
  constraint financial_movements_metadata_no_secrets_check check (
    jsonb_typeof(metadata) = 'object'
    and
    not (metadata ?| array[
      'pin', 'pin_hash', 'password', 'token', 'secret',
      'bank_account_number', 'mvola_number'
    ])
  )
);

alter table stock.financial_movements
  drop constraint if exists financial_movements_source_type_nonempty_check,
  drop constraint if exists financial_movements_idempotency_key_nonempty_check;
alter table stock.financial_movements
  add constraint financial_movements_source_type_nonempty_check check (btrim(source_type) <> ''),
  add constraint financial_movements_idempotency_key_nonempty_check check (btrim(idempotency_key) <> '');

create unique index if not exists financial_movements_one_reversal_idx
  on stock.financial_movements(reversal_of)
  where reversal_of is not null;

create index if not exists financial_movements_account_occurred_idx
  on stock.financial_movements(account_id, occurred_at desc);

create index if not exists financial_movements_source_idx
  on stock.financial_movements(source_type, source_id);

create index if not exists financial_movements_event_type_idx
  on stock.financial_movements(event_type, occurred_at desc);

comment on table stock.financial_movements is
  'C1.2 : journal financier append-only. Le solde est derive par SUM(in)-SUM(out); aucune colonne current_balance.';
comment on column stock.financial_movements.idempotency_key is
  'Cle stable construite par la RPC metier; jamais librement fournie par le frontend.';
comment on column stock.financial_movements.reversal_of is
  'Contre-ecriture append-only; l etat contre-passe est derive par existence d une ligne fille.';

insert into stock.role_permissions(role, permission)
select role_name::stock.user_role, permission_name
from (values
  ('direction', 'cash_movements.read'),
  ('comptabilite', 'cash_movements.read'),
  ('caisse', 'cash_movements.read'),
  ('direction', 'cash_movements.reverse')
) as permissions(role_name, permission_name)
on conflict (role, permission) do nothing;

delete from stock.role_permissions
where permission in ('cash_movements.read', 'cash_movements.reverse')
  and (
    (permission = 'cash_movements.read'
      and role not in ('direction'::stock.user_role, 'comptabilite'::stock.user_role, 'caisse'::stock.user_role))
    or (permission = 'cash_movements.reverse'
      and role <> 'direction'::stock.user_role)
  );

create or replace function stock.prevent_financial_movement_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, stock, auth, extensions
as $$
begin
  raise exception 'financial_movements est strictement append-only';
end;
$$;

create or replace function stock.validate_financial_movement_reversal()
returns trigger
language plpgsql
set search_path = pg_catalog, stock, auth, extensions
as $$
declare
  v_original stock.financial_movements%rowtype;
  v_expected_direction text;
begin
  if new.event_type <> 'reversal' then
    return new;
  end if;

  if new.reversal_of is null then
    raise exception 'Une contre-ecriture doit referencer un mouvement original';
  end if;

  select * into v_original
  from stock.financial_movements
  where id = new.reversal_of
  for key share;

  if not found then
    raise exception 'Mouvement original introuvable';
  end if;
  if v_original.event_type = 'reversal' or v_original.reversal_of is not null then
    raise exception 'Une contre-ecriture ne peut pas contre-passer une contre-ecriture';
  end if;
  v_expected_direction := case
    when v_original.direction = 'in' then 'out'
    else 'in'
  end;
  if new.account_id <> v_original.account_id
     or new.amount <> v_original.amount
     or new.currency <> v_original.currency
     or new.direction <> v_expected_direction then
    raise exception 'Contre-ecriture incoherente avec le mouvement original';
  end if;

  return new;
end;
$$;

drop trigger if exists financial_movements_validate_reversal_trg on stock.financial_movements;
create trigger financial_movements_validate_reversal_trg
before insert on stock.financial_movements
for each row execute function stock.validate_financial_movement_reversal();

drop trigger if exists financial_movements_append_only_trg on stock.financial_movements;
create trigger financial_movements_append_only_trg
before update or delete on stock.financial_movements
for each row execute function stock.prevent_financial_movement_mutation();

alter table stock.financial_movements enable row level security;

revoke all on table stock.financial_movements from public, anon, authenticated;
grant select on table stock.financial_movements to authenticated;
revoke insert, update, delete on table stock.financial_movements from public, anon, authenticated;

drop policy if exists "Financial movements readable by authorized profiles" on stock.financial_movements;
create policy "Financial movements readable by authorized profiles"
  on stock.financial_movements for select to authenticated
  using (
    stock.has_permission('cash_movements.read')
    and (
      exists (
        select 1 from stock.profiles p
        where p.id = stock.current_profile_id()
          and p.role in ('direction'::stock.user_role, 'comptabilite'::stock.user_role)
          and p.status = 'active'::stock.user_status
      )
      or exists (
        select 1 from stock.profiles p
        join stock.financial_account_access faa on faa.profile_id = p.id
        where p.id = stock.current_profile_id()
          and p.role = 'caisse'::stock.user_role
          and p.status = 'active'::stock.user_status
          and faa.account_id = financial_movements.account_id
          and faa.active
          and exists (
            select 1 from stock.financial_accounts fa
            where fa.id = financial_movements.account_id and fa.active
          )
      )
    )
  );

create or replace function stock.reverse_financial_movement(
  p_movement_id uuid,
  p_pin text,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, stock, auth, extensions
as $$
declare
  v_actor uuid;
  v_original stock.financial_movements%rowtype;
  v_reversal_id uuid;
begin
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Un motif de contre-ecriture est obligatoire';
  end if;

  v_actor := stock.current_profile_id();

  if not exists (
    select 1 from stock.profiles p
    where p.id = v_actor
      and p.role = 'direction'::stock.user_role
      and p.status = 'active'::stock.user_status
  ) then
    raise exception 'Profil Direction actif requis';
  end if;

  perform stock.assert_sensitive_action(
    'cash_movements.reverse', p_pin, 'financial_movement.reverse',
    'financial_movement', p_movement_id, p_reason, '{}'::jsonb
  );

  select * into v_original
  from stock.financial_movements
  where id = p_movement_id
  for update;

  if not found then
    raise exception 'Mouvement financier introuvable';
  end if;
  if v_original.event_type = 'reversal' or v_original.reversal_of is not null then
    raise exception 'Un mouvement de contre-ecriture ne peut pas etre contre-passe';
  end if;
  select id into v_reversal_id
  from stock.financial_movements
  where reversal_of = v_original.id;
  if found then
    return v_reversal_id;
  end if;

  insert into stock.financial_movements (
    account_id, direction, amount, currency, occurred_at, event_type,
    source_type, source_id, source_occurrence_id, idempotency_key,
    counterparty_profile_id, counterparty_name, payment_mode, reference,
    description, reversal_of, confirmed_by, confirmed_at, created_by, metadata
  ) values (
    v_original.account_id,
    case when v_original.direction = 'in' then 'out' else 'in' end,
    v_original.amount, v_original.currency, now(), 'reversal',
    'financial_movement', v_original.id, null,
    'reversal:' || v_original.id::text,
    v_original.counterparty_profile_id, v_original.counterparty_name,
    v_original.payment_mode, v_original.reference, p_reason,
    v_original.id, v_actor, now(), v_actor,
    '{}'::jsonb
  ) returning id into v_reversal_id;

  insert into stock.sensitive_action_audit (
    action_code, required_permission, actor_profile_id, entity_type, entity_id,
    outcome, reason, metadata
  ) values (
    'financial_movement.reversed', 'cash_movements.reverse', v_actor, 'financial_movement',
    v_original.id, 'completed', p_reason,
    jsonb_build_object('reversal_id', v_reversal_id)
  );

  return v_reversal_id;
end;
$$;

revoke all on function stock.reverse_financial_movement(uuid, text, text) from public, anon, authenticated;
grant execute on function stock.reverse_financial_movement(uuid, text, text) to authenticated;

-- Aucun post generique n est expose en C1.2 : les futures RPC metier construiront
-- cote serveur les cles d idempotence et insereront les mouvements dans leur transaction.
