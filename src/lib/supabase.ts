import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.')
}

const currentPath = typeof window === 'undefined' ? '' : window.location.pathname.replace(/\/+$/, '')
const isInviteAcceptanceRoute = currentPath === '/auth/accept-invite'

export const supabase = createClient(supabaseUrl ?? 'https://placeholder.supabase.co', supabaseAnonKey ?? 'placeholder-key', {
  auth: {
    // The invitation route handles its callback through a separate, temporary client.
    detectSessionInUrl: !isInviteAcceptanceRoute,
  },
})
