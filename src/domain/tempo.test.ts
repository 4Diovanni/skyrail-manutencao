import { describe, expect, it } from 'vitest'
import { duracaoMin, formatarDuracao, parseHora } from './tempo'

describe('parseHora', () => {
  it('lê HH:MM', () => expect(parseHora('07:45')).toBe(465))
  it('rejeita hora inválida', () => {
    expect(parseHora('24:00')).toBeNull()
    expect(parseHora('7h')).toBeNull()
    expect(parseHora('')).toBeNull()
  })
})

describe('duracaoMin', () => {
  it('mesmo dia', () => expect(duracaoMin('22:00', '23:30')).toBe(90))
  it('atravessa a meia-noite', () => expect(duracaoMin('23:30', '01:15')).toBe(105))
  it('início igual ao fim é zero', () => expect(duracaoMin('10:00', '10:00')).toBe(0))
  it('entrada inválida dá null', () => expect(duracaoMin('x', '10:00')).toBeNull())
})

describe('formatarDuracao', () => {
  it('formata em HH:MM', () => expect(formatarDuracao(105)).toBe('01:45'))
  it('passa de 24h', () => expect(formatarDuracao(1500)).toBe('25:00'))
})
