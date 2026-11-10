import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

/** Nenhuma tela com dados é renderizada sem sessão válida e perfil ativo. */
export function RequireAuth() {
  const { session, perfil, loading } = useAuth()
  const location = useLocation()

  if (loading) return <p className="center">Carregando…</p>
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!perfil || !perfil.ativo) {
    return (
      <main className="login">
        <p role="alert">Seu acesso não está ativo. Fale com o administrador.</p>
        <button type="button" onClick={() => supabase.auth.signOut()}>Sair</button>
      </main>
    )
  }
  if (perfil.deve_trocar_senha && location.pathname !== '/trocar-senha') {
    return <Navigate to="/trocar-senha" replace />
  }
  return <Outlet />
}
