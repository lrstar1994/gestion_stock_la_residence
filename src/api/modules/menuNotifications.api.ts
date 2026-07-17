import { supabase } from '../../lib/supabase'
import type { UserRole } from '../../lib/validation'

export type MenuNotificationCounts = Record<string, number>

function add(counts: MenuNotificationCounts, key: string, value: number) {
  counts[key] = (counts[key] ?? 0) + value
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function safeCount(table: string, apply?: (query: any) => any) {
  try {
    let query = supabase.schema('stock').from(table).select('id', { count: 'exact', head: true })
    if (apply) query = apply(query)
    const { count, error } = await query
    if (error) return 0
    return count ?? 0
  } catch {
    return 0
  }
}

export async function getMenuNotificationCounts(role?: UserRole): Promise<MenuNotificationCounts> {
  if (!role) return {}

  const counts: MenuNotificationCounts = {}
  const today = new Date().toISOString().slice(0, 10)

  if (role === 'direction') {
    const pendingUsers = await safeCount('profiles', (query) => query.eq('status', 'pending_validation'))
    const pendingRecipes = await safeCount('recipes', (query) => query.eq('status', 'en_attente'))
    const pendingNeeds = await safeCount('purchase_needs', (query) => query.in('status', ['a_faire', 'valide']))
    const urgentNeeds = await safeCount('purchase_needs', (query) => query.in('status', ['a_faire', 'en_cours', 'valide']).neq('urgency', 'normal'))
    const pendingCash = await safeCount('cash_purchases', (query) => query.in('status', ['en_attente', 'retour_complet']))
    const justifiedCashDifferences = await safeCount('cash_purchase_differences', (query) => query.eq('status', 'justifie'))
    const pendingOrders = await safeCount('purchase_orders', (query) => query.in('status', ['brouillon', 'livree']))
    const pendingOrderDifferences = await safeCount('purchase_order_items', (query) => query.eq('difference_status', 'a_justifier'))
    const pendingReceptions = await safeCount('receptions', (query) => query.in('status', ['brouillon', 'en_attente', 'validee']))
    const openReceptionAnomalies = await safeCount('reception_anomalies', (query) => query.eq('resolved', false))
    const pendingStockMovements = await safeCount('stock_movements', (query) => query.eq('status', 'en_attente'))
    const pendingStockEntries = await safeCount('stock_pending_movements', (query) => query.eq('status', 'pending_stock_module'))
    const pendingInventories = await safeCount('inventories', (query) => query.eq('status', 'en_attente'))
    const pendingInventoryAdjustments = await safeCount('inventory_adjustment_requests', (query) => query.eq('status', 'en_attente'))
    const pendingInvoices = await safeCount('invoices', (query) => query.in('status', ['a_verifier', 'a_payer', 'partiellement_paye', 'conteste']))
    const overdueInvoices = await safeCount('invoices', (query) => query.in('status', ['validee', 'a_payer', 'partiellement_paye']).gt('amount_remaining', 0).lt('due_date', today))
    const supplierPaymentsToValidate = await safeCount('invoice_payments', (query) => query.eq('status', 'a_valider_direction'))

    add(counts, '/admin/users', pendingUsers)
    add(counts, '/recipes', pendingRecipes)
    add(counts, '/recipes', await safeCount('pending_ingredients', (query) => query.in('status', ['pending', 'ambiguous'])))
    add(counts, '/purchase-needs', pendingNeeds)
    add(counts, '/purchase-needs', urgentNeeds)
    add(counts, '/cash-purchases', pendingCash)
    add(counts, '/cash-purchases', justifiedCashDifferences)
    add(counts, '/purchase-orders', pendingOrders)
    add(counts, '/purchase-orders', pendingOrderDifferences)
    add(counts, '/receptions', pendingReceptions)
    add(counts, '/receptions', openReceptionAnomalies)
    add(counts, '/stock', pendingStockMovements)
    add(counts, '/stock', pendingStockEntries)
    add(counts, '/inventories', pendingInventories)
    add(counts, '/inventories', pendingInventoryAdjustments)
    add(counts, '/invoices', pendingInvoices)
    add(counts, '/invoices', overdueInvoices)
    add(counts, '/invoices/payables', overdueInvoices + supplierPaymentsToValidate)
    add(counts, '/purchases/tracking', pendingNeeds + pendingCash + pendingOrders + pendingReceptions + pendingInvoices + supplierPaymentsToValidate)
    add(counts, '/validations/my', pendingNeeds + pendingCash + pendingOrders + pendingReceptions + pendingInvoices + supplierPaymentsToValidate)
  }

  if (role === 'acheteur') {
    const validNeeds = await safeCount('purchase_needs', (query) => query.eq('status', 'valide'))
    const cashToReturn = await safeCount('cash_purchases', (query) => query.eq('status', 'especes_remises'))
    const ordersToSend = await safeCount('purchase_orders', (query) => query.eq('status', 'validee'))
    add(counts, '/purchase-needs', validNeeds)
    add(counts, '/cash-purchases', cashToReturn)
    add(counts, '/purchase-orders', ordersToSend)
    add(counts, '/purchases/tracking', validNeeds + cashToReturn + ordersToSend)
  }

  if (role === 'caisse') {
    const cashToGive = await safeCount('cash_purchases', (query) => query.eq('status', 'valide'))
    const invoicesToPrepare = await safeCount('invoices', (query) => query.in('status', ['validee', 'a_payer', 'partiellement_paye']).gt('amount_remaining', 0))
    const paymentsToExecute = await safeCount('invoice_payments', (query) => query.eq('status', 'a_executer'))
    add(counts, '/cash-purchases', cashToGive)
    add(counts, '/invoices', invoicesToPrepare + paymentsToExecute)
    add(counts, '/invoices/payables', invoicesToPrepare + paymentsToExecute)
    add(counts, '/purchases/tracking', cashToGive + invoicesToPrepare + paymentsToExecute)
  }

  if (role === 'magasinier') {
    const receivableOrders = await safeCount('purchase_orders', (query) => query.in('status', ['envoyee', 'partiellement_livree', 'reception_avec_ecart']))
    const receptionsToHandle = await safeCount('receptions', (query) => query.in('status', ['brouillon', 'validee']))
    const stockEntries = await safeCount('stock_pending_movements', (query) => query.eq('status', 'pending_stock_module'))
    const inventoriesToValidate = await safeCount('inventories', (query) => query.eq('status', 'en_attente'))
    add(counts, '/purchase-orders', receivableOrders)
    add(counts, '/receptions', receivableOrders)
    add(counts, '/receptions', receptionsToHandle)
    add(counts, '/stock', stockEntries)
    add(counts, '/inventories', inventoriesToValidate)
    add(counts, '/purchases/tracking', receivableOrders + receptionsToHandle)
  }

  if (role === 'chef_cuisine' || role === 'fiche_technique') {
    add(counts, '/recipes', await safeCount('pending_ingredients', (query) => query.in('status', ['pending', 'ambiguous'])))
  }

  if (role === 'comptabilite') {
    const invoicesToHandle = await safeCount('invoices', (query) => query.in('status', ['a_verifier', 'a_payer', 'partiellement_paye', 'conteste']))
    const overdueInvoices = await safeCount('invoices', (query) => query.in('status', ['validee', 'a_payer', 'partiellement_paye']).gt('amount_remaining', 0).lt('due_date', today))
    const paymentsToExecute = await safeCount('invoice_payments', (query) => query.eq('status', 'a_executer'))
    add(counts, '/invoices', invoicesToHandle + overdueInvoices + paymentsToExecute)
    add(counts, '/invoices/payables', invoicesToHandle + overdueInvoices + paymentsToExecute)
  }

  return Object.fromEntries(Object.entries(counts).filter(([, value]) => value > 0))
}
