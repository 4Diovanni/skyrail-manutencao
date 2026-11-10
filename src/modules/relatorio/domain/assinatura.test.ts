import { describe, expect, it } from 'vitest'
import { papeisDe } from './assinatura'

describe('papeisDe', () => {
  const a = { resp_tecnico_id: 'u1', lider_id: null, gestor_id: 'u2' }
  it('membro da equipe e resp. técnico', () => expect(papeisDe(a, ['u1', 'u3'], 'u1')).toEqual(['equipe', 'resp_tecnico']))
  it('gestor fora da equipe', () => expect(papeisDe(a, ['u1'], 'u2')).toEqual(['gestor']))
  it('quem não tem papel não assina', () => expect(papeisDe(a, ['u1'], 'u9')).toEqual([]))
})
