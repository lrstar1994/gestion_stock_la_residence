import { Download, FileText } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ChartCard, DataTable, DonutChart, HorizontalBars, KpiCard, LineChart } from '../components/dashboard/DashboardWidgets'
import { exportDashboardToExcel, exportDashboardToPdf } from '../lib/dashboardExports'
import { formatMoney, formatNumber, formatPercent } from '../lib/dashboard'
import { DashboardControls } from './dashboard/DashboardControls'
import { useDirectionDashboard } from './dashboard/useDirectionDashboard'

export function Dashboard() {
  const { dashboard, loading, period, range, setPeriod, setRange, load } = useDirectionDashboard()

  if (loading && !dashboard) return <p className="surface p-6 text-sm text-slate-600">Chargement du tableau de bord...</p>
  if (!dashboard) return <p className="surface p-6 text-sm text-slate-600">Aucune donnee disponible.</p>

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Direction</p>
          <h1 className="page-title mt-2">Tableau de bord general</h1>
          <p className="mt-2 text-sm text-slate-600">Indicateurs consolides du {dashboard.period.from} au {dashboard.period.to}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => exportDashboardToExcel(dashboard)} className="btn-secondary"><Download className="mr-2 h-4 w-4" /> Excel</button>
          <button type="button" onClick={() => exportDashboardToPdf(dashboard)} className="btn-primary"><FileText className="mr-2 h-4 w-4" /> PDF</button>
        </div>
      </header>

      <DashboardControls period={period} range={range} onPeriodChange={setPeriod} onRangeChange={setRange} onRefresh={load} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Valeur totale du stock" value={formatMoney(dashboard.kpis.stockValue)} />
        <KpiCard label="Articles en stock" value={formatNumber(dashboard.kpis.stockArticles)} />
        <KpiCard label="Articles sous seuil" value={formatNumber(dashboard.kpis.lowStockArticles)} />
        <KpiCard label="Achats du mois" value={formatMoney(dashboard.kpis.monthlyPurchases)} />
        <KpiCard label="Decaissements en cours" value={formatMoney(dashboard.kpis.activeCashAdvancesAmount)} hint={`${dashboard.kpis.unregularizedAdvances} avance(s) non regularisee(s)`} />
        <KpiCard label="Factures a payer" value={formatNumber(dashboard.kpis.invoicesToPay)} hint={`${dashboard.kpis.overdueInvoices} en retard`} />
        <KpiCard label="CA du jour" value={formatMoney(dashboard.kpis.todayRevenue)} />
        <KpiCard label="CA du mois" value={formatMoney(dashboard.kpis.monthlyRevenue)} />
        <KpiCard label="Marge brute estimee" value={formatMoney(dashboard.kpis.estimatedGrossMargin)} />
        <KpiCard label="Taux de marge moyen" value={formatPercent(dashboard.kpis.averageMarginRate)} />
        <KpiCard label="Receptions avec ecarts" value={formatNumber(dashboard.kpis.receptionsWithAnomalies)} />
        <KpiCard label="Alertes actives" value={formatNumber(dashboard.alerts.pendingPurchaseNeeds + dashboard.alerts.pendingCashValidations + dashboard.alerts.ordersToReceive + dashboard.alerts.overdueInvoices)} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Valeur du stock par famille" action={<Link to="/dashboard/stock" className="text-sm font-bold text-[#1E3A8A]">Detail</Link>}><DonutChart rows={dashboard.stock.valueByFamily} /></ChartCard>
        <ChartCard title="Evolution des ventes - 30 jours" action={<Link to="/dashboard/sales" className="text-sm font-bold text-[#1E3A8A]">Detail</Link>}><LineChart rows={dashboard.sales.evolution30Days} /></ChartCard>
        <ChartCard title="Achats par fournisseur" action={<Link to="/dashboard/purchases" className="text-sm font-bold text-[#1E3A8A]">Detail</Link>}><HorizontalBars rows={dashboard.purchases.bySupplier} /></ChartCard>
        <ChartCard title="Marge par point de vente" action={<Link to="/dashboard/finance" className="text-sm font-bold text-[#1E3A8A]">Detail</Link>}><HorizontalBars rows={dashboard.finance.marginByPoint} /></ChartCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Articles sous seuil"><DataTable rows={dashboard.stock.lowStockItems} empty="Aucun article sous seuil." /></ChartCard>
        <ChartCard title="Alertes Direction">
          <div className="grid gap-3 md:grid-cols-2">
            <KpiCard label="Besoins en attente" value={formatNumber(dashboard.alerts.pendingPurchaseNeeds)} />
            <KpiCard label="Decaissements a valider" value={formatNumber(dashboard.alerts.pendingCashValidations)} />
            <KpiCard label="Commandes a receptionner" value={formatNumber(dashboard.alerts.ordersToReceive)} />
            <KpiCard label="Ecarts non resolus" value={formatNumber(dashboard.alerts.unresolvedReceptionAnomalies)} />
            <KpiCard label="Mouvements retroactifs" value={formatNumber(dashboard.alerts.pendingRetroactiveMovements)} />
            <KpiCard label="Corrections inventaire" value={formatNumber(dashboard.alerts.pendingInventoryCorrections)} />
          </div>
        </ChartCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Decaissements en cours"><DataTable rows={dashboard.purchases.activeCashAdvances} empty="Aucun decaissement en cours." /></ChartCard>
        <ChartCard title="Receptions avec ecarts"><DataTable rows={dashboard.receptions.withAnomalies} empty="Aucune reception avec ecart." /></ChartCard>
      </section>
    </div>
  )
}
