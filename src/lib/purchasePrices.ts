export const purchasePriceClassifications = ['normal', 'promotional', 'exceptional'] as const
export type PurchasePriceClassification = (typeof purchasePriceClassifications)[number]

export type PurchasePriceSourceType = 'cash_purchase_item' | 'reception_item' | 'invoice_item'

export type NormalActualPurchasePrice = {
  article_id: string
  classification: 'normal'
  actual_unit_price_source: number
  source_unit_id: string | null
  normalized_unit_price: number | null
  normalized_unit_id: string | null
  conversion_factor: number | null
  effective_date: string
  supplier_id: string | null
  source_type: PurchasePriceSourceType
  source_id: string
  source_line_id: string
  tax_treatment: string | null
  vat_rate: number | null
  price_basis: string | null
  source_status: string
}

export const purchasePriceClassificationLabels: Record<PurchasePriceClassification, string> = {
  normal: 'NORMAL',
  promotional: 'PROMOTIONNEL',
  exceptional: 'EXCEPTIONNEL',
}
