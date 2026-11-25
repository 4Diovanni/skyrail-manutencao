import Dexie, { type EntityTable } from 'dexie'
import { donoLocal, ehDoDono, semDono } from '../../../lib/donoLocal'
import type { RascunhoAtividade } from '../domain/tipos'

/** rascunho: só no aparelho · fila: tocou em Enviar, aguardando rede · erro: o servidor recusou */
export type EstadoLocal = 'rascunho' | 'fila' | 'erro'

export interface RascunhoLocal {
  id: string
  /** Quem fez o rascunho neste aparelho (ver lib/donoLocal). */
  userId?: string
  data: string
  estado: EstadoLocal
  erro?: string
  atualizadoEm: string
  dados: RascunhoAtividade
}

export interface FotoLocal {
  id: string
  atividadeId: string
  ordem: number
  legenda: string
  /** Foto nova ainda não enviada. */
  blob?: Blob
  /** Caminho no Storage, quando já está no servidor. */
  storagePath?: string
  removida?: boolean
}

/** Cópia local de listas (pessoas, locais, sistemas) para usar sem internet. */
export interface CacheLocal {
  chave: string
  valor: unknown
}

class RelatorioDb extends Dexie {
  rascunhos!: EntityTable<RascunhoLocal, 'id'>
  fotos!: EntityTable<FotoLocal, 'id'>
  cache!: EntityTable<CacheLocal, 'chave'>

  constructor() {
    super('skyrail-relatorio')
    this.version(1).stores({ rascunhos: 'id, data, estado', fotos: 'id, atividadeId', cache: 'chave' })
    this.version(2).stores({ rascunhos: 'id, data, estado, userId' })
  }
}

export const localDb = new RelatorioDb()

export async function salvarRascunho(dados: RascunhoAtividade, estado: EstadoLocal = 'rascunho') {
  const userId = donoLocal()
  if (!userId) throw new Error('Sem usuário logado: o rascunho não foi salvo.')
  await localDb.rascunhos.put({ id: dados.id, userId, data: dados.data, estado, atualizadoEm: new Date().toISOString(), dados })
}

/** Rascunho deste id, só se for da pessoa logada. */
export async function meuRascunho(id: string): Promise<RascunhoLocal | undefined> {
  const r = await localDb.rascunhos.get(id)
  return r && ehDoDono(r) ? r : undefined
}

/** Rascunhos da pessoa logada (opcionalmente de um dia). */
export function meusRascunhos(data?: string) {
  const col = data ? localDb.rascunhos.where('data').equals(data) : localDb.rascunhos.toCollection()
  return col.filter((r) => ehDoDono(r))
}

/** Fila (enviar ou com erro) da pessoa logada. */
export function minhaFila() {
  return localDb.rascunhos.where('estado').anyOf('fila', 'erro').filter((r) => ehDoDono(r))
}

export async function adotarSemDono(userId: string) {
  await localDb.rascunhos.filter(semDono).modify({ userId })
}

export async function descartarRascunho(id: string) {
  await localDb.transaction('rw', localDb.rascunhos, localDb.fotos, async () => {
    await localDb.rascunhos.delete(id)
    await localDb.fotos.where('atividadeId').equals(id).delete()
  })
}
