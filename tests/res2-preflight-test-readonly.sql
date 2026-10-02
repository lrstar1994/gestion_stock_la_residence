\set ON_ERROR_STOP on
\pset pager off
\pset null '(NULL)'

BEGIN;
SET TRANSACTION READ ONLY;

-- RES-2 preflight for the externally selected TEST project:
-- mcvchrqgubccgddcalpk. The Supabase pooler exposes current_user=postgres,
-- therefore the project ref must be guaranteed by the psql connection string.
SELECT
  'mcvchrqgubccgddcalpk'::text AS expected_project_ref,
  current_database() AS database_name,
  current_user AS current_user_name,
  session_user AS session_user_name,
  current_setting('server_version') AS server_version,
  current_setting('transaction_read_only') AS transaction_read_only;

-- Detailed catalog evidence. No business function is invoked.
SELECT version, name, array_length(statements, 1) AS statement_count
FROM supabase_migrations.schema_migrations
WHERE version IN ('202609290001', '202609290002', '202609300001', '202610010001')
   OR lower(coalesce(name, '')) LIKE '%stock_reservation_operations%'
ORDER BY version;

SELECT
  c.oid::regclass AS relation,
  pg_get_userbyid(c.relowner) AS owner,
  c.relrowsecurity,
  c.relforcerowsecurity,
  c.relacl
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'stock'
  AND c.relname IN (
    'stock_reservation_locks', 'stock_reservation_requests',
    'stock_reservations', 'stock_reservation_segments',
    'stock_reservation_contribution_allocations', 'stock_reservation_events'
  )
ORDER BY c.relname;

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'stock'
  AND tablename IN (
    'stock_reservation_locks', 'stock_reservation_requests',
    'stock_reservations', 'stock_reservation_segments',
    'stock_reservation_contribution_allocations', 'stock_reservation_events'
  )
ORDER BY tablename, policyname;

SELECT
  p.oid::regprocedure AS signature,
  pg_get_userbyid(p.proowner) AS owner,
  p.prosecdef AS security_definer,
  p.proacl
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'stock'
  AND (
    p.proname LIKE '\_res2\_%' ESCAPE '\'
    OR p.proname IN (
      'reserve_resource', 'change_reservation_target',
      'release_reservation', 'get_reservation_state'
    )
  )
ORDER BY p.proname, p.oid;

SELECT
  p.oid::regprocedure AS signature,
  pg_get_userbyid(p.proowner) AS owner,
  p.prosecdef AS security_definer,
  p.proacl,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
WHERE p.oid IN (
  to_regprocedure('stock.can_access_stock_location(uuid,boolean)'),
  to_regprocedure('stock.article_location_allowed(uuid,uuid)')
)
ORDER BY p.oid::regprocedure::text;

SELECT
  c.oid::regclass AS view_name,
  pg_get_viewdef(c.oid, true) AS definition
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'stock' AND c.relname = 'stock_location_view';

SELECT
  n.nspname AS schema_name,
  c.relname AS possible_recipe_physical_source,
  c.relkind
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'stock'
  AND c.relkind IN ('r', 'p', 'v', 'm')
  AND c.relname ~* '(recipe|recette).*(stock|inventory|movement)|(stock|inventory|movement).*(recipe|recette)'
ORDER BY c.relname;

WITH
res1_tables(name) AS (
  VALUES
    ('stock_reservation_locks'), ('stock_reservation_requests'),
    ('stock_reservations'), ('stock_reservation_segments'),
    ('stock_reservation_contribution_allocations'), ('stock_reservation_events')
),
expected_res1_columns(table_name, column_name) AS (
  VALUES
    ('stock_reservation_locks','resource_type'),('stock_reservation_locks','resource_id'),
    ('stock_reservation_locks','location_id'),('stock_reservation_locks','created_at'),
    ('stock_reservation_requests','request_id'),('stock_reservation_requests','operation'),
    ('stock_reservation_requests','payload_hash'),('stock_reservation_requests','actor_profile_id'),
    ('stock_reservation_requests','result'),('stock_reservation_requests','created_at'),
    ('stock_reservations','id'),('stock_reservations','op_id'),('stock_reservations','revision_id'),
    ('stock_reservations','resource_type'),('stock_reservations','resource_id'),
    ('stock_reservations','unit_id'),('stock_reservations','target_quantity'),
    ('stock_reservations','reserved_quantity'),('stock_reservations','delivered_quantity'),
    ('stock_reservations','released_quantity'),('stock_reservations','transferred_quantity'),
    ('stock_reservations','shortage_quantity'),('stock_reservations','excess_quantity'),
    ('stock_reservations','status'),('stock_reservations','created_at'),('stock_reservations','updated_at'),
    ('stock_reservation_segments','id'),('stock_reservation_segments','reservation_id'),
    ('stock_reservation_segments','location_id'),('stock_reservation_segments','protected_quantity'),
    ('stock_reservation_segments','status'),('stock_reservation_segments','source_movement_id'),
    ('stock_reservation_segments','destination_movement_id'),('stock_reservation_segments','created_at'),
    ('stock_reservation_segments','updated_at'),
    ('stock_reservation_contribution_allocations','id'),
    ('stock_reservation_contribution_allocations','reservation_id'),
    ('stock_reservation_contribution_allocations','contribution_id'),
    ('stock_reservation_contribution_allocations','contribution_snapshot_id'),
    ('stock_reservation_contribution_allocations','calculation_run_id'),
    ('stock_reservation_contribution_allocations','revision_id'),
    ('stock_reservation_contribution_allocations','allocated_quantity'),
    ('stock_reservation_contribution_allocations','status'),
    ('stock_reservation_contribution_allocations','created_at'),
    ('stock_reservation_contribution_allocations','updated_at'),
    ('stock_reservation_events','id'),('stock_reservation_events','reservation_id'),
    ('stock_reservation_events','request_id'),('stock_reservation_events','operation'),
    ('stock_reservation_events','event_type'),('stock_reservation_events','op_id'),
    ('stock_reservation_events','revision_id'),('stock_reservation_events','change_sequence'),
    ('stock_reservation_events','actor_profile_id'),('stock_reservation_events','reason'),
    ('stock_reservation_events','target_quantity_before'),
    ('stock_reservation_events','target_quantity_after'),
    ('stock_reservation_events','reserved_quantity_delta'),
    ('stock_reservation_events','delivered_quantity_delta'),
    ('stock_reservation_events','released_quantity_delta'),
    ('stock_reservation_events','transferred_quantity_delta'),
    ('stock_reservation_events','metadata'),('stock_reservation_events','created_at')
),
expected_constraints(name) AS (
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
    ('stock_reservation_requests_pkey'),('stock_reservations_pkey'),
    ('stock_reservation_segments_pkey'),('stock_reservation_contribution_allocations_pkey'),
    ('stock_reservation_events_pkey'),('stock_reservation_locks_location_id_fkey'),
    ('stock_reservation_requests_actor_profile_id_fkey'),('stock_reservations_unit_id_fkey'),
    ('stock_reservation_segments_reservation_id_fkey'),('stock_reservation_segments_location_id_fkey'),
    ('stock_reservation_contribution_allocations_reservation_id_fkey'),
    ('stock_reservation_events_reservation_id_fkey'),
    ('stock_reservation_events_actor_profile_id_fkey')
),
expected_indexes(name) AS (
  VALUES
    ('stock_reservations_resource_idx'),('stock_reservations_op_revision_idx'),
    ('stock_reservation_segments_reservation_idx'),('stock_reservation_segments_location_idx'),
    ('stock_reservation_allocations_reservation_idx'),('stock_reservation_allocations_snapshot_idx'),
    ('stock_reservation_allocations_current_contribution_unique'),
    ('stock_reservation_events_reservation_idx'),('stock_reservation_events_request_idx')
),
expected_triggers(table_name, name) AS (
  VALUES
    ('stock_reservation_requests','stock_reservation_requests_append_only_trg'),
    ('stock_reservation_events','stock_reservation_events_append_only_trg')
),
expected_dependencies(object_name, expected_kind) AS (
  VALUES
    ('stock.profiles','table'),('stock.locations','table'),('stock.units','table'),
    ('stock.articles','table'),('stock.stock_location_view','view'),
    ('stock.can_access_stock_location(uuid,boolean)','function'),
    ('stock.article_location_allowed(uuid,uuid)','function')
),
expected_op_tables(name) AS (
  VALUES
    ('production_order_number_counters'),('production_orders'),('production_order_lines'),
    ('production_order_revisions'),('production_order_revision_lines'),
    ('production_order_revision_changes')
),
expected_storage_buckets(name) AS (
  VALUES ('purchase-order-files'),('reception-anomalies'),('reception-documents'),('invoice-files')
),
expected_storage_policies(name) AS (
  VALUES
    ('Purchase order files are readable'),('Purchase order staff can upload files'),
    ('Reception anomaly photos are readable'),('Reception staff can upload anomaly photos'),
    ('Reception documents are readable'),('Reception staff can upload documents'),
    ('Users can view invoice files'),('Accounting can upload invoice files')
),
res2_functions(signature) AS (
  VALUES
    ('stock._res2_fail(text)'),('stock._res2_actor(boolean)'),
    ('stock._res2_quantity(numeric)'),('stock._res2_lock_request(uuid)'),
    ('stock._res2_check_locations(jsonb,boolean)'),
    ('stock._res2_request(uuid,text,uuid,jsonb)'),('stock._res2_lock_resources(jsonb)'),
    ('stock._res2_article_location(uuid,uuid)'),('stock._res2_lock_reservation(uuid,uuid)'),
    ('stock._res2_available(uuid,uuid,uuid,uuid)'),('stock._res2_state(uuid)'),
    ('stock.reserve_resource(uuid,text,uuid,numeric,uuid,bigint,uuid,uuid)'),
    ('stock.change_reservation_target(uuid,uuid,numeric,bigint,uuid)'),
    ('stock.release_reservation(uuid,uuid,numeric,uuid)'),
    ('stock.get_reservation_state(uuid)')
),
checks(family, control, expected, actual, passed) AS (
  SELECT 'A_IDENTITY','database','postgres',current_database(),current_database()='postgres'
  UNION ALL SELECT 'A_IDENTITY','transaction_read_only','on',current_setting('transaction_read_only'),current_setting('transaction_read_only')='on'
  UNION ALL SELECT 'A_IDENTITY','server_version','PostgreSQL 17.x',current_setting('server_version'),current_setting('server_version_num')::integer BETWEEN 170000 AND 179999
  UNION ALL SELECT 'A_IDENTITY','pooler_session_identity','postgres or project-qualified login',current_user||' / '||session_user,current_user IN ('postgres','postgres.mcvchrqgubccgddcalpk') AND session_user IN ('postgres','postgres.mcvchrqgubccgddcalpk')

  UNION ALL SELECT 'B_HISTORY','202609290001 occurrence','1',count(*)::text,count(*)=1 FROM supabase_migrations.schema_migrations WHERE version='202609290001'
  UNION ALL SELECT 'B_HISTORY','202609290002 occurrence','1',count(*)::text,count(*)=1 FROM supabase_migrations.schema_migrations WHERE version='202609290002'
  UNION ALL SELECT 'B_HISTORY','202609300001 occurrence','1',count(*)::text,count(*)=1 FROM supabase_migrations.schema_migrations WHERE version='202609300001'
  UNION ALL SELECT 'B_HISTORY','202610010001 occurrence','0',count(*)::text,count(*)=0 FROM supabase_migrations.schema_migrations WHERE version='202610010001'
  UNION ALL SELECT 'B_HISTORY','equivalent RES-2 under another version','0',count(*)::text,count(*)=0
    FROM supabase_migrations.schema_migrations
    WHERE version<>'202610010001' AND (
      lower(coalesce(name,'')) LIKE '%stock_reservation_operations%'
      OR coalesce(array_to_string(statements,E'\n'),'') ILIKE '%create function stock.reserve_resource%'
    )

  UNION ALL SELECT 'C_RES1_TABLES','table '||name,'present',coalesce(to_regclass('stock.'||name)::text,'absent'),to_regclass('stock.'||name) IS NOT NULL FROM res1_tables
  UNION ALL SELECT 'C_RES1_COLUMNS','column '||table_name||'.'||column_name,'present',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns c WHERE c.table_schema='stock' AND c.table_name=e.table_name AND c.column_name=e.column_name) THEN 'present' ELSE 'absent' END,
    EXISTS(SELECT 1 FROM information_schema.columns c WHERE c.table_schema='stock' AND c.table_name=e.table_name AND c.column_name=e.column_name)
    FROM expected_res1_columns e
  UNION ALL SELECT 'C_RES1_COLUMNS','last_target_change_sequence','absent',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='stock' AND table_name='stock_reservations' AND column_name='last_target_change_sequence') THEN 'present' ELSE 'absent' END,
    NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='stock' AND table_name='stock_reservations' AND column_name='last_target_change_sequence')
  UNION ALL SELECT 'C_RES1_CONSTRAINTS','constraint '||name,'present',
    CASE WHEN EXISTS(SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='stock' AND c.conname=e.name) THEN 'present' ELSE 'absent' END,
    EXISTS(SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='stock' AND c.conname=e.name)
    FROM expected_constraints e
  UNION ALL SELECT 'C_RES1_CONSTRAINTS','exact constraint count','34',count(*)::text,count(*)=34
    FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname='stock' AND t.relname IN (SELECT name FROM res1_tables)
  UNION ALL SELECT 'C_RES1_INDEXES','index '||name,'present',coalesce(to_regclass('stock.'||name)::text,'absent'),to_regclass('stock.'||name) IS NOT NULL FROM expected_indexes
  UNION ALL SELECT 'C_RES1_INDEXES','exact explicit index count','9',count(*)::text,count(*)=9
    FROM pg_index i JOIN pg_class t ON t.oid=i.indrelid JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname='stock' AND t.relname IN (SELECT name FROM res1_tables)
      AND NOT EXISTS(SELECT 1 FROM pg_constraint c WHERE c.conindid=i.indexrelid)
  UNION ALL SELECT 'C_RES1_TRIGGERS','trigger '||e.name,'present',
    CASE WHEN EXISTS(SELECT 1 FROM pg_trigger tr WHERE tr.tgrelid=to_regclass('stock.'||e.table_name) AND tr.tgname=e.name AND NOT tr.tgisinternal) THEN 'present' ELSE 'absent' END,
    EXISTS(SELECT 1 FROM pg_trigger tr WHERE tr.tgrelid=to_regclass('stock.'||e.table_name) AND tr.tgname=e.name AND NOT tr.tgisinternal)
    FROM expected_triggers e
  UNION ALL SELECT 'C_RES1_TRIGGERS','exact user trigger count','2',count(*)::text,count(*)=2
    FROM pg_trigger tr JOIN pg_class t ON t.oid=tr.tgrelid JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname='stock' AND t.relname IN (SELECT name FROM res1_tables) AND NOT tr.tgisinternal
  UNION ALL SELECT 'C_RES1_RLS','RLS and FORCE RLS '||r.name,'on/on',
    coalesce(c.relrowsecurity::text,'absent')||'/'||coalesce(c.relforcerowsecurity::text,'absent'),
    coalesce(c.relrowsecurity,false) AND coalesce(c.relforcerowsecurity,false)
    FROM res1_tables r LEFT JOIN pg_class c ON c.relname=r.name AND c.relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='stock')
  UNION ALL SELECT 'C_RES1_RLS','no policies on RES-1','0',count(*)::text,count(*)=0
    FROM pg_policies WHERE schemaname='stock' AND tablename IN (SELECT name FROM res1_tables)
  UNION ALL SELECT 'C_RES1_APPEND_ONLY','append-only function','present',coalesce(to_regprocedure('stock.prevent_stock_reservation_append_mutation()')::text,'absent'),to_regprocedure('stock.prevent_stock_reservation_append_mutation()') IS NOT NULL

  UNION ALL SELECT 'D_RES2_COLLISIONS','function '||signature,'absent',coalesce(to_regprocedure(signature)::text,'absent'),to_regprocedure(signature) IS NULL FROM res2_functions

  UNION ALL SELECT 'E_DEPENDENCIES','dependency '||object_name,'present',
    CASE WHEN expected_kind='function' THEN coalesce(to_regprocedure(object_name)::text,'absent') ELSE coalesce(to_regclass(object_name)::text,'absent') END,
    CASE WHEN expected_kind='function' THEN to_regprocedure(object_name) IS NOT NULL ELSE to_regclass(object_name) IS NOT NULL END
    FROM expected_dependencies
  UNION ALL SELECT 'E_DEPENDENCIES','profiles.id type','uuid',coalesce(format_type(a.atttypid,a.atttypmod),'absent'),format_type(a.atttypid,a.atttypmod)='uuid'
    FROM (VALUES(1)) q(x) LEFT JOIN pg_attribute a ON a.attrelid=to_regclass('stock.profiles') AND a.attname='id' AND NOT a.attisdropped
  UNION ALL SELECT 'E_DEPENDENCIES','locations.id type','uuid',coalesce(format_type(a.atttypid,a.atttypmod),'absent'),format_type(a.atttypid,a.atttypmod)='uuid'
    FROM (VALUES(1)) q(x) LEFT JOIN pg_attribute a ON a.attrelid=to_regclass('stock.locations') AND a.attname='id' AND NOT a.attisdropped
  UNION ALL SELECT 'E_DEPENDENCIES','units.id type','uuid',coalesce(format_type(a.atttypid,a.atttypmod),'absent'),format_type(a.atttypid,a.atttypmod)='uuid'
    FROM (VALUES(1)) q(x) LEFT JOIN pg_attribute a ON a.attrelid=to_regclass('stock.units') AND a.attname='id' AND NOT a.attisdropped
  UNION ALL SELECT 'E_DEPENDENCIES','articles.id type','uuid',coalesce(format_type(a.atttypid,a.atttypmod),'absent'),format_type(a.atttypid,a.atttypmod)='uuid'
    FROM (VALUES(1)) q(x) LEFT JOIN pg_attribute a ON a.attrelid=to_regclass('stock.articles') AND a.attname='id' AND NOT a.attisdropped

  UNION ALL SELECT 'F_PGCRYPTO','extension pgcrypto','present',coalesce(n.nspname,'absent'),e.oid IS NOT NULL
    FROM (VALUES(1)) q(x) LEFT JOIN pg_extension e ON e.extname='pgcrypto' LEFT JOIN pg_namespace n ON n.oid=e.extnamespace
  UNION ALL SELECT 'F_PGCRYPTO','digest(bytea,text) extension member','present',count(*)::text,count(*)=1
    FROM pg_extension e JOIN pg_depend d ON d.refclassid='pg_extension'::regclass AND d.refobjid=e.oid AND d.deptype='e'
    JOIN pg_proc p ON d.classid='pg_proc'::regclass AND d.objid=p.oid
    WHERE e.extname='pgcrypto' AND pg_get_function_identity_arguments(p.oid)='bytea, text' AND p.proname='digest'

  UNION ALL SELECT 'G_SECURITY','owner/BYPASSRLS for RES-1','one owner, postgres, BYPASSRLS, not super-required',
    string_agg(DISTINCT pg_get_userbyid(c.relowner)||':bypass='||r.rolbypassrls||':super='||r.rolsuper,','),
    count(DISTINCT c.relowner)=1 AND bool_and(pg_get_userbyid(c.relowner)='postgres' AND r.rolbypassrls)
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_roles r ON r.oid=c.relowner
    WHERE n.nspname='stock' AND c.relname IN (SELECT name FROM res1_tables)
  UNION ALL SELECT 'G_SECURITY','anon/authenticated BYPASSRLS','false/false',string_agg(rolname||'='||rolbypassrls,',' ORDER BY rolname),count(*)=2 AND NOT bool_or(rolbypassrls)
    FROM pg_roles WHERE rolname IN ('anon','authenticated')
  UNION ALL SELECT 'G_SECURITY','no direct DML '||r.rolname||' on '||t.name,'none',
    CASE WHEN r.rolname='PUBLIC' THEN
      CASE WHEN EXISTS(
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
        WHERE n.nspname='stock' AND c.relname=t.name AND a.grantee=0
          AND a.privilege_type IN ('SELECT','INSERT','UPDATE','DELETE')
      ) THEN 'direct privilege present' ELSE 'none' END
    ELSE concat_ws(',',
      CASE WHEN has_table_privilege(r.rolname,'stock.'||t.name,'SELECT') THEN 'SELECT' END,
      CASE WHEN has_table_privilege(r.rolname,'stock.'||t.name,'INSERT') THEN 'INSERT' END,
      CASE WHEN has_table_privilege(r.rolname,'stock.'||t.name,'UPDATE') THEN 'UPDATE' END,
      CASE WHEN has_table_privilege(r.rolname,'stock.'||t.name,'DELETE') THEN 'DELETE' END)
    END,
    CASE WHEN r.rolname='PUBLIC' THEN NOT EXISTS(
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
      WHERE n.nspname='stock' AND c.relname=t.name AND a.grantee=0
        AND a.privilege_type IN ('SELECT','INSERT','UPDATE','DELETE')
    ) ELSE NOT has_table_privilege(r.rolname,'stock.'||t.name,'SELECT,INSERT,UPDATE,DELETE') END
    FROM (VALUES('PUBLIC'),('anon'),('authenticated')) r(rolname) CROSS JOIN res1_tables t
  UNION ALL SELECT 'G_SECURITY','can_access_stock_location owner/ACL','present and inspect',
    coalesce(pg_get_userbyid(p.proowner)||' / '||coalesce(p.proacl::text,'default ACL'),'absent'),p.oid IS NOT NULL
    FROM (VALUES(1)) q(x) LEFT JOIN pg_proc p ON p.oid=to_regprocedure('stock.can_access_stock_location(uuid,boolean)')

  UNION ALL SELECT 'H_PHYSICAL_STOCK','stock_location_view column '||v.name,'present',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns c WHERE c.table_schema='stock' AND c.table_name='stock_location_view' AND c.column_name=v.name) THEN 'present' ELSE 'absent' END,
    EXISTS(SELECT 1 FROM information_schema.columns c WHERE c.table_schema='stock' AND c.table_name='stock_location_view' AND c.column_name=v.name)
    FROM (VALUES('article_id'),('location_id'),('unit_id'),('quantity')) v(name)

  UNION ALL SELECT 'I_RESOURCE_TYPE','no obvious recipe physical source','0',count(*)::text,count(*)=0
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='stock' AND c.relkind IN ('r','p','v','m')
      AND c.relname ~* '(recipe|recette).*(stock|inventory|movement)|(stock|inventory|movement).*(recipe|recette)'

  UNION ALL SELECT 'J_OP1','OP-1 table '||name,'present',coalesce(to_regclass('stock.'||name)::text,'absent'),to_regclass('stock.'||name) IS NOT NULL FROM expected_op_tables
  UNION ALL SELECT 'J_OP1','no RES-2-named OP relation collision','0',count(*)::text,count(*)=0
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='stock' AND c.relname LIKE 'production_order%' AND c.relname ~* 'reserv'

  UNION ALL SELECT 'K_STORAGE','bucket '||name,'present',CASE WHEN EXISTS(SELECT 1 FROM storage.buckets b WHERE b.id=e.name) THEN 'present' ELSE 'absent' END,EXISTS(SELECT 1 FROM storage.buckets b WHERE b.id=e.name) FROM expected_storage_buckets e
  UNION ALL SELECT 'K_STORAGE','policy '||name,'present',CASE WHEN EXISTS(SELECT 1 FROM pg_policies p WHERE p.schemaname='storage' AND p.tablename='objects' AND p.policyname=e.name) THEN 'present' ELSE 'absent' END,EXISTS(SELECT 1 FROM pg_policies p WHERE p.schemaname='storage' AND p.tablename='objects' AND p.policyname=e.name) FROM expected_storage_policies e

  UNION ALL SELECT 'L_ACTIVATION','no OP trigger invokes reservations','0',count(*)::text,count(*)=0
    FROM pg_trigger tr JOIN pg_class c ON c.oid=tr.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_proc p ON p.oid=tr.tgfoid
    WHERE n.nspname='stock' AND c.relname LIKE 'production_order%' AND NOT tr.tgisinternal
      AND (p.proname LIKE '%reserv%' OR p.prosrc ILIKE '%reserve_resource%' OR p.prosrc ILIKE '%stock_reservation%')
  UNION ALL SELECT 'L_ACTIVATION','no OP automatic reservation RPC','0',count(*)::text,count(*)=0
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='stock' AND p.proname NOT LIKE '\_res2\_%' ESCAPE '\'
      AND (p.proname ILIKE '%op%reserv%' OR (p.prosrc ILIKE '%production_order%' AND p.prosrc ILIKE '%reserve_resource%'))
  UNION ALL SELECT 'L_ACTIVATION','no VENTES hook to RES-2','0',count(*)::text,count(*)=0
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='stock' AND (p.proname ILIKE '%sale%' OR p.proname ILIKE '%stock_out%')
      AND (p.prosrc ILIKE '%reserve_resource%' OR p.prosrc ILIKE '%_res2_%')
  UNION ALL SELECT 'L_ACTIVATION','no transfer hook to RES-2','0',count(*)::text,count(*)=0
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='stock' AND p.proname ILIKE '%transfer%'
      AND (p.prosrc ILIKE '%reserve_resource%' OR p.prosrc ILIKE '%_res2_%')
),
report AS (
  SELECT 0 AS sort_group, family, control, expected, actual,
         CASE WHEN passed THEN 'PASS' ELSE 'FAIL' END AS result
  FROM checks
  UNION ALL
  SELECT 1, 'SUMMARY', 'TOTAL_CONTROLS', count(*)::text, count(*)::text, 'INFO' FROM checks
  UNION ALL
  SELECT 2, 'SUMMARY', 'PASS', count(*)::text, count(*) FILTER (WHERE passed)::text,
         CASE WHEN bool_and(passed) THEN 'PASS' ELSE 'FAIL' END FROM checks
  UNION ALL
  SELECT 3, 'SUMMARY', 'FAIL', '0', count(*) FILTER (WHERE NOT passed)::text,
         CASE WHEN count(*) FILTER (WHERE NOT passed)=0 THEN 'PASS' ELSE 'FAIL' END FROM checks
  UNION ALL
  SELECT 4, 'SUMMARY', 'VERDICT', 'RES-2 PREFLIGHT PASSED',
         CASE WHEN bool_and(passed) THEN 'RES-2 PREFLIGHT PASSED' ELSE 'RES-2 PREFLIGHT FAILED' END,
         CASE WHEN bool_and(passed) THEN 'PASS' ELSE 'FAIL' END FROM checks
)
SELECT family, control, expected, actual, result
FROM report
ORDER BY sort_group, family, control;

ROLLBACK;
