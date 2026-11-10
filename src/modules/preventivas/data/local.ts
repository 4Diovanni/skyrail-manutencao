import Dexie, { type EntityTable } from 'dexie'
import type { FotoBase } from '../../../components/FotosLista'
import type { ModeloChecklist } from '../domain/modelo'
import type { RascunhoPreventiva } from '../domain/preventiva'

/** rascunho: só no aparelho · fila: tocou em Enviar, aguardando rede · erro: o servidor recusou */
export type EstadoLocal = 'rascunho' | 'fila' | 'erro'

export interface RascunhoLocal {
  id: string
  estado: EstadoLocal
  erro?: string
  atualizadoEm: string
  dados: RascunhoPreventiva
}

export interface FotoPreventiva extends FotoBase {
  preventivaId: string
  ocorrenciaId: string
}

class PreventivasDb extends Dexie {
  rascunhos!: EntityTable<RascunhoLocal, 'id'>
  fotos!: EntityTable<FotoPreventiva, 'id'>
  modelos!: EntityTable<ModeloChecklist, 'id'>

  constructor() {
    super('skyrail-preventivas')
    this.version(1).stores({ rascunhos: 'id, estado', fotos: 'id, preventivaId, [preventivaId+ocorrenciaId]', modelos: 'id, sistema' })
  }
}

export const prevDb = new PreventivasDb()

export async function salvarRascunho(dados: RascunhoPreventiva, estado: EstadoLocal = 'rascunho') {
  await prevDb.rascunhos.put({ id: dados.id, estado, atualizadoEm: new Date().toISOString(), dados })
}

export async function descartarRascunho(id: string) {
  await prevDb.transaction('rw', prevDb.rascunhos, prevDb.fotos, async () => {
    await prevDb.rascunhos.delete(id)
    await prevDb.fotos.where('preventivaId').equals(id).delete()
  })
}
