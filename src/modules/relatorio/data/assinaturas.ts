import { supabase } from '../../../lib/supabase'
import type { Papel } from '../domain/assinatura'

export async function minhaAssinaturaUrl(uid: string): Promise<string | null> {
  const { data } = await supabase.storage.from('assinaturas').createSignedUrl(`${uid}.png`, 300)
  return data?.signedUrl ?? null
}

export async function temAssinatura(uid: string): Promise<boolean> {
  const { data } = await supabase.storage.from('assinaturas').download(`${uid}.png`)
  return !!data
}

export async function enviarMinhaAssinatura(uid: string, png: Blob) {
  const { error } = await supabase.storage.from('assinaturas').upload(`${uid}.png`, png, { contentType: 'image/png', upsert: true })
  if (error) throw new Error(error.message)
}

/** Aplica a assinatura do usuário logado na versão atual da atividade (o banco confere o papel). */
export async function assinar(atividadeId: string, papeis: Papel[]) {
  const linhas = papeis.map((papel) => ({ atividade_id: atividadeId, papel, versao: 0 }))
  const { error } = await supabase.from('atividade_assinaturas').upsert(linhas)
  if (error) throw new Error(error.message)
}
