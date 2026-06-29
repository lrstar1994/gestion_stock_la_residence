import { supabase } from '../../lib/supabase'
import type { Profile, UserRole, UserStatus } from '../../lib/validation'

type UserFilters = {
  status?: UserStatus | 'all'
  role?: UserRole | 'all'
  search?: string
}

export async function getCurrentProfile(userId: string) {
  const { data, error } = await supabase.schema('stock').from('profiles').select('*').eq('user_id', userId).single()

  if (error) {
    throw error
  }

  return data as Profile
}

export async function listUsers(filters: UserFilters = {}) {
  let query = supabase.schema('stock').from('profiles').select('*').order('created_at', { ascending: false })

  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status)
  }

  if (filters.role && filters.role !== 'all') {
    query = query.eq('role', filters.role)
  }

  if (filters.search?.trim()) {
    const search = filters.search.trim()
    query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`)
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  return (data ?? []) as Profile[]
}

export async function validateUser(profileId: string, role: UserRole, validatorProfileId: string) {
  const { error } = await supabase.schema('stock')
    .from('profiles')
    .update({
      role,
      status: 'active',
      validated_by: validatorProfileId,
      validated_at: new Date().toISOString(),
      rejected_at: null,
      rejection_reason: null,
    })
    .eq('id', profileId)

  if (error) {
    throw error
  }
}

export async function rejectUser(profileId: string, reason: string) {
  const { error } = await supabase.schema('stock')
    .from('profiles')
    .update({
      status: 'rejected',
      rejected_at: new Date().toISOString(),
      rejection_reason: reason,
    })
    .eq('id', profileId)

  if (error) {
    throw error
  }
}

export async function updateUser(profileId: string, payload: { role: UserRole; status: Extract<UserStatus, 'active' | 'inactive'> }) {
  const { error } = await supabase.schema('stock').from('profiles').update(payload).eq('id', profileId)

  if (error) {
    throw error
  }
}

export async function updateOwnProfile(profileId: string, fullName: string) {
  const { error } = await supabase.schema('stock').from('profiles').update({ full_name: fullName }).eq('id', profileId)

  if (error) {
    throw error
  }
}
