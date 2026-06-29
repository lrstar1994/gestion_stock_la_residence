import { supabase } from '../../lib/supabase'
import { compressReceiptFile } from '../../lib/imageCompression'
import type { Invoice, InvoiceFormValues, InvoicePaymentFormValues, InvoiceStatus, PaymentMode } from '../../lib/invoices'

const INVOICE_FILES_BUCKET = 'invoice-files'

type InvoiceFilters = {
  search?: string
  status?: InvoiceStatus | 'all'
  supplierId?: string
  paymentMode?: PaymentMode | 'all'
  fromDate?: string
  toDate?: string
  page?: number
  pageSize?: number
}

function cleanNullable(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export async function listInvoices(filters: InvoiceFilters = {}) {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 10
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase.schema('stock')
    .from('invoices')
    .select('*, suppliers(*), receptions(id, reference, invoice_number, total_amount), creator:profiles!invoices_created_by_fkey(id, full_name)', { count: 'exact' })
    .order('due_date', { ascending: true })
    .range(from, to)

  if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status)
  if (filters.supplierId) query = query.eq('supplier_id', filters.supplierId)
  if (filters.paymentMode && filters.paymentMode !== 'all') query = query.eq('payment_mode', filters.paymentMode)
  if (filters.fromDate) query = query.gte('invoice_date', filters.fromDate)
  if (filters.toDate) query = query.lte('invoice_date', filters.toDate)
  if (filters.search?.trim()) {
    const term = filters.search.trim()
    query = query.or(`reference.ilike.%${term}%,invoice_number.ilike.%${term}%`)
  }

  const { data, error, count } = await query
  if (error) throw error
  return { invoices: (data ?? []) as Invoice[], total: count ?? 0 }
}

export async function getInvoice(id: string) {
  const { data, error } = await supabase.schema('stock')
    .from('invoices')
    .select('*, suppliers(*), receptions(id, reference, invoice_number, total_amount), validator:profiles!invoices_validated_by_fkey(id, full_name), creator:profiles!invoices_created_by_fkey(id, full_name), invoice_items(*, articles(id, name, families(id, name)), units(id, name, abbreviation)), invoice_payments(*, creator:profiles!invoice_payments_created_by_fkey(id, full_name)), invoice_history(*, actor:profiles!invoice_history_created_by_fkey(id, full_name))')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as Invoice
}

export async function listInvoiceableReceptions() {
  const { data: activeInvoices, error: invoiceError } = await supabase.schema('stock')
    .from('invoices')
    .select('reception_id')
    .not('reception_id', 'is', null)
    .neq('status', 'annulee')
  if (invoiceError) throw invoiceError
  const alreadyInvoicedIds = (activeInvoices ?? []).map((invoice) => invoice.reception_id).filter(Boolean)

  let query = supabase.schema('stock')
    .from('receptions')
    .select('*, suppliers(*), reception_items(*, articles(id, name, families(id, name)), units(id, name, abbreviation))')
    .in('status', ['validee', 'validee_avec_anomalies', 'entree_stock'])
    .order('reception_date', { ascending: false })
  if (alreadyInvoicedIds.length > 0) query = query.not('id', 'in', `(${alreadyInvoicedIds.join(',')})`)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function createInvoice(values: InvoiceFormValues, profileId?: string, file?: File) {
  validateInvoice(values)
  const reference = await generateInvoiceReference(values.invoice_date)
  const uploaded = file ? await uploadInvoiceFile(reference, file) : null

  const { data, error } = await supabase.schema('stock')
    .from('invoices')
    .insert({
      reference,
      supplier_id: values.supplier_id,
      invoice_number: values.invoice_number.trim(),
      invoice_date: values.invoice_date,
      due_date: values.due_date,
      amount_ht: values.amount_ht,
      amount_tva: values.amount_tva,
      payment_mode: values.payment_mode || null,
      comment: cleanNullable(values.comment),
      reception_id: values.reception_id || null,
      purchase_order_id: values.purchase_order_id || null,
      cash_purchase_id: values.cash_purchase_id || null,
      file_url: uploaded?.publicUrl ?? null,
      file_name: uploaded?.file.name ?? null,
      created_by: profileId,
      updated_by: profileId,
    })
    .select('id')
    .single()
  if (error) {
    if (error.code === '23505') throw new Error('Le numero de facture doit etre unique')
    throw error
  }

  await replaceInvoiceItems(data.id, values.items)
  await addInvoiceHistory(data.id, 'creation', buildInvoiceCreationDescription(values), profileId)
  return data.id as string
}

export async function updateInvoice(id: string, values: InvoiceFormValues, profileId?: string, file?: File) {
  const current = await getInvoice(id)
  if (['payee', 'cloturee', 'annulee'].includes(current.status)) throw new Error('Cette facture ne peut plus etre modifiee')
  validateInvoice(values)
  const uploaded = file ? await uploadInvoiceFile(current.reference, file) : null

  const { error } = await supabase.schema('stock')
    .from('invoices')
    .update({
      supplier_id: values.supplier_id,
      invoice_number: values.invoice_number.trim(),
      invoice_date: values.invoice_date,
      due_date: values.due_date,
      amount_ht: values.amount_ht,
      amount_tva: values.amount_tva,
      payment_mode: values.payment_mode || null,
      comment: cleanNullable(values.comment),
      reception_id: values.reception_id || null,
      purchase_order_id: values.purchase_order_id || null,
      cash_purchase_id: values.cash_purchase_id || null,
      file_url: uploaded?.publicUrl ?? current.file_url,
      file_name: uploaded?.file.name ?? current.file_name,
      updated_by: profileId,
    })
    .eq('id', id)
  if (error) {
    if (error.code === '23505') throw new Error('Le numero de facture doit etre unique')
    throw error
  }
  await replaceInvoiceItems(id, values.items)
  await addInvoiceHistory(id, 'modification', 'Facture mise a jour', profileId)
}

function validateInvoice(values: InvoiceFormValues) {
  if (values.due_date < values.invoice_date) throw new Error("La date d'echeance doit etre posterieure a la date de facture")
  if (values.amount_ht < 0 || values.amount_tva < 0) throw new Error('Une erreur est survenue. Veuillez reessayer.')
}

function buildInvoiceCreationDescription(values: InvoiceFormValues) {
  const total = Number(values.amount_ht ?? 0) + Number(values.amount_tva ?? 0)
  return values.reception_id ? `Facture creee depuis reception pour ${total.toLocaleString('fr-FR')} Ar` : `Facture creee manuellement pour ${total.toLocaleString('fr-FR')} Ar`
}

async function replaceInvoiceItems(invoiceId: string, items: InvoiceFormValues['items']) {
  const { error: deleteError } = await supabase.schema('stock').from('invoice_items').delete().eq('invoice_id', invoiceId)
  if (deleteError) throw deleteError
  if (items.length === 0) return

  const rows = items.map((item) => ({
    invoice_id: invoiceId,
    article_id: item.article_id,
    quantity: item.quantity,
    unit_id: item.unit_id,
    unit_price: item.unit_price,
    comment: cleanNullable(item.comment),
  }))
  const { error } = await supabase.schema('stock').from('invoice_items').insert(rows)
  if (error) throw error
}

async function generateInvoiceReference(invoiceDate: string) {
  const date = new Date(invoiceDate)
  const prefix = `INV-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  const { count, error } = await supabase.schema('stock').from('invoices').select('id', { count: 'exact', head: true }).ilike('reference', `${prefix}-%`)
  if (error) throw error
  return `${prefix}-${String((count ?? 0) + 1).padStart(6, '0')}`
}

export async function validateInvoiceRecord(id: string, profileId?: string, comment?: string) {
  const invoice = await getInvoice(id)
  const status = invoice.due_date <= addDays(7) && Number(invoice.amount_remaining ?? 0) > 0 ? 'a_payer' : 'validee'
  const { error } = await supabase.schema('stock')
    .from('invoices')
    .update({ status, validated_by: profileId, validated_at: new Date().toISOString(), validation_comment: cleanNullable(comment), updated_by: profileId })
    .eq('id', id)
  if (error) throw error
  await addInvoiceHistory(id, 'validation', `Facture validee${status === 'a_payer' ? ' et marquee a payer' : ''}`, profileId)
}

export async function contestInvoice(id: string, profileId: string | undefined, reason: string) {
  if (!reason.trim()) throw new Error('Motif obligatoire')
  const { error } = await supabase.schema('stock')
    .from('invoices')
    .update({ status: 'conteste', validation_comment: reason.trim(), updated_by: profileId })
    .eq('id', id)
  if (error) throw error
  await addInvoiceHistory(id, 'contestation', reason.trim(), profileId)
}

export async function closeInvoice(id: string, profileId?: string) {
  const invoice = await getInvoice(id)
  if (Number(invoice.amount_remaining ?? 0) > 0) throw new Error('Cette facture doit etre entierement payee avant cloture')
  const { error } = await supabase.schema('stock').from('invoices').update({ status: 'cloturee', updated_by: profileId }).eq('id', id)
  if (error) throw error
  await addInvoiceHistory(id, 'cloture', 'Facture cloturee', profileId)
}

export async function addInvoicePayment(id: string, values: InvoicePaymentFormValues, profileId?: string) {
  if (!values.payment_mode) throw new Error('Veuillez selectionner un mode de paiement')
  const invoice = await getInvoice(id)
  if (invoice.status === 'payee' || invoice.status === 'cloturee') throw new Error('Cette facture a deja ete payee')
  if (!['validee', 'a_payer', 'partiellement_paye'].includes(invoice.status)) throw new Error('La facture doit etre validee avant paiement')
  if (Number(values.amount) > Number(invoice.amount_remaining ?? 0)) throw new Error('Le montant paye ne peut pas depasser le montant total')

  const { error: paymentError } = await supabase.schema('stock').from('invoice_payments').insert({
    invoice_id: id,
    amount: values.amount,
    payment_mode: values.payment_mode,
    payment_date: values.payment_date,
    payment_reference: cleanNullable(values.payment_reference),
    comment: cleanNullable(values.comment),
    created_by: profileId,
  })
  if (paymentError) throw paymentError

  const paid = Number(invoice.amount_paid ?? 0) + Number(values.amount)
  const total = Number(invoice.amount_ttc ?? 0)
  const status: InvoiceStatus = paid >= total ? 'payee' : 'partiellement_paye'
  const { error } = await supabase.schema('stock')
    .from('invoices')
    .update({
      amount_paid: paid,
      status,
      payment_mode: values.payment_mode,
      payment_date: values.payment_date,
      payment_reference: cleanNullable(values.payment_reference),
      updated_by: profileId,
    })
    .eq('id', id)
  if (error) throw error
  await addInvoiceHistory(id, status === 'payee' ? 'paiement_complet' : 'paiement_partiel', `${Number(values.amount).toLocaleString('fr-FR')} Ar paye`, profileId)
}

function addDays(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

async function addInvoiceHistory(invoiceId: string, action: string, description: string, profileId?: string) {
  const { error } = await supabase.schema('stock').from('invoice_history').insert({
    invoice_id: invoiceId,
    action,
    description,
    created_by: profileId,
  })
  if (error) throw error
}

async function uploadInvoiceFile(reference: string, file: File) {
  const preparedFile = await compressReceiptFile(file)
  const extension = preparedFile.name.split('.').pop() || 'bin'
  const safeName = preparedFile.name.replace(/\.[^.]+$/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase()
  const path = `${reference}/${Date.now()}-${safeName}.${extension}`
  const { error } = await supabase.storage.from(INVOICE_FILES_BUCKET).upload(path, preparedFile, { contentType: preparedFile.type || file.type, upsert: false })
  if (error) throw error
  const { data } = supabase.storage.from(INVOICE_FILES_BUCKET).getPublicUrl(path)
  return { publicUrl: data.publicUrl, file: preparedFile }
}
