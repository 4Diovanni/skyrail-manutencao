import type { PDFImage } from 'pdf-lib'
import { duracaoEtapa, formatarMinutos } from '../domain/tempos'
import { ETAPAS } from '../domain/tipos'
import { juntarNomes, nomesEquipe, type DadosDocumento } from './dados'
import { A4, COR, novoDocumento, Pagina, type Fontes } from './folha'
import { dataBR, quebrarLinhas } from './texto'

const M = 40 // margem lateral
const LARG = A4.w - 2 * M
const RODAPE = 50 // altura reservada para o rodapé

const CORES_STATUS: Record<string, keyof typeof COR> = { 'Concluída': 'verde', 'Em andamento': 'diurno', 'Não realizada': 'vermelho' }

function cabecalho(p: Pagina, titulo: string, turno: string) {
  const codW = 130
  p.retangulo(M, 30, LARG, 44, { borda: COR.linha })
  p.retangulo(M + LARG - codW, 30, codW, 44, { borda: COR.linha })
  p.paragrafo(titulo.toUpperCase(), M + 8, 40, LARG - codW - 16, { tamanho: 12, fonte: p.f.negrito, alinhar: 'centro' })
  p.texto('FO.MNT.S.0012', M + LARG - codW + 8, 36, { tamanho: 7.5 })
  p.texto('Rev.: 00', M + LARG - codW + 8, 48, { tamanho: 7.5 })
  p.texto('Data: 31/07/2026', M + LARG - codW + 8, 60, { tamanho: 7.5 })
  p.retangulo(M, 74, LARG - codW, 14, { fundo: COR.azul })
  p.texto('Manutenção de Sistemas BYD - Linha 17 Ouro', M, 77, { tamanho: 8, fonte: p.f.negrito, cor: COR.branco, alinhar: 'centro', largura: LARG - codW })
  p.retangulo(M + LARG - codW, 74, codW, 14, { fundo: rgbAmarelo() })
  p.texto(turno, M + LARG - codW, 77, { tamanho: 8, fonte: p.f.negrito, alinhar: 'centro', largura: codW })
}
const rgbAmarelo = () => COR.amarelo

class Fluxo {
  paginas: Pagina[] = []
  y = 0
  readonly novaPagina: () => Pagina
  constructor(novaPagina: () => Pagina) {
    this.novaPagina = novaPagina
    this.quebrar(false)
  }
  get p(): Pagina {
    return this.paginas[this.paginas.length - 1]!
  }
  quebrar(continuacao = true) {
    this.paginas.push(this.novaPagina())
    this.y = 104
    if (continuacao) {
      this.p.texto('(continuação)', M, this.y, { tamanho: 8, fonte: this.p.f.negrito, cor: COR.cinza })
      this.y += 16
    }
  }
  garantir(h: number) {
    if (this.y + h > A4.h - RODAPE) this.quebrar()
  }
}

function secao(fl: Fluxo, titulo: string) {
  fl.garantir(40)
  fl.p.texto(titulo, M, fl.y, { tamanho: 11, fonte: fl.p.f.negrito })
  const w = fl.p.f.negrito.widthOfTextAtSize(titulo, 11)
  fl.p.linhaH(M + w + 8, fl.y + 6, LARG - w - 8, COR.linha, 1.5)
  fl.y += 20
}

/** Parágrafos com barra amarela à esquerda; quebram de página quando preciso. */
function blocoTexto(fl: Fluxo, paragrafos: { rotulo?: string; texto: string }[], cor = COR.amarelo) {
  const tam = 9.5
  const lh = tam * 1.45
  for (const par of paragrafos) {
    const txt = par.rotulo ? `${par.rotulo}: ${par.texto}` : par.texto
    const linhas = quebrarLinhas(txt, fl.p.f.normal, tam, LARG - 16)
    for (const l of linhas) {
      fl.garantir(lh)
      fl.p.retangulo(M, fl.y - 1, 3.5, lh, { fundo: cor })
      fl.p.texto(l, M + 12, fl.y, { tamanho: tam })
      fl.y += lh
    }
    fl.y += 4
  }
  fl.y += 4
}

function grade(fl: Fluxo, cel: { r: string; v: string; span: number; destaque?: boolean }[]) {
  const gap = 6
  const colW = (LARG - 3 * gap) / 4
  let col = 0
  let linhaY = fl.y
  let alturaLinha = 0
  for (const c of cel) {
    if (col + c.span > 4) {
      linhaY += alturaLinha + gap
      col = 0
      alturaLinha = 0
    }
    const w = colW * c.span + gap * (c.span - 1)
    const x = M + col * (colW + gap)
    const linhas = quebrarLinhas(c.v || '—', fl.p.f.negrito, 9.5, w - 14)
    const h = 20 + linhas.length * 12
    fl.p.retangulo(x, linhaY, w, h, c.destaque ? { fundo: COR.branco, borda: COR.amarelo, espessura: 1 } : { fundo: COR.suave })
    fl.p.texto(c.r, x + 7, linhaY + 6, { tamanho: 6.8, fonte: fl.p.f.negrito, cor: COR.cinza })
    linhas.forEach((l, i) => fl.p.texto(l, x + 7, linhaY + 17 + i * 12, { tamanho: 9.5, fonte: fl.p.f.negrito }))
    alturaLinha = Math.max(alturaLinha, h)
    col += c.span
  }
  fl.y = linhaY + alturaLinha + 10
}

function tempos(fl: Fluxo, d: DadosDocumento) {
  const a = d.atividade
  const gap = 5
  const w = (LARG - 5 * gap) / 6
  const h = 62
  fl.garantir(h + 10)
  ETAPAS.forEach(([k, rotulo], i) => {
    const t = a.tempos[k]
    const dur = duracaoEtapa(t)
    const x = M + i * (w + gap)
    const na = dur == null
    fl.p.retangulo(x, fl.y, w, h, { fundo: na ? COR.suave : k === 'atu' ? rgbClaro() : COR.branco, borda: COR.linha })
    fl.p.retangulo(x, fl.y, w, 3, { fundo: na ? COR.linha : k === 'atu' ? COR.amarelo : COR.azul })
    fl.p.paragrafo(rotulo, x + 5, fl.y + 7, w - 10, { tamanho: 6.8, fonte: fl.p.f.negrito, cor: COR.cinza, entrelinha: 8 })
    if (na) {
      fl.p.texto('N/A', x + 5, fl.y + 30, { tamanho: 10, fonte: fl.p.f.negrito, cor: COR.cinza })
      fl.p.texto('não se aplica', x + 5, fl.y + 46, { tamanho: 6.8, cor: COR.cinza })
    } else {
      fl.p.texto(`${t!.i} - ${t!.f}`, x + 5, fl.y + 30, { tamanho: 9, fonte: fl.p.f.negrito })
      fl.p.texto(formatarMinutos(dur), x + 5, fl.y + 46, { tamanho: 7.5, cor: COR.cinza })
    }
  })
  const x = M + 5 * (w + gap)
  const total = duracaoEtapa(a.tempos.atu)
  fl.p.retangulo(x, fl.y, w, h, { fundo: COR.ardosia })
  fl.p.paragrafo('Tempo de atuação', x + 5, fl.y + 7, w - 10, { tamanho: 6.8, fonte: fl.p.f.negrito, cor: COR.branco, entrelinha: 8 })
  fl.p.texto(total != null ? formatarMinutos(total) : 'N/A', x + 5, fl.y + 27, { tamanho: 14, fonte: fl.p.f.negrito, cor: COR.branco })
  if (total != null) fl.p.texto(`${a.tempos.atu!.i} às ${a.tempos.atu!.f}`, x + 5, fl.y + 47, { tamanho: 6.8, cor: COR.branco })
  fl.y += h + 14
}
const rgbClaro = () => COR.suave

async function fotos(fl: Fluxo, d: DadosDocumento, embed: (b: Uint8Array) => Promise<PDFImage | null>) {
  if (!d.fotos.length) return
  secao(fl, 'Registro fotográfico')
  const gap = 10
  const w = (LARG - gap) / 2
  const h = 190
  for (let i = 0; i < d.fotos.length; i += 2) {
    fl.garantir(h + 30)
    for (let j = 0; j < 2 && i + j < d.fotos.length; j++) {
      const f = d.fotos[i + j]!
      const x = M + j * (w + gap)
      fl.p.retangulo(x, fl.y, w, h, { fundo: COR.suave })
      const img = await embed(f.bytes)
      if (img) fl.p.imagem(img, x, fl.y, w, h)
      if (f.legenda) fl.p.paragrafo(f.legenda, x, fl.y + h + 4, w, { tamanho: 7.8, fonte: fl.p.f.italico, alinhar: 'centro', entrelinha: 9.5 })
    }
    fl.y += h + 30
  }
}

function rodapes(paginas: Pagina[], esquerda: string) {
  paginas.forEach((p, i) => {
    p.linhaH(M, A4.h - 38, LARG)
    p.paragrafo(esquerda, M, A4.h - 32, LARG * 0.55, { tamanho: 7.5, cor: COR.cinza, entrelinha: 9 })
    p.texto(`Operação e Manutenção da Linha 17 Ouro | Página ${i + 1} de ${paginas.length}`, M, A4.h - 32, {
      tamanho: 7.5,
      cor: COR.cinza,
      alinhar: 'dir',
      largura: LARG,
    })
  })
}

/** Relatório de uma atividade (layout do app original, gerado como texto). */
export async function gerarRelatorio(d: DadosDocumento): Promise<Uint8Array> {
  const a = d.atividade
  const prev = a.categoria === 'Preventiva'
  const { doc, f } = await novoDocumento(`Relatório - ${a.titulo}`)
  const fl = new Fluxo(() => {
    const p = new Pagina(doc.addPage([A4.w, A4.h]), f as Fontes)
    cabecalho(p, a.titulo, a.turno)
    return p
  })
  const p = fl.p
  const equipe = juntarNomes(nomesEquipe(d))

  // Título
  p.retangulo(M, fl.y, 40, 40, { fundo: COR.ardosia })
  p.texto(String(d.numero).padStart(2, '0'), M, fl.y + 12, { tamanho: 17, fonte: f.negrito, cor: COR.branco, alinhar: 'centro', largura: 40 })
  p.texto(`${prev ? `PREVENTIVA ${a.tipo_prev ?? ''}` : 'CORRETIVA'} · ${dataBR(a.data)}`, M + 50, fl.y, { tamanho: 7.8, fonte: f.negrito, cor: COR.amarelo })
  const pillW = 64
  const statusW = f.negrito.widthOfTextAtSize(a.status, 8.5) + 20
  const hTit = p.paragrafo(a.titulo, M + 50, fl.y + 12, LARG - 50 - pillW - statusW - 16, { tamanho: 14, fonte: f.negrito, entrelinha: 17 })
  p.retangulo(M + LARG - pillW, fl.y + 10, pillW, 18, { fundo: a.turno === 'Noturno' ? COR.noturno : COR.diurno })
  p.texto(a.turno, M + LARG - pillW, fl.y + 14, { tamanho: 8.5, fonte: f.negrito, cor: COR.branco, alinhar: 'centro', largura: pillW })
  p.retangulo(M + LARG - pillW - statusW - 6, fl.y + 10, statusW, 18, { fundo: COR[CORES_STATUS[a.status] ?? 'cinza'] })
  p.texto(a.status, M + LARG - pillW - statusW - 6, fl.y + 14, { tamanho: 8.5, fonte: f.negrito, cor: COR.branco, alinhar: 'centro', largura: statusW })
  fl.y += Math.max(44, 14 + hTit) + 4
  p.linhaH(M, fl.y, LARG, COR.ardosia, 3)
  fl.y += 12

  const horario = a.tempos.atu?.i ? `${a.tempos.atu.i} - ${a.tempos.atu.f ?? ''}` : '—'
  grade(
    fl,
    prev
      ? [
          { r: 'LOCAL', v: a.local ?? '', span: 1 },
          { r: 'SISTEMA', v: a.sistema ?? '', span: 1 },
          { r: 'TIPO DE PREVENTIVA', v: a.tipo_prev ?? '', span: 1, destaque: true },
          { r: 'HORÁRIO', v: horario, span: 1 },
          { r: 'EQUIPAMENTO', v: a.equipamento ?? '', span: 2 },
          { r: 'EQUIPE', v: equipe, span: 2 },
        ]
      : [
          { r: 'LOCAL', v: a.local ?? '', span: 1 },
          { r: 'SISTEMA', v: a.sistema ?? '', span: 1 },
          { r: 'HORA DO INFORME', v: a.hora_informe || 'Não informado', span: 1 },
          { r: 'Nº DO CIM', v: a.cim ?? '', span: 1, destaque: true },
          { r: 'EQUIPAMENTO', v: a.equipamento ?? '', span: 2 },
          { r: 'SINTOMA', v: a.sintoma ?? '', span: 2 },
          { r: 'EQUIPE', v: equipe, span: 4 },
        ],
  )

  if (a.reprog_pedido) {
    const txt = `PEDIDO DE REPROGRAMAÇÃO${a.reprog_data ? ` · nova data sugerida: ${dataBR(a.reprog_data)}` : ''}${a.motivo ? `\nMotivo: ${a.motivo}` : ''}`
    blocoTexto(fl, [{ texto: txt }], COR.vermelho)
  } else if (a.status === 'Não realizada' && a.motivo) {
    blocoTexto(fl, [{ rotulo: 'Motivo da não realização', texto: a.motivo }], COR.vermelho)
  }

  const linhas = (v: string | null) => (v ?? '').split(/\n+/).map((x) => x.trim()).filter(Boolean)
  if (prev) {
    secao(fl, 'O que foi feito')
    blocoTexto(fl, linhas(a.feito).map((texto) => ({ texto })).concat(linhas(a.feito).length ? [] : [{ texto: '—' }]))
    const nc = linhas(a.nao_conformidades)
    if (nc.length) {
      secao(fl, 'Não conformidades / pendências')
      blocoTexto(fl, nc.map((texto) => ({ texto: `- ${texto}` })), COR.vermelho)
    }
  } else {
    secao(fl, 'Diagnóstico e intervenção')
    const pars = (
      [
        ['Diagnóstico', a.diagnostico],
        ['Intervenção', a.intervencao],
        ['Resultado', a.resultado],
      ] as const
    ).flatMap(([r, v]) => linhas(v).map((texto, i) => ({ rotulo: i === 0 ? r : undefined, texto })))
    blocoTexto(fl, pars.length ? pars : [{ texto: '—' }])
  }

  secao(fl, 'Tempos da atuação')
  tempos(fl, d)

  const cache = new Map<Uint8Array, PDFImage | null>()
  await fotos(fl, d, async (b) => {
    if (!cache.has(b)) cache.set(b, await doc.embedJpg(b).catch(() => doc.embedPng(b).catch(() => null)))
    return cache.get(b) ?? null
  })

  rodapes(fl.paginas, equipe ? `Equipe: ${equipe}` : '')
  return doc.save()
}
