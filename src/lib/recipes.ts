import { z } from 'zod'
import type { Article, Unit } from './catalog'
import type { Profile, UserRole } from './validation'

export const recipeTypes = ['EF', 'EC', 'PL', 'ACC', 'DS', 'PC-S', 'PC-SU', 'CO-S', 'CO-SU', 'SAU', 'PREP', 'BOI', 'BF'] as const
export const creatableRecipeTypes = recipeTypes.filter((type) => type !== 'BF') as Exclude<RecipeType, 'BF'>[]
export const recipeMainIngredients = ['POU', 'ZEB', 'POR', 'POI', 'CRV', 'OEU', 'LEG', 'FEC', 'FRO', 'FRU', 'CHO', 'VAN', 'MIX'] as const
export const recipeStatuses = ['brouillon', 'simulation', 'en_attente', 'validee', 'archived'] as const
export const recipeYieldModes = ['portions', 'rendement_produit'] as const
export const ingredientQuantityModes = ['brut', 'net'] as const
export const recipeTags = ['economique', 'festif', 'malagasy', 'enfant', 'vegetarien', 'tres_apprecie', 'ameliorer'] as const
export const pendingIngredientStatuses = ['pending', 'resolved', 'ambiguous', 'new_created'] as const

export type RecipeType = (typeof recipeTypes)[number]
export type RecipeMainIngredient = (typeof recipeMainIngredients)[number]
export type RecipeStatus = (typeof recipeStatuses)[number]
export type RecipeYieldMode = (typeof recipeYieldModes)[number]
export type IngredientQuantityMode = (typeof ingredientQuantityModes)[number]
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
  yield_mode?: RecipeYieldMode
  yield_quantity?: number | null
  yield_unit_id?: string | null
  material_cost_ht?: number
  theoretical_sale_price_ttc?: number
  retained_sale_price_ttc?: number | null
  retained_sale_price_reason?: string | null
  workflow_status?: string | null
  cost_status?: 'PROVISOIRE' | 'CONFIRME' | 'A_REVOIR' | null
  cost_review_task_opened_at?: string | null
  chef_validated_by?: string | null
  chef_validated_at?: string | null
  direction_validated_by?: string | null
  direction_validated_at?: string | null
  validation_comment?: string | null
  submitted_by?: string | null
  submitted_at?: string | null
  correction_requested_by?: string | null
  correction_requested_at?: string | null
  correction_reason?: string | null
  validated_material_cost?: number | null
  validated_cost_per_yield?: number | null
  validated_theoretical_sale_price_ttc?: number | null
  validated_retained_sale_price_ttc?: number | null
  validated_snapshot_at?: string | null
  dressing_photo_url?: string | null
  dressing_photo_path?: string | null
  dressing_photo_alt?: string | null
  recipe_ingredients?: RecipeIngredient[]
  recipe_steps?: RecipeStep[]
  pending_ingredients?: PendingIngredient[]
  validator?: Pick<Profile, 'id' | 'full_name'>
  submitter?: Pick<Profile, 'id' | 'full_name'>
  chef_validator?: Pick<Profile, 'id' | 'full_name'>
  direction_validator?: Pick<Profile, 'id' | 'full_name'>
  correction_requester?: Pick<Profile, 'id' | 'full_name'>
  recipe_validation_history?: RecipeValidationHistory[]
  provisional_prices?: RecipeProvisionalIngredientPrice[]
}

export type RecipeValidationHistory = {
  id: string
  action: string
  comment: string | null
  created_at: string
  metadata?: Record<string, unknown>
  actor?: Pick<Profile, 'id' | 'full_name'> | null
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
  is_net_quantity?: boolean
  quantity_mode?: IngredientQuantityMode
  trim_form_id?: string | null
  yield_percent_snapshot?: number | null
  normalized_unit_price?: number | null
  price_source_type?: string | null
  price_source_id?: string | null
  price_effective_at?: string | null
  subrecipe_id?: string | null
  line_kind?: 'article' | 'subrecipe'
  trim_form_name_snapshot?: string | null
  normalized_price_snapshot?: number | null
  price_effective_at_snapshot?: string | null
  subrecipe_cost_snapshot?: number | null
  economic_snapshot_at?: string | null
  imported_indicative_price?: number | null
  import_observation?: string | null
  resolution_status: PendingIngredientStatus
  sort_order: number
  articles?: Pick<Article, 'id' | 'name' | 'unit_id' | 'locations_restricted' | 'article_locations'> & { units?: Pick<Unit, 'id' | 'name' | 'abbreviation'> }
  units?: Pick<Unit, 'id' | 'name' | 'abbreviation'>
  display_unit?: Pick<Unit, 'id' | 'name' | 'abbreviation'>
  stored_unit?: Pick<Unit, 'id' | 'name' | 'abbreviation'>
  trim_form?: { id: string; name: string; yield_percent: number }
  provisional_prices?: RecipeProvisionalIngredientPrice[]
}

export type RecipeProvisionalIngredientPrice = {
  id: string
  recipe_id: string
  copied_from_recipe_id?: string | null
  copied_from_price_id?: string | null
  article_id: string
  amount_ttc: number
  unit_id: string
  normalized_amount_ttc?: number | null
  normalized_unit_id?: string | null
  conversion_factor_to_stock?: number | null
  observed_at: string
  entered_by: string
  source?: string | null
  observation?: string | null
  created_at: string
}

export type RecipeStep = {
  id?: string
  recipe_id?: string
  step_order: number
  title?: string | null
  instructions: string
  active_duration_minutes?: number | null
  passive_duration_minutes?: number | null
  attention_points?: string | null
  observation?: string | null
  created_by?: string | null
  updated_by?: string | null
  created_at?: string
  updated_at?: string
}

export type PendingIngredient = {
  id: string
  recipe_id: string
  imported_name: string
  quantity: number
  unit_name: string
  unit_price: number
  quantity_mode?: IngredientQuantityMode | null
  trim_form_name?: string | null
  imported_indicative_price?: number | null
  import_observation?: string | null
  conversion_factor?: number | null
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
  duplicates: number
  unknownUnits: number
  missingConversions: number
  trimFormsToReview: number
  errors: string[]
}

export const recipeIngredientSchema = z.object({
  article_id: z.string().min(1, 'Article obligatoire'),
  quantity: z.number().positive('Quantite obligatoire'),
  unit_id: z.string().min(1, 'Unite obligatoire'),
  // 0 is the draft sentinel when no qualified NORMAL purchase price exists.
  // Readiness, not draft persistence, blocks submission in that situation.
  unit_price: z.number().min(0, 'Le prix unitaire doit etre positif ou nul'),
  conversion_factor: z.number().positive('Le facteur manuel doit etre superieur a 0').optional().nullable(),
  sort_order: z.number(),
  quantity_mode: z.enum(ingredientQuantityModes).optional(),
  trim_form_id: z.string().optional(),
  yield_percent_snapshot: z.number().positive().max(100).optional(),
  line_kind: z.enum(['article', 'subrecipe']).optional(),
  subrecipe_id: z.string().optional(),
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
  yield_mode: z.enum(recipeYieldModes).optional(),
  yield_quantity: z.number().positive().optional(),
  yield_unit_id: z.string().optional(),
  retained_sale_price_ttc: z.number().min(0).optional(),
  retained_sale_price_reason: z.string().optional(),
  dressing_photo_alt: z.string().optional(),
  steps: z.array(z.object({
    step_order: z.number().int().positive(),
    title: z.string().optional(),
    instructions: z.string(),
    active_duration_minutes: z.number().min(0).optional(),
    passive_duration_minutes: z.number().min(0).optional(),
    attention_points: z.string().optional(),
    observation: z.string().optional(),
  })).optional(),
})

export type RecipeFormValues = z.infer<typeof recipeSchema>
export type RecipeIngredientFormValues = z.infer<typeof recipeIngredientSchema>

export function canEditRecipes(role?: UserRole) {
  return role === 'direction' || role === 'chef_cuisine' || role === 'fiche_technique'
}

export function canValidateRecipes(role?: UserRole) {
  return role === 'direction'
}

export function canChefReviewRecipes(role?: UserRole) {
  return role === 'chef_cuisine'
}

export function getRecipeWorkflowLabel(recipe: Pick<Recipe, 'status' | 'workflow_status' | 'direction_validated_at'>) {
  if (recipe.direction_validated_at || recipe.status === 'validee' || recipe.workflow_status === 'approved') return 'Validée par Direction'
  if (recipe.workflow_status === 'submitted') return 'À valider par Chef'
  if (recipe.workflow_status === 'chef_validated') return 'À valider par Direction'
  if (recipe.workflow_status === 'needs_correction') return 'À corriger'
  return recipeStatusLabels[recipe.status]
}

export function getRecipeCostStatusLabel(costStatus?: Recipe['cost_status']) {
  if (costStatus === 'PROVISOIRE') return 'PROVISOIRE'
  if (costStatus === 'CONFIRME') return 'CONFIRMÉ'
  if (costStatus === 'A_REVOIR') return 'À REVOIR'
  return 'Non défini'
}

export function calculateRecipeTotals(values: Pick<RecipeFormValues, 'ingredients' | 'portions' | 'margin_coefficient' | 'final_price'>) {
  const totalCost = values.ingredients.reduce((sum, ingredient) => sum + ingredient.quantity * ingredient.unit_price, 0)
  const costPerPortion = values.portions > 0 ? totalCost / values.portions : 0
  const suggestedPrice = totalCost * values.margin_coefficient
  const costRatio = values.final_price > 0 ? (totalCost / values.final_price) * 100 : 0
  const marginRate = values.final_price > 0 ? ((values.final_price - totalCost) / values.final_price) * 100 : 0

  return { totalCost, costPerPortion, suggestedPrice, costRatio, marginRate }
}

export type RecipePriceObservation = {
  article_id: string
  classification: 'normal'
  normalized_unit_price: number | null
  actual_unit_price_source: number
  source_unit_id: string | null
  effective_date: string
  supplier_id: string | null
  source_type: string
  source_id: string
}

export function calculateRecipeTheoreticalSalePriceTtc(totalMaterialCost: number, yieldMode: RecipeYieldMode, peopleOrPortions: number) {
  if (yieldMode === 'rendement_produit') return null
  return totalMaterialCost * 4 + 2000 * Math.max(0, peopleOrPortions)
}

export function calculateRecipeTheoreticalSalePriceTtcPerPerson(totalMaterialCost: number, yieldMode: RecipeYieldMode, peopleOrPortions: number) {
  const total = calculateRecipeTheoreticalSalePriceTtc(totalMaterialCost, yieldMode, peopleOrPortions)
  return total == null || peopleOrPortions <= 0 ? null : total / peopleOrPortions
}

export function calculateRecipeCostPerYield(totalMaterialCost: number, yieldQuantity: number) {
  return yieldQuantity > 0 ? totalMaterialCost / yieldQuantity : null
}

export type RecipeOperationalEconomics = {
  calculable: boolean
  totalMaterialCostTtc: number | null
  costPerPortion: number | null
  theoreticalSalePriceTtcTotal: number | null
  theoreticalSalePriceTtcPerPerson: number | null
  costPerYield: number | null
}

export function calculateRecipeOperationalEconomics(
  materialCostTtc: number | null,
  yieldMode: RecipeYieldMode,
  portions: number,
  yieldQuantity: number,
): RecipeOperationalEconomics {
  if (materialCostTtc == null || !Number.isFinite(materialCostTtc)) {
    return {
      calculable: false,
      totalMaterialCostTtc: null,
      costPerPortion: null,
      theoreticalSalePriceTtcTotal: null,
      theoreticalSalePriceTtcPerPerson: null,
      costPerYield: null,
    }
  }

  return {
    calculable: true,
    totalMaterialCostTtc: materialCostTtc,
    costPerPortion: portions > 0 ? materialCostTtc / portions : null,
    theoreticalSalePriceTtcTotal: calculateRecipeTheoreticalSalePriceTtc(materialCostTtc, yieldMode, portions),
    theoreticalSalePriceTtcPerPerson: calculateRecipeTheoreticalSalePriceTtcPerPerson(materialCostTtc, yieldMode, portions),
    costPerYield: yieldMode === 'rendement_produit' ? calculateRecipeCostPerYield(materialCostTtc, yieldQuantity) : null,
  }
}

export function calculateRawQuantityFromNet(netQuantity: number, yieldPercent: number) {
  if (netQuantity <= 0 || yieldPercent <= 0 || yieldPercent > 100) return null
  return netQuantity / (yieldPercent / 100)
}

export function calculateIngredientCost(quantity: number, normalizedUnitPrice: number | null, quantityMode: IngredientQuantityMode = 'brut', yieldPercent?: number | null) {
  if (quantity <= 0 || normalizedUnitPrice == null || normalizedUnitPrice <= 0) return null
  if (quantityMode === 'net') {
    const rawQuantity = calculateRawQuantityFromNet(quantity, Number(yieldPercent ?? 0))
    return rawQuantity == null ? null : rawQuantity * normalizedUnitPrice
  }
  return quantity * normalizedUnitPrice
}

export function getRecipeReadiness(recipe: Recipe, priceObservations?: Map<string, RecipePriceObservation | null>, provisionalPrices?: Map<string, RecipeProvisionalIngredientPrice | null>): RecipeReadinessCheck[] {
  const ingredients = recipe.recipe_ingredients ?? []
  const unresolved = recipe.pending_ingredients?.filter((ingredient) => ingredient.status === 'pending' || ingredient.status === 'ambiguous') ?? []
  const articleIngredients = ingredients.filter((ingredient) => (ingredient.line_kind ?? 'article') === 'article')
  const missingPrices = articleIngredients.filter((ingredient) => {
    const provisional = provisionalPrices?.get(ingredient.article_id)?.normalized_amount_ttc
    return (!priceObservations?.has(ingredient.article_id) || priceObservations?.get(ingredient.article_id) === null) && provisional == null
  })
  const unnormalizablePrices = articleIngredients.filter((ingredient) => {
    const observation = priceObservations?.get(ingredient.article_id)
    return observation != null && observation.normalized_unit_price == null
  })
  const invalidNetRows = ingredients.filter((ingredient) => ingredient.quantity_mode === 'net' && (!ingredient.trim_form_id && !(ingredient.yield_percent_snapshot && ingredient.yield_percent_snapshot > 0 && ingredient.yield_percent_snapshot <= 100)))
  const steps = recipe.recipe_steps ?? []
  const invalidSteps = steps.filter((step) => !step.instructions?.trim())
  const uniqueStepOrders = new Set(steps.map((step) => step.step_order))
  const missingArticleLinks = articleIngredients.filter((ingredient) => !ingredient.article_id)
  const invalidSubrecipes = ingredients.filter((ingredient) => ingredient.line_kind === 'subrecipe' && (!ingredient.subrecipe_id || Number(ingredient.subrecipe_cost_snapshot ?? ingredient.unit_price ?? 0) <= 0))
  const currentMaterialCost = ingredients.reduce<number | null>((sum, ingredient) => {
    if (sum == null) return null
    const quantity = Number(ingredient.quantity_stored ?? ingredient.quantity ?? 0)
    if (ingredient.line_kind === 'subrecipe') {
      const unitCost = Number(ingredient.subrecipe_cost_snapshot ?? ingredient.unit_price ?? 0)
      return quantity > 0 && unitCost > 0 ? sum + quantity * unitCost : null
    }
    const official = priceObservations?.get(ingredient.article_id)
    const unitCost = official?.normalized_unit_price ?? (official == null ? provisionalPrices?.get(ingredient.article_id)?.normalized_amount_ttc ?? null : null)
    return quantity > 0 && unitCost != null && unitCost > 0 ? sum + quantity * unitCost : null
  }, 0)

  return [
    {
      key: 'name',
      label: 'Nom de la fiche',
      ok: Boolean(recipe.name?.trim()),
      detail: recipe.name?.trim() ? 'Nom renseigné.' : 'Le nom est obligatoire.',
    },
    {
      key: 'yield',
      label: 'Rendement final',
      ok: recipe.yield_mode === 'rendement_produit'
        ? Number(recipe.yield_quantity) > 0 && Boolean(recipe.yield_unit_id)
        : Number(recipe.portions) > 0,
      detail: recipe.yield_mode === 'rendement_produit'
        ? Number(recipe.yield_quantity) > 0 && recipe.yield_unit_id ? 'Rendement produit renseigné.' : 'Quantité et unité de rendement obligatoires.'
        : Number(recipe.portions) > 0 ? `${recipe.portions} portion(s).` : 'Le nombre de portions est invalide.',
    },
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
      key: 'net_yields',
      label: 'Rendements NET / paré',
      ok: invalidNetRows.length === 0,
      detail: invalidNetRows.length === 0 ? 'Les lignes NET disposent d’un rendement.' : `${invalidNetRows.length} ligne(s) NET sans forme ou rendement valide.`,
    },
    {
      key: 'subrecipes',
      label: 'Sous-recettes',
      ok: invalidSubrecipes.length === 0,
      detail: invalidSubrecipes.length === 0 ? 'Sous-recettes exploitables.' : `${invalidSubrecipes.length} sous-recette(s) invalide(s) ou sans coût validé.`,
    },
    {
      key: 'procedure',
      label: 'Procédé structuré',
      ok: steps.length > 0 && invalidSteps.length === 0 && uniqueStepOrders.size === steps.length,
      detail: steps.length === 0 ? 'Aucune étape de procédé.' : invalidSteps.length > 0 ? `${invalidSteps.length} étape(s) sans description.` : uniqueStepOrders.size !== steps.length ? 'Ordre des étapes incohérent.' : `${steps.length} étape(s) ordonnée(s).`,
    },
    {
      key: 'dressing_photo',
      label: 'Photo de dressage',
      ok: true,
      detail: recipe.dressing_photo_path || recipe.dressing_photo_url ? 'Photo principale disponible.' : 'Photo facultative absente.',
    },
    {
      key: 'prices',
      label: 'Prix NORMAL Achats',
      ok: Boolean(priceObservations) && missingPrices.length === 0 && unnormalizablePrices.length === 0,
      detail: !priceObservations
        ? 'Prix NORMAL non chargé.'
        : missingPrices.length > 0
          ? `${missingPrices.length} prix NORMAL manquant(s).${articleIngredients.some((ingredient) => provisionalPrices?.get(ingredient.article_id)?.normalized_amount_ttc != null) ? ' Un prix provisoire est utilisé.' : ''}`
          : unnormalizablePrices.length > 0
            ? `${unnormalizablePrices.length} prix NORMAL non normalisable(s) : coût incomplet.`
            : articleIngredients.some((ingredient) => provisionalPrices?.get(ingredient.article_id)?.normalized_amount_ttc != null)
              ? 'Coût provisoire calculable ; validation possible avec statut PROVISOIRE.'
              : 'Prix NORMAL disponibles et normalisés.',
    },
    {
      key: 'total_cost',
      label: 'Cout total',
      ok: currentMaterialCost != null && currentMaterialCost > 0,
      detail: currentMaterialCost != null && currentMaterialCost > 0 ? `${currentMaterialCost.toLocaleString('fr-FR')} Ar.` : 'Le coût matière actuel est non calculable.',
    },
  ]
}

export function isRecipeReadyForValidation(recipe: Recipe, priceObservations?: Map<string, RecipePriceObservation | null>, provisionalPrices?: Map<string, RecipeProvisionalIngredientPrice | null>) {
  return getRecipeReadiness(recipe, priceObservations, provisionalPrices).every((check) => check.ok)
}
