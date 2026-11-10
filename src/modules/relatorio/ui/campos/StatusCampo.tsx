import type { RascunhoAtividade, StatusAtividade } from '../../domain/tipos'
import { Campo, Opcoes, Texto } from './Campo'

const STATUS: readonly StatusAtividade[] = ['Concluída', 'Em andamento', 'Não realizada']

export function StatusCampo({ a, set }: { a: RascunhoAtividade; set: (p: Partial<RascunhoAtividade>) => void }) {
  const precisaMotivo = a.status === 'Não realizada' || a.reprog_pedido
  return (
    <>
      <Campo rotulo="Status da atividade" obrigatorio>
        <Opcoes opcoes={STATUS} valor={a.status} obrigatoria onChange={(v) => v && set({ status: v, ...(v === 'Concluída' ? { reprog_pedido: false, reprog_data: null } : {}) })} />
      </Campo>
      {a.status !== 'Concluída' && (
        <label className="reprog">
          <input type="checkbox" checked={a.reprog_pedido} onChange={(e) => set({ reprog_pedido: e.target.checked })} />
          <span>
            <b>Pedir reprogramação desta atividade</b>
            <small>Vai para aprovação de um admin e aparece na passagem de turno.</small>
          </span>
        </label>
      )}
      {a.reprog_pedido && (
        <Campo rotulo="Nova data sugerida (opcional)">
          <input type="date" value={a.reprog_data ?? ''} onChange={(e) => set({ reprog_data: e.target.value || null })} />
        </Campo>
      )}
      {precisaMotivo && (
        <Campo rotulo={a.reprog_pedido ? 'Motivo do pedido de reprogramação' : 'Motivo da não realização'} obrigatorio>
          <Texto linhas={3} valor={a.motivo} onChange={(v) => set({ motivo: v })} placeholder="Ex.: Sem liberação do CCO; falta de material…" />
        </Campo>
      )}
    </>
  )
}
