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

interface AuthContextValue {
  session: Session | null
  user: User | null
  loading: boolean
  signInWithEmail: (email: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

async function ensureUserProfile(user: User) {
  // ATTENTION : la table users n'a que des policies select/update sur soi.
  // Sans policy insert, cet upsert échoue en RLS. Migration à ajouter,
  // on ne contourne pas (pas de service role côté client).
  const { error } = await supabase.from('users').upsert(
    {
      id: user.id,
      first_name: user.email?.split('@')[0] ?? 'Membre',
    },
    { onConflict: 'id', ignoreDuplicates: true },
  )
  if (error) {
    console.error('Création du profil users impossible :', error.message)
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let profileEnsuredFor: string | null = null

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setLoading(false)

      const user = newSession?.user
      if (user && profileEnsuredFor !== user.id) {
        profileEnsuredFor = user.id
        // setTimeout : pas d'appel Supabase awaité dans le callback
        // onAuthStateChange (risque de deadlock documenté supabase-js).
        setTimeout(() => void ensureUserProfile(user), 0)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signInWithEmail = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    return { error: error?.message ?? null }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signInWithEmail,
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
