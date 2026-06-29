import { supabase } from '../../lib/supabase'
import { listCashPurchases } from './cashPurchases.api'
import { listInitialInventoryStatus } from './inventories.api'
import { listInvoices } from './invoices.api'
import { listPurchaseNeedsGlobal } from './purchaseNeeds.api'
import { listPurchaseOrders } from './purchaseOrders.api'
import { listReceptions } from './receptions.api'
import { getSalesStats, listSales } from './sales.api'
import { listStock, listMovements } from './stock.api'
import { listStockOuts } from './stockOuts.api'
import { salesChannelLabels, salesPointLabels, serviceModeLabels } from '../../lib/sales'
import type { DirectionDashboard, ChartRow, DashboardPeriod, DateRange, DashboardTableRow, TimelineRow } from '../../lib/dashboard'
import type { Sale, SaleStatsRow } from '../../lib/sales'
import type { StockRow } from '../../lib/stock'

export type DashboardFilters = {
  period?: DashboardPeriod
  from?: string
  to?: string
}

type PurchaseItemRow = {
  quantity_ordered: number
  unit_price: number
  articles?: { id: string; name: string; families?: { id: string; name: string } }
  purchase_orders?: { order_date: string; status: string; suppliers?: { id: string; name: string } }
}

export async function getDirectionDashboard(filters: DashboardFilters = {}): Promise<DirectionDashboard> {
  const period = resolvePeriod(filters)
  const today = new Date().toISOString().slice(0, 10)
  const month = resolvePeriod({ period: 'month' })
  const thirtyDays = dateRangeFromDays(29)
  const twelveMonths = dateRangeFromMonths(11)

  const [
    stockRows,
    periodSalesResult,
    todaySalesResult,
    monthSalesResult,
    monthOrdersResult,
    cashResult,
    invoiceResult,
    receptionResult,
    needResult,
    orderResult,
    stockOutResult,
    monthStockOutResult,
    todayStockOutResult,
    movementResult,
    initialRows,
    salesStats,
    sales30Stats,
    purchaseItems,
    stockMovements12Months,
  ] = await Promise.all([
    listStock(),
    listSales({ fromDate: period.from, toDate: period.to, page: 1, pageSize: 10000, status: 'validee' }),
    listSales({ fromDate: today, toDate: today, page: 1, pageSize: 1000, status: 'validee' }),
    listSales({ fromDate: month.from, toDate: month.to, page: 1, pageSize: 10000, status: 'validee' }),
    listPurchaseOrders({ fromDate: month.from, toDate: month.to, page: 1, pageSize: 10000 }),
    listCashPurchases({ page: 1, pageSize: 10000 }),
    listInvoices({ page: 1, pageSize: 10000 }),
    listReceptions({ page: 1, pageSize: 10000 }),
    listPurchaseNeedsGlobal({ page: 1, pageSize: 10000 }),
    listPurchaseOrders({ page: 1, pageSize: 10000 }),
    listStockOuts({ fromDate: period.from, toDate: period.to, page: 1, pageSize: 10000 }),
    listStockOuts({ fromDate: month.from, toDate: month.to, page: 1, pageSize: 10000 }),
    listStockOuts({ fromDate: today, toDate: today, page: 1, pageSize: 1000 }),
    listMovements({ page: 1, pageSize: 10000 }),
    listInitialInventoryStatus(),
    getSalesStats({ fromDate: period.from, toDate: period.to }),
    getSalesStats({ fromDate: thirtyDays.from, toDate: thirtyDays.to }),
    listPurchaseItems(twelveMonths.from, period.to),
    listStockMovements(twelveMonths.from, period.to),
  ])

  const periodSales = periodSalesResult.sales
  const todaySales = todaySalesResult.sales
  const monthSales = monthSalesResult.sales
  const monthOrders = monthOrdersResult.orders
  const cashPurchases = cashResult.purchases
  const invoices = invoiceResult.invoices
  const receptions = receptionResult.receptions
  const needs = needResult.needs
  const orders = orderResult.orders
  const stockOuts = stockOutResult.stockOuts
  const monthStockOuts = monthStockOutResult.stockOuts
  const todayStockOuts = todayStockOutResult.stockOuts
  const movements = movementResult.movements
  const stockValue = stockRows.reduce((sum, row) => sum + stockRowValue(row), 0)
  const lowStockRows = stockRows.filter((row) => isLowStock(row))
  const todayRevenue = sumSales(todaySales)
  const monthlyRevenue = sumSales(monthSales)
  const periodRevenue = sumSales(periodSales)
  const materialCost = sumStockOutCost(stockOuts)
  const monthMaterialCost = sumStockOutCost(monthStockOuts)
  const margin = periodRevenue - materialCost
  const invoicesToPay = invoices.filter((invoice) => ['a_payer', 'validee', 'partiellement_paye'].includes(invoice.status) && Number(invoice.amount_remaining ?? 0) > 0)
  const overdueInvoices = invoicesToPay.filter((invoice) => invoice.due_date < today)
  const activeCashAdvances = cashPurchases.filter((purchase) => !['cloture', 'refuse'].includes(purchase.status))
  const unregularizedAdvances = cashPurchases.filter((purchase) => ['especes_remises', 'retour_partiel', 'retour_complet'].includes(purchase.status) && purchase.status !== 'cloture')
  const anomalyReceptions = receptions.filter((reception) => reception.status === 'validee_avec_anomalies')
  const pendingInventoryCorrections = await countPendingInventoryCorrections()

  return {
    period,
    kpis: {
      stockValue,
      stockArticles: stockRows.filter((row) => Number(row.total_quantity ?? 0) > 0).length,
      lowStockArticles: lowStockRows.length,
      monthlyPurchases: monthOrders.reduce((sum, order) => sum + Number(order.total_amount ?? 0), 0),
      activeCashAdvancesAmount: activeCashAdvances.reduce((sum, purchase) => sum + Number(purchase.amount_given || purchase.amount_validated || purchase.amount_requested || 0), 0),
      unregularizedAdvances: unregularizedAdvances.length,
      invoicesToPay: invoicesToPay.length,
      overdueInvoices: overdueInvoices.length,
      receptionsWithAnomalies: anomalyReceptions.length,
      todayRevenue,
      monthlyRevenue,
      estimatedGrossMargin: monthlyRevenue - monthMaterialCost,
      averageMarginRate: monthlyRevenue > 0 ? ((monthlyRevenue - monthMaterialCost) / monthlyRevenue) * 100 : 0,
    },
    alerts: {
      pendingPurchaseNeeds: needs.filter((need) => need.status === 'a_faire').length,
      urgentPurchaseNeeds: needs.filter((need) => need.urgency === 'tres_urgent' && !['regroupe', 'annule', 'refuse'].includes(need.status)).length,
      pendingCashValidations: cashPurchases.filter((purchase) => purchase.status === 'en_attente').length,
      ordersToReceive: orders.filter((order) => ['envoyee', 'partiellement_livree', 'reception_avec_ecart'].includes(order.status)).length,
      invoicesToPay: invoicesToPay.length,
      overdueInvoices: overdueInvoices.length,
      unresolvedReceptionAnomalies: await countUnresolvedReceptionAnomalies(),
      pendingRetroactiveMovements: movements.filter((movement) => movement.status === 'en_attente' || (movement.is_retroactive && !movement.retroactive_validated_at)).length,
      pendingInventoryCorrections,
      initialInventoriesMissing: initialRows
        .filter((row) => row.status !== 'stock_initial_confirme')
        .slice(0, 10)
        .map((row) => ({ articleName: row.article_name, locationName: row.location_name })),
    },
    stock: {
      lowStockItems: lowStockRows.slice(0, 10).map((row) => ({
        id: row.article_id,
        label: row.articles?.name ?? 'Article',
        description: `${Number(row.total_quantity ?? 0).toLocaleString('fr-FR')} ${row.articles?.units?.abbreviation ?? ''} / seuil ${Number(row.articles?.min_stock ?? 0).toLocaleString('fr-FR')}`,
        amount: stockRowValue(row),
        to: `/stock/articles/${row.article_id}`,
      })),
      valueByFamily: aggregateStockByFamily(stockRows, 'value'),
      valueByLocation: aggregateStockByLocation(stockRows),
      valueEvolution: buildStockValueTimeline(stockMovements12Months),
      quantityByFamily: aggregateStockByFamily(stockRows, 'quantity'),
    },
    purchases: {
      bySupplier: aggregatePurchaseItems(purchaseItems, 'supplier'),
      byFamily: aggregatePurchaseItems(purchaseItems, 'family'),
      evolution: aggregatePurchaseTimeline(purchaseItems),
      topArticles: aggregatePurchaseItems(purchaseItems, 'article').slice(0, 10),
      activeCashAdvances: activeCashAdvances.slice(0, 8).map((purchase) => ({
        id: purchase.id,
        label: purchase.reference,
        description: purchase.reason,
        amount: Number(purchase.amount_given || purchase.amount_validated || purchase.amount_requested || 0),
        status: purchase.status,
        date: purchase.request_date,
        to: `/cash-purchases/${purchase.id}`,
      })),
      unregularizedAdvances: unregularizedAdvances.slice(0, 8).map((purchase) => ({
        id: purchase.id,
        label: purchase.reference,
        description: purchase.buyer?.full_name ?? purchase.reason,
        amount: Number(purchase.difference ?? 0),
        status: purchase.status,
        date: purchase.request_date,
        to: `/cash-purchases/${purchase.id}`,
      })),
    },
    receptions: {
      bySupplier: aggregateRows(receptions, (reception) => reception.suppliers?.name ?? 'Sans fournisseur', (reception) => Number(reception.total_amount ?? 0)),
      withAnomalies: anomalyReceptions.slice(0, 10).map((reception) => ({
        id: reception.id,
        label: reception.reference,
        description: reception.suppliers?.name ?? 'Fournisseur',
        amount: Number(reception.total_amount ?? 0),
        date: reception.reception_date,
        status: reception.status,
        to: `/receptions/${reception.id}`,
      })),
      conformityRate: receptions.length > 0 ? ((receptions.length - anomalyReceptions.length) / receptions.length) * 100 : 100,
    },
    production: {
      today: todayStockOuts.slice(0, 8).map((out) => ({
        id: out.id,
        label: out.articles?.name ?? 'Article',
        description: out.reason,
        amount: Number(out.stock_movement?.total_cost ?? 0),
        date: out.out_date,
        status: out.consumption_type ?? undefined,
        to: `/stock/stock-out/${out.id}`,
      })),
      monthlyCount: monthStockOuts.length,
      materialCost: monthMaterialCost,
      differences: aggregateRows(monthStockOuts, (out) => out.consumption_type ?? 'non_classe', (out) => Math.abs(Number(out.quantity ?? 0) - Number(out.theoretical_quantity ?? 0))),
    },
    sales: {
      byPoint: relabelStats(statsToChartRows(salesStats.byPoint), salesPointLabels),
      byChannel: relabelStats(statsToChartRows(salesStats.byChannel), salesChannelLabels),
      byService: relabelStats(statsToChartRows(salesStats.byService), serviceModeLabels),
      byFamily: statsToChartRows(salesStats.byFamily),
      topArticles: statsToChartRows(salesStats.byArticle).slice(0, 10),
      evolution30Days: completeDailyTimeline(statsToChartRows(sales30Stats.byDay), thirtyDays),
      evolutionByPoint: buildSalesTimelineByPoint(periodSales),
      todayRows: todaySales.slice(0, 8).map(saleToTableRow),
      monthRows: monthSales.slice(0, 10).map(saleToTableRow),
    },
    finance: {
      materialCost,
      grossMargin: margin,
      marginRate: periodRevenue > 0 ? (margin / periodRevenue) * 100 : 0,
      materialCostRatio: periodRevenue > 0 ? (materialCost / periodRevenue) * 100 : 0,
      marginEvolution: buildMarginTimeline(periodSales, stockOuts),
      marginByFamily: estimateMarginRows(statsToChartRows(salesStats.byFamily)),
      marginByPoint: estimateMarginRows(relabelStats(statsToChartRows(salesStats.byPoint), salesPointLabels)),
    },
  }
}

function resolvePeriod(filters: DashboardFilters): DateRange {
  if (filters.period === 'custom' && filters.from && filters.to) return { from: filters.from, to: filters.to }
  const now = new Date()
  const start = new Date(now)
  if (filters.period === 'today') {
    return { from: toDateInput(now), to: toDateInput(now) }
  }
  if (filters.period === 'week') start.setDate(now.getDate() - 6)
  else if (filters.period === 'quarter') start.setMonth(now.getMonth() - 2, 1)
  else if (filters.period === 'year') start.setMonth(0, 1)
  else start.setDate(1)
  return { from: toDateInput(start), to: toDateInput(now) }
}

function dateRangeFromDays(days: number): DateRange {
  const to = new Date()
  const from = new Date()
  from.setDate(to.getDate() - days)
  return { from: toDateInput(from), to: toDateInput(to) }
}

function dateRangeFromMonths(months: number): DateRange {
  const to = new Date()
  const from = new Date()
  from.setMonth(to.getMonth() - months, 1)
  return { from: toDateInput(from), to: toDateInput(to) }
}

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10)
}

function stockRowValue(row: StockRow) {
  return Number(row.total_quantity ?? 0) * Number(row.average_price ?? row.last_price ?? 0)
}

function isLowStock(row: StockRow) {
  const quantity = Number(row.total_quantity ?? 0)
  const min = Number(row.articles?.min_stock ?? 0)
  return min > 0 && quantity <= min
}

function sumSales(sales: Sale[]) {
  return sales.reduce((sum, sale) => sum + Number(sale.total_after_discount ?? 0), 0)
}

function sumStockOutCost(rows: Awaited<ReturnType<typeof listStockOuts>>['stockOuts']) {
  return rows.reduce((sum, row) => sum + Number(row.stock_movement?.total_cost ?? 0), 0)
}

function aggregateStockByFamily(rows: StockRow[], mode: 'value' | 'quantity'): ChartRow[] {
  return aggregateRows(rows, (row) => row.articles?.families?.name ?? 'Sans famille', (row) => mode === 'value' ? stockRowValue(row) : Number(row.total_quantity ?? 0))
}

function aggregateStockByLocation(rows: StockRow[]): ChartRow[] {
  const values = new Map<string, number>()
  for (const row of rows) {
    const unitValue = Number(row.average_price ?? row.last_price ?? 0)
    for (const location of row.locations ?? []) {
      values.set(location.location_name, Number(values.get(location.location_name) ?? 0) + Number(location.quantity ?? 0) * unitValue)
    }
  }
  return mapToChartRows(values)
}

function aggregateRows<T>(rows: T[], keyGetter: (row: T) => string, valueGetter: (row: T) => number): ChartRow[] {
  const values = new Map<string, number>()
  for (const row of rows) {
    const key = keyGetter(row)
    values.set(key, Number(values.get(key) ?? 0) + Number(valueGetter(row) ?? 0))
  }
  return mapToChartRows(values)
}

function mapToChartRows(values: Map<string, number>): ChartRow[] {
  return Array.from(values.entries())
    .map(([label, value]) => ({ label, value }))
    .filter((row) => Number.isFinite(row.value))
    .sort((a, b) => b.value - a.value)
}

function relabelStats<T extends Record<string, string>>(rows: ChartRow[], labels: T): ChartRow[] {
  return rows.map((row) => ({ ...row, label: labels[row.label as keyof T] ?? row.label }))
}

function statsToChartRows(rows: SaleStatsRow[]): ChartRow[] {
  return rows.map((row) => ({ label: row.label, value: Number(row.revenue ?? 0), secondaryValue: Number(row.quantity ?? 0) }))
}

async function listPurchaseItems(from: string, to: string): Promise<PurchaseItemRow[]> {
  const { data, error } = await supabase.schema('stock')
    .from('purchase_order_items')
    .select('quantity_ordered, unit_price, articles(id, name, families(id, name)), purchase_orders!inner(order_date, status, suppliers(id, name))')
    .gte('purchase_orders.order_date', from)
    .lte('purchase_orders.order_date', to)
    .neq('purchase_orders.status', 'annulee')
  if (error) throw error
  return (data ?? []).map((row) => {
    const article = Array.isArray(row.articles) ? row.articles[0] : row.articles
    const family = Array.isArray(article?.families) ? article?.families[0] : article?.families
    const order = Array.isArray(row.purchase_orders) ? row.purchase_orders[0] : row.purchase_orders
    const supplier = Array.isArray(order?.suppliers) ? order?.suppliers[0] : order?.suppliers
    return {
      quantity_ordered: Number(row.quantity_ordered ?? 0),
      unit_price: Number(row.unit_price ?? 0),
      articles: article ? { id: article.id, name: article.name, families: family } : undefined,
      purchase_orders: order ? { order_date: order.order_date, status: order.status, suppliers: supplier } : undefined,
    }
  })
}

async function listStockMovements(from: string, to: string) {
  const { data, error } = await supabase.schema('stock')
    .from('stock_movements')
    .select('movement_date, movement_type, quantity, unit_cost, total_cost')
    .gte('movement_date', from)
    .lte('movement_date', to)
    .in('status', ['normal', 'retroactif', 'valide'])
  if (error) throw error
  return data ?? []
}

function aggregatePurchaseItems(rows: PurchaseItemRow[], mode: 'supplier' | 'family' | 'article'): ChartRow[] {
  return aggregateRows(rows, (row) => {
    if (mode === 'supplier') return row.purchase_orders?.suppliers?.name ?? 'Sans fournisseur'
    if (mode === 'family') return row.articles?.families?.name ?? 'Sans famille'
    return row.articles?.name ?? 'Article'
  }, (row) => Number(row.quantity_ordered ?? 0) * Number(row.unit_price ?? 0))
}

function aggregatePurchaseTimeline(rows: PurchaseItemRow[]): TimelineRow[] {
  return fillMonthlyTimeline(aggregateRows(rows, (row) => String(row.purchase_orders?.order_date ?? '').slice(0, 7), (row) => Number(row.quantity_ordered ?? 0) * Number(row.unit_price ?? 0)))
}

function buildStockValueTimeline(rows: Array<{ movement_date: string; movement_type: string; total_cost: number | null }>): TimelineRow[] {
  const values = new Map<string, number>()
  for (const row of rows) {
    const month = String(row.movement_date).slice(0, 7)
    const sign = ['entree', 'retour', 'correction', 'ajustement'].includes(row.movement_type) ? 1 : -1
    values.set(month, Number(values.get(month) ?? 0) + sign * Number(row.total_cost ?? 0))
  }
  let cumulative = 0
  return fillMonthlyTimeline(mapToChartRows(values)).map((row) => {
    cumulative += row.value
    return { label: row.label, value: cumulative }
  })
}

function fillMonthlyTimeline(rows: ChartRow[]): TimelineRow[] {
  const values = new Map(rows.map((row) => [row.label, row.value]))
  const result: TimelineRow[] = []
  const cursor = new Date()
  cursor.setMonth(cursor.getMonth() - 11, 1)
  for (let index = 0; index < 12; index += 1) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
    result.push({ label: key, value: Number(values.get(key) ?? 0) })
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return result
}

function completeDailyTimeline(rows: ChartRow[], range: DateRange): TimelineRow[] {
  const values = new Map(rows.map((row) => [row.label, row.value]))
  const result: TimelineRow[] = []
  const cursor = new Date(range.from)
  const end = new Date(range.to)
  while (cursor <= end) {
    const key = toDateInput(cursor)
    result.push({ label: key.slice(5), value: Number(values.get(key) ?? 0) })
    cursor.setDate(cursor.getDate() + 1)
  }
  return result
}

function buildSalesTimelineByPoint(sales: Sale[]): Record<string, TimelineRow[]> {
  const byPoint: Record<string, Map<string, number>> = {}
  for (const sale of sales) {
    const point = salesPointLabels[sale.sales_point] ?? sale.sales_point
    const day = sale.sale_date.slice(0, 10)
    byPoint[point] ??= new Map<string, number>()
    byPoint[point].set(day, Number(byPoint[point].get(day) ?? 0) + Number(sale.total_after_discount ?? 0))
  }
  return Object.fromEntries(Object.entries(byPoint).map(([point, values]) => [
    point,
    Array.from(values.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => a.label.localeCompare(b.label)),
  ]))
}

function buildMarginTimeline(sales: Sale[], stockOuts: Awaited<ReturnType<typeof listStockOuts>>['stockOuts']): TimelineRow[] {
  const revenue = aggregateRows(sales, (sale) => sale.sale_date.slice(0, 7), (sale) => Number(sale.total_after_discount ?? 0))
  const costs = aggregateRows(stockOuts, (out) => out.out_date.slice(0, 7), (out) => Number(out.stock_movement?.total_cost ?? 0))
  const costMap = new Map(costs.map((row) => [row.label, row.value]))
  return fillMonthlyTimeline(revenue).map((row) => ({ label: row.label, value: row.value - Number(costMap.get(row.label) ?? 0) }))
}

function estimateMarginRows(rows: ChartRow[]): ChartRow[] {
  return rows.map((row) => ({ ...row, value: row.value * 0.65, secondaryValue: row.value })).sort((a, b) => b.value - a.value)
}

function saleToTableRow(sale: Sale): DashboardTableRow {
  return {
    id: sale.id,
    label: sale.reference,
    description: sale.client_name ?? salesPointLabels[sale.sales_point] ?? sale.sales_point,
    amount: Number(sale.total_after_discount ?? 0),
    date: sale.sale_date.slice(0, 10),
    status: sale.status,
    to: `/sales/${sale.id}`,
  }
}

async function countUnresolvedReceptionAnomalies() {
  const { count, error } = await supabase.schema('stock').from('reception_anomalies').select('id', { count: 'exact', head: true }).eq('resolved', false)
  if (error) return 0
  return count ?? 0
}

async function countPendingInventoryCorrections() {
  const { count, error } = await supabase.schema('stock').from('inventory_adjustment_requests').select('id', { count: 'exact', head: true }).eq('status', 'en_attente')
  if (error) return 0
  return count ?? 0
}
