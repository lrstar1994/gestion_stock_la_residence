import { Download, FileSpreadsheet, Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { listSales } from '../../api/modules/sales.api'
import { useAuth } from '../../hooks/useAuth'
import { exportSalesToCsv, exportSalesToExcel } from '../../lib/salesExports'
import {
  canCreateSales,
  canExportSales,
  salesChannelLabels,
  salesChannels,
  salesPointLabels,
  salesPoints,
  salesStatusLabels,
  salesStatuses,
  serviceModeLabels,
  serviceModes,
} from '../../lib/sales'
import type { Sale, SalesChannel, SalesPoint, SalesStatus, ServiceMode } from '../../lib/sales'

export function SalesList() {
  const { profile } = useAuth()
  const [sales, setSales] = useState<Sale[]>([])
  const [search, setSearch] = useState('')
  const [channel, setChannel] = useState<SalesChannel | 'all'>('all')
  const [serviceMode, setServiceMode] = useState<ServiceMode | 'all'>('all')
  const [salesPoint, setSalesPoint] = useState<SalesPoint | 'all'>('all')
  const [status, setStatus] = useState<SalesStatus | 'all'>('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 10
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const filters = useMemo(() => ({ search, channel, serviceMode, salesPoint, status, page, pageSize }), [channel, page, salesPoint, search, serviceMode, status])

  const load = useCallback(async () => {
    const result = await listSales(filters)
    setSales(result.sales)
    setTotal(result.total)
  }, [filters])

  useEffect(() => {
    load().catch(() => toast.error('Impossible de charger les ventes.'))
  }, [load])

  const metrics = {
    count: sales.length,
    revenue: sales.filter((sale) => sale.status === 'validee').reduce((sum, sale) => sum + Number(sale.total_after_discount ?? 0), 0),
    cancelled: sales.filter((sale) => sale.status === 'annulee').length,
    items: sales.reduce((sum, sale) => sum + (sale.sale_items?.length ?? 0), 0),
  }

  const exportAll = async (format: 'csv' | 'excel') => {
    const result = await listSales({ ...filters, page: 1, pageSize: 10000 })
    if (format === 'csv') exportSalesToCsv(result.sales)
    else exportSalesToExcel(result.sales)
    toast.success('Statistiques exportees avec succes')
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">Ventes</p><h1 className="page-title mt-2">Journal des ventes</h1></div>
        <div className="flex flex-wrap gap-2">
          <Link to="/sales/stats" className="btn-secondary">Statistiques</Link>
          {canExportSales(profile?.role) && <button type="button" onClick={() => exportAll('csv')} className="btn-secondary"><Download className="mr-2 h-4 w-4" /> CSV</button>}
          {canExportSales(profile?.role) && <button type="button" onClick={() => exportAll('excel')} className="btn-secondary"><FileSpreadsheet className="mr-2 h-4 w-4" /> Excel</button>}
          {canCreateSales(profile?.role) && <Link to="/sales/new" className="btn-primary"><Plus className="mr-2 h-4 w-4" /> Nouvelle vente</Link>}
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="Ventes affichees" value={String(metrics.count)} />
        <Metric label="CA valide" value={`${metrics.revenue.toLocaleString('fr-FR')} Ar`} />
        <Metric label="Ventes annulees" value={String(metrics.cancelled)} />
        <Metric label="Lignes articles" value={String(metrics.items)} />
      </section>

      <section className="surface grid gap-3 p-4 md:grid-cols-5">
        <input value={search} onChange={(event) => { setPage(1); setSearch(event.target.value) }} className="input" placeholder="Reference ou client" />
        <select value={channel} onChange={(event) => { setPage(1); setChannel(event.target.value as SalesChannel | 'all') }} className="input"><option value="all">Tous canaux</option>{salesChannels.map((item) => <option key={item} value={item}>{salesChannelLabels[item]}</option>)}</select>
        <select value={serviceMode} onChange={(event) => { setPage(1); setServiceMode(event.target.value as ServiceMode | 'all') }} className="input"><option value="all">Tous services</option>{serviceModes.map((item) => <option key={item} value={item}>{serviceModeLabels[item]}</option>)}</select>
        <select value={salesPoint} onChange={(event) => { setPage(1); setSalesPoint(event.target.value as SalesPoint | 'all') }} className="input"><option value="all">Tous points</option>{salesPoints.map((item) => <option key={item} value={item}>{salesPointLabels[item]}</option>)}</select>
        <select value={status} onChange={(event) => { setPage(1); setStatus(event.target.value as SalesStatus | 'all') }} className="input"><option value="all">Tous statuts</option>{salesStatuses.map((item) => <option key={item} value={item}>{salesStatusLabels[item]}</option>)}</select>
      </section>

      <section className="surface overflow-hidden">
        <div className="hidden grid-cols-[160px_170px_150px_150px_1fr_100px_140px_120px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 xl:grid">
          <span>Reference</span><span>Date</span><span>Canal</span><span>Service</span><span>Client</span><span>Articles</span><span>Total</span><span>Statut</span>
        </div>
        <div className="divide-y divide-slate-200">
          {sales.map((sale) => (
            <Link key={sale.id} to={`/sales/${sale.id}`} className="grid gap-3 px-5 py-4 transition hover:bg-slate-50 xl:grid-cols-[160px_170px_150px_150px_1fr_100px_140px_120px] xl:items-center">
              <span className="font-bold text-[#1E3A8A]">{sale.reference}</span>
              <span>{new Date(sale.sale_date).toLocaleString('fr-FR')}</span>
              <span>{salesChannelLabels[sale.channel]}</span>
              <span>{serviceModeLabels[sale.service_mode]}</span>
              <span><span className="block font-semibold">{sale.client_name || 'Client non renseigne'}</span><span className="text-xs text-slate-500">{salesPointLabels[sale.sales_point]}</span></span>
              <span>{sale.sale_items?.length ?? 0}</span>
              <span>{Number(sale.total_after_discount ?? 0).toLocaleString('fr-FR')} Ar</span>
              <Badge status={sale.status} />
            </Link>
          ))}
          {sales.length === 0 && <p className="p-5 text-sm text-slate-600">Aucune vente.</p>}
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

function Badge({ status }: { status: SalesStatus }) {
  const color = status === 'validee' ? 'bg-emerald-50 text-emerald-800' : status === 'annulee' ? 'bg-red-50 text-red-800' : 'bg-slate-100 text-slate-800'
  return <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${color}`}>{salesStatusLabels[status]}</span>
}
