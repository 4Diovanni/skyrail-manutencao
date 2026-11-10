import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { novaPassagem } from '../domain/passagem'
import type { ItemTurno } from '../domain/tipos'
import { gerarPassagem, type DadosPassagemPdf } from './passagem'

const item = (i: number, x: Partial<ItemTurno> = {}): ItemTurno => ({
  id: `i${i}`,
  origem: 'atividade',
  categoria: 'Corretiva',
  tipoPrev: null,
  titulo: `Atendimento de exemplo ${i}`,
  local: 'VJD',
  sistema: 'PSD',
  cim: String(1000 + i),
  status: 'Concluída',
  motivo: null,
  reprogPedido: false,
  reprogData: null,
  reprogStatus: null,
  atuacao: { i: '19:00', f: '19:40' },
  minutos: 40,
  equipe: ['Pessoa Exemplo Um', 'Pessoa Exemplo Dois'],
  ...x,
})

export function dadosExemploPassagem(n = 3): DadosPassagemPdf {
  const p = novaPassagem('2026-11-10', 'Noturno', 'x')
  p.condicoes[0]!.c = 'Via 2 entre VJD e BPA em marcha à vista'
  p.alta = [{ l: 'VJD PDM13', d: 'Porta isolada aguardando peça; manter isolamento' }]
  p.media = [{ l: 'CZD', d: 'Iluminação do corredor técnico intermitente' }]
  p.programadas = [{ nome: 'AMV', tipo: 'P1', local: 'MOB' }]
  p.encerramento = 'Turno entregue ao diurno com as ocorrências acima.'
  const itens = Array.from({ length: n }, (_, i) => item(i + 1))
  itens.push(item(99, { categoria: 'Preventiva', tipoPrev: 'P1', titulo: 'AMV P1', local: 'MOB', sistema: 'AMV', cim: null, status: 'Não realizada', motivo: 'Sem liberação do CCO', reprogPedido: true, reprogData: '2026-11-12', reprogStatus: 'pendente', atuacao: null, minutos: null }))
  return { passagem: { ...p, versao: 2 }, itens, documentos: [{ nome: 'Corretiva_10112026_Noturno_01_exemplo_v1.pdf', tipo: 'relatorio' }] }
}

const paginas = async (b: Uint8Array) => (await PDFDocument.load(b)).getPageCount()

describe('PDF da passagem (FO.MNT.S.0009)', () => {
  it('turno comum cabe em uma página', async () => {
    expect(await paginas(await gerarPassagem(dadosExemploPassagem(3)))).toBe(1)
  })
  it('turno cheio continua em novas páginas sem perder linhas', async () => {
    expect(await paginas(await gerarPassagem(dadosExemploPassagem(40)))).toBeGreaterThan(1)
  })
  it('turno vazio também gera', async () => {
    const p = novaPassagem('2026-11-10', 'Diurno', 'y')
    expect(await paginas(await gerarPassagem({ passagem: p, itens: [], documentos: [] }))).toBe(1)
  })
})

describe('caminho do PDF da passagem', () => {
  it('separa por dia e turno, com a versão no nome', async () => {
    const { caminhoPassagem } = await import('./caminho')
    const c = caminhoPassagem('2026-11-10', 'Noturno', 3)
    expect(c.pasta).toMatch(/^Passagem de turno\/2026-11-10 .+\/Noturno$/)
    expect(c.nome).toBe('Passagem_de_turno_10112026_Noturno_v3.pdf')
  })
})
