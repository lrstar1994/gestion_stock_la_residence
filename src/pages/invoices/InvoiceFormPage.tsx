import { Save, Upload } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { listArticles } from '../../api/modules/catalog.api'
import { createInvoice, getInvoice, listInvoiceableReceptions, updateInvoice } from '../../api/modules/invoices.api'
import { listSuppliers } from '../../api/modules/suppliers.api'
import { useAuth } from '../../hooks/useAuth'
import type { Article } from '../../lib/catalog'
import { calculateInvoiceItemsTotal, paymentModeLabels, paymentModes } from '../../lib/invoices'
import type { InvoiceFormValues } from '../../lib/invoices'
import { calculateMaterialCost, invoiceTaxModeLabels, invoiceTaxModes } from '../../lib/materialCosts'
import type { InvoiceTaxMode } from '../../lib/materialCosts'
import type { Reception } from '../../lib/receptions'
import type { Supplier } from '../../lib/suppliers'

const today = new Date().toISOString().slice(0, 10)

const emptyForm: InvoiceFormValues = {
  reference: '',
  supplier_id: '',
  invoice_number: '',
  invoice_date: today,
  due_date: today,
  amount_ht: 0,
  amount_tva: 0,
  invoice_tax_mode: 'invoice_with_recoverable_vat',
  vat_rate: 20,
  vat_recoverable: true,
  declared_extra_tax_rate: 0,
  declared_extra_tax_amount: 0,
  effective_cost_note: '',
  payment_mode: undefined,
  currency: 'Ar',
  comment: '',
  reception_id: '',
  purchase_order_id: '',
  cash_purchase_id: '',
  items: [],
}

export function InvoiceFormPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isEdit = Boolean(id)
  const [values, setValues] = useState<InvoiceFormValues>(emptyForm)
  const [articles, setArticles] = useState<Article[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [receptions, setReceptions] = useState<Reception[]>([])
  const [file, setFile] = useState<File | undefined>()
  const itemsTotal = useMemo(() => calculateInvoiceItemsTotal(values.items), [values.items])
  const amountTtc = Number(values.amount_ht ?? 0) + Number(values.amount_tva ?? 0)
  const materialCost = calculateMaterialCost({
    amountHt: values.amount_ht,
    vatAmount: values.amount_tva,
    amountTtc,
    quantityStock: 1,
    invoiceTaxMode: values.invoice_tax_mode as InvoiceTaxMode,
    vatRate: values.vat_rate,
    vatRecoverable: values.vat_recoverable,
    declaredExtraTaxRate: values.declared_extra_tax_rate,
    declaredExtraTaxAmount: values.declared_extra_tax_amount,
  })
  const selectedReception = receptions.find((reception) => reception.id === values.reception_id)
  const receptionDifference = selectedReception ? amountTtc - Number(selectedReception.total_amount ?? 0) : 0

  const selectReception = useCallback((reception: Reception) => {
    setValues((current) => ({
      ...current,
      supplier_id: reception.supplier_id,
      invoice_number: reception.invoice_number,
      invoice_date: reception.invoice_date,
      due_date: current.due_date || reception.invoice_date,
      amount_ht: Number(reception.total_amount ?? 0),
      invoice_tax_mode: current.invoice_tax_mode ?? 'invoice_with_recoverable_vat',
      vat_rate: current.vat_rate ?? 20,
      vat_recoverable: current.vat_recoverable ?? true,
      declared_extra_tax_rate: current.declared_extra_tax_rate ?? 0,
      declared_extra_tax_amount: current.declared_extra_tax_amount ?? 0,
      reception_id: reception.id,
      purchase_order_id: reception.purchase_order_id ?? '',
      cash_purchase_id: reception.cash_purchase_id ?? '',
      items: reception.reception_items?.map((item) => ({
        article_id: item.article_id,
        quantity: Number(item.quantity_accepted ?? 0),
        unit_id: item.unit_id,
        unit_price: Number(item.unit_price_real ?? 0),
        supplier_tax_status: item.supplier_tax_status ?? undefined,
        invoice_tax_mode: item.invoice_tax_mode ?? undefined,
        vat_rate: Number(item.vat_rate ?? 20),
        vat_recoverable: item.vat_recoverable ?? true,
        declared_extra_tax_rate: Number(item.declared_extra_tax_rate ?? 0),
        declared_extra_tax_amount: Number(item.declared_extra_tax_amount ?? 0),
        effective_cost_note: item.effective_cost_note ?? '',
        comment: '',
      })) ?? [],
    }))
  }, [])

  const load = useCallback(async () => {
    const [articlesResult, loadedSuppliers, loadedReceptions] = await Promise.all([
      listArticles({ page: 1, pageSize: 1000, status: 'active' }),
      listSuppliers(),
      listInvoiceableReceptions(),
    ])
    setArticles(articlesResult.articles)
    setSuppliers(loadedSuppliers)
    setReceptions(loadedReceptions as Reception[])

    if (id) {
      const invoice = await getInvoice(id)
      setValues({
        reference: invoice.reference,
        supplier_id: invoice.supplier_id,
        invoice_number: invoice.invoice_number,
        invoice_date: invoice.invoice_date,
        due_date: invoice.due_date,
        amount_ht: Number(invoice.amount_ht ?? 0),
        amount_tva: Number(invoice.amount_tva ?? 0),
        invoice_tax_mode: invoice.invoice_tax_mode ?? 'invoice_with_recoverable_vat',
        vat_rate: Number(invoice.vat_rate ?? 20),
        vat_recoverable: invoice.vat_recoverable ?? true,
        declared_extra_tax_rate: Number(invoice.declared_extra_tax_rate ?? 0),
        declared_extra_tax_amount: Number(invoice.declared_extra_tax_amount ?? 0),
        effective_cost_note: invoice.effective_cost_note ?? '',
        payment_mode: invoice.payment_mode ?? undefined,
        currency: 'Ar',
        comment: invoice.comment ?? '',
        reception_id: invoice.reception_id ?? '',
        purchase_order_id: invoice.purchase_order_id ?? '',
        cash_purchase_id: invoice.cash_purchase_id ?? '',
        items: invoice.invoice_items?.map((item) => ({
          article_id: item.article_id,
          quantity: Number(item.quantity ?? 0),
          unit_id: item.unit_id,
          unit_price: Number(item.unit_price ?? 0),
          supplier_tax_status: item.supplier_tax_status ?? undefined,
          invoice_tax_mode: item.invoice_tax_mode ?? undefined,
          vat_rate: Number(item.vat_rate ?? 20),
          vat_recoverable: item.vat_recoverable ?? true,
          declared_extra_tax_rate: Number(item.declared_extra_tax_rate ?? 0),
          declared_extra_tax_amount: Number(item.declared_extra_tax_amount ?? 0),
          effective_cost_note: item.effective_cost_note ?? '',
          comment: item.comment ?? '',
        })) ?? [],
      })
    } else {
      const receptionId = searchParams.get('receptionId')
      const reception = loadedReceptions.find((item) => item.id === receptionId)
      if (reception) selectReception(reception as Reception)
    }
  }, [id, searchParams, selectReception])

  useEffect(() => {
    load().catch(() => toast.error('Impossible de charger le formulaire.'))
  }, [load])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      const payload = { ...values, amount_ht: values.amount_ht || itemsTotal }
      if (id) {
        await updateInvoice(id, payload, profile?.id, file)
        toast.success('Facture mise a jour avec succes')
        navigate(`/invoices/${id}`)
      } else {
        if (!file) throw new Error('Veuillez ajouter une piece jointe')
        const invoiceId = await createInvoice(payload, profile?.id, file)
        toast.success('Facture creee avec succes')
        navigate(`/invoices/${invoiceId}`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Une erreur est survenue')
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">Facture</p><h1 className="page-title mt-2">{isEdit ? 'Modifier la facture' : 'Nouvelle facture'}</h1></div>
        <div className="flex gap-2"><Link to="/invoices" className="btn-secondary">Annuler</Link><button type="submit" className="btn-primary"><Save className="mr-2 h-4 w-4" /> Enregistrer</button></div>
      </header>

      {!isEdit && (
        <section className="surface p-5">
          <label className="block"><span className="field-label">Reception a facturer</span><select value={values.reception_id} onChange={(event) => { const reception = receptions.find((item) => item.id === event.target.value); if (reception) selectReception(reception); else setValues(emptyForm) }} className="input mt-2"><option value="">Selectionner une reception</option>{receptions.map((reception) => <option key={reception.id} value={reception.id}>{reception.reference} - {reception.suppliers?.name}</option>)}</select></label>
          <p className="mt-3 text-sm text-slate-600">La facture doit etre rattachee a une reception. Les articles factures sont repris automatiquement depuis la reception selectionnee.</p>
        </section>
      )}

      <section className="surface grid gap-4 p-5 md:grid-cols-2">
        <label className="block">
          <span className="field-label">Numero facture interne</span>
          <input value={values.reference ?? ''} onChange={(event) => setValues((current) => ({ ...current, reference: event.target.value }))} className="input mt-2" placeholder="Laisser vide pour generer automatiquement" />
        </label>
        <label className="block"><span className="field-label">Fournisseur</span><select value={values.supplier_id} onChange={(event) => setValues((current) => ({ ...current, supplier_id: event.target.value }))} className="input mt-2"><option value="">Selectionner</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
        <label className="block"><span className="field-label">Numero facture fournisseur</span><input value={values.invoice_number} onChange={(event) => setValues((current) => ({ ...current, invoice_number: event.target.value }))} className="input mt-2" /></label>
        <label className="block"><span className="field-label">Date facture</span><input type="date" value={values.invoice_date} onChange={(event) => setValues((current) => ({ ...current, invoice_date: event.target.value }))} className="input mt-2" /></label>
        <label className="block"><span className="field-label">Date echeance</span><input type="date" value={values.due_date} onChange={(event) => setValues((current) => ({ ...current, due_date: event.target.value }))} className="input mt-2" /></label>
        <label className="block"><span className="field-label">Montant HT facture</span><input type="number" value={values.amount_ht} onChange={(event) => setValues((current) => ({ ...current, amount_ht: Number(event.target.value) }))} className="input mt-2" /></label>
        <label className="block"><span className="field-label">Montant TVA facture</span><input type="number" value={values.amount_tva} onChange={(event) => setValues((current) => ({ ...current, amount_tva: Number(event.target.value) }))} className="input mt-2" /></label>
        <label className="block"><span className="field-label">Mode paiement prevu</span><select value={values.payment_mode ?? ''} onChange={(event) => setValues((current) => ({ ...current, payment_mode: event.target.value as InvoiceFormValues['payment_mode'] || undefined }))} className="input mt-2"><option value="">Non defini</option>{paymentModes.map((mode) => <option key={mode} value={mode}>{paymentModeLabels[mode]}</option>)}</select></label>
        <label className="block"><span className="field-label">Piece jointe obligatoire</span><label className="btn-secondary mt-2 cursor-pointer"><Upload className="mr-2 h-4 w-4" /> {file?.name ?? 'Choisir fichier'}<input type="file" accept="image/*,.pdf" required={!isEdit} onChange={(event) => setFile(event.target.files?.[0])} className="hidden" /></label>{!isEdit && <p className="mt-1 text-xs font-semibold text-amber-700">Obligatoire pour creer la facture.</p>}</label>
        <label className="block md:col-span-2"><span className="field-label">Commentaire</span><textarea value={values.comment} onChange={(event) => setValues((current) => ({ ...current, comment: event.target.value }))} className="input mt-2 min-h-24" /></label>
      </section>

      <section className="surface grid gap-4 p-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <p className="eyebrow">Fiscalite et cout matiere interne</p>
          <h2 className="mt-2 text-lg font-bold text-slate-950">Cout matiere interne de la facture</h2>
          <p className="mt-1 text-sm text-slate-600">Ces informations distinguent la lecture comptable de la valorisation interne du stock.</p>
        </div>
        <label className="block">
          <span className="field-label">Mode fiscal</span>
          <select value={values.invoice_tax_mode ?? 'invoice_with_recoverable_vat'} onChange={(event) => setValues((current) => ({ ...current, invoice_tax_mode: event.target.value as InvoiceTaxMode }))} className="input mt-2">
            {invoiceTaxModes.map((mode) => <option key={mode} value={mode}>{invoiceTaxModeLabels[mode]}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Taux TVA facture</span>
          <input type="number" value={values.vat_rate ?? 20} onChange={(event) => setValues((current) => ({ ...current, vat_rate: Number(event.target.value) }))} className="input mt-2" />
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={values.vat_recoverable ?? true} onChange={(event) => setValues((current) => ({ ...current, vat_recoverable: event.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-[#1E3A8A] focus:ring-[#1E3A8A]" />
          TVA recuperable par La Residence
        </label>
        <label className="block">
          <span className="field-label">Charge declarative %</span>
          <input type="number" value={values.declared_extra_tax_rate ?? 0} onChange={(event) => setValues((current) => ({ ...current, declared_extra_tax_rate: Number(event.target.value) }))} className="input mt-2" />
        </label>
        <label className="block md:col-span-2">
          <span className="field-label">Note cout matiere interne</span>
          <input value={values.effective_cost_note ?? ''} onChange={(event) => setValues((current) => ({ ...current, effective_cost_note: event.target.value }))} className="input mt-2" placeholder="Motif ou precision si cout exceptionnel" />
        </label>
        <div className="rounded-md border border-[#D4AF37]/30 bg-amber-50 p-4 text-sm text-slate-800 md:col-span-2">
          <p>TVA recuperable : <strong>{materialCost.recoverable_vat_amount.toLocaleString('fr-FR')} Ar</strong></p>
          <p>TVA non recuperable : <strong>{materialCost.non_recoverable_vat_amount.toLocaleString('fr-FR')} Ar</strong></p>
          <p>Charge declarative : <strong>{materialCost.declared_extra_tax_amount.toLocaleString('fr-FR')} Ar</strong></p>
          <p>Cout matiere interne estime : <strong>{Number(materialCost.effective_material_cost_total ?? 0).toLocaleString('fr-FR')} Ar</strong></p>
        </div>
      </section>

      <section className="surface overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold">Articles factures repris de la reception</h2>
          <p className="mt-1 text-sm text-slate-600">Lignes reprises depuis la reception. Aucun ajout ou suppression manuel n'est autorise.</p>
        </div>
        <div className="divide-y divide-slate-200">
          {values.items.map((item, index) => {
            const selectedArticle = articles.find((article) => article.id === item.article_id)
            return (
              <div key={`${item.article_id}-${index}`} className="grid gap-3 px-5 py-4 xl:grid-cols-[1fr_130px_120px_150px_150px] xl:items-center">
                <div><span className="field-label">Article</span><p className="mt-2 font-semibold text-slate-950">{selectedArticle?.name ?? item.article_id}</p></div>
                <div><span className="field-label">Quantite</span><p className="mt-2 font-bold">{Number(item.quantity).toLocaleString('fr-FR')}</p></div>
                <div><span className="field-label">Unite</span><p className="mt-2 font-semibold">{selectedArticle?.units?.abbreviation ?? '-'}</p></div>
                <div><span className="field-label">Prix unitaire facture</span><p className="mt-2 font-bold">{Number(item.unit_price).toLocaleString('fr-FR')} Ar</p></div>
                <div><span className="field-label">Total ligne facture</span><p className="mt-2 font-bold">{(Number(item.quantity) * Number(item.unit_price)).toLocaleString('fr-FR')} Ar</p></div>
              </div>
            )
          })}
          {values.items.length === 0 && <p className="p-5 text-sm text-slate-600">Aucun article.</p>}
        </div>
      </section>

      <section className="surface flex items-center justify-between p-5">
        <span className="text-sm text-slate-600">Montant TTC facture calcule</span>
        <span className="text-2xl font-black text-[#1E3A8A]">{amountTtc.toLocaleString('fr-FR')} Ar</span>
      </section>

      {selectedReception && Math.abs(receptionDifference) > 0.01 && (
        <section className="surface border border-orange-200 bg-orange-50 p-5">
          <h2 className="font-bold text-orange-900">Ecart avec la reception</h2>
          <p className="mt-1 text-sm text-orange-800">
            Reception : {Number(selectedReception.total_amount ?? 0).toLocaleString('fr-FR')} Ar · Facture : {amountTtc.toLocaleString('fr-FR')} Ar · Ecart : {receptionDifference.toLocaleString('fr-FR')} Ar
          </p>
        </section>
      )}
    </form>
  )
}
