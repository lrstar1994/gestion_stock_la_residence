import { supabase } from '../../lib/supabase'
import { calculateOrderTotal } from '../../lib/purchaseOrders'
import type { PurchaseOrder, PurchaseOrderFormValues, PurchaseOrderItem, PurchaseOrderStatus } from '../../lib/purchaseOrders'
import type { AnomalyType, ReceptionFormValues } from '../../lib/receptions'
import { compressReceiptFile } from '../../lib/imageCompression'
import type { PurchaseGroup, PurchaseNeedGlobal } from '../../lib/purchaseNeeds'
import { createReception, listDefaultReceptionLocation, submitReception } from './receptions.api'

const PURCHASE_ORDER_FILES_BUCKET = 'purchase-order-files'

type PurchaseOrderFilters = {
  search?: string
  status?: PurchaseOrderStatus | 'all'
  supplierId?: string
  buyerId?: string
  fromDate?: string
  toDate?: string
  page?: number
  pageSize?: number
}

function cleanNullable(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export async function listPurchaseOrders(filters: PurchaseOrderFilters = {}) {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 10
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase.schema('stock')
    .from('purchase_orders')
    .select('*, suppliers(*), creator:profiles!purchase_orders_created_by_fkey(id, full_name, role), purchase_order_documents(id)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status)
  if (filters.supplierId) query = query.eq('supplier_id', filters.supplierId)
  if (filters.buyerId) query = query.eq('created_by', filters.buyerId)
  if (filters.fromDate) query = query.gte('order_date', filters.fromDate)
  if (filters.toDate) query = query.lte('order_date', filters.toDate)
  if (filters.search?.trim()) {
    const term = filters.search.trim()
    query = query.or(`id.ilike.%${term}%,reference.ilike.%${term}%,supplier_reference.ilike.%${term}%`)
  }

  const { data, error, count } = await query
  if (error) throw error
  return { orders: (data ?? []) as PurchaseOrder[], total: count ?? 0 }
}

export async function getPurchaseOrder(id: string) {
  const baseSelect = '*, suppliers(*), creator:profiles!purchase_orders_created_by_fkey(id, full_name, role)'
  let query = await supabase.schema('stock').from('purchase_orders').select(baseSelect).eq('id', id).maybeSingle()
  if (query.error) throw query.error
  let order = query.data
  if (!order) {
    query = await supabase.schema('stock').from('purchase_orders').select(baseSelect).eq('reference', decodeURIComponent(id)).maybeSingle()
    if (query.error) throw query.error
    order = query.data
  }
  if (!order) {
    const listed = await listPurchaseOrders({ search: decodeURIComponent(id), page: 1, pageSize: 10 })
    order = listed.orders.find((candidate) => candidate.id === id || candidate.reference === decodeURIComponent(id)) ?? null
  }
  if (!order) throw new Error('Commande introuvable')
  const { data: items, error: itemsError } = await supabase.schema('stock')
    .from('purchase_order_items')
    .select('*, articles(id, name, unit_id, families(id, name), units(id, name, abbreviation)), units(id, name, abbreviation), stock_unit:units!purchase_order_items_stock_unit_id_fkey(id, name, abbreviation)')
    .eq('purchase_order_id', order.id)
  if (itemsError) throw itemsError
  return { ...order, purchase_order_items: items ?? [] } as PurchaseOrder
}
export async function createPurchaseOrder(values: PurchaseOrderFormValues, profileId?: string) {
  if (!values.items || values.items.length === 0) throw new Error('Impossible de créer une commande fournisseur sans lignes d’articles')
  const total = calculateOrderTotal(values.items)
  const reference = await generatePurchaseOrderReference()

  const { data, error } = await supabase.schema('stock')
    .from('purchase_orders')
    .insert({
      reference,
      supplier_id: values.supplier_id,
      order_date: values.order_date,
      delivery_date: values.delivery_date,
      supplier_reference: cleanNullable(values.supplier_reference),
      payment_terms: cleanNullable(values.payment_terms),
      delivery_mode: cleanNullable(values.delivery_mode),
      comment: cleanNullable(values.comment),
      total_amount: total,
      status: 'brouillon',
      created_by: profileId,
      updated_by: profileId,
    })
    .select('id')
    .single()

  if (error) throw error

  await replaceOrderItems(data.id, values.items)
  await linkNeeds(data.id, values.need_ids ?? [], values.supplier_id, profileId)
  await addOrderHistory(data.id, 'creation', 'Commande creee', profileId)
  return data.id as string
}

export async function updatePurchaseOrder(id: string, values: PurchaseOrderFormValues, profileId?: string) {
  const current = await getPurchaseOrder(id)
  if (current.status !== 'brouillon') throw new Error('Une commande validee ne peut plus etre modifiee')
  await assertOrderDraftMutable(id)
  await assertNeedLinksCanBeReplaced(id, values.need_ids ?? [])

  const total = calculateOrderTotal(values.items)
  const { error } = await supabase.schema('stock')
    .from('purchase_orders')
    .update({
      supplier_id: values.supplier_id,
      order_date: values.order_date,
      delivery_date: values.delivery_date,
      supplier_reference: cleanNullable(values.supplier_reference),
      payment_terms: cleanNullable(values.payment_terms),
      delivery_mode: cleanNullable(values.delivery_mode),
      comment: cleanNullable(values.comment),
      total_amount: total,
      updated_by: profileId,
    })
    .eq('id', id)

  if (error) throw error

  await replaceOrderItems(id, values.items)
  await replaceNeedLinks(id, values.need_ids ?? [], values.supplier_id, profileId)
  await addOrderHistory(id, 'modification', 'Commande mise a jour', profileId)
}

async function replaceOrderItems(orderId: string, items: PurchaseOrderFormValues['items']) {
  await assertOrderDraftMutable(orderId)
  const { error: deleteError } = await supabase.schema('stock').from('purchase_order_items').delete().eq('purchase_order_id', orderId)
  if (deleteError) throw deleteError

  const rows = items.map((item) => ({
    purchase_order_id: orderId,
    article_id: item.article_id,
    quantity_ordered: item.quantity_ordered,
    unit_id: item.unit_id,
    stock_unit_id: item.stock_unit_id || null,
    conversion_factor: item.conversion_factor ?? 1,
    quantity_ordered_stock: item.quantity_ordered_stock ?? item.quantity_ordered,
    unit_price: item.unit_price,
    unit_price_stock: item.unit_price_stock ?? item.unit_price,
    comment: cleanNullable(item.comment),
  }))

  const { error } = await supabase.schema('stock').from('purchase_order_items').insert(rows)
  if (error) throw error
}

async function linkNeeds(orderId: string, needIds: string[], supplierId: string, profileId?: string) {
  if (needIds.length === 0) return
  const { data: needs, error: needsReadError } = await supabase.schema('stock').from('purchase_needs').select('id, status, decision_status, processing_mode').in('id', needIds)
  if (needsReadError) throw needsReadError
  if ((needs ?? []).length !== needIds.length || (needs ?? []).some((need) => need.status !== 'valide' || (need.decision_status && need.decision_status !== 'pending') || (need.processing_mode && need.processing_mode !== 'none'))) {
    throw new Error('Seuls les besoins valides et non engagés peuvent être liés à une commande')
  }
  const links = needIds.map((needId) => ({ purchase_order_id: orderId, need_id: needId }))
  const { error: linkError } = await supabase.schema('stock').from('purchase_order_needs').insert(links)
  if (linkError) throw linkError

  const { error } = await supabase.schema('stock')
    .from('purchase_needs')
    .update({ status: 'regroupe', supplier_id: supplierId, updated_by: profileId })
    .in('id', needIds)
  if (error) throw error

  const { data: groupedNeeds } = await supabase.schema('stock').from('purchase_needs').select('group_id').in('id', needIds)
  const groupIds = [...new Set((groupedNeeds ?? []).map((need) => need.group_id).filter(Boolean))]
  if (groupIds.length > 0) {
    await supabase.schema('stock').from('purchase_groups').update({ status: 'commande_creee' }).in('id', groupIds)
  }
}

async function replaceNeedLinks(orderId: string, needIds: string[], supplierId: string, profileId?: string) {
  await assertOrderDraftMutable(orderId)
  await assertNeedLinksCanBeReplaced(orderId, needIds)
  const { data: existing, error: existingError } = await supabase.schema('stock').from('purchase_order_needs').select('need_id').eq('purchase_order_id', orderId)
  if (existingError) throw existingError
  const oldIds = (existing ?? []).map((item) => item.need_id as string)

  if (oldIds.length > 0) {
    const { error: releaseError } = await supabase.schema('stock').from('purchase_needs').update({ status: 'valide', updated_by: profileId }).in('id', oldIds)
    if (releaseError) throw releaseError
  }

  const { error: deleteError } = await supabase.schema('stock').from('purchase_order_needs').delete().eq('purchase_order_id', orderId)
  if (deleteError) throw deleteError
  await linkNeeds(orderId, needIds, supplierId, profileId)
}

async function assertOrderDraftMutable(orderId: string) {
  const { data: order, error } = await supabase.schema('stock').from('purchase_orders').select('id, status').eq('id', orderId).single()
  if (error) throw error
  if (order.status !== 'brouillon') throw new Error('Les lignes et besoins ne peuvent être remplacés que sur une commande brouillon')
  const { count, error: receptionError } = await supabase.schema('stock').from('receptions').select('id', { count: 'exact', head: true }).eq('purchase_order_id', orderId)
  if (receptionError) throw receptionError
  if ((count ?? 0) > 0) throw new Error('Cette commande possède déjà une réception et ne peut plus être remplacée')
}

async function assertNeedLinksCanBeReplaced(orderId: string, requestedNeedIds: string[]) {
  const { data: existing, error: existingError } = await supabase.schema('stock').from('purchase_order_needs').select('need_id').eq('purchase_order_id', orderId)
  if (existingError) throw existingError
  const allIds = [...new Set([...(existing ?? []).map((row) => row.need_id as string), ...requestedNeedIds])]
  if (allIds.length === 0) return

  const { data: needs, error: needsError } = await supabase.schema('stock').from('purchase_needs').select('id, status, decision_status, processing_mode').in('id', allIds)
  if (needsError) throw needsError
  const byId = new Map((needs ?? []).map((need) => [need.id, need]))
  for (const id of allIds) {
    const need = byId.get(id)
    if (!need) throw new Error('Besoin introuvable lors du remplacement des liens')
    if (need.status !== 'valide' && need.status !== 'regroupe') throw new Error('Un besoin soumis, refusé ou annulé ne peut pas être détaché ou regroupé automatiquement')
    if (need.decision_status && need.decision_status !== 'pending') throw new Error('Un besoin avec une décision engagée ne peut pas être remplacé')
    if (need.processing_mode && need.processing_mode !== 'none') throw new Error('Un besoin déjà orienté ne peut pas être remplacé')
  }

  const { data: cashLinks, error: cashError } = await supabase.schema('stock').from('cash_purchase_items').select('purchase_need_id').in('purchase_need_id', allIds)
  if (cashError) throw cashError
  if ((cashLinks ?? []).length > 0) throw new Error('Un besoin déjà lié à un achat espèces ne peut pas être remplacé')
  const { data: otherLinks, error: otherError } = await supabase.schema('stock').from('purchase_order_needs').select('need_id').in('need_id', allIds).neq('purchase_order_id', orderId)
  if (otherError) throw otherError
  if ((otherLinks ?? []).length > 0) throw new Error('Un besoin déjà lié à une autre commande ne peut pas être remplacé')
}

async function generatePurchaseOrderReference() {
  const now = new Date()
  const prefix = `PO-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const { count, error } = await supabase.schema('stock')
    .from('purchase_orders')
    .select('id', { count: 'exact', head: true })
    .ilike('reference', `${prefix}-%`)
  if (error) throw error
  return `${prefix}-${String((count ?? 0) + 1).padStart(3, '0')}`
}

export async function validatePurchaseOrder(id: string, profileId?: string, comment?: string) {
  const { error } = await supabase.schema('stock')
    .from('purchase_orders')
    .update({ status: 'validee', validated_by: profileId, validated_at: new Date().toISOString(), validation_comment: cleanNullable(comment) })
    .eq('id', id)
  if (error) throw error
  await addOrderHistory(id, 'validation', 'Commande validee par la Direction', profileId)
}

export async function sendPurchaseOrder(id: string, profileId?: string, fileUrl?: string) {
  const { error } = await supabase.schema('stock')
    .from('purchase_orders')
    .update({ status: 'envoyee', sent_by: profileId, sent_at: new Date().toISOString(), file_url: cleanNullable(fileUrl) })
    .eq('id', id)
  if (error) throw error
  await addOrderHistory(id, 'envoi', 'Commande marquee comme envoyee au fournisseur', profileId)
}

export async function receivePurchaseOrder(id: string, items: PurchaseOrderItem[], profileId?: string) {
  const order = await getPurchaseOrder(id)
  const defaultLocation = await listDefaultReceptionLocation()
  if (!defaultLocation?.id) throw new Error('Localisation de reception par defaut introuvable')

  const today = new Date().toISOString().slice(0, 10)
  const currentItems = order.purchase_order_items ?? []
  const receptionItems: ReceptionFormValues['items'] = []

  for (const item of items) {
    if (!item.id) continue

    const currentItem = currentItems.find((current) => current.id === item.id)
    if (!currentItem) continue

    const targetReceived = Number(item.quantity_received ?? 0)
    const alreadyReceived = Number(currentItem.quantity_received ?? 0)
    const ordered = Number(currentItem.quantity_ordered ?? 0)
    const quantityToReceive = targetReceived - alreadyReceived

    if (targetReceived < alreadyReceived) {
      throw new Error('La quantite recue ne peut pas etre inferieure a la quantite deja receptionnee')
    }
    if (targetReceived > ordered) {
      throw new Error('La quantite recue ne peut pas depasser la quantite commandee')
    }
    if (quantityToReceive <= 0) continue

    const hasLineDifference = Boolean(item.difference_type) || Boolean(item.difference_comment)
    const differenceDescription = cleanNullable(item.difference_comment) ?? 'Ecart signale depuis la commande fournisseur'
    const anomalyType = mapOrderDifferenceToReceptionAnomaly(item.difference_type)
    const stockUnitId = currentItem.stock_unit_id ?? currentItem.articles?.unit_id ?? currentItem.unit_id
    const factor = Number(currentItem.conversion_factor ?? 1)
    const stockQuantityToReceive = quantityToReceive * factor

    receptionItems.push({
      article_id: currentItem.article_id,
      quantity_ordered: Math.max(0, ordered - alreadyReceived),
      quantity_delivered: stockQuantityToReceive,
      quantity_accepted: stockQuantityToReceive,
      quantity_delivered_display: quantityToReceive,
      quantity_accepted_display: quantityToReceive,
      unit_id: stockUnitId,
      unit_display_id: currentItem.unit_id,
      conversion_factor: factor,
      unit_price_planned: Number(currentItem.unit_price ?? 0),
      unit_price_real: Number(currentItem.unit_price_stock ?? (factor > 0 ? Number(currentItem.unit_price ?? 0) / factor : currentItem.unit_price) ?? 0),
      unit_price_display: Number(currentItem.unit_price ?? 0),
      quality: hasLineDifference ? 'a_verifier' : 'conforme',
      quality_comment: hasLineDifference ? differenceDescription : '',
      has_anomaly: hasLineDifference,
      anomalies: hasLineDifference ? [{
        anomaly_type: anomalyType,
        description: differenceDescription,
        photo_url: '',
      }] : [],
    })

    const { error } = await supabase.schema('stock')
      .from('purchase_order_items')
      .update({
        difference_type: cleanNullable(item.difference_type ?? null),
        difference_comment: cleanNullable(item.difference_comment),
        difference_status: hasLineDifference ? item.difference_status === 'valide' ? 'valide' : 'a_justifier' : 'aucun',
      })
      .eq('id', item.id)
    if (error) throw error
  }

  if (receptionItems.length === 0) {
    throw new Error('Aucune nouvelle quantite a receptionner')
  }

  const receptionId = await createReception({
    supplier_id: order.supplier_id,
    reception_date: today,
    invoice_number: `AUTO-${order.reference}-${Date.now()}`,
    invoice_date: today,
    location_id: defaultLocation.id,
    comment: `Reception automatique creee depuis la commande ${order.reference}`,
    purchase_order_id: order.id,
    cash_purchase_id: '',
    is_historical: false,
    items: receptionItems,
  }, profileId)

  await submitReception(receptionId, profileId)
  await addOrderHistory(id, 'reception', `Reception officielle creee depuis la commande (${receptionId})`, profileId)
  return receptionId
}

function mapOrderDifferenceToReceptionAnomaly(type?: PurchaseOrderItem['difference_type'] | null): AnomalyType {
  if (type === 'quantite_manquante') return 'quantite_manquante'
  if (type === 'produit_non_conforme') return 'produit_non_conforme'
  if (type === 'prix_different') return 'prix_different'
  return 'erreur_facture'
}

export async function cancelPurchaseOrder(id: string, profileId: string | undefined, reason: string) {
  if (!reason.trim()) throw new Error('Motif obligatoire')
  const order = await getPurchaseOrder(id)
  const needIds = (order.purchase_order_needs ?? []).map((link) => link.need_id)

  const { error } = await supabase.schema('stock')
    .from('purchase_orders')
    .update({ status: 'annulee', cancellation_reason: reason.trim(), cancelled_by: profileId, cancelled_at: new Date().toISOString(), updated_by: profileId })
    .eq('id', id)
  if (error) throw error

  if (needIds.length > 0) {
    const { error: needsError } = await supabase.schema('stock').from('purchase_needs').update({ status: 'valide', updated_by: profileId }).in('id', needIds)
    if (needsError) throw needsError
  }
  await addOrderHistory(id, 'annulation', reason.trim(), profileId)
}

export async function closePurchaseOrder(id: string, profileId?: string) {
  const order = await getPurchaseOrder(id)
  if (!['livree', 'reception_avec_ecart'].includes(order.status)) {
    throw new Error('La commande doit etre livree avant cloture')
  }
  const hasOpenDifference = (order.purchase_order_items ?? []).some((item) => item.difference_status === 'a_justifier')
  if (hasOpenDifference) {
    throw new Error('Tous les ecarts de reception doivent etre valides avant cloture')
  }

  const { error } = await supabase.schema('stock')
    .from('purchase_orders')
    .update({ status: 'cloturee', closed_by: profileId, closed_at: new Date().toISOString(), updated_by: profileId })
    .eq('id', id)
  if (error) throw error
  await addOrderHistory(id, 'cloture', 'Commande cloturee', profileId)
}

export async function validateOrderItemDifference(itemId: string, profileId?: string) {
  const { error } = await supabase.schema('stock')
    .from('purchase_order_items')
    .update({ difference_status: 'valide', difference_validated_by: profileId, difference_validated_at: new Date().toISOString() })
    .eq('id', itemId)
  if (error) throw error
}

export async function uploadPurchaseOrderFile(orderId: string, file: File) {
  const preparedFile = await compressReceiptFile(file)
  const extension = preparedFile.name.split('.').pop() || 'bin'
  const safeName = preparedFile.name
    .replace(/\.[^.]+$/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  const path = `${orderId}/${Date.now()}-${safeName}.${extension}`

  const { error: uploadError } = await supabase.storage
    .from(PURCHASE_ORDER_FILES_BUCKET)
    .upload(path, preparedFile, {
      cacheControl: '3600',
      contentType: preparedFile.type || file.type,
      upsert: false,
    })
  if (uploadError) throw uploadError

  const { data } = supabase.storage.from(PURCHASE_ORDER_FILES_BUCKET).getPublicUrl(path)
  return { publicUrl: data.publicUrl, file: preparedFile }
}

export async function uploadPurchaseOrderDocument(orderId: string, file: File, description: string, profileId?: string) {
  const uploaded = await uploadPurchaseOrderFile(orderId, file)
  const { error } = await supabase.schema('stock').from('purchase_order_documents').insert({
    purchase_order_id: orderId,
    file_url: uploaded.publicUrl,
    file_name: uploaded.file.name,
    file_size: uploaded.file.size,
    mime_type: uploaded.file.type,
    document_type: 'bon_livraison',
    description: cleanNullable(description),
    uploaded_by: profileId,
  })
  if (error) throw error
  await addOrderHistory(orderId, 'document', `Document ajoute : ${uploaded.file.name}`, profileId)
}

export async function attachGeneratedPurchaseOrderPdf(orderId: string, file: File, profileId?: string) {
  const uploaded = await uploadPurchaseOrderFile(orderId, file)
  const { error } = await supabase.schema('stock').from('purchase_orders').update({ file_url: uploaded.publicUrl, updated_by: profileId }).eq('id', orderId)
  if (error) throw error
  await addOrderHistory(orderId, 'pdf', 'PDF de commande genere et televerse', profileId)
  return uploaded.publicUrl
}

async function addOrderHistory(orderId: string, action: string, description: string, profileId?: string) {
  const { error } = await supabase.schema('stock').from('purchase_order_history').insert({
    purchase_order_id: orderId,
    action,
    description,
    created_by: profileId,
  })
  if (error) throw error
}

export async function listOrderablePurchaseGroups() {
  const { data, error } = await supabase.schema('stock')
    .from('purchase_groups')
    .select('*, suppliers(id, name)')
    .eq('status', 'en_cours')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as PurchaseGroup[]
}

export async function getPurchaseGroupNeeds(groupId: string) {
  const { data, error } = await supabase.schema('stock')
    .from('purchase_needs')
    .select('*, articles(id, name, families(id, name)), units(id, name, abbreviation), suppliers(id, name)')
    .eq('group_id', groupId)
    .in('status', ['regroupe', 'valide'])
  if (error) throw error
  return (data ?? []) as PurchaseNeedGlobal[]
}

export async function createPurchaseOrderFromGroup(groupId: string, profileId?: string) {
  const needs = await getPurchaseGroupNeeds(groupId)
  if (needs.length === 0) throw new Error('Aucun besoin regroupé dans ce groupe')
  const existingLinks = await supabase.schema('stock')
    .from('purchase_order_needs')
    .select('purchase_order_id')
    .in('need_id', needs.map((need) => need.id))
  if (existingLinks.error) throw existingLinks.error
  const existingOrderId = existingLinks.data?.[0]?.purchase_order_id
  if (existingOrderId) return existingOrderId as string

  const supplierId = needs[0].supplier_id
  if (!supplierId) throw new Error('Fournisseur manquant pour ce groupe')
  return createPurchaseOrder({
    supplier_id: supplierId,
    order_date: new Date().toISOString().slice(0, 10),
    delivery_date: needs[0].requested_date ?? new Date().toISOString().slice(0, 10),
    supplier_reference: '',
    payment_terms: '',
    delivery_mode: '',
    comment: 'Commande créée depuis les besoins regroupés',
    group_id: groupId,
    need_ids: needs.map((need) => need.id),
    items: needs.map((need) => ({
      article_id: need.article_id,
      quantity_ordered: Number(need.quantity) > 0 ? Number(need.quantity) : Number(need.quantity_needed ?? 0),
      unit_id: need.unit_id,
      stock_unit_id: need.unit_id,
      conversion_factor: 1,
      quantity_ordered_stock: Number(need.quantity) > 0 ? Number(need.quantity) : Number(need.quantity_needed ?? 0),
      unit_price: Number(need.estimated_price) > 0 ? Number(need.estimated_price) : (Number(need.estimated_payable_amount ?? need.estimated_cost ?? 0) / Math.max(1, Number(need.quantity) || Number(need.quantity_needed) || 1)),
      unit_price_stock: Number(need.estimated_price) > 0 ? Number(need.estimated_price) : (Number(need.estimated_payable_amount ?? need.estimated_cost ?? 0) / Math.max(1, Number(need.quantity) || Number(need.quantity_needed) || 1)),
      comment: need.comment ?? '',
    })),
  }, profileId)
}
