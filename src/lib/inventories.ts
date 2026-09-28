import { z } from 'zod'
import type { Article, Family, Location, Unit } from './catalog'
import type { StockMovement } from './stock'
import type { Profile, UserRole } from './validation'

export const inventoryTypes = ['initial', 'periodique', 'exceptionnel', 'controle'] as const
export const inventoryStatuses = ['brouillon', 'en_saisie', 'saisi', 'en_attente', 'a_controler', 'a_valider_direction', 'en_attente_validation', 'validation_direction_requise', 'valide', 'corrige', 'corrections_generees', 'cloture', 'annule', 'cloture_avec_reserve', 'archive'] as const
export const initialInventoryStatuses = ['non_inventorie', 'stock_initial_non_confirme', 'stock_initial_confirme', 'a_controler', 'archive'] as const

export const inventorySettings = {
  validationThresholdPercent: 5,
  mandatoryReasonThresholdPercent: 10,
}

export type InventoryType = (typeof inventoryTypes)[number]
export type InventoryStatus = (typeof inventoryStatuses)[number]
export type InitialInventoryStatus = (typeof initialInventoryStatuses)[number]

export const inventoryTypeLabels: Record<InventoryType, string> = {
  initial: 'Initial',
  periodique: 'Périodique',
  exceptionnel: 'Exceptionnel',
  controle: 'ContrÃ´le',
}

export const inventoryStatusLabels: Record<InventoryStatus, string> = {
  brouillon: 'Brouillon',
  en_saisie: 'En cours de saisie',
  saisi: 'Saisi',
  en_attente: 'En attente Controle : inventaire a verifier',
  a_controler: 'En attente Controle : inventaire a verifier',
  a_valider_direction: 'A valider Direction',
  en_attente_validation: 'En attente validation Direction',
  validation_direction_requise: 'Validation Direction requise',
  valide: 'Validé',
  corrige: 'Corrigé',
  corrections_generees: 'Corrections stock générées',
  cloture: 'Clôturé',
  annule: 'Annulé',
  cloture_avec_reserve: 'Clôturé avec réserve',
  archive: 'Archivé',
}

export const initialInventoryStatusLabels: Record<InitialInventoryStatus, string> = {
  non_inventorie: 'Non inventorie',
  stock_initial_non_confirme: 'Stock initial non confirme',
  stock_initial_confirme: 'Stock initial confirme',
  a_controler: 'A controler',
  archive: 'Archive',
}

export type InventoryItem = {
  id?: string
  inventory_id?: string
  article_id: string
  theoretical_quantity: number
  counted_quantity: number | null
  difference?: number
  unit_id: string
  unit_price: number | null
  value_difference?: number | null
  reason: string | null
  stock_movement_id: string | null
  articles?: Pick<Article, 'id' | 'name'> & { families?: Pick<Family, 'id' | 'name'>; units?: Pick<Unit, 'id' | 'name' | 'abbreviation'> }
  units?: Pick<Unit, 'id' | 'name' | 'abbreviation'>
  stock_movements?: Pick<StockMovement, 'id' | 'movement_reference' | 'quantity' | 'unit_cost' | 'total_cost'>
}

export type InventoryAdjustmentRequest = {
  id: string
  inventory_id: string
  inventory_item_id: string
  article_id: string
  location_id: string
  original_counted_quantity: number
  proposed_counted_quantity: number
  adjustment_difference: number
  unit_id: string
  unit_price: number
  reason: string
  status: 'en_attente' | 'valide' | 'refuse'
  stock_movement_id: string | null
  requested_by: string | null
  requested_at: string
  validated_by: string | null
  validated_at: string | null
  validation_comment: string | null
  articles?: Pick<Article, 'id' | 'name'>
  units?: Pick<Unit, 'id' | 'name' | 'abbreviation'>
  requester?: Pick<Profile, 'id' | 'full_name'>
  validator?: Pick<Profile, 'id' | 'full_name'>
  stock_movements?: Pick<StockMovement, 'id' | 'movement_reference' | 'quantity' | 'unit_cost' | 'total_cost'>
}

export type Inventory = {
  id: string
  reference: string
  location_id: string
  inventory_date: string
  type: InventoryType
  comment: string | null
  status: InventoryStatus
  total_positive_difference: number
  total_negative_difference: number
  total_difference: number
  total_value_difference: number
  validated_by: string | null
  validated_at: string | null
  validation_comment: string | null
  closed_by: string | null
  closed_at: string | null
  created_at: string
  updated_at: string
  created_by: string
  updated_by: string | null
  locations?: Pick<Location, 'id' | 'name'>
  creator?: Pick<Profile, 'id' | 'full_name'>
  validator?: Pick<Profile, 'id' | 'full_name'>
  closer?: Pick<Profile, 'id' | 'full_name'>
  inventory_items?: InventoryItem[]
  inventory_adjustment_requests?: InventoryAdjustmentRequest[]
}

export type InitialInventoryRow = {
  inventory_id?: string | null
  article_id: string
  article_name: string
  location_id: string
  location_name: string
  unit_name: string
  status: InitialInventoryStatus
  last_inventory_date: string | null
}

export type InventoryDashboard = {
  total: number
  pending: number
  initialMissing: number
  totalValueDifference: number
  biggestDifferences: InventoryItem[]
}

export const inventoryItemSchema = z.object({
  article_id: z.string().min(1),
  theoretical_quantity: z.number(),
  counted_quantity: z.number().min(0, 'La quantité comptée ne peut pas être négative').nullable(),
  unit_id: z.string().min(1),
  unit_price: z.number().min(0).nullable(),
  reason: z.string().optional(),
})

export const inventoryFormSchema = z.object({
  location_id: z.string().min(1, 'Localisation obligatoire'),
  inventory_date: z.string().min(1),
  type: z.enum(inventoryTypes),
  comment: z.string().optional(),
  items: z.array(inventoryItemSchema).min(1, 'Ajoutez au moins un article'),
})

export type InventoryFormValues = z.infer<typeof inventoryFormSchema>

export function canCreateInventories(role?: UserRole) {
  return role === 'direction' || role === 'magasinier'
}

export function canValidateInventory(role?: UserRole) {
  return role === 'direction'
}

export function canExportInventories(role?: UserRole) {
  return role ? ['direction', 'magasinier', 'comptabilite'].includes(role) : false
}

export function summarizeInventory(items: Array<Pick<InventoryItem, 'theoretical_quantity' | 'counted_quantity' | 'unit_price'>>) {
  return items.reduce((summary, item) => {
    if (item.counted_quantity === null) return summary
    const difference = Number(item.counted_quantity) - Number(item.theoretical_quantity ?? 0)
    return {
      positive: summary.positive + Math.max(0, difference),
      negative: summary.negative + Math.min(0, difference),
      total: summary.total + difference,
      value: summary.value + difference * Number(item.unit_price ?? 0),
    }
  }, { positive: 0, negative: 0, total: 0, value: 0 })
}

export function hasSignificantDifference(item: Pick<InventoryItem, 'theoretical_quantity' | 'counted_quantity'>, threshold = 5) {
  if (item.counted_quantity === null) return false
  const theoretical = Math.abs(Number(item.theoretical_quantity ?? 0))
  const difference = Math.abs(Number(item.counted_quantity ?? 0) - Number(item.theoretical_quantity ?? 0))
  if (difference === 0) return false
  if (theoretical === 0) return true
  return (difference / theoretical) * 100 > threshold
}
