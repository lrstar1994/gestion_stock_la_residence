import { z } from 'zod'

export const userRoles = [
  'direction',
  'chef_cuisine',
  'fiche_technique',
  'magasinier',
  'caisse',
  'comptabilite',
  'acheteur',
  'point_vente',
  'maintenance',
  'consultation',
] as const

export const userStatuses = ['pending_validation', 'active', 'inactive', 'rejected'] as const

export type UserRole = (typeof userRoles)[number]
export type UserStatus = (typeof userStatuses)[number]

export type Profile = {
  id: string
  user_id: string
  email: string
  full_name: string
  role: UserRole
  status: UserStatus
  created_at: string
  updated_at: string
  validated_by: string | null
  validated_at: string | null
  rejected_at: string | null
  rejection_reason: string | null
  created_by: string | null
}

export const roleLabels: Record<UserRole, string> = {
  direction: 'Direction',
  chef_cuisine: 'Chef cuisine',
  fiche_technique: 'Fiche Technique',
  magasinier: 'Magasinier',
  caisse: 'Caisse',
  comptabilite: 'Comptabilite',
  acheteur: 'Acheteur',
  point_vente: 'Point de vente',
  maintenance: 'Maintenance',
  consultation: 'Consultation',
}

export const statusLabels: Record<UserStatus, string> = {
  pending_validation: 'En attente',
  active: 'Actif',
  inactive: 'Desactive',
  rejected: 'Refuse',
}

export const registerSchema = z
  .object({
    email: z.string().email('Adresse email invalide'),
    fullName: z.string().min(2, 'Le nom complet est obligatoire'),
    password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caracteres'),
    confirmPassword: z.string().min(8, 'Veuillez confirmer le mot de passe'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  })

export const loginSchema = z.object({
  email: z.string().email('Adresse email invalide'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caracteres'),
})

export const profileSchema = z.object({
  fullName: z.string().min(2, 'Le nom complet est obligatoire'),
})

export const rejectionSchema = z.object({
  reason: z.string().min(3, 'Le motif du refus est obligatoire'),
})

export const roleSchema = z.object({
  role: z.enum(userRoles),
})

export const userUpdateSchema = z.object({
  role: z.enum(userRoles),
  status: z.enum(['active', 'inactive']),
})
