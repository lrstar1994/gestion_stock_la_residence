import { supabase } from '../../lib/supabase'
import { getStockQuantity } from './stock.api'
import { createStockOutRows } from './stockOuts.api'
import { calculateSaleTotals, salesPointLabels } from '../../lib/sales'
import type { Sale, SaleFormValues, SalesStatsPayload, SaleStatsRow, SalesChannel, SalesPoint, SalesStatus, ServiceMode } from '../../lib/sales'

type SalesFilters = {
  search?: string
  channel?: SalesChannel | 'all'
  serviceMode?: ServiceMode | 'all'
  salesPoint?: SalesPoint | 'all'
  status?: SalesStatus | 'all'
  articleId?: string
  fromDate?: string
  toDate?: string
  page?: number
  pageSize?: number
}

function cleanNullable(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export async function listSales(filters: SalesFilters = {}) {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 10
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase.schema('stock')
    .from('sales')
    .select('*, events(id, name), creator:profiles!sales_created_by_fkey(id, full_name), sale_items(*, articles(id, name, unit_id, families(id, name), units(id, name, abbreviation)))', { count: 'exact' })
    .order('sale_date', { ascending: false })
    .range(from, to)

  if (filters.channel && filters.channel !== 'all') query = query.eq('channel', filters.channel)
  if (filters.serviceMode && filters.serviceMode !== 'all') query = query.eq('service_mode', filters.serviceMode)
  if (filters.salesPoint && filters.salesPoint !== 'all') query = query.eq('sales_point', filters.salesPoint)
  if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status)
  if (filters.fromDate) query = query.gte('sale_date', filters.fromDate)
  if (filters.toDate) query = query.lte('sale_date', `${filters.toDate}T23:59:59`)
  if (filters.search?.trim()) {
    const term = filters.search.trim()
    query = query.or(`reference.ilike.%${term}%,client_name.ilike.%${term}%`)
  }

  const { data, error, count } = await query
  if (error) throw error
  return { sales: (data ?? []) as Sale[], total: count ?? 0 }
}

export async function getSale(id: string) {
  const { data, error } = await supabase.schema('stock')
    .from('sales')
    .select('*, events(id, name), creator:profiles!sales_created_by_fkey(id, full_name), canceller:profiles!sales_cancelled_by_fkey(id, full_name), sale_items(*, articles(id, name, unit_id, families(id, name), units(id, name, abbreviation)), recipes(id, name, code, final_price, total_cost)), sale_stock_outs(*, stock_outs(*, articles(id, name), units(id, name, abbreviation), locations(id, name))), sale_returns(*, stock_movements(id, movement_reference, quantity, unit_cost, total_cost), creator:profiles!sale_returns_created_by_fkey(id, full_name))')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as Sale
}

export async function createSale(values: SaleFormValues, profileId: string, role?: string) {
  await validateSaleValues(values)
  const totals = calculateSaleTotals(values.items)

  const { data: sale, error } = await supabase.schema('stock')
    .from('sales')
    .insert({
      sale_date: values.sale_date,
      channel: values.channel,
      service_mode: values.service_mode,
      sales_point: values.sales_point,
      client_name: cleanNullable(values.client_name),
      comment: cleanNullable(values.comment),
      total_before_discount: totals.beforeDiscount,
      total_discount: totals.discount,
      total_after_discount: totals.afterDiscount,
      event_id: values.event_id || null,
      created_by: profileId,
      updated_by: profileId,
    })
    .select('id')
    .single()
  if (error) throw error

  for (const item of values.items) {
    const billableQuantity = Math.max(0, Number(item.quantity) - Number(item.quantity_offered ?? 0))
    const { data: saleItem, error: itemError } = await supabase.schema('stock')
      .from('sale_items')
      .insert({
        sale_id: sale.id,
        article_id: item.article_id,
        product_type: item.product_type,
        quantity: item.quantity,
        quantity_offered: item.quantity_offered,
        unit_price: item.unit_price,
        discount: item.discount,
        offer_reason: cleanNullable(item.offer_reason),
        comment: cleanNullable(item.comment),
        recipe_id: item.recipe_id || null,
      })
      .select('id')
      .single()
    if (itemError) throw itemError

    if (billableQuantity <= 0) continue
    const stockOutIds = await createStockOutRows({
      event_id: values.event_id,
      out_date: values.sale_date.slice(0, 10),
      destination: mapSalePointToStockDestination(values.sales_point),
      reason: `Vente ${salesPointLabels[values.sales_point]}`,
      comment: values.comment,
      items: [{
        article_id: item.article_id,
        quantity: billableQuantity,
        unit_id: await getArticleUnitId(item.article_id),
        location_id: values.location_id,
        theoretical_quantity: billableQuantity,
        recipe_id: '',
        is_additional: false,
        is_return: false,
        return_quantity: 0,
        is_loss: false,
        loss_comment: '',
      }],
    }, profileId, role)

    for (const stockOutId of stockOutIds) {
      const { error: linkError } = await supabase.schema('stock').from('sale_stock_outs').insert({
        sale_id: sale.id,
        sale_item_id: saleItem.id,
        stock_out_id: stockOutId,
      })
      if (linkError) throw linkError
    }
  }

  return sale.id as string
}

export async function cancelSale(id: string, profileId: string, reason: string) {
  const sale = await getSale(id)
  if (sale.status === 'annulee') throw new Error('Cette vente a deja ete annulee')
  if (!reason.trim()) throw new Error('Motif obligatoire')

  for (const link of sale.sale_stock_outs ?? []) {
    const stockOut = link.stock_outs
    if (!stockOut) continue
    const unitCost = await getAverageStockCost(stockOut.article_id)
    const { error: movementError } = await supabase.schema('stock').from('stock_movements').insert({
      article_id: stockOut.article_id,
      quantity: stockOut.quantity,
      unit_id: stockOut.unit_id,
      movement_type: 'retour',
      to_location_id: stockOut.location_id,
      movement_date: new Date().toISOString().slice(0, 10),
      reference_type: 'sale_cancellation',
      reference_id: id,
      status: 'normal',
      unit_cost: unitCost,
      price_source: 'average',
      comment: `Annulation vente ${sale.reference}`,
      created_by: profileId,
      updated_by: profileId,
    })
    if (movementError) throw movementError
  }

  const { error } = await supabase.schema('stock')
    .from('sales')
    .update({
      status: 'annulee',
      cancelled_by: profileId,
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason.trim(),
      updated_by: profileId,
    })
    .eq('id', id)
  if (error) throw error
}

export async function returnSaleItem(params: { saleId: string; saleItemId: string; quantity: number; reason: string; profileId: string }) {
  if (params.quantity <= 0) throw new Error('La quantite ne peut pas etre negative')
  if (!params.reason.trim()) throw new Error('Motif obligatoire')
  const sale = await getSale(params.saleId)
  if (sale.status === 'annulee') throw new Error('Cette vente a deja ete annulee')
  const item = sale.sale_items?.find((row) => row.id === params.saleItemId)
  if (!item) throw new Error('Article de vente introuvable')

  const alreadyReturned = Number(item.returned_quantity ?? 0)
  const maxReturn = Math.max(0, Number(item.quantity ?? 0) - Number(item.quantity_offered ?? 0) - alreadyReturned)
  if (params.quantity > maxReturn) throw new Error('La quantite retournee depasse la quantite vendue')

  const stockOut = sale.sale_stock_outs?.find((link) => link.sale_item_id === item.id)?.stock_outs
  if (!stockOut) throw new Error('Sortie de stock introuvable')
  const unitCost = await getAverageStockCost(stockOut.article_id)
  const { data: movement, error: movementError } = await supabase.schema('stock')
    .from('stock_movements')
    .insert({
      article_id: stockOut.article_id,
      quantity: params.quantity,
      unit_id: stockOut.unit_id,
      movement_type: 'retour',
      to_location_id: stockOut.location_id,
      movement_date: new Date().toISOString().slice(0, 10),
      reference_type: 'sale_partial_return',
      reference_id: params.saleId,
      status: 'normal',
      unit_cost: unitCost,
      price_source: 'average',
      comment: `Retour partiel vente ${sale.reference}`,
      created_by: params.profileId,
      updated_by: params.profileId,
    })
    .select('id')
    .single()
  if (movementError) throw movementError

  const { error: returnError } = await supabase.schema('stock').from('sale_returns').insert({
    sale_id: params.saleId,
    sale_item_id: params.saleItemId,
    quantity: params.quantity,
    reason: params.reason.trim(),
    stock_movement_id: movement.id,
    created_by: params.profileId,
  })
  if (returnError) throw returnError

  const newReturned = alreadyReturned + params.quantity
  const { error: itemError } = await supabase.schema('stock')
    .from('sale_items')
    .update({ returned_quantity: newReturned, return_reason: params.reason.trim() })
    .eq('id', params.saleItemId)
  if (itemError) throw itemError

  if ((sale.sale_items ?? []).every((row) => row.id === params.saleItemId ? newReturned >= Math.max(0, Number(row.quantity) - Number(row.quantity_offered ?? 0)) : Number(row.returned_quantity ?? 0) >= Math.max(0, Number(row.quantity) - Number(row.quantity_offered ?? 0)))) {
    await supabase.schema('stock').from('sales').update({ status: 'retournee', updated_by: params.profileId }).eq('id', params.saleId)
  }
}

export async function getSalePriceSuggestions() {
  const [{ data: stockPrices, error: stockError }, { data: recipes, error: recipeError }] = await Promise.all([
    supabase.schema('stock').from('stock_view').select('article_id, last_price, average_price'),
    supabase.schema('stock').from('recipes').select('id, code, name, final_price, total_cost').eq('status', 'validee').order('name', { ascending: true }),
  ])
  if (stockError) throw stockError
  if (recipeError) throw recipeError
  const rawPrices = new Map<string, { lastPrice: number; averagePrice: number; suggestedPrice: number }>()
  for (const row of stockPrices ?? []) {
    const average = Number(row.average_price ?? row.last_price ?? 0)
    rawPrices.set(row.article_id, {
      lastPrice: Number(row.last_price ?? 0),
      averagePrice: average,
      suggestedPrice: Math.round(average * 1.3),
    })
  }
  return { rawPrices, recipes: recipes ?? [] }
}

export async function getSalesStats(filters: Pick<SalesFilters, 'fromDate' | 'toDate' | 'channel' | 'serviceMode' | 'salesPoint'> = {}): Promise<SalesStatsPayload> {
  const { sales } = await listSales({ ...filters, page: 1, pageSize: 10000, status: 'validee' })
  const offeredValue = sales.reduce((sum, sale) => sum + (sale.sale_items ?? []).reduce((itemSum, item) => itemSum + Number(item.quantity_offered ?? 0) * Number(item.unit_price ?? 0), 0), 0)
  const returnedQuantity = sales.reduce((sum, sale) => sum + (sale.sale_items ?? []).reduce((itemSum, item) => itemSum + Number(item.returned_quantity ?? 0), 0), 0)
  const revenue = sales.reduce((sum, sale) => sum + Number(sale.total_after_discount ?? 0), 0)
  return {
    byArticle: aggregateStats(sales, (_sale, item) => item.articles?.name ?? item.article_id),
    byFamily: aggregateStats(sales, (_sale, item) => item.articles?.families?.name ?? 'Sans famille'),
    byChannel: aggregateStats(sales, (sale) => sale.channel),
    byService: aggregateStats(sales, (sale) => sale.service_mode),
    byPoint: aggregateStats(sales, (sale) => sale.sales_point),
    byDay: aggregateStats(sales, (sale) => sale.sale_date.slice(0, 10)),
    byMonth: aggregateStats(sales, (sale) => sale.sale_date.slice(0, 7)),
    offers: aggregateOfferStats(sales),
    summary: {
      salesCount: sales.length,
      revenue,
      averageBasket: sales.length > 0 ? revenue / sales.length : 0,
      offeredValue,
      returnedQuantity,
    },
  }
}

function aggregateStats(sales: Sale[], keyGetter: (sale: Sale, item: NonNullable<Sale['sale_items']>[number]) => string): SaleStatsRow[] {
  const rows = new Map<string, SaleStatsRow>()
  for (const sale of sales) {
    for (const item of sale.sale_items ?? []) {
      const key = keyGetter(sale, item)
      const quantity = Number(item.quantity ?? 0)
      const revenue = Number(item.total_after_discount ?? Math.max(0, (quantity - Number(item.quantity_offered ?? 0)) * Number(item.unit_price ?? 0) - Number(item.discount ?? 0)))
      const current = rows.get(key)
      const nextQuantity = Number(current?.quantity ?? 0) + quantity
      const nextRevenue = Number(current?.revenue ?? 0) + revenue
      rows.set(key, {
        key,
        label: key,
        quantity: nextQuantity,
        revenue: nextRevenue,
        averagePrice: nextQuantity > 0 ? nextRevenue / nextQuantity : 0,
      })
    }
  }
  return Array.from(rows.values()).sort((a, b) => b.revenue - a.revenue)
}

function aggregateOfferStats(sales: Sale[]): SaleStatsRow[] {
  const rows = new Map<string, SaleStatsRow>()
  for (const sale of sales) {
    for (const item of sale.sale_items ?? []) {
      const quantity = Number(item.quantity_offered ?? 0)
      if (quantity <= 0) continue
      const key = item.offer_reason || 'Offre sans motif'
      const revenue = quantity * Number(item.unit_price ?? 0)
      const current = rows.get(key)
      const nextQuantity = Number(current?.quantity ?? 0) + quantity
      const nextRevenue = Number(current?.revenue ?? 0) + revenue
      rows.set(key, { key, label: key, quantity: nextQuantity, revenue: nextRevenue, averagePrice: nextQuantity > 0 ? nextRevenue / nextQuantity : 0 })
    }
  }
  return Array.from(rows.values()).sort((a, b) => b.revenue - a.revenue)
}

async function getArticleUnitId(articleId: string) {
  const { data, error } = await supabase.schema('stock').from('articles').select('unit_id').eq('id', articleId).single()
  if (error) throw error
  return data.unit_id as string
}

async function getAverageStockCost(articleId: string) {
  const { data, error } = await supabase.schema('stock').from('stock_view').select('average_price').eq('article_id', articleId).maybeSingle()
  if (error) throw error
  return Number(data?.average_price ?? 0)
}

async function validateSaleValues(values: SaleFormValues) {
  for (const item of values.items) {
    if (item.quantity < 0) throw new Error('La quantite ne peut pas etre negative')
    if (item.unit_price <= 0) throw new Error('Le prix unitaire doit etre superieur a 0')
    if (item.quantity_offered > item.quantity) throw new Error('La quantite offerte ne peut pas depasser la quantite vendue')
    if (item.quantity_offered > 0 && !item.offer_reason?.trim()) throw new Error('Le motif est obligatoire pour une offre')
    const billableQuantity = Math.max(0, Number(item.quantity) - Number(item.quantity_offered ?? 0))
    const available = await getStockQuantity(item.article_id, values.location_id)
    if (available < billableQuantity) throw new Error('Stock insuffisant pour cette vente')
  }
}

function mapSalePointToStockDestination(point: SalesPoint) {
  if (point === 'take_away') return 'take_away'
  if (point === 'piscine') return 'piscine'
  if (point === 'chambre') return 'chambre'
  if (point === 'evenement') return 'buffet'
  if (point === 'le_privilege') return 'restaurant'
  return 'restaurant'
}
