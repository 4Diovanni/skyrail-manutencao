import { describe, expect, it } from 'vitest'
import { temposVazios } from '../../relatorio/domain/tempos'
import type { ModeloChecklist } from './modelo'
import { linhasRegistro, obsGeral, obsUnidade, resumir } from './resumo'

const m: ModeloChecklist = {
  id: 'psd-x', sistema: 'psd', sistemaNome: 'PSD', codigo: '1M', tipoPrev: 'P1', periodicidade: 'Mensal', ordem: 1, ativo: true,
  conteudo: {
    titulo: 'T', referencia: 'MM-1', sistemaTexto: 'PSD (portas de plataforma)',
    local: { rotulo: 'Estação' },
    unidades: { rotulo: 'Porta', grupos: [{ nome: 'Fachada 1', unidades: ['P1', 'P2'] }] },
    medicaoUnidade: { item: '1.1', rotulo: 'Tensão correia (N)', min: 140, max: 170 },
    grupos: [
      { titulo: 'A', escopo: 'unidade', itens: ['1.1'] },
      { titulo: 'B', escopo: 'geral', itens: ['2.1', '2.2'] },
    ],
    itens: [
      { id: '1.1', curto: 'Correia', atividade: 'Verificar correia' },
      { id: '2.1', curto: 'Painel', atividade: 'Verificar painel', medicoes: [{ id: 't', rotulo: 'Temp. (°C)', min: null, max: 40 }] },
      { id: '2.2', curto: 'Dados', atividade: 'Exportar dados' },
    ],
  },
}

const base = { local: 'BPA', os_numero: '123', observacoes: null, tempos: { ...temposVazios(), atu: { i: '23:00', f: '00:30' } } }

describe('resumo da preventiva', () => {
  const p = {
    ...base,
    respostas: {
      '1.1@P1': { r: 'NOK' as const, obs: 'Correia frouxa', med: { un: 130 } },
      '2.1': { r: 'OK' as const, med: { t: 45 } },
    },
    ocorrencias: [{ id: 'o1', item: '1.1', unidade: 'P1', texto: 'Correia frouxa' }],
  }

  it('conta por unidade e geral', () => {
    const s = resumir(m.conteudo, p)
    expect(s.porUnidade).toEqual({ total: 2, ok: 0, nok: [{ item: '1.1', unidade: 'P1' }], na: 0, branco: { '1.1': ['P2'] } })
    expect(s.geral).toEqual({ total: 2, ok: 1, nok: [], na: 0, branco: ['2.2'] })
  })

  it('junta medição, observação e ocorrência sem repetir texto', () => {
    expect(obsUnidade(m.conteudo, p, 'P1')).toBe('Tensão correia: 130 (fora da faixa) · Item 1.1: Correia frouxa')
    expect(obsUnidade(m.conteudo, p, 'P2')).toBe('')
    expect(obsGeral(m.conteudo, p, '2.1')).toBe('Temp. (°C): 45 (fora do limite)')
  })

  it('escreve o registro de manutenção', () => {
    expect(linhasRegistro(m, p)).toEqual([
      'Foi realizada a manutenção preventiva mensal (1M) do PSD (portas de plataforma) na estação BPA, ordem 123, conforme roteiro do manual MM-1, com 1 itens verificados em 2 portas (2 verificações) e 2 atividade(s) geral(is), sendo 1 OK e 1 NOK por conta das observações descritas abaixo e 2 não executado(s).',
      'Atuação das 23:00 às 00:30 (1h30).',
      'Não conformidades (NOK) identificadas:',
      '• P1 – Item 1.1 (Correia): Correia frouxa',
      'Outras observações registradas:',
      '• Item 2.1 (Painel): Temp. (°C): 45 (fora do limite)',
      'Pendência: item 1.1 (Correia) não executado em 1 porta(s): P2.',
      'Pendência: item(ns) 2.2 sem registro de execução.',
    ])
  })
})
