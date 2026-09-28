import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migration = await readFile(new URL('../supabase/migrations_hold/202609240001_cash_purchase_handover_quantities_and_guards.sql', import.meta.url), 'utf8')
const schema = await readFile(new URL('../src/lib/receptions.ts', import.meta.url), 'utf8')
const api = await readFile(new URL('../src/api/modules/receptions.api.ts', import.meta.url), 'utf8')
const form = await readFile(new URL('../src/pages/receptions/ReceptionFormPage.tsx', import.meta.url), 'utf8')

test('l’idempotence est portée par handover_id et non par cash_purchase_id', () => {
  assert.match(migration, /add column if not exists handover_id uuid/)
  assert.match(migration, /drop index if exists stock\.idx_receptions_one_active_cash_purchase/)
  assert.match(migration, /idx_receptions_one_active_handover[\s\S]*on stock\.receptions \(handover_id\)/)
  assert.doesNotMatch(migration, /unique index if not exists idx_receptions_one_active_cash_purchase/)
  assert.match(api, /\.eq\('handover_id', values\.handover_id\)/)
  assert.match(form, /handover_id: current\.handover_id \?\? \(controlled \? crypto\.randomUUID\(\)/)
})

test('les bornes de quantité préservent les NULL historiques', () => {
  assert.match(migration, /stock_quantity_accepted <= controller_quantity_accepted/)
  assert.match(migration, /stock_quantity_accepted <= handover_quantity_received/)
  assert.match(migration, /\) not valid;/)
  assert.match(schema, /handover_quantity_received\?: number \| null/)
})

test('les mouvements actifs utilisent les valeurs réelles de movement_status', () => {
  assert.match(migration, /status <> 'annule'::stock\.movement_status/)
})
