import { Plus, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { createArticle, listArticles, listFamilies, listLocations, listUnits } from '../../api/modules/catalog.api'
import { attachPendingIngredient, attachPendingIngredientGroup, listPendingIngredients } from '../../api/modules/recipes.api'
import { useAuth } from '../../hooks/useAuth'
import type { Article, Family, Location, Unit } from '../../lib/catalog'
import type { PendingIngredient } from '../../lib/recipes'

type ArticleDraft = {
  name: string
  family_id: string
  unit_id: string
}

export function PendingIngredientsPage() {
  const { profile } = useAuth()
  const [items, setItems] = useState<PendingIngredient[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [families, setFamilies] = useState<Family[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [selection, setSelection] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [creatingFor, setCreatingFor] = useState<PendingIngredient | null>(null)
  const [articleDraft, setArticleDraft] = useState<ArticleDraft>({ name: '', family_id: '', unit_id: '' })

  const filteredItems = useMemo(() => {
    const term = normalize(search)
    if (!term) return items
    return items.filter((item) => normalize(item.imported_name).includes(term) || normalize(item.recipes?.name ?? '').includes(term))
  }, [items, search])

  const groupedCounts = useMemo(() => {
    return items.reduce<Record<string, number>>((acc, item) => {
      acc[item.imported_name] = (acc[item.imported_name] ?? 0) + 1
      return acc
    }, {})
  }, [items])

  const load = async () => {
    const [pending, articleResult, loadedFamilies, loadedUnits, loadedLocations] = await Promise.all([
      listPendingIngredients(),
      listArticles({ status: 'active', pageSize: 1000 }),
      listFamilies(),
      listUnits(),
      listLocations(),
    ])
    setItems(pending)
    setArticles(articleResult.articles)
    setFamilies(loadedFamilies)
    setUnits(loadedUnits)
    setLocations(loadedLocations)
  }

  useEffect(() => {
    load().catch(() => toast.error('Une erreur est survenue. Veuillez reessayer.'))
  }, [])

  const resolveOne = async (id: string) => {
    const articleId = selection[id]
    if (!articleId) {
      toast.error('Choisissez un article')
      return
    }

    await attachPendingIngredient(id, articleId)
    toast.success('Ingredient rapproche')
    await load()
  }

  const resolveGroup = async (item: PendingIngredient) => {
    const articleId = selection[item.id]
    if (!articleId) {
      toast.error('Choisissez un article')
      return
    }

    const count = await attachPendingIngredientGroup(item.imported_name, articleId)
    toast.success(`${count} ingredient(s) rapproches`)
    await load()
  }

  const openCreateArticle = (item: PendingIngredient) => {
    const matchingUnit = units.find((unit) => normalize(unit.abbreviation) === normalize(item.unit_name) || normalize(unit.name) === normalize(item.unit_name))
    setCreatingFor(item)
    setArticleDraft({
      name: item.imported_name,
      family_id: families[0]?.id ?? '',
      unit_id: matchingUnit?.id ?? units[0]?.id ?? '',
    })
  }

  const createAndAttach = async (applyToGroup: boolean) => {
    if (!creatingFor) return

    if (!articleDraft.name || !articleDraft.family_id || !articleDraft.unit_id) {
      toast.error('Nom, famille et unite sont obligatoires')
      return
    }

    const defaultLocation = locations.find((location) => location.is_magasin_general) ?? locations[0]
    if (!defaultLocation) {
      toast.error('Aucune localisation disponible pour creer l article')
      return
    }

    try {
      const articleId = await createArticle(
        {
          name: articleDraft.name,
          family_id: articleDraft.family_id,
          sub_family: '',
          unit_id: articleDraft.unit_id,
          packaging: '',
          default_supplier: '',
          min_stock: 0,
          status: 'active',
          location_ids: [defaultLocation.id],
        },
        profile?.id,
      )

      if (applyToGroup) {
        const count = await attachPendingIngredientGroup(creatingFor.imported_name, articleId)
        toast.success(`Article cree et ${count} ingredient(s) lies`)
      } else {
        await attachPendingIngredient(creatingFor.id, articleId)
        toast.success('Article cree et ingredient lie')
      }

      setCreatingFor(null)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Une erreur est survenue. Veuillez reessayer.')
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Import</p>
          <h1 className="page-title mt-2">Ingredients en attente</h1>
          <p className="mt-2 text-sm text-slate-600">
            Rapprochez les ingredients importes ou creez les articles manquants sans bloquer la fiche.
          </p>
        </div>
        <div className="surface px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">A traiter</p>
          <p className="mt-1 text-2xl font-bold text-[#1E3A8A]">{items.length}</p>
        </div>
      </header>

      <section className="surface p-4">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} className="input pl-9" placeholder="Rechercher un ingredient ou une fiche" />
        </label>
      </section>

      <section className="surface overflow-hidden">
        <div className="divide-y divide-slate-200">
          {filteredItems.map((item) => (
            <article key={item.id} className="grid gap-3 p-4 xl:grid-cols-[1fr_130px_130px_150px_1.1fr_260px] xl:items-center">
              <div>
                <p className="font-semibold text-slate-950">{item.imported_name}</p>
                <p className="mt-1 text-sm text-slate-500">{item.recipes?.name}</p>
                {groupedCounts[item.imported_name] > 1 && (
                  <p className="mt-1 text-xs font-semibold text-[#1E3A8A]">{groupedCounts[item.imported_name]} occurrences identiques</p>
                )}
              </div>
              <p className="text-sm">{Number(item.quantity)} {item.unit_name}</p>
              <p className="text-sm">{Number(item.unit_price).toLocaleString('fr-FR')} Ar</p>
              <span className="w-fit rounded-md bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
                {item.status === 'ambiguous' ? 'A rapprocher' : 'A creer'}
              </span>
              <select value={selection[item.id] ?? ''} onChange={(event) => setSelection((current) => ({ ...current, [item.id]: event.target.value }))} className="input">
                <option value="">Choisir un article</option>
                {articles.map((article) => <option key={article.id} value={article.id}>{article.name}</option>)}
              </select>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-primary" onClick={() => resolveOne(item.id)}>Lier</button>
                {groupedCounts[item.imported_name] > 1 && (
                  <button type="button" className="btn-secondary" onClick={() => resolveGroup(item)}>Lier tous</button>
                )}
                <button type="button" className="btn-secondary" onClick={() => openCreateArticle(item)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Creer
                </button>
              </div>
            </article>
          ))}
          {filteredItems.length === 0 && <p className="p-5 text-sm text-slate-600">Aucun ingredient en attente.</p>}
        </div>
      </section>

      {creatingFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm">
          <form className="w-full max-w-lg overflow-hidden rounded-lg bg-white shadow-2xl" onSubmit={(event) => event.preventDefault()}>
            <div className="border-b border-slate-200 px-6 py-5">
              <p className="eyebrow">Nouvel article</p>
              <h2 className="mt-2 text-xl font-bold text-[#132b67]">Creer depuis l import</h2>
              <p className="mt-2 text-sm text-slate-600">Ingredient : {creatingFor.imported_name}</p>
            </div>

            <div className="space-y-4 px-6 py-5">
              <label className="block">
                <span className="field-label">Nom</span>
                <input value={articleDraft.name} onChange={(event) => setArticleDraft((current) => ({ ...current, name: event.target.value }))} className="input mt-2" />
              </label>
              <label className="block">
                <span className="field-label">Famille</span>
                <select value={articleDraft.family_id} onChange={(event) => setArticleDraft((current) => ({ ...current, family_id: event.target.value }))} className="input mt-2">
                  <option value="">Selectionner</option>
                  {families.map((family) => <option key={family.id} value={family.id}>{family.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="field-label">Unite</span>
                <select value={articleDraft.unit_id} onChange={(event) => setArticleDraft((current) => ({ ...current, unit_id: event.target.value }))} className="input mt-2">
                  <option value="">Selectionner</option>
                  {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name} ({unit.abbreviation})</option>)}
                </select>
              </label>
            </div>

            <div className="flex flex-wrap justify-end gap-3 bg-slate-50 px-6 py-4">
              <button type="button" onClick={() => setCreatingFor(null)} className="btn-secondary">Annuler</button>
              <button type="button" onClick={() => createAndAttach(false)} className="btn-secondary">Creer et lier celui-ci</button>
              {groupedCounts[creatingFor.imported_name] > 1 && (
                <button type="button" onClick={() => createAndAttach(true)} className="btn-primary">Creer et lier tous</button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

function normalize(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}
