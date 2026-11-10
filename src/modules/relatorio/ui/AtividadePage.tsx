import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { sincronizarAgora } from '../../../lib/sync'
import { processarFila } from '../data/envio'
import { descartarRascunho, localDb, salvarRascunho } from '../data/local'
import { buscarAtividade } from '../data/remoto'
import { atividadeParaRascunho, novoRascunho } from '../domain/rascunho'
import { TIPOS_PREV, type Categoria, type RascunhoAtividade } from '../domain/tipos'
import { errosEnvio } from '../domain/validacao'
import { Campo, Opcoes, Texto } from './campos/Campo'
import { EquipeCampo } from './campos/EquipeCampo'
import { FotosCampo } from './campos/FotosCampo'
import { MultiChips } from './campos/MultiChips'
import { OSCampo } from './campos/OSCampo'
import { RegistroCampo } from './campos/RegistroCampo'
import { StatusCampo } from './campos/StatusCampo'
import { TemposCampo } from './campos/TemposCampo'
import { useReferencias } from './useReferencias'

/** Carrega o rascunho local; se não houver, parte da versão do servidor; senão, cria um novo. */
async function carregar(id: string | undefined, data: string, categoria: Categoria, ordem: number): Promise<RascunhoAtividade> {
  if (id) {
    const local = await localDb.rascunhos.get(id)
    if (local) return local.dados
    const remoto = await buscarAtividade(id)
    if (remoto) {
      await localDb.fotos.bulkPut(
        remoto.fotos.map((f) => ({ id: f.id, atividadeId: id, ordem: f.ordem, legenda: f.legenda ?? '', storagePath: f.storage_path })),
      )
      return atividadeParaRascunho(remoto.atividade, remoto.equipe)
    }
  }
  return novoRascunho(data, categoria, ordem)
}

export function AtividadePage() {
  const { id } = useParams()
  const [qs] = useSearchParams()
  const navigate = useNavigate()
  const ref = useReferencias()
  const [a, setA] = useState<RascunhoAtividade | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  const data = qs.get('data') ?? new Date().toISOString().slice(0, 10)
  const categoria = (qs.get('cat') as Categoria) ?? 'Corretiva'
  const ordem = Number(qs.get('ordem') ?? '1')

  useEffect(() => {
    carregar(id, data, categoria, ordem)
      .then((r) => {
        setA(r)
        // Atividade nova: grava o rascunho e troca a URL, para retomar se a página recarregar.
        if (!id) {
          void salvarRascunho(r)
          navigate(`/relatorio/atividade/${r.id}?data=${r.data}&cat=${r.categoria}`, { replace: true })
        }
      })
      .catch(() => setErro('Não foi possível abrir a atividade. Verifique a internet.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Salva o rascunho no aparelho a cada alteração (sem enviar ao servidor).
  const salvarDepois = useCallback((r: RascunhoAtividade) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void salvarRascunho(r), 400)
  }, [])

  const set = useCallback(
    (p: Partial<RascunhoAtividade>) => {
      setA((atual) => {
        if (!atual) return atual
        const novo = { ...atual, ...p }
        salvarDepois(novo)
        return novo
      })
    },
    [salvarDepois],
  )

  if (erro) return <p role="alert" className="error">{erro}</p>
  if (!a) return <p className="center">Carregando…</p>

  async function enviar() {
    if (!a) return
    const erros = errosEnvio(a)
    if (erros.length) {
      alert(erros.join('\n'))
      return
    }
    setEnviando(true)
    window.clearTimeout(timer.current)
    await salvarRascunho(a, 'fila')
    const r = await processarFila()
    await sincronizarAgora()
    setEnviando(false)
    if (r.enviados) alert('Atividade enviada.')
    else if (!navigator.onLine) alert('Sem internet: a atividade ficou na fila e será enviada quando a conexão voltar.')
    else {
      const item = await localDb.rascunhos.get(a.id)
      alert(`O servidor recusou o envio: ${item?.erro ?? 'erro desconhecido'}. A atividade ficou salva no aparelho.`)
    }
    navigate(`/relatorio?data=${a.data}&cat=${a.categoria}`)
  }

  async function descartar() {
    if (!a) return
    if (!confirm('Descartar as alterações feitas neste aparelho?')) return
    await descartarRascunho(a.id)
    navigate(`/relatorio?data=${a.data}&cat=${a.categoria}`)
  }

  const prev = a.categoria === 'Preventiva'
  const novo = a.versaoBase == null

  return (
    <div className="form-atividade">
      <h2>
        {novo ? (prev ? 'Nova preventiva' : 'Nova corretiva') : 'Editar atividade'} · {a.data.split('-').reverse().join('/')}
      </h2>
      <section className="card">
        <Campo rotulo="Título da atividade" obrigatorio>
          <Texto valor={a.titulo} onChange={(v) => set({ titulo: v })} placeholder={prev ? 'Ex.: Preventiva P1 – AMV X24.1' : 'Ex.: Falha no reset do contador de eixos 708'} />
        </Campo>
        <StatusCampo a={a} set={set} />
        {prev && (
          <Campo rotulo="Tipo de preventiva" obrigatorio>
            <Opcoes opcoes={TIPOS_PREV} valor={a.tipo_prev} obrigatoria onChange={(v) => set({ tipo_prev: v })} />
          </Campo>
        )}
        <Campo rotulo="Turno">
          <Opcoes opcoes={['Noturno', 'Diurno'] as const} valor={a.turno} obrigatoria onChange={(v) => v && set({ turno: v })} />
        </Campo>
        <div className="campo">
          <span>Equipe da atividade</span>
          <EquipeCampo pessoas={ref.pessoas} valor={a.equipe} onChange={(v) => set({ equipe: v })} />
        </div>
        {!prev && (
          <div className="row">
            <Campo rotulo="Nº do CIM"><Texto valor={a.cim} onChange={(v) => set({ cim: v })} placeholder="Nº ou N/A" /></Campo>
            <Campo rotulo="Hora do informe"><input type="time" value={a.hora_informe ?? ''} onChange={(e) => set({ hora_informe: e.target.value || null })} /></Campo>
          </div>
        )}
        <div className="campo"><span>Local</span><MultiChips itens={ref.locais} valor={a.local} onChange={(v) => set({ local: v })} /></div>
        <div className="campo"><span>Sistema</span><MultiChips itens={ref.sistemas} valor={a.sistema} onChange={(v) => set({ sistema: v })} /></div>
        <Campo rotulo="Equipamento"><Texto valor={a.equipamento} onChange={(v) => set({ equipamento: v })} placeholder={prev ? 'Ex.: AMV X24.1 e X24.2' : 'Ex.: ZC – Série A'} /></Campo>
        {prev ? (
          <>
            <Campo rotulo="O que foi feito"><Texto linhas={5} valor={a.feito} onChange={(v) => set({ feito: v })} placeholder="Cada linha vira um parágrafo no relatório." /></Campo>
            <Campo rotulo="Não conformidades / pendências (opcional)"><Texto linhas={3} valor={a.nao_conformidades} onChange={(v) => set({ nao_conformidades: v })} placeholder="Uma por linha." /></Campo>
          </>
        ) : (
          <>
            <Campo rotulo="Sintoma"><Texto valor={a.sintoma} onChange={(v) => set({ sintoma: v })} placeholder="Ex.: Ausência de comunicação com o SCT" /></Campo>
            <Campo rotulo="Diagnóstico"><Texto linhas={3} valor={a.diagnostico} onChange={(v) => set({ diagnostico: v })} placeholder="O que a equipe verificou e identificou." /></Campo>
            <Campo rotulo="Intervenção"><Texto linhas={3} valor={a.intervencao} onChange={(v) => set({ intervencao: v })} placeholder="Ex.: Realizado reset no ZC-B" /></Campo>
          </>
        )}
      </section>
      {prev ? <RegistroCampo a={a} set={set} pessoas={ref.pessoas} /> : <OSCampo a={a} set={set} pessoas={ref.pessoas} />}
      <section className="card">
        <h3>Tempos da atuação</h3>
        <TemposCampo valor={a.tempos} onChange={(t) => set({ tempos: t })} />
      </section>
      <section className="card">
        <h3>Registro fotográfico</h3>
        <p className="hint">As fotos são comprimidas no aparelho. A legenda aparece embaixo de cada foto no PDF.</p>
        <FotosCampo atividadeId={a.id} onMudou={() => salvarDepois(a)} />
      </section>
      <div className="barra">
        <button type="button" className="sec" onClick={() => void descartar()}>Descartar alterações</button>
        <button type="button" disabled={enviando} onClick={() => void enviar()}>{enviando ? 'Enviando…' : 'Enviar'}</button>
      </div>
      <p className="hint center">Tudo fica salvo neste aparelho enquanto você preenche. Só vai para o servidor ao tocar em Enviar.</p>
    </div>
  )
}
