import { describe, expect, it } from 'vitest'
import { chaveAceiteLocal, precisaAceitar, SECOES, textoDataAceite, VERSAO_POLITICA } from './politica'

describe('precisaAceitar', () => {
  it('pede aceite no primeiro acesso', () => {
    expect(precisaAceitar('1', null)).toBe(true)
  })
  it('pede aceite de novo quando a versão do texto muda', () => {
    expect(precisaAceitar('2', '1')).toBe(true)
  })
  it('não pede de novo a versão já aceita', () => {
    expect(precisaAceitar('1', '1')).toBe(false)
  })
})

describe('texto da política', () => {
  it('tem versão e conteúdo', () => {
    expect(VERSAO_POLITICA.length).toBeGreaterThan(0)
    expect(SECOES.length).toBeGreaterThan(0)
    expect(SECOES.every((s) => s.titulo && s.paragrafos.length)).toBe(true)
  })
})

describe('chaveAceiteLocal', () => {
  it('separa o aceite por pessoa no mesmo aparelho', () => {
    expect(chaveAceiteLocal('a')).not.toBe(chaveAceiteLocal('b'))
  })
})

describe('textoDataAceite', () => {
  it('mostra data e hora de São Paulo', () => {
    expect(textoDataAceite('2026-11-25T20:42:00Z')).toBe('25/11/2026 às 17:42')
  })
  it('data inválida vira texto vazio', () => {
    expect(textoDataAceite('x')).toBe('')
  })
})
