-- INT-1 step 1 / contract 2.0. LOCAL HOLD ONLY.
-- Additive follow-up to 202610020001: align the disabled INT-1 schema with
-- the published immutable OP-2 contract. No business transition, RES-2 call,
-- purchase need, stock movement, grant, or activation is introduced here.

do $$
begin
  if current_user <> 'postgres' or not exists (
    select 1 from pg_roles where rolname=current_user and rolbypassrls
  ) then
    raise exception 'INT-1 step 1 requires the existing postgres owner with BYPASSRLS';
  end if;

  if to_regclass('stock.op_reservation_integration_control') is null
     or to_regclass('stock.op_reservation_operations') is null
     or to_regclass('stock.op_reservation_bindings') is null
     or to_regclass('stock.op_reservation_operation_items') is null
     or to_regclass('stock.op_reservation_allocations') is null
     or to_regclass('stock.production_order_calculation_runs') is null
     or to_regclass('stock.production_order_contributions') is null
     or to_regclass('stock.production_order_contribution_snapshots') is null then
    raise exception 'INT-1 step 1 requires the INT-1 foundation and OP-2';
  end if;

  if exists (select 1 from stock.op_reservation_operations)
     or exists (select 1 from stock.op_reservation_bindings)
     or exists (select 1 from stock.op_reservation_operation_items)
     or exists (select 1 from stock.op_reservation_allocations) then
    raise exception 'INT-1 step 1 requires the disabled INT-1 foundation to be empty';
  end if;
end $$;

alter table stock.op_reservation_integration_control
  add column contract_version text not null default 'INT-1/2.0',
  add constraint op_reservation_integration_control_contract_check
    check (contract_version='INT-1/2.0');

alter table stock.op_reservation_operations
  add column published_run_id uuid not null,
  add column canonical_scope jsonb not null default '{}'::jsonb,
  add column contract_version text not null default 'INT-1/2.0',
  add column status text not null default 'completed',
  add constraint op_reservation_operations_published_run_fk
    foreign key (published_run_id)
    references stock.production_order_calculation_runs(calculation_run_id) on delete restrict,
  add constraint op_reservation_operations_scope_check
    check (jsonb_typeof(canonical_scope)='object'),
  add constraint op_reservation_operations_contract_check
    check (contract_version='INT-1/2.0'),
  add constraint op_reservation_operations_status_check
    check (status in ('completed','failed'));

create index op_reservation_operations_published_run_idx
  on stock.op_reservation_operations(published_run_id);

drop index stock.op_reservation_bindings_current_source_usage_idx;

alter table stock.op_reservation_bindings
  drop constraint op_reservation_bindings_source_kind_check,
  drop column source_kind,
  drop column source_id,
  add column production_order_line_id uuid not null,
  add column contribution_id uuid not null,
  add column contribution_snapshot_id uuid not null,
  add column published_run_id uuid not null,
  add constraint op_reservation_bindings_order_line_fk
    foreign key (production_order_line_id)
    references stock.production_order_lines(id) on delete restrict,
  add constraint op_reservation_bindings_contribution_fk
    foreign key (contribution_id)
    references stock.production_order_contributions(contribution_id) on delete restrict,
  add constraint op_reservation_bindings_snapshot_fk
    foreign key (contribution_snapshot_id)
    references stock.production_order_contribution_snapshots(contribution_snapshot_id) on delete restrict,
  add constraint op_reservation_bindings_published_run_fk
    foreign key (published_run_id)
    references stock.production_order_calculation_runs(calculation_run_id) on delete restrict,
  add constraint op_reservation_bindings_version_identity_unique
    unique (production_order_line_id,usage_key,contribution_id);

create unique index op_reservation_bindings_current_line_usage_idx
  on stock.op_reservation_bindings(production_order_line_id,usage_key)
  where status='active';
create index op_reservation_bindings_contribution_idx
  on stock.op_reservation_bindings(contribution_id);
create index op_reservation_bindings_snapshot_idx
  on stock.op_reservation_bindings(contribution_snapshot_id);
create index op_reservation_bindings_published_run_idx
  on stock.op_reservation_bindings(published_run_id);
create index op_reservation_bindings_revision_idx
  on stock.op_reservation_bindings(current_revision_id,current_op_change_sequence);

alter table stock.op_reservation_operation_items
  alter column reservation_change_sequence drop not null,
  drop constraint op_reservation_operation_items_reservation_sequence_check,
  add column production_order_line_id uuid not null,
  add column usage_key text not null,
  add column contribution_id uuid not null,
  add column contribution_snapshot_id uuid not null,
  add column resource_id uuid not null,
  add column unit_id uuid not null,
  add constraint op_reservation_operation_items_reservation_sequence_check
    check (reservation_change_sequence is null or reservation_change_sequence>0),
  add constraint op_reservation_operation_items_usage_key_check
    check (btrim(usage_key)<>''),
  add constraint op_reservation_operation_items_order_line_fk
    foreign key (production_order_line_id)
    references stock.production_order_lines(id) on delete restrict,
  add constraint op_reservation_operation_items_contribution_fk
    foreign key (contribution_id)
    references stock.production_order_contributions(contribution_id) on delete restrict,
  add constraint op_reservation_operation_items_snapshot_fk
    foreign key (contribution_snapshot_id)
    references stock.production_order_contribution_snapshots(contribution_snapshot_id) on delete restrict,
  add constraint op_reservation_operation_items_resource_fk
    foreign key (resource_id) references stock.articles(id) on delete restrict,
  add constraint op_reservation_operation_items_unit_fk
    foreign key (unit_id) references stock.units(id) on delete restrict;

create index op_reservation_operation_items_order_line_idx
  on stock.op_reservation_operation_items(production_order_line_id,usage_key);
create index op_reservation_operation_items_contribution_idx
  on stock.op_reservation_operation_items(contribution_id);
create index op_reservation_operation_items_snapshot_idx
  on stock.op_reservation_operation_items(contribution_snapshot_id);
create index op_reservation_operation_items_resource_idx
  on stock.op_reservation_operation_items(resource_id,unit_id);

alter table stock.op_reservation_allocations
  add column production_order_line_id uuid not null,
  add column usage_key text not null,
  add column contribution_id uuid not null,
  add column contribution_snapshot_id uuid not null,
  add constraint op_reservation_allocations_usage_key_check
    check (btrim(usage_key)<>''),
  add constraint op_reservation_allocations_order_line_fk
    foreign key (production_order_line_id)
    references stock.production_order_lines(id) on delete restrict,
  add constraint op_reservation_allocations_contribution_fk
    foreign key (contribution_id)
    references stock.production_order_contributions(contribution_id) on delete restrict,
  add constraint op_reservation_allocations_snapshot_fk
    foreign key (contribution_snapshot_id)
    references stock.production_order_contribution_snapshots(contribution_snapshot_id) on delete restrict;

create index op_reservation_allocations_order_line_idx
  on stock.op_reservation_allocations(production_order_line_id,usage_key);
create index op_reservation_allocations_contribution_idx
  on stock.op_reservation_allocations(contribution_id);
create index op_reservation_allocations_snapshot_idx
  on stock.op_reservation_allocations(contribution_snapshot_id);

create function stock._int1_business_key(
  p_op_id uuid,
  p_revision_id uuid,
  p_op_change_sequence bigint,
  p_operation_kind text,
  p_canonical_scope jsonb
) returns text language sql immutable security invoker set search_path=pg_catalog as $$
  select 'INT-1/2.0|op='||p_op_id::text||'|revision='||p_revision_id::text||
         '|sequence='||p_op_change_sequence::text||'|kind='||p_operation_kind||
         '|scope='||md5(coalesce(p_canonical_scope,'{}'::jsonb)::text)
$$;

-- The old generic source_kind/source_id helper is deliberately removed. Child
-- request identity is now based only on canonical OP-2 identities.
drop function stock._int1_child_request_id(uuid,text,uuid,text,text);

create function stock._int1_child_request_id(
  p_operation_id uuid,
  p_production_order_line_id uuid,
  p_usage_key text,
  p_contribution_id uuid,
  p_contribution_snapshot_id uuid,
  p_action_kind text,
  p_resource_id uuid
) returns uuid language sql immutable security invoker set search_path=pg_catalog as $$
  select (
    substr(md5(concat_ws('|',p_operation_id::text,p_production_order_line_id::text,p_usage_key,
      p_contribution_id::text,p_contribution_snapshot_id::text,p_action_kind,p_resource_id::text)),1,8)||'-'||
    substr(md5(concat_ws('|',p_operation_id::text,p_production_order_line_id::text,p_usage_key,
      p_contribution_id::text,p_contribution_snapshot_id::text,p_action_kind,p_resource_id::text)),9,4)||'-5'||
    substr(md5(concat_ws('|',p_operation_id::text,p_production_order_line_id::text,p_usage_key,
      p_contribution_id::text,p_contribution_snapshot_id::text,p_action_kind,p_resource_id::text)),14,3)||'-a'||
    substr(md5(concat_ws('|',p_operation_id::text,p_production_order_line_id::text,p_usage_key,
      p_contribution_id::text,p_contribution_snapshot_id::text,p_action_kind,p_resource_id::text)),18,3)||'-'||
    substr(md5(concat_ws('|',p_operation_id::text,p_production_order_line_id::text,p_usage_key,
      p_contribution_id::text,p_contribution_snapshot_id::text,p_action_kind,p_resource_id::text)),21,12)
  )::uuid
$$;

create or replace function stock.ensure_op_reservation_integration_consistency()
returns trigger language plpgsql security invoker set search_path=pg_catalog,stock as $$
declare
  v_op uuid;
  v_reservation stock.stock_reservations%rowtype;
  v_snapshot record;
begin
  if tg_table_name='op_reservation_operations' then
    select production_order_id into v_op
      from stock.production_order_revisions where id=new.revision_id;
    if v_op is distinct from new.op_id then
      perform stock._int1_fail('OP_RESERVATION_REVISION_MISMATCH');
    end if;
    if not exists (
      select 1 from stock.production_order_calculation_runs r
       where r.calculation_run_id=new.published_run_id
         and r.production_order_id=new.op_id
         and r.revision_id=new.revision_id
         and r.change_sequence=new.op_change_sequence
         and r.run_status='published'
    ) then
      perform stock._int1_fail('OP_RESERVATION_RUN_NOT_PUBLISHED');
    end if;

  elsif tg_table_name='op_reservation_bindings' then
    if tg_op='UPDATE' and (
      new.production_order_line_id is distinct from old.production_order_line_id
      or new.usage_key is distinct from old.usage_key
      or new.contribution_id is distinct from old.contribution_id
      or new.contribution_snapshot_id is distinct from old.contribution_snapshot_id
      or new.published_run_id is distinct from old.published_run_id
      or new.reservation_id is distinct from old.reservation_id
      or new.resource_type is distinct from old.resource_type
      or new.resource_id is distinct from old.resource_id
      or new.unit_id is distinct from old.unit_id
    ) then
      perform stock._int1_fail('OP_RESERVATION_BINDING_IDENTITY_IMMUTABLE');
    end if;
    if tg_op='UPDATE' and old.status='historical' and new.status<>'historical' then
      perform stock._int1_fail('OP_RESERVATION_BINDING_HISTORY_IMMUTABLE');
    end if;

    select c.production_order_id,s.production_order_line_id,s.usage_key,s.contribution_id,
           s.calculation_run_id,s.revision_id,s.change_sequence,s.resource_type,
           s.resource_id,s.canonical_unit_id,s.target_quantity,r.run_status
      into v_snapshot
      from stock.production_order_contribution_snapshots s
      join stock.production_order_contributions c on c.contribution_id=s.contribution_id
      join stock.production_order_calculation_runs r on r.calculation_run_id=s.calculation_run_id
     where s.contribution_snapshot_id=new.contribution_snapshot_id;
    if not found
       or v_snapshot.run_status is distinct from 'published'
       or v_snapshot.production_order_id is distinct from new.op_id
       or v_snapshot.production_order_line_id is distinct from new.production_order_line_id
       or v_snapshot.usage_key is distinct from new.usage_key
       or v_snapshot.contribution_id is distinct from new.contribution_id
       or v_snapshot.calculation_run_id is distinct from new.published_run_id
       or v_snapshot.revision_id is distinct from new.current_revision_id
       or v_snapshot.change_sequence is distinct from new.current_op_change_sequence
       or v_snapshot.resource_type is distinct from new.resource_type
       or v_snapshot.resource_id is distinct from new.resource_id
       or v_snapshot.canonical_unit_id is distinct from new.unit_id
       or v_snapshot.target_quantity is null then
      perform stock._int1_fail('OP_RESERVATION_SNAPSHOT_MISMATCH');
    end if;

    select * into v_reservation from stock.stock_reservations
     where id=new.reservation_id;
    if not found or v_reservation.op_id is distinct from new.op_id
       or v_reservation.resource_type is distinct from new.resource_type
       or v_reservation.resource_id is distinct from new.resource_id
       or v_reservation.unit_id is distinct from new.unit_id then
      perform stock._int1_fail('OP_RESERVATION_BINDING_RESERVATION_MISMATCH');
    end if;

  elsif tg_table_name='op_reservation_operation_items' then
    if not exists (
      select 1
        from stock.op_reservation_operations o
        join stock.op_reservation_bindings b on b.id=new.binding_id and b.op_id=o.op_id
       where o.id=new.operation_id
         and o.revision_id=new.revision_id
         and o.op_change_sequence=new.op_change_sequence
         and b.production_order_line_id=new.production_order_line_id
         and b.usage_key=new.usage_key
         and b.contribution_id=new.contribution_id
         and b.contribution_snapshot_id=new.contribution_snapshot_id
         and b.resource_id=new.resource_id
         and b.unit_id=new.unit_id
         and b.reservation_id=(new.result->>'reservation_id')::uuid
    ) then
      perform stock._int1_fail('OP_RESERVATION_ITEM_MISMATCH');
    end if;

  elsif tg_table_name='op_reservation_allocations' then
    if not exists (
      select 1
        from stock.op_reservation_bindings b
        join stock.op_reservation_operation_items i
          on i.id=new.operation_item_id and i.binding_id=b.id
       where b.id=new.binding_id
         and b.reservation_id=new.reservation_id
         and i.revision_id=new.revision_id
         and i.op_change_sequence=new.op_change_sequence
         and i.production_order_line_id=new.production_order_line_id
         and i.usage_key=new.usage_key
         and i.contribution_id=new.contribution_id
         and i.contribution_snapshot_id=new.contribution_snapshot_id
    ) then
      perform stock._int1_fail('OP_RESERVATION_ALLOCATION_MISMATCH');
    end if;
  end if;
  return new;
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

revoke all on function stock._int1_child_request_id(uuid,uuid,text,uuid,uuid,text,uuid)
  from public,anon,authenticated;
revoke all on function stock._int1_business_key(uuid,uuid,bigint,text,jsonb)
  from public,anon,authenticated;
revoke all on function stock.ensure_op_reservation_integration_consistency()
  from public,anon,authenticated;

comment on table stock.op_reservation_operations is
  'INT-1/2.0 append-only parent idempotence and canonical published OP-2 scope.';
comment on table stock.op_reservation_bindings is
  'INT-1/2.0 immutable production_order_line_id/usage_key binding versioned by OP-2 contribution and snapshot.';
comment on table stock.op_reservation_allocations is
  'INT-1 analytical approved/pending_increase/chef_hold only. mixed and approved shortage are derived; physical reservation remains exclusively RES-2.';
comment on column stock.op_reservation_allocations.quantity is
  'Analytical category quantity only; never a duplicate of RES-2 reserved quantity.';
comment on column stock.op_reservation_operations.canonical_scope is
  'Server-canonical OP-2 identity selection only; never caller-owned resource, quantity, unit or conversion data.';
