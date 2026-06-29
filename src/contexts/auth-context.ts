import { createContext } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '../lib/validation'

export type AuthContextValue = {
  user: User | null
  profile: Profile | null
  loading: boolean
  refreshProfile: () => Promise<Profile | null>
  register: (payload: { email: string; password: string; fullName: string }) => Promise<void>
  signIn: (email: string, password: string) => Promise<Profile>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
