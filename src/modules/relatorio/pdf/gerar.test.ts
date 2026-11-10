import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { novoRascunho, rascunhoParaLinha } from '../domain/rascunho'
import type { Atividade } from '../domain/tipos'
import type { DadosDocumento } from './dados'
import { gerarOS } from './os'
import { gerarRelatorio } from './relatorio'
import { gerarRM } from './rm'

// PNG 1x1 (serve como foto e como assinatura de teste)
const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0))

function dados(over: Partial<Atividade> = {}, nFotos = 0): DadosDocumento {
  const r = { ...novoRascunho('2026-11-10', 'Corretiva', 1, new Date(2026, 10, 10, 20)), titulo: 'Falha no reset do contador de eixos — 708 📷', status: 'Concluída' as const }
  const atividade = {
    ...rascunhoParaLinha(r), versao: 2, enviado_em: '2026-11-10T23:00:00Z', reprog_status: null,
    local: 'BPA / WAS', sistema: 'AMV', diagnostico: 'Linha 1\nLinha 2 '.repeat(40), intervencao: 'Reset no ZC-B',
    tempos: { prep: { i: '23:00', f: '23:10' }, desl: { i: '23:10', f: '23:30' }, lib: { i: '', f: '', na: true }, atu: { i: '23:30', f: '00:40' }, ret: { i: '00:40', f: '01:00' } },
    os: { numero: '123', materiais: [{ d: 'Relé', q: '1' }], impacto: 'Sem impacto' as const },
    resp_tecnico_id: 'p1',
    ...over,
  } as Atividade
  return {
    atividade, numero: 3,
    equipe: [{ id: 'p1', nome: 'Pessoa Um', matricula: '53000001' }, { id: 'p2', nome: 'Pessoa Dois', matricula: '53000002' }],
    pessoas: [{ id: 'p1', nome: 'Pessoa Um', matricula: '53000001' }, { id: 'p2', nome: 'Pessoa Dois', matricula: '53000002' }],
    fotos: Array.from({ length: nFotos }, (_, i) => ({ bytes: PNG, legenda: `Foto ${i + 1}` })),
    assinaturas: { 'p1:equipe': PNG, 'p1:resp_tecnico': PNG },
  }
}

const paginas = async (b: Uint8Array) => (await PDFDocument.load(b)).getPageCount()

describe('PDFs', () => {
  it('relatório com texto longo e 5 fotos quebra em várias páginas', async () => {
    const b = await gerarRelatorio(dados({}, 5))
    expect(new TextDecoder().decode(b.slice(0, 5))).toBe('%PDF-')
    expect(await paginas(b)).toBeGreaterThan(1)
  })
  it('relatório de preventiva com reprogramação', async () => {
    const b = await gerarRelatorio(dados({ categoria: 'Preventiva', tipo_prev: 'P1', feito: 'Inspeção', status: 'Em andamento', reprog_pedido: true, motivo: 'Sem CCO' }))
    expect(await paginas(b)).toBe(1)
  })
  it('OS cabe em uma página', async () => expect(await paginas(await gerarOS(dados()))).toBe(1))
  it('Registro de manutenção cabe em uma página', async () =>
    expect(await paginas(await gerarRM(dados({ categoria: 'Preventiva', tipo_prev: 'P3', feito: 'a\nb\nc' })))).toBe(1))
})
