import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const detail = await readFile(new URL('../src/pages/cash-purchases/CashPurchaseDetail.tsx', import.meta.url), 'utf8')
const api = await readFile(new URL('../src/api/modules/cashPurchases.api.ts', import.meta.url), 'utf8')

test('control PIN flow awaits the current receive-and-control RPC with the complete draft payload', () => {
  const handler = detail.match(/const controlReturn = async \(\) => \{[\s\S]*?\n  \}/)?.[0]
  assert.ok(handler)
  assert.match(handler, /const pin = window\.prompt\('PIN Contrôleur requis'\)/)
  assert.match(handler, /if \(pin === null\)/)
  assert.match(handler, /if \(!pin\.trim\(\)\)/)
  assert.match(handler, /amount_paid_supplier: amountPaidSupplier/)
  assert.match(handler, /amount_returned_to_controller: amountReturnedToController/)
  assert.match(handler, /quantity_bought: item\.quantity_bought/)
  assert.match(handler, /quantity_accepted: item\.quantity_accepted \?\? item\.quantity_bought/)
  assert.match(handler, /unit_price_real: item\.unit_price_real/)
  assert.match(handler, /await receiveAndControlCashPurchase\(purchase\.id, payload, pin\)/)
  assert.match(api, /schema\('stock'\)\.rpc\('receive_and_control_cash_purchase', \{ p_purchase_id: id, p_payload: payload, p_pin: pin \}\)/)
  assert.doesNotMatch(handler, /controlCashPurchase\(/)
})

test('failed control keeps drafts and displays a persistent explicit error without logging the PIN', () => {
  const handler = detail.match(/const controlReturn = async \(\) => \{[\s\S]*?\n  \}/)?.[0]
  assert.ok(handler)
  assert.match(handler, /catch \(error\)/)
  assert.match(handler, /setControlError\(message\)/)
  assert.match(handler, /toast\.error\(`Contrôle non enregistré : \$\{message\}`\)/)
  assert.match(detail, /role="alert"[\s\S]*?Contrôle non confirmé/)
  assert.match(handler, /trace\('PIN received', \{ pinProvided: true \}\)/)
  assert.doesNotMatch(handler, /console\.(debug|log|error).*\bpin\b/i)
  assert.match(handler, /finally \{\s*setControlling\(false\)/)
})

test('Supabase plain-object errors display their useful message instead of [object Object]', () => {
  assert.match(detail, /function getControlErrorMessage\(error: unknown\)/)
  assert.match(detail, /typeof message === 'string' && message\.trim\(\)/)
  assert.match(detail, /return message\.trim\(\)/)
  assert.doesNotMatch(detail, /const detail = error instanceof Error \? error\.message : String\(error\)/)
})
