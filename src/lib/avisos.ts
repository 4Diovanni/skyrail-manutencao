import { useSyncExternalStore } from 'react'

/** Aviso único de envio: concluído, na fila ou falhou. Aparece na própria tela, sem bloquear (nada de alert). */
export type TipoAviso = 'ok' | 'fila' | 'erro'
export type Aviso = { id: number; tipo: TipoAviso; texto: string }

/** Resultado de uma rodada da fila de envio (Relatório, Preventivas ou Passagem). */
export type ResultadoFila = { enviados: number; pendentes: number; erros: string[] }

/** Avisos de sucesso somem sozinhos; os de fila e erro ficam até a pessoa fechar. */
export const TEMPO_AVISO_OK_MS = 6000

let avisos: Aviso[] = []
let proximoId = 1
let ultimoErroSync: string | null = null
const ouvintes = new Set<() => void>()

function emitir() {
  avisos = [...avisos]
  ouvintes.forEach((o) => o())
}

export function avisar(tipo: TipoAviso, texto: string): number {
  // Não repete o mesmo aviso que já está na tela (ex.: a fila falhando de novo a cada 30 min).
  const igual = avisos.find((a) => a.tipo === tipo && a.texto === texto)
  if (igual) return igual.id
  const id = proximoId++
  avisos = [...avisos, { id, tipo, texto }]
  ouvintes.forEach((o) => o())
  if (tipo === 'ok' && typeof window !== 'undefined') window.setTimeout(() => dispensar(id), TEMPO_AVISO_OK_MS)
  return id
}

export function dispensar(id: number) {
  if (!avisos.some((a) => a.id === id)) return
  avisos = avisos.filter((a) => a.id !== id)
  emitir()
}

export function useAvisos(): Aviso[] {
  return useSyncExternalStore(
    (cb) => {
      ouvintes.add(cb)
      return () => ouvintes.delete(cb)
    },
    () => avisos,
  )
}

/** Último erro da sincronização em segundo plano (null quando a última rodada foi boa). */
export function ultimoErroDaSincronizacao(): string | null {
  return ultimoErroSync
}

export function registrarErroSincronizacao(erro: string | null) {
  ultimoErroSync = erro
}

/** Texto do aviso depois de uma rodada da fila, ou null se não havia nada a dizer. */
export function textoDaFila(r: ResultadoFila, rotulo: string): { tipo: TipoAviso; texto: string } | null {
  if (r.erros.length) {
    return { tipo: 'erro', texto: `${rotulo}: o envio falhou (${r.erros[0]}). Ficou salvo no aparelho e será tentado de novo.` }
  }
  if (r.enviados > 0) {
    return { tipo: 'ok', texto: r.enviados === 1 ? `${rotulo}: 1 item enviado.` : `${rotulo}: ${r.enviados} itens enviados.` }
  }
  if (r.pendentes > 0) {
    return { tipo: 'fila', texto: `${rotulo}: sem internet. Fica na fila e será enviado quando a conexão voltar.` }
  }
  return null
}

export function avisarFila(r: ResultadoFila, rotulo: string) {
  const t = textoDaFila(r, rotulo)
  if (t) avisar(t.tipo, t.texto)
}

/** Só para testes. */
export function limparAvisos() {
  avisos = []
  ultimoErroSync = null
  emitir()
}
