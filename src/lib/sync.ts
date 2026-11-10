/** Intervalo de sincronização combinado na reunião: a cada 30 minutos, e sempre que a internet volta. */
export const INTERVALO_SYNC_MS = 30 * 60 * 1000

type Tarefa = () => Promise<unknown>

const tarefas = new Set<Tarefa>()
let rodando = false
let iniciado = false

export function registrarSincronizacao(t: Tarefa): () => void {
  tarefas.add(t)
  iniciar()
  return () => tarefas.delete(t)
}

export async function sincronizarAgora() {
  if (rodando || (typeof navigator !== 'undefined' && navigator.onLine === false)) return
  rodando = true
  try {
    for (const t of tarefas) {
      try {
        await t()
      } catch {
        // tenta de novo no próximo ciclo
      }
    }
  } finally {
    rodando = false
  }
}

function iniciar() {
  if (iniciado || typeof window === 'undefined') return
  iniciado = true
  window.addEventListener('online', () => void sincronizarAgora())
  window.setInterval(() => void sincronizarAgora(), INTERVALO_SYNC_MS)
}
