import { Download } from 'lucide-react'
import { ChartCard, DataTable, DonutChart, HorizontalBars, KpiCard, LineChart } from '../../components/dashboard/DashboardWidgets'
import { exportDashboardToExcel } from '../../lib/dashboardExports'
import { formatMoney, formatNumber } from '../../lib/dashboard'
import { DashboardControls } from './DashboardControls'
import { useDirectionDashboard } from './useDirectionDashboard'

export function StockDashboard() {
  const { dashboard, loading, period, range, setPeriod, setRange, load } = useDirectionDashboard()
  if (loading && !dashboard) return <p className="surface p-6 text-sm text-slate-600">Chargement...</p>
  if (!dashboard) return null

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">Direction</p><h1 className="page-title mt-2">Dashboard stock</h1></div>
        <button type="button" onClick={() => exportDashboardToExcel(dashboard, 'dashboard-stock')} className="btn-primary"><Download className="mr-2 h-4 w-4" /> Excel</button>
      </header>
      <DashboardControls period={period} range={range} onPeriodChange={setPeriod} onRangeChange={setRange} onRefresh={load} />
      <section className="grid gap-4 md:grid-cols-4">
        <KpiCard label="Valeur totale du stock" value={formatMoney(dashboard.kpis.stockValue)} />
        <KpiCard label="Articles en stock" value={formatNumber(dashboard.kpis.stockArticles)} />
        <KpiCard label="Articles sous seuil" value={formatNumber(dashboard.kpis.lowStockArticles)} />
        <KpiCard label="Inventaires initiaux non confirmes" value={formatNumber(dashboard.alerts.initialInventoriesMissing.length)} />
      </section>
      <section className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Valeur par famille"><DonutChart rows={dashboard.stock.valueByFamily} /></ChartCard>
        <ChartCard title="Valeur par localisation"><DonutChart rows={dashboard.stock.valueByLocation} /></ChartCard>
        <ChartCard title="Evolution de la valeur du stock"><LineChart rows={dashboard.stock.valueEvolution} /></ChartCard>
        <ChartCard title="Stock total par famille"><HorizontalBars rows={dashboard.stock.quantityByFamily} valueType="number" /></ChartCard>
      </section>
      <section className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Articles sous seuil"><DataTable rows={dashboard.stock.lowStockItems} /></ChartCard>
        <ChartCard title="Rotation des stocks">
          <HorizontalBars rows={dashboard.purchases.topArticles.map((row) => ({ ...row, value: row.value / Math.max(1, dashboard.kpis.stockValue) * 100 }))} valueType="percent" />
        </ChartCard>
      </section>
    </div>
  )
}
