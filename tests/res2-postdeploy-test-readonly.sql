\set ON_ERROR_STOP on
\pset pager off
\pset null '(NULL)'

BEGIN READ ONLY;

-- The external connection must target TEST project mcvchrqgubccgddcalpk.
-- Supabase pooler sessions expose current_user/session_user as postgres.
SELECT
  'mcvchrqgubccgddcalpk'::text AS expected_project_ref,
  current_database() AS database_name,
  current_user AS current_user_name,
  session_user AS session_user_name,
  current_setting('server_version') AS server_version,
  current_setting('transaction_read_only') AS transaction_read_only;

WITH
res1_tables(name) AS (
  VALUES
    ('stock_reservation_locks'), ('stock_reservation_requests'),
    ('stock_reservations'), ('stock_reservation_segments'),
    ('stock_reservation_contribution_allocations'), ('stock_reservation_events')
),
res1_constraints(name) AS (
  VALUES
    ('stock_reservation_locks_resource_type_check'),
    ('stock_reservation_locks_resource_location_unique'),
    ('stock_reservation_requests_operation_check'),
    ('stock_reservation_requests_payload_hash_check'),
    ('stock_reservations_resource_type_check'),
    ('stock_reservations_target_quantity_check'),
    ('stock_reservations_reserved_quantity_check'),
    ('stock_reservations_delivered_quantity_check'),
    ('stock_reservations_released_quantity_check'),
    ('stock_reservations_transferred_quantity_check'),
    ('stock_reservations_status_check'),
    ('stock_reservation_segments_protected_quantity_check'),
    ('stock_reservation_segments_status_check'),
    ('stock_reservation_allocations_quantity_check'),
    ('stock_reservation_allocations_status_check'),
    ('stock_reservation_allocations_snapshot_unique'),
    ('stock_reservation_events_operation_check'),
    ('stock_reservation_events_type_check'),
    ('stock_reservation_events_sequence_check'),
    ('stock_reservation_events_target_before_check'),
    ('stock_reservation_events_target_after_check'),
    ('stock_reservation_requests_pkey'), ('stock_reservations_pkey'),
    ('stock_reservation_segments_pkey'),
    ('stock_reservation_contribution_allocations_pkey'),
    ('stock_reservation_events_pkey'),
    ('stock_reservation_locks_location_id_fkey'),
    ('stock_reservation_requests_actor_profile_id_fkey'),
    ('stock_reservations_unit_id_fkey'),
    ('stock_reservation_segments_reservation_id_fkey'),
    ('stock_reservation_segments_location_id_fkey'),
    ('stock_reservation_contribution_allocations_reservation_id_fkey'),
    ('stock_reservation_events_reservation_id_fkey'),
    ('stock_reservation_events_actor_profile_id_fkey')
),
res1_indexes(name) AS (
  VALUES
    ('stock_reservations_resource_idx'), ('stock_reservations_op_revision_idx'),
    ('stock_reservation_segments_reservation_idx'),
    ('stock_reservation_segments_location_idx'),
    ('stock_reservation_allocations_reservation_idx'),
    ('stock_reservation_allocations_snapshot_idx'),
    ('stock_reservation_allocations_current_contribution_unique'),
    ('stock_reservation_events_reservation_idx'),
    ('stock_reservation_events_request_idx')
),
res1_triggers(table_name, name) AS (
  VALUES
    ('stock_reservation_requests','stock_reservation_requests_append_only_trg'),
    ('stock_reservation_events','stock_reservation_events_append_only_trg')
),
res2_helpers(signature, expected_search_path) AS (
  VALUES
    ('stock._res2_fail(text)','pg_catalog,stock'),
    ('stock._res2_actor(boolean)','pg_catalog,stock,auth'),
    ('stock._res2_quantity(numeric)','pg_catalog,stock'),
    ('stock._res2_lock_request(uuid)','pg_catalog,stock'),
    ('stock._res2_check_locations(jsonb,boolean)','pg_catalog,stock,auth'),
    ('stock._res2_request(uuid,text,uuid,jsonb)','pg_catalog,stock,auth'),
    ('stock._res2_lock_resources(jsonb)','pg_catalog,stock'),
    ('stock._res2_article_location(uuid,uuid)','pg_catalog,stock,auth'),
    ('stock._res2_lock_reservation(uuid,uuid)','pg_catalog,stock,auth'),
    ('stock._res2_available(uuid,uuid,uuid,uuid)','pg_catalog,stock'),
    ('stock._res2_state(uuid)','pg_catalog,stock')
),
res2_public(signature) AS (
  VALUES
    ('stock.reserve_resource(uuid,text,uuid,numeric,uuid,bigint,uuid,uuid)'),
    ('stock.change_reservation_target(uuid,uuid,numeric,bigint,uuid)'),
    ('stock.release_reservation(uuid,uuid,numeric,uuid)'),
    ('stock.get_reservation_state(uuid)')
),
op1_tables(name) AS (
  VALUES
    ('production_order_number_counters'), ('production_orders'),
    ('production_order_lines'), ('production_order_revisions'),
    ('production_order_revision_lines'), ('production_order_revision_changes')
),
op1_constraints(name) AS (
  VALUES
    ('production_orders_activation_blocked_check'),
    ('production_orders_op1_draft_only_check'),
    ('production_orders_active_revision_fk'),
    ('production_orders_approved_revision_fk')
),
op1_triggers(name) AS (
  VALUES
    ('production_orders_revision_pointer_consistency_trg'),
    ('production_orders_assign_number_trg'),
    ('production_order_revisions_immutable_trg'),
    ('production_order_revision_lines_immutable_trg')
),
storage_buckets(name) AS (
  VALUES
    ('purchase-order-files'), ('reception-anomalies'),
    ('reception-documents'), ('invoice-files')
),
storage_policies(name) AS (
  VALUES
    ('Purchase order files are readable'),
    ('Purchase order staff can upload files'),
    ('Reception anomaly photos are readable'),
    ('Reception staff can upload anomaly photos'),
    ('Reception documents are readable'),
    ('Reception staff can upload documents'),
    ('Users can view invoice files'),
    ('Accounting can upload invoice files')
),
checks(family, control, expected, actual, passed, blocking) AS (
  SELECT 'A_IDENTITY','database','postgres',current_database(),current_database()='postgres',true
  UNION ALL SELECT 'A_IDENTITY','PostgreSQL major','17.x',current_setting('server_version'),current_setting('server_version_num')::integer BETWEEN 170000 AND 179999,true
  UNION ALL SELECT 'A_IDENTITY','current_user','postgres',current_user,current_user='postgres',true
  UNION ALL SELECT 'A_IDENTITY','transaction_read_only','on',current_setting('transaction_read_only'),current_setting('transaction_read_only')='on',true

  UNION ALL SELECT 'B_HISTORY','OP-1 202609290001 occurrence','1',count(*)::text,count(*)=1,true FROM supabase_migrations.schema_migrations WHERE version='202609290001'
  UNION ALL SELECT 'B_HISTORY','RES-1 202609290002 occurrence','1',count(*)::text,count(*)=1,true FROM supabase_migrations.schema_migrations WHERE version='202609290002'
  UNION ALL SELECT 'B_HISTORY','Storage 202609300001 occurrence','1',count(*)::text,count(*)=1,true FROM supabase_migrations.schema_migrations WHERE version='202609300001'
  UNION ALL SELECT 'B_HISTORY','RES-2 202610010001 has no duplicate','0 or 1',count(*)::text,count(*) IN (0,1),true FROM supabase_migrations.schema_migrations WHERE version='202610010001'
  UNION ALL SELECT 'B_HISTORY','RES-2 history synchronization','reported only',
    CASE count(*) WHEN 0 THEN 'NOT YET SYNCHRONIZED' WHEN 1 THEN 'SYNCHRONIZED' ELSE 'INVALID DUPLICATE HISTORY' END,
    true,false FROM supabase_migrations.schema_migrations WHERE version='202610010001'

  UNION ALL SELECT 'C_RES2_OBJECTS','last_target_change_sequence exists','present',CASE WHEN a.attname IS NULL THEN 'absent' ELSE 'present' END,a.attname IS NOT NULL,true
    FROM (VALUES(1)) q(x) LEFT JOIN pg_attribute a ON a.attrelid=to_regclass('stock.stock_reservations') AND a.attname='last_target_change_sequence' AND a.attnum>0 AND NOT a.attisdropped
  UNION ALL SELECT 'C_RES2_OBJECTS','last_target_change_sequence type','bigint',coalesce(format_type(a.atttypid,a.atttypmod),'absent'),format_type(a.atttypid,a.atttypmod)='bigint',true
    FROM (VALUES(1)) q(x) LEFT JOIN pg_attribute a ON a.attrelid=to_regclass('stock.stock_reservations') AND a.attname='last_target_change_sequence' AND a.attnum>0 AND NOT a.attisdropped
  UNION ALL SELECT 'C_RES2_OBJECTS','last_target_change_sequence NOT NULL','true',coalesce(a.attnotnull::text,'absent'),coalesce(a.attnotnull,false),true
    FROM (VALUES(1)) q(x) LEFT JOIN pg_attribute a ON a.attrelid=to_regclass('stock.stock_reservations') AND a.attname='last_target_change_sequence' AND a.attnum>0 AND NOT a.attisdropped
  UNION ALL SELECT 'C_RES2_OBJECTS','last_target_change_sequence DEFAULT','0',coalesce(pg_get_expr(d.adbin,d.adrelid),'absent'),coalesce(pg_get_expr(d.adbin,d.adrelid) IN ('0','0::bigint','(0)::bigint'),false),true
    FROM (VALUES(1)) q(x)
    LEFT JOIN pg_attribute a ON a.attrelid=to_regclass('stock.stock_reservations') AND a.attname='last_target_change_sequence' AND a.attnum>0 AND NOT a.attisdropped
    LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
  UNION ALL SELECT 'C_RES2_OBJECTS','helper '||signature,'present',coalesce(to_regprocedure(signature)::text,'absent'),to_regprocedure(signature) IS NOT NULL,true FROM res2_helpers
  UNION ALL SELECT 'C_RES2_OBJECTS','public RPC '||signature,'present',coalesce(to_regprocedure(signature)::text,'absent'),to_regprocedure(signature) IS NOT NULL,true FROM res2_public
  UNION ALL SELECT 'C_RES2_OBJECTS','exact expected RES-2 signatures','15',count(*)::text,count(*)=15,true
    FROM (SELECT to_regprocedure(signature) AS oid FROM res2_helpers UNION ALL SELECT to_regprocedure(signature) FROM res2_public) s WHERE oid IS NOT NULL
  UNION ALL SELECT 'C_RES2_OBJECTS','no unexpected RES-2 overload or function','0',count(*)::text,count(*)=0,true
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='stock'
      AND (p.proname LIKE '\_res2\_%' ESCAPE '\' OR p.proname IN ('reserve_resource','change_reservation_target','release_reservation','get_reservation_state'))
      AND p.oid NOT IN (
        SELECT to_regprocedure(signature) FROM res2_helpers WHERE to_regprocedure(signature) IS NOT NULL
        UNION ALL SELECT to_regprocedure(signature) FROM res2_public WHERE to_regprocedure(signature) IS NOT NULL
      )
  UNION ALL SELECT 'C_RES2_OBJECTS','no RES-2 type created','0',count(*)::text,count(*)=0,true
    FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='stock' AND t.typname ~* '(^|_)res2(_|$)'
  UNION ALL SELECT 'C_RES2_OBJECTS','no RES-2 constraint created','0',count(*)::text,count(*)=0,true
    FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='stock' AND c.conname ~* '(^|_)res2(_|$)'
  UNION ALL SELECT 'C_RES2_OBJECTS','no RES-2 index created','0',count(*)::text,count(*)=0,true
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='stock' AND c.relkind='i' AND c.relname ~* '(^|_)res2(_|$)'
  UNION ALL SELECT 'C_RES2_OBJECTS','no RES-2 trigger created','0',count(*)::text,count(*)=0,true
    FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='stock' AND NOT t.tgisinternal AND t.tgname ~* '(^|_)res2(_|$)'

  UNION ALL SELECT 'C_RES2_CONTRACT','request payload hash','digest plus payload mismatch guard',
    CASE WHEN pg_get_functiondef(to_regprocedure('stock._res2_request(uuid,text,uuid,jsonb)')) ILIKE '%digest(%'
           AND pg_get_functiondef(to_regprocedure('stock._res2_request(uuid,text,uuid,jsonb)')) ILIKE '%payload_hash%'
           AND pg_get_functiondef(to_regprocedure('stock._res2_request(uuid,text,uuid,jsonb)')) ILIKE '%RESERVATION_REQUEST_PAYLOAD_MISMATCH%'
      THEN 'present' ELSE 'absent' END,
    coalesce(pg_get_functiondef(to_regprocedure('stock._res2_request(uuid,text,uuid,jsonb)')) ILIKE '%digest(%'
      AND pg_get_functiondef(to_regprocedure('stock._res2_request(uuid,text,uuid,jsonb)')) ILIKE '%payload_hash%'
      AND pg_get_functiondef(to_regprocedure('stock._res2_request(uuid,text,uuid,jsonb)')) ILIKE '%RESERVATION_REQUEST_PAYLOAD_MISMATCH%',false),true
  UNION ALL SELECT 'C_RES2_CONTRACT','request lock serialization','advisory xact lock',
    CASE WHEN pg_get_functiondef(to_regprocedure('stock._res2_lock_request(uuid)')) ILIKE '%pg_advisory_xact_lock%' THEN 'present' ELSE 'absent' END,
    coalesce(pg_get_functiondef(to_regprocedure('stock._res2_lock_request(uuid)')) ILIKE '%pg_advisory_xact_lock%',false),true
  UNION ALL SELECT 'C_RES2_CONTRACT','request lock isolation','read committed required',
    CASE WHEN pg_get_functiondef(to_regprocedure('stock._res2_lock_request(uuid)')) ILIKE '%transaction_isolation%'
           AND pg_get_functiondef(to_regprocedure('stock._res2_lock_request(uuid)')) ILIKE '%read committed%'
      THEN 'present' ELSE 'absent' END,
    coalesce(pg_get_functiondef(to_regprocedure('stock._res2_lock_request(uuid)')) ILIKE '%transaction_isolation%'
      AND pg_get_functiondef(to_regprocedure('stock._res2_lock_request(uuid)')) ILIKE '%read committed%',false),true
  UNION ALL SELECT 'C_RES2_CONTRACT','business locks ordered','resource_type/resource_id/location_id',
    CASE WHEN regexp_replace(lower(pg_get_functiondef(to_regprocedure('stock._res2_lock_resources(jsonb)'))),'\s+','','g') LIKE '%orderbyk.resource_type,k.resource_id,k.location_id%' THEN 'present' ELSE 'absent' END,
    coalesce(regexp_replace(lower(pg_get_functiondef(to_regprocedure('stock._res2_lock_resources(jsonb)'))),'\s+','','g') LIKE '%orderbyk.resource_type,k.resource_id,k.location_id%',false),true
  UNION ALL SELECT 'C_RES2_CONTRACT','business lock table row lock','insert plus FOR UPDATE',
    CASE WHEN pg_get_functiondef(to_regprocedure('stock._res2_lock_resources(jsonb)')) ILIKE '%stock_reservation_locks%'
           AND pg_get_functiondef(to_regprocedure('stock._res2_lock_resources(jsonb)')) ILIKE '%for update%'
      THEN 'present' ELSE 'absent' END,
    coalesce(pg_get_functiondef(to_regprocedure('stock._res2_lock_resources(jsonb)')) ILIKE '%stock_reservation_locks%'
      AND pg_get_functiondef(to_regprocedure('stock._res2_lock_resources(jsonb)')) ILIKE '%for update%',false),true
  UNION ALL SELECT 'C_RES2_CONTRACT',r.signature||' locks request before business mutation','lock_request call before first DML',
    CASE WHEN position('stock._res2_lock_request' in lower(pg_get_functiondef(to_regprocedure(r.signature))))>0
           AND position('stock._res2_lock_request' in lower(pg_get_functiondef(to_regprocedure(r.signature))))
               < least(nullif(position('insert into' in lower(pg_get_functiondef(to_regprocedure(r.signature)))),0),
                       nullif(position('update stock.' in lower(pg_get_functiondef(to_regprocedure(r.signature)))),0))
      THEN 'present' ELSE 'absent' END,
    coalesce(position('stock._res2_lock_request' in lower(pg_get_functiondef(to_regprocedure(r.signature))))>0
      AND position('stock._res2_lock_request' in lower(pg_get_functiondef(to_regprocedure(r.signature))))
          < least(nullif(position('insert into' in lower(pg_get_functiondef(to_regprocedure(r.signature)))),0),
                  nullif(position('update stock.' in lower(pg_get_functiondef(to_regprocedure(r.signature)))),0)),false),true
    FROM (VALUES
      ('stock.reserve_resource(uuid,text,uuid,numeric,uuid,bigint,uuid,uuid)'),
      ('stock.change_reservation_target(uuid,uuid,numeric,bigint,uuid)'),
      ('stock.release_reservation(uuid,uuid,numeric,uuid)')) r(signature)
  UNION ALL SELECT 'C_RES2_CONTRACT','availability physical source','stock_location_view',
    CASE WHEN pg_get_functiondef(to_regprocedure('stock._res2_available(uuid,uuid,uuid,uuid)')) ILIKE '%stock.stock_location_view%' THEN 'present' ELSE 'absent' END,
    coalesce(pg_get_functiondef(to_regprocedure('stock._res2_available(uuid,uuid,uuid,uuid)')) ILIKE '%stock.stock_location_view%',false),true
  UNION ALL SELECT 'C_RES2_CONTRACT','availability subtracts protected active/in_transit once','segments with active/in_transit',
    CASE WHEN pg_get_functiondef(to_regprocedure('stock._res2_available(uuid,uuid,uuid,uuid)')) ILIKE '%protected_quantity%'
           AND pg_get_functiondef(to_regprocedure('stock._res2_available(uuid,uuid,uuid,uuid)')) ILIKE '%active%'
           AND pg_get_functiondef(to_regprocedure('stock._res2_available(uuid,uuid,uuid,uuid)')) ILIKE '%in_transit%'
      THEN 'present' ELSE 'absent' END,
    coalesce(pg_get_functiondef(to_regprocedure('stock._res2_available(uuid,uuid,uuid,uuid)')) ILIKE '%protected_quantity%'
      AND pg_get_functiondef(to_regprocedure('stock._res2_available(uuid,uuid,uuid,uuid)')) ILIKE '%active%'
      AND pg_get_functiondef(to_regprocedure('stock._res2_available(uuid,uuid,uuid,uuid)')) ILIKE '%in_transit%',false),true

  UNION ALL SELECT 'D_RES2_SECURITY','public RPC owner '||r.signature,'postgres',coalesce(pg_get_userbyid(p.proowner),'absent'),coalesce(pg_get_userbyid(p.proowner)='postgres',false),true
    FROM res2_public r LEFT JOIN pg_proc p ON p.oid=to_regprocedure(r.signature)
  UNION ALL SELECT 'D_RES2_SECURITY','public RPC SECURITY DEFINER '||r.signature,'true',coalesce(p.prosecdef::text,'absent'),coalesce(p.prosecdef,false),true
    FROM res2_public r LEFT JOIN pg_proc p ON p.oid=to_regprocedure(r.signature)
  UNION ALL SELECT 'D_RES2_SECURITY','public RPC search_path '||r.signature,'pg_catalog,stock,auth',
    coalesce((SELECT replace(split_part(cfg,'=',2),' ','') FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%'),'absent'),
    coalesce((SELECT replace(split_part(cfg,'=',2),' ','')='pg_catalog,stock,auth' FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%'),false),true
    FROM res2_public r LEFT JOIN pg_proc p ON p.oid=to_regprocedure(r.signature)
  UNION ALL SELECT 'D_RES2_SECURITY','authenticated EXECUTE '||r.signature,'yes',
    CASE WHEN to_regprocedure(r.signature) IS NOT NULL AND has_function_privilege('authenticated',r.signature,'EXECUTE') THEN 'yes' ELSE 'no' END,
    to_regprocedure(r.signature) IS NOT NULL AND has_function_privilege('authenticated',r.signature,'EXECUTE'),true FROM res2_public r
  UNION ALL SELECT 'D_RES2_SECURITY','anon EXECUTE '||r.signature,'no',
    CASE WHEN to_regprocedure(r.signature) IS NOT NULL AND has_function_privilege('anon',r.signature,'EXECUTE') THEN 'yes' ELSE 'no' END,
    to_regprocedure(r.signature) IS NOT NULL AND NOT has_function_privilege('anon',r.signature,'EXECUTE'),true FROM res2_public r
  UNION ALL SELECT 'D_RES2_SECURITY','PUBLIC EXECUTE '||r.signature,'no',
    CASE WHEN EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.oid=to_regprocedure(r.signature) AND a.grantee=0 AND a.privilege_type='EXECUTE') THEN 'yes' ELSE 'no' END,
    to_regprocedure(r.signature) IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.oid=to_regprocedure(r.signature) AND a.grantee=0 AND a.privilege_type='EXECUTE'),true FROM res2_public r
  UNION ALL SELECT 'D_RES2_SECURITY','helper ACL '||h.signature,'no PUBLIC/anon/authenticated EXECUTE',
    concat_ws(',',
      CASE WHEN EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.oid=to_regprocedure(h.signature) AND a.grantee=0 AND a.privilege_type='EXECUTE') THEN 'PUBLIC' END,
      CASE WHEN to_regprocedure(h.signature) IS NOT NULL AND has_function_privilege('anon',h.signature,'EXECUTE') THEN 'anon' END,
      CASE WHEN to_regprocedure(h.signature) IS NOT NULL AND has_function_privilege('authenticated',h.signature,'EXECUTE') THEN 'authenticated' END),
    to_regprocedure(h.signature) IS NOT NULL
      AND NOT has_function_privilege('anon',h.signature,'EXECUTE')
      AND NOT has_function_privilege('authenticated',h.signature,'EXECUTE')
      AND NOT EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.oid=to_regprocedure(h.signature) AND a.grantee=0 AND a.privilege_type='EXECUTE'),true
    FROM res2_helpers h
  UNION ALL SELECT 'D_RES2_SECURITY','helper owner '||h.signature,'postgres',
    coalesce(pg_get_userbyid(p.proowner),'absent'),coalesce(pg_get_userbyid(p.proowner)='postgres',false),true
    FROM res2_helpers h LEFT JOIN pg_proc p ON p.oid=to_regprocedure(h.signature)
  UNION ALL SELECT 'D_RES2_SECURITY','helper SECURITY INVOKER '||h.signature,'true',
    CASE WHEN p.oid IS NULL THEN 'absent' WHEN p.prosecdef THEN 'false' ELSE 'true' END,
    p.oid IS NOT NULL AND NOT p.prosecdef,true
    FROM res2_helpers h LEFT JOIN pg_proc p ON p.oid=to_regprocedure(h.signature)
  UNION ALL SELECT 'D_RES2_SECURITY','helper search_path '||h.signature,h.expected_search_path,
    coalesce((SELECT replace(split_part(cfg,'=',2),' ','') FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%'),'absent'),
    coalesce((SELECT replace(split_part(cfg,'=',2),' ','')=h.expected_search_path FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%'),false),true
    FROM res2_helpers h LEFT JOIN pg_proc p ON p.oid=to_regprocedure(h.signature)

  UNION ALL SELECT 'E_RES1_NON_REGRESSION','table '||t.name,'present',coalesce(to_regclass('stock.'||t.name)::text,'absent'),to_regclass('stock.'||t.name) IS NOT NULL,true FROM res1_tables t
  UNION ALL SELECT 'E_RES1_NON_REGRESSION','RLS/FORCE RLS '||t.name,'on/on',coalesce(c.relrowsecurity::text,'absent')||'/'||coalesce(c.relforcerowsecurity::text,'absent'),coalesce(c.relrowsecurity,false) AND coalesce(c.relforcerowsecurity,false),true
    FROM res1_tables t LEFT JOIN pg_class c ON c.relname=t.name AND c.relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='stock')
  UNION ALL SELECT 'E_RES1_NON_REGRESSION','policy count','0',count(*)::text,count(*)=0,true FROM pg_policies WHERE schemaname='stock' AND tablename IN (SELECT name FROM res1_tables)
  UNION ALL SELECT 'E_RES1_NON_REGRESSION','no direct DML '||r.rolname||' on '||t.name,'none',
    CASE WHEN r.rolname='PUBLIC' THEN CASE WHEN EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE n.nspname='stock' AND c.relname=t.name AND a.grantee=0 AND a.privilege_type IN ('SELECT','INSERT','UPDATE','DELETE')) THEN 'present' ELSE 'none' END
      ELSE concat_ws(',',CASE WHEN has_table_privilege(r.rolname,'stock.'||t.name,'SELECT') THEN 'SELECT' END,CASE WHEN has_table_privilege(r.rolname,'stock.'||t.name,'INSERT') THEN 'INSERT' END,CASE WHEN has_table_privilege(r.rolname,'stock.'||t.name,'UPDATE') THEN 'UPDATE' END,CASE WHEN has_table_privilege(r.rolname,'stock.'||t.name,'DELETE') THEN 'DELETE' END) END,
    CASE WHEN r.rolname='PUBLIC' THEN NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE n.nspname='stock' AND c.relname=t.name AND a.grantee=0 AND a.privilege_type IN ('SELECT','INSERT','UPDATE','DELETE'))
      ELSE NOT has_table_privilege(r.rolname,'stock.'||t.name,'SELECT,INSERT,UPDATE,DELETE') END,true
    FROM (VALUES('PUBLIC'),('anon'),('authenticated')) r(rolname) CROSS JOIN res1_tables t
  UNION ALL SELECT 'E_RES1_NON_REGRESSION','trigger '||e.name,'present',CASE WHEN EXISTS(SELECT 1 FROM pg_trigger tr WHERE tr.tgrelid=to_regclass('stock.'||e.table_name) AND tr.tgname=e.name AND NOT tr.tgisinternal) THEN 'present' ELSE 'absent' END,EXISTS(SELECT 1 FROM pg_trigger tr WHERE tr.tgrelid=to_regclass('stock.'||e.table_name) AND tr.tgname=e.name AND NOT tr.tgisinternal),true FROM res1_triggers e
  UNION ALL SELECT 'E_RES1_NON_REGRESSION','exact append-only trigger count','2',count(*)::text,count(*)=2,true FROM pg_trigger tr JOIN pg_class c ON c.oid=tr.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='stock' AND c.relname IN (SELECT name FROM res1_tables) AND NOT tr.tgisinternal
  UNION ALL SELECT 'E_RES1_NON_REGRESSION','constraint '||e.name,'present',CASE WHEN EXISTS(SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='stock' AND c.conname=e.name) THEN 'present' ELSE 'absent' END,EXISTS(SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='stock' AND c.conname=e.name),true FROM res1_constraints e
  UNION ALL SELECT 'E_RES1_NON_REGRESSION','index '||e.name,'present',coalesce(to_regclass('stock.'||e.name)::text,'absent'),to_regclass('stock.'||e.name) IS NOT NULL,true FROM res1_indexes e

  UNION ALL SELECT 'F_DEPENDENCIES','stock_location_view','present',coalesce(to_regclass('stock.stock_location_view')::text,'absent'),to_regclass('stock.stock_location_view') IS NOT NULL,true
  UNION ALL SELECT 'F_DEPENDENCIES','can_access_stock_location(uuid,boolean)','present',coalesce(to_regprocedure('stock.can_access_stock_location(uuid,boolean)')::text,'absent'),to_regprocedure('stock.can_access_stock_location(uuid,boolean)') IS NOT NULL,true
  UNION ALL SELECT 'F_DEPENDENCIES','article_location_allowed(uuid,uuid)','present',coalesce(to_regprocedure('stock.article_location_allowed(uuid,uuid)')::text,'absent'),to_regprocedure('stock.article_location_allowed(uuid,uuid)') IS NOT NULL,true
  UNION ALL SELECT 'F_DEPENDENCIES','pgcrypto','present',coalesce(e.extname,'absent'),e.oid IS NOT NULL,true FROM (VALUES(1)) q(x) LEFT JOIN pg_extension e ON e.extname='pgcrypto'
  UNION ALL SELECT 'F_DEPENDENCIES','digest(bytea,text) extension member','present',count(*)::text,count(*)=1,true
    FROM pg_extension e JOIN pg_depend d ON d.refclassid='pg_extension'::regclass AND d.refobjid=e.oid AND d.deptype='e' JOIN pg_proc p ON d.classid='pg_proc'::regclass AND d.objid=p.oid WHERE e.extname='pgcrypto' AND p.proname='digest' AND pg_get_function_identity_arguments(p.oid)='bytea, text'

  UNION ALL SELECT 'G_RESOURCE_TYPE','reserve_resource article-only guard','present',CASE WHEN pg_get_functiondef(to_regprocedure('stock.reserve_resource(uuid,text,uuid,numeric,uuid,bigint,uuid,uuid)')) ILIKE '%p_resource_type is distinct from ''article''%' THEN 'present' ELSE 'absent' END,pg_get_functiondef(to_regprocedure('stock.reserve_resource(uuid,text,uuid,numeric,uuid,bigint,uuid,uuid)')) ILIKE '%p_resource_type is distinct from ''article''%',true
  UNION ALL SELECT 'G_RESOURCE_TYPE','lock_resources article-only guard','present',CASE WHEN pg_get_functiondef(to_regprocedure('stock._res2_lock_resources(jsonb)')) ILIKE '%resource_type is distinct from ''article''%' THEN 'present' ELSE 'absent' END,pg_get_functiondef(to_regprocedure('stock._res2_lock_resources(jsonb)')) ILIKE '%resource_type is distinct from ''article''%',true
  UNION ALL SELECT 'G_RESOURCE_TYPE','state recipe rejection','present',CASE WHEN pg_get_functiondef(to_regprocedure('stock.get_reservation_state(uuid)')) ILIKE '%resource_type%<>%''article''%' THEN 'present' ELSE 'absent' END,pg_get_functiondef(to_regprocedure('stock.get_reservation_state(uuid)')) ILIKE '%resource_type%<>%''article''%',true
  UNION ALL SELECT 'G_RESOURCE_TYPE','no recipe reservation RPC','0',count(*)::text,count(*)=0,true FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='stock' AND p.proname ILIKE '%reserv%' AND p.proname ILIKE '%recipe%'
  UNION ALL SELECT 'G_RESOURCE_TYPE','no obvious recipe physical stock source','0',count(*)::text,count(*)=0,true FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='stock' AND c.relkind IN ('r','p','v','m') AND c.relname ~* '(recipe|recette).*(stock|inventory|movement)|(stock|inventory|movement).*(recipe|recette)'

  UNION ALL SELECT 'H_OP1','table '||o.name,'present',coalesce(to_regclass('stock.'||o.name)::text,'absent'),to_regclass('stock.'||o.name) IS NOT NULL,true FROM op1_tables o
  UNION ALL SELECT 'H_OP1','RLS/FORCE RLS on all OP-1 tables','6',count(*)::text,count(*)=6,true
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='stock' AND c.relname IN (SELECT name FROM op1_tables) AND c.relrowsecurity AND c.relforcerowsecurity
  UNION ALL SELECT 'H_OP1','no direct DML PUBLIC/anon/authenticated','none',
    coalesce(string_agg(coalesce(r.rolname,'PUBLIC')||':'||c.relname||':'||a.privilege_type,',' ORDER BY c.relname,a.privilege_type),'none'),count(*)=0,true
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
    LEFT JOIN pg_roles r ON r.oid=a.grantee
    WHERE n.nspname='stock' AND c.relname IN (SELECT name FROM op1_tables)
      AND (a.grantee=0 OR r.rolname IN ('anon','authenticated'))
      AND a.privilege_type IN ('INSERT','UPDATE','DELETE')
  UNION ALL SELECT 'H_OP1','constraint '||e.name,'present',
    CASE WHEN EXISTS(SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='stock' AND c.conname=e.name) THEN 'present' ELSE 'absent' END,
    EXISTS(SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='stock' AND c.conname=e.name),true
    FROM op1_constraints e
  UNION ALL SELECT 'H_OP1','trigger '||e.name,'present',
    CASE WHEN EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='stock' AND t.tgname=e.name AND NOT t.tgisinternal) THEN 'present' ELSE 'absent' END,
    EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='stock' AND t.tgname=e.name AND NOT t.tgisinternal),true
    FROM op1_triggers e

  UNION ALL SELECT 'I_STORAGE','Storage migration occurrence','1',count(*)::text,count(*)=1,true FROM supabase_migrations.schema_migrations WHERE version='202609300001'
  UNION ALL SELECT 'I_STORAGE','bucket '||b.name,'present',CASE WHEN EXISTS(SELECT 1 FROM storage.buckets x WHERE x.id=b.name) THEN 'present' ELSE 'absent' END,EXISTS(SELECT 1 FROM storage.buckets x WHERE x.id=b.name),true FROM storage_buckets b
  UNION ALL SELECT 'I_STORAGE','policy '||e.name,'present',CASE WHEN EXISTS(SELECT 1 FROM pg_policies p WHERE p.schemaname='storage' AND p.tablename='objects' AND p.policyname=e.name) THEN 'present' ELSE 'absent' END,EXISTS(SELECT 1 FROM pg_policies p WHERE p.schemaname='storage' AND p.tablename='objects' AND p.policyname=e.name),true FROM storage_policies e

  UNION ALL SELECT 'J_ACTIVATION','no OP trigger invokes RES-2','0',count(*)::text,count(*)=0,true
    FROM pg_trigger tr JOIN pg_class c ON c.oid=tr.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_proc p ON p.oid=tr.tgfoid WHERE n.nspname='stock' AND c.relname LIKE 'production_order%' AND NOT tr.tgisinternal AND (p.prosrc ILIKE '%reserve_resource%' OR p.prosrc ILIKE '%change_reservation_target%' OR p.prosrc ILIKE '%release_reservation%')
  UNION ALL SELECT 'J_ACTIVATION','no OP automatic RPC','0',count(*)::text,count(*)=0,true
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='stock' AND p.proname NOT LIKE '\_res2\_%' ESCAPE '\' AND p.proname NOT IN ('reserve_resource','change_reservation_target','release_reservation','get_reservation_state') AND p.prosrc ILIKE '%production_order%' AND (p.prosrc ILIKE '%reserve_resource%' OR p.prosrc ILIKE '%stock_reservation%')
  UNION ALL SELECT 'J_ACTIVATION','no VENTES hook','0',count(*)::text,count(*)=0,true
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='stock' AND (p.proname ILIKE '%sale%' OR p.proname ILIKE '%stock_out%') AND (p.prosrc ILIKE '%reserve_resource%' OR p.prosrc ILIKE '%_res2_%')
  UNION ALL SELECT 'J_ACTIVATION','no transfer hook','0',count(*)::text,count(*)=0,true
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='stock' AND p.proname ILIKE '%transfer%' AND (p.prosrc ILIKE '%reserve_resource%' OR p.prosrc ILIKE '%_res2_%')
  UNION ALL SELECT 'J_ACTIVATION','INT-1 relations absent','0',count(*)::text,count(*)=0,true
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='stock' AND c.relname IN (
      'op_reservation_integration_control','op_reservation_operations','op_reservation_bindings',
      'op_reservation_operation_items','op_reservation_allocations')
  UNION ALL SELECT 'J_ACTIVATION','INT-1 functions absent','0',count(*)::text,count(*)=0,true
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='stock' AND (p.proname LIKE '\_int1\_%' ESCAPE '\' OR p.proname IN (
      'prevent_op_reservation_append_mutation','ensure_op_reservation_integration_consistency','apply_op_reservation_operation'))
  UNION ALL SELECT 'J_ACTIVATION','INT-1 triggers absent','0',count(*)::text,count(*)=0,true
    FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='stock' AND NOT t.tgisinternal AND t.tgname LIKE 'op_reservation%'
)
SELECT
  jsonb_agg(jsonb_build_object(
    'family',family,'control',control,'expected',expected,'actual',actual,
    'passed',coalesce(passed,false),'blocking',blocking
  ) ORDER BY family,control)::text AS checks_json,
  count(*)::integer AS total_controls,
  count(*) FILTER (WHERE blocking)::integer AS mandatory_controls,
  count(*) FILTER (WHERE NOT blocking)::integer AS info_controls,
  count(*) FILTER (WHERE passed IS TRUE)::integer AS pass_count,
  count(*) FILTER (WHERE passed IS NOT TRUE)::integer AS fail_count,
  count(*) FILTER (WHERE blocking AND passed IS NOT TRUE)::integer AS mandatory_fail_count,
  (count(*) FILTER (WHERE blocking AND passed IS NOT TRUE)=0)::text AS mandatory_ok,
  (SELECT count(*)::integer FROM supabase_migrations.schema_migrations WHERE version='202610010001') AS history_count
FROM checks
\gset res2_

-- Detailed result table. The JSON variable is client-side only; no temporary table is created.
SELECT
  x.family,
  x.control,
  CASE WHEN x.blocking THEN 'MANDATORY' ELSE 'INFO' END AS control_kind,
  x.expected,
  x.actual,
  CASE WHEN x.passed THEN 'PASS' ELSE 'FAIL' END AS result
FROM jsonb_to_recordset(:'res2_checks_json'::jsonb)
  AS x(family text,control text,expected text,actual text,passed boolean,blocking boolean)
ORDER BY x.family,x.control;

SELECT
  :'res2_total_controls'::integer AS total_controls,
  :'res2_mandatory_controls'::integer AS mandatory_controls,
  :'res2_info_controls'::integer AS info_controls,
  :'res2_pass_count'::integer AS pass,
  :'res2_fail_count'::integer AS fail,
  :'res2_mandatory_fail_count'::integer AS mandatory_fail;

SELECT
  CASE
    WHEN :'res2_mandatory_fail_count'::integer>0 THEN 'RES-2 POSTDEPLOY CHECKS FAILED'
    WHEN :'res2_history_count'::integer=0 THEN 'RES-2 POSTDEPLOY OBJECTS PASSED — HISTORY NOT YET SYNCHRONIZED'
    WHEN :'res2_history_count'::integer=1 THEN 'RES-2 POSTDEPLOY OBJECTS PASSED — HISTORY SYNCHRONIZED'
    ELSE 'RES-2 POSTDEPLOY CHECKS FAILED'
  END AS verdict,
  CASE
    WHEN NOT EXISTS(
      SELECT 1 FROM jsonb_to_recordset(:'res2_checks_json'::jsonb)
        AS x(family text,control text,expected text,actual text,passed boolean,blocking boolean)
      WHERE x.family='J_ACTIVATION' AND x.passed IS NOT TRUE
    ) THEN 'INTEGRATION NOT ACTIVATED'
    ELSE 'INTEGRATION DETECTED'
  END AS integration_status;

ROLLBACK;

-- The deliberate error is outside the rolled-back read-only transaction. It only
-- makes psql return a non-zero code when a mandatory catalog check failed.
\if :res2_mandatory_ok
  \echo 'RES-2 POSTDEPLOY REQUIRED CHECKS PASSED'
\else
  \echo 'RES-2 POSTDEPLOY REQUIRED CHECKS FAILED'
  SELECT 1/0 AS res2_postdeploy_required_check_failed;
\endif
