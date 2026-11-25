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
