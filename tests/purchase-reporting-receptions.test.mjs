import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const migration = await readFile(new URL('supabase/migrations/202609150001_purchase_reporting_reception_read.sql', root), 'utf8')
const locationMigration = await readFile(new URL('supabase/migrations_hold/202609160001_restrict_stock_by_user_location.sql', root), 'utf8')
const reportingApi = await readFile(new URL('src/api/modules/purchaseReporting.api.ts', root), 'utf8')
const taskApi = await readFile(new URL('src/api/modules/tasks.api.ts', root), 'utf8')

test('report reception RPC is read-only, active-profile gated, and role limited', () => {
  assert.match(migration, /list_purchase_reporting_receptions[\s\S]*?language plpgsql\s+stable\s+security definer/i)
  assert.match(migration, /p\.status = 'active'[\s\S]*?v_role not in \('direction', 'controleur', 'caisse'\)/i)
  assert.match(migration, /revoke all on function stock\.list_purchase_reporting_receptions[\s\S]*?from public, anon, authenticated/i)
  assert.match(migration, /grant execute on function stock\.list_purchase_reporting_receptions[\s\S]*?to authenticated/i)
  assert.match(migration, /revoke all on function stock\.list_supplier_regularization_reporting[\s\S]*?from public, anon, authenticated/i)
  assert.doesNotMatch(migration, /grant\s+(select|insert|update|delete|all)\s+on\s+stock\.(receptions|reception_items|locations|stock_movements)/i)
  const receptionRpc = migration.split('create or replace function stock.list_supplier_regularization_reporting')[0]
  assert.doesNotMatch(receptionRpc, /\b(insert|update|delete)\s+(into\s+)?stock\./i)
})

test('Caisse report API uses the dedicated RPC and propagates errors', () => {
  assert.match(reportingApi, /'direction', 'controleur', 'caisse'/)
  assert.match(reportingApi, /rpc\('list_purchase_reporting_receptions'/)
  assert.match(reportingApi, /if \(error\) throw error/)
  assert.doesNotMatch(reportingApi, /catch\s*\(\s*\)\s*=>\s*\[\]/)
})

test('regularization reporting projects location name without granting location-table access', () => {
  assert.match(migration, /list_supplier_regularization_reporting[\s\S]*?physical_location_name text/i)
  assert.match(migration, /sr\.physical_location_id, l\.name/i)
  assert.match(migration, /v_role not in \('direction', 'caisse', 'controleur', 'magasinier'\)/i)
  assert.doesNotMatch(migration, /grant\s+select\s+on\s+stock\.locations/i)
  assert.match(taskApi, /listSupplierRegularizations\(\)\s*:/)
  assert.doesNotMatch(taskApi, /safe\(listSupplierRegularizations\(\),\s*\[\]\)/)
})

test('location restriction migration still blocks unassigned Caisse from stock operations and receipt writes', () => {
  assert.match(locationMigration, /p\.role <> 'controleur' and p\.role <> 'direction' and exists\s*\([\s\S]*?stock\.profile_location_access/i)
  assert.match(locationMigration, /create policy receptions_scoped_manage[\s\S]*?p\.role in \('direction','magasinier'\)/i)
  assert.match(locationMigration, /create policy reception_items_scoped_manage[\s\S]*?p\.role in \('direction','magasinier'\)/i)
  assert.match(locationMigration, /create policy reception_documents_scoped_manage[\s\S]*?p\.role in \('direction','magasinier'\)/i)
  assert.match(locationMigration, /create policy stock_movements_scoped_manage[\s\S]*?p\.role in \('direction','magasinier','chef_cuisine','point_vente'\)/i)
})
