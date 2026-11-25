import { describe, expect, it } from 'vitest'
import { textoUltimaSincronizacao } from './sincronizacao'

const agora = new Date('2026-11-25T20:00:00Z') // 17:00 em São Paulo

describe('textoUltimaSincronizacao', () => {
  it('sem registro', () => {
    expect(textoUltimaSincronizacao(null, agora)).toBe('Ainda não sincronizou neste aparelho')
    expect(textoUltimaSincronizacao('x', agora)).toBe('Ainda não sincronizou neste aparelho')
  })
  it('hoje, no horário de São Paulo', () => {
    expect(textoUltimaSincronizacao('2026-11-25T19:42:00Z', agora)).toBe('Sincronizado hoje às 16:42')
  })
  it('ontem', () => {
    expect(textoUltimaSincronizacao('2026-11-24T23:10:00Z', agora)).toBe('Sincronizado ontem às 20:10')
  })
  it('meia-noite em UTC ainda é o mesmo dia em São Paulo', () => {
    expect(textoUltimaSincronizacao('2026-11-25T01:30:00Z', agora)).toBe('Sincronizado ontem às 22:30')
  })
  it('dias antes', () => {
    expect(textoUltimaSincronizacao('2026-11-20T12:05:00Z', agora)).toBe('Sincronizado em 20/11 às 09:05')
  })
})
