import { Download, FileSpreadsheet, Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { listCashPurchases } from '../../api/modules/cashPurchases.api'
import { useAuth } from '../../hooks/useAuth'
import { exportCashPurchasesToCsv, exportCashPurchasesToExcel } from '../../lib/cashPurchaseExports'
import { canCreateCashPurchases, canExportCashPurchases, cashPurchaseSourceLabels, cashPurchaseSources, cashPurchaseStatusLabels, cashPurchaseStatuses } from '../../lib/cashPurchases'
import type { CashPurchase, CashPurchaseSource, CashPurchaseStatus } from '../../lib/cashPurchases'

export function CashPurchasesList() {
  const { profile } = useAuth()
  const canCreate = canCreateCashPurchases(profile?.role)
  const canExport = canExportCashPurchases(profile?.role)
  const [purchases, setPurchases] = useState<CashPurchase[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<CashPurchaseStatus | 'all'>('all')
  const [cashSource, setCashSource] = useState<CashPurchaseSource | 'all'>('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 10
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const filters = useMemo(() => ({ search, status, cashSource, page, pageSize }), [cashSource, page, search, status])

  const load = useCallback(async () => {
    const result = await listCashPurchases(filters)
    setPurchases(result.purchases)
    setTotal(result.total)
  }, [filters])

  useEffect(() => {
    load().catch(() => toast.error('Impossible de charger les achats en especes.'))
  }, [load])

  const dashboard = {
    pending: purchases.filter((item) => item.status === 'en_attente').length,
    toClose: purchases.filter((item) => item.status === 'retour_complet').length,
    advances: purchases.reduce((sum, item) => sum + Number(item.amount_given ?? 0), 0),
    purchased: purchases.reduce((sum, item) => sum + Number(item.total_purchased ?? 0), 0),
    difference: purchases.reduce((sum, item) => sum + Number(item.difference ?? 0), 0),
  }

  const exportAll = async (format: 'csv' | 'excel') => {
    const result = await listCashPurchases({ ...filters, page: 1, pageSize: 10000 })
    if (format === 'csv') exportCashPurchasesToCsv(result.purchases)
    else exportCashPurchasesToExcel(result.purchases)
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">Caisse</p><h1 className="page-title mt-2">Achats en especes</h1></div>
        <div className="flex flex-wrap gap-2">
          {canExport && <button type="button" onClick={() => exportAll('csv')} className="btn-secondary"><Download className="mr-2 h-4 w-4" /> CSV</button>}
          {canExport && <button type="button" onClick={() => exportAll('excel')} className="btn-secondary"><FileSpreadsheet className="mr-2 h-4 w-4" /> Excel</button>}
          {canCreate && <Link to="/cash-purchases/new" className="btn-primary"><Plus className="mr-2 h-4 w-4" /> Nouvelle demande</Link>}
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-5">
        <Metric label="En attente" value={String(dashboard.pending)} />
        <Metric label="A cloturer" value={String(dashboard.toClose)} />
        <Metric label="Avances" value={`${dashboard.advances.toLocaleString('fr-FR')} Ar`} />
        <Metric label="Achats" value={`${dashboard.purchased.toLocaleString('fr-FR')} Ar`} />
        <Metric label="Ecart" value={`${dashboard.difference.toLocaleString('fr-FR')} Ar`} />
      </section>

      <section className="surface grid gap-3 p-4 md:grid-cols-[1fr_180px_220px]">
        <input value={search} onChange={(event) => setSearch(event.target.value)} className="input" placeholder="Recherche reference ou motif" />
        <select value={status} onChange={(event) => setStatus(event.target.value as CashPurchaseStatus | 'all')} className="input"><option value="all">Tous statuts</option>{cashPurchaseStatuses.map((item) => <option key={item} value={item}>{cashPurchaseStatusLabels[item]}</option>)}</select>
        <select value={cashSource} onChange={(event) => setCashSource(event.target.value as CashPurchaseSource | 'all')} className="input"><option value="all">Toutes caisses</option>{cashPurchaseSources.map((item) => <option key={item} value={item}>{cashPurchaseSourceLabels[item]}</option>)}</select>
      </section>

      <section className="surface overflow-hidden">
        <div className="hidden grid-cols-[150px_130px_1fr_140px_140px_140px_140px_140px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 xl:grid">
          <span>Reference</span><span>Date</span><span>Acheteur / motif</span><span>Demande</span><span>Remis</span><span>Achete</span><span>Ecart</span><span>Statut</span>
        </div>
        <div className="divide-y divide-slate-200">
          {purchases.map((purchase) => (
            <Link key={purchase.id} to={`/cash-purchases/${purchase.id}`} className="grid gap-3 px-5 py-4 transition hover:bg-slate-50 xl:grid-cols-[150px_130px_1fr_140px_140px_140px_140px_140px] xl:items-center">
              <span className="font-bold text-[#1E3A8A]">{purchase.reference}</span>
              <span className="text-sm">{new Date(purchase.request_date).toLocaleDateString('fr-FR')}</span>
              <span><span className="block font-semibold">{purchase.buyer?.full_name}</span><span className="text-xs text-slate-500">{purchase.reason}</span></span>
              <span>{Number(purchase.amount_requested).toLocaleString('fr-FR')} Ar</span>
              <span>{Number(purchase.amount_given).toLocaleString('fr-FR')} Ar</span>
              <span>{Number(purchase.total_purchased).toLocaleString('fr-FR')} Ar</span>
              <span className={Number(purchase.difference) > 0 ? 'font-bold text-red-700' : 'text-slate-700'}>{Number(purchase.difference).toLocaleString('fr-FR')} Ar</span>
              <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#1E3A8A]">{cashPurchaseStatusLabels[purchase.status]}</span>
            </Link>
          ))}
          {purchases.length === 0 && <p className="p-5 text-sm text-slate-600">Aucun achat en especes.</p>}
        </div>
      </section>

      <div className="flex justify-between gap-3">
        <p className="text-sm text-slate-600">Page {page} sur {totalPages}</p>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Precedent</button>
          <button type="button" className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Suivant</button>
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="surface p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-950">{value}</p></div>
}
