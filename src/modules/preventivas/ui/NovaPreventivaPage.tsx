import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { turnoDe, type Turno } from '../../../domain/turno'
import { Opcoes } from '../../relatorio/ui/campos/Campo'
import { salvarRascunho } from '../data/local'
import type { ModeloChecklist } from '../domain/modelo'
import { novaPreventiva } from '../domain/preventiva'
import { hojeISO, useModelos } from './useModelos'

export function NovaPreventivaPage() {
  const { modelos, carregando, semRede } = useModelos()
  const navigate = useNavigate()
  const [sistema, setSistema] = useState<string | null>(null)
  const [data, setData] = useState(hojeISO)
  const [turno, setTurno] = useState<Turno>(() => turnoDe(new Date()))

  const ativos = modelos.filter((m) => m.ativo)
  const sistemas = [...new Map(ativos.map((m) => [m.sistema, m])).values()]
  const doSistema = ativos.filter((m) => m.sistema === sistema)

  async function comecar(m: ModeloChecklist) {
    const r = novaPreventiva(m, data, turno)
    await salvarRascunho(r)
    navigate(`/preventivas/${r.id}`, { replace: true })
  }

  if (carregando) return <p className="center">Carregando checklists…</p>
  if (!ativos.length)
    return (
      <p className="aviso">
        {semRede ? 'Sem internet e nenhum checklist guardado neste aparelho. Abra esta tela com internet uma vez.' : 'Nenhum checklist cadastrado ainda. Peça ao admin para importar os checklists.'}
      </p>
    )

  return (
    <div className="pagina-prev">
      <h2>Nova preventiva</h2>
      <section className="card">
        <div className="row">
          <label className="campo">
            <span>Data</span>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </label>
          <div className="campo">
            <span>Turno</span>
            <Opcoes opcoes={['Noturno', 'Diurno'] as const} valor={turno} obrigatoria onChange={(v) => v && setTurno(v)} />
          </div>
        </div>
      </section>
      <h3 className="sec-titulo">1. Sistema</h3>
      <div className="grade-sistemas">
        {sistemas.map((m) => (
          <button type="button" key={m.sistema} className={`sistema ${sistema === m.sistema ? 'on' : ''}`} aria-pressed={sistema === m.sistema} onClick={() => setSistema(m.sistema)}>
            <b>{m.sistemaNome}</b>
            <small>{m.sistemaDescricao}</small>
          </button>
        ))}
      </div>
      {sistema && (
        <>
          <h3 className="sec-titulo">2. Preventiva</h3>
          <div className="lista-prev">
            {doSistema.map((m) => (
              <button type="button" key={m.id} className="card prev-modelo" onClick={() => void comecar(m)}>
                <span className="cod">{m.codigo}</span>
                <span>
                  <b>{m.rotulo ?? m.periodicidade}</b>
                  <small>{m.resumo ?? `${m.conteudo.itens.length} itens`}</small>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
