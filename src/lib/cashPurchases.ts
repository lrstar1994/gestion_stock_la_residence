import { z } from 'zod'
import type { Article, Unit } from './catalog'
import type { Profile, UserRole } from './validation'

export const cashPurchaseStatuses = ['en_attente', 'valide', 'especes_remises', 'retour_partiel', 'retour_complet', 'cloture', 'refuse'] as const
export const cashPurchaseSources = ['caisse_principale', 'caisse_privilege', 'caisse_piscine'] as const
export const differenceTypes = ['change_not_returned', 'price_difference', 'quantity_missing', 'product_not_conforming', 'invoice_error', 'advance_overrun'] as const

export type CashPurchaseStatus = (typeof cashPurchaseStatuses)[number]
export type CashPurchaseSource = (typeof cashPurchaseSources)[number]
export type DifferenceType = (typeof differenceTypes)[number]

export const cashPurchaseStatusLabels: Record<CashPurchaseStatus, string> = {
  en_attente: 'En attente',
  valide: 'Valide',
  especes_remises: 'Especes remises',
  retour_partiel: 'Retour partiel',
  retour_complet: 'Retour complet',
  cloture: 'Cloture',
  refuse: 'Refuse',
}

export const cashPurchaseSourceLabels: Record<CashPurchaseSource, string> = {
  caisse_principale: 'Caisse principale',
  caisse_privilege: 'Caisse Le Privilege',
  caisse_piscine: 'Caisse Piscine',
}

export const differenceTypeLabels: Record<DifferenceType, string> = {
  change_not_returned: 'Monnaie non rendue',
  price_difference: 'Prix different',
  quantity_missing: 'Quantite manquante',
  product_not_conforming: 'Produit non conforme',
  invoice_error: 'Erreur de facture',
  advance_overrun: "Depassement d'avance",
}

export type CashPurchase = {
  id: string
  reference: string
  buyer_id: string
  cash_source: CashPurchaseSource
  reason: string
  purchase_date: string | null
  request_date: string
  total_estimated: number
  amount_requested: number
  amount_validated: number
  amount_given: number
  total_purchased: number
  change_expected: number
  change_returned: number
  difference: number
  validated_by: string | null
  validated_at: string | null
  validation_comment: string | null
  given_by: string | null
  given_at: string | null
  closed_by: string | null
  closed_at: string | null
  closing_comment: string | null
  status: CashPurchaseStatus
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  buyer?: Pick<Profile, 'id' | 'full_name' | 'role'>
  validator?: Pick<Profile, 'id' | 'full_name'>
  cashier?: Pick<Profile, 'id' | 'full_name'>
  closer?: Pick<Profile, 'id' | 'full_name'>
  cash_purchase_items?: CashPurchaseItem[]
  cash_purchase_receipts?: CashPurchaseReceipt[]
  cash_purchase_differences?: CashPurchaseDifference[]
}

export type CashPurchaseItem = {
  id?: string
  cash_purchase_id?: string
  article_id: string
  purchase_need_id?: string | null
  quantity_planned: number
  quantity_bought: number
  unit_id: string
  unit_price_estimated: number
  unit_price_real: number
  total_estimated: number
  total_real: number
  invoice_number?: string | null
  invoice_date?: string | null
  supplier?: string | null
  comment?: string | null
  articles?: Pick<Article, 'id' | 'name'> & { units?: Pick<Unit, 'id' | 'name' | 'abbreviation'> }
  units?: Pick<Unit, 'id' | 'name' | 'abbreviation'>
}

export type CashPurchaseReceipt = {
  id: string
  cash_purchase_id: string
  file_url: string
  file_name: string
  file_size: number | null
  mime_type: string | null
  description: string | null
  uploaded_at: string
  uploaded_by: string | null
}

export type CashPurchaseDifference = {
  id: string
  cash_purchase_id: string
  difference_type: DifferenceType
  amount: number
  description: string
  status: 'a_justifier' | 'justifie' | 'valide'
  justified_by: string | null
  justified_at: string | null
  justification: string | null
  validated_by: string | null
  validated_at: string | null
  created_at: string
}

export const cashPurchaseItemSchema = z.object({
  article_id: z.string().min(1, 'Article obligatoire'),
  purchase_need_id: z.string().optional(),
  quantity_planned: z.number().positive('La quantite doit etre superieure a 0'),
  unit_id: z.string().min(1, "L'unite est obligatoire"),
  unit_price_estimated: z.number().min(0),
})

export const cashPurchaseSchema = z.object({
  buyer_id: z.string().min(1, 'Acheteur obligatoire'),
  cash_source: z.enum(cashPurchaseSources),
  reason: z.string().min(1, 'Le motif est obligatoire'),
  purchase_date: z.string().optional(),
  request_date: z.string().min(1),
  items: z.array(cashPurchaseItemSchema).min(1, 'Veuillez ajouter au moins un article'),
})

export type CashPurchaseFormValues = z.infer<typeof cashPurchaseSchema>
export type CashPurchaseItemFormValues = z.infer<typeof cashPurchaseItemSchema>

export function canCreateCashPurchases(role?: UserRole) {
  return role === 'direction' || role === 'acheteur'
}

export function canValidateCashPurchases(role?: UserRole) {
  return role === 'direction'
}

export function canGiveCash(role?: UserRole) {
  return role === 'direction' || role === 'caisse'
}

export function canEnterCashReturn(role?: UserRole) {
  return role === 'direction' || role === 'acheteur'
}

export function canExportCashPurchases(role?: UserRole) {
  return role === 'direction' || role === 'comptabilite'
}

export function calculateCashTotals(items: Array<Pick<CashPurchaseItemFormValues, 'quantity_planned' | 'unit_price_estimated'>>) {
  return items.reduce((sum, item) => sum + Number(item.quantity_planned ?? 0) * Number(item.unit_price_estimated ?? 0), 0)
}

export function calculateReturnTotals(items: Array<Pick<CashPurchaseItem, 'quantity_bought' | 'unit_price_real'>>) {
  return items.reduce((sum, item) => sum + Number(item.quantity_bought ?? 0) * Number(item.unit_price_real ?? 0), 0)
}
