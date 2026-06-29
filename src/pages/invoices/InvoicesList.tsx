import { Download, FileSpreadsheet, Plus, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { listInvoices } from '../../api/modules/invoices.api'
import { listSuppliers } from '../../api/modules/suppliers.api'
import { useAuth } from '../../hooks/useAuth'
import { exportInvoicesToCsv, exportInvoicesToExcel } from '../../lib/invoiceExports'
import { canExportInvoices, canManageInvoices, invoiceStatusLabels, invoiceStatuses, paymentModeLabels, paymentModes } from '../../lib/invoices'
import type { Invoice, InvoiceStatus, PaymentMode } from '../../lib/invoices'
import type { Supplier } from '../../lib/suppliers'

export function InvoicesList() {
  const { profile } = useAuth()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<InvoiceStatus | 'all'>('all')
  const [supplierId, setSupplierId] = useState('')
  const [paymentMode, setPaymentMode] = useState<PaymentMode | 'all'>('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 10
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const filters = useMemo(() => ({ search, status, supplierId, paymentMode, page, pageSize }), [search, status, supplierId, paymentMode, page])
  const canManage = canManageInvoices(profile?.role)
  const canExport = canExportInvoices(profile?.role)

  const load = useCallback(async () => {
    const result = await listInvoices(filters)
    setInvoices(result.invoices)
    setTotal(result.total)
  }, [filters])

  useEffect(() => {
    listSuppliers().then(setSuppliers).catch(() => toast.error('Impossible de charger les fournisseurs.'))
  }, [])

  useEffect(() => {
    load().catch(() => toast.error('Impossible de charger les factures.'))
  }, [load])

  const dashboard = {
    waiting: invoices.filter((item) => ['a_verifier', 'a_payer', 'validee', 'partiellement_paye'].includes(item.status)).length,
    overdue: invoices.filter((item) => Number(item.amount_remaining ?? 0) > 0 && item.due_date < new Date().toISOString().slice(0, 10)).length,
    dueSoon: invoices.filter((item) => Number(item.amount_remaining ?? 0) > 0 && daysUntil(item.due_date) >= 0 && daysUntil(item.due_date) <= 7).length,
    remaining: invoices.reduce((sum, item) => sum + Number(item.amount_remaining ?? 0), 0),
  }

  const exportCurrent = async (format: 'csv' | 'xlsx') => {
    const result = await listInvoices({ ...filters, page: 1, pageSize: 1000 })
    if (format === 'csv') exportInvoicesToCsv(result.invoices)
    else exportInvoicesToExcel(result.invoices)
    toast.success('Facture exportee avec succes')
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">Factures</p><h1 className="page-title mt-2">Factures fournisseurs</h1></div>
        <div className="flex flex-wrap gap-2">
          {canExport && <button type="button" onClick={() => exportCurrent('csv')} className="btn-secondary"><Download className="mr-2 h-4 w-4" /> CSV</button>}
          {canExport && <button type="button" onClick={() => exportCurrent('xlsx')} className="btn-secondary"><FileSpreadsheet className="mr-2 h-4 w-4" /> Excel</button>}
          {canManage && <Link to="/invoices/new" className="btn-primary"><Plus className="mr-2 h-4 w-4" /> Nouvelle facture</Link>}
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="A traiter" value={String(dashboard.waiting)} />
        <Metric label="Echeances 7 jours" value={String(dashboard.dueSoon)} />
        <Metric label="En retard" value={String(dashboard.overdue)} />
        <Metric label="Solde a payer" value={`${dashboard.remaining.toLocaleString('fr-FR')} Ar`} />
      </section>

      <section className="surface grid gap-3 p-4 xl:grid-cols-[1fr_180px_220px_210px]">
        <label className="relative block"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => { setPage(1); setSearch(event.target.value) }} className="input pl-9" placeholder="Recherche numero" /></label>
        <select value={status} onChange={(event) => { setPage(1); setStatus(event.target.value as InvoiceStatus | 'all') }} className="input"><option value="all">Tous statuts</option>{invoiceStatuses.map((item) => <option key={item} value={item}>{invoiceStatusLabels[item]}</option>)}</select>
        <select value={supplierId} onChange={(event) => { setPage(1); setSupplierId(event.target.value) }} className="input"><option value="">Tous fournisseurs</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select>
        <select value={paymentMode} onChange={(event) => { setPage(1); setPaymentMode(event.target.value as PaymentMode | 'all') }} className="input"><option value="all">Tous paiements</option>{paymentModes.map((mode) => <option key={mode} value={mode}>{paymentModeLabels[mode]}</option>)}</select>
      </section>

      <section className="surface overflow-hidden">
        <div className="hidden grid-cols-[150px_1fr_120px_120px_130px_130px_140px_140px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 xl:grid">
          <span>Reference</span><span>Fournisseur</span><span>Date</span><span>Echeance</span><span>TTC</span><span>Solde</span><span>Statut</span><span>Paiement</span>
        </div>
        <div className="divide-y divide-slate-200">
          {invoices.map((invoice) => (
            <Link key={invoice.id} to={`/invoices/${invoice.id}`} className="grid gap-3 px-5 py-4 transition hover:bg-slate-50 xl:grid-cols-[150px_1fr_120px_120px_130px_130px_140px_140px] xl:items-center">
              <span className="font-bold text-[#1E3A8A]">{invoice.reference}</span>
              <span><span className="block font-semibold">{invoice.suppliers?.name}</span><span className="text-xs text-slate-500">{invoice.invoice_number}</span></span>
              <span>{new Date(invoice.invoice_date).toLocaleDateString('fr-FR')}</span>
              <span className={invoice.due_date < new Date().toISOString().slice(0, 10) && Number(invoice.amount_remaining) > 0 ? 'font-bold text-red-700' : ''}>{new Date(invoice.due_date).toLocaleDateString('fr-FR')}</span>
              <span>{Number(invoice.amount_ttc ?? 0).toLocaleString('fr-FR')} Ar</span>
              <span>{Number(invoice.amount_remaining ?? 0).toLocaleString('fr-FR')} Ar</span>
              <Badge status={invoice.status} />
              <span>{invoice.payment_mode ? paymentModeLabels[invoice.payment_mode] : '-'}</span>
            </Link>
          ))}
          {invoices.length === 0 && <p className="p-5 text-sm text-slate-600">Aucune facture.</p>}
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

function daysUntil(date: string) {
  return Math.ceil((new Date(date).getTime() - new Date(new Date().toISOString().slice(0, 10)).getTime()) / 86400000)
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="surface p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-950">{value}</p></div>
}

function Badge({ status }: { status: InvoiceStatus }) {
  const colors: Record<InvoiceStatus, string> = {
    a_verifier: 'bg-yellow-50 text-yellow-800',
    validee: 'bg-blue-50 text-blue-800',
    a_payer: 'bg-orange-50 text-orange-800',
    payee: 'bg-emerald-50 text-emerald-800',
    partiellement_paye: 'bg-purple-50 text-purple-800',
    conteste: 'bg-red-50 text-red-800',
    cloturee: 'bg-slate-100 text-slate-700',
    annulee: 'bg-slate-200 text-slate-700',
  }
  return <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${colors[status]}`}>{invoiceStatusLabels[status]}</span>
}
