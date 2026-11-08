export type Turno = 'Diurno' | 'Noturno'

/** Regra do app original: Noturno das 18h às 6h; Diurno no resto. */
export function turnoDe(data: Date): Turno {
  const h = data.getHours()
  return h >= 18 || h < 6 ? 'Noturno' : 'Diurno'
}
