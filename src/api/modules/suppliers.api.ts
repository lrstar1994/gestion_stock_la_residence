import { supabase } from '../../lib/supabase'
import type { Supplier, SupplierFormValues } from '../../lib/suppliers'

function cleanNullable(value?: string) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export async function listSuppliers(search = '') {
  let query = supabase.schema('stock').from('suppliers').select('*').order('name', { ascending: true })

  if (search.trim()) {
    const term = search.trim()
    query = query.or(`name.ilike.%${term}%,nif.ilike.%${term}%,stat.ilike.%${term}%`)
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  return (data ?? []) as Supplier[]
}

export async function createSupplier(values: SupplierFormValues, profileId?: string) {
  const { error } = await supabase.schema('stock').from('suppliers').insert({
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

  if (error) {
    throw error
  }
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
