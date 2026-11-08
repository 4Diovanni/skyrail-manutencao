const HORA_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

/** Converte "HH:MM" em minutos desde 00:00, ou null se inválido. */
export function parseHora(hhmm: string): number | null {
  const m = HORA_RE.exec(hhmm.trim())
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

/**
 * Duração em minutos entre dois horários. Se o fim for menor que o início,
 * considera que atravessou a meia-noite (regra do app original).
 */
export function duracaoMin(inicio: string, fim: string): number | null {
  const a = parseHora(inicio)
  const b = parseHora(fim)
  if (a === null || b === null) return null
  return b >= a ? b - a : b + 24 * 60 - a
}

export function formatarDuracao(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
