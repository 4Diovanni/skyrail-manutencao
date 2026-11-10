/**
 * Detecção de "versão antiga do app": depois de um deploy novo, uma aba aberta
 * antes do deploy ainda aponta para arquivos (chunks) com hash antigo, que não
 * existem mais no servidor. O import dinâmico falha e a solução é recarregar.
 */

/** Mensagens dos navegadores quando um import dinâmico não carrega. */
const PADROES = [
  'failed to fetch dynamically imported module', // Chrome / Edge
  'error loading dynamically imported module', // Firefox
  'importing a module script failed', // Safari
  'unable to preload css', // Vite (CSS do chunk)
  'failed to load module script', // MIME errado (HTML no lugar do JS)
]

export function ehVersaoAntiga(erro: unknown): boolean {
  const msg = (erro instanceof Error ? erro.message : String(erro ?? '')).toLowerCase()
  return PADROES.some((p) => msg.includes(p))
}

/** Intervalo mínimo entre recarregamentos automáticos, para nunca entrar em laço. */
export const INTERVALO_RECARGA_MS = 60_000

/** Pode recarregar se nunca recarregou por isso ou se a última vez foi há mais de um minuto. */
export function podeRecarregar(agora: number, ultima: number | null): boolean {
  return ultima === null || !Number.isFinite(ultima) || agora - ultima > INTERVALO_RECARGA_MS
}
