import { Link } from 'react-router-dom'
import { KpiCard } from '../../components/dashboard/DashboardWidgets'
import { formatMoney, formatNumber } from '../../lib/dashboard'
import { listCashierCashPurchaseData } from '../../api/modules/tasks.api'
import { useEffect, useState } from 'react'
import type { CashierCashPurchaseData } from '../../api/modules/tasks.api'

export function DashboardCaisse() {
  const [data, setData] = useState<CashierCashPurchaseData | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => { listCashierCashPurchaseData().then(setData).catch(() => setError(true)) }, [])
  if (error) return <section className="surface border border-red-200 p-6 text-red-800"><h1 className="text-xl font-bold">Tableau de bord Caisse indisponible</h1><p className="mt-2">Les données n’ont pas pu être chargées. Aucun zéro n’est affiché.</p></section>
  if (!data) return <p className="surface p-6 text-sm text-slate-600">Chargement du tableau de bord Caisse...</p>
  const authorizedTotal = data.toGive.reduce((sum, item) => sum + Number(item.amount_validated ?? 0), 0)
  const givenTodayTotal = data.givenToday.reduce((sum, item) => sum + Number(item.amount_given ?? 0), 0)
  return <div className="space-y-6">
    <header><p className="eyebrow">Caisse</p><h1 className="page-title mt-2">Tableau de bord Caisse</h1><p className="mt-2 text-sm text-slate-600">Opérations à traiter et mouvements du jour</p></header>
    <section className="grid gap-4 md:grid-cols-3">
      <KpiCard label="Espèces à remettre" value={formatNumber(data.toGive.length)} hint={`Autorisé Direction : ${formatMoney(authorizedTotal)}`} />
      <KpiCard label="Remises effectuées aujourd’hui" value={formatNumber(data.givenToday.length)} hint={formatMoney(givenTodayTotal)} />
      <KpiCard label="Achats avec espèces remises en cours" value={formatNumber(data.givenOpen.length)} hint="Suivi uniquement" />
    </section>
    <section className="surface p-5"><div className="flex items-center justify-between"><h2 className="text-lg font-bold">Dernières opérations Caisse</h2><Link className="text-sm font-bold text-[#1E3A8A]" to="/cash-purchases/report">Rapport décaissements</Link></div>
      <div className="mt-4 divide-y divide-slate-200">{data.recentGiven.slice(0, 10).map((item) => <Link key={item.id} to={`/cash-purchases/${item.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm hover:bg-slate-50"><span className="min-w-0"><strong>{item.reference}</strong><span className="ml-2 text-slate-600">{item.buyer_directory?.full_name ?? item.buyer?.full_name ?? 'Acheteur non affecté'}</span>{(item.cash_purchase_items ?? []).map((line) => <span key={line.id} className="mt-1 block whitespace-pre-wrap break-words text-xs text-slate-600">{line.articles?.name ?? line.free_designation ?? 'Article'} · {Number(line.quantity_planned ?? 0).toLocaleString('fr-FR')} {line.units?.abbreviation ?? ''}{line.purchase_needs?.justification ? `\n${line.purchase_needs.justification}` : ''}</span>)}</span><span>{new Date(item.given_at as string).toLocaleString('fr-FR')} · {formatMoney(Number(item.amount_given ?? 0))}</span></Link>)}{data.recentGiven.length === 0 && <p className="py-3 text-sm text-slate-600">Aucune remise aujourd’hui.</p>}</div>
    </section>
    <section className="flex flex-wrap gap-3"><Link className="btn-primary" to="/tasks">Tâches à traiter</Link><Link className="btn-secondary" to="/cash-purchases/report">Rapport décaissements</Link><Link className="btn-secondary" to="/profile">Mon profil</Link></section>
  </div>
}
