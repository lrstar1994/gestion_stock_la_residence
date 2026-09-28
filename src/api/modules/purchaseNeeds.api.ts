import { supabase } from '../../lib/supabase'
import type { Article } from '../../lib/catalog'
import type { Supplier } from '../../lib/suppliers'
import type {
  NeedOrigin,
  NeedCalculationSource,
  NeedDestination,
  NeedStatus,
  NeedType,
  NeedUrgency,
  PurchaseIntendedUse,
  PurchaseGroup,
  PurchaseNeedFormValues,
  PurchaseNeedGlobal,
  RequestingService,
} from '../../lib/purchaseNeeds'

type CashPurchaseProcessing = { id: string; reference: string | null; status: string | null; cash_status?: string | null; reception_status?: string | null; stock_entry_status?: string | null }

type PurchaseNeedFilters = {
  id?: string
  search?: string
  status?: NeedStatus | 'all' | 'open'
  origin?: NeedOrigin | 'all'
  type?: NeedType | 'all'
  destination?: NeedDestination | 'all'
  source?: NeedCalculationSource | 'all'
  service?: RequestingService | 'all'
  urgency?: NeedUrgency | 'all'
  familyId?: string
  articleId?: string
  supplierId?: string
  fromDate?: string
  toDate?: string
  page?: number
  pageSize?: number
}

function cleanNullable(value?: string) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

const DEFAULT_VAT_RATE = 20

function calculateTaxValues(values: PurchaseNeedFormValues) {
  const inputAmount = Number(values.price_input_amount ?? values.estimated_price ?? 0)
  const vatRate = Number(values.vat_rate ?? DEFAULT_VAT_RATE)
  const treatment = values.tax_treatment
  const isTaxExcluded = treatment === 'ht_add_vat'
  const isNoVat = treatment === 'no_vat'
  const estimatedPriceHt = treatment === 'ht_add_vat' ? inputAmount : (treatment === 'ttc_included' ? inputAmount / (1 + vatRate / 100) : inputAmount)
  const estimatedPriceTtc = treatment === 'ht_add_vat' ? inputAmount * (1 + vatRate / 100) : inputAmount
  const estimatedVatAmount = Math.max(0, estimatedPriceTtc - estimatedPriceHt)

  return {
    inputAmount,
    vatRate,
    isTaxExcluded,
    estimatedPriceHt,
    estimatedPriceTtc,
    estimatedVatAmount,
    estimatedPayableAmount: isNoVat || treatment === 'ttc_included' ? inputAmount : estimatedPriceTtc,
  }
}

function deriveLegacyOrigin(values: PurchaseNeedFormValues): NeedOrigin {
  if (values.source_du_calcul === 'besoins_theoriques_evenement' || values.destination_prevue === 'evenement_banquet_seminaire') return 'evenement'
  if (values.source_du_calcul === 'seuil_stock') return 'seuil_minimum'
  if (values.destination_prevue === 'maintenance_travaux' || values.service_demandeur === 'maintenance') return 'maintenance'
  if (values.destination_prevue === 'chambres_hebergement' || values.service_demandeur === 'hebergement') return 'chambres'
  if (values.destination_prevue === 'administration_bureau' || values.service_demandeur === 'administration') return 'administration'
  if (values.destination_prevue === 'cuisine_production' || values.source_du_calcul === 'fiche_technique') return 'production'
  return values.origin
}

export async function listPurchaseNeedsGlobal(filters: PurchaseNeedFilters = {}) {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 20
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase.schema('stock')
    .from('purchase_needs')
    .select('*, articles(id, name, default_supplier, min_stock, families(id, name)), units(id, name, abbreviation), suppliers(id, name), events(id, name), intended_uses:purchase_intended_uses!purchase_needs_intended_use_id_fkey(id, code, label), requester:profiles!purchase_needs_created_by_fkey(id, full_name, role), validator:profiles!purchase_needs_validated_by_fkey(id, full_name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filters.status === 'open' || !filters.status) query = query.in('status', ['a_faire', 'en_cours', 'valide'])
  else if (filters.status !== 'all') query = query.eq('status', filters.status)
  if (filters.origin && filters.origin !== 'all') query = query.eq('origin', filters.origin)
  if (filters.type && filters.type !== 'all') query = query.eq('type_de_besoin', filters.type)
  if (filters.destination && filters.destination !== 'all') query = query.eq('destination_prevue', filters.destination)
  if (filters.source && filters.source !== 'all') query = query.eq('source_du_calcul', filters.source)
  if (filters.service && filters.service !== 'all') query = query.eq('service_demandeur', filters.service)
  if (filters.urgency && filters.urgency !== 'all') query = query.eq('urgency', filters.urgency)
  if (filters.id) query = query.eq('id', filters.id)
  if (filters.articleId) query = query.eq('article_id', filters.articleId)
  if (filters.supplierId) query = query.eq('supplier_id', filters.supplierId)
  if (filters.fromDate) query = query.gte('created_at', filters.fromDate)
  if (filters.toDate) query = query.lte('created_at', filters.toDate)

  let data: unknown[] | null
  let count: number | null
  try {
    const result = await query
    if (result.error) throw result.error
    data = result.data as unknown[] | null
    count = result.count
  } catch {
    let fallback = supabase.schema('stock').from('purchase_needs').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to)
    if (filters.status === 'open' || !filters.status) fallback = fallback.in('status', ['a_faire', 'en_cours', 'valide'])
    else if (filters.status !== 'all') fallback = fallback.eq('status', filters.status)
    if (filters.id) fallback = fallback.eq('id', filters.id)
    const result = await fallback
    if (result.error) throw result.error
    data = result.data as unknown[] | null
    count = result.count
  }

  let needs = (data ?? []) as PurchaseNeedGlobal[]
  const missingArticleIds = [...new Set(needs.filter((need) => need.article_id && !need.articles).map((need) => need.article_id))]
  const missingUnitIds = [...new Set(needs.filter((need) => need.unit_id && !need.units).map((need) => need.unit_id))]
  const missingRequesterIds = [...new Set(needs.filter((need) => need.created_by && !need.requester).map((need) => need.created_by))]
  if (missingArticleIds.length || missingUnitIds.length || missingRequesterIds.length) {
    const [{ data: articles }, { data: units }, { data: requesters }] = await Promise.all([
      missingArticleIds.length ? supabase.schema('stock').from('articles').select('id, name, default_supplier, min_stock, families(id, name)').in('id', missingArticleIds) : Promise.resolve({ data: [] }),
      missingUnitIds.length ? supabase.schema('stock').from('units').select('id, name, abbreviation').in('id', missingUnitIds) : Promise.resolve({ data: [] }),
      missingRequesterIds.length ? supabase.schema('stock').from('profiles').select('id, full_name, role').in('id', missingRequesterIds) : Promise.resolve({ data: [] }),
    ])
    const articleById = new Map((articles ?? []).map((article) => [article.id, article]))
    const unitById = new Map((units ?? []).map((unit) => [unit.id, unit]))
    const requesterById = new Map((requesters ?? []).map((requester) => [requester.id, requester]))
    needs = needs.map((need) => {
      const fallbackArticle = articleById.get(need.article_id)
      const article = need.articles ?? (fallbackArticle ? { ...fallbackArticle, families: Array.isArray(fallbackArticle.families) ? fallbackArticle.families[0] : fallbackArticle.families } : undefined)
      return { ...need, articles: article, units: need.units ?? unitById.get(need.unit_id), requester: need.requester ?? requesterById.get(need.created_by) }
    })
  }
  // Le fallback de compatibilité ci-dessus ne joint que purchase_needs. On
  // recharge donc séparément l'utilisation prévue afin qu'une relation
  // secondaire indisponible ne masque jamais ce libellé métier.
  const missingIntendedUseIds = [...new Set(needs.filter((need) => need.intended_use_id && !need.intended_uses).map((need) => need.intended_use_id as string))]
  if (missingIntendedUseIds.length > 0) {
    const { data: intendedUses, error: intendedUsesError } = await supabase.schema('stock')
      .from('purchase_intended_uses')
      .select('id, code, label')
      .in('id', missingIntendedUseIds)
    if (intendedUsesError) throw intendedUsesError
    const intendedUseById = new Map((intendedUses ?? []).map((intendedUse) => [intendedUse.id, intendedUse]))
    needs = needs.map((need) => ({
      ...need,
      intended_uses: need.intended_uses ?? (need.intended_use_id ? intendedUseById.get(need.intended_use_id) : null),
    }))
  }
  if (filters.familyId) needs = needs.filter((need) => need.articles?.families?.id === filters.familyId)
  if (filters.search?.trim()) {
    const term = filters.search.trim().toLowerCase()
    needs = needs.filter((need) => `${need.articles?.name ?? ''} ${need.comment ?? ''}`.toLowerCase().includes(term))
  }

  const needIds = needs.map((need) => need.id)
  if (needIds.length > 0) {
    const { data: cashItems } = await supabase.schema('stock').from('cash_purchase_items').select('purchase_need_id, cash_purchases(id, reference, status, cash_status, reception_status, stock_entry_status)').in('purchase_need_id', needIds)
    const cashByNeed = new Map((cashItems ?? []).map((row) => [row.purchase_need_id, row.cash_purchases]))
    const groupIds = [...new Set(needs.map((need) => need.group_id).filter(Boolean))] as string[]
    const { data: orders } = groupIds.length > 0 ? await supabase.schema('stock').from('purchase_orders').select('id, reference, status, group_id').in('group_id', groupIds) : { data: [] as Array<{ id: string; reference: string; status: string; group_id: string }> }
    const orderByGroup = new Map((orders ?? []).map((order) => [order.group_id, order]))
    needs = needs.map((need) => {
      const rawCash = cashByNeed.get(need.id) as unknown as CashPurchaseProcessing | CashPurchaseProcessing[] | null | undefined
      const cash = Array.isArray(rawCash) ? rawCash[0] : rawCash
      const order = orderByGroup.get(need.group_id ?? '')
      return { ...need, processing: cash ? { kind: 'cash' as const, id: cash.id, reference: cash.reference, status: cash.status, cashStatus: cash.cash_status, receptionStatus: cash.reception_status, stockEntryStatus: cash.stock_entry_status } : order ? { kind: 'supplier' as const, id: order.id, reference: order.reference, status: order.status } : null }
    })
  }

  return { needs, total: count ?? needs.length }
}

export async function listPurchaseIntendedUses(): Promise<PurchaseIntendedUse[]> {
  const { data, error } = await supabase.schema('stock')
    .from('purchase_intended_uses')
    .select('id, code, label, is_active, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('label', { ascending: true })
  if (error) throw error
  return (data ?? []) as PurchaseIntendedUse[]
}

export async function createPurchaseNeed(values: PurchaseNeedFormValues, profileId: string) {
  const tax = calculateTaxValues(values)
  const total = values.quantity * tax.estimatedPriceHt
  const origin = deriveLegacyOrigin(values)
  const { data, error } = await supabase.schema('stock').from('purchase_needs').insert({
    article_id: values.article_id,
    quantity: values.quantity,
    quantity_needed: values.quantity,
    unit_id: values.unit_id,
    origin,
    type_de_besoin: values.type_de_besoin ?? 'besoin_ponctuel',
    destination_prevue: values.destination_prevue ?? 'stock_general',
    source_du_calcul: values.source_du_calcul ?? 'saisie_manuelle',
    service_demandeur: values.service_demandeur ?? 'cuisine',
    urgency: values.urgency,
    estimated_price: tax.estimatedPriceHt,
    price_input_amount: tax.inputAmount,
    price_input_is_tax_excluded: tax.isTaxExcluded,
    tax_treatment: values.tax_treatment,
    vat_rate: tax.vatRate,
    estimated_vat_amount: tax.estimatedVatAmount,
    estimated_price_ttc: tax.estimatedPriceTtc,
    estimated_payable_amount: tax.estimatedPayableAmount * values.quantity,
    estimated_cost: total,
    budget: values.budget ?? null,
    requested_date: values.requested_date || null,
    comment: cleanNullable(values.comment),
    supplier_id: values.supplier_id || null,
    business_origin: values.business_origin ?? 'mise_en_place',
    intended_use_id: values.intended_use_id || null,
    supply_difficulty: values.supply_difficulty ?? 'facile',
    justification: cleanNullable(values.justification),
    workflow_status: 'submitted',
    status: 'a_faire',
    created_by: profileId,
    updated_by: profileId,
  })
    .select('id')
    .single()

  if (error) throw error
  return data.id as string
}

export async function updatePurchaseNeed(id: string, values: PurchaseNeedFormValues, profileId?: string) {
  const need = await getPurchaseNeed(id)
  if (need.status === 'valide') throw new Error('Ce besoin a deja ete valide')
  if (need.status === 'regroupe') throw new Error('Ce besoin a deja ete regroupe')

  const tax = calculateTaxValues(values)
  const total = values.quantity * tax.estimatedPriceHt
  const origin = deriveLegacyOrigin(values)
  const { error } = await supabase.schema('stock')
    .from('purchase_needs')
    .update({
      article_id: values.article_id,
      quantity: values.quantity,
      quantity_needed: values.quantity,
      unit_id: values.unit_id,
      origin,
      type_de_besoin: values.type_de_besoin ?? 'besoin_ponctuel',
      destination_prevue: values.destination_prevue ?? 'stock_general',
      source_du_calcul: values.source_du_calcul ?? 'saisie_manuelle',
      service_demandeur: values.service_demandeur ?? 'cuisine',
      urgency: values.urgency,
      estimated_price: tax.estimatedPriceHt,
      price_input_amount: tax.inputAmount,
    price_input_is_tax_excluded: tax.isTaxExcluded,
      tax_treatment: values.tax_treatment,
      vat_rate: tax.vatRate,
      estimated_vat_amount: tax.estimatedVatAmount,
      estimated_price_ttc: tax.estimatedPriceTtc,
      estimated_payable_amount: tax.estimatedPayableAmount * values.quantity,
      estimated_cost: total,
      budget: values.budget ?? null,
      requested_date: values.requested_date || null,
      comment: cleanNullable(values.comment),
      supplier_id: values.supplier_id || null,
      ...(values.business_origin ? { business_origin: values.business_origin } : {}),
      ...(values.intended_use_id ? { intended_use_id: values.intended_use_id } : {}),
      ...(values.supply_difficulty ? { supply_difficulty: values.supply_difficulty } : {}),
      ...(values.justification !== undefined ? { justification: cleanNullable(values.justification) } : {}),
      updated_by: profileId,
    })
    .eq('id', id)

  if (error) throw error
}

export async function getPurchaseNeed(id: string) {
  const { data, error } = await supabase.schema('stock')
    .from('purchase_needs')
    .select('*, articles(id, name, default_supplier, min_stock, families(id, name)), units(id, name, abbreviation), suppliers(id, name), events(id, name), intended_uses:purchase_intended_uses!purchase_needs_intended_use_id_fkey(id, code, label), requester:profiles!purchase_needs_created_by_fkey(id, full_name, role), validator:profiles!purchase_needs_validated_by_fkey(id, full_name)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as PurchaseNeedGlobal
}

export async function validatePurchaseNeed(id: string, validatorProfileId?: string, comment?: string) {
  const { error } = await supabase.schema('stock')
    .from('purchase_needs')
    .update({
      status: 'valide',
      validated_by: validatorProfileId,
      validated_at: new Date().toISOString(),
      validation_comment: cleanNullable(comment),
    })
    .eq('id', id)

  if (error) throw error
}

export async function cancelPurchaseNeed(id: string, profileId: string | undefined, reason: string) {
  if (!reason.trim()) throw new Error('Motif obligatoire pour classer le besoin sans suite')
  const { data: need, error: needError } = await supabase.schema('stock').from('purchase_needs').select('id, status, decision_status, processing_mode').eq('id', id).single()
  if (needError) throw needError
  if (need.status !== 'a_faire' || (need.decision_status && need.decision_status !== 'pending') || (need.processing_mode && need.processing_mode !== 'none')) {
    throw new Error('Ce besoin est déjà orienté ou traité et ne peut plus être classé sans suite.')
  }
  const { count: cashCount, error: cashError } = await supabase.schema('stock').from('cash_purchase_items').select('id', { count: 'exact', head: true }).eq('purchase_need_id', id)
  if (cashError) throw cashError
  const { count: orderCount, error: orderError } = await supabase.schema('stock').from('purchase_order_needs').select('id', { count: 'exact', head: true }).eq('need_id', id)
  if (orderError) throw orderError
  if ((cashCount ?? 0) > 0 || (orderCount ?? 0) > 0) throw new Error('Ce besoin possède déjà un traitement lié.')
  const { error } = await supabase.schema('stock').from('purchase_needs').update({
    status: 'annule',
    decision_status: 'pending',
    processing_mode: 'none',
    validation_comment: reason.trim(),
    updated_by: profileId ?? null,
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) throw error
}
export async function refusePurchaseNeed(id: string, validatorProfileId: string | undefined, reason: string) {
  if (!reason.trim()) throw new Error('Motif obligatoire en cas de refus')
  const { error } = await supabase.schema('stock')
    .from('purchase_needs')
    .update({
      status: 'refuse',
      validated_by: validatorProfileId,
      validated_at: new Date().toISOString(),
      validation_comment: reason.trim(),
    })
    .eq('id', id)

  if (error) throw error
}

export async function applyPurchaseNeedLineDecisions(pin: string, decisions: Array<{ purchase_need_id: string; decision: 'cash' | 'supplier' | 'supplier_delivery' | 'refused'; supplier_id?: string | null; supplier_name?: string | null; supplier_phone?: string | null; refused_reason?: string | null; direction_comment?: string | null }>) {
  const { data, error } = await supabase.schema('stock').rpc('apply_purchase_need_line_decisions', { p_pin: pin, p_decisions: decisions })
  if (error) {
    const details = [error.message, error.code ? ('Code: ' + error.code) : undefined, error.details, error.hint ? ('Indice: ' + error.hint) : undefined].filter(Boolean).join(' - ')
    throw new Error(details || 'Erreur RPC decision ligne par ligne')
  }
  return data as { refused_count?: number; cash_purchases?: Array<{ id: string; reference: string }>; purchase_orders?: Array<{ id: string; reference: string; supplier_id: string }> }
}
export async function validatePurchaseNeeds(ids: string[], validatorProfileId?: string) {
  if (ids.length === 0) return
  const { error } = await supabase.schema('stock')
    .from('purchase_needs')
    .update({
      status: 'valide',
      validated_by: validatorProfileId,
      validated_at: new Date().toISOString(),
    })
    .in('id', ids)

  if (error) throw error
}

export async function groupPurchaseNeeds(ids: string[], supplierId: string, profileId?: string) {
  if (ids.length === 0) return null
  if (!supplierId) throw new Error('Veuillez selectionner un fournisseur')

  const { data: needsData, error: needsError } = await supabase.schema('stock').from('purchase_needs').select('*').in('id', ids)
  if (needsError) throw needsError
  const needs = (needsData ?? []) as PurchaseNeedGlobal[]
  if (needs.length !== ids.length || needs.some((need) => need.status !== 'valide')) {
    throw new Error('Seuls les besoins valides peuvent etre regroupes')
  }
  const total = needs.reduce((sum, need) => sum + Number(need.estimated_payable_amount ?? need.estimated_cost ?? 0), 0)

  const { data: supplier, error: supplierError } = await supabase.schema('stock').from('suppliers').select('*').eq('id', supplierId).single()
  if (supplierError) throw supplierError

  const { data: group, error: groupError } = await supabase.schema('stock')
    .from('purchase_groups')
    .insert({
      name: `Achat ${((supplier as Supplier).name)} - ${new Date().toLocaleDateString('fr-FR')}`,
      supplier_id: supplierId,
      total_estimated_cost: total,
      status: 'en_cours',
      created_by: profileId,
    })
    .select('id')
    .single()

  if (groupError) throw groupError

  const { error } = await supabase.schema('stock')
    .from('purchase_needs')
    .update({
      status: 'regroupe',
      group_id: group.id,
      supplier_id: supplierId,
      updated_by: profileId,
    })
    .in('id', ids)

  if (error) throw error
  return {
    groupId: group.id as string,
    supplierId,
    supplierName: (supplier as Supplier).name,
    needIds: ids,
  }
}

export async function autoGroupValidatedNeeds(profileId?: string) {
  const { data, error } = await supabase.schema('stock')
    .from('purchase_needs')
    .select('*, articles(id, name, default_supplier)')
    .eq('status', 'valide')
  if (error) throw error

  const { data: suppliersData, error: suppliersError } = await supabase.schema('stock').from('suppliers').select('*')
  if (suppliersError) throw suppliersError

  const suppliers = (suppliersData ?? []) as Supplier[]
  const needs = (data ?? []) as PurchaseNeedGlobal[]
  const grouped = new Map<string, string[]>()

  for (const need of needs) {
    const supplier = suppliers.find((item) => item.name.toLowerCase() === (need.articles?.default_supplier ?? '').toLowerCase())
    if (!supplier) continue
    grouped.set(supplier.id, [...(grouped.get(supplier.id) ?? []), need.id])
  }

  for (const [supplierId, ids] of grouped.entries()) {
    await groupPurchaseNeeds(ids, supplierId, profileId)
  }

  return [...grouped.values()].reduce((sum, ids) => sum + ids.length, 0)
}

export async function listPurchaseGroups() {
  const { data, error } = await supabase.schema('stock')
    .from('purchase_groups')
    .select('*, suppliers(id, name)')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as PurchaseGroup[]
}

export async function getArticleWithUnit(id: string) {
  const { data, error } = await supabase.schema('stock')
    .from('articles')
    .select('*, units(id, name, abbreviation), families(id, name)')
    .eq('id', id)
    .single()

  if (error) {
    const details = [error.message, error.code ? ('Code: ' + error.code) : undefined, error.details, error.hint ? ('Indice: ' + error.hint) : undefined].filter(Boolean).join(' - ')
    throw new Error(details || 'Erreur RPC decision ligne par ligne')
  }
  return data as Article
}
