import { Save } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate } from 'react-router-dom'
import { listAllArticles, listLocations } from '../../api/modules/catalog.api'
import { createTransfer, listTransferDestinations } from '../../api/modules/stock.api'
import { ArticleSearchSelect } from '../../components/articles/ArticleSearchSelect'
import { QuickArticleDrawer } from '../../components/articles/QuickArticleDrawer'
import { useAuth } from '../../hooks/useAuth'
import type { Article, Location } from '../../lib/catalog'
import { getArticleAllowedLocationIds } from '../../lib/articleLocations'
import type { TransferFormValues } from '../../lib/stock'

const today = new Date().toISOString().slice(0, 10)

export function StockTransferSinglePage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [articles, setArticles] = useState<Article[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [destinationLocations, setDestinationLocations] = useState<Array<Pick<Location, 'id' | 'name'>>>([])
  const [submitting, setSubmitting] = useState(false)
  const [quickArticleOpen, setQuickArticleOpen] = useState(false)
  const [values, setValues] = useState<TransferFormValues>({ article_id: '', quantity: 1, unit_id: '', from_location_id: '', to_location_id: '', movement_date: today, reason: '', comment: '' })
  const selectableArticles = useMemo(() => articles.filter((article) => !values.from_location_id || getArticleAllowedLocationIds(
    article.locations_restricted,
    article.article_locations?.map((link) => link.locations.id) ?? [],
    locations.map((location) => location.id),
  ).includes(values.from_location_id)), [articles, locations, values.from_location_id])

  useEffect(() => {
    Promise.all([listAllArticles({ status: 'active' }), listLocations()])
      .then(([loadedArticles, loadedLocations]) => {
        setArticles(loadedArticles)
        setLocations(loadedLocations)
      })
      .catch(() => toast.error('Impossible de charger le formulaire.'))
  }, [])

  useEffect(() => {
    setDestinationLocations([])
    setValues((current) => current.to_location_id ? { ...current, to_location_id: '' } : current)
    if (!values.article_id || !values.from_location_id) return
    let cancelled = false
    listTransferDestinations(values.article_id, values.from_location_id)
      .then((destinations) => { if (!cancelled) setDestinationLocations(destinations) })
      .catch(() => toast.error('Impossible de charger les destinations autorisées pour cet article.'))
    return () => { cancelled = true }
  }, [values.article_id, values.from_location_id])

  const selectArticle = (articleId: string) => {
    const article = articles.find((item) => item.id === articleId)
    setValues((current) => ({ ...current, article_id: articleId, unit_id: article?.unit_id ?? '', to_location_id: '' }))
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    await save()
  }

  const changeOrigin = (fromLocationId: string) => {
    setValues((current) => {
      const article = articles.find((item) => item.id === current.article_id)
      const allowed = !article || !fromLocationId || getArticleAllowedLocationIds(
        article.locations_restricted,
        article.article_locations?.map((link) => link.locations.id) ?? [],
        locations.map((location) => location.id),
      ).includes(fromLocationId)
      return { ...current, from_location_id: fromLocationId, to_location_id: '', ...(allowed ? {} : { article_id: '', unit_id: '' }) }
    })
  }

  const save = async () => {
    setSubmitting(true)
    try {
      if (!profile?.id) return
      await createTransfer(values, profile.id, profile.role)
      toast.success('Transfert unitaire préparé. Il ne modifiera le stock qu’après remise et réception avec PIN.')
      navigate('/stock/transfer')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Une erreur est survenue')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">Stock</p><h1 className="page-title mt-2">Transfert unitaire</h1></div>
        <div className="flex gap-2"><Link to="/stock/transfer" className="btn-secondary">Transfert groupé</Link><Link to="/stock" className="btn-secondary">Annuler</Link><button type="submit" disabled={submitting} className="btn-primary"><Save className="mr-2 h-4 w-4" /> Préparer le transfert</button></div>
      </header>
      <section className="surface grid gap-4 p-5 md:grid-cols-2">
        <label className="block"><span className="field-label">Article</span><div className="mt-2"><ArticleSearchSelect articles={selectableArticles} value={values.article_id} onChange={selectArticle} onCreate={() => setQuickArticleOpen(true)} allowCreateAfterNoMatch /></div></label>
        <label className="block"><span className="field-label">Unite de stock liee a l article</span><input readOnly value={articles.find((article) => article.id === values.article_id)?.units?.abbreviation ?? ''} className="input mt-2 bg-slate-100" placeholder="Selectionnez d abord l article" /></label>
        <label className="block"><span className="field-label">Quantite</span><input type="number" min="0.01" step="0.01" value={values.quantity} onChange={(event) => setValues((current) => ({ ...current, quantity: Number(event.target.value) }))} className="input mt-2" /></label>
        <label className="block"><span className="field-label">Date</span><input type="date" value={values.movement_date} onChange={(event) => setValues((current) => ({ ...current, movement_date: event.target.value }))} className="input mt-2" /></label>
        <label className="block"><span className="field-label">Origine</span><select value={values.from_location_id} onChange={(event) => changeOrigin(event.target.value)} className="input mt-2"><option value="">Selectionner</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
        <label className="block"><span className="field-label">Destination</span><select value={values.to_location_id} onChange={(event) => setValues((current) => ({ ...current, to_location_id: event.target.value }))} disabled={!values.article_id || !values.from_location_id} className="input mt-2 disabled:bg-slate-100"><option value="">Selectionner</option>{destinationLocations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select><span className="mt-1 block text-xs text-slate-500">Destinations autorisées pour cet article; l’origine doit appartenir à vos localisations affectées.</span></label>
        <label className="block md:col-span-2"><span className="field-label">Motif</span><input value={values.reason} onChange={(event) => setValues((current) => ({ ...current, reason: event.target.value }))} className="input mt-2" /></label>
        <label className="block md:col-span-2"><span className="field-label">Commentaire</span><textarea value={values.comment} onChange={(event) => setValues((current) => ({ ...current, comment: event.target.value }))} className="input mt-2 min-h-24" /></label>
      </section>
      <p className="text-sm text-slate-600">La préparation n’effectue aucun mouvement de stock. La sortie sera enregistrée à la remise physique avec le PIN Magasinier, puis l’entrée à la réception avec le PIN du responsable destination.</p>
      <QuickArticleDrawer open={quickArticleOpen} profileId={profile?.id} defaultLocationId={values.from_location_id} onClose={() => setQuickArticleOpen(false)} onCreated={(article) => { setArticles((current) => [article, ...current.filter((item) => item.id !== article.id)]); setValues((current) => ({ ...current, article_id: article.id, unit_id: article.unit_id })) }} />
    </form>
  )
}
