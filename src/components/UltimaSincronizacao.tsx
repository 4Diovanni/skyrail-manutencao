import { textoUltimaSincronizacao } from '../domain/sincronizacao'
import { useUltimaSincronizacao } from '../lib/sync'

/** "Sincronizado hoje às 17:42": mostra se o que está no aparelho já chegou ao servidor. */
export function UltimaSincronizacao({ className = '' }: { className?: string }) {
  const iso = useUltimaSincronizacao()
  return <small className={`ultima-sync ${className}`.trim()}>{textoUltimaSincronizacao(iso)}</small>
}
