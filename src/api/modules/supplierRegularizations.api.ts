import { supabase } from '../../lib/supabase'

export type SupplierRegularization = {
  id: string
  cash_purchase_id: string
  cash_purchases?: { reference?: string | null } | null
  cash_purchase_items?: { articles?: { name?: string | null } | null } | null
  suppliers?: { name?: string | null } | null
  locations?: { name?: string | null } | null
  quantity_delivered: number
  quantity_accepted: number
  quantity_refused: number
  value_to_regularize: number
  treatment_type: string | null
  status: string
  current_responsible_role: string
  physical_location_note: string | null
  opened_at: string
  due_at: string | null
  physical_location_id: string | null
}

export async function listSupplierRegularizations(): Promise<SupplierRegularization[]> {
  const { data, error } = await supabase.schema('stock').rpc('list_supplier_regularization_reporting', {
    p_cash_purchase_id: null, p_regularization_id: null, p_open_only: true,
  })
  if (error) throw error
  return (data ?? []).map(mapRegularization) as SupplierRegularization[]
}

export async function getSupplierRegularizationsForPurchase(cashPurchaseId: string): Promise<SupplierRegularization[]> {
  const { data, error } = await supabase.schema('stock').rpc('list_supplier_regularization_reporting', {
    p_cash_purchase_id: cashPurchaseId, p_regularization_id: null, p_open_only: false,
  })
  if (error) throw error
  return (data ?? []).map(mapRegularization) as SupplierRegularization[]
}

export async function getSupplierRegularization(id: string) {
  const { data, error } = await supabase.schema('stock').rpc('list_supplier_regularization_reporting', {
    p_cash_purchase_id: null, p_regularization_id: id, p_open_only: false,
  })
  if (error) throw error
  const row = data?.[0]
  if (!row) throw new Error('Régularisation fournisseur introuvable')
  return mapRegularization(row)
}

function mapRegularization(row: Record<string, unknown>) {
  return {
    ...row,
    cash_purchases: { reference: row.cash_purchase_reference },
    cash_purchase_items: { articles: { name: row.article_name } },
    suppliers: row.supplier_name ? { name: row.supplier_name } : null,
    locations: row.physical_location_name ? { name: row.physical_location_name } : null,
  }
}

export async function isolateSupplierRegularization(id: string, locationId: string, note?: string) {
  const { data, error } = await supabase.schema('stock').rpc('isolate_cash_purchase_supplier_regularization', { p_regularization_id: id, p_location_id: locationId, p_location_note: note ?? null })
  if (error) throw error
  return data
}
