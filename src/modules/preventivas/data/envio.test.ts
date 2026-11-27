import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { definirDonoLocal } from '../../../lib/donoLocal'
import { novaPreventiva } from '../domain/preventiva'
import { processarFila } from './envio'
import { prevDb, salvarRascunho } from './local'

const falso = await vi.hoisted(async () => (await import('../../../test/supabaseFalso')).criarSupabaseFalso())
vi.mock('../../../lib/supabase', () => ({ supabase: falso.supabase }))

const A = '00000000-0000-4000-8000-00000000000a'
const B = '00000000-0000-4000-8000-00000000000b'
const foto = (n: number) => new Blob([`foto ficticia ${n}`], { type: 'image/jpeg' })

async function preventivaNaFila(ocorrencias = [{ id: 'oc1', texto: 'Folga no suporte (fictício)' }]) {
  const p = { ...novaPreventiva({ id: 'modelo-ficticio' }, '2026-11-27', 'Diurno' as const), equipe: [A, B], ocorrencias }
  await salvarRascunho(p, 'fila')
  return p
}

beforeEach(async () => {
  falso.limpar()
  definirDonoLocal(A)
  await prevDb.rascunhos.clear()
  await prevDb.fotos.clear()
})

describe('fila das Preventivas', () => {
  it('envia preventiva, equipe e fotos das ocorrências e limpa o aparelho', async () => {
    const p = await preventivaNaFila()
    await prevDb.fotos.add({ id: 'f1', preventivaId: p.id, ocorrenciaId: 'oc1', ordem: 0, legenda: 'suporte', blob: foto(1) })

    expect(await processarFila()).toEqual({ enviados: 1, pendentes: 0, erros: [] })
    expect(falso.linhas('preventivas')[0]?.id).toBe(p.id)
    expect(falso.linhas('preventiva_equipe').map((l) => l.profile_id)).toEqual([A, B])
    expect(falso.linhas('preventiva_fotos')[0]).toMatchObject({ id: 'f1', ocorrencia_id: 'oc1', storage_path: `preventivas/${p.id}/f1.jpg` })
    expect(await prevDb.rascunhos.count()).toBe(0)
    expect(await prevDb.fotos.count()).toBe(0)
  })

  it('foto de ocorrência apagada sai do servidor', async () => {
    const p = await preventivaNaFila([])
    falso.linhas('preventiva_fotos').push({ id: 'f1', preventiva_id: p.id, storage_path: `preventivas/${p.id}/f1.jpg` })
    falso.arquivos.set(`fotos/preventivas/${p.id}/f1.jpg`, foto(1))
    await prevDb.fotos.add({ id: 'f1', preventivaId: p.id, ocorrenciaId: 'oc-apagada', ordem: 0, legenda: '', storagePath: `preventivas/${p.id}/f1.jpg` })

    await processarFila()

    expect(falso.linhas('preventiva_fotos')).toHaveLength(0)
    expect(falso.arquivos.size).toBe(0)
  })

  it('servidor recusou: fica com erro no aparelho e é tentada de novo na próxima rodada', async () => {
    const p = await preventivaNaFila()
    falso.falhar('preventivas', 'upsert', 'permission denied for table preventivas')

    expect((await processarFila()).erros).toEqual(['permission denied for table preventivas'])
    expect((await prevDb.rascunhos.get(p.id))?.estado).toBe('erro')

    expect(await processarFila()).toEqual({ enviados: 1, pendentes: 0, erros: [] })
    expect(await prevDb.rascunhos.count()).toBe(0)
  })
})
