import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definirDonoLocal } from '../../../lib/donoLocal'
import { novoRascunho } from '../domain/rascunho'
import { processarFila } from './envio'
import { localDb, salvarRascunho } from './local'

const falso = await vi.hoisted(async () => (await import('../../../test/supabaseFalso')).criarSupabaseFalso())
vi.mock('../../../lib/supabase', () => ({ supabase: falso.supabase }))

const A = '00000000-0000-4000-8000-00000000000a'
const B = '00000000-0000-4000-8000-00000000000b'
const C = '00000000-0000-4000-8000-00000000000c'
const foto = (n: number) => new Blob([`foto ficticia ${n}`], { type: 'image/jpeg' })

async function rascunhoNaFila(estado: 'fila' | 'erro' | 'rascunho' = 'fila', equipe: string[] = [A]) {
  const r = { ...novoRascunho('2026-11-27', 'Corretiva', 1), titulo: 'Troca de sensor (fictício)', equipe }
  await salvarRascunho(r, estado)
  return r
}

beforeEach(async () => {
  falso.limpar()
  definirDonoLocal(A)
  await localDb.rascunhos.clear()
  await localDb.fotos.clear()
})
afterEach(() => vi.unstubAllGlobals())

describe('fila do Relatório', () => {
  it('envia o que está na fila ou com erro, com equipe e fotos, e limpa o aparelho', async () => {
    const r1 = await rascunhoNaFila('fila', [A, B])
    const r2 = await rascunhoNaFila('erro')
    await localDb.fotos.bulkAdd([
      { id: 'f1', atividadeId: r1.id, ordem: 0, legenda: 'antes', blob: foto(1) },
      { id: 'f2', atividadeId: r1.id, ordem: 1, legenda: '', blob: foto(2) },
    ])

    const res = await processarFila()

    expect(res).toEqual({ enviados: 2, pendentes: 0, erros: [] })
    expect(falso.linhas('atividades').map((l) => l.id).sort()).toEqual([r1.id, r2.id].sort())
    expect(falso.linhas('atividade_equipe').filter((l) => l.atividade_id === r1.id).map((l) => l.profile_id)).toEqual([A, B])
    expect(falso.linhas('atividade_fotos').map((l) => [l.id, l.storage_path, l.legenda])).toEqual([
      ['f1', `${r1.id}/f1.jpg`, 'antes'],
      ['f2', `${r1.id}/f2.jpg`, null],
    ])
    expect(falso.arquivos.has(`fotos/${r1.id}/f1.jpg`)).toBe(true)
    expect(await localDb.rascunhos.count()).toBe(0)
    expect(await localDb.fotos.count()).toBe(0)
  })

  it('não envia rascunho que a pessoa ainda não mandou enviar', async () => {
    await rascunhoNaFila('rascunho')
    expect(await processarFila()).toEqual({ enviados: 0, pendentes: 0, erros: [] })
    expect(falso.linhas('atividades')).toHaveLength(0)
    expect(await localDb.rascunhos.count()).toBe(1)
  })

  it('sem internet nada sai do aparelho e não conta como erro', async () => {
    await rascunhoNaFila()
    vi.stubGlobal('navigator', { onLine: false })
    expect(await processarFila()).toEqual({ enviados: 0, pendentes: 1, erros: [] })
    expect(falso.chamadas).toHaveLength(0)
    expect((await localDb.rascunhos.toArray())[0]?.estado).toBe('fila')
  })

  it('servidor recusou: guarda o erro e mantém rascunho e fotos no aparelho', async () => {
    const r = await rascunhoNaFila()
    await localDb.fotos.add({ id: 'f1', atividadeId: r.id, ordem: 0, legenda: '', blob: foto(1) })
    falso.falhar('atividades', 'upsert', 'new row violates row-level security policy')

    const res = await processarFila()

    expect(res).toEqual({ enviados: 0, pendentes: 1, erros: ['new row violates row-level security policy'] })
    const local = await localDb.rascunhos.get(r.id)
    expect(local?.estado).toBe('erro')
    expect(local?.erro).toContain('row-level security')
    expect((await localDb.fotos.get('f1'))?.blob).toBeDefined()
  })

  it('falha no meio das fotos: não perde nenhuma e, ao tentar de novo, não reenvia a que já subiu', async () => {
    const r = await rascunhoNaFila()
    await localDb.fotos.bulkAdd([
      { id: 'f1', atividadeId: r.id, ordem: 0, legenda: '', blob: foto(1) },
      { id: 'f2', atividadeId: r.id, ordem: 1, legenda: '', blob: foto(2) },
    ])
    falso.falhar(`fotos/${r.id}/f2.jpg`, 'upload', 'Gateway Timeout')

    expect((await processarFila()).erros).toEqual(['Gateway Timeout'])
    expect((await localDb.fotos.get('f1'))?.storagePath).toBe(`${r.id}/f1.jpg`)
    expect((await localDb.fotos.get('f2'))?.blob).toBeDefined()

    falso.chamadas.length = 0
    expect(await processarFila()).toEqual({ enviados: 1, pendentes: 0, erros: [] })
    const uploads = falso.chamadas.filter((c) => c.op === 'upload').map((c) => c.alvo)
    expect(uploads).toEqual([`fotos/${r.id}/f2.jpg`])
    expect(falso.linhas('atividade_fotos')).toHaveLength(2)
  })

  it('equipe por diferença: entra quem foi incluído e sai quem foi tirado', async () => {
    const r = await rascunhoNaFila('fila', [B, C])
    falso.linhas('atividade_equipe').push({ atividade_id: r.id, profile_id: A }, { atividade_id: r.id, profile_id: B })

    await processarFila()

    expect(falso.linhas('atividade_equipe').map((l) => l.profile_id).sort()).toEqual([B, C].sort())
  })

  it('foto removida que já estava no servidor sai do banco e do Storage', async () => {
    const r = await rascunhoNaFila()
    falso.linhas('atividade_fotos').push({ id: 'f9', atividade_id: r.id, storage_path: `${r.id}/f9.jpg` })
    falso.arquivos.set(`fotos/${r.id}/f9.jpg`, foto(9))
    await localDb.fotos.add({ id: 'f9', atividadeId: r.id, ordem: 0, legenda: '', storagePath: `${r.id}/f9.jpg`, removida: true })

    await processarFila()

    expect(falso.linhas('atividade_fotos')).toHaveLength(0)
    expect(falso.arquivos.size).toBe(0)
  })

  it('só envia a fila de quem está logado', async () => {
    await rascunhoNaFila()
    definirDonoLocal(B)
    expect(await processarFila()).toEqual({ enviados: 0, pendentes: 0, erros: [] })
    expect(falso.linhas('atividades')).toHaveLength(0)
  })
})
