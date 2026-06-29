import { Download } from 'lucide-react'
import { ChartCard, HorizontalBars, KpiCard, LineChart } from '../../components/dashboard/DashboardWidgets'
import { exportDashboardToExcel } from '../../lib/dashboardExports'
import { formatMoney, formatPercent } from '../../lib/dashboard'
import { DashboardControls } from './DashboardControls'
import { useDirectionDashboard } from './useDirectionDashboard'

export function FinanceDashboard() {
  const { dashboard, loading, period, range, setPeriod, setRange, load } = useDirectionDashboard()
  if (loading && !dashboard) return <p className="surface p-6 text-sm text-slate-600">Chargement...</p>
  if (!dashboard) return null

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">Direction</p><h1 className="page-title mt-2">Dashboard financier</h1></div>
        <button type="button" onClick={() => exportDashboardToExcel(dashboard, 'dashboard-finance')} className="btn-primary"><Download className="mr-2 h-4 w-4" /> Excel</button>
      </header>
      <DashboardControls period={period} range={range} onPeriodChange={setPeriod} onRangeChange={setRange} onRefresh={load} />
      <section className="grid gap-4 md:grid-cols-4">
        <KpiCard label="Marge brute" value={formatMoney(dashboard.finance.grossMargin)} />
        <KpiCard label="Taux de marge" value={formatPercent(dashboard.finance.marginRate)} />
        <KpiCard label="Cout matiere" value={formatMoney(dashboard.finance.materialCost)} />
        <KpiCard label="Ratio cout matiere" value={formatPercent(dashboard.finance.materialCostRatio)} />
      </section>
      <section className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Evolution des marges"><LineChart rows={dashboard.finance.marginEvolution} /></ChartCard>
        <ChartCard title="Marge par famille"><HorizontalBars rows={dashboard.finance.marginByFamily} /></ChartCard>
        <ChartCard title="Marge par point de vente"><HorizontalBars rows={dashboard.finance.marginByPoint} /></ChartCard>
        <ChartCard title="Cout matiere par production"><HorizontalBars rows={dashboard.production.differences} valueType="number" /></ChartCard>
      </section>
    </div>
  )
}
