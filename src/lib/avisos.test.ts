import { beforeEach, describe, expect, it } from 'vitest'
import { avisar, dispensar, limparAvisos, registrarErroSincronizacao, textoDaFila, ultimoErroDaSincronizacao } from './avisos'
import { sincronizarAgora, registrarSincronizacao } from './sync'

describe('textoDaFila', () => {
  it('erro tem prioridade e mostra o motivo', () => {
    const t = textoDaFila({ enviados: 1, pendentes: 1, erros: ['RLS negou'] }, 'Relatório')
    expect(t?.tipo).toBe('erro')
    expect(t?.texto).toContain('RLS negou')
  })
  it('concluído, na fila e nada a dizer', () => {
    expect(textoDaFila({ enviados: 2, pendentes: 0, erros: [] }, 'Preventivas')?.texto).toBe('Preventivas: 2 itens enviados.')
    expect(textoDaFila({ enviados: 0, pendentes: 1, erros: [] }, 'Passagem')?.tipo).toBe('fila')
    expect(textoDaFila({ enviados: 0, pendentes: 0, erros: [] }, 'Passagem')).toBeNull()
  })
})

describe('avisar', () => {
  beforeEach(() => limparAvisos())
  it('não repete o mesmo aviso e dispensar remove', () => {
    const a = avisar('erro', 'falhou')
    expect(avisar('erro', 'falhou')).toBe(a)
    dispensar(a)
    expect(avisar('erro', 'falhou')).not.toBe(a)
  })
})

describe('sincronizarAgora', () => {
  beforeEach(() => limparAvisos())
  it('guarda o último erro em vez de engolir', async () => {
    const sair = registrarSincronizacao({ rotulo: 'Teste', executar: async () => { throw new Error('rede caiu') } })
    await sincronizarAgora()
    expect(ultimoErroDaSincronizacao()).toBe('Teste: rede caiu')
    sair()
    await sincronizarAgora()
    expect(ultimoErroDaSincronizacao()).toBeNull()
    registrarErroSincronizacao(null)
  })
})
