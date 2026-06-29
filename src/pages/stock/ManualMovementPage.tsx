import { Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate } from 'react-router-dom'
import { listArticles, listLocations } from '../../api/modules/catalog.api'
import { createManualMovement } from '../../api/modules/stock.api'
import { useAuth } from '../../hooks/useAuth'
import type { Article, Location } from '../../lib/catalog'
import { movementTypeLabels } from '../../lib/stock'
import type { ManualMovementFormValues } from '../../lib/stock'

const today = new Date().toISOString().slice(0, 10)

export function ManualMovementPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [articles, setArticles] = useState<Article[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [values, setValues] = useState<ManualMovementFormValues>({ movement_type: 'sortie', movement_date: today, article_id: '', quantity: 1, unit_id: '', location_id: '', unit_cost: 0, price_source: 'manual', reason: '', retroactive_reason: '', comment: '' })

  useEffect(() => {
    Promise.all([listArticles({ page: 1, pageSize: 1000, status: 'active' }), listLocations()])
      .then(([articlesResult, loadedLocations]) => {
        setArticles(articlesResult.articles)
        setLocations(loadedLocations)
      })
      .catch(() => toast.error('Impossible de charger le formulaire.'))
  }, [])

  const selectArticle = (articleId: string) => {
    const article = articles.find((item) => item.id === articleId)
    setValues((current) => ({ ...current, article_id: articleId, unit_id: article?.unit_id ?? '' }))
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      if (!profile?.id) return
      const result = await createManualMovement(values, profile.id, profile.role)
      toast.success(result.pendingValidation ? 'Mouvement enregistré avec succès' : 'Mouvement manuel créé avec succès')
      if (result.pendingValidation) toast.error('Cette insertion manuelle nécessite une validation Direction')
      navigate('/stock/movements')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Une erreur est survenue')
    }
  }

  const needsPrice = ['entree', 'correction', 'ajustement'].includes(values.movement_type)

  return (
    <form onSubmit={submit} className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">Stock</p><h1 className="page-title mt-2">Mouvement manuel</h1></div>
        <div className="flex gap-2"><Link to="/stock/movements" className="btn-secondary">Annuler</Link><button type="submit" className="btn-primary"><Save className="mr-2 h-4 w-4" /> Enregistrer</button></div>
      </header>
      <section className="surface grid gap-4 p-5 md:grid-cols-2">
        <label className="block"><span className="field-label">Type</span><select value={values.movement_type} onChange={(event) => setValues((current) => ({ ...current, movement_type: event.target.value as ManualMovementFormValues['movement_type'] }))} className="input mt-2">{(['entree', 'sortie', 'correction', 'ajustement'] as const).map((type) => <option key={type} value={type}>{movementTypeLabels[type]}</option>)}</select></label>
        <label className="block"><span className="field-label">Date</span><input type="date" value={values.movement_date} onChange={(event) => setValues((current) => ({ ...current, movement_date: event.target.value }))} className="input mt-2" /></label>
        <label className="block"><span className="field-label">Article</span><select value={values.article_id} onChange={(event) => selectArticle(event.target.value)} className="input mt-2"><option value="">Selectionner</option>{articles.map((article) => <option key={article.id} value={article.id}>{article.name}</option>)}</select></label>
        <label className="block"><span className="field-label">Quantite</span><input type="number" value={values.quantity} onChange={(event) => setValues((current) => ({ ...current, quantity: Number(event.target.value) }))} className="input mt-2" /></label>
        <label className="block"><span className="field-label">Unite</span><select value={values.unit_id} onChange={(event) => setValues((current) => ({ ...current, unit_id: event.target.value }))} className="input mt-2"><option value={values.unit_id}>{articles.find((article) => article.id === values.article_id)?.units?.abbreviation ?? 'Unite'}</option></select></label>
        <label className="block"><span className="field-label">Localisation</span><select value={values.location_id} onChange={(event) => setValues((current) => ({ ...current, location_id: event.target.value }))} className="input mt-2"><option value="">Selectionner</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
        {needsPrice && <label className="block"><span className="field-label">Prix unitaire</span><input type="number" value={values.unit_cost} onChange={(event) => setValues((current) => ({ ...current, unit_cost: Number(event.target.value) }))} className="input mt-2" /></label>}
        {needsPrice && <label className="block"><span className="field-label">Source prix</span><select value={values.price_source} onChange={(event) => setValues((current) => ({ ...current, price_source: event.target.value as 'manual' | 'correction' }))} className="input mt-2"><option value="manual">Facture / manuel</option><option value="correction">Correction</option></select></label>}
        <label className="block md:col-span-2"><span className="field-label">Motif</span><input value={values.reason} onChange={(event) => setValues((current) => ({ ...current, reason: event.target.value }))} className="input mt-2" /></label>
        <label className="block md:col-span-2"><span className="field-label">Motif retroactif si date anterieure</span><input value={values.retroactive_reason} onChange={(event) => setValues((current) => ({ ...current, retroactive_reason: event.target.value }))} className="input mt-2" /></label>
      </section>
    </form>
  )
}
