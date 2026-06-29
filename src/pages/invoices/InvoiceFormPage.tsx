import { Plus, Save, Trash2, Upload } from 'lucide-react'
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
import type { Reception } from '../../lib/receptions'
import type { Supplier } from '../../lib/suppliers'

const today = new Date().toISOString().slice(0, 10)

const emptyForm: InvoiceFormValues = {
  supplier_id: '',
  invoice_number: '',
  invoice_date: today,
  due_date: today,
  amount_ht: 0,
  amount_tva: 0,
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
      reception_id: reception.id,
      purchase_order_id: reception.purchase_order_id ?? '',
      cash_purchase_id: reception.cash_purchase_id ?? '',
      items: reception.reception_items?.map((item) => ({
        article_id: item.article_id,
        quantity: Number(item.quantity_accepted ?? 0),
        unit_id: item.unit_id,
        unit_price: Number(item.unit_price_real ?? 0),
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
        supplier_id: invoice.supplier_id,
        invoice_number: invoice.invoice_number,
        invoice_date: invoice.invoice_date,
        due_date: invoice.due_date,
        amount_ht: Number(invoice.amount_ht ?? 0),
        amount_tva: Number(invoice.amount_tva ?? 0),
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

  const addItem = () => {
    const article = articles[0]
    setValues((current) => ({ ...current, items: [...current.items, { article_id: article?.id ?? '', quantity: 1, unit_id: article?.unit_id ?? '', unit_price: 0, comment: '' }] }))
  }

  const updateItem = (index: number, patch: Partial<InvoiceFormValues['items'][number]>) => {
    setValues((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) }))
  }

  const changeArticle = (index: number, articleId: string) => {
    const article = articles.find((item) => item.id === articleId)
    updateItem(index, { article_id: articleId, unit_id: article?.unit_id ?? '' })
  }

  const removeItem = (index: number) => setValues((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      const payload = { ...values, amount_ht: values.amount_ht || itemsTotal }
      if (id) {
        await updateInvoice(id, payload, profile?.id, file)
        toast.success('Facture mise a jour avec succes')
        navigate(`/invoices/${id}`)
      } else {
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
          <label className="block"><span className="field-label">Depuis une reception</span><select value={values.reception_id} onChange={(event) => { const reception = receptions.find((item) => item.id === event.target.value); if (reception) selectReception(reception); else setValues(emptyForm) }} className="input mt-2"><option value="">Saisie manuelle</option>{receptions.map((reception) => <option key={reception.id} value={reception.id}>{reception.reference} - {reception.suppliers?.name}</option>)}</select></label>
        </section>
      )}

      <section className="surface grid gap-4 p-5 md:grid-cols-2">
        <label className="block"><span className="field-label">Fournisseur</span><select value={values.supplier_id} onChange={(event) => setValues((current) => ({ ...current, supplier_id: event.target.value }))} className="input mt-2"><option value="">Selectionner</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
        <label className="block"><span className="field-label">Numero facture</span><input value={values.invoice_number} onChange={(event) => setValues((current) => ({ ...current, invoice_number: event.target.value }))} className="input mt-2" /></label>
        <label className="block"><span className="field-label">Date facture</span><input type="date" value={values.invoice_date} onChange={(event) => setValues((current) => ({ ...current, invoice_date: event.target.value }))} className="input mt-2" /></label>
        <label className="block"><span className="field-label">Date echeance</span><input type="date" value={values.due_date} onChange={(event) => setValues((current) => ({ ...current, due_date: event.target.value }))} className="input mt-2" /></label>
        <label className="block"><span className="field-label">Montant HT</span><input type="number" value={values.amount_ht} onChange={(event) => setValues((current) => ({ ...current, amount_ht: Number(event.target.value) }))} className="input mt-2" /></label>
        <label className="block"><span className="field-label">TVA</span><input type="number" value={values.amount_tva} onChange={(event) => setValues((current) => ({ ...current, amount_tva: Number(event.target.value) }))} className="input mt-2" /></label>
        <label className="block"><span className="field-label">Mode paiement prevu</span><select value={values.payment_mode ?? ''} onChange={(event) => setValues((current) => ({ ...current, payment_mode: event.target.value as InvoiceFormValues['payment_mode'] || undefined }))} className="input mt-2"><option value="">Non defini</option>{paymentModes.map((mode) => <option key={mode} value={mode}>{paymentModeLabels[mode]}</option>)}</select></label>
        <label className="block"><span className="field-label">Piece jointe</span><label className="btn-secondary mt-2 cursor-pointer"><Upload className="mr-2 h-4 w-4" /> {file?.name ?? 'Choisir fichier'}<input type="file" accept="image/*,.pdf" onChange={(event) => setFile(event.target.files?.[0])} className="hidden" /></label></label>
        <label className="block md:col-span-2"><span className="field-label">Commentaire</span><textarea value={values.comment} onChange={(event) => setValues((current) => ({ ...current, comment: event.target.value }))} className="input mt-2 min-h-24" /></label>
      </section>

      <section className="surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><h2 className="text-lg font-bold">Articles factures</h2><button type="button" onClick={addItem} className="btn-secondary"><Plus className="mr-2 h-4 w-4" /> Ajouter</button></div>
        <div className="divide-y divide-slate-200">
          {values.items.map((item, index) => {
            const selectedArticle = articles.find((article) => article.id === item.article_id)
            return (
              <div key={`${item.article_id}-${index}`} className="grid gap-3 px-5 py-4 xl:grid-cols-[1fr_110px_120px_140px_140px_44px] xl:items-end">
                <label className="block"><span className="field-label">Article</span><select value={item.article_id} onChange={(event) => changeArticle(index, event.target.value)} className="input mt-2"><option value="">Article</option>{articles.map((article) => <option key={article.id} value={article.id}>{article.name}</option>)}</select></label>
                <label className="block"><span className="field-label">Quantite</span><input type="number" value={item.quantity} onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })} className="input mt-2" /></label>
                <label className="block"><span className="field-label">Unite</span><select value={item.unit_id} onChange={(event) => updateItem(index, { unit_id: event.target.value })} className="input mt-2"><option value={selectedArticle?.unit_id ?? item.unit_id}>{selectedArticle?.units?.abbreviation ?? 'Unite'}</option></select></label>
                <label className="block"><span className="field-label">Prix unitaire</span><input type="number" value={item.unit_price} onChange={(event) => updateItem(index, { unit_price: Number(event.target.value) })} className="input mt-2" /></label>
                <div><span className="field-label">Total</span><p className="mt-2 font-bold">{(Number(item.quantity) * Number(item.unit_price)).toLocaleString('fr-FR')} Ar</p></div>
                <button type="button" onClick={() => removeItem(index)} className="btn-secondary text-red-700"><Trash2 className="h-4 w-4" /></button>
              </div>
            )
          })}
          {values.items.length === 0 && <p className="p-5 text-sm text-slate-600">Aucun article.</p>}
        </div>
      </section>

      <section className="surface flex items-center justify-between p-5">
        <span className="text-sm text-slate-600">Montant TTC</span>
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
