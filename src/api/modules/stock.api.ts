import { supabase } from '../../lib/supabase'
import { isRetroactive } from '../../lib/stock'
import type { ManualMovementFormValues, MovementType, PriceHistoryRow, StockArticleDetail, StockMovement, StockRow, TransferFormValues } from '../../lib/stock'

type StockFilters = {
  search?: string
  familyId?: string
  locationId?: string
  status?: 'all' | 'low' | 'normal' | 'out'
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

function cleanNullable(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export async function listStock(filters: StockFilters = {}) {
  const { data, error } = await supabase.schema('stock').from('stock_view').select('*')
  if (error) throw error

  const stockRows = data ?? []
  const articleIds = Array.from(new Set(stockRows.map((row) => row.article_id).filter(Boolean)))

  const { data: articlesData, error: articlesError } = articleIds.length
    ? await supabase.schema('stock')
        .from('articles')
        .select('id, name, min_stock, families(id, name), units(id, name, abbreviation)')
        .in('id', articleIds)
    : { data: [], error: null }
  if (articlesError) throw articlesError

  const { data: locationsData, error: locationsError } = await supabase.schema('stock').from('stock_location_view').select('*')
  if (locationsError) throw locationsError

  const locationIds = Array.from(new Set((locationsData ?? []).map((row) => row.location_id).filter(Boolean)))
  const { data: locationRefs, error: locationRefsError } = locationIds.length
    ? await supabase.schema('stock').from('locations').select('id, name').in('id', locationIds)
    : { data: [], error: null }
  if (locationRefsError) throw locationRefsError

  const articlesById = new Map((articlesData ?? []).map((article) => [article.id, article]))
  const locationsById = new Map((locationRefs ?? []).map((location) => [location.id, location]))

  let rows = stockRows.map((row) => {
    const locationMap = new Map<string, { location_id: string; location_name: string; quantity: number }>()
    ;(locationsData ?? [])
      .filter((locationRow) => locationRow.article_id === row.article_id && Number(locationRow.quantity ?? 0) !== 0)
      .forEach((locationRow) => {
        const key = locationRow.location_id
        const current = locationMap.get(key)
        locationMap.set(key, {
          location_id: key,
          location_name: locationsById.get(key)?.name ?? '',
          quantity: Number(current?.quantity ?? 0) + Number(locationRow.quantity ?? 0),
        })
      })

    return {
      ...row,
      articles: articlesById.get(row.article_id),
      locations: Array.from(locationMap.values()),
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
      if (filters.status === 'low') return quantity > 0 && minStock > 0 && quantity <= minStock
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

export async function createTransfer(values: TransferFormValues, profileId: string, role?: string): Promise<StockActionResult> {
  if (values.from_location_id === values.to_location_id) throw new Error("La destination doit être différente de l'origine")
  if (isRetroactive(values.movement_date) && !values.reason.trim()) throw new Error('Veuillez saisir un motif pour le mouvement rétroactif')

  const allowed = await isArticleAllowedInLocation(values.article_id, values.to_location_id)
  if (!allowed) throw new Error("Cette localisation n'est pas autorisée pour cet article")

  const available = await getStockQuantity(values.article_id, values.from_location_id)
  if (available < values.quantity) throw new Error('Stock insuffisant pour ce transfert')

  const retro = isRetroactive(values.movement_date)
  const needsValidation = retro && role !== 'direction'
  const { error } = await supabase.schema('stock').from('stock_movements').insert({
    article_id: values.article_id,
    quantity: values.quantity,
    unit_id: values.unit_id,
    movement_type: 'transfert',
    from_location_id: values.from_location_id,
    to_location_id: values.to_location_id,
    movement_date: values.movement_date,
    status: needsValidation ? 'en_attente' : retro ? 'retroactif' : 'normal',
    is_retroactive: retro,
    retroactive_date: retro ? values.movement_date : null,
    retroactive_reason: retro ? values.reason : null,
    comment: cleanNullable(values.comment || values.reason),
    created_by: profileId,
    updated_by: profileId,
  })
  if (error) throw error
  return { pendingValidation: needsValidation }
}

export async function createManualMovement(values: ManualMovementFormValues, profileId: string, role?: string): Promise<StockActionResult> {
  const retro = isRetroactive(values.movement_date)
  const directionOnly = values.movement_type !== 'sortie' || retro
  if (retro && !values.retroactive_reason?.trim()) throw new Error('Veuillez saisir un motif pour le mouvement rétroactif')
  if (['entree', 'correction', 'ajustement'].includes(values.movement_type) && (!values.unit_cost || values.unit_cost <= 0)) {
    throw new Error('Le prix unitaire est obligatoire pour ce type de mouvement')
  }
  if (values.movement_type === 'sortie') {
    const available = await getStockQuantity(values.article_id, values.location_id)
    if (available < values.quantity) throw new Error('Stock insuffisant pour ce transfert')
  }

  const needsValidation = directionOnly && role !== 'direction'
  const isInbound = values.movement_type === 'entree' || values.movement_type === 'correction' || values.movement_type === 'ajustement'
  const { error } = await supabase.schema('stock').from('stock_movements').insert({
    article_id: values.article_id,
    quantity: values.quantity,
    unit_id: values.unit_id,
    movement_type: values.movement_type,
    from_location_id: isInbound ? null : values.location_id,
    to_location_id: isInbound ? values.location_id : null,
    movement_date: values.movement_date,
    status: needsValidation ? 'en_attente' : retro ? 'retroactif' : 'normal',
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
  return { pendingValidation: needsValidation }
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

export async function validateMovement(id: string, profileId?: string) {
  const { error } = await supabase.schema('stock')
    .from('stock_movements')
    .update({
      status: 'valide',
      manual_validated_by: profileId,
      manual_validated_at: new Date().toISOString(),
      retroactive_validated_by: profileId,
      retroactive_validated_at: new Date().toISOString(),
      updated_by: profileId,
    })
    .eq('id', id)
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
    const { data: existing } = await supabase.schema('stock').from('stock_movements').select('id').eq('reception_item_id', pending.reception_item_id).limit(1)
    if ((existing ?? []).length > 0) continue
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
      unit_cost: pending.reception_items?.unit_price_real,
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
    .select('id, date, event_recipes(*, recipes(portions, recipe_ingredients(article_id, quantity, quantity_stored, unit_id, unit_stored, unit_price)))')
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
  const { count, error } = await supabase.schema('stock')
    .from('article_locations')
    .select('id', { count: 'exact', head: true })
    .eq('article_id', articleId)
    .eq('location_id', locationId)
  if (error) throw error
  return (count ?? 0) > 0
}

export function stockStatus(row: StockRow) {
  const quantity = Number(row.total_quantity ?? 0)
  const min = Number(row.articles?.min_stock ?? 0)
  if (quantity <= 0) return 'rupture'
  if (min > 0 && quantity <= min) return 'bas'
  return 'normal'
}
