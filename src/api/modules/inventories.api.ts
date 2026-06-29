import { supabase } from '../../lib/supabase'
import { hasSignificantDifference, inventorySettings, summarizeInventory } from '../../lib/inventories'
import type { InitialInventoryRow, Inventory, InventoryDashboard, InventoryFormValues, InventoryStatus, InventoryType } from '../../lib/inventories'

type InventoryFilters = {
  search?: string
  locationId?: string
  type?: InventoryType | 'all'
  status?: InventoryStatus | 'all'
  fromDate?: string
  toDate?: string
  page?: number
  pageSize?: number
}

function cleanNullable(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export async function listInventories(filters: InventoryFilters = {}) {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 10
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase.schema('stock')
    .from('inventories')
    .select('*, locations(id, name), creator:profiles!inventories_created_by_fkey(id, full_name), validator:profiles!inventories_validated_by_fkey(id, full_name), inventory_items(id)', { count: 'exact' })
    .order('inventory_date', { ascending: false })
    .range(from, to)

  if (filters.locationId) query = query.eq('location_id', filters.locationId)
  if (filters.type && filters.type !== 'all') query = query.eq('type', filters.type)
  if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status)
  if (filters.fromDate) query = query.gte('inventory_date', filters.fromDate)
  if (filters.toDate) query = query.lte('inventory_date', filters.toDate)
  if (filters.search?.trim()) query = query.ilike('comment', `%${filters.search.trim()}%`)

  const { data, error, count } = await query
  if (error) throw error
  return { inventories: (data ?? []) as Inventory[], total: count ?? 0 }
}

export async function getInventory(id: string) {
  const { data, error } = await supabase.schema('stock')
    .from('inventories')
    .select('*, locations(id, name), creator:profiles!inventories_created_by_fkey(id, full_name), validator:profiles!inventories_validated_by_fkey(id, full_name), inventory_items(*, articles(id, name, units(id, name, abbreviation)), units(id, name, abbreviation), stock_movements(id, movement_reference, quantity, unit_cost, total_cost)), inventory_adjustment_requests(*, articles(id, name), units(id, name, abbreviation), requester:profiles!inventory_adjustment_requests_requested_by_fkey(id, full_name), validator:profiles!inventory_adjustment_requests_validated_by_fkey(id, full_name), stock_movements(id, movement_reference, quantity, unit_cost, total_cost))')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as Inventory
}

export async function prepareInventoryItems(locationId: string) {
  const { data: locationStock, error: stockError } = await supabase.schema('stock')
    .from('stock_location_view')
    .select('article_id, unit_id, quantity')
    .eq('location_id', locationId)
  if (stockError) throw stockError

  const { data: allowedArticles, error: allowedError } = await supabase.schema('stock')
    .from('article_locations')
    .select('article_id, articles(id, name, unit_id, status, families(id, name), units(id, name, abbreviation))')
    .eq('location_id', locationId)
  if (allowedError) throw allowedError

  const stockByArticle = new Map<string, { quantity: number; unit_id: string }>()
  for (const row of locationStock ?? []) {
    const current = stockByArticle.get(row.article_id)
    stockByArticle.set(row.article_id, {
      quantity: Number(current?.quantity ?? 0) + Number(row.quantity ?? 0),
      unit_id: row.unit_id,
    })
  }

  const { data: prices, error: priceError } = await supabase.schema('stock').from('stock_view').select('article_id, average_price, last_price')
  if (priceError) throw priceError
  const priceByArticle = new Map((prices ?? []).map((row) => [row.article_id, Number(row.average_price ?? row.last_price ?? 0)]))

  return (allowedArticles ?? [])
    .flatMap((row) => {
      const article = Array.isArray(row.articles) ? row.articles[0] : row.articles
      if (!article || article.status === 'archived') return []
      const unit = Array.isArray(article.units) ? article.units[0] : article.units
      const family = Array.isArray(article.families) ? article.families[0] : article.families
      const stock = stockByArticle.get(article.id)
      return [{
        article_id: article.id,
        theoretical_quantity: Number(stock?.quantity ?? 0),
        counted_quantity: Number(stock?.quantity ?? 0),
        unit_id: stock?.unit_id ?? article.unit_id,
        unit_price: priceByArticle.get(article.id) ?? 0,
        reason: '',
        stock_movement_id: null,
        articles: { id: article.id, name: article.name, families: family },
        units: unit,
      }]
    })
}

export async function createInventory(values: InventoryFormValues, profileId: string, role?: string) {
  validateInventoryValues(values)
  const summary = summarizeInventory(values.items)
  const significant = values.type === 'initial' || values.items.some((item) => hasSignificantDifference(item, inventorySettings.validationThresholdPercent))
  const status = role === 'direction' || !significant ? 'valide' : 'en_attente'

  const { data, error } = await supabase.schema('stock')
    .from('inventories')
    .insert({
      location_id: values.location_id,
      inventory_date: values.inventory_date,
      type: values.type,
      comment: cleanNullable(values.comment),
      total_positive_difference: summary.positive,
      total_negative_difference: summary.negative,
      total_difference: summary.total,
      total_value_difference: summary.value,
      status,
      validated_by: status === 'valide' ? profileId : null,
      validated_at: status === 'valide' ? new Date().toISOString() : null,
      created_by: profileId,
      updated_by: profileId,
    })
    .select('id')
    .single()
  if (error) throw error

  const rows = values.items.map((item) => ({
    inventory_id: data.id,
    article_id: item.article_id,
    theoretical_quantity: item.theoretical_quantity,
    counted_quantity: item.counted_quantity,
    unit_id: item.unit_id,
    unit_price: item.unit_price,
    reason: cleanNullable(item.reason),
  }))
  const { error: insertItemsError } = await supabase.schema('stock').from('inventory_items').insert(rows)
  if (insertItemsError) throw insertItemsError

  if (status === 'valide') await createInventoryCorrections(data.id, profileId)
  return { id: data.id as string, pendingValidation: status === 'en_attente' }
}

export async function validateInventory(id: string, profileId: string, comment = '') {
  const inventory = await getInventory(id)
  if (inventory.status === 'valide' || inventory.status === 'corrige') throw new Error('Cet inventaire a deja ete valide')
  for (const item of inventory.inventory_items ?? []) {
    if (hasSignificantDifference(item, inventorySettings.mandatoryReasonThresholdPercent) && !item.reason?.trim()) throw new Error('Veuillez saisir un motif pour cet ecart')
  }
  const { error } = await supabase.schema('stock')
    .from('inventories')
    .update({ status: 'valide', validated_by: profileId, validated_at: new Date().toISOString(), validation_comment: cleanNullable(comment), updated_by: profileId })
    .eq('id', id)
  if (error) throw error
  await createInventoryCorrections(id, profileId)
}

export async function createInventoryCorrections(id: string, profileId: string) {
  const inventory = await getInventory(id)
  let created = 0
  for (const item of inventory.inventory_items ?? []) {
    if (item.stock_movement_id) continue
    const difference = Number(item.counted_quantity ?? 0) - Number(item.theoretical_quantity ?? 0)
    if (difference === 0) continue
    const { data: movement, error } = await supabase.schema('stock')
      .from('stock_movements')
      .insert({
        article_id: item.article_id,
        quantity: difference,
        unit_id: item.unit_id,
        movement_type: 'correction',
        to_location_id: inventory.location_id,
        movement_date: inventory.inventory_date,
        status: 'valide',
        is_manual: true,
        manual_reason: item.reason || `Correction inventaire ${inventory.reference}`,
        manual_validated_by: profileId,
        manual_validated_at: new Date().toISOString(),
        unit_cost: Number(item.unit_price ?? 0),
        price_source: 'correction',
        comment: `Correction automatique suite a inventaire ${inventory.reference}`,
        reference_type: 'inventaire',
        reference_id: inventory.id,
        created_by: profileId,
        updated_by: profileId,
      })
      .select('id')
      .single()
    if (error) throw error
    await supabase.schema('stock').from('inventory_items').update({ stock_movement_id: movement.id }).eq('id', item.id)
    created += 1
  }
  if (created > 0) {
    await supabase.schema('stock').from('inventories').update({ status: 'corrige', updated_by: profileId }).eq('id', id)
  }
  return created
}

export async function getInventoryDashboard(): Promise<InventoryDashboard> {
  const [{ inventories }, initialRows, items] = await Promise.all([
    listInventories({ page: 1, pageSize: 1000 }),
    listInitialInventoryStatus(),
    listInventoryDifferenceItems(),
  ])
  const biggestDifferences = items.sort((a, b) => Math.abs(Number(b.value_difference ?? 0)) - Math.abs(Number(a.value_difference ?? 0))).slice(0, 10)
  return {
    total: inventories.length,
    pending: inventories.filter((inventory) => inventory.status === 'en_attente').length,
    initialMissing: initialRows.filter((row) => row.status !== 'stock_initial_confirme').length,
    totalValueDifference: inventories.reduce((sum, inventory) => sum + Number(inventory.total_value_difference ?? 0), 0),
    biggestDifferences,
  }
}

async function listInventoryDifferenceItems() {
  const { data, error } = await supabase.schema('stock')
    .from('inventory_items')
    .select('*, articles(id, name, units(id, name, abbreviation)), units(id, name, abbreviation)')
    .neq('difference', 0)
    .limit(200)
  if (error) throw error
  return data ?? []
}

export async function listInitialInventoryStatus(): Promise<InitialInventoryRow[]> {
  const { data: allowed, error: allowedError } = await supabase.schema('stock')
    .from('article_locations')
    .select('article_id, location_id, articles(id, name, units(id, abbreviation)), locations(id, name)')
  if (allowedError) throw allowedError

  const { data: initialInventories, error: inventoryError } = await supabase.schema('stock')
    .from('inventories')
    .select('id, location_id, inventory_date, status, inventory_items(article_id)')
    .eq('type', 'initial')
    .in('status', ['valide', 'corrige'])
  if (inventoryError) throw inventoryError

  return (allowed ?? []).map((row) => {
    const article = Array.isArray(row.articles) ? row.articles[0] : row.articles
    const location = Array.isArray(row.locations) ? row.locations[0] : row.locations
    const match = (initialInventories ?? []).find((inventory) => inventory.location_id === row.location_id && inventory.inventory_items?.some((item) => item.article_id === row.article_id))
    return {
      article_id: row.article_id,
      article_name: article?.name ?? '',
      location_id: row.location_id,
      location_name: location?.name ?? '',
      unit_name: (() => {
        const units = (article as { units?: Array<{ abbreviation?: string }> } | undefined)?.units
        return (Array.isArray(units) ? units[0]?.abbreviation : undefined) ?? ''
      })(),
      status: match ? 'stock_initial_confirme' : 'non_inventorie',
      last_inventory_date: match?.inventory_date ?? null,
    }
  })
}

export async function getUnconfirmedInitialInventoryCount(locationId?: string) {
  const rows = await listInitialInventoryStatus()
  return rows.filter((row) => (!locationId || row.location_id === locationId) && row.status !== 'stock_initial_confirme').length
}

export async function requestInventoryAdjustment(params: {
  inventoryId: string
  inventoryItemId: string
  proposedCountedQuantity: number
  reason: string
  profileId: string
}) {
  if (params.proposedCountedQuantity < 0) throw new Error('La quantite comptee ne peut pas etre negative')
  if (!params.reason.trim()) throw new Error('Veuillez saisir un motif pour cet ecart')
  const inventory = await getInventory(params.inventoryId)
  if (!['valide', 'corrige'].includes(inventory.status)) throw new Error('Cet inventaire doit etre valide avant correction')
  const item = inventory.inventory_items?.find((row) => row.id === params.inventoryItemId)
  if (!item?.id) throw new Error('Ligne inventaire introuvable')

  const { error } = await supabase.schema('stock').from('inventory_adjustment_requests').insert({
    inventory_id: inventory.id,
    inventory_item_id: item.id,
    article_id: item.article_id,
    location_id: inventory.location_id,
    original_counted_quantity: item.counted_quantity,
    proposed_counted_quantity: params.proposedCountedQuantity,
    unit_id: item.unit_id,
    unit_price: item.unit_price ?? 0,
    reason: params.reason.trim(),
    requested_by: params.profileId,
  })
  if (error) throw error
}

export async function validateInventoryAdjustment(id: string, profileId: string, comment = '') {
  const { data: request, error } = await supabase.schema('stock')
    .from('inventory_adjustment_requests')
    .select('*, inventories(reference, inventory_date)')
    .eq('id', id)
    .single()
  if (error) throw error
  if (request.status !== 'en_attente') throw new Error('Cette demande a deja ete traitee')
  const difference = Number(request.proposed_counted_quantity ?? 0) - Number(request.original_counted_quantity ?? 0)
  if (difference === 0) throw new Error('Aucun ajustement a creer')

  const { data: movement, error: movementError } = await supabase.schema('stock')
    .from('stock_movements')
    .insert({
      article_id: request.article_id,
      quantity: difference,
      unit_id: request.unit_id,
      movement_type: 'ajustement',
      to_location_id: request.location_id,
      movement_date: request.inventories?.inventory_date ?? new Date().toISOString().slice(0, 10),
      status: 'valide',
      is_manual: true,
      manual_reason: request.reason,
      manual_validated_by: profileId,
      manual_validated_at: new Date().toISOString(),
      unit_cost: Number(request.unit_price ?? 0),
      price_source: 'correction',
      comment: `Ajustement apres inventaire ${request.inventories?.reference ?? ''}`,
      reference_type: 'inventaire_ajustement',
      reference_id: request.inventory_id,
      created_by: profileId,
      updated_by: profileId,
    })
    .select('id')
    .single()
  if (movementError) throw movementError

  const { error: updateError } = await supabase.schema('stock')
    .from('inventory_adjustment_requests')
    .update({ status: 'valide', stock_movement_id: movement.id, validated_by: profileId, validated_at: new Date().toISOString(), validation_comment: cleanNullable(comment) })
    .eq('id', id)
  if (updateError) throw updateError
}

function validateInventoryValues(values: InventoryFormValues) {
  for (const item of values.items) {
    if (Number(item.counted_quantity) < 0) throw new Error('La quantite comptee ne peut pas etre negative')
    const difference = Math.abs(Number(item.counted_quantity) - Number(item.theoretical_quantity))
    const theoretical = Math.abs(Number(item.theoretical_quantity))
    const percent = theoretical > 0 ? (difference / theoretical) * 100 : difference > 0 ? 100 : 0
    if (percent > inventorySettings.mandatoryReasonThresholdPercent && !item.reason?.trim()) throw new Error('Veuillez saisir un motif pour cet ecart')
  }
}
