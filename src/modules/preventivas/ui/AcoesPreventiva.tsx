import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthContext'
import { temAssinatura } from '../../relatorio/data/assinaturas'
import { papeisDe } from '../../relatorio/domain/assinatura'
import { assinarPreventiva } from '../data/assinaturas'
import type { Preventiva } from '../domain/preventiva'
import type { TipoDocPrev } from '../pdf/caminho'
import { importarModulo } from '../../../lib/versaoNova'

const BOTOES: [TipoDocPrev, string][] = [
  ['relatorio', 'Relatório'],
  ['roteiro', 'Roteiro'],
  ['rm', 'Registro'],
]

/** Ações de uma preventiva já enviada: gerar os três PDFs e assinar (só a própria pessoa). */
export function AcoesPreventiva({ p, nome }: { p: Preventiva & { equipe: string[] }; nome: string }) {
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const [ocupado, setOcupado] = useState<string | null>(null)
  const papeis = perfil ? papeisDe(p, p.equipe, perfil.id) : []

  async function pdf(tipo: TipoDocPrev) {
    setOcupado('Gerando PDF…')
    try {
      const { gerarEGuardarPreventiva } = await importarModulo(() => import('../pdf/servico'))
      const { entregarPdf } = await importarModulo(() => import('../../relatorio/pdf/servico'))
      const r = await gerarEGuardarPreventiva(p.id, tipo)
      setOcupado(null)
      if (!r.guardado) alert('O PDF foi gerado, mas não foi possível guardar no servidor. Ele será entregue só neste aparelho.')
      await entregarPdf(r.blob, r.nome)
    } catch (e) {
      alert(`Erro ao gerar o PDF: ${(e as Error).message}`)
    } finally {
      setOcupado(null)
    }
  }

  async function assinar() {
    if (!perfil) return
    setOcupado('Assinando…')
    try {
      if (!(await temAssinatura(perfil.id))) {
        if (confirm('Você ainda não cadastrou a sua assinatura. Cadastrar agora?')) navigate('/perfil/assinatura')
        return
      }
      if (!confirm(`Confirmar a sua assinatura nesta versão da preventiva “${nome}”?`)) return
      await assinarPreventiva(p.id, papeis)
      alert('Assinatura aplicada. Ela aparece nos próximos PDFs desta versão.')
    } catch (e) {
      alert(`Não foi possível assinar: ${(e as Error).message}`)
    } finally {
      setOcupado(null)
    }
  }

  if (ocupado) return <p className="hint acoes-prev-status" role="status">{ocupado}</p>
  return (
    <div className="acoes-prev">
      {BOTOES.map(([tipo, rotulo]) => (
        <button key={tipo} type="button" className="secundario" onClick={() => void pdf(tipo)}>
          {rotulo}
        </button>
      ))}
      {papeis.length > 0 && (
        <button type="button" onClick={() => void assinar()}>
          Assinar
        </button>
      )}
    </div>
  )
}
