import { z } from 'zod'
import type { Article, Family, Unit } from './catalog'
import type { Event } from './events'
import type { Supplier } from './suppliers'
import type { Profile, UserRole } from './validation'

export const needOrigins = ['evenement', 'production', 'seuil_minimum', 'maintenance', 'entretien', 'chambres', 'administration', 'demande_manuelle'] as const
export const needTypes = ['reapprovisionnement_normal', 'besoin_ponctuel', 'urgence_rupture', 'remplacement_anomalie', 'demande_exceptionnelle_direction'] as const
export const needDestinations = ['stock_general', 'cuisine_production', 'salle_bar_service_client', 'evenement_banquet_seminaire', 'chambres_hebergement', 'maintenance_travaux', 'administration_bureau', 'immobilisation_equipement', 'autre'] as const
export const needCalculationSources = ['saisie_manuelle', 'seuil_stock', 'besoins_theoriques_evenement', 'fiche_technique', 'historique_consommation', 'demande_direction', 'autre'] as const
export const requestingServices = ['direction', 'cuisine', 'fiche_technique', 'magasin', 'achats', 'maintenance', 'comptabilite', 'caisse', 'point_vente', 'hebergement', 'administration', 'autre'] as const
export const needUrgencies = ['normal', 'urgent', 'tres_urgent'] as const
export const needStatuses = ['a_faire', 'en_cours', 'valide', 'regroupe', 'refuse', 'annule'] as const

export type NeedOrigin = (typeof needOrigins)[number]
export type NeedType = (typeof needTypes)[number]
export type NeedDestination = (typeof needDestinations)[number]
export type NeedCalculationSource = (typeof needCalculationSources)[number]
export type RequestingService = (typeof requestingServices)[number]
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

export const needTypeLabels: Record<NeedType, string> = {
  reapprovisionnement_normal: 'Reapprovisionnement normal',
  besoin_ponctuel: 'Besoin ponctuel',
  urgence_rupture: 'Urgence / rupture',
  remplacement_anomalie: 'Remplacement / anomalie',
  demande_exceptionnelle_direction: 'Demande exceptionnelle Direction',
}

export const needDestinationLabels: Record<NeedDestination, string> = {
  stock_general: 'Stock general',
  cuisine_production: 'Cuisine / production',
  salle_bar_service_client: 'Salle / bar / service client',
  evenement_banquet_seminaire: 'Evenement / banquet / seminaire',
  chambres_hebergement: 'Chambres / hebergement',
  maintenance_travaux: 'Maintenance / travaux',
  administration_bureau: 'Administration / bureau',
  immobilisation_equipement: 'Immobilisation / equipement',
  autre: 'Autre a preciser',
}

export const needCalculationSourceLabels: Record<NeedCalculationSource, string> = {
  saisie_manuelle: 'Saisie manuelle',
  seuil_stock: 'Seuil de stock',
  besoins_theoriques_evenement: 'Besoins theoriques evenement',
  fiche_technique: 'Fiche technique',
  historique_consommation: 'Historique de consommation',
  demande_direction: 'Demande Direction',
  autre: 'Autre',
}

export const requestingServiceLabels: Record<RequestingService, string> = {
  direction: 'Direction',
  cuisine: 'Cuisine',
  fiche_technique: 'Fiche technique',
  magasin: 'Magasin',
  achats: 'Achats',
  maintenance: 'Maintenance',
  comptabilite: 'Comptabilite',
  caisse: 'Caisse',
  point_vente: 'Point de vente',
  hebergement: 'Hebergement',
  administration: 'Administration',
  autre: 'Autre',
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
  type_de_besoin: NeedType | null
  destination_prevue: NeedDestination | null
  source_du_calcul: NeedCalculationSource | null
  service_demandeur: RequestingService | null
  urgency: NeedUrgency
  estimated_price: number | null
  price_input_amount: number | null
  price_input_is_tax_excluded: boolean | null
  vat_rate: number | null
  estimated_vat_amount: number | null
  estimated_price_ttc: number | null
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
  type_de_besoin: z.enum(needTypes).optional(),
  destination_prevue: z.enum(needDestinations).optional(),
  source_du_calcul: z.enum(needCalculationSources).optional(),
  service_demandeur: z.enum(requestingServices).optional(),
  urgency: z.enum(needUrgencies),
  estimated_price: z.number().min(0).optional(),
  price_input_amount: z.number().min(0).optional(),
  price_input_is_tax_excluded: z.boolean().optional(),
  vat_rate: z.number().min(0).optional(),
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
