import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthContext'
import { assinar, temAssinatura } from '../data/assinaturas'
import { papeisDe } from '../domain/assinatura'
import type { Atividade } from '../domain/tipos'
import { camposFaltando } from '../domain/validacao'
import { atividadeParaRascunho } from '../domain/rascunho'
import { importarModulo } from '../../../lib/versaoNova'
import { avisar } from '../../../lib/avisos'

/** Botões de uma atividade já enviada: PDF, OS/Registro e Assinar. */
export function AcoesAtividade({ a, numero }: { a: Atividade & { equipe: string[] }; numero: number }) {
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const [ocupado, setOcupado] = useState<string | null>(null)
  const papeis = perfil ? papeisDe(a, a.equipe, perfil.id) : []
  const prev = a.categoria === 'Preventiva'

  async function pdf(tipo: 'relatorio' | 'os' | 'rm') {
    const falta = camposFaltando(atividadeParaRascunho(a, a.equipe))
    if (falta.length) {
      avisar('erro', `O PDF não foi gerado. Falta: ${falta.join('; ')}. Toque na atividade para completar e envie de novo.`)
      return
    }
    setOcupado('Gerando PDF…')
    try {
      const { gerarEGuardar, entregarPdf } = await importarModulo(() => import('../pdf/servico'))
      const r = await gerarEGuardar(a.id, tipo, numero)
      setOcupado(null)
      if (!r.guardado) avisar('fila', 'O PDF foi gerado, mas não foi possível guardar no servidor. Ele foi entregue só neste aparelho.')
      await entregarPdf(r.blob, r.nome)
    } catch (e) {
      avisar('erro', `Erro ao gerar o PDF: ${(e as Error).message}`)
    } finally {
      setOcupado(null)
    }
  }

  async function aplicarAssinatura() {
    if (!perfil) return
    setOcupado('Assinando…')
    try {
      if (!(await temAssinatura(perfil.id))) {
        if (confirm('Você ainda não cadastrou a sua assinatura. Cadastrar agora?')) navigate('/perfil/assinatura')
        return
      }
      if (!confirm(`Confirmar a sua assinatura nesta versão da atividade “${a.titulo}”?`)) return
      await assinar(a.id, papeis)
      avisar('ok', 'Assinatura aplicada. Ela aparece nos próximos PDFs desta versão.')
    } catch (e) {
      avisar('erro', `Não foi possível assinar: ${(e as Error).message}`)
    } finally {
      setOcupado(null)
    }
  }

  if (ocupado) return <span className="hint">{ocupado}</span>
  return (
    <div className="acoes-atividade">
      <button type="button" className="mini" onClick={() => void pdf('relatorio')}>PDF</button>
      <button type="button" className="mini" onClick={() => void pdf(prev ? 'rm' : 'os')}>{prev ? 'Registro' : 'OS'}</button>
      {papeis.length > 0 && (
        <button type="button" className="mini" onClick={() => void aplicarAssinatura()}>Assinar</button>
      )}
    </div>
  )
}
