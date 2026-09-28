import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const migration = fs.readFileSync(path.join(root, 'supabase/migrations_hold/202609280001_purchase_needs_transactional_guards.sql'), 'utf8')
const eventsApi = fs.readFileSync(path.join(root, 'src/api/modules/events.api.ts'), 'utf8')
const ordersApi = fs.readFileSync(path.join(root, 'src/api/modules/purchaseOrders.api.ts'), 'utf8')

test('Lot A expose uniquement les trois RPC spécialisées avec idempotence', () => {
  for (const name of ['regenerate_event_purchase_needs', 'update_event_purchase_need_status', 'replace_purchase_order_items', 'replace_purchase_order_need_links', 'cancel_purchase_need', 'replace_purchase_order_draft']) {
    assert.match(migration, new RegExp(`create or replace function stock\\.${name}`))
    assert.match(migration, new RegExp(`request_id`))
  }
  assert.match(migration, /purchase_need_operation_requests/)
  assert.match(migration, /guard_purchase_need_direct_write/)
  assert.match(migration, /current_user in \('anon','authenticated'\)/)
  assert.match(migration, /guard_lot_a_direct_order_write\(\) returns trigger\s*language plpgsql security invoker/s)
  assert.match(migration, /Écriture directe interdite : utiliser la RPC Lot A/)
  assert.match(migration, /for update/i)
  assert.match(migration, /before update or delete on stock\.purchase_order_items/)
  assert.match(migration, /before update or insert or delete on stock\.purchase_order_needs/)
  assert.match(migration, /array_agg\(id order by id\)/)
  assert.match(migration, /revoke all on function/)
})

test('Les chemins frontend appellent les RPC spécialisées', () => {
  assert.match(eventsApi, /regenerate_event_purchase_needs/)
  assert.match(eventsApi, /update_event_purchase_need_status/)
  assert.match(ordersApi, /replace_purchase_order_items/)
  assert.match(ordersApi, /replace_purchase_order_need_links/)
  assert.match(ordersApi, /replace_purchase_order_draft/)
  assert.match(ordersApi, /p_order_patch: orderPatch/)
  assert.match(migration, /replace_purchase_order_need_links/)
  const needsApi = fs.readFileSync(path.join(root, 'src/api/modules/purchaseNeeds.api.ts'), 'utf8')
  assert.match(needsApi, /cancel_purchase_need/)
})

test('Les décisions Direction restent sur la RPC officielle', () => {
  const needsApi = fs.readFileSync(path.join(root, 'src/api/modules/purchaseNeeds.api.ts'), 'utf8')
  assert.match(needsApi, /apply_purchase_need_line_decisions/)
  assert.doesNotMatch(migration, /transition_purchase_need_status/)
})
