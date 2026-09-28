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

export const supplierBusinessTypes = ['societe', 'entreprise_individuelle', 'personne_physique', 'informel', 'a_verifier'] as const
export const supplierUsageTypes = ['habituel', 'occasionnel', 'a_verifier'] as const
export const supplierProvidedServiceTags = ['epicerie', 'boissons', 'produits_frais', 'legumes', 'fruits', 'emballages', 'entretien', 'maintenance', 'transport', 'administratif', 'petit_materiel', 'generaliste', 'autres'] as const

export type SupplierBusinessType = (typeof supplierBusinessTypes)[number]
export type SupplierUsageType = (typeof supplierUsageTypes)[number]
export type SupplierProvidedServiceTag = (typeof supplierProvidedServiceTags)[number]

export const supplierBusinessTypeLabels: Record<SupplierBusinessType, string> = {
  societe: 'Societe',
  entreprise_individuelle: 'Entreprise individuelle',
  personne_physique: 'Personne physique',
  informel: 'Informel',
  a_verifier: 'A verifier',
}

export const supplierUsageTypeLabels: Record<SupplierUsageType, string> = {
  habituel: 'Fournisseur habituel',
  occasionnel: 'Fournisseur occasionnel',
  a_verifier: 'A verifier',
}

export const supplierProvidedServiceLabels: Record<SupplierProvidedServiceTag, string> = {
  epicerie: 'Epicerie',
  boissons: 'Boissons',
  produits_frais: 'Produits frais',
  legumes: 'Legumes',
  fruits: 'Fruits',
  emballages: 'Emballages',
  entretien: 'Entretien',
  maintenance: 'Maintenance',
  transport: 'Transport',
  administratif: 'Administratif',
  petit_materiel: 'Petit materiel',
  generaliste: 'Generaliste',
  autres: 'Autres',
}

export type QuickSupplierFormValues = {
  name: string
  legal_name?: string
  business_type: SupplierBusinessType
  usage_type: SupplierUsageType
  nif?: string
  stat?: string
  vat_status: 'yes' | 'no' | 'unknown'
  fiscal_status: 'complete' | 'to_check'
  contact?: string
  phone?: string
  whatsapp?: string
  email?: string
  address?: string
  payment_mode?: string
  payment_terms?: string
  aliases?: string
  provided_services: SupplierProvidedServiceTag[]
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

export function buildQuickSupplierNotes(values: QuickSupplierFormValues) {
  return [
    values.legal_name ? `Raison sociale : ${values.legal_name}` : '',
    `Type : ${supplierBusinessTypeLabels[values.business_type]}`,
    `Usage : ${supplierUsageTypeLabels[values.usage_type]}`,
    `Statut fiscal : ${values.fiscal_status === 'complete' ? 'Complet' : 'A verifier'}`,
    values.whatsapp ? `WhatsApp : ${values.whatsapp}` : '',
    values.payment_mode ? `Mode paiement : ${values.payment_mode}` : '',
    values.payment_terms ? `Conditions paiement : ${values.payment_terms}` : '',
    values.aliases ? `Alias / mots-cles : ${values.aliases}` : '',
    values.provided_services.length > 0 ? `Produits / services : ${values.provided_services.map((tag) => supplierProvidedServiceLabels[tag]).join(', ')}` : '',
    values.fiscal_status === 'to_check' ? 'Alerte : Fiche fournisseur a completer' : '',
  ].filter(Boolean).join('\n')
}

export function canManageSuppliers(role?: UserRole) {
  return role === 'direction' || role === 'acheteur'
}

export function canViewSuppliers(role?: UserRole) {
  return role === 'direction' || role === 'acheteur' || role === 'comptabilite'
}
