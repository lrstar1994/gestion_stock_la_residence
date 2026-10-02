-- RES-2 / contract 2.0. LOCAL ONLY: not deployed to TEST.
-- Apply in one transaction as postgres. No physical stock writes or OP integration.
-- Numeric argument typmods are not enforced by PostgreSQL functions: validate explicitly.
do $$
begin
  if current_user <> 'postgres' or not exists (
    select 1 from pg_roles where rolname = current_user and rolbypassrls
  ) then
    raise exception 'RES-2 requires the existing postgres owner with BYPASSRLS';
  end if;
  if to_regprocedure('stock.can_access_stock_location(uuid,boolean)') is null
     or to_regprocedure('stock.article_location_allowed(uuid,uuid)') is null
     or to_regclass('stock.stock_location_view') is null then
    raise exception 'RES-2 existing stock dependencies missing';
  end if;
  if not exists (
    select 1 from pg_extension e join pg_namespace n on n.oid=e.extnamespace
    join pg_proc p on p.pronamespace=n.oid and p.proname='digest'
    join pg_depend d on d.classid='pg_proc'::regclass and d.objid=p.oid
      and d.refclassid='pg_extension'::regclass and d.refobjid=e.oid and d.deptype='e'
    where e.extname='pgcrypto' and pg_get_function_identity_arguments(p.oid)='bytea, text'
  ) then raise exception 'RES-2 requires the existing pgcrypto digest(bytea,text)'; end if;
end $$;

alter table stock.stock_reservations
  add column last_target_change_sequence bigint not null default 0;

create function stock._res2_fail(p_code text) returns void
language plpgsql security invoker set search_path=pg_catalog,stock as $$
begin
  raise exception using errcode='P0001', message=p_code,
    detail=jsonb_build_object('code',p_code,'contract','RES-2/2.0')::text;
end $$;

create function stock._res2_actor(p_write boolean) returns uuid
language plpgsql security invoker set search_path=pg_catalog,stock,auth as $$
declare v_actor stock.profiles%rowtype;
begin
  select * into v_actor from stock.profiles where user_id=auth.uid() and status='active';
  if not found then perform stock._res2_fail('RESERVATION_PROFILE_REQUIRED'); end if;
  if v_actor.role is null or not (
    v_actor.role::text=any(case when p_write then array['direction','chef_cuisine']
      else array['direction','chef_cuisine','magasinier','acheteur','controleur'] end)
  ) then perform stock._res2_fail('RESERVATION_ROLE_FORBIDDEN'); end if;
  return v_actor.id;
end $$;

create function stock._res2_quantity(p_quantity numeric) returns numeric
language plpgsql security invoker set search_path=pg_catalog,stock as $$
begin
  if p_quantity is null or p_quantity::text in ('NaN','Infinity','-Infinity')
     or p_quantity < 0 or p_quantity > 9999999999.9999
     or p_quantity <> trunc(p_quantity,4) then
    perform stock._res2_fail('RESERVATION_QUANTITY_INVALID');
  end if;
  return p_quantity::numeric(14,4);
end $$;

create function stock._res2_lock_request(p_request_id uuid) returns void
language plpgsql security invoker set search_path=pg_catalog,stock as $$
begin
  if p_request_id is null then perform stock._res2_fail('RESERVATION_REQUEST_REQUIRED'); end if;
  -- Namespace distinct from every business lock (which exclusively uses the RES-1 table).
  perform pg_advisory_xact_lock(hashtextextended('RES-2/request/'||p_request_id::text,0));
  -- Fresh command snapshots after waits are required for availability and replay.
  if current_setting('transaction_isolation') <> 'read committed' then
    perform stock._res2_fail('RESERVATION_ISOLATION_UNSUPPORTED');
  end if;
end $$;

create function stock._res2_check_locations(p_state jsonb,p_write boolean) returns void
language plpgsql security invoker set search_path=pg_catalog,stock,auth as $$
declare v_location uuid;
begin
  if jsonb_array_length(p_state->'segments')=0 then
    perform stock._res2_fail('RESERVATION_LOCATION_REQUIRED');
  end if;
  for v_location in select distinct (s->>'location_id')::uuid
    from jsonb_array_elements(p_state->'segments') s
  loop
    if not stock.can_access_stock_location(v_location,p_write) then
      perform stock._res2_fail('RESERVATION_LOCATION_FORBIDDEN');
    end if;
  end loop;
end $$;

create function stock._res2_request(p_request_id uuid,p_operation text,p_actor uuid,p_parameters jsonb)
returns table(payload_hash text,cached_result jsonb)
language plpgsql security invoker set search_path=pg_catalog,stock,auth as $$
declare v_schema name; v_canonical jsonb; v_old stock.stock_reservation_requests%rowtype;
begin
  -- Internal only: parameters are constructed from typed arguments by each public RPC.
  v_canonical := jsonb_build_object('contract','RES-2/2.0','operation',p_operation,
    'actor_profile_id',p_actor,'auth_user_id',auth.uid(),'parameters',p_parameters);
  select n.nspname into strict v_schema from pg_extension e
    join pg_namespace n on n.oid=e.extnamespace where e.extname='pgcrypto';
  execute format('select encode(%I.digest(convert_to($1,''UTF8''),''sha256''),''hex'')',v_schema)
    into payload_hash using v_canonical::text;
  select * into v_old from stock.stock_reservation_requests where request_id=p_request_id;
  if found then
    if v_old.payload_hash <> payload_hash then
      perform stock._res2_fail('RESERVATION_REQUEST_PAYLOAD_MISMATCH');
    end if;
    -- Revoked access must not become readable through a historical request result.
    perform stock._res2_check_locations(v_old.result,true);
    cached_result := v_old.result;
  end if;
  return next;
end $$;

create function stock._res2_lock_resources(p_keys jsonb) returns void
language plpgsql security invoker set search_path=pg_catalog,stock as $$
declare v_key record;
begin
  -- BOTH insertion and locking are ordered, including previously absent keys.
  for v_key in select distinct k.resource_type,k.resource_id,k.location_id
    from jsonb_to_recordset(p_keys) k(resource_type text,resource_id uuid,location_id uuid)
    order by k.resource_type,k.resource_id,k.location_id
  loop
    if v_key.resource_type is distinct from 'article' then
      perform stock._res2_fail('RESERVATION_RESOURCE_TYPE_UNSUPPORTED');
    end if;
    insert into stock.stock_reservation_locks(resource_type,resource_id,location_id)
      values(v_key.resource_type,v_key.resource_id,v_key.location_id) on conflict do nothing;
    perform 1 from stock.stock_reservation_locks
      where resource_type=v_key.resource_type and resource_id=v_key.resource_id
        and location_id=v_key.location_id for update;
  end loop;
end $$;

create function stock._res2_article_location(p_article_id uuid,p_location_id uuid) returns uuid
language plpgsql security invoker set search_path=pg_catalog,stock,auth as $$
declare v_article stock.articles%rowtype;
begin
  if p_location_id is null then perform stock._res2_fail('RESERVATION_LOCATION_REQUIRED'); end if;
  if not exists(select 1 from stock.locations where id=p_location_id and is_active)
     or not stock.can_access_stock_location(p_location_id,true) then
    perform stock._res2_fail('RESERVATION_LOCATION_FORBIDDEN');
  end if;
  select * into v_article from stock.articles where id=p_article_id;
  if not found then perform stock._res2_fail('RESERVATION_RESOURCE_NOT_FOUND'); end if;
  if v_article.status::text is distinct from 'active' or v_article.stockable is not true
     or stock.article_location_allowed(p_article_id,p_location_id) is not true then
    perform stock._res2_fail('RESERVATION_RESOURCE_UNAVAILABLE');
  end if;
  return v_article.unit_id;
end $$;

create function stock._res2_lock_reservation(p_reservation_id uuid,p_extra_location uuid)
returns stock.stock_reservations
language plpgsql security invoker set search_path=pg_catalog,stock,auth as $$
declare v_before stock.stock_reservations%rowtype; v_locked stock.stock_reservations%rowtype;
  v_locations uuid[]; v_location uuid;
begin
  select * into v_before from stock.stock_reservations where id=p_reservation_id;
  if not found then perform stock._res2_fail('RESERVATION_NOT_FOUND'); end if;
  if v_before.resource_type <> 'article' then
    perform stock._res2_fail('RESERVATION_RESOURCE_TYPE_UNSUPPORTED');
  end if;
  if p_extra_location is not null then
    perform stock._res2_article_location(v_before.resource_id,p_extra_location);
  end if;
  select array_agg(distinct location_id order by location_id) into v_locations from (
    select location_id from stock.stock_reservation_segments where reservation_id=p_reservation_id
    union select p_extra_location where p_extra_location is not null
  ) q;
  if coalesce(cardinality(v_locations),0)=0 then
    perform stock._res2_fail('RESERVATION_LOCATION_REQUIRED');
  end if;
  foreach v_location in array v_locations loop
    if not stock.can_access_stock_location(v_location,true) then
      perform stock._res2_fail('RESERVATION_LOCATION_FORBIDDEN');
    end if;
  end loop;
  perform stock._res2_lock_resources((select jsonb_agg(jsonb_build_object(
    'resource_type',v_before.resource_type,'resource_id',v_before.resource_id,'location_id',l))
    from unnest(v_locations) l));
  select * into v_locked from stock.stock_reservations where id=p_reservation_id for update;
  -- Another writer may have added a location while this writer waited. Never take
  -- an additional out-of-order lock after the reservation lock: abort and retry.
  if v_locked.resource_id is distinct from v_before.resource_id
     or v_locked.resource_type is distinct from v_before.resource_type
     or exists(select 1 from stock.stock_reservation_segments
       where reservation_id=p_reservation_id and not(location_id=any(v_locations))) then
    perform stock._res2_fail('RESERVATION_CONCURRENT_CHANGE');
  end if;
  if v_locked.status not in ('active','suspended') then
    perform stock._res2_fail('RESERVATION_STATUS_FORBIDDEN');
  end if;
  return v_locked;
end $$;

create function stock._res2_available(p_article_id uuid,p_location_id uuid,p_unit_id uuid,p_exclude uuid)
returns numeric
language plpgsql security invoker set search_path=pg_catalog,stock as $$
declare v_physical numeric; v_other numeric;
begin
  -- Caller holds the resource/location row lock. Never guess a unit conversion.
  if exists(select 1 from stock.stock_location_view where article_id=p_article_id
    and location_id=p_location_id and quantity<>0 and unit_id is distinct from p_unit_id) then
    perform stock._res2_fail('RESERVATION_STOCK_UNIT_MISMATCH');
  end if;
  select coalesce(sum(quantity),0) into v_physical from stock.stock_location_view
    where article_id=p_article_id and location_id=p_location_id and unit_id=p_unit_id;
  select coalesce(sum(s.protected_quantity),0) into v_other
    from stock.stock_reservation_segments s join stock.stock_reservations r on r.id=s.reservation_id
    where r.resource_type='article' and r.resource_id=p_article_id and s.location_id=p_location_id
      and s.status in ('active','in_transit') and r.id is distinct from p_exclude;
  return v_physical-v_other;
end $$;

create function stock._res2_state(p_reservation_id uuid) returns jsonb
language sql stable security invoker set search_path=pg_catalog,stock as $$
  -- One statement snapshot for header, segments and analytical allocations.
  select jsonb_build_object(
    'reservation_id',r.id,'resource_type',r.resource_type,'resource_id',r.resource_id,'unit_id',r.unit_id,
    'op_id',r.op_id,'revision_id',r.revision_id,'target_quantity',r.target_quantity,
    'reserved_quantity',r.reserved_quantity,'delivered_quantity',r.delivered_quantity,
    'released_quantity',r.released_quantity,'transferred_quantity',r.transferred_quantity,
    'shortage_quantity',r.shortage_quantity,'excess_quantity',r.excess_quantity,
    'status',r.status,'last_target_change_sequence',r.last_target_change_sequence,
    'segments',coalesce((select jsonb_agg(jsonb_build_object('segment_id',s.id,
      'location_id',s.location_id,'protected_quantity',s.protected_quantity,'status',s.status)
      order by s.location_id,s.id) from stock.stock_reservation_segments s where s.reservation_id=r.id),'[]'::jsonb),
    'allocations',coalesce((select jsonb_agg(jsonb_build_object('allocation_id',a.id,
      'contribution_id',a.contribution_id,'contribution_snapshot_id',a.contribution_snapshot_id,
      'calculation_run_id',a.calculation_run_id,'revision_id',a.revision_id,
      'allocated_quantity',a.allocated_quantity,'status',a.status) order by a.id)
      from stock.stock_reservation_contribution_allocations a
      where a.reservation_id=r.id and a.status='active'),'[]'::jsonb))
  from stock.stock_reservations r where r.id=p_reservation_id;
$$;

create function stock.reserve_resource(
  p_request_id uuid,p_resource_type text,p_resource_id uuid,p_target_quantity numeric(14,4),
  p_location_id uuid,p_change_sequence bigint,p_op_id uuid default null,p_revision_id uuid default null
) returns jsonb language plpgsql security definer set search_path=pg_catalog,stock,auth as $$
declare v_actor uuid; v_q numeric(14,4); v_hash text; v_result jsonb; v_unit uuid;
  v_id uuid; v_reserved numeric(14,4);
begin
  perform stock._res2_lock_request(p_request_id);
  v_actor := stock._res2_actor(true);
  v_q := stock._res2_quantity(p_target_quantity);
  select payload_hash,cached_result into v_hash,v_result from stock._res2_request(
    p_request_id,'reserve_resource',v_actor,jsonb_build_object('resource_type',p_resource_type,
      'resource_id',p_resource_id,'target_quantity',v_q,'location_id',p_location_id,
      'change_sequence',p_change_sequence,'op_id',p_op_id,'revision_id',p_revision_id));
  if v_result is not null then return v_result; end if;
  if p_resource_type is distinct from 'article' then
    perform stock._res2_fail('RESERVATION_RESOURCE_TYPE_UNSUPPORTED');
  end if;
  if p_change_sequence is null or p_change_sequence<=0 then
    perform stock._res2_fail('RESERVATION_STALE_CHANGE_SEQUENCE');
  end if;
  v_unit := stock._res2_article_location(p_resource_id,p_location_id);
  perform stock._res2_lock_resources(jsonb_build_array(jsonb_build_object(
    'resource_type',p_resource_type,'resource_id',p_resource_id,'location_id',p_location_id)));
  v_reserved := trunc(least(v_q,greatest(0,stock._res2_available(p_resource_id,p_location_id,v_unit,null))),4);
  insert into stock.stock_reservations(op_id,revision_id,resource_type,resource_id,unit_id,
    target_quantity,reserved_quantity,last_target_change_sequence)
    values(p_op_id,p_revision_id,p_resource_type,p_resource_id,v_unit,v_q,v_reserved,p_change_sequence)
    returning id into v_id;
  -- The zero active segment retains the creation location without protecting stock.
  insert into stock.stock_reservation_segments(reservation_id,location_id,protected_quantity)
    values(v_id,p_location_id,v_reserved);
  insert into stock.stock_reservation_events(reservation_id,request_id,operation,event_type,op_id,
    revision_id,change_sequence,actor_profile_id,target_quantity_after,reserved_quantity_delta)
    values(v_id,p_request_id,'reserve_resource','created',p_op_id,p_revision_id,p_change_sequence,v_actor,v_q,v_reserved);
  v_result := stock._res2_state(v_id)||jsonb_build_object('request_id',p_request_id,'location_id',p_location_id);
  insert into stock.stock_reservation_requests(request_id,operation,payload_hash,actor_profile_id,result)
    values(p_request_id,'reserve_resource',v_hash,v_actor,v_result);
  return v_result;
end $$;

create function stock.change_reservation_target(
  p_request_id uuid,p_reservation_id uuid,p_target_quantity numeric(14,4),p_change_sequence bigint,
  p_location_id uuid default null
) returns jsonb language plpgsql security definer set search_path=pg_catalog,stock,auth as $$
declare v_actor uuid; v_q numeric(14,4); v_hash text; v_result jsonb;
  v_r stock.stock_reservations%rowtype; v_delta numeric(14,4):=0; v_own numeric; v_unit uuid;
begin
  perform stock._res2_lock_request(p_request_id);
  v_actor := stock._res2_actor(true);
  v_q := stock._res2_quantity(p_target_quantity);
  select payload_hash,cached_result into v_hash,v_result from stock._res2_request(
    p_request_id,'change_reservation_target',v_actor,jsonb_build_object('reservation_id',p_reservation_id,
      'target_quantity',v_q,'change_sequence',p_change_sequence,'location_id',p_location_id));
  if v_result is not null then return v_result; end if;
  v_r := stock._res2_lock_reservation(p_reservation_id,p_location_id);
  if p_change_sequence is null or p_change_sequence<=v_r.last_target_change_sequence then
    perform stock._res2_fail('RESERVATION_STALE_CHANGE_SEQUENCE');
  end if;
  if v_q=v_r.target_quantity then perform stock._res2_fail('RESERVATION_TARGET_UNCHANGED'); end if;
  if v_q>v_r.target_quantity then
    v_unit := stock._res2_article_location(v_r.resource_id,p_location_id);
    if v_unit<>v_r.unit_id then perform stock._res2_fail('RESERVATION_STOCK_UNIT_MISMATCH'); end if;
    select coalesce(sum(protected_quantity),0) into v_own from stock.stock_reservation_segments
      where reservation_id=v_r.id and location_id=p_location_id and status in ('active','in_transit');
    -- available excludes own segments: subtract only current own protection at THIS
    -- location to obtain extra headroom; never subtract historical delivered/released.
    v_delta := trunc(least(v_q-v_r.target_quantity,greatest(0,v_q-v_r.reserved_quantity-v_r.delivered_quantity),
      greatest(0,stock._res2_available(v_r.resource_id,p_location_id,v_r.unit_id,v_r.id)-v_own)),4);
    if v_delta>0 then
      insert into stock.stock_reservation_segments(reservation_id,location_id,protected_quantity)
        values(v_r.id,p_location_id,v_delta);
    end if;
  end if;
  update stock.stock_reservations set target_quantity=v_q,reserved_quantity=reserved_quantity+v_delta,
    last_target_change_sequence=p_change_sequence,updated_at=clock_timestamp() where id=v_r.id;
  insert into stock.stock_reservation_events(reservation_id,request_id,operation,event_type,op_id,
    revision_id,change_sequence,actor_profile_id,target_quantity_before,target_quantity_after,
    reserved_quantity_delta,metadata) values(v_r.id,p_request_id,'change_reservation_target','target_changed',
      v_r.op_id,v_r.revision_id,p_change_sequence,v_actor,v_r.target_quantity,v_q,v_delta,
      jsonb_build_object('location_id',p_location_id));
  v_result := stock._res2_state(v_r.id)||jsonb_build_object('request_id',p_request_id,'location_id',p_location_id);
  insert into stock.stock_reservation_requests(request_id,operation,payload_hash,actor_profile_id,result)
    values(p_request_id,'change_reservation_target',v_hash,v_actor,v_result);
  return v_result;
end $$;

create function stock.release_reservation(
  p_request_id uuid,p_reservation_id uuid,p_release_quantity numeric(14,4),p_segment_id uuid default null
) returns jsonb language plpgsql security definer set search_path=pg_catalog,stock,auth as $$
declare v_actor uuid; v_q numeric(14,4); v_hash text; v_result jsonb;
  v_r stock.stock_reservations%rowtype; v_s stock.stock_reservation_segments%rowtype; v_count bigint;
begin
  perform stock._res2_lock_request(p_request_id);
  v_actor := stock._res2_actor(true);
  v_q := stock._res2_quantity(p_release_quantity);
  select payload_hash,cached_result into v_hash,v_result from stock._res2_request(
    p_request_id,'release_reservation',v_actor,jsonb_build_object('reservation_id',p_reservation_id,
      'release_quantity',v_q,'segment_id',p_segment_id));
  if v_result is not null then return v_result; end if;
  if v_q<=0 then perform stock._res2_fail('RESERVATION_QUANTITY_INVALID'); end if;
  v_r := stock._res2_lock_reservation(p_reservation_id,null);
  if p_segment_id is null then
    select count(*) into v_count from stock.stock_reservation_segments where reservation_id=v_r.id
      and status in ('active','in_transit') and protected_quantity>0;
    if v_count>1 then perform stock._res2_fail('RESERVATION_SEGMENT_REQUIRED'); end if;
    if v_count=0 then perform stock._res2_fail('RESERVATION_RELEASE_EXCEEDS_RESERVED'); end if;
    select * into v_s from stock.stock_reservation_segments where reservation_id=v_r.id
      and status in ('active','in_transit') and protected_quantity>0 for update;
  else
    select * into v_s from stock.stock_reservation_segments
      where id=p_segment_id and reservation_id=v_r.id for update;
    if not found then perform stock._res2_fail('RESERVATION_SEGMENT_NOT_FOUND'); end if;
  end if;
  if v_s.status not in ('active','in_transit') or v_q>v_s.protected_quantity or v_q>v_r.reserved_quantity then
    perform stock._res2_fail('RESERVATION_RELEASE_EXCEEDS_RESERVED');
  end if;
  update stock.stock_reservation_segments set protected_quantity=protected_quantity-v_q,
    status=case when protected_quantity=v_q then 'released' else status end,
    updated_at=clock_timestamp() where id=v_s.id;
  update stock.stock_reservations set reserved_quantity=reserved_quantity-v_q,
    released_quantity=released_quantity+v_q,updated_at=clock_timestamp() where id=v_r.id;
  insert into stock.stock_reservation_events(reservation_id,request_id,operation,event_type,op_id,
    revision_id,actor_profile_id,reserved_quantity_delta,released_quantity_delta,metadata)
    values(v_r.id,p_request_id,'release_reservation','released',v_r.op_id,v_r.revision_id,v_actor,-v_q,v_q,
      jsonb_build_object('segment_id',v_s.id,'location_id',v_s.location_id));
  v_result := stock._res2_state(v_r.id)||jsonb_build_object('request_id',p_request_id,'location_id',v_s.location_id);
  insert into stock.stock_reservation_requests(request_id,operation,payload_hash,actor_profile_id,result)
    values(p_request_id,'release_reservation',v_hash,v_actor,v_result);
  return v_result;
end $$;

create function stock.get_reservation_state(p_reservation_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,stock,auth as $$
declare v_result jsonb;
begin
  perform stock._res2_actor(false);
  v_result := stock._res2_state(p_reservation_id);
  if v_result is null then perform stock._res2_fail('RESERVATION_NOT_FOUND'); end if;
  if v_result->>'resource_type'<>'article' then
    perform stock._res2_fail('RESERVATION_RESOURCE_TYPE_UNSUPPORTED');
  end if;
  perform stock._res2_check_locations(v_result,false);
  return v_result;
end $$;

-- Explicit allowlist: no existing helper/function ACL is changed.
do $$
declare v_name text; v_oid regprocedure;
begin
  foreach v_name in array array[
    '_res2_fail(text)','_res2_actor(boolean)','_res2_quantity(numeric)',
    '_res2_lock_request(uuid)','_res2_check_locations(jsonb,boolean)',
    '_res2_request(uuid,text,uuid,jsonb)','_res2_lock_resources(jsonb)',
    '_res2_article_location(uuid,uuid)','_res2_lock_reservation(uuid,uuid)',
    '_res2_available(uuid,uuid,uuid,uuid)','_res2_state(uuid)',
    'reserve_resource(uuid,text,uuid,numeric,uuid,bigint,uuid,uuid)',
    'change_reservation_target(uuid,uuid,numeric,bigint,uuid)',
    'release_reservation(uuid,uuid,numeric,uuid)','get_reservation_state(uuid)'
  ] loop
    v_oid := ('stock.'||v_name)::regprocedure;
    execute format('revoke all on function %s from public,anon,authenticated',v_oid);
  end loop;
end $$;
grant execute on function stock.reserve_resource(uuid,text,uuid,numeric,uuid,bigint,uuid,uuid) to authenticated;
grant execute on function stock.change_reservation_target(uuid,uuid,numeric,bigint,uuid) to authenticated;
grant execute on function stock.release_reservation(uuid,uuid,numeric,uuid) to authenticated;
grant execute on function stock.get_reservation_state(uuid) to authenticated;
comment on column stock.stock_reservations.last_target_change_sequence is
  'RES-2: strict positive bigint sequence for creation/target changes only; idempotent replay precedes the sequence check.';
