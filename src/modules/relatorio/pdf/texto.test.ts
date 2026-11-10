import { StandardFonts, PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import type { Atividade } from '../domain/tipos'
import { caminhoDocumento, chaveStorage } from './caminho'
import { diaDaSemana, quebrarLinhas, slug, textoSeguro } from './texto'

describe('textoSeguro', () => {
  it('mantém acentos do português', () => expect(textoSeguro('Manutenção — liberação “CCO”')).toBe('Manutenção - liberação "CCO"'))
  it('remove emojis', () => expect(textoSeguro('OK 📷')).toBe('OK '))
})

describe('quebrarLinhas', () => {
  it('quebra pela largura e respeita parágrafos', async () => {
    const font = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica)
    const l = quebrarLinhas('uma frase bem comprida que precisa quebrar\nsegundo', font, 10, 80)
    expect(l.length).toBeGreaterThan(2)
    expect(l.at(-1)).toBe('segundo')
    l.forEach((x) => expect(font.widthOfTextAtSize(x, 10)).toBeLessThanOrEqual(80))
  })
})

describe('nomes e pastas', () => {
  const a = { categoria: 'Corretiva', data: '2026-11-10', turno: 'Noturno', titulo: 'Falha no AMV 24!', versao: 2, tipo_prev: null, os: { numero: '123' } } as unknown as Atividade
  it('dia da semana', () => expect(diaDaSemana('2026-11-10')).toBe('Terça-feira'))
  it('slug', () => expect(slug('Falha no AMV 24!')).toBe('Falha-no-AMV-24'))
  it('relatório segue a pasta do app original', () =>
    expect(caminhoDocumento(a, 'relatorio', 3).caminho).toBe('Corretiva/2026-11-10 Terça-feira/Noturno/Relatórios/Corretiva_10112026_Noturno_03_Falha-no-AMV-24_v2.pdf'))
  it('OS leva o número digitado', () => expect(caminhoDocumento(a, 'os', 1).nome).toBe('OS_123_10112026_Noturno_Falha-no-AMV-24_v2.pdf'))
  it('chave do storage sem acento nem espaço', () =>
    expect(chaveStorage('Corretiva/2026-11-10 Terça-feira/Noturno/Relatórios/a.pdf')).toBe('Corretiva/2026-11-10_Terca-feira/Noturno/Relatorios/a.pdf'))
})
