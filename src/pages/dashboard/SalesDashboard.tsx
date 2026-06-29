import { Download } from 'lucide-react'
import { ChartCard, DataTable, DonutChart, HorizontalBars, KpiCard, LineChart } from '../../components/dashboard/DashboardWidgets'
import { exportDashboardToExcel } from '../../lib/dashboardExports'
import { formatMoney, formatNumber } from '../../lib/dashboard'
import { DashboardControls } from './DashboardControls'
import { useDirectionDashboard } from './useDirectionDashboard'

export function SalesDashboard() {
  const { dashboard, loading, period, range, setPeriod, setRange, load } = useDirectionDashboard()
  if (loading && !dashboard) return <p className="surface p-6 text-sm text-slate-600">Chargement...</p>
  if (!dashboard) return null

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">Direction</p><h1 className="page-title mt-2">Dashboard ventes</h1></div>
        <button type="button" onClick={() => exportDashboardToExcel(dashboard, 'dashboard-ventes')} className="btn-primary"><Download className="mr-2 h-4 w-4" /> Excel</button>
      </header>
      <DashboardControls period={period} range={range} onPeriodChange={setPeriod} onRangeChange={setRange} onRefresh={load} />
      <section className="grid gap-4 md:grid-cols-4">
        <KpiCard label="CA du jour" value={formatMoney(dashboard.kpis.todayRevenue)} />
        <KpiCard label="CA du mois" value={formatMoney(dashboard.kpis.monthlyRevenue)} />
        <KpiCard label="Ventes du jour" value={formatNumber(dashboard.sales.todayRows.length)} />
        <KpiCard label="Top article" value={dashboard.sales.topArticles[0]?.label ?? '-'} />
      </section>
      <section className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="CA par point de vente"><HorizontalBars rows={dashboard.sales.byPoint} /></ChartCard>
        <ChartCard title="CA par canal"><DonutChart rows={dashboard.sales.byChannel} /></ChartCard>
        <ChartCard title="CA par mode de service"><DonutChart rows={dashboard.sales.byService} /></ChartCard>
        <ChartCard title="Evolution des ventes"><LineChart rows={dashboard.sales.evolution30Days} /></ChartCard>
        <ChartCard title="Ventes par famille"><HorizontalBars rows={dashboard.sales.byFamily} /></ChartCard>
        <ChartCard title="Top des articles"><HorizontalBars rows={dashboard.sales.topArticles} /></ChartCard>
      </section>
      <section className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Ventes du jour"><DataTable rows={dashboard.sales.todayRows} /></ChartCard>
        <ChartCard title="Ventes du mois"><DataTable rows={dashboard.sales.monthRows} /></ChartCard>
      </section>
    </div>
  )
}
