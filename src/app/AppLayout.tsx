import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Avisos } from '../components/Avisos'
import { registrarSincronizacao, sincronizarAgora } from '../lib/sync'
import { processarFilaPassagem } from '../modules/passagem/data/envio'
import { processarFila as filaPreventivas } from '../modules/preventivas/data/envio'
import { processarFila } from '../modules/relatorio/data/envio'
import { useAuth } from '../auth/AuthContext'
import { MenuConta } from './MenuConta'
import { adotarRascunhosAntigos, sairComAviso } from './sair'

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

// O terceiro valor marca os links que, no PC, saem da barra e vão para o menu da conta (canto direito).
const LINKS: [string, string, boolean?][] = [
  ['/relatorio', 'Relatório'],
  ['/preventivas', 'Preventivas'],
  ['/passagem', 'Passagem de turno'],
  ['/documentos', 'Documentos'],
  ['/perfil', 'Meu perfil', true],
  ['/perfil/assinatura', 'Minha assinatura', true],
]

export function AppLayout() {
  const online = useOnline()
  const uid = useAuth().session?.user.id
  // Fila de envio: roda ao abrir o app, quando a internet volta e a cada 30 minutos.
  useEffect(() => {
    if (!uid) return
    const p1 = registrarSincronizacao({ rotulo: 'Relatório', executar: processarFila })
    const p2 = registrarSincronizacao({ rotulo: 'Preventivas', executar: filaPreventivas })
    const p3 = registrarSincronizacao({ rotulo: 'Passagem de turno', executar: processarFilaPassagem })
    // Rascunhos de antes da separação por pessoa ficam com quem entrou; depois a fila roda.
    void adotarRascunhosAntigos(uid).finally(() => void sincronizarAgora())
    return () => {
      p1()
      p2()
      p3()
    }
  }, [uid])

  const [menuAberto, setMenuAberto] = useState(false)
  // Fecha o menu ao escolher uma tela, ao tocar fora dele e com a tecla Esc.
  useEffect(() => {
    if (!menuAberto) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setMenuAberto(false)
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [menuAberto])

  return (
    <div className="layout">
      <header className="topo">
        <strong className="marca">SkyRail L17</strong>
        <span className={`rede ${online ? 'on' : 'off'}`} role="status">
          <span className="ponto" aria-hidden="true" />
          {online ? 'Online' : 'Sem internet'}
        </span>
        <button
          type="button"
          className="btn-menu"
          aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={menuAberto}
          aria-controls="menu-principal"
          onClick={() => setMenuAberto((v) => !v)}
        >
          <span className={`hamburguer ${menuAberto ? 'x' : ''}`} aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>
        <nav id="menu-principal" className={menuAberto ? 'aberto' : ''} aria-label="Menu principal">
          {LINKS.map(([to, rotulo, conta]) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/perfil'}
              className={conta ? 'so-celular' : undefined}
              onClick={() => setMenuAberto(false)}
            >
              {rotulo}
            </NavLink>
          ))}
          <button type="button" className="btn-sair so-celular" onClick={() => void sairComAviso()}>
            Sair
          </button>
        </nav>
        <MenuConta />
      </header>
      {menuAberto && <div className="menu-fundo" onClick={() => setMenuAberto(false)} aria-hidden="true" />}
      <Avisos />
      <main>
        <Outlet />
      </main>
    </div>
  )
}
