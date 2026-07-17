import { Download, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { listDailyCashDisbursementReport } from '../../api/modules/cashPurchases.api'
import { exportDailyCashDisbursementReport } from '../../lib/cashPurchaseExports'
import {
  cashPurchaseSourceLabels,
  cashPurchaseStatusLabels,
  cashReceptionStatusLabels,
  cashStockEntryStatusLabels,
  cashWorkflowStatusLabels,
} from '../../lib/cashPurchases'
import type { CashPurchase } from '../../lib/cashPurchases'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function money(value: unknown) {
  return `${Number(value ?? 0).toLocaleString('fr-FR')} Ar`
}

export function CashDisbursementReportPage() {
  const [reportDate, setReportDate] = useState(todayIso())
  const [purchases, setPurchases] = useState<CashPurchase[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setPurchases(await listDailyCashDisbursementReport(reportDate))
    } finally {
      setLoading(false)
    }
  }, [reportDate])

  useEffect(() => {
    load().catch(() => toast.error('Impossible de charger le rapport caisse.'))
  }, [load])

  const summary = useMemo(() => {
    const total = (field: keyof Pick<CashPurchase, 'amount_requested' | 'amount_validated' | 'amount_given' | 'total_purchased' | 'change_expected' | 'change_returned' | 'difference'>) =>
      purchases.reduce((sum, purchase) => sum + Number(purchase[field] ?? 0), 0)

    return {
      count: purchases.length,
      requested: total('amount_requested'),
      validated: total('amount_validated'),
      given: total('amount_given'),
      purchased: total('total_purchased'),
      changeExpected: total('change_expected'),
      changeReturned: total('change_returned'),
      difference: total('difference'),
      pendingValidation: purchases.filter((purchase) => purchase.status === 'en_attente').length,
      cashToGive: purchases.filter((purchase) => purchase.status === 'valide').length,
      returnsToEnter: purchases.filter((purchase) => purchase.status === 'especes_remises').length,
      differencesToValidate: purchases.filter((purchase) => purchase.cash_purchase_differences?.some((difference) => difference.status !== 'valide')).length,
      toClose: purchases.filter((purchase) => purchase.status === 'retour_complet').length,
    }
  }, [purchases])

  const exportReport = () => {
    exportDailyCashDisbursementReport(purchases, reportDate)
    toast.success('Rapport journalier exporte avec succes')
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Caisse</p>
          <h1 className="page-title mt-2">Rapport journalier des decaissements</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Suivi des demandes d'achat en especes creees sur la date choisie, avec les montants remis,
            les retours, les justificatifs et les ecarts a traiter.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={load} className="btn-secondary" disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Actualiser
          </button>
          <button type="button" onClick={exportReport} className="btn-primary" disabled={purchases.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export Excel
          </button>
        </div>
      </header>

      <section className="surface grid gap-3 p-4 sm:grid-cols-[220px_1fr] sm:items-end">
        <label>
          <span className="field-label">Date du rapport</span>
          <input type="date" value={reportDate} onChange={(event) => setReportDate(event.target.value)} className="input mt-2" />
        </label>
        <p className="text-sm text-slate-600">
          Le rapport reprend les dossiers dont la date de demande correspond a cette date. Les details restent cliquables pour continuer le traitement.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Metric label="Dossiers" value={String(summary.count)} />
        <Metric label="Montant demande" value={money(summary.requested)} />
        <Metric label="Montant valide" value={money(summary.validated)} />
        <Metric label="Especes remises" value={money(summary.given)} />
        <Metric label="Total achete" value={money(summary.purchased)} />
        <Metric label="Ecart monnaie" value={money(summary.difference)} tone={summary.difference !== 0 ? 'warning' : 'normal'} />
      </section>

      <section className="grid gap-4 md:grid-cols-5">
        <SmallMetric label="A valider" value={summary.pendingValidation} />
        <SmallMetric label="A remettre" value={summary.cashToGive} />
        <SmallMetric label="Retour a saisir" value={summary.returnsToEnter} />
        <SmallMetric label="Ecarts a traiter" value={summary.differencesToValidate} />
        <SmallMetric label="A cloturer" value={summary.toClose} />
      </section>

      <section className="surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1280px] w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Acheteur / motif</th>
                <th className="px-4 py-3">Caisse</th>
                <th className="px-4 py-3 text-right">Demande</th>
                <th className="px-4 py-3 text-right">Valide</th>
                <th className="px-4 py-3 text-right">Remis</th>
                <th className="px-4 py-3 text-right">Achete</th>
                <th className="px-4 py-3 text-right">Monnaie attendue</th>
                <th className="px-4 py-3 text-right">Monnaie rendue</th>
                <th className="px-4 py-3 text-right">Ecart</th>
                <th className="px-4 py-3">Justif.</th>
                <th className="px-4 py-3">Statuts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {purchases.map((purchase) => {
                const openDifferences = purchase.cash_purchase_differences?.filter((difference) => difference.status !== 'valide').length ?? 0
                return (
                  <tr key={purchase.id} className="align-top hover:bg-slate-50">
                    <td className="px-4 py-4">
                      <Link to={`/cash-purchases/${purchase.id}`} className="font-bold text-[#1E3A8A] hover:underline">
                        {purchase.reference}
                      </Link>
                      <p className="mt-1 text-xs text-slate-500">{cashPurchaseStatusLabels[purchase.status]}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-950">{purchase.buyer?.full_name || 'Acheteur non renseigne'}</p>
                      <p className="mt-1 max-w-xs text-xs text-slate-500">{purchase.reason}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p>{cashPurchaseSourceLabels[purchase.cash_source]}</p>
                      {purchase.cashier?.full_name && <p className="mt-1 text-xs text-slate-500">Remis par {purchase.cashier.full_name}</p>}
                    </td>
                    <MoneyCell value={purchase.amount_requested} />
                    <MoneyCell value={purchase.amount_validated} />
                    <MoneyCell value={purchase.amount_given} />
                    <MoneyCell value={purchase.total_purchased} />
                    <MoneyCell value={purchase.change_expected} />
                    <MoneyCell value={purchase.change_returned} />
                    <MoneyCell value={purchase.difference} warning={Number(purchase.difference ?? 0) !== 0} />
                    <td className="px-4 py-4">
                      <p>{purchase.cash_purchase_receipts?.length ?? 0} piece(s)</p>
                      {openDifferences > 0 && <p className="mt-1 font-semibold text-amber-700">{openDifferences} ecart(s)</p>}
                    </td>
                    <td className="space-y-1 px-4 py-4">
                      <Status label={cashWorkflowStatusLabels[purchase.cash_status ?? 'especes_demandees']} />
                      <Status label={cashReceptionStatusLabels[purchase.reception_status ?? 'en_attente_reception']} />
                      <Status label={cashStockEntryStatusLabels[purchase.stock_entry_status ?? 'non_entre_stock']} />
                    </td>
                  </tr>
                )
              })}
              {purchases.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-4 py-6 text-center text-slate-600">
                    Aucun decaissement pour cette date.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function Metric({ label, value, tone = 'normal' }: { label: string; value: string; tone?: 'normal' | 'warning' }) {
  return (
    <div className="surface p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-black ${tone === 'warning' ? 'text-amber-700' : 'text-slate-950'}`}>{value}</p>
    </div>
  )
}

function SmallMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-[#1E3A8A]">{value.toLocaleString('fr-FR')}</p>
    </div>
  )
}

function MoneyCell({ value, warning = false }: { value: unknown; warning?: boolean }) {
  return (
    <td className={`px-4 py-4 text-right font-semibold ${warning ? 'text-amber-700' : 'text-slate-800'}`}>
      {money(value)}
    </td>
  )
}

function Status({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-[#1E3A8A]">
      {label}
    </span>
  )
}
