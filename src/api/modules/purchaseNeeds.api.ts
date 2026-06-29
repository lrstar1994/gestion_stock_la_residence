import { supabase } from '../../lib/supabase'
import type { Article } from '../../lib/catalog'
import type { Supplier } from '../../lib/suppliers'
import type {
  NeedOrigin,
  NeedStatus,
  NeedUrgency,
  PurchaseGroup,
  PurchaseNeedFormValues,
  PurchaseNeedGlobal,
} from '../../lib/purchaseNeeds'

type PurchaseNeedFilters = {
  search?: string
  status?: NeedStatus | 'all'
  origin?: NeedOrigin | 'all'
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

  if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status)
  if (filters.origin && filters.origin !== 'all') query = query.eq('origin', filters.origin)
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
  const total = values.quantity * Number(values.estimated_price ?? 0)
  const { error } = await supabase.schema('stock').from('purchase_needs').insert({
    article_id: values.article_id,
    quantity: values.quantity,
    quantity_needed: values.quantity,
    unit_id: values.unit_id,
    origin: values.origin,
    urgency: values.urgency,
    estimated_price: values.estimated_price ?? null,
    estimated_cost: total,
    budget: values.budget ?? null,
    requested_date: values.requested_date || null,
    comment: cleanNullable(values.comment),
    supplier_id: values.supplier_id || null,
    status: 'a_faire',
    created_by: profileId,
    updated_by: profileId,
  })

  if (error) throw error
}

export async function updatePurchaseNeed(id: string, values: PurchaseNeedFormValues, profileId?: string) {
  const need = await getPurchaseNeed(id)
  if (need.status === 'valide') throw new Error('Ce besoin a deja ete valide')
  if (need.status === 'regroupe') throw new Error('Ce besoin a deja ete regroupe')

  const total = values.quantity * Number(values.estimated_price ?? 0)
  const { error } = await supabase.schema('stock')
    .from('purchase_needs')
    .update({
      article_id: values.article_id,
      quantity: values.quantity,
      quantity_needed: values.quantity,
      unit_id: values.unit_id,
      origin: values.origin,
      urgency: values.urgency,
      estimated_price: values.estimated_price ?? null,
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
