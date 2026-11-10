import { supabase } from '../../../lib/supabase'
import { buscarAtividade, listarPessoas } from '../data/remoto'
import { caminhoDocumento, chaveStorage, type TipoDoc } from './caminho'
import type { DadosDocumento } from './dados'

async function baixar(bucket: string, path: string): Promise<Uint8Array | null> {
  const { data, error } = await supabase.storage.from(bucket).download(path)
  if (error || !data) return null
  return new Uint8Array(await data.arrayBuffer())
}

/** Busca no servidor tudo o que o PDF precisa. Só assinaturas feitas na versão atual entram. */
export async function montarDados(atividadeId: string, numero: number): Promise<DadosDocumento> {
  const r = await buscarAtividade(atividadeId)
  if (!r) throw new Error('Atividade não encontrada no servidor. Envie a atividade antes de gerar o PDF.')
  const pessoas = await listarPessoas()
  const equipe = r.equipe.map((id) => pessoas.find((p) => p.id === id) ?? { id, nome: null, matricula: null })
  const fotos = []
  for (const f of r.fotos) {
    const bytes = await baixar('fotos', f.storage_path)
    if (bytes) fotos.push({ bytes, legenda: f.legenda })
  }
  const { data: ass } = await supabase
    .from('atividade_assinaturas')
    .select('profile_id, papel')
    .eq('atividade_id', atividadeId)
    .eq('versao', r.atividade.versao)
  const assinaturas: Record<string, Uint8Array> = {}
  const cache = new Map<string, Uint8Array | null>()
  for (const s of ass ?? []) {
    if (!cache.has(s.profile_id)) cache.set(s.profile_id, await baixar('assinaturas', `${s.profile_id}.png`))
    const png = cache.get(s.profile_id)
    if (png) assinaturas[`${s.profile_id}:${s.papel}`] = png
  }
  return { atividade: r.atividade, numero, equipe, pessoas, fotos, assinaturas }
}

/** Gera o PDF e guarda no servidor (bucket "documentos"), na pasta do dia/turno/tipo. */
export async function gerarEGuardar(atividadeId: string, tipo: TipoDoc, numero: number) {
  const d = await montarDados(atividadeId, numero)
  const gerador =
    tipo === 'relatorio' ? (await import('./relatorio')).gerarRelatorio : tipo === 'os' ? (await import('./os')).gerarOS : (await import('./rm')).gerarRM
  const bytes = await gerador(d)
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const { nome, caminho } = caminhoDocumento(d.atividade, tipo, numero)
  const chave = chaveStorage(caminho)

  let guardado = true
  const up = await supabase.storage.from('documentos').upload(chave, blob, { contentType: 'application/pdf', upsert: false })
  // Já existe o mesmo arquivo (mesma versão): conta como guardado.
  if (up.error && !/exist|duplicate/i.test(up.error.message)) guardado = false
  if (guardado) {
    const { error } = await supabase.from('documentos').insert({
      atividade_id: d.atividade.id,
      tipo,
      categoria: d.atividade.categoria,
      data: d.atividade.data,
      turno: d.atividade.turno,
      storage_path: chave,
      nome,
      tamanho: blob.size,
    })
    if (error && error.code !== '23505') guardado = false
  }
  return { blob, nome, guardado }
}

/** Entrega o PDF no aparelho: compartilhar (celular) ou baixar. */
export async function entregarPdf(blob: Blob, nome: string) {
  const arquivo = new File([blob], nome, { type: 'application/pdf' })
  if (navigator.canShare?.({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo], title: nome })
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
