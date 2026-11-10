/** Monta o e-mail interno do Supabase a partir do RE digitado (ou aceita um e-mail completo). */
export function usuarioParaEmail(entrada: string, dominio: string): string | null {
  const v = entrada.trim().toLowerCase()
  if (/^[0-9]{4,12}$/.test(v)) return `${v}@${dominio}`
  if (/^[0-9]{4,12}@[a-z0-9.-]+\.[a-z]{2,}$/.test(v)) return v
  return null
}

const SENHAS_FRACAS = ['123456', '12345678', 'senha', 'password', 'byd', 'skyrail', 'metro']

/** Regras da senha pessoal. Retorna a lista de problemas (vazia = senha aceita). */
export function problemasSenha(senha: string, matricula?: string | null): string[] {
  const p: string[] = []
  if (senha.length < 8) p.push('Use pelo menos 8 caracteres.')
  if (!/[a-zA-Z]/.test(senha) || !/[0-9]/.test(senha)) p.push('Misture letras e números.')
  const baixa = senha.toLowerCase()
  if (matricula && baixa.includes(matricula)) p.push('Não use a sua matrícula na senha.')
  if (SENHAS_FRACAS.some((f) => baixa.includes(f))) p.push('Evite sequências e palavras óbvias (123456, byd, senha…).')
  return p
}
