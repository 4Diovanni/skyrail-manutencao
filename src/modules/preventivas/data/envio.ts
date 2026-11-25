import type { ResultadoFila } from '../../../lib/avisos'
import { supabase } from '../../../lib/supabase'
import { rascunhoParaLinha } from '../domain/preventiva'
import { minhaFila, prevDb, type RascunhoLocal } from './local'

export type ResultadoEnvio = { ok: true; versao: number } | { ok: false; offline: boolean; mensagem: string }

const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false

/** Envia a preventiva, a equipe (por diferença) e as fotos das ocorrências. O último envio vale. */
export async function enviarRascunho(r: RascunhoLocal): Promise<ResultadoEnvio> {
  if (offline()) return { ok: false, offline: true, mensagem: 'Sem internet. O envio fica na fila.' }
  const d = r.dados
  try {
    const { data: salva, error } = await supabase.from('preventivas').upsert(rascunhoParaLinha(d)).select('versao').single()
    if (error) throw error

    const { data: eqAtual, error: e1 } = await supabase.from('preventiva_equipe').select('profile_id').eq('preventiva_id', d.id)
    if (e1) throw e1
    const antes = new Set((eqAtual ?? []).map((e) => e.profile_id as string))
    const linhas = d.equipe.map((profile_id, ordem) => ({ preventiva_id: d.id, profile_id, ordem }))
    if (linhas.length) {
      const { error: e2 } = await supabase.from('preventiva_equipe').upsert(linhas)
      if (e2) throw e2
    }
    const sairam = [...antes].filter((id) => !d.equipe.includes(id))
    if (sairam.length) {
      const { error: e3 } = await supabase.from('preventiva_equipe').delete().eq('preventiva_id', d.id).in('profile_id', sairam)
      if (e3) throw e3
    }

    await enviarFotos(d.id, new Set(d.ocorrencias.map((o) => o.id)))
    return { ok: true, versao: salva.versao as number }
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e)
    return { ok: false, offline: offline(), mensagem }
  }
}

async function enviarFotos(preventivaId: string, ocorrencias: Set<string>) {
  const fotos = await prevDb.fotos.where('preventivaId').equals(preventivaId).toArray()
  for (const f of fotos) {
    // Foto de ocorrência apagada também sai do servidor.
    if (f.removida || !ocorrencias.has(f.ocorrenciaId)) {
      if (f.storagePath) {
        await supabase.from('preventiva_fotos').delete().eq('id', f.id)
        await supabase.storage.from('fotos').remove([f.storagePath])
      }
      await prevDb.fotos.delete(f.id)
      continue
    }
    let path = f.storagePath
    if (!path && f.blob) {
      path = `preventivas/${preventivaId}/${f.id}.jpg`
      const { error } = await supabase.storage.from('fotos').upload(path, f.blob, { contentType: 'image/jpeg', upsert: true })
      if (error) throw error
      await prevDb.fotos.update(f.id, { storagePath: path, blob: undefined })
    }
    if (!path) continue
    const { error } = await supabase.from('preventiva_fotos').upsert({
      id: f.id,
      preventiva_id: preventivaId,
      ocorrencia_id: f.ocorrenciaId,
      storage_path: path,
      legenda: f.legenda || null,
      ordem: f.ordem,
    })
    if (error) throw error
  }
}

/** Processa a fila: tudo que está em "fila" ou "erro" é reenviado. */
export async function processarFila(): Promise<ResultadoFila> {
  // Só a fila de quem está logado: o envio usa a sessão dessa pessoa.
  const itens = await minhaFila().toArray()
  let enviados = 0
  const erros: string[] = []
  for (const item of itens) {
    const res = await enviarRascunho(item)
    if (res.ok) {
      await prevDb.transaction('rw', prevDb.rascunhos, prevDb.fotos, async () => {
        await prevDb.rascunhos.delete(item.id)
        await prevDb.fotos.where('preventivaId').equals(item.id).delete()
      })
      enviados++
    } else if (!res.offline) {
      await prevDb.rascunhos.update(item.id, { estado: 'erro', erro: res.mensagem })
      erros.push(res.mensagem)
    }
  }
  return { enviados, pendentes: itens.length - enviados, erros }
}
