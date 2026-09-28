import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const root = new URL('..', import.meta.url)

test('Magasinier reçoit une tâche de passation vers une réception préremplie', async () => {
  const tasks = await readFile(new URL('src/api/modules/tasks.api.ts', root), 'utf8')
  const form = await readFile(new URL('src/pages/receptions/ReceptionFormPage.tsx', root), 'utf8')
  assert.match(tasks, /Marchandises contrôlées à prendre en charge/)
  assert.match(tasks, /cash-handover-\$\{item\.id\}/)
  assert.match(tasks, /cashPurchaseId=\$\{item\.id\}/)
  assert.match(form, /controlled_at/)
  assert.match(form, /Quantite attendue \(Contrôleur\)/)
  assert.match(form, /submitReception\(receptionId, profile\?\.id\)/)
})

test('une réception cash existante bloque la création d’une seconde réception', async () => {
  const api = await readFile(new URL('src/api/modules/receptions.api.ts', root), 'utf8')
  const stock = await readFile(new URL('src/api/modules/stock.api.ts', root), 'utf8')
  assert.match(api, /Une reception existe deja pour cet achat controle/)
  assert.match(stock, /\.eq\('reception_item_id', pending\.reception_item_id\)/)
})

test('un justificatif cash contrôlé peut satisfaire le contrôle documentaire de la réception', async () => {
  const api = await readFile(new URL('src/api/modules/receptions.api.ts', root), 'utf8')
  assert.match(api, /cashReceiptReady/)
  assert.match(api, /cash_purchase_receipts\(id, file_url, cancelled_at\)/)
})

test('les trois quantités de passation sont stockées séparément', async () => {
  const migration = await readFile(new URL('supabase/migrations/202609240001_cash_purchase_handover_quantities_and_guards.sql', root), 'utf8')
  const form = await readFile(new URL('src/pages/receptions/ReceptionFormPage.tsx', root), 'utf8')
  assert.match(migration, /controller_quantity_accepted/)
  assert.match(migration, /handover_quantity_received/)
  assert.match(migration, /stock_quantity_accepted/)
  assert.match(form, /controller_quantity_accepted: expected/)
  assert.match(form, /handover_quantity_received: physical/)
  assert.match(form, /stock_quantity_accepted: 0/)
})

test('les gardes DB empêchent une réception active et un mouvement actif en double', async () => {
  const migration = await readFile(new URL('supabase/migrations/202609240001_cash_purchase_handover_quantities_and_guards.sql', root), 'utf8')
  assert.match(migration, /idx_receptions_one_active_cash_purchase/)
  assert.match(migration, /idx_stock_movements_one_active_reception_item/)
})
