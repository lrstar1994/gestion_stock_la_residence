import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { listArticles, listFamilies, listSubCategories, listUnits } from '../../api/modules/catalog.api'
import { createRecipe, getRecipe, updateRecipe } from '../../api/modules/recipes.api'
import { useAuth } from '../../hooks/useAuth'
import { getErrorMessage } from '../../lib/errors'
import { mainIngredientLabels, recipeMainIngredients, recipeSchema, recipeTagLabels, recipeTags, recipeTypeLabels, recipeTypes } from '../../lib/recipes'
import { calculateRecipeTotalsWithConversions, getIngredientConversionPreview, getUnitConversionFactor } from '../../lib/unitConversions'
import type { Article, Family, SubCategory, Unit } from '../../lib/catalog'
import type { RecipeFormValues, RecipeIngredientFormValues } from '../../lib/recipes'

type IngredientArticleFilter = {
  familyId: string
  subCategoryName: string
}

function getEmptyIngredientArticleFilter(): IngredientArticleFilter {
  return { familyId: 'all', subCategoryName: 'all' }
}

function articleMatchesIngredientFilter(article: Article, filter: IngredientArticleFilter) {
  const familyMatches = filter.familyId === 'all' || article.family_id === filter.familyId
  const subCategoryMatches = filter.subCategoryName === 'all' || article.sub_family === filter.subCategoryName
  return familyMatches && subCategoryMatches
}

export function RecipeFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [articles, setArticles] = useState<Article[]>([])
  const [families, setFamilies] = useState<Family[]>([])
  const [subCategories, setSubCategories] = useState<SubCategory[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [ingredientArticleFilters, setIngredientArticleFilters] = useState<Record<string, IngredientArticleFilter>>({})
  const [loading, setLoading] = useState(isEdit)
  const form = useForm<RecipeFormValues>({
    resolver: zodResolver(recipeSchema),
    defaultValues: { name: '', type: 'PL', sub_type: '', main_ingredient: 'MIX', portions: 1, description: '', tags: [], margin_coefficient: 3, final_price: 0, status: 'brouillon', ingredients: [] },
  })
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'ingredients' })
  const watched = useWatch({ control: form.control })
  const watchedIngredients = useMemo(() => (watched.ingredients ?? []) as RecipeIngredientFormValues[], [watched.ingredients])
  const sortedArticles = useMemo(
    () => [...articles].sort((first, second) => first.name.localeCompare(second.name, 'fr', { sensitivity: 'base' })),
    [articles],
  )
  const conversionErrors = useMemo(() => watchedIngredients.flatMap((ingredient) => {
    if (!ingredient.article_id || !ingredient.unit_id || !ingredient.quantity) return []
    const article = articles.find((item) => item.id === ingredient.article_id)
    try {
      getIngredientConversionPreview(ingredient, article, units)
      return []
    } catch (error) {
      return [error instanceof Error ? error.message : 'Conversion impossible pour un ingredient']
    }
  }), [articles, units, watchedIngredients])
  const totals = useMemo(() => {
    try {
      return calculateRecipeTotalsWithConversions({
        ingredients: watchedIngredients,
        portions: watched.portions ?? 1,
        margin_coefficient: watched.margin_coefficient ?? 3,
        final_price: watched.final_price ?? 0,
      }, articles, units)
    } catch {
      return { totalCost: 0, costPerPortion: 0, suggestedPrice: 0, costRatio: 0, marginRate: 0 }
    }
  }, [articles, units, watched.final_price, watched.margin_coefficient, watched.portions, watchedIngredients])

  useEffect(() => {
    Promise.all([listArticles({ status: 'active', pageSize: 1000 }), listUnits(), listFamilies(), listSubCategories()])
      .then(([articleResult, loadedUnits, loadedFamilies, loadedSubCategories]) => {
        setArticles(articleResult.articles)
        setUnits(loadedUnits)
        setFamilies(loadedFamilies)
        setSubCategories(loadedSubCategories)
      })
      .catch(() => toast.error('Une erreur est survenue. Veuillez reessayer.'))
  }, [])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getRecipe(id)
      .then((recipe) => {
        form.reset({
          name: recipe.name,
          type: recipe.type,
          sub_type: recipe.sub_type ?? '',
          main_ingredient: recipe.main_ingredient,
          portions: recipe.portions,
          description: recipe.description ?? '',
          tags: recipe.tags ?? [],
          margin_coefficient: Number(recipe.margin_coefficient),
          final_price: Number(recipe.final_price),
          status: recipe.status,
          ingredients: recipe.recipe_ingredients?.filter((ingredient) => ingredient.article_id).map((ingredient, index) => ({
            article_id: ingredient.article_id,
            quantity: Number(ingredient.quantity_display ?? ingredient.quantity),
            unit_id: ingredient.unit_display ?? ingredient.unit_id,
            unit_price: Number(ingredient.unit_price),
            conversion_factor: ingredient.conversion_factor ? Number(ingredient.conversion_factor) : null,
            sort_order: index,
          })) ?? [],
        })
      })
      .catch((error) => toast.error(getErrorMessage(error, 'Fiche technique introuvable')))
      .finally(() => setLoading(false))
  }, [form, id])

  const addIngredient = () => append({ article_id: '', quantity: 1, unit_id: '', unit_price: 0, conversion_factor: null, sort_order: fields.length })

  const updateIngredientArticleFilter = (rowId: string, index: number, nextFilter: IngredientArticleFilter) => {
    setIngredientArticleFilters((current) => ({ ...current, [rowId]: nextFilter }))
    const selectedArticleId = watchedIngredients[index]?.article_id
    const selectedArticle = articles.find((article) => article.id === selectedArticleId)
    if (selectedArticle && !articleMatchesIngredientFilter(selectedArticle, nextFilter)) {
      form.setValue(`ingredients.${index}.article_id`, '')
      form.setValue(`ingredients.${index}.unit_id`, '')
    }
  }

  const onSubmit = async (values: RecipeFormValues) => {
    try {
      if (values.ingredients.some((ingredient) => ingredient.unit_price <= 0)) throw new Error('Tous les ingredients doivent avoir un prix unitaire')
      calculateRecipeTotalsWithConversions(values, articles, units)
      if (id) {
        const savedRecipeId = await updateRecipe(id, values, profile?.id)
        toast.success(savedRecipeId === id ? 'Fiche technique mise a jour avec succes' : 'Nouvelle version creee en brouillon')
        navigate(`/recipes/${savedRecipeId}`)
      } else {
        const recipeId = await createRecipe(values, profile?.id)
        toast.success('Fiche technique creee avec succes')
        navigate(`/recipes/${recipeId}`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Une erreur est survenue. Veuillez reessayer.')
    }
  }

  if (loading) return <div className="surface p-6 text-sm text-slate-600">Chargement...</div>

  return (
    <div className="space-y-6">
      <header><p className="eyebrow">Fiche technique</p><h1 className="page-title mt-2">{isEdit ? 'Modifier la fiche' : 'Nouvelle fiche'}</h1></header>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <section className="surface grid gap-5 p-5 lg:grid-cols-2">
          <Field label="Nom"><input {...form.register('name')} className="input mt-2" /></Field>
          <Field label="Type"><select {...form.register('type')} className="input mt-2">{recipeTypes.map((type) => <option key={type} value={type}>{type} - {recipeTypeLabels[type]}</option>)}</select></Field>
          <Field label="Matiere principale"><select {...form.register('main_ingredient')} className="input mt-2">{recipeMainIngredients.map((item) => <option key={item} value={item}>{item} - {mainIngredientLabels[item]}</option>)}</select></Field>
          <Field label="Portions"><input {...form.register('portions', { valueAsNumber: true })} type="number" min="1" className="input mt-2" /></Field>
          <Field label="Coefficient marge"><input {...form.register('margin_coefficient', { valueAsNumber: true })} type="number" step="0.1" min="0" className="input mt-2" /></Field>
          <Field label="Prix de vente final HT"><input {...form.register('final_price', { valueAsNumber: true })} type="number" min="0" className="input mt-2" /></Field>
          <Field label="Tags"><select multiple {...form.register('tags')} className="input mt-2 min-h-28">{recipeTags.map((tag) => <option key={tag} value={tag}>{recipeTagLabels[tag]}</option>)}</select></Field>
          <label className="block lg:col-span-2"><span className="field-label">Description</span><textarea {...form.register('description')} className="input mt-2 min-h-24 resize-none" /></label>
        </section>

        <section className="surface p-5">
          <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-bold">Ingredients</h2><button type="button" onClick={addIngredient} className="btn-secondary"><Plus className="mr-2 h-4 w-4" /> Ajouter</button></div>
          <div className="mt-4 space-y-3">
            {fields.map((field, index) => {
              const ingredient = watchedIngredients[index]
              const selectedArticle = articles.find((item) => item.id === ingredient?.article_id)
              const displayUnit = units.find((unit) => unit.id === ingredient?.unit_id)
              const stockUnit = units.find((unit) => unit.id === selectedArticle?.unit_id)
              const needsManualFactor = Boolean(ingredient?.article_id && ingredient.unit_id && displayUnit && stockUnit && getUnitConversionFactor(displayUnit, stockUnit) === null)
              const articleFilter = ingredientArticleFilters[field.id] ?? getEmptyIngredientArticleFilter()
              const availableSubCategories = subCategories.filter((subCategory) => articleFilter.familyId === 'all' || subCategory.family_id === articleFilter.familyId)
              const filteredArticles = sortedArticles.filter((article) => articleMatchesIngredientFilter(article, articleFilter))

              return (
                <div key={field.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[180px_220px_minmax(260px,1fr)]">
                    <select
                      value={articleFilter.familyId}
                      className="input min-w-0"
                      onChange={(event) => {
                        updateIngredientArticleFilter(field.id, index, {
                          familyId: event.target.value,
                          subCategoryName: 'all',
                        })
                      }}
                    >
                      <option value="all">Toutes categories</option>
                      {families.map((family) => <option key={family.id} value={family.id}>{family.name}</option>)}
                    </select>
                    <select
                      value={articleFilter.subCategoryName}
                      className="input min-w-0"
                      onChange={(event) => {
                        updateIngredientArticleFilter(field.id, index, {
                          ...articleFilter,
                          subCategoryName: event.target.value,
                        })
                      }}
                    >
                      <option value="all">Toutes sous-categories</option>
                      {availableSubCategories.map((subCategory) => <option key={subCategory.id} value={subCategory.name}>{subCategory.name}</option>)}
                    </select>
                    <select {...form.register(`ingredients.${index}.article_id`)} className="input min-w-0 md:col-span-2 xl:col-span-1" onChange={(event) => {
                      form.register(`ingredients.${index}.article_id`).onChange(event)
                      const article = articles.find((item) => item.id === event.target.value)
                      if (article?.unit_id) form.setValue(`ingredients.${index}.unit_id`, article.unit_id)
                    }}>
                      <option value="">Article</option>{filteredArticles.map((article) => <option key={article.id} value={article.id}>{article.name}</option>)}
                    </select>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-[120px_170px_150px_160px_minmax(220px,1fr)_90px]">
                    <input {...form.register(`ingredients.${index}.quantity`, { valueAsNumber: true })} type="number" min="0" step="0.01" className="input min-w-0" placeholder="Quantite" />
                    <select {...form.register(`ingredients.${index}.unit_id`)} className="input min-w-0"><option value="">Unite</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name} ({unit.abbreviation})</option>)}</select>
                    <input {...form.register(`ingredients.${index}.unit_price`, { valueAsNumber: true })} type="number" min="0" step="0.01" className="input min-w-0" placeholder="Prix unitaire stock" />
                    {needsManualFactor ? (
                      <label className="block min-w-0">
                        <input
                          {...form.register(`ingredients.${index}.conversion_factor`, {
                            setValueAs: (value) => {
                              if (value === '' || value == null) return null
                              const parsed = Number(value)
                              return Number.isNaN(parsed) ? null : parsed
                            },
                          })}
                          type="number"
                          min="0"
                          step="0.000001"
                          className="input min-w-0"
                          placeholder="Facteur"
                        />
                        <span className="mt-1 block text-[11px] font-semibold text-amber-700">
                          1 {displayUnit?.abbreviation || displayUnit?.name} = facteur x {stockUnit?.abbreviation || stockUnit?.name}
                        </span>
                      </label>
                    ) : (
                      <p className="rounded-md bg-white px-3 py-2 text-xs text-slate-500">Facteur auto</p>
                    )}
                    <ConversionPreview ingredient={ingredient} article={selectedArticle} units={units} />
                    <button type="button" onClick={() => window.confirm('Supprimer cet ingredient ?') && remove(index)} className="btn-secondary text-red-700"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {conversionErrors.length > 0 && (
          <section className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
            {conversionErrors[0]}
          </section>
        )}

        <section className="surface grid gap-4 p-5 md:grid-cols-5">
          <Metric label="Cout matiere total HT" value={`${totals.totalCost.toLocaleString('fr-FR')} Ar`} />
          <Metric label="Cout matiere par portion" value={`${totals.costPerPortion.toLocaleString('fr-FR')} Ar`} />
          <Metric label="Prix de vente conseille HT" value={`${totals.suggestedPrice.toLocaleString('fr-FR')} Ar`} />
          <Metric label="Ratio cout" value={`${totals.costRatio.toFixed(1)} %`} />
          <Metric label="Marge" value={`${totals.marginRate.toFixed(1)} %`} />
          <p className="text-xs text-slate-500 md:col-span-5">Tous les prix indiques sont hors TVA.</p>
        </section>

        <div className="flex gap-3"><button type="submit" className="btn-primary"><Save className="mr-2 h-4 w-4" /> Enregistrer</button><Link to="/recipes" className="btn-secondary">Annuler</Link></div>
      </form>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="field-label">{label}</span>{children}</label>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-sm text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-950">{value}</p></div>
}

function ConversionPreview({ ingredient, article, units }: { ingredient?: RecipeIngredientFormValues; article?: Article; units: Unit[] }) {
  if (!ingredient?.article_id || !ingredient.unit_id || !ingredient.quantity) {
    return <p className="rounded-md bg-white px-3 py-2 text-xs text-slate-500">Conversion: -</p>
  }

  let conversion: ReturnType<typeof getIngredientConversionPreview> = null
  let errorMessage = ''

  try {
    conversion = getIngredientConversionPreview(ingredient, article, units)
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Conversion impossible'
  }

  if (errorMessage) {
    return (
      <p className="rounded-md bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
        {errorMessage}
      </p>
    )
  }

  if (!conversion) return <p className="rounded-md bg-white px-3 py-2 text-xs text-slate-500">Conversion: -</p>

  return (
    <p className="rounded-md bg-blue-50 px-3 py-2 text-xs font-semibold text-[#1E3A8A]">
      {conversion.quantityDisplay.toLocaleString('fr-FR')} {conversion.unitDisplay} ({conversion.quantityStored.toLocaleString('fr-FR')} {conversion.unitStored})
    </p>
  )
}
