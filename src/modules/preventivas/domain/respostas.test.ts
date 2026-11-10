import { describe, expect, it } from 'vitest'
import type { ConteudoModelo } from './modelo'
import { chave, foraDoLimite, linhas, marcarPendentesOk, medicoesForaDoLimite, progresso } from './respostas'

const c: ConteudoModelo = {
  titulo: 'T',
  local: { rotulo: 'Estação' },
  unidades: { rotulo: 'Porta', grupos: [{ nome: 'Fachada 1', unidades: ['P1', 'P2'] }] },
  grupos: [
    { titulo: 'Por porta', escopo: 'unidade', itens: ['1.1'] },
    { titulo: 'Geral', escopo: 'geral', itens: ['2.1', '2.2'] },
  ],
  itens: [
    { id: '1.1', atividade: 'a' },
    { id: '2.1', atividade: 'b', medicoes: [{ id: 't', rotulo: 'Tempo (s)', min: null, max: 9 }] },
    { id: '2.2', atividade: 'c' },
  ],
}

describe('respostas do checklist', () => {
  it('monta a chave por item e por unidade', () => {
    expect(chave('1.1')).toBe('1.1')
    expect(chave('1.1', 'PDM11')).toBe('1.1@PDM11')
  })

  it('lista uma linha por unidade nos grupos por unidade', () => {
    expect(linhas(c)).toEqual([{ item: '1.1', unidade: 'P1' }, { item: '1.1', unidade: 'P2' }, { item: '2.1' }, { item: '2.2' }])
  })

  it('conta progresso, NOK e NA', () => {
    expect(progresso(c, { '1.1@P1': { r: 'OK' }, '2.1': { r: 'NOK' }, '2.2': { r: 'NA' }, '2.2@x': { r: 'OK' } })).toEqual({ total: 4, respondidos: 3, nok: 1, na: 1 })
  })

  it('marca OK só o que está pendente', () => {
    const r = marcarPendentesOk(c, { '2.1': { r: 'NOK', obs: 'folga' } })
    expect(r['2.1']).toEqual({ r: 'NOK', obs: 'folga' })
    expect(r['1.1@P1']?.r).toBe('OK')
    expect(progresso(c, r).respondidos).toBe(4)
  })

  it('marca OK filtrando por unidade', () => {
    const r = marcarPendentesOk(c, {}, (l) => l.unidade === 'P2')
    expect(Object.keys(r)).toEqual(['1.1@P2'])
  })

  it('aponta medição fora do limite', () => {
    expect(foraDoLimite(10, null, 9)).toBe(true)
    expect(foraDoLimite(9, null, 9)).toBe(false)
    expect(foraDoLimite(130, 140, 170)).toBe(true)
    expect(foraDoLimite(null, 140, 170)).toBe(false)
    expect(medicoesForaDoLimite(c.itens[1]!, { med: { t: 12 } })).toEqual(['t'])
  })
})
