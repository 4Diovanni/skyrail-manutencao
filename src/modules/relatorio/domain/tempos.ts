import { duracaoMin } from '../../../domain/tempo'
import { ETAPAS, type Etapa, type Intervalo, type Tempos } from './tipos'

export function temposVazios(): Required<Tempos> {
  return { prep: { i: '', f: '' }, desl: { i: '', f: '' }, lib: { i: '', f: '' }, atu: { i: '', f: '' }, ret: { i: '', f: '' } }
}

export function duracaoEtapa(p: Intervalo | undefined): number | null {
  if (!p || p.na || !p.i || !p.f) return null
  return duracaoMin(p.i, p.f)
}

/**
 * Define início ou fim de uma etapa. Ao informar o fim, o início da etapa seguinte
 * é preenchido se ainda estiver vazio e não for N/A (regra do app original).
 */
export function definirHorario(t: Tempos, etapa: Etapa, campo: 'i' | 'f', valor: string): Tempos {
  const novo: Tempos = { ...t, [etapa]: { ...(t[etapa] ?? { i: '', f: '' }), [campo]: valor, ...(valor ? { na: false } : {}) } }
  if (campo === 'f' && valor) {
    const idx = ETAPAS.findIndex(([k]) => k === etapa)
    const prox = ETAPAS[idx + 1]?.[0]
    if (prox) {
      const p = novo[prox] ?? { i: '', f: '' }
      if (!p.i && !p.na) novo[prox] = { ...p, i: valor }
    }
  }
  return novo
}

export function marcarNA(t: Tempos, etapa: Etapa, na: boolean): Tempos {
  return { ...t, [etapa]: na ? { i: '', f: '', na: true } : { ...(t[etapa] ?? { i: '', f: '' }), na: false } }
}

/** Formato do app original: "45 min", "1h", "1h05". */
export function formatarMinutos(n: number | null): string {
  if (n == null) return ''
  if (n < 60) return `${n} min`
  const h = Math.floor(n / 60)
  const m = n % 60
  return `${h}h${m ? String(m).padStart(2, '0') : ''}`
}
