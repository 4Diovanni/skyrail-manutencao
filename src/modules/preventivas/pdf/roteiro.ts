import { A4, COR, novoDocumento, Pagina, TabelaPaginada } from '../../relatorio/pdf/folha'
import { dataBR } from '../../relatorio/pdf/texto'
import { chave } from '../domain/respostas'
import { itensPorUnidade, obsGeral, obsUnidade } from '../domain/resumo'
import { MARGEM, novaPaginaCom, rodape } from './comum'
import type { DadosPreventivaPdf } from './dados'

const W = [10, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 11, 11, 11, 11]

/** Roteiro de preventiva: réplica da planilha do formulário (FO.MTS.M.00xx), com resultados por porta e por item. */
export async function gerarRoteiro(d: DadosPreventivaPdf): Promise<Uint8Array> {
  const { preventiva: pv, modelo: m } = d
  const c = m.conteudo
  const { doc, f } = await novoDocumento(`Roteiro ${m.sistemaNome} ${m.codigo} - ${pv.local ?? ''}`)
  const t = new TabelaPaginada(W, A4.w - 2 * MARGEM)
  const G = COR.cinzaForm
  const G2 = COR.cinzaForm2
  const sep = () => t.linhaP(7, [{ span: 16, semBorda: true }])

  t.linhaP(48, [
    { span: 13, texto: `${c.tituloRoteiro ?? `ROTEIRO DE ${c.titulo}`}${m.formulario ? `\n${m.formulario} · Rev.: 00` : ''}`, negrito: true, alinhar: 'centro', tamanho: 12 },
    { span: 3, texto: 'Metrô L17 Ouro', negrito: true, alinhar: 'centro', tamanho: 8 },
  ])
  t.linhaP(20, [
    { span: 4, texto: `REF. MANUAL: ${c.referencia ?? '—'}`, negrito: true, alinhar: 'centro' },
    { span: 3, texto: `Data: ${dataBR(pv.data)}${pv.dias.length ? ` (+${pv.dias.length} dia${pv.dias.length > 1 ? 's' : ''})` : ''}`, negrito: true },
    { span: 4, texto: `Nº DA ORDEM: ${pv.os_numero ?? ''}`, negrito: true },
    { span: 5, texto: `${c.local.rotulo.toUpperCase()}: ${pv.local ?? ''}`, negrito: true },
  ])
  const extras = (c.camposExtras ?? []).filter((ce) => pv.campos[ce.id])
  if (extras.length) t.linhaP(16, [{ span: 16, texto: extras.map((ce) => `${ce.rotulo}: ${pv.campos[ce.id]}`).join('   ·   '), negrito: true }])
  t.linhaP(13, [
    { span: 7, texto: 'EQUIPAMENTO UTILIZADO', fundo: G2, negrito: true, alinhar: 'centro' },
    { span: 4, texto: 'CALIBRAÇÃO', fundo: G2, negrito: true, alinhar: 'centro' },
    { span: 5, texto: 'OBSERVAÇÃO', fundo: G2, negrito: true, alinhar: 'centro' },
  ])
  for (let i = 0; i < Math.max(3, pv.instrumentos.length); i++) {
    const ins = pv.instrumentos[i]
    t.linhaP(15, [{ span: 7, texto: ins?.nome ?? '' }, { span: 4, texto: ins?.calibracao ?? '' }, { span: 5, texto: ins?.obs ?? '' }])
  }

  const itens = new Map(c.itens.map((i) => [i.id, i]))
  const grupoRows = (escopo: 'unidade' | 'geral', item: (id: string) => void) => {
    let ultimo = ''
    for (const g of c.grupos.filter((x) => x.escopo === escopo)) {
      if (g.titulo !== ultimo) t.linhaP(13, [{ span: 16, texto: g.titulo, fundo: G, negrito: true, alinhar: 'centro' }], { juntoCom: 1 })
      ultimo = g.titulo
      if (g.subtitulo) t.linhaP(12, [{ span: 16, texto: g.subtitulo, fundo: COR.suave, negrito: true, alinhar: 'centro', tamanho: 7.5 }], { juntoCom: 1 })
      g.itens.forEach(item)
    }
  }

  const DI = itensPorUnidade(c)
  if (c.unidades && DI.length) {
    const rot = c.unidades.rotulo
    sep()
    t.linhaP(16, [{ span: 16, texto: `ATIVIDADES POR ${rot.toUpperCase()} — ${c.unidades.grupos.map((g) => g.nome.toUpperCase()).join(' E ')}`, fundo: G, negrito: true, alinhar: 'centro', tamanho: 9.5 }])
    t.linhaP(13, [{ span: 1, texto: 'ITEM', fundo: G2, negrito: true, alinhar: 'centro' }, { span: 15, texto: 'DESCRIÇÃO DE ATIVIDADE', fundo: G2, negrito: true, alinhar: 'centro' }], { repetir: true })
    grupoRows('unidade', (id) => t.linhaP(22, [{ span: 1, texto: id, alinhar: 'centro' }, { span: 15, texto: itens.get(id)?.atividade ?? '' }]))
    const mu = c.medicaoUnidade
    const nc = DI.length + (mu ? 1 : 0)
    const obsSpan = Math.max(1, 15 - nc)
    for (const gr of c.unidades.grupos) {
      sep()
      t.linhaP(16, [{ span: 16, texto: gr.nome.toUpperCase(), fundo: G, negrito: true, alinhar: 'centro', tamanho: 9.5 }], { juntoCom: 2 })
      t.linhaP(
        14,
        [
          { span: 1, texto: rot, fundo: G2, negrito: true, alinhar: 'centro' },
          ...DI.map((i) => ({ span: 1, texto: i, fundo: G2, negrito: true, alinhar: 'centro' as const })),
          ...(mu ? [{ span: 1, texto: mu.rotulo.replace(/^[^(]*\(([^)]*)\).*$/, '$1') || 'Med.', fundo: G2, negrito: true, alinhar: 'centro' as const }] : []),
          { span: obsSpan, texto: 'OBSERVAÇÕES', fundo: G2, negrito: true, alinhar: 'centro' },
        ],
        { repetir: true },
      )
      for (const u of gr.unidades) {
        const obs = obsUnidade(c, pv, u, false)
        t.linhaP(15, [
          { span: 1, texto: u, alinhar: 'centro', negrito: true },
          ...DI.map((i) => {
            const v = pv.respostas[chave(i, u)]?.r
            return { span: 1, texto: v ?? '', alinhar: 'centro' as const, negrito: v === 'NOK' }
          }),
          ...(mu ? [{ span: 1, texto: String(pv.respostas[chave(mu.item, u)]?.med?.un ?? ''), alinhar: 'centro' as const }] : []),
          { span: obsSpan, texto: obs, tamanho: 6.5 },
        ])
      }
    }
    t.linhaP(13, [{ span: 16, texto: `Preenchimento por ${rot.toLowerCase()}: OK / NOK / NA (não aplicável). Todo NOK deve ser descrito em Observações.`, tamanho: 7 }])
  }

  const geral = c.grupos.some((g) => g.escopo === 'geral')
  if (geral) {
    sep()
    t.linhaP(16, [{ span: 16, texto: (c.tituloGeral ?? (DI.length ? 'Atividades gerais do sistema' : 'Itens de inspeção')).toUpperCase(), fundo: G, negrito: true, alinhar: 'centro', tamanho: 9.5 }], { juntoCom: 2 })
    t.linhaP(
      13,
      [
        { span: 1, texto: 'ITEM', fundo: G2, negrito: true, alinhar: 'centro' },
        { span: 9, texto: 'DESCRIÇÃO DE ATIVIDADE', fundo: G2, negrito: true, alinhar: 'centro' },
        { span: 2, texto: 'STATUS', fundo: G2, negrito: true, alinhar: 'centro' },
        { span: 4, texto: 'OBSERVAÇÕES', fundo: G2, negrito: true, alinhar: 'centro' },
      ],
      { repetir: true },
    )
    grupoRows('geral', (id) => {
      const v = pv.respostas[id]?.r
      const obs = `${v === 'NA' ? 'NA – não aplicável. ' : ''}${obsGeral(c, pv, id)}`
      t.linhaP(26, [
        { span: 1, texto: id, alinhar: 'centro' },
        { span: 9, texto: itens.get(id)?.atividade ?? '' },
        { span: 1, texto: `OK\n${v === 'OK' ? 'X' : ''}`, alinhar: 'centro', topo: true, tamanho: 7 },
        { span: 1, texto: `NOK\n${v === 'NOK' ? 'X' : ''}`, alinhar: 'centro', topo: true, tamanho: 7 },
        { span: 4, texto: obs, tamanho: 6.5 },
      ])
    })
  }
  if (c.nota) {
    sep()
    t.linhaP(22, [{ span: 16, texto: c.nota, tamanho: 7, semBorda: true }])
  }

  const topo = () => MARGEM
  const primeira = new Pagina(doc.addPage([A4.w, A4.h]), f)
  t.desenharPaginado(primeira, MARGEM, MARGEM, A4.h - MARGEM - 14, 7.5, novaPaginaCom(doc, f, topo))
  const paginas = doc.getPages()
  paginas.forEach((pg, i) => rodape(new Pagina(pg, f), i + 1, paginas.length))
  return doc.save()
}
