import { z } from 'zod'
import type { Recipe } from './recipes'
import type { Article, Unit } from './catalog'
import type { UserRole } from './validation'

export const eventTypes = ['buffet', 'brunch', 'seminaire', 'business_lunch', 'cocktail', 'take_away', 'patisserie', 'autre'] as const
export const eventStatuses = ['planifie', 'en_production', 'termine', 'annule'] as const
export const serviceTypes = ['assiette', 'buffet'] as const
export const interestLevels = ['tres_demande', 'normal', 'complement', 'decouverte', 'appoint', 'condiment'] as const
export const purchaseNeedStatuses = ['a_faire', 'en_cours', 'valide', 'regroupe', 'refuse', 'annule'] as const

export type EventType = (typeof eventTypes)[number]
export type EventStatus = (typeof eventStatuses)[number]
export type ServiceType = (typeof serviceTypes)[number]
export type InterestLevel = (typeof interestLevels)[number]
export type PurchaseNeedStatus = (typeof purchaseNeedStatuses)[number]

export const eventTypeLabels: Record<EventType, string> = {
  buffet: 'Buffet',
  brunch: 'Brunch',
  seminaire: 'Seminaire',
  business_lunch: 'Business lunch',
  cocktail: 'Cocktail',
  take_away: 'Take-away',
  patisserie: 'Patisserie',
  autre: 'Autre',
}

export const eventStatusLabels: Record<EventStatus, string> = {
  planifie: 'Planifie',
  en_production: 'En production',
  termine: 'Termine',
  annule: 'Annule',
}

export const serviceTypeLabels: Record<ServiceType, string> = {
  assiette: "A l'assiette",
  buffet: 'Buffet',
}

export const interestLevelLabels: Record<InterestLevel, string> = {
  tres_demande: 'Tres demande',
  normal: 'Normal',
  complement: 'Complement',
  decouverte: 'Decouverte',
  appoint: 'Appoint',
  condiment: 'Condiment',
}

export const purchaseNeedStatusLabels: Record<PurchaseNeedStatus, string> = {
  a_faire: 'A faire',
  en_cours: 'En cours',
  valide: 'Valide',
  regroupe: 'Regroupe',
  refuse: 'Refuse',
  annule: 'Annule',
}

export type Event = {
  id: string
  name: string
  type: EventType
  date: string
  location: string | null
  description: string | null
  adults: number
  children: number
  child_coefficient: number
  total_equivalent: number
  safety_margin: number
  status: EventStatus
  total_estimated_cost: number
  total_real_cost: number
  total_estimated_price: number
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  event_recipes?: EventRecipe[]
}

export type EventRecipe = {
  id: string
  event_id: string
  recipe_id: string
  service_type: ServiceType
  interest_level: InterestLevel
  suggested_coefficient: number
  selected_coefficient: number
  coefficient_modification_reason: string | null
  coefficient_modified_by: string | null
  coefficient_modified_at: string | null
  portions_planned: number
  portions_produced: number
  portions_consumed: number
  portions_returned: number
  portions_lost: number
  portions_unsold: number
  portions_additional: number
  estimated_cost: number
  real_cost: number
  recipes?: Recipe
}

export type PurchaseNeed = {
  id: string
  event_id: string
  article_id: string
  quantity_needed: number
  unit_id: string
  estimated_cost: number
  status: PurchaseNeedStatus
  articles?: Pick<Article, 'id' | 'name' | 'default_supplier'> & { families?: { id: string; name: string } }
  units?: Pick<Unit, 'id' | 'name' | 'abbreviation'>
}

export const eventRecipeSchema = z.object({
  recipe_id: z.string().min(1),
  service_type: z.enum(serviceTypes),
  interest_level: z.enum(interestLevels),
  suggested_coefficient: z.number().min(0),
  selected_coefficient: z.number().min(0),
  coefficient_modification_reason: z.string().optional(),
  portions_planned: z.number().min(0),
  estimated_cost: z.number().min(0),
  estimated_price: z.number().min(0),
})

export const eventSchema = z.object({
  name: z.string().min(1, 'Le nom est obligatoire'),
  type: z.enum(eventTypes),
  date: z.string().min(1, 'La date est obligatoire'),
  location: z.string().optional(),
  description: z.string().optional(),
  adults: z.number().int().min(0),
  children: z.number().int().min(0),
  child_coefficient: z.number().min(0).max(1),
  safety_margin: z.number().min(0),
  status: z.enum(eventStatuses),
  recipes: z.array(eventRecipeSchema),
})

export type EventFormValues = z.infer<typeof eventSchema>
export type EventRecipeFormValues = z.infer<typeof eventRecipeSchema>

export function canManageEvents(role?: UserRole) {
  return role === 'direction' || role === 'chef_cuisine' || role === 'fiche_technique'
}

export function canUpdateProduction(role?: UserRole) {
  return role === 'direction' || role === 'chef_cuisine'
}

export function calculateEquivalentAdults(adults: number, children: number, childCoefficient: number) {
  return adults + children * childCoefficient
}

export function getRecipeEventCategory(recipe: Pick<Recipe, 'type'>) {
  if (recipe.type === 'PL') return 'plat'
  if (recipe.type === 'EF' || recipe.type === 'EC') return 'entree'
  if (recipe.type === 'DS' || recipe.type === 'PC-SU' || recipe.type === 'CO-SU') return 'dessert'
  if (recipe.type === 'PC-S' || recipe.type === 'CO-S') return 'amuse'
  return 'plat'
}

export function suggestBuffetCoefficient(recipe: Pick<Recipe, 'type'>, interestLevel: InterestLevel, recipesInCategory: number) {
  const category = getRecipeEventCategory(recipe)
  const count = Math.max(1, recipesInCategory)

  if (category === 'plat') {
    if (count === 1) return interestLevel === 'tres_demande' ? 95 : 85
    if (count === 2) return byInterest(interestLevel, { tres_demande: 60, normal: 48, complement: 35, decouverte: 25 })
    if (count === 3) return byInterest(interestLevel, { tres_demande: 50, normal: 35, complement: 25, decouverte: 20 })
    return byInterest(interestLevel, { tres_demande: 40, normal: 30, complement: 20, decouverte: 15 })
  }

  if (category === 'entree') {
    if (count <= 3) return 65
    if (count <= 5) return 45
    return 35
  }

  if (category === 'dessert') {
    if (count <= 3) return 55
    if (count <= 5) return 40
    return 30
  }

  if (count <= 4) return 75
  if (count <= 8) return 55
  return 45
}

function byInterest(interestLevel: InterestLevel, values: Partial<Record<InterestLevel, number>>) {
  return values[interestLevel] ?? ({ tres_demande: 50, normal: 40, complement: 30, decouverte: 20, appoint: 15, condiment: 10 }[interestLevel])
}

export function calculateRecipePlannedPortions(params: {
  serviceType: ServiceType
  equivalentAdults: number
  selectedCoefficient: number
  safetyMargin: number
}) {
  if (params.serviceType === 'assiette') return params.equivalentAdults
  return params.equivalentAdults * (params.selectedCoefficient / 100) * (1 + params.safetyMargin / 100)
}

export function calculateEventRecipeCost(recipe: Recipe, portionsPlanned: number) {
  const portions = Math.max(1, Number(recipe.portions) || 1)
  const multiplier = portionsPlanned / portions
  return Number(recipe.total_cost ?? 0) * multiplier
}

export function calculateEventRecipePrice(recipe: Recipe, portionsPlanned: number) {
  const portions = Math.max(1, Number(recipe.portions) || 1)
  const multiplier = portionsPlanned / portions
  return Number(recipe.final_price ?? 0) * multiplier
}

export function calculateConsumedPortions(item: Pick<EventRecipe, 'portions_produced' | 'portions_additional' | 'portions_returned' | 'portions_lost'>) {
  return Math.max(0, Number(item.portions_produced ?? 0) + Number(item.portions_additional ?? 0) - Number(item.portions_returned ?? 0) - Number(item.portions_lost ?? 0))
}
