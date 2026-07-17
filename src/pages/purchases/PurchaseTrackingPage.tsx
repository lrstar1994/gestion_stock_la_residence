import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listCashPurchases } from '../../api/modules/cashPurchases.api'
import { listInvoices } from '../../api/modules/invoices.api'
import { listPurchaseNeedsGlobal } from '../../api/modules/purchaseNeeds.api'
import { listPurchaseOrders } from '../../api/modules/purchaseOrders.api'
import { listReceptions } from '../../api/modules/receptions.api'
import { cashPurchaseStatusLabels } from '../../lib/cashPurchases'
import { invoiceStatusLabels } from '../../lib/invoices'
import { needStatusLabels } from '../../lib/purchaseNeeds'
import { purchaseOrderStatusLabels } from '../../lib/purchaseOrders'
import { receptionStatusLabels } from '../../lib/receptions'

type TrackingItem = {
  id: string
  title: string
  subtitle: string
  amount?: number | null
  status: string
  to: string
}

type TrackingState = {
  needs: TrackingItem[]
  cash: TrackingItem[]
  orders: TrackingItem[]
  receptions: TrackingItem[]
  invoices: TrackingItem[]
}

const emptyState: TrackingState = {
  needs: [],
  cash: [],
  orders: [],
  receptions: [],
  invoices: [],
}

export function PurchaseTrackingPage() {
  const [data, setData] = useState<TrackingState>(emptyState)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false

    async function load() {
      try {
        setLoading(true)
        setError(null)
        const [needs, cash, orders, receptions, invoices] = await Promise.all([
          listPurchaseNeedsGlobal({ status: 'open', pageSize: 8 }),
          listCashPurchases({ status: 'all', pageSize: 8 }),
          listPurchaseOrders({ status: 'all', pageSize: 8 }),
          listReceptions({ status: 'all', pageSize: 8 }),
          listInvoices({ status: 'all', pageSize: 8 }),
        ])

        if (ignore) return
        setData({
          needs: needs.needs
            .filter((need) => ['a_faire', 'en_cours', 'valide'].includes(need.status))
            .map((need) => ({
              id: need.id,
              title: need.articles?.name ?? 'Besoin sans article',
              subtitle: `${Number(need.quantity ?? 0).toLocaleString('fr-FR')} ${need.units?.abbreviation ?? ''} - ${need.requester?.full_name ?? 'Demandeur non renseigne'}`,
              amount: need.estimated_cost,
              status: needStatusLabels[need.status],
              to: '/purchase-needs',
            })),
          cash: cash.purchases
            .filter((purchase) => !['cloture', 'refuse'].includes(purchase.status))
            .map((purchase) => ({
              id: purchase.id,
              title: purchase.reference,
              subtitle: purchase.reason,
              amount: purchase.amount_requested,
              status: cashPurchaseStatusLabels[purchase.status],
              to: `/cash-purchases/${purchase.id}`,
            })),
          orders: orders.orders
            .filter((order) => !['annulee', 'cloturee'].includes(order.status))
            .map((order) => ({
              id: order.id,
              title: order.reference,
              subtitle: order.suppliers?.name ?? 'Fournisseur non renseigne',
              amount: order.total_amount,
              status: purchaseOrderStatusLabels[order.status],
              to: `/purchase-orders/${order.id}`,
            })),
          receptions: receptions.receptions
            .filter((reception) => !['entree_stock', 'refusee'].includes(reception.status))
            .map((reception) => ({
              id: reception.id,
              title: reception.reference,
              subtitle: reception.suppliers?.name ?? 'Fournisseur non renseigne',
              amount: reception.total_amount,
              status: receptionStatusLabels[reception.status],
              to: `/receptions/${reception.id}`,
            })),
          invoices: invoices.invoices
            .filter((invoice) => !['payee', 'cloturee', 'annulee'].includes(invoice.status))
            .map((invoice) => ({
              id: invoice.id,
              title: invoice.reference,
              subtitle: invoice.suppliers?.name ?? invoice.invoice_number,
              amount: invoice.amount_remaining,
              status: invoiceStatusLabels[invoice.status],
              to: `/invoices/${invoice.id}`,
            })),
        })
      } catch {
        if (!ignore) setError('Impossible de charger le suivi des achats.')
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    load()
    return () => {
      ignore = true
    }
  }, [])

  const totalOpen = useMemo(
    () => Object.values(data).reduce((sum, rows) => sum + rows.length, 0),
    [data],
  )

  return (
    <div className="space-y-6">
      <header className="surface flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="eyebrow">Achats</p>
          <h1 className="page-title mt-2">Suivi achats</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Une vue simple pour retrouver les besoins, achats especes, commandes, receptions et factures encore ouverts.
          </p>
        </div>
        <Link to="/purchases/new" className="btn-primary">Nouvel achat</Link>
      </header>

      <section className="grid gap-4 md:grid-cols-5">
        <Metric label="Dossiers ouverts" value={totalOpen} />
        <Metric label="Besoins" value={data.needs.length} />
        <Metric label="Achats especes" value={data.cash.length} />
        <Metric label="Commandes" value={data.orders.length} />
        <Metric label="Factures" value={data.invoices.length} />
      </section>

      {loading && <div className="surface p-5 text-sm text-slate-600">Chargement du suivi...</div>}
      {error && <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

      {!loading && !error && (
        <div className="grid gap-5 xl:grid-cols-2">
          <TrackingCard title="Besoins a traiter" rows={data.needs} empty="Aucun besoin ouvert." allTo="/purchase-needs" />
          <TrackingCard title="Achats especes" rows={data.cash} empty="Aucun achat especes ouvert." allTo="/cash-purchases" />
          <TrackingCard title="Commandes fournisseurs" rows={data.orders} empty="Aucune commande ouverte." allTo="/purchase-orders" />
          <TrackingCard title="Receptions" rows={data.receptions} empty="Aucune reception ouverte." allTo="/receptions" />
          <TrackingCard title="Factures fournisseurs" rows={data.invoices} empty="Aucune facture ouverte." allTo="/invoices" />
        </div>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="surface p-4">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value.toLocaleString('fr-FR')}</p>
    </div>
  )
}

function TrackingCard({ title, rows, empty, allTo }: { title: string; rows: TrackingItem[]; empty: string; allTo: string }) {
  return (
    <section className="surface overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h2 className="font-black text-slate-950">{title}</h2>
        <Link to={allTo} className="text-sm font-bold text-[#1E3A8A]">Tout voir</Link>
      </div>
      <div className="divide-y divide-slate-100">
        {rows.map((row) => (
          <Link key={row.id} to={row.to} className="grid gap-3 px-5 py-4 transition hover:bg-slate-50 md:grid-cols-[1fr_130px_130px] md:items-center">
            <span>
              <span className="block font-bold text-slate-950">{row.title}</span>
              <span className="mt-1 block text-sm text-slate-600">{row.subtitle}</span>
            </span>
            <span className="text-sm font-semibold text-slate-700">{formatAmount(row.amount)}</span>
            <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#1E3A8A]">{row.status}</span>
          </Link>
        ))}
        {rows.length === 0 && <p className="px-5 py-4 text-sm text-slate-600">{empty}</p>}
      </div>
    </section>
  )
}

function formatAmount(value?: number | null) {
  if (value === null || value === undefined) return '-'
  return `${Number(value).toLocaleString('fr-FR')} Ar`
}
