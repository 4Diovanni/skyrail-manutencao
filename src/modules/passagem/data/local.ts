import Dexie, { type EntityTable } from 'dexie'
import type { Turno } from '../../../domain/turno'
import type { RascunhoPassagem } from '../domain/tipos'

/** rascunho: só no aparelho · fila: tocou em Enviar, aguardando rede · erro: o servidor recusou */
export type EstadoLocal = 'rascunho' | 'fila' | 'erro'

export interface PassagemLocal {
  /** "<data>|<turno>": uma passagem por turno também no aparelho. */
  chave: string
  estado: EstadoLocal
  erro?: string
  atualizadoEm: string
  dados: RascunhoPassagem
}

class PassagemDb extends Dexie {
  rascunhos!: EntityTable<PassagemLocal, 'chave'>
  constructor() {
    super('skyrail-passagem')
    this.version(1).stores({ rascunhos: 'chave, estado' })
  }
}

export const passDb = new PassagemDb()
export const chavePassagem = (data: string, turno: Turno) => `${data}|${turno}`

export async function salvarLocal(dados: RascunhoPassagem, estado: EstadoLocal = 'rascunho', erro?: string) {
  await passDb.rascunhos.put({ chave: chavePassagem(dados.data, dados.turno), estado, erro, atualizadoEm: new Date().toISOString(), dados })
}

export const descartarLocal = (data: string, turno: Turno) => passDb.rascunhos.delete(chavePassagem(data, turno))
