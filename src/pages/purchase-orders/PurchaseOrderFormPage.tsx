import { Plus, Save, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { listArticles } from '../../api/modules/catalog.api'
import { createPurchaseOrder, getPurchaseGroupNeeds, getPurchaseOrder, listOrderablePurchaseGroups, updatePurchaseOrder } from '../../api/modules/purchaseOrders.api'
import { listSuppliers } from '../../api/modules/suppliers.api'
import { useAuth } from '../../hooks/useAuth'
import type { Article } from '../../lib/catalog'
import { calculateOrderTotal, groupLabel } from '../../lib/purchaseOrders'
import type { PurchaseOrderFormValues } from '../../lib/purchaseOrders'
import type { PurchaseGroup } from '../../lib/purchaseNeeds'
import type { Supplier } from '../../lib/suppliers'

const today = new Date().toISOString().slice(0, 10)

const emptyForm: PurchaseOrderFormValues = {
  supplier_id: '',
  order_date: today,
  delivery_date: today,
  supplier_reference: '',
  payment_terms: '',
  delivery_mode: '',
  comment: '',
  group_id: '',
  need_ids: [],
  items: [],
}

export function PurchaseOrderFormPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isEdit = Boolean(id)
  const [values, setValues] = useState<PurchaseOrderFormValues>(emptyForm)
  const [articles, setArticles] = useState<Article[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [groups, setGroups] = useState<PurchaseGroup[]>([])
  const total = useMemo(() => calculateOrderTotal(values.items), [values.items])

  const load = useCallback(async () => {
    const [articlesResult, loadedSuppliers, loadedGroups] = await Promise.all([
      listArticles({ page: 1, pageSize: 1000, status: 'active' }),
      listSuppliers(),
      listOrderablePurchaseGroups(),
    ])
    setArticles(articlesResult.articles)
    setSuppliers(loadedSuppliers)
    setGroups(loadedGroups)

    if (id) {
      const order = await getPurchaseOrder(id)
      setValues({
        supplier_id: order.supplier_id,
        order_date: order.order_date,
        delivery_date: order.delivery_date,
        supplier_reference: order.supplier_reference ?? '',
        payment_terms: order.payment_terms ?? '',
        delivery_mode: order.delivery_mode ?? '',
        comment: order.comment ?? '',
        group_id: '',
        need_ids: order.purchase_order_needs?.map((link) => link.need_id) ?? [],
        items: order.purchase_order_items?.map((item) => ({
          article_id: item.article_id,
          quantity_ordered: Number(item.quantity_ordered ?? 0),
          unit_id: item.unit_id,
          unit_price: Number(item.unit_price ?? 0),
          comment: item.comment ?? '',
        })) ?? [],
      })
    } else {
      const groupId = searchParams.get('groupId')
      if (groupId && loadedGroups.some((group) => group.id === groupId)) {
        const group = loadedGroups.find((item) => item.id === groupId)
        const needs = await getPurchaseGroupNeeds(groupId)
        setValues((current) => ({
          ...current,
          group_id: groupId,
          supplier_id: group?.supplier_id ?? current.supplier_id,
          need_ids: needs.map((need) => need.id),
          items: needs.map((need) => ({
            article_id: need.article_id,
            quantity_ordered: Number(need.quantity ?? need.quantity_needed ?? 0),
            unit_id: need.unit_id,
            unit_price: Number(need.estimated_price ?? 0),
            comment: need.comment ?? '',
          })),
        }))
      }
    }
  }, [id, searchParams])

  useEffect(() => {
    load().catch(() => toast.error('Impossible de charger le formulaire.'))
  }, [load])

  const selectGroup = async (groupId: string) => {
    const group = groups.find((item) => item.id === groupId)
    if (!group) {
      setValues((current) => ({ ...current, group_id: '', need_ids: [] }))
      return
    }
    const needs = await getPurchaseGroupNeeds(groupId)
    setValues((current) => ({
      ...current,
      group_id: groupId,
      supplier_id: group.supplier_id ?? current.supplier_id,
      need_ids: needs.map((need) => need.id),
      items: needs.map((need) => ({
        article_id: need.article_id,
        quantity_ordered: Number(need.quantity ?? need.quantity_needed ?? 0),
        unit_id: need.unit_id,
        unit_price: Number(need.estimated_price ?? 0),
        comment: need.comment ?? '',
      })),
    }))
  }

  const addItem = () => {
    const article = articles[0]
    setValues((current) => ({
      ...current,
      items: [...current.items, {
        article_id: article?.id ?? '',
        quantity_ordered: 1,
        unit_id: article?.unit_id ?? '',
        unit_price: 0,
        comment: '',
      }],
    }))
  }

  const updateItem = (index: number, patch: Partial<PurchaseOrderFormValues['items'][number]>) => {
    setValues((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
    }))
  }

  const changeArticle = (index: number, articleId: string) => {
    const article = articles.find((item) => item.id === articleId)
    updateItem(index, { article_id: articleId, unit_id: article?.unit_id ?? '' })
  }

  const removeItem = (index: number) => {
    setValues((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      if (!values.supplier_id) throw new Error('Fournisseur obligatoire')
      if (!values.delivery_date) throw new Error('Date de livraison obligatoire')
      if (values.items.length === 0) throw new Error('Veuillez ajouter au moins un article')
      if (isEdit && id) {
        await updatePurchaseOrder(id, values, profile?.id)
        toast.success('Commande mise a jour avec succes')
        navigate(`/purchase-orders/${id}`)
      } else {
        const orderId = await createPurchaseOrder(values, profile?.id)
        toast.success('Commande creee avec succes')
        navigate(`/purchase-orders/${orderId}`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Une erreur est survenue')
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">Commande fournisseur</p><h1 className="page-title mt-2">{isEdit ? 'Modifier la commande' : 'Nouvelle commande'}</h1></div>
        <div className="flex gap-2">
          <Link to="/purchase-orders" className="btn-secondary">Annuler</Link>
          <button type="submit" className="btn-primary"><Save className="mr-2 h-4 w-4" /> Enregistrer</button>
        </div>
      </header>

      {!isEdit && (
        <section className="surface p-5">
          <label className="block">
            <span className="field-label">Creer depuis un groupe d'achat</span>
            <select value={values.group_id} onChange={(event) => selectGroup(event.target.value)} className="input mt-2">
              <option value="">Creation manuelle</option>
              {groups.map((group) => <option key={group.id} value={group.id}>{groupLabel(group)}</option>)}
            </select>
          </label>
        </section>
      )}

      <section className="surface grid gap-4 p-5 md:grid-cols-2">
        <label className="block"><span className="field-label">Fournisseur</span><select value={values.supplier_id} onChange={(event) => setValues((current) => ({ ...current, supplier_id: event.target.value }))} className="input mt-2"><option value="">Selectionner</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
        <label className="block"><span className="field-label">Date commande</span><input type="date" value={values.order_date} onChange={(event) => setValues((current) => ({ ...current, order_date: event.target.value }))} className="input mt-2" /></label>
        <label className="block"><span className="field-label">Date livraison prevue</span><input type="date" value={values.delivery_date} onChange={(event) => setValues((current) => ({ ...current, delivery_date: event.target.value }))} className="input mt-2" /></label>
        <label className="block"><span className="field-label">Reference fournisseur</span><input value={values.supplier_reference} onChange={(event) => setValues((current) => ({ ...current, supplier_reference: event.target.value }))} className="input mt-2" /></label>
        <label className="block"><span className="field-label">Conditions de paiement</span><input value={values.payment_terms} onChange={(event) => setValues((current) => ({ ...current, payment_terms: event.target.value }))} className="input mt-2" /></label>
        <label className="block"><span className="field-label">Mode de livraison</span><input value={values.delivery_mode} onChange={(event) => setValues((current) => ({ ...current, delivery_mode: event.target.value }))} className="input mt-2" /></label>
        <label className="block md:col-span-2"><span className="field-label">Commentaire</span><textarea value={values.comment} onChange={(event) => setValues((current) => ({ ...current, comment: event.target.value }))} className="input mt-2 min-h-24" /></label>
      </section>

      <section className="surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold">Articles</h2>
          <button type="button" onClick={addItem} className="btn-secondary"><Plus className="mr-2 h-4 w-4" /> Ajouter</button>
        </div>
        <div className="divide-y divide-slate-200">
          {values.items.map((item, index) => {
            const selectedArticle = articles.find((article) => article.id === item.article_id)
            return (
              <div key={`${item.article_id}-${index}`} className="grid gap-3 px-5 py-4 xl:grid-cols-[1fr_110px_120px_140px_140px_44px] xl:items-end">
                <label className="block"><span className="field-label">Article</span><select value={item.article_id} onChange={(event) => changeArticle(index, event.target.value)} className="input mt-2"><option value="">Article</option>{articles.map((article) => <option key={article.id} value={article.id}>{article.name}</option>)}</select></label>
                <label className="block"><span className="field-label">Quantite</span><input type="number" value={item.quantity_ordered} onChange={(event) => updateItem(index, { quantity_ordered: Number(event.target.value) })} className="input mt-2" /></label>
                <label className="block"><span className="field-label">Unite</span><select value={item.unit_id} onChange={(event) => updateItem(index, { unit_id: event.target.value })} className="input mt-2"><option value={selectedArticle?.unit_id ?? item.unit_id}>{selectedArticle?.units?.abbreviation ?? 'Unite'}</option></select></label>
                <label className="block"><span className="field-label">Prix unitaire</span><input type="number" value={item.unit_price} onChange={(event) => updateItem(index, { unit_price: Number(event.target.value) })} className="input mt-2" /></label>
                <div><span className="field-label">Total</span><p className="mt-2 font-bold">{(Number(item.quantity_ordered) * Number(item.unit_price)).toLocaleString('fr-FR')} Ar</p></div>
                <button type="button" onClick={() => removeItem(index)} className="btn-secondary text-red-700"><Trash2 className="h-4 w-4" /></button>
              </div>
            )
          })}
          {values.items.length === 0 && <p className="p-5 text-sm text-slate-600">Aucun article dans la commande.</p>}
        </div>
      </section>

      <section className="surface flex items-center justify-between p-5">
        <span className="text-sm text-slate-600">Montant total commande</span>
        <span className="text-2xl font-black text-[#1E3A8A]">{total.toLocaleString('fr-FR')} Ar</span>
      </section>
    </form>
  )
}
