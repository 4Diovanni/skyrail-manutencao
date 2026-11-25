import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { iniciais, primeiroNome, rotuloPerfil } from '../auth/perfilTexto'
import { sairComAviso } from './sair'

/** Botão de conta no canto superior direito (só no PC). No celular, os mesmos links ficam no menu. */
export function MenuConta() {
  const { perfil } = useAuth()
  const [aberto, setAberto] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false)
    document.addEventListener('mousedown', fora)
    window.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fora)
      window.removeEventListener('keydown', esc)
    }
  }, [aberto])

  if (!perfil) return null
  const fechar = () => setAberto(false)

  return (
    <div className="conta" ref={caixa}>
      <button
        type="button"
        className="conta-botao"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls="menu-conta"
        onClick={() => setAberto((v) => !v)}
      >
        <span className="avatar" aria-hidden="true">{iniciais(perfil.nome)}</span>
        <span className="conta-nome">{primeiroNome(perfil.nome)}</span>
        <span className="seta" aria-hidden="true">▾</span>
      </button>
      {aberto && (
        <div id="menu-conta" className="conta-menu" role="menu">
          <div className="conta-cabecalho">
            <strong>{perfil.nome || 'Nome não cadastrado'}</strong>
            <small>
              RE {perfil.matricula || '—'} · {rotuloPerfil(perfil.perfil)}
            </small>
          </div>
          <Link role="menuitem" to="/perfil" onClick={fechar}>Meu perfil</Link>
          <Link role="menuitem" to="/perfil/assinatura" onClick={fechar}>Minha assinatura</Link>
          <button role="menuitem" type="button" className="conta-sair" onClick={() => void sairComAviso()}>
            Sair
          </button>
        </div>
      )}
    </div>
  )
}
