import { supabase } from '../../lib/supabase'
import type { StockMovement, MovementStatus, MovementType } from '../../lib/stock'
import type { StockCorrectionOrigin } from '../../lib/stockCorrections'

export type { StockCorrectionOrigin } from '../../lib/stockCorrections'

export type StockCorrection = StockMovement & {
  source_reference?: string | null
  manual_validator?: { id: string; full_name: string } | null
  retroactive_validator?: { id: string; full_name: string } | null
}

export type StockCorrectionFilters = {
  fromDate?: string
  toDate?: string
  articleId?: string
  familyId?: string
  locationId?: string
  origin?: StockCorrectionOrigin | 'all'
  status?: MovementStatus | 'all'
  page?: number
  pageSize?: number
}

const correctionSelect = '*, articles!inner(id, name, family_id, families(id, name)), units(id, name, abbreviation), from_location:locations!stock_movements_from_location_id_fkey(id, name), to_location:locations!stock_movements_to_location_id_fkey(id, name), creator:profiles!stock_movements_created_by_fkey(id, full_name), manual_validator:profiles!stock_movements_manual_validated_by_fkey(id, full_name), retroactive_validator:profiles!stock_movements_retroactive_validated_by_fkey(id, full_name)'

async function attachSourceReferences(rows: StockCorrection[]) {
  const inventoryIds = [...new Set(rows
    .filter((row) => row.reference_type === 'inventaire' && row.reference_id)
    .map((row) => row.reference_id as string))]
  if (inventoryIds.length === 0) return rows

  const { data, error } = await supabase.schema('stock')
    .from('inventories')
    .select('id, reference')
    .in('id', inventoryIds)
  if (error) throw error
  const references = new Map((data ?? []).map((inventory) => [inventory.id, inventory.reference]))
  return rows.map((row) => ({
    ...row,
    source_reference: row.reference_type === 'inventaire' && row.reference_id
      ? references.get(row.reference_id) ?? null
      : null,
  }))
}

export async function listStockCorrections(filters: StockCorrectionFilters = {}) {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 20
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase.schema('stock')
    .from('stock_movements')
    .select(correctionSelect, { count: 'exact' })
    .in('movement_type', ['correction', 'ajustement'] satisfies MovementType[])
    .order('movement_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filters.fromDate) query = query.gte('movement_date', filters.fromDate)
  if (filters.toDate) query = query.lte('movement_date', filters.toDate)
  if (filters.articleId) query = query.eq('article_id', filters.articleId)
  if (filters.familyId) query = query.eq('articles.family_id', filters.familyId)
  if (filters.locationId) query = query.or(`from_location_id.eq.${filters.locationId},to_location_id.eq.${filters.locationId}`)
  if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status)
  if (filters.origin === 'inventory') query = query.eq('reference_type', 'inventaire')
  if (filters.origin === 'manual') query = query.eq('is_manual', true).or('reference_type.is.null,reference_type.neq.inventaire')
  if (filters.origin === 'other') query = query.eq('is_manual', false).or('reference_type.is.null,reference_type.neq.inventaire')

  const { data, error, count } = await query
  if (error) throw error
  const rows = await attachSourceReferences((data ?? []) as StockCorrection[])
  return { corrections: rows, total: count ?? 0 }
}

export async function getStockCorrection(id: string) {
  const { data, error } = await supabase.schema('stock')
    .from('stock_movements')
    .select(correctionSelect)
    .eq('id', id)
    .in('movement_type', ['correction', 'ajustement'] satisfies MovementType[])
    .single()
  if (error) throw error
  const [movement] = await attachSourceReferences([data as StockCorrection])
  return movement
}
