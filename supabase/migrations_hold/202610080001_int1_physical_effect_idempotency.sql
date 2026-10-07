-- INT-1 step 3A.1. LOCAL HOLD ONLY.
-- Separate stable prepared-item identity from each future RES-2 effect ID.
-- This migration defines no RES-2 calls and performs no physical stock effect.

do $$
begin
  if current_user <> 'postgres' or not exists (
    select 1 from pg_roles where rolname=current_user and rolbypassrls
  ) then
    raise exception 'INT-1 step 3A.1 requires postgres with BYPASSRLS';
  end if;
  if to_regclass('stock.op_reservation_operation_items') is null
     or to_regprocedure('stock._int1_prepare_operation(uuid,uuid,uuid,bigint,text,uuid[])') is null
     or to_regprocedure('stock._int1_child_request_id(uuid,uuid,text,uuid,uuid,text,uuid)') is null then
    raise exception 'INT-1 step 3A.1 requires completed steps 1/2/3A';
  end if;
  if exists (select 1 from stock.op_reservation_operation_items where action_kind<>'prepared') then
    raise exception 'INT1_3A1_UNEXPECTED_NONPREPARED_ITEMS';
  end if;
  if exists (
    select 1 from stock.op_reservation_operation_items i
    where i.action_kind='prepared'
      and i.child_request_id is distinct from stock._int1_child_request_id(
        i.operation_id,i.production_order_line_id,i.usage_key,i.contribution_id,
        i.contribution_snapshot_id,'prepared',i.resource_id)
  ) then
    raise exception 'INT1_3A1_PREPARED_IDENTITY_MISMATCH';
  end if;
end $$;

-- Move the 3A deterministic prepared identity out of the physical request
-- column. Non-prepared effect rows will later carry a separate parent pointer
-- and their own RES-2 child request ID.
alter table stock.op_reservation_operation_items
  add column prepared_item_id uuid,
  add column prepared_parent_item_id uuid,
  alter column child_request_id drop not null,
  add constraint op_reservation_operation_items_prepared_item_id_key unique (prepared_item_id),
  add constraint op_reservation_operation_items_prepared_parent_fk
    foreign key (prepared_parent_item_id)
    references stock.op_reservation_operation_items(prepared_item_id) on delete restrict;

alter table stock.op_reservation_operation_items
  disable trigger op_reservation_operation_items_append_only_trg;
update stock.op_reservation_operation_items
   set prepared_item_id=child_request_id, child_request_id=null
 where action_kind='prepared';
alter table stock.op_reservation_operation_items
  enable trigger op_reservation_operation_items_append_only_trg;
alter table stock.op_reservation_operation_items
  add constraint op_reservation_operation_items_identity_split_check check (
    (action_kind='prepared' and prepared_item_id is not null
      and prepared_parent_item_id is null and child_request_id is null)
    or (action_kind in ('reserve','change_target','release')
      and prepared_item_id is null and prepared_parent_item_id is not null and child_request_id is not null)
    or (action_kind in ('reclassify_approved','reclassify_chef_hold','no_change')
      and prepared_item_id is null and prepared_parent_item_id is null and child_request_id is null)
  );

create function stock._int1_prepared_item_id(
  p_operation_id uuid,
  p_production_order_line_id uuid,
  p_usage_key text,
  p_contribution_id uuid,
  p_contribution_snapshot_id uuid,
  p_resource_id uuid
) returns uuid language sql immutable security invoker set search_path=pg_catalog as $$
  with derived as (
    select md5(concat_ws('|',p_operation_id::text,p_production_order_line_id::text,p_usage_key,
      p_contribution_id::text,p_contribution_snapshot_id::text,'prepared',p_resource_id::text)) as h
  )
  select (substr(h,1,8)||'-'||substr(h,9,4)||'-5'||substr(h,14,3)||'-a'||substr(h,18,3)||'-'||substr(h,21,12))::uuid
    from derived
$$;

create function stock._int1_physical_effect_request_id(
  p_operation_id uuid,
  p_prepared_item_id uuid,
  p_effect_kind text,
  p_effect_coordinates jsonb
) returns uuid language plpgsql immutable security invoker set search_path=pg_catalog as $$
declare
  v_identity text;
  v_hash text;
begin
  if p_operation_id is null or p_prepared_item_id is null
     or p_effect_kind is null or p_effect_kind not in
       ('reserve_resource','change_reservation_target','release_reservation')
     or p_effect_coordinates is null
     or jsonb_typeof(p_effect_coordinates) is distinct from 'object'
     or p_effect_coordinates='{}'::jsonb
     or (p_effect_kind='reserve_resource' and (
          not (p_effect_coordinates ?& array['resource_type','resource_id','location_id'])
          or (p_effect_coordinates - 'resource_type' - 'resource_id' - 'location_id')<>'{}'::jsonb
          or p_effect_coordinates->>'resource_type' is distinct from 'article'
          or p_effect_coordinates->>'resource_id' is null
          or p_effect_coordinates->>'location_id' is null))
     or (p_effect_kind='change_reservation_target' and (
          not (p_effect_coordinates ?& array['reservation_id','location_id','change_sequence'])
          or (p_effect_coordinates - 'reservation_id' - 'location_id' - 'change_sequence')<>'{}'::jsonb
          or p_effect_coordinates->>'reservation_id' is null
          or coalesce((p_effect_coordinates->>'change_sequence')::bigint,0)<=0))
     or (p_effect_kind='release_reservation' and (
          not (p_effect_coordinates ?& array['reservation_id','segment_id'])
          or (p_effect_coordinates - 'reservation_id' - 'segment_id')<>'{}'::jsonb
          or p_effect_coordinates->>'reservation_id' is null)) then
    raise exception 'INT1_PHYSICAL_EFFECT_IDENTITY_INVALID';
  end if;

  -- JSONB text is canonical for an object. Coordinates contain only the
  -- logical RES-2 target, not payload quantities that belong to its hash.
  v_identity:=jsonb_build_object(
    'contract','INT-1/3A.1/RES-2-PHYSICAL-EFFECT',
    'operation_id',p_operation_id,
    'prepared_item_id',p_prepared_item_id,
    'effect_kind',p_effect_kind,
    'coordinates',p_effect_coordinates
  )::text;
  v_hash:=encode(sha256(convert_to(v_identity,'UTF8')),'hex');

  -- Deterministic UUIDv8 custom value: SHA-256 identity bits, version 8,
  -- RFC variant. No random UUID is involved.
  return (substr(v_hash,1,8)||'-'||substr(v_hash,9,4)||'-8'||substr(v_hash,14,3)||
    '-a'||substr(v_hash,18,3)||'-'||substr(v_hash,21,12))::uuid;
end $$;

-- The prepared row and its returned journal item carry only prepared_item_id.
-- Keep the request payload/hash/replay checks byte-for-byte semantically equal
-- to 3A; historical completed operations still return their stored result.
create or replace function stock._int1_prepare_operation(
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
  v_prepared_item_id uuid;
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
    v_prepared_item_id:=stock._int1_prepared_item_id(
      p_op_reservation_operation_id,
      (v_need->>'production_order_line_id')::uuid,
      v_need->>'usage_key',
      (v_need->>'contribution_id')::uuid,
      (v_need->>'contribution_snapshot_id')::uuid,
      (v_need->>'resource_id')::uuid);
    v_items:=v_items||jsonb_build_array(jsonb_build_object(
      'prepared_item_id',v_prepared_item_id,'action_kind','prepared',
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
      operation_id,binding_id,prepared_item_id,action_kind,revision_id,op_change_sequence,
      reservation_change_sequence,target_quantity,result,production_order_line_id,usage_key,
      contribution_id,contribution_snapshot_id,resource_id,unit_id)
    values(p_op_reservation_operation_id,null,(v_need->>'prepared_item_id')::uuid,'prepared',
      p_revision_id,p_op_change_sequence,null,(v_need->>'target_quantity')::numeric,
      jsonb_build_object('status','prepared','physical_effect','none'),
      (v_need->>'production_order_line_id')::uuid,v_need->>'usage_key',
      (v_need->>'contribution_id')::uuid,(v_need->>'contribution_snapshot_id')::uuid,
      (v_need->>'resource_id')::uuid,(v_need->>'unit_id')::uuid);
  end loop;
  return v_existing_result;
end $$;

drop function stock._int1_child_request_id(uuid,uuid,text,uuid,uuid,text,uuid);

revoke all on function stock._int1_prepared_item_id(uuid,uuid,text,uuid,uuid,uuid)
  from public,anon,authenticated;
revoke all on function stock._int1_physical_effect_request_id(uuid,uuid,text,jsonb)
  from public,anon,authenticated;
revoke all on function stock._int1_prepare_operation(uuid,uuid,uuid,bigint,text,uuid[])
  from public,anon,authenticated;

comment on column stock.op_reservation_operation_items.prepared_item_id is
  'Stable deterministic identity of a prepared INT-1 item. Never pass as a RES-2 request_id.';
comment on column stock.op_reservation_operation_items.prepared_parent_item_id is
  'Physical-effect journal rows point to their stable prepared item through this FK.';
comment on column stock.op_reservation_operation_items.child_request_id is
  'Deterministic request_id for one physical RES-2 effect only; NULL for prepared/non-physical journal rows.';
comment on function stock._int1_prepared_item_id(uuid,uuid,text,uuid,uuid,uuid) is
  'Stable INT-1 prepared-item identity, preserving the exact 3A deterministic value; independent of future physical effect.';
comment on function stock._int1_physical_effect_request_id(uuid,uuid,text,jsonb) is
  'Derives a deterministic, effect-specific RES-2 request UUID from operation, prepared item, effect kind and canonical logical coordinates. No physical RPC is called here.';

create function stock.validate_op_reservation_item_identity()
returns trigger language plpgsql security invoker set search_path=pg_catalog,stock as $$
declare
  v_parent stock.op_reservation_operation_items%rowtype;
  v_effect_kind text;
begin
  if new.action_kind='prepared' then
    if new.prepared_item_id is distinct from stock._int1_prepared_item_id(
         new.operation_id,new.production_order_line_id,new.usage_key,new.contribution_id,
         new.contribution_snapshot_id,new.resource_id)
       or new.prepared_parent_item_id is not null or new.child_request_id is not null then
      raise exception 'INT1_PREPARED_ITEM_IDENTITY_INVALID';
    end if;
    return new;
  end if;

  if new.action_kind in ('reserve','change_target','release') then
    select * into v_parent from stock.op_reservation_operation_items p
     where p.prepared_item_id=new.prepared_parent_item_id and p.action_kind='prepared';
    if not found or v_parent.operation_id is distinct from new.operation_id
       or v_parent.production_order_line_id is distinct from new.production_order_line_id
       or v_parent.usage_key is distinct from new.usage_key
       or v_parent.contribution_id is distinct from new.contribution_id
       or v_parent.contribution_snapshot_id is distinct from new.contribution_snapshot_id
       or v_parent.resource_id is distinct from new.resource_id
       or v_parent.unit_id is distinct from new.unit_id then
      raise exception 'INT1_PHYSICAL_EFFECT_PREPARED_ITEM_MISMATCH';
    end if;
    v_effect_kind:=case new.action_kind
      when 'reserve' then 'reserve_resource'
      when 'change_target' then 'change_reservation_target'
      when 'release' then 'release_reservation'
    end;
    if new.child_request_id is distinct from stock._int1_physical_effect_request_id(
         new.operation_id,new.prepared_parent_item_id,v_effect_kind,
         new.result->'physical_effect_coordinates') then
      raise exception 'INT1_PHYSICAL_EFFECT_REQUEST_ID_INVALID';
    end if;
  elsif new.prepared_item_id is not null or new.prepared_parent_item_id is not null
     or new.child_request_id is not null then
    raise exception 'INT1_NONPHYSICAL_ITEM_IDENTITY_INVALID';
  end if;
  return new;
end $$;

create trigger op_reservation_operation_items_identity_trg
before insert on stock.op_reservation_operation_items
for each row execute function stock.validate_op_reservation_item_identity();

revoke all on function stock.validate_op_reservation_item_identity() from public,anon,authenticated;
comment on function stock.validate_op_reservation_item_identity() is
  'Validates deterministic prepared identity and future effect-specific RES-2 child IDs without calling RES-2.';

