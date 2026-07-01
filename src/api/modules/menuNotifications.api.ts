import { supabase } from '../../lib/supabase'
import type { UserRole } from '../../lib/validation'

export type MenuNotificationCounts = Record<string, number>

function add(counts: MenuNotificationCounts, key: string, value: number) {
  counts[key] = (counts[key] ?? 0) + value
}

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
    add(counts, '/admin/users', await safeCount('profiles', (query) => query.eq('status', 'pending_validation')))
    add(counts, '/recipes', await safeCount('recipes', (query) => query.eq('status', 'en_attente')))
    add(counts, '/recipes', await safeCount('pending_ingredients', (query) => query.in('status', ['pending', 'ambiguous'])))
    add(counts, '/purchase-needs', await safeCount('purchase_needs', (query) => query.in('status', ['a_faire', 'valide'])))
    add(counts, '/purchase-needs', await safeCount('purchase_needs', (query) => query.in('status', ['a_faire', 'en_cours', 'valide']).neq('urgency', 'normal')))
    add(counts, '/cash-purchases', await safeCount('cash_purchases', (query) => query.in('status', ['en_attente', 'retour_complet'])))
    add(counts, '/cash-purchases', await safeCount('cash_purchase_differences', (query) => query.eq('status', 'justifie')))
    add(counts, '/purchase-orders', await safeCount('purchase_orders', (query) => query.in('status', ['brouillon', 'livree'])))
    add(counts, '/purchase-orders', await safeCount('purchase_order_items', (query) => query.eq('difference_status', 'a_justifier')))
    add(counts, '/receptions', await safeCount('receptions', (query) => query.in('status', ['brouillon', 'en_attente', 'validee'])))
    add(counts, '/receptions', await safeCount('reception_anomalies', (query) => query.eq('resolved', false)))
    add(counts, '/stock', await safeCount('stock_movements', (query) => query.eq('status', 'en_attente')))
    add(counts, '/stock', await safeCount('stock_pending_movements', (query) => query.eq('status', 'pending_stock_module')))
    add(counts, '/inventories', await safeCount('inventories', (query) => query.eq('status', 'en_attente')))
    add(counts, '/inventories', await safeCount('inventory_adjustment_requests', (query) => query.eq('status', 'en_attente')))
    add(counts, '/invoices', await safeCount('invoices', (query) => query.in('status', ['a_verifier', 'a_payer', 'partiellement_paye', 'conteste'])))
    add(counts, '/invoices', await safeCount('invoices', (query) => query.in('status', ['validee', 'a_payer', 'partiellement_paye']).gt('amount_remaining', 0).lt('due_date', today)))
  }

  if (role === 'acheteur') {
    add(counts, '/purchase-needs', await safeCount('purchase_needs', (query) => query.eq('status', 'valide')))
    add(counts, '/cash-purchases', await safeCount('cash_purchases', (query) => query.eq('status', 'especes_remises')))
    add(counts, '/purchase-orders', await safeCount('purchase_orders', (query) => query.eq('status', 'validee')))
  }

  if (role === 'caisse') {
    add(counts, '/cash-purchases', await safeCount('cash_purchases', (query) => query.eq('status', 'valide')))
  }

  if (role === 'magasinier') {
    add(counts, '/purchase-orders', await safeCount('purchase_orders', (query) => query.in('status', ['envoyee', 'partiellement_livree', 'reception_avec_ecart'])))
    add(counts, '/receptions', await safeCount('purchase_orders', (query) => query.in('status', ['envoyee', 'partiellement_livree', 'reception_avec_ecart'])))
    add(counts, '/receptions', await safeCount('receptions', (query) => query.in('status', ['brouillon', 'validee'])))
    add(counts, '/stock', await safeCount('stock_pending_movements', (query) => query.eq('status', 'pending_stock_module')))
    add(counts, '/inventories', await safeCount('inventories', (query) => query.eq('status', 'en_attente')))
  }

  if (role === 'chef_cuisine' || role === 'fiche_technique') {
    add(counts, '/recipes', await safeCount('pending_ingredients', (query) => query.in('status', ['pending', 'ambiguous'])))
  }

  if (role === 'comptabilite') {
    add(counts, '/invoices', await safeCount('invoices', (query) => query.in('status', ['a_verifier', 'a_payer', 'partiellement_paye', 'conteste'])))
    add(counts, '/invoices', await safeCount('invoices', (query) => query.in('status', ['validee', 'a_payer', 'partiellement_paye']).gt('amount_remaining', 0).lt('due_date', today)))
  }

  return Object.fromEntries(Object.entries(counts).filter(([, value]) => value > 0))
}
