import { supabase } from '../../lib/supabase'
import { compressReceiptFile } from '../../lib/imageCompression'
import { calculateMaterialCost } from '../../lib/materialCosts'
import type { Invoice, InvoiceFormValues, InvoicePaymentFormValues, InvoiceStatus, PaymentMode } from '../../lib/invoices'

const INVOICE_FILES_BUCKET = 'invoice-files'

type InvoiceFilters = {
  search?: string
  status?: InvoiceStatus | 'all'
  supplierId?: string
  paymentMode?: PaymentMode | 'all'
  fromDate?: string
  toDate?: string
  payableOnly?: boolean
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
    .select('*, suppliers(*), receptions(id, reference, invoice_number, total_amount), creator:profiles!invoices_created_by_fkey(id, full_name), invoice_payments(*)', { count: 'exact' })
    .order('due_date', { ascending: true })
    .range(from, to)

  if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status)
  if (filters.supplierId) query = query.eq('supplier_id', filters.supplierId)
  if (filters.paymentMode && filters.paymentMode !== 'all') query = query.eq('payment_mode', filters.paymentMode)
  if (filters.fromDate) query = query.gte('invoice_date', filters.fromDate)
  if (filters.toDate) query = query.lte('invoice_date', filters.toDate)
  if (filters.payableOnly) query = query.gt('amount_remaining', 0).in('status', ['validee', 'a_payer', 'partiellement_paye', 'conteste'])
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
    .select('*, suppliers(*), receptions(id, reference, invoice_number, total_amount), validator:profiles!invoices_validated_by_fkey(id, full_name), creator:profiles!invoices_created_by_fkey(id, full_name), invoice_items(*, articles(id, name, families(id, name)), units(id, name, abbreviation)), invoice_payments(*, creator:profiles!invoice_payments_created_by_fkey(id, full_name), validator:profiles!invoice_payments_validated_by_fkey(id, full_name), executor:profiles!invoice_payments_executed_by_fkey(id, full_name)), invoice_history(*, actor:profiles!invoice_history_created_by_fkey(id, full_name))')
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
    .select('*, suppliers(*), reception_items(*, articles(id, name, families(id, name)), units:units!reception_items_unit_id_fkey(id, name, abbreviation))')
    .in('status', ['validee', 'validee_avec_anomalies', 'entree_stock'])
    .order('reception_date', { ascending: false })
  if (alreadyInvoicedIds.length > 0) query = query.not('id', 'in', `(${alreadyInvoicedIds.join(',')})`)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function createInvoice(values: InvoiceFormValues, profileId?: string, file?: File) {
  validateInvoice(values)
  if (!file) throw new Error('Veuillez ajouter une piece jointe')
  const reference = values.reference?.trim() || await generateInvoiceReference(values.invoice_date)
  const uploaded = file ? await uploadInvoiceFile(reference, file) : null
  const headerCost = calculateMaterialCost({
    amountHt: values.amount_ht,
    vatAmount: values.amount_tva,
    amountTtc: Number(values.amount_ht ?? 0) + Number(values.amount_tva ?? 0),
    quantityStock: 1,
    invoiceTaxMode: values.invoice_tax_mode as never,
    vatRate: values.vat_rate,
    vatRecoverable: values.vat_recoverable,
    declaredExtraTaxRate: values.declared_extra_tax_rate,
    declaredExtraTaxAmount: values.declared_extra_tax_amount,
  })

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
      supplier_tax_status: values.supplier_tax_status || null,
      invoice_tax_mode: values.invoice_tax_mode || 'invoice_with_recoverable_vat',
      vat_rate: headerCost.vat_rate,
      vat_recoverable: headerCost.vat_recoverable,
      recoverable_vat_amount: headerCost.recoverable_vat_amount,
      non_recoverable_vat_amount: headerCost.non_recoverable_vat_amount,
      declared_extra_tax_rate: headerCost.declared_extra_tax_rate,
      declared_extra_tax_amount: headerCost.declared_extra_tax_amount,
      accounting_total_amount: headerCost.accounting_total_amount,
      effective_material_cost_total: headerCost.effective_material_cost_total,
      effective_cost_method: headerCost.effective_cost_method,
      effective_cost_source: 'invoice',
      effective_cost_note: cleanNullable(values.effective_cost_note),
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
  const reference = values.reference?.trim() || current.reference
  const uploaded = file ? await uploadInvoiceFile(current.reference, file) : null
  const headerCost = calculateMaterialCost({
    amountHt: values.amount_ht,
    vatAmount: values.amount_tva,
    amountTtc: Number(values.amount_ht ?? 0) + Number(values.amount_tva ?? 0),
    quantityStock: 1,
    invoiceTaxMode: values.invoice_tax_mode as never,
    vatRate: values.vat_rate,
    vatRecoverable: values.vat_recoverable,
    declaredExtraTaxRate: values.declared_extra_tax_rate,
    declaredExtraTaxAmount: values.declared_extra_tax_amount,
  })

  const { error } = await supabase.schema('stock')
    .from('invoices')
    .update({
      reference,
      supplier_id: values.supplier_id,
      invoice_number: values.invoice_number.trim(),
      invoice_date: values.invoice_date,
      due_date: values.due_date,
      amount_ht: values.amount_ht,
      amount_tva: values.amount_tva,
      supplier_tax_status: values.supplier_tax_status || null,
      invoice_tax_mode: values.invoice_tax_mode || 'invoice_with_recoverable_vat',
      vat_rate: headerCost.vat_rate,
      vat_recoverable: headerCost.vat_recoverable,
      recoverable_vat_amount: headerCost.recoverable_vat_amount,
      non_recoverable_vat_amount: headerCost.non_recoverable_vat_amount,
      declared_extra_tax_rate: headerCost.declared_extra_tax_rate,
      declared_extra_tax_amount: headerCost.declared_extra_tax_amount,
      accounting_total_amount: headerCost.accounting_total_amount,
      effective_material_cost_total: headerCost.effective_material_cost_total,
      effective_cost_method: headerCost.effective_cost_method,
      effective_cost_source: 'invoice',
      effective_cost_note: cleanNullable(values.effective_cost_note),
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
  if (!values.reception_id) throw new Error('Veuillez selectionner une reception')
  if (values.items.length === 0) throw new Error('La reception selectionnee ne contient aucun article a facturer')
  if (values.due_date < values.invoice_date) throw new Error("La date d'echeance doit etre posterieure a la date de facture")
  if (values.amount_ht < 0 || values.amount_tva < 0) throw new Error('Une erreur est survenue. Veuillez reessayer.')
}

function buildInvoiceCreationDescription(values: InvoiceFormValues) {
  const total = Number(values.amount_ht ?? 0) + Number(values.amount_tva ?? 0)
  return `Facture creee depuis reception pour ${total.toLocaleString('fr-FR')} Ar`
}

async function replaceInvoiceItems(invoiceId: string, items: InvoiceFormValues['items']) {
  const { error: deleteError } = await supabase.schema('stock').from('invoice_items').delete().eq('invoice_id', invoiceId)
  if (deleteError) throw deleteError
  if (items.length === 0) return

  const rows = items.map((item) => ({
    ...buildInvoiceItemRow(invoiceId, item),
  }))
  const { error } = await supabase.schema('stock').from('invoice_items').insert(rows)
  if (error) throw error
}

function buildInvoiceItemRow(invoiceId: string, item: InvoiceFormValues['items'][number]) {
  const amountHt = Number(item.quantity ?? 0) * Number(item.unit_price ?? 0)
  const invoiceTaxMode = item.invoice_tax_mode || 'invoice_with_recoverable_vat'
  const vatRate = Number(item.vat_rate ?? 20)
  const vatAmount = ['invoice_with_recoverable_vat', 'invoice_ttc_vat_not_recoverable'].includes(invoiceTaxMode)
    ? amountHt * vatRate / 100
    : 0
  const cost = calculateMaterialCost({
    amountHt,
    vatAmount,
    amountTtc: amountHt + vatAmount,
    quantityStock: item.quantity,
    invoiceTaxMode: invoiceTaxMode as never,
    vatRate,
    vatRecoverable: item.vat_recoverable,
    declaredExtraTaxRate: item.declared_extra_tax_rate,
    declaredExtraTaxAmount: item.declared_extra_tax_amount,
  })

  return {
    invoice_id: invoiceId,
    article_id: item.article_id,
    quantity: item.quantity,
    unit_id: item.unit_id,
    unit_price: item.unit_price,
    supplier_tax_status: item.supplier_tax_status || null,
    invoice_tax_mode: invoiceTaxMode,
    invoice_amount_ht: cost.invoice_amount_ht,
    invoice_vat_amount: cost.invoice_vat_amount,
    invoice_amount_ttc: cost.invoice_amount_ttc,
    vat_rate: cost.vat_rate,
    vat_recoverable: cost.vat_recoverable,
    recoverable_vat_amount: cost.recoverable_vat_amount,
    non_recoverable_vat_amount: cost.non_recoverable_vat_amount,
    declared_extra_tax_rate: cost.declared_extra_tax_rate,
    declared_extra_tax_amount: cost.declared_extra_tax_amount,
    accounting_total_amount: cost.accounting_total_amount,
    effective_material_cost_total: cost.effective_material_cost_total ?? amountHt,
    effective_material_unit_cost: cost.effective_material_unit_cost ?? item.unit_price,
    effective_cost_method: cost.effective_cost_method,
    effective_cost_source: 'invoice',
    effective_cost_note: cleanNullable(item.effective_cost_note),
    comment: cleanNullable(item.comment),
  }
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

export async function prepareInvoicePayment(id: string, values: InvoicePaymentFormValues, profileId?: string) {
  if (!values.payment_mode) throw new Error('Veuillez selectionner un mode de paiement')
  const invoice = await getInvoice(id)
  if (invoice.status === 'payee' || invoice.status === 'cloturee') throw new Error('Cette facture a deja ete payee')
  if (!['validee', 'a_payer', 'partiellement_paye'].includes(invoice.status)) throw new Error('La facture doit etre validee avant paiement')
  const pendingPreparedAmount = (invoice.invoice_payments ?? [])
    .filter((payment) => ['a_valider_direction', 'a_executer'].includes(payment.status ?? ''))
    .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0)
  if (Number(values.amount) > Number(invoice.amount_remaining ?? 0) - pendingPreparedAmount) throw new Error('Le montant prepare ne peut pas depasser le reste a payer')

  const { error } = await supabase.schema('stock').from('invoice_payments').insert({
    invoice_id: id,
    amount: values.amount,
    payment_mode: values.payment_mode,
    payment_date: values.payment_date,
    planned_payment_date: values.payment_date,
    payment_reference: cleanNullable(values.payment_reference),
    cash_account: cleanNullable(values.cash_account),
    beneficiary: cleanNullable(values.beneficiary) ?? invoice.suppliers?.name ?? null,
    comment: cleanNullable(values.comment),
    status: 'a_valider_direction',
    planned_by: profileId,
    planned_at: new Date().toISOString(),
    created_by: profileId,
  })
  if (error) throw error
  await addInvoiceHistory(id, 'paiement_prepare', `${Number(values.amount).toLocaleString('fr-FR')} Ar prepare pour validation Direction`, profileId)
}

export async function validateInvoicePayment(paymentId: string, profileId?: string, comment?: string) {
  const payment = await getInvoicePayment(paymentId)
  if (payment.status !== 'a_valider_direction') throw new Error('Ce paiement ne peut pas etre valide')
  const { error } = await supabase.schema('stock')
    .from('invoice_payments')
    .update({
      status: 'a_executer',
      validated_by: profileId,
      validated_at: new Date().toISOString(),
      validation_comment: cleanNullable(comment),
    })
    .eq('id', paymentId)
  if (error) throw error
  await addInvoiceHistory(payment.invoice_id, 'paiement_valide_direction', `${Number(payment.amount).toLocaleString('fr-FR')} Ar valide par la Direction`, profileId)
}

export async function refuseInvoicePayment(paymentId: string, profileId: string | undefined, reason: string) {
  if (!reason.trim()) throw new Error('Motif obligatoire')
  const payment = await getInvoicePayment(paymentId)
  if (payment.status !== 'a_valider_direction') throw new Error('Ce paiement ne peut pas etre refuse')
  const { error } = await supabase.schema('stock')
    .from('invoice_payments')
    .update({
      status: 'refuse_direction',
      refused_by: profileId,
      refused_at: new Date().toISOString(),
      refusal_reason: reason.trim(),
    })
    .eq('id', paymentId)
  if (error) throw error
  await addInvoiceHistory(payment.invoice_id, 'paiement_refuse_direction', reason.trim(), profileId)
}

export async function executeInvoicePayment(paymentId: string, values: InvoicePaymentFormValues, profileId?: string) {
  if (!values.payment_mode) throw new Error('Veuillez selectionner un mode de paiement')
  const payment = await getInvoicePayment(paymentId)
  if (payment.status !== 'a_executer' && payment.status !== 'valide_direction') throw new Error('Ce paiement doit etre valide par la Direction avant execution')
  const invoice = await getInvoice(payment.invoice_id)
  if (Number(values.amount) > Number(invoice.amount_remaining ?? 0)) throw new Error('Le montant paye ne peut pas depasser le montant total')

  const { error: paymentError } = await supabase.schema('stock')
    .from('invoice_payments')
    .update({
      amount: values.amount,
      payment_mode: values.payment_mode,
      payment_date: values.payment_date,
      payment_reference: cleanNullable(values.payment_reference),
      cash_account: cleanNullable(values.cash_account),
      beneficiary: cleanNullable(values.beneficiary) ?? invoice.suppliers?.name ?? null,
      execution_comment: cleanNullable(values.comment),
      status: 'execute',
      executed_by: profileId,
      executed_at: new Date().toISOString(),
    })
    .eq('id', paymentId)
  if (paymentError) throw paymentError

  await applyExecutedPayment(invoice, values, profileId)
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
    cash_account: cleanNullable(values.cash_account),
    beneficiary: cleanNullable(values.beneficiary) ?? invoice.suppliers?.name ?? null,
    comment: cleanNullable(values.comment),
    status: 'execute',
    planned_payment_date: values.payment_date,
    planned_by: profileId,
    planned_at: new Date().toISOString(),
    executed_by: profileId,
    executed_at: new Date().toISOString(),
    created_by: profileId,
  })
  if (paymentError) throw paymentError

  await applyExecutedPayment(invoice, values, profileId)
}

async function applyExecutedPayment(invoice: Invoice, values: InvoicePaymentFormValues, profileId?: string) {
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
    .eq('id', invoice.id)
  if (error) throw error
  await addInvoiceHistory(invoice.id, status === 'payee' ? 'paiement_execute_complet' : 'paiement_execute_partiel', `${Number(values.amount).toLocaleString('fr-FR')} Ar execute`, profileId)
}

async function getInvoicePayment(paymentId: string) {
  const { data, error } = await supabase.schema('stock')
    .from('invoice_payments')
    .select('*, invoices(*, suppliers(*))')
    .eq('id', paymentId)
    .single()
  if (error) throw error
  return data as {
    id: string
    invoice_id: string
    amount: number
    status: string | null
    invoices?: Invoice
  }
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
