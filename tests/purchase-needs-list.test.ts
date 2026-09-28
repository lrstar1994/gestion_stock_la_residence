import assert from 'node:assert/strict'
import test from 'node:test'
import { getPurchaseNeedIntendedUseLabel } from '../src/lib/purchaseNeeds.ts'

test('the intended-use label comes from purchase_intended_uses, independently of the requesting service', () => {
  assert.equal(getPurchaseNeedIntendedUseLabel({ intended_uses: { id: 'cuisine', code: 'cuisine', label: 'Cuisine' } }), 'Cuisine')
  assert.equal(getPurchaseNeedIntendedUseLabel({ intended_uses: { id: 'banquet', code: 'banquet', label: 'Banquet' } }), 'Banquet')
})

test('a historical need without an intended use keeps the neutral placeholder', () => {
  assert.equal(getPurchaseNeedIntendedUseLabel({ intended_uses: null }), '—')
})
