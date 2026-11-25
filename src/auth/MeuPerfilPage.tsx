import { Link } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { fichaPerfil } from './perfilTexto'

/** Mostra quem está logado, para o técnico conferir a conta antes de enviar. */
export function MeuPerfilPage() {
  const { perfil } = useAuth()
  if (!perfil) return null

  return (
    <section className="meu-perfil">
      <h2>Meu perfil</h2>
      <p className="hint">Confira se esta é a sua conta antes de enviar relatórios e preventivas.</p>
      <dl className="card ficha-perfil">
        {fichaPerfil(perfil).map(([rotulo, valor]) => (
          <div key={rotulo}>
            <dt>{rotulo}</dt>
            <dd>{valor}</dd>
          </div>
        ))}
      </dl>
      <Link to="/perfil/assinatura" className="botao sec">Minha assinatura</Link>
      <p className="hint">Nome ou RE errado? Peça a correção ao administrador.</p>
      <p className="hint versao-app">Versão do app {__APP_VERSION__}</p>
    </section>
  )
}
