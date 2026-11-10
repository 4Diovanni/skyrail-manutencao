import type { Atividade } from './tipos'

export type Papel = 'equipe' | 'resp_tecnico' | 'lider' | 'gestor'

/** Papéis em que o usuário logado pode assinar esta atividade. */
export function papeisDe(a: Pick<Atividade, 'resp_tecnico_id' | 'lider_id' | 'gestor_id'>, equipe: string[], uid: string): Papel[] {
  const p: Papel[] = []
  if (equipe.includes(uid)) p.push('equipe')
  if (a.resp_tecnico_id === uid) p.push('resp_tecnico')
  if (a.lider_id === uid) p.push('lider')
  if (a.gestor_id === uid) p.push('gestor')
  return p
}
