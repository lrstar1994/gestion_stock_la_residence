import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isDuplicateAuthEmailError, validateCreateUserPayload } from './validation.mjs'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders })
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json(405, { error: 'Méthode non autorisée.' })

  const authorization = request.headers.get('Authorization')
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!accessToken) return json(401, { error: 'Session Direction requise.' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const appBaseUrl = Deno.env.get('APP_BASE_URL')
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !appBaseUrl) {
    return json(500, { error: 'Configuration serveur incomplète pour les invitations utilisateurs.' })
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: callerData, error: callerError } = await callerClient.auth.getUser(accessToken)
  if (callerError || !callerData.user) return json(401, { error: 'Session invalide ou expirée.' })

  let input: unknown
  try {
    const body: unknown = await request.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('payload')
    input = body
  } catch {
    return json(400, { error: 'Corps de requête invalide.' })
  }

  // Cette RPC expose les libellés directement depuis stock.user_role et refuse
  // tout appel autre qu'un profil Direction actif avant l'usage Auth Admin.
  const { data: rolesData, error: rolesError } = await callerClient.schema('stock').rpc('list_user_creation_roles')
  if (rolesError) return json(403, { error: rolesError.message || 'Profil Direction actif requis.' })
  const validated = validateCreateUserPayload(input, rolesData)
  if (validated.error) return json(400, { error: validated.error })
  const { email, fullName, role, status, locationIds, directionPin } = validated.value

  const redirectTo = new URL('/auth/accept-invite', appBaseUrl).toString()
  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo,
  })
  if (inviteError || !inviteData.user) {
    const duplicate = isDuplicateAuthEmailError(inviteError)
    if (duplicate) return json(409, { error: 'Cette adresse e-mail est déjà utilisée.' })
    if (inviteData?.user?.id) {
      const { error: cleanupError } = await adminClient.auth.admin.deleteUser(inviteData.user.id)
      if (cleanupError) {
        return json(500, {
          error: 'L’envoi de l’invitation a échoué et le compte Auth temporaire n’a pas pu être supprimé. Intervention Direction requise.',
          code: 'ACCOUNT_CLEANUP_REQUIRED',
          auth_user_id: inviteData.user.id,
        })
      }
    }
    return json(502, {
      error: 'Invitation e-mail impossible. Aucun profil n’a été finalisé; si l’erreur Auth a créé un compte malgré l’échec, vérifiez-le avant de réessayer.',
      code: 'INVITE_STATE_REQUIRES_CHECK',
    })
  }

  const { data: profileId, error: finalizeError } = await callerClient.schema('stock').rpc('finalize_invited_user_profile', {
    p_auth_user_id: inviteData.user.id,
    p_full_name: fullName,
    p_role: role,
    p_status: status,
    p_location_ids: locationIds,
    p_direction_pin: directionPin,
  })

  if (finalizeError || typeof profileId !== 'string') {
    const { error: cleanupError } = await adminClient.auth.admin.deleteUser(inviteData.user.id)
    if (cleanupError) {
      return json(500, {
        error: 'La finalisation du profil a échoué et le compte Auth temporaire n’a pas pu être supprimé. Intervention Direction requise.',
        code: 'ACCOUNT_CLEANUP_REQUIRED',
        auth_user_id: inviteData.user.id,
      })
    }
    return json(400, { error: finalizeError?.message ?? 'La création du profil a échoué; le compte Auth temporaire a été supprimé.' })
  }

  return json(201, { profile_id: profileId, invitation_sent: true })
})
