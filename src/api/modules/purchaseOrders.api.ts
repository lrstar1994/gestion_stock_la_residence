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
    .select('*, suppliers(*), creator:profiles!purchase_orders_created_by_fkey(id, full_name, role)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status)
  if (filters.supplierId) query = query.eq('supplier_id', filters.supplierId)
  if (filters.buyerId) query = query.eq('created_by', filters.buyerId)
  if (filters.fromDate) query = query.gte('order_date', filters.fromDate)
  if (filters.toDate) query = query.lte('order_date', filters.toDate)
  if (filters.search?.trim()) {
    const term = filters.search.trim()
    query = query.or(`reference.ilike.%${term}%,supplier_reference.ilike.%${term}%`)
  }

  const { data, error, count } = await query
  if (error) throw error
  return { orders: (data ?? []) as PurchaseOrder[], total: count ?? 0 }
}

export async function getPurchaseOrder(id: string) {
  const { data, error } = await supabase.schema('stock')
    .from('purchase_orders')
    .select('*, suppliers(*), creator:profiles!purchase_orders_created_by_fkey(id, full_name, role), validator:profiles!purchase_orders_validated_by_fkey(id, full_name), sender:profiles!purchase_orders_sent_by_fkey(id, full_name), purchase_order_items(*, articles(id, name, families(id, name)), units(id, name, abbreviation)), purchase_order_needs(*, purchase_needs(*, articles(id, name, families(id, name)), units(id, name, abbreviation), requester:profiles!purchase_needs_created_by_fkey(id, full_name))), purchase_order_history(*, actor:profiles!purchase_order_history_created_by_fkey(id, full_name)), purchase_order_documents(*)')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as PurchaseOrder
}

export async function createPurchaseOrder(values: PurchaseOrderFormValues, profileId?: string) {
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
  const { error: deleteError } = await supabase.schema('stock').from('purchase_order_items').delete().eq('purchase_order_id', orderId)
  if (deleteError) throw deleteError

  const rows = items.map((item) => ({
    purchase_order_id: orderId,
    article_id: item.article_id,
    quantity_ordered: item.quantity_ordered,
    unit_id: item.unit_id,
    unit_price: item.unit_price,
    comment: cleanNullable(item.comment),
  }))

  const { error } = await supabase.schema('stock').from('purchase_order_items').insert(rows)
  if (error) throw error
}

async function linkNeeds(orderId: string, needIds: string[], supplierId: string, profileId?: string) {
  if (needIds.length === 0) return
  const links = needIds.map((needId) => ({ purchase_order_id: orderId, need_id: needId }))
  const { error: linkError } = await supabase.schema('stock').from('purchase_order_needs').insert(links)
  if (linkError) throw linkError

  const { error } = await supabase.schema('stock')
    .from('purchase_needs')
    .update({ status: 'regroupe', supplier_id: supplierId, updated_by: profileId })
    .in('id', needIds)
  if (error) throw error

  const { data: needs } = await supabase.schema('stock').from('purchase_needs').select('group_id').in('id', needIds)
  const groupIds = [...new Set((needs ?? []).map((need) => need.group_id).filter(Boolean))]
  if (groupIds.length > 0) {
    await supabase.schema('stock').from('purchase_groups').update({ status: 'commande_creee' }).in('id', groupIds)
  }
}

async function replaceNeedLinks(orderId: string, needIds: string[], supplierId: string, profileId?: string) {
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

    receptionItems.push({
      article_id: currentItem.article_id,
      quantity_ordered: Math.max(0, ordered - alreadyReceived),
      quantity_delivered: quantityToReceive,
      quantity_accepted: quantityToReceive,
      unit_id: currentItem.unit_id,
      unit_price_planned: Number(currentItem.unit_price ?? 0),
      unit_price_real: Number(currentItem.unit_price ?? 0),
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
