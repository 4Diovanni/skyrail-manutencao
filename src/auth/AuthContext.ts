import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { PerfilUsuario } from './types'

export interface AuthState {
  session: Session | null
  perfil: PerfilUsuario | null
  loading: boolean
  recarregarPerfil: () => Promise<void>
}

export const AuthContext = createContext<AuthState>({
  session: null,
  perfil: null,
  loading: true,
  recarregarPerfil: async () => {},
})

export function useAuth(): AuthState {
  return useContext(AuthContext)
}
