import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { AuthShell } from '../../components/AuthShell'
import { establishInviteSession, inviteSessionStillMatches, parseInviteCallback, verifyInviteSession } from '../../lib/inviteAuth.mjs'
import type { InviteCallback, VerifiedInvite } from '../../lib/inviteAuth.mjs'
import { getInviteSupabaseClient, resetInviteSupabaseClient } from '../../lib/inviteSupabase'

type InviteAccess = {
  client: SupabaseClient
  callback: InviteCallback
  verified: VerifiedInvite
}

let inviteAccessPromise: Promise<InviteAccess | null> | null = null
let inviteAccessToken: string | null = null

// React StrictMode mounts effects twice in development. Share one callback
// exchange so the single-use invitation token is never exchanged twice.
function loadInviteAccess(): Promise<InviteAccess | null> {
  const callback = parseInviteCallback(window.location.href)
  if (!callback) return Promise.resolve(null)
  if (inviteAccessPromise && inviteAccessToken === callback.accessToken) return inviteAccessPromise

  inviteAccessToken = callback.accessToken
  inviteAccessPromise = (async () => {
    try {
      const client = getInviteSupabaseClient()
      const verified = await establishInviteSession(client.auth, callback)
      return verified ? { client, callback, verified } : null
    } catch {
      return null
    }
  })()

  return inviteAccessPromise
}

function hasAuthCallbackParameters() {
  const url = new URL(window.location.href)
  const params = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash)
  url.searchParams.forEach((value, key) => params.set(key, value))
  return ['access_token', 'refresh_token', 'token_type', 'expires_in', 'type', 'error', 'error_description', 'error_code', 'code', 'token', 'token_hash']
    .some((key) => params.has(key))
}

function clearAuthCallbackFromUrl() {
  const url = new URL(window.location.href)
  for (const key of ['access_token', 'refresh_token', 'expires_in', 'expires_at', 'token_type', 'type', 'error', 'error_description', 'error_code', 'code', 'token', 'token_hash']) {
    url.searchParams.delete(key)
  }
  url.hash = ''
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`)
}

export function AcceptInvite() {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)
  const [inviteAccess, setInviteAccess] = useState<InviteAccess | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    void loadInviteAccess().then((access) => {
      if (cancelled) return
      if (!access && hasAuthCallbackParameters()) clearAuthCallbackFromUrl()
      setInviteAccess(access)
      setChecking(false)
    })

    return () => { cancelled = true }
  }, [])

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!inviteAccess) return
    if (password.length < 8) {
      toast.error('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (password !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas.')
      return
    }

    setSaving(true)
    try {
      const verifiedNow = await verifyInviteSession(inviteAccess.client.auth, inviteAccess.callback)
      if (
        !verifiedNow ||
        verifiedNow.userId !== inviteAccess.verified.userId ||
        !inviteSessionStillMatches(
          (await inviteAccess.client.auth.getSession()).data.session,
          inviteAccess.verified,
        )
      ) {
        throw new Error('Lien d’invitation invalide ou expiré.')
      }

      const { error } = await inviteAccess.client.auth.updateUser({ password })
      if (error) throw error

      // This client has only the invitee's in-memory session; never sign out
      // the application's shared Direction/Caisse/Contrôleur session.
      try {
        await inviteAccess.client.auth.signOut({ scope: 'local' })
      } catch {
        // The invitation client is memory-only; cleanup failure cannot affect
        // the application's persisted session or undo a successful password update.
      }
      toast.success('Mot de passe défini. Vous pouvez vous connecter.')
      setInviteAccess(null)
      inviteAccessPromise = null
      inviteAccessToken = null
      resetInviteSupabaseClient()
      navigate('/login', { replace: true })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossible de définir le mot de passe.')
    } finally {
      setSaving(false)
      setPassword('')
      setConfirmPassword('')
    }
  }

  return (
    <AuthShell title="Activer votre accès" subtitle="Choisissez votre mot de passe personnel pour terminer l’invitation.">
      {checking ? <p className="text-sm text-slate-600">Vérification de l’invitation…</p> : !inviteAccess ? (
        <div className="space-y-4 text-sm text-slate-700">
          <p>Lien d’invitation invalide ou expiré. Demandez à la Direction de renvoyer l’invitation.</p>
          <button type="button" className="btn-primary w-full" onClick={() => navigate('/dashboard')}>Retour à l’application</button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <label className="block">
            <span className="field-label">Nouveau mot de passe</span>
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="new-password" className="input mt-2" minLength={8} required />
          </label>
          <label className="block">
            <span className="field-label">Confirmer le mot de passe</span>
            <input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type="password" autoComplete="new-password" className="input mt-2" minLength={8} required />
          </label>
          <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? 'Enregistrement…' : 'Définir mon mot de passe'}</button>
        </form>
      )}
    </AuthShell>
  )
}
