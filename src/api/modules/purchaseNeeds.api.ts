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
  PurchaseGroup,
  PurchaseNeedFormValues,
  PurchaseNeedGlobal,
  RequestingService,
} from '../../lib/purchaseNeeds'

type PurchaseNeedFilters = {
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
  const isTaxExcluded = Boolean(values.price_input_is_tax_excluded)
  const estimatedPriceHt = isTaxExcluded ? inputAmount : inputAmount / (1 + vatRate / 100)
  const estimatedPriceTtc = isTaxExcluded ? inputAmount * (1 + vatRate / 100) : inputAmount
  const estimatedVatAmount = Math.max(0, estimatedPriceTtc - estimatedPriceHt)

  return {
    inputAmount,
    vatRate,
    isTaxExcluded,
    estimatedPriceHt,
    estimatedPriceTtc,
    estimatedVatAmount,
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
    .select('*, articles(id, name, default_supplier, min_stock, families(id, name)), units(id, name, abbreviation), suppliers(id, name), events(id, name), requester:profiles!purchase_needs_created_by_fkey(id, full_name, role), validator:profiles!purchase_needs_validated_by_fkey(id, full_name)', { count: 'exact' })
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
  if (filters.articleId) query = query.eq('article_id', filters.articleId)
  if (filters.supplierId) query = query.eq('supplier_id', filters.supplierId)
  if (filters.fromDate) query = query.gte('created_at', filters.fromDate)
  if (filters.toDate) query = query.lte('created_at', filters.toDate)

  const { data, error, count } = await query
  if (error) throw error

  let needs = (data ?? []) as PurchaseNeedGlobal[]
  if (filters.familyId) needs = needs.filter((need) => need.articles?.families?.id === filters.familyId)
  if (filters.search?.trim()) {
    const term = filters.search.trim().toLowerCase()
    needs = needs.filter((need) => `${need.articles?.name ?? ''} ${need.comment ?? ''}`.toLowerCase().includes(term))
  }

  return { needs, total: count ?? needs.length }
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
    vat_rate: tax.vatRate,
    estimated_vat_amount: tax.estimatedVatAmount,
    estimated_price_ttc: tax.estimatedPriceTtc,
    estimated_cost: total,
    budget: values.budget ?? null,
    requested_date: values.requested_date || null,
    comment: cleanNullable(values.comment),
    supplier_id: values.supplier_id || null,
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
      vat_rate: tax.vatRate,
      estimated_vat_amount: tax.estimatedVatAmount,
      estimated_price_ttc: tax.estimatedPriceTtc,
      estimated_cost: total,
      budget: values.budget ?? null,
      requested_date: values.requested_date || null,
      comment: cleanNullable(values.comment),
      supplier_id: values.supplier_id || null,
      updated_by: profileId,
    })
    .eq('id', id)

  if (error) throw error
}

export async function getPurchaseNeed(id: string) {
  const { data, error } = await supabase.schema('stock')
    .from('purchase_needs')
    .select('*, articles(id, name, default_supplier, min_stock, families(id, name)), units(id, name, abbreviation), suppliers(id, name), events(id, name), requester:profiles!purchase_needs_created_by_fkey(id, full_name, role), validator:profiles!purchase_needs_validated_by_fkey(id, full_name)')
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
  if (ids.length === 0) return
  if (!supplierId) throw new Error('Veuillez selectionner un fournisseur')

  const { data: needsData, error: needsError } = await supabase.schema('stock').from('purchase_needs').select('*').in('id', ids)
  if (needsError) throw needsError
  const needs = (needsData ?? []) as PurchaseNeedGlobal[]
  if (needs.length !== ids.length || needs.some((need) => need.status !== 'valide')) {
    throw new Error('Seuls les besoins valides peuvent etre regroupes')
  }
  const total = needs.reduce((sum, need) => sum + Number(need.estimated_cost ?? 0), 0)

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

  if (error) throw error
  return data as Article
}
