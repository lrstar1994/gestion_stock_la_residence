import { z } from 'zod'
import type { UserRole } from './validation'

export type Supplier = {
  id: string
  name: string
  contact: string | null
  phone: string | null
  email: string | null
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
