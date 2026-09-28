import { supabase } from '../../lib/supabase'
import type { NormalActualPurchasePrice, PurchasePriceClassification, PurchasePriceSourceType } from '../../lib/purchasePrices'

export async function getLastNormalActualPurchasePrice(articleId: string) {
  const { data, error } = await supabase.schema('stock').rpc('get_last_normal_actual_purchase_price', { p_article_id: articleId })
  if (error) throw error
  return (data?.[0] ?? null) as NormalActualPurchasePrice | null
}

export async function getLastNormalActualPurchasePrices(articleIds: string[]) {
  if (articleIds.length === 0) return []
  const { data, error } = await supabase.schema('stock').rpc('get_last_normal_actual_purchase_prices', { p_article_ids: articleIds })
  if (error) throw error
  return (data ?? []) as NormalActualPurchasePrice[]
}

export async function qualifyPurchasePrice(input: {
  sourceType: PurchasePriceSourceType
  sourceLineId: string
  classification: PurchasePriceClassification
  reason?: string | null
}) {
  const { data, error } = await supabase.schema('stock').rpc('qualify_purchase_price', {
    p_source_type: input.sourceType,
    p_source_line_id: input.sourceLineId,
    p_classification: input.classification,
    p_reason: input.reason ?? null,
  })
  if (error) throw error
  return data as string
}
