import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import { supabase } from '@/lib/supabase'

import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type UserProfile = Database['public']['Tables']['users']['Row']

interface AuthContextValue {
  session: Session | null
  user: User | null
  loading: boolean
  profile: UserProfile | null
  profileLoading: boolean
  signInWithEmail: (email: string) => Promise<{ error: string | null }>
  createProfile: (
    firstName: string,
    lastName?: string,
  ) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  // true au départ pour éviter une redirection /bienvenue avant la
  // première lecture du profil.
  const [profileLoading, setProfileLoading] = useState(true)

  const userId = session?.user.id ?? null

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!userId) {
      setProfile(null)
      setProfileLoading(false)
      return
    }

    let cancelled = false
    setProfileLoading(true)

    supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('Lecture du profil impossible :', error.message)
        }
        setProfile(data ?? null)
        setProfileLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [userId])

  const signInWithEmail = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    return { error: error?.message ?? null }
  }, [])

  const createProfile = useCallback(
    async (firstName: string, lastName?: string) => {
      if (!userId) {
        return { error: 'Aucune session active' }
      }
      const { data, error } = await supabase
        .from('users')
        .insert({
          id: userId,
          first_name: firstName.trim(),
          last_name: lastName?.trim() ? lastName.trim() : null,
        })
        .select()
        .single()
      if (error) {
        return { error: error.message }
      }
      setProfile(data)
      return { error: null }
    },
    [userId],
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        profile,
        profileLoading,
        signInWithEmail,
        createProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth doit être utilisé à l’intérieur de AuthProvider')
  }
  return ctx
}
