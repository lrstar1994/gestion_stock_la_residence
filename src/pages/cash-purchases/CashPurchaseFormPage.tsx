import { Plus, Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate } from 'react-router-dom'
import { listArticles } from '../../api/modules/catalog.api'
import { createCashPurchase } from '../../api/modules/cashPurchases.api'
import { listPurchaseNeedsGlobal } from '../../api/modules/purchaseNeeds.api'
import { useAuth } from '../../hooks/useAuth'
import { calculateCashTotals, cashPurchaseSourceLabels, cashPurchaseSources } from '../../lib/cashPurchases'
import type { CashPurchaseFormValues, CashPurchaseItemFormValues, CashPurchaseSource } from '../../lib/cashPurchases'
import type { Article } from '../../lib/catalog'
import type { PurchaseNeedGlobal } from '../../lib/purchaseNeeds'

export function CashPurchaseFormPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [articles, setArticles] = useState<Article[]>([])
  const [needs, setNeeds] = useState<PurchaseNeedGlobal[]>([])
  const [values, setValues] = useState<CashPurchaseFormValues>({
    buyer_id: profile?.id ?? '',
    cash_source: 'caisse_principale',
    reason: '',
    request_date: new Date().toISOString().slice(0, 10),
    purchase_date: '',
    items: [],
  })
  const total = useMemo(() => calculateCashTotals(values.items), [values.items])

  useEffect(() => {
    setValues((current) => ({ ...current, buyer_id: profile?.id ?? current.buyer_id }))
  }, [profile?.id])

  useEffect(() => {
    Promise.all([
      listArticles({ status: 'active', pageSize: 1000 }),
      listPurchaseNeedsGlobal({ status: 'valide', pageSize: 1000 }),
    ])
      .then(([articleResult, needsResult]) => {
        setArticles(articleResult.articles)
        setNeeds(needsResult.needs)
      })
      .catch(() => toast.error('Impossible de charger les donnees.'))
  }, [])

  const addItem = () => setValues((current) => ({ ...current, items: [...current.items, { article_id: '', quantity_planned: 1, unit_id: '', unit_price_estimated: 0 }] }))

  const addNeed = (need: PurchaseNeedGlobal) => {
    if (values.items.some((item) => item.purchase_need_id === need.id)) return
    setValues((current) => ({
      ...current,
      items: [...current.items, {
        purchase_need_id: need.id,
        article_id: need.article_id,
        quantity_planned: Number(need.quantity ?? need.quantity_needed),
        unit_id: need.unit_id,
        unit_price_estimated: Number(need.estimated_price ?? 0),
      }],
    }))
  }

  const updateItem = (index: number, patch: Partial<CashPurchaseItemFormValues>) => {
    setValues((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
    }))
  }

  const selectArticle = (index: number, articleId: string) => {
    const article = articles.find((item) => item.id === articleId)
    updateItem(index, { article_id: articleId, unit_id: article?.unit_id ?? '' })
  }

  const removeItem = (index: number) => setValues((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))

  const save = async () => {
    try {
      if (!profile?.id) throw new Error('Profil introuvable')
      if (total <= 0) throw new Error('Le montant demande doit etre superieur a 0')
      if (values.items.length === 0) throw new Error('Veuillez ajouter au moins un article')
      const id = await createCashPurchase(values, profile.id)
      toast.success("Demande d'achat creee avec succes")
      navigate(`/cash-purchases/${id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Une erreur est survenue. Veuillez reessayer.')
    }
  }

  return (
    <div className="space-y-6">
      <header><p className="eyebrow">Caisse</p><h1 className="page-title mt-2">Nouvelle demande d'achat en especes</h1></header>

      <section className="surface grid gap-5 p-5 lg:grid-cols-2">
        <Field label="Caisse source"><select value={values.cash_source} onChange={(event) => setValues((current) => ({ ...current, cash_source: event.target.value as CashPurchaseSource }))} className="input mt-2">{cashPurchaseSources.map((source) => <option key={source} value={source}>{cashPurchaseSourceLabels[source]}</option>)}</select></Field>
        <Field label="Date demande"><input value={values.request_date} onChange={(event) => setValues((current) => ({ ...current, request_date: event.target.value }))} type="date" className="input mt-2" /></Field>
        <Field label="Date achat prevue"><input value={values.purchase_date} onChange={(event) => setValues((current) => ({ ...current, purchase_date: event.target.value }))} type="date" className="input mt-2" /></Field>
        <div className="surface border border-blue-100 bg-blue-50 p-4"><p className="text-xs font-bold uppercase text-[#1E3A8A]">Montant demande</p><p className="mt-2 text-2xl font-bold text-[#10285f]">{total.toLocaleString('fr-FR')} Ar</p></div>
        <label className="block lg:col-span-2"><span className="field-label">Motif</span><textarea value={values.reason} onChange={(event) => setValues((current) => ({ ...current, reason: event.target.value }))} className="input mt-2 min-h-24 resize-none" /></label>
      </section>

      {needs.length > 0 && (
        <section className="surface p-5">
          <h2 className="text-lg font-bold">Importer depuis les besoins valides</h2>
          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {needs.slice(0, 9).map((need) => (
              <button key={need.id} type="button" onClick={() => addNeed(need)} className="rounded-md border border-slate-200 p-3 text-left transition hover:bg-slate-50">
                <span className="block font-semibold">{need.articles?.name}</span>
                <span className="text-xs text-slate-500">{Number(need.quantity ?? need.quantity_needed).toLocaleString('fr-FR')} {need.units?.abbreviation} - {Number(need.estimated_cost).toLocaleString('fr-FR')} Ar</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="surface p-5">
        <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Articles a acheter</h2><button type="button" onClick={addItem} className="btn-secondary"><Plus className="mr-2 h-4 w-4" /> Ajouter</button></div>
        <div className="mt-4 space-y-3">
          {values.items.map((item, index) => {
            const article = articles.find((candidate) => candidate.id === item.article_id)
            return (
              <div key={index} className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 lg:grid-cols-[1fr_120px_120px_150px_130px_80px]">
                <select value={item.article_id} onChange={(event) => selectArticle(index, event.target.value)} className="input"><option value="">Article</option>{articles.map((article) => <option key={article.id} value={article.id}>{article.name}</option>)}</select>
                <input value={item.quantity_planned} onChange={(event) => updateItem(index, { quantity_planned: Number(event.target.value) })} type="number" min="0" step="0.01" className="input" />
                <input value={article?.units?.abbreviation || ''} readOnly className="input bg-slate-100" />
                <input value={item.unit_price_estimated} onChange={(event) => updateItem(index, { unit_price_estimated: Number(event.target.value) })} type="number" min="0" step="0.01" className="input" />
                <p className="rounded-md bg-white px-3 py-2 text-sm font-bold">{(item.quantity_planned * item.unit_price_estimated).toLocaleString('fr-FR')} Ar</p>
                <button type="button" onClick={() => removeItem(index)} className="btn-secondary text-red-700"><Trash2 className="h-4 w-4" /></button>
              </div>
            )
          })}
        </div>
      </section>

      <div className="flex gap-3"><button type="button" onClick={save} className="btn-primary"><Save className="mr-2 h-4 w-4" /> Enregistrer</button><Link to="/cash-purchases" className="btn-secondary">Annuler</Link></div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="field-label">{label}</span>{children}</label>
}
