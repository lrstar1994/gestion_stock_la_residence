import { Download } from 'lucide-react'
import { ChartCard, DataTable, DonutChart, HorizontalBars, KpiCard, LineChart } from '../../components/dashboard/DashboardWidgets'
import { exportDashboardToExcel } from '../../lib/dashboardExports'
import { formatMoney, formatNumber } from '../../lib/dashboard'
import { DashboardControls } from './DashboardControls'
import { useDirectionDashboard } from './useDirectionDashboard'

export function PurchasesDashboard() {
  const { dashboard, loading, period, range, setPeriod, setRange, load } = useDirectionDashboard()
  if (loading && !dashboard) return <p className="surface p-6 text-sm text-slate-600">Chargement...</p>
  if (!dashboard) return null
  const activeAmount = dashboard.purchases.activeCashAdvances.reduce((sum, row) => sum + Number(row.amount ?? 0), 0)

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">Direction</p><h1 className="page-title mt-2">Dashboard achats</h1></div>
        <button type="button" onClick={() => exportDashboardToExcel(dashboard, 'dashboard-achats')} className="btn-primary"><Download className="mr-2 h-4 w-4" /> Excel</button>
      </header>
      <DashboardControls period={period} range={range} onPeriodChange={setPeriod} onRangeChange={setRange} onRefresh={load} />
      <section className="grid gap-4 md:grid-cols-4">
        <KpiCard label="Achats du mois" value={formatMoney(dashboard.kpis.monthlyPurchases)} />
        <KpiCard label="Avances en cours" value={formatMoney(activeAmount)} />
        <KpiCard label="Avances non regularisees" value={formatNumber(dashboard.kpis.unregularizedAdvances)} />
        <KpiCard label="Besoins urgents" value={formatNumber(dashboard.alerts.urgentPurchaseNeeds)} />
      </section>
      <section className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Achats par fournisseur"><DonutChart rows={dashboard.purchases.bySupplier} /></ChartCard>
        <ChartCard title="Evolution des achats"><LineChart rows={dashboard.purchases.evolution} /></ChartCard>
        <ChartCard title="Achats par famille"><HorizontalBars rows={dashboard.purchases.byFamily} /></ChartCard>
        <ChartCard title="Top articles achetes"><HorizontalBars rows={dashboard.purchases.topArticles} /></ChartCard>
      </section>
      <section className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Avances en cours"><DataTable rows={dashboard.purchases.activeCashAdvances} /></ChartCard>
        <ChartCard title="Avances non regularisees"><DataTable rows={dashboard.purchases.unregularizedAdvances} /></ChartCard>
      </section>
    </div>
  )
}
