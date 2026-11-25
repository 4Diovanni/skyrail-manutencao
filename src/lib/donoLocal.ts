/**
 * Dono dos rascunhos, fila e fotos guardados no aparelho. Num celular compartilhado, cada pessoa vê e envia
 * só o que é dela: outro técnico não abre nem envia (com a própria sessão) o rascunho de quem saiu.
 * O AuthProvider define o dono ao entrar e limpa ao sair.
 */
let dono: string | null = null

export function definirDonoLocal(userId: string | null) {
  dono = userId
}

export function donoLocal(): string | null {
  return dono
}

/** O registro local pertence a esta pessoa? Sem pessoa logada, nada pertence. */
export function ehDoDono(registro: { userId?: string }, userId: string | null = dono): boolean {
  return userId != null && registro.userId === userId
}

/** Registros de antes desta separação não têm dono: ficam com a primeira pessoa que entrar no aparelho. */
export function semDono(registro: { userId?: string }): boolean {
  return !registro.userId
}
