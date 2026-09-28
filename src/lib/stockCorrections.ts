import type { StockMovement } from './stock'

export type StockCorrectionOrigin = 'inventory' | 'manual' | 'other'

export function getStockCorrectionOrigin(movement: Pick<StockMovement, 'reference_type' | 'is_manual'>): StockCorrectionOrigin {
  if (movement.reference_type === 'inventaire') return 'inventory'
  if (movement.is_manual) return 'manual'
  return 'other'
}

export function getSignedStockCorrectionQuantity(movement: Pick<StockMovement, 'quantity' | 'from_location_id'>) {
  const quantity = Number(movement.quantity)
  if (quantity < 0) return quantity
  return movement.from_location_id ? -Math.abs(quantity) : Math.abs(quantity)
}

export function getStockCorrectionSourcePath(movement: Pick<StockMovement, 'reference_type' | 'reference_id'>) {
  if (!movement.reference_id) return null
  switch (movement.reference_type) {
    case 'inventaire': return `/inventories/${movement.reference_id}`
    case 'reception': return `/receptions/${movement.reference_id}`
    case 'stock_out':
    case 'stock_out_return': return `/stock/stock-out/${movement.reference_id}`
    case 'event_production': return `/events/${movement.reference_id}/production`
    case 'sale_cancellation':
    case 'sale_partial_return': return `/sales/${movement.reference_id}`
    default: return null
  }
}
