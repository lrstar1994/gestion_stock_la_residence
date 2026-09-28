import { supabase } from '../../lib/supabase'
import type { Article, Unit } from '../../lib/catalog'
import { getArticle, listArticles } from './catalog.api'
import type {
  ImportReport,
  PendingIngredient,
  Recipe,
  RecipeFormValues,
  RecipeMainIngredient,
  RecipeStatus,
  RecipeType,
  RecipePriceObservation,
  RecipeProvisionalIngredientPrice,
} from '../../lib/recipes'
import { calculateRawQuantityFromNet, calculateRecipeTotals, getRecipeReadiness } from '../../lib/recipes'
import { convertIngredientQuantity } from '../../lib/unitConversions'
import { getErrorMessage } from '../../lib/errors'
import { getLastNormalActualPurchasePrices } from './purchasePrices.api'
import type { ParsedRecipeWorkbook } from '../../lib/recipeImport'
import { normalizeImportLabel } from '../../lib/recipeImport'
import { filterRecipeArticleSearchResults, normalizeRecipeArticleSearch } from '../../lib/recipeFormUx'
import { recipeMainIngredients, recipeTags, recipeTypes } from '../../lib/recipes'

type RecipeFilters = {
  search?: string
  type?: RecipeType | 'all'
  mainIngredient?: RecipeMainIngredient | 'all'
  status?: RecipeStatus | 'all'
  page?: number
  pageSize?: number
}

type ImportArticleMatch = Pick<Article, 'id' | 'name'> & { unit_id?: string | null }

type PendingResolutionOptions = {
  conversionFactor?: number | null
  confirmAlias?: boolean
  profileId?: string
}

type ImportAlias = { normalized_label: string; article_id: string }
type ImportTrimForm = { id: string; article_id: string; name: string; yield_percent: number }

function cleanNullable(value?: string) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export async function listRecipes(filters: RecipeFilters = {}) {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 10
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase.schema('stock')
    .from('recipes')
    .select('*', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range(from, to)

  if (filters.type && filters.type !== 'all') query = query.eq('type', filters.type)
  if (filters.mainIngredient && filters.mainIngredient !== 'all') query = query.eq('main_ingredient', filters.mainIngredient)
  if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status)
  if (filters.search?.trim()) {
    const term = filters.search.trim()
    query = query.or(`name.ilike.%${term}%,code.ilike.%${term}%`)
  }

  const { data, error, count } = await query
  if (error) throw error

  return { recipes: (data ?? []) as Recipe[], total: count ?? 0 }
}

export async function listRecipeTrimForms(articleId?: string) {
  let query = supabase.schema('stock').from('recipe_trim_forms').select('*').eq('is_active', true).order('name')
  if (articleId) query = query.eq('article_id', articleId)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

/**
 * Recherche légère destinée au sélecteur d'ingrédients FT. Une page limitée
 * est chargée dès l'ouverture puis filtrée à chaque saisie. Les alias
 * confirmés du module d'import sont aussi pris en compte lorsqu'ils sont
 * disponibles.
 */
export async function searchRecipeIngredientArticles(search: string, limit = 20): Promise<Article[]> {
  const normalizedSearch = normalizeRecipeArticleSearch(search)
  const [articleResult, aliasesResult] = await Promise.all([
    listArticles({ status: 'active', usableInRecipes: true, search, page: 1, pageSize: limit }),
    normalizedSearch
      ? supabase.schema('stock')
        .from('recipe_import_aliases')
        .select('article_id, normalized_label')
        .eq('is_active', true)
        .ilike('normalized_label', `%${normalizedSearch}%`)
        .limit(limit)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (aliasesResult.error) throw aliasesResult.error

  const aliasArticleIds = [...new Set((aliasesResult.data ?? []).map((alias) => alias.article_id))]
  const aliasArticles = aliasArticleIds.length === 0
    ? [] as Article[]
    : (await Promise.all(aliasArticleIds.map((articleId) => getArticle(articleId)))).filter((article) => article.status === 'active' && article.usable_in_recipes)

  const byId = new Map<string, Article>()
  for (const article of [...articleResult.articles, ...aliasArticles]) {
    byId.set(article.id, article)
  }
  return [...byId.values()]
    .filter((article) => aliasArticleIds.includes(article.id) || filterRecipeArticleSearchResults([article], search).length > 0)
    .sort((first, second) => first.name.localeCompare(second.name, 'fr', { sensitivity: 'base' }))
    .slice(0, limit)
}

export async function getRecipe(id: string) {
  const fullSelect =
    '*, validator:profiles!recipes_validated_by_fkey(id, full_name), submitter:profiles!recipes_submitted_by_fkey(id, full_name), correction_requester:profiles!recipes_correction_requested_by_fkey(id, full_name), recipe_validation_history(*, actor:profiles!recipe_validation_history_actor_id_fkey(id, full_name)), recipe_ingredients!recipe_ingredients_recipe_id_fkey(*, articles(id, name, unit_id, locations_restricted, units(id, name, abbreviation), article_locations(locations(*))), units:units!recipe_ingredients_unit_id_fkey(id, name, abbreviation), display_unit:units!recipe_ingredients_unit_display_fkey(id, name, abbreviation), stored_unit:units!recipe_ingredients_unit_stored_fkey(id, name, abbreviation), trim_form:recipe_trim_forms(id, name, yield_percent)), recipe_steps(*), pending_ingredients(*)'
  const legacySelect =
    '*, validator:profiles!recipes_validated_by_fkey(id, full_name), recipe_ingredients!recipe_ingredients_recipe_id_fkey(*, articles(id, name, unit_id, locations_restricted, units(id, name, abbreviation), article_locations(locations(*))), units:units!recipe_ingredients_unit_id_fkey(id, name, abbreviation)), recipe_steps(*), pending_ingredients(*)'

  const { data, error } = await supabase.schema('stock')
    .from('recipes')
    .select(fullSelect)
    .eq('id', id)
    .single()

  if (error && isMissingConversionSchemaError(error)) {
    const { data: legacyData, error: legacyError } = await supabase.schema('stock')
      .from('recipes')
      .select(legacySelect)
      .eq('id', id)
      .single()

    if (legacyError) throw new Error(getErrorMessage(legacyError, 'Fiche technique introuvable'))
    return attachProvisionalPrices(legacyData as Recipe)
  }

  if (error) throw new Error(getErrorMessage(error, 'Fiche technique introuvable'))
  return attachProvisionalPrices(data as Recipe)
}

async function attachProvisionalPrices(recipe: Recipe): Promise<Recipe> {
  const { data, error } = await supabase.schema('stock')
    .from('recipe_ingredient_provisional_prices')
    .select('*')
    .eq('recipe_id', recipe.id)
    .order('created_at', { ascending: false })
  // Keep older environments readable until the additive migration is applied.
  if (!error) recipe.provisional_prices = (data ?? []) as RecipeProvisionalIngredientPrice[]
  return recipe
}

export async function recordRecipeIngredientProvisionalPrice(
  recipeId: string,
  articleId: string,
  amountTtc: number,
  unitId: string,
  normalizedAmountTtc: number,
  normalizedUnitId: string,
  conversionFactorToStock: number,
  source?: string,
  observation?: string,
) {
  const { data, error } = await supabase.schema('stock').rpc('record_recipe_ingredient_provisional_price', {
    p_recipe_id: recipeId,
    p_article_id: articleId,
    p_amount_ttc: amountTtc,
    p_unit_id: unitId,
    p_normalized_amount_ttc: normalizedAmountTtc,
    p_normalized_unit_id: normalizedUnitId,
    p_conversion_factor_to_stock: conversionFactorToStock,
    p_source: source?.trim() || null,
    p_observation: observation?.trim() || null,
  })
  if (error) throw error
  return data as string
}

function isMissingConversionSchemaError(error: unknown) {
  const message = getErrorMessage(error, '').toLowerCase()
  return (
    message.includes('recipe_ingredients_unit_display_fkey') ||
    message.includes('recipe_ingredients_unit_stored_fkey') ||
    message.includes('unit_display') ||
    message.includes('unit_stored') ||
    message.includes('quantity_display') ||
    message.includes('quantity_stored') ||
    message.includes('conversion_factor') ||
    message.includes('recipe_trim_forms') ||
    message.includes('schema cache')
  )
}

export async function createRecipe(values: RecipeFormValues, profileId?: string) {
  if (values.type === 'BF') throw new Error('Le type Composition buffet est historique et ne peut plus être créé')
  const prepared = await prepareRecipeIngredients(values)
  const totals = calculateTotalsFromIngredientRows(values, prepared.rows)
  const { data, error } = await supabase.schema('stock')
    .from('recipes')
    .insert({
      name: values.name.trim(),
      type: values.type,
      sub_type: cleanNullable(values.sub_type),
      main_ingredient: values.main_ingredient,
      portions: values.portions,
      description: cleanNullable(values.description),
      tags: values.tags,
      total_cost: totals.totalCost,
      cost_per_portion: totals.costPerPortion,
      suggested_price: totals.suggestedPrice,
      final_price: 0,
      cost_ratio: totals.costRatio,
      margin_rate: totals.marginRate,
      margin_coefficient: values.margin_coefficient,
      yield_mode: values.yield_mode,
      yield_quantity: values.yield_quantity ?? null,
      yield_unit_id: values.yield_unit_id || null,
      retained_sale_price_ttc: null,
      retained_sale_price_reason: null,
      dressing_photo_alt: cleanNullable(values.dressing_photo_alt),
      status: 'brouillon',
      workflow_status: 'draft',
      created_by: profileId,
      updated_by: profileId,
    })
    .select('id')
    .single()

  if (error) throw error
  await replaceRecipeIngredients(data.id, prepared.rows)
  await replaceRecipeSteps(data.id, values.steps ?? [], profileId)
  return data.id as string
}

export async function updateRecipe(id: string, values: RecipeFormValues, profileId?: string) {
  const current = await getRecipe(id)
  if (current.status === 'validee') {
    const versionId = await createRecipeVersion(current, values)
    if (current.dressing_photo_path) await cloneRecipeDressingPhoto(current.dressing_photo_path, versionId)
    return versionId
  }
  if (current.status === 'archived' || current.status === 'en_attente' || !['draft', 'needs_correction', null, undefined].includes(current.workflow_status)) {
    throw new Error('Cette fiche ne peut pas être modifiée dans son état actuel')
  }
  if (values.type === 'BF' && current.type !== 'BF') throw new Error('Le type Composition buffet est historique et ne peut plus être créé')

  const prepared = await prepareRecipeIngredients(values)
  const totals = calculateTotalsFromIngredientRows(values, prepared.rows)
  const { error } = await supabase.schema('stock')
    .from('recipes')
    .update({
      name: values.name.trim(),
      type: values.type,
      sub_type: cleanNullable(values.sub_type),
      main_ingredient: values.main_ingredient,
      portions: values.portions,
      description: cleanNullable(values.description),
      tags: values.tags,
      total_cost: totals.totalCost,
      cost_per_portion: totals.costPerPortion,
      suggested_price: totals.suggestedPrice,
      final_price: values.final_price,
      cost_ratio: totals.costRatio,
      margin_rate: totals.marginRate,
      margin_coefficient: values.margin_coefficient,
      yield_mode: values.yield_mode,
      yield_quantity: values.yield_quantity ?? null,
      yield_unit_id: values.yield_unit_id || null,
      dressing_photo_alt: cleanNullable(values.dressing_photo_alt),
      status: 'brouillon',
      updated_by: profileId,
    })
    .eq('id', id)

  if (error) throw error
  await replaceRecipeIngredients(id, prepared.rows)
  await replaceRecipeSteps(id, values.steps ?? [], profileId)
  return id
}

export async function submitRecipeForValidation(id: string) {
  const recipe = await getRecipe(id)
  const prices = await getLastNormalActualPurchasePrices(Array.from(new Set((recipe.recipe_ingredients ?? []).map((ingredient) => ingredient.article_id).filter(Boolean))))
  const observations = new Map((recipe.recipe_ingredients ?? []).map((ingredient) => [ingredient.article_id, prices.find((price) => price.article_id === ingredient.article_id) ?? null] as [string, typeof prices[number] | null]))
  const provisional = new Map((recipe.provisional_prices ?? []).filter((item) => item.normalized_amount_ttc != null).map((item) => [item.article_id, item] as [string, RecipeProvisionalIngredientPrice]))
  assertRecipeReady(recipe, observations, provisional)

  const { error } = await supabase.schema('stock').rpc('submit_recipe_for_validation', { p_recipe_id: id })
  if (error) throw error
}

export async function reviewRecipeAsChef(id: string, approve: boolean, pin: string, reason?: string) {
  const { error } = await supabase.schema('stock').rpc('chef_review_recipe', { p_recipe_id: id, p_approve: approve, p_pin: pin, p_reason: reason?.trim() || null })
  if (error) throw error
}

export async function reviewRecipeAsDirection(id: string, approve: boolean, pin: string, reason?: string, retainedPrice?: number) {
  const { error } = await supabase.schema('stock').rpc('direction_review_recipe', {
    p_recipe_id: id,
    p_approve: approve,
    p_pin: pin,
    p_reason: reason?.trim() || null,
    p_retained_price: retainedPrice ?? null,
  })
  if (error) throw error
}

export async function listRecipeVersions(recipe: Recipe) {
  const rootId = recipe.parent_version_id ?? recipe.id
  const { data, error } = await supabase.schema('stock')
    .from('recipes')
    .select('*')
    .or(`id.eq.${rootId},parent_version_id.eq.${rootId}`)
    .order('version', { ascending: false })

  if (error) throw error
  return (data ?? []) as Recipe[]
}

export async function archiveRecipe(id: string, pin: string, reason: string) {
  const { error } = await supabase.schema('stock').rpc('archive_recipe', { p_recipe_id: id, p_pin: pin, p_reason: reason })
  if (error) throw error
}

type PreparedIngredientRow = {
  article_id: string | null
  quantity: number
  unit_id: string
  unit_price: number
  total_cost: number
  quantity_display: number
  unit_display: string
  quantity_stored: number
  unit_stored: string
  conversion_factor: number
  resolution_status: 'resolved'
  sort_order: number
  quantity_mode: 'brut' | 'net'
  is_net_quantity: boolean
  yield_percent_snapshot: number | null
  line_kind: 'article' | 'subrecipe'
  subrecipe_id: string | null
  trim_form_name_snapshot: string | null
  normalized_price_snapshot: number | null
  price_effective_at_snapshot: string | null
  subrecipe_cost_snapshot: number | null
  economic_snapshot_at: string | null
}

async function replaceRecipeIngredients(recipeId: string, rows: PreparedIngredientRow[]) {
  const { error: deleteError } = await supabase.schema('stock').from('recipe_ingredients').delete().eq('recipe_id', recipeId)
  if (deleteError) throw deleteError

  if (rows.length === 0) return

  const rowsWithRecipe = rows.map((row) => ({ ...row, recipe_id: recipeId }))

  const { error } = await supabase.schema('stock').from('recipe_ingredients').insert(rowsWithRecipe)
  if (error) throw error
}

async function createRecipeVersion(current: Recipe, values: RecipeFormValues) {
  const prepared = await prepareRecipeIngredients(values)
  const totals = calculateTotalsFromIngredientRows(values, prepared.rows)
  const { data, error } = await supabase.schema('stock').rpc('create_recipe_version', {
    p_parent_recipe_id: current.id,
    p_recipe: {
      name: values.name.trim(),
      type: values.type,
      sub_type: cleanNullable(values.sub_type),
      main_ingredient: values.main_ingredient,
      portions: values.portions,
      description: cleanNullable(values.description),
      tags: values.tags,
      total_cost: totals.totalCost,
      cost_per_portion: totals.costPerPortion,
      suggested_price: totals.suggestedPrice,
      cost_ratio: totals.costRatio,
      margin_rate: totals.marginRate,
      margin_coefficient: values.margin_coefficient,
      yield_mode: values.yield_mode,
      yield_quantity: values.yield_quantity ?? null,
      yield_unit_id: values.yield_unit_id || null,
      dressing_photo_alt: cleanNullable(values.dressing_photo_alt),
      dressing_photo_path: null,
      dressing_photo_url: null,
    },
    p_ingredients: prepared.rows,
    p_steps: (values.steps ?? []).map((step, index) => ({
      step_order: index + 1,
      title: cleanNullable(step.title),
      instructions: step.instructions.trim(),
      active_duration_minutes: step.active_duration_minutes ?? null,
      passive_duration_minutes: step.passive_duration_minutes ?? null,
      attention_points: cleanNullable(step.attention_points),
      observation: cleanNullable(step.observation),
    })),
  })
  if (error) throw error
  return data as string
}

async function replaceRecipeSteps(recipeId: string, steps: NonNullable<RecipeFormValues['steps']>, profileId?: string) {
  const { error: deleteError } = await supabase.schema('stock').from('recipe_steps').delete().eq('recipe_id', recipeId)
  if (deleteError) throw deleteError
  if (steps.length === 0) return
  const { error } = await supabase.schema('stock').from('recipe_steps').insert(steps.map((step, index) => ({
    recipe_id: recipeId,
    step_order: index + 1,
    title: cleanNullable(step.title),
    instructions: step.instructions.trim(),
    active_duration_minutes: step.active_duration_minutes ?? null,
    passive_duration_minutes: step.passive_duration_minutes ?? null,
    attention_points: cleanNullable(step.attention_points),
    observation: cleanNullable(step.observation),
    created_by: profileId ?? null,
    updated_by: profileId ?? null,
  })))
  if (error) throw error
}

const RECIPE_ASSETS_BUCKET = 'recipe-assets'

export async function uploadRecipeDressingPhoto(recipeId: string, file: File) {
  if (!file.type.startsWith('image/')) throw new Error('La photo de dressage doit être une image')
  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${recipeId}/dressing-${crypto.randomUUID()}.${extension}`
  const { error: uploadError } = await supabase.storage.from(RECIPE_ASSETS_BUCKET).upload(path, file, { contentType: file.type, upsert: false })
  if (uploadError) throw uploadError
  const { error } = await supabase.schema('stock').from('recipes').update({ dressing_photo_path: path, dressing_photo_url: null }).eq('id', recipeId)
  if (error) {
    await supabase.storage.from(RECIPE_ASSETS_BUCKET).remove([path])
    throw error
  }
  return path
}

export async function removeRecipeDressingPhoto(recipeId: string, currentPath?: string | null) {
  const { error } = await supabase.schema('stock').from('recipes').update({ dressing_photo_path: null, dressing_photo_url: null }).eq('id', recipeId)
  if (error) throw error
  if (currentPath) await supabase.storage.from(RECIPE_ASSETS_BUCKET).remove([currentPath])
}

async function cloneRecipeDressingPhoto(sourcePath: string, targetRecipeId: string) {
  const extension = sourcePath.split('.').pop()?.toLowerCase() || 'jpg'
  const targetPath = `${targetRecipeId}/dressing-${crypto.randomUUID()}.${extension}`
  const { error: copyError } = await supabase.storage.from(RECIPE_ASSETS_BUCKET).copy(sourcePath, targetPath)
  if (copyError) throw copyError

  const { error: updateError } = await supabase.schema('stock').from('recipes')
    .update({ dressing_photo_path: targetPath, dressing_photo_url: null })
    .eq('id', targetRecipeId)
  if (updateError) {
    await supabase.storage.from(RECIPE_ASSETS_BUCKET).remove([targetPath])
    throw updateError
  }
}

export async function getRecipeDressingPhotoUrl(path?: string | null) {
  if (!path) return null
  const { data, error } = await supabase.storage.from(RECIPE_ASSETS_BUCKET).createSignedUrl(path, 60 * 15)
  if (error) throw error
  return data.signedUrl
}

function assertRecipeReady(recipe: Recipe, priceObservations?: Map<string, RecipePriceObservation | null>, provisionalPrices?: Map<string, RecipeProvisionalIngredientPrice | null>) {
  const failed = getRecipeReadiness(recipe, priceObservations, provisionalPrices).filter((check) => !check.ok)
  if (failed.length === 0) return

  const firstFailure = failed[0]
  if (firstFailure.key === 'prices') throw new Error('Tous les ingredients doivent avoir un prix unitaire')
  if (firstFailure.key === 'total_cost') throw new Error('Le cout total ne peut pas etre nul')
  if (firstFailure.key === 'unresolved' || firstFailure.key === 'article_links') throw new Error('Tous les ingredients doivent etre resolus avant validation')
  throw new Error(firstFailure.detail)
}

export async function importRecipesFromWorkbook(parsed: ParsedRecipeWorkbook): Promise<ImportReport> {
  const [articlesResult, unitsResult, aliasesResult, trimFormsResult, recipesResult] = await Promise.all([
    supabase.schema('stock').from('articles').select('id, name, unit_id, units(id, name, abbreviation)').neq('status', 'archived').eq('usable_in_recipes', true),
    supabase.schema('stock').from('units').select('*'),
    supabase.schema('stock').from('recipe_import_aliases').select('normalized_label, article_id').eq('is_active', true),
    supabase.schema('stock').from('recipe_trim_forms').select('id, article_id, name, yield_percent').eq('is_active', true),
    supabase.schema('stock').from('recipes').select('code, name, type'),
  ])
  if (articlesResult.error) throw articlesResult.error
  if (unitsResult.error) throw unitsResult.error
  if (aliasesResult.error) throw aliasesResult.error
  if (trimFormsResult.error) throw trimFormsResult.error
  if (recipesResult.error) throw recipesResult.error

  const articles = (articlesResult.data ?? []) as unknown as ImportArticleMatch[]
  const units = (unitsResult.data ?? []) as Unit[]
  const aliases = (aliasesResult.data ?? []) as ImportAlias[]
  const trimForms = (trimFormsResult.data ?? []) as ImportTrimForm[]
  const existingRecipes = recipesResult.data ?? []
  const report: ImportReport = { recipesImported: 0, recipesFailed: 0, recognized: 0, ambiguous: 0, unknown: 0, pending: 0, duplicates: 0, unknownUnits: 0, missingConversions: 0, trimFormsToReview: 0, errors: [] }

  for (const recipeRow of parsed.recipes) {
    const recipeLabel = recipeRow.importKey
    try {
      if (!recipeTypes.includes(recipeRow.type) || !recipeMainIngredients.includes(recipeRow.mainIngredient)) throw new Error('Type ou matière principale inconnu')
      const invalidTags = recipeRow.tags.filter((tag) => !recipeTags.includes(tag as (typeof recipeTags)[number]))
      if (invalidTags.length) throw new Error(`Tag(s) inconnu(s) : ${invalidTags.join(', ')}`)
      const duplicate = existingRecipes.find((existing) =>
        (recipeRow.code && existing.code && normalizeImportLabel(existing.code) === normalizeImportLabel(recipeRow.code))
        || normalizeImportLabel(existing.name) === normalizeImportLabel(recipeRow.name)
        || (existing.type === recipeRow.type && normalizeImportLabel(existing.name).includes(normalizeImportLabel(recipeRow.name))),
      )
      if (duplicate) {
        report.duplicates += 1
        report.recipesFailed += 1
        report.errors.push(`${recipeLabel} : doublon possible avec ${duplicate.code || duplicate.name}`)
        continue
      }
      const yieldUnit = recipeRow.yieldUnitName ? findImportUnit(recipeRow.yieldUnitName, units) : null
      if (recipeRow.yieldMode === 'rendement_produit' && !yieldUnit) throw new Error(`Unité de rendement inconnue : ${recipeRow.yieldUnitName || 'vide'}`)

      const resolvedRows: Record<string, unknown>[] = []
      const pendingRows: Record<string, unknown>[] = []
      const ingredientRows = parsed.ingredients.filter((row) => normalizeImportLabel(row.recipeCode) === normalizeImportLabel(recipeRow.importKey))
      for (const ingredient of ingredientRows) {
        const normalizedIngredient = normalizeImportLabel(ingredient.importedName)
        const alias = aliases.filter((item) => item.normalized_label === normalizedIngredient)
        const exactArticleName = ingredient.knownArticleName || ingredient.importedName
        const exactMatches = articles.filter((article) => normalizeImportLabel(article.name) === normalizeImportLabel(exactArticleName))
        const aliasArticles = alias.length === 1 ? articles.filter((article) => article.id === alias[0].article_id) : []
        const certainMatches = exactMatches.length === 1 ? exactMatches : aliasArticles.length === 1 ? aliasArticles : []
        const suggestions = certainMatches.length ? certainMatches : findArticleMatches(ingredient.importedName, articles)
        const unit = findImportUnit(ingredient.unitName, units)
        if (!unit) report.unknownUnits += 1

        let pendingReason: 'pending' | 'ambiguous' | null = null
        if (certainMatches.length !== 1) pendingReason = suggestions.length > 0 ? 'ambiguous' : 'pending'
        if (!unit) pendingReason = suggestions.length > 0 ? 'ambiguous' : 'pending'
        let conversion: ReturnType<typeof convertIngredientQuantity> | null = null
        let trimForm: ImportTrimForm | null = null
        if (!pendingReason) {
          const article = certainMatches[0]
          const stockUnit = units.find((item) => item.id === article.unit_id)
          try {
            conversion = convertIngredientQuantity({ quantity: ingredient.quantity, displayUnit: unit, stockUnit })
          } catch {
            report.missingConversions += 1
            pendingReason = 'ambiguous'
          }
          if (ingredient.quantityMode === 'net') {
            trimForm = trimForms.find((item) => item.article_id === article.id && normalizeImportLabel(item.name) === normalizeImportLabel(ingredient.trimFormName ?? '')) ?? null
            if (!trimForm) {
              report.trimFormsToReview += 1
              pendingReason = 'ambiguous'
            }
          }
        }

        if (pendingReason || !conversion || !unit) {
          if (pendingReason === 'ambiguous') report.ambiguous += 1
          else report.unknown += 1
          report.pending += 1
          pendingRows.push({ imported_name: ingredient.importedName, quantity: ingredient.quantity, unit_name: ingredient.unitName, status: pendingReason ?? 'pending', candidate_article_ids: suggestions.map((item) => item.id), quantity_mode: ingredient.quantityMode, trim_form_name: ingredient.trimFormName, imported_indicative_price: ingredient.indicativePrice, import_observation: ingredient.observation })
          continue
        }
        report.recognized += 1
        resolvedRows.push({ article_id: certainMatches[0].id, imported_name: ingredient.importedName, quantity_display: conversion.quantityDisplay, quantity_stored: ingredient.quantityMode === 'net' && trimForm ? calculateRawQuantityFromNet(conversion.quantityStored, trimForm.yield_percent) : conversion.quantityStored, unit_id: unit.id, unit_stored: certainMatches[0].unit_id, unit_name: ingredient.unitName, conversion_factor: conversion.conversionFactor, quantity_mode: ingredient.quantityMode, trim_form_id: trimForm?.id ?? null, yield_percent_snapshot: trimForm?.yield_percent ?? null, sort_order: ingredient.order, imported_indicative_price: ingredient.indicativePrice, import_observation: ingredient.observation })
      }

      const stepRows = parsed.steps.filter((row) => normalizeImportLabel(row.recipeCode) === normalizeImportLabel(recipeRow.importKey)).map((step) => ({ step_order: step.order, title: step.title, instructions: step.description, active_duration_minutes: step.activeDuration, passive_duration_minutes: step.passiveDuration, attention_points: step.attentionPoint, observation: step.observation }))
      const { error } = await supabase.schema('stock').rpc('import_recipe_draft', {
        p_recipe: { code: recipeRow.code, name: recipeRow.name, type: recipeRow.type, main_ingredient: recipeRow.mainIngredient, portions: recipeRow.portions, description: recipeRow.description, import_observation: recipeRow.observation, tags: recipeRow.tags, yield_mode: recipeRow.yieldMode, yield_quantity: recipeRow.yieldQuantity, yield_unit_id: yieldUnit?.id ?? null },
        p_ingredients: resolvedRows,
        p_pending: pendingRows,
        p_steps: stepRows,
      })
      if (error) throw error
      report.recipesImported += 1
    } catch (error) {
      report.recipesFailed += 1
      report.errors.push(`${recipeLabel} : ${getErrorMessage(error)}`)
    }
  }
  return report
}

export async function listPendingIngredients() {
  const { data, error } = await supabase.schema('stock')
    .from('pending_ingredients')
    .select('*, recipes(id, name)')
    .in('status', ['pending', 'ambiguous'])
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as PendingIngredient[]
}

export async function attachPendingIngredient(id: string, articleId: string, options: PendingResolutionOptions = {}) {
  const { data: pending, error: pendingError } = await supabase.schema('stock').from('pending_ingredients').select('*').eq('id', id).single()
  if (pendingError) throw pendingError

  const { data: article, error: articleError } = await supabase.schema('stock').from('articles').select('id, unit_id').eq('id', articleId).single()
  if (articleError) throw articleError
  const unit = await findUnitByNameOrAbbreviation(pending.unit_name)
  const stockUnit = await findUnitById(article.unit_id)
  const conversion = convertIngredientQuantity({
    quantity: Number(pending.quantity),
    displayUnit: unit ?? stockUnit,
    stockUnit,
    manualConversionFactor: options.conversionFactor ?? pending.conversion_factor,
  })

  const trimForm = pending.quantity_mode === 'net'
    ? (await listRecipeTrimForms(articleId)).find((item) => normalizeImportLabel(item.name) === normalizeImportLabel(pending.trim_form_name ?? ''))
    : null
  if (pending.quantity_mode === 'net' && !trimForm) throw new Error('La forme parée NET doit être rapprochée avant de lier cet ingrédient')
  const storedQuantity = pending.quantity_mode === 'net' && trimForm
    ? calculateRawQuantityFromNet(conversion.quantityStored, Number(trimForm.yield_percent))
    : conversion.quantityStored
  if (storedQuantity == null) throw new Error('Le rendement NET ne permet pas de calculer la quantité brute')
  const importedOnlyPrice = pending.imported_indicative_price !== null && pending.imported_indicative_price !== undefined

  const { error: insertError } = await supabase.schema('stock').from('recipe_ingredients').insert({
    recipe_id: pending.recipe_id,
    article_id: articleId,
    quantity: storedQuantity,
    unit_id: unit?.id ?? article.unit_id,
    unit_price: importedOnlyPrice ? null : pending.unit_price,
    total_cost: importedOnlyPrice ? 0 : storedQuantity * pending.unit_price,
    quantity_display: conversion.quantityDisplay,
    unit_display: unit?.id ?? article.unit_id,
    quantity_stored: storedQuantity,
    unit_stored: article.unit_id,
    conversion_factor: conversion.conversionFactor,
    quantity_mode: pending.quantity_mode ?? 'brut',
    is_net_quantity: pending.quantity_mode === 'net',
    trim_form_id: trimForm?.id ?? null,
    yield_percent_snapshot: trimForm ? Number(trimForm.yield_percent) : null,
    imported_indicative_price: pending.imported_indicative_price ?? null,
    import_observation: pending.import_observation ?? null,
    resolution_status: 'resolved',
  })
  if (insertError) throw insertError

  const { error } = await supabase.schema('stock').from('pending_ingredients').update({ status: 'resolved', resolved_article_id: articleId, conversion_factor: conversion.conversionFactor }).eq('id', id)
  if (error) throw error
  if (options.confirmAlias) await confirmRecipeImportAlias(pending.imported_name, articleId, options.profileId)
  await recalculateRecipeCosts(pending.recipe_id)
}

export async function updatePendingIngredientLabel(id: string, importedName: string) {
  const cleaned = importedName.trim()
  if (!cleaned) throw new Error('Le libellé importé ne peut pas être vide')
  const { error } = await supabase.schema('stock').from('pending_ingredients').update({ imported_name: cleaned }).eq('id', id)
  if (error) throw error
}

export async function confirmRecipeImportAlias(sourceLabel: string, articleId: string, profileId?: string) {
  const normalizedLabel = normalizeImportLabel(sourceLabel)
  if (!normalizedLabel) throw new Error('Libellé source obligatoire pour confirmer un alias')
  const { data: existing, error: lookupError } = await supabase.schema('stock').from('recipe_import_aliases').select('id, article_id').eq('normalized_label', normalizedLabel).eq('is_active', true).maybeSingle()
  if (lookupError) throw lookupError
  if (existing && existing.article_id !== articleId) throw new Error('Cet alias actif est déjà rattaché à un autre article')
  if (existing) return existing.id as string
  const { data, error } = await supabase.schema('stock').from('recipe_import_aliases').insert({ source_label: sourceLabel.trim(), normalized_label: normalizedLabel, article_id: articleId, created_by: profileId, updated_by: profileId }).select('id').single()
  if (error) throw error
  return data.id as string
}

async function findUnitByNameOrAbbreviation(unitName: string) {
  const { data, error } = await supabase.schema('stock').from('units').select('*')
  if (error) throw error
  const normalized = normalize(unitName)
  return (data ?? []).find((unit) => normalize(unit.abbreviation) === normalized || normalize(unit.name) === normalized)
}

async function findUnitById(id: string) {
  const { data, error } = await supabase.schema('stock').from('units').select('*').eq('id', id).single()
  if (error) throw error
  return data as Unit
}

async function prepareRecipeIngredients(values: RecipeFormValues) {
  if (values.ingredients.length === 0) return { rows: [] as PreparedIngredientRow[] }

  const articleIds = [...new Set(values.ingredients.filter((ingredient) => (ingredient.line_kind ?? 'article') === 'article').map((ingredient) => ingredient.article_id).filter(Boolean))]
  const { data: articlesData, error: articlesError } = await supabase.schema('stock')
    .from('articles')
    .select('id, name, unit_id, units(id, name, abbreviation)')
    .in('id', articleIds.length > 0 ? articleIds : ['00000000-0000-0000-0000-000000000000'])

  if (articlesError) throw articlesError

  const { data: unitsData, error: unitsError } = await supabase.schema('stock').from('units').select('*')
  if (unitsError) throw unitsError

  const articles = (articlesData ?? []) as unknown as Article[]
  const units = (unitsData ?? []) as Unit[]
  let officialPrices: Record<string, number | null> = {}
  try {
    const prices = await getLastNormalActualPurchasePrices(articleIds)
    officialPrices = Object.fromEntries(prices.map((price) => [price.article_id, price.normalized_unit_price]))
  } catch {
    // Contract Achats not deployed on TEST: save the draft without inventing a price.
    officialPrices = {}
  }

  const rows = await Promise.all(values.ingredients.map(async (ingredient) => {
    const displayUnit = units.find((unit) => unit.id === ingredient.unit_id)
    const lineKind = ingredient.line_kind ?? 'article'

    if (lineKind === 'subrecipe') {
      if (!ingredient.subrecipe_id || !displayUnit) throw new Error('Sous-recette ou unite introuvable')
      return prepareSubrecipeRow(ingredient, displayUnit, units, new Set())
    }

    const article = articles.find((item) => item.id === ingredient.article_id)
    const stockUnit = units.find((unit) => unit.id === article?.unit_id)

    if (!article || !displayUnit || !stockUnit) {
      throw new Error('Article ou unite introuvable pour un ingredient')
    }

    const quantityMode = ingredient.quantity_mode ?? 'brut'
    const rawQuantity = quantityMode === 'net' ? calculateRawQuantityFromNet(ingredient.quantity, Number(ingredient.yield_percent_snapshot ?? 0)) : ingredient.quantity
    if (rawQuantity == null) throw new Error('Rendement net/paré manquant ou invalide pour un ingredient')
    const conversion = convertIngredientQuantity({
      quantity: rawQuantity,
      displayUnit,
      stockUnit,
      manualConversionFactor: ingredient.conversion_factor,
    })

    const normalizedPrice = officialPrices[ingredient.article_id] ?? null
    return {
      article_id: ingredient.article_id,
      quantity: conversion.quantityStored,
      unit_id: ingredient.unit_id,
      unit_price: normalizedPrice ?? 0,
      total_cost: normalizedPrice == null ? 0 : conversion.quantityStored * normalizedPrice,
      quantity_display: conversion.quantityDisplay,
      unit_display: ingredient.unit_id,
      quantity_stored: conversion.quantityStored,
      unit_stored: article.unit_id,
      conversion_factor: conversion.conversionFactor,
      resolution_status: 'resolved' as const,
      sort_order: ingredient.sort_order,
      quantity_mode: quantityMode,
      is_net_quantity: quantityMode === 'net',
      yield_percent_snapshot: quantityMode === 'net' ? Number(ingredient.yield_percent_snapshot) : null,
      line_kind: 'article' as const,
      subrecipe_id: null,
      trim_form_name_snapshot: null,
      normalized_price_snapshot: normalizedPrice,
      price_effective_at_snapshot: null,
      subrecipe_cost_snapshot: null,
      economic_snapshot_at: new Date().toISOString(),
    }
  }))

  return { rows }
}

async function prepareSubrecipeRow(ingredient: RecipeFormValues['ingredients'][number], displayUnit: Unit, units: Unit[], visited: Set<string>): Promise<PreparedIngredientRow> {
  if (!ingredient.subrecipe_id) throw new Error('Sous-recette obligatoire')
  if (visited.has(ingredient.subrecipe_id)) throw new Error('Dépendance circulaire entre fiches techniques')
  const subrecipe = await getRecipe(ingredient.subrecipe_id)
  if (subrecipe.status !== 'validee' || subrecipe.yield_mode !== 'rendement_produit' || !subrecipe.yield_quantity || !subrecipe.yield_unit_id) {
    throw new Error('La sous-recette doit être validée avec un rendement produit et une unité de rendement')
  }
  const childCost = await calculateCurrentRecipeCost(subrecipe.id, new Set([...visited, subrecipe.id]))
  const childUnit = units.find((unit) => unit.id === subrecipe.yield_unit_id)
  if (!childUnit || childCost == null) throw new Error('Coût de sous-recette incomplet')
  const conversion = convertIngredientQuantity({ quantity: ingredient.quantity, displayUnit, stockUnit: childUnit })
  const unitPrice = childCost / Number(subrecipe.yield_quantity)
  return {
    article_id: null,
    quantity: conversion.quantityStored,
    unit_id: ingredient.unit_id,
    unit_price: unitPrice,
    total_cost: conversion.quantityStored * unitPrice,
    quantity_display: conversion.quantityDisplay,
    unit_display: ingredient.unit_id,
    quantity_stored: conversion.quantityStored,
    unit_stored: subrecipe.yield_unit_id,
    conversion_factor: conversion.conversionFactor,
    resolution_status: 'resolved',
    sort_order: ingredient.sort_order,
    quantity_mode: 'brut',
    is_net_quantity: false,
    yield_percent_snapshot: null,
    line_kind: 'subrecipe',
    subrecipe_id: subrecipe.id,
    trim_form_name_snapshot: null,
    normalized_price_snapshot: null,
    price_effective_at_snapshot: null,
    subrecipe_cost_snapshot: childCost,
    economic_snapshot_at: new Date().toISOString(),
  }
}

export async function getCurrentRecipeMaterialCost(recipeId: string): Promise<number | null> {
  return calculateCurrentRecipeCost(recipeId, new Set())
}

async function calculateCurrentRecipeCost(recipeId: string, visited: Set<string>): Promise<number | null> {
  if (visited.has(recipeId)) throw new Error('Dépendance circulaire entre fiches techniques')
  const recipe = await getRecipe(recipeId)
  if (recipe.status !== 'validee') return null
  const ingredients = recipe.recipe_ingredients ?? []
  const articleIds = ingredients.filter((ingredient) => (ingredient.line_kind ?? 'article') === 'article' && ingredient.article_id).map((ingredient) => ingredient.article_id)
  const prices = await getLastNormalActualPurchasePrices(Array.from(new Set(articleIds)))
  let total = 0
  for (const ingredient of ingredients) {
    const quantity = Number(ingredient.quantity_stored ?? ingredient.quantity ?? 0)
    if (ingredient.line_kind === 'subrecipe' && ingredient.subrecipe_id) {
      const childCost = await calculateCurrentRecipeCost(ingredient.subrecipe_id, new Set([...visited, recipeId]))
      const child = await getRecipe(ingredient.subrecipe_id)
      const childUnitCost = childCost == null ? null : childCost / Number(child.yield_quantity ?? 0)
      if (childUnitCost == null || !Number.isFinite(childUnitCost) || childUnitCost <= 0) return null
      total += quantity * childUnitCost
      continue
    }
    const price = prices.find((item) => item.article_id === ingredient.article_id)?.normalized_unit_price ?? null
    if (price == null) return null
    total += quantity * Number(price)
  }
  return total
}

function calculateTotalsFromIngredientRows(
  values: Pick<RecipeFormValues, 'portions' | 'margin_coefficient' | 'final_price'>,
  rows: PreparedIngredientRow[],
) {
  return calculateRecipeTotals({
    ingredients: rows.map((row) => ({
      article_id: row.article_id ?? '',
      quantity: row.quantity_stored,
      unit_id: row.unit_stored,
      unit_price: row.unit_price,
      sort_order: row.sort_order,
    })),
    portions: values.portions,
    margin_coefficient: values.margin_coefficient,
    final_price: values.final_price,
  })
}

export async function attachPendingIngredientGroup(importedName: string, articleId: string, options: PendingResolutionOptions = {}) {
  const { data, error } = await supabase.schema('stock')
    .from('pending_ingredients')
    .select('id')
    .eq('imported_name', importedName)
    .in('status', ['pending', 'ambiguous'])

  if (error) throw error

  for (const item of data ?? []) {
    await attachPendingIngredient(item.id, articleId, options)
  }

  return data?.length ?? 0
}

async function recalculateRecipeCosts(recipeId: string) {
  const { error } = await supabase.schema('stock').rpc('recalculate_recipe_costs', { recipe_uuid: recipeId })
  if (error) throw error
}

function normalize(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function findArticleMatches(importedName: string, articles: ImportArticleMatch[]) {
  const needle = normalize(importedName)
  const exact = articles.filter((article) => normalize(article.name) === needle)
  if (exact.length > 0) return exact
  return articles.filter((article) => normalize(article.name).includes(needle) || needle.includes(normalize(article.name)))
}

function findImportUnit(importedName: string, units: Unit[]) {
  const needle = normalizeImportLabel(importedName)
  return units.find((unit) => normalizeImportLabel(unit.abbreviation) === needle || normalizeImportLabel(unit.name) === needle) ?? null
}

