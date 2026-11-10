import Dexie, { type EntityTable } from 'dexie'

/** Operação pendente gravada offline e enviada ao Supabase quando houver rede. */
export interface PendingOp {
  id?: number
  table: string
  action: 'insert' | 'update' | 'delete'
  payload: Record<string, unknown>
  createdAt: string
}

class OfflineDb extends Dexie {
  pending!: EntityTable<PendingOp, 'id'>

  constructor() {
    super('skyrail-offline')
    this.version(1).stores({ pending: '++id, table, createdAt' })
  }
}

export const offlineDb = new OfflineDb()

export function enqueue(op: Omit<PendingOp, 'id' | 'createdAt'>) {
  return offlineDb.pending.add({ ...op, createdAt: new Date().toISOString() })
}
