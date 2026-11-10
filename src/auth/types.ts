export type Perfil = 'tecnico' | 'supervisor' | 'admin'

export interface PerfilUsuario {
  id: string
  nome: string | null
  matricula: string | null
  perfil: Perfil
  ativo: boolean
  deve_trocar_senha: boolean
}
