import { supabase } from '../../lib/supabase'

export async function getActiveStockProfileRole() {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!authData.user) throw new Error('Session utilisateur requise')

  const { data: profile, error } = await supabase.schema('stock')
    .from('profiles')
    .select('role, status')
    .eq('user_id', authData.user.id)
    .maybeSingle()
  if (error) throw error
  if (profile?.status !== 'active') throw new Error('Profil actif requis')
  return profile.role as string
}
