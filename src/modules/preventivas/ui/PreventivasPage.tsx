import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { avisarFila } from '../../../lib/avisos'
import { processarFila } from '../data/envio'
import { useAuth } from '../../../auth/AuthContext'
import { meusRascunhos } from '../data/local'
import { listarPreventivas } from '../data/remoto'
import type { ModeloChecklist } from '../domain/modelo'
import type { Preventiva, RascunhoPreventiva } from '../domain/preventiva'
import { progresso } from '../domain/respostas'
import { AcoesPreventiva } from './AcoesPreventiva'
import { dataBR, nomeModelo, useModelos } from './useModelos'

const ESTADO_LOCAL: Record<string, string> = { rascunho: 'Só neste aparelho', fila: 'Na fila de envio', erro: 'Erro no envio' }

function trintaDiasAtras() {
  const d = new Date(Date.now() - 30 * 86400000)
  return d.toISOString().slice(0, 10)
}

function Cartao({ p, estado, modelos }: { p: RascunhoPreventiva | Preventiva; estado?: string; modelos: ModeloChecklist[] }) {
  const m = modelos.find((x) => x.id === p.modelo_id)
  const pr = m ? progresso(m.conteudo, p.respostas) : null
  return (
    <Link to={`/preventivas/${p.id}`} className="card prev-item">
      <div className="prev-item-topo">
        <b>{nomeModelo(m, p.modelo_id)}</b>
        <span className={`tag st-${p.status === 'Concluído' ? 'ok' : p.status === 'Não realizado' ? 'nok' : 'and'}`}>{p.status}</span>
      </div>
      <small>
        {dataBR(p.data)} · {p.turno}
        {p.local ? ` · ${p.local}` : ''}
        {p.dias.length ? ` · ${p.dias.length + 1} dias` : ''}
      </small>
      {pr && (
        <div className="progresso" aria-label={`${pr.respondidos} de ${pr.total} itens`}>
          <span style={{ width: `${pr.total ? (pr.respondidos / pr.total) * 100 : 0}%` }} />
          <em>
            {pr.respondidos}/{pr.total}
            {pr.nok ? ` · ${pr.nok} NOK` : ''}
          </em>
        </div>
      )}
      {estado && <span className={`tag local-${estado}`}>{ESTADO_LOCAL[estado]}</span>}
    </Link>
  )
}

export function PreventivasPage() {
  const { modelos } = useModelos()
  const uid = useAuth().session?.user.id
  const locais = useLiveQuery(() => meusRascunhos().toArray(), [uid]) ?? []
  const [remotas, setRemotas] = useState<(Preventiva & { equipe: string[] })[]>([])
  const [semRede, setSemRede] = useState(false)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    listarPreventivas(trintaDiasAtras())
      .then((l) => {
        setRemotas(l)
        setSemRede(false)
      })
      .catch(() => setSemRede(true))
  }, [recarga])

  const pendentesFila = locais.filter((l) => l.estado !== 'rascunho').length
  const enviadas = remotas.filter((r) => !locais.some((l) => l.id === r.id))

  return (
    <div className="pagina-prev">
      <div className="titulo-pagina">
        <h2>Preventivas</h2>
        <Link to="/preventivas/nova" className="botao">+ Nova preventiva</Link>
      </div>
      {semRede && <p className="aviso">Sem conexão com o servidor. Mostrando o que está neste aparelho.</p>}
      {pendentesFila > 0 && (
        <p className="aviso">
          {pendentesFila} preventiva(s) aguardando envio.{' '}
          <button type="button" className="mini" onClick={() => void processarFila().then((r) => { avisarFila(r, 'Preventivas'); setRecarga((n) => n + 1) })}>Enviar agora</button>
        </p>
      )}
      {locais.length > 0 && (
        <section>
          <h3 className="sec-titulo">Neste aparelho</h3>
          <div className="lista-prev">
            {locais.map((l) => <Cartao key={l.id} p={l.dados} estado={l.estado} modelos={modelos} />)}
          </div>
        </section>
      )}
      <section>
        <h3 className="sec-titulo">Enviadas nos últimos 30 dias</h3>
        <div className="lista-prev">
          {enviadas.map((p) => (
            <div key={p.id} className="prev-enviada">
              <Cartao p={p} modelos={modelos} />
              <AcoesPreventiva p={p} nome={nomeModelo(modelos.find((m) => m.id === p.modelo_id), p.modelo_id)} />
            </div>
          ))}
          {!enviadas.length && <p className="hint">Nenhuma preventiva enviada neste período.</p>}
        </div>
      </section>
    </div>
  )
}
