import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definirDonoLocal } from '../../../lib/donoLocal'
import { novaPassagem } from '../domain/passagem'
import { processarFilaPassagem } from './envio'
import { passDb, salvarLocal } from './local'

const falso = await vi.hoisted(async () => (await import('../../../test/supabaseFalso')).criarSupabaseFalso())
vi.mock('../../../lib/supabase', () => ({ supabase: falso.supabase }))

const A = '00000000-0000-4000-8000-00000000000a'
const B = '00000000-0000-4000-8000-00000000000b'

beforeEach(async () => {
  falso.limpar()
  await passDb.rascunhos.clear()
})
afterEach(() => vi.unstubAllGlobals())

describe('fila da Passagem de turno', () => {
  it('duas pessoas enviam o mesmo turno: fica uma passagem só, na versão 2', async () => {
    definirDonoLocal(A)
    await salvarLocal({ ...novaPassagem('2026-11-27', 'Diurno'), encerramento: 'Turno sem ocorrências (fictício)' }, 'fila')
    expect(await processarFilaPassagem()).toEqual({ enviados: 1, pendentes: 0, erros: [] })

    definirDonoLocal(B)
    await salvarLocal({ ...novaPassagem('2026-11-27', 'Diurno'), encerramento: 'Complemento (fictício)' }, 'fila')
    expect(await processarFilaPassagem()).toEqual({ enviados: 1, pendentes: 0, erros: [] })

    expect(falso.linhas('passagens')).toHaveLength(1)
    expect(falso.linhas('passagens')[0]).toMatchObject({ versao: 2, encerramento: 'Complemento (fictício)' })
    expect(await passDb.rascunhos.count()).toBe(0)
  })

  it('sem internet a passagem continua na fila', async () => {
    definirDonoLocal(A)
    await salvarLocal(novaPassagem('2026-11-27', 'Noturno'), 'fila')
    vi.stubGlobal('navigator', { onLine: false })
    expect(await processarFilaPassagem()).toEqual({ enviados: 0, pendentes: 1, erros: [] })
    expect((await passDb.rascunhos.toArray())[0]?.estado).toBe('fila')
  })

  it('recusada pelo servidor: fica com erro e é tentada de novo na próxima rodada', async () => {
    definirDonoLocal(A)
    await salvarLocal(novaPassagem('2026-11-27', 'Noturno'), 'fila')
    falso.falhar('passagens', 'upsert', 'Service Unavailable')

    expect((await processarFilaPassagem()).erros).toEqual(['Service Unavailable'])
    expect((await passDb.rascunhos.toArray())[0]).toMatchObject({ estado: 'erro', erro: 'Service Unavailable' })

    expect(await processarFilaPassagem()).toEqual({ enviados: 1, pendentes: 0, erros: [] })
    expect(await passDb.rascunhos.count()).toBe(0)
  })

  it('só envia a fila de quem está logado', async () => {
    definirDonoLocal(A)
    await salvarLocal(novaPassagem('2026-11-27', 'Diurno'), 'fila')
    definirDonoLocal(B)
    expect(await processarFilaPassagem()).toEqual({ enviados: 0, pendentes: 0, erros: [] })
  })
})
