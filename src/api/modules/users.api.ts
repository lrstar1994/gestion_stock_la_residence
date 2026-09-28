import { supabase } from '../../lib/supabase'
import type { Profile, UserRole, UserStatus } from '../../lib/validation'
import type { Location } from '../../lib/catalog'
import { getAdminUserInvocationErrorMessage } from './adminUserInvocationError.mjs'

type UserFilters = {
  status?: UserStatus | 'all'
  role?: UserRole | 'all'
  search?: string
}

export async function resetProfilePinForUser(targetProfileId: string, directionPin: string) {
  const { error } = await supabase.schema('stock').rpc('reset_profile_pin_for_user', {
    p_target_profile_id: targetProfileId,
    p_direction_pin: directionPin,
  })
  if (error) throw error
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

export async function updateUser(profileId: string, payload: { role: UserRole; status: Extract<UserStatus, 'active' | 'inactive'>; locationIds: string[] }) {
  const { error } = await supabase.schema('stock').rpc('update_profile_and_location_access', {
    p_profile_id: profileId,
    p_role: payload.role,
    p_status: payload.status,
    p_location_ids: payload.locationIds,
  })
  if (error) throw error
}

export async function getUserById(profileId: string): Promise<Profile> {
  const { data, error } = await supabase.schema('stock').from('profiles').select('*').eq('id', profileId).single()
  if (error) throw error
  return data as Profile
}

export async function listUserCreationRoles(): Promise<string[]> {
  const { data, error } = await supabase.schema('stock').rpc('list_user_creation_roles')
  if (error) throw error
  if (!Array.isArray(data) || data.some((role) => typeof role !== 'string')) {
    throw new Error('Le référentiel des rôles a renvoyé une réponse invalide.')
  }
  return data as string[]
}

export async function createAdminUser(payload: {
  email: string
  fullName: string
  role: UserRole
  status: Extract<UserStatus, 'active' | 'inactive'>
  locationIds: string[]
  directionPin?: string
}): Promise<{ profileId: string; invitationSent: boolean }> {
  const { data, error } = await supabase.functions.invoke('admin-create-user', {
    body: {
      email: payload.email,
      full_name: payload.fullName,
      role: payload.role,
      status: payload.status,
      location_ids: payload.locationIds,
      direction_pin: payload.directionPin,
    },
  })
  if (error) {
    const message = await getAdminUserInvocationErrorMessage(error)
    throw new Error(`Erreur d’invitation : ${message}`)
  }
  if (!data || typeof data.profile_id !== 'string' || data.invitation_sent !== true) {
    throw new Error('Réponse inattendue de l’invitation. Vérifiez que l’utilisateur n’a pas été créé avant de réessayer.')
  }
  return { profileId: data.profile_id, invitationSent: true }
}

export async function getProfileLocations(profileId: string): Promise<Location[]> {
  const { data, error } = await supabase.schema('stock')
    .from('profile_location_access')
    .select('location:locations(*)')
    .eq('profile_id', profileId)
    .eq('active', true)
  if (error) throw error
  return (data ?? []).flatMap((row) => row.location ? [row.location as unknown as Location] : [])
}

export async function getProfileLocationIds(profileId: string): Promise<string[]> {
  const { data, error } = await supabase.schema('stock')
    .from('profile_location_access')
    .select('location_id')
    .eq('profile_id', profileId)
    .eq('active', true)
  if (error) throw error
  return (data ?? []).map((row) => row.location_id as string)
}

export async function updateOwnProfile(profileId: string, fullName: string) {
  const { error } = await supabase.schema('stock').from('profiles').update({ full_name: fullName }).eq('id', profileId)

  if (error) {
    throw error
  }
}
