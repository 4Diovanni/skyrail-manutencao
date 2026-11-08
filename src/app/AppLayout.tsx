import { NavLink, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function AppLayout() {
  return (
    <div className="layout">
      <header>
        <strong>SkyRail L17</strong>
        <nav>
          <NavLink to="/preventivas">Preventivas</NavLink>
          <NavLink to="/relatorio">Relatório</NavLink>
          <NavLink to="/passagem">Passagem de turno</NavLink>
        </nav>
        <button type="button" onClick={() => supabase.auth.signOut()}>Sair</button>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}
