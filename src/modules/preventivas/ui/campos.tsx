import { useMemo } from 'react'
import { FotosLista, type RepoFotos } from '../../../components/FotosLista'
import { turnoDe } from '../../../domain/turno'
import { temposVazios } from '../../relatorio/domain/tempos'
import { urlFoto } from '../../relatorio/data/remoto'
import { Campo, Opcoes, Texto } from '../../relatorio/ui/campos/Campo'
import { TemposCampo } from '../../relatorio/ui/campos/TemposCampo'
import { prevDb } from '../data/local'
import type { ConteudoModelo } from '../domain/modelo'
import { STATUS_PREVENTIVA, type DiaAtuacao, type Instrumento, type Ocorrencia, type RascunhoPreventiva } from '../domain/preventiva'
import { dataBR } from './useModelos'

type Set = (p: Partial<RascunhoPreventiva>) => void

export function SituacaoCampo({ p, set }: { p: RascunhoPreventiva; set: Set }) {
  const precisaMotivo = p.status === 'Não realizado' || p.reprog_pedido
  return (
    <>
      <Campo rotulo="Situação" obrigatorio>
        <Opcoes
          opcoes={STATUS_PREVENTIVA}
          valor={p.status}
          obrigatoria
          onChange={(v) => v && set({ status: v, ...(v === 'Concluído' ? { reprog_pedido: false, reprog_data: null } : {}) })}
        />
      </Campo>
      {p.status !== 'Concluído' && (
        <label className="reprog">
          <input type="checkbox" checked={p.reprog_pedido} onChange={(e) => set({ reprog_pedido: e.target.checked })} />
          <span>
            <b>Pedir reprogramação desta preventiva</b>
            <small>Vai para aprovação de um admin e aparece na passagem de turno.</small>
          </span>
        </label>
      )}
      {p.reprog_pedido && (
        <Campo rotulo="Nova data sugerida (opcional)">
          <input type="date" value={p.reprog_data ?? ''} onChange={(e) => set({ reprog_data: e.target.value || null })} />
        </Campo>
      )}
      {precisaMotivo && (
        <Campo rotulo={p.reprog_pedido ? 'Motivo do pedido de reprogramação' : 'Motivo da não realização'} obrigatorio>
          <Texto linhas={3} valor={p.motivo} onChange={(v) => set({ motivo: v })} placeholder="Ex.: Sem liberação do CCO; falta de material…" />
        </Campo>
      )}
    </>
  )
}

export function InstrumentosCampo({ valor, onChange }: { valor: Instrumento[]; onChange: (v: Instrumento[]) => void }) {
  const mudar = (i: number, m: Partial<Instrumento>) => onChange(valor.map((x, j) => (j === i ? { ...x, ...m } : x)))
  return (
    <div className="instrumentos">
      {valor.map((ins, i) => (
        <div key={i} className="instrumento">
          <input type="text" placeholder="Equipamento (ex.: Multímetro)" value={ins.nome} onChange={(e) => mudar(i, { nome: e.target.value })} />
          <input type="text" placeholder="Calibração (ex.: válida até 03/2027)" value={ins.calibracao ?? ''} onChange={(e) => mudar(i, { calibracao: e.target.value })} />
          <input type="text" placeholder="Observação" value={ins.obs ?? ''} onChange={(e) => mudar(i, { obs: e.target.value })} />
          <button type="button" className="mini perigo" aria-label="Remover equipamento" onClick={() => onChange(valor.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button type="button" className="sec" onClick={() => onChange([...valor, { nome: '' }])}>+ Equipamento utilizado</button>
    </div>
  )
}

/** Preventiva em vários dias: cada dia extra tem data, turno e tempos próprios. */
export function DiasCampo({ valor, onChange, primeiro }: { valor: DiaAtuacao[]; onChange: (v: DiaAtuacao[]) => void; primeiro: string }) {
  const mudar = (i: number, m: Partial<DiaAtuacao>) => onChange(valor.map((x, j) => (j === i ? { ...x, ...m } : x)))
  return (
    <>
      {valor.map((d, i) => (
        <fieldset key={i} className="dia-extra">
          <legend>
            Dia {i + 2} · {dataBR(d.data)}
          </legend>
          <div className="row">
            <label className="campo">
              <span>Data</span>
              <input type="date" value={d.data} min={primeiro} onChange={(e) => mudar(i, { data: e.target.value })} />
            </label>
            <div className="campo">
              <span>Turno</span>
              <Opcoes opcoes={['Noturno', 'Diurno'] as const} valor={d.turno} obrigatoria onChange={(v) => v && mudar(i, { turno: v })} />
            </div>
          </div>
          <TemposCampo valor={d.tempos} onChange={(t) => mudar(i, { tempos: t })} />
          <button type="button" className="mini perigo" onClick={() => onChange(valor.filter((_, j) => j !== i))}>Remover este dia</button>
        </fieldset>
      ))}
      <button
        type="button"
        className="sec"
        onClick={() => {
          const d = new Date()
          const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
          onChange([...valor, { data: iso, turno: turnoDe(d), tempos: temposVazios() }])
        }}
      >
        + Continuar em outro dia
      </button>
    </>
  )
}

function FotosOcorrencia({ preventivaId, ocorrenciaId, onMudou }: { preventivaId: string; ocorrenciaId: string; onMudou: () => void }) {
  const repo = useMemo<RepoFotos>(
    () => ({
      listar: () => prevDb.fotos.where('[preventivaId+ocorrenciaId]').equals([preventivaId, ocorrenciaId]).toArray(),
      criar: async (f) => {
        await prevDb.fotos.put({ ...f, preventivaId, ocorrenciaId })
      },
      atualizar: async (id, m) => {
        await prevDb.fotos.update(id, m)
      },
      apagar: (id) => prevDb.fotos.delete(id),
      url: urlFoto,
    }),
    [preventivaId, ocorrenciaId],
  )
  return <FotosLista repo={repo} chave={ocorrenciaId} onMudou={onMudou} />
}

export function OcorrenciasCampo({
  p,
  c,
  onChange,
  onFotos,
}: {
  p: RascunhoPreventiva
  c: ConteudoModelo
  onChange: (v: Ocorrencia[]) => void
  onFotos: () => void
}) {
  const mudar = (id: string, m: Partial<Ocorrencia>) => onChange(p.ocorrencias.map((o) => (o.id === id ? { ...o, ...m } : o)))
  return (
    <>
      {p.ocorrencias.map((o, i) => (
        <div key={o.id} className="ocorrencia" id={`oc-${o.id}`}>
          <div className="unidade-barra">
            <b>
              Ocorrência {i + 1}
              {o.item ? ` · item ${o.item}` : ''}
              {o.unidade ? ` · ${o.unidade}` : ''}
            </b>
            <button
              type="button"
              className="mini perigo"
              onClick={() => confirm('Remover esta ocorrência e as fotos dela?') && onChange(p.ocorrencias.filter((x) => x.id !== o.id))}
            >
              Remover
            </button>
          </div>
          <Texto linhas={2} valor={o.texto} onChange={(v) => mudar(o.id, { texto: v })} placeholder="O que foi encontrado e o que foi feito" />
          <FotosOcorrencia preventivaId={p.id} ocorrenciaId={o.id} onMudou={onFotos} />
        </div>
      ))}
      <button type="button" className="sec" onClick={() => onChange([...p.ocorrencias, { id: crypto.randomUUID(), texto: '' }])}>
        + Nova ocorrência
      </button>
      {!c.unidades && !p.ocorrencias.length && <p className="hint">Use para registrar não conformidades e anexar fotos.</p>}
    </>
  )
}

export function GuiaCampo({ c }: { c: ConteudoModelo }) {
  if (!c.guia?.length && !c.ferramentasLista?.length && !c.tabelas?.length && !c.nota) return null
  return (
    <details className="card guia">
      <summary>Antes de começar: segurança, ferramentas e orientações</summary>
      {c.nota && <p className="hint">{c.nota}</p>}
      {c.guia?.map((g, i) => (
        <div key={i}>
          <h4>{g.titulo}</h4>
          {g.texto && <p>{g.texto}</p>}
          {g.lista?.length ? <ul>{g.lista.map((l, j) => <li key={j}>{l}</li>)}</ul> : null}
        </div>
      ))}
      {c.ferramentasLista?.map((f, i) => (
        <div key={`f${i}`}>
          <h4>{f.categoria}</h4>
          <ul>
            {f.itens.map((x, j) => (
              <li key={j}>
                {x.texto}
                {x.itens.length ? <small> (itens {x.itens.join(', ')})</small> : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {c.tabelas?.map((t, i) => (
        <div key={`t${i}`}>
          <h4>{t.titulo}</h4>
          <ul>{t.linhas.map((l, j) => <li key={j}><b>{l.rotulo}:</b> {l.texto}</li>)}</ul>
        </div>
      ))}
    </details>
  )
}
