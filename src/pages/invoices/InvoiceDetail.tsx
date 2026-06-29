import { CheckCircle, Download, Edit, XCircle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { addInvoicePayment, closeInvoice, contestInvoice, getInvoice, validateInvoiceRecord } from '../../api/modules/invoices.api'
import { useAuth } from '../../hooks/useAuth'
import { exportInvoiceToPdf } from '../../lib/invoiceExports'
import { canManageInvoices, canPayInvoices, invoiceStatusLabels, paymentModeLabels, paymentModes } from '../../lib/invoices'
import type { Invoice, InvoicePaymentFormValues } from '../../lib/invoices'

const today = new Date().toISOString().slice(0, 10)

export function InvoiceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [payment, setPayment] = useState<InvoicePaymentFormValues>({ amount: 0, payment_mode: 'virement', payment_date: today, payment_reference: '', comment: '' })
  const canManage = canManageInvoices(profile?.role)
  const canPay = canPayInvoices(profile?.role)

  const load = useCallback(async () => {
    if (!id) return
    setInvoice(await getInvoice(id))
  }, [id])

  useEffect(() => {
    load().catch(() => {
      toast.error('Facture introuvable')
      navigate('/invoices')
    })
  }, [load, navigate])

  if (!invoice) return <div className="surface p-6 text-sm text-slate-600">Chargement...</div>

  const validate = async () => {
    const comment = window.prompt('Commentaire de validation (optionnel)') ?? ''
    await validateInvoiceRecord(invoice.id, profile?.id, comment)
    toast.success('Facture validee avec succes')
    await load()
  }

  const contest = async () => {
    const reason = window.prompt('Motif de contestation')
    if (!reason) return
    await contestInvoice(invoice.id, profile?.id, reason)
    toast.success('Facture contestee')
    await load()
  }

  const pay = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      await addInvoicePayment(invoice.id, payment, profile?.id)
      toast.success('Paiement enregistre avec succes')
      setPayment({ amount: 0, payment_mode: 'virement', payment_date: today, payment_reference: '', comment: '' })
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Une erreur est survenue')
    }
  }

  const close = async () => {
    try {
      await closeInvoice(invoice.id, profile?.id)
      toast.success('Facture cloturee')
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Une erreur est survenue')
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Facture</p>
          <h1 className="page-title mt-2">{invoice.reference}</h1>
          <p className="mt-2 text-sm text-slate-600">{invoice.suppliers?.name} - {invoiceStatusLabels[invoice.status]}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => { exportInvoiceToPdf(invoice); toast.success('Facture exportee avec succes') }} className="btn-secondary"><Download className="mr-2 h-4 w-4" /> PDF</button>
          {canManage && !['payee', 'cloturee', 'annulee'].includes(invoice.status) && <Link to={`/invoices/${invoice.id}/edit`} className="btn-secondary"><Edit className="mr-2 h-4 w-4" /> Modifier</Link>}
          <Link to="/invoices" className="btn-secondary">Retour</Link>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="Montant TTC" value={`${Number(invoice.amount_ttc).toLocaleString('fr-FR')} Ar`} />
        <Metric label="Montant paye" value={`${Number(invoice.amount_paid).toLocaleString('fr-FR')} Ar`} />
        <Metric label="Solde restant" value={`${Number(invoice.amount_remaining).toLocaleString('fr-FR')} Ar`} />
        <Metric label="Echeance" value={new Date(invoice.due_date).toLocaleDateString('fr-FR')} />
      </section>

      <section className="surface grid gap-4 p-5 md:grid-cols-2">
        <Info label="Fournisseur" value={invoice.suppliers?.name || '-'} />
        <Info label="Numero facture" value={invoice.invoice_number} />
        <Info label="Date facture" value={new Date(invoice.invoice_date).toLocaleDateString('fr-FR')} />
        <Info label="Mode paiement" value={invoice.payment_mode ? paymentModeLabels[invoice.payment_mode] : '-'} />
        {invoice.receptions ? <InfoLink label="Reception liee" value={invoice.receptions.reference} to={`/receptions/${invoice.receptions.id}`} /> : <Info label="Reception liee" value="-" />}
        <Info label="Validation" value={invoice.validated_at ? `${new Date(invoice.validated_at).toLocaleString('fr-FR')} - ${invoice.validator?.full_name || ''}` : '-'} />
        {invoice.file_url && <a href={invoice.file_url} target="_blank" className="font-semibold text-[#1E3A8A]">Voir piece jointe : {invoice.file_name}</a>}
        {invoice.comment && <div className="md:col-span-2"><Info label="Commentaire" value={invoice.comment} /></div>}
      </section>

      {canManage && (
        <section className="surface flex flex-wrap gap-3 p-5">
          {invoice.status === 'a_verifier' && <button type="button" onClick={validate} className="btn-primary"><CheckCircle className="mr-2 h-4 w-4" /> Valider</button>}
          {!['payee', 'cloturee', 'annulee'].includes(invoice.status) && <button type="button" onClick={contest} className="btn-secondary text-red-700"><XCircle className="mr-2 h-4 w-4" /> Contester</button>}
          {invoice.status === 'payee' && <button type="button" onClick={close} className="btn-primary">Cloturer</button>}
        </section>
      )}

      {invoice.receptions && Math.abs(Number(invoice.amount_ttc ?? 0) - Number(invoice.receptions.total_amount ?? 0)) > 0.01 && (
        <section className="surface border border-orange-200 bg-orange-50 p-5">
          <h2 className="font-bold text-orange-900">Ecart facture / reception</h2>
          <p className="mt-1 text-sm text-orange-800">
            Reception : {Number(invoice.receptions.total_amount ?? 0).toLocaleString('fr-FR')} Ar · Facture : {Number(invoice.amount_ttc ?? 0).toLocaleString('fr-FR')} Ar · Ecart : {(Number(invoice.amount_ttc ?? 0) - Number(invoice.receptions.total_amount ?? 0)).toLocaleString('fr-FR')} Ar
          </p>
        </section>
      )}

      {canPay && Number(invoice.amount_remaining ?? 0) > 0 && ['validee', 'a_payer', 'partiellement_paye'].includes(invoice.status) && (
        <form onSubmit={pay} className="surface grid gap-3 p-5 md:grid-cols-[1fr_180px_180px_1fr_auto] md:items-end">
          <label className="block"><span className="field-label">Montant paye</span><input type="number" value={payment.amount} onChange={(event) => setPayment((current) => ({ ...current, amount: Number(event.target.value) }))} className="input mt-2" /></label>
          <label className="block"><span className="field-label">Mode</span><select value={payment.payment_mode} onChange={(event) => setPayment((current) => ({ ...current, payment_mode: event.target.value as typeof payment.payment_mode }))} className="input mt-2">{paymentModes.map((mode) => <option key={mode} value={mode}>{paymentModeLabels[mode]}</option>)}</select></label>
          <label className="block"><span className="field-label">Date</span><input type="date" value={payment.payment_date} onChange={(event) => setPayment((current) => ({ ...current, payment_date: event.target.value }))} className="input mt-2" /></label>
          <label className="block"><span className="field-label">Reference</span><input value={payment.payment_reference} onChange={(event) => setPayment((current) => ({ ...current, payment_reference: event.target.value }))} className="input mt-2" /></label>
          <button type="submit" className="btn-primary">Payer</button>
        </form>
      )}

      <section className="surface overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4"><h2 className="text-lg font-bold">Articles</h2></div>
        <div className="divide-y divide-slate-200">
          {invoice.invoice_items?.map((item) => (
            <div key={item.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_130px_130px_130px] md:items-center">
              <span className="font-semibold">{item.articles?.name}</span>
              <span>{Number(item.quantity).toLocaleString('fr-FR')} {item.units?.abbreviation}</span>
              <span>{Number(item.unit_price).toLocaleString('fr-FR')} Ar</span>
              <span>{Number(item.total ?? 0).toLocaleString('fr-FR')} Ar</span>
            </div>
          ))}
          {(invoice.invoice_items?.length ?? 0) === 0 && <p className="p-5 text-sm text-slate-600">Aucun article.</p>}
        </div>
      </section>

      <section className="surface overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4"><h2 className="text-lg font-bold">Paiements</h2></div>
        <div className="divide-y divide-slate-200">
          {invoice.invoice_payments?.map((item) => (
            <div key={item.id} className="grid gap-3 px-5 py-4 md:grid-cols-[130px_150px_1fr_150px] md:items-center">
              <span>{new Date(item.payment_date).toLocaleDateString('fr-FR')}</span>
              <span>{Number(item.amount).toLocaleString('fr-FR')} Ar</span>
              <span>{paymentModeLabels[item.payment_mode]} {item.payment_reference ? `- ${item.payment_reference}` : ''}</span>
              <span>{item.creator?.full_name || '-'}</span>
            </div>
          ))}
          {(invoice.invoice_payments?.length ?? 0) === 0 && <p className="p-5 text-sm text-slate-600">Aucun paiement.</p>}
        </div>
      </section>

      <section className="surface overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4"><h2 className="text-lg font-bold">Historique</h2></div>
        <div className="divide-y divide-slate-200">
          {invoice.invoice_history?.map((item) => (
            <div key={item.id} className="grid gap-2 px-5 py-4 md:grid-cols-[170px_160px_1fr_180px] md:items-center">
              <span>{new Date(item.created_at).toLocaleString('fr-FR')}</span>
              <span className="font-bold text-[#1E3A8A]">{item.action}</span>
              <span>{item.description}</span>
              <span>{item.actor?.full_name || '-'}</span>
            </div>
          ))}
          {(invoice.invoice_history?.length ?? 0) === 0 && <p className="p-5 text-sm text-slate-600">Aucun historique.</p>}
        </div>
      </section>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="surface p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-950">{value}</p></div>
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 font-semibold text-slate-950">{value}</p></div>
}

function InfoLink({ label, value, to }: { label: string; value: string; to: string }) {
  return <div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p><Link to={to} className="mt-1 inline-block font-semibold text-[#1E3A8A] hover:underline">{value}</Link></div>
}
