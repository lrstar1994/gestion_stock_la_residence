import { supabase } from '../../lib/supabase'
import { getArticleAllowedLocationIds } from '../../lib/articleLocations'
import { isArticleAllowedAtLocation as checkArticleAllowedAtLocation, listLocations } from './catalog.api'
import { isRetroactive } from '../../lib/stock'
import type { Location } from '../../lib/catalog'
import type { ManualMovementFormValues, MovementType, PriceHistoryRow, StockArticleDetail, StockMovement, StockRow, TransferFormValues } from '../../lib/stock'

type StockFilters = {
  search?: string
  familyId?: string
  locationId?: string
  status?: 'all' | 'low' | 'minimum' | 'normal' | 'out' | 'to_initialize' | 'initial_unconfirmed' | 'missing_cost' | 'with_value'
}

type MovementFilters = {
  date?: string
  movementType?: MovementType | 'all'
  articleId?: string
  locationId?: string
  page?: number
  pageSize?: number
}

type StockActionResult = {
  pendingValidation: boolean
}

function stockApiError(context: string, error: unknown) {
  if (typeof error !== 'object' || error === null) return new Error(`${context}: ${String(error)}`)
  const failure = error as { code?: string; message?: string; details?: string; hint?: string }
  return new Error(`${context}${failure.code ? ` [${failure.code}]` : ''}: ${failure.message ?? 'Erreur inconnue'}${failure.details ? ` — ${failure.details}` : ''}${failure.hint ? ` — ${failure.hint}` : ''}`)
}

export type StockTransferDraftItem = {
  id: string
  line_number: number
  article_id: string | null
  unit_id: string | null
  quantity: number | null
  line_comment: string | null
  authorized_quantity?: number | null
  articles?: { name: string } | null
  units?: { abbreviation: string } | null
}

export type StockTransferDraft = {
  id: string
  reference: string | null
  from_location_id: string | null
  to_location_id: string | null
  movement_date: string | null
  reason: string | null
  comment: string | null
  status: string
  created_by: string
  updated_at: string
  stock_transfer_batch_items: StockTransferDraftItem[]
}

export type StockTransferDraftPayload = {
  from_location_id: string
  to_location_id: string
  movement_date: string
  reason: string
  comment: string
  lines: Array<Pick<StockTransferDraftItem, 'article_id' | 'unit_id' | 'quantity' | 'line_comment'>>
}

export type StockTransferWorkflowLine = {
  id: string
  batch_item_id: string
  article_id: string
  unit_id: string
  quantity: number
  dispatched_quantity: number
  received_quantity?: number
  stock_transfer_receipt_items?: Array<{ id: string; received_quantity: number }>
  stock_transfer_discrepancies?: Array<{ id: string; quantity: number; reason: string; status: string; recipient_confirmed_by: string; magasinier_confirmed_by: string | null }>
}

export type StockTransferWorkflowHandoff = {
  id: string
  reference: string
  dispatched_by: string
  dispatched_at: string
  stock_transfer_handoff_items: StockTransferWorkflowLine[]
  stock_transfer_receipts?: Array<{ id: string; received_by: string; received_at: string }>
}

export type StockTransferWorkflowBatch = StockTransferDraft & {
  from_location_name_snapshot: string | null
  to_location_name_snapshot: string | null
  prepared_by: string | null
  prepared_at: string | null
  closed_by: string | null
  closed_at: string | null
  stock_transfer_batch_items: StockTransferDraftItem[]
  stock_transfer_handoffs: StockTransferWorkflowHandoff[]
  stock_transfer_discrepancies?: Array<{ id: string; quantity: number; reason: string; status: string; recipient_confirmed_by: string; magasinier_confirmed_by: string | null }>
}

function cleanNullable(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export async function listStock(filters: StockFilters = {}) {
  const [stockResult, locationsResult, articlesResult, initialResult, movementsResult, activeLocations] = await Promise.all([
    supabase.schema('stock').from('stock_view').select('*'),
    supabase.schema('stock').from('stock_location_view').select('*'),
    supabase.schema('stock').from('articles')
      .select('id, name, min_stock, status, stockable, locations_restricted, families(id, name), units(id, name, abbreviation), article_locations(location_id, locations(id, name))')
      .eq('stockable', true)
      .neq('status', 'archived'),
    supabase.schema('stock').from('inventories')
      .select('location_id, status, inventory_items(article_id)')
      .eq('type', 'initial')
      .in('status', ['valide', 'corrige', 'corrections_generees', 'cloture']),
    supabase.schema('stock').from('stock_movements')
      .select('article_id, movement_date, created_at')
      .in('status', ['normal', 'retroactif', 'valide'])
      .order('movement_date', { ascending: false })
      .order('created_at', { ascending: false }),
    listLocations(),
  ])
  if (stockResult.error) throw stockResult.error
  if (locationsResult.error) throw locationsResult.error
  if (articlesResult.error) throw articlesResult.error
  if (initialResult.error) throw initialResult.error
  if (movementsResult.error) throw movementsResult.error

  const stockByArticle = new Map((stockResult.data ?? []).map((row) => [row.article_id, row]))
  const locationStockByPair = new Map<string, { quantity: number; stock_value: number }>()
  for (const row of locationsResult.data ?? []) {
    const key = `${row.article_id}:${row.location_id}`
    const current = locationStockByPair.get(key)
    locationStockByPair.set(key, {
      quantity: Number(current?.quantity ?? 0) + Number(row.quantity ?? 0),
      stock_value: Number(current?.stock_value ?? 0) + Number(row.stock_value ?? 0),
    })
  }
  const confirmedPairs = new Set<string>()
  for (const inventory of initialResult.data ?? []) {
    for (const item of inventory.inventory_items ?? []) {
      confirmedPairs.add(`${item.article_id}:${inventory.location_id}`)
    }
  }
  const lastMovementByArticle = new Map<string, string>()
  for (const movement of movementsResult.data ?? []) {
    if (!lastMovementByArticle.has(movement.article_id)) lastMovementByArticle.set(movement.article_id, movement.movement_date)
  }

  let rows = (articlesResult.data ?? []).map((article) => {
    const family = Array.isArray(article.families) ? article.families[0] : article.families
    const unit = Array.isArray(article.units) ? article.units[0] : article.units
    const stock = stockByArticle.get(article.id)
    const activeLocationIds = activeLocations.map((location) => location.id)
    const linkedLocations = article.article_locations ?? []
    const allowedLocationIds = new Set(getArticleAllowedLocationIds(
      article.locations_restricted,
      linkedLocations.map((link) => link.location_id),
      activeLocationIds,
    ))
    const locations = activeLocations.filter((location) => allowedLocationIds.has(location.id)).map((location) => {
      const locationStock = locationStockByPair.get(`${article.id}:${location.id}`)
      return {
        location_id: location.id,
        location_name: location.name,
        quantity: Number(locationStock?.quantity ?? 0),
        stock_value: Number(locationStock?.stock_value ?? 0),
      }
    })
    const confirmedCount = locations.filter((location) => confirmedPairs.has(`${article.id}:${location.location_id}`)).length
    const initializationStatus = locations.length === 0 || confirmedCount === 0
      ? 'to_initialize'
      : confirmedCount < locations.length ? 'unconfirmed' : 'confirmed'
    const averagePrice = stock?.average_price == null ? null : Number(stock.average_price)
    return {
      article_id: article.id,
      total_quantity: Number(stock?.total_quantity ?? 0),
      last_price: stock?.last_price == null ? null : Number(stock.last_price),
      average_price: averagePrice,
      last_entry_date: stock?.last_entry_date ?? null,
      stock_value: averagePrice == null ? null : Number(stock?.stock_value ?? 0),
      articles: {
        id: article.id,
        name: article.name,
        min_stock: article.min_stock,
        families: family,
        units: unit,
      },
      locations,
      initialization_status: initializationStatus,
      last_movement_date: lastMovementByArticle.get(article.id) ?? null,
      valuation_status: averagePrice == null || averagePrice <= 0 ? 'missing_cost' : 'available',
    }
  }) as StockRow[]

  if (filters.search?.trim()) rows = rows.filter((row) => row.articles?.name.toLowerCase().includes(filters.search!.trim().toLowerCase()))
  if (filters.familyId) rows = rows.filter((row) => row.articles?.families?.id === filters.familyId)
  if (filters.locationId) rows = rows.filter((row) => row.locations?.some((location) => location.location_id === filters.locationId))
  if (filters.status && filters.status !== 'all') {
    rows = rows.filter((row) => {
      const quantity = Number(row.total_quantity ?? 0)
      const minStock = Number(row.articles?.min_stock ?? 0)
      if (filters.status === 'out') return quantity <= 0
      if (filters.status === 'low') return quantity > 0 && minStock > 0 && quantity < minStock
      if (filters.status === 'minimum') return minStock > 0 && quantity === minStock
      if (filters.status === 'to_initialize') return row.initialization_status === 'to_initialize'
      if (filters.status === 'initial_unconfirmed') return row.initialization_status === 'unconfirmed'
      if (filters.status === 'missing_cost') return row.valuation_status === 'missing_cost'
      if (filters.status === 'with_value') return Number(row.stock_value ?? 0) > 0
      return quantity > minStock
    })
  }

  return rows
}

export async function getStockArticleDetail(articleId: string): Promise<StockArticleDetail> {
  const rows = await listStock()
  const stock = rows.find((row) => row.article_id === articleId) ?? null
  const [movementsResult, priceHistory] = await Promise.all([
    listMovements({ articleId, page: 1, pageSize: 100 }),
    getPriceHistory(articleId),
  ])

  return {
    stock,
    movements: movementsResult.movements,
    priceHistory,
  }
}

export async function getStockQuantity(articleId: string, locationId?: string) {
  if (locationId) {
    const { data, error } = await supabase.schema('stock').from('stock_location_view').select('quantity').eq('article_id', articleId).eq('location_id', locationId)
    if (error) throw error
    return (data ?? []).reduce((sum, row) => sum + Number(row.quantity ?? 0), 0)
  }
  const { data, error } = await supabase.schema('stock').from('stock_view').select('total_quantity').eq('article_id', articleId).maybeSingle()
  if (error) throw error
  return Number(data?.total_quantity ?? 0)
}

export async function createTransfer(values: TransferFormValues, profileId: string, role?: string, pin?: string): Promise<StockActionResult> {
  void role
  void pin
  if (!profileId.trim()) throw new Error('Profil actif requis pour préparer un transfert')
  if (values.from_location_id === values.to_location_id) throw new Error("La destination doit être différente de l'origine")
  if (!values.reason.trim()) throw new Error('Le motif du transfert est obligatoire')
  if (!values.article_id || !values.unit_id || !Number.isFinite(values.quantity) || values.quantity <= 0) throw new Error('Article, unité et quantité positive sont obligatoires')
  const transferId = await saveStockTransferDraft(null, {
    from_location_id: values.from_location_id,
    to_location_id: values.to_location_id,
    movement_date: values.movement_date,
    reason: values.reason,
    comment: values.comment ?? '',
    lines: [{ article_id: values.article_id, unit_id: values.unit_id, quantity: values.quantity, line_comment: null }],
  })
  await prepareStockTransfer(transferId)
  return { pendingValidation: false }
}

export async function createManualMovement(values: ManualMovementFormValues, profileId: string, role?: string, pin?: string): Promise<StockActionResult> {
  const allowed = await isArticleAllowedInLocation(values.article_id, values.location_id)
  if (!allowed) throw new Error("Cette localisation n'est pas autorisée pour cet article")
  const retro = isRetroactive(values.movement_date)
  if (retro && !values.retroactive_reason?.trim()) throw new Error('Veuillez saisir un motif pour le mouvement rétroactif')
  if (['entree', 'correction', 'ajustement'].includes(values.movement_type) && (!values.unit_cost || values.unit_cost <= 0)) {
    throw new Error('Le prix unitaire est obligatoire pour ce type de mouvement')
  }
  if (values.movement_type === 'sortie') {
    const available = await getStockQuantity(values.article_id, values.location_id)
    if (available < values.quantity) throw new Error('Stock insuffisant pour ce transfert')
  }

  const isInbound = values.movement_type === 'entree' || values.movement_type === 'correction' || values.movement_type === 'ajustement'
  if (role !== 'direction') {
    const { error } = await supabase.schema('stock').from('stock_movements').insert({
      article_id: values.article_id,
      quantity: values.quantity,
      unit_id: values.unit_id,
      movement_type: values.movement_type,
      from_location_id: isInbound ? null : values.location_id,
      to_location_id: isInbound ? values.location_id : null,
      movement_date: values.movement_date,
      status: 'en_attente',
      is_retroactive: retro,
      retroactive_date: retro ? values.movement_date : null,
      retroactive_reason: cleanNullable(values.retroactive_reason),
      is_manual: true,
      manual_reason: values.reason.trim(),
      unit_cost: isInbound ? values.unit_cost : null,
      price_source: isInbound ? values.price_source ?? 'manual' : 'average',
      comment: cleanNullable(values.comment),
      created_by: profileId,
      updated_by: profileId,
    })
    if (error) throw error
    return { pendingValidation: true }
  }

  if (!pin) throw new Error('Le PIN personnel est obligatoire pour valider un mouvement manuel sensible')
  const { error } = await supabase.schema('stock').rpc('create_sensitive_stock_movement', {
    p_payload: {
      ...values,
      from_location_id: isInbound ? null : values.location_id,
      to_location_id: isInbound ? values.location_id : null,
      retroactive_reason: cleanNullable(values.retroactive_reason),
      price_source: isInbound ? values.price_source ?? 'manual' : 'average',
    },
    p_pin: pin,
  })
  if (error) throw error
  return { pendingValidation: false }
}

export async function listTransferDestinations(articleId: string, fromLocationId: string): Promise<Array<Pick<Location, 'id' | 'name'>>> {
  if (!articleId || !fromLocationId) return []
  const { data, error } = await supabase.schema('stock').rpc('list_article_allowed_transfer_destinations', {
    p_article_id: articleId,
    p_from_location_id: fromLocationId,
  })
  if (!error) return (data ?? []) as Array<Pick<Location, 'id' | 'name'>>
  if (error.code !== 'PGRST202') throw error
  const [articleResult, activeLocations] = await Promise.all([
    supabase.schema('stock').from('articles').select('locations_restricted, article_locations(location_id)').eq('id', articleId).single(),
    listLocations(),
  ])
  if (articleResult.error) throw articleResult.error
  const linkedIds = articleResult.data.article_locations?.map((link) => link.location_id) ?? []
  const allowedIds = new Set(getArticleAllowedLocationIds(articleResult.data.locations_restricted, linkedIds, activeLocations.map((location) => location.id)))
  return activeLocations.filter((location) => location.id !== fromLocationId && allowedIds.has(location.id))
    .map(({ id, name }) => ({ id, name }))
    .sort((left, right) => left.name.localeCompare(right.name, 'fr'))
}

export async function listStockTransferDrafts(): Promise<StockTransferDraft[]> {
  const { data, error } = await supabase.schema('stock')
    .from('stock_transfer_batches')
    .select('id, reference, from_location_id, to_location_id, movement_date, reason, comment, status, created_by, updated_at, stock_transfer_batch_items(id, line_number, article_id, unit_id, quantity, line_comment)')
    .eq('status', 'draft')
    .order('updated_at', { ascending: false })
  if (error) throw stockApiError('Lecture de stock.stock_transfer_batches et de ses lignes', error)
  return (data ?? []) as unknown as StockTransferDraft[]
}

export async function saveStockTransferDraft(transferId: string | null, payload: StockTransferDraftPayload) {
  const { data, error } = await supabase.schema('stock').rpc('save_stock_transfer_draft', {
    p_transfer_id: transferId,
    p_payload: payload,
  })
  if (error) throw stockApiError('RPC stock.save_stock_transfer_draft', error)
  return data as string
}

export async function deleteStockTransferDraft(transferId: string) {
  const { error } = await supabase.schema('stock').rpc('delete_stock_transfer_draft', { p_transfer_id: transferId })
  if (error) throw stockApiError('RPC stock.delete_stock_transfer_draft', error)
}

export async function finalizeStockTransfer(transferId: string, pin?: string) {
  const { data, error } = await supabase.schema('stock').rpc('finalize_stock_transfer', {
    p_transfer_id: transferId,
    p_pin: pin ?? null,
  })
  if (error) throw stockApiError('RPC stock.finalize_stock_transfer', error)
  return data as { transfer_id: string; reference: string; status: 'pending_direction' | 'validated'; movement_count: number }
}

export async function prepareStockTransfer(transferId: string, sourceType: 'operation' | 'stock_request' | 'manual_exception' = 'manual_exception', sourceId: string | null = null) {
  const { data, error } = await supabase.schema('stock').rpc('prepare_stock_transfer', {
    p_transfer_id: transferId,
    p_source_type: sourceType,
    p_source_id: sourceId,
  })
  if (error) throw stockApiError('RPC stock.prepare_stock_transfer', error)
  return data as { transfer_id: string; status: 'prepared' }
}

export async function listStockTransferWorkflow(): Promise<StockTransferWorkflowBatch[]> {
  const statuses = ['prepared', 'awaiting_dispatch', 'in_transit', 'partially_received', 'discrepancy_pending', 'received']
  const { data, error } = await supabase.schema('stock').from('stock_transfer_batches')
    .select('id, reference, from_location_id, to_location_id, movement_date, reason, comment, status, created_by, updated_at, from_location_name_snapshot, to_location_name_snapshot, prepared_by, prepared_at, closed_by, closed_at, stock_transfer_batch_items(id, line_number, article_id, unit_id, quantity, authorized_quantity, line_comment, articles(name), units(abbreviation)), stock_transfer_handoffs(id, reference, dispatched_by, dispatched_at, stock_transfer_receipts(id, received_by, received_at), stock_transfer_handoff_items(id, batch_item_id, article_id, unit_id, dispatched_quantity, stock_transfer_receipt_items(id, received_quantity), stock_transfer_discrepancies(id, quantity, reason, status, recipient_confirmed_by, magasinier_confirmed_by)))')
    .in('status', statuses).order('updated_at', { ascending: false }).range(0, 499)
  if (error) throw stockApiError('Lecture des transmissions et réceptions de transferts', error)
  return (data ?? []) as unknown as StockTransferWorkflowBatch[]
}

export async function dispatchStockTransfer(transferId: string, requestId: string, lines: Array<{ batch_item_id: string; quantity: number }>, pin: string) {
  const { data, error } = await supabase.schema('stock').rpc('dispatch_stock_transfer', {
    p_transfer_id: transferId,
    p_request_id: requestId,
    p_lines: lines,
    p_pin: pin,
  })
  if (error) throw stockApiError('RPC stock.dispatch_stock_transfer', error)
  return data as { handoff_id: string; reference: string; status: string; line_count?: number; retry?: boolean }
}

export async function receiveStockTransfer(handoffId: string, requestId: string, lines: Array<{ handoff_item_id: string; quantity: number }>, finalizeDiscrepancy: boolean, discrepancyReason: string, pin: string) {
  const { data, error } = await supabase.schema('stock').rpc('receive_stock_transfer', {
    p_handoff_id: handoffId,
    p_request_id: requestId,
    p_lines: lines,
    p_finalize_discrepancy: finalizeDiscrepancy,
    p_discrepancy_reason: discrepancyReason,
    p_pin: pin,
  })
  if (error) throw stockApiError('RPC stock.receive_stock_transfer', error)
  return data as { receipt_id: string; status: string; line_count?: number; retry?: boolean }
}

export async function confirmStockTransferDiscrepancy(discrepancyId: string, pin: string) {
  const { data, error } = await supabase.schema('stock').rpc('confirm_stock_transfer_discrepancy', {
    p_discrepancy_id: discrepancyId,
    p_pin: pin,
  })
  if (error) throw stockApiError('RPC stock.confirm_stock_transfer_discrepancy', error)
  return data as { discrepancy_id: string; status: string; stock_movement_id: string }
}

export async function closeStockTransfer(transferId: string, pin: string) {
  const { data, error } = await supabase.schema('stock').rpc('close_stock_transfer', {
    p_transfer_id: transferId,
    p_pin: pin,
  })
  if (error) throw stockApiError('RPC stock.close_stock_transfer', error)
  return data as { transfer_id: string; status: 'closed' }
}

export async function listMovements(filters: MovementFilters = {}) {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 20
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase.schema('stock')
    .from('stock_movements')
    .select('*, articles(id, name, min_stock, families(id, name)), units(id, name, abbreviation), from_location:locations!stock_movements_from_location_id_fkey(id, name), to_location:locations!stock_movements_to_location_id_fkey(id, name), creator:profiles!stock_movements_created_by_fkey(id, full_name)', { count: 'exact' })
    .order('movement_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filters.date) query = query.eq('movement_date', filters.date)
  if (filters.movementType && filters.movementType !== 'all') query = query.eq('movement_type', filters.movementType)
  if (filters.articleId) query = query.eq('article_id', filters.articleId)
  if (filters.locationId) query = query.or(`from_location_id.eq.${filters.locationId},to_location_id.eq.${filters.locationId}`)

  const { data, error, count } = await query
  if (error) throw error
  return { movements: (data ?? []) as StockMovement[], total: count ?? 0 }
}

export async function validateMovement(id: string, pin: string, reason: string) {
  const { error } = await supabase.schema('stock').rpc('validate_stock_movement_with_pin', {
    p_movement_id: id,
    p_pin: pin,
    p_reason: reason,
  })
  if (error) throw error
}

export async function cancelMovement(id: string, profileId?: string) {
  const { error } = await supabase.schema('stock').from('stock_movements').update({ status: 'annule', updated_by: profileId }).eq('id', id)
  if (error) throw error
}

export async function getPriceHistory(articleId: string) {
  const { data, error } = await supabase.schema('stock').from('price_history_view').select('*').eq('article_id', articleId).order('movement_date', { ascending: false })
  if (error) throw error
  return (data ?? []) as PriceHistoryRow[]
}

export async function integratePendingReceptionMovements(profileId: string) {
  const { data, error } = await supabase.schema('stock')
    .from('stock_pending_movements')
    .select('*, reception_items(id, unit_price_real), receptions(id, reference, reception_date, status)')
    .eq('status', 'pending_stock_module')
  if (error) throw error

  let count = 0
  const integratedReceptionIds = new Set<string>()
  for (const pending of data ?? []) {
    if (!['validee', 'validee_avec_anomalies'].includes(pending.receptions?.status)) continue
    const { data: existing, error: existingError } = await supabase.schema('stock').from('stock_movements').select('id').eq('reception_item_id', pending.reception_item_id).limit(1)
    if (existingError) throw existingError
    if ((existing ?? []).length > 0) {
      await supabase.schema('stock').from('stock_pending_movements').update({ status: 'integrated' }).eq('id', pending.id)
      integratedReceptionIds.add(pending.reception_id)
      continue
    }
    const { error: insertError } = await supabase.schema('stock').from('stock_movements').insert({
      article_id: pending.article_id,
      quantity: pending.quantity,
      unit_id: pending.unit_id,
      movement_type: 'entree',
      to_location_id: pending.location_id,
      movement_date: pending.receptions?.reception_date ?? new Date().toISOString().slice(0, 10),
      reference_type: 'reception',
      reference_id: pending.reception_id,
      reception_item_id: pending.reception_item_id,
      status: 'normal',
      unit_cost: pending.effective_material_unit_cost ?? pending.reception_items?.unit_price_real,
      effective_material_unit_cost: pending.effective_material_unit_cost ?? pending.reception_items?.unit_price_real,
      effective_material_cost_total: pending.effective_material_cost_total ?? Number(pending.quantity ?? 0) * Number(pending.reception_items?.unit_price_real ?? 0),
      effective_cost_method: pending.effective_cost_method ?? 'invoice_ht_vat_recoverable',
      effective_cost_source: pending.effective_cost_source ?? 'reception',
      price_source: 'reception',
      comment: `Reception ${pending.receptions?.reference ?? ''}`,
      created_by: profileId,
      updated_by: profileId,
    })
    if (insertError) throw insertError
    await supabase.schema('stock').from('stock_pending_movements').update({ status: 'integrated' }).eq('id', pending.id)
    integratedReceptionIds.add(pending.reception_id)
    count += 1
  }
  for (const receptionId of integratedReceptionIds) {
    await supabase.schema('stock')
      .from('receptions')
      .update({ status: 'entree_stock', updated_by: profileId })
      .eq('id', receptionId)
      .in('status', ['validee', 'validee_avec_anomalies'])
  }
  if (integratedReceptionIds.size > 0) {
    const { data: receptions, error: receptionError } = await supabase.schema('stock')
      .from('receptions')
      .select('cash_purchase_id')
      .in('id', Array.from(integratedReceptionIds))
      .not('cash_purchase_id', 'is', null)
    if (receptionError) throw receptionError

    const cashPurchaseIds = Array.from(new Set((receptions ?? []).map((reception) => reception.cash_purchase_id).filter(Boolean))) as string[]
    for (const cashPurchaseId of cashPurchaseIds) {
      const { error: workflowError } = await supabase.schema('stock').rpc('update_cash_purchase_workflow_status', {
        p_cash_purchase_id: cashPurchaseId,
        p_cash_status: null,
        p_reception_status: null,
        p_stock_entry_status: 'entree_stock_faite',
        p_profile_id: profileId,
      })
      if (workflowError) throw workflowError
    }
  }
  return count
}

export async function syncEventProductionStock(eventId: string, profileId: string) {
  const { error: deleteError } = await supabase.schema('stock')
    .from('stock_movements')
    .delete()
    .eq('reference_type', 'event_production')
    .eq('reference_id', eventId)
  if (deleteError) throw deleteError

  const { data: event, error } = await supabase.schema('stock')
    .from('events')
    .select('id, date, event_recipes(*, recipes(portions, recipe_ingredients!recipe_ingredients_recipe_id_fkey(article_id, quantity, quantity_stored, unit_id, unit_stored, unit_price)))')
    .eq('id', eventId)
    .single()
  if (error) throw error

  const needs = new Map<string, { articleId: string; unitId: string; quantity: number }>()
  for (const eventRecipe of event.event_recipes ?? []) {
    const recipe = Array.isArray(eventRecipe.recipes) ? eventRecipe.recipes[0] : eventRecipe.recipes
    if (!recipe) continue
    const consumed = Number(eventRecipe.portions_consumed ?? 0)
    if (consumed <= 0) continue
    const multiplier = consumed / Math.max(1, Number(recipe.portions ?? 1))

    for (const ingredient of recipe.recipe_ingredients ?? []) {
      const articleId = ingredient.article_id
      const unitId = ingredient.unit_stored ?? ingredient.unit_id
      const quantity = Number(ingredient.quantity_stored ?? ingredient.quantity ?? 0) * multiplier
      if (!articleId || !unitId || quantity <= 0) continue
      const key = `${articleId}:${unitId}`
      const current = needs.get(key)
      needs.set(key, {
        articleId,
        unitId,
        quantity: Number(current?.quantity ?? 0) + quantity,
      })
    }
  }

  let inserted = 0
  for (const need of needs.values()) {
    const available = await getStockQuantity(need.articleId)
    if (available + 0.0001 < need.quantity) {
      throw new Error('Stock insuffisant pour cette production')
    }

    let remaining = need.quantity
    const { data: rawLocationRows, error: locationError } = await supabase.schema('stock')
      .from('stock_location_view')
      .select('location_id, quantity')
      .eq('article_id', need.articleId)
      .gt('quantity', 0)
    if (locationError) throw locationError

    const locationMap = new Map<string, number>()
    for (const locationRow of rawLocationRows ?? []) {
      locationMap.set(locationRow.location_id, Number(locationMap.get(locationRow.location_id) ?? 0) + Number(locationRow.quantity ?? 0))
    }
    const locationRows = Array.from(locationMap.entries()).map(([location_id, quantity]) => ({ location_id, quantity })).filter((row) => row.quantity > 0)

    for (const locationRow of locationRows) {
      if (remaining <= 0) break
      const quantity = Math.min(Number(locationRow.quantity ?? 0), remaining)
      if (quantity <= 0) continue

      const { error: insertError } = await supabase.schema('stock').from('stock_movements').insert({
        article_id: need.articleId,
        quantity,
        unit_id: need.unitId,
        movement_type: 'consommation',
        from_location_id: locationRow.location_id,
        movement_date: String(event.date).slice(0, 10),
        reference_type: 'event_production',
        reference_id: eventId,
        status: 'normal',
        is_manual: false,
        comment: 'Sortie automatique production',
        created_by: profileId,
        updated_by: profileId,
      })
      if (insertError) throw insertError
      remaining -= quantity
      inserted += 1
    }
  }

  return inserted
}

async function isArticleAllowedInLocation(articleId: string, locationId: string) {
  return checkArticleAllowedAtLocation(articleId, locationId)
}

export function stockStatus(row: StockRow) {
  if (row.initialization_status === 'to_initialize') return 'a_initialiser'
  if (row.initialization_status === 'unconfirmed') return 'initial_non_confirme'
  const quantity = Number(row.total_quantity ?? 0)
  const min = Number(row.articles?.min_stock ?? 0)
  if (quantity <= 0) return 'rupture'
  if (min > 0 && quantity < min) return 'bas'
  if (min > 0 && quantity === min) return 'minimum'
  return 'normal'
}
