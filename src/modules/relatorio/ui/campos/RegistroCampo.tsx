import type { PessoaEquipe } from '../../data/remoto'
import type { RascunhoAtividade } from '../../domain/tipos'
import { Campo, Texto } from './Campo'
import { PessoaSelect } from './EquipeCampo'

/** Dados do Registro de Manutenção (FO.MNT.S.0008) da preventiva. */
export function RegistroCampo({ a, set, pessoas }: { a: RascunhoAtividade; set: (p: Partial<RascunhoAtividade>) => void; pessoas: PessoaEquipe[] }) {
  return (
    <section className="card">
      <h3>📋 Dados do Registro de Manutenção</h3>
      <p className="hint">Usados no PDF “Registro de Manutenção” (FO.MNT.S.0008). Data, local, sistema, equipamento, nível e técnicos já vêm do que você preencheu acima.</p>
      <div className="row">
        <Campo rotulo="Aprovação – técnico"><PessoaSelect pessoas={pessoas} valor={a.resp_tecnico_id} onChange={(v) => set({ resp_tecnico_id: v })} /></Campo>
        <Campo rotulo="Líder de manutenção"><PessoaSelect pessoas={pessoas} valor={a.lider_id} onChange={(v) => set({ lider_id: v })} /></Campo>
      </div>
      <Campo rotulo="Gestor"><PessoaSelect pessoas={pessoas} valor={a.gestor_id} onChange={(v) => set({ gestor_id: v })} /></Campo>
      <Campo rotulo="Observações"><Texto linhas={3} valor={a.registro.obs} onChange={(v) => set({ registro: { ...a.registro, obs: v } })} /></Campo>
    </section>
  )
}
