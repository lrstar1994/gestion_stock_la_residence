/** Reads only a Supabase implicit callback explicitly marked as an invitation. */
export function parseInviteCallback(href) {
  try {
    const url = new URL(href)
    const params = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash)
    // Match auth-js: query parameters override fragment parameters.
    url.searchParams.forEach((value, key) => params.set(key, value))

    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const expiresIn = Number(params.get('expires_in'))
    const tokenType = params.get('token_type')

    if (
      params.get('type') !== 'invite' ||
      params.has('error') ||
      params.has('error_description') ||
      params.has('error_code') ||
      !accessToken ||
      !refreshToken ||
      !Number.isFinite(expiresIn) ||
      expiresIn <= 0 ||
      tokenType?.toLowerCase() !== 'bearer'
    ) {
      return null
    }

    return { accessToken, refreshToken, expiresIn, tokenType: 'bearer' }
  } catch {
    return null
  }
}

/** Requires the temporary client's session to have been established by this exact URL token. */
export async function verifyInviteSession(auth, callback) {
  if (!callback) return null

  try {
    const { data, error } = await auth.getSession()
    const session = data?.session
    const userId = session?.user?.id
    if (error || !session || !userId || session.access_token !== callback.accessToken) return null

    const { data: userData, error: userError } = await auth.getUser(callback.accessToken)
    if (userError || userData?.user?.id !== userId) return null

    return { userId, accessToken: callback.accessToken }
  } catch {
    return null
  }
}

/** Establishes an invitation session only on the isolated, in-memory invite client. */
export async function establishInviteSession(auth, callback) {
  if (!callback || typeof auth?.setSession !== 'function') return null

  try {
    const { error } = await auth.setSession({
      access_token: callback.accessToken,
      refresh_token: callback.refreshToken,
    })
    if (error) return null
    return verifyInviteSession(auth, callback)
  } catch {
    return null
  }
}

export function inviteSessionStillMatches(session, verifiedInvite) {
  return Boolean(
    session &&
      verifiedInvite &&
      session.access_token === verifiedInvite.accessToken &&
      session.user?.id === verifiedInvite.userId,
  )
}
