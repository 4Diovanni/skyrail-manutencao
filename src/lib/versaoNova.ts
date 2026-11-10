import { ehVersaoAntiga, podeRecarregar } from '../domain/versao'

const CHAVE = 'skyrail:recarga-versao'
let recarregando = false

function ultimaRecarga(): number | null {
  try {
    const v = sessionStorage.getItem(CHAVE)
    return v ? Number(v) : null
  } catch {
    return null
  }
}

/** Recarrega a página para pegar a versão nova. Devolve false se já recarregou há pouco. */
export function recarregarParaVersaoNova(): boolean {
  if (recarregando) return true
  const agora = Date.now()
  if (!podeRecarregar(agora, ultimaRecarga())) return false
  try {
    sessionStorage.setItem(CHAVE, String(agora))
  } catch {
    // sem sessionStorage: recarrega mesmo assim (o pior caso é uma recarga a mais)
  }
  recarregando = true
  window.location.reload()
  return true
}

/**
 * Import dinâmico que sobrevive a um deploy novo: se o arquivo da versão antiga
 * sumiu do servidor, recarrega a página uma vez. Se mesmo assim falhar, explica o que fazer.
 */
export async function importarModulo<T>(carregar: () => Promise<T>): Promise<T> {
  try {
    return await carregar()
  } catch (e) {
    if (!ehVersaoAntiga(e)) throw e
    if (recarregarParaVersaoNova()) return new Promise<T>(() => {}) // a página vai recarregar
    throw new Error('O app foi atualizado e não conseguiu carregar esta parte. Feche o app (ou a aba) e abra de novo.', { cause: e })
  }
}

/**
 * Liga a recarga automática quando o Vite não consegue carregar um chunk, inclusive
 * em imports que não passam por importarModulo. Não chama preventDefault: se chamasse,
 * o import "daria certo" devolvendo undefined e o código quebraria com outro erro.
 */
export function ouvirFalhaDeChunk(): void {
  window.addEventListener('vite:preloadError', (ev) => {
    if (ehVersaoAntiga((ev as Event & { payload?: unknown }).payload)) recarregarParaVersaoNova()
  })
}
