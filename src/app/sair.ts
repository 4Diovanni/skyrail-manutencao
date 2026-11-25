import { donoLocal } from '../lib/donoLocal'
import { supabase } from '../lib/supabase'
import { adotarSemDono as adotarPassagem, minhaFila as filaPassagem } from '../modules/passagem/data/local'
import { adotarSemDono as adotarPreventivas, minhaFila as filaPreventivas } from '../modules/preventivas/data/local'
import { adotarSemDono as adotarRelatorio, minhaFila as filaRelatorio } from '../modules/relatorio/data/local'

/** Quantos registros desta pessoa ainda não chegaram ao servidor (na fila ou com erro). */
export async function pendentesDoUsuario(): Promise<number> {
  if (!donoLocal()) return 0
  const [a, b, c] = await Promise.all([filaRelatorio().count(), filaPreventivas().count(), filaPassagem().count()])
  return a + b + c
}

export function textoSairComPendentes(n: number): string {
  const itens = n === 1 ? '1 registro seu ainda não foi enviado' : `${n} registros seus ainda não foram enviados`
  return `${itens}. Eles ficam guardados neste aparelho e só são enviados quando você entrar de novo. Sair mesmo assim?`
}

/** Sai do app, avisando antes se a pessoa tem envio pendente neste aparelho. */
export async function sairComAviso() {
  const n = await pendentesDoUsuario().catch(() => 0)
  if (n > 0 && !window.confirm(textoSairComPendentes(n))) return
  await supabase.auth.signOut()
}

export async function adotarRascunhosAntigos(userId: string) {
  await Promise.all([adotarRelatorio(userId), adotarPreventivas(userId), adotarPassagem(userId)]).catch(() => {})
}
