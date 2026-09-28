export type InviteCallback = {
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: 'bearer'
}

export type VerifiedInvite = {
  userId: string
  accessToken: string
}

export function parseInviteCallback(href: string): InviteCallback | null
export function verifyInviteSession(
  auth: {
    getSession(): Promise<{ data: { session: { access_token: string; user?: { id?: string } } | null }; error: unknown }>
    getUser(token: string): Promise<{ data: { user: { id: string } | null }; error: unknown }>
  },
  callback: InviteCallback | null,
): Promise<VerifiedInvite | null>
export function establishInviteSession(
  auth: {
    setSession(input: { access_token: string; refresh_token: string }): Promise<{ error: unknown }>
    getSession(): Promise<{ data: { session: { access_token: string; user?: { id?: string } } | null }; error: unknown }>
    getUser(token: string): Promise<{ data: { user: { id: string } | null }; error: unknown }>
  },
  callback: InviteCallback | null,
): Promise<VerifiedInvite | null>
export function inviteSessionStillMatches(
  session: { access_token: string; user?: { id?: string } } | null,
  verifiedInvite: VerifiedInvite | null,
): boolean
