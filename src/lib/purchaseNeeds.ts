import { z } from 'zod'
import type { Article, Family, Unit } from './catalog'
import type { Event } from './events'
import type { Supplier } from './suppliers'
import type { Profile, UserRole } from './validation'

export const needOrigins = ['evenement', 'production', 'seuil_minimum', 'maintenance', 'entretien', 'chambres', 'administration', 'demande_manuelle'] as const
export const needUrgencies = ['normal', 'urgent', 'tres_urgent'] as const
export const needStatuses = ['a_faire', 'en_cours', 'valide', 'regroupe', 'refuse', 'annule'] as const

export type NeedOrigin = (typeof needOrigins)[number]
export type NeedUrgency = (typeof needUrgencies)[number]
export type NeedStatus = (typeof needStatuses)[number]

export const needOriginLabels: Record<NeedOrigin, string> = {
  evenement: 'Evenement',
  production: 'Production',
  seuil_minimum: 'Seuil minimum',
  maintenance: 'Maintenance',
  entretien: 'Entretien',
  chambres: 'Chambres',
  administration: 'Administration',
  demande_manuelle: 'Demande manuelle',
}

export const needUrgencyLabels: Record<NeedUrgency, string> = {
  normal: 'Normal',
  urgent: 'Urgent',
  tres_urgent: 'Tres urgent',
}

export const needStatusLabels: Record<NeedStatus, string> = {
  a_faire: 'A faire',
  en_cours: 'En cours',
  valide: 'Valide',
  regroupe: 'Regroupe',
  refuse: 'Refuse',
  annule: 'Annule',
}

export type PurchaseNeedGlobal = {
  id: string
  article_id: string
  quantity: number
  quantity_needed: number
  unit_id: string
  origin: NeedOrigin
  urgency: NeedUrgency
  estimated_price: number | null
  estimated_cost: number
  budget: number | null
  requested_date: string | null
  comment: string | null
  status: NeedStatus
  event_id: string | null
  recipe_id: string | null
  validated_by: string | null
  validated_at: string | null
  validation_comment: string | null
  group_id: string | null
  supplier_id: string | null
  created_at: string
  updated_at: string
  created_by: string
  updated_by: string | null
  articles?: Pick<Article, 'id' | 'name' | 'default_supplier' | 'min_stock'> & { families?: Pick<Family, 'id' | 'name'> }
  units?: Pick<Unit, 'id' | 'name' | 'abbreviation'>
  suppliers?: Pick<Supplier, 'id' | 'name'>
  events?: Pick<Event, 'id' | 'name'>
  requester?: Pick<Profile, 'id' | 'full_name' | 'role'>
  validator?: Pick<Profile, 'id' | 'full_name'>
}

export type PurchaseGroup = {
  id: string
  name: string
  supplier_id: string | null
  total_estimated_cost: number
  status: string
  created_at: string
  updated_at: string
  created_by: string | null
  suppliers?: Pick<Supplier, 'id' | 'name'>
}

export const purchaseNeedSchema = z.object({
  article_id: z.string().min(1, 'Article obligatoire'),
  quantity: z.number().positive('La quantite doit etre superieure a 0'),
  unit_id: z.string().min(1, "L'unite est obligatoire"),
  origin: z.enum(needOrigins),
  urgency: z.enum(needUrgencies),
  estimated_price: z.number().min(0).optional(),
  budget: z.number().min(0, 'Le budget ne peut pas etre negatif').optional(),
  requested_date: z.string().optional(),
  comment: z.string().optional(),
  supplier_id: z.string().optional(),
})

export type PurchaseNeedFormValues = z.infer<typeof purchaseNeedSchema>

export function canCreatePurchaseNeeds(role?: UserRole) {
  return role ? ['direction', 'chef_cuisine', 'fiche_technique', 'maintenance', 'magasinier'].includes(role) : false
}

export function canValidatePurchaseNeeds(role?: UserRole) {
  return role === 'direction'
}

export function canGroupPurchaseNeeds(role?: UserRole) {
  return role === 'direction' || role === 'acheteur'
}

export function canEditPurchaseNeed(need: PurchaseNeedGlobal, role?: UserRole, profileId?: string) {
  if (need.status === 'valide' || need.status === 'regroupe') return false
  if (role === 'direction' || role === 'acheteur') return true
  return Boolean(profileId && need.created_by === profileId)
}

export function isNeedExpired(need: PurchaseNeedGlobal) {
  if (!need.requested_date || need.status === 'regroupe' || need.status === 'annule') return false
  const today = new Date().toISOString().slice(0, 10)
  return need.requested_date < today
}
