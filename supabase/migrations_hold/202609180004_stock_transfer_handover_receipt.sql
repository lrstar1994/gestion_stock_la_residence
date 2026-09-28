-- Circuit de transmission physique a double confirmation PIN.
-- Extension additive du modèle 180002 : les transferts historiques et leurs
-- mouvements directs restent intacts et consultables.

-- pending_direction est un ancien état de validation 180002. La nouvelle
-- version retire l'appel client à finalize_stock_transfer; ne jamais laisser
-- ces dossiers bloqués silencieusement. Ils doivent être validés via l'ancien
-- parcours Direction avant application de cette migration.
do $$
begin
  if exists (
    select 1 from stock.stock_transfer_batches where status = 'pending_direction'
  ) then
    raise exception 'Des transferts pending_direction doivent être traités par Direction avant application de 180004';
  end if;
end;
$$;

alter table stock.locations
  add column if not exists is_stock_transit boolean not null default false;

create unique index if not exists locations_one_stock_transit_idx
  on stock.locations(is_stock_transit) where is_stock_transit;

insert into stock.locations(name, description, is_magasin_general, is_active, is_stock_transit)
select '__SYSTEM_STOCK_TRANSFER_TRANSIT__', 'Localisation technique réservée aux transferts en transit.', false, true, true
where not exists (select 1 from stock.locations where is_stock_transit);

create or replace function stock.prevent_stock_transit_location_mutation()
returns trigger language plpgsql security definer
set search_path = pg_catalog, stock
as $$
begin
  if (tg_op = 'DELETE' and old.is_stock_transit)
     or (tg_op = 'UPDATE' and (old.is_stock_transit or new.is_stock_transit)) then
    raise exception 'La localisation technique EN TRANSIT ne peut pas être modifiée ou supprimée';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function stock.prevent_stock_transit_location_mutation() from public, anon, authenticated;
drop trigger if exists stock_transit_location_immutable on stock.locations;
create trigger stock_transit_location_immutable before update or delete on stock.locations
for each row execute function stock.prevent_stock_transit_location_mutation();

alter table stock.stock_transfer_batches
  add column if not exists prepared_by uuid references stock.profiles(id) on delete set null,
  add column if not exists prepared_at timestamptz,
  add column if not exists source_type text,
  add column if not exists source_id uuid,
  add column if not exists from_location_name_snapshot text,
  add column if not exists to_location_name_snapshot text,
  add column if not exists authorized_by uuid references stock.profiles(id) on delete set null,
  add column if not exists authorized_at timestamptz,
  add column if not exists closed_by uuid references stock.profiles(id) on delete set null,
  add column if not exists closed_at timestamptz;

alter table stock.stock_transfer_batch_items
  add column if not exists authorized_quantity numeric(14,4);

do $$
declare c record;
begin
  for c in
    select conname from pg_catalog.pg_constraint
    where conrelid = 'stock.stock_transfer_batches'::regclass
      and contype = 'c'
      and pg_catalog.pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table stock.stock_transfer_batches drop constraint %I', c.conname);
  end loop;
end;
$$;

alter table stock.stock_transfer_batches
  add constraint stock_transfer_batches_workflow_status_check
  check (status in (
    'draft', 'pending_direction', 'validated', 'cancelled',
    'prepared', 'awaiting_dispatch', 'in_transit', 'partially_received',
    'discrepancy_pending', 'received', 'closed',
    'closed_with_justified_discrepancy'
  ));

create table if not exists stock.stock_transfer_handoffs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  transfer_id uuid not null references stock.stock_transfer_batches(id) on delete restrict,
  reference text not null unique,
  dispatched_by uuid not null references stock.profiles(id) on delete restrict,
  dispatched_role text not null default 'magasinier',
  dispatch_location_id uuid not null references stock.locations(id) on delete restrict,
  dispatched_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default clock_timestamp()
);

create table if not exists stock.stock_transfer_handoff_items (
  id uuid primary key default gen_random_uuid(),
  handoff_id uuid not null references stock.stock_transfer_handoffs(id) on delete restrict,
  batch_item_id uuid not null references stock.stock_transfer_batch_items(id) on delete restrict,
  article_id uuid not null references stock.articles(id) on delete restrict,
  unit_id uuid not null references stock.units(id) on delete restrict,
  dispatched_quantity numeric(14,4) not null check (dispatched_quantity > 0),
  stock_movement_id uuid references stock.stock_movements(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  unique (handoff_id, batch_item_id)
);

create table if not exists stock.stock_transfer_receipts (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  handoff_id uuid not null references stock.stock_transfer_handoffs(id) on delete restrict,
  received_by uuid not null references stock.profiles(id) on delete restrict,
  received_role text not null,
  receive_location_id uuid not null references stock.locations(id) on delete restrict,
  finalize_discrepancy boolean not null default false,
  discrepancy_reason text,
  request_payload jsonb,
  received_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default clock_timestamp()
);

alter table stock.stock_transfer_receipts
  add column if not exists request_payload jsonb;

create table if not exists stock.stock_transfer_receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references stock.stock_transfer_receipts(id) on delete restrict,
  handoff_item_id uuid not null references stock.stock_transfer_handoff_items(id) on delete restrict,
  article_id uuid not null references stock.articles(id) on delete restrict,
  unit_id uuid not null references stock.units(id) on delete restrict,
  received_quantity numeric(14,4) not null check (received_quantity > 0),
  stock_movement_id uuid references stock.stock_movements(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp()
);

-- Un item d'une remise ne peut être enregistré qu'une fois par reçu.
create unique index if not exists stock_transfer_receipt_items_receipt_handoff_item_idx
  on stock.stock_transfer_receipt_items(receipt_id, handoff_item_id);

create table if not exists stock.stock_transfer_discrepancies (
  id uuid primary key default gen_random_uuid(),
  handoff_item_id uuid not null references stock.stock_transfer_handoff_items(id) on delete restrict,
  quantity numeric(14,4) not null check (quantity > 0),
  reason text not null check (length(btrim(reason)) > 0),
  opened_by uuid not null references stock.profiles(id) on delete restrict,
  opened_at timestamptz not null default clock_timestamp(),
  recipient_confirmed_by uuid not null references stock.profiles(id) on delete restrict,
  recipient_role text not null,
  destination_location_id uuid not null references stock.locations(id) on delete restrict,
  recipient_confirmed_at timestamptz not null default clock_timestamp(),
  magasinier_confirmed_by uuid references stock.profiles(id) on delete restrict,
  magasinier_role text,
  magasinier_confirmed_at timestamptz,
  origin_location_id uuid not null references stock.locations(id) on delete restrict,
  status text not null default 'awaiting_magasinier'
    check (status in ('awaiting_magasinier', 'resolved')),
  stock_movement_id uuid references stock.stock_movements(id) on delete restrict,
  resolved_at timestamptz,
  check (recipient_confirmed_by <> magasinier_confirmed_by),
  check ((magasinier_confirmed_by is null) = (magasinier_confirmed_at is null)),
  check ((status <> 'resolved') or (magasinier_confirmed_by is not null and stock_movement_id is not null and resolved_at is not null))
);

create unique index if not exists stock_transfer_discrepancy_open_handoff_item_idx
  on stock.stock_transfer_discrepancies(handoff_item_id) where status = 'awaiting_magasinier';
create index if not exists stock_transfer_handoffs_transfer_idx
  on stock.stock_transfer_handoffs(transfer_id, dispatched_at);
create index if not exists stock_transfer_receipts_handoff_idx
  on stock.stock_transfer_receipts(handoff_id, received_at);
create index if not exists stock_transfer_discrepancies_opened_idx
  on stock.stock_transfer_discrepancies(status, opened_at);

create or replace view stock.stock_transfer_transit_view with (security_invoker = true) as
select
  b.id as transfer_id,
  b.reference as transfer_reference,
  b.from_location_id,
  b.to_location_id,
  b.from_location_name_snapshot as from_location_name,
  b.to_location_name_snapshot as to_location_name,
  bi.id as batch_item_id,
  bi.article_id,
  a.name as article_name,
  bi.unit_id,
  u.abbreviation as unit_abbreviation,
  coalesce(bi.authorized_quantity, bi.quantity) as authorized_quantity,
  coalesce(sent.dispatched_quantity, 0)::numeric(14,4) as dispatched_quantity,
  coalesce(got.received_quantity, 0)::numeric(14,4) as received_quantity,
  coalesce(settled.discrepancy_quantity, 0)::numeric(14,4) as settled_discrepancy_quantity,
  greatest(coalesce(bi.authorized_quantity, bi.quantity) - coalesce(sent.dispatched_quantity, 0), 0)::numeric(14,4) as remaining_to_dispatch,
  greatest(coalesce(sent.dispatched_quantity, 0) - coalesce(got.received_quantity, 0) - coalesce(settled.discrepancy_quantity, 0), 0)::numeric(14,4) as in_transit_quantity,
  coalesce(declared.discrepancy_quantity, 0)::numeric(14,4) as discrepancy_quantity,
  latest.dispatched_at as last_dispatch_at
from stock.stock_transfer_batch_items bi
join stock.stock_transfer_batches b on b.id = bi.transfer_id
join stock.articles a on a.id = bi.article_id
join stock.units u on u.id = bi.unit_id
left join lateral (
  select sum(hi.dispatched_quantity) as dispatched_quantity
  from stock.stock_transfer_handoffs h
  join stock.stock_transfer_handoff_items hi on hi.handoff_id = h.id
  where h.transfer_id = b.id and hi.batch_item_id = bi.id
) sent on true
left join lateral (
  select sum(ri.received_quantity) as received_quantity
  from stock.stock_transfer_handoffs h
  join stock.stock_transfer_handoff_items hi on hi.handoff_id = h.id
  join stock.stock_transfer_receipt_items ri on ri.handoff_item_id = hi.id
  where h.transfer_id = b.id and hi.batch_item_id = bi.id
) got on true
left join lateral (
  select sum(d.quantity) as discrepancy_quantity
  from stock.stock_transfer_handoffs h
  join stock.stock_transfer_handoff_items hi on hi.handoff_id = h.id
  join stock.stock_transfer_discrepancies d on d.handoff_item_id = hi.id
  where h.transfer_id = b.id and hi.batch_item_id = bi.id
) declared on true
left join lateral (
  select sum(d.quantity) as discrepancy_quantity
  from stock.stock_transfer_handoffs h
  join stock.stock_transfer_handoff_items hi on hi.handoff_id = h.id
  join stock.stock_transfer_discrepancies d on d.handoff_item_id = hi.id and d.status = 'resolved'
  where h.transfer_id = b.id and hi.batch_item_id = bi.id
) settled on true
left join lateral (
  select max(h.dispatched_at) as dispatched_at
  from stock.stock_transfer_handoffs h
  join stock.stock_transfer_handoff_items hi on hi.handoff_id = h.id
  where h.transfer_id = b.id and hi.batch_item_id = bi.id
) latest on true
where b.status in ('prepared', 'awaiting_dispatch', 'in_transit', 'partially_received', 'discrepancy_pending', 'received')
  and (coalesce(sent.dispatched_quantity, 0) > 0 or coalesce(bi.authorized_quantity, bi.quantity) > 0);

alter table stock.stock_transfer_handoffs enable row level security;
alter table stock.stock_transfer_handoff_items enable row level security;
alter table stock.stock_transfer_receipts enable row level security;
alter table stock.stock_transfer_receipt_items enable row level security;
alter table stock.stock_transfer_discrepancies enable row level security;

revoke all on stock.stock_transfer_handoffs, stock.stock_transfer_handoff_items,
  stock.stock_transfer_receipts, stock.stock_transfer_receipt_items,
  stock.stock_transfer_discrepancies from public, anon, authenticated;
grant select on stock.stock_transfer_handoffs, stock.stock_transfer_handoff_items,
  stock.stock_transfer_receipts, stock.stock_transfer_receipt_items,
  stock.stock_transfer_discrepancies to authenticated;
revoke all on stock.stock_transfer_transit_view from public, anon, authenticated;
grant select on stock.stock_transfer_transit_view to authenticated;

drop policy if exists stock_transfer_batches_read_authorized on stock.stock_transfer_batches;
create policy stock_transfer_batches_read_authorized on stock.stock_transfer_batches
for select to authenticated
using (
  stock.can_read_stock_transfer_batch(created_by)
  or stock.can_access_stock_location(from_location_id, false)
  or stock.can_access_stock_location(to_location_id, false)
);

drop policy if exists locations_scoped_read on stock.locations;
create policy locations_scoped_read on stock.locations for select to authenticated
using (
  not is_stock_transit and (
    stock.can_access_stock_location(id, false)
    or exists (
      select 1 from stock.stock_movements sm
      where (sm.from_location_id = id and stock.can_access_stock_location(sm.to_location_id, false))
         or (sm.to_location_id = id and stock.can_access_stock_location(sm.from_location_id, false))
    )
  )
);

drop policy if exists stock_transfer_batch_items_read_authorized on stock.stock_transfer_batch_items;
create policy stock_transfer_batch_items_read_authorized on stock.stock_transfer_batch_items
for select to authenticated
using (exists (
  select 1 from stock.stock_transfer_batches b where b.id = transfer_id
    and (stock.can_read_stock_transfer_batch(b.created_by)
      or stock.can_access_stock_location(b.from_location_id, false)
      or stock.can_access_stock_location(b.to_location_id, false))
));

drop policy if exists stock_transfer_handoffs_read_authorized on stock.stock_transfer_handoffs;
create policy stock_transfer_handoffs_read_authorized on stock.stock_transfer_handoffs
for select to authenticated using (exists (
  select 1 from stock.stock_transfer_batches b where b.id = transfer_id
    and (stock.can_read_stock_transfer_batch(b.created_by)
      or stock.can_access_stock_location(b.from_location_id, false)
      or stock.can_access_stock_location(b.to_location_id, false))
));

drop policy if exists stock_transfer_handoff_items_read_authorized on stock.stock_transfer_handoff_items;
create policy stock_transfer_handoff_items_read_authorized on stock.stock_transfer_handoff_items
for select to authenticated using (exists (
  select 1 from stock.stock_transfer_handoffs h
  join stock.stock_transfer_batches b on b.id = h.transfer_id
  where h.id = handoff_id and (stock.can_read_stock_transfer_batch(b.created_by)
    or stock.can_access_stock_location(b.from_location_id, false)
    or stock.can_access_stock_location(b.to_location_id, false))
));

drop policy if exists stock_transfer_receipts_read_authorized on stock.stock_transfer_receipts;
create policy stock_transfer_receipts_read_authorized on stock.stock_transfer_receipts
for select to authenticated using (exists (
  select 1 from stock.stock_transfer_handoffs h
  join stock.stock_transfer_batches b on b.id = h.transfer_id
  where h.id = handoff_id and (stock.can_read_stock_transfer_batch(b.created_by)
    or stock.can_access_stock_location(b.from_location_id, false)
    or stock.can_access_stock_location(b.to_location_id, false))
));

drop policy if exists stock_transfer_receipt_items_read_authorized on stock.stock_transfer_receipt_items;
create policy stock_transfer_receipt_items_read_authorized on stock.stock_transfer_receipt_items
for select to authenticated using (exists (
  select 1 from stock.stock_transfer_handoff_items hi
  join stock.stock_transfer_handoffs h on h.id = hi.handoff_id
  join stock.stock_transfer_batches b on b.id = h.transfer_id
  where hi.id = handoff_item_id and (stock.can_read_stock_transfer_batch(b.created_by)
    or stock.can_access_stock_location(b.from_location_id, false)
    or stock.can_access_stock_location(b.to_location_id, false))
));

drop policy if exists stock_transfer_discrepancies_read_authorized on stock.stock_transfer_discrepancies;
create policy stock_transfer_discrepancies_read_authorized on stock.stock_transfer_discrepancies
for select to authenticated using (exists (
  select 1 from stock.stock_transfer_handoff_items hi
  join stock.stock_transfer_handoffs h on h.id = hi.handoff_id
  join stock.stock_transfer_batches b on b.id = h.transfer_id
  where hi.id = handoff_item_id and (stock.can_read_stock_transfer_batch(b.created_by)
    or stock.can_access_stock_location(b.from_location_id, false)
    or stock.can_access_stock_location(b.to_location_id, false))
));

insert into stock.role_permissions(role, permission) values
  ('magasinier', 'stock.transfers.dispatch'),
  ('magasinier', 'stock.transfers.receive'),
  ('chef_cuisine', 'stock.transfers.receive'),
  ('point_vente', 'stock.transfers.receive'),
  ('direction', 'stock.transfers.close')
on conflict (role, permission) do nothing;

-- La permission historique de création avait aussi été accordée à chef_cuisine
-- dans le socle local ; son retrait respecte la règle de création réservée.
delete from stock.role_permissions
where role = 'chef_cuisine' and permission = 'stock.transfers.create';

create or replace function stock.validate_stock_transfer_transit_movement(
  p_movement stock.stock_movements
) returns boolean
language plpgsql stable security definer
set search_path = pg_catalog, stock, auth
as $$
declare
  v_transit_id uuid;
  v_actor uuid := stock.current_profile_id();
begin
  select id into v_transit_id from stock.locations where is_stock_transit limit 1;
  if v_transit_id is null then return false; end if;
  if p_movement.reference_type = 'stock_transfer_handoff' then
    return exists (
      select 1 from stock.stock_transfer_handoffs h
      join stock.stock_transfer_batches b on b.id = h.transfer_id
      join stock.stock_transfer_handoff_items hi on hi.handoff_id = h.id
      join stock.stock_transfer_batch_items bi on bi.id = hi.batch_item_id
      where h.id = p_movement.reference_id and hi.stock_movement_id is null
        and h.dispatched_by = v_actor and b.from_location_id = p_movement.from_location_id
        and v_transit_id = p_movement.to_location_id and p_movement.movement_type = 'transfert'
        and bi.article_id = p_movement.article_id and bi.unit_id = p_movement.unit_id
        and hi.dispatched_quantity = p_movement.quantity
    );
  elsif p_movement.reference_type = 'stock_transfer_receipt' then
    return exists (
      select 1 from stock.stock_transfer_receipts r
      join stock.stock_transfer_handoffs h on h.id = r.handoff_id
      join stock.stock_transfer_batches b on b.id = h.transfer_id
      join stock.stock_transfer_receipt_items ri on ri.receipt_id = r.id
      join stock.stock_transfer_handoff_items hi on hi.id = ri.handoff_item_id
      where r.id = p_movement.reference_id and ri.stock_movement_id is null
        and r.received_by = v_actor and v_transit_id = p_movement.from_location_id
        and b.to_location_id = p_movement.to_location_id and p_movement.movement_type = 'transfert'
        and ri.article_id = p_movement.article_id and ri.unit_id = p_movement.unit_id
        and ri.received_quantity = p_movement.quantity and hi.id = ri.handoff_item_id
    );
  elsif p_movement.reference_type = 'stock_transfer_discrepancy' then
    return exists (
      select 1 from stock.stock_transfer_discrepancies d
      join stock.stock_transfer_handoff_items hi on hi.id = d.handoff_item_id
      join stock.stock_transfer_handoffs h on h.id = hi.handoff_id
      join stock.stock_transfer_batches b on b.id = h.transfer_id
      join stock.stock_transfer_batch_items bi on bi.id = hi.batch_item_id
      where d.id = p_movement.reference_id and d.stock_movement_id is null
        and d.magasinier_confirmed_by = v_actor and d.magasinier_confirmed_at is not null
        and v_transit_id = p_movement.from_location_id and p_movement.to_location_id is null
        and p_movement.movement_type = 'perte' and bi.article_id = p_movement.article_id
        and bi.unit_id = p_movement.unit_id and d.quantity = p_movement.quantity
    );
  end if;
  return false;
end;
$$;
revoke all on function stock.validate_stock_transfer_transit_movement(stock.stock_movements) from public, anon, authenticated;

create or replace function stock.enforce_stock_movement_location_access()
returns trigger language plpgsql security definer
set search_path = pg_catalog, stock, auth
as $$
declare v_transit_id uuid;
begin
  select id into v_transit_id from stock.locations where is_stock_transit limit 1;
  if new.from_location_id = v_transit_id or new.to_location_id = v_transit_id then
    if not stock.validate_stock_transfer_transit_movement(new) then
      raise exception 'Un mouvement en transit doit provenir du circuit de remise, réception ou écart confirmé';
    end if;
    return new;
  end if;
  if new.movement_type = 'transfert' then
    raise exception 'Un nouveau transfert doit passer par la préparation puis la remise et la réception avec PIN';
  end if;
  if not stock.stock_movement_location_write_allowed(new.article_id, new.movement_type, new.from_location_id, new.to_location_id) then
    raise exception 'La localisation d’origine ou de destination n’est pas autorisée pour cet utilisateur';
  end if;
  return new;
end;
$$;
revoke all on function stock.enforce_stock_movement_location_access() from public, anon, authenticated;
drop trigger if exists stock_movement_location_access_guard on stock.stock_movements;
create trigger stock_movement_location_access_guard
before insert or update of article_id, movement_type, from_location_id, to_location_id
on stock.stock_movements for each row execute function stock.enforce_stock_movement_location_access();

create or replace function stock.guard_stock_transfer_batch_item_workflow()
returns trigger language plpgsql security definer
set search_path = pg_catalog, stock
as $$
declare v_status text; v_transfer_id uuid;
begin
  v_transfer_id := coalesce(new.transfer_id, old.transfer_id);
  select status into v_status from stock.stock_transfer_batches where id = v_transfer_id for update;
  if v_status is distinct from 'draft' then
    raise exception 'Les lignes d’un transfert préparé ne sont plus modifiables';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function stock.guard_stock_transfer_batch_item_workflow() from public, anon, authenticated;

drop trigger if exists stock_transfer_batch_items_workflow_guard on stock.stock_transfer_batch_items;
create trigger stock_transfer_batch_items_workflow_guard
before insert or update or delete on stock.stock_transfer_batch_items
for each row execute function stock.guard_stock_transfer_batch_item_workflow();

create or replace function stock.prevent_transfer_movement_mutation()
returns trigger language plpgsql security definer
set search_path = pg_catalog, stock
as $$
begin
  if old.reference_type in ('stock_transfer_handoff', 'stock_transfer_receipt', 'stock_transfer_discrepancy') then
    raise exception 'Les mouvements de remise, réception et écart sont définitifs';
  end if;
  if tg_op = 'UPDATE' and new.reference_type in ('stock_transfer_handoff', 'stock_transfer_receipt', 'stock_transfer_discrepancy') then
    raise exception 'Un mouvement existant ne peut pas être reclassé en mouvement de transfert';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function stock.prevent_transfer_movement_mutation() from public, anon, authenticated;
drop trigger if exists stock_transfer_movement_append_only on stock.stock_movements;
create trigger stock_transfer_movement_append_only
before update or delete on stock.stock_movements
for each row execute function stock.prevent_transfer_movement_mutation();

create or replace function stock.prepare_stock_transfer(
  p_transfer_id uuid,
  p_source_type text default 'manual_exception',
  p_source_id uuid default null
) returns jsonb
language plpgsql security definer
set search_path = pg_catalog, stock, auth, extensions
as $$
declare
  v_profile uuid := stock.current_profile_id();
  v_role stock.user_role;
  v_batch stock.stock_transfer_batches%rowtype;
  v_allowed boolean;
begin
  if v_profile is null or not stock.has_permission('stock.transfers.create') then raise exception 'Permission de préparation de transfert insuffisante'; end if;
  select role into v_role from stock.profiles where id = v_profile and status = 'active';
  if v_role is null or v_role <> 'direction' then raise exception 'Seule Direction peut préparer et autoriser un transfert'; end if;
  select * into v_batch from stock.stock_transfer_batches where id = p_transfer_id for update;
  if not found then raise exception 'Transfert introuvable'; end if;
  if v_batch.status <> 'draft' then raise exception 'Seul un brouillon peut être préparé'; end if;
  if v_batch.created_by <> v_profile and v_role <> 'direction' then raise exception 'Ce brouillon appartient à un autre utilisateur'; end if;
  if v_batch.from_location_id is null or v_batch.to_location_id is null or v_batch.from_location_id = v_batch.to_location_id
     or v_batch.movement_date is null or nullif(btrim(v_batch.reason), '') is null then
    raise exception 'Origine, destination, date et motif sont obligatoires';
  end if;
  if p_source_type is null or p_source_type not in ('operation', 'stock_request', 'manual_exception') then raise exception 'Type de provenance invalide'; end if;
  if not exists (select 1 from stock.locations l where l.id = v_batch.from_location_id and l.is_active and not l.is_stock_transit)
     or not exists (select 1 from stock.locations l where l.id = v_batch.to_location_id and l.is_active and not l.is_stock_transit) then
    raise exception 'Origine et destination doivent être des localisations opérationnelles actives';
  end if;
  if not exists (select 1 from stock.stock_transfer_batch_items i where i.transfer_id = p_transfer_id) then raise exception 'Ajoutez au moins une ligne'; end if;
  if exists (
    select 1 from stock.stock_transfer_batch_items i
    left join stock.articles a on a.id = i.article_id
    where i.transfer_id = p_transfer_id and (a.id is null or a.status <> 'active' or a.stockable is false
      or i.unit_id is distinct from a.unit_id or i.quantity is null or i.quantity <= 0
      or i.quantity <> round(i.quantity, 3) or not stock.article_location_allowed(i.article_id, v_batch.from_location_id)
      or not stock.article_location_allowed(i.article_id, v_batch.to_location_id))
  ) then raise exception 'Une ligne est invalide, non autorisée ou dépasse la précision de stock (3 décimales maximum)'; end if;

  update stock.stock_transfer_batch_items set authorized_quantity = quantity where transfer_id = p_transfer_id;
  update stock.stock_transfer_batches set status = 'prepared', prepared_by = v_profile, prepared_at = clock_timestamp(),
    reference = coalesce(reference, 'TRF-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
    source_type = p_source_type, source_id = p_source_id,
    authorized_by = case when v_role = 'direction' then v_profile else authorized_by end,
    authorized_at = case when v_role = 'direction' then clock_timestamp() else authorized_at end,
    from_location_name_snapshot = (select name from stock.locations where id = v_batch.from_location_id),
    to_location_name_snapshot = (select name from stock.locations where id = v_batch.to_location_id),
    updated_by = v_profile, updated_at = clock_timestamp()
  where id = p_transfer_id;
  return jsonb_build_object('transfer_id', p_transfer_id, 'status', 'prepared');
end;
$$;

create or replace function stock.dispatch_stock_transfer(
  p_transfer_id uuid,
  p_request_id uuid,
  p_lines jsonb,
  p_pin text
) returns jsonb
language plpgsql security definer
set search_path = pg_catalog, stock, auth, extensions
as $$
declare
  v_profile uuid := stock.current_profile_id();
  v_batch stock.stock_transfer_batches%rowtype;
  v_transit uuid;
  v_handoff uuid;
  v_reference text;
  v_item record;
  v_available numeric;
  v_dispatched numeric;
  v_line_id uuid;
  v_movement uuid;
  v_count integer := 0;
begin
  if v_profile is null or not stock.has_permission('stock.transfers.dispatch') then raise exception 'Permission de remise Magasinier insuffisante'; end if;
  if not exists (select 1 from stock.profiles where id = v_profile and status = 'active' and role = 'magasinier') then raise exception 'Seul un profil Magasinier actif peut confirmer la remise'; end if;
  select * into v_batch from stock.stock_transfer_batches where id = p_transfer_id for update;
  if not found then raise exception 'Transfert introuvable'; end if;
  if not stock.can_access_stock_location(v_batch.from_location_id, true) then raise exception 'Accès à la localisation d’origine requis'; end if;
  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) = 0 then raise exception 'Sélectionnez au moins une ligne à remettre'; end if;
  if p_request_id is null then raise exception 'Identifiant de demande de remise manquant'; end if;
  if exists (select 1 from jsonb_array_elements(p_lines) x(value) group by x.value->>'batch_item_id' having count(*) > 1) then raise exception 'Une ligne ne peut apparaître qu’une fois par remise'; end if;
  if exists (select 1 from stock.stock_transfer_handoffs where request_id = p_request_id) then
    select id, reference into v_handoff, v_reference from stock.stock_transfer_handoffs where request_id = p_request_id;
    if not exists (select 1 from stock.stock_transfer_handoffs h where h.id = v_handoff and h.transfer_id = p_transfer_id and h.dispatched_by = v_profile)
       or jsonb_array_length(p_lines) <> (select count(*) from stock.stock_transfer_handoff_items hi where hi.handoff_id = v_handoff)
       or exists (
         select 1 from jsonb_array_elements(p_lines) x(value)
         left join stock.stock_transfer_batch_items bi on bi.id = nullif(x.value->>'batch_item_id', '')::uuid
         left join stock.stock_transfer_handoff_items hi on hi.handoff_id = v_handoff and hi.batch_item_id = bi.id
         where hi.id is null or hi.dispatched_quantity is distinct from nullif(x.value->>'quantity', '')::numeric
       ) then raise exception 'Identifiant de remise déjà utilisé avec des données différentes'; end if;
    return jsonb_build_object('handoff_id', v_handoff, 'reference', v_reference, 'status', 'in_transit', 'retry', true);
  end if;
  if v_batch.status not in ('prepared', 'awaiting_dispatch', 'in_transit', 'partially_received') then raise exception 'Ce transfert n’est pas disponible pour remise'; end if;
  v_profile := stock.assert_sensitive_action('stock.transfers.dispatch', p_pin, 'stock.transfer.dispatch', 'stock_transfer_batch', p_transfer_id, null, jsonb_build_object('request_id', p_request_id));
  select id into v_transit from stock.locations where is_stock_transit and is_active limit 1;
  if v_transit is null then raise exception 'Localisation technique de transit introuvable'; end if;
  v_reference := 'TRD-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into stock.stock_transfer_handoffs(request_id, transfer_id, reference, dispatched_by, dispatched_role, dispatch_location_id)
  values (p_request_id, p_transfer_id, v_reference, v_profile, 'magasinier', v_batch.from_location_id) returning id into v_handoff;

  for v_item in
    select (x.value->>'batch_item_id')::uuid as batch_item_id,
           (x.value->>'quantity')::numeric as quantity
    from jsonb_array_elements(p_lines) x(value)
    order by (x.value->>'batch_item_id')::uuid
  loop
    if v_item.quantity is null or v_item.quantity <= 0 or v_item.quantity <> round(v_item.quantity, 3) then raise exception 'Quantité de remise invalide (3 décimales maximum)'; end if;
    perform pg_advisory_xact_lock(hashtextextended((select article_id::text from stock.stock_transfer_batch_items where id = v_item.batch_item_id) || ':' || v_batch.from_location_id::text, 0));
    select coalesce(authorized_quantity, quantity) into v_dispatched from stock.stock_transfer_batch_items where id = v_item.batch_item_id and transfer_id = p_transfer_id for update;
    if not found then raise exception 'Ligne de transfert introuvable'; end if;
    select coalesce(sum(hi.dispatched_quantity), 0) into v_available
    from stock.stock_transfer_handoffs h join stock.stock_transfer_handoff_items hi on hi.handoff_id = h.id
    where h.transfer_id = p_transfer_id and hi.batch_item_id = v_item.batch_item_id;
    if v_available + v_item.quantity > v_dispatched then raise exception 'La remise dépasse la quantité autorisée'; end if;
    select coalesce(sum(s.quantity), 0) into v_available from stock.stock_location_view s
    where s.article_id = (select article_id from stock.stock_transfer_batch_items where id = v_item.batch_item_id)
      and s.location_id = v_batch.from_location_id;
    if v_item.quantity > v_available then raise exception 'Stock insuffisant à l’origine'; end if;

    insert into stock.stock_transfer_handoff_items(handoff_id, batch_item_id, article_id, unit_id, dispatched_quantity)
    select v_handoff, i.id, i.article_id, i.unit_id, v_item.quantity from stock.stock_transfer_batch_items i where i.id = v_item.batch_item_id
    returning id into v_line_id;
    insert into stock.stock_movements(article_id, quantity, unit_id, movement_type, from_location_id, to_location_id,
      movement_date, status, comment, movement_reference, reference_type, reference_id, created_by, updated_by)
    select i.article_id, v_item.quantity, i.unit_id, 'transfert', v_batch.from_location_id, v_transit,
      current_date, 'normal', concat_ws(' — ', v_reference, v_batch.reason, nullif(btrim(i.line_comment), '')),
      v_reference || '-L' || lpad(i.line_number::text, 3, '0'), 'stock_transfer_handoff', v_handoff, v_profile, v_profile
    from stock.stock_transfer_batch_items i where i.id = v_item.batch_item_id
    returning id into v_movement;
    update stock.stock_transfer_handoff_items set stock_movement_id = v_movement where id = v_line_id;
    v_count := v_count + 1;
  end loop;
  update stock.stock_transfer_batches set status = 'in_transit', updated_by = v_profile, updated_at = clock_timestamp() where id = p_transfer_id;
  perform stock.refresh_stock_transfer_workflow_status(p_transfer_id);
  return jsonb_build_object('handoff_id', v_handoff, 'reference', v_reference, 'status', 'in_transit', 'line_count', v_count);
end;
$$;

create or replace function stock.receive_stock_transfer(
  p_handoff_id uuid,
  p_request_id uuid,
  p_lines jsonb,
  p_finalize_discrepancy boolean,
  p_discrepancy_reason text,
  p_pin text
) returns jsonb
language plpgsql security definer
set search_path = pg_catalog, stock, auth, extensions
as $$
declare
  v_profile uuid := stock.current_profile_id();
  v_batch stock.stock_transfer_batches%rowtype;
  v_handoff stock.stock_transfer_handoffs%rowtype;
  v_transit uuid;
  v_receipt uuid;
  v_item record;
  v_sent numeric;
  v_received numeric;
  v_discrepancy numeric;
  v_line_id uuid;
  v_movement uuid;
  v_count integer := 0;
  v_gap_count integer := 0;
  v_final_status text;
  v_payload jsonb;
begin
  if v_profile is null or not stock.has_permission('stock.transfers.receive') then raise exception 'Permission de réception insuffisante'; end if;
  select * into v_handoff from stock.stock_transfer_handoffs where id = p_handoff_id for update;
  if not found then raise exception 'Remise à réceptionner introuvable'; end if;
  select * into v_batch from stock.stock_transfer_batches where id = v_handoff.transfer_id for update;
  if not exists (select 1 from stock.profiles where id = v_profile and status = 'active') then raise exception 'Profil actif requis pour réceptionner un transfert'; end if;
  if not exists (
    select 1 from stock.profile_location_access pla
    join stock.locations l on l.id = pla.location_id
    where pla.profile_id = v_profile
      and pla.location_id = v_batch.to_location_id
      and pla.active = true
      and l.is_active = true
      and not l.is_stock_transit
  ) then raise exception 'Le profil doit être affecté activement à la localisation de destination'; end if;
  if not stock.can_access_stock_location(v_batch.to_location_id, true) then raise exception 'Le profil doit être affecté activement à la localisation de destination'; end if;
  if v_handoff.dispatched_by = v_profile then raise exception 'La remise et la réception doivent être confirmées par deux profils distincts'; end if;
  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) = 0 then raise exception 'Saisissez au moins une quantité reçue'; end if;
  if p_request_id is null then raise exception 'Identifiant de demande de réception manquant'; end if;
  if exists (select 1 from jsonb_array_elements(p_lines) x(value) group by x.value->>'handoff_item_id' having count(*) > 1) then raise exception 'Une ligne ne peut apparaître qu’une fois par réception'; end if;
  if p_finalize_discrepancy and nullif(btrim(p_discrepancy_reason), '') is null then raise exception 'Un motif est obligatoire pour déclarer un écart définitif'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_lines) x(value)
    where nullif(x.value->>'handoff_item_id', '') is null
      or nullif(x.value->>'quantity', '') is null
      or (nullif(x.value->>'quantity', '')::numeric < 0)
      or (nullif(x.value->>'quantity', '')::numeric <> round(nullif(x.value->>'quantity', '')::numeric, 3))
  ) then raise exception 'Quantité reçue invalide (3 décimales maximum)'; end if;
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'handoff_item_id', x.value->>'handoff_item_id',
      'quantity', nullif(x.value->>'quantity', '')::numeric
    ) order by (x.value->>'handoff_item_id')::uuid
  ), '[]'::jsonb)
  into v_payload
  from jsonb_array_elements(p_lines) x(value);
  if exists (select 1 from stock.stock_transfer_receipts where request_id = p_request_id) then
    select id into v_receipt from stock.stock_transfer_receipts where request_id = p_request_id;
    if not exists (select 1 from stock.stock_transfer_receipts r where r.id = v_receipt and r.handoff_id = p_handoff_id and r.received_by = v_profile
       and r.finalize_discrepancy = p_finalize_discrepancy
       and r.discrepancy_reason is not distinct from nullif(btrim(p_discrepancy_reason), '')
       and r.request_payload is not distinct from v_payload
    ) then raise exception 'Identifiant de réception déjà utilisé avec des données différentes'; end if;
    return jsonb_build_object('receipt_id', v_receipt, 'status', v_batch.status, 'retry', true);
  end if;
  if v_batch.status not in ('in_transit', 'partially_received') then raise exception 'Ce transfert n’est pas disponible pour réception'; end if;
  if exists (select 1 from stock.stock_transfer_discrepancies d join stock.stock_transfer_handoff_items hi on hi.id = d.handoff_item_id where hi.handoff_id = p_handoff_id and d.status = 'awaiting_magasinier') then raise exception 'Un écart définitif attend sa seconde confirmation PIN'; end if;
  v_profile := stock.assert_sensitive_action('stock.transfers.receive', p_pin, 'stock.transfer.receive', 'stock_transfer_handoff', p_handoff_id, p_discrepancy_reason, jsonb_build_object('request_id', p_request_id));
  select id into v_transit from stock.locations where is_stock_transit and is_active limit 1;
  insert into stock.stock_transfer_receipts(request_id, handoff_id, received_by, received_role, receive_location_id, finalize_discrepancy, discrepancy_reason, request_payload)
  values (p_request_id, p_handoff_id, v_profile, (select role::text from stock.profiles where id=v_profile), v_batch.to_location_id,
    p_finalize_discrepancy, nullif(btrim(p_discrepancy_reason), ''), v_payload) returning id into v_receipt;
  for v_item in
    select (x.value->>'handoff_item_id')::uuid as handoff_item_id,
           (x.value->>'quantity')::numeric as quantity
    from jsonb_array_elements(p_lines) x(value)
    order by (x.value->>'handoff_item_id')::uuid
  loop
    if v_item.quantity is null or v_item.quantity < 0 or v_item.quantity <> round(v_item.quantity, 3) then raise exception 'Quantité reçue invalide (3 décimales maximum)'; end if;
    select hi.dispatched_quantity into v_sent from stock.stock_transfer_handoff_items hi where hi.id = v_item.handoff_item_id and hi.handoff_id = p_handoff_id for update;
    if not found then raise exception 'Ligne de remise introuvable'; end if;
    select coalesce(sum(ri.received_quantity), 0) into v_received from stock.stock_transfer_receipt_items ri where ri.handoff_item_id = v_item.handoff_item_id;
    select coalesce(sum(d.quantity), 0) into v_discrepancy from stock.stock_transfer_discrepancies d where d.handoff_item_id = v_item.handoff_item_id and d.status = 'resolved';
    if v_item.quantity > 0 then
      if v_received + v_discrepancy + v_item.quantity > v_sent then raise exception 'La quantité reçue dépasse la quantité remise'; end if;
      insert into stock.stock_transfer_receipt_items(receipt_id, handoff_item_id, article_id, unit_id, received_quantity)
      select v_receipt, hi.id, hi.article_id, hi.unit_id, v_item.quantity from stock.stock_transfer_handoff_items hi where hi.id = v_item.handoff_item_id
      returning id into v_line_id;
      insert into stock.stock_movements(article_id, quantity, unit_id, movement_type, from_location_id, to_location_id,
        movement_date, status, comment, movement_reference, reference_type, reference_id, created_by, updated_by)
      select hi.article_id, v_item.quantity, hi.unit_id, 'transfert', v_transit, v_batch.to_location_id,
        current_date, 'normal', concat_ws(' — ', v_handoff.reference, 'Réception'),
        v_handoff.reference || '-R' || lpad((select count(*)::text from stock.stock_transfer_receipt_items where receipt_id = v_receipt), 3, '0'),
        'stock_transfer_receipt', v_receipt, v_profile, v_profile
      from stock.stock_transfer_handoff_items hi where hi.id = v_item.handoff_item_id returning id into v_movement;
      update stock.stock_transfer_receipt_items set stock_movement_id = v_movement where id = v_line_id;
      v_count := v_count + 1;
    end if;
    if p_finalize_discrepancy then
      if v_received + v_discrepancy + v_item.quantity < v_sent then
        insert into stock.stock_transfer_discrepancies(handoff_item_id, quantity, reason, opened_by, recipient_confirmed_by, recipient_role, destination_location_id, origin_location_id)
        values (v_item.handoff_item_id, v_sent - v_received - v_discrepancy - v_item.quantity, btrim(p_discrepancy_reason), v_profile, v_profile,
          (select role::text from stock.profiles where id=v_profile), v_batch.to_location_id, v_batch.from_location_id);
        v_gap_count := v_gap_count + 1;
      end if;
    end if;
  end loop;
  if p_finalize_discrepancy and v_gap_count = 0 then raise exception 'Aucun reliquat positif à déclarer en écart définitif'; end if;
  update stock.stock_transfer_batches set status = case when v_gap_count > 0 then 'discrepancy_pending' else 'partially_received' end,
    updated_by = v_profile, updated_at = clock_timestamp() where id = v_batch.id;
  if v_count = 0 and v_gap_count = 0 then raise exception 'Aucune quantité positive réceptionnée'; end if;
  v_final_status := stock.refresh_stock_transfer_workflow_status(v_batch.id);
  return jsonb_build_object('receipt_id', v_receipt, 'status', v_final_status, 'line_count', v_count, 'discrepancy_count', v_gap_count);
end;
$$;

create or replace function stock.confirm_stock_transfer_discrepancy(p_discrepancy_id uuid, p_pin text)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, stock, auth, extensions
as $$
declare
  v_profile uuid := stock.current_profile_id();
  v_role stock.user_role;
  v_discrepancy stock.stock_transfer_discrepancies%rowtype;
  v_hi stock.stock_transfer_handoff_items%rowtype;
  v_handoff stock.stock_transfer_handoffs%rowtype;
  v_batch stock.stock_transfer_batches%rowtype;
  v_transit uuid;
  v_movement uuid;
begin
  if v_profile is null then raise exception 'Profil actif introuvable'; end if;
  select role into v_role from stock.profiles where id = v_profile and status = 'active';
  select * into v_discrepancy from stock.stock_transfer_discrepancies where id = p_discrepancy_id for update;
  if not found then raise exception 'Écart de transfert introuvable'; end if;
  if v_discrepancy.status <> 'awaiting_magasinier' then raise exception 'Cet écart est déjà résolu'; end if;
  if v_role is distinct from 'magasinier' or not stock.has_permission('stock.transfers.dispatch') then raise exception 'Confirmation Magasinier requise'; end if;
  select * into v_hi from stock.stock_transfer_handoff_items where id = v_discrepancy.handoff_item_id for update;
  select * into v_handoff from stock.stock_transfer_handoffs where id = v_hi.handoff_id;
  if v_profile is distinct from v_handoff.dispatched_by then raise exception 'La seconde confirmation doit être faite par le Magasinier ayant effectué la remise'; end if;
  if v_profile = v_discrepancy.recipient_confirmed_by then raise exception 'Les deux confirmations doivent provenir de profils distincts'; end if;
  select * into v_batch from stock.stock_transfer_batches where id = v_handoff.transfer_id for update;
  if not stock.can_access_stock_location(v_batch.from_location_id, true) then raise exception 'Accès à la localisation d’origine requis'; end if;
  v_profile := stock.assert_sensitive_action('stock.transfers.dispatch', p_pin, 'stock.transfer.discrepancy_dispatch_confirm', 'stock_transfer_discrepancy', p_discrepancy_id, v_discrepancy.reason, '{}'::jsonb);
  select id into v_transit from stock.locations where is_stock_transit and is_active limit 1;
  update stock.stock_transfer_discrepancies set magasinier_confirmed_by = v_profile,
    magasinier_role = 'magasinier', magasinier_confirmed_at = clock_timestamp()
  where id = p_discrepancy_id;
  insert into stock.stock_movements(article_id, quantity, unit_id, movement_type, from_location_id, to_location_id,
    movement_date, status, comment, movement_reference, reference_type, reference_id, created_by, updated_by)
  values (v_hi.article_id, v_discrepancy.quantity, v_hi.unit_id, 'perte', v_transit, null,
    current_date, 'normal', concat_ws(' — ', v_handoff.reference, 'Écart définitif : ' || v_discrepancy.reason),
    v_handoff.reference || '-D-' || left(replace(p_discrepancy_id::text, '-', ''), 8),
    'stock_transfer_discrepancy', p_discrepancy_id, v_profile, v_profile)
  returning id into v_movement;
  update stock.stock_transfer_discrepancies set stock_movement_id = v_movement, status = 'resolved', resolved_at = clock_timestamp() where id = p_discrepancy_id;
  perform stock.refresh_stock_transfer_workflow_status(v_batch.id);
  return jsonb_build_object('discrepancy_id', p_discrepancy_id, 'status', 'resolved', 'stock_movement_id', v_movement);
end;
$$;

create or replace function stock.close_stock_transfer(p_transfer_id uuid, p_pin text)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, stock, auth, extensions
as $$
declare v_profile uuid := stock.current_profile_id(); v_batch stock.stock_transfer_batches%rowtype;
begin
  if v_profile is null or not stock.has_permission('stock.transfers.close')
     or not exists (select 1 from stock.profiles where id = v_profile and status = 'active' and role = 'direction') then raise exception 'Clôture réservée à Direction'; end if;
  select * into v_batch from stock.stock_transfer_batches where id = p_transfer_id for update;
  if not found then raise exception 'Transfert introuvable'; end if;
  -- Voie exceptionnelle pour les anciens dossiers encore à l'état received.
  -- Le circuit normal se clôture dans refresh_stock_transfer_workflow_status.
  if v_batch.status <> 'received' then raise exception 'Seul un dossier exceptionnel encore à l’état received peut être clôturé par Direction'; end if;
  if exists (
    select 1 from stock.stock_transfer_transit_view v
    where v.transfer_id = p_transfer_id
      and (v.in_transit_quantity > 0 or v.remaining_to_dispatch > 0)
  ) then raise exception 'Des quantités restent à remettre ou à recevoir'; end if;
  if exists (
    select 1 from stock.stock_transfer_discrepancies d
    join stock.stock_transfer_handoff_items hi on hi.id = d.handoff_item_id
    join stock.stock_transfer_handoffs h on h.id = hi.handoff_id
    where h.transfer_id = p_transfer_id and d.status = 'awaiting_magasinier'
  ) then raise exception 'Un écart attend encore sa régularisation'; end if;
  v_profile := stock.assert_sensitive_action('stock.transfers.close', p_pin, 'stock.transfer.close', 'stock_transfer_batch', p_transfer_id, v_batch.reason, '{}'::jsonb);
  update stock.stock_transfer_batches set status = 'closed', closed_by = v_profile, closed_at = clock_timestamp(), updated_by = v_profile, updated_at = clock_timestamp()
  where id = p_transfer_id;
  return jsonb_build_object('transfer_id', p_transfer_id, 'status', 'closed');
end;
$$;

-- Rafraîchit un dossier au fil des RPC sans toucher à ses lignes historiques.
create or replace function stock.refresh_stock_transfer_workflow_status(p_transfer_id uuid)
returns text language plpgsql security definer
set search_path = pg_catalog, stock
as $$
declare v_status text;
begin
  if exists (select 1 from stock.stock_transfer_discrepancies d join stock.stock_transfer_handoff_items hi on hi.id=d.handoff_item_id join stock.stock_transfer_handoffs h on h.id=hi.handoff_id where h.transfer_id=p_transfer_id and d.status='awaiting_magasinier') then
    v_status := 'discrepancy_pending';
  elsif exists (select 1 from stock.stock_transfer_transit_view v where v.transfer_id=p_transfer_id and v.in_transit_quantity > 0) then
    v_status := 'in_transit';
  elsif exists (select 1 from stock.stock_transfer_transit_view v where v.transfer_id=p_transfer_id and v.remaining_to_dispatch > 0) then
    v_status := 'awaiting_dispatch';
  elsif exists (select 1 from stock.stock_transfer_discrepancies d join stock.stock_transfer_handoff_items hi on hi.id=d.handoff_item_id join stock.stock_transfer_handoffs h on h.id=hi.handoff_id where h.transfer_id=p_transfer_id and d.status='resolved') then
    v_status := 'closed_with_justified_discrepancy';
  elsif exists (select 1 from stock.stock_transfer_receipts r join stock.stock_transfer_handoffs h on h.id=r.handoff_id where h.transfer_id=p_transfer_id) then
    v_status := 'closed';
  else
    v_status := 'prepared';
  end if;
  update stock.stock_transfer_batches set status=v_status, updated_at=clock_timestamp() where id=p_transfer_id and status not in ('closed','closed_with_justified_discrepancy','cancelled','validated','pending_direction');
  if v_status in ('closed', 'closed_with_justified_discrepancy') then
    update stock.stock_transfer_batches
    set closed_by=coalesce(closed_by, stock.current_profile_id()),
        closed_at=coalesce(closed_at, clock_timestamp())
    where id=p_transfer_id;
  end if;
  return v_status;
end;
$$;

-- L'ancienne RPC créait un transfert direct origine -> destination. Elle reste
-- définie pour compatibilité historique mais ne doit plus être appelable par les clients.
revoke all on function stock.finalize_stock_transfer(uuid, text) from public, anon, authenticated;

revoke all on function stock.prepare_stock_transfer(uuid, text, uuid) from public, anon, authenticated;
revoke all on function stock.dispatch_stock_transfer(uuid, uuid, jsonb, text) from public, anon, authenticated;
revoke all on function stock.receive_stock_transfer(uuid, uuid, jsonb, boolean, text, text) from public, anon, authenticated;
revoke all on function stock.confirm_stock_transfer_discrepancy(uuid, text) from public, anon, authenticated;
revoke all on function stock.close_stock_transfer(uuid, text) from public, anon, authenticated;
revoke all on function stock.refresh_stock_transfer_workflow_status(uuid) from public, anon, authenticated;
grant execute on function stock.prepare_stock_transfer(uuid, text, uuid) to authenticated;
grant execute on function stock.dispatch_stock_transfer(uuid, uuid, jsonb, text) to authenticated;
grant execute on function stock.receive_stock_transfer(uuid, uuid, jsonb, boolean, text, text) to authenticated;
grant execute on function stock.confirm_stock_transfer_discrepancy(uuid, text) to authenticated;
grant execute on function stock.close_stock_transfer(uuid, text) to authenticated;

comment on column stock.stock_transfer_batch_items.authorized_quantity is 'Quantité totale autorisée à remettre pour la nouvelle transmission physique.';
comment on column stock.stock_transfer_batches.source_type is 'Provenance future-compatible : operation, stock_request ou manual_exception.';
comment on view stock.stock_transfer_transit_view is 'Reliquats autorisés, remis, reçus et encore en transit, rattachés au dossier et à sa destination.';
