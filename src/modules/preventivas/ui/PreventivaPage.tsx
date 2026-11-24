import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { avisar } from '../../../lib/avisos'
import { sincronizarAgora } from '../../../lib/sync'
import { Campo, Opcoes, Texto } from '../../relatorio/ui/campos/Campo'
import { EquipeCampo, PessoaSelect } from '../../relatorio/ui/campos/EquipeCampo'
import { TemposCampo } from '../../relatorio/ui/campos/TemposCampo'
import { useReferencias } from '../../relatorio/ui/useReferencias'
import { processarFila } from '../data/envio'
import { descartarRascunho, prevDb, salvarRascunho } from '../data/local'
import { buscarPreventiva } from '../data/remoto'
import { errosEnvio, preventivaParaRascunho, type RascunhoPreventiva } from '../domain/preventiva'
import type { Respostas } from '../domain/respostas'
import { ChecklistCampo } from './ChecklistCampo'
import { DiasCampo, GuiaCampo, InstrumentosCampo, OcorrenciasCampo, SituacaoCampo } from './campos'
import { dataBR, useModelos } from './useModelos'

/** Abre o rascunho do aparelho; se não houver, parte da versão enviada ao servidor. */
async function carregar(id: string): Promise<RascunhoPreventiva | null> {
  const local = await prevDb.rascunhos.get(id)
  if (local) return local.dados
  const remoto = await buscarPreventiva(id)
  if (!remoto) return null
  await prevDb.fotos.bulkPut(
    remoto.fotos.map((f) => ({
      id: f.id,
      preventivaId: id,
      ocorrenciaId: f.ocorrencia_id ?? '',
      ordem: f.ordem,
      legenda: f.legenda ?? '',
      storagePath: f.storage_path,
    })),
  )
  return preventivaParaRascunho(remoto.preventiva, remoto.equipe)
}

export function PreventivaPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const ref = useReferencias()
  useModelos()
  const [p, setP] = useState<RascunhoPreventiva | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const modelo = useLiveQuery(() => (p ? prevDb.modelos.get(p.modelo_id) : undefined), [p?.modelo_id])

  useEffect(() => {
    carregar(id)
      .then((r) => (r ? setP(r) : setErro('Preventiva não encontrada.')))
      .catch(() => setErro('Não foi possível abrir a preventiva. Verifique a internet.'))
  }, [id])

  const salvarDepois = useCallback((r: RascunhoPreventiva) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void salvarRascunho(r), 400)
  }, [])

  const set = useCallback(
    (m: Partial<RascunhoPreventiva>) => {
      setP((atual) => {
        if (!atual) return atual
        const novo = { ...atual, ...m }
        salvarDepois(novo)
        return novo
      })
    },
    [salvarDepois],
  )
  const setRespostas = useCallback((r: Respostas) => set({ respostas: r }), [set])

  if (erro) return <p role="alert" className="error">{erro}</p>
  if (!p) return <p className="center">Carregando…</p>
  if (!modelo) return <p className="center">Carregando o checklist… (na primeira vez é preciso internet)</p>

  const c = modelo.conteudo
  const opcoesLocal = c.local.opcoes?.length ? c.local.opcoes : ref.locais

  function novaOcorrencia(item: string, unidade?: string) {
    if (!p) return
    const oc = { id: crypto.randomUUID(), item, unidade: unidade ?? null, texto: p.respostas[unidade ? `${item}@${unidade}` : item]?.obs ?? '' }
    set({ ocorrencias: [...p.ocorrencias, oc] })
    window.setTimeout(() => document.getElementById(`oc-${oc.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
  }

  async function enviar() {
    if (!p) return
    const erros = errosEnvio(p, modelo)
    if (erros.length) {
      avisar('erro', `Falta preencher: ${erros.join('; ')}`)
      return
    }
    setEnviando(true)
    window.clearTimeout(timer.current)
    await salvarRascunho(p, 'fila')
    const r = await processarFila()
    await sincronizarAgora()
    setEnviando(false)
    if (r.enviados) avisar('ok', 'Preventiva enviada.')
    else if (!navigator.onLine) avisar('fila', 'Sem internet: a preventiva ficou na fila e será enviada quando a conexão voltar.')
    else {
      const item = await prevDb.rascunhos.get(p.id)
      avisar('erro', `O servidor recusou o envio: ${item?.erro ?? 'erro desconhecido'}. A preventiva ficou salva no aparelho.`)
    }
    navigate('/preventivas')
  }

  async function descartar() {
    if (!p) return
    const msg = p.versaoBase == null ? 'Apagar esta preventiva? Ela ainda não foi enviada.' : 'Descartar as alterações feitas neste aparelho?'
    if (!confirm(msg)) return
    await descartarRascunho(p.id)
    navigate('/preventivas')
  }

  return (
    <div className="form-atividade form-prev">
      <h2>
        {modelo.sistemaNome} {modelo.codigo} · {dataBR(p.data)}
      </h2>
      <p className="hint">
        {c.titulo}
        {modelo.formulario ? ` · ${modelo.formulario}` : ''}
      </p>

      <GuiaCampo c={c} />

      <section className="card">
        <h3>Identificação</h3>
        <div className="campo">
          <span>
            {c.local.rotulo} <b className="req">*</b>
          </span>
          {opcoesLocal.length > 0 && <Opcoes opcoes={opcoesLocal} valor={p.local} onChange={(v) => set({ local: v })} />}
          <input type="text" value={p.local ?? ''} placeholder={opcoesLocal.length ? 'Ou digite' : c.local.rotulo} onChange={(e) => set({ local: e.target.value })} />
        </div>
        {c.camposExtras?.map((ce) => (
          <div className="campo" key={ce.id}>
            <span>{ce.rotulo}</span>
            {ce.opcoes?.length ? <Opcoes opcoes={ce.opcoes} valor={p.campos[ce.id] ?? null} onChange={(v) => set({ campos: { ...p.campos, [ce.id]: v ?? '' } })} /> : null}
            <input type="text" value={p.campos[ce.id] ?? ''} onChange={(e) => set({ campos: { ...p.campos, [ce.id]: e.target.value } })} />
          </div>
        ))}
        <div className="row">
          <Campo rotulo="Ordem de serviço">
            <Texto valor={p.os_numero} onChange={(v) => set({ os_numero: v })} placeholder="Nº da OS" />
          </Campo>
          <div className="campo">
            <span>Turno</span>
            <Opcoes opcoes={['Noturno', 'Diurno'] as const} valor={p.turno} obrigatoria onChange={(v) => v && set({ turno: v })} />
          </div>
        </div>
        <div className="campo">
          <span>
            Equipe <b className="req">*</b>
          </span>
          <EquipeCampo pessoas={ref.pessoas} valor={p.equipe} onChange={(v) => set({ equipe: v })} />
        </div>
        <label className="campo">
          <span>Supervisor</span>
          <PessoaSelect pessoas={ref.pessoas} valor={p.supervisor_id} onChange={(v) => set({ supervisor_id: v })} />
        </label>
        <div className="campo">
          <span>Equipamentos utilizados</span>
          <InstrumentosCampo valor={p.instrumentos} onChange={(v) => set({ instrumentos: v })} />
        </div>
      </section>

      <ChecklistCampo c={c} respostas={p.respostas} onChange={setRespostas} onOcorrencia={novaOcorrencia} />

      <section className="card">
        <h3>Ocorrências e fotos</h3>
        <OcorrenciasCampo p={p} c={c} onChange={(v) => set({ ocorrencias: v })} onFotos={() => salvarDepois(p)} />
      </section>

      <section className="card">
        <h3>Tempos da atuação</h3>
        <TemposCampo valor={p.tempos} onChange={(t) => set({ tempos: t })} />
        <DiasCampo valor={p.dias} primeiro={p.data} onChange={(v) => set({ dias: v })} />
      </section>

      <section className="card">
        <h3>Situação</h3>
        <SituacaoCampo p={p} set={set} />
        <Campo rotulo="Observações gerais (opcional)">
          <Texto linhas={3} valor={p.observacoes} onChange={(v) => set({ observacoes: v })} />
        </Campo>
      </section>

      <div className="barra">
        <button type="button" className="sec" onClick={() => void descartar()}>
          {p.versaoBase == null ? 'Apagar' : 'Descartar alterações'}
        </button>
        <button type="button" disabled={enviando} onClick={() => void enviar()}>
          {enviando ? 'Enviando…' : 'Enviar'}
        </button>
      </div>
      <p className="hint center">Tudo fica salvo neste aparelho enquanto você preenche. Só vai para o servidor ao tocar em Enviar.</p>
    </div>
  )
}
