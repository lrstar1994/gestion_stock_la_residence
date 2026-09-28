import { supabase } from '../../lib/supabase'
import { getArticleAllowedLocationIds } from '../../lib/articleLocations'
import { listLocations } from './catalog.api'
import { hasSignificantDifference, inventorySettings, summarizeInventory } from '../../lib/inventories'
import type { InitialInventoryRow, Inventory, InventoryDashboard, InventoryFormValues, InventoryStatus, InventoryType } from '../../lib/inventories'

type InventoryFilters = {
  search?: string
  locationId?: string
  type?: InventoryType | 'all'
  status?: InventoryStatus | 'all'
  statuses?: InventoryStatus[]
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
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filters.locationId) query = query.eq('location_id', filters.locationId)
  if (filters.type && filters.type !== 'all') query = query.eq('type', filters.type)
  if (filters.status && filters.status !== 'all') {
    query = filters.status === 'brouillon'
      ? query.in('status', ['brouillon', 'en_saisie'])
      : query.eq('status', filters.status)
  }
  if (filters.statuses?.length) query = query.in('status', filters.statuses)
  if (filters.fromDate) query = query.gte('inventory_date', filters.fromDate)
  if (filters.toDate) query = query.lte('inventory_date', filters.toDate)
  if (filters.search?.trim()) {
    const term = filters.search.trim()
    query = query.or(`reference.ilike.%${term}%,comment.ilike.%${term}%`)
  }

  const { data, error, count } = await query
  if (error) throw error
  return { inventories: (data ?? []) as Inventory[], total: count ?? 0 }
}

export async function getInventory(id: string) {
  const { data, error } = await supabase.schema('stock')
    .from('inventories')
    .select('*, locations(id, name), creator:profiles!inventories_created_by_fkey(id, full_name), validator:profiles!inventories_validated_by_fkey(id, full_name), closer:profiles!inventories_closed_by_fkey(id, full_name), inventory_items(*, articles(id, name, units(id, name, abbreviation)), units(id, name, abbreviation), stock_movements(id, movement_reference, quantity, unit_cost, total_cost)), inventory_adjustment_requests(*, articles(id, name), units(id, name, abbreviation), requester:profiles!inventory_adjustment_requests_requested_by_fkey(id, full_name), validator:profiles!inventory_adjustment_requests_validated_by_fkey(id, full_name), stock_movements(id, movement_reference, quantity, unit_cost, total_cost))')
    .eq('id', id)
    .single()
  if (!error) return data as Inventory
  const fallback = await supabase.schema('stock')
    .from('inventories')
    .select('*, locations(id, name), inventory_items(*)')
    .eq('id', id)
    .single()
  if (fallback.error) throw error
  const raw = fallback.data as Inventory
  const rows = raw.inventory_items ?? []
  const articleIds = [...new Set(rows.map((item) => item.article_id).filter(Boolean))]
  const unitIds = [...new Set(rows.map((item) => item.unit_id).filter(Boolean))]
  const [{ data: articles }, { data: units }] = await Promise.all([
    articleIds.length ? supabase.schema('stock').from('articles').select('id, name').in('id', articleIds) : Promise.resolve({ data: [] }),
    unitIds.length ? supabase.schema('stock').from('units').select('id, name, abbreviation').in('id', unitIds) : Promise.resolve({ data: [] }),
  ])
  const articleById = new Map((articles ?? []).map((article) => [article.id, article]))
  const unitById = new Map((units ?? []).map((unit) => [unit.id, unit]))
  raw.inventory_items = rows.map((item) => ({ ...item, articles: item.articles ?? articleById.get(item.article_id), units: item.units ?? unitById.get(item.unit_id) }))
  return raw
}

export async function listInventoriesForFinalReview() {
  const pageSize = 100
  const statuses: InventoryStatus[] = ['en_attente', 'valide', 'corrige', 'corrections_generees']
  const inventories: Inventory[] = []
  let page = 1
  let total: number

  do {
    const result = await listInventories({ statuses, page, pageSize })
    inventories.push(...result.inventories)
    total = result.total
    if (result.inventories.length === 0 && inventories.length < total) {
      throw new Error('Impossible de charger toutes les validations d’inventaire')
    }
    page += 1
  } while (inventories.length < total)

  return { inventories, total }
}

export async function prepareInventoryItems(locationId: string) {
  const { data: locationStock, error: stockError } = await supabase.schema('stock')
    .from('stock_location_view')
    .select('article_id, unit_id, quantity')
    .eq('location_id', locationId)
  if (stockError) throw stockError

  const { data: candidateArticles, error: allowedError } = await supabase.schema('stock')
    .from('articles')
    .select('id, name, unit_id, status, stockable, locations_restricted, families(id, name), units(id, name, abbreviation), article_locations(location_id)')
    .eq('status', 'active')
    .eq('stockable', true)
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

  return (candidateArticles ?? [])
    .flatMap((article) => {
      const allowedIds = getArticleAllowedLocationIds(
        article.locations_restricted,
        article.article_locations?.map((link) => link.location_id) ?? [],
        [locationId],
      )
      if (!allowedIds.includes(locationId)) return []
      const unit = Array.isArray(article.units) ? article.units[0] : article.units
      const family = Array.isArray(article.families) ? article.families[0] : article.families
      const stock = stockByArticle.get(article.id)
      return [{
        article_id: article.id,
        theoretical_quantity: Number(stock?.quantity ?? 0),
        counted_quantity: null,
        unit_id: stock?.unit_id ?? article.unit_id,
        unit_price: priceByArticle.get(article.id) ?? 0,
        reason: '',
        stock_movement_id: null,
        articles: { id: article.id, name: article.name, families: family },
        units: unit,
      }]
    })
}

export async function createInventory(values: InventoryFormValues, profileId: string, submission: 'draft' | 'submit' = 'draft') {
  validateInventoryValues(values)
  const summary = summarizeInventory(values.items)
  if (submission === 'submit' && values.items.some((item) => item.counted_quantity === null)) {
    throw new Error('Toutes les lignes doivent être comptées ou explicitement marquées avant soumission')
  }
  const significant = values.type === 'initial' || values.items.some((item) => hasSignificantDifference(item, inventorySettings.validationThresholdPercent))
  const status = submission === 'draft' ? 'brouillon' : significant ? 'a_valider_direction' : 'en_attente'

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
      submitted_by: submission === 'submit' ? profileId : null,
      submitted_at: submission === 'submit' ? new Date().toISOString() : null,
      retroactive_reason: values.inventory_date < new Date().toISOString().slice(0, 10) ? cleanNullable(values.comment) : null,
      created_by: profileId,
      updated_by: profileId,
    })
    .select('id')
    .single()
  if (error) throw error

  const rows = inventoryRowsForSave(data.id, values.items, submission)
  if (rows.length === 0 && submission === 'draft') {
    return { id: data.id as string, pendingValidation: false, status }
  }
  const { error: insertItemsError } = await supabase.schema('stock').from('inventory_items').insert(rows)
  if (insertItemsError) throw insertItemsError

  return { id: data.id as string, pendingValidation: submission === 'submit', status }
}

export async function updateInventoryDraft(id: string, values: InventoryFormValues, profileId: string, submission: 'draft' | 'submit' = 'draft') {
  validateInventoryValues(values)
  const current = await getInventory(id)
  if (!['brouillon', 'en_saisie', 'saisi'].includes(current.status)) {
    throw new Error('Cet inventaire ne peut plus etre modifie')
  }
  if (current.location_id !== values.location_id) {
    throw new Error('La localisation du brouillon ne peut pas etre modifiee')
  }
  if (submission === 'submit' && values.items.some((item) => item.counted_quantity === null)) {
    throw new Error('Toutes les lignes doivent etre comptees ou explicitement marquees avant soumission')
  }

  const summary = summarizeInventory(values.items)
  const significant = values.type === 'initial' || values.items.some((item) => hasSignificantDifference(item, inventorySettings.validationThresholdPercent))
  const status = submission === 'draft' ? 'brouillon' : significant ? 'a_valider_direction' : 'en_attente'
  const { error } = await supabase.schema('stock')
    .from('inventories')
    .update({
      inventory_date: values.inventory_date,
      type: values.type,
      comment: cleanNullable(values.comment),
      total_positive_difference: summary.positive,
      total_negative_difference: summary.negative,
      total_difference: summary.total,
      total_value_difference: summary.value,
      status,
      submitted_by: submission === 'submit' ? profileId : null,
      submitted_at: submission === 'submit' ? new Date().toISOString() : null,
      retroactive_reason: values.inventory_date < new Date().toISOString().slice(0, 10) ? cleanNullable(values.comment) : null,
      updated_by: profileId,
    })
    .eq('id', id)
  if (error) throw error

  const existingByArticle = new Map((current.inventory_items ?? []).map((item) => [item.article_id, item]))
  const rowsToInsert = []
  for (const item of values.items) {
    const shouldPersistDraftLine = submission === 'submit' || item.counted_quantity !== null
    if (!shouldPersistDraftLine) continue
    const existing = existingByArticle.get(item.article_id)
    const row = {
      theoretical_quantity: item.theoretical_quantity,
      counted_quantity: item.counted_quantity,
      unit_id: item.unit_id,
      unit_price: item.unit_price,
      reason: cleanNullable(item.reason),
    }
    if (existing?.id) {
      const { error: updateItemError } = await supabase.schema('stock').from('inventory_items').update(row).eq('id', existing.id)
      if (updateItemError) throw updateItemError
    } else {
      rowsToInsert.push({
        inventory_id: id,
        article_id: item.article_id,
        ...row,
      })
    }
  }
  if (rowsToInsert.length > 0) {
    const { error: insertItemsError } = await supabase.schema('stock').from('inventory_items').insert(rowsToInsert)
    if (insertItemsError) throw insertItemsError
  }

  return { id, pendingValidation: submission === 'submit', status }
}

function inventoryRowsForSave(inventoryId: string, items: InventoryFormValues['items'], submission: 'draft' | 'submit') {
  return items
    .filter((item) => submission === 'submit' || item.counted_quantity !== null)
    .map((item) => ({
    inventory_id: inventoryId,
    article_id: item.article_id,
    theoretical_quantity: item.theoretical_quantity,
    counted_quantity: item.counted_quantity,
    unit_id: item.unit_id,
    unit_price: item.unit_price,
    reason: cleanNullable(item.reason),
  }))
}

export async function validateInventory(id: string, pin: string, comment = '') {
  const { error } = await supabase.schema('stock').rpc('validate_inventory_with_pin', {
    p_inventory_id: id,
    p_pin: pin,
    p_comment: cleanNullable(comment),
  })
  if (error) throw error
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
  const [locations, articlesResult] = await Promise.all([
    listLocations(),
    supabase.schema('stock')
      .from('articles')
      .select('id, name, unit_id, locations_restricted, units(id, abbreviation), article_locations(location_id)')
      .eq('status', 'active')
      .eq('stockable', true),
  ])
  if (articlesResult.error) throw articlesResult.error

  const { data: initialInventories, error: inventoryError } = await supabase.schema('stock')
    .from('inventories')
    .select('id, location_id, inventory_date, status, inventory_items(article_id)')
    .eq('type', 'initial')
    .order('inventory_date', { ascending: false })
  if (inventoryError) throw inventoryError

  return (articlesResult.data ?? []).flatMap((article) => {
    const allowedIds = getArticleAllowedLocationIds(
      article.locations_restricted,
      article.article_locations?.map((link) => link.location_id) ?? [],
      locations.map((location) => location.id),
    )
    return locations.filter((location) => allowedIds.includes(location.id)).map((location) => {
      const match = (initialInventories ?? []).find((inventory) => inventory.location_id === location.id && inventory.inventory_items?.some((item) => item.article_id === article.id))
      const confirmed = match && ['valide', 'corrige', 'corrections_generees', 'cloture'].includes(match.status)
      const submitted = match && ['saisi', 'en_attente', 'a_controler', 'a_valider_direction', 'en_attente_validation', 'validation_direction_requise'].includes(match.status)
      const units = Array.isArray(article.units) ? article.units : article.units ? [article.units] : []
      return {
        article_id: article.id,
        article_name: article.name ?? '',
        location_id: location.id,
        location_name: location.name,
        unit_name: units[0]?.abbreviation ?? '',
        inventory_id: match?.id ?? null,
        status: confirmed ? 'stock_initial_confirme' : submitted ? 'a_controler' : match ? 'stock_initial_non_confirme' : 'non_inventorie',
        last_inventory_date: match?.inventory_date ?? null,
      }
    })
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

export async function validateInventoryAdjustment(id: string, pin: string, comment = '') {
  const { error } = await supabase.schema('stock').rpc('validate_inventory_adjustment_with_pin', {
    p_request_id: id,
    p_pin: pin,
    p_comment: cleanNullable(comment),
  })
  if (error) throw error
}

export async function closeInventory(id: string, pin: string, comment = '') {
  const { error } = await supabase.schema('stock').rpc('close_inventory_with_pin', {
    p_inventory_id: id,
    p_pin: pin,
    p_comment: cleanNullable(comment),
  })
  if (error) throw error
}

function validateInventoryValues(values: InventoryFormValues) {
  for (const item of values.items) {
    if (item.counted_quantity === null) continue
    if (Number(item.counted_quantity) < 0) throw new Error('La quantite comptee ne peut pas etre negative')
    const difference = Math.abs(Number(item.counted_quantity) - Number(item.theoretical_quantity))
    const theoretical = Math.abs(Number(item.theoretical_quantity))
    const percent = theoretical > 0 ? (difference / theoretical) * 100 : difference > 0 ? 100 : 0
    if (percent > inventorySettings.mandatoryReasonThresholdPercent && !item.reason?.trim()) throw new Error('Veuillez saisir un motif pour cet ecart')
  }
}
