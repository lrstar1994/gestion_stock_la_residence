-- INT-1 step 3A. LOCAL HOLD ONLY: transactional idempotence/journal core.
-- No RES-2 call, physical STOCK effect, ACHATS write, or activation.

do $$
begin
  if current_user <> 'postgres' or not exists (
    select 1 from pg_roles where rolname=current_user and rolbypassrls
  ) then
    raise exception 'INT-1 step 3A requires postgres with BYPASSRLS';
  end if;
  if to_regprocedure('stock._int1_list_published_op_stock_needs(uuid,uuid,bigint,uuid[])') is null
     or to_regprocedure('stock._int1_child_request_id(uuid,uuid,text,uuid,uuid,text,uuid)') is null
     or to_regprocedure('stock._res2_actor(boolean)') is null then
    raise exception 'INT-1 step 3A requires steps 1/2 and the RES-2 actor contract';
  end if;
end $$;

-- A prepared item is a transactional journal entry, not a reservation result.
alter table stock.op_reservation_operation_items
  alter column binding_id drop not null,
  drop constraint op_reservation_operation_items_action_check,
  add constraint op_reservation_operation_items_action_check check (action_kind in (
    'prepared','reserve','change_target','reclassify_approved','reclassify_chef_hold','release','no_change'
  ));

create or replace function stock.ensure_op_reservation_integration_consistency()
returns trigger language plpgsql security invoker set search_path=pg_catalog,stock as $$
declare
  v_op uuid;
  v_reservation stock.stock_reservations%rowtype;
  v_snapshot record;
begin
  if tg_table_name='op_reservation_operations' then
    select production_order_id into v_op from stock.production_order_revisions where id=new.revision_id;
    if v_op is distinct from new.op_id then perform stock._int1_fail('OP_RESERVATION_REVISION_MISMATCH'); end if;
    if not exists (select 1 from stock.production_order_calculation_runs r
      where r.calculation_run_id=new.published_run_id and r.production_order_id=new.op_id
        and r.revision_id=new.revision_id and r.change_sequence=new.op_change_sequence
        and r.run_status='published') then
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
      or new.unit_id is distinct from old.unit_id) then
      perform stock._int1_fail('OP_RESERVATION_BINDING_IDENTITY_IMMUTABLE');
    end if;
    if tg_op='UPDATE' and old.status='historical' and new.status<>'historical' then
      perform stock._int1_fail('OP_RESERVATION_BINDING_HISTORY_IMMUTABLE');
    end if;
    select c.production_order_id,s.production_order_line_id,s.usage_key,s.contribution_id,
      s.calculation_run_id,s.revision_id,s.change_sequence,s.resource_type,s.resource_id,
      s.canonical_unit_id,s.target_quantity,r.run_status
      into v_snapshot from stock.production_order_contribution_snapshots s
      join stock.production_order_contributions c on c.contribution_id=s.contribution_id
      join stock.production_order_calculation_runs r on r.calculation_run_id=s.calculation_run_id
      where s.contribution_snapshot_id=new.contribution_snapshot_id;
    if not found or v_snapshot.run_status is distinct from 'published'
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
    select * into v_reservation from stock.stock_reservations where id=new.reservation_id;
    if not found or v_reservation.op_id is distinct from new.op_id
      or v_reservation.resource_type is distinct from new.resource_type
      or v_reservation.resource_id is distinct from new.resource_id
      or v_reservation.unit_id is distinct from new.unit_id then
      perform stock._int1_fail('OP_RESERVATION_BINDING_RESERVATION_MISMATCH');
    end if;
  elsif tg_table_name='op_reservation_operation_items' then
    if new.action_kind='prepared' then
      if new.binding_id is not null or new.reservation_change_sequence is not null
        or new.result is distinct from jsonb_build_object('status','prepared','physical_effect','none')
        or not exists (
          select 1 from stock.op_reservation_operations o
          join stock.production_order_contribution_snapshots s
            on s.contribution_snapshot_id=new.contribution_snapshot_id
          join stock.production_order_contributions c on c.contribution_id=s.contribution_id
          join stock.production_order_calculation_runs r on r.calculation_run_id=s.calculation_run_id
          join stock.production_order_lines l on l.id=s.production_order_line_id
          join stock.production_order_revision_lines rl on rl.id=s.production_order_revision_line_id
          where o.id=new.operation_id and o.op_id=c.production_order_id
            and o.revision_id=new.revision_id and o.op_change_sequence=new.op_change_sequence
            and o.published_run_id=s.calculation_run_id and r.run_status='published'
            and c.resolution_status='resolved' and c.contribution_id=new.contribution_id
            and s.production_order_line_id=new.production_order_line_id
            and l.production_order_id=o.op_id and rl.revision_id=o.revision_id
            and s.usage_key=new.usage_key and s.resource_type='article'
            and s.resource_id=new.resource_id and s.canonical_unit_id=new.unit_id
            and s.target_quantity=new.target_quantity) then
        perform stock._int1_fail('OP_RESERVATION_ITEM_MISMATCH');
      end if;
    elsif not exists (
      select 1 from stock.op_reservation_operations o
      join stock.op_reservation_bindings b on b.id=new.binding_id and b.op_id=o.op_id
      where o.id=new.operation_id and o.revision_id=new.revision_id
        and o.op_change_sequence=new.op_change_sequence
        and b.production_order_line_id=new.production_order_line_id
        and b.usage_key=new.usage_key and b.contribution_id=new.contribution_id
        and b.contribution_snapshot_id=new.contribution_snapshot_id
        and b.resource_id=new.resource_id and b.unit_id=new.unit_id
        and b.reservation_id=(new.result->>'reservation_id')::uuid) then
      perform stock._int1_fail('OP_RESERVATION_ITEM_MISMATCH');
    end if;
  elsif tg_table_name='op_reservation_allocations' then
    if not exists (select 1 from stock.op_reservation_bindings b
      join stock.op_reservation_operation_items i on i.id=new.operation_item_id and i.binding_id=b.id
      where b.id=new.binding_id and b.reservation_id=new.reservation_id
        and i.revision_id=new.revision_id and i.op_change_sequence=new.op_change_sequence
        and i.production_order_line_id=new.production_order_line_id
        and i.usage_key=new.usage_key and i.contribution_id=new.contribution_id
        and i.contribution_snapshot_id=new.contribution_snapshot_id) then
      perform stock._int1_fail('OP_RESERVATION_ALLOCATION_MISMATCH');
    end if;
  end if;
  return new;
end $$;

create function stock._int1_prepare_operation(
  p_op_reservation_operation_id uuid,
  p_op_id uuid,
  p_revision_id uuid,
  p_op_change_sequence bigint,
  p_operation_kind text,
  p_contribution_snapshot_ids uuid[] default null
) returns jsonb
language plpgsql security definer set search_path=pg_catalog,stock,auth as $$
declare
  v_actor uuid;
  v_list jsonb;
  v_needs jsonb;
  v_scope jsonb;
  v_payload jsonb;
  v_hash text;
  v_key text;
  v_existing_hash text;
  v_existing_result jsonb;
  v_existing_id uuid;
  v_run_id uuid;
  v_items jsonb:='[]'::jsonb;
  v_need jsonb;
  v_child uuid;
begin
  if p_op_reservation_operation_id is null or p_op_id is null or p_revision_id is null
    or p_op_change_sequence is null or p_op_change_sequence<=0 then
    perform stock._int1_fail('OP_RESERVATION_INPUT_INVALID');
  end if;
  if p_operation_kind is null or p_operation_kind not in ('revision_target_sync','revision_approved','revision_rejected',
    'revision_withdrawn','chef_hold','chef_release','op_cancellation_requested','op_cancelled') then
    perform stock._int1_fail('OP_RESERVATION_OPERATION_KIND_INVALID');
  end if;

  -- Caller scope contains only snapshot IDs. NULL means all resolved needs;
  -- empty/duplicate/foreign scopes are rejected by the step-2 reader.
  v_list:=stock._int1_list_published_op_stock_needs(
    p_op_id,p_revision_id,p_op_change_sequence,p_contribution_snapshot_ids);
  v_needs:=coalesce(v_list->'needs','[]'::jsonb);
  v_run_id:=(v_list->>'published_run_id')::uuid;
  select coalesce(jsonb_agg(jsonb_build_object(
      'production_order_line_id',n->'production_order_line_id',
      'usage_key',n->'usage_key','contribution_id',n->'contribution_id',
      'contribution_snapshot_id',n->'contribution_snapshot_id')
      order by n->>'production_order_line_id',n->>'usage_key',
        n->>'contribution_id',n->>'contribution_snapshot_id'),'[]'::jsonb)
    into v_scope from jsonb_array_elements(v_needs) n;
  v_scope:=jsonb_build_object('needs',v_scope);

  v_actor:=stock._res2_actor(true);
  v_payload:=jsonb_build_object(
    'contract_version','INT-1/2.0',
    'actor_profile_id',v_actor,
    'actor_user_id',auth.uid(),
    'op_id',p_op_id,
    'revision_id',p_revision_id,
    'op_change_sequence',p_op_change_sequence,
    'operation_kind',p_operation_kind,
    'canonical_scope',v_scope,
    'published_run_id',v_run_id,
    'resolved_snapshots',coalesce((select jsonb_agg(jsonb_build_object(
        'contribution_snapshot_id',n->'contribution_snapshot_id',
        'contribution_id',n->'contribution_id',
        'production_order_line_id',n->'production_order_line_id',
        'usage_key',n->'usage_key','resource_id',n->'resource_id',
        'canonical_unit_id',n->'canonical_unit_id','target_quantity',n->'target_quantity')
        order by n->>'production_order_line_id',n->>'usage_key',
          n->>'contribution_id',n->>'contribution_snapshot_id')
      from jsonb_array_elements(v_needs) n),'[]'::jsonb));
  v_hash:=encode(sha256(convert_to(v_payload::text,'UTF8')),'hex');
  v_key:=stock._int1_business_key(p_op_id,p_revision_id,p_op_change_sequence,p_operation_kind,v_scope);

  -- Stable lock order: external parent identity, then canonical business key.
  perform pg_advisory_xact_lock(hashtextextended('INT-1/parent/'||p_op_reservation_operation_id::text,0));
  perform pg_advisory_xact_lock(hashtextextended('INT-1/business/'||v_key,0));

  select payload_hash,result into v_existing_hash,v_existing_result
    from stock.op_reservation_operations where id=p_op_reservation_operation_id;
  if found then
    if v_existing_hash is distinct from v_hash then
      perform stock._int1_fail('OP_RESERVATION_PAYLOAD_MISMATCH');
    end if;
    return v_existing_result;
  end if;
  select id into v_existing_id from stock.op_reservation_operations where business_key=v_key;
  if found then perform stock._int1_fail('OP_RESERVATION_BUSINESS_KEY_CONFLICT'); end if;

  -- Staleness is checked only for a new parent, after both replay checks.
  if p_op_change_sequence < (select max(c.change_sequence)
      from stock.production_order_revision_changes c where c.revision_id=p_revision_id) then
    perform stock._int1_fail('OP_RESERVATION_STALE_CHANGE_SEQUENCE');
  end if;

  for v_need in select value from jsonb_array_elements(v_needs) order by
    value->>'production_order_line_id',value->>'usage_key',
    value->>'contribution_id',value->>'contribution_snapshot_id'
  loop
    v_child:=stock._int1_child_request_id(
      p_op_reservation_operation_id,
      (v_need->>'production_order_line_id')::uuid,
      v_need->>'usage_key',
      (v_need->>'contribution_id')::uuid,
      (v_need->>'contribution_snapshot_id')::uuid,
      'prepared',(v_need->>'resource_id')::uuid);
    v_items:=v_items||jsonb_build_array(jsonb_build_object(
      'child_request_id',v_child,'action_kind','prepared',
      'production_order_line_id',v_need->'production_order_line_id',
      'usage_key',v_need->'usage_key','contribution_id',v_need->'contribution_id',
      'contribution_snapshot_id',v_need->'contribution_snapshot_id',
      'resource_id',v_need->'resource_id','unit_id',v_need->'canonical_unit_id',
      'target_quantity',v_need->'target_quantity'));
  end loop;

  v_existing_result:=jsonb_build_object(
    'contract_version','INT-1/2.0','status','completed','effect','prepared_only',
    'operation_id',p_op_reservation_operation_id,'business_key',v_key,
    'payload_hash',v_hash,'published_run_id',v_run_id,'canonical_scope',v_scope,'items',v_items);
  insert into stock.op_reservation_operations(
    id,business_key,payload_hash,op_id,revision_id,op_change_sequence,operation_kind,
    actor_profile_id,result,published_run_id,canonical_scope,contract_version,status)
  values(p_op_reservation_operation_id,v_key,v_hash,p_op_id,p_revision_id,p_op_change_sequence,
    p_operation_kind,v_actor,v_existing_result,v_run_id,v_scope,'INT-1/2.0','completed');

  for v_need in select value from jsonb_array_elements(v_items)
  loop
    insert into stock.op_reservation_operation_items(
      operation_id,binding_id,child_request_id,action_kind,revision_id,op_change_sequence,
      reservation_change_sequence,target_quantity,result,production_order_line_id,usage_key,
      contribution_id,contribution_snapshot_id,resource_id,unit_id)
    values(p_op_reservation_operation_id,null,(v_need->>'child_request_id')::uuid,'prepared',
      p_revision_id,p_op_change_sequence,null,(v_need->>'target_quantity')::numeric,
      jsonb_build_object('status','prepared','physical_effect','none'),
      (v_need->>'production_order_line_id')::uuid,v_need->>'usage_key',
      (v_need->>'contribution_id')::uuid,(v_need->>'contribution_snapshot_id')::uuid,
      (v_need->>'resource_id')::uuid,(v_need->>'unit_id')::uuid);
  end loop;
  return v_existing_result;
end $$;

revoke all on function stock._int1_prepare_operation(uuid,uuid,uuid,bigint,text,uuid[])
  from public,anon,authenticated;

comment on function stock._int1_prepare_operation(uuid,uuid,uuid,bigint,text,uuid[]) is
  'Private INT-1 step-3A transaction core: canonical OP-2 scope, payload hash, replay-safe parent and prepared-only child journal; no physical effects.';
comment on column stock.op_reservation_operation_items.binding_id is
  'NULL only for INT-1/2.0 prepared-only journal items; physical-effect items require a binding.';
