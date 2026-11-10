import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import bruto from '../../../../supabase/seed/checklists.json?raw'
import { temposVazios } from '../../relatorio/domain/tempos'
import type { ModeloChecklist } from '../domain/modelo'
import { novaPreventiva, type Preventiva } from '../domain/preventiva'
import { linhas, marcarPendentesOk } from '../domain/respostas'
import type { DadosPreventivaPdf } from './dados'
import { gerarRegistro } from './registro'
import { gerarRelatorio } from './relatorio'
import { gerarRoteiro } from './roteiro'

const modelos = (JSON.parse(bruto) as { modelos: ModeloChecklist[] }).modelos
const pessoas = [
  { id: 'u1', nome: 'Pessoa Exemplo Um', matricula: '1001' },
  { id: 'u2', nome: 'Pessoa Exemplo Dois', matricula: '1002' },
]

export function dadosExemplo(id: string): DadosPreventivaPdf {
  const modelo = modelos.find((m) => m.id === id)!
  const r = novaPreventiva(modelo, '2026-11-10', 'Noturno')
  const primeira = linhas(modelo.conteudo)[0]!
  const k = primeira.unidade ? `${primeira.item}@${primeira.unidade}` : primeira.item
  const respostas = marcarPendentesOk(modelo.conteudo, { [k]: { r: 'NOK', obs: 'Não conformidade de exemplo' } })
  const preventiva: Preventiva = {
    ...r,
    local: modelo.conteudo.local.opcoes?.[0] ?? 'Trecho exemplo',
    os_numero: '12345',
    respostas,
    tempos: { ...temposVazios(), prep: { i: '23:00', f: '23:10' }, atu: { i: '23:30', f: '01:15' } },
    ocorrencias: [{ id: 'oc1', item: primeira.item, unidade: primeira.unidade ?? null, texto: 'Não conformidade de exemplo' }],
    instrumentos: [{ nome: 'Multímetro', calibracao: 'válida até 03/2027' }],
    status: 'Em andamento',
    supervisor_id: 'u2',
    modelo_versao: 1,
    versao: 1,
    enviado_em: '2026-11-10T03:00:00Z',
    reprog_status: null,
    criado_por: 'u1',
  }
  return { preventiva, modelo, equipe: pessoas, pessoas, fotos: [], assinaturas: {} }
}

async function paginas(bytes: Uint8Array) {
  expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
  return (await PDFDocument.load(bytes)).getPageCount()
}

describe('PDFs da preventiva', () => {
  it.each(['psd-1m', 'psd-6m', 'amv-p3', 'tri-1m', 'aaru-p1'])('%s gera relatório, roteiro e registro', async (id) => {
    const d = dadosExemplo(id)
    expect(await paginas(await gerarRelatorio(d))).toBeGreaterThanOrEqual(1)
    expect(await paginas(await gerarRoteiro(d))).toBeGreaterThanOrEqual(1)
    expect(await paginas(await gerarRegistro(d))).toBe(1)
  })

  it('todos os 47 modelos geram o roteiro sem erro', async () => {
    for (const m of modelos) expect(await paginas(await gerarRoteiro(dadosExemplo(m.id)))).toBeGreaterThanOrEqual(1)
  })
})
