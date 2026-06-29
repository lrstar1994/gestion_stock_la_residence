import { z } from 'zod'
import type { Article, Family, Unit } from './catalog'
import type { Event } from './events'
import type { Recipe } from './recipes'
import type { StockMovement } from './stock'
import type { StockOut } from './stockOuts'
import type { Profile, UserRole } from './validation'

export const salesChannels = ['whatsapp', 'facebook', 'telephone', 'reception', 'client_direct', 'formulaire', 'commercial'] as const
export const serviceModes = ['sur_place', 'take_away', 'livraison', 'room_service', 'evenement', 'seminaire'] as const
export const salesPoints = ['le_privilege', 'piscine', 'reception', 'chambre', 'evenement', 'take_away'] as const
export const productTypes = ['produit_fini', 'produit_brut'] as const
export const salesStatuses = ['validee', 'annulee', 'retournee'] as const

export type SalesChannel = (typeof salesChannels)[number]
export type ServiceMode = (typeof serviceModes)[number]
export type SalesPoint = (typeof salesPoints)[number]
export type ProductType = (typeof productTypes)[number]
export type SalesStatus = (typeof salesStatuses)[number]

export const salesChannelLabels: Record<SalesChannel, string> = {
  whatsapp: 'WhatsApp',
  facebook: 'Facebook / Messenger',
  telephone: 'Telephone',
  reception: 'Reception',
  client_direct: 'Client direct',
  formulaire: 'Formulaire',
  commercial: 'Commercial',
}

export const serviceModeLabels: Record<ServiceMode, string> = {
  sur_place: 'Sur place',
  take_away: 'Take-away',
  livraison: 'Livraison',
  room_service: 'Room service',
  evenement: 'Evenement',
  seminaire: 'Seminaire',
}

export const salesPointLabels: Record<SalesPoint, string> = {
  le_privilege: 'Le Privilege',
  piscine: 'Piscine',
  reception: 'Reception',
  chambre: 'Chambre',
  evenement: 'Evenement',
  take_away: 'Take-away',
}

export const productTypeLabels: Record<ProductType, string> = {
  produit_fini: 'Produit fini',
  produit_brut: 'Produit brut',
}

export const salesStatusLabels: Record<SalesStatus, string> = {
  validee: 'Validee',
  annulee: 'Annulee',
  retournee: 'Retournee',
}

export type SaleItem = {
  id?: string
  sale_id?: string
  article_id: string
  product_type: ProductType
  quantity: number
  quantity_offered: number
  unit_price: number
  total?: number
  discount: number
  total_after_discount?: number
  offer_reason?: string | null
  comment?: string | null
  recipe_id?: string | null
  returned_quantity?: number | null
  return_reason?: string | null
  articles?: Pick<Article, 'id' | 'name' | 'unit_id'> & { families?: Pick<Family, 'id' | 'name'>; units?: Pick<Unit, 'id' | 'name' | 'abbreviation'> }
  recipes?: Pick<Recipe, 'id' | 'name' | 'code' | 'final_price' | 'total_cost'>
}

export type SaleStockOut = {
  id: string
  sale_id: string
  sale_item_id: string
  stock_out_id: string
  stock_outs?: StockOut
}

export type SaleReturn = {
  id: string
  sale_id: string
  sale_item_id: string
  quantity: number
  reason: string
  stock_movement_id: string | null
  created_at: string
  created_by: string | null
  stock_movements?: Pick<StockMovement, 'id' | 'movement_reference' | 'quantity' | 'unit_cost' | 'total_cost'>
  creator?: Pick<Profile, 'id' | 'full_name'>
}

export type Sale = {
  id: string
  reference: string
  sale_date: string
  channel: SalesChannel
  service_mode: ServiceMode
  sales_point: SalesPoint
  client_name: string | null
  comment: string | null
  total_before_discount: number
  total_discount: number
  total_after_discount: number
  event_id: string | null
  status: SalesStatus
  cancelled_by: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  events?: Pick<Event, 'id' | 'name'>
  creator?: Pick<Profile, 'id' | 'full_name'>
  canceller?: Pick<Profile, 'id' | 'full_name'>
  sale_items?: SaleItem[]
  sale_stock_outs?: SaleStockOut[]
  sale_returns?: SaleReturn[]
}

export type SaleStatsRow = {
  key: string
  label: string
  quantity: number
  revenue: number
  averagePrice: number
}

export type SalesStatsPayload = {
  byArticle: SaleStatsRow[]
  byFamily: SaleStatsRow[]
  byChannel: SaleStatsRow[]
  byService: SaleStatsRow[]
  byPoint: SaleStatsRow[]
  byDay: SaleStatsRow[]
  byMonth: SaleStatsRow[]
  offers: SaleStatsRow[]
  summary: {
    salesCount: number
    revenue: number
    averageBasket: number
    offeredValue: number
    returnedQuantity: number
  }
}

export const saleItemSchema = z.object({
  article_id: z.string().min(1, 'Article obligatoire'),
  product_type: z.enum(productTypes),
  quantity: z.number().min(0, 'La quantite ne peut pas etre negative'),
  quantity_offered: z.number().min(0).default(0),
  unit_price: z.number().positive('Le prix unitaire doit etre superieur a 0'),
  discount: z.number().min(0).default(0),
  offer_reason: z.string().optional(),
  comment: z.string().optional(),
  recipe_id: z.string().optional(),
})

export const saleFormSchema = z.object({
  sale_date: z.string().min(1),
  channel: z.enum(salesChannels),
  service_mode: z.enum(serviceModes),
  sales_point: z.enum(salesPoints),
  location_id: z.string().min(1, 'Localisation obligatoire pour la sortie de stock'),
  client_name: z.string().optional(),
  comment: z.string().optional(),
  event_id: z.string().optional(),
  items: z.array(saleItemSchema).min(1, 'Veuillez ajouter au moins un article'),
}).superRefine((values, context) => {
  values.items.forEach((item, index) => {
    if (item.quantity_offered > item.quantity) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['items', index, 'quantity_offered'], message: 'La quantite offerte ne peut pas depasser la quantite vendue' })
    }
    if (item.quantity_offered > 0 && !item.offer_reason?.trim()) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['items', index, 'offer_reason'], message: 'Le motif est obligatoire pour une offre' })
    }
  })
})

export type SaleFormValues = z.infer<typeof saleFormSchema>

export function calculateSaleTotals(items: Array<Pick<SaleItem, 'quantity' | 'quantity_offered' | 'unit_price' | 'discount'>>) {
  return items.reduce((totals, item) => {
    const billableQuantity = Math.max(0, Number(item.quantity ?? 0) - Number(item.quantity_offered ?? 0))
    const beforeDiscount = billableQuantity * Number(item.unit_price ?? 0)
    const discount = Number(item.discount ?? 0)
    return {
      beforeDiscount: totals.beforeDiscount + beforeDiscount,
      discount: totals.discount + discount,
      afterDiscount: totals.afterDiscount + Math.max(0, beforeDiscount - discount),
    }
  }, { beforeDiscount: 0, discount: 0, afterDiscount: 0 })
}

export function canCreateSales(role?: UserRole) {
  return role === 'direction' || role === 'point_vente'
}

export function canCancelSales(role?: UserRole) {
  return role === 'direction'
}

export function canExportSales(role?: UserRole) {
  return role ? ['direction', 'comptabilite', 'point_vente'].includes(role) : false
}
