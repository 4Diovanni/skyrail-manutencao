import { describe, expect, it } from 'vitest'
import { definirHorario, duracaoEtapa, formatarMinutos, marcarNA, temposVazios } from './tempos'

describe('definirHorario', () => {
  it('fim de uma etapa preenche o início da próxima', () => {
    const t = definirHorario(temposVazios(), 'prep', 'f', '23:10')
    expect(t.desl?.i).toBe('23:10')
  })
  it('não sobrescreve início já preenchido', () => {
    let t = definirHorario(temposVazios(), 'desl', 'i', '23:15')
    t = definirHorario(t, 'prep', 'f', '23:10')
    expect(t.desl?.i).toBe('23:15')
  })
  it('não preenche etapa marcada como N/A', () => {
    let t = marcarNA(temposVazios(), 'lib', true)
    t = definirHorario(t, 'desl', 'f', '23:40')
    expect(t.lib).toEqual({ i: '', f: '', na: true })
  })
  it('preencher horário tira o N/A', () => {
    const t = definirHorario(marcarNA(temposVazios(), 'lib', true), 'lib', 'i', '23:40')
    expect(t.lib?.na).toBe(false)
  })
})

describe('duracaoEtapa e formatarMinutos', () => {
  it('atravessa a meia-noite', () => expect(duracaoEtapa({ i: '23:30', f: '00:40' })).toBe(70))
  it('N/A não tem duração', () => expect(duracaoEtapa({ i: '', f: '', na: true })).toBeNull())
  it('formata como o app original', () => {
    expect(formatarMinutos(45)).toBe('45 min')
    expect(formatarMinutos(60)).toBe('1h')
    expect(formatarMinutos(65)).toBe('1h05')
  })
})
