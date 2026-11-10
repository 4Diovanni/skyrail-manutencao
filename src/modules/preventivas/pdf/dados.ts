import type { PessoaEquipe } from '../../relatorio/data/remoto'
import type { ModeloChecklist } from '../domain/modelo'
import type { Preventiva } from '../domain/preventiva'

export interface FotoPdf {
  bytes: Uint8Array
  legenda: string | null
  ocorrenciaId: string | null
}

/** Tudo o que os PDFs da preventiva precisam, já baixado do servidor. */
export interface DadosPreventivaPdf {
  preventiva: Preventiva
  modelo: ModeloChecklist
  equipe: PessoaEquipe[]
  pessoas: PessoaEquipe[]
  fotos: FotoPdf[]
  /** PNG por "<profile_id>:<papel>", só de quem assinou a versão atual. */
  assinaturas: Record<string, Uint8Array>
}

export const nomeDe = (d: DadosPreventivaPdf, id: string | null | undefined) => {
  if (!id) return ''
  const p = d.pessoas.find((x) => x.id === id)
  return p?.nome || p?.matricula || ''
}
