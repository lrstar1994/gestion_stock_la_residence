import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('..', import.meta.url)
const events = await readFile(new URL('src/api/modules/events.api.ts', root), 'utf8')
const eventPage = await readFile(new URL('src/pages/events/PurchaseNeedsPage.tsx', root), 'utf8')
const needs = await readFile(new URL('src/api/modules/purchaseNeeds.api.ts', root), 'utf8')
const orders = await readFile(new URL('src/api/modules/purchaseOrders.api.ts', root), 'utf8')

test('la régénération événementielle rapproche les brouillons sans supprimer les besoins protégés', () => {
  assert.match(events, /regenerate_event_purchase_needs/)
  assert.match(events, /p_request_id: crypto\.randomUUID\(\)/)
  assert.doesNotMatch(events, /purchase_needs'\)\.delete\(\)\.eq\('event_id'/)
  assert.match(eventPage, /result\.conflicts\.length > 0/)
})

test('les transitions de besoins utilisent des préconditions de statut', () => {
  assert.match(needs, /apply_purchase_need_line_decisions/)
  assert.match(needs, /Les décisions Direction doivent passer par apply_purchase_need_line_decisions avec PIN/)
})

test('les commandes engagées ou réceptionnées ne peuvent pas être remplacées', () => {
  assert.match(orders, /assertOrderDraftMutable\(orderId\)/)
  assert.match(orders, /order\.status !== 'brouillon'/)
  assert.match(orders, /receptions'.*purchase_order_id/s)
  assert.match(orders, /replace_purchase_order_draft/)
  assert.match(orders, /replace_purchase_order_items/)
  assert.match(orders, /Un besoin déjà lié à un achat espèces ne peut pas être remplacé/)
})
