import { describe, expect, it } from 'vitest'
import { ehVersaoAntiga, INTERVALO_RECARGA_MS, podeRecarregar } from './versao'

describe('ehVersaoAntiga', () => {
  it('reconhece a falha de import dinâmico de cada navegador', () => {
    expect(ehVersaoAntiga(new TypeError('Failed to fetch dynamically imported module: https://x/assets/servico-OfEtkkP7.js'))).toBe(true)
    expect(ehVersaoAntiga(new TypeError('error loading dynamically imported module: https://x/a.js'))).toBe(true)
    expect(ehVersaoAntiga(new TypeError('Importing a module script failed.'))).toBe(true)
    expect(ehVersaoAntiga(new Error('Unable to preload CSS for /assets/a.css'))).toBe(true)
  })

  it('não confunde com outros erros', () => {
    expect(ehVersaoAntiga(new Error('Failed to fetch'))).toBe(false)
    expect(ehVersaoAntiga(new Error('new row violates row-level security policy'))).toBe(false)
    expect(ehVersaoAntiga(undefined)).toBe(false)
  })
})

describe('podeRecarregar', () => {
  it('recarrega na primeira vez', () => {
    expect(podeRecarregar(1000, null)).toBe(true)
  })
  it('não recarrega de novo dentro de um minuto (evita laço)', () => {
    expect(podeRecarregar(1000 + INTERVALO_RECARGA_MS - 1, 1000)).toBe(false)
  })
  it('volta a poder depois de um minuto', () => {
    expect(podeRecarregar(1000 + INTERVALO_RECARGA_MS + 1, 1000)).toBe(true)
  })
})
