import { supabase } from '../../../lib/supabase'
import { listarPessoas } from '../../relatorio/data/remoto'
import { chaveStorage } from '../../relatorio/pdf/caminho'
import { prevDb } from '../data/local'
import { atualizarModelos, buscarPreventiva } from '../data/remoto'
import { caminhoPreventiva, type TipoDocPrev } from './caminho'
import type { DadosPreventivaPdf, FotoPdf } from './dados'

async function baixar(bucket: string, path: string): Promise<Uint8Array | null> {
  const { data, error } = await supabase.storage.from(bucket).download(path)
  if (error || !data) return null
  return new Uint8Array(await data.arrayBuffer())
}

/** Busca no servidor tudo o que os PDFs precisam. Só assinaturas feitas na versão atual entram. */
export async function montarDadosPreventiva(id: string): Promise<DadosPreventivaPdf> {
  const r = await buscarPreventiva(id)
  if (!r) throw new Error('Preventiva não encontrada no servidor. Envie a preventiva antes de gerar o PDF.')
  const p = r.preventiva
  let modelo = await prevDb.modelos.get(p.modelo_id)
  if (!modelo) modelo = (await atualizarModelos()).find((m) => m.id === p.modelo_id)
  if (!modelo) throw new Error('O checklist desta preventiva não foi encontrado.')
  if (modelo.versao !== p.modelo_versao) {
    // O PDF usa o checklist atual; respostas de itens que saíram do modelo não aparecem.
    console.warn(`Checklist ${modelo.id} mudou da versão ${p.modelo_versao} para ${modelo.versao}.`)
  }
  const pessoas = await listarPessoas()
  const equipe = r.equipe.map((pid) => pessoas.find((x) => x.id === pid) ?? { id: pid, nome: null, matricula: null })
  const fotos: FotoPdf[] = []
  for (const f of r.fotos) {
    const bytes = await baixar('fotos', f.storage_path)
    if (bytes) fotos.push({ bytes, legenda: f.legenda, ocorrenciaId: f.ocorrencia_id })
  }
  const { data: ass } = await supabase
    .from('preventiva_assinaturas')
    .select('profile_id, papel')
    .eq('preventiva_id', id)
    .eq('versao', p.versao)
  const assinaturas: Record<string, Uint8Array> = {}
  const cache = new Map<string, Uint8Array | null>()
  for (const s of (ass ?? []) as { profile_id: string; papel: string }[]) {
    if (!cache.has(s.profile_id)) cache.set(s.profile_id, await baixar('assinaturas', `${s.profile_id}.png`))
    const png = cache.get(s.profile_id)
    if (png) assinaturas[`${s.profile_id}:${s.papel}`] = png
  }
  return { preventiva: p, modelo, equipe, pessoas, fotos, assinaturas }
}

/** Gera o PDF e guarda no servidor (bucket "documentos"), na pasta do dia/turno/tipo. */
export async function gerarEGuardarPreventiva(id: string, tipo: TipoDocPrev) {
  const d = await montarDadosPreventiva(id)
  const gerador =
    tipo === 'relatorio'
      ? (await import('./relatorio')).gerarRelatorio
      : tipo === 'roteiro'
        ? (await import('./roteiro')).gerarRoteiro
        : (await import('./registro')).gerarRegistro
  const bytes = await gerador(d)
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const { nome, caminho } = caminhoPreventiva(d.preventiva, d.modelo, tipo)
  const chave = chaveStorage(caminho)

  let guardado = true
  const up = await supabase.storage.from('documentos').upload(chave, blob, { contentType: 'application/pdf', upsert: false })
  // Já existe o mesmo arquivo (mesma versão): conta como guardado.
  if (up.error && !/exist|duplicate/i.test(up.error.message)) guardado = false
  if (guardado) {
    const { error } = await supabase.from('documentos').insert({
      preventiva_id: id,
      tipo,
      categoria: 'Preventiva',
      data: d.preventiva.data,
      turno: d.preventiva.turno,
      storage_path: chave,
      nome,
      tamanho: blob.size,
    })
    if (error && error.code !== '23505') guardado = false
  }
  return { blob, nome, guardado }
}
