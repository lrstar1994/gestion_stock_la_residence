import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowDown, ArrowUp, Plus, Save, Trash2, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import type { FieldErrors } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getArticle, listFamilies, listSubCategories, listUnits } from '../../api/modules/catalog.api'
import { createRecipe, getRecipe, listRecipeTrimForms, listRecipes, recordRecipeIngredientProvisionalPrice, searchRecipeIngredientArticles, updateRecipe, uploadRecipeDressingPhoto } from '../../api/modules/recipes.api'
import { getLastNormalActualPurchasePrices } from '../../api/modules/purchasePrices.api'
import { useAuth } from '../../hooks/useAuth'
import { getErrorMessage } from '../../lib/errors'
import { isRecipeDraftMeaningful, shouldReplaceInitialNumericValue } from '../../lib/recipeFormUx'
import { calculateRecipeOperationalEconomics, canEditRecipes, creatableRecipeTypes, ingredientQuantityModes, mainIngredientLabels, recipeMainIngredients, recipeSchema, recipeTagLabels, recipeTags, recipeTypeLabels, recipeTypes, recipeYieldModes } from '../../lib/recipes'
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

function firstFormErrorMessage(value: unknown, path: string[] = []): string | null {
  if (!value || typeof value !== 'object') return null
  if ('message' in value && typeof value.message === 'string' && value.message.trim()) {
    return `${path.join('.') || 'formulaire'} : ${value.message}`
  }
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const message = firstFormErrorMessage(item, [...path, String(index)])
      if (message) return message
    }
    return null
  }
  for (const [key, child] of Object.entries(value)) {
    if (key === 'ref' || key === 'type') continue
    const message = firstFormErrorMessage(child, [...path, key])
    if (message) return message
  }
  return null
}

function optionalNumberValue(value: unknown): number | undefined {
  if (value === '' || value == null) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
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
  const [officialPrices, setOfficialPrices] = useState<Record<string, number | null>>({})
  const [provisionalPrices, setProvisionalPrices] = useState<Record<string, { amount_ttc: number; unit_id: string; source?: string | null }>>({})
  const [provisionalDrafts, setProvisionalDrafts] = useState<Record<string, { amount: string; source: string; observation: string }>>({})
  const [subrecipes, setSubrecipes] = useState<import('../../lib/recipes').Recipe[]>([])
  const [trimForms, setTrimForms] = useState<Record<string, Array<{ id: string; name: string; yield_percent: number }>>>({})
  const [dressingPhoto, setDressingPhoto] = useState<File | null>(null)
  const [ingredientArticleFilters, setIngredientArticleFilters] = useState<Record<string, IngredientArticleFilter>>({})
  const [loading, setLoading] = useState(isEdit)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [autosaveState, setAutosaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [loadedWorkflowStatus, setLoadedWorkflowStatus] = useState<string | null>(null)
  const autosaveLastSnapshot = useRef('')
  const autosaveInFlight = useRef(false)
  const [untouchedDefaultValues, setUntouchedDefaultValues] = useState<Set<string>>(() => new Set(['portions', 'yield_quantity']))
  const form = useForm<RecipeFormValues>({
    resolver: zodResolver(recipeSchema),
    defaultValues: { name: '', type: 'PL', sub_type: '', main_ingredient: 'MIX', portions: 10, description: '', tags: [], margin_coefficient: 3, final_price: 0, status: 'brouillon', ingredients: [], yield_mode: 'portions', yield_quantity: 1, yield_unit_id: '', retained_sale_price_ttc: undefined, retained_sale_price_reason: '', dressing_photo_alt: '', steps: [] },
  })
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'ingredients' })
  const { fields: stepFields, append: appendStep, remove: removeStep, move: moveStep } = useFieldArray({ control: form.control, name: 'steps' })
  const watched = useWatch({ control: form.control })
  const watchedIngredients = useMemo(() => (watched.ingredients ?? []) as RecipeIngredientFormValues[], [watched.ingredients])
  const selectableRecipeTypes = watched.type === 'BF' ? recipeTypes : creatableRecipeTypes
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
  const effectivePrices = useMemo(() => Object.fromEntries(watchedIngredients.map((ingredient) => {
    if (!ingredient.article_id) return ['', null]
    if (Object.prototype.hasOwnProperty.call(officialPrices, ingredient.article_id)) return [ingredient.article_id, officialPrices[ingredient.article_id]]
    return [ingredient.article_id, provisionalPrices[ingredient.article_id]?.amount_ttc ?? null]
  }).filter(([id]) => Boolean(id))), [officialPrices, provisionalPrices, watchedIngredients])
  const totals = useMemo(() => {
    try {
      return calculateRecipeTotalsWithConversions({
        ingredients: watchedIngredients.map((ingredient) => ({ ...ingredient, unit_price: ingredient.article_id && effectivePrices[ingredient.article_id] != null ? Number(effectivePrices[ingredient.article_id]) : 0 })),
        portions: watched.portions ?? 1,
        margin_coefficient: watched.margin_coefficient ?? 3,
        final_price: watched.final_price ?? 0,
      }, articles, units)
    } catch {
      return { totalCost: 0, costPerPortion: 0, suggestedPrice: 0, costRatio: 0, marginRate: 0 }
    }
  }, [articles, effectivePrices, units, watched.final_price, watched.margin_coefficient, watched.portions, watchedIngredients])
  const costsAreCalculable = watchedIngredients.filter((ingredient) => ingredient.article_id && ingredient.line_kind !== 'subrecipe').every((ingredient) => {
    if (Object.prototype.hasOwnProperty.call(officialPrices, ingredient.article_id)) return officialPrices[ingredient.article_id] != null
    return provisionalPrices[ingredient.article_id]?.amount_ttc != null
  }) && conversionErrors.length === 0
  const economics = calculateRecipeOperationalEconomics(
    costsAreCalculable ? totals.totalCost : null,
    watched.yield_mode ?? 'portions',
    Number(watched.portions ?? 0),
    Number(watched.yield_quantity ?? 0),
  )

  useEffect(() => {
    Promise.all([listUnits(), listFamilies(), listSubCategories(), listRecipes({ status: 'all', pageSize: 1000 })])
      .then(([loadedUnits, loadedFamilies, loadedSubCategories, loadedRecipes]) => {
        setUnits(loadedUnits)
        setFamilies(loadedFamilies)
        setSubCategories(loadedSubCategories)
        setSubrecipes(loadedRecipes.recipes.filter((recipe) => recipe.status === 'validee' && recipe.yield_mode === 'rendement_produit'))
      })
      .catch(() => toast.error('Une erreur est survenue. Veuillez reessayer.'))
  }, [])

  useEffect(() => {
    const missingArticleIds = [...new Set(watchedIngredients.map((ingredient) => ingredient.article_id).filter((articleId): articleId is string => Boolean(articleId) && !articles.some((article) => article.id === articleId)))]
    if (missingArticleIds.length === 0) return
    Promise.all(missingArticleIds.map((articleId) => getArticle(articleId)))
      .then((loadedArticles) => setArticles((current) => [...current, ...loadedArticles.filter((article) => !current.some((existing) => existing.id === article.id))]))
      .catch(() => toast.error('Impossible de charger l’article sélectionné.'))
  }, [articles, watchedIngredients])

  useEffect(() => {
    const ids = Array.from(new Set(watchedIngredients.map((ingredient) => ingredient.article_id).filter(Boolean)))
    if (ids.length === 0) { setOfficialPrices({}); return }
    getLastNormalActualPurchasePrices(ids)
      .then((prices) => setOfficialPrices(Object.fromEntries(prices.map((price) => [price.article_id, price.normalized_unit_price]))))
      .catch(() => setOfficialPrices({}))
  }, [watchedIngredients])

  useEffect(() => {
    watchedIngredients.forEach((ingredient, index) => {
      const officialPrice = ingredient.article_id ? officialPrices[ingredient.article_id] : null
      if (officialPrice != null) {
        form.setValue(`ingredients.${index}.unit_price`, officialPrice, { shouldDirty: false })
      }
    })
  }, [form, officialPrices, watchedIngredients])

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
          yield_mode: recipe.yield_mode ?? 'portions',
          yield_quantity: recipe.yield_quantity ? Number(recipe.yield_quantity) : 1,
          yield_unit_id: recipe.yield_unit_id ?? '',
          retained_sale_price_ttc: recipe.retained_sale_price_ttc == null ? undefined : Number(recipe.retained_sale_price_ttc),
          retained_sale_price_reason: recipe.retained_sale_price_reason ?? '',
          dressing_photo_alt: recipe.dressing_photo_alt ?? '',
          steps: (recipe.recipe_steps ?? []).sort((a, b) => a.step_order - b.step_order).map((step) => ({ step_order: step.step_order, title: step.title ?? '', instructions: step.instructions, active_duration_minutes: step.active_duration_minutes ?? undefined, passive_duration_minutes: step.passive_duration_minutes ?? undefined, attention_points: step.attention_points ?? '', observation: step.observation ?? '' })),
          status: recipe.status,
          ingredients: recipe.recipe_ingredients?.filter((ingredient) => ingredient.article_id || ingredient.subrecipe_id).map((ingredient, index) => ({
            article_id: ingredient.article_id ?? '',
            quantity: Number(ingredient.quantity_display ?? ingredient.quantity),
            unit_id: ingredient.unit_display ?? ingredient.unit_id,
            unit_price: Number(ingredient.unit_price),
            conversion_factor: ingredient.conversion_factor ? Number(ingredient.conversion_factor) : null,
            quantity_mode: ingredient.quantity_mode ?? (ingredient.is_net_quantity ? 'net' : 'brut'),
            yield_percent_snapshot: ingredient.yield_percent_snapshot == null ? undefined : Number(ingredient.yield_percent_snapshot),
            line_kind: ingredient.line_kind ?? (ingredient.subrecipe_id ? 'subrecipe' : 'article'),
            subrecipe_id: ingredient.subrecipe_id ?? undefined,
            sort_order: index,
          })) ?? [],
        })
          setLoadedWorkflowStatus(recipe.workflow_status ?? null)
        setProvisionalPrices(Object.fromEntries((recipe.provisional_prices ?? []).reduce<Array<[string, { amount_ttc: number; unit_id: string; source?: string | null }]>>((rows, item) => rows.some(([articleId]) => articleId === item.article_id) || item.normalized_amount_ttc == null ? rows : [...rows, [item.article_id, { amount_ttc: Number(item.normalized_amount_ttc), unit_id: item.normalized_unit_id ?? item.unit_id, source: item.source }]], [])))
      })
      .catch((error) => toast.error(getErrorMessage(error, 'Fiche technique introuvable')))
      .finally(() => setLoading(false))
  }, [form, id])

  const isEditableDraft = !isEdit || ['draft', 'needs_correction', null].includes(loadedWorkflowStatus)
  useEffect(() => {
    if (!isEditableDraft || !form.formState.isDirty || !isRecipeDraftMeaningful(watched.name)) return
    const parsed = recipeSchema.safeParse(watched)
    if (!parsed.success) return
    const snapshot = JSON.stringify(parsed.data)
    if (snapshot === autosaveLastSnapshot.current) return

    const timer = window.setTimeout(() => {
      if (autosaveInFlight.current) return
      autosaveInFlight.current = true
      setAutosaveState('saving')
      const saveDraft = async () => {
        try {
          const recipeId = id
            ? await updateRecipe(id, parsed.data, profile?.id)
            : await createRecipe(parsed.data, profile?.id)
          autosaveLastSnapshot.current = snapshot
          setAutosaveState('saved')
          if (!id) navigate(`/recipes/${recipeId}/edit`, { replace: true })
        } catch {
          setAutosaveState('error')
        } finally {
          autosaveInFlight.current = false
        }
      }
      void saveDraft()
    }, 900)
    return () => window.clearTimeout(timer)
  }, [form.formState.isDirty, id, isEditableDraft, navigate, profile?.id, watched])

  const selectInitialDefaultValue = (key: string, initialValue: string | number) => (event: React.FocusEvent<HTMLInputElement>) => {
    if (shouldReplaceInitialNumericValue(event.currentTarget.value, initialValue, !untouchedDefaultValues.has(key))) event.currentTarget.select()
  }
  const markDefaultValueEdited = (key: string) => {
    setUntouchedDefaultValues((current) => { const next = new Set(current); next.delete(key); return next })
  }

  const addIngredient = () => {
    setUntouchedDefaultValues((current) => new Set(current).add(`ingredient-${fields.length}`))
    append({ article_id: '', quantity: 1, unit_id: '', unit_price: 0, conversion_factor: null, quantity_mode: 'brut', yield_percent_snapshot: undefined, line_kind: 'article', subrecipe_id: undefined, sort_order: fields.length })
  }

  const loadTrimForms = async (articleId: string) => {
    if (!articleId || trimForms[articleId]) return
    try {
      const forms = await listRecipeTrimForms(articleId)
      setTrimForms((current) => ({ ...current, [articleId]: forms }))
    } catch {
      setTrimForms((current) => ({ ...current, [articleId]: [] }))
    }
  }

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
    setSubmitError(null)
    try {
      calculateRecipeTotalsWithConversions(values, articles, units)
      if (id) {
        const savedRecipeId = await updateRecipe(id, values, profile?.id)
        if (dressingPhoto) await uploadRecipeDressingPhoto(savedRecipeId, dressingPhoto)
        toast.success(savedRecipeId === id ? 'Fiche technique mise a jour avec succes' : 'Nouvelle version creee en brouillon')
        navigate(`/recipes/${savedRecipeId}`)
      } else {
        const recipeId = await createRecipe(values, profile?.id)
        if (dressingPhoto) await uploadRecipeDressingPhoto(recipeId, dressingPhoto)
        toast.success('Fiche technique creee avec succes')
        navigate(`/recipes/${recipeId}`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Une erreur est survenue. Veuillez reessayer.'
      setSubmitError(message)
      toast.error(message)
    }
  }

  const selectIngredientArticle = (index: number, article: Article) => {
    setArticles((current) => current.some((item) => item.id === article.id) ? current : [...current, article])
    form.setValue(`ingredients.${index}.article_id`, article.id, { shouldDirty: true })
    form.setValue(`ingredients.${index}.unit_id`, article.unit_id, { shouldDirty: true })
    form.setValue(`ingredients.${index}.unit_price`, officialPrices[article.id] ?? 0, { shouldDirty: false })
    void loadTrimForms(article.id)
  }

  const saveProvisionalPrice = async (articleId: string, unitId: string) => {
    if (!id) { toast.error('Enregistrez d’abord le brouillon avant de saisir un prix provisoire.'); return }
    const draft = provisionalDrafts[articleId]
    const amount = Number(draft?.amount)
    if (!Number.isFinite(amount) || amount < 0) { toast.error('Montant provisoire invalide.'); return }
    try {
      const article = articles.find((item) => item.id === articleId)
      const sourceUnit = units.find((item) => item.id === unitId)
      const stockUnit = units.find((item) => item.id === article?.unit_id)
      const ingredient = watchedIngredients.find((item) => item.article_id === articleId)
      const conversionFactor = getUnitConversionFactor(sourceUnit, stockUnit) ?? Number(ingredient?.conversion_factor ?? 0)
      if (!article || !stockUnit || !sourceUnit || !Number.isFinite(conversionFactor) || conversionFactor <= 0) {
        throw new Error('Conversion impossible de l unité du prix provisoire vers l unité stock')
      }
      const normalizedAmount = amount / conversionFactor
      await recordRecipeIngredientProvisionalPrice(id, articleId, amount, unitId, normalizedAmount, stockUnit.id, conversionFactor, draft?.source, draft?.observation)
      setProvisionalPrices((current) => ({ ...current, [articleId]: { amount_ttc: normalizedAmount, unit_id: stockUnit.id, source: draft?.source } }))
      toast.success('Prix provisoire enregistré pour le brouillon')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Impossible d’enregistrer le prix provisoire') }
  }

  const onInvalid = (errors: FieldErrors<RecipeFormValues>) => {
    const message = firstFormErrorMessage(errors) ?? 'Impossible d’enregistrer : vérifiez les champs obligatoires.'
    setSubmitError(message)
    toast.error(message)
  }

  if (loading) return <div className="surface p-6 text-sm text-slate-600">Chargement...</div>

  return (
    <div className="space-y-6">
      <header><p className="eyebrow">Fiche technique</p><h1 className="page-title mt-2">{isEdit ? 'Modifier la fiche' : 'Nouvelle fiche'}</h1>{autosaveState === 'saving' && <p className="mt-2 text-sm text-slate-500">Enregistrement du brouillon…</p>}{autosaveState === 'saved' && <p className="mt-2 text-sm font-semibold text-emerald-700">Brouillon enregistré automatiquement.</p>}{autosaveState === 'error' && <p className="mt-2 text-sm font-semibold text-amber-700">Le brouillon n’a pas pu être enregistré automatiquement. Utilisez Enregistrer.</p>}</header>
      {submitError && <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">{submitError}</div>}
      <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-6">
        <section className="surface grid gap-5 p-5 lg:grid-cols-2">
          <Field label="Nom"><input {...form.register('name')} className="input mt-2" /></Field>
          <Field label="Type"><select {...form.register('type')} className="input mt-2">{selectableRecipeTypes.map((type) => <option key={type} value={type}>{type} - {recipeTypeLabels[type]}{type === 'BF' ? ' — Legacy' : ''}</option>)}</select></Field>
          <Field label="Matiere principale"><select {...form.register('main_ingredient')} className="input mt-2">{recipeMainIngredients.map((item) => <option key={item} value={item}>{item} - {mainIngredientLabels[item]}</option>)}</select></Field>
          <Field label="Portions"><input {...form.register('portions', { valueAsNumber: true, onChange: () => markDefaultValueEdited('portions') })} onFocus={selectInitialDefaultValue('portions', 10)} type="number" min="1" className="input mt-2" /></Field>
          <Field label="Mode de rendement"><select {...form.register('yield_mode')} className="input mt-2">{recipeYieldModes.map((mode) => <option key={mode} value={mode}>{mode === 'portions' ? 'Portions / convives' : 'Rendement produit'}</option>)}</select></Field>
          <Field label="Quantite de rendement"><input {...form.register('yield_quantity', { setValueAs: optionalNumberValue, onChange: () => markDefaultValueEdited('yield_quantity') })} onFocus={selectInitialDefaultValue('yield_quantity', 1)} type="number" min="0.001" step="0.001" className="input mt-2" /></Field>
          <div className="rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900 lg:col-span-2">Le PV retenu TTC est fixé exclusivement par la Direction lors de la validation finale. Pour un rendement produit, la règle de PV théorique complet reste à arbitrer.</div>
          <Field label="Tags"><select multiple {...form.register('tags')} className="input mt-2 min-h-28">{recipeTags.map((tag) => <option key={tag} value={tag}>{recipeTagLabels[tag]}</option>)}</select></Field>
          <label className="block lg:col-span-2"><span className="field-label">Description</span><textarea {...form.register('description')} className="input mt-2 min-h-24 resize-none" /></label>
        </section>

        <section className="surface p-5">
          <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-bold">Ingredients</h2><button type="button" onClick={addIngredient} className="btn-secondary"><Plus className="mr-2 h-4 w-4" /> Ajouter</button></div>
          <div className="mt-4 space-y-3">
            {fields.map((field, index) => {
              const ingredient = watchedIngredients[index]
              const selectedArticle = articles.find((item) => item.id === ingredient?.article_id)
              const officialPrice = ingredient?.article_id && Object.prototype.hasOwnProperty.call(officialPrices, ingredient.article_id) ? officialPrices[ingredient.article_id] : null
              const provisionalPrice = ingredient?.article_id ? provisionalPrices[ingredient.article_id]?.amount_ttc ?? null : null
              const effectivePrice = officialPrice != null ? officialPrice : (!ingredient?.article_id || Object.prototype.hasOwnProperty.call(officialPrices, ingredient.article_id) ? null : provisionalPrice)
              const displayUnit = units.find((unit) => unit.id === ingredient?.unit_id)
              const stockUnit = units.find((unit) => unit.id === selectedArticle?.unit_id)
              const needsManualFactor = Boolean(ingredient?.article_id && ingredient.unit_id && displayUnit && stockUnit && getUnitConversionFactor(displayUnit, stockUnit) === null)
              const articleFilter = ingredientArticleFilters[field.id] ?? getEmptyIngredientArticleFilter()
              const availableSubCategories = subCategories.filter((subCategory) => articleFilter.familyId === 'all' || subCategory.family_id === articleFilter.familyId)
              let lineCost: number | null = null
              if (ingredient?.line_kind !== 'subrecipe' && ingredient?.article_id && effectivePrice != null) {
                try {
                  const conversion = getIngredientConversionPreview(ingredient, selectedArticle, units)
                  lineCost = conversion ? conversion.quantityStored * effectivePrice : null
                } catch {
                  lineCost = null
                }
              }

              return (
                <div key={field.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[180px_220px_minmax(260px,1fr)]">
                    <label className="block min-w-0"><span className="field-label">Type de ligne</span><select {...form.register(`ingredients.${index}.line_kind`)} className="input mt-2" onChange={(event) => { form.register(`ingredients.${index}.line_kind`).onChange(event); if (event.target.value === 'article') form.setValue(`ingredients.${index}.subrecipe_id`, undefined); else form.setValue(`ingredients.${index}.article_id`, '') }}><option value="article">Article Stock</option><option value="subrecipe">Sous-recette validée</option></select></label>
                    <label className="block min-w-0">
                      <span className="field-label">Categorie article</span>
                      <select
                        value={articleFilter.familyId}
                        className="input mt-2 min-w-0"
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
                    </label>
                    <label className="block min-w-0">
                      <span className="field-label">Sous-categorie article</span>
                      <select
                        value={articleFilter.subCategoryName}
                        className="input mt-2 min-w-0"
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
                    </label>
                    {ingredient?.line_kind === 'subrecipe' ? <label className="block min-w-0 md:col-span-2 xl:col-span-1"><span className="field-label">Sous-recette validée</span><select {...form.register(`ingredients.${index}.subrecipe_id`)} className="input mt-2 min-w-0" onChange={(event) => { const selected = subrecipes.find((recipe) => recipe.id === event.target.value); if (selected?.yield_unit_id) form.setValue(`ingredients.${index}.unit_id`, selected.yield_unit_id) }}><option value="">Sous-recette</option>{subrecipes.filter((recipe) => recipe.id !== id).map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.code ? `${recipe.code} - ` : ''}{recipe.name} ({Number(recipe.yield_quantity ?? 0).toLocaleString('fr-FR')} rendement)</option>)}</select></label> : <RecipeIngredientArticlePicker selectedArticle={selectedArticle} articleFilter={articleFilter} onSelect={(article) => selectIngredientArticle(index, article)} onClear={() => { form.setValue(`ingredients.${index}.article_id`, '', { shouldDirty: true }); form.setValue(`ingredients.${index}.unit_id`, '', { shouldDirty: true }); form.setValue(`ingredients.${index}.unit_price`, 0, { shouldDirty: false }) }} />}
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-[120px_170px_150px_160px_minmax(220px,1fr)_90px]">
                    <label className="block min-w-0"><span className="field-label">Quantite utilisee</span><input {...form.register(`ingredients.${index}.quantity`, { valueAsNumber: true, onChange: () => markDefaultValueEdited(`ingredient-${index}`) })} onFocus={selectInitialDefaultValue(`ingredient-${index}`, 1)} type="number" min="0" step="0.01" className="input mt-2 min-w-0" /></label>
                    <label className="block min-w-0"><span className="field-label">Unite utilisee</span><select {...form.register(`ingredients.${index}.unit_id`)} className="input mt-2 min-w-0"><option value="">Unite</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name} ({unit.abbreviation})</option>)}</select></label>
                    <label className="block min-w-0"><span className="field-label">Mode quantité</span><select {...form.register(`ingredients.${index}.quantity_mode`)} className="input mt-2">{ingredientQuantityModes.map((mode) => <option key={mode} value={mode}>{mode === 'brut' ? 'Brut' : 'Net / paré'}</option>)}</select></label>
                    {ingredient?.quantity_mode === 'net' && <label className="block min-w-0"><span className="field-label">Forme parée</span><select {...form.register(`ingredients.${index}.trim_form_id`)} className="input mt-2" onFocus={() => void loadTrimForms(ingredient.article_id)} onChange={(event) => { form.register(`ingredients.${index}.trim_form_id`).onChange(event); const selected = (trimForms[ingredient.article_id] ?? []).find((formOption) => formOption.id === event.target.value); if (selected) form.setValue(`ingredients.${index}.yield_percent_snapshot`, Number(selected.yield_percent)) }}><option value="">Forme</option>{(trimForms[ingredient.article_id] ?? []).map((formOption) => <option key={formOption.id} value={formOption.id}>{formOption.name} ({formOption.yield_percent} %)</option>)}</select></label>}
                    <label className="block min-w-0"><span className="field-label">Rendement utilisé (%)</span><input {...form.register(`ingredients.${index}.yield_percent_snapshot`, { setValueAs: optionalNumberValue })} type="number" min="0.001" max="100" step="0.001" disabled={ingredient?.quantity_mode !== 'net'} className="input mt-2 min-w-0" /></label>
                    <label className="block min-w-0">
                      <span className="field-label">Prix unitaire normalisé officiel</span>
                      <input type="hidden" {...form.register(`ingredients.${index}.unit_price`, { valueAsNumber: true })} value={officialPrice ?? 0} readOnly />
                      <input type="text" readOnly value={officialPrice ?? ''} placeholder="Prix NORMAL manquant" className="input mt-2 min-w-0 bg-slate-100" aria-label="Prix unitaire normalisé officiel" />
                      <span className={`mt-1 block text-xs ${ingredient?.article_id && officialPrice == null ? 'font-semibold text-amber-700' : 'text-slate-500'}`}>
                        {ingredient?.article_id && officialPrice == null ? 'Prix NORMAL manquant — la soumission restera bloquée jusqu’à résolution.' : 'Source : achats réels qualifiés.'}
                      </span>
                      {ingredient?.article_id && officialPrice == null && provisionalPrice == null && canEditRecipes(profile?.role) && <div className="mt-2 space-y-2 rounded border border-amber-200 bg-amber-50 p-2"><span className="block text-xs font-semibold text-amber-900">Prix provisoire de travail (TTC)</span><input type="number" min="0" step="0.01" placeholder="Montant TTC" value={provisionalDrafts[ingredient.article_id]?.amount ?? ''} onChange={(event) => setProvisionalDrafts((current) => ({ ...current, [ingredient.article_id as string]: { ...(current[ingredient.article_id as string] ?? { source: '', observation: '' }), amount: event.target.value } }))} className="input" /><input type="text" placeholder="Source / observation (facultatif)" value={provisionalDrafts[ingredient.article_id]?.source ?? ''} onChange={(event) => setProvisionalDrafts((current) => ({ ...current, [ingredient.article_id as string]: { ...(current[ingredient.article_id as string] ?? { amount: '', observation: '' }), source: event.target.value } }))} className="input" /><button type="button" onClick={() => saveProvisionalPrice(ingredient.article_id as string, ingredient.unit_id)} className="btn-secondary">Enregistrer le prix provisoire</button><span className="block text-[11px] text-amber-800">Ce prix aide le brouillon et reste bloquant pour la validation Direction.</span></div>}
                      {ingredient?.article_id && officialPrice == null && provisionalPrice != null && <span className="mt-1 block rounded bg-amber-100 px-2 py-1 text-xs font-bold text-amber-900">Prix provisoire utilisé : {provisionalPrice.toLocaleString('fr-FR')} Ar TTC · validation Direction bloquée tant qu’aucun NORMAL n’est disponible.</span>}
                      <span className="mt-1 block text-xs font-semibold text-slate-700">Coût ligne TTC : {lineCost == null ? 'Non calculable' : `${lineCost.toLocaleString('fr-FR')} Ar`}</span>
                    </label>
                    {needsManualFactor ? (
                      <label className="block min-w-0">
                        <span className="field-label">Facteur manuel</span>
                        <input
                          {...form.register(`ingredients.${index}.conversion_factor`, {
                            setValueAs: (value) => {
                              if (value === '' || value == null) return null
                              const parsed = Number(value)
                              return Number.isFinite(parsed) ? parsed : null
                            },
                          })}
                          type="number"
                          min="0"
                          step="0.000001"
                          className="input mt-2 min-w-0"
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

        <section className="surface p-5">
          <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Procédé / déroulé</h2><p className="mt-1 text-sm text-slate-500">Étapes ordonnées de la recette.</p></div><button type="button" onClick={() => appendStep({ step_order: stepFields.length + 1, title: '', instructions: '', active_duration_minutes: undefined, passive_duration_minutes: undefined, attention_points: '', observation: '' })} className="btn-secondary"><Plus className="mr-2 h-4 w-4" />Ajouter une étape</button></div>
          <div className="mt-4 space-y-4">{stepFields.map((step, index) => <div key={step.id} className="rounded-md border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between"><strong>Étape {index + 1}</strong><div className="flex gap-2"><button type="button" disabled={index === 0} onClick={() => moveStep(index, index - 1)} className="btn-secondary p-2"><ArrowUp className="h-4 w-4" /></button><button type="button" disabled={index === stepFields.length - 1} onClick={() => moveStep(index, index + 1)} className="btn-secondary p-2"><ArrowDown className="h-4 w-4" /></button><button type="button" onClick={() => removeStep(index)} className="btn-secondary p-2 text-red-700"><Trash2 className="h-4 w-4" /></button></div></div><input type="hidden" {...form.register(`steps.${index}.step_order`, { valueAsNumber: true })} value={index + 1} /><div className="mt-3 grid gap-3 md:grid-cols-2"><Field label="Titre facultatif"><input {...form.register(`steps.${index}.title`)} className="input mt-2" /></Field><Field label="Description"><textarea {...form.register(`steps.${index}.instructions`)} className="input mt-2 min-h-20" /></Field><Field label="Durée active (min)"><input {...form.register(`steps.${index}.active_duration_minutes`, { setValueAs: optionalNumberValue })} type="number" min="0" step="0.5" className="input mt-2" /></Field><Field label="Durée passive (min)"><input {...form.register(`steps.${index}.passive_duration_minutes`, { setValueAs: optionalNumberValue })} type="number" min="0" step="0.5" className="input mt-2" /></Field><Field label="Point de vigilance"><textarea {...form.register(`steps.${index}.attention_points`)} className="input mt-2 min-h-16" /></Field><Field label="Observation"><textarea {...form.register(`steps.${index}.observation`)} className="input mt-2 min-h-16" /></Field></div></div>)}</div>
        </section>

        <section className="surface p-5"><h2 className="text-lg font-bold">Photo de dressage</h2><div className="mt-4 grid gap-4 md:grid-cols-2"><label className="block"><span className="field-label">Ajouter ou remplacer</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setDressingPhoto(event.target.files?.[0] ?? null)} className="input mt-2" /><span className="mt-1 block text-xs text-slate-500">Stockage privé Supabase, 5 Mo maximum.</span></label><Field label="Texte alternatif"><input {...form.register('dressing_photo_alt')} className="input mt-2" /></Field></div>{dressingPhoto && <p className="mt-3 text-sm text-slate-600"><Upload className="mr-2 inline h-4 w-4" />{dressingPhoto.name}</p>}</section>

        {conversionErrors.length > 0 && (
          <section className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
            {conversionErrors[0]}
          </section>
        )}

        <section className="surface grid gap-4 p-5 md:grid-cols-5">
          <Metric label="Coût matière TTC total" value={economics.totalMaterialCostTtc == null ? 'Non calculable' : `${economics.totalMaterialCostTtc.toLocaleString('fr-FR')} Ar`} />
          <Metric label="Coût matière TTC/personne" value={economics.costPerPortion == null ? 'Non calculable' : `${economics.costPerPortion.toLocaleString('fr-FR')} Ar`} />
          <Metric label="PV théorique TTC/personne" value={watched.yield_mode === 'rendement_produit' ? 'Règle métier à définir' : economics.theoreticalSalePriceTtcPerPerson == null ? 'Non calculable' : `${economics.theoreticalSalePriceTtcPerPerson.toLocaleString('fr-FR')} Ar`} />
          <Metric label="Ratio cout" value={`${totals.costRatio.toFixed(1)} %`} />
          <Metric label="Marge" value={`${totals.marginRate.toFixed(1)} %`} />
          <Metric label={watched.yield_mode === 'rendement_produit' ? 'Coût / unité de rendement' : 'PV théorique TTC total'} value={watched.yield_mode === 'rendement_produit' ? economics.costPerYield == null ? 'Non calculable' : `${economics.costPerYield.toLocaleString('fr-FR')} Ar` : economics.theoreticalSalePriceTtcTotal == null ? 'Non calculable' : `${economics.theoreticalSalePriceTtcTotal.toLocaleString('fr-FR')} Ar`} />
          <p className="text-xs text-slate-500 md:col-span-5">Les coûts opérationnels FT sont exprimés TTC. Les informations HT et TVA, lorsqu’elles sont fournies par Achats, restent consultables sans piloter ce calcul.</p>
        </section>

        <div className="flex gap-3"><button type="submit" className="btn-primary"><Save className="mr-2 h-4 w-4" /> Enregistrer</button><Link to="/recipes" className="btn-secondary">Annuler</Link></div>
      </form>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="field-label">{label}</span>{children}</label>
}

function RecipeIngredientArticlePicker({
  selectedArticle,
  articleFilter,
  onSelect,
  onClear,
}: {
  selectedArticle?: Article
  articleFilter: IngredientArticleFilter
  onSelect: (article: Article) => void
  onClear: () => void
}) {
  const [query, setQuery] = useState(selectedArticle?.name ?? '')
  const [results, setResults] = useState<Article[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const searchRequest = useRef(0)
  const selectedArticleId = selectedArticle?.id
  const selectedArticleName = selectedArticle?.name ?? ''

  useEffect(() => {
    setQuery(selectedArticleName)
    if (selectedArticleId) {
      setResults([])
      setIsOpen(false)
    }
  }, [selectedArticleId, selectedArticleName])

  useEffect(() => {
    if (selectedArticleId && query === selectedArticleName) {
      setResults([])
      setIsOpen(false)
      return
    }
    const requestId = ++searchRequest.current
    const timer = window.setTimeout(() => {
      searchRecipeIngredientArticles(query)
        .then((articles) => {
          if (requestId !== searchRequest.current) return
          setResults(articles.filter((article) => articleMatchesIngredientFilter(article, articleFilter)))
          setIsOpen(true)
          setSearchError(null)
        })
        .catch(() => {
          if (requestId !== searchRequest.current) return
          setResults([])
          setSearchError('Recherche d’articles impossible.')
        })
    }, 250)
    return () => window.clearTimeout(timer)
  }, [articleFilter, query, selectedArticleId, selectedArticleName])

  return (
    <div className="relative block min-w-0 md:col-span-2 xl:col-span-1">
      <span className="field-label">Article ingrédient</span>
      <div className="mt-2 flex gap-2">
        <input
          value={query}
          onFocus={() => { if (!selectedArticle) setIsOpen(true) }}
          onBlur={() => { window.setTimeout(() => setIsOpen(false), 100) }}
          onChange={(event) => {
            const nextQuery = event.target.value
            if (selectedArticle && nextQuery !== selectedArticle.name) onClear()
            setQuery(nextQuery)
            setIsOpen(true)
          }}
          placeholder="Rechercher un article"
          className="input min-w-0 flex-1"
          aria-label="Rechercher un article ingrédient"
        />
        {selectedArticle && <button type="button" className="btn-secondary px-3" onClick={() => { setQuery(''); setResults([]); setIsOpen(true); onClear() }}>Effacer</button>}
      </div>
      {searchError && <p className="mt-1 text-xs font-semibold text-red-700">{searchError}</p>}
      {isOpen && results.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {results.map((article) => (
            <button
              key={article.id}
              type="button"
              className="block w-full px-3 py-2 text-left text-sm hover:bg-blue-50"
              onClick={() => { onSelect(article); setQuery(article.name); setResults([]); setIsOpen(false) }}
            >
              {article.name}{article.units?.abbreviation ? ` — ${article.units.abbreviation}` : ''}
            </button>
          ))}
        </div>
      )}
      {isOpen && results.length === 0 && !searchError && <p className="mt-1 text-xs text-slate-500">Aucun article actif utilisable en fiche technique trouvé.</p>}
    </div>
  )
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
