import { describe, expect, it } from 'vitest'
import bruto from '../../../../supabase/seed/checklists.json?raw'
import { problemasModelo, type ModeloChecklist } from './modelo'

const pacote = JSON.parse(bruto) as {
  formato: string
  modelos: ModeloChecklist[]
}

describe('pacote de checklists importado do app antigo', () => {
  it('tem o formato certo e ids únicos', () => {
    expect(pacote.formato).toBe('skyrail-checklists')
    const ids = pacote.modelos.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(pacote.modelos.filter((m) => m.ativo)).toHaveLength(43)
  })

  it.each(pacote.modelos.map((m) => [m.id, m] as const))('%s é consistente', (_id, m) => {
    expect(problemasModelo(m)).toEqual([])
  })

  it('não traz nomes de pessoas nem matrículas', () => {
    const txt = JSON.stringify(pacote)
    expect(txt).not.toMatch(/\b\d{8}\b/)
    expect(txt).not.toMatch(/SIG_|assinatura manuscrita/i)
  })
})

describe('problemasModelo', () => {
  const base: ModeloChecklist = {
    id: 'x-p1', sistema: 'x', sistemaNome: 'X', codigo: 'P1', tipoPrev: 'P1', periodicidade: 'Mensal', ordem: 1, ativo: true,
    conteudo: { titulo: 'T', local: { rotulo: 'Estação' }, grupos: [{ titulo: 'G', escopo: 'geral', itens: ['1.1'] }], itens: [{ id: '1.1', atividade: 'a' }] },
  }
  it('aceita um modelo simples', () => expect(problemasModelo(base)).toEqual([]))
  it('aponta item inexistente, item solto e grupo por unidade sem unidades', () => {
    const m: ModeloChecklist = {
      ...base,
      conteudo: { ...base.conteudo, grupos: [{ titulo: 'G', escopo: 'unidade', itens: ['9.9'] }], itens: [{ id: '1.1', atividade: 'a' }] },
    }
    expect(problemasModelo(m)).toEqual([
      'grupo "G" é por unidade mas o modelo não tem unidades',
      'grupo "G" cita item inexistente: 9.9',
      'item 1.1 fora de qualquer grupo',
    ])
  })
  it('aponta limites invertidos', () => {
    const m: ModeloChecklist = { ...base, conteudo: { ...base.conteudo, itens: [{ id: '1.1', atividade: 'a', medicoes: [{ id: 'v', rotulo: 'V', min: 10, max: 5 }] }] } }
    expect(problemasModelo(m)).toEqual(['limites invertidos em 1.1/v'])
  })
})
