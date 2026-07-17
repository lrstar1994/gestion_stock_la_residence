import { Plus, Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate } from 'react-router-dom'
import { listArticles, listLocations, listUnits } from '../../api/modules/catalog.api'
import { listEvents } from '../../api/modules/events.api'
import { getRecipe, listRecipes } from '../../api/modules/recipes.api'
import { createSale, getSalePriceSuggestions } from '../../api/modules/sales.api'
import { getUnconfirmedInitialInventoryCount } from '../../api/modules/inventories.api'
import { useAuth } from '../../hooks/useAuth'
import type { Article, Location, Unit } from '../../lib/catalog'
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
import { getUnitConversionFactor } from '../../lib/unitConversions'

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
  const [units, setUnits] = useState<Unit[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [recipeDetails, setRecipeDetails] = useState<Map<string, Recipe>>(new Map())
  const [rawPrices, setRawPrices] = useState<Map<string, { lastPrice: number; averagePrice: number; suggestedPrice: number }>>(new Map())
  const [unconfirmedInitial, setUnconfirmedInitial] = useState(0)
  const totals = useMemo(() => calculateSaleTotals(values.items), [values.items])

  useEffect(() => {
    Promise.all([
      listArticles({ page: 1, pageSize: 1000, status: 'active', sellableWithoutTransformation: true }),
      listUnits(),
      listLocations(),
      listEvents({ page: 1, pageSize: 100, status: 'planifie' }),
      listRecipes({ page: 1, pageSize: 1000, status: 'validee' }),
      getSalePriceSuggestions(),
    ])
      .then(([articleResult, loadedUnits, loadedLocations, eventResult, recipeResult, suggestions]) => {
        setArticles(articleResult.articles)
        setUnits(loadedUnits)
        setLocations(loadedLocations)
        setEvents(eventResult.events)
        setRecipes(recipeResult.recipes)
        setRawPrices(suggestions.rawPrices)
      })
      .catch(() => toast.error('Impossible de charger le formulaire.'))
  }, [])

  const getArticleAllowedLocations = (article?: Article) => {
    const allowedIds = new Set((article?.article_locations ?? []).map((item) => item.locations.id))
    return locations.filter((location) => allowedIds.has(location.id))
  }

  const getRecipeAllowedLocations = (recipe?: Recipe) => {
    const ingredients = recipe?.recipe_ingredients ?? []
    if (ingredients.length === 0) return []
    let commonIds: Set<string> | null = null

    for (const ingredient of ingredients) {
      const ingredientIds: Set<string> = new Set((ingredient.articles?.article_locations ?? []).map((item) => item.locations.id))
      if (ingredientIds.size === 0) return []
      if (commonIds) {
        const previousIds: string[] = Array.from(commonIds)
        commonIds = new Set(previousIds.filter((id) => ingredientIds.has(id)))
      } else {
        commonIds = ingredientIds
      }
    }

    return locations.filter((location) => commonIds?.has(location.id))
  }

  const getAllowedLocationsForItem = (item: SaleFormValues['items'][number]) => {
    if (item.product_type === 'produit_fini') {
      return getRecipeAllowedLocations(recipeDetails.get(item.recipe_id ?? ''))
    }
    return getArticleAllowedLocations(articles.find((row) => row.id === item.article_id))
  }

  const ensureAllowedLocation = (currentLocationId: string | undefined, allowedLocations: Location[]) => {
    if (currentLocationId && allowedLocations.some((location) => location.id === currentLocationId)) return currentLocationId
    return allowedLocations[0]?.id ?? ''
  }

  const loadRecipeDetail = async (recipeId: string) => {
    const existing = recipeDetails.get(recipeId)
    if (existing) return existing
    const detail = await getRecipe(recipeId)
    setRecipeDetails((current) => {
      const next = new Map(current)
      next.set(recipeId, detail)
      return next
    })
    return detail
  }

  const addItem = () => {
    const article = articles[0]
    const allowedLocations = getArticleAllowedLocations(article)
    setValues((current) => ({
      ...current,
      items: [...current.items, {
        article_id: article?.id ?? '',
        product_type: 'produit_brut',
        quantity: 1,
        quantity_offered: 0,
        unit_display_id: article?.unit_id ?? '',
        unit_stock_id: article?.unit_id ?? '',
        quantity_stock: 1,
        conversion_factor: 1,
        unit_price: 0,
        discount: 0,
        location_id: allowedLocations[0]?.id ?? '',
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

  const getRawSaleConversionPatch = (item: SaleFormValues['items'][number], patch: Partial<SaleFormValues['items'][number]> = {}) => {
    const next = { ...item, ...patch }
    const article = articles.find((row) => row.id === next.article_id)
    const stockUnit = units.find((unit) => unit.id === article?.unit_id)
    const displayUnit = units.find((unit) => unit.id === (next.unit_display_id || stockUnit?.id))
    const automaticFactor = getUnitConversionFactor(displayUnit, stockUnit)
    const factor = automaticFactor ?? Number(next.conversion_factor ?? 0)
    const billableQuantity = Math.max(0, Number(next.quantity ?? 0) - Number(next.quantity_offered ?? 0))

    return {
      ...patch,
      unit_display_id: displayUnit?.id ?? '',
      unit_stock_id: stockUnit?.id ?? '',
      conversion_factor: factor,
      quantity_stock: billableQuantity * factor,
    }
  }

  const removeItem = (index: number) => {
    setValues((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))
  }

  const changeProductType = async (index: number, productType: ProductType) => {
    const current = values.items[index]
    if (productType === 'produit_fini') {
      const recipeId = current.recipe_id || ''
      const recipe = recipeId ? await loadRecipeDetail(recipeId) : undefined
      const allowedLocations = getRecipeAllowedLocations(recipe)
      updateItem(index, {
        product_type: productType,
        article_id: '',
        recipe_id: recipeId,
        unit_display_id: '',
        unit_stock_id: '',
        quantity_stock: undefined,
        conversion_factor: undefined,
        location_id: ensureAllowedLocation(current.location_id, allowedLocations),
        unit_price: Number(recipe?.final_price ?? current.unit_price),
      })
      return
    }
    const articleId = current.article_id || articles[0]?.id || ''
    const article = articles.find((item) => item.id === articleId)
    const suggestion = rawPrices.get(articleId)
    const allowedLocations = getArticleAllowedLocations(article)
    updateItem(index, {
      product_type: productType,
      article_id: articleId,
      recipe_id: '',
      unit_display_id: article?.unit_id ?? '',
      unit_stock_id: article?.unit_id ?? '',
      quantity_stock: Math.max(0, Number(current.quantity ?? 0) - Number(current.quantity_offered ?? 0)),
      conversion_factor: 1,
      location_id: ensureAllowedLocation(current.location_id, allowedLocations),
      unit_price: suggestion?.suggestedPrice ?? current.unit_price,
    })
  }

  const changeArticle = (index: number, articleId: string) => {
    const current = values.items[index]
    const article = articles.find((item) => item.id === articleId)
    const allowedLocations = getArticleAllowedLocations(article)
    const suggestion = rawPrices.get(articleId)
    updateItem(index, getRawSaleConversionPatch(current, {
      article_id: articleId,
      location_id: ensureAllowedLocation(current.location_id, allowedLocations),
      unit_display_id: article?.unit_id ?? '',
      unit_stock_id: article?.unit_id ?? '',
      conversion_factor: 1,
      unit_price: suggestion?.suggestedPrice ?? current.unit_price,
    }))
  }

  const changeRecipe = async (index: number, recipeId: string) => {
    const current = values.items[index]
    const recipe = recipeId ? await loadRecipeDetail(recipeId) : undefined
    const allowedLocations = getRecipeAllowedLocations(recipe)
    updateItem(index, {
      recipe_id: recipeId,
      article_id: '',
      unit_display_id: '',
      unit_stock_id: '',
      quantity_stock: undefined,
      conversion_factor: undefined,
      location_id: ensureAllowedLocation(current.location_id, allowedLocations),
      unit_price: Number(recipe?.final_price ?? current.unit_price),
    })
  }

  const changeItemLocation = async (index: number, locationId: string) => {
    updateItem(index, { location_id: locationId })
    if (locationId) {
      setUnconfirmedInitial(await getUnconfirmedInitialInventoryCount(locationId))
    }
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
          <div>
            <h2 className="text-lg font-bold">Produits vendus</h2>
            <p className="mt-1 text-sm text-slate-600">Choisissez un article brut stocke ou une fiche technique validee.</p>
          </div>
          <button type="button" onClick={addItem} className="btn-secondary"><Plus className="mr-2 h-4 w-4" /> Ajouter</button>
        </div>
        <div className="divide-y divide-slate-200">
          {values.items.map((item, index) => {
            const article = articles.find((row) => row.id === item.article_id)
            const recipe = recipeDetails.get(item.recipe_id ?? '') ?? recipes.find((row) => row.id === item.recipe_id)
            const allowedLocations = getAllowedLocationsForItem(item)
            const displayUnit = units.find((unit) => unit.id === (item.unit_display_id || article?.unit_id))
            const stockUnit = units.find((unit) => unit.id === (item.unit_stock_id || article?.unit_id))
            const automaticFactor = getUnitConversionFactor(displayUnit, stockUnit)
            const needsManualFactor = item.product_type === 'produit_brut' && Boolean(displayUnit && stockUnit && !automaticFactor && displayUnit.id !== stockUnit.id)
            const lineTotal = Math.max(0, (Number(item.quantity) - Number(item.quantity_offered ?? 0)) * Number(item.unit_price) - Number(item.discount ?? 0))
            return (
              <div key={`${item.article_id || item.recipe_id || 'line'}-${index}`} className="space-y-3 px-5 py-4">
                <div className="grid gap-3 xl:grid-cols-[120px_170px_1fr_95px_110px_90px_110px_100px_110px_44px] xl:items-end">
                  <label><span className="field-label">Type</span><select value={item.product_type} onChange={(event) => void changeProductType(index, event.target.value as ProductType)} className="input mt-2">{productTypes.map((type) => <option key={type} value={type}>{productTypeLabels[type]}</option>)}</select></label>
                  <label>
                    <span className="field-label">Localisation</span>
                    <select value={item.location_id || ''} onChange={(event) => void changeItemLocation(index, event.target.value)} className="input mt-2">
                      <option value="">Selectionner</option>
                      {allowedLocations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                    </select>
                  </label>
                  {item.product_type === 'produit_brut' ? (
                    <label>
                      <span className="field-label">Article a vendre sans transformation</span>
                      <select value={item.article_id ?? ''} onChange={(event) => changeArticle(index, event.target.value)} className="input mt-2">
                        <option value="">Selectionner un article stock</option>
                        {articles.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
                      </select>
                    </label>
                  ) : (
                    <label>
                      <span className="field-label">Produit fini / fiche technique</span>
                      <select value={item.recipe_id ?? ''} onChange={(event) => void changeRecipe(index, event.target.value)} className="input mt-2">
                        <option value="">Selectionner une fiche validee</option>
                        {recipes.map((row) => <option key={row.id} value={row.id}>{row.code ? `${row.code} - ` : ''}{row.name} ({Number(row.final_price ?? 0).toLocaleString('fr-FR')} Ar)</option>)}
                      </select>
                    </label>
                  )}
                  <label><span className="field-label">Quantite</span><input type="number" min="0" step="0.01" value={item.quantity} onChange={(event) => updateItem(index, item.product_type === 'produit_brut' ? getRawSaleConversionPatch(item, { quantity: Number(event.target.value) }) : { quantity: Number(event.target.value) })} className="input mt-2" /></label>
                  {item.product_type === 'produit_brut' ? (
                    <label>
                      <span className="field-label">Unite vente</span>
                      <select value={item.unit_display_id || article?.unit_id || ''} onChange={(event) => updateItem(index, getRawSaleConversionPatch(item, { unit_display_id: event.target.value, conversion_factor: undefined }))} className="input mt-2">
                        <option value="">Unite</option>
                        {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.abbreviation}</option>)}
                      </select>
                    </label>
                  ) : (
                    <div><span className="field-label">Unite</span><p className="mt-2 font-semibold text-slate-600">portion</p></div>
                  )}
                  <label><span className="field-label">Offert</span><input type="number" min="0" step="0.01" value={item.quantity_offered} onChange={(event) => updateItem(index, item.product_type === 'produit_brut' ? getRawSaleConversionPatch(item, { quantity_offered: Number(event.target.value) }) : { quantity_offered: Number(event.target.value) })} className="input mt-2" /></label>
                  <label><span className="field-label">Prix unitaire vente</span><input type="number" value={item.unit_price} onChange={(event) => updateItem(index, { unit_price: Number(event.target.value) })} className="input mt-2" /></label>
                  <label><span className="field-label">Remise</span><input type="number" value={item.discount} onChange={(event) => updateItem(index, { discount: Number(event.target.value) })} className="input mt-2" /></label>
                  <div><span className="field-label">Total ligne vente</span><p className="mt-2 font-bold">{lineTotal.toLocaleString('fr-FR')} Ar</p><p className="text-xs text-slate-500">{item.product_type === 'produit_brut' ? displayUnit?.abbreviation : recipe?.code}</p></div>
                  <button type="button" onClick={() => removeItem(index)} className="btn-secondary text-red-700" title="Supprimer la ligne"><Trash2 className="h-4 w-4" /></button>
                </div>
                {item.product_type === 'produit_brut' && (
                  <div className="grid gap-3 rounded-md bg-slate-50 p-3 text-xs font-semibold text-slate-700 md:grid-cols-[1fr_150px_1fr] md:items-end">
                    <p>
                      Sortie stock : {Number(item.quantity_stock ?? 0).toLocaleString('fr-FR')} {stockUnit?.abbreviation ?? article?.units?.abbreviation ?? ''}
                      {displayUnit && stockUnit && displayUnit.id !== stockUnit.id ? ` pour ${Number(Math.max(0, Number(item.quantity ?? 0) - Number(item.quantity_offered ?? 0))).toLocaleString('fr-FR')} ${displayUnit.abbreviation}` : ''}
                    </p>
                    <label>
                      <span className="field-label">Facteur</span>
                      <input type="number" min="0" step="0.0001" value={item.conversion_factor ?? 1} onChange={(event) => updateItem(index, getRawSaleConversionPatch(item, { conversion_factor: Number(event.target.value) }))} disabled={!needsManualFactor} className="input mt-2 disabled:bg-slate-100" />
                    </label>
                    <p className={needsManualFactor ? 'text-amber-700' : 'text-emerald-700'}>
                      {needsManualFactor
                        ? `Conversion manuelle requise : indiquez combien vaut 1 ${displayUnit?.abbreviation} en ${stockUnit?.abbreviation}.`
                        : `Conversion automatique vers ${stockUnit?.abbreviation ?? 'unite stock'}.`}
                    </p>
                  </div>
                )}
                {item.product_type === 'produit_fini' && (
                  <p className="rounded-md bg-amber-50 p-3 text-xs font-semibold text-amber-800">
                    Produit fini vendu depuis une fiche technique. Les ingredients de la fiche seront sortis automatiquement du stock.
                  </p>
                )}
                {allowedLocations.length === 0 && (
                  <p className="rounded-md bg-red-50 p-3 text-xs font-semibold text-red-800">
                    Aucune localisation autorisee disponible pour ce produit.
                  </p>
                )}
                {item.product_type === 'produit_brut' && item.article_id && rawPrices.has(item.article_id) && (
                  <p className="rounded-md bg-blue-50 p-3 text-xs font-semibold text-blue-800">
                    Cout stock moyen : {Number(rawPrices.get(item.article_id)?.averagePrice ?? 0).toLocaleString('fr-FR')} Ar - prix de vente propose : {Number(rawPrices.get(item.article_id)?.suggestedPrice ?? 0).toLocaleString('fr-FR')} Ar
                  </p>
                )}
                {Number(item.quantity_offered ?? 0) > 0 && (
                  <label className="block">
                    <span className="field-label">Motif obligatoire de l'offre</span>
                    <input value={item.offer_reason ?? ''} onChange={(event) => updateItem(index, { offer_reason: event.target.value })} className="input mt-2" />
                  </label>
                )}
              </div>
            )
          })}
          {values.items.length === 0 && <p className="p-5 text-sm text-slate-600">Aucun article.</p>}
          {articles.length === 0 && <p className="px-5 pb-5 text-sm font-semibold text-amber-700">Aucun article coche "A vendre sans transformation" n'est disponible pour la vente.</p>}
          {recipes.length === 0 && <p className="px-5 pb-5 text-sm font-semibold text-amber-700">Aucune fiche technique validee n'est disponible pour les produits finis.</p>}
        </div>
      </section>

      <section className="surface grid gap-4 p-5 md:grid-cols-3">
        <Metric label="Total avant remise" value={`${totals.beforeDiscount.toLocaleString('fr-FR')} Ar`} />
        <Metric label="Total remises" value={`${totals.discount.toLocaleString('fr-FR')} Ar`} />
        <Metric label="Total vente TTC" value={`${totals.afterDiscount.toLocaleString('fr-FR')} Ar`} />
      </section>
    </form>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-2xl font-black text-[#1E3A8A]">{value}</p></div>
}
