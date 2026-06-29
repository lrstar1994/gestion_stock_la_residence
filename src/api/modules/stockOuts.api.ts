import { supabase } from '../../lib/supabase'
import { getEvent } from './events.api'
import { getStockQuantity } from './stock.api'
import { computeConsumptionType } from '../../lib/stockOuts'
import type { ConsumptionAnalysisRow, StockOut, StockOutDestination, StockOutFormValues } from '../../lib/stockOuts'

type StockOutFilters = {
  search?: string
  destination?: StockOutDestination | 'all'
  locationId?: string
  articleId?: string
  userId?: string
  fromDate?: string
  toDate?: string
  page?: number
  pageSize?: number
}

function cleanNullable(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export async function listStockOuts(filters: StockOutFilters = {}) {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 20
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase.schema('stock')
    .from('stock_outs')
    .select('*, articles(id, name, families(id, name)), units(id, name, abbreviation), locations(id, name), recipes(id, name, code), events(id, name), creator:profiles!stock_outs_created_by_fkey(id, full_name), validator:profiles!stock_outs_validated_by_fkey(id, full_name)', { count: 'exact' })
    .order('out_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filters.destination && filters.destination !== 'all') query = query.eq('destination', filters.destination)
  if (filters.locationId) query = query.eq('location_id', filters.locationId)
  if (filters.articleId) query = query.eq('article_id', filters.articleId)
  if (filters.userId) query = query.eq('created_by', filters.userId)
  if (filters.fromDate) query = query.gte('out_date', filters.fromDate)
  if (filters.toDate) query = query.lte('out_date', filters.toDate)
  if (filters.search?.trim()) query = query.ilike('reason', `%${filters.search.trim()}%`)

  const { data, error, count } = await query
  if (error) throw error
  return { stockOuts: await enrichStockOutMovements((data ?? []) as StockOut[]), total: count ?? 0 }
}

export async function getStockOut(id: string) {
  const { data, error } = await supabase.schema('stock')
    .from('stock_outs')
    .select('*, articles(id, name, families(id, name)), units(id, name, abbreviation), locations(id, name), recipes(id, name, code), events(id, name), creator:profiles!stock_outs_created_by_fkey(id, full_name), validator:profiles!stock_outs_validated_by_fkey(id, full_name)')
    .eq('id', id)
    .single()
  if (error) throw error
  const [stockOut] = await enrichStockOutMovements([data as StockOut])
  return stockOut
}

async function enrichStockOutMovements(rows: StockOut[]) {
  const movementIds = Array.from(new Set(rows.flatMap((row) => [row.stock_movement_id, row.return_movement_id]).filter(Boolean))) as string[]
  if (movementIds.length === 0) return rows

  const { data, error } = await supabase.schema('stock')
    .from('stock_movements')
    .select('id, movement_reference, unit_cost, total_cost, price_source')
    .in('id', movementIds)
  if (error) throw error

  const movements = new Map((data ?? []).map((movement) => [movement.id, movement]))
  return rows.map((row) => ({
    ...row,
    stock_movement: row.stock_movement_id ? movements.get(row.stock_movement_id) : undefined,
    return_movement: row.return_movement_id ? movements.get(row.return_movement_id) : undefined,
  }))
}

export async function createStockOut(values: StockOutFormValues, profileId: string, role?: string) {
  return (await createStockOutRows(values, profileId, role)).length
}

export async function createStockOutRows(values: StockOutFormValues, profileId: string, role?: string) {
  if (!values.destination) throw new Error('La destination est obligatoire pour cette sortie')
  if (!values.reason.trim()) throw new Error('Le motif doit etre renseigne')

  const createdIds: string[] = []
  for (const item of values.items) {
    const allowed = await isArticleAllowedInLocation(item.article_id, item.location_id)
    if (!allowed) throw new Error("Cette localisation n'est pas autorisee pour cet article")

    const needsValidation = role !== 'direction' && (values.out_date < new Date().toISOString().slice(0, 10) || item.is_loss || values.destination === 'perte' || values.destination === 'casse')
    const available = await getStockQuantity(item.article_id, item.location_id)
    if (!needsValidation && available < item.quantity) throw new Error('Stock insuffisant pour cette sortie')

    const consumptionType = computeConsumptionType(item.quantity, item.theoretical_quantity, item.is_loss || values.destination === 'perte' || values.destination === 'casse')
    const { data, error } = await supabase.schema('stock')
      .from('stock_outs')
      .insert({
        article_id: item.article_id,
        quantity: item.quantity,
        unit_id: item.unit_id,
        location_id: item.location_id,
        destination: values.destination,
        out_date: values.out_date,
        recipe_id: item.recipe_id || null,
        event_id: values.event_id || null,
        theoretical_quantity: item.theoretical_quantity ?? null,
        consumption_type: consumptionType,
        is_loss: item.is_loss || values.destination === 'perte' || values.destination === 'casse',
        loss_type: item.loss_type ?? (values.destination === 'casse' ? 'casse' : values.destination === 'perte' ? 'autre' : null),
        loss_comment: cleanNullable(item.loss_comment),
        is_additional: item.is_additional,
        is_return: item.is_return,
        return_quantity: item.is_return ? Number(item.return_quantity ?? 0) : null,
        reason: values.reason.trim(),
        comment: cleanNullable(values.comment),
        created_by: profileId,
        updated_by: profileId,
        status: needsValidation ? 'en_attente' : 'valide',
        validated_by: needsValidation ? null : profileId,
        validated_at: needsValidation ? null : new Date().toISOString(),
      })
      .select('id')
      .single()
    if (error) throw error

    if (!needsValidation) await applyStockOutMovement(data.id, profileId)
    createdIds.push(data.id as string)
  }
  return createdIds
}

export async function validateStockOut(id: string, profileId: string) {
  await applyStockOutMovement(id, profileId)
  const { error } = await supabase.schema('stock')
    .from('stock_outs')
    .update({ status: 'valide', validated_by: profileId, validated_at: new Date().toISOString(), updated_by: profileId })
    .eq('id', id)
  if (error) throw error
}

async function applyStockOutMovement(id: string, profileId: string) {
  const { data: stockOut, error } = await supabase.schema('stock').from('stock_outs').select('*').eq('id', id).single()
  if (error) throw error
  if (stockOut.stock_movement_id) return

  const allowed = await isArticleAllowedInLocation(stockOut.article_id, stockOut.location_id)
  if (!allowed) throw new Error("Cette localisation n'est pas autorisee pour cet article")

  const available = await getStockQuantity(stockOut.article_id, stockOut.location_id)
  if (available < Number(stockOut.quantity ?? 0)) throw new Error('Stock insuffisant pour cette sortie')

  const movementType = stockOut.is_loss ? 'perte' : stockOut.destination === 'consommation_interne' ? 'consommation' : 'sortie'
  const { data: movement, error: movementError } = await supabase.schema('stock')
    .from('stock_movements')
    .insert({
      article_id: stockOut.article_id,
      quantity: stockOut.quantity,
      unit_id: stockOut.unit_id,
      movement_type: movementType,
      from_location_id: stockOut.location_id,
      movement_date: stockOut.out_date,
      reference_type: 'stock_out',
      reference_id: id,
      status: stockOut.out_date < new Date().toISOString().slice(0, 10) ? 'retroactif' : 'normal',
      is_retroactive: stockOut.out_date < new Date().toISOString().slice(0, 10),
      retroactive_date: stockOut.out_date < new Date().toISOString().slice(0, 10) ? stockOut.out_date : null,
      retroactive_reason: stockOut.out_date < new Date().toISOString().slice(0, 10) ? stockOut.reason : null,
      comment: stockOut.reason,
      created_by: profileId,
      updated_by: profileId,
    })
    .select('id')
    .single()
  if (movementError) throw movementError

  let returnMovementId: string | null = null
  if (stockOut.is_return && Number(stockOut.return_quantity ?? 0) > 0) {
    const unitCost = await getAverageStockCost(stockOut.article_id)
    const { data: returnMovement, error: returnError } = await supabase.schema('stock')
      .from('stock_movements')
      .insert({
        article_id: stockOut.article_id,
        quantity: stockOut.return_quantity,
        unit_id: stockOut.unit_id,
        movement_type: 'retour',
        to_location_id: stockOut.location_id,
        movement_date: stockOut.out_date,
        reference_type: 'stock_out_return',
        reference_id: id,
        status: 'normal',
        unit_cost: unitCost,
        price_source: 'average',
        comment: `Retour sortie ${stockOut.reference}`,
        created_by: profileId,
        updated_by: profileId,
      })
      .select('id')
      .single()
    if (returnError) throw returnError
    returnMovementId = returnMovement.id
  }

  const { error: updateError } = await supabase.schema('stock').from('stock_outs').update({ stock_movement_id: movement.id, return_movement_id: returnMovementId, updated_by: profileId }).eq('id', id)
  if (updateError) throw updateError
}

async function getAverageStockCost(articleId: string) {
  const { data, error } = await supabase.schema('stock').from('stock_view').select('average_price').eq('article_id', articleId).maybeSingle()
  if (error) throw error
  return Number(data?.average_price ?? 0)
}

export async function loadStockOutItemsFromEvent(eventId: string, locationId = '') {
  const event = await getEvent(eventId)
  const items = new Map<string, {
    article_id: string
    quantity: number
    unit_id: string
    location_id: string
    theoretical_quantity: number
    recipe_id: string
    is_additional: boolean
    is_return: boolean
    return_quantity: number
    is_loss: boolean
    loss_comment: string
  }>()

  for (const eventRecipe of event.event_recipes ?? []) {
    if (!eventRecipe.recipes) continue
    const multiplier = Number(eventRecipe.portions_planned ?? 0) / Math.max(1, Number(eventRecipe.recipes.portions ?? 1))
    for (const ingredient of eventRecipe.recipes.recipe_ingredients ?? []) {
      const articleId = ingredient.article_id
      const unitId = ingredient.unit_stored ?? ingredient.articles?.unit_id ?? ingredient.unit_id
      const quantity = Number(ingredient.quantity_stored ?? ingredient.quantity ?? 0) * multiplier
      if (!articleId || !unitId || quantity <= 0) continue
      const key = `${articleId}:${unitId}`
      const current = items.get(key)
      items.set(key, {
        article_id: articleId,
        quantity: Number(current?.quantity ?? 0) + quantity,
        unit_id: unitId,
        location_id: locationId,
        theoretical_quantity: Number(current?.theoretical_quantity ?? 0) + quantity,
        recipe_id: eventRecipe.recipe_id,
        is_additional: false,
        is_return: false,
        return_quantity: 0,
        is_loss: false,
        loss_comment: '',
      })
    }
  }

  return Array.from(items.values())
}

export async function getConsumptionAnalysis(filters: Pick<StockOutFilters, 'fromDate' | 'toDate' | 'destination'> = {}) {
  const result = await listStockOuts({ ...filters, page: 1, pageSize: 1000 })
  const rows = new Map<string, ConsumptionAnalysisRow>()
  for (const stockOut of result.stockOuts) {
    const key = `${stockOut.article_id}:${stockOut.destination}:${stockOut.consumption_type ?? 'normale'}`
    const current = rows.get(key)
    rows.set(key, {
      article_id: stockOut.article_id,
      article_name: stockOut.articles?.name ?? '',
      family_name: stockOut.articles?.families?.name ?? '',
      destination: stockOut.destination,
      quantity: Number(current?.quantity ?? 0) + Number(stockOut.quantity ?? 0),
      theoretical_quantity: Number(current?.theoretical_quantity ?? 0) + Number(stockOut.theoretical_quantity ?? 0),
      difference: Number(current?.difference ?? 0) + Number(stockOut.difference ?? 0),
      cost: Number(current?.cost ?? 0) + Number(stockOut.stock_movement?.total_cost ?? 0),
      consumption_type: stockOut.consumption_type ?? 'normale',
    })
  }
  return Array.from(rows.values())
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
