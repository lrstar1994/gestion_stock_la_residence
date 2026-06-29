import { z } from 'zod'
import type { Article, Unit } from './catalog'
import type { Reception } from './receptions'
import type { Supplier } from './suppliers'
import type { Profile, UserRole } from './validation'

export const invoiceStatuses = ['a_verifier', 'validee', 'a_payer', 'payee', 'partiellement_paye', 'conteste', 'cloturee', 'annulee'] as const
export const paymentModes = ['especes', 'virement', 'mobile_money', 'cheque', 'credit_fournisseur', 'autre'] as const

export type InvoiceStatus = (typeof invoiceStatuses)[number]
export type PaymentMode = (typeof paymentModes)[number]

export const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  a_verifier: 'A verifier',
  validee: 'Validee',
  a_payer: 'A payer',
  payee: 'Payee',
  partiellement_paye: 'Partiellement payee',
  conteste: 'Contestee',
  cloturee: 'Cloturee',
  annulee: 'Annulee',
}

export const paymentModeLabels: Record<PaymentMode, string> = {
  especes: 'Especes',
  virement: 'Virement bancaire',
  mobile_money: 'Mobile Money',
  cheque: 'Cheque',
  credit_fournisseur: 'Credit fournisseur',
  autre: 'Autre',
}

export type InvoiceItem = {
  id?: string
  invoice_id?: string
  article_id: string
  quantity: number
  unit_id: string
  unit_price: number
  total?: number
  comment?: string | null
  articles?: Pick<Article, 'id' | 'name'> & { families?: { id: string; name: string } }
  units?: Pick<Unit, 'id' | 'name' | 'abbreviation'>
}

export type InvoicePayment = {
  id: string
  invoice_id: string
  amount: number
  payment_mode: PaymentMode
  payment_date: string
  payment_reference: string | null
  comment: string | null
  created_at: string
  created_by: string | null
  creator?: Pick<Profile, 'id' | 'full_name'>
}

export type InvoiceHistory = {
  id: string
  invoice_id: string
  action: string
  description: string | null
  created_at: string
  created_by: string | null
  actor?: Pick<Profile, 'id' | 'full_name'>
}

export type Invoice = {
  id: string
  reference: string
  supplier_id: string
  invoice_number: string
  invoice_date: string
  due_date: string
  comment: string | null
  amount_ht: number
  amount_tva: number
  amount_ttc: number
  amount_paid: number
  amount_remaining: number
  reception_id: string | null
  purchase_order_id: string | null
  cash_purchase_id: string | null
  status: InvoiceStatus
  payment_mode: PaymentMode | null
  payment_date: string | null
  payment_reference: string | null
  validated_by: string | null
  validated_at: string | null
  validation_comment: string | null
  file_url: string | null
  file_name: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  suppliers?: Supplier
  receptions?: Pick<Reception, 'id' | 'reference' | 'invoice_number' | 'total_amount'>
  invoice_items?: InvoiceItem[]
  invoice_payments?: InvoicePayment[]
  invoice_history?: InvoiceHistory[]
  validator?: Pick<Profile, 'id' | 'full_name'>
  creator?: Pick<Profile, 'id' | 'full_name'>
}

export const invoiceItemSchema = z.object({
  article_id: z.string().min(1, 'Article obligatoire'),
  quantity: z.number().positive('La quantite doit etre superieure a 0'),
  unit_id: z.string().min(1, "L'unite est obligatoire"),
  unit_price: z.number().min(0, 'Le prix ne peut pas etre negatif'),
  comment: z.string().optional(),
})

export const invoiceSchema = z.object({
  supplier_id: z.string().min(1, 'Fournisseur obligatoire'),
  invoice_number: z.string().min(1, 'Numero de facture obligatoire'),
  invoice_date: z.string().min(1, 'Date de facture obligatoire'),
  due_date: z.string().min(1, "Date d'echeance obligatoire"),
  amount_ht: z.number().min(0),
  amount_tva: z.number().min(0),
  payment_mode: z.enum(paymentModes).optional(),
  currency: z.string().default('Ar'),
  comment: z.string().optional(),
  reception_id: z.string().optional(),
  purchase_order_id: z.string().optional(),
  cash_purchase_id: z.string().optional(),
  items: z.array(invoiceItemSchema).default([]),
})

export const paymentSchema = z.object({
  amount: z.number().positive('Le montant paye doit etre superieur a 0'),
  payment_mode: z.enum(paymentModes),
  payment_date: z.string().min(1),
  payment_reference: z.string().optional(),
  comment: z.string().optional(),
})

export type InvoiceFormValues = z.infer<typeof invoiceSchema>
export type InvoicePaymentFormValues = z.infer<typeof paymentSchema>

export function calculateInvoiceItemsTotal(items: Array<Pick<InvoiceItem, 'quantity' | 'unit_price'>>) {
  return items.reduce((sum, item) => sum + Number(item.quantity ?? 0) * Number(item.unit_price ?? 0), 0)
}

export function canManageInvoices(role?: UserRole) {
  return role === 'direction' || role === 'comptabilite'
}

export function canPayInvoices(role?: UserRole) {
  return role === 'direction' || role === 'comptabilite'
}

export function canExportInvoices(role?: UserRole) {
  return role ? ['direction', 'comptabilite'].includes(role) : false
}
