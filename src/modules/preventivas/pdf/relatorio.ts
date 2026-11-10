import type { PDFImage } from 'pdf-lib'
import { A4, COR, novoDocumento, Pagina, TabelaPaginada } from '../../relatorio/pdf/folha'
import { dataBR } from '../../relatorio/pdf/texto'
import { chave } from '../domain/respostas'
import { itensPorUnidade, obsGeral, obsUnidade, resumir } from '../domain/resumo'
import { cabecalho, carregarAssinaturas, linhasTempos, MARGEM, novaPaginaCom, rodape } from './comum'
import { nomeDe, type DadosPreventivaPdf } from './dados'

/** Relatório da preventiva com resultados, tempos e registro fotográfico das ocorrências. */
export async function gerarRelatorio(d: DadosPreventivaPdf): Promise<Uint8Array> {
  const { preventiva: pv, modelo: m } = d
  const c = m.conteudo
  const { doc, f } = await novoDocumento(`Relatório ${m.sistemaNome} ${m.codigo} - ${pv.local ?? ''}`)
  const assin = await carregarAssinaturas(doc, d)
  const larg = A4.w - 2 * MARGEM
  const nova = novaPaginaCom(doc, f, (p) => cabecalho(p, d))
  const yMax = A4.h - MARGEM - 16
  let { p, y } = nova()

  // Identificação
  const t = new TabelaPaginada([1, 1, 1, 1], larg)
  const G2 = COR.cinzaForm2
  const sep = () => t.linhaP(8, [{ span: 4, semBorda: true }])
  const par = (a: [string, string], b?: [string, string]) =>
    t.linhaP(17, [
      { span: 1, texto: a[0], fundo: G2, negrito: true, tamanho: 7.5 },
      { span: b ? 1 : 3, texto: a[1] || '—' },
      ...(b ? [{ span: 1, texto: b[0], fundo: G2, negrito: true, tamanho: 7.5 }, { span: 1, texto: b[1] || '—' }] : []),
    ])
  par([c.local.rotulo, pv.local ?? ''], ['Data', [pv.data, ...pv.dias.map((x) => x.data)].map(dataBR).join(', ')])
  par(['Ordem de serviço', pv.os_numero ?? ''], ['Linha', pv.linha])
  for (const ce of c.camposExtras ?? []) if (pv.campos[ce.id]) par([ce.rotulo, pv.campos[ce.id]!])
  par(['Equipe', d.equipe.map((x) => x.nome || x.matricula).join(', ')])
  par(['Supervisor', nomeDe(d, pv.supervisor_id)], ['Situação', `${pv.status}${pv.motivo ? ` – ${pv.motivo}` : ''}`])
  if (pv.instrumentos.length)
    par(['Equipamentos utilizados', pv.instrumentos.map((i) => [i.nome, i.calibracao && `calibração ${i.calibracao}`, i.obs].filter(Boolean).join(' – ')).join('; ')])

  const s = resumir(c, pv)
  const fotosOc = d.fotos.filter((x) => x.ocorrenciaId)
  sep()
  t.linhaP(20, [
    {
      span: 4,
      fundo: COR.suave,
      texto: c.unidades
        ? `Verificações por ${c.unidades.rotulo.toLowerCase()}: ${s.porUnidade.total} · OK ${s.porUnidade.ok} · NOK ${s.porUnidade.nok.length}${s.porUnidade.na ? ` · NA ${s.porUnidade.na}` : ''} · Atividades gerais: ${s.geral.total} (OK ${s.geral.ok} · NOK ${s.geral.nok.length}) · Fotos: ${fotosOc.length}`
        : `Itens verificados: ${s.geral.total} · OK ${s.geral.ok} · NOK ${s.geral.nok.length}${s.geral.na ? ` · NA ${s.geral.na}` : ''} · Sem status: ${s.geral.branco.length} · Fotos: ${fotosOc.length}`,
      negrito: true,
    },
  ])
  ;({ p, y } = t.desenharPaginado(p, MARGEM, y, yMax, 8, nova))

  // Tempos (um bloco por dia)
  const tempos = new TabelaPaginada([1, 1, 1, 1, 1], larg)
  const dias = [{ data: pv.data, turno: pv.turno, tempos: pv.tempos }, ...pv.dias]
  tempos.linhaP(10, [{ span: 5, semBorda: true }])
  tempos.linhaP(14, [{ span: 5, texto: 'TEMPOS DA ATUAÇÃO', fundo: COR.cinzaForm, negrito: true, alinhar: 'centro' }], { juntoCom: 3 })
  for (const dia of dias) {
    const lt = linhasTempos(dia.tempos)
    if (dias.length > 1) tempos.linhaP(12, [{ span: 5, texto: `${dataBR(dia.data)} · ${dia.turno}`, negrito: true, tamanho: 7.5 }], { juntoCom: 2 })
    tempos.linhaP(13, lt.map((x) => ({ span: 1, texto: x.rotulo, fundo: x.k === 'atu' ? COR.cinzaForm : G2, negrito: true, alinhar: 'centro' as const, tamanho: 7 })))
    tempos.linhaP(20, lt.map((x) => ({ span: 1, texto: `${x.faixa}\n${x.dur}`, alinhar: 'centro' as const, negrito: x.k === 'atu' })))
  }
  ;({ p, y } = tempos.desenharPaginado(p, MARGEM, y, yMax, 8, nova))

  const itens = new Map(c.itens.map((i) => [i.id, i]))
  const DI = itensPorUnidade(c)
  if (c.unidades && DI.length) {
    const mu = c.medicaoUnidade
    const cols = [1.4, ...DI.map(() => 1), ...(mu ? [1.4] : []), Math.max(4, 10 - DI.length)]
    for (const gr of c.unidades.grupos) {
      const tu = new TabelaPaginada(cols, larg)
      const n = cols.length
      tu.linhaP(10, [{ span: n, semBorda: true }])
      tu.linhaP(14, [{ span: n, texto: `${gr.nome.toUpperCase()} · RESULTADOS POR ${c.unidades.rotulo.toUpperCase()}`, fundo: COR.cinzaForm, negrito: true, alinhar: 'centro' }], { juntoCom: 2 })
      tu.linhaP(
        13,
        [
          { span: 1, texto: c.unidades.rotulo, fundo: G2, negrito: true, alinhar: 'centro' },
          ...DI.map((i) => ({ span: 1, texto: i, fundo: G2, negrito: true, alinhar: 'centro' as const })),
          ...(mu ? [{ span: 1, texto: mu.rotulo, fundo: G2, negrito: true, alinhar: 'centro' as const, tamanho: 6 }] : []),
          { span: 1, texto: 'Observações', fundo: G2, negrito: true, alinhar: 'centro' },
        ],
        { repetir: true },
      )
      for (const u of gr.unidades) {
        tu.linhaP(16, [
          { span: 1, texto: u, negrito: true, alinhar: 'centro' },
          ...DI.map((i) => {
            const v = pv.respostas[chave(i, u)]?.r
            return { span: 1, texto: v ?? '—', alinhar: 'centro' as const, negrito: v === 'NOK', fundo: v === 'NOK' ? COR.cinzaForm : undefined }
          }),
          ...(mu ? [{ span: 1, texto: String(pv.respostas[chave(mu.item, u)]?.med?.un ?? '—'), alinhar: 'centro' as const }] : []),
          { span: 1, texto: obsUnidade(c, pv, u, false) || '—', tamanho: 6.5 },
        ])
      }
      ;({ p, y } = tu.desenharPaginado(p, MARGEM, y, yMax, 7.5, nova))
    }
    // legenda dos itens por unidade
    const leg = new TabelaPaginada([1, 7, 6], larg)
    leg.linhaP(8, [{ span: 3, semBorda: true }])
    leg.linhaP(13, [
      { span: 1, texto: 'Item', fundo: G2, negrito: true, alinhar: 'centro' },
      { span: 1, texto: `Atividade (por ${c.unidades.rotulo.toLowerCase()})`, fundo: G2, negrito: true },
      { span: 1, texto: 'Critério de aceitação', fundo: G2, negrito: true },
    ], { repetir: true })
    for (const id of DI) leg.linhaP(28, [{ span: 1, texto: id, alinhar: 'centro' }, { span: 1, texto: itens.get(id)?.atividade ?? '', tamanho: 7 }, { span: 1, texto: itens.get(id)?.criterio ?? '', tamanho: 7 }])
    ;({ p, y } = leg.desenharPaginado(p, MARGEM, y, yMax, 7.5, nova))
  }

  if (c.grupos.some((g) => g.escopo === 'geral')) {
    const tg = new TabelaPaginada([1, 5, 4, 1.3, 4.2], larg)
    tg.linhaP(10, [{ span: 5, semBorda: true }])
    tg.linhaP(14, [{ span: 5, texto: (c.tituloGeral ?? (DI.length ? 'Atividades gerais do sistema' : 'Itens verificados')).toUpperCase(), fundo: COR.cinzaForm, negrito: true, alinhar: 'centro' }], { juntoCom: 2 })
    tg.linhaP(
      13,
      ['Item', 'Atividade', 'Critério de aceitação', 'Status', 'Observações'].map((x) => ({ span: 1, texto: x, fundo: G2, negrito: true, alinhar: 'centro' as const })),
      { repetir: true },
    )
    let ultimo = ''
    for (const g of c.grupos.filter((x) => x.escopo === 'geral')) {
      if (g.titulo !== ultimo) tg.linhaP(13, [{ span: 5, texto: g.titulo, fundo: COR.suave, negrito: true, tamanho: 7.5 }], { juntoCom: 1 })
      ultimo = g.titulo
      for (const id of g.itens) {
        const v = pv.respostas[id]?.r
        tg.linhaP(30, [
          { span: 1, texto: id, alinhar: 'centro' },
          { span: 1, texto: itens.get(id)?.atividade ?? '', tamanho: 7 },
          { span: 1, texto: itens.get(id)?.criterio ?? '', tamanho: 7 },
          { span: 1, texto: v ?? '—', alinhar: 'centro', negrito: true, fundo: v === 'NOK' ? COR.cinzaForm : undefined },
          { span: 1, texto: obsGeral(c, pv, id) || '—', tamanho: 7 },
        ])
      }
    }
    ;({ p, y } = tg.desenharPaginado(p, MARGEM, y, yMax, 7.5, nova))
  }

  // Observações e assinaturas
  const fim = new TabelaPaginada([1, 1, 1], larg)
  fim.linhaP(10, [{ span: 3, semBorda: true }])
  fim.linhaP(40, [{ span: 3, texto: `Observações gerais: ${pv.observacoes ?? '—'}`, topo: true }])
  fim.linhaP(10, [{ span: 3, semBorda: true }], { juntoCom: 2 })
  const tecId = pv.resp_tecnico_id ?? d.equipe[0]?.id ?? null
  const tecPapel = pv.resp_tecnico_id ? 'resp_tecnico' : 'equipe'
  fim.linhaP(36, [
    { span: 1, imagem: assin(tecId, tecPapel), semBorda: true },
    { span: 1, semBorda: true },
    { span: 1, imagem: assin(pv.lider_id, 'lider'), semBorda: true },
  ])
  fim.linhaP(14, [
    { span: 1, texto: `Responsável pela execução${tecId ? `: ${nomeDe(d, tecId)}` : ''}`, alinhar: 'centro', tamanho: 7.5 },
    { span: 1, semBorda: true },
    { span: 1, texto: `Supervisor / conferência${pv.lider_id ?? pv.supervisor_id ? `: ${nomeDe(d, pv.lider_id ?? pv.supervisor_id)}` : ''}`, alinhar: 'centro', tamanho: 7.5 },
  ])
  ;({ p, y } = fim.desenharPaginado(p, MARGEM, y, yMax, 8, nova))

  // Registro fotográfico: 2 fotos por página, com a ocorrência
  const imgs: { img: PDFImage; titulo: string; texto: string }[] = []
  let n = 0
  for (const oc of pv.ocorrencias) {
    for (const foto of d.fotos.filter((x) => x.ocorrenciaId === oc.id)) {
      try {
        const img = await doc.embedJpg(foto.bytes)
        n++
        const it = oc.item ? itens.get(oc.item) : undefined
        imgs.push({
          img,
          titulo: `Foto ${String(n).padStart(2, '0')}${oc.unidade ? ` · ${oc.unidade}` : ''}${oc.item ? ` · Item ${oc.item}` : ''}${it?.curto ? ` · ${it.curto}` : ''}`,
          texto: [oc.texto, foto.legenda].filter(Boolean).join(' – '),
        })
      } catch {
        // foto ilegível: pula
      }
    }
  }
  for (let i = 0; i < imgs.length; i += 2) {
    ;({ p, y } = nova())
    p.texto(i ? 'Registro fotográfico – continuação' : 'Registro fotográfico', MARGEM, y, { tamanho: 11, fonte: p.f.negrito })
    y += 20
    const h = (yMax - y - 10) / 2
    for (const item of imgs.slice(i, i + 2)) {
      p.retangulo(MARGEM, y, larg, h, { borda: COR.linha })
      p.texto(item.titulo, MARGEM + 6, y + 6, { tamanho: 8.5, fonte: p.f.negrito })
      const usado = item.texto ? p.paragrafo(item.texto, MARGEM + 6, y + 19, larg - 12, { tamanho: 8 }) : 0
      p.imagem(item.img, MARGEM + 6, y + 22 + usado, larg - 12, h - 28 - usado)
      y += h + 10
    }
  }

  const paginas = doc.getPages()
  paginas.forEach((pg, i) => rodape(new Pagina(pg, f), i + 1, paginas.length))
  return doc.save()
}
