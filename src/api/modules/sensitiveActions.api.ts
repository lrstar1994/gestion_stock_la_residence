import { supabase } from '../../lib/supabase'

export type PinStatus = {
  pin_defined: boolean
  pin_set_at: string | null
  pin_updated_at: string | null
}

export async function getMyPinStatus(): Promise<PinStatus> {
  const { data, error } = await supabase.schema('stock').rpc('get_my_pin_status')
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  return {
    pin_defined: Boolean(row?.pin_defined),
    pin_set_at: row?.pin_set_at ?? null,
    pin_updated_at: row?.pin_updated_at ?? null,
  }
}

export async function getSensitiveActionRuntimeStatus(permission: string) {
  const [{ data: authData }, permissionResult, pinStatus] = await Promise.all([
    supabase.auth.getUser(),
    supabase.schema('stock').rpc('has_permission', { p_permission: permission }),
    getMyPinStatus(),
  ])
  if (permissionResult.error) throw permissionResult.error
  return {
    authUserId: authData.user?.id ?? null,
    email: authData.user?.email ?? null,
    permission,
    hasPermission: Boolean(permissionResult.data),
    pinDefined: pinStatus.pin_defined,
  }
}

export async function setMyPersonalPin(newPin: string, currentPin?: string) {
  const { error } = await supabase.schema('stock').rpc('set_my_personal_pin', {
    p_new_pin: newPin,
    p_current_pin: currentPin || null,
  })
  if (error) throw error
}

export async function assertSensitiveAction(permission: string, pin: string, actionCode: string, entityType: string, entityId?: string) {
  const { data, error } = await supabase.schema('stock').rpc('assert_sensitive_action', {
    p_permission: permission, p_pin: pin, p_action_code: actionCode, p_entity_type: entityType,
    p_entity_id: entityId || null, p_reason: null, p_metadata: {},
  })
  if (error) throw error
  return data as string
}

export function getSensitiveActionErrorMessage(error: unknown) {
  const message = typeof error === 'object' && error !== null && 'message' in error
    ? String((error as { message?: unknown }).message ?? '')
    : error instanceof Error ? error.message : ''
  const normalized = message.toLowerCase()
  if (normalized.includes('pin') && (normalized.includes('invalide') || normalized.includes('invalid'))) return 'PIN incorrect.'
  if (normalized.includes('aucun pin') || normalized.includes('no pin')) return 'Aucun PIN personnel défini pour ce compte.'
  if (normalized.includes('permission')) return 'Permission Direction manquante pour valider ce type de demande.'
  if (normalized.includes('action')) return 'Action purchase_need.validate non reconnue par le service PIN.'
  return message ? `Erreur technique du service PIN : ${message}` : 'Erreur technique du service PIN.'
}

export function getSensitiveActionErrorDetails(error: unknown) {
  if (typeof error === 'object' && error !== null) {
    const value = error as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown }
    return {
      message: String(value.message ?? 'Erreur inconnue'),
      code: value.code ? String(value.code) : null,
      details: value.details ? String(value.details) : null,
      hint: value.hint ? String(value.hint) : null,
    }
  }
  return { message: error instanceof Error ? error.message : 'Erreur inconnue', code: null, details: null, hint: null }
}
