import { describe, expect, it } from 'vitest'
import type { RascunhoAtividade } from './tipos'
import { camposFaltando, errosEnvio } from './validacao'

function base(over: Partial<RascunhoAtividade> = {}): RascunhoAtividade {
  return {
    id: 'x', data: '2026-11-10', turno: 'Noturno', categoria: 'Corretiva', tipo_prev: null, ordem: 1,
    titulo: 'Falha no reset', status: 'Concluída', motivo: null, local: 'BPA', sistema: 'AMV',
    hora_informe: '23:10', equipamento: 'ZC', sintoma: 'Sem comunicação', diagnostico: 'Verificado',
    intervencao: 'Reset', resultado: null, feito: null, nao_conformidades: null, cim: 'N/A',
    tempos: {
      prep: { i: '23:00', f: '23:10' }, desl: { i: '23:10', f: '23:30' }, lib: { i: '', f: '', na: true },
      atu: { i: '23:30', f: '00:40' }, ret: { i: '00:40', f: '01:00' },
    },
    os: {}, registro: {}, resp_tecnico_id: null, lider_id: null, gestor_id: null,
    reprog_pedido: false, reprog_data: null, equipe: ['u1'], versaoBase: null, ...over,
  }
}

describe('camposFaltando', () => {
  it('corretiva completa não falta nada', () => expect(camposFaltando(base())).toEqual([]))
  it('exige equipe', () => expect(camposFaltando(base({ equipe: [] }))).toContain('Equipe da atividade'))
  it('etapa sem N/A precisa de início e fim', () =>
    expect(camposFaltando(base({ tempos: { ...base().tempos, lib: { i: '', f: '' } } }))).toContain(
      'Liberação do CCO – preencha início e fim ou marque N/A',
    ))
  it('em andamento dispensa fim da atuação', () =>
    expect(camposFaltando(base({ status: 'Em andamento', tempos: { ...base().tempos, atu: { i: '23:30', f: '' } } }))).toEqual([]))
  it('não realizada só pede o motivo', () =>
    expect(camposFaltando(base({ status: 'Não realizada', equipamento: null, motivo: null }))).toEqual(['Motivo da não realização']))
  it('preventiva exige tipo e "o que foi feito"', () => {
    const f = camposFaltando(base({ categoria: 'Preventiva', feito: '' }))
    expect(f).toContain('Tipo de preventiva')
    expect(f).toContain('O que foi feito')
  })
})

describe('errosEnvio', () => {
  it('reprogramação exige motivo', () =>
    expect(errosEnvio(base({ status: 'Em andamento', reprog_pedido: true }))).toContain('Informe o motivo do pedido de reprogramação.'))
  it('rascunho válido envia', () => expect(errosEnvio(base())).toEqual([]))
})
