import { Save } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate } from 'react-router-dom'
import { listArticles } from '../../api/modules/catalog.api'
import { createPurchaseNeed } from '../../api/modules/purchaseNeeds.api'
import { listSuppliers } from '../../api/modules/suppliers.api'
import { useAuth } from '../../hooks/useAuth'
import { needOriginLabels, needOrigins, needUrgencies, needUrgencyLabels } from '../../lib/purchaseNeeds'
import type { NeedOrigin, NeedUrgency, PurchaseNeedFormValues } from '../../lib/purchaseNeeds'
import type { Article } from '../../lib/catalog'
import type { Supplier } from '../../lib/suppliers'

export function PurchaseNeedFormPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [articles, setArticles] = useState<Article[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [search, setSearch] = useState('')
  const [values, setValues] = useState<PurchaseNeedFormValues>({
    article_id: '',
    quantity: 1,
    unit_id: '',
    origin: 'demande_manuelle',
    urgency: 'normal',
    estimated_price: 0,
    budget: 0,
    requested_date: '',
    comment: '',
    supplier_id: '',
  })

  const selectedArticle = articles.find((article) => article.id === values.article_id)
  const filteredArticles = useMemo(() => articles.filter((article) => article.name.toLowerCase().includes(search.toLowerCase())), [articles, search])

  useEffect(() => {
    Promise.all([listArticles({ status: 'active', pageSize: 1000 }), listSuppliers()])
      .then(([articleResult, loadedSuppliers]) => {
        setArticles(articleResult.articles)
        setSuppliers(loadedSuppliers)
      })
      .catch(() => toast.error('Impossible de charger les articles.'))
  }, [])

  const update = <K extends keyof PurchaseNeedFormValues>(key: K, value: PurchaseNeedFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }))
  }

  const selectArticle = (articleId: string) => {
    const article = articles.find((item) => item.id === articleId)
    const supplier = suppliers.find((item) => item.name.toLowerCase() === (article?.default_supplier ?? '').toLowerCase())
    setValues((current) => ({
      ...current,
      article_id: articleId,
      unit_id: article?.unit_id ?? '',
      supplier_id: supplier?.id ?? current.supplier_id ?? '',
    }))
  }

  const save = async () => {
    try {
      if (!profile?.id) throw new Error('Profil utilisateur introuvable')
      if (values.quantity <= 0) throw new Error('La quantite doit etre superieure a 0')
      if (Number(values.budget ?? 0) < 0) throw new Error('Le budget ne peut pas etre negatif')
      await createPurchaseNeed(values, profile.id)
      toast.success('Besoin cree avec succes')
      navigate('/purchase-needs')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Une erreur est survenue. Veuillez reessayer.')
    }
  }

  return (
    <div className="space-y-6">
      <header><p className="eyebrow">Achats</p><h1 className="page-title mt-2">Nouveau besoin d'achat</h1></header>

      <section className="surface grid gap-5 p-5 lg:grid-cols-2">
        <label className="block lg:col-span-2">
          <span className="field-label">Recherche article</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} className="input mt-2" placeholder="Rechercher un article" />
        </label>

        <label className="block lg:col-span-2">
          <span className="field-label">Article</span>
          <select value={values.article_id} onChange={(event) => selectArticle(event.target.value)} className="input mt-2">
            <option value="">Selectionner un article</option>
            {filteredArticles.map((article) => <option key={article.id} value={article.id}>{article.name} - {article.families?.name}</option>)}
          </select>
          {selectedArticle?.min_stock ? <p className="mt-2 text-xs font-semibold text-[#1E3A8A]">Seuil minimum defini : {selectedArticle.min_stock}</p> : null}
        </label>

        <Field label="Quantite"><input value={values.quantity} onChange={(event) => update('quantity', Number(event.target.value))} type="number" min="0" step="0.01" className="input mt-2" /></Field>
        <Field label="Unite"><input value={selectedArticle?.units?.abbreviation || ''} readOnly className="input mt-2 bg-slate-100" /></Field>
        <Field label="Origine"><select value={values.origin} onChange={(event) => update('origin', event.target.value as NeedOrigin)} className="input mt-2">{needOrigins.map((origin) => <option key={origin} value={origin}>{needOriginLabels[origin]}</option>)}</select></Field>
        <Field label="Urgence"><select value={values.urgency} onChange={(event) => update('urgency', event.target.value as NeedUrgency)} className="input mt-2">{needUrgencies.map((urgency) => <option key={urgency} value={urgency}>{needUrgencyLabels[urgency]}</option>)}</select></Field>
        <Field label="Date souhaitee"><input value={values.requested_date} onChange={(event) => update('requested_date', event.target.value)} type="date" className="input mt-2" /></Field>
        <Field label="Prix estimatif"><input value={values.estimated_price ?? 0} onChange={(event) => update('estimated_price', Number(event.target.value))} type="number" min="0" step="0.01" className="input mt-2" /></Field>
        <Field label="Budget prevu"><input value={values.budget ?? 0} onChange={(event) => update('budget', Number(event.target.value))} type="number" min="0" step="0.01" className="input mt-2" /></Field>
        <Field label="Fournisseur cible"><select value={values.supplier_id ?? ''} onChange={(event) => update('supplier_id', event.target.value)} className="input mt-2"><option value="">Aucun</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></Field>
        <label className="block lg:col-span-2"><span className="field-label">Commentaire</span><textarea value={values.comment ?? ''} onChange={(event) => update('comment', event.target.value)} className="input mt-2 min-h-24 resize-none" /></label>
      </section>

      <div className="flex gap-3">
        <button type="button" onClick={save} className="btn-primary"><Save className="mr-2 h-4 w-4" /> Enregistrer</button>
        <Link to="/purchase-needs" className="btn-secondary">Annuler</Link>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="field-label">{label}</span>{children}</label>
}
