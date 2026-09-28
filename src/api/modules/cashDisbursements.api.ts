import { supabase } from '../../lib/supabase'
import type { NonPurchaseDisbursement, NonPurchaseDisbursementFormValues } from '../../lib/cashDisbursements'
import { parseNonPurchaseMetadata } from '../../lib/cashDisbursements'

const RECEIPTS_BUCKET = 'cash-purchase-receipts'

export async function listNonPurchaseDisbursements(reportDate?: string) {
  let query = supabase.schema('stock').from('non_purchase_cash_disbursements')
    .select('*, requester:profiles!non_purchase_cash_disbursements_requested_by_fkey(id, full_name, role)')
    .order('created_at', { ascending: false })
  if (reportDate) query = query.eq('request_date', reportDate)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((row) => ({ ...row, metadata: parseNonPurchaseMetadata(row.validation_comment) })) as NonPurchaseDisbursement[]
}

export async function createNonPurchaseDisbursement(values: NonPurchaseDisbursementFormValues, profileId: string, file?: File | null) {
  if (!values.beneficiary.trim() || !values.reason.trim() || values.amount <= 0) throw new Error('Beneficiaire, motif et montant sont obligatoires')
  if (values.supportingDocumentStatus === 'present' && !file) throw new Error('Selectionnez le justificatif annonce comme present')
  const reference = `DEC-${values.actualDate.replaceAll('-', '')}-${Date.now().toString().slice(-6)}`
  let documentPath = ''
  if (file) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    documentPath = `non-purchase/${reference}/${crypto.randomUUID()}-${safeName}`
    const { error: uploadError } = await supabase.storage.from(RECEIPTS_BUCKET).upload(documentPath, file, { upsert: false })
    if (uploadError) throw uploadError
  }
  const metadata = { type: values.type, beneficiary: values.beneficiary.trim(), paymentMode: values.paymentMode, service: values.service.trim(), supportingDocumentStatus: file ? 'present' : values.supportingDocumentStatus, supportingDocumentPath: documentPath || undefined, supportingDocumentName: file?.name, comment: values.comment.trim(), validationRequired: values.validationRequired }
  const { data, error } = await supabase.schema('stock').from('non_purchase_cash_disbursements').insert({
    reference, category: values.category, cash_source: values.cashSource, request_date: values.actualDate,
    requested_by: profileId, reason: values.reason.trim(), amount_requested: values.amount,
    status: values.validationRequired ? 'pending_direction' : 'approved', validation_comment: JSON.stringify(metadata),
    created_by: profileId, updated_by: profileId,
  }).select('id').single()
  if (error) {
    if (documentPath) await supabase.storage.from(RECEIPTS_BUCKET).remove([documentPath])
    throw error
  }
  return { id: data.id as string, reference }
}
