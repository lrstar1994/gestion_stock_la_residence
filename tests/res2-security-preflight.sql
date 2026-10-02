\set ON_ERROR_STOP on

BEGIN READ ONLY;

SELECT
  current_database() AS database_name,
  current_user AS current_user,
  session_user AS session_user,
  current_role AS current_role,
  current_setting('server_version') AS server_version,
  current_setting('transaction_read_only') AS transaction_read_only,
  has_schema_privilege(current_user, 'stock', 'USAGE,CREATE')
    AS current_role_can_create_in_stock;

WITH res1_tables(name) AS (
  VALUES
    ('stock_reservation_locks'),
    ('stock_reservation_requests'),
    ('stock_reservations'),
    ('stock_reservation_segments'),
    ('stock_reservation_contribution_allocations'),
    ('stock_reservation_events')
)
SELECT
  t.name,
  c.oid::regclass AS relation_name,
  pg_get_userbyid(c.relowner) AS owner,
  c.relrowsecurity,
  c.relforcerowsecurity
FROM res1_tables t
LEFT JOIN pg_class c
  ON c.relname = t.name
 AND c.relnamespace = (
   SELECT oid FROM pg_namespace WHERE nspname = 'stock'
 )
ORDER BY t.name;

SELECT
  p.oid::regprocedure AS function_name,
  p.prosecdef AS security_definer,
  pg_get_userbyid(p.proowner) AS owner,
  r.rolsuper,
  r.rolbypassrls,
  r.rolcanlogin,
  p.proconfig,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_roles r ON r.oid = p.proowner
WHERE n.nspname = 'stock'
  AND p.prosecdef
ORDER BY p.proname, p.oid::regprocedure::text;

SELECT
  current_user AS future_function_owner_if_created_without_set_role,
  session_user,
  current_role,
  r.rolsuper,
  r.rolbypassrls,
  r.rolcanlogin
FROM pg_roles r
WHERE r.rolname = current_user;

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'stock'
  AND tablename IN (
    'stock_reservation_locks',
    'stock_reservation_requests',
    'stock_reservations',
    'stock_reservation_segments',
    'stock_reservation_contribution_allocations',
    'stock_reservation_events'
  )
ORDER BY tablename, policyname;

SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  c.relrowsecurity,
  c.relforcerowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'stock'
  AND c.relname IN (
    'stock_reservation_locks',
    'stock_reservation_requests',
    'stock_reservations',
    'stock_reservation_segments',
    'stock_reservation_contribution_allocations',
    'stock_reservation_events'
  )
ORDER BY c.relname;

SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  COALESCE(r.rolname, 'PUBLIC') AS grantee,
  a.privilege_type,
  a.is_grantable,
  pg_get_userbyid(c.relowner) AS owner
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a
LEFT JOIN pg_roles r ON r.oid = a.grantee
WHERE n.nspname = 'stock'
  AND c.relname IN (
    'stock_reservation_locks',
    'stock_reservation_requests',
    'stock_reservations',
    'stock_reservation_segments',
    'stock_reservation_contribution_allocations',
    'stock_reservation_events'
  )
ORDER BY c.relname, grantee, a.privilege_type;

SELECT
  p.oid::regprocedure AS function_name,
  pg_get_userbyid(p.proowner) AS owner,
  p.prosecdef AS security_definer,
  p.proconfig,
  COALESCE(r.rolsuper, false) AS owner_rolsuper,
  COALESCE(r.rolbypassrls, false) AS owner_rolbypassrls
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_roles r ON r.oid = p.proowner
WHERE n.nspname = 'stock'
  AND p.oid = to_regprocedure('stock.can_access_stock_location(uuid,boolean)');

SELECT
  COALESCE(grantee_role.rolname, 'PUBLIC') AS grantee,
  a.privilege_type,
  a.is_grantable
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
LEFT JOIN pg_roles grantee_role ON grantee_role.oid = a.grantee
WHERE n.nspname = 'stock'
  AND p.oid = to_regprocedure('stock.can_access_stock_location(uuid,boolean)')
ORDER BY grantee, a.privilege_type;

SELECT auth.uid() AS session_auth_uid;

SELECT
  p.oid::regprocedure AS function_name,
  pg_get_userbyid(p.proowner) AS owner,
  p.prosecdef AS security_definer,
  position('auth.uid()' IN pg_get_functiondef(p.oid)) > 0
    AS references_auth_uid,
  p.proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'stock'
  AND p.prosecdef
  AND position('auth.uid()' IN pg_get_functiondef(p.oid)) > 0
ORDER BY p.proname, p.oid::regprocedure::text;

ROLLBACK;
