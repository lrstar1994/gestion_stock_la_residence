import { z } from 'zod'
import type { Article, Family, Location, Unit } from './catalog'
import type { Profile, UserRole } from './validation'

export const movementTypes = ['entree', 'sortie', 'transfert', 'retour', 'perte', 'consommation', 'correction', 'ajustement'] as const
export const movementStatuses = ['normal', 'retroactif', 'annule', 'en_attente', 'valide'] as const
export const priceSourceTypes = ['reception', 'manual', 'average', 'correction'] as const

export type MovementType = (typeof movementTypes)[number]
export type MovementStatus = (typeof movementStatuses)[number]
export type PriceSourceType = (typeof priceSourceTypes)[number]

export const movementTypeLabels: Record<MovementType, string> = {
  entree: 'Entree',
  sortie: 'Sortie',
  transfert: 'Transfert',
  retour: 'Retour',
  perte: 'Perte',
  consommation: 'Consommation',
  correction: 'Correction',
  ajustement: 'Ajustement',
}

export const movementStatusLabels: Record<MovementStatus, string> = {
  normal: 'Normal',
  retroactif: 'Retroactif',
  annule: 'Annule',
  en_attente: 'En attente',
  valide: 'Valide',
}

export const priceSourceLabels: Record<PriceSourceType, string> = {
  reception: 'Reception',
  manual: 'Manuelle',
  average: 'Prix moyen',
  correction: 'Correction',
}

export type StockMovement = {
  id: string
  article_id: string
  quantity: number
  unit_id: string
  movement_type: MovementType
  from_location_id: string | null
  to_location_id: string | null
  movement_date: string
  created_at: string
  updated_at: string
  created_by: string
  updated_by: string | null
  reference_type: string | null
  reference_id: string | null
  reception_item_id: string | null
  status: MovementStatus
  is_retroactive: boolean
  retroactive_date: string | null
  retroactive_reason: string | null
  retroactive_validated_by: string | null
  retroactive_validated_at: string | null
  is_manual: boolean
  manual_reason: string | null
  manual_validated_by: string | null
  manual_validated_at: string | null
  comment: string | null
  movement_reference: string
  unit_cost: number | null
  price_source: PriceSourceType
  total_cost: number
  articles?: Pick<Article, 'id' | 'name' | 'min_stock'> & { families?: Pick<Family, 'id' | 'name'> }
  units?: Pick<Unit, 'id' | 'name' | 'abbreviation'>
  from_location?: Pick<Location, 'id' | 'name'>
  to_location?: Pick<Location, 'id' | 'name'>
  creator?: Pick<Profile, 'id' | 'full_name'>
  validator?: Pick<Profile, 'id' | 'full_name'>
}

export type StockRow = {
  article_id: string
  total_quantity: number
  last_price: number | null
  average_price: number | null
  articles?: Pick<Article, 'id' | 'name' | 'min_stock'> & { families?: Pick<Family, 'id' | 'name'>; units?: Pick<Unit, 'id' | 'name' | 'abbreviation'> }
  locations?: Array<{ location_id: string; location_name: string; quantity: number }>
}

export type StockArticleDetail = {
  stock: StockRow | null
  movements: StockMovement[]
  priceHistory: PriceHistoryRow[]
}

export type PriceHistoryRow = {
  id: string
  article_id: string
  movement_date: string
  unit_cost: number
  quantity: number
  price_source: PriceSourceType
  reference_type: string | null
  reference_id: string | null
  movement_reference: string
  created_at: string
}

export const transferSchema = z.object({
  article_id: z.string().min(1, 'Article obligatoire'),
  quantity: z.number().positive('La quantite doit etre superieure a 0'),
  unit_id: z.string().min(1, "L'unite est obligatoire"),
  from_location_id: z.string().min(1, 'Localisation de depart obligatoire'),
  to_location_id: z.string().min(1, 'Localisation de destination obligatoire'),
  movement_date: z.string().min(1),
  reason: z.string().min(1, 'Motif obligatoire'),
  comment: z.string().optional(),
})

export const manualMovementSchema = z.object({
  movement_type: z.enum(['entree', 'sortie', 'correction', 'ajustement']),
  movement_date: z.string().min(1),
  article_id: z.string().min(1, 'Article obligatoire'),
  quantity: z.number().positive('La quantite doit etre superieure a 0'),
  unit_id: z.string().min(1, "L'unite est obligatoire"),
  location_id: z.string().min(1, 'Localisation obligatoire'),
  unit_cost: z.number().min(0).optional(),
  price_source: z.enum(['manual', 'correction']).optional(),
  reason: z.string().min(1, 'Motif obligatoire'),
  retroactive_reason: z.string().optional(),
  comment: z.string().optional(),
})

export type TransferFormValues = z.infer<typeof transferSchema>
export type ManualMovementFormValues = z.infer<typeof manualMovementSchema>

export function canManageStock(role?: UserRole) {
  return role === 'direction' || role === 'magasinier'
}

export function canRequestTransfers(role?: UserRole) {
  return role === 'direction' || role === 'magasinier' || role === 'chef_cuisine'
}

export function canValidateStock(role?: UserRole) {
  return role === 'direction'
}

export function isRetroactive(date: string) {
  return date < new Date().toISOString().slice(0, 10)
}
