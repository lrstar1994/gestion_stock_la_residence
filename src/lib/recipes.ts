import { z } from 'zod'
import type { Article, Unit } from './catalog'
import type { Profile, UserRole } from './validation'

export const recipeTypes = ['EF', 'EC', 'PL', 'ACC', 'DS', 'PC-S', 'PC-SU', 'CO-S', 'CO-SU', 'SAU', 'PREP', 'BOI', 'BF'] as const
export const recipeMainIngredients = ['POU', 'ZEB', 'POR', 'POI', 'CRV', 'OEU', 'LEG', 'FEC', 'FRO', 'FRU', 'CHO', 'VAN', 'MIX'] as const
export const recipeStatuses = ['brouillon', 'simulation', 'en_attente', 'validee', 'archived'] as const
export const recipeTags = ['economique', 'festif', 'malagasy', 'enfant', 'vegetarien', 'tres_apprecie', 'ameliorer'] as const
export const pendingIngredientStatuses = ['pending', 'resolved', 'ambiguous', 'new_created'] as const

export type RecipeType = (typeof recipeTypes)[number]
export type RecipeMainIngredient = (typeof recipeMainIngredients)[number]
export type RecipeStatus = (typeof recipeStatuses)[number]
export type RecipeTag = (typeof recipeTags)[number]
export type PendingIngredientStatus = (typeof pendingIngredientStatuses)[number]

export const recipeTypeLabels: Record<RecipeType, string> = {
  EF: 'Entree froide',
  EC: 'Entree chaude',
  PL: 'Plat',
  ACC: 'Accompagnement',
  DS: 'Dessert',
  'PC-S': 'Piece salee pause-cafe',
  'PC-SU': 'Piece sucree pause-cafe',
  'CO-S': 'Piece salee cocktail',
  'CO-SU': 'Piece sucree cocktail',
  SAU: 'Sauce / condiment',
  PREP: 'Preparation intermediaire',
  BOI: 'Boisson',
  BF: 'Composition buffet',
}

export const mainIngredientLabels: Record<RecipeMainIngredient, string> = {
  POU: 'Poulet',
  ZEB: 'Zebu / boeuf',
  POR: 'Porc',
  POI: 'Poisson',
  CRV: 'Crevettes / fruits de mer',
  OEU: 'Oeufs',
  LEG: 'Legumes',
  FEC: 'Feculents',
  FRO: 'Fromage',
  FRU: 'Fruits',
  CHO: 'Chocolat',
  VAN: 'Vanille',
  MIX: 'Mixte',
}

export const recipeStatusLabels: Record<RecipeStatus, string> = {
  brouillon: 'Brouillon',
  simulation: 'Simulation',
  en_attente: 'En attente',
  validee: 'Validee',
  archived: 'Archivee',
}

export const recipeTagLabels: Record<RecipeTag, string> = {
  economique: 'Economique',
  festif: 'Festif',
  malagasy: 'Malagasy',
  enfant: 'Enfant',
  vegetarien: 'Vegetarien',
  tres_apprecie: 'Tres apprecie',
  ameliorer: 'A ameliorer',
}

export type Recipe = {
  id: string
  code: string | null
  name: string
  type: RecipeType
  sub_type: string | null
  main_ingredient: RecipeMainIngredient
  portions: number
  description: string | null
  tags: RecipeTag[]
  total_cost: number
  cost_per_portion: number
  suggested_price: number
  final_price: number
  cost_ratio: number
  margin_rate: number
  margin_coefficient: number
  status: RecipeStatus
  version: number
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  validated_by: string | null
  validated_at: string | null
  archived_at: string | null
  parent_version_id: string | null
  recipe_ingredients?: RecipeIngredient[]
  pending_ingredients?: PendingIngredient[]
  validator?: Pick<Profile, 'id' | 'full_name'>
}

export type RecipeReadinessCheck = {
  key: string
  label: string
  ok: boolean
  detail: string
}

export type RecipeIngredient = {
  id?: string
  recipe_id?: string
  article_id: string
  imported_name?: string | null
  quantity: number
  unit_id: string
  unit_name?: string | null
  unit_price: number
  total_cost: number
  quantity_display: number | null
  unit_display: string | null
  quantity_stored: number | null
  unit_stored: string | null
  conversion_factor: number | null
  resolution_status: PendingIngredientStatus
  sort_order: number
  articles?: Pick<Article, 'id' | 'name' | 'unit_id'> & { units?: Pick<Unit, 'id' | 'name' | 'abbreviation'> }
  units?: Pick<Unit, 'id' | 'name' | 'abbreviation'>
  display_unit?: Pick<Unit, 'id' | 'name' | 'abbreviation'>
  stored_unit?: Pick<Unit, 'id' | 'name' | 'abbreviation'>
}

export type PendingIngredient = {
  id: string
  recipe_id: string
  imported_name: string
  quantity: number
  unit_name: string
  unit_price: number
  status: PendingIngredientStatus
  resolved_article_id: string | null
  candidate_article_ids: string[]
  created_by: string | null
  created_at: string
  updated_at: string
  recipes?: Pick<Recipe, 'id' | 'name'>
}

export type ImportReport = {
  recipesImported: number
  recipesFailed: number
  recognized: number
  ambiguous: number
  unknown: number
  pending: number
}

export const recipeIngredientSchema = z.object({
  article_id: z.string().min(1, 'Article obligatoire'),
  quantity: z.number().positive('Quantite obligatoire'),
  unit_id: z.string().min(1, 'Unite obligatoire'),
  unit_price: z.number().positive('Le prix unitaire doit etre superieur a 0'),
  sort_order: z.number(),
})

export const recipeSchema = z.object({
  name: z.string().min(1, 'Le nom est obligatoire'),
  type: z.enum(recipeTypes),
  sub_type: z.string().optional(),
  main_ingredient: z.enum(recipeMainIngredients),
  portions: z.number().int().positive(),
  description: z.string().optional(),
  tags: z.array(z.enum(recipeTags)),
  margin_coefficient: z.number().positive(),
  final_price: z.number().min(0),
  status: z.enum(recipeStatuses),
  ingredients: z.array(recipeIngredientSchema),
})

export type RecipeFormValues = z.infer<typeof recipeSchema>
export type RecipeIngredientFormValues = z.infer<typeof recipeIngredientSchema>

export function canEditRecipes(role?: UserRole) {
  return role === 'direction' || role === 'chef_cuisine' || role === 'fiche_technique'
}

export function canValidateRecipes(role?: UserRole) {
  return role === 'direction'
}

export function calculateRecipeTotals(values: Pick<RecipeFormValues, 'ingredients' | 'portions' | 'margin_coefficient' | 'final_price'>) {
  const totalCost = values.ingredients.reduce((sum, ingredient) => sum + ingredient.quantity * ingredient.unit_price, 0)
  const costPerPortion = values.portions > 0 ? totalCost / values.portions : 0
  const suggestedPrice = totalCost * values.margin_coefficient
  const costRatio = values.final_price > 0 ? (totalCost / values.final_price) * 100 : 0
  const marginRate = values.final_price > 0 ? ((values.final_price - totalCost) / values.final_price) * 100 : 0

  return { totalCost, costPerPortion, suggestedPrice, costRatio, marginRate }
}

export function getRecipeReadiness(recipe: Recipe): RecipeReadinessCheck[] {
  const ingredients = recipe.recipe_ingredients ?? []
  const unresolved = recipe.pending_ingredients?.filter((ingredient) => ingredient.status === 'pending' || ingredient.status === 'ambiguous') ?? []
  const missingPrices = ingredients.filter((ingredient) => Number(ingredient.unit_price) <= 0)
  const missingArticleLinks = ingredients.filter((ingredient) => !ingredient.article_id)

  return [
    {
      key: 'unresolved',
      label: 'Ingredients resolus',
      ok: unresolved.length === 0,
      detail: unresolved.length === 0 ? 'Aucun ingredient en attente.' : `${unresolved.length} ingredient(s) a traiter.`,
    },
    {
      key: 'ingredients',
      label: 'Ingredients presents',
      ok: ingredients.length > 0,
      detail: ingredients.length > 0 ? `${ingredients.length} ingredient(s) renseignes.` : 'Ajoutez au moins un ingredient.',
    },
    {
      key: 'article_links',
      label: 'Articles lies',
      ok: missingArticleLinks.length === 0,
      detail: missingArticleLinks.length === 0 ? 'Tous les ingredients sont lies a un article.' : `${missingArticleLinks.length} ingredient(s) sans article.`,
    },
    {
      key: 'prices',
      label: 'Prix unitaires',
      ok: missingPrices.length === 0,
      detail: missingPrices.length === 0 ? 'Tous les prix unitaires sont renseignes.' : `${missingPrices.length} prix unitaire(s) manquants ou a zero.`,
    },
    {
      key: 'total_cost',
      label: 'Cout total',
      ok: Number(recipe.total_cost) > 0,
      detail: Number(recipe.total_cost) > 0 ? `${Number(recipe.total_cost).toLocaleString('fr-FR')} Ar HT.` : 'Le cout total ne peut pas etre nul.',
    },
    {
      key: 'final_price',
      label: 'Prix de vente final',
      ok: Number(recipe.final_price) > 0,
      detail: Number(recipe.final_price) > 0 ? `${Number(recipe.final_price).toLocaleString('fr-FR')} Ar HT.` : 'Veuillez renseigner un prix de vente final.',
    },
  ]
}

export function isRecipeReadyForValidation(recipe: Recipe) {
  return getRecipeReadiness(recipe).every((check) => check.ok)
}
