import { z } from 'zod'
import type { Article, Location, Unit } from './catalog'
import type { PurchaseOrder } from './purchaseOrders'
import type { Supplier } from './suppliers'
import type { Profile, UserRole } from './validation'

export const receptionStatuses = ['brouillon', 'en_attente', 'validee', 'validee_avec_anomalies', 'entree_stock', 'refusee'] as const
export const qualityStatuses = ['conforme', 'non_conforme', 'a_verifier'] as const
export const anomalyTypes = ['quantite_manquante', 'prix_different', 'produit_abime', 'produit_non_conforme', 'livraison_partielle', 'erreur_facture', 'achat_non_autorise', 'produit_paye_non_recu'] as const

export type ReceptionStatus = (typeof receptionStatuses)[number]
export type QualityStatus = (typeof qualityStatuses)[number]
export type AnomalyType = (typeof anomalyTypes)[number]

export const receptionStatusLabels: Record<ReceptionStatus, string> = {
  brouillon: 'Brouillon',
  en_attente: 'En attente',
  validee: 'Validee',
  validee_avec_anomalies: 'Validee avec anomalies',
  entree_stock: 'Entree stock',
  refusee: 'Refusee',
}

export const qualityStatusLabels: Record<QualityStatus, string> = {
  conforme: 'Conforme',
  non_conforme: 'Non conforme',
  a_verifier: 'A verifier',
}

export const anomalyTypeLabels: Record<AnomalyType, string> = {
  quantite_manquante: 'Quantite manquante',
  prix_different: 'Prix different',
  produit_abime: 'Produit abime',
  produit_non_conforme: 'Produit non conforme',
  livraison_partielle: 'Livraison partielle',
  erreur_facture: 'Erreur facture',
  achat_non_autorise: 'Achat non autorise',
  produit_paye_non_recu: 'Produit paye non recu',
}

export type ReceptionAnomaly = {
  id?: string
  reception_item_id?: string
  anomaly_type: AnomalyType
  description: string
  photo_url?: string | null
  resolved?: boolean
  resolved_at?: string | null
  resolved_by?: string | null
  resolution_comment?: string | null
}

export type ReceptionDocument = {
  id: string
  reception_id: string
  file_url: string
  file_name: string
  file_size: number | null
  mime_type: string | null
  document_type: string
  description: string | null
  uploaded_at: string
  uploaded_by: string | null
}

export type ReceptionHistory = {
  id: string
  reception_id: string
  action: string
  description: string | null
  created_at: string
  created_by: string | null
  actor?: Pick<Profile, 'id' | 'full_name'>
}

export type ReceptionItem = {
  id?: string
  reception_id?: string
  article_id: string
  quantity_ordered: number
  quantity_delivered: number
  quantity_accepted: number
  quantity_refused?: number
  unit_id: string
  unit_price_planned: number | null
  unit_price_real: number
  total?: number
  quality: QualityStatus
  quality_comment?: string | null
  has_anomaly: boolean
  articles?: Pick<Article, 'id' | 'name'> & { families?: { id: string; name: string } }
  units?: Pick<Unit, 'id' | 'name' | 'abbreviation'>
  reception_anomalies?: ReceptionAnomaly[]
}

export type Reception = {
  id: string
  reference: string
  supplier_id: string
  reception_date: string
  invoice_number: string
  invoice_date: string
  location_id: string | null
  comment: string | null
  purchase_order_id: string | null
  cash_purchase_id: string | null
  validated_by: string | null
  validated_at: string | null
  validation_comment: string | null
  total_amount: number
  status: ReceptionStatus
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  suppliers?: Supplier
  locations?: Pick<Location, 'id' | 'name'>
  purchase_orders?: Pick<PurchaseOrder, 'id' | 'reference' | 'status'>
  receiver?: Pick<Profile, 'id' | 'full_name' | 'role'>
  validator?: Pick<Profile, 'id' | 'full_name'>
  reception_items?: ReceptionItem[]
  reception_documents?: ReceptionDocument[]
  reception_history?: ReceptionHistory[]
}

export const receptionItemSchema = z.object({
  article_id: z.string().min(1, 'Article obligatoire'),
  quantity_ordered: z.number().min(0),
  quantity_delivered: z.number().min(0, 'Quantite livree obligatoire'),
  quantity_accepted: z.number().min(0, 'Quantite acceptee obligatoire'),
  unit_id: z.string().min(1, "L'unite est obligatoire"),
  unit_price_planned: z.number().min(0).nullable(),
  unit_price_real: z.number().positive('Le prix réel doit être supérieur à 0'),
  quality: z.enum(qualityStatuses),
  quality_comment: z.string().optional(),
  has_anomaly: z.boolean(),
  anomalies: z.array(z.object({
    anomaly_type: z.enum(anomalyTypes),
    description: z.string().min(1, 'Description obligatoire'),
    photo_url: z.string().optional(),
  })).default([]),
})

export const receptionSchema = z.object({
  supplier_id: z.string().min(1, 'Fournisseur obligatoire'),
  reception_date: z.string().min(1, 'Date de reception obligatoire'),
  invoice_number: z.string().min(1, 'Veuillez saisir un numéro de facture'),
  invoice_date: z.string().min(1, 'Date de facture obligatoire'),
  location_id: z.string().min(1, 'Localisation obligatoire'),
  comment: z.string().optional(),
  purchase_order_id: z.string().optional(),
  cash_purchase_id: z.string().optional(),
  items: z.array(receptionItemSchema).min(1, 'Veuillez ajouter au moins un article'),
})

export type ReceptionFormValues = z.infer<typeof receptionSchema>

export function calculateReceptionTotal(items: Array<Pick<ReceptionItem, 'quantity_accepted' | 'unit_price_real'>>) {
  return items.reduce((sum, item) => sum + Number(item.quantity_accepted ?? 0) * Number(item.unit_price_real ?? 0), 0)
}

export function receptionHasAnomalies(items: ReceptionFormValues['items']) {
  return items.some((item) => item.has_anomaly || item.quality !== 'conforme' || item.quantity_delivered !== item.quantity_accepted || Number(item.unit_price_planned ?? 0) !== Number(item.unit_price_real ?? 0))
}

export function canCreateReceptions(role?: UserRole) {
  return role === 'direction' || role === 'magasinier'
}

export function canValidateReceptions(role?: UserRole) {
  return role === 'direction' || role === 'magasinier'
}

export function canValidateReceptionWithAnomalies(role?: UserRole) {
  return role === 'direction'
}

export function canExportReceptions(role?: UserRole) {
  return role ? ['direction', 'magasinier', 'acheteur', 'comptabilite'].includes(role) : false
}
