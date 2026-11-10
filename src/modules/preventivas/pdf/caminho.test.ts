import { describe, expect, it } from 'vitest'
import { chaveStorage } from '../../relatorio/pdf/caminho'
import { caminhoPreventiva } from './caminho'

const p = { data: '2026-11-10', turno: 'Noturno' as const, versao: 3, local: 'VJD' }
const m = { sistemaNome: 'Porta de plataforma', codigo: 'PQ' }

describe('caminhoPreventiva', () => {
  it('separa por dia, turno e tipo, com a versão no nome', () => {
    const r = caminhoPreventiva(p, m, 'roteiro')
    expect(r.pasta).toMatch(/^Preventiva\/2026-11-10 .+\/Noturno\/Roteiros$/)
    expect(r.nome).toMatch(/^Roteiro_PQ_10112026_Noturno_.+_VJD_v3\.pdf$/)
  })
  it('cada tipo tem pasta e prefixo próprios', () => {
    expect(caminhoPreventiva(p, m, 'rm').caminho).toContain('/Registros de manutenção/RM_Preventiva_')
    expect(caminhoPreventiva(p, m, 'relatorio').caminho).toContain('/Relatórios/Preventiva_')
  })
  it('sem local, o nome não fica com separador sobrando', () => {
    expect(caminhoPreventiva({ ...p, local: null }, m, 'rm').nome).not.toContain('__')
  })
  it('a chave do storage não tem acento nem espaço', () => {
    expect(chaveStorage(caminhoPreventiva(p, m, 'rm').caminho)).toMatch(/^[A-Za-z0-9/_.-]+$/)
  })
})
