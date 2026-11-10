import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import type { ModeloChecklist } from '../domain/modelo'
import { prevDb } from '../data/local'
import { atualizarModelos } from '../data/remoto'

/** Modelos de checklist: mostra a cópia do aparelho na hora e atualiza do servidor quando houver rede. */
export function useModelos(): { modelos: ModeloChecklist[]; carregando: boolean; semRede: boolean } {
  const modelos = useLiveQuery(() => prevDb.modelos.orderBy('id').toArray(), [])
  const [semRede, setSemRede] = useState(false)
  const [buscando, setBuscando] = useState(true)
  useEffect(() => {
    atualizarModelos()
      .then(() => setSemRede(false))
      .catch(() => setSemRede(true))
      .finally(() => setBuscando(false))
  }, [])
  const lista = [...(modelos ?? [])].sort((a, b) => a.ordem - b.ordem)
  return { modelos: lista, carregando: modelos === undefined || (buscando && !lista.length), semRede }
}

export const nomeModelo = (m: ModeloChecklist | undefined, id?: string) => (m ? `${m.sistemaNome} ${m.codigo}` : (id ?? 'Checklist'))

export const dataBR = (d: string) => d.split('-').reverse().join('/')

export function hojeISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
