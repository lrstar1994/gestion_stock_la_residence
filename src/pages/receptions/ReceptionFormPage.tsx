import { Plus, Save, Trash2, Upload } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { listArticles, listLocations } from '../../api/modules/catalog.api'
import { createReception, getReception, listDefaultReceptionLocation, listReceivableCashPurchases, listReceivableOrders, updateReception, uploadReceptionAnomalyPhoto } from '../../api/modules/receptions.api'
import { listSuppliers } from '../../api/modules/suppliers.api'
import { useAuth } from '../../hooks/useAuth'
import type { Article, Location } from '../../lib/catalog'
import type { PurchaseOrder } from '../../lib/purchaseOrders'
import { anomalyTypeLabels, anomalyTypes, calculateReceptionTotal, qualityStatusLabels, qualityStatuses } from '../../lib/receptions'
import type { AnomalyType, ReceptionFormValues } from '../../lib/receptions'
import type { Supplier } from '../../lib/suppliers'
import type { CashPurchase } from '../../lib/cashPurchases'

const today = new Date().toISOString().slice(0, 10)

const emptyForm: ReceptionFormValues = {
  supplier_id: '',
  reception_date: today,
  invoice_number: '',
  invoice_date: today,
  location_id: '',
  comment: '',
  purchase_order_id: '',
  cash_purchase_id: '',
  items: [],
}

export function ReceptionFormPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isEdit = Boolean(id)
  const [values, setValues] = useState<ReceptionFormValues>(emptyForm)
  const [articles, setArticles] = useState<Article[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [cashPurchases, setCashPurchases] = useState<CashPurchase[]>([])
  const total = useMemo(() => calculateReceptionTotal(values.items), [values.items])

  const selectOrder = useCallback((order: PurchaseOrder, fallbackLocationId = '') => {
    setValues((current) => ({
      ...current,
      supplier_id: order.supplier_id,
      purchase_order_id: order.id,
      location_id: current.location_id || fallbackLocationId,
      items: order.purchase_order_items?.map((item) => {
        const remaining = Math.max(0, Number(item.quantity_ordered ?? 0) - Number(item.quantity_received ?? 0))
        return {
          article_id: item.article_id,
          quantity_ordered: remaining,
          quantity_delivered: remaining,
          quantity_accepted: remaining,
          unit_id: item.unit_id,
          unit_price_planned: Number(item.unit_price ?? 0),
          unit_price_real: Number(item.unit_price ?? 0),
          quality: 'conforme',
          quality_comment: '',
          has_anomaly: false,
          anomalies: [],
        }
      }) ?? [],
    }))
  }, [])

  const selectCashPurchase = useCallback((cashPurchase: CashPurchase, fallbackLocationId = '') => {
    setValues((current) => ({
      ...current,
      cash_purchase_id: cashPurchase.id,
      purchase_order_id: '',
      location_id: current.location_id || fallbackLocationId,
      invoice_number: cashPurchase.cash_purchase_items?.[0]?.invoice_number ?? current.invoice_number,
      invoice_date: cashPurchase.cash_purchase_items?.[0]?.invoice_date ?? current.invoice_date,
      items: cashPurchase.cash_purchase_items?.map((item) => ({
        article_id: item.article_id,
        quantity_ordered: Number(item.quantity_planned ?? 0),
        quantity_delivered: Number(item.quantity_bought ?? 0),
        quantity_accepted: Number(item.quantity_bought ?? 0),
        unit_id: item.unit_id,
        unit_price_planned: Number(item.unit_price_estimated ?? 0),
        unit_price_real: Number(item.unit_price_real ?? 0),
        quality: 'conforme',
        quality_comment: '',
        has_anomaly: false,
        anomalies: [],
      })) ?? [],
    }))
  }, [])

  const load = useCallback(async () => {
    const [articlesResult, loadedSuppliers, loadedLocations, loadedOrders, loadedCashPurchases, defaultLocation] = await Promise.all([
      listArticles({ page: 1, pageSize: 1000, status: 'active' }),
      listSuppliers(),
      listLocations(),
      listReceivableOrders(),
      listReceivableCashPurchases(),
      listDefaultReceptionLocation(),
    ])
    setArticles(articlesResult.articles)
    setSuppliers(loadedSuppliers)
    setLocations(loadedLocations)
    setOrders(loadedOrders)
    setCashPurchases(loadedCashPurchases as CashPurchase[])

    if (id) {
      const reception = await getReception(id)
      setValues({
        supplier_id: reception.supplier_id,
        reception_date: reception.reception_date,
        invoice_number: reception.invoice_number,
        invoice_date: reception.invoice_date,
        location_id: reception.location_id ?? '',
        comment: reception.comment ?? '',
        purchase_order_id: reception.purchase_order_id ?? '',
        cash_purchase_id: reception.cash_purchase_id ?? '',
        items: reception.reception_items?.map((item) => ({
          article_id: item.article_id,
          quantity_ordered: Number(item.quantity_ordered ?? 0),
          quantity_delivered: Number(item.quantity_delivered ?? 0),
          quantity_accepted: Number(item.quantity_accepted ?? 0),
          unit_id: item.unit_id,
          unit_price_planned: Number(item.unit_price_planned ?? 0),
          unit_price_real: Number(item.unit_price_real ?? 0),
          quality: item.quality,
          quality_comment: item.quality_comment ?? '',
          has_anomaly: item.has_anomaly,
          anomalies: item.reception_anomalies?.map((anomaly) => ({
            anomaly_type: anomaly.anomaly_type,
            description: anomaly.description,
            photo_url: anomaly.photo_url ?? '',
          })) ?? [],
        })) ?? [],
      })
    } else {
      setValues((current) => ({ ...current, location_id: defaultLocation?.id ?? loadedLocations[0]?.id ?? '' }))
      const orderId = searchParams.get('orderId')
      if (orderId) {
        const order = loadedOrders.find((item) => item.id === orderId)
        if (order) selectOrder(order, defaultLocation?.id ?? loadedLocations[0]?.id ?? '')
      }
    }
  }, [id, searchParams, selectOrder])

  useEffect(() => {
    load().catch(() => toast.error('Impossible de charger le formulaire.'))
  }, [load])

  const addItem = () => {
    const article = articles[0]
    setValues((current) => ({
      ...current,
      items: [...current.items, {
        article_id: article?.id ?? '',
        quantity_ordered: 0,
        quantity_delivered: 1,
        quantity_accepted: 1,
        unit_id: article?.unit_id ?? '',
        unit_price_planned: 0,
        unit_price_real: 0,
        quality: 'conforme',
        quality_comment: '',
        has_anomaly: false,
        anomalies: [],
      }],
    }))
  }

  const updateItem = (index: number, patch: Partial<ReceptionFormValues['items'][number]>) => {
    setValues((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) }))
  }

  const changeArticle = (index: number, articleId: string) => {
    const article = articles.find((item) => item.id === articleId)
    updateItem(index, { article_id: articleId, unit_id: article?.unit_id ?? '' })
  }

  const addAnomaly = (index: number) => {
    const item = values.items[index]
    updateItem(index, { has_anomaly: true, anomalies: [...(item.anomalies ?? []), { anomaly_type: 'quantite_manquante', description: '', photo_url: '' }] })
    toast.success('Anomalie enregistrée')
  }

  const updateAnomaly = (itemIndex: number, anomalyIndex: number, patch: Partial<ReceptionFormValues['items'][number]['anomalies'][number]>) => {
    const item = values.items[itemIndex]
    updateItem(itemIndex, { anomalies: (item.anomalies ?? []).map((anomaly, index) => index === anomalyIndex ? { ...anomaly, ...patch } : anomaly) })
  }

  const uploadPhoto = async (itemIndex: number, anomalyIndex: number, file?: File) => {
    if (!file) return
    try {
      const url = await uploadReceptionAnomalyPhoto(file)
      updateAnomaly(itemIndex, anomalyIndex, { photo_url: url })
      toast.success('Photo ajoutee')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload impossible')
    }
  }

  const removeItem = (index: number) => setValues((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      if (id) {
        await updateReception(id, values, profile?.id)
        toast.success('Reception mise a jour avec succes')
        navigate(`/receptions/${id}`)
      } else {
        const receptionId = await createReception(values, profile?.id)
        toast.success('Réception créée avec succès')
        navigate(`/receptions/${receptionId}`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Une erreur est survenue')
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">Reception</p><h1 className="page-title mt-2">{isEdit ? 'Modifier la reception' : 'Nouvelle reception'}</h1></div>
        <div className="flex gap-2"><Link to="/receptions" className="btn-secondary">Annuler</Link><button type="submit" className="btn-primary"><Save className="mr-2 h-4 w-4" /> Enregistrer</button></div>
      </header>

      {!isEdit && (
        <section className="surface grid gap-4 p-5 md:grid-cols-2">
          <label className="block"><span className="field-label">Depuis une commande</span><select value={values.purchase_order_id} onChange={(event) => { const order = orders.find((item) => item.id === event.target.value); if (order) selectOrder(order); else setValues((current) => ({ ...current, purchase_order_id: '', items: [] })) }} className="input mt-2"><option value="">Reception sans commande</option>{orders.map((order) => <option key={order.id} value={order.id}>{order.reference} - {order.suppliers?.name}</option>)}</select></label>
          <label className="block"><span className="field-label">Depuis un achat en especes</span><select value={values.cash_purchase_id} onChange={(event) => { const cashPurchase = cashPurchases.find((item) => item.id === event.target.value); if (cashPurchase) selectCashPurchase(cashPurchase, values.location_id); else setValues((current) => ({ ...current, cash_purchase_id: '', items: [] })) }} className="input mt-2"><option value="">Aucun achat en especes</option>{cashPurchases.map((purchase) => <option key={purchase.id} value={purchase.id}>{purchase.reference} - {purchase.reason}</option>)}</select></label>
        </section>
      )}

      <section className="surface grid gap-4 p-5 md:grid-cols-2">
        <label className="block"><span className="field-label">Fournisseur</span><select value={values.supplier_id} onChange={(event) => setValues((current) => ({ ...current, supplier_id: event.target.value }))} className="input mt-2"><option value="">Selectionner</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
        <label className="block"><span className="field-label">Localisation reception</span><select value={values.location_id} onChange={(event) => setValues((current) => ({ ...current, location_id: event.target.value }))} className="input mt-2">{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
        <label className="block"><span className="field-label">Date reception</span><input type="date" value={values.reception_date} onChange={(event) => setValues((current) => ({ ...current, reception_date: event.target.value }))} className="input mt-2" /></label>
        <label className="block"><span className="field-label">Numero facture/recu</span><input value={values.invoice_number} onChange={(event) => setValues((current) => ({ ...current, invoice_number: event.target.value }))} className="input mt-2" /></label>
        <label className="block"><span className="field-label">Date facture</span><input type="date" value={values.invoice_date} onChange={(event) => setValues((current) => ({ ...current, invoice_date: event.target.value }))} className="input mt-2" /></label>
        <label className="block"><span className="field-label">Commentaire</span><input value={values.comment} onChange={(event) => setValues((current) => ({ ...current, comment: event.target.value }))} className="input mt-2" /></label>
      </section>

      <section className="surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><h2 className="text-lg font-bold">Articles recus</h2><button type="button" onClick={addItem} className="btn-secondary"><Plus className="mr-2 h-4 w-4" /> Ajouter</button></div>
        <div className="divide-y divide-slate-200">
          {values.items.map((item, index) => {
            const selectedArticle = articles.find((article) => article.id === item.article_id)
            const refused = Math.max(0, Number(item.quantity_delivered) - Number(item.quantity_accepted))
            return (
              <div key={`${item.article_id}-${index}`} className="space-y-4 px-5 py-4">
                <div className="grid gap-3 xl:grid-cols-[1fr_90px_90px_90px_90px_110px_130px_44px] xl:items-end">
                  <label className="block"><span className="field-label">Article</span><select value={item.article_id} onChange={(event) => changeArticle(index, event.target.value)} className="input mt-2"><option value="">Article</option>{articles.map((article) => <option key={article.id} value={article.id}>{article.name}</option>)}</select></label>
                  <Info label="Cmd" value={Number(item.quantity_ordered).toLocaleString('fr-FR')} />
                  <label className="block"><span className="field-label">Livre</span><input type="number" value={item.quantity_delivered} onChange={(event) => updateItem(index, { quantity_delivered: Number(event.target.value) })} className="input mt-2" /></label>
                  <label className="block"><span className="field-label">Accepte</span><input type="number" value={item.quantity_accepted} onChange={(event) => updateItem(index, { quantity_accepted: Number(event.target.value) })} className="input mt-2" /></label>
                  <Info label="Refuse" value={refused.toLocaleString('fr-FR')} />
                  <label className="block"><span className="field-label">Unite</span><select value={item.unit_id} onChange={(event) => updateItem(index, { unit_id: event.target.value })} className="input mt-2"><option value={selectedArticle?.unit_id ?? item.unit_id}>{selectedArticle?.units?.abbreviation ?? 'Unite'}</option></select></label>
                  <label className="block"><span className="field-label">Prix reel</span><input type="number" value={item.unit_price_real} onChange={(event) => updateItem(index, { unit_price_real: Number(event.target.value) })} className="input mt-2" /></label>
                  <button type="button" onClick={() => removeItem(index)} className="btn-secondary text-red-700"><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="grid gap-3 md:grid-cols-[180px_1fr_auto]">
                  <select value={item.quality} onChange={(event) => updateItem(index, { quality: event.target.value as typeof item.quality, has_anomaly: event.target.value !== 'conforme' || item.has_anomaly })} className="input">{qualityStatuses.map((quality) => <option key={quality} value={quality}>{qualityStatusLabels[quality]}</option>)}</select>
                  <input value={item.quality_comment} onChange={(event) => updateItem(index, { quality_comment: event.target.value })} className="input" placeholder="Commentaire qualite" />
                  <button type="button" onClick={() => addAnomaly(index)} className="btn-secondary">Ajouter anomalie</button>
                </div>
                {(item.anomalies ?? []).map((anomaly, anomalyIndex) => (
                  <div key={anomalyIndex} className="grid gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 md:grid-cols-[190px_1fr_180px]">
                    <select value={anomaly.anomaly_type} onChange={(event) => updateAnomaly(index, anomalyIndex, { anomaly_type: event.target.value as AnomalyType })} className="input">{anomalyTypes.map((type) => <option key={type} value={type}>{anomalyTypeLabels[type]}</option>)}</select>
                    <input value={anomaly.description} onChange={(event) => updateAnomaly(index, anomalyIndex, { description: event.target.value })} className="input" placeholder="Description anomalie" />
                    <label className="btn-secondary cursor-pointer"><Upload className="mr-2 h-4 w-4" /> Photo<input type="file" accept="image/*" onChange={(event) => uploadPhoto(index, anomalyIndex, event.target.files?.[0])} className="hidden" /></label>
                    {anomaly.photo_url && <a href={anomaly.photo_url} target="_blank" className="text-sm font-semibold text-[#1E3A8A] md:col-span-3">Photo ajoutee</a>}
                  </div>
                ))}
              </div>
            )
          })}
          {values.items.length === 0 && <p className="p-5 text-sm text-slate-600">Aucun article.</p>}
        </div>
      </section>

      <section className="surface flex items-center justify-between p-5"><span className="text-sm text-slate-600">Montant total accepte</span><span className="text-2xl font-black text-[#1E3A8A]">{total.toLocaleString('fr-FR')} Ar</span></section>
    </form>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><span className="field-label">{label}</span><p className="mt-2 font-bold">{value}</p></div>
}
