import type { ResultadoFila } from '../../../lib/avisos'
import { supabase } from '../../../lib/supabase'
import { rascunhoParaLinha } from '../domain/passagem'
import type { RascunhoPassagem } from '../domain/tipos'
import { passDb, salvarLocal } from './local'
import { ehDoDono } from '../../../lib/donoLocal'

export type ResultadoEnvio = { ok: true; versao: number; id: string } | { ok: false; offline: boolean; mensagem: string }

const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false

/**
 * Envia a passagem do turno. A chave é dia + turno: se outra pessoa já criou a passagem
 * deste turno, o envio atualiza a mesma linha (o último envio vale; a anterior vai para o histórico).
 */
export async function enviarPassagem(r: RascunhoPassagem): Promise<ResultadoEnvio> {
  if (offline()) return { ok: false, offline: true, mensagem: 'Sem internet. O envio fica na fila.' }
  try {
    const { id: _id, ...linha } = rascunhoParaLinha(r)
    const { data, error } = await supabase.from('passagens').upsert(linha, { onConflict: 'data,turno' }).select('id, versao').single()
    if (error) throw error
    return { ok: true, versao: data.versao as number, id: data.id as string }
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e)
    return { ok: false, offline: offline(), mensagem }
  }
}

/** Versão no servidor agora, para avisar se outra pessoa enviou depois que este aparelho abriu. */
export async function versaoNoServidor(r: RascunhoPassagem): Promise<number | null> {
  const { data } = await supabase.from('passagens').select('versao').eq('data', r.data).eq('turno', r.turno).maybeSingle()
  return (data?.versao as number | undefined) ?? null
}

/** Fila: envia as passagens que ficaram esperando internet. */
export async function processarFilaPassagem(): Promise<ResultadoFila> {
  // Só a fila de quem está logado: o envio usa a sessão dessa pessoa.
  const fila = await passDb.rascunhos.where('estado').equals('fila').filter((r) => ehDoDono(r)).toArray()
  let enviados = 0
  const erros: string[] = []
  for (const l of fila) {
    const r = await enviarPassagem(l.dados)
    if (r.ok) {
      await passDb.rascunhos.delete(l.chave)
      enviados++
    } else if (!r.offline) {
      await salvarLocal(l.dados, 'erro', r.mensagem)
      erros.push(r.mensagem)
    }
  }
  return { enviados, pendentes: fila.length - enviados, erros }
}
