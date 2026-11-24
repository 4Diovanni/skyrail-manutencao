import type { ResultadoFila } from '../../../lib/avisos'
import { supabase } from '../../../lib/supabase'
import { rascunhoParaLinha } from '../domain/rascunho'
import { localDb, type RascunhoLocal } from './local'

export type ResultadoEnvio =
  | { ok: true; versao: number; sobrescreveu: boolean }
  | { ok: false; offline: boolean; mensagem: string }

const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false

/** Envia um rascunho: atividade, equipe (por diferença) e fotos. O último envio vale; o banco guarda o anterior. */
export async function enviarRascunho(r: RascunhoLocal): Promise<ResultadoEnvio> {
  if (offline()) return { ok: false, offline: true, mensagem: 'Sem internet. O envio fica na fila.' }
  const d = r.dados
  try {
    // Havia versão mais nova de outra pessoa? (só para avisar; o envio segue valendo)
    let sobrescreveu = false
    if (d.versaoBase != null) {
      const { data: atual } = await supabase.from('atividades').select('versao').eq('id', d.id).maybeSingle()
      sobrescreveu = !!atual && atual.versao !== d.versaoBase
    }

    const { data: salva, error } = await supabase.from('atividades').upsert(rascunhoParaLinha(d)).select('versao').single()
    if (error) throw error

    // Equipe: insere quem entrou antes de remover quem saiu (quem edita pode estar saindo da equipe).
    const { data: eqAtual, error: e1 } = await supabase.from('atividade_equipe').select('profile_id').eq('atividade_id', d.id)
    if (e1) throw e1
    const antes = new Set((eqAtual ?? []).map((e) => e.profile_id as string))
    const linhasEquipe = d.equipe.map((profile_id, ordem) => ({ atividade_id: d.id, profile_id, ordem }))
    if (linhasEquipe.length) {
      const { error: e2 } = await supabase.from('atividade_equipe').upsert(linhasEquipe)
      if (e2) throw e2
    }
    const sairam = [...antes].filter((id) => !d.equipe.includes(id))
    if (sairam.length) {
      const { error: e3 } = await supabase.from('atividade_equipe').delete().eq('atividade_id', d.id).in('profile_id', sairam)
      if (e3) throw e3
    }

    await enviarFotos(d.id)
    return { ok: true, versao: salva.versao as number, sobrescreveu }
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e)
    return { ok: false, offline: offline(), mensagem }
  }
}

async function enviarFotos(atividadeId: string) {
  const fotos = await localDb.fotos.where('atividadeId').equals(atividadeId).toArray()
  for (const f of fotos) {
    if (f.removida) {
      if (f.storagePath) {
        await supabase.from('atividade_fotos').delete().eq('id', f.id)
        await supabase.storage.from('fotos').remove([f.storagePath])
      }
      await localDb.fotos.delete(f.id)
      continue
    }
    let path = f.storagePath
    if (!path && f.blob) {
      path = `${atividadeId}/${f.id}.jpg`
      const { error } = await supabase.storage.from('fotos').upload(path, f.blob, { contentType: 'image/jpeg', upsert: true })
      if (error) throw error
      await localDb.fotos.update(f.id, { storagePath: path, blob: undefined })
    }
    if (!path) continue
    const { error } = await supabase
      .from('atividade_fotos')
      .upsert({ id: f.id, atividade_id: atividadeId, storage_path: path, legenda: f.legenda || null, ordem: f.ordem })
    if (error) throw error
  }
}

/** Processa a fila: tudo que está em "fila" ou "erro" é reenviado. */
export async function processarFila(): Promise<ResultadoFila> {
  const itens = await localDb.rascunhos.where('estado').anyOf('fila', 'erro').toArray()
  let enviados = 0
  const erros: string[] = []
  for (const item of itens) {
    const res = await enviarRascunho(item)
    if (res.ok) {
      await localDb.transaction('rw', localDb.rascunhos, localDb.fotos, async () => {
        await localDb.rascunhos.delete(item.id)
        await localDb.fotos.where('atividadeId').equals(item.id).delete()
      })
      enviados++
    } else if (!res.offline) {
      await localDb.rascunhos.update(item.id, { estado: 'erro', erro: res.mensagem })
      erros.push(res.mensagem)
    }
  }
  return { enviados, pendentes: itens.length - enviados, erros }
}
