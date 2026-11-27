import { supabase } from '../../../lib/supabase'
import { chaveAceiteLocal } from '../domain/politica'

export type Aceite = { versao: string; aceito_em: string }

/** Aceite desta pessoa para a versão pedida, ou null. Erro de rede ou do servidor sobe como exceção. */
export async function buscarAceite(userId: string, versao: string): Promise<Aceite | null> {
  const { data, error } = await supabase
    .from('aceites_politica')
    .select('versao, aceito_em')
    .eq('user_id', userId)
    .eq('versao', versao)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as Aceite | null) ?? null
}

/** Grava o aceite (data e hora do servidor). Aceite repetido da mesma versão conta como feito. */
export async function registrarAceite(versao: string): Promise<void> {
  const { error } = await supabase.from('aceites_politica').insert({ versao })
  if (error && error.code !== '23505') throw new Error(error.message)
}

export function versaoAceitaNoAparelho(userId: string): string | null {
  try {
    return localStorage.getItem(chaveAceiteLocal(userId))
  } catch {
    return null
  }
}

export function guardarAceiteNoAparelho(userId: string, versao: string) {
  try {
    localStorage.setItem(chaveAceiteLocal(userId), versao)
  } catch {
    // sem localStorage: o app só confere no servidor a cada abertura
  }
}
