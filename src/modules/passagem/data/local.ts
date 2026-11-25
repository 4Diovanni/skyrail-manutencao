import Dexie, { type EntityTable } from 'dexie'
import { donoLocal, ehDoDono, semDono } from '../../../lib/donoLocal'
import type { Turno } from '../../../domain/turno'
import type { RascunhoPassagem } from '../domain/tipos'

/** rascunho: só no aparelho · fila: tocou em Enviar, aguardando rede · erro: o servidor recusou */
export type EstadoLocal = 'rascunho' | 'fila' | 'erro'

export interface PassagemLocal {
  /** "<userId>|<data>|<turno>": uma passagem por turno e por pessoa no aparelho. */
  chave: string
  /** Quem fez o rascunho neste aparelho (ver lib/donoLocal). */
  userId?: string
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
    this.version(2).stores({ rascunhos: 'chave, estado, userId' })
  }
}

export const passDb = new PassagemDb()
export const chavePassagem = (data: string, turno: Turno) => `${data}|${turno}`
/** Chave no aparelho: a mesma passagem de turno pode ter rascunhos de pessoas diferentes. */
export const chaveLocal = (userId: string, data: string, turno: Turno) => `${userId}|${chavePassagem(data, turno)}`

function exigirDono(): string {
  const userId = donoLocal()
  if (!userId) throw new Error('Sem usuário logado: a passagem não foi salva.')
  return userId
}

export async function salvarLocal(dados: RascunhoPassagem, estado: EstadoLocal = 'rascunho', erro?: string) {
  const userId = exigirDono()
  await passDb.rascunhos.put({ chave: chaveLocal(userId, dados.data, dados.turno), userId, estado, erro, atualizadoEm: new Date().toISOString(), dados })
}

/** Rascunho deste turno, da pessoa logada (null se não houver). */
export async function minhaPassagem(data: string, turno: Turno): Promise<PassagemLocal | null> {
  const userId = donoLocal()
  if (!userId) return null
  return (await passDb.rascunhos.get(chaveLocal(userId, data, turno))) ?? null
}

export const descartarLocal = (data: string, turno: Turno) => passDb.rascunhos.delete(chaveLocal(exigirDono(), data, turno))

/** Fila (enviar ou com erro) da pessoa logada. */
export function minhaFila() {
  return passDb.rascunhos.where('estado').anyOf('fila', 'erro').filter((r) => ehDoDono(r))
}

/** Rascunhos de antes desta separação (chave "<data>|<turno>", sem dono) passam para quem entrou. */
export async function adotarSemDono(userId: string) {
  await passDb.transaction('rw', passDb.rascunhos, async () => {
    const antigos = await passDb.rascunhos.filter(semDono).toArray()
    for (const r of antigos) {
      await passDb.rascunhos.delete(r.chave)
      await passDb.rascunhos.put({ ...r, userId, chave: chaveLocal(userId, r.dados.data, r.dados.turno) })
    }
  })
}
