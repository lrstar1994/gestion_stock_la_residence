import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

let invitationClient: SupabaseClient | null = null

/** Lazily creates an in-memory-only Auth client used solely to accept an invite. */
export function getInviteSupabaseClient(): SupabaseClient {
  if (invitationClient) return invitationClient
  if (!supabaseUrl || !supabaseAnonKey) throw new Error('Configuration Supabase indisponible.')

  invitationClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      // AcceptInvite parses and validates the invitation callback explicitly,
      // then calls setSession on this isolated client only.
      detectSessionInUrl: false,
      flowType: 'implicit',
      storageKey: 'stock-invite-acceptance-temporary',
    },
  })

  return invitationClient
}

export function resetInviteSupabaseClient() {
  invitationClient = null
}
