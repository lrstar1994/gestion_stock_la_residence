import { Plus, Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate } from 'react-router-dom'
import { listArticles, listLocations } from '../../api/modules/catalog.api'
import { listEvents } from '../../api/modules/events.api'
import { listRecipes } from '../../api/modules/recipes.api'
import { createSale, getSalePriceSuggestions } from '../../api/modules/sales.api'
import { getUnconfirmedInitialInventoryCount } from '../../api/modules/inventories.api'
import { useAuth } from '../../hooks/useAuth'
import type { Article, Location } from '../../lib/catalog'
import type { Event } from '../../lib/events'
import type { Recipe } from '../../lib/recipes'
import {
  calculateSaleTotals,
  productTypeLabels,
  productTypes,
  salesChannelLabels,
  salesChannels,
  salesPointLabels,
  salesPoints,
  serviceModeLabels,
  serviceModes,
} from '../../lib/sales'
import type { ProductType, SaleFormValues } from '../../lib/sales'

const nowValue = new Date().toISOString().slice(0, 16)

const emptyForm: SaleFormValues = {
  sale_date: nowValue,
  channel: 'client_direct',
  service_mode: 'sur_place',
  sales_point: 'le_privilege',
  location_id: '',
  client_name: '',
  comment: '',
  event_id: '',
  items: [],
}

export function SaleFormPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [values, setValues] = useState<SaleFormValues>(emptyForm)
  const [articles, setArticles] = useState<Article[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [rawPrices, setRawPrices] = useState<Map<string, { lastPrice: number; averagePrice: number; suggestedPrice: number }>>(new Map())
  const [unconfirmedInitial, setUnconfirmedInitial] = useState(0)
  const totals = useMemo(() => calculateSaleTotals(values.items), [values.items])

  useEffect(() => {
    Promise.all([
      listArticles({ page: 1, pageSize: 1000, status: 'active' }),
      listLocations(),
      listEvents({ page: 1, pageSize: 100, status: 'planifie' }),
      listRecipes({ page: 1, pageSize: 1000, status: 'validee' }),
      getSalePriceSuggestions(),
    ])
      .then(([articleResult, loadedLocations, eventResult, recipeResult, suggestions]) => {
        setArticles(articleResult.articles)
        setLocations(loadedLocations)
        setEvents(eventResult.events)
        setRecipes(recipeResult.recipes)
        setRawPrices(suggestions.rawPrices)
        setValues((current) => ({ ...current, location_id: loadedLocations[0]?.id ?? '' }))
        if (loadedLocations[0]?.id) getUnconfirmedInitialInventoryCount(loadedLocations[0].id).then(setUnconfirmedInitial).catch(() => undefined)
      })
      .catch(() => toast.error('Impossible de charger le formulaire.'))
  }, [])

  const addItem = () => {
    const article = articles[0]
    setValues((current) => ({
      ...current,
      items: [...current.items, {
        article_id: article?.id ?? '',
        product_type: 'produit_brut',
        quantity: 1,
        quantity_offered: 0,
        unit_price: 0,
        discount: 0,
        offer_reason: '',
        comment: '',
        recipe_id: '',
      }],
    }))
  }

  const updateItem = (index: number, patch: Partial<SaleFormValues['items'][number]>) => {
    setValues((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
    }))
  }

  const removeItem = (index: number) => {
    setValues((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))
  }

  const changeProductType = (index: number, productType: ProductType) => {
    updateItem(index, { product_type: productType, recipe_id: productType === 'produit_fini' ? values.items[index].recipe_id : '' })
  }

  const changeArticle = (index: number, articleId: string) => {
    const suggestion = rawPrices.get(articleId)
    updateItem(index, { article_id: articleId, unit_price: suggestion?.suggestedPrice ?? values.items[index].unit_price })
  }

  const changeRecipe = (index: number, recipeId: string) => {
    const recipe = recipes.find((item) => item.id === recipeId)
    updateItem(index, { recipe_id: recipeId, unit_price: Number(recipe?.final_price ?? values.items[index].unit_price) })
  }

  const changeLocation = async (locationId: string) => {
    setValues((current) => ({ ...current, location_id: locationId }))
    setUnconfirmedInitial(await getUnconfirmedInitialInventoryCount(locationId))
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!profile?.id) return toast.error('Profil utilisateur introuvable.')
    try {
      const saleId = await createSale(values, profile.id, profile.role)
      toast.success('Vente enregistree avec succes')
      navigate(`/sales/${saleId}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Une erreur est survenue')
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">Ventes</p><h1 className="page-title mt-2">Nouvelle vente</h1></div>
        <div className="flex gap-2"><Link to="/sales" className="btn-secondary">Annuler</Link><button type="submit" className="btn-primary"><Save className="mr-2 h-4 w-4" /> Enregistrer</button></div>
      </header>

      <section className="surface grid gap-4 p-5 md:grid-cols-3">
        <label className="block"><span className="field-label">Date et heure</span><input type="datetime-local" value={values.sale_date} onChange={(event) => setValues((current) => ({ ...current, sale_date: event.target.value }))} className="input mt-2" /></label>
        <label className="block"><span className="field-label">Canal</span><select value={values.channel} onChange={(event) => setValues((current) => ({ ...current, channel: event.target.value as typeof values.channel }))} className="input mt-2">{salesChannels.map((item) => <option key={item} value={item}>{salesChannelLabels[item]}</option>)}</select></label>
        <label className="block"><span className="field-label">Mode de service</span><select value={values.service_mode} onChange={(event) => setValues((current) => ({ ...current, service_mode: event.target.value as typeof values.service_mode }))} className="input mt-2">{serviceModes.map((item) => <option key={item} value={item}>{serviceModeLabels[item]}</option>)}</select></label>
        <label className="block"><span className="field-label">Point de vente</span><select value={values.sales_point} onChange={(event) => setValues((current) => ({ ...current, sales_point: event.target.value as typeof values.sales_point }))} className="input mt-2">{salesPoints.map((item) => <option key={item} value={item}>{salesPointLabels[item]}</option>)}</select></label>
        <label className="block"><span className="field-label">Localisation stock</span><select value={values.location_id} onChange={(event) => changeLocation(event.target.value)} className="input mt-2"><option value="">Selectionner</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
        <label className="block"><span className="field-label">Evenement lie</span><select value={values.event_id} onChange={(event) => setValues((current) => ({ ...current, event_id: event.target.value }))} className="input mt-2"><option value="">Aucun</option>{events.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="block md:col-span-3"><span className="field-label">Client</span><input value={values.client_name} onChange={(event) => setValues((current) => ({ ...current, client_name: event.target.value }))} className="input mt-2" /></label>
        <label className="block md:col-span-3"><span className="field-label">Commentaire</span><textarea value={values.comment} onChange={(event) => setValues((current) => ({ ...current, comment: event.target.value }))} className="input mt-2 min-h-20" /></label>
      </section>

      {unconfirmedInitial > 0 && (
        <section className="surface border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-800">
          Stock initial non confirme. Inventaire initial a realiser dans un delai maximum de 2 jours.
        </section>
      )}

      <section className="surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold">Articles vendus</h2>
          <button type="button" onClick={addItem} className="btn-secondary"><Plus className="mr-2 h-4 w-4" /> Ajouter</button>
        </div>
        <div className="divide-y divide-slate-200">
          {values.items.map((item, index) => {
            const article = articles.find((row) => row.id === item.article_id)
            const lineTotal = Math.max(0, (Number(item.quantity) - Number(item.quantity_offered ?? 0)) * Number(item.unit_price) - Number(item.discount ?? 0))
            return (
              <div key={`${item.article_id}-${index}`} className="space-y-3 px-5 py-4">
                <div className="grid gap-3 xl:grid-cols-[150px_1fr_100px_100px_130px_120px_120px_44px] xl:items-end">
                  <label><span className="field-label">Type</span><select value={item.product_type} onChange={(event) => changeProductType(index, event.target.value as ProductType)} className="input mt-2">{productTypes.map((type) => <option key={type} value={type}>{productTypeLabels[type]}</option>)}</select></label>
                  <label><span className="field-label">Article stock</span><select value={item.article_id} onChange={(event) => changeArticle(index, event.target.value)} className="input mt-2"><option value="">Article</option>{articles.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
                  <label><span className="field-label">Quantite</span><input type="number" value={item.quantity} onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })} className="input mt-2" /></label>
                  <label><span className="field-label">Offert</span><input type="number" value={item.quantity_offered} onChange={(event) => updateItem(index, { quantity_offered: Number(event.target.value) })} className="input mt-2" /></label>
                  <label><span className="field-label">Prix</span><input type="number" value={item.unit_price} onChange={(event) => updateItem(index, { unit_price: Number(event.target.value) })} className="input mt-2" /></label>
                  <label><span className="field-label">Remise</span><input type="number" value={item.discount} onChange={(event) => updateItem(index, { discount: Number(event.target.value) })} className="input mt-2" /></label>
                  <div><span className="field-label">Total</span><p className="mt-2 font-bold">{lineTotal.toLocaleString('fr-FR')} Ar</p><p className="text-xs text-slate-500">{article?.units?.abbreviation}</p></div>
                  <button type="button" onClick={() => removeItem(index)} className="btn-secondary text-red-700"><Trash2 className="h-4 w-4" /></button>
                </div>
                {item.product_type === 'produit_fini' && (
                  <label className="block">
                    <span className="field-label">Fiche technique liee</span>
                    <select value={item.recipe_id ?? ''} onChange={(event) => changeRecipe(index, event.target.value)} className="input mt-2">
                      <option value="">Aucune fiche liee</option>
                      {recipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.code ? `${recipe.code} - ` : ''}{recipe.name} ({Number(recipe.final_price ?? 0).toLocaleString('fr-FR')} Ar)</option>)}
                    </select>
                  </label>
                )}
                {item.product_type === 'produit_brut' && item.article_id && rawPrices.has(item.article_id) && (
                  <p className="rounded-md bg-blue-50 p-3 text-xs font-semibold text-blue-800">
                    Prix stock moyen : {Number(rawPrices.get(item.article_id)?.averagePrice ?? 0).toLocaleString('fr-FR')} Ar - prix propose : {Number(rawPrices.get(item.article_id)?.suggestedPrice ?? 0).toLocaleString('fr-FR')} Ar
                  </p>
                )}
                {Number(item.quantity_offered ?? 0) > 0 && <input value={item.offer_reason ?? ''} onChange={(event) => updateItem(index, { offer_reason: event.target.value })} className="input" placeholder="Motif obligatoire de l'offre" />}
              </div>
            )
          })}
          {values.items.length === 0 && <p className="p-5 text-sm text-slate-600">Aucun article.</p>}
        </div>
      </section>

      <section className="surface grid gap-4 p-5 md:grid-cols-3">
        <Metric label="Avant remise" value={`${totals.beforeDiscount.toLocaleString('fr-FR')} Ar`} />
        <Metric label="Remises" value={`${totals.discount.toLocaleString('fr-FR')} Ar`} />
        <Metric label="Total TTC" value={`${totals.afterDiscount.toLocaleString('fr-FR')} Ar`} />
      </section>
    </form>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-2xl font-black text-[#1E3A8A]">{value}</p></div>
}
