import { avisarFila, registrarErroSincronizacao, type ResultadoFila } from './avisos'

/** Intervalo de sincronização combinado na reunião: a cada 30 minutos, e sempre que a internet volta. */
export const INTERVALO_SYNC_MS = 30 * 60 * 1000

export type Tarefa = { rotulo: string; executar: () => Promise<ResultadoFila> }

const tarefas = new Set<Tarefa>()
let rodando = false
let iniciado = false

export function registrarSincronizacao(t: Tarefa): () => void {
  tarefas.add(t)
  iniciar()
  return () => tarefas.delete(t)
}

/**
 * Roda todas as filas. Quando algo é enviado ou falha, avisa na tela (a pessoa não está olhando a fila)
 * e guarda o último erro; antes os erros eram engolidos em silêncio.
 */
export async function sincronizarAgora() {
  if (rodando || (typeof navigator !== 'undefined' && navigator.onLine === false)) return
  rodando = true
  let erro: string | null = null
  try {
    for (const t of tarefas) {
      try {
        const r = await t.executar()
        // Sem internet no meio da rodada não é erro: o item segue na fila.
        if (r.enviados || r.erros.length) avisarFila(r, t.rotulo)
        if (r.erros.length) erro = `${t.rotulo}: ${r.erros[0]}`
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        erro = `${t.rotulo}: ${msg}`
        avisarFila({ enviados: 0, pendentes: 0, erros: [msg] }, t.rotulo)
      }
    }
  } finally {
    registrarErroSincronizacao(erro)
    rodando = false
  }
}

function iniciar() {
  if (iniciado || typeof window === 'undefined') return
  iniciado = true
  window.addEventListener('online', () => void sincronizarAgora())
  window.setInterval(() => void sincronizarAgora(), INTERVALO_SYNC_MS)
}
