import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { AuthContext } from './AuthContext'
import type { PerfilUsuario } from './types'

async function buscarPerfil(userId: string): Promise<PerfilUsuario | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id, nome, matricula, perfil, ativo, deve_trocar_senha')
    .eq('id', userId)
    .maybeSingle()
  return (data as PerfilUsuario | null) ?? null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null)
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async (s: Session | null) => {
    setSession(s)
    setPerfil(s ? await buscarPerfil(s.user.id) : null)
    setLoading(false)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => carregar(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      void carregar(s)
    })
    return () => data.subscription.unsubscribe()
  }, [carregar])

  const recarregarPerfil = useCallback(async () => {
    if (session) setPerfil(await buscarPerfil(session.user.id))
  }, [session])

  return (
    <AuthContext.Provider value={{ session, perfil, loading, recarregarPerfil }}>{children}</AuthContext.Provider>
  )
}
