import { supabase } from '../../lib/supabase'
import { compressReceiptFile } from '../../lib/imageCompression'
import { calculateReceptionTotal, receptionHasAnomalies } from '../../lib/receptions'
import { integratePendingReceptionMovements } from './stock.api'
import type { Reception, ReceptionFormValues, ReceptionStatus } from '../../lib/receptions'
import type { PurchaseOrder } from '../../lib/purchaseOrders'

const RECEPTION_ANOMALIES_BUCKET = 'reception-anomalies'
const RECEPTION_DOCUMENTS_BUCKET = 'reception-documents'

type ReceptionFilters = {
  search?: string
  status?: ReceptionStatus | 'all'
  supplierId?: string
  receiverId?: string
  fromDate?: string
  toDate?: string
  page?: number
  pageSize?: number
}

function cleanNullable(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export async function listReceptions(filters: ReceptionFilters = {}) {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 10
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase.schema('stock')
    .from('receptions')
    .select('*, suppliers(*), locations(id, name), purchase_orders(id, reference, status), receiver:profiles!receptions_created_by_fkey(id, full_name, role), reception_items(id)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status)
  if (filters.supplierId) query = query.eq('supplier_id', filters.supplierId)
  if (filters.receiverId) query = query.eq('created_by', filters.receiverId)
  if (filters.fromDate) query = query.gte('reception_date', filters.fromDate)
  if (filters.toDate) query = query.lte('reception_date', filters.toDate)
  if (filters.search?.trim()) query = query.ilike('reference', `%${filters.search.trim()}%`)

  const { data, error, count } = await query
  if (error) throw error
  return { receptions: (data ?? []) as Reception[], total: count ?? 0 }
}

export async function getReception(id: string) {
  const { data, error } = await supabase.schema('stock')
    .from('receptions')
    .select('*, suppliers(*), locations(id, name), purchase_orders(id, reference, status), receiver:profiles!receptions_created_by_fkey(id, full_name, role), validator:profiles!receptions_validated_by_fkey(id, full_name), reception_items(*, articles(id, name, families(id, name)), units(id, name, abbreviation), reception_anomalies(*)), reception_documents(*), reception_history(*, actor:profiles!reception_history_created_by_fkey(id, full_name))')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as Reception
}

export async function listReceivableOrders() {
  const { data, error } = await supabase.schema('stock')
    .from('purchase_orders')
    .select('*, suppliers(*), purchase_order_items(*, articles(id, name, families(id, name)), units(id, name, abbreviation))')
    .in('status', ['envoyee', 'partiellement_livree', 'reception_avec_ecart'])
    .order('delivery_date', { ascending: true })
  if (error) throw error
  return (data ?? []) as PurchaseOrder[]
}

export async function listReceivableCashPurchases() {
  const { data, error } = await supabase.schema('stock')
    .from('cash_purchases')
    .select('*, cash_purchase_items(*, articles(id, name, units(id, name, abbreviation)), units(id, name, abbreviation))')
    .eq('status', 'cloture')
    .order('request_date', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createReception(values: ReceptionFormValues, profileId?: string) {
  validateReceptionValues(values)
  await assertOrderQuantitiesAvailable(values)
  const total = calculateReceptionTotal(values.items)
  const reference = await generateReceptionReference()
  const { data, error } = await supabase.schema('stock')
    .from('receptions')
    .insert({
      reference,
      supplier_id: values.supplier_id,
      reception_date: values.reception_date,
      invoice_number: values.invoice_number.trim(),
      invoice_date: values.invoice_date,
      location_id: values.location_id,
      comment: cleanNullable(values.comment),
      purchase_order_id: values.purchase_order_id || null,
      cash_purchase_id: values.cash_purchase_id || null,
      total_amount: total,
      status: 'brouillon',
      created_by: profileId,
      updated_by: profileId,
    })
    .select('id')
    .single()
  if (error) throw error

  await replaceReceptionItems(data.id, values.items)
  await addReceptionHistory(data.id, 'creation', 'Reception creee', profileId)
  return data.id as string
}

export async function updateReception(id: string, values: ReceptionFormValues, profileId?: string) {
  const current = await getReception(id)
  if (!['brouillon', 'en_attente'].includes(current.status)) throw new Error('Cette reception ne peut plus etre modifiee')
  validateReceptionValues(values)
  await assertOrderQuantitiesAvailable(values, id)
  const total = calculateReceptionTotal(values.items)
  const { error } = await supabase.schema('stock')
    .from('receptions')
    .update({
      supplier_id: values.supplier_id,
      reception_date: values.reception_date,
      invoice_number: values.invoice_number.trim(),
      invoice_date: values.invoice_date,
      location_id: values.location_id,
      comment: cleanNullable(values.comment),
      purchase_order_id: values.purchase_order_id || null,
      cash_purchase_id: values.cash_purchase_id || null,
      total_amount: total,
      updated_by: profileId,
    })
    .eq('id', id)
  if (error) throw error
  await replaceReceptionItems(id, values.items)
  await addReceptionHistory(id, 'modification', 'Reception mise a jour', profileId)
}

function validateReceptionValues(values: ReceptionFormValues) {
  if (!values.supplier_id.trim()) {
    throw new Error('Veuillez selectionner un fournisseur')
  }
  if (!values.location_id.trim()) {
    throw new Error('Veuillez selectionner une localisation de reception')
  }
  if (!values.invoice_number.trim()) {
    throw new Error('Veuillez saisir un numéro de facture')
  }
  if (values.items.length === 0) {
    throw new Error('Veuillez ajouter au moins un article')
  }

  for (const item of values.items) {
    if (!item.article_id.trim()) {
      throw new Error('Veuillez selectionner un article')
    }
    if (!item.unit_id.trim()) {
      throw new Error("Veuillez selectionner l'unite")
    }
    if (Number(item.unit_price_real) <= 0) {
      throw new Error('Le prix réel doit être supérieur à 0')
    }
    if (item.quality === 'non_conforme' && !item.quality_comment?.trim()) {
      throw new Error('Commentaire obligatoire pour un produit non conforme')
    }
    if (item.quantity_accepted > item.quantity_delivered) {
      throw new Error('La quantité acceptée ne peut pas dépasser la quantité livrée')
    }
    for (const anomaly of item.anomalies ?? []) {
      if (anomaly.anomaly_type === 'produit_abime' && !anomaly.photo_url) {
        throw new Error("Une photo est obligatoire pour ce type d'anomalie")
      }
    }
  }
}

async function assertOrderQuantitiesAvailable(values: ReceptionFormValues, currentReceptionId?: string) {
  if (!values.purchase_order_id) return

  for (const item of values.items) {
    const { data: orderItems, error: orderError } = await supabase.schema('stock')
      .from('purchase_order_items')
      .select('article_id, quantity_ordered')
      .eq('purchase_order_id', values.purchase_order_id)
      .eq('article_id', item.article_id)
    if (orderError) throw orderError

    const orderItem = orderItems?.[0]
    if (!orderItem) continue

    let query = supabase.schema('stock')
      .from('reception_items')
      .select('quantity_accepted, receptions!inner(id, purchase_order_id, status)')
      .eq('article_id', item.article_id)
      .eq('receptions.purchase_order_id', values.purchase_order_id)
      .neq('receptions.status', 'refusee')

    if (currentReceptionId) {
      query = query.neq('receptions.id', currentReceptionId)
    }

    const { data: alreadyReceived, error: receivedError } = await query
    if (receivedError) throw receivedError

    const existingQuantity = (alreadyReceived ?? []).reduce((sum, row) => sum + Number(row.quantity_accepted ?? 0), 0)
    if (existingQuantity + Number(item.quantity_accepted ?? 0) > Number(orderItem.quantity_ordered ?? 0)) {
      throw new Error('Cette quantite depasse le restant a receptionner pour la commande')
    }
  }
}

async function replaceReceptionItems(receptionId: string, items: ReceptionFormValues['items']) {
  const { error: deleteError } = await supabase.schema('stock').from('reception_items').delete().eq('reception_id', receptionId)
  if (deleteError) throw deleteError

  for (const item of items) {
    const { data, error } = await supabase.schema('stock')
      .from('reception_items')
      .insert({
        reception_id: receptionId,
        article_id: item.article_id,
        quantity_ordered: item.quantity_ordered,
        quantity_delivered: item.quantity_delivered,
        quantity_accepted: item.quantity_accepted,
        unit_id: item.unit_id,
        unit_price_planned: item.unit_price_planned,
        unit_price_real: item.unit_price_real,
        quality: item.quality,
        quality_comment: cleanNullable(item.quality_comment),
        has_anomaly: item.has_anomaly || (item.anomalies ?? []).length > 0,
      })
      .select('id')
      .single()
    if (error) throw error

    const anomalies = (item.anomalies ?? []).filter((anomaly) => anomaly.description.trim()).map((anomaly) => ({
      reception_item_id: data.id,
      anomaly_type: anomaly.anomaly_type,
      description: anomaly.description.trim(),
      photo_url: anomaly.photo_url || null,
    }))
    if (anomalies.length > 0) {
      const { error: anomalyError } = await supabase.schema('stock').from('reception_anomalies').insert(anomalies)
      if (anomalyError) throw anomalyError
    }
  }
}

async function generateReceptionReference() {
  const now = new Date()
  const prefix = `REC-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const { count, error } = await supabase.schema('stock').from('receptions').select('id', { count: 'exact', head: true }).ilike('reference', `${prefix}-%`)
  if (error) throw error
  return `${prefix}-${String((count ?? 0) + 1).padStart(3, '0')}`
}

export async function submitReception(id: string, profileId?: string) {
  const reception = await getReception(id)
  const hasAnomaly = receptionHasAnomalies((reception.reception_items ?? []).map((item) => ({
    article_id: item.article_id,
    quantity_ordered: Number(item.quantity_ordered ?? 0),
    quantity_delivered: Number(item.quantity_delivered ?? 0),
    quantity_accepted: Number(item.quantity_accepted ?? 0),
    unit_id: item.unit_id,
    unit_price_planned: Number(item.unit_price_planned ?? 0),
    unit_price_real: Number(item.unit_price_real ?? 0),
    quality: item.quality,
    quality_comment: item.quality_comment ?? '',
    has_anomaly: item.has_anomaly,
    anomalies: [],
  })))
  const status: ReceptionStatus = hasAnomaly ? 'en_attente' : 'validee'
  const { error } = await supabase.schema('stock').from('receptions').update({ status, updated_by: profileId }).eq('id', id)
  if (error) throw error
  await addReceptionHistory(id, status === 'validee' ? 'validation' : 'soumission', status === 'validee' ? 'Reception validee automatiquement' : 'Reception soumise a validation', profileId)
  if (status === 'validee') {
    await applyReceptionSideEffects(id, profileId)
    const integrated = profileId ? await integratePendingReceptionMovements(profileId) : 0
    await addReceptionHistory(id, 'stock_pending', integrated > 0 ? 'Entree en stock effectuee avec succes' : 'Mouvement stock en attente cree', profileId)
  }
}

export async function validateReception(id: string, profileId?: string, comment?: string) {
  const reception = await getReception(id)
  const hasAnomaly = (reception.reception_items ?? []).some((item) => item.has_anomaly || item.quality !== 'conforme' || (item.reception_anomalies?.length ?? 0) > 0)
  const status: ReceptionStatus = hasAnomaly ? 'validee_avec_anomalies' : 'validee'
  const { error } = await supabase.schema('stock')
    .from('receptions')
    .update({ status, validated_by: profileId, validated_at: new Date().toISOString(), validation_comment: cleanNullable(comment), updated_by: profileId })
    .eq('id', id)
  if (error) throw error
  await applyReceptionSideEffects(id, profileId)
  const integrated = profileId ? await integratePendingReceptionMovements(profileId) : 0
  await addReceptionHistory(id, 'validation', status === 'validee_avec_anomalies' ? 'Reception validee avec anomalies' : 'Reception validee', profileId)
  await addReceptionHistory(id, 'stock_pending', integrated > 0 ? 'Entree en stock effectuee avec succes' : 'Mouvement stock en attente cree', profileId)
}

export async function refuseReception(id: string, profileId?: string, reason?: string) {
  const { error } = await supabase.schema('stock')
    .from('receptions')
    .update({ status: 'refusee', validated_by: profileId, validated_at: new Date().toISOString(), validation_comment: cleanNullable(reason), updated_by: profileId })
    .eq('id', id)
  if (error) throw error
  await addReceptionHistory(id, 'refus', reason ?? 'Reception refusee', profileId)
}

async function applyReceptionSideEffects(id: string, profileId?: string) {
  const reception = await getReception(id)
  await supabase.schema('stock').from('stock_pending_movements').delete().eq('reception_id', id)

  const movementRows = (reception.reception_items ?? []).filter((item) => Number(item.quantity_accepted ?? 0) > 0).map((item) => ({
    reception_id: id,
    reception_item_id: item.id,
    article_id: item.article_id,
    quantity: item.quantity_accepted,
    unit_id: item.unit_id,
    location_id: reception.location_id,
    created_by: profileId,
  }))
  if (movementRows.length > 0) {
    const { error } = await supabase.schema('stock').from('stock_pending_movements').insert(movementRows)
    if (error) throw error
  }

  if (reception.purchase_order_id) {
    for (const item of reception.reception_items ?? []) {
      const { data: orderItems, error: orderItemError } = await supabase.schema('stock')
        .from('purchase_order_items')
        .select('id, quantity_received')
        .eq('purchase_order_id', reception.purchase_order_id)
        .eq('article_id', item.article_id)
      if (orderItemError) throw orderItemError
      const orderItem = orderItems?.[0]
      if (orderItem) {
        const { error } = await supabase.schema('stock')
          .from('purchase_order_items')
          .update({ quantity_received: Number(orderItem.quantity_received ?? 0) + Number(item.quantity_accepted ?? 0) })
          .eq('id', orderItem.id)
        if (error) throw error
      }
    }
    await refreshPurchaseOrderStatus(reception.purchase_order_id, profileId)
  }
}

async function refreshPurchaseOrderStatus(orderId: string, profileId?: string) {
  const { error } = await supabase.schema('stock').rpc('refresh_purchase_order_status_from_items', {
    p_order_id: orderId,
    p_profile_id: profileId ?? null,
  })
  if (error) throw error
}

export async function uploadReceptionAnomalyPhoto(file: File) {
  const preparedFile = await compressReceiptFile(file)
  if (!preparedFile.type.startsWith('image/')) throw new Error('La photo doit etre une image')
  const extension = preparedFile.name.split('.').pop() || 'jpg'
  const safeName = preparedFile.name.replace(/\.[^.]+$/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase()
  const path = `${Date.now()}-${safeName}.${extension}`
  const { error } = await supabase.storage.from(RECEPTION_ANOMALIES_BUCKET).upload(path, preparedFile, { contentType: preparedFile.type, upsert: false })
  if (error) throw error
  const { data } = supabase.storage.from(RECEPTION_ANOMALIES_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function uploadReceptionDocument(receptionId: string, file: File, description: string, profileId?: string) {
  const uploaded = await uploadFile(RECEPTION_DOCUMENTS_BUCKET, receptionId, file)
  const { error } = await supabase.schema('stock').from('reception_documents').insert({
    reception_id: receptionId,
    file_url: uploaded.publicUrl,
    file_name: uploaded.file.name,
    file_size: uploaded.file.size,
    mime_type: uploaded.file.type,
    document_type: 'facture',
    description: cleanNullable(description),
    uploaded_by: profileId,
  })
  if (error) throw error
  await addReceptionHistory(receptionId, 'document', `Document ajoute : ${uploaded.file.name}`, profileId)
}

export async function resolveReceptionAnomaly(anomalyId: string, profileId: string | undefined, comment: string) {
  const { data: anomaly, error: anomalyError } = await supabase.schema('stock')
    .from('reception_anomalies')
    .select('*, reception_items(reception_id)')
    .eq('id', anomalyId)
    .single()
  if (anomalyError) throw anomalyError

  const { error } = await supabase.schema('stock')
    .from('reception_anomalies')
    .update({
      resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_by: profileId,
      resolution_comment: comment.trim(),
    })
    .eq('id', anomalyId)
  if (error) throw error

  const receptionId = anomaly.reception_items?.reception_id
  if (receptionId) await addReceptionHistory(receptionId, 'anomalie_resolue', comment.trim(), profileId)
}

async function uploadFile(bucket: string, folder: string, file: File) {
  const preparedFile = await compressReceiptFile(file)
  const extension = preparedFile.name.split('.').pop() || 'bin'
  const safeName = preparedFile.name.replace(/\.[^.]+$/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase()
  const path = `${folder}/${Date.now()}-${safeName}.${extension}`
  const { error } = await supabase.storage.from(bucket).upload(path, preparedFile, { contentType: preparedFile.type || file.type, upsert: false })
  if (error) throw error
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return { publicUrl: data.publicUrl, file: preparedFile }
}

async function addReceptionHistory(receptionId: string, action: string, description: string, profileId?: string) {
  const { error } = await supabase.schema('stock').from('reception_history').insert({
    reception_id: receptionId,
    action,
    description,
    created_by: profileId,
  })
  if (error) throw error
}

export async function listDefaultReceptionLocation() {
  const { data, error } = await supabase.schema('stock').from('locations').select('*').eq('is_magasin_general', true).limit(1).maybeSingle()
  if (error) throw error
  return data
}
