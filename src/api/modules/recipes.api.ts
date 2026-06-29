import { supabase } from '../../lib/supabase'
import type { Article, Unit } from '../../lib/catalog'
import type {
  ImportReport,
  PendingIngredient,
  Recipe,
  RecipeFormValues,
  RecipeMainIngredient,
  RecipeStatus,
  RecipeType,
} from '../../lib/recipes'
import { calculateRecipeTotals, getRecipeReadiness } from '../../lib/recipes'
import { convertIngredientQuantity } from '../../lib/unitConversions'
import { getErrorMessage } from '../../lib/errors'

type RecipeFilters = {
  search?: string
  type?: RecipeType | 'all'
  mainIngredient?: RecipeMainIngredient | 'all'
  status?: RecipeStatus | 'all'
  page?: number
  pageSize?: number
}

type ParsedImportRow = {
  Nom: string
  Type: RecipeType
  'Matière principale': RecipeMainIngredient
  Portions: number
  Ingredients: string
  Ingrédients?: string
}

type ImportArticleMatch = Pick<Article, 'id' | 'name'> & { unit_id?: string | null }

type ParsedIngredientLine = {
  name: string
  quantity: number
  unit: string
  unit_price: number
}

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

export async function getRecipe(id: string) {
  const fullSelect =
    '*, validator:profiles!recipes_validated_by_fkey(id, full_name), recipe_ingredients(*, articles(id, name, unit_id, units(id, name, abbreviation)), units:units!recipe_ingredients_unit_id_fkey(id, name, abbreviation), display_unit:units!recipe_ingredients_unit_display_fkey(id, name, abbreviation), stored_unit:units!recipe_ingredients_unit_stored_fkey(id, name, abbreviation)), pending_ingredients(*)'
  const legacySelect =
    '*, validator:profiles!recipes_validated_by_fkey(id, full_name), recipe_ingredients(*, articles(id, name, unit_id, units(id, name, abbreviation)), units:units!recipe_ingredients_unit_id_fkey(id, name, abbreviation)), pending_ingredients(*)'

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
    return legacyData as Recipe
  }

  if (error) throw new Error(getErrorMessage(error, 'Fiche technique introuvable'))
  return data as Recipe
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
    message.includes('schema cache')
  )
}

export async function createRecipe(values: RecipeFormValues, profileId?: string) {
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
      final_price: values.final_price,
      cost_ratio: totals.costRatio,
      margin_rate: totals.marginRate,
      margin_coefficient: values.margin_coefficient,
      status: values.status,
      created_by: profileId,
      updated_by: profileId,
    })
    .select('id')
    .single()

  if (error) throw error
  await replaceRecipeIngredients(data.id, prepared.rows)
  return data.id as string
}

export async function updateRecipe(id: string, values: RecipeFormValues, profileId?: string) {
  const current = await getRecipe(id)
  if (current.status === 'validee') {
    return createRecipeVersion(current, values, profileId)
  }

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
      status: values.status,
      updated_by: profileId,
    })
    .eq('id', id)

  if (error) throw error
  await replaceRecipeIngredients(id, prepared.rows)
  return id
}

export async function submitRecipeForValidation(id: string) {
  const recipe = await getRecipe(id)
  assertRecipeReady(recipe)

  const { error } = await supabase.schema('stock').from('recipes').update({ status: 'en_attente' }).eq('id', id)
  if (error) throw error
}

export async function validateRecipe(id: string, profileId?: string) {
  const recipe = await getRecipe(id)
  assertRecipeReady(recipe)
  if (recipe.status !== 'en_attente') {
    throw new Error('La fiche doit etre soumise a validation avant approbation')
  }

  const { error } = await supabase.schema('stock')
    .from('recipes')
    .update({ status: 'validee', validated_by: profileId, validated_at: new Date().toISOString() })
    .eq('id', id)

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

export async function setRecipeArchived(id: string, archived: boolean) {
  const { error } = await supabase.schema('stock')
    .from('recipes')
    .update({ status: archived ? 'archived' : 'brouillon', archived_at: archived ? new Date().toISOString() : null })
    .eq('id', id)

  if (error) throw error
}

type PreparedIngredientRow = {
  article_id: string
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
}

async function replaceRecipeIngredients(recipeId: string, rows: PreparedIngredientRow[]) {
  const { error: deleteError } = await supabase.schema('stock').from('recipe_ingredients').delete().eq('recipe_id', recipeId)
  if (deleteError) throw deleteError

  if (rows.length === 0) return

  const rowsWithRecipe = rows.map((row) => ({ ...row, recipe_id: recipeId }))

  const { error } = await supabase.schema('stock').from('recipe_ingredients').insert(rowsWithRecipe)
  if (error) throw error
}

async function createRecipeVersion(current: Recipe, values: RecipeFormValues, profileId?: string) {
  const rootVersionId = current.parent_version_id ?? current.id
  const { data: versions, error: versionsError } = await supabase.schema('stock')
    .from('recipes')
    .select('version')
    .or(`id.eq.${rootVersionId},parent_version_id.eq.${rootVersionId}`)

  if (versionsError) throw versionsError

  const nextVersion = Math.max(...(versions ?? []).map((version) => Number(version.version)), Number(current.version)) + 1
  const prepared = await prepareRecipeIngredients(values)
  const totals = calculateTotalsFromIngredientRows(values, prepared.rows)
  const { data, error } = await supabase.schema('stock')
    .from('recipes')
    .insert({
      code: null,
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
      status: 'brouillon',
      version: nextVersion,
      parent_version_id: rootVersionId,
      created_by: profileId,
      updated_by: profileId,
    })
    .select('id')
    .single()

  if (error) throw error
  await replaceRecipeIngredients(data.id, prepared.rows)
  return data.id as string
}

function assertRecipeReady(recipe: Recipe) {
  const failed = getRecipeReadiness(recipe).filter((check) => !check.ok)
  if (failed.length === 0) return

  const firstFailure = failed[0]
  if (firstFailure.key === 'prices') throw new Error('Tous les ingredients doivent avoir un prix unitaire')
  if (firstFailure.key === 'total_cost') throw new Error('Le cout total ne peut pas etre nul')
  if (firstFailure.key === 'final_price') throw new Error('Veuillez renseigner un prix de vente final')
  if (firstFailure.key === 'unresolved' || firstFailure.key === 'article_links') throw new Error('Tous les ingredients doivent etre resolus avant validation')
  throw new Error(firstFailure.detail)
}

export async function importRecipesFromRows(rows: ParsedImportRow[], profileId?: string): Promise<ImportReport> {
  const { data: articlesData, error: articlesError } = await supabase.schema('stock')
    .from('articles')
    .select('id, name, unit_id, units(id, name, abbreviation)')
    .neq('status', 'archived')

  if (articlesError) throw articlesError
  const articles = (articlesData ?? []) as unknown as ImportArticleMatch[]

  const { data: unitsData, error: unitsError } = await supabase.schema('stock').from('units').select('*')
  if (unitsError) throw unitsError

  const units = unitsData ?? []
  const report: ImportReport = { recipesImported: 0, recipesFailed: 0, recognized: 0, ambiguous: 0, unknown: 0, pending: 0 }

  for (const row of rows) {
    try {
      const ingredientsText = row.Ingredients || row['Ingrédients'] || ''
      const parsedIngredients = ingredientsText
        .split('|')
        .map((item) => parseIngredientLine(item))
        .filter((ingredient): ingredient is ParsedIngredientLine => Boolean(ingredient))
      const { data: recipe, error: recipeError } = await supabase.schema('stock')
        .from('recipes')
        .insert({
          name: row.Nom,
          type: row.Type,
          main_ingredient: row['Matière principale'],
          portions: Number(row.Portions) || 1,
          total_cost: 0,
          cost_per_portion: 0,
          suggested_price: 0,
          margin_coefficient: 3,
          status: 'brouillon',
          created_by: profileId,
          updated_by: profileId,
        })
        .select('id')
        .single()

      if (recipeError) throw recipeError

      for (let index = 0; index < parsedIngredients.length; index += 1) {
        const ingredient = parsedIngredients[index]
        const matches = findArticleMatches(ingredient.name, articles)
        const unit = units.find((item) => item.abbreviation?.toLowerCase() === ingredient.unit.toLowerCase() || item.name?.toLowerCase() === ingredient.unit.toLowerCase())

        if (matches.length === 1 && unit) {
          try {
            const article = matches[0]
            const stockUnit = units.find((item) => item.id === article.unit_id)
            const conversion = convertIngredientQuantity({ quantity: ingredient.quantity, displayUnit: unit, stockUnit })
            report.recognized += 1
            await supabase.schema('stock').from('recipe_ingredients').insert({
              recipe_id: recipe.id,
              article_id: article.id,
              quantity: conversion.quantityStored,
              unit_id: unit.id,
              unit_price: ingredient.unit_price,
              total_cost: conversion.quantityStored * ingredient.unit_price,
              quantity_display: conversion.quantityDisplay,
              unit_display: unit.id,
              quantity_stored: conversion.quantityStored,
              unit_stored: article.unit_id,
              conversion_factor: conversion.conversionFactor,
              resolution_status: 'resolved',
              sort_order: index,
            })
          } catch {
            report.ambiguous += 1
            report.pending += 1
            await supabase.schema('stock').from('pending_ingredients').insert({
              recipe_id: recipe.id,
              imported_name: ingredient.name,
              quantity: ingredient.quantity,
              unit_name: ingredient.unit,
              unit_price: ingredient.unit_price,
              status: 'ambiguous',
              candidate_article_ids: [matches[0].id],
              created_by: profileId,
            })
          }
        } else {
          const status = matches.length > 1 ? 'ambiguous' : 'pending'
          if (status === 'ambiguous') report.ambiguous += 1
          else report.unknown += 1
          report.pending += 1

          await supabase.schema('stock').from('pending_ingredients').insert({
            recipe_id: recipe.id,
            imported_name: ingredient.name,
            quantity: ingredient.quantity,
            unit_name: ingredient.unit,
            unit_price: ingredient.unit_price,
            status,
            candidate_article_ids: matches.map((match) => match.id),
            created_by: profileId,
          })
        }
      }

      report.recipesImported += 1
    } catch {
      report.recipesFailed += 1
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

export async function attachPendingIngredient(id: string, articleId: string) {
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
  })

  const { error: insertError } = await supabase.schema('stock').from('recipe_ingredients').insert({
    recipe_id: pending.recipe_id,
    article_id: articleId,
    quantity: conversion.quantityStored,
    unit_id: unit?.id ?? article.unit_id,
    unit_price: pending.unit_price,
    total_cost: conversion.quantityStored * pending.unit_price,
    quantity_display: conversion.quantityDisplay,
    unit_display: unit?.id ?? article.unit_id,
    quantity_stored: conversion.quantityStored,
    unit_stored: article.unit_id,
    conversion_factor: conversion.conversionFactor,
    resolution_status: 'resolved',
  })
  if (insertError) throw insertError

  const { error } = await supabase.schema('stock').from('pending_ingredients').update({ status: 'resolved', resolved_article_id: articleId }).eq('id', id)
  if (error) throw error
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

  const articleIds = [...new Set(values.ingredients.map((ingredient) => ingredient.article_id))]
  const { data: articlesData, error: articlesError } = await supabase.schema('stock')
    .from('articles')
    .select('id, name, unit_id, units(id, name, abbreviation)')
    .in('id', articleIds)

  if (articlesError) throw articlesError

  const { data: unitsData, error: unitsError } = await supabase.schema('stock').from('units').select('*')
  if (unitsError) throw unitsError

  const articles = (articlesData ?? []) as unknown as Article[]
  const units = (unitsData ?? []) as Unit[]

  const rows = values.ingredients.map((ingredient) => {
    const article = articles.find((item) => item.id === ingredient.article_id)
    const displayUnit = units.find((unit) => unit.id === ingredient.unit_id)
    const stockUnit = units.find((unit) => unit.id === article?.unit_id)

    if (!article || !displayUnit || !stockUnit) {
      throw new Error('Article ou unite introuvable pour un ingredient')
    }

    const conversion = convertIngredientQuantity({
      quantity: ingredient.quantity,
      displayUnit,
      stockUnit,
    })

    return {
      article_id: ingredient.article_id,
      quantity: conversion.quantityStored,
      unit_id: ingredient.unit_id,
      unit_price: ingredient.unit_price,
      total_cost: conversion.quantityStored * ingredient.unit_price,
      quantity_display: conversion.quantityDisplay,
      unit_display: ingredient.unit_id,
      quantity_stored: conversion.quantityStored,
      unit_stored: article.unit_id,
      conversion_factor: conversion.conversionFactor,
      resolution_status: 'resolved' as const,
      sort_order: ingredient.sort_order,
    }
  })

  return { rows }
}

function calculateTotalsFromIngredientRows(
  values: Pick<RecipeFormValues, 'portions' | 'margin_coefficient' | 'final_price'>,
  rows: PreparedIngredientRow[],
) {
  return calculateRecipeTotals({
    ingredients: rows.map((row) => ({
      article_id: row.article_id,
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

export async function attachPendingIngredientGroup(importedName: string, articleId: string) {
  const { data, error } = await supabase.schema('stock')
    .from('pending_ingredients')
    .select('id')
    .eq('imported_name', importedName)
    .in('status', ['pending', 'ambiguous'])

  if (error) throw error

  for (const item of data ?? []) {
    await attachPendingIngredient(item.id, articleId)
  }

  return data?.length ?? 0
}

function parseIngredientLine(line: string): ParsedIngredientLine | null {
  const [name, quantity, unit, unitPrice] = line.split(';').map((item) => item?.trim())
  if (!name || !quantity || !unit || !unitPrice) return null
  return { name, quantity: Number(quantity), unit, unit_price: Number(unitPrice) }
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
