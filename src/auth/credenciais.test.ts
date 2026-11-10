import { describe, expect, it } from 'vitest'
import { problemasSenha, usuarioParaEmail } from './credenciais'

describe('usuarioParaEmail', () => {
  it('RE vira e-mail interno', () => expect(usuarioParaEmail(' 53000001 ', 'l17.local')).toBe('53000001@l17.local'))
  it('aceita RE com domínio', () => expect(usuarioParaEmail('53000001@exemplo.com', 'l17.local')).toBe('53000001@exemplo.com'))
  it('rejeita texto qualquer', () => {
    expect(usuarioParaEmail('fulano', 'l17.local')).toBeNull()
    expect(usuarioParaEmail('', 'l17.local')).toBeNull()
  })
})

describe('problemasSenha', () => {
  it('recusa a senha padrão do tipo 123456@byd', () => expect(problemasSenha('123456@byd').length).toBeGreaterThan(0))
  it('recusa senha com a matrícula', () =>
    expect(problemasSenha('ab53000001', '53000001')).toContain('Não use a sua matrícula na senha.'))
  it('recusa senha curta', () => expect(problemasSenha('a1b2')).toContain('Use pelo menos 8 caracteres.'))
  it('aceita senha razoável', () => expect(problemasSenha('Trilho7Ouro42', '53000001')).toEqual([]))
})
