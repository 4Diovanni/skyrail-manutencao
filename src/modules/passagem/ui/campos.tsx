import { useState } from 'react'
import { TIPOS_PREV } from '../../relatorio/domain/tipos'
import { trazerDoAnterior, type OpcoesTrazer } from '../domain/passagem'
import { PRIORIDADES, type ItemTurno, type LinhaCondicao, type Ocorrencia, type Passagem, type Prioridade, type Programada, type RascunhoPassagem } from '../domain/tipos'

const dataBR = (iso: string) => iso.split('-').reverse().join('/')

export function TrazerAnterior({ anterior, onTrazer }: { anterior: Passagem; onTrazer: (f: (r: RascunhoPassagem) => RascunhoPassagem) => void }) {
  const [aberto, setAberto] = useState(false)
  const [op, setOp] = useState<OpcoesTrazer>({ ocorrencias: true, condicoes: true, encerramento: false, programadas: true })
  const n = anterior.alta.length + anterior.media.length + anterior.baixa.length
  const opcoes: [keyof OpcoesTrazer, string][] = [
    ['ocorrencias', `Ocorrências (${n})`],
    ['condicoes', 'Condição operacional'],
    ['programadas', 'Preventivas programadas'],
    ['encerramento', 'Encerramento'],
  ]
  return (
    <section className="card pass-anterior">
      <div className="pass-anterior-topo">
        <div>
          <b>
            Turno anterior: {dataBR(anterior.data)} · {anterior.turno}
          </b>
          <small>
            {n} ocorrência{n === 1 ? '' : 's'} (alta {anterior.alta.length} · média {anterior.media.length} · baixa {anterior.baixa.length})
          </small>
        </div>
        {!aberto && (
          <button type="button" onClick={() => setAberto(true)}>
            Trazer informações
          </button>
        )}
      </div>
      {aberto && (
        <div className="pass-anterior-op">
          {opcoes.map(([k, rot]) => (
            <label key={k} className="check">
              <input type="checkbox" checked={op[k]} onChange={(e) => setOp({ ...op, [k]: e.target.checked })} />
              {rot}
            </label>
          ))}
          <div className="pass-anterior-acoes">
            <button type="button" className="secundario" onClick={() => setAberto(false)}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                onTrazer((r) => trazerDoAnterior(r, anterior, op).passagem)
                setAberto(false)
              }}
            >
              Trazer
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

export function CondicoesCampo({ valor, onChange }: { valor: LinhaCondicao[]; onChange: (v: LinhaCondicao[]) => void }) {
  return (
    <section className="card">
      <h3>Condição operacional e entrega</h3>
      {valor.map((c, i) => (
        <label key={i} className="campo">
          <span>
            {c.i}
            {c.auto && <em className="tag"> preenchido pelo app</em>}
          </span>
          <textarea rows={2} value={c.c} onChange={(e) => onChange(valor.map((x, j) => (j === i ? { i: x.i, c: e.target.value } : x)))} />
        </label>
      ))}
    </section>
  )
}

export function OcorrenciasCampo({ r, onChange }: { r: RascunhoPassagem; onChange: (k: Prioridade, v: Ocorrencia[]) => void }) {
  return (
    <>
      {PRIORIDADES.map(([k, titulo, rotulo]) => {
        const lista = r[k]
        return (
          <section key={k} className={`card pass-oc pri-${k}`}>
            <h3>
              {titulo} {lista.length > 0 && <span className="pass-conta">{lista.length}</span>}
            </h3>
            {lista.map((o, i) => (
              <div key={i} className="pass-oc-linha">
                <input
                  value={o.l}
                  placeholder="Local e equipamento (ex.: VJD PDM11)"
                  aria-label={`${titulo}: local e equipamento ${i + 1}`}
                  onChange={(e) => onChange(k, lista.map((x, j) => (j === i ? { ...x, l: e.target.value } : x)))}
                />
                <textarea
                  rows={2}
                  value={o.d}
                  placeholder={rotulo}
                  aria-label={`${titulo}: ${rotulo} ${i + 1}`}
                  onChange={(e) => onChange(k, lista.map((x, j) => (j === i ? { ...x, d: e.target.value } : x)))}
                />
                <button type="button" className="secundario pass-remover" onClick={() => onChange(k, lista.filter((_, j) => j !== i))}>
                  Remover
                </button>
              </div>
            ))}
            <button type="button" className="secundario pass-add" onClick={() => onChange(k, [...lista, { l: '', d: '' }])}>
              + Adicionar ocorrência
            </button>
          </section>
        )
      })}
    </>
  )
}

type Conf = { ok: boolean; incompleta: boolean; item: ItemTurno | null }

export function ProgramadasCampo({ valor, conferencia, onChange }: { valor: Programada[]; conferencia: Conf[]; onChange: (v: Programada[]) => void }) {
  const set = (i: number, p: Partial<Programada>) => onChange(valor.map((x, j) => (j === i ? { ...x, ...p } : x)))
  return (
    <section className="card">
      <h3>Preventivas programadas</h3>
      <p className="hint">O app confere cada uma com as preventivas enviadas no turno.</p>
      {valor.map((p, i) => {
        const c = conferencia[i]
        return (
          <div key={i} className="pass-prog">
            <div className="row">
              <input value={p.nome} placeholder="Atividade (ex.: AMV)" aria-label={`Programada ${i + 1}: atividade`} onChange={(e) => set(i, { nome: e.target.value })} />
              <input value={p.local} placeholder="Local (opcional)" aria-label={`Programada ${i + 1}: local`} onChange={(e) => set(i, { local: e.target.value })} />
            </div>
            <select value={p.tipo} aria-label={`Programada ${i + 1}: periodicidade`} onChange={(e) => set(i, { tipo: e.target.value })}>
              <option value="">Periodicidade…</option>
              {TIPOS_PREV.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <div className="pass-prog-fim">
              <span className={`tag ${c?.ok ? 'st-ok' : c?.incompleta ? '' : 'st-nok'}`}>
                {c?.ok ? `Recebida · ${c.item?.status.toLowerCase()}` : c?.incompleta ? 'Preencha atividade e periodicidade' : 'Ainda não enviada'}
              </span>
              <button type="button" className="secundario pass-remover" onClick={() => onChange(valor.filter((_, j) => j !== i))}>
                Remover
              </button>
            </div>
          </div>
        )
      })}
      <button type="button" className="secundario pass-add" onClick={() => onChange([...valor, { nome: '', tipo: '', local: '' }])}>
        + Adicionar programada
      </button>
    </section>
  )
}
