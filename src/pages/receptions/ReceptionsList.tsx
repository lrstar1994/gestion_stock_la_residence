import { Download, FileSpreadsheet, Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { listReceptions } from '../../api/modules/receptions.api'
import { listSuppliers } from '../../api/modules/suppliers.api'
import { useAuth } from '../../hooks/useAuth'
import { exportReceptionsToCsv, exportReceptionsToExcel } from '../../lib/receptionExports'
import { canCreateReceptions, canExportReceptions, receptionStatusLabels, receptionStatuses } from '../../lib/receptions'
import type { Reception, ReceptionStatus } from '../../lib/receptions'
import type { Supplier } from '../../lib/suppliers'

export function ReceptionsList() {
  const { profile } = useAuth()
  const canCreate = canCreateReceptions(profile?.role)
  const canExport = canExportReceptions(profile?.role)
  const [receptions, setReceptions] = useState<Reception[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ReceptionStatus | 'all'>('all')
  const [supplierId, setSupplierId] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 10
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const filters = useMemo(() => ({ search, status, supplierId, page, pageSize }), [page, search, status, supplierId])

  const load = useCallback(async () => {
    const result = await listReceptions(filters)
    setReceptions(result.receptions)
    setTotal(result.total)
  }, [filters])

  useEffect(() => {
    listSuppliers().then(setSuppliers).catch(() => toast.error('Impossible de charger les fournisseurs.'))
  }, [])

  useEffect(() => {
    load().catch(() => toast.error('Impossible de charger les receptions.'))
  }, [load])

  const dashboard = {
    waiting: receptions.filter((item) => item.status === 'en_attente').length,
    validated: receptions.filter((item) => item.status === 'validee' || item.status === 'validee_avec_anomalies' || item.status === 'entree_stock').length,
    anomalies: receptions.filter((item) => item.status === 'validee_avec_anomalies').length,
    total: receptions.reduce((sum, item) => sum + Number(item.total_amount ?? 0), 0),
  }

  const exportAll = async (format: 'csv' | 'excel') => {
    const result = await listReceptions({ ...filters, page: 1, pageSize: 10000 })
    if (format === 'csv') exportReceptionsToCsv(result.receptions)
    else exportReceptionsToExcel(result.receptions)
    toast.success('Receptions exportees avec succes')
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">Stock</p><h1 className="page-title mt-2">Receptions</h1></div>
        <div className="flex flex-wrap gap-2">
          {canExport && <button type="button" onClick={() => exportAll('csv')} className="btn-secondary"><Download className="mr-2 h-4 w-4" /> CSV</button>}
          {canExport && <button type="button" onClick={() => exportAll('excel')} className="btn-secondary"><FileSpreadsheet className="mr-2 h-4 w-4" /> Excel</button>}
          {canCreate && <Link to="/receptions/new" className="btn-primary"><Plus className="mr-2 h-4 w-4" /> Nouvelle reception</Link>}
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="En attente" value={String(dashboard.waiting)} />
        <Metric label="Validees" value={String(dashboard.validated)} />
        <Metric label="Avec anomalies" value={String(dashboard.anomalies)} />
        <Metric label="Montant affiche" value={`${dashboard.total.toLocaleString('fr-FR')} Ar`} />
      </section>

      <section className="surface grid gap-3 p-4 md:grid-cols-[1fr_190px_240px]">
        <input value={search} onChange={(event) => { setPage(1); setSearch(event.target.value) }} className="input" placeholder="Recherche numero de reception" />
        <select value={status} onChange={(event) => { setPage(1); setStatus(event.target.value as ReceptionStatus | 'all') }} className="input"><option value="all">Tous statuts</option>{receptionStatuses.map((item) => <option key={item} value={item}>{receptionStatusLabels[item]}</option>)}</select>
        <select value={supplierId} onChange={(event) => { setPage(1); setSupplierId(event.target.value) }} className="input"><option value="">Tous fournisseurs</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select>
      </section>

      <section className="surface overflow-hidden">
        <div className="hidden grid-cols-[160px_1fr_140px_150px_120px_150px_150px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 xl:grid">
          <span>Reference</span><span>Fournisseur</span><span>Date</span><span>Commande</span><span>Articles</span><span>Montant</span><span>Statut</span>
        </div>
        <div className="divide-y divide-slate-200">
          {receptions.map((reception) => (
            <Link key={reception.id} to={`/receptions/${reception.id}`} className="grid gap-3 px-5 py-4 transition hover:bg-slate-50 xl:grid-cols-[160px_1fr_140px_150px_120px_150px_150px] xl:items-center">
              <span className="font-bold text-[#1E3A8A]">{reception.reference}</span>
              <span><span className="block font-semibold">{reception.suppliers?.name}</span><span className="text-xs text-slate-500">{reception.invoice_number}</span></span>
              <span>{new Date(reception.reception_date).toLocaleDateString('fr-FR')}</span>
              <span>{reception.purchase_orders?.reference || '-'}</span>
              <span>{reception.reception_items?.length ?? 0}</span>
              <span>{Number(reception.total_amount ?? 0).toLocaleString('fr-FR')} Ar</span>
              <Badge status={reception.status} />
            </Link>
          ))}
          {receptions.length === 0 && <p className="p-5 text-sm text-slate-600">Aucune reception.</p>}
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

function Badge({ status }: { status: ReceptionStatus }) {
  const color = {
    brouillon: 'bg-slate-100 text-slate-700',
    en_attente: 'bg-yellow-50 text-yellow-800',
    validee: 'bg-blue-50 text-blue-800',
    validee_avec_anomalies: 'bg-orange-50 text-orange-800',
    entree_stock: 'bg-emerald-50 text-emerald-800',
    refusee: 'bg-red-50 text-red-800',
  }[status]
  return <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${color}`}>{receptionStatusLabels[status]}</span>
}
