import { describe, expect, it } from 'vitest'
import { turnoDe } from './turno'

const at = (h: number, m = 0) => new Date(2026, 10, 8, h, m)

describe('turnoDe', () => {
  it('18:00 em diante é Noturno', () => expect(turnoDe(at(18))).toBe('Noturno'))
  it('23:59 é Noturno', () => expect(turnoDe(at(23, 59))).toBe('Noturno'))
  it('05:59 é Noturno', () => expect(turnoDe(at(5, 59))).toBe('Noturno'))
  it('06:00 é Diurno', () => expect(turnoDe(at(6))).toBe('Diurno'))
  it('17:59 é Diurno', () => expect(turnoDe(at(17, 59))).toBe('Diurno'))
})
