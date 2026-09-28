import { Save } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate } from 'react-router-dom'
import { listArticles, listLocations } from '../../api/modules/catalog.api'
import { getMyPinStatus } from '../../api/modules/sensitiveActions.api'
import { createManualMovement } from '../../api/modules/stock.api'
import { SensitiveActionModal } from '../../components/SensitiveActionModal'
import { ArticleSearchSelect } from '../../components/articles/ArticleSearchSelect'
import { QuickArticleDrawer } from '../../components/articles/QuickArticleDrawer'
import { useAuth } from '../../hooks/useAuth'
import type { Article, Location } from '../../lib/catalog'
import { getArticleAllowedLocationIds } from '../../lib/articleLocations'
import { movementTypeLabels } from '../../lib/stock'
import type { ManualMovementFormValues } from '../../lib/stock'

const today = new Date().toISOString().slice(0, 10)

export function ManualMovementPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [articles, setArticles] = useState<Article[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [pinDefined, setPinDefined] = useState(false)
  const [pinOpen, setPinOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [quickArticleOpen, setQuickArticleOpen] = useState(false)
  const [values, setValues] = useState<ManualMovementFormValues>({ movement_type: 'sortie', movement_date: today, article_id: '', quantity: 1, unit_id: '', location_id: '', unit_cost: 0, price_source: 'manual', reason: '', retroactive_reason: '', comment: '' })

  useEffect(() => {
    Promise.all([listArticles({ page: 1, pageSize: 1000, status: 'active' }), listLocations()])
      .then(([articlesResult, loadedLocations]) => {
        setArticles(articlesResult.articles)
        setLocations(loadedLocations)
      })
      .catch((error) => {
        console.error('Erreur de chargement du formulaire de mouvement manuel', error)
        toast.error('Impossible de charger le formulaire.', { id: 'manual-movement-load-error' })
      })
  }, [])

  useEffect(() => {
    if (profile?.role === 'direction') {
      getMyPinStatus().then((status) => setPinDefined(status.pin_defined)).catch(() => setPinDefined(false))
    }
  }, [profile?.role])

  const selectArticle = (articleId: string) => {
    const article = articles.find((item) => item.id === articleId)
    setValues((current) => ({ ...current, article_id: articleId, unit_id: article?.unit_id ?? '' }))
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (profile?.role === 'direction') {
      setPinOpen(true)
      return
    }
    await save()
  }

  const save = async (pin?: string) => {
    setSubmitting(true)
    try {
      if (!profile?.id) return
      const result = await createManualMovement(values, profile.id, profile.role, pin)
      toast.success(result.pendingValidation ? 'Brouillon soumis à validation Direction.' : 'Mouvement manuel validé et créé.')
      navigate('/stock/movements')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Une erreur est survenue')
    } finally {
      setSubmitting(false)
    }
  }

  const needsPrice = ['entree', 'correction', 'ajustement'].includes(values.movement_type)
  const selectableArticles = useMemo(() => articles.filter((article) => !values.location_id || getArticleAllowedLocationIds(
    article.locations_restricted,
    article.article_locations?.map((link) => link.locations.id) ?? [],
    locations.map((location) => location.id),
  ).includes(values.location_id)), [articles, locations, values.location_id])

  const changeLocation = (locationId: string) => {
    setValues((current) => {
      const article = articles.find((item) => item.id === current.article_id)
      const allowed = !article || !locationId || getArticleAllowedLocationIds(
        article.locations_restricted,
        article.article_locations?.map((link) => link.locations.id) ?? [],
        locations.map((location) => location.id),
      ).includes(locationId)
      return { ...current, location_id: locationId, ...(allowed ? {} : { article_id: '', unit_id: '' }) }
    })
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">Stock</p><h1 className="page-title mt-2">Mouvement manuel</h1></div>
        <div className="flex gap-2"><Link to="/stock/movements" className="btn-secondary">Annuler</Link><button type="submit" disabled={submitting} className="btn-primary"><Save className="mr-2 h-4 w-4" /> {profile?.role === 'direction' ? 'Valider le mouvement' : 'Soumettre'}</button></div>
      </header>
      <section className="surface grid gap-4 p-5 md:grid-cols-2">
        <label className="block"><span className="field-label">Type</span><select value={values.movement_type} onChange={(event) => setValues((current) => ({ ...current, movement_type: event.target.value as ManualMovementFormValues['movement_type'] }))} className="input mt-2">{(['entree', 'sortie', 'correction', 'ajustement'] as const).map((type) => <option key={type} value={type}>{movementTypeLabels[type]}</option>)}</select></label>
        <label className="block"><span className="field-label">Date</span><input type="date" value={values.movement_date} onChange={(event) => setValues((current) => ({ ...current, movement_date: event.target.value }))} className="input mt-2" /></label>
        <label className="block"><span className="field-label">Article</span><div className="mt-2"><ArticleSearchSelect articles={selectableArticles} value={values.article_id} onChange={selectArticle} onCreate={() => setQuickArticleOpen(true)} /></div></label>
        <label className="block"><span className="field-label">Unite de stock liee a l article</span><input readOnly value={articles.find((article) => article.id === values.article_id)?.units?.abbreviation ?? ''} className="input mt-2 bg-slate-100" placeholder="Selectionnez d abord l article" /></label>
        <label className="block"><span className="field-label">Quantite</span><input type="number" min="0.01" step="0.01" value={values.quantity} onChange={(event) => setValues((current) => ({ ...current, quantity: Number(event.target.value) }))} className="input mt-2" /></label>
        <label className="block"><span className="field-label">Localisation</span><select value={values.location_id} onChange={(event) => changeLocation(event.target.value)} className="input mt-2"><option value="">Sélectionner</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
        {needsPrice && <label className="block"><span className="field-label">Prix unitaire</span><input type="number" value={values.unit_cost} onChange={(event) => setValues((current) => ({ ...current, unit_cost: Number(event.target.value) }))} className="input mt-2" /></label>}
        {needsPrice && <label className="block"><span className="field-label">Source prix</span><select value={values.price_source} onChange={(event) => setValues((current) => ({ ...current, price_source: event.target.value as 'manual' | 'correction' }))} className="input mt-2"><option value="manual">Facture / manuel</option><option value="correction">Correction</option></select></label>}
        <label className="block md:col-span-2"><span className="field-label">Motif</span><input value={values.reason} onChange={(event) => setValues((current) => ({ ...current, reason: event.target.value }))} className="input mt-2" /></label>
        <label className="block md:col-span-2"><span className="field-label">Motif rétroactif si date antérieure</span><input value={values.retroactive_reason} onChange={(event) => setValues((current) => ({ ...current, retroactive_reason: event.target.value }))} className="input mt-2" /></label>
      </section>
      <SensitiveActionModal
        open={pinOpen}
        title="Valider un mouvement manuel"
        description="Cette validation modifie le stock réel."
        permissionLabel="stock.manual.validate"
        pinDefined={pinDefined}
        busy={submitting}
        onCancel={() => setPinOpen(false)}
        onConfirm={async ({ pin }) => {
          await save(pin)
          setPinOpen(false)
        }}
      />
      <QuickArticleDrawer open={quickArticleOpen} profileId={profile?.id} defaultLocationId={values.location_id} onClose={() => setQuickArticleOpen(false)} onCreated={(article) => { setArticles((current) => [article, ...current.filter((item) => item.id !== article.id)]); setValues((current) => ({ ...current, article_id: article.id, unit_id: article.unit_id })) }} />
    </form>
  )
}
