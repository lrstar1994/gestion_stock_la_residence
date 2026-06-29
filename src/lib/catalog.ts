import { z } from 'zod'
import type { UserRole } from './validation'

export const articleStatuses = ['active', 'inactive', 'archived'] as const
export type ArticleStatus = (typeof articleStatuses)[number]

export const articleStatusLabels: Record<ArticleStatus, string> = {
  active: 'Actif',
  inactive: 'Inactif',
  archived: 'Archive',
}

export const catalogManagerRoles: UserRole[] = ['direction', 'chef_cuisine', 'magasinier', 'acheteur']

export function canManageArticles(role?: UserRole) {
  return role ? catalogManagerRoles.includes(role) : false
}

export function canManageCatalogSettings(role?: UserRole) {
  return role === 'direction'
}

export type Family = {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  articles_count?: number
}

export type Unit = {
  id: string
  name: string
  abbreviation: string
  created_at: string
  updated_at: string
  created_by: string | null
}

export type Location = {
  id: string
  name: string
  description: string | null
  is_magasin_general: boolean
  created_at: string
  updated_at: string
  created_by: string | null
  articles_count?: number
}

export type Article = {
  id: string
  name: string
  family_id: string
  sub_family: string | null
  unit_id: string
  packaging: string | null
  default_supplier: string | null
  min_stock: number
  status: ArticleStatus
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  families?: Pick<Family, 'id' | 'name'>
  units?: Pick<Unit, 'id' | 'name' | 'abbreviation'>
  article_locations?: Array<{ locations: Location }>
}

export const familySchema = z.object({
  name: z.string().min(1, 'Le nom est obligatoire'),
  description: z.string().optional(),
})

export const unitSchema = z.object({
  name: z.string().min(1, 'Le nom est obligatoire'),
  abbreviation: z.string().min(1, "L'abreviation est obligatoire"),
})

export const locationSchema = z.object({
  name: z.string().min(1, 'Le nom est obligatoire'),
  description: z.string().optional(),
  is_magasin_general: z.boolean(),
})

export const articleSchema = z.object({
  name: z.string().min(1, 'Le nom est obligatoire'),
  family_id: z.string().min(1, 'La famille est obligatoire'),
  sub_family: z.string().optional(),
  unit_id: z.string().min(1, "L'unite est obligatoire"),
  packaging: z.string().optional(),
  default_supplier: z.string().optional(),
  min_stock: z.number().min(0, 'Le stock minimum doit etre positif'),
  status: z.enum(articleStatuses),
  location_ids: z.array(z.string()).min(1, 'Selectionnez au moins une localisation'),
})

export type FamilyFormValues = z.infer<typeof familySchema>
export type UnitFormValues = z.infer<typeof unitSchema>
export type LocationFormValues = z.infer<typeof locationSchema>
export type ArticleFormValues = z.infer<typeof articleSchema>
