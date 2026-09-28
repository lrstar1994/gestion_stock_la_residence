import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const migration = await readFile(new URL('supabase/migrations/202609230001_qualify_purchase_price_at_cash_control.sql', root), 'utf8')
const a1 = await readFile(new URL('supabase/migrations/202609200001_create_purchase_price_qualification_contract.sql', root), 'utf8')
const detail = await readFile(new URL('src/pages/cash-purchases/CashPurchaseDetail.tsx', root), 'utf8')

test('controller-only qualification reuses the A1 history contract', () => {
  assert.match(a1, /if not stock\.is_current_user_direction\(\)/i)
  assert.match(migration, /p\.role in \('direction','controleur'\)/i)
  assert.match(a1, /purchase_price_qualification_history/i)
  assert.match(migration, /insert into stock\.purchase_price_qualifications/i)
})

test('control transaction qualifies every admissible cash purchase line', () => {
  assert.match(migration, /price_classification text,price_qualification_reason text/i)
  assert.match(migration, /insert into stock\.purchase_price_qualifications\(source_type,source_line_id,classification,reason,qualified_by,qualified_at,updated_at\)/i)
  assert.match(migration, /controlled_at=v_now/i)
})

test('control UI exposes the last NORMAL price and conditional reason', () => {
  assert.match(detail, /getLastNormalActualPurchasePrices\(articleIds\)/)
  assert.match(detail, /Dernier prix NORMAL connu/)
  assert.match(detail, /: 'Aucun'/)
  assert.match(detail, /value="promotional".*PROMOTIONNEL/s)
  assert.match(detail, /Motif obligatoire/)
  assert.match(detail, /price_classification:/)
  assert.match(detail, /price_qualification_reason:/)
  assert.match(detail, /Un motif est obligatoire pour chaque prix promotionnel ou exceptionnel/)
})
