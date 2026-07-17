import { z } from 'zod'
import { invoiceTaxModes, supplierTaxStatuses } from './materialCosts'
import type { InvoiceTaxMode, SupplierTaxStatus } from './materialCosts'
import type { UserRole } from './validation'

export type Supplier = {
  id: string
  name: string
  contact: string | null
  phone: string | null
  email: string | null
  nif: string | null
  stat: string | null
  supplier_tax_status: SupplierTaxStatus | null
  is_identified: boolean | null
  usually_issues_vat_invoice: boolean | null
  default_vat_rate: number | null
  default_vat_recoverable: boolean | null
  default_invoice_tax_mode: InvoiceTaxMode | null
  is_usual_without_nif_stat: boolean | null
  default_declared_extra_tax_enabled: boolean | null
  default_declared_extra_tax_rate: number | null
  occasional_purchase_alert_threshold: number | null
  address: string | null
  notes: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export const supplierSchema = z.object({
  name: z.string().min(1, 'Le nom est obligatoire'),
  contact: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Adresse email invalide').optional().or(z.literal('')),
  nif: z.string().optional(),
  stat: z.string().optional(),
  supplier_tax_status: z.enum(supplierTaxStatuses).optional(),
  is_identified: z.boolean().optional(),
  usually_issues_vat_invoice: z.boolean().optional(),
  default_vat_rate: z.number().min(0).optional(),
  default_vat_recoverable: z.boolean().optional(),
  default_invoice_tax_mode: z.enum(invoiceTaxModes).optional(),
  is_usual_without_nif_stat: z.boolean().optional(),
  default_declared_extra_tax_enabled: z.boolean().optional(),
  default_declared_extra_tax_rate: z.number().min(0).optional(),
  occasional_purchase_alert_threshold: z.number().min(0).optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
})

export type SupplierFormValues = z.infer<typeof supplierSchema>

export function canManageSuppliers(role?: UserRole) {
  return role === 'direction' || role === 'acheteur'
}

export function canViewSuppliers(role?: UserRole) {
  return role === 'direction' || role === 'acheteur' || role === 'comptabilite'
}
