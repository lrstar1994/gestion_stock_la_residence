-- INT-1 / contract 1.0. LOCAL ONLY. Activation is technically disabled.
-- Depends on OP-1, RES-1 and RES-2. Does not alter their objects.
-- No OP trigger, application grant, purchase need or stock movement is created.

do $$
begin
  if current_user <> 'postgres' or not exists (
    select 1 from pg_roles where rolname=current_user and rolbypassrls
  ) then
    raise exception 'INT-1 requires the existing postgres owner with BYPASSRLS';
  end if;
  if to_regclass('stock.production_orders') is null
     or to_regclass('stock.production_order_lines') is null
     or to_regclass('stock.production_order_revisions') is null
     or to_regclass('stock.production_order_revision_lines') is null
     or to_regclass('stock.stock_reservations') is null
     or to_regprocedure('stock._res2_actor(boolean)') is null
     or to_regprocedure('stock._res2_fail(text)') is null then
    raise exception 'INT-1 requires OP-1, RES-1 and RES-2';
  end if;
end $$;

create table stock.op_reservation_integration_control (
  integration_key text primary key,
  activation_state text not null default 'disabled',
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint op_reservation_integration_control_key_check
    check (integration_key='OP_STOCK_RESERVATION'),
  constraint op_reservation_integration_control_disabled_check
    check (activation_state='disabled')
);

insert into stock.op_reservation_integration_control(integration_key)
values ('OP_STOCK_RESERVATION');

create table stock.op_reservation_operations (
  id uuid primary key,
  business_key text not null unique,
  payload_hash text not null,
  op_id uuid not null references stock.production_orders(id) on delete restrict,
  revision_id uuid not null references stock.production_order_revisions(id) on delete restrict,
  op_change_sequence bigint not null,
  operation_kind text not null,
  actor_profile_id uuid not null references stock.profiles(id) on delete restrict,
  result jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint op_reservation_operations_business_key_check check (btrim(business_key)<>''),
  constraint op_reservation_operations_payload_hash_check check (btrim(payload_hash)<>''),
  constraint op_reservation_operations_sequence_check check (op_change_sequence>0),
  constraint op_reservation_operations_kind_check check (operation_kind in (
    'revision_target_sync','revision_approved','revision_rejected','revision_withdrawn',
    'chef_hold','chef_release','op_cancellation_requested','op_cancelled'
  )),
  constraint op_reservation_operations_result_check check (jsonb_typeof(result)='object')
);

create table stock.op_reservation_bindings (
  id uuid primary key default gen_random_uuid(),
  source_kind text not null,
  source_id uuid not null,
  usage_key text not null,
  op_id uuid not null references stock.production_orders(id) on delete restrict,
  reservation_id uuid not null references stock.stock_reservations(id) on delete restrict,
  resource_type text not null,
  resource_id uuid not null,
  unit_id uuid not null references stock.units(id) on delete restrict,
  current_revision_id uuid not null references stock.production_order_revisions(id) on delete restrict,
  current_op_change_sequence bigint not null,
  current_reservation_change_sequence bigint not null,
  status text not null default 'active',
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint op_reservation_bindings_source_kind_check
    check (source_kind in ('production_order_line','contribution')),
  constraint op_reservation_bindings_usage_key_check check (btrim(usage_key)<>''),
  constraint op_reservation_bindings_resource_type_check check (resource_type='article'),
  constraint op_reservation_bindings_op_sequence_check check (current_op_change_sequence>0),
  constraint op_reservation_bindings_reservation_sequence_check
    check (current_reservation_change_sequence>0),
  constraint op_reservation_bindings_status_check check (status in ('active','historical'))
);

create unique index op_reservation_bindings_current_source_usage_idx
  on stock.op_reservation_bindings(source_kind,source_id,usage_key)
  where status='active';
create index op_reservation_bindings_op_idx
  on stock.op_reservation_bindings(op_id,status);
create index op_reservation_bindings_reservation_idx
  on stock.op_reservation_bindings(reservation_id,status);

create table stock.op_reservation_operation_items (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references stock.op_reservation_operations(id) on delete restrict,
  binding_id uuid not null references stock.op_reservation_bindings(id) on delete restrict,
  child_request_id uuid not null unique,
  action_kind text not null,
  revision_id uuid not null references stock.production_order_revisions(id) on delete restrict,
  op_change_sequence bigint not null,
  reservation_change_sequence bigint not null,
  target_quantity numeric(14,4) not null,
  result jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint op_reservation_operation_items_action_check check (action_kind in (
    'reserve','change_target','reclassify_approved','reclassify_chef_hold','release','no_change'
  )),
  constraint op_reservation_operation_items_op_sequence_check check (op_change_sequence>0),
  constraint op_reservation_operation_items_reservation_sequence_check
    check (reservation_change_sequence>0),
  constraint op_reservation_operation_items_target_check check (target_quantity>=0),
  constraint op_reservation_operation_items_result_check check (jsonb_typeof(result)='object'),
  constraint op_reservation_operation_items_binding_once_unique
    unique (operation_id,binding_id,action_kind)
);

create index op_reservation_operation_items_operation_idx
  on stock.op_reservation_operation_items(operation_id,id);
create index op_reservation_operation_items_binding_idx
  on stock.op_reservation_operation_items(binding_id,created_at);

create table stock.op_reservation_allocations (
  id uuid primary key default gen_random_uuid(),
  binding_id uuid not null references stock.op_reservation_bindings(id) on delete restrict,
  reservation_id uuid not null references stock.stock_reservations(id) on delete restrict,
  operation_item_id uuid not null references stock.op_reservation_operation_items(id) on delete restrict,
  revision_id uuid not null references stock.production_order_revisions(id) on delete restrict,
  op_change_sequence bigint not null,
  category text not null,
  status text not null,
  quantity numeric(14,4) not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint op_reservation_allocations_sequence_check check (op_change_sequence>0),
  constraint op_reservation_allocations_category_check
    check (category in ('approved','pending_increase','chef_hold')),
  constraint op_reservation_allocations_status_check
    check (status in ('active','awaiting_chef_decision','released','superseded')),
  constraint op_reservation_allocations_quantity_check check (quantity>=0),
  constraint op_reservation_allocations_awaiting_check check (
    status<>'awaiting_chef_decision' or category='pending_increase'
  )
);

create unique index op_reservation_allocations_current_category_idx
  on stock.op_reservation_allocations(binding_id,category)
  where status in ('active','awaiting_chef_decision');
create index op_reservation_allocations_reservation_idx
  on stock.op_reservation_allocations(reservation_id,status);
create index op_reservation_allocations_operation_item_idx
  on stock.op_reservation_allocations(operation_item_id);

create function stock._int1_fail(p_code text) returns void
language plpgsql security invoker set search_path=pg_catalog,stock as $$
begin
  raise exception using errcode='P0001',message=p_code,
    detail=jsonb_build_object('code',p_code,'contract','INT-1/1.0')::text;
end $$;

create function stock._int1_business_key(
  p_op_id uuid,p_revision_id uuid,p_op_change_sequence bigint,p_operation_kind text
) returns text language sql immutable security invoker set search_path=pg_catalog as $$
  select 'INT-1/1.0|op='||p_op_id::text||'|revision='||p_revision_id::text||
         '|sequence='||p_op_change_sequence::text||'|kind='||p_operation_kind
$$;

create function stock._int1_child_request_id(
  p_operation_id uuid,p_source_kind text,p_source_id uuid,p_usage_key text,p_action_kind text
) returns uuid language sql immutable security invoker set search_path=pg_catalog as $$
  select (
    substr(md5(p_operation_id::text||'|'||p_source_kind||'|'||p_source_id::text||'|'||p_usage_key||'|'||p_action_kind),1,8)||'-'||
    substr(md5(p_operation_id::text||'|'||p_source_kind||'|'||p_source_id::text||'|'||p_usage_key||'|'||p_action_kind),9,4)||'-5'||
    substr(md5(p_operation_id::text||'|'||p_source_kind||'|'||p_source_id::text||'|'||p_usage_key||'|'||p_action_kind),14,3)||'-a'||
    substr(md5(p_operation_id::text||'|'||p_source_kind||'|'||p_source_id::text||'|'||p_usage_key||'|'||p_action_kind),18,3)||'-'||
    substr(md5(p_operation_id::text||'|'||p_source_kind||'|'||p_source_id::text||'|'||p_usage_key||'|'||p_action_kind),21,12)
  )::uuid
$$;

create function stock.prevent_op_reservation_append_mutation() returns trigger
language plpgsql security invoker set search_path=pg_catalog,stock as $$
begin
  perform stock._int1_fail('OP_RESERVATION_APPEND_ONLY');
  return null;
end $$;

create function stock.ensure_op_reservation_integration_consistency() returns trigger
language plpgsql security invoker set search_path=pg_catalog,stock as $$
declare v_op uuid; v_reservation stock.stock_reservations%rowtype;
begin
  if tg_table_name='op_reservation_operations' then
    select production_order_id into v_op from stock.production_order_revisions where id=new.revision_id;
    if v_op is distinct from new.op_id then perform stock._int1_fail('OP_RESERVATION_REVISION_MISMATCH'); end if;
  elsif tg_table_name='op_reservation_bindings' then
    if new.source_kind<>'production_order_line' then
      perform stock._int1_fail('OP_RESERVATION_SOURCE_KIND_UNSUPPORTED');
    end if;
    select production_order_id into v_op from stock.production_order_lines where id=new.source_id;
    if v_op is distinct from new.op_id then perform stock._int1_fail('OP_RESERVATION_SOURCE_MISMATCH'); end if;
    select production_order_id into v_op from stock.production_order_revisions where id=new.current_revision_id;
    if v_op is distinct from new.op_id then perform stock._int1_fail('OP_RESERVATION_REVISION_MISMATCH'); end if;
    select * into v_reservation from stock.stock_reservations where id=new.reservation_id;
    if not found or v_reservation.op_id is distinct from new.op_id
       or v_reservation.resource_type is distinct from new.resource_type
       or v_reservation.resource_id is distinct from new.resource_id
       or v_reservation.unit_id is distinct from new.unit_id then
      perform stock._int1_fail('OP_RESERVATION_BINDING_RESERVATION_MISMATCH');
    end if;
  elsif tg_table_name='op_reservation_operation_items' then
    if not exists(
      select 1 from stock.op_reservation_operations o
      join stock.op_reservation_bindings b on b.id=new.binding_id and b.op_id=o.op_id
      where o.id=new.operation_id and o.revision_id=new.revision_id
        and o.op_change_sequence=new.op_change_sequence
        and b.reservation_id=(new.result->>'reservation_id')::uuid
    ) then perform stock._int1_fail('OP_RESERVATION_ITEM_MISMATCH'); end if;
  elsif tg_table_name='op_reservation_allocations' then
    if not exists(
      select 1 from stock.op_reservation_bindings b
      join stock.op_reservation_operation_items i on i.id=new.operation_item_id
       and i.binding_id=b.id and i.revision_id=new.revision_id
       and i.op_change_sequence=new.op_change_sequence
      where b.id=new.binding_id and b.reservation_id=new.reservation_id
    ) then perform stock._int1_fail('OP_RESERVATION_ALLOCATION_MISMATCH'); end if;
  end if;
  return new;
end $$;

create trigger op_reservation_operations_consistency_trg
before insert on stock.op_reservation_operations
for each row execute function stock.ensure_op_reservation_integration_consistency();
create trigger op_reservation_bindings_consistency_trg
before insert or update on stock.op_reservation_bindings
for each row execute function stock.ensure_op_reservation_integration_consistency();
create trigger op_reservation_operation_items_consistency_trg
before insert on stock.op_reservation_operation_items
for each row execute function stock.ensure_op_reservation_integration_consistency();
create trigger op_reservation_allocations_consistency_trg
before insert or update on stock.op_reservation_allocations
for each row execute function stock.ensure_op_reservation_integration_consistency();

create trigger op_reservation_operations_append_only_trg
before update or delete on stock.op_reservation_operations
for each row execute function stock.prevent_op_reservation_append_mutation();

create trigger op_reservation_operation_items_append_only_trg
before update or delete on stock.op_reservation_operation_items
for each row execute function stock.prevent_op_reservation_append_mutation();

-- Internal bulk contract only. It cannot be enabled by this migration and has
-- no application EXECUTE grant. ARTICLE resolution is deliberately unavailable
-- until FT/OP owns an official production_order_line -> STOCK article mapping.
create function stock.apply_op_reservation_operation(
  p_op_reservation_operation_id uuid,
  p_op_id uuid,
  p_revision_id uuid,
  p_op_change_sequence bigint,
  p_operation_kind text,
  p_items jsonb
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,stock,auth as $$
declare v_actor uuid; v_state text;
begin
  if p_op_reservation_operation_id is null or p_op_id is null or p_revision_id is null
     or p_op_change_sequence is null or p_op_change_sequence<=0
     or jsonb_typeof(p_items) is distinct from 'array' then
    perform stock._int1_fail('OP_RESERVATION_INPUT_INVALID');
  end if;
  if p_operation_kind not in (
    'revision_target_sync','revision_approved','revision_rejected','revision_withdrawn',
    'chef_hold','chef_release','op_cancellation_requested','op_cancelled'
  ) then perform stock._int1_fail('OP_RESERVATION_OPERATION_KIND_INVALID'); end if;
  perform pg_advisory_xact_lock(hashtextextended('INT-1/operation/'||
    stock._int1_business_key(p_op_id,p_revision_id,p_op_change_sequence,p_operation_kind),0));
  select activation_state into v_state from stock.op_reservation_integration_control
   where integration_key='OP_STOCK_RESERVATION' for update;
  if v_state is distinct from 'enabled' then
    perform stock._int1_fail('OP_RESERVATION_INTEGRATION_DISABLED');
  end if;
  v_actor:=stock._res2_actor(true);
  -- The table check above makes this branch unreachable in INT-1. Retain an
  -- independent source-of-truth guard for any future activation migration.
  perform stock._int1_fail('OP_RESERVATION_ARTICLE_MAPPING_UNAVAILABLE');
  return null;
end $$;

do $$
declare v_table text;
begin
  foreach v_table in array array[
    'op_reservation_integration_control','op_reservation_operations',
    'op_reservation_bindings','op_reservation_operation_items','op_reservation_allocations'
  ] loop
    execute format('alter table stock.%I enable row level security',v_table);
    execute format('alter table stock.%I force row level security',v_table);
    execute format('revoke all on table stock.%I from public,anon,authenticated',v_table);
  end loop;
end $$;

do $$
declare v_signature text; v_function regprocedure;
begin
  foreach v_signature in array array[
    '_int1_fail(text)','_int1_business_key(uuid,uuid,bigint,text)',
    '_int1_child_request_id(uuid,text,uuid,text,text)',
    'prevent_op_reservation_append_mutation()','ensure_op_reservation_integration_consistency()',
    'apply_op_reservation_operation(uuid,uuid,uuid,bigint,text,jsonb)'
  ] loop
    v_function:=('stock.'||v_signature)::regprocedure;
    execute format('revoke all on function %s from public,anon,authenticated',v_function);
  end loop;
end $$;

comment on table stock.op_reservation_integration_control is
  'INT-1 technical kill switch. This migration permits only disabled.';
comment on table stock.op_reservation_bindings is
  'Durable source_kind/source_id/usage_key binding to one physical reservation.';
comment on table stock.op_reservation_allocations is
  'Analytical approved/pending_increase/chef_hold ventilation; never physical stock.';
comment on function stock.apply_op_reservation_operation(uuid,uuid,uuid,bigint,text,jsonb) is
  'INT-1 internal bulk contract. No application EXECUTE; disabled and ARTICLE mapping unavailable.';
