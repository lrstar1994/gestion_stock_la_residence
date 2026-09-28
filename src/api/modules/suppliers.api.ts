import { supabase } from '../../lib/supabase'
import { buildQuickSupplierNotes } from '../../lib/suppliers'
import type { QuickSupplierFormValues, Supplier, SupplierFormValues } from '../../lib/suppliers'

function cleanNullable(value?: string) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export async function listSuppliers(search = '') {
  let query = supabase.schema('stock').from('suppliers').select('*').order('name', { ascending: true })

  if (search.trim()) {
    const term = search.trim()
    query = query.or(`name.ilike.%${term}%,contact.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,nif.ilike.%${term}%,stat.ilike.%${term}%,address.ilike.%${term}%,notes.ilike.%${term}%`)
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  return (data ?? []) as Supplier[]
}

export async function createSupplier(values: SupplierFormValues, profileId?: string) {
  const { data, error } = await supabase.schema('stock').from('suppliers').insert({
    name: values.name.trim(),
    contact: cleanNullable(values.contact),
    phone: cleanNullable(values.phone),
    email: cleanNullable(values.email),
    nif: cleanNullable(values.nif),
    stat: cleanNullable(values.stat),
    supplier_tax_status: values.supplier_tax_status ?? 'unknown',
    is_identified: Boolean(values.is_identified),
    usually_issues_vat_invoice: Boolean(values.usually_issues_vat_invoice),
    default_vat_rate: values.default_vat_rate ?? 20,
    default_vat_recoverable: values.default_vat_recoverable ?? true,
    default_invoice_tax_mode: values.default_invoice_tax_mode ?? 'invoice_with_recoverable_vat',
    is_usual_without_nif_stat: Boolean(values.is_usual_without_nif_stat),
    default_declared_extra_tax_enabled: Boolean(values.default_declared_extra_tax_enabled),
    default_declared_extra_tax_rate: values.default_declared_extra_tax_rate ?? 0,
    occasional_purchase_alert_threshold: values.occasional_purchase_alert_threshold ?? 1000000,
    address: cleanNullable(values.address),
    notes: cleanNullable(values.notes),
    created_by: profileId,
    updated_by: profileId,
  })
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return data as Supplier
}

export async function createQuickSupplier(values: QuickSupplierFormValues, profileId?: string) {
  return createSupplier({
    name: values.name,
    contact: values.contact,
    phone: values.phone,
    email: values.email,
    nif: values.nif,
    stat: values.stat,
    supplier_tax_status: values.vat_status === 'yes' ? 'nif_stat_with_vat' : values.fiscal_status === 'complete' ? 'nif_stat_without_vat' : 'unknown',
    is_identified: values.fiscal_status === 'complete',
    usually_issues_vat_invoice: values.vat_status === 'yes',
    default_vat_rate: values.vat_status === 'yes' ? 20 : 0,
    default_vat_recoverable: values.vat_status === 'yes',
    default_invoice_tax_mode: values.vat_status === 'yes' ? 'invoice_with_recoverable_vat' : 'invoice_without_vat',
    is_usual_without_nif_stat: !values.nif && !values.stat && values.usage_type === 'habituel',
    default_declared_extra_tax_enabled: false,
    default_declared_extra_tax_rate: 0,
    occasional_purchase_alert_threshold: 1000000,
    address: values.address,
    notes: buildQuickSupplierNotes(values),
  }, profileId)
}

export async function createSupplierFromPurchaseControl(values: QuickSupplierFormValues) {
  const { data, error } = await supabase.schema('stock').rpc('create_supplier_from_purchase_control', {
    p_payload: { name: values.name, contact: values.contact, phone: values.phone, email: values.email, nif: values.nif, stat: values.stat, address: values.address, notes: buildQuickSupplierNotes(values) },
  })
  if (error) throw error
  const { data: supplier, error: readError } = await supabase.schema('stock').from('suppliers').select('*').eq('id', data).single()
  if (readError) throw readError
  return supplier as Supplier
}

export async function updateSupplier(id: string, values: SupplierFormValues, profileId?: string) {
  const { error } = await supabase.schema('stock')
    .from('suppliers')
    .update({
      name: values.name.trim(),
      contact: cleanNullable(values.contact),
      phone: cleanNullable(values.phone),
      email: cleanNullable(values.email),
      nif: cleanNullable(values.nif),
      stat: cleanNullable(values.stat),
      supplier_tax_status: values.supplier_tax_status ?? 'unknown',
      is_identified: Boolean(values.is_identified),
      usually_issues_vat_invoice: Boolean(values.usually_issues_vat_invoice),
      default_vat_rate: values.default_vat_rate ?? 20,
      default_vat_recoverable: values.default_vat_recoverable ?? true,
      default_invoice_tax_mode: values.default_invoice_tax_mode ?? 'invoice_with_recoverable_vat',
      is_usual_without_nif_stat: Boolean(values.is_usual_without_nif_stat),
      default_declared_extra_tax_enabled: Boolean(values.default_declared_extra_tax_enabled),
      default_declared_extra_tax_rate: values.default_declared_extra_tax_rate ?? 0,
      occasional_purchase_alert_threshold: values.occasional_purchase_alert_threshold ?? 1000000,
      address: cleanNullable(values.address),
      notes: cleanNullable(values.notes),
      updated_by: profileId,
    })
    .eq('id', id)

  if (error) {
    throw error
  }
}

export async function deleteSupplier(id: string) {
  const { error } = await supabase.schema('stock').from('suppliers').delete().eq('id', id)

  if (error) {
    throw error
  }
}
