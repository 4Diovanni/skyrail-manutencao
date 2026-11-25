import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { definirDonoLocal, ehDoDono } from './donoLocal'
import { novaPassagem } from '../modules/passagem/domain/passagem'
import * as pass from '../modules/passagem/data/local'
import { novoRascunho } from '../modules/relatorio/domain/rascunho'
import * as rel from '../modules/relatorio/data/local'

const A = '00000000-0000-4000-8000-00000000000a'
const B = '00000000-0000-4000-8000-00000000000b'

describe('ehDoDono', () => {
  it('sem pessoa logada nada pertence', () => {
    expect(ehDoDono({ userId: A }, null)).toBe(false)
    expect(ehDoDono({}, A)).toBe(false)
    expect(ehDoDono({ userId: A }, A)).toBe(true)
  })
})

describe('rascunhos do relatório por pessoa', () => {
  beforeEach(async () => {
    await rel.localDb.rascunhos.clear()
  })

  it('B não vê nem envia o rascunho de A', async () => {
    definirDonoLocal(A)
    const r = novoRascunho('2026-11-24', 'Corretiva', 1)
    await rel.salvarRascunho(r, 'fila')

    definirDonoLocal(B)
    expect(await rel.meuRascunho(r.id)).toBeUndefined()
    expect(await rel.meusRascunhos('2026-11-24').count()).toBe(0)
    expect(await rel.minhaFila().count()).toBe(0)

    definirDonoLocal(A)
    expect((await rel.meuRascunho(r.id))?.dados.id).toBe(r.id)
    expect(await rel.minhaFila().count()).toBe(1)
  })

  it('sem login não salva', async () => {
    definirDonoLocal(null)
    await expect(rel.salvarRascunho(novoRascunho('2026-11-24', 'Corretiva', 1))).rejects.toThrow()
  })

  it('rascunho antigo (sem dono) fica com quem entra primeiro', async () => {
    const r = novoRascunho('2026-11-24', 'Corretiva', 1)
    await rel.localDb.rascunhos.put({ id: r.id, data: r.data, estado: 'rascunho', atualizadoEm: '', dados: r })
    await rel.adotarSemDono(A)
    definirDonoLocal(A)
    expect(await rel.meuRascunho(r.id)).toBeDefined()
    definirDonoLocal(B)
    expect(await rel.meuRascunho(r.id)).toBeUndefined()
  })
})

describe('passagem de turno por pessoa', () => {
  beforeEach(async () => {
    await pass.passDb.rascunhos.clear()
  })

  it('A e B têm rascunhos separados do mesmo turno', async () => {
    const p = novaPassagem('2026-11-24', 'Diurno')
    definirDonoLocal(A)
    await pass.salvarLocal(p, 'fila')
    definirDonoLocal(B)
    expect(await pass.minhaPassagem('2026-11-24', 'Diurno')).toBeNull()
    await pass.salvarLocal(p)
    expect(await pass.passDb.rascunhos.count()).toBe(2)
    expect(await pass.minhaFila().count()).toBe(0)
    await pass.descartarLocal('2026-11-24', 'Diurno')
    definirDonoLocal(A)
    expect(await pass.minhaPassagem('2026-11-24', 'Diurno')).not.toBeNull()
  })

  it('passagem antiga (chave sem dono) é migrada para quem entra', async () => {
    const p = novaPassagem('2026-11-24', 'Noturno')
    await pass.passDb.rascunhos.put({ chave: pass.chavePassagem(p.data, p.turno), estado: 'fila', atualizadoEm: '', dados: p })
    await pass.adotarSemDono(A)
    definirDonoLocal(A)
    expect(await pass.minhaPassagem('2026-11-24', 'Noturno')).not.toBeNull()
    expect(await pass.passDb.rascunhos.count()).toBe(1)
  })
})
