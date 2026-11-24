import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthContext'
import { avisarFila } from '../../../lib/avisos'
import { processarFila } from '../data/envio'
import { localDb } from '../data/local'
import { excluirAtividade, listarAtividades } from '../data/remoto'
import { duracaoEtapa, formatarMinutos } from '../domain/tempos'
import type { Atividade, Categoria, RascunhoAtividade } from '../domain/tipos'
import { AcoesAtividade } from './AcoesAtividade'
import { nomePessoa, useReferencias } from './useReferencias'

const hoje = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

type Linha = { a: RascunhoAtividade | (Atividade & { equipe: string[] }); estadoLocal?: string; enviada: boolean }

export function DiaPage() {
  const [qs, setQs] = useSearchParams()
  const { perfil } = useAuth()
  const ref = useReferencias()
  const data = qs.get('data') ?? hoje()
  const cat = (qs.get('cat') as Categoria) ?? 'Corretiva'
  const [remotas, setRemotas] = useState<(Atividade & { equipe: string[] })[]>([])
  const [semRede, setSemRede] = useState(false)
  const [recarga, setRecarga] = useState(0)
  const locais = useLiveQuery(() => localDb.rascunhos.where('data').equals(data).toArray(), [data]) ?? []
  const fila = useLiveQuery(() => localDb.rascunhos.where('estado').anyOf('fila', 'erro').count(), []) ?? 0

  useEffect(() => {
    listarAtividades(data)
      .then((l) => { setRemotas(l); setSemRede(false) })
      .catch(() => setSemRede(true))
  }, [data, recarga])

  const linhas: Linha[] = [
    ...remotas.filter((r) => !locais.some((l) => l.id === r.id)).map((a) => ({ a, enviada: true })),
    ...locais.map((l) => ({ a: l.dados, estadoLocal: l.estado, enviada: l.dados.versaoBase != null })),
  ]
    .filter((l) => l.a.categoria === cat)
    .sort((x, y) => x.a.ordem - y.a.ordem)

  const proxOrdem = linhas.length ? Math.max(...linhas.map((l) => l.a.ordem)) + 1 : 1

  async function enviarFila() {
    avisarFila(await processarFila(), 'Relatório')
    setRecarga((n) => n + 1)
  }

  async function excluir(id: string) {
    if (!confirm('Excluir esta atividade do servidor? Esta ação não pode ser desfeita.')) return
    try {
      await excluirAtividade(id)
      setRecarga((n) => n + 1)
    } catch {
      alert('Não foi possível excluir. Só quem criou a atividade (ou um admin) pode excluir.')
    }
  }

  return (
    <div>
      <div className="row topo-dia">
        <label className="campo">
          <span>Data</span>
          <input type="date" value={data} onChange={(e) => setQs({ data: e.target.value, cat })} />
        </label>
        <div className="campo">
          <span>Categoria</span>
          <div className="chips">
            {(['Corretiva', 'Preventiva'] as const).map((c) => (
              <button type="button" key={c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setQs({ data, cat: c })}>{c}</button>
            ))}
          </div>
        </div>
      </div>
      {semRede && <p className="aviso">Sem conexão: mostrando só o que está neste aparelho.</p>}
      {fila > 0 && (
        <p className="aviso">
          {fila} envio(s) aguardando internet ou com erro. <button type="button" className="mini" onClick={() => void enviarFila()}>Tentar agora</button>
        </p>
      )}
      {perfil?.perfil === 'admin' && <p><Link to="/relatorio/reprogramacoes">Pedidos de reprogramação</Link></p>}
      {(['Noturno', 'Diurno'] as const).map((t) => {
        const l = linhas.filter((x) => x.a.turno === t)
        return (
          <section key={t} className={`card turno ${t}`}>
            <h3>{cat} · {t} <span className="pill">{l.length}</span></h3>
            {!l.length && <p className="hint">Nenhuma {cat.toLowerCase()} no {t.toLowerCase()}.</p>}
            {l.map(({ a, estadoLocal, enviada }, i) => {
              const d = duracaoEtapa(a.tempos.atu)
              return (
                <div key={a.id} className="atividade">
                  <span className="num">{String(i + 1).padStart(2, '0')}</span>
                  <Link to={`/relatorio/atividade/${a.id}?data=${data}&cat=${cat}`} className="meio">
                    <b>{a.titulo || 'Sem título'}</b>
                    <small>
                      {a.status}
                      {a.tipo_prev ? ` · ${a.tipo_prev}` : ''}
                      {a.local ? ` · ${a.local}` : ''}
                      {d != null ? ` · ${formatarMinutos(d)}` : ''}
                    </small>
                    <small>{a.equipe.map((id) => nomePessoa(ref.pessoas, id)).join(', ')}</small>
                    {estadoLocal === 'rascunho' && <em className="tag">Rascunho no aparelho</em>}
                    {estadoLocal === 'fila' && <em className="tag">Na fila de envio</em>}
                    {estadoLocal === 'erro' && <em className="tag erro">Erro no envio</em>}
                  </Link>
                  {enviada && !estadoLocal && 'versao' in a && <AcoesAtividade a={a} numero={i + 1} />}
                  {enviada && !estadoLocal && (
                    <button type="button" className="mini perigo" aria-label="Excluir" onClick={() => void excluir(a.id)}>🗑</button>
                  )}
                </div>
              )
            })}
          </section>
        )
      })}
      <div className="barra">
        <Link className="botao" to={`/relatorio/atividade/nova?data=${data}&cat=${cat}&ordem=${proxOrdem}`}>+ Nova {cat.toLowerCase()}</Link>
      </div>
    </div>
  )
}
