import type { PDFDocument, PDFImage } from 'pdf-lib'
import { duracaoEtapa, formatarMinutos } from '../../relatorio/domain/tempos'
import { ETAPAS, type Tempos } from '../../relatorio/domain/tipos'
import { A4, COR, linhaTabela, Pagina, type Fontes } from '../../relatorio/pdf/folha'
import type { DadosPreventivaPdf } from './dados'

export const MARGEM = 28

export async function carregarAssinaturas(doc: PDFDocument, d: DadosPreventivaPdf) {
  const imgs: Record<string, PDFImage> = {}
  for (const [k, bytes] of Object.entries(d.assinaturas)) {
    try {
      imgs[k] = await doc.embedPng(bytes)
    } catch {
      // assinatura inválida: fica em branco
    }
  }
  return (id: string | null | undefined, papel: string) => (id ? (imgs[`${id}:${papel}`] ?? null) : null)
}

/** Cabeçalho das páginas do relatório: título, código do formulário e turno. */
export function cabecalho(p: Pagina, d: DadosPreventivaPdf): number {
  const m = d.modelo
  const w = A4.w - 2 * MARGEM
  const turnoCor = d.preventiva.turno === 'Noturno' ? COR.noturno : COR.diurno
  linhaTabela(p, MARGEM, 20, 36, [
    { w: w * 0.18, texto: 'Metrô L17 Ouro', negrito: true, alinhar: 'centro', tamanho: 8 },
    { w: w * 0.62, texto: m.conteudo.titulo, negrito: true, alinhar: 'centro', tamanho: 11 },
    { w: w * 0.2, texto: `${m.formulario ?? 'Checklist'}\nRev.: 00`, alinhar: 'centro', tamanho: 7.5 },
  ])
  linhaTabela(p, MARGEM, 56, 14, [
    { w: w * 0.8, fundo: COR.ardosia },
    { w: w * 0.2, fundo: turnoCor },
  ])
  // texto branco sobre as faixas escuras
  p.texto('Manutenção de Sistemas BYD - Linha 17 Ouro', MARGEM, 59.5, { tamanho: 7.5, cor: COR.branco, alinhar: 'centro', largura: w * 0.8 })
  p.texto(d.preventiva.turno, MARGEM + w * 0.8, 59.5, { tamanho: 8, cor: COR.branco, fonte: p.f.negrito, alinhar: 'centro', largura: w * 0.2 })
  return 80
}

export function rodape(p: Pagina, n: number, total: number) {
  p.texto(`Operação e Manutenção da Linha 17 Ouro · página ${n} de ${total}`, MARGEM, A4.h - 22, { tamanho: 7, cor: COR.cinza, alinhar: 'centro', largura: A4.w - 2 * MARGEM })
}

export function linhasTempos(t: Tempos) {
  return ETAPAS.map(([k, rotulo]) => {
    const e = t[k]
    const d = e ? duracaoEtapa(e) : null
    return { k, rotulo, faixa: e?.na ? 'N/A' : e?.i && e?.f ? `${e.i} – ${e.f}` : '—', dur: d != null ? formatarMinutos(d) : '—' }
  })
}

export function novaPaginaCom(doc: PDFDocument, f: Fontes, topo: (p: Pagina) => number) {
  return () => {
    const p = new Pagina(doc.addPage([A4.w, A4.h]), f)
    return { p, y: topo(p) }
  }
}
