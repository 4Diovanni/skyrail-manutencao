import { A4, COR, novoDocumento, Pagina, Tabela } from '../../relatorio/pdf/folha'
import { dataBR, quebrarLinhas } from '../../relatorio/pdf/texto'
import { linhasRegistro, resumir } from '../domain/resumo'
import { carregarAssinaturas, MARGEM } from './comum'
import { nomeDe, type DadosPreventivaPdf } from './dados'

const NIVEIS: [string, string][] = [
  ['PQ', 'QUINZENAL (15D)'],
  ['P1', 'MENSAL (1M)'],
  ['P3', 'TRIMESTRAL (3M)'],
  ['P6', 'SEMESTRAL (6M)'],
  ['P12', 'ANUAL (1A)'],
]
const LINHAS = 40

/** Registro de Manutenção (FO.MNT.S.0008) da preventiva, mesma estrutura do app original. */
export async function gerarRegistro(d: DadosPreventivaPdf): Promise<Uint8Array> {
  const { preventiva: pv, modelo: m } = d
  const c = m.conteudo
  const { doc, f } = await novoDocumento(`Registro de Manutenção ${m.sistemaNome} ${m.codigo} - ${pv.local ?? ''}`)
  const p = new Pagina(doc.addPage([A4.w, A4.h]), f)
  const assin = await carregarAssinaturas(doc, d)
  const t = new Tabela([21.71, 18, 14, 13, 13, 13, 13, 17, 14, 13], A4.w - 2 * MARGEM)
  const G = COR.cinzaForm

  // Cada frase quebra em linhas do formulário (largura da coluna de descrição, 7,5 pt).
  const largDesc = t.w(0, 8) - 5
  const linhas = linhasRegistro(m, pv).flatMap((frase) => {
    const partes = quebrarLinhas(frase, f.normal, 7.5, largDesc)
    // título de bloco ("...:") continua em negrito na primeira parte
    return partes
  })
  // Uma folha só: o que passar de 40 linhas fica no relatório da preventiva.
  if (linhas.length > LINHAS) linhas.splice(LINHAS - 1, linhas.length, '(continua: detalhamento completo no relatório e no roteiro da preventiva)')
  const tecs = d.equipe.map((x) => x.nome || x.matricula || '')

  t.linha(53, [
    { span: 1, texto: 'Metrô L17 Ouro', negrito: true, alinhar: 'centro', tamanho: 7 },
    { span: 7, texto: 'REGISTRO DE MANUTENÇÃO', negrito: true, alinhar: 'centro', tamanho: 14 },
    { span: 2, texto: 'FO.MNT.S.0008\nRev.: 00', alinhar: 'centro' },
  ])
  const lv = (l: string, v: string | null | undefined) =>
    t.linha(15, [{ span: 2, texto: l, fundo: G, negrito: true }, { span: 8, texto: v ?? '', negrito: true, alinhar: 'centro' }])
  lv('DATA', [pv.data, ...pv.dias.map((x) => x.data)].map(dataBR).join(', '))
  lv(`${c.local.rotulo.toUpperCase()} / LOCAL:`, pv.local)
  lv('SISTEMA:', c.sistemaTexto ?? m.sistemaNome)
  lv('EQUIPAMENTO:', [c.equipamento ?? m.sistemaDescricao, ...Object.values(pv.campos)].filter(Boolean).join(' · '))
  t.linha(10, [{ span: 10, semBorda: true }])
  t.linha(15.75, [{ span: 10, texto: 'NÍVEL DE MANUTENÇÃO', fundo: G, negrito: true, alinhar: 'centro' }])
  t.linha(
    30,
    NIVEIS.map(([k, txt]) => ({ span: 2, texto: `${m.tipoPrev === k ? '[X]' : '[ ]'} ${txt}`, negrito: m.tipoPrev === k })),
  )
  if (!NIVEIS.some(([k]) => k === m.tipoPrev)) t.linha(15, [{ span: 10, texto: `[X] ${m.periodicidade.toUpperCase()} (${m.codigo})`, negrito: true }])
  t.linha(10, [{ span: 10, semBorda: true }])
  t.linha(15.75, [{ span: 10, texto: 'REGISTRO DE ATIVIDADES REALIZADAS', fundo: G, negrito: true, alinhar: 'centro' }])
  t.linha(15.75, [
    { span: 8, texto: 'DESCRIÇÃO DA ATIVIDADE / ANOMALIA E AÇÃO TOMADA', fundo: G, negrito: true, alinhar: 'centro' },
    { span: 2, texto: 'TÉCNICOS', fundo: G, negrito: true, alinhar: 'centro' },
  ])
  for (let i = 0; i < Math.max(18, linhas.length, tecs.length); i++) {
    const l = linhas[i] ?? ''
    t.linha(15, [{ span: 8, texto: l, negrito: /^(Não conformidades|Outras observações).*:$/.test(l) }, { span: 2, texto: tecs[i] ?? '', alinhar: 'centro' }])
  }
  t.linha(10, [{ span: 10, semBorda: true }])
  t.linha(15.75, [{ span: 10, texto: 'APROVAÇÕES', fundo: G, negrito: true, alinhar: 'centro' }])
  t.linha(15.75, [
    { span: 3, texto: 'TÉCNICO', fundo: G, negrito: true, alinhar: 'centro' },
    { span: 3, texto: 'Líder de Manutenção', fundo: G, negrito: true, alinhar: 'centro' },
    { span: 4, texto: 'GESTOR', fundo: G, negrito: true, alinhar: 'centro' },
  ])
  const tecId = pv.resp_tecnico_id ?? d.equipe[0]?.id ?? null
  const tecPapel = pv.resp_tecnico_id ? 'resp_tecnico' : 'equipe'
  const liderId = pv.lider_id ?? pv.supervisor_id
  t.linha(15.75, [
    { span: 3, texto: `Nome: ${nomeDe(d, tecId)}` },
    { span: 3, texto: `Nome: ${nomeDe(d, liderId)}` },
    { span: 4, texto: `Nome: ${nomeDe(d, pv.gestor_id)}` },
  ])
  t.linha(34, [
    { span: 3, imagem: assin(tecId, tecPapel), texto: 'Assinatura:', topo: true },
    { span: 3, imagem: assin(pv.lider_id, 'lider'), texto: 'Assinatura:', topo: true },
    { span: 4, imagem: assin(pv.gestor_id, 'gestor'), texto: 'Assinatura:', topo: true },
  ])
  t.linha(15.75, [{ span: 3, texto: `Data: ${dataBR(pv.data)}` }, { span: 3, texto: 'Data:' }, { span: 4, texto: 'Data:' }])
  t.linha(10, [{ span: 10, semBorda: true }])
  const s = resumir(c, pv)
  const ok = s.porUnidade.ok + s.geral.ok
  const nok = s.porUnidade.nok.length + s.geral.nok.length
  const na = s.porUnidade.na + s.geral.na
  t.linha(45, [
    {
      span: 10,
      topo: true,
      texto: `OBSERVAÇÕES: Resumo da preventiva: ${ok} OK · ${nok} NOK${na ? ` · ${na} NA` : ''}. Situação: ${pv.status}${pv.motivo ? ` (${pv.motivo})` : ''}. Detalhamento ${c.unidades ? 'por porta' : 'por item'} no roteiro${pv.os_numero ? `, ordem ${pv.os_numero}` : ''}, e registro fotográfico no relatório da preventiva.`,
    },
  ])
  t.desenhar(p, MARGEM, 34, A4.h - 68, 7.5)
  return doc.save()
}
