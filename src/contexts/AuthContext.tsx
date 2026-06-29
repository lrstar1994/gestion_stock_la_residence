import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { getCurrentProfile } from '../api/modules/users.api'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/validation'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (authUser: User | null) => {
    if (!authUser) {
      setProfile(null)
      return null
    }

    const loadedProfile = await getCurrentProfile(authUser.id)
    setProfile(loadedProfile)
    return loadedProfile
  }, [])

  const refreshProfile = useCallback(async () => loadProfile(user), [loadProfile, user])

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) {
        return
      }

      const authUser = data.session?.user ?? null
      setUser(authUser)

      try {
        await loadProfile(authUser)
      } catch {
        setProfile(null)
      } finally {
        setLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const authUser = session?.user ?? null
      if (!authUser && event !== 'SIGNED_OUT') {
        setLoading(false)
        return
      }
      setLoading(true)
      setUser(authUser)
      loadProfile(authUser)
        .catch(() => setProfile(null))
        .finally(() => setLoading(false))
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [loadProfile])

  const register = useCallback(async ({ email, password, fullName }: { email: string; password: string; fullName: string }) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    })

    if (error) {
      throw error
    }
  }, [])

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        throw error
      }

      const signedInProfile = await loadProfile(data.user)
      if (!signedInProfile) {
        throw new Error('Profil introuvable')
      }

      return signedInProfile
    },
    [loadProfile],
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }, [])

  const value = useMemo(
    () => ({ user, profile, loading, refreshProfile, register, signIn, signOut }),
    [loading, profile, refreshProfile, register, signIn, signOut, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
