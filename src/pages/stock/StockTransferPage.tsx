import { Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate } from 'react-router-dom'
import { listArticles, listLocations } from '../../api/modules/catalog.api'
import { createTransfer } from '../../api/modules/stock.api'
import { useAuth } from '../../hooks/useAuth'
import type { Article, Location } from '../../lib/catalog'
import type { TransferFormValues } from '../../lib/stock'

const today = new Date().toISOString().slice(0, 10)

export function StockTransferPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [articles, setArticles] = useState<Article[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [values, setValues] = useState<TransferFormValues>({ article_id: '', quantity: 1, unit_id: '', from_location_id: '', to_location_id: '', movement_date: today, reason: '', comment: '' })

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
      const result = await createTransfer(values, profile.id, profile.role)
      toast.success(result.pendingValidation ? 'Mouvement enregistré avec succès' : 'Transfert effectué avec succès')
      if (result.pendingValidation) toast.error('Cette insertion manuelle nécessite une validation Direction')
      navigate('/stock/movements')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Une erreur est survenue')
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">Stock</p><h1 className="page-title mt-2">Transfert interne</h1></div>
        <div className="flex gap-2"><Link to="/stock" className="btn-secondary">Annuler</Link><button type="submit" className="btn-primary"><Save className="mr-2 h-4 w-4" /> Enregistrer</button></div>
      </header>
      <section className="surface grid gap-4 p-5 md:grid-cols-2">
        <label className="block"><span className="field-label">Article</span><select value={values.article_id} onChange={(event) => selectArticle(event.target.value)} className="input mt-2"><option value="">Selectionner</option>{articles.map((article) => <option key={article.id} value={article.id}>{article.name}</option>)}</select></label>
        <label className="block"><span className="field-label">Quantite</span><input type="number" value={values.quantity} onChange={(event) => setValues((current) => ({ ...current, quantity: Number(event.target.value) }))} className="input mt-2" /></label>
        <label className="block"><span className="field-label">Unite</span><select value={values.unit_id} onChange={(event) => setValues((current) => ({ ...current, unit_id: event.target.value }))} className="input mt-2"><option value={values.unit_id}>{articles.find((article) => article.id === values.article_id)?.units?.abbreviation ?? 'Unite'}</option></select></label>
        <label className="block"><span className="field-label">Date</span><input type="date" value={values.movement_date} onChange={(event) => setValues((current) => ({ ...current, movement_date: event.target.value }))} className="input mt-2" /></label>
        <label className="block"><span className="field-label">Origine</span><select value={values.from_location_id} onChange={(event) => setValues((current) => ({ ...current, from_location_id: event.target.value }))} className="input mt-2"><option value="">Selectionner</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
        <label className="block"><span className="field-label">Destination</span><select value={values.to_location_id} onChange={(event) => setValues((current) => ({ ...current, to_location_id: event.target.value }))} className="input mt-2"><option value="">Selectionner</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
        <label className="block md:col-span-2"><span className="field-label">Motif</span><input value={values.reason} onChange={(event) => setValues((current) => ({ ...current, reason: event.target.value }))} className="input mt-2" /></label>
        <label className="block md:col-span-2"><span className="field-label">Commentaire</span><textarea value={values.comment} onChange={(event) => setValues((current) => ({ ...current, comment: event.target.value }))} className="input mt-2 min-h-24" /></label>
      </section>
    </form>
  )
}
