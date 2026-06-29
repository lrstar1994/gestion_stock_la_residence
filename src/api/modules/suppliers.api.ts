import { supabase } from '../../lib/supabase'
import type { Supplier, SupplierFormValues } from '../../lib/suppliers'

function cleanNullable(value?: string) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export async function listSuppliers(search = '') {
  let query = supabase.schema('stock').from('suppliers').select('*').order('name', { ascending: true })

  if (search.trim()) {
    query = query.ilike('name', `%${search.trim()}%`)
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
