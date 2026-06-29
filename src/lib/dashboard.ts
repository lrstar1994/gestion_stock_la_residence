export const dashboardPeriods = ['today', 'week', 'month', 'quarter', 'year', 'custom'] as const

export type DashboardPeriod = (typeof dashboardPeriods)[number]

export type DateRange = {
  from: string
  to: string
}

export type ChartRow = {
  label: string
  value: number
  secondaryValue?: number
}

export type TimelineRow = {
  label: string
  value: number
}

export type DashboardKpis = {
  stockValue: number
  stockArticles: number
  lowStockArticles: number
  monthlyPurchases: number
  activeCashAdvancesAmount: number
  unregularizedAdvances: number
  invoicesToPay: number
  overdueInvoices: number
  receptionsWithAnomalies: number
  todayRevenue: number
  monthlyRevenue: number
  estimatedGrossMargin: number
  averageMarginRate: number
}

export type DashboardAlerts = {
  pendingPurchaseNeeds: number
  urgentPurchaseNeeds: number
  pendingCashValidations: number
  ordersToReceive: number
  invoicesToPay: number
  overdueInvoices: number
  unresolvedReceptionAnomalies: number
  pendingRetroactiveMovements: number
  pendingInventoryCorrections: number
  initialInventoriesMissing: Array<{ articleName: string; locationName: string }>
}

export type DashboardTableRow = {
  id: string
  label: string
  description?: string
  amount?: number
  date?: string
  status?: string
  to?: string
}

export type DirectionDashboard = {
  period: DateRange
  kpis: DashboardKpis
  alerts: DashboardAlerts
  stock: {
    lowStockItems: DashboardTableRow[]
    valueByFamily: ChartRow[]
    valueByLocation: ChartRow[]
    valueEvolution: TimelineRow[]
    quantityByFamily: ChartRow[]
  }
  purchases: {
    bySupplier: ChartRow[]
    byFamily: ChartRow[]
    evolution: TimelineRow[]
    topArticles: ChartRow[]
    activeCashAdvances: DashboardTableRow[]
    unregularizedAdvances: DashboardTableRow[]
  }
  receptions: {
    bySupplier: ChartRow[]
    withAnomalies: DashboardTableRow[]
    conformityRate: number
  }
  production: {
    today: DashboardTableRow[]
    monthlyCount: number
    materialCost: number
    differences: ChartRow[]
  }
  sales: {
    byPoint: ChartRow[]
    byChannel: ChartRow[]
    byService: ChartRow[]
    byFamily: ChartRow[]
    topArticles: ChartRow[]
    evolution30Days: TimelineRow[]
    evolutionByPoint: Record<string, TimelineRow[]>
    todayRows: DashboardTableRow[]
    monthRows: DashboardTableRow[]
  }
  finance: {
    materialCost: number
    grossMargin: number
    marginRate: number
    materialCostRatio: number
    marginEvolution: TimelineRow[]
    marginByFamily: ChartRow[]
    marginByPoint: ChartRow[]
  }
}

export function formatMoney(value: number) {
  return `${Math.round(Number(value ?? 0)).toLocaleString('fr-FR')} Ar`
}

export function formatNumber(value: number) {
  return Number(value ?? 0).toLocaleString('fr-FR')
}

export function formatPercent(value: number) {
  return `${Number(value ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`
}
