import { describe, expect, it } from 'vitest'
import type { ModeloChecklist } from './modelo'
import { errosEnvio, novaPreventiva, preventivaParaRascunho, rascunhoParaLinha, type Preventiva } from './preventiva'

const modelo: ModeloChecklist = {
  id: 'x-p1', sistema: 'x', sistemaNome: 'X', codigo: 'P1', tipoPrev: 'P1', periodicidade: 'Mensal', ordem: 1, ativo: true,
  conteudo: {
    titulo: 'T',
    local: { rotulo: 'Estação' },
    grupos: [{ titulo: 'G', escopo: 'geral', itens: ['1.1', '1.2'] }],
    itens: [{ id: '1.1', atividade: 'a' }, { id: '1.2', atividade: 'b' }],
  },
}

describe('preventiva', () => {
  it('começa em andamento, sem respostas', () => {
    const r = novaPreventiva(modelo, '2026-11-10', 'Noturno')
    expect(r).toMatchObject({ modelo_id: 'x-p1', status: 'Em andamento', respostas: {}, versaoBase: null })
  })

  it('pede local e equipe, e deixa enviar incompleta em andamento', () => {
    const r = novaPreventiva(modelo, '2026-11-10', 'Noturno')
    expect(errosEnvio(r, modelo)).toEqual(['Informe: Estação.', 'Marque quem está na equipe.'])
    expect(errosEnvio({ ...r, local: 'BPA', equipe: ['u1'] }, modelo)).toEqual([])
  })

  it('para concluir exige todos os itens respondidos', () => {
    const r = { ...novaPreventiva(modelo, '2026-11-10', 'Noturno'), local: 'BPA', equipe: ['u1'], status: 'Concluído' as const }
    expect(errosEnvio({ ...r, respostas: { '1.1': { r: 'OK' } } }, modelo)).toEqual(['Para concluir, responda todos os itens (faltam 1).'])
    expect(errosEnvio({ ...r, respostas: { '1.1': { r: 'OK' }, '1.2': { r: 'NA' } } }, modelo)).toEqual([])
  })

  it('não realizado e reprogramação pedem motivo', () => {
    const r = { ...novaPreventiva(modelo, '2026-11-10', 'Noturno'), local: 'BPA', equipe: ['u1'] }
    expect(errosEnvio({ ...r, status: 'Não realizado' }, modelo)).toContain('Informe o motivo da não realização.')
    expect(errosEnvio({ ...r, reprog_pedido: true }, modelo)).toContain('Informe o motivo do pedido de reprogramação.')
  })

  it('limpa campos vazios e zera reprogramação ao concluir', () => {
    const r = {
      ...novaPreventiva(modelo, '2026-11-10', 'Noturno'),
      local: ' BPA ', os_numero: '  ', status: 'Concluído' as const, reprog_pedido: true, reprog_data: '2026-11-20',
      instrumentos: [{ nome: 'Multímetro' }, { nome: ' ' }], ocorrencias: [{ id: 'o1', texto: '' }], campos: { quadro: 'X22', tipo: '' },
      equipe: ['u1'],
    }
    const l = rascunhoParaLinha(r)
    expect(l).toMatchObject({ local: 'BPA', os_numero: null, reprog_pedido: false, reprog_data: null, instrumentos: [{ nome: 'Multímetro' }], ocorrencias: [], campos: { quadro: 'X22' } })
    expect(l).not.toHaveProperty('equipe')
    expect(l).not.toHaveProperty('versaoBase')
  })

  it('volta do banco para rascunho guardando a versão base', () => {
    const p = { ...novaPreventiva(modelo, '2026-11-10', 'Noturno'), versao: 3, modelo_versao: 1, enviado_em: 'x', reprog_status: null, criado_por: 'u1' } as Preventiva & { equipe: string[]; versaoBase: null }
    const r = preventivaParaRascunho(p, ['u1'])
    expect(r.versaoBase).toBe(3)
    expect(r.equipe).toEqual(['u1'])
    expect(r).not.toHaveProperty('modelo_versao')
  })
})
