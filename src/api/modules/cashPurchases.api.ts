import { supabase } from '../../lib/supabase'
import type { CashPurchase, CashPurchaseFormValues, CashPurchaseItem, CashPurchaseSource, CashPurchaseStatus } from '../../lib/cashPurchases'
import { calculateCashTotals, calculateReturnTotals } from '../../lib/cashPurchases'
import { compressReceiptFile } from '../../lib/imageCompression'

const CASH_RECEIPTS_BUCKET = 'cash-purchase-receipts'

type CashPurchaseFilters = {
  search?: string
  status?: CashPurchaseStatus | 'all'
  buyerId?: string
  cashSource?: CashPurchaseSource | 'all'
  fromDate?: string
  toDate?: string
  page?: number
  pageSize?: number
}

function cleanNullable(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export async function listCashPurchases(filters: CashPurchaseFilters = {}) {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 10
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase.schema('stock')
    .from('cash_purchases')
    .select('*, buyer:profiles!cash_purchases_buyer_id_fkey(id, full_name, role)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status)
  if (filters.buyerId) query = query.eq('buyer_id', filters.buyerId)
  if (filters.cashSource && filters.cashSource !== 'all') query = query.eq('cash_source', filters.cashSource)
  if (filters.fromDate) query = query.gte('request_date', filters.fromDate)
  if (filters.toDate) query = query.lte('request_date', filters.toDate)
  if (filters.search?.trim()) {
    const term = filters.search.trim()
    query = query.or(`reference.ilike.%${term}%,reason.ilike.%${term}%`)
  }

  const { data, error, count } = await query
  if (error) throw error
  return { purchases: (data ?? []) as CashPurchase[], total: count ?? 0 }
}

export async function listDailyCashDisbursementReport(reportDate: string) {
  const { data, error } = await supabase.schema('stock')
    .from('cash_purchases')
    .select('*, buyer:profiles!cash_purchases_buyer_id_fkey(id, full_name, role), validator:profiles!cash_purchases_validated_by_fkey(id, full_name), cashier:profiles!cash_purchases_given_by_fkey(id, full_name), closer:profiles!cash_purchases_closed_by_fkey(id, full_name), cash_purchase_items(id, total_estimated, total_real), cash_purchase_receipts(id), cash_purchase_differences(id, amount, status, difference_type)')
    .eq('request_date', reportDate)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as CashPurchase[]
}

export async function getCashPurchase(id: string) {
  const { data, error } = await supabase.schema('stock')
    .from('cash_purchases')
    .select('*, buyer:profiles!cash_purchases_buyer_id_fkey(id, full_name, role), validator:profiles!cash_purchases_validated_by_fkey(id, full_name), cashier:profiles!cash_purchases_given_by_fkey(id, full_name), closer:profiles!cash_purchases_closed_by_fkey(id, full_name), cash_purchase_items(*, articles(id, name, unit_id, units(id, name, abbreviation)), units(id, name, abbreviation), stock_unit:units!cash_purchase_items_stock_unit_id_fkey(id, name, abbreviation)), cash_purchase_receipts(*), cash_purchase_differences(*)')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as CashPurchase
}

export async function createCashPurchase(values: CashPurchaseFormValues, profileId?: string) {
  const total = calculateCashTotals(values.items)
  if (total <= 0) throw new Error('Le montant demande doit etre superieur a 0')

  const reference = await generateCashPurchaseReference()
  const { data, error } = await supabase.schema('stock')
    .from('cash_purchases')
    .insert({
      reference,
      buyer_id: values.buyer_id,
      cash_source: values.cash_source,
      reason: values.reason.trim(),
      purchase_date: values.purchase_date || null,
      request_date: values.request_date,
      total_estimated: total,
      amount_requested: total,
      status: 'en_attente',
      cash_status: 'especes_demandees',
      reception_status: 'en_attente_reception',
      stock_entry_status: 'non_entre_stock',
      created_by: profileId,
      updated_by: profileId,
    })
    .select('id')
    .single()

  if (error) throw error
  await replaceItems(data.id, values.items)
  await markLinkedNeedsInProgress(values.items)
  return data.id as string
}

async function replaceItems(cashPurchaseId: string, items: CashPurchaseFormValues['items']) {
  const rows = items.map((item) => ({
    cash_purchase_id: cashPurchaseId,
    article_id: item.article_id,
    purchase_need_id: item.purchase_need_id || null,
    quantity_planned: item.quantity_planned,
    unit_id: item.unit_id,
    stock_unit_id: item.stock_unit_id || null,
    conversion_factor: item.conversion_factor ?? 1,
    quantity_planned_stock: item.quantity_planned_stock ?? item.quantity_planned,
    unit_price_estimated: item.unit_price_estimated,
    unit_price_estimated_stock: item.unit_price_estimated_stock ?? item.unit_price_estimated,
    total_estimated: item.quantity_planned * item.unit_price_estimated,
  }))

  const { error } = await supabase.schema('stock').from('cash_purchase_items').insert(rows)
  if (error) throw error
}

async function markLinkedNeedsInProgress(items: CashPurchaseFormValues['items']) {
  const ids = items.map((item) => item.purchase_need_id).filter((id): id is string => Boolean(id))
  if (ids.length === 0) return
  const { error } = await supabase.schema('stock').from('purchase_needs').update({ status: 'en_cours' }).in('id', ids)
  if (error) throw error
}

async function generateCashPurchaseReference() {
  const now = new Date()
  const prefix = `CA-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const { count, error } = await supabase.schema('stock')
    .from('cash_purchases')
    .select('id', { count: 'exact', head: true })
    .ilike('reference', `${prefix}-%`)
  if (error) throw error
  return `${prefix}-${String((count ?? 0) + 1).padStart(3, '0')}`
}

export async function validateCashPurchase(id: string, amountValidated: number, profileId?: string, comment?: string) {
  if (amountValidated <= 0) throw new Error('Le montant demande doit etre superieur a 0')
  const { error } = await supabase.schema('stock')
    .from('cash_purchases')
    .update({
      amount_validated: amountValidated,
      status: 'valide',
      cash_status: 'decaissement_valide',
      validated_by: profileId,
      validated_at: new Date().toISOString(),
      validation_comment: cleanNullable(comment),
    })
    .eq('id', id)
  if (error) throw error
}

export async function refuseCashPurchase(id: string, profileId: string | undefined, reason: string) {
  if (!reason.trim()) throw new Error('Motif obligatoire')
  const { error } = await supabase.schema('stock')
    .from('cash_purchases')
    .update({
      status: 'refuse',
      cash_status: 'annule',
      reception_status: 'reception_refusee',
      stock_entry_status: 'bloque_stock',
      validated_by: profileId,
      validated_at: new Date().toISOString(),
      validation_comment: reason.trim(),
    })
    .eq('id', id)
  if (error) throw error
}

export async function giveCash(id: string, amountGiven: number, profileId?: string) {
  if (amountGiven <= 0) throw new Error('Le montant demande doit etre superieur a 0')
  const { error } = await supabase.schema('stock')
    .from('cash_purchases')
    .update({
      amount_given: amountGiven,
      status: 'especes_remises',
      cash_status: 'especes_remises',
      given_by: profileId,
      given_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error
}

export async function saveCashPurchaseReturn(id: string, items: CashPurchaseItem[], changeReturned: number, profileId?: string) {
  const totalPurchased = calculateReturnTotals(items)
  const purchase = await getCashPurchase(id)
  const changeExpected = Number(purchase.amount_given ?? 0) - totalPurchased
  const difference = changeExpected - Number(changeReturned ?? 0)
  const status = items.some((item) => Number(item.quantity_bought ?? 0) < Number(item.quantity_planned ?? 0)) ? 'retour_partiel' : 'retour_complet'
  const cashStatus = deriveCashWorkflowStatus(changeExpected, difference)

  for (const item of items) {
    if (!item.id) continue
    const { error: itemError } = await supabase.schema('stock')
      .from('cash_purchase_items')
      .update({
        quantity_bought: item.quantity_bought,
        quantity_bought_stock: item.quantity_bought_stock ?? item.quantity_bought,
        conversion_factor: item.conversion_factor ?? 1,
        unit_price_real: item.unit_price_real,
        unit_price_real_stock: item.unit_price_real_stock ?? item.unit_price_real,
        total_real: Number(item.quantity_bought ?? 0) * Number(item.unit_price_real ?? 0),
        invoice_number: cleanNullable(item.invoice_number),
        invoice_date: item.invoice_date || null,
        supplier: cleanNullable(item.supplier),
        comment: cleanNullable(item.comment),
      })
      .eq('id', item.id)
    if (itemError) throw itemError
  }

  const { error } = await supabase.schema('stock')
    .from('cash_purchases')
    .update({
      total_purchased: totalPurchased,
      change_expected: changeExpected,
      change_returned: changeReturned,
      difference,
      status,
      cash_status: cashStatus,
      reception_status: status === 'retour_partiel' ? 'reception_partielle' : 'en_attente_reception',
      updated_by: profileId,
    })
    .eq('id', id)
  if (error) throw error

  await upsertAutomaticDifference(id, changeExpected, difference)
}

async function upsertAutomaticDifference(cashPurchaseId: string, changeExpected: number, difference: number) {
  if (Math.abs(difference) <= 0) return
  const isAdvanceOverrun = changeExpected < 0
  const { error } = await supabase.schema('stock').from('cash_purchase_differences').insert({
    cash_purchase_id: cashPurchaseId,
    difference_type: isAdvanceOverrun ? 'advance_overrun' : 'change_not_returned',
    amount: Math.abs(difference),
    description: isAdvanceOverrun
      ? 'Total achete superieur au montant remis par la caisse'
      : difference > 0
        ? 'Monnaie attendue non rendue totalement'
        : 'Monnaie rendue superieure a la monnaie attendue',
    status: 'a_justifier',
  })
  if (error) throw error
}

export async function addReceipt(cashPurchaseId: string, values: { file_url: string; file_name: string; description?: string }, profileId?: string) {
  const { error } = await supabase.schema('stock').from('cash_purchase_receipts').insert({
    cash_purchase_id: cashPurchaseId,
    file_url: values.file_url,
    file_name: values.file_name,
    description: cleanNullable(values.description),
    uploaded_by: profileId,
  })
  if (error) throw error
  await refreshCashStatusAfterReceipt(cashPurchaseId, profileId)
}

export async function uploadCashPurchaseReceipt(cashPurchaseId: string, file: File, description: string | undefined, profileId?: string) {
  const preparedFile = await compressReceiptFile(file)
  const extension = preparedFile.name.split('.').pop() || 'bin'
  const safeName = preparedFile.name
    .replace(/\.[^.]+$/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  const path = `${cashPurchaseId}/${Date.now()}-${safeName}.${extension}`

  const { error: uploadError } = await supabase.storage
    .from(CASH_RECEIPTS_BUCKET)
    .upload(path, preparedFile, {
      cacheControl: '3600',
      contentType: preparedFile.type || file.type,
      upsert: false,
    })

  if (uploadError) throw uploadError

  const { data } = supabase.storage.from(CASH_RECEIPTS_BUCKET).getPublicUrl(path)

  const { error } = await supabase.schema('stock').from('cash_purchase_receipts').insert({
    cash_purchase_id: cashPurchaseId,
    file_url: data.publicUrl,
    file_name: preparedFile.name,
    file_size: preparedFile.size,
    mime_type: preparedFile.type,
    description: cleanNullable(description),
    uploaded_by: profileId,
  })

  if (error) throw error
  await refreshCashStatusAfterReceipt(cashPurchaseId, profileId)
}

export async function justifyDifference(id: string, justification: string, profileId?: string) {
  const { data: difference } = await supabase.schema('stock')
    .from('cash_purchase_differences')
    .select('cash_purchase_id')
    .eq('id', id)
    .maybeSingle()
  const { error } = await supabase.schema('stock')
    .from('cash_purchase_differences')
    .update({ status: 'justifie', justification, justified_by: profileId, justified_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
  if (difference?.cash_purchase_id) {
    await updateWorkflowStatus(difference.cash_purchase_id, { cash_status: 'ecart_a_valider' }, profileId)
  }
}

export async function validateDifference(id: string, profileId?: string) {
  const { error } = await supabase.schema('stock')
    .from('cash_purchase_differences')
    .update({ status: 'valide', validated_by: profileId, validated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
  const { data: difference } = await supabase.schema('stock')
    .from('cash_purchase_differences')
    .select('cash_purchase_id')
    .eq('id', id)
    .maybeSingle()
  if (difference?.cash_purchase_id) {
    await updateWorkflowStatus(difference.cash_purchase_id, { cash_status: 'ecart_valide_direction' }, profileId)
  }
}

export async function closeCashPurchase(id: string, profileId?: string, comment?: string) {
  const purchase = await getCashPurchase(id)
  const hasBlockingDifference = (purchase.cash_purchase_differences ?? []).some((difference) => difference.status !== 'valide' && Number(difference.amount) > 0)
  if (hasBlockingDifference) throw new Error("L'ecart doit etre justifie avant la cloture")
  if ((purchase.cash_purchase_receipts ?? []).length === 0) throw new Error('Tous les justificatifs doivent etre fournis')

  const { error } = await supabase.schema('stock')
    .from('cash_purchases')
    .update({ status: 'cloture', cash_status: 'cloture_caisse', closed_by: profileId, closed_at: new Date().toISOString(), closing_comment: cleanNullable(comment) })
    .eq('id', id)
  if (error) throw error
}

function deriveCashWorkflowStatus(changeExpected: number, difference: number) {
  if (difference > 0) return 'rendu_monnaie_a_suivre'
  if (difference !== 0 || changeExpected < 0) return 'ecart_a_valider'
  return 'monnaie_rendue'
}

async function updateWorkflowStatus(
  cashPurchaseId: string,
  patch: { cash_status?: string; reception_status?: string; stock_entry_status?: string },
  profileId?: string,
) {
  const { error } = await supabase.schema('stock').rpc('update_cash_purchase_workflow_status', {
    p_cash_purchase_id: cashPurchaseId,
    p_cash_status: patch.cash_status ?? null,
    p_reception_status: patch.reception_status ?? null,
    p_stock_entry_status: patch.stock_entry_status ?? null,
    p_profile_id: profileId ?? null,
  })
  if (error) throw error
}

async function refreshCashStatusAfterReceipt(cashPurchaseId: string, profileId?: string) {
  const purchase = await getCashPurchase(cashPurchaseId)
  const difference = Number(purchase.difference ?? 0)
  const changeExpected = Number(purchase.change_expected ?? 0)
  const cashStatus = difference === 0 && changeExpected >= 0 ? 'justificatif_recu' : deriveCashWorkflowStatus(changeExpected, difference)
  await updateWorkflowStatus(cashPurchaseId, { cash_status: cashStatus }, profileId)
}
