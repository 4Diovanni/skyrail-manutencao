import type { PDFFont } from 'pdf-lib'

// Caracteres fora do WinAnsi (usado pelas fontes padrão do PDF) que aparecem em textos digitados.
const TROCAS: Record<string, string> = {
  '–': '-', '—': '-', '‘': "'", '’': "'", '“': '"', '”': '"', '…': '...', '•': '-', ' ': ' ',
  '☒': '[X]', '☐': '[ ]', '✓': 'OK', '⟳': '',
}

/** Deixa o texto desenhável pelas fontes padrão (WinAnsi): troca símbolos comuns e remove emojis. */
export function textoSeguro(s: string | null | undefined): string {
  let out = ''
  for (const ch of String(s ?? '')) {
    if (TROCAS[ch] !== undefined) out += TROCAS[ch]
    else if (ch === '\n' || ch === '\t') out += ch === '\t' ? ' ' : ch
    else if (ch.codePointAt(0)! < 0x20) continue
    else if (ch.codePointAt(0)! <= 0xff) out += ch
    else if ('€‚ƒ„†‡ˆ‰Š‹ŒŽ•˜™š›œžŸ'.includes(ch)) out += ch
    else out += ''
  }
  return out
}

/** Quebra o texto em linhas que cabem na largura (respeita quebras de linha digitadas). */
export function quebrarLinhas(texto: string, font: PDFFont, tamanho: number, largura: number): string[] {
  const linhas: string[] = []
  for (const paragrafo of textoSeguro(texto).split('\n')) {
    const palavras = paragrafo.split(/\s+/).filter(Boolean)
    if (!palavras.length) {
      linhas.push('')
      continue
    }
    let atual = ''
    for (const p of palavras) {
      const tentativa = atual ? `${atual} ${p}` : p
      if (font.widthOfTextAtSize(tentativa, tamanho) <= largura) {
        atual = tentativa
        continue
      }
      if (atual) linhas.push(atual)
      // palavra maior que a largura: corta em pedaços
      let resto = p
      while (font.widthOfTextAtSize(resto, tamanho) > largura && resto.length > 1) {
        let n = resto.length - 1
        while (n > 1 && font.widthOfTextAtSize(resto.slice(0, n), tamanho) > largura) n--
        linhas.push(resto.slice(0, n))
        resto = resto.slice(n)
      }
      atual = resto
    }
    linhas.push(atual)
  }
  return linhas
}

export const dataBR = (iso: string | null | undefined) => (iso ? iso.split('-').reverse().join('/') : '')

const DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
export function diaDaSemana(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return DIAS[new Date(y!, m! - 1, d!).getDay()]!
}

/** Igual ao slug do app original: sem acento, só letras, números e hífen, até 50 caracteres. */
export function slug(t: string | null | undefined): string {
  return (
    String(t || 'atividade')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50) || 'atividade'
  )
}
