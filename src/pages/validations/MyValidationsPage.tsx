import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listCashPurchases } from '../../api/modules/cashPurchases.api'
import { listInvoices } from '../../api/modules/invoices.api'
import { listPurchaseNeedsGlobal } from '../../api/modules/purchaseNeeds.api'
import { listPurchaseOrders } from '../../api/modules/purchaseOrders.api'
import { listReceptions } from '../../api/modules/receptions.api'
import { useAuth } from '../../hooks/useAuth'
import { cashPurchaseStatusLabels } from '../../lib/cashPurchases'
import { invoicePaymentStatusLabels, invoiceStatusLabels } from '../../lib/invoices'
import { needStatusLabels } from '../../lib/purchaseNeeds'
import { purchaseOrderStatusLabels } from '../../lib/purchaseOrders'
import { receptionStatusLabels } from '../../lib/receptions'

type ValidationRow = {
  id: string
  type: string
  title: string
  detail: string
  status: string
  to: string
  priority: number
}

export function MyValidationsPage() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<ValidationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false

    async function load() {
      if (profile?.role !== 'direction') {
        setRows([])
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)
        const [needs, cash, orders, receptions, invoices] = await Promise.all([
          listPurchaseNeedsGlobal({ status: 'a_faire', pageSize: 10 }),
          listCashPurchases({ status: 'all', pageSize: 15 }),
          listPurchaseOrders({ status: 'all', pageSize: 15 }),
          listReceptions({ status: 'all', pageSize: 15 }),
          listInvoices({ status: 'all', pageSize: 15 }),
        ])

        if (ignore) return
        const nextRows: ValidationRow[] = [
          ...needs.needs.map((need) => ({
            id: `need-${need.id}`,
            type: "Besoin d'achat",
            title: need.articles?.name ?? 'Besoin sans article',
            detail: `${Number(need.quantity ?? 0).toLocaleString('fr-FR')} ${need.units?.abbreviation ?? ''} - ${need.requester?.full_name ?? 'Demandeur non renseigne'}`,
            status: needStatusLabels[need.status],
            to: '/purchase-needs',
            priority: need.urgency === 'normal' ? 4 : 2,
          })),
          ...cash.purchases
            .filter((purchase) => ['en_attente', 'retour_complet'].includes(purchase.status))
            .map((purchase) => ({
              id: `cash-${purchase.id}`,
              type: 'Achat especes',
              title: purchase.reference,
              detail: `${purchase.reason} - ${Number(purchase.amount_requested ?? 0).toLocaleString('fr-FR')} Ar`,
              status: cashPurchaseStatusLabels[purchase.status],
              to: `/cash-purchases/${purchase.id}`,
              priority: purchase.status === 'en_attente' ? 1 : 3,
            })),
          ...orders.orders
            .filter((order) => ['brouillon', 'livree'].includes(order.status))
            .map((order) => ({
              id: `order-${order.id}`,
              type: 'Commande fournisseur',
              title: order.reference,
              detail: `${order.suppliers?.name ?? 'Fournisseur non renseigne'} - ${Number(order.total_amount ?? 0).toLocaleString('fr-FR')} Ar`,
              status: purchaseOrderStatusLabels[order.status],
              to: `/purchase-orders/${order.id}`,
              priority: order.status === 'brouillon' ? 2 : 5,
            })),
          ...receptions.receptions
            .filter((reception) => ['en_attente', 'validee'].includes(reception.status))
            .map((reception) => ({
              id: `reception-${reception.id}`,
              type: 'Reception',
              title: reception.reference,
              detail: reception.suppliers?.name ?? 'Fournisseur non renseigne',
              status: receptionStatusLabels[reception.status],
              to: `/receptions/${reception.id}`,
              priority: reception.status === 'en_attente' ? 2 : 6,
            })),
          ...invoices.invoices
            .filter((invoice) => ['a_verifier', 'conteste'].includes(invoice.status))
            .map((invoice) => ({
              id: `invoice-${invoice.id}`,
              type: 'Facture fournisseur',
              title: invoice.reference,
              detail: `${invoice.suppliers?.name ?? invoice.invoice_number} - ${Number(invoice.amount_ttc ?? 0).toLocaleString('fr-FR')} Ar`,
              status: invoiceStatusLabels[invoice.status],
              to: `/invoices/${invoice.id}`,
              priority: invoice.status === 'conteste' ? 1 : 3,
            })),
          ...invoices.invoices.flatMap((invoice) => (invoice.invoice_payments ?? [])
            .filter((payment) => payment.status === 'a_valider_direction')
            .map((payment) => ({
              id: `invoice-payment-${payment.id}`,
              type: 'Paiement fournisseur',
              title: invoice.reference,
              detail: `${invoice.suppliers?.name ?? invoice.invoice_number} - ${Number(payment.amount ?? 0).toLocaleString('fr-FR')} Ar`,
              status: invoicePaymentStatusLabels[payment.status ?? 'a_valider_direction'],
              to: `/invoices/${invoice.id}`,
              priority: 4,
            }))),
        ]

        setRows(nextRows.sort((a, b) => a.priority - b.priority || a.type.localeCompare(b.type)))
      } catch {
        if (!ignore) setError('Impossible de charger les validations.')
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    load()
    return () => {
      ignore = true
    }
  }, [profile?.role])

  const grouped = useMemo(() => {
    return rows.reduce<Record<string, ValidationRow[]>>((groups, row) => {
      groups[row.type] = [...(groups[row.type] ?? []), row]
      return groups
    }, {})
  }, [rows])

  if (profile?.role !== 'direction') {
    return (
      <div className="surface p-6">
        <p className="eyebrow">Validations</p>
        <h1 className="page-title mt-2">Mes validations</h1>
        <p className="mt-2 text-sm text-slate-600">Cette page est reservee a la Direction.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header className="surface p-6">
        <p className="eyebrow">Direction</p>
        <h1 className="page-title mt-2">Mes validations</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Les actions qui demandent une decision Direction sont rassemblees ici. Le code PIN reste demande uniquement dans le dossier concerne.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="A valider" value={rows.length} />
        <Metric label="Achats especes" value={grouped['Achat especes']?.length ?? 0} />
        <Metric label="Commandes" value={grouped['Commande fournisseur']?.length ?? 0} />
        <Metric label="Factures" value={grouped['Facture fournisseur']?.length ?? 0} />
      </section>

      {loading && <div className="surface p-5 text-sm text-slate-600">Chargement des validations...</div>}
      {error && <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

      {!loading && !error && (
        <section className="surface overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-black text-slate-950">Actions en attente</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {rows.map((row) => (
              <Link key={row.id} to={row.to} className="grid gap-3 px-5 py-4 transition hover:bg-slate-50 md:grid-cols-[180px_1fr_150px] md:items-center">
                <span className="text-sm font-bold text-[#1E3A8A]">{row.type}</span>
                <span>
                  <span className="block font-bold text-slate-950">{row.title}</span>
                  <span className="mt-1 block text-sm text-slate-600">{row.detail}</span>
                </span>
                <span className="w-fit rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">{row.status}</span>
              </Link>
            ))}
            {rows.length === 0 && <p className="px-5 py-4 text-sm text-slate-600">Aucune validation en attente.</p>}
          </div>
        </section>
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
