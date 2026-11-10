import { useCallback, useState } from 'react'
import type { ConteudoModelo } from '../domain/modelo'
import { chave, marcarPendentesOk, progresso, type Resposta, type Respostas } from '../domain/respostas'
import { ItemCard } from './ItemCard'

/** Situação de uma unidade (porta): completa, com NOK ou pendente. */
function estadoUnidade(c: ConteudoModelo, resp: Respostas, unidade: string) {
  const ids = c.grupos.filter((g) => g.escopo === 'unidade').flatMap((g) => g.itens)
  const rs = ids.map((i) => resp[chave(i, unidade)]?.r)
  if (rs.includes('NOK')) return 'nok'
  if (rs.every(Boolean)) return 'ok'
  if (rs.some(Boolean)) return 'parcial'
  return ''
}

export function ChecklistCampo({
  c,
  respostas,
  onChange,
  onOcorrencia,
}: {
  c: ConteudoModelo
  respostas: Respostas
  onChange: (r: Respostas) => void
  onOcorrencia: (item: string, unidade?: string) => void
}) {
  const primeira = c.unidades?.grupos[0]?.unidades[0] ?? null
  const [unidade, setUnidade] = useState<string | null>(primeira)
  const itens = new Map(c.itens.map((i) => [i.id, i]))
  const temUnidade = c.grupos.some((g) => g.escopo === 'unidade') && !!c.unidades
  const geral = c.grupos.filter((g) => g.escopo === 'geral')
  const p = progresso(c, respostas)

  const responder = useCallback(
    (k: string, r: Resposta) => onChange({ ...respostas, [k]: r }),
    [onChange, respostas],
  )

  function blocoGrupos(escopo: 'unidade' | 'geral', un?: string) {
    let ultimoTitulo = ''
    return c.grupos
      .filter((g) => g.escopo === escopo)
      .map((g, gi) => {
        const mostraTitulo = g.titulo !== ultimoTitulo
        ultimoTitulo = g.titulo
        return (
          <div key={`${escopo}-${gi}`} className="grupo-prev">
            {mostraTitulo && <h4>{g.titulo}</h4>}
            {g.subtitulo && <p className="grupo-sub">{g.subtitulo}</p>}
            {g.itens.map((id) => {
              const item = itens.get(id)
              if (!item) return null
              const k = chave(id, un)
              const mu = un && c.medicaoUnidade?.item === id ? c.medicaoUnidade : undefined
              return (
                <ItemCard
                  key={k}
                  item={item}
                  resposta={respostas[k]}
                  figuras={c.figuras}
                  medicaoExtra={mu}
                  onChange={(r) => responder(k, r)}
                  onOcorrencia={() => onOcorrencia(id, un)}
                />
              )
            })}
          </div>
        )
      })
  }

  return (
    <>
      <div className="progresso grande" aria-label={`${p.respondidos} de ${p.total} respostas`}>
        <span style={{ width: `${p.total ? (p.respondidos / p.total) * 100 : 0}%` }} />
        <em>
          {p.respondidos} de {p.total} respondidos{p.nok ? ` · ${p.nok} NOK` : ''}
        </em>
      </div>

      {temUnidade && c.unidades && (
        <section className="card">
          <h3>Por {c.unidades.rotulo.toLowerCase()}</h3>
          {c.unidades.grupos.map((g) => (
            <div key={g.nome} className="campo">
              <span>{g.nome}</span>
              <div className="unidades">
                {g.unidades.map((u) => (
                  <button type="button" key={u} className={`unidade ${estadoUnidade(c, respostas, u)} ${unidade === u ? 'on' : ''}`} aria-pressed={unidade === u} onClick={() => setUnidade(u)}>
                    {u}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {unidade && (
            <>
              <div className="unidade-barra">
                <b>{unidade}</b>
                <button type="button" className="mini" onClick={() => onChange(marcarPendentesOk(c, respostas, (l) => l.unidade === unidade))}>
                  Pendentes desta {c.unidades.rotulo.toLowerCase()} = OK
                </button>
              </div>
              {blocoGrupos('unidade', unidade)}
            </>
          )}
        </section>
      )}

      {geral.length > 0 && (
        <section className="card">
          <div className="unidade-barra">
            <h3>{temUnidade ? (c.tituloGeral ?? 'Itens gerais') : 'Itens do checklist'}</h3>
            <button type="button" className="mini" onClick={() => onChange(marcarPendentesOk(c, respostas, (l) => !l.unidade))}>
              Pendentes = OK
            </button>
          </div>
          {blocoGrupos('geral')}
        </section>
      )}
    </>
  )
}
