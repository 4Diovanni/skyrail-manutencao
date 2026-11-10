import { describe, expect, it } from 'vitest'
import { novoRascunho, rascunhoParaLinha } from './rascunho'

describe('novoRascunho', () => {
  it('turno vem da hora atual (18h às 6h é Noturno)', () => {
    expect(novoRascunho('2026-11-10', 'Corretiva', 1, new Date(2026, 10, 10, 19)).turno).toBe('Noturno')
    expect(novoRascunho('2026-11-10', 'Corretiva', 1, new Date(2026, 10, 10, 9)).turno).toBe('Diurno')
  })
})

describe('rascunhoParaLinha', () => {
  it('tira campos locais e limpa reprogramação de atividade concluída', () => {
    const r = { ...novoRascunho('2026-11-10', 'Corretiva', 1), titulo: '  Falha  ', reprog_pedido: true, reprog_data: '2026-11-12', equipe: ['a'] }
    const l = rascunhoParaLinha(r)
    expect(l).not.toHaveProperty('equipe')
    expect(l).not.toHaveProperty('versaoBase')
    expect(l.titulo).toBe('Falha')
    expect(l.reprog_pedido).toBe(false)
    expect(l.reprog_data).toBeNull()
  })
  it('corretiva não leva tipo de preventiva', () => {
    const r = { ...novoRascunho('2026-11-10', 'Corretiva', 1), tipo_prev: 'P1' as const }
    expect(rascunhoParaLinha(r).tipo_prev).toBeNull()
  })
})
