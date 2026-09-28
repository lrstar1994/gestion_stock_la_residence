import { z } from 'zod'
import type { UserRole } from './validation'

export const articleStatuses = ['active', 'inactive', 'archived'] as const
export const articleNatures = ['ingredient', 'boisson', 'consommable', 'fourniture', 'produit_entretien', 'materiel_maintenance', 'equipement', 'service', 'emballage', 'consigne', 'autre'] as const
export type ArticleStatus = (typeof articleStatuses)[number]
export type ArticleNature = (typeof articleNatures)[number]

export const articleNatureLabels: Record<ArticleNature, string> = {
  ingredient: 'Ingrédient',
  boisson: 'Boisson',
  consommable: 'Consommable',
  fourniture: 'Fourniture',
  produit_entretien: 'Produit d’entretien',
  materiel_maintenance: 'Matériel maintenance',
  equipement: 'Équipement',
  service: 'Service',
  emballage: 'Emballage',
  consigne: 'Consigne',
  autre: 'Autre',
}

export const articleStatusLabels: Record<ArticleStatus, string> = {
  active: 'Actif',
  inactive: 'Inactif',
  archived: 'Archivé',
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
  normalized_key?: string | null
  is_active?: boolean
}

export type SubCategory = {
  id: string
  family_id: string
  name: string
  created_at: string
  updated_at: string
  created_by: string | null
  families?: Pick<Family, 'id' | 'name'>
  articles_count?: number
  normalized_key?: string | null
  is_active?: boolean
}

export type Unit = {
  id: string
  name: string
  abbreviation: string
  created_at: string
  updated_at: string
  created_by: string | null
  normalized_key?: string | null
  unit_type?: string
  reference_unit_id?: string | null
  is_active?: boolean
  articles_count?: number
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
  normalized_key?: string | null
  location_type?: string
  parent_location_id?: string | null
  is_active?: boolean
  is_stock_transit?: boolean
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
  sellable_without_transformation: boolean
  usable_in_recipes: boolean
  normalized_key?: string | null
  nature: ArticleNature
  stockable: boolean
  locations_restricted: boolean
  durable_equipment: boolean
  indicative_price: number | null
  indicative_price_note: string | null
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

export const subCategorySchema = z.object({
  family_id: z.string().min(1, 'La categorie est obligatoire'),
  name: z.string().min(1, 'Le nom est obligatoire'),
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
  family_id: z.string().min(1, 'La categorie est obligatoire'),
  sub_family: z.string().optional(),
  unit_id: z.string().min(1, "L'unite est obligatoire"),
  packaging: z.string().optional(),
  default_supplier: z.string().optional(),
  min_stock: z.number().min(0, 'Le stock minimum doit etre positif'),
  sellable_without_transformation: z.boolean(),
  usable_in_recipes: z.boolean(),
  nature: z.enum(articleNatures),
  stockable: z.boolean(),
  locations_restricted: z.boolean(),
  durable_equipment: z.boolean(),
  indicative_price: z.number().min(0, 'Le prix indicatif doit être positif').nullable(),
  indicative_price_note: z.string().optional(),
  status: z.enum(articleStatuses),
  location_ids: z.array(z.string()),
}).superRefine((values, context) => {
  if (values.stockable && values.locations_restricted && values.location_ids.length === 0) {
    context.addIssue({ code: 'custom', path: ['location_ids'], message: 'Sélectionnez au moins une localisation ou désactivez la restriction' })
  }
})

export type FamilyFormValues = z.infer<typeof familySchema>
export type SubCategoryFormValues = z.infer<typeof subCategorySchema>
export type UnitFormValues = z.infer<typeof unitSchema>
export type LocationFormValues = z.infer<typeof locationSchema>
export type ArticleFormValues = z.infer<typeof articleSchema>
