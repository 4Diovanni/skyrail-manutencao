import type { Perfil, PerfilUsuario } from './types'

const ROTULOS: Record<Perfil, string> = {
  tecnico: 'Técnico',
  supervisor: 'Supervisor',
  admin: 'Administrador',
}

export function rotuloPerfil(perfil: Perfil): string {
  return ROTULOS[perfil] ?? perfil
}

/** Linhas da ficha "Meu perfil". Campo vazio vira um aviso para procurar o administrador. */
export function fichaPerfil(p: Pick<PerfilUsuario, 'nome' | 'matricula' | 'perfil'>): [string, string][] {
  const vazio = 'Não cadastrado. Fale com o administrador.'
  return [
    ['Nome', p.nome?.trim() || vazio],
    ['Matrícula (RE)', p.matricula?.trim() || vazio],
    ['Perfil', rotuloPerfil(p.perfil)],
  ]
}

/** Até duas iniciais do nome (primeiro e último), para o botão de conta. */
export function iniciais(nome: string | null | undefined): string {
  const partes = (nome ?? '').trim().split(/\s+/).filter(Boolean)
  if (!partes.length) return '?'
  const primeira = partes[0]?.[0] ?? ''
  const ultima = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? '') : ''
  return (primeira + ultima).toUpperCase()
}

export function primeiroNome(nome: string | null | undefined): string {
  return (nome ?? '').trim().split(/\s+/)[0] || 'Minha conta'
}
