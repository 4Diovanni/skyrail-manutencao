import { describe, expect, it } from 'vitest'
import type { Atividade } from '../../relatorio/domain/tipos'
import type { Preventiva } from '../../preventivas/domain/preventiva'
import { itemDeAtividade, itemDePreventiva, ordenarItens, preventivaNoTurno } from './itens'
import {
  aplicarAutomatico,
  conferirProgramadas,
  novaPassagem,
  pedidosReprog,
  rascunhoParaLinha,
  resumoTurno,
  textoEmail,
  textoOcorrenciasAtendidas,
  trazerDoAnterior,
} from './passagem'
import type { ItemTurno, Passagem } from './tipos'

const item = (x: Partial<ItemTurno>): ItemTurno => ({
  id: crypto.randomUUID(),
  origem: 'atividade',
  categoria: 'Corretiva',
  tipoPrev: null,
  titulo: 'Falha',
  local: null,
  sistema: null,
  cim: null,
  status: 'Concluída',
  motivo: null,
  reprogPedido: false,
  reprogData: null,
  reprogStatus: null,
  atuacao: null,
  minutos: null,
  equipe: [],
  ...x,
})

const turno = [
  item({ titulo: 'Porta travada', local: 'VJD', cim: '1234', minutos: 45, atuacao: { i: '23:00', f: '23:45' } }),
  item({ titulo: 'Alarme falso', local: 'BPA', cim: 'N/A', minutos: 30, atuacao: { i: '19:10', f: '19:40' } }),
  item({ categoria: 'Preventiva', tipoPrev: 'PQ', titulo: 'AMV PQ', sistema: 'AMV', local: 'MOB', status: 'Não realizada', motivo: 'Sem liberação do CCO', reprogPedido: true, reprogData: '2026-11-12' }),
]

describe('passagem nova', () => {
  it('começa com a abertura e os 4 indicadores do formulário', () => {
    const p = novaPassagem('2026-11-10', 'Noturno', 'x')
    expect(p.condicoes.map((c) => c.i)).toEqual(['Operação assistida', 'Rondas e checklists', 'Ocorrências atendidas', 'Ocorrências críticas'])
    expect(p.versaoBase).toBeNull()
  })
  it('linha do banco tira linhas vazias e espaços', () => {
    const p = novaPassagem('2026-11-10', 'Noturno', 'x')
    p.alta = [{ l: ' VJD ', d: ' porta ' }, { l: '', d: '  ' }]
    p.programadas = [{ nome: '', tipo: '', local: '' }]
    const l = rascunhoParaLinha(p)
    expect(l.alta).toEqual([{ l: 'VJD', d: 'porta' }])
    expect(l.programadas).toEqual([])
    expect(l.condicoes).toHaveLength(4)
  })
})

describe('resumo e texto automático', () => {
  it('conta por categoria, status e soma a atuação', () => {
    expect(resumoTurno(turno)).toEqual({ total: 3, corretivas: 2, preventivas: 1, concluidas: 2, andamento: 0, naoRealizadas: 1, minutos: 75 })
  })
  it('ocorrências atendidas no formato do app antigo, sem contar CIM N/A', () => {
    expect(textoOcorrenciasAtendidas(turno)).toBe('2 atendimentos corretivos (1 com CIM) e 1 preventiva — VJD Porta travada, BPA Alarme falso')
  })
  it('não sobrescreve o que a pessoa escreveu, mas atualiza o texto automático', () => {
    const p = novaPassagem('2026-11-10', 'Noturno', 'x')
    const a = aplicarAutomatico(p, turno)
    expect(a.condicoes[2]).toMatchObject({ c: expect.stringContaining('2 atendimentos'), auto: true })
    const editado = { ...a, condicoes: a.condicoes.map((c, i) => (i === 2 ? { i: c.i, c: 'Escrito à mão' } : c)) }
    expect(aplicarAutomatico(editado, turno).condicoes[2]!.c).toBe('Escrito à mão')
  })
})

describe('programadas e reprogramação', () => {
  it('confere a programada com a preventiva enviada pelo tipo, nome e local', () => {
    const r = conferirProgramadas(
      [
        { nome: 'amv', tipo: 'PQ', local: 'mob' },
        { nome: 'PSD', tipo: 'P1', local: '' },
        { nome: '', tipo: 'P1', local: '' },
      ],
      turno,
    )
    expect(r.map((x) => [x.ok, x.incompleta])).toEqual([
      [true, false],
      [false, false],
      [false, true],
    ])
  })
  it('só entra pedido explícito de reprogramação', () => {
    expect(pedidosReprog(turno).map((x) => x.titulo)).toEqual(['AMV PQ'])
  })
})

describe('trazer do turno anterior', () => {
  const ant: Passagem = {
    ...novaPassagem('2026-11-10', 'Diurno', 'a'),
    condicoes: [
      { i: 'Operação assistida', c: 'Via 2 em marcha à vista' },
      { i: 'Ocorrências atendidas', c: 'auto antigo', auto: true },
    ],
    alta: [{ l: 'VJD PDM11', d: 'porta isolada' }],
    encerramento: 'Entregue',
    programadas: [{ nome: 'AMV', tipo: 'P1', local: 'CZD' }],
    versao: 3,
    enviado_por: null,
    enviado_em: '',
  }
  it('traz ocorrências sem duplicar e não traz texto automático', () => {
    const atual = { ...novaPassagem('2026-11-10', 'Noturno', 'b'), alta: [{ l: 'vjd  pdm11', d: 'Porta isolada' }] }
    const { passagem, ocorrenciasTrazidas } = trazerDoAnterior(atual, ant, { ocorrencias: true, condicoes: true, encerramento: false, programadas: true })
    expect(ocorrenciasTrazidas).toBe(0)
    expect(passagem.condicoes[0]!.c).toBe('Via 2 em marcha à vista')
    expect(passagem.condicoes[2]!.c).toBe('')
    expect(passagem.encerramento).toBe('')
    expect(passagem.programadas).toHaveLength(1)
  })
})

describe('itens do turno vindos do banco', () => {
  it('preventiva com dias extras aparece em cada turno, com o dia no título', () => {
    const p = {
      id: 'p',
      modelo_id: 'amv-p1',
      data: '2026-11-09',
      turno: 'Noturno',
      dias: [{ data: '2026-11-10', turno: 'Noturno', tempos: { atu: { i: '00:30', f: '02:00' } } }],
      tempos: {},
      local: 'MOB',
      status: 'Concluído',
      motivo: null,
      reprog_pedido: false,
      reprog_data: null,
      reprog_status: null,
    } as unknown as Preventiva
    expect(preventivaNoTurno(p, '2026-11-10', 'Noturno')).toBe(true)
    expect(preventivaNoTurno(p, '2026-11-10', 'Diurno')).toBe(false)
    const it2 = itemDePreventiva(p, { sistemaNome: 'AMV', codigo: 'P1', tipoPrev: 'P1' }, [], '2026-11-10', 'Noturno')
    expect(it2).toMatchObject({ titulo: 'AMV P1 · dia 2/2', status: 'Concluída', minutos: 90, tipoPrev: 'P1' })
  })
  it('atividade usa a etapa de atuação', () => {
    const a = { id: 'a', categoria: 'Corretiva', titulo: 'x', status: 'Concluída', tempos: { atu: { i: '23:50', f: '00:20' } }, reprog_pedido: false } as unknown as Atividade
    expect(itemDeAtividade(a, ['Fulano']).minutos).toBe(30)
  })
  it('ordena pela hora no turno da noite (19h antes de 23h, 23h antes de 1h)', () => {
    const t = [item({ titulo: 'c', atuacao: { i: '01:00', f: '' } }), item({ titulo: 'b', atuacao: { i: '23:00', f: '' } }), item({ titulo: 'a', atuacao: { i: '19:00', f: '' } }), item({ titulo: 'z' })]
    expect(ordenarItens(t, 'Noturno').map((x) => x.titulo)).toEqual(['a', 'b', 'c', 'z'])
  })
})

describe('texto do e-mail', () => {
  it('tem assunto, resumo, corretivas, preventivas e ocorrências', () => {
    const p = { ...novaPassagem('2026-11-10', 'Noturno', 'x'), alta: [{ l: 'VJD PDM11', d: 'porta isolada' }] }
    const t = textoEmail(p, turno)
    expect(t).toContain('Assunto: Passagem de turno | Manutenção L17 | Noturno | 10/11/2026')
    expect(t).toContain('3 atividades (2 corretivas, 1 preventiva) · 2 concluídas, 1 não realizada · 1h15')
    expect(t).toContain('• VJD · Porta travada · CIM 1234 · concluída')
    expect(t).toContain('• BPA · Alarme falso · sem CIM · concluída')
    expect(t).toContain('• AMV PQ MOB não realizada (Sem liberação do CCO) · reprogramar p/ 12/11/2026')
    expect(t).toContain('• VJD PDM11 – porta isolada')
  })
})

describe('turno atual', () => {
  it('03h ainda é o Noturno que começou no dia anterior', async () => {
    const { turnoAtual } = await import('./passagem')
    expect(turnoAtual(new Date(2026, 10, 11, 3, 0))).toEqual({ data: '2026-11-10', turno: 'Noturno' })
    expect(turnoAtual(new Date(2026, 10, 10, 19, 0))).toEqual({ data: '2026-11-10', turno: 'Noturno' })
    expect(turnoAtual(new Date(2026, 10, 10, 9, 0))).toEqual({ data: '2026-11-10', turno: 'Diurno' })
  })
})
