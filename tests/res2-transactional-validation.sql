\set ON_ERROR_STOP on
-- Run only against the isolated fixture assembled by run-res2-local.mjs.
begin;
create temp table res2_results(name text primary key,passed boolean not null);
grant all on res2_results to authenticated,anon;
create function pg_temp.ok(p_name text,p_ok boolean) returns void language plpgsql as $$
begin
  if p_ok is not true then raise exception 'FAIL: %',p_name; end if;
  insert into res2_results values(p_name,true);
end $$;
create function pg_temp.error(p_sql text,p_code text,p_name text) returns void language plpgsql as $$
declare v_detail text;
begin
  begin
    execute p_sql;
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_detail=pg_exception_detail;
    perform pg_temp.ok(p_name,v_detail::jsonb->>'code'=p_code);
    return;
  end;
  raise exception 'FAIL expected %: %',p_code,p_name;
end $$;

select pg_temp.ok('bigint_column',exists(select 1 from information_schema.columns
 where table_schema='stock' and table_name='stock_reservations' and column_name='last_target_change_sequence'
 and data_type='bigint' and is_nullable='NO' and column_default='0'));
select pg_temp.ok('six_tables_and_RLS',count(*)=6 and bool_and(c.relrowsecurity and c.relforcerowsecurity))
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='stock' and c.relkind='r' and c.relname like 'stock_reserv%';
select pg_temp.ok('eleven_internal_helpers',count(*)=11 and bool_and(not p.prosecdef
 and not has_function_privilege('authenticated',p.oid,'EXECUTE')
 and not has_function_privilege('anon',p.oid,'EXECUTE')))
 from pg_proc p where p.pronamespace='stock'::regnamespace and p.proname like '\_res2\_%' escape '\';
select pg_temp.ok('four_public_RPC_ACL_owner_path',count(*)=4 and bool_and(p.prosecdef
 and pg_get_userbyid(p.proowner)='postgres' and 'search_path=pg_catalog, stock, auth'=any(p.proconfig)
 and has_function_privilege('authenticated',p.oid,'EXECUTE')
 and not has_function_privilege('anon',p.oid,'EXECUTE')))
 from pg_proc p where p.pronamespace='stock'::regnamespace
 and p.proname in ('reserve_resource','change_reservation_target','release_reservation','get_reservation_state');
select pg_temp.ok('no_PUBLIC_function_execute',not exists(
 select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
 where p.pronamespace='stock'::regnamespace and (p.proname like '\_res2\_%' escape '\'
 or p.proname in ('reserve_resource','change_reservation_target','release_reservation','get_reservation_state'))
 and a.grantee=0 and a.privilege_type='EXECUTE'));
select pg_temp.ok('no_speculative_RPC',not exists(select 1 from pg_proc where pronamespace='stock'::regnamespace
 and proname in ('maintain_reservation','record_reservation_delivery','reserve_recipe')));
select pg_temp.ok('no_direct_table_access',not exists(
 select 1 from pg_class c cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
 where c.relnamespace='stock'::regnamespace and c.relname like 'stock_reserv%' and c.relkind='r'
 and a.grantee in (0,'anon'::regrole::oid,'authenticated'::regrole::oid)));
select pg_temp.ok('no_policies',not exists(select 1 from pg_policies where schemaname='stock'
 and tablename like 'stock_reserv%'));

set local role authenticated;
select set_config('request.jwt.claim.sub','50000000-0000-0000-0000-000000000001',true);
do $$
declare a uuid:='30000000-0000-0000-0000-000000000001'; l uuid:='20000000-0000-0000-0000-000000000001';
 b uuid:='20000000-0000-0000-0000-000000000002'; req uuid:=gen_random_uuid(); r jsonb; again jsonb;
 id uuid; seg uuid; z jsonb; cr uuid; rr uuid; result_before jsonb;
begin
 r:=stock.reserve_resource(req,'article',a,10,l,3000000000);
 id:=(r->>'reservation_id')::uuid; seg:=(r->'segments'->0->>'segment_id')::uuid;
 perform set_config('res2.test.id',id::text,true);
 perform set_config('res2.test.request',req::text,true);
 perform pg_temp.ok('first_partial_and_shortage',r->>'target_quantity'='10.0000'
   and (r->>'reserved_quantity')::numeric=6 and (r->>'shortage_quantity')::numeric=4
   and (r->>'last_target_change_sequence')::bigint=3000000000);
 again:=stock.reserve_resource(req,'article',a,10.0000,l,3000000000);
 perform pg_temp.ok('reserve_exact_replay',r=again);
 perform pg_temp.error(format('select stock.reserve_resource(%L,''article'',%L,11,%L,3000000000)',req,a,l),
   'RESERVATION_REQUEST_PAYLOAD_MISMATCH','payload_mismatch');
 z:=stock.reserve_resource(gen_random_uuid(),'article',a,2,l,1);
 perform pg_temp.ok('zero_stock_zero_active_segment',(z->>'reserved_quantity')::numeric=0
   and (z->>'shortage_quantity')::numeric=2 and jsonb_array_length(z->'segments')=1
   and z->'segments'->0->>'status'='active' and (z->'segments'->0->>'protected_quantity')::numeric=0);
 perform pg_temp.error(format('select stock.change_reservation_target(%L,%L,11,3000000001)',gen_random_uuid(),id),
   'RESERVATION_LOCATION_REQUIRED','increase_location_required');
 cr:=gen_random_uuid();
 r:=stock.change_reservation_target(cr,id,18,3000000001,b);
 perform pg_temp.ok('increase_partial_explicit_B',(r->>'reserved_quantity')::numeric=12
   and (r->>'shortage_quantity')::numeric=6 and jsonb_array_length(r->'segments')=2);
 perform pg_temp.ok('change_exact_replay',r=stock.change_reservation_target(cr,id,18,3000000001,b));
 perform pg_temp.error(format('select stock.change_reservation_target(%L,%L,19,3000000001,%L)',gen_random_uuid(),id,b),
   'RESERVATION_STALE_CHANGE_SEQUENCE','stale_sequence');
 perform pg_temp.error(format('select stock.change_reservation_target(%L,%L,18,3000000002)',gen_random_uuid(),id),
   'RESERVATION_TARGET_UNCHANGED','unchanged_target');
 r:=stock.change_reservation_target(gen_random_uuid(),id,8,3000000002);
 perform pg_temp.ok('multi_location_decrease_no_release',(r->>'reserved_quantity')::numeric=12
   and (r->>'excess_quantity')::numeric=4 and (r->>'released_quantity')::numeric=0);
 perform pg_temp.error(format('select stock.release_reservation(%L,%L,1)',gen_random_uuid(),id),
   'RESERVATION_SEGMENT_REQUIRED','multiple_segments_no_implicit_order');
 rr:=gen_random_uuid(); r:=stock.release_reservation(rr,id,2,seg);
 perform pg_temp.ok('partial_release_and_sequence',(r->>'reserved_quantity')::numeric=10
   and (r->>'released_quantity')::numeric=2 and (r->>'excess_quantity')::numeric=2
   and (r->>'last_target_change_sequence')::bigint=3000000002);
 perform pg_temp.ok('release_exact_replay',r=stock.release_reservation(rr,id,2,seg));
 perform pg_temp.error(format('select stock.release_reservation(%L,%L,5,%L)',gen_random_uuid(),id,seg),
   'RESERVATION_RELEASE_EXCEEDS_RESERVED','release_exceeds_segment');
 perform pg_temp.error(format('select stock.release_reservation(%L,%L,1,%L)',gen_random_uuid(),id,gen_random_uuid()),
   'RESERVATION_SEGMENT_NOT_FOUND','segment_not_found');
 perform pg_temp.error(format('select stock.reserve_resource(%L,''recipe'',%L,1,%L,1)',gen_random_uuid(),a,l),
   'RESERVATION_RESOURCE_TYPE_UNSUPPORTED','recipe_refused');
 perform pg_temp.error(format('select stock.reserve_resource(NULL,''article'',%L,1,%L,1)',a,l),
   'RESERVATION_REQUEST_REQUIRED','request_required');
 perform pg_temp.error(format('select stock.reserve_resource(%L,''article'',%L,1.00001,%L,1)',gen_random_uuid(),a,l),
   'RESERVATION_QUANTITY_INVALID','no_silent_rounding');
 perform pg_temp.error(format('select stock.reserve_resource(%L,''article'',%L,''NaN'',%L,1)',gen_random_uuid(),a,l),
   'RESERVATION_QUANTITY_INVALID','nan_rejected');
 perform pg_temp.error(format('select stock.reserve_resource(%L,''article'',%L,1,%L,1)',gen_random_uuid(),gen_random_uuid(),l),
   'RESERVATION_RESOURCE_NOT_FOUND','missing_article');
 perform pg_temp.error(format('select stock.get_reservation_state(%L)',gen_random_uuid()),
   'RESERVATION_NOT_FOUND','missing_reservation');
 result_before:=stock.get_reservation_state(id);
 begin
   perform stock.release_reservation(gen_random_uuid(),id,1,seg);
   raise exception using errcode='ZX001',message='test outer rollback';
 exception when sqlstate 'ZX001' then null;
 end;
 perform pg_temp.ok('outer_error_rolls_back_successful_RPC',result_before=stock.get_reservation_state(id));
 -- A new target increase in A must not reserve already protected own stock twice.
 r:=stock.change_reservation_target(gen_random_uuid(),id,20,3000000003,l);
 perform pg_temp.ok('own_segments_not_double_counted',(r->>'reserved_quantity')::numeric=12
   and (r->>'shortage_quantity')::numeric=8);
end $$;

-- Each real SQL caller is authenticated; helpers and direct DML are checked too.
do $$
declare i integer; id uuid:=current_setting('res2.test.id')::uuid; r jsonb;
begin
 for i in 1..12 loop
   perform set_config('request.jwt.claim.sub','50000000-0000-0000-0000-'||lpad(i::text,12,'0'),true);
   if i<=5 then
     r:=stock.get_reservation_state(id);
     perform pg_temp.ok('read_allowed_role_'||i,(r->>'reservation_id')::uuid=id);
   else
     perform pg_temp.error(format('select stock.get_reservation_state(%L)',id),
       'RESERVATION_ROLE_FORBIDDEN','read_forbidden_role_'||i);
   end if;
   if i>2 then
     perform pg_temp.error(format('select stock.change_reservation_target(%L,%L,1,4000000000)',gen_random_uuid(),id),
       'RESERVATION_ROLE_FORBIDDEN','write_forbidden_role_'||i);
     perform pg_temp.error(format('select stock.reserve_resource(%L,''article'',%L,1,%L,1)',gen_random_uuid(),
       '30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001'),
       'RESERVATION_ROLE_FORBIDDEN','reserve_forbidden_role_'||i);
     perform pg_temp.error(format('select stock.release_reservation(%L,%L,1)',gen_random_uuid(),id),
       'RESERVATION_ROLE_FORBIDDEN','release_forbidden_role_'||i);
   end if;
 end loop;
 perform set_config('request.jwt.claim.sub','50000000-0000-0000-0000-000000000002',true);
 perform pg_temp.error(format('select stock.reserve_resource(%L,''article'',%L,1,%L,1)',gen_random_uuid(),
   '30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003'),
   'RESERVATION_LOCATION_FORBIDDEN','chef_forbidden_location');
 r:=stock.reserve_resource(gen_random_uuid(),'article','30000000-0000-0000-0000-000000000001',1,
   '20000000-0000-0000-0000-000000000001',1);
 perform pg_temp.ok('chef_can_reserve',(r->>'target_quantity')::numeric=1);
 perform set_config('request.jwt.claim.sub','',true);
 perform pg_temp.error(format('select stock.get_reservation_state(%L)',id),'RESERVATION_PROFILE_REQUIRED','missing_profile');
 begin
   perform stock._res2_actor(true);
   raise exception 'helper unexpectedly executable';
 exception when insufficient_privilege then perform pg_temp.ok('helper_execute_denied_runtime',true);
 end;
 begin
   perform 1 from stock.stock_reservations;
   raise exception 'table unexpectedly readable';
 exception when insufficient_privilege then perform pg_temp.ok('table_select_denied_runtime',true);
 end;
end $$;
reset role;
update stock.profiles set status='inactive' where role='chef_cuisine';
set local role authenticated;
select set_config('request.jwt.claim.sub','50000000-0000-0000-0000-000000000002',true);
select pg_temp.error(format('select stock.get_reservation_state(%L)',current_setting('res2.test.id')),
 'RESERVATION_PROFILE_REQUIRED','inactive_profile');
reset role;
update stock.profiles set status='active' where role='chef_cuisine';
delete from stock.profile_location_access where profile_id='40000000-0000-0000-0000-000000000002'
 and location_id='20000000-0000-0000-0000-000000000002';
set local role authenticated;
select pg_temp.error(format('select stock.get_reservation_state(%L)',current_setting('res2.test.id')),
 'RESERVATION_LOCATION_FORBIDDEN','multi_location_read_no_data_leak');
reset role;

select pg_temp.ok('no_double_event_on_replay',count(*)=1) from stock.stock_reservation_events
 where request_id=current_setting('res2.test.request')::uuid;
select pg_temp.ok('no_double_creation_segment',count(*)=1) from stock.stock_reservation_segments
 where reservation_id=current_setting('res2.test.id')::uuid and protected_quantity=4;
select pg_temp.ok('requests_events_one_per_success',
 (select count(*) from stock.stock_reservation_requests)=(select count(*) from stock.stock_reservation_events));
select pg_temp.ok('quantities_and_segments_consistent',bool_and(r.reserved_quantity=(
 select coalesce(sum(s.protected_quantity),0) from stock.stock_reservation_segments s
 where s.reservation_id=r.id and s.status in ('active','in_transit'))
 and r.shortage_quantity=greatest(0,r.target_quantity-r.reserved_quantity-r.delivered_quantity)
 and r.excess_quantity=greatest(0,r.reserved_quantity+r.delivered_quantity-r.target_quantity)))
 from stock.stock_reservations r;
select pg_temp.ok('sha256_hashes',bool_and(payload_hash ~ '^[0-9a-f]{64}$')) from stock.stock_reservation_requests;
do $$
declare t text; op text;
begin
 foreach t in array array['stock_reservation_requests','stock_reservation_events'] loop
   foreach op in array array['update','delete'] loop
     begin
       if op='update' then execute format('update stock.%I set operation=operation',t);
       else execute format('delete from stock.%I',t); end if;
       raise exception using errcode='ZX002',message='append-only unexpectedly mutable';
     exception when sqlstate 'P0001' then perform pg_temp.ok('append_only_'||t||'_'||op,true);
     end;
   end loop;
 end loop;
end $$;

-- Late error after reservation/segment/event writes: statement subtransaction
-- must roll back all six tables, including an inserted business lock row.
create function pg_temp.reject_request_insert() returns trigger language plpgsql as $$
begin raise exception using errcode='ZX003',message='injected request insert failure'; end $$;
create trigger res2_test_late_error before insert on stock.stock_reservation_requests
 for each row execute function pg_temp.reject_request_insert();
create function pg_temp.counts() returns jsonb language sql as $$
 select jsonb_build_array((select count(*) from stock.stock_reservations),
 (select count(*) from stock.stock_reservation_segments),(select count(*) from stock.stock_reservation_events),
 (select count(*) from stock.stock_reservation_requests),(select count(*) from stock.stock_reservation_locks),
 (select count(*) from stock.stock_reservation_contribution_allocations));
$$;
select set_config('request.jwt.claim.sub','50000000-0000-0000-0000-000000000001',true);
do $$
declare before_counts jsonb:=pg_temp.counts();
begin
 begin
   perform stock.reserve_resource(gen_random_uuid(),'article','30000000-0000-0000-0000-000000000001',1,
     '20000000-0000-0000-0000-000000000003',1);
   raise exception 'late error missing';
 exception when sqlstate 'ZX003' then null;
 end;
 perform pg_temp.ok('late_error_full_six_table_rollback',before_counts=pg_temp.counts());
end $$;
drop trigger res2_test_late_error on stock.stock_reservation_requests;

-- Future delivered/transit/history data are explicit fixtures, not RES-2 APIs.
do $$
declare r uuid:=current_setting('res2.test.id')::uuid; s uuid; q numeric; out_state jsonb;
begin
 insert into stock.stock_reservation_segments(reservation_id,location_id,protected_quantity,status)
 select r,'20000000-0000-0000-0000-000000000003',100,status
 from unnest(array['released','delivered','cancelled']) t(status);
 insert into stock.stock_reservation_contribution_allocations(reservation_id,contribution_id,
   contribution_snapshot_id,calculation_run_id,allocated_quantity)
 values(r,gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),999);
 out_state:=stock.reserve_resource(gen_random_uuid(),'article','30000000-0000-0000-0000-000000000001',1,
   '20000000-0000-0000-0000-000000000003',1);
 perform pg_temp.ok('historical_segments_and_allocations_not_subtracted',
   (out_state->>'reserved_quantity')::numeric=0 and (out_state->>'shortage_quantity')::numeric=1);
 -- Add actual physical units: historical segments must not consume them.
 insert into stock.stock_movements(article_id,unit_id,quantity,to_location_id,movement_type)
 values('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',5,
   '20000000-0000-0000-0000-000000000003','entree');
 out_state:=stock.reserve_resource(gen_random_uuid(),'article','30000000-0000-0000-0000-000000000001',2,
   '20000000-0000-0000-0000-000000000003',1);
 perform pg_temp.ok('historical_segments_do_not_protect',(out_state->>'reserved_quantity')::numeric=2);
 s:=(out_state->'segments'->0->>'segment_id')::uuid;
 update stock.stock_reservation_segments set status='in_transit' where id=s;
 out_state:=stock.reserve_resource(gen_random_uuid(),'article','30000000-0000-0000-0000-000000000001',10,
   '20000000-0000-0000-0000-000000000003',1);
 perform pg_temp.ok('in_transit_protection_counted',(out_state->>'reserved_quantity')::numeric=3);
 -- Model 2 already delivered units AND the corresponding physical stock out.
 update stock.stock_reservation_segments set status='delivered',protected_quantity=0 where id=s;
 update stock.stock_reservations set reserved_quantity=0,delivered_quantity=2
 where id=(select reservation_id from stock.stock_reservation_segments where id=s);
 insert into stock.stock_movements(article_id,unit_id,quantity,from_location_id,movement_type)
 values('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',2,
   '20000000-0000-0000-0000-000000000003','consommation');
 -- Release one from the 3 remaining: exactly one becomes free, not -1.
 perform stock.release_reservation(gen_random_uuid(),(out_state->>'reservation_id')::uuid,1);
 out_state:=stock.reserve_resource(gen_random_uuid(),'article','30000000-0000-0000-0000-000000000001',10,
   '20000000-0000-0000-0000-000000000003',1);
 perform pg_temp.ok('physical_delivery_never_subtracted_twice',(out_state->>'reserved_quantity')::numeric=1);
 perform pg_temp.error(format('select stock.release_reservation(%L,%L,1,%L)',gen_random_uuid(),
   (select reservation_id from stock.stock_reservation_segments where id=s),s),
   'RESERVATION_RELEASE_EXCEEDS_RESERVED','delivered_segment_never_released');
 perform pg_temp.ok('current_allocations_returned',jsonb_array_length(stock.get_reservation_state(r)->'allocations')=1);
end $$;

-- Invalid inputs, inactive/restricted locations and replay security.
do $$
declare a uuid:='30000000-0000-0000-0000-000000000001'; l uuid:='20000000-0000-0000-0000-000000000001';
 r uuid:=current_setting('res2.test.id')::uuid; req uuid:=gen_random_uuid(); result jsonb; seg uuid;
begin
 perform pg_temp.error(format('select stock.change_reservation_target(%L,%L,99,5000000000,%L)',
   gen_random_uuid(),r,gen_random_uuid()),'RESERVATION_LOCATION_FORBIDDEN','unknown_increase_location');
 perform pg_temp.error(format('select stock.reserve_resource(%L,''article'',%L,1,%L,0)',gen_random_uuid(),a,l),
   'RESERVATION_STALE_CHANGE_SEQUENCE','creation_sequence_positive');
 update stock.locations set is_active=false where id=l;
 perform pg_temp.error(format('select stock.reserve_resource(%L,''article'',%L,1,%L,1)',gen_random_uuid(),a,l),
   'RESERVATION_LOCATION_FORBIDDEN','inactive_location');
 update stock.locations set is_active=true where id=l;
 update stock.articles set locations_restricted=true where id=a;
 perform pg_temp.error(format('select stock.reserve_resource(%L,''article'',%L,1,%L,1)',gen_random_uuid(),a,l),
   'RESERVATION_RESOURCE_UNAVAILABLE','article_location_restriction_reused');
 update stock.articles set locations_restricted=false where id=a;
 perform set_config('request.jwt.claim.sub','50000000-0000-0000-0000-000000000002',true);
 result:=stock.reserve_resource(req,'article',a,1,l,1);
 delete from stock.profile_location_access where profile_id='40000000-0000-0000-0000-000000000002' and location_id=l;
 perform pg_temp.error(format('select stock.reserve_resource(%L,''article'',%L,1,%L,1)',req,a,l),
   'RESERVATION_LOCATION_FORBIDDEN','replay_respects_revoked_access');
 insert into stock.profile_location_access values('40000000-0000-0000-0000-000000000002',l,true);
 update stock.profiles set status='inactive' where role='chef_cuisine';
 perform pg_temp.error(format('select stock.reserve_resource(%L,''article'',%L,1,%L,1)',req,a,l),
   'RESERVATION_PROFILE_REQUIRED','replay_requires_active_profile');
 update stock.profiles set status='active' where role='chef_cuisine';
 perform set_config('request.jwt.claim.sub','50000000-0000-0000-0000-000000000001',true);
 perform pg_temp.error(format('select stock.reserve_resource(%L,''article'',%L,1,%L,1)',req,a,l),
   'RESERVATION_REQUEST_PAYLOAD_MISMATCH','real_actor_in_hash');
end $$;

set local role anon;
do $$
begin
 begin
   perform stock.get_reservation_state(gen_random_uuid());
   raise exception 'anon RPC unexpectedly allowed';
 exception when insufficient_privilege then perform pg_temp.ok('anon_rpc_denied_runtime',true);
 end;
end $$;
reset role;
select name,passed from res2_results order by name;
select count(*)||' transactional checks PASS' as summary from res2_results;
rollback;
