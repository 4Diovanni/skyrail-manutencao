import type { Atividade } from '../domain/tipos'

export interface PessoaDoc {
  id: string
  nome: string | null
  matricula: string | null
}

/** Tudo o que um PDF precisa, já buscado do servidor. */
export interface DadosDocumento {
  atividade: Atividade
  /** Posição da atividade na lista do turno (Nº no relatório). */
  numero: number
  equipe: PessoaDoc[]
  pessoas: PessoaDoc[]
  fotos: { bytes: Uint8Array; legenda: string | null }[]
  /** PNG das assinaturas válidas (versão atual), por "profileId:papel". */
  assinaturas: Record<string, Uint8Array>
}

export const nomeDe = (d: DadosDocumento, id: string | null | undefined) =>
  (id && (d.pessoas.find((p) => p.id === id)?.nome || d.pessoas.find((p) => p.id === id)?.matricula)) || ''

export const nomesEquipe = (d: DadosDocumento) => d.equipe.map((p) => p.nome || p.matricula || '').filter(Boolean)

export function juntarNomes(a: string[]): string {
  return a.length <= 1 ? (a[0] ?? '') : `${a.slice(0, -1).join(', ')} e ${a[a.length - 1]}`
}
