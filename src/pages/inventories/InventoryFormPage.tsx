import { Save } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { listLocations } from '../../api/modules/catalog.api'
import { createInventory, getInventory, prepareInventoryItems, updateInventoryDraft } from '../../api/modules/inventories.api'
import { useAuth } from '../../hooks/useAuth'
import type { Article, Location } from '../../lib/catalog'
import { QuickArticleDrawer } from '../../components/articles/QuickArticleDrawer'
import { inventoryTypeLabels, inventoryTypes, summarizeInventory } from '../../lib/inventories'
import type { InventoryFormValues, InventoryItem, InventoryType } from '../../lib/inventories'

const today = new Date().toISOString().slice(0, 10)

export function InventoryFormPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isEdit = Boolean(id)
  const requestedType = searchParams.get('type') === 'initial' ? 'initial' : 'periodique'
  const requestedLocation = searchParams.get('location') ?? ''
  const [locations, setLocations] = useState<Location[]>([])
  const [familyFilter, setFamilyFilter] = useState('all')
  const [articleSearch, setArticleSearch] = useState('')
  const [values, setValues] = useState<Omit<InventoryFormValues, 'items'> & { items: InventoryItem[] }>({ location_id: '', inventory_date: today, type: requestedType, comment: '', items: [] })
  const [loadingArticles, setLoadingArticles] = useState(false)
  const [quickArticleOpen, setQuickArticleOpen] = useState(false)
  const summary = useMemo(() => summarizeInventory(values.items), [values.items])
  const families = useMemo(() => {
    const unique = new Map<string, string>()
    for (const item of values.items) {
      if (item.articles?.families?.id) unique.set(item.articles.families.id, item.articles.families.name)
    }
    return Array.from(unique.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [values.items])
  const visibleItems = useMemo(() => values.items.filter((item) => {
    const familyMatch = familyFilter === 'all' || item.articles?.families?.id === familyFilter
    const normalize = (value?: string) => (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    const searchMatch = !articleSearch.trim() || normalize(item.articles?.name).includes(normalize(articleSearch.trim()))
    return familyMatch && searchMatch
  }), [articleSearch, familyFilter, values.items])

  useEffect(() => {
    let ignore = false
    async function load() {
      try {
        const loadedLocations = await listLocations().catch(() => [])
        if (ignore) return
        setLocations(loadedLocations)
        if (!id) {
          if (requestedLocation) {
            setLoadingArticles(true)
            const preparedItems = await prepareInventoryItems(requestedLocation).catch(() => [])
            if (!ignore) setValues((current) => ({ ...current, location_id: requestedLocation, type: requestedType, items: preparedItems }))
            setLoadingArticles(false)
          }
          return
        }

        const inventory = await getInventory(id)
        if (!['brouillon', 'en_saisie', 'saisi'].includes(inventory.status)) {
          toast.error('Cet inventaire ne peut plus etre modifie.')
          navigate(`/inventories/${id}`)
          return
        }

        const preparedItems = await prepareInventoryItems(inventory.location_id).catch(() => [])
        const savedByArticle = new Map((inventory.inventory_items ?? []).map((item) => [item.article_id, item]))
        const mergedItems = preparedItems.map((item) => {
          const saved = savedByArticle.get(item.article_id)
          return saved ? {
            ...item,
            id: saved.id,
            theoretical_quantity: Number(saved.theoretical_quantity ?? item.theoretical_quantity),
            counted_quantity: saved.counted_quantity === null ? null : Number(saved.counted_quantity),
            unit_id: saved.unit_id,
            unit_price: saved.unit_price == null ? item.unit_price : Number(saved.unit_price),
            reason: saved.reason ?? '',
          } : item
        })
        const preparedIds = new Set(preparedItems.map((item) => item.article_id))
        const savedOnlyItems = (inventory.inventory_items ?? []).filter((item) => !preparedIds.has(item.article_id))

        if (!ignore) {
          setValues({
            location_id: inventory.location_id,
            inventory_date: inventory.inventory_date,
            type: inventory.type,
            comment: inventory.comment ?? '',
            items: [
              ...mergedItems,
              ...savedOnlyItems.map((item) => ({
                id: item.id,
                article_id: item.article_id,
                theoretical_quantity: Number(item.theoretical_quantity ?? 0),
                counted_quantity: item.counted_quantity === null ? null : Number(item.counted_quantity),
                unit_id: item.unit_id,
                unit_price: item.unit_price == null ? 0 : Number(item.unit_price),
                reason: item.reason ?? '',
                stock_movement_id: item.stock_movement_id ?? null,
                articles: item.articles,
                units: item.units,
              })),
            ],
          })
        }
      } catch {
        toast.error(id ? 'Impossible de charger le brouillon.' : 'Impossible de charger les localisations.')
      }
    }
    load()
    return () => { ignore = true }
  }, [id, navigate, requestedLocation, requestedType])

  const selectLocation = async (locationId: string) => {
    setValues((current) => ({ ...current, location_id: locationId, items: [] }))
    setFamilyFilter('all')
    setArticleSearch('')
    if (!locationId) return
    try {
      setLoadingArticles(true)
      const items = await prepareInventoryItems(locationId)
      setValues((current) => ({ ...current, location_id: locationId, items }))
    } catch {
      toast.error('Impossible de preparer les articles.')
    } finally {
      setLoadingArticles(false)
    }
  }

  const addCreatedArticle = (article: Article) => {
    const item: InventoryItem = {
      article_id: article.id, theoretical_quantity: 0, counted_quantity: null, unit_id: article.unit_id,
      unit_price: Number(article.indicative_price ?? 0), reason: '', stock_movement_id: null,
      articles: { id: article.id, name: article.name, families: article.families },
      units: article.units,
    }
    setValues((current) => ({ ...current, items: [item, ...current.items.filter((row) => row.article_id !== article.id)] }))
    setArticleSearch(article.name)
  }

  const updateItem = (articleId: string, counted: number | null) => {
    setValues((current) => ({ ...current, items: current.items.map((item) => item.article_id === articleId ? { ...item, counted_quantity: counted } : item) }))
  }

  const updateReason = (articleId: string, reason: string) => {
    setValues((current) => ({ ...current, items: current.items.map((item) => item.article_id === articleId ? { ...item, reason } : item) }))
  }

  const submit = async (event: React.FormEvent, submission: 'draft' | 'submit' = 'draft') => {
    event.preventDefault()
    if (!profile?.id) return
    try {
      const payload: InventoryFormValues = {
        ...values,
        items: values.items.map((item) => ({
          article_id: item.article_id,
          theoretical_quantity: item.theoretical_quantity,
          counted_quantity: item.counted_quantity,
          unit_id: item.unit_id,
          unit_price: item.unit_price,
          reason: item.reason ?? '',
        })),
      }
      const result = isEdit && id
        ? await updateInventoryDraft(id, payload, profile.id, submission)
        : await createInventory(payload, profile.id, submission)
      toast.success(submission === 'draft'
        ? values.type === 'initial'
          ? 'Brouillon enregistré. Vous pouvez le retrouver dans Inventaire initial > Compléter le brouillon.'
          : 'Brouillon enregistré. Vous pouvez le retrouver dans Inventaires > Statut : Brouillon.'
        : 'Inventaire soumis sans modifier le stock.')
      if (submission === 'draft') navigate('/inventories?status=brouillon', { state: { draftSaved: true } })
      else navigate(`/inventories/${result.id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Une erreur est survenue')
    }
  }

  return (
    <form onSubmit={(event) => submit(event, 'draft')} className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">Inventaire</p><h1 className="page-title mt-2">{isEdit ? 'Reprendre le brouillon' : 'Nouvel inventaire'}</h1></div>
        <div className="flex flex-wrap gap-2">
          <Link to="/inventories" className="btn-secondary">Annuler</Link>
          <button type="submit" className="btn-secondary"><Save className="mr-2 h-4 w-4" /> Enregistrer le brouillon</button>
          <button type="button" onClick={(event) => submit(event, 'submit')} className="btn-primary">Soumettre pour validation</button>
        </div>
      </header>

      <section className="surface grid gap-4 p-5 md:grid-cols-3">
        <label><span className="field-label">Zone / localisation</span><select value={values.location_id} onChange={(event) => selectLocation(event.target.value)} disabled={isEdit} className="input mt-2 disabled:bg-slate-100"><option value="">Sélectionner</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
        <label><span className="field-label">Date</span><input type="date" value={values.inventory_date} onChange={(event) => setValues((current) => ({ ...current, inventory_date: event.target.value }))} className="input mt-2" /></label>
        <label><span className="field-label">Type</span><select value={values.type} onChange={(event) => setValues((current) => ({ ...current, type: event.target.value as InventoryType }))} className="input mt-2">{inventoryTypes.map((item) => <option key={item} value={item}>{inventoryTypeLabels[item]}</option>)}</select></label>
        <label className="md:col-span-3"><span className="field-label">Commentaire</span><textarea value={values.comment} onChange={(event) => setValues((current) => ({ ...current, comment: event.target.value }))} className="input mt-2 min-h-20" /></label>
      </section>

      <section className="surface overflow-hidden">
        <div className="grid gap-3 border-b border-slate-200 p-5 md:grid-cols-[220px_1fr_auto] md:items-end">
          <label>
            <span className="field-label">Famille</span>
            <select value={familyFilter} onChange={(event) => setFamilyFilter(event.target.value)} disabled={!values.location_id || loadingArticles} className="input mt-2 disabled:bg-slate-100">
              <option value="all">{families.length > 0 ? 'Toutes les familles' : 'Toutes les familles / aucune famille renseignee'}</option>
              {families.map((family) => <option key={family.id} value={family.id}>{family.name}</option>)}
            </select>
          </label>
          <label>
            <span className="field-label">Recherche article</span>
            <input value={articleSearch} onChange={(event) => setArticleSearch(event.target.value)} disabled={!values.location_id || loadingArticles} className="input mt-2 disabled:bg-slate-100" placeholder="Premieres lettres ou mot-cle : FAR, SUC, SAL..." />
          </label>
          <div className="flex items-center gap-2"><p className="text-sm font-semibold text-slate-600">{visibleItems.length} / {values.items.length} articles</p>{values.location_id && <button type="button" onClick={() => setQuickArticleOpen(true)} className="btn-secondary">+ Nouvel article</button>}</div>
        </div>
        <div className="hidden grid-cols-[1fr_130px_130px_120px_120px_1fr] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 xl:grid">
          <span>Article</span><span>Théorique</span><span>Compté</span><span>Unité</span><span>Écart</span><span>Motif</span>
        </div>
        <div className="divide-y divide-slate-200">
          {visibleItems.map((item) => {
            const difference = item.counted_quantity === null ? null : Number(item.counted_quantity) - Number(item.theoretical_quantity)
            return (
              <div key={item.article_id} className="grid gap-3 px-5 py-4 xl:grid-cols-[1fr_130px_130px_120px_120px_1fr] xl:items-center">
                <div><span className="field-label xl:hidden">Article</span><span className="font-semibold">{item.articles?.name}</span><p className="text-xs text-slate-500">{item.articles?.families?.name ?? 'Sans famille'}</p></div>
                <div><span className="field-label xl:hidden">Quantité théorique</span><span className="mt-1 block">{Number(item.theoretical_quantity).toLocaleString('fr-FR')}</span></div>
                <label className="block"><span className="field-label xl:hidden">Quantité comptée</span><input type="number" min="0" step="0.01" value={item.counted_quantity ?? ''} onChange={(event) => updateItem(item.article_id, event.target.value === '' ? null : Number(event.target.value))} className="input mt-2 xl:mt-0" placeholder="Non compté" /></label>
                <div><span className="field-label xl:hidden">Unité</span><span className="mt-1 block">{item.units?.abbreviation}</span></div>
                <div><span className="field-label xl:hidden">Écart calculé</span><span className={difference === null ? 'font-bold text-slate-500' : difference > 0 ? 'font-bold text-emerald-600' : difference < 0 ? 'font-bold text-red-600' : 'font-bold text-slate-700'}>{difference === null ? 'Non compté' : difference.toLocaleString('fr-FR')}</span></div>
                <label className="block"><span className="field-label xl:hidden">Motif écart</span><input value={item.reason ?? ''} onChange={(event) => updateReason(item.article_id, event.target.value)} className="input mt-2 xl:mt-0" placeholder={difference ? 'Motif obligatoire' : 'Sans écart'} /></label>
              </div>
            )
          })}
          {!values.location_id && <p className="p-5 text-sm font-semibold text-slate-600">Selectionnez une localisation pour charger les articles stockables.</p>}
          {values.location_id && loadingArticles && <p className="p-5 text-sm text-slate-600">Chargement des articles stockables...</p>}
          {values.location_id && !loadingArticles && values.items.length === 0 && <p className="p-5 text-sm font-semibold text-amber-700">Aucun article stockable trouve pour cette localisation.</p>}
          {values.items.length > 0 && visibleItems.length === 0 && <div className="flex items-center justify-between gap-3 p-5"><p className="text-sm text-slate-600">Aucun article ne correspond aux filtres.</p><button type="button" onClick={() => { setFamilyFilter('all'); setArticleSearch('') }} className="btn-secondary">Reinitialiser la recherche</button></div>}
        </div>
      </section>

      <section className="surface grid gap-4 p-5 md:grid-cols-4">
        <Metric label="Écart positif" value={summary.positive.toLocaleString('fr-FR')} />
        <Metric label="Écart négatif" value={summary.negative.toLocaleString('fr-FR')} />
        <Metric label="Écart total" value={summary.total.toLocaleString('fr-FR')} />
        <Metric label="Valeur écart" value={`${summary.value.toLocaleString('fr-FR')} Ar`} />
      </section>
      <QuickArticleDrawer open={quickArticleOpen} profileId={profile?.id} initialName={articleSearch} defaultLocationId={values.location_id} onClose={() => setQuickArticleOpen(false)} onCreated={addCreatedArticle} />
    </form>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-2xl font-black text-[#1E3A8A]">{value}</p></div>
}
