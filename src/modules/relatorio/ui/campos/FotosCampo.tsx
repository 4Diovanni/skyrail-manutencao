import { useMemo } from 'react'
import { FotosLista, type RepoFotos } from '../../../../components/FotosLista'
import { localDb } from '../../data/local'
import { urlFoto } from '../../data/remoto'

export function FotosCampo({ atividadeId, onMudou }: { atividadeId: string; onMudou: () => void }) {
  const repo = useMemo<RepoFotos>(
    () => ({
      listar: () => localDb.fotos.where('atividadeId').equals(atividadeId).toArray(),
      criar: async (f) => {
        await localDb.fotos.put({ ...f, atividadeId })
      },
      atualizar: async (id, m) => {
        await localDb.fotos.update(id, m)
      },
      apagar: (id) => localDb.fotos.delete(id),
      url: urlFoto,
    }),
    [atividadeId],
  )
  return <FotosLista repo={repo} chave={atividadeId} onMudou={onMudou} />
}
