import Dexie, { type EntityTable } from 'dexie'
import { donoLocal, ehDoDono, semDono } from '../../../lib/donoLocal'
import type { FotoBase } from '../../../components/FotosLista'
import type { ModeloChecklist } from '../domain/modelo'
import type { RascunhoPreventiva } from '../domain/preventiva'

/** rascunho: só no aparelho · fila: tocou em Enviar, aguardando rede · erro: o servidor recusou */
export type EstadoLocal = 'rascunho' | 'fila' | 'erro'

export interface RascunhoLocal {
  id: string
  /** Quem fez o rascunho neste aparelho (ver lib/donoLocal). */
  userId?: string
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
    this.version(2).stores({ rascunhos: 'id, estado, userId' })
  }
}

export const prevDb = new PreventivasDb()

export async function salvarRascunho(dados: RascunhoPreventiva, estado: EstadoLocal = 'rascunho') {
  const userId = donoLocal()
  if (!userId) throw new Error('Sem usuário logado: o rascunho não foi salvo.')
  await prevDb.rascunhos.put({ id: dados.id, userId, estado, atualizadoEm: new Date().toISOString(), dados })
}

/** Rascunho deste id, só se for da pessoa logada. */
export async function meuRascunho(id: string): Promise<RascunhoLocal | undefined> {
  const r = await prevDb.rascunhos.get(id)
  return r && ehDoDono(r) ? r : undefined
}

export function meusRascunhos() {
  return prevDb.rascunhos.filter((r) => ehDoDono(r))
}

/** Fila (enviar ou com erro) da pessoa logada. */
export function minhaFila() {
  return prevDb.rascunhos.where('estado').anyOf('fila', 'erro').filter((r) => ehDoDono(r))
}

export async function adotarSemDono(userId: string) {
  await prevDb.rascunhos.filter(semDono).modify({ userId })
}

export async function descartarRascunho(id: string) {
  await prevDb.transaction('rw', prevDb.rascunhos, prevDb.fotos, async () => {
    await prevDb.rascunhos.delete(id)
    await prevDb.fotos.where('preventivaId').equals(id).delete()
  })
}
