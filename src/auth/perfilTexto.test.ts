import { describe, expect, it } from 'vitest'
import { fichaPerfil, rotuloPerfil } from './perfilTexto'

describe('rotuloPerfil', () => {
  it('traduz os três perfis', () => {
    expect(rotuloPerfil('tecnico')).toBe('Técnico')
    expect(rotuloPerfil('supervisor')).toBe('Supervisor')
    expect(rotuloPerfil('admin')).toBe('Administrador')
  })
})

describe('fichaPerfil', () => {
  it('mostra nome, RE e perfil', () => {
    expect(fichaPerfil({ nome: 'Pessoa Teste', matricula: '000123', perfil: 'tecnico' })).toEqual([
      ['Nome', 'Pessoa Teste'],
      ['Matrícula (RE)', '000123'],
      ['Perfil', 'Técnico'],
    ])
  })

  it('avisa quando nome ou RE estão vazios', () => {
    const [nome, re, perfil] = fichaPerfil({ nome: '  ', matricula: null, perfil: 'supervisor' }).map(([, v]) => v)
    expect(nome).toMatch(/administrador/)
    expect(re).toMatch(/administrador/)
    expect(perfil).toBe('Supervisor')
  })
})
