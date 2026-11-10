import { memo, useState } from 'react'
import type { ItemChecklist } from '../domain/modelo'
import { foraDoLimite, type Resposta, type Resultado } from '../domain/respostas'

const RESULTADOS: readonly Resultado[] = ['OK', 'NOK', 'NA']

function limites(min: number | null, max: number | null) {
  if (min !== null && max !== null) return `${min} a ${max}`
  if (min !== null) return `mín. ${min}`
  if (max !== null) return `máx. ${max}`
  return ''
}

function numero(v: string): number | null {
  const n = Number(v.replace(',', '.'))
  return v.trim() === '' || Number.isNaN(n) ? null : n
}

export interface PropsItem {
  item: ItemChecklist
  resposta: Resposta | undefined
  figuras?: Record<string, string>
  onChange: (r: Resposta) => void
  onOcorrencia: () => void
  /** Medição extra feita nesta unidade (ex.: tensão da correia da porta). */
  medicaoExtra?: { rotulo: string; min: number | null; max: number | null }
}

export const ItemCard = memo(function ItemCard({ item, resposta, figuras, onChange, onOcorrencia, medicaoExtra }: PropsItem) {
  const [abrirObs, setAbrirObs] = useState(false)
  const r = resposta ?? {}
  const meds = [...(item.medicoes ?? []), ...(medicaoExtra ? [{ id: 'un', ...medicaoExtra }] : [])]
  const mostrarObs = abrirObs || r.r === 'NOK' || !!r.obs
  const temGuia = item.criterio || item.comoFazer || item.acaoNok || item.ferramentas || item.parametro || item.requisitos || item.figuras?.length

  return (
    <article className={`item-prev ${r.r ? `r-${r.r.toLowerCase()}` : ''}`}>
      <div className="item-topo">
        <span className="item-id">{item.id}</span>
        <p>{item.atividade}</p>
      </div>
      <div className="resp" role="group" aria-label={`Resultado do item ${item.id}`}>
        {RESULTADOS.map((x) => (
          <button type="button" key={x} className={`r-${x.toLowerCase()} ${r.r === x ? 'on' : ''}`} aria-pressed={r.r === x} onClick={() => onChange({ ...r, r: r.r === x ? undefined : x })}>
            {x === 'NA' ? 'N/A' : x}
          </button>
        ))}
      </div>
      {meds.length > 0 && (
        <div className="medicoes">
          {meds.map((m) => {
            const v = r.med?.[m.id]
            const fora = foraDoLimite(v, m.min, m.max)
            return (
              <label key={m.id} className={fora ? 'fora' : ''}>
                <span>
                  {m.rotulo}
                  {limites(m.min, m.max) && <em> ({limites(m.min, m.max)})</em>}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  defaultValue={v ?? ''}
                  onBlur={(e) => onChange({ ...r, med: { ...r.med, [m.id]: numero(e.target.value) } })}
                />
                {fora && <small>Fora do limite</small>}
              </label>
            )
          })}
        </div>
      )}
      {mostrarObs ? (
        <textarea rows={2} placeholder={r.r === 'NOK' ? 'Descreva a não conformidade' : 'Observação'} value={r.obs ?? ''} onChange={(e) => onChange({ ...r, obs: e.target.value })} />
      ) : null}
      <div className="item-acoes">
        {!mostrarObs && (
          <button type="button" className="link" onClick={() => setAbrirObs(true)}>+ Observação</button>
        )}
        {r.r === 'NOK' && (
          <button type="button" className="link" onClick={onOcorrencia}>+ Ocorrência com fotos</button>
        )}
      </div>
      {temGuia && (
        <details className="guia-item">
          <summary>Como fazer e critério</summary>
          {item.comoFazer && <p><b>Como fazer:</b> {item.comoFazer}</p>}
          {item.criterio && <p><b>Critério de aceitação:</b> {item.criterio}</p>}
          {item.parametro && <p><b>Parâmetro:</b> {item.parametro}</p>}
          {item.acaoNok && <p><b>Se não estiver OK:</b> {item.acaoNok}</p>}
          {item.ferramentas && <p><b>Ferramentas:</b> {item.ferramentas}</p>}
          {item.requisitos && (
            <>
              <p><b>{item.requisitos.titulo}</b></p>
              <ul>{item.requisitos.linhas.map((l, i) => <li key={i}>{l}</li>)}</ul>
            </>
          )}
          {item.figuras?.length ? (
            <ul className="figuras">{item.figuras.map((f) => <li key={f}>{figuras?.[String(f)] ?? `Figura ${f}`}</li>)}</ul>
          ) : null}
        </details>
      )}
    </article>
  )
})
