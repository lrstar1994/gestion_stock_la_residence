import { z } from 'zod'
import type { Article, Unit } from './catalog'
import type { PurchaseGroup, PurchaseNeedGlobal } from './purchaseNeeds'
import type { Supplier } from './suppliers'
import type { Profile, UserRole } from './validation'

export const purchaseOrderStatuses = ['brouillon', 'validee', 'envoyee', 'partiellement_livree', 'livree', 'reception_avec_ecart', 'annulee', 'cloturee'] as const
export const orderDifferenceTypes = ['quantite_manquante', 'produit_non_conforme', 'prix_different', 'autre'] as const
export type PurchaseOrderStatus = (typeof purchaseOrderStatuses)[number]
export type OrderDifferenceType = (typeof orderDifferenceTypes)[number]
export type OrderDifferenceStatus = 'aucun' | 'a_justifier' | 'valide'

export const purchaseOrderStatusLabels: Record<PurchaseOrderStatus, string> = {
  brouillon: 'Brouillon',
  validee: 'Validee',
  envoyee: 'Envoyee',
  partiellement_livree: 'Partiellement livree',
  livree: 'Livree',
  reception_avec_ecart: 'Reception avec ecart',
  annulee: 'Annulee',
  cloturee: 'Cloturee',
}

export const orderDifferenceTypeLabels: Record<OrderDifferenceType, string> = {
  quantite_manquante: 'Quantite manquante',
  produit_non_conforme: 'Produit non conforme',
  prix_different: 'Prix different',
  autre: 'Autre',
}

export type PurchaseOrderItem = {
  id?: string
  purchase_order_id?: string
  article_id: string
  quantity_ordered: number
  quantity_received: number
  quantity_remaining?: number
  unit_id: string
  unit_price: number
  total?: number
  comment?: string | null
  difference_type?: OrderDifferenceType | null
  difference_comment?: string | null
  difference_status?: OrderDifferenceStatus
  difference_validated_by?: string | null
  difference_validated_at?: string | null
  articles?: Pick<Article, 'id' | 'name'> & { families?: { id: string; name: string } }
  units?: Pick<Unit, 'id' | 'name' | 'abbreviation'>
}

export type PurchaseOrderNeedLink = {
  id: string
  purchase_order_id: string
  need_id: string
  purchase_needs?: PurchaseNeedGlobal
}

export type PurchaseOrderHistory = {
  id: string
  purchase_order_id: string
  action: string
  description: string | null
  created_at: string
  created_by: string | null
  actor?: Pick<Profile, 'id' | 'full_name'>
}

export type PurchaseOrderDocument = {
  id: string
  purchase_order_id: string
  file_url: string
  file_name: string
  file_size: number | null
  mime_type: string | null
  document_type: string
  description: string | null
  uploaded_at: string
  uploaded_by: string | null
}

export type PurchaseOrder = {
  id: string
  reference: string
  supplier_id: string
  order_date: string
  delivery_date: string
  supplier_reference: string | null
  payment_terms: string | null
  delivery_mode: string | null
  comment: string | null
  total_amount: number
  validated_by: string | null
  validated_at: string | null
  validation_comment: string | null
  sent_at: string | null
  sent_by: string | null
  file_url: string | null
  status: PurchaseOrderStatus
  cancellation_reason: string | null
  cancelled_by: string | null
  cancelled_at: string | null
  closed_by: string | null
  closed_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  suppliers?: Supplier
  creator?: Pick<Profile, 'id' | 'full_name' | 'role'>
  validator?: Pick<Profile, 'id' | 'full_name'>
  sender?: Pick<Profile, 'id' | 'full_name'>
  purchase_order_items?: PurchaseOrderItem[]
  purchase_order_needs?: PurchaseOrderNeedLink[]
  purchase_order_history?: PurchaseOrderHistory[]
  purchase_order_documents?: PurchaseOrderDocument[]
}

export const purchaseOrderItemSchema = z.object({
  article_id: z.string().min(1, 'Article obligatoire'),
  quantity_ordered: z.number().positive('La quantite doit etre superieure a 0'),
  unit_id: z.string().min(1, "L'unite est obligatoire"),
  unit_price: z.number().min(0, 'Le prix ne peut pas etre negatif'),
  comment: z.string().optional(),
})

export const purchaseOrderSchema = z.object({
  supplier_id: z.string().min(1, 'Fournisseur obligatoire'),
  order_date: z.string().min(1, 'Date de commande obligatoire'),
  delivery_date: z.string().min(1, 'Date de livraison obligatoire'),
  supplier_reference: z.string().optional(),
  payment_terms: z.string().optional(),
  delivery_mode: z.string().optional(),
  comment: z.string().optional(),
  group_id: z.string().optional(),
  need_ids: z.array(z.string()).default([]),
  items: z.array(purchaseOrderItemSchema).min(1, 'Veuillez ajouter au moins un article'),
})

export type PurchaseOrderFormValues = z.infer<typeof purchaseOrderSchema>

export function calculateOrderTotal(items: Array<Pick<PurchaseOrderItem, 'quantity_ordered' | 'unit_price'>>) {
  return items.reduce((sum, item) => sum + Number(item.quantity_ordered ?? 0) * Number(item.unit_price ?? 0), 0)
}

export function canCreatePurchaseOrders(role?: UserRole) {
  return role === 'direction' || role === 'acheteur'
}

export function canValidatePurchaseOrders(role?: UserRole) {
  return role === 'direction'
}

export function canSendPurchaseOrders(role?: UserRole) {
  return role === 'direction' || role === 'acheteur'
}

export function canReceivePurchaseOrders(role?: UserRole) {
  return role === 'direction' || role === 'acheteur' || role === 'magasinier'
}

export function canExportPurchaseOrders(role?: UserRole) {
  return role ? ['direction', 'acheteur', 'comptabilite'].includes(role) : false
}

export function canEditPurchaseOrder(order: PurchaseOrder, role?: UserRole) {
  if (order.status !== 'brouillon') return false
  return role === 'direction' || role === 'acheteur'
}

export function groupLabel(group: PurchaseGroup) {
  return `${group.name} - ${Number(group.total_estimated_cost ?? 0).toLocaleString('fr-FR')} Ar`
}
