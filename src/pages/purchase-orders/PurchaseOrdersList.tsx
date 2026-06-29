import { Download, FileSpreadsheet, Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { listPurchaseOrders } from '../../api/modules/purchaseOrders.api'
import { listSuppliers } from '../../api/modules/suppliers.api'
import { useAuth } from '../../hooks/useAuth'
import { exportPurchaseOrdersToCsv, exportPurchaseOrdersToExcel } from '../../lib/purchaseOrderExports'
import { canCreatePurchaseOrders, canExportPurchaseOrders, purchaseOrderStatusLabels, purchaseOrderStatuses } from '../../lib/purchaseOrders'
import type { PurchaseOrder, PurchaseOrderStatus } from '../../lib/purchaseOrders'
import type { Supplier } from '../../lib/suppliers'

export function PurchaseOrdersList() {
  const { profile } = useAuth()
  const canCreate = canCreatePurchaseOrders(profile?.role)
  const canExport = canExportPurchaseOrders(profile?.role)
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<PurchaseOrderStatus | 'all'>('all')
  const [supplierId, setSupplierId] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 10
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const filters = useMemo(() => ({ search, status, supplierId, page, pageSize }), [page, search, status, supplierId])

  const load = useCallback(async () => {
    const result = await listPurchaseOrders(filters)
    setOrders(result.orders)
    setTotal(result.total)
  }, [filters])

  useEffect(() => {
    listSuppliers().then(setSuppliers).catch(() => toast.error('Impossible de charger les fournisseurs.'))
  }, [])

  useEffect(() => {
    load().catch(() => toast.error('Impossible de charger les commandes.'))
  }, [load])

  const dashboard = {
    draft: orders.filter((order) => order.status === 'brouillon').length,
    toSend: orders.filter((order) => order.status === 'validee').length,
    waiting: orders.filter((order) => order.status === 'envoyee' || order.status === 'partiellement_livree').length,
    total: orders.reduce((sum, order) => sum + Number(order.total_amount ?? 0), 0),
  }

  const exportAll = async (format: 'csv' | 'excel') => {
    const result = await listPurchaseOrders({ ...filters, page: 1, pageSize: 10000 })
    if (format === 'csv') exportPurchaseOrdersToCsv(result.orders)
    else exportPurchaseOrdersToExcel(result.orders)
    toast.success('Commandes exportees avec succes')
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">Achats</p><h1 className="page-title mt-2">Commandes fournisseurs</h1></div>
        <div className="flex flex-wrap gap-2">
          {canExport && <button type="button" onClick={() => exportAll('csv')} className="btn-secondary"><Download className="mr-2 h-4 w-4" /> CSV</button>}
          {canExport && <button type="button" onClick={() => exportAll('excel')} className="btn-secondary"><FileSpreadsheet className="mr-2 h-4 w-4" /> Excel</button>}
          {canCreate && <Link to="/purchase-orders/new" className="btn-primary"><Plus className="mr-2 h-4 w-4" /> Nouvelle commande</Link>}
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="Brouillons" value={String(dashboard.draft)} />
        <Metric label="A envoyer" value={String(dashboard.toSend)} />
        <Metric label="Reception attendue" value={String(dashboard.waiting)} />
        <Metric label="Montant affiche" value={`${dashboard.total.toLocaleString('fr-FR')} Ar`} />
      </section>

      <section className="surface grid gap-3 p-4 md:grid-cols-[1fr_190px_240px]">
        <input value={search} onChange={(event) => { setPage(1); setSearch(event.target.value) }} className="input" placeholder="Recherche reference commande ou fournisseur" />
        <select value={status} onChange={(event) => { setPage(1); setStatus(event.target.value as PurchaseOrderStatus | 'all') }} className="input"><option value="all">Tous statuts</option>{purchaseOrderStatuses.map((item) => <option key={item} value={item}>{purchaseOrderStatusLabels[item]}</option>)}</select>
        <select value={supplierId} onChange={(event) => { setPage(1); setSupplierId(event.target.value) }} className="input"><option value="">Tous fournisseurs</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select>
      </section>

      <section className="surface overflow-hidden">
        <div className="hidden grid-cols-[150px_1fr_140px_150px_150px_140px_150px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 xl:grid">
          <span>Reference</span><span>Fournisseur</span><span>Commande</span><span>Livraison</span><span>Montant</span><span>Acheteur</span><span>Statut</span>
        </div>
        <div className="divide-y divide-slate-200">
          {orders.map((order) => (
            <Link key={order.id} to={`/purchase-orders/${order.id}`} className="grid gap-3 px-5 py-4 transition hover:bg-slate-50 xl:grid-cols-[150px_1fr_140px_150px_150px_140px_150px] xl:items-center">
              <span className="font-bold text-[#1E3A8A]">{order.reference}</span>
              <span><span className="block font-semibold">{order.suppliers?.name}</span><span className="text-xs text-slate-500">{order.supplier_reference || 'Sans reference fournisseur'}</span></span>
              <span>{new Date(order.order_date).toLocaleDateString('fr-FR')}</span>
              <span>{new Date(order.delivery_date).toLocaleDateString('fr-FR')}</span>
              <span>{Number(order.total_amount ?? 0).toLocaleString('fr-FR')} Ar</span>
              <span>{order.creator?.full_name || '-'}</span>
              <Badge status={order.status} />
            </Link>
          ))}
          {orders.length === 0 && <p className="p-5 text-sm text-slate-600">Aucune commande fournisseur.</p>}
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

function Badge({ status }: { status: PurchaseOrderStatus }) {
  const color = {
    brouillon: 'bg-slate-100 text-slate-700',
    validee: 'bg-blue-50 text-blue-800',
    envoyee: 'bg-purple-50 text-purple-800',
    partiellement_livree: 'bg-orange-50 text-orange-800',
    livree: 'bg-emerald-50 text-emerald-800',
    reception_avec_ecart: 'bg-yellow-50 text-yellow-800',
    annulee: 'bg-red-50 text-red-800',
    cloturee: 'bg-slate-200 text-slate-800',
  }[status]
  return <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${color}`}>{purchaseOrderStatusLabels[status]}</span>
}
