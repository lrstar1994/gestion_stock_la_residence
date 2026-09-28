import test from 'node:test'
import assert from 'node:assert/strict'
import { getSignedStockCorrectionQuantity, getStockCorrectionOrigin, getStockCorrectionSourcePath } from '../src/lib/stockCorrections.ts'

test('inventory corrections classify as inventory even though they are marked manual', () => {
  assert.equal(getStockCorrectionOrigin({ reference_type: 'inventaire', is_manual: true }), 'inventory')
})

test('manual and other correction origins remain distinct', () => {
  assert.equal(getStockCorrectionOrigin({ reference_type: 'sensitive_action', is_manual: true }), 'manual')
  assert.equal(getStockCorrectionOrigin({ reference_type: null, is_manual: false }), 'other')
})

test('signed correction quantity uses the stock direction for historical inventory movements', () => {
  assert.equal(getSignedStockCorrectionQuantity({ quantity: 1, from_location_id: 'source-location' }), -1)
  assert.equal(getSignedStockCorrectionQuantity({ quantity: 1, from_location_id: null }), 1)
  assert.equal(getSignedStockCorrectionQuantity({ quantity: -2, from_location_id: null }), -2)
})

test('inventory source references open their inventory dossier', () => {
  assert.equal(getStockCorrectionSourcePath({ reference_type: 'inventaire', reference_id: 'inventory-id' }), '/inventories/inventory-id')
  assert.equal(getStockCorrectionSourcePath({ reference_type: 'sensitive_action', reference_id: null }), null)
})
