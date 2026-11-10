import type { PessoaEquipe } from '../../data/remoto'
import type { DadosOS, RascunhoAtividade } from '../../domain/tipos'
import { Campo, Opcoes, Texto } from './Campo'
import { PessoaSelect } from './EquipeCampo'

/** Dados da Ordem de Serviço (FO.MNT.S.0003). Número da OS digitado à mão. */
export function OSCampo({ a, set, pessoas }: { a: RascunhoAtividade; set: (p: Partial<RascunhoAtividade>) => void; pessoas: PessoaEquipe[] }) {
  const os = a.os
  const setOS = (p: Partial<DadosOS>) => set({ os: { ...os, ...p } })
  const mats = os.materiais ?? []
  return (
    <section className="card">
      <h3>📋 Dados da OS</h3>
      <p className="hint">Usados no PDF “Ordem de Serviço” (FO.MNT.S.0003). Falha, local, sistema, tempos e equipe já vêm do que você preencheu acima.</p>
      <div className="row">
        <Campo rotulo="Nº da OS"><Texto valor={os.numero} onChange={(v) => setOS({ numero: v })} placeholder="Digite o número" /></Campo>
        <Campo rotulo="Nº do chamado Metrô"><Texto valor={os.chamado ?? a.cim} onChange={(v) => setOS({ chamado: v })} /></Campo>
      </div>
      <Campo rotulo="Código / alarme"><Texto valor={os.codigo} onChange={(v) => setOS({ codigo: v })} placeholder="Ex.: ARB, GVS" /></Campo>
      <Campo rotulo="Impacto operacional"><Opcoes opcoes={['Com impacto', 'Sem impacto'] as const} valor={os.impacto} onChange={(v) => setOS({ impacto: v ?? undefined })} /></Campo>
      <Campo rotulo="Causa da ocorrência"><Texto linhas={2} valor={os.causa} onChange={(v) => setOS({ causa: v })} /></Campo>
      <Campo rotulo="Houve substituição de componente?"><Opcoes opcoes={['Sim', 'Não'] as const} valor={os.substituicao} onChange={(v) => setOS({ substituicao: v ?? undefined })} /></Campo>
      <div className="campo">
        <span>Materiais e peças (até 7)</span>
        {mats.map((m, i) => (
          <div className="material" key={i}>
            <input type="text" placeholder="Material / peça" value={m.d} onChange={(e) => setOS({ materiais: mats.map((x, j) => (j === i ? { ...x, d: e.target.value } : x)) })} />
            <input type="text" placeholder="Qtd" value={m.q} onChange={(e) => setOS({ materiais: mats.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)) })} />
            <button type="button" className="mini perigo" aria-label="Remover" onClick={() => setOS({ materiais: mats.filter((_, j) => j !== i) })}>✕</button>
          </div>
        ))}
        {mats.length < 7 && (
          <button type="button" className="sec" onClick={() => setOS({ materiais: [...mats, { d: '', q: '' }] })}>+ Adicionar material</button>
        )}
      </div>
      <Campo rotulo="Status do reparo"><Opcoes opcoes={['Definitivo', 'Provisório', 'Não reparado'] as const} valor={os.status_reparo} onChange={(v) => setOS({ status_reparo: v ?? undefined })} /></Campo>
      <Campo rotulo="Liberação"><Opcoes opcoes={['Liberado sem restrição', 'Liberado com restrição', 'Não liberado'] as const} valor={os.liberacao} onChange={(v) => setOS({ liberacao: v ?? undefined })} /></Campo>
      <div className="row">
        <Campo rotulo="Resp. técnico (assina na OS)"><PessoaSelect pessoas={pessoas} valor={a.resp_tecnico_id} onChange={(v) => set({ resp_tecnico_id: v })} /></Campo>
        <Campo rotulo="Resp. liberação"><Texto valor={os.resp_liberacao} onChange={(v) => setOS({ resp_liberacao: v })} placeholder="Nome" /></Campo>
      </div>
      <Campo rotulo="Data/hora final"><Texto valor={os.data_hora_final} onChange={(v) => setOS({ data_hora_final: v })} placeholder="Vazio = data do dia + fim da atuação" /></Campo>
      <p className="hint">As matrículas vêm do cadastro de cada pessoa da equipe.</p>
    </section>
  )
}
