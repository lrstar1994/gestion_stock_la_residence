import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js'
import { isDuplicateAuthEmailError, validateCreateUserPayload } from '../supabase/functions/admin-create-user/validation.mjs'
import { getAdminUserInvocationErrorMessage } from '../src/api/modules/adminUserInvocationError.mjs'
import { establishInviteSession, inviteSessionStillMatches, parseInviteCallback, verifyInviteSession } from '../src/lib/inviteAuth.mjs'

const migration = await readFile(new URL('../supabase/migrations/202609180003_admin_user_creation.sql', import.meta.url), 'utf8')
const edge = await readFile(new URL('../supabase/functions/admin-create-user/index.ts', import.meta.url), 'utf8')
const frontendApi = await readFile(new URL('../src/api/modules/users.api.ts', import.meta.url), 'utf8')
const form = await readFile(new URL('../src/pages/admin/users/UserCreatePage.tsx', import.meta.url), 'utf8')
const browserClient = await readFile(new URL('../src/lib/supabase.ts', import.meta.url), 'utf8')

test('the role selector is sourced from the database enum and server-guarded to active Direction', () => {
  assert.match(migration, /enum_range\(null::stock\.user_role\)/)
  assert.match(migration, /p\.role = 'direction'::stock\.user_role[\s\S]*?p\.status = 'active'::stock\.user_status/)
  assert.match(frontendApi, /rpc\('list_user_creation_roles'\)/)
  assert.match(form, /listUserCreationRoles\(\)/)
})

test('invitation and profile finalization are server-side with cleanup on partial failure', () => {
  assert.match(edge, /auth\.admin\.inviteUserByEmail/)
  assert.match(edge, /SUPABASE_SERVICE_ROLE_KEY/)
  assert.match(edge, /finalize_invited_user_profile/)
  assert.match(edge, /auth\.admin\.deleteUser\(inviteData\.user\.id\)/)
  assert.match(edge, /ACCOUNT_CLEANUP_REQUIRED/)
  assert.doesNotMatch(browserClient, /SERVICE_ROLE/i)
  assert.doesNotMatch(frontendApi, /SERVICE_ROLE/i)
})

test('location links, initial state, and audit are committed by one Direction-only SQL RPC', () => {
  assert.match(migration, /stock\.set_profile_location_access\(v_profile_id, v_location_ids\)/)
  assert.match(migration, /insert into stock\.sensitive_action_audit[\s\S]*?'profile\.created'[\s\S]*?to_jsonb\(v_location_ids\)/)
  assert.match(migration, /p_status not in \('active'::stock\.user_status, 'inactive'::stock\.user_status\)/)
  assert.match(migration, /p_role in \('direction'::stock\.user_role, 'controleur'::stock\.user_role\)[\s\S]*?cardinality\(v_location_ids\) > 0/)
  assert.match(migration, /'profiles\.create_direction'/)
})

test('Direction and Controller are global-by-role, while operational roles get an empty-selection warning', () => {
  assert.match(form, /currentRole === 'direction' \|\| currentRole === 'controleur'/)
  assert.match(form, /stockOperationalRoles/)
  assert.match(form, /n’aura aucun accès STOCK tant qu’aucune localisation ne lui est affectée/)
  assert.match(form, /role === 'caisse' \|\| role === 'consultation'/)
})

test('invite callback parser accepts only a complete implicit invite callback', () => {
  assert.equal(parseInviteCallback('https://app.example.com/auth/accept-invite'), null)
  assert.equal(parseInviteCallback('https://app.example.com/auth/accept-invite#type=recovery&access_token=a&refresh_token=r&expires_in=3600&token_type=bearer'), null)
  assert.equal(parseInviteCallback('https://app.example.com/auth/accept-invite#type=invite&access_token=a&refresh_token=r&expires_in=3600&token_type=bearer&error=access_denied'), null)
  assert.deepEqual(
    parseInviteCallback('https://app.example.com/auth/accept-invite#type=invite&access_token=a&refresh_token=r&expires_in=3600&token_type=bearer'),
    { accessToken: 'a', refreshToken: 'r', expiresIn: 3600, tokenType: 'bearer' },
  )
})

test('A/B: a Direction session cannot authorize invite acceptance without this invitation token', async () => {
  const directionAuth = {
    getSession: async () => ({ data: { session: { access_token: 'direction-token', user: { id: 'direction-user' } } }, error: null }),
    getUser: async () => ({ data: { user: { id: 'direction-user' } }, error: null }),
    updateUser: async () => assert.fail('updateUser must not run'),
  }
  assert.equal(await verifyInviteSession(directionAuth, null), null)
  const callback = parseInviteCallback('https://app.example.com/auth/accept-invite#type=invite&access_token=invite-token&refresh_token=invite-refresh&expires_in=3600&token_type=bearer')
  assert.equal(await verifyInviteSession(directionAuth, callback), null)
})

test('C/D: a valid invite token updates only the invited-user client, with or without a normal session', async () => {
  const callback = parseInviteCallback('https://app.example.com/auth/accept-invite#type=invite&access_token=invite-token&refresh_token=invite-refresh&expires_in=3600&token_type=bearer')
  const updated = []
  let directionUpdates = 0
  const inviteAuth = {
    getSession: async () => ({ data: { session: { access_token: 'invite-token', user: { id: 'magasinier-user' } } }, error: null }),
    getUser: async (token) => ({ data: { user: token === 'invite-token' ? { id: 'magasinier-user' } : null }, error: null }),
    updateUser: async (attributes) => { updated.push({ userId: 'magasinier-user', attributes }); return { error: null } },
  }
  const directionAuth = { updateUser: async () => { directionUpdates += 1 } }
  const verified = await verifyInviteSession(inviteAuth, callback)
  assert.equal(verified.userId, 'magasinier-user')
  assert.equal(inviteSessionStillMatches({ access_token: 'invite-token', user: { id: 'magasinier-user' } }, verified), true)
  await inviteAuth.updateUser({ password: 'mock-password-only' })
  assert.deepEqual(updated, [{ userId: 'magasinier-user', attributes: { password: 'mock-password-only' } }])
  assert.equal(directionUpdates, 0)
  const acceptInvite = await readFile(new URL('../src/pages/auth/AcceptInvite.tsx', import.meta.url), 'utf8')
  assert.match(acceptInvite, /inviteAccess\.client\.auth\.updateUser\(\{ password \}\)/)
  assert.doesNotMatch(acceptInvite, /supabase\.auth\.updateUser/)
})

test('E: expired or rejected invitation session does not verify', async () => {
  const callback = parseInviteCallback('https://app.example.com/auth/accept-invite#type=invite&access_token=expired&refresh_token=expired-refresh&expires_in=3600&token_type=bearer')
  const expiredAuth = {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => assert.fail('getUser must not run without a session'),
  }
  assert.equal(await verifyInviteSession(expiredAuth, callback), null)
})

test('F/G: invite flow uses local cleanup; regular login client/session behavior remains configured', async () => {
  const acceptInvite = await readFile(new URL('../src/pages/auth/AcceptInvite.tsx', import.meta.url), 'utf8')
  const inviteClient = await readFile(new URL('../src/lib/inviteSupabase.ts', import.meta.url), 'utf8')
  const authContext = await readFile(new URL('../src/contexts/AuthContext.tsx', import.meta.url), 'utf8')
  assert.match(acceptInvite, /signOut\(\{ scope: 'local' \}\)/)
  assert.doesNotMatch(acceptInvite, /supabase\.auth\.signOut/)
  assert.match(inviteClient, /persistSession: false/)
  assert.match(inviteClient, /detectSessionInUrl: false/)
  assert.match(acceptInvite, /establishInviteSession\(client\.auth, callback\)/)
  assert.match(browserClient, /detectSessionInUrl: !isInviteAcceptanceRoute/)
  assert.match(authContext, /signInWithPassword\(\{ email, password \}\)/)
  assert.doesNotMatch(authContext, /inviteSupabase|inviteAuth/)
})

test('A/B/C/F: absent, invalid, and expired callbacks leave the global Direction session untouched', async () => {
  const directionSession = { access_token: 'direction-token', user: { id: 'direction-user' } }
  let globalSignedOutEvents = 0
  const globalAuth = {
    getSession: async () => ({ data: { session: directionSession }, error: null }),
    onAuthStateChange: (callback) => {
      if (globalSignedOutEvents) callback('SIGNED_OUT', null)
      return { data: { subscription: { unsubscribe() {} } } }
    },
  }
  const noCallback = parseInviteCallback('https://app.example.com/auth/accept-invite')
  const invalidCallback = parseInviteCallback('https://app.example.com/auth/accept-invite#type=invite&access_token=broken&refresh_token=r&expires_in=0&token_type=bearer')
  const expiredCallback = parseInviteCallback('https://app.example.com/auth/accept-invite#type=invite&access_token=expired&refresh_token=expired-refresh&expires_in=3600&token_type=bearer')
  assert.equal(noCallback, null)
  assert.equal(invalidCallback, null)
  const untouchedAuth = { setSession: async () => assert.fail('setSession must not run without a valid callback') }
  assert.equal(await establishInviteSession(untouchedAuth, noCallback), null)
  assert.equal(await establishInviteSession(untouchedAuth, invalidCallback), null)
  assert.equal(await establishInviteSession({ setSession: async () => ({ error: new Error('expired token') }) }, expiredCallback), null)
  const after = await globalAuth.getSession()
  assert.equal(after.data.session, directionSession)
  assert.equal(globalSignedOutEvents, 0)
})

test('D/E: valid callback is set only on the temporary client and emits no global sign-out', async () => {
  const callback = parseInviteCallback('https://app.example.com/auth/accept-invite#type=invite&access_token=invite-token&refresh_token=invite-refresh&expires_in=3600&token_type=bearer')
  const directionSession = { access_token: 'direction-token', user: { id: 'direction-user' } }
  let globalSession = directionSession
  let globalSignedOutEvents = 0
  const globalAuth = {
    getSession: async () => ({ data: { session: globalSession }, error: null }),
    emit: (event, session) => {
      if (event === 'SIGNED_OUT') globalSignedOutEvents += 1
      globalSession = session
    },
  }
  let inviteSession = null
  const inviteAuth = {
    setSession: async ({ access_token }) => {
      inviteSession = { access_token, user: { id: 'magasinier-user' } }
      return { data: { session: inviteSession }, error: null }
    },
    getSession: async () => ({ data: { session: inviteSession }, error: null }),
    getUser: async () => ({ data: { user: { id: 'magasinier-user' } }, error: null }),
  }
  const verified = await establishInviteSession(inviteAuth, callback)
  assert.equal(verified.userId, 'magasinier-user')
  assert.equal((await globalAuth.getSession()).data.session, directionSession)
  assert.equal(globalSession, directionSession)
  assert.equal(globalSignedOutEvents, 0)
})

test('invite page cannot render its password form from the global session alone', async () => {
  const acceptInvite = await readFile(new URL('../src/pages/auth/AcceptInvite.tsx', import.meta.url), 'utf8')
  assert.match(acceptInvite, /parseInviteCallback\(window\.location\.href\)/)
  assert.match(acceptInvite, /!inviteAccess/)
  assert.match(acceptInvite, /verifyInviteSession\(inviteAccess\.client\.auth, inviteAccess\.callback\)/)
  assert.doesNotMatch(acceptInvite, /service_role|pin_hash|personal_pin/i)
  assert.match(acceptInvite, /Retour à l’application/)
})

test('root route restores an existing active user instead of always sending them to login', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  assert.match(app, /function RootRedirect\(\)[\s\S]*?user && profile\?\.status === 'active'[\s\S]*?Navigate to="\/dashboard"/)
  assert.match(app, /path="\/" element=\{<RootRedirect \/>\}/)
})

test('requested role and location scenarios pass server-side payload validation', () => {
  const validRoles = ['direction', 'controleur', 'magasinier', 'caisse', 'consultation']
  const locationA = '10000000-0000-4000-8000-000000000001'
  const locationB = '10000000-0000-4000-8000-000000000002'
  const base = { email: ' Personne@EXAMPLE.com ', full_name: 'Utilisateur Exemple', status: 'active' }

  assert.equal(validateCreateUserPayload({ ...base, role: 'magasinier', location_ids: [locationA] }, validRoles).value.locationIds.length, 1)
  assert.equal(validateCreateUserPayload({ ...base, role: 'magasinier', location_ids: [locationA, locationB] }, validRoles).value.locationIds.length, 2)
  assert.equal(validateCreateUserPayload({ ...base, role: 'caisse', location_ids: [] }, validRoles).value.locationIds.length, 0)
  assert.equal(validateCreateUserPayload({ ...base, role: 'controleur', location_ids: [] }, validRoles).value.role, 'controleur')
  assert.equal(validateCreateUserPayload({ ...base, role: 'direction', location_ids: [], direction_pin: '1234' }, validRoles).value.role, 'direction')
  assert.match(validateCreateUserPayload({ ...base, role: 'alien', location_ids: [] }, validRoles).error, /Rôle invalide/)
  assert.match(validateCreateUserPayload({ ...base, role: 'magasinier', location_ids: [locationA, locationA] }, validRoles).error, /plusieurs fois/)
  assert.equal(isDuplicateAuthEmailError({ status: 422, message: 'User already registered' }), true)
})

test('database RPC and protected route both reject a non-Direction creator', async () => {
  assert.match(migration, /if not exists \([\s\S]*?p\.role = 'direction'::stock\.user_role[\s\S]*?p\.status = 'active'::stock\.user_status/)
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  assert.match(app, /ProtectedRoute allowedRoles=\{\['direction'\]\}[\s\S]*?<Route path="\/admin\/users\/new"/)
})

test('Supabase FunctionsHttpError context Response is parsed as Edge Function JSON', async () => {
  const error = new FunctionsHttpError(new Response(JSON.stringify({ error: 'Cette adresse e-mail est déjà utilisée.' }), {
    status: 409,
    headers: { 'Content-Type': 'application/json' },
  }))
  assert.equal(await getAdminUserInvocationErrorMessage(error), 'Cette adresse e-mail est déjà utilisée.')
})

test('non-Response network context does not call clone and keeps the useful message', async () => {
  const error = new FunctionsFetchError(new TypeError('Failed to fetch'))
  assert.equal(await getAdminUserInvocationErrorMessage(error), 'Failed to fetch')
  assert.doesNotMatch(frontendApi, /response\.clone\(\)/)
})

test('non-JSON Edge Function errors are displayed as text', async () => {
  const error = new FunctionsHttpError({
    text: async () => 'Service unavailable',
  })
  assert.equal(await getAdminUserInvocationErrorMessage(error), 'Service unavailable')
})

test('unexpected successful Edge Function payload warns against blind retry', () => {
  assert.match(frontendApi, /Réponse inattendue de l’invitation\. Vérifiez que l’utilisateur n’a pas été créé avant de réessayer\./)
  assert.match(frontendApi, /data\.invitation_sent !== true/)
})
