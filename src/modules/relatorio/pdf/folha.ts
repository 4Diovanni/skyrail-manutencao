import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFImage, type PDFPage, type RGB } from 'pdf-lib'
import { quebrarLinhas, textoSeguro } from './texto'

export const A4 = { w: 595.28, h: 841.89 }
export const COR = {
  tinta: rgb(0.11, 0.15, 0.19),
  cinza: rgb(0.4, 0.45, 0.49),
  linha: rgb(0.79, 0.82, 0.85),
  suave: rgb(0.93, 0.94, 0.95),
  ardosia: rgb(0.18, 0.24, 0.31),
  azul: rgb(0.12, 0.36, 0.48),
  amarelo: rgb(0.88, 0.63, 0),
  noturno: rgb(0.15, 0.18, 0.36),
  diurno: rgb(0.75, 0.44, 0),
  vermelho: rgb(0.7, 0.15, 0.12),
  verde: rgb(0.18, 0.48, 0.29),
  branco: rgb(1, 1, 1),
  preto: rgb(0, 0, 0),
  cinzaForm: rgb(0.82, 0.82, 0.82),
  cinzaForm2: rgb(0.9, 0.9, 0.9),
}

export interface Fontes {
  normal: PDFFont
  negrito: PDFFont
  italico: PDFFont
}

export async function novoDocumento(titulo: string): Promise<{ doc: PDFDocument; f: Fontes }> {
  const doc = await PDFDocument.create()
  doc.setTitle(titulo)
  doc.setProducer('SkyRail L17 - Manutenção')
  doc.setCreator('SkyRail L17 - Manutenção')
  const f = {
    normal: await doc.embedFont(StandardFonts.Helvetica),
    negrito: await doc.embedFont(StandardFonts.HelveticaBold),
    italico: await doc.embedFont(StandardFonts.HelveticaOblique),
  }
  return { doc, f }
}

export interface OpTexto {
  tamanho?: number
  fonte?: PDFFont
  cor?: RGB
  alinhar?: 'esq' | 'centro' | 'dir'
  largura?: number
}

/** Página com coordenadas a partir do topo (y cresce para baixo), mais fácil de seguir o formulário. */
export class Pagina {
  readonly page: PDFPage
  readonly f: Fontes
  constructor(page: PDFPage, f: Fontes) {
    this.page = page
    this.f = f
  }

  texto(s: string, x: number, y: number, op: OpTexto = {}) {
    const tamanho = op.tamanho ?? 10
    const fonte = op.fonte ?? this.f.normal
    const t = textoSeguro(s).replace(/\n/g, ' ')
    let xx = x
    if (op.largura && op.alinhar && op.alinhar !== 'esq') {
      const w = fonte.widthOfTextAtSize(t, tamanho)
      xx = op.alinhar === 'centro' ? x + (op.largura - w) / 2 : x + op.largura - w
    }
    this.page.drawText(t, { x: xx, y: A4.h - y - tamanho * 0.8, size: tamanho, font: fonte, color: op.cor ?? COR.tinta })
  }

  /** Texto com quebra de linha; retorna a altura usada. */
  paragrafo(s: string, x: number, y: number, largura: number, op: OpTexto & { entrelinha?: number } = {}): number {
    const tamanho = op.tamanho ?? 10
    const fonte = op.fonte ?? this.f.normal
    const lh = op.entrelinha ?? tamanho * 1.35
    const linhas = quebrarLinhas(s, fonte, tamanho, largura)
    linhas.forEach((l, i) => this.texto(l, x, y + i * lh, { ...op, largura }))
    return linhas.length * lh
  }

  retangulo(x: number, y: number, w: number, h: number, op: { fundo?: RGB; borda?: RGB; espessura?: number } = {}) {
    this.page.drawRectangle({
      x,
      y: A4.h - y - h,
      width: w,
      height: h,
      color: op.fundo,
      borderColor: op.borda,
      borderWidth: op.borda ? (op.espessura ?? 0.75) : 0,
    })
  }

  linhaH(x: number, y: number, w: number, cor = COR.linha, espessura = 1) {
    this.page.drawLine({ start: { x, y: A4.h - y }, end: { x: x + w, y: A4.h - y }, color: cor, thickness: espessura })
  }

  /** Desenha a imagem dentro da caixa, mantendo a proporção e centralizada. */
  imagem(img: PDFImage, x: number, y: number, w: number, h: number) {
    const k = Math.min(w / img.width, h / img.height)
    const iw = img.width * k
    const ih = img.height * k
    this.page.drawImage(img, { x: x + (w - iw) / 2, y: A4.h - y - h + (h - ih) / 2, width: iw, height: ih })
  }
}

/** Célula de tabela de formulário (OS e Registro). Largura em pontos. */
export interface Celula {
  w: number
  texto?: string
  fundo?: RGB
  negrito?: boolean
  alinhar?: 'esq' | 'centro' | 'dir'
  topo?: boolean
  tamanho?: number
  semBorda?: boolean
  imagem?: PDFImage | null
  /** Altura própria (célula que ocupa várias linhas); as linhas seguintes levam um espaço vazio sem borda. */
  altura?: number
}

/**
 * Desenha uma linha de tabela. O texto que não couber diminui de tamanho até caber
 * (igual ao ajuste do app original), com mínimo de 5.5 pt.
 */
export function linhaTabela(p: Pagina, x: number, y: number, h: number, celulas: Celula[], tamanhoBase = 8.5) {
  let cx = x
  for (const c0 of celulas) {
    const hh = c0.altura ?? h
    const c = c0
    if (!c.semBorda) p.retangulo(cx, y, c.w, hh, { fundo: c.fundo, borda: COR.preto, espessura: 0.6 })
    if (c.imagem) p.imagem(c.imagem, cx + 2, y + 1.5, c.w - 4, hh - 3)
    if (c.texto) {
      const fonte = c.negrito ? p.f.negrito : p.f.normal
      let t = c.tamanho ?? tamanhoBase
      let linhas = quebrarLinhas(c.texto, fonte, t, c.w - 5)
      while (t > 5.5 && linhas.length * t * 1.2 > hh - 2) {
        t -= 0.5
        linhas = quebrarLinhas(c.texto, fonte, t, c.w - 5)
      }
      const altura = linhas.length * t * 1.2
      const y0 = c.topo ? y + 2 : y + (hh - altura) / 2
      linhas.forEach((l, i) => {
        if (y0 + (i + 1) * t * 1.2 <= y + hh + 1) p.texto(l, cx + 2.5, y0 + i * t * 1.2, { tamanho: t, fonte, alinhar: c.alinhar, largura: c.w - 5 })
      })
    }
    cx += c.w
  }
}

/** Monta uma tabela de formulário linha a linha e desenha ajustando a altura total à página. */
export class Tabela {
  private linhas: { h: number; cels: Celula[] }[] = []
  readonly colunas: number[]
  constructor(larguras: number[], larguraTotal: number) {
    const soma = larguras.reduce((x, y) => x + y, 0)
    this.colunas = larguras.map((w) => (w / soma) * larguraTotal)
  }
  /** Largura de "n" colunas a partir da coluna "de". */
  w(de: number, n: number): number {
    return this.colunas.slice(de, de + n).reduce((x, y) => x + y, 0)
  }
  /** Células com "span" em colunas, na ordem. */
  linha(h: number, cels: (Omit<Celula, 'w'> & { span: number })[]) {
    let col = 0
    this.linhas.push({
      h,
      cels: cels.map(({ span, ...c }) => {
        const w = this.w(col, span)
        col += span
        return { ...c, w }
      }),
    })
  }
  desenhar(p: Pagina, x: number, y: number, alturaMax: number, tamanhoBase: number) {
    const total = this.linhas.reduce((s, l) => s + l.h, 0)
    const k = Math.min(1, alturaMax / total)
    let yy = y
    for (const l of this.linhas) {
      linhaTabela(p, x, yy, l.h * k, l.cels.map((c) => (c.altura ? { ...c, altura: c.altura * k } : c)), tamanhoBase)
      yy += l.h * k
    }
  }
}

/**
 * Tabela que continua em novas páginas quando não cabe (roteiros longos, ex.: 20 portas).
 * Não reduz a escala: cada linha mantém a altura pedida. Linhas marcadas com "repetir"
 * (cabeçalho de colunas) são redesenhadas no topo da página seguinte.
 */
export class TabelaPaginada extends Tabela {
  private fila: { h: number; cels: Celula[]; repetir?: boolean; juntoCom?: number }[] = []
  linhaP(h: number, cels: (Omit<Celula, 'w'> & { span: number })[], op: { repetir?: boolean; juntoCom?: number } = {}) {
    let col = 0
    this.fila.push({
      h,
      ...op,
      cels: cels.map(({ span, ...c }) => {
        const w = this.w(col, span)
        col += span
        return { ...c, w }
      }),
    })
  }
  /** Desenha a partir de y; devolve a página e o y final. "novaPagina" cria a próxima página já com cabeçalho. */
  desenharPaginado(p: Pagina, x: number, y: number, yMax: number, tamanhoBase: number, novaPagina: () => { p: Pagina; y: number }) {
    let pg = p
    let yy = y
    let cabecalho: { h: number; cels: Celula[] }[] = []
    for (let i = 0; i < this.fila.length; i++) {
      const l = this.fila[i]!
      if (l.repetir) cabecalho = [...cabecalho.filter((c) => c !== l), l]
      // mantém a linha junto com as próximas N (ex.: título de grupo + primeiro item)
      const bloco = this.fila.slice(i, i + 1 + (l.juntoCom ?? 0)).reduce((s, x) => s + x.h, 0)
      if (yy + bloco > yMax) {
        const n = novaPagina()
        pg = n.p
        yy = n.y
        if (!l.repetir) for (const c of cabecalho) {
          linhaTabela(pg, x, yy, c.h, c.cels, tamanhoBase)
          yy += c.h
        }
      }
      linhaTabela(pg, x, yy, l.h, l.cels, tamanhoBase)
      yy += l.h
      if (!l.repetir && cabecalho.length && l.h > 0 && l.cels.every((c) => c.semBorda)) cabecalho = []
    }
    return { p: pg, y: yy }
  }
}
