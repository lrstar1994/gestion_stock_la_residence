import { supabase } from '../../lib/supabase'
import type { CashPurchase, CashPurchaseFormValues, CashPurchaseItem, CashPurchaseSource, CashPurchaseStatus } from '../../lib/cashPurchases'
import { calculateCashTotals, calculateReturnTotals, cashPurchaseSchema } from '../../lib/cashPurchases'
import { compressReceiptFile } from '../../lib/imageCompression'

const CASH_RECEIPTS_BUCKET = 'cash-purchase-receipts'
const CASH_RECEIPTS_MAX_BYTES = 5 * 1024 * 1024
const CASH_RECEIPTS_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])

function storageUploadError(error: unknown) {
  if (!error || typeof error !== 'object') return new Error('Upload du justificatif refusé par Storage')
  const value = error as { message?: string; statusCode?: string | number; error?: string; details?: string }
  const parts = [value.message, value.error, value.details, value.statusCode ? ('HTTP ' + String(value.statusCode)) : undefined].filter((part): part is string => Boolean(part))
  return new Error(parts.join(' — ') || 'Upload du justificatif refusé par Storage')
}

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

function isMissingColumnError(error: unknown) {
  return error && typeof error === 'object' && 'message' in error && String((error as { message?: string }).message).includes('column')
}

function normalizeBuyerDirectory(row: any) {
  const directory = row?.buyer_directory
  if (!directory) return row
  return { ...row, buyer_directory: { id: directory.id, full_name: `${directory.first_name ?? ''} ${directory.last_name ?? ''}`.trim(), phone: directory.phone ?? null } }
}

export async function listCashPurchases(filters: CashPurchaseFilters = {}) {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 10
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase.schema('stock')
    .from('cash_purchases')
    .select('*, buyer:profiles!cash_purchases_buyer_id_fkey(id, full_name, role), buyer_directory:cash_purchase_buyer_directory!cash_purchases_buyer_directory_id_fkey(id, first_name, last_name, phone), cash_purchase_receipts(id), cash_purchase_differences(id, amount, status, difference_type)', { count: 'exact' })
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
  return { purchases: (data ?? []).map(normalizeBuyerDirectory) as CashPurchase[], total: count ?? 0 }
}

export async function listDailyCashDisbursementReport(reportDate: string) {
  const { data, error } = await supabase.schema('stock')
    .from('cash_purchases')
    .select('*, buyer:profiles!cash_purchases_buyer_id_fkey(id, full_name, role), buyer_directory:cash_purchase_buyer_directory!cash_purchases_buyer_directory_id_fkey(id, first_name, last_name, phone), validator:profiles!cash_purchases_validated_by_fkey(id, full_name), cashier:profiles!cash_purchases_given_by_fkey(id, full_name), closer:profiles!cash_purchases_closed_by_fkey(id, full_name), cash_purchase_items(id, total_estimated, total_real), cash_purchase_receipts(id), cash_purchase_differences(id, amount, status, difference_type)')
    .eq('request_date', reportDate)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map(normalizeBuyerDirectory) as CashPurchase[]
}

export class CashPurchaseNotFoundError extends Error {
  constructor(id: string) {
    super(`Achat espèces ${id} introuvable`)
    this.name = 'CashPurchaseNotFoundError'
  }
}

export async function listCashPurchaseBuyers() {
  const { data, error } = await supabase.schema('stock').rpc('list_cash_purchase_buyers')
  if (error) throw error
  return (data ?? []) as Array<{ id: string; full_name: string | null; phone?: string | null; role: string; kind: 'profile' | 'directory'; profile_id: string | null; directory_id: string | null }>
}

export async function createCashPurchaseBuyer(firstName: string, lastName: string, phone?: string) {
  const { data, error } = await supabase.schema('stock').rpc('create_cash_purchase_buyer', {
    p_first_name: firstName,
    p_last_name: lastName,
    p_phone: phone?.trim() || null,
  })
  if (error) throw error
  if (!data) throw new Error('Acheteur non créé')
  return data as string
}

export async function archiveCashPurchaseBuyer(id: string) {
  const { error } = await supabase.schema('stock').rpc('archive_cash_purchase_buyer', { p_buyer_id: id })
  if (error) throw error
}

function logCashPurchaseReadError(query: string, error: unknown) {
  const value = error && typeof error === 'object' ? error as Record<string, unknown> : {}
  console.error('[cashPurchases.api] Lecture échouée', {
    query,
    code: value.code ?? null,
    message: value.message ?? String(error),
    details: value.details ?? null,
    hint: value.hint ?? null,
  })
}

async function readCashPurchaseSection<T>(queryName: string, request: PromiseLike<{ data: T | null; error: unknown }>, fallback: T): Promise<T> {
  try {
    const { data, error } = await request
    if (error) {
      logCashPurchaseReadError(queryName, error)
      return fallback
    }
    return data ?? fallback
  } catch (error) {
    logCashPurchaseReadError(queryName, error)
    return fallback
  }
}

export async function getCashPurchase(id: string) {
  const { data: purchase, error } = await supabase.schema('stock')
    .from('cash_purchases')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    logCashPurchaseReadError('stock.cash_purchases SELECT id', error)
    throw error
  }
  if (!purchase) throw new CashPurchaseNotFoundError(id)

  const [items, receipts, differences] = await Promise.all([
    readCashPurchaseSection(
      'stock.cash_purchase_items SELECT avec articles, besoins et unités',
      supabase.schema('stock').from('cash_purchase_items')
        .select('*, purchase_needs(*, articles(id, name, default_supplier, min_stock), units(id, name, abbreviation), intended_uses:purchase_intended_uses!purchase_needs_intended_use_id_fkey(id, code, label), requester:profiles!purchase_needs_created_by_fkey(id, full_name, role)), articles(id, name, unit_id, units(id, name, abbreviation)), units!cash_purchase_items_unit_id_fkey(id, name, abbreviation), stock_unit:units!cash_purchase_items_stock_unit_id_fkey(id, name, abbreviation)')
        .eq('cash_purchase_id', id),
      null as CashPurchase['cash_purchase_items'] | null,
    ).then(async (rows) => rows ?? await readCashPurchaseSection(
      'stock.cash_purchase_items SELECT de repli sans relations',
      supabase.schema('stock').from('cash_purchase_items').select('*').eq('cash_purchase_id', id),
      [],
    )),
    readCashPurchaseSection(
      'stock.cash_purchase_receipts SELECT avec fournisseur',
      supabase.schema('stock').from('cash_purchase_receipts')
        .select('*, suppliers(id, name)')
        .eq('cash_purchase_id', id),
      null as CashPurchase['cash_purchase_receipts'] | null,
    ).then(async (rows) => rows ?? await readCashPurchaseSection(
      'stock.cash_purchase_receipts SELECT de repli',
      supabase.schema('stock').from('cash_purchase_receipts').select('*').eq('cash_purchase_id', id),
      [],
    )),
    readCashPurchaseSection(
      'stock.cash_purchase_differences SELECT',
      supabase.schema('stock').from('cash_purchase_differences').select('*').eq('cash_purchase_id', id),
      [] as CashPurchase['cash_purchase_differences'],
    ),
  ])

  const receiptRows = (receipts ?? []) as NonNullable<CashPurchase['cash_purchase_receipts']>
  const profileIds = [purchase.buyer_id, purchase.validated_by, purchase.given_by, purchase.closed_by,
    ...receiptRows.map((receipt) => receipt.cancelled_by ?? null)]
    .filter((profileId): profileId is string => Boolean(profileId))
  const profiles = profileIds.length ? await readCashPurchaseSection(
    'stock.profiles SELECT des acteurs du dossier',
    supabase.schema('stock').from('profiles').select('id, full_name, role').in('id', profileIds),
    [],
  ) : []
  const profileById = new Map((profiles as Array<{ id: string; full_name: string | null; role?: string }>).map((profile) => [profile.id, profile]))

  let buyerDirectory: CashPurchase['buyer_directory'] = null
  if (purchase.buyer_directory_id) {
    const directory = await readCashPurchaseSection(
      'stock.cash_purchase_buyer_directory SELECT',
      supabase.schema('stock').from('cash_purchase_buyer_directory').select('id, first_name, last_name, phone').eq('id', purchase.buyer_directory_id).maybeSingle(),
      null as { id: string; first_name: string; last_name: string; phone?: string | null } | null,
    )
    buyerDirectory = directory ? { id: directory.id, full_name: `${directory.first_name} ${directory.last_name}`.trim(), phone: directory.phone } : null
  }
  return {
    ...purchase,
    buyer: purchase.buyer_id ? profileById.get(purchase.buyer_id) ?? null : null,
    buyer_directory: buyerDirectory,
    validator: purchase.validated_by ? profileById.get(purchase.validated_by) ?? null : null,
    cashier: purchase.given_by ? profileById.get(purchase.given_by) ?? null : null,
    closer: purchase.closed_by ? profileById.get(purchase.closed_by) ?? null : null,
    cash_purchase_items: items,
    cash_purchase_receipts: receiptRows.map((receipt) => ({
      ...receipt,
      cancelled_by_profile: receipt.cancelled_by ? profileById.get(receipt.cancelled_by) ?? null : null,
    })),
    cash_purchase_differences: differences,
  } as CashPurchase
}

export async function createCashPurchase(values: CashPurchaseFormValues, profileId?: string) {
  const validatedValues = cashPurchaseSchema.parse(values)
  const total = calculateCashTotals(validatedValues.items)
  if (total <= 0) throw new Error('Le montant demande doit etre superieur a 0')

  const reference = await generateCashPurchaseReference()
  const insertRow = {
    supplier_id: validatedValues.supplier_id || null,
    reference,
    buyer_id: validatedValues.buyer_id,
    cash_source: validatedValues.cash_source,
    reason: validatedValues.reason.trim(),
    purchase_date: validatedValues.purchase_date || null,
    request_date: validatedValues.request_date,
    total_estimated: total,
    amount_requested: total,
    status: 'en_attente',
    cash_status: 'especes_demandees',
    reception_status: 'en_attente_reception',
    stock_entry_status: 'non_entre_stock',
    created_by: profileId,
    updated_by: profileId,
  }

  let { data, error } = await supabase.schema('stock')
    .from('cash_purchases')
    .insert(insertRow)
    .select('id')
    .single()

  if (error && isMissingColumnError(error)) {
    const legacyRow = { ...insertRow } as Omit<typeof insertRow, 'supplier_id'> & { supplier_id?: string | null }
    delete legacyRow.supplier_id
    const legacyResult = await supabase.schema('stock')
      .from('cash_purchases')
      .insert(legacyRow)
      .select('id')
      .single()
    data = legacyResult.data
    error = legacyResult.error
  }

  if (error) throw error
  if (!data) throw new Error("Impossible de creer le dossier d'achat")
  await replaceItems(data.id, validatedValues.items)
  await markLinkedNeedsInProgress(validatedValues.items)
  return data.id as string
}

async function replaceItems(cashPurchaseId: string, items: CashPurchaseFormValues['items']) {
  const rows = items.map((item) => ({
    cash_purchase_id: cashPurchaseId,
    article_id: item.article_mode === 'catalog' ? item.article_id : null,
    free_designation: item.article_mode === 'free' ? item.free_designation?.trim() : null,
    article_match_status: item.article_mode === 'free' ? 'to_create_or_match' : 'matched',
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

export async function giveCash(id: string, amountGiven: number, pin: string, buyer: { profileId?: string | null; directoryId?: string | null }) {
  if (amountGiven <= 0) throw new Error('Le montant remis doit etre superieur a 0')
  if (!pin.trim()) throw new Error('PIN Caisse requis')
  if ((!buyer.profileId && !buyer.directoryId) || (buyer.profileId && buyer.directoryId)) throw new Error('Acheteur obligatoire')
  const { error } = await supabase.schema('stock').rpc('disburse_cash_purchase', {
    p_cash_purchase_id: id,
    p_amount: amountGiven,
    p_buyer_profile_id: buyer.profileId ?? null,
    p_buyer_directory_id: buyer.directoryId ?? null,
    p_pin: pin,
  })
  if (error) throw error
}
export async function saveCashPurchaseReturn(id: string, items: CashPurchaseItem[], changeReturned: number, profileId?: string, overrunReason?: string, overrunPayer?: string) {
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
      validation_comment: overrunReason ? 'Depassement a regulariser - motif : ' + overrunReason + '; complement pris en charge par : ' + (overrunPayer ?? '') : undefined,
    })
    .eq('id', id)
  if (error) throw error

  await upsertAutomaticDifference(id, changeExpected, difference)
}

export async function getCashPurchaseReceiptPreviewUrl(fileUrl: string) {
  let parsedUrl: URL
  try {
    parsedUrl = new URL(fileUrl)
  } catch {
    throw new Error('Le chemin sécurisé du justificatif est indisponible')
  }

  const bucketPrefix = `/storage/v1/object/sign/${CASH_RECEIPTS_BUCKET}/`
  const publicPrefix = `/storage/v1/object/public/${CASH_RECEIPTS_BUCKET}/`
  const prefix = parsedUrl.pathname.startsWith(bucketPrefix)
    ? bucketPrefix
    : parsedUrl.pathname.startsWith(publicPrefix) ? publicPrefix : null
  if (!prefix) throw new Error('Le justificatif ne pointe pas vers le stockage autorisé')

  let objectPath: string
  try {
    objectPath = decodeURIComponent(parsedUrl.pathname.slice(prefix.length))
  } catch {
    throw new Error('Le chemin sécurisé du justificatif est invalide')
  }
  if (!objectPath || objectPath.split('/').some((segment) => segment === '..')) {
    throw new Error('Le chemin sécurisé du justificatif est invalide')
  }

  const { data, error } = await supabase.storage.from(CASH_RECEIPTS_BUCKET).createSignedUrl(objectPath, 60 * 5)
  if (error || !data?.signedUrl) throw error ?? new Error('Impossible de préparer l’aperçu du justificatif')
  return data.signedUrl
}

export async function controlCashPurchase(id: string, items: Array<{ item_id: string; quantity_accepted: number; control_comment?: string | null }>, pin: string) {
  const { data, error } = await supabase.schema('stock').rpc('control_cash_purchase', { p_purchase_id: id, p_items: items, p_pin: pin })
  if (error) throw error
  return data as { id: string; amount_accepted: number; controlled_by: string; controlled_at: string }
}

export async function receiveAndControlCashPurchase(id: string, payload: Record<string, unknown>, pin: string) {
  const { data, error } = await supabase.schema('stock').rpc('receive_and_control_cash_purchase', { p_purchase_id: id, p_payload: payload, p_pin: pin })
  if (error) throw error
  return data as Record<string, unknown>
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

export async function uploadCashPurchaseReceipt(cashPurchaseId: string, file: File, description: string | undefined, profileId?: string, metadata: {
  documentType?: string
  supplierId?: string | null
  documentDate?: string | null
    documentAmount?: number | null
  supplierDocumentNumber?: string | null
  lineIds?: string[]
  profileRole?: string
} = {}) {
  const preparedFile = await compressReceiptFile(file)
  const contentType = preparedFile.type || file.type
  if (!CASH_RECEIPTS_MIME_TYPES.has(contentType)) throw new Error('Format de justificatif non accepté. Utilisez JPG, PNG, WebP ou PDF.')
  if (preparedFile.size > CASH_RECEIPTS_MAX_BYTES) throw new Error('Le justificatif dépasse la limite de 5 Mo.')
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
      contentType,
      upsert: false,
    })

  if (uploadError) throw storageUploadError(uploadError)

  const { data, error: urlError } = await supabase.storage.from(CASH_RECEIPTS_BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7)
  if (urlError || !data?.signedUrl) throw urlError ?? new Error("Impossible de preparer le lien securise du justificatif")

  const row = {
    cash_purchase_id: cashPurchaseId,
    document_type: metadata.documentType ?? 'justificatif_achat',
    supplier_id: metadata.supplierId ?? null,
    document_date: metadata.documentDate ?? null,
    document_amount: metadata.documentAmount ?? null,
    supplier_document_number: metadata.supplierDocumentNumber ?? null,
    line_ids: metadata.lineIds ?? [],
    file_url: data.signedUrl,
    file_name: preparedFile.name,
    file_size: preparedFile.size,
    mime_type: preparedFile.type,
    description: cleanNullable(description),
    uploaded_by: profileId,
  }

  let { error } = await supabase.schema('stock').from('cash_purchase_receipts').insert(row)
  if (error && isMissingColumnError(error)) {
    const legacyRow = { ...row } as Omit<typeof row, 'document_type' | 'supplier_id' | 'document_date' | 'document_amount' | 'line_ids'> & {
      document_type?: string
      supplier_id?: string | null
      document_date?: string | null
      document_amount?: number | null
      line_ids?: string[]
    }
    delete legacyRow.document_type
    delete legacyRow.supplier_id
    delete legacyRow.document_date
    delete legacyRow.document_amount
    delete legacyRow.line_ids
    const legacyResult = await supabase.schema('stock').from('cash_purchase_receipts').insert(legacyRow)
    error = legacyResult.error
  }

  if (error) throw error
  if (metadata.profileRole !== 'controleur') await refreshCashStatusAfterReceipt(cashPurchaseId, profileId)
}

export async function cancelCashPurchaseReceipt(receiptId: string, reason: string) {
  const trimmedReason = reason.trim()
  if (!trimmedReason) throw new Error('Motif d’annulation obligatoire')
  const { data, error } = await supabase.schema('stock').rpc('cancel_cash_purchase_receipt', {
    p_receipt_id: receiptId,
    p_reason: trimmedReason,
  })
  if (error) throw error
  return data
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
  if (!(purchase.cash_purchase_receipts ?? []).some((receipt) => !receipt.cancelled_at && Boolean(receipt.file_url?.trim()))) throw new Error('Tous les justificatifs doivent etre fournis')

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
