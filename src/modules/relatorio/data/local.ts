import Dexie, { type EntityTable } from 'dexie'
import type { RascunhoAtividade } from '../domain/tipos'

/** rascunho: só no aparelho · fila: tocou em Enviar, aguardando rede · erro: o servidor recusou */
export type EstadoLocal = 'rascunho' | 'fila' | 'erro'

export interface RascunhoLocal {
  id: string
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
  }
}

export const localDb = new RelatorioDb()

export async function salvarRascunho(dados: RascunhoAtividade, estado: EstadoLocal = 'rascunho') {
  await localDb.rascunhos.put({ id: dados.id, data: dados.data, estado, atualizadoEm: new Date().toISOString(), dados })
}

export async function descartarRascunho(id: string) {
  await localDb.transaction('rw', localDb.rascunhos, localDb.fotos, async () => {
    await localDb.rascunhos.delete(id)
    await localDb.fotos.where('atividadeId').equals(id).delete()
  })
}
