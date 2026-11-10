import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthContext'
import { decidirReprogramacao, listarReprogramacoesPendentes } from '../data/remoto'
import type { Atividade } from '../domain/tipos'

/** Aprovação de pedidos de reprogramação (só admin; o banco também bloqueia os demais). */
export function ReprogramacoesPage() {
  const { perfil } = useAuth()
  const [lista, setLista] = useState<Atividade[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = () => listarReprogramacoesPendentes().then(setLista).catch(() => setErro('Não foi possível carregar.'))
  useEffect(() => {
    void carregar()
  }, [])

  if (perfil?.perfil !== 'admin') return <Navigate to="/relatorio" replace />

  async function decidir(id: string, d: 'aprovado' | 'recusado') {
    try {
      await decidirReprogramacao(id, d)
      await carregar()
    } catch {
      setErro('Não foi possível registrar a decisão.')
    }
  }

  return (
    <section>
      <h2>Pedidos de reprogramação</h2>
      {erro && <p role="alert" className="error">{erro}</p>}
      {lista && !lista.length && <p className="hint">Nenhum pedido pendente.</p>}
      {lista?.map((a) => (
        <div key={a.id} className="card">
          <b>{a.titulo}</b>
          <p className="hint">
            {a.data.split('-').reverse().join('/')} · {a.turno} · {a.categoria}
            {a.reprog_data ? ` · nova data sugerida: ${a.reprog_data.split('-').reverse().join('/')}` : ''}
          </p>
          <p>{a.motivo}</p>
          <div className="row">
            <button type="button" className="sec" onClick={() => void decidir(a.id, 'recusado')}>Recusar</button>
            <button type="button" onClick={() => void decidir(a.id, 'aprovado')}>Aprovar</button>
          </div>
        </div>
      ))}
    </section>
  )
}
