import { supabase } from '../../../lib/supabase'
import type { Papel } from '../../relatorio/domain/assinatura'

/** Aplica a assinatura do usuário logado na versão atual da preventiva (o banco confere o papel e a versão). */
export async function assinarPreventiva(preventivaId: string, papeis: Papel[]) {
  const linhas = papeis.map((papel) => ({ preventiva_id: preventivaId, papel, versao: 0 }))
  const { error } = await supabase.from('preventiva_assinaturas').upsert(linhas)
  if (error) throw new Error(error.message)
}

/** Quem já assinou a versão atual: "<profile_id>:<papel>". */
export async function assinaturasDaVersao(preventivaId: string, versao: number): Promise<Set<string>> {
  const { data } = await supabase
    .from('preventiva_assinaturas')
    .select('profile_id, papel')
    .eq('preventiva_id', preventivaId)
    .eq('versao', versao)
  return new Set(((data ?? []) as { profile_id: string; papel: string }[]).map((s) => `${s.profile_id}:${s.papel}`))
}
