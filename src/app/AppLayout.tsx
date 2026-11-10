import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { registrarSincronizacao, sincronizarAgora } from '../lib/sync'
import { processarFila as filaPreventivas } from '../modules/preventivas/data/envio'
import { processarFila } from '../modules/relatorio/data/envio'
import { supabase } from '../lib/supabase'

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

export function AppLayout() {
  const online = useOnline()
  // Fila de envio: roda ao abrir o app, quando a internet volta e a cada 30 minutos.
  useEffect(() => {
    const p1 = registrarSincronizacao(processarFila)
    const p2 = registrarSincronizacao(filaPreventivas)
    void sincronizarAgora()
    return () => {
      p1()
      p2()
    }
  }, [])

  return (
    <div className="layout">
      <header>
        <strong>SkyRail L17</strong>
        <nav>
          <NavLink to="/relatorio">Relatório</NavLink>
          <NavLink to="/preventivas">Preventivas</NavLink>
          <NavLink to="/passagem">Passagem de turno</NavLink>
          <NavLink to="/documentos">Documentos</NavLink>
          <NavLink to="/perfil/assinatura">Minha assinatura</NavLink>
        </nav>
        <span className={`rede ${online ? 'on' : 'off'}`}>{online ? 'Online' : 'Sem internet'}</span>
        <button type="button" onClick={() => supabase.auth.signOut()}>Sair</button>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}
