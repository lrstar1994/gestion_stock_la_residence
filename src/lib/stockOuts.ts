import { z } from 'zod'
import type { Article, Location, Unit } from './catalog'
import type { Event } from './events'
import type { Recipe } from './recipes'
import type { StockMovement } from './stock'
import type { Profile, UserRole } from './validation'

export const stockOutDestinations = ['recette', 'production', 'buffet', 'seminaire', 'restaurant', 'take_away', 'piscine', 'chambre', 'maintenance', 'entretien', 'consommation_interne', 'perte', 'casse', 'autre'] as const
export const consumptionTypes = ['normale', 'surconsommation', 'economie', 'perte'] as const
export const lossTypes = ['casse', 'erreur', 'qualite', 'autre'] as const

export type StockOutDestination = (typeof stockOutDestinations)[number]
export type ConsumptionType = (typeof consumptionTypes)[number]
export type LossType = (typeof lossTypes)[number]
export type StockOutStatus = 'valide' | 'en_attente' | 'annule'

export const stockOutDestinationLabels: Record<StockOutDestination, string> = {
  recette: 'Recette',
  production: 'Production',
  buffet: 'Buffet',
  seminaire: 'Seminaire',
  restaurant: 'Restaurant',
  take_away: 'Take-away',
  piscine: 'Piscine',
  chambre: 'Chambre',
  maintenance: 'Maintenance',
  entretien: 'Entretien',
  consommation_interne: 'Consommation interne',
  perte: 'Perte',
  casse: 'Casse',
  autre: 'Autre',
}

export const consumptionTypeLabels: Record<ConsumptionType, string> = {
  normale: 'Normale',
  surconsommation: 'Surconsommation',
  economie: 'Economie',
  perte: 'Perte',
}

export const lossTypeLabels: Record<LossType, string> = {
  casse: 'Casse',
  erreur: 'Erreur',
  qualite: 'Qualite',
  autre: 'Autre',
}

export type StockOut = {
  id: string
  reference: string
  article_id: string
  quantity: number
  unit_id: string
  location_id: string
  destination: StockOutDestination
  out_date: string
  recipe_id: string | null
  event_id: string | null
  production_id: string | null
  theoretical_quantity: number | null
  difference: number | null
  consumption_type: ConsumptionType | null
  is_loss: boolean
  loss_type: LossType | null
  loss_comment: string | null
  is_additional: boolean
  is_return: boolean
  return_quantity: number | null
  reason: string
  comment: string | null
  validated_by: string | null
  validated_at: string | null
  stock_movement_id: string | null
  return_movement_id: string | null
  created_by: string
  updated_by: string | null
  status: StockOutStatus
  created_at: string
  updated_at: string
  articles?: Pick<Article, 'id' | 'name'> & { families?: { id: string; name: string } }
  units?: Pick<Unit, 'id' | 'name' | 'abbreviation'>
  locations?: Pick<Location, 'id' | 'name'>
  recipes?: Pick<Recipe, 'id' | 'name' | 'code'>
  events?: Pick<Event, 'id' | 'name'>
  stock_movement?: Pick<StockMovement, 'id' | 'movement_reference' | 'unit_cost' | 'total_cost' | 'price_source'>
  return_movement?: Pick<StockMovement, 'id' | 'movement_reference' | 'unit_cost' | 'total_cost' | 'price_source'>
  creator?: Pick<Profile, 'id' | 'full_name'>
  validator?: Pick<Profile, 'id' | 'full_name'>
}

export const stockOutItemSchema = z.object({
  article_id: z.string().min(1, 'Article obligatoire'),
  quantity: z.number().positive('La quantite doit etre superieure a 0'),
  unit_id: z.string().min(1, "L'unite est obligatoire"),
  location_id: z.string().min(1, 'Localisation obligatoire'),
  theoretical_quantity: z.number().min(0).optional(),
  recipe_id: z.string().optional(),
  is_additional: z.boolean().default(false),
  is_return: z.boolean().default(false),
  return_quantity: z.number().min(0).optional(),
  is_loss: z.boolean().default(false),
  loss_type: z.enum(lossTypes).optional(),
  loss_comment: z.string().optional(),
})

export const stockOutFormSchema = z.object({
  event_id: z.string().optional(),
  out_date: z.string().min(1),
  destination: z.enum(stockOutDestinations),
  reason: z.string().min(1, 'Le motif doit etre renseigne'),
  comment: z.string().optional(),
  items: z.array(stockOutItemSchema).min(1, 'Veuillez ajouter au moins un article'),
})

export type StockOutFormValues = z.infer<typeof stockOutFormSchema>

export type ConsumptionAnalysisRow = {
  article_id: string
  article_name: string
  family_name: string
  destination: StockOutDestination
  quantity: number
  theoretical_quantity: number
  difference: number
  cost: number
  consumption_type: ConsumptionType
}

export function canCreateStockOuts(role?: UserRole) {
  return role === 'direction' || role === 'chef_cuisine'
}

export function canValidateStockOuts(role?: UserRole) {
  return role === 'direction' || role === 'magasinier'
}

export function canExportStockOuts(role?: UserRole) {
  return role ? ['direction', 'chef_cuisine', 'fiche_technique', 'magasinier', 'comptabilite'].includes(role) : false
}

export function computeConsumptionType(quantity: number, theoreticalQuantity?: number, isLoss = false): ConsumptionType {
  if (isLoss) return 'perte'
  const theoretical = Number(theoreticalQuantity ?? 0)
  if (theoretical <= 0) return 'normale'
  const ratio = (quantity - theoretical) / theoretical
  if (ratio > 0.05) return 'surconsommation'
  if (ratio < -0.05) return 'economie'
  return 'normale'
}
