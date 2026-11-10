import type { Turno } from '../../../domain/turno'
import { supabase } from '../../../lib/supabase'
import { chaveStorage } from '../../relatorio/pdf/caminho'
import { buscarPassagem, itensDoTurno } from '../data/remoto'
import { caminhoPassagem } from './caminho'
import { gerarPassagem, type DocumentoTurno } from './passagem'

/** Gera o PDF da versão enviada da passagem e guarda no servidor. */
export async function gerarEGuardarPassagem(data: string, turno: Turno) {
  const p = await buscarPassagem(data, turno)
  if (!p) throw new Error('Envie a passagem antes de gerar o PDF.')
  const itens = await itensDoTurno(data, turno)
  const { data: docs } = await supabase
    .from('documentos')
    .select('nome, tipo, gerado_em')
    .eq('data', data)
    .eq('turno', turno)
    .neq('tipo', 'passagem')
    .order('gerado_em')
  const documentos: DocumentoTurno[] = ((docs ?? []) as DocumentoTurno[]).map(({ nome, tipo }) => ({ nome, tipo }))
  const bytes = await gerarPassagem({ passagem: p, itens, documentos })
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const { nome, caminho } = caminhoPassagem(data, turno, p.versao)
  const chave = chaveStorage(caminho)

  let guardado = true
  const up = await supabase.storage.from('documentos').upload(chave, blob, { contentType: 'application/pdf', upsert: false })
  if (up.error && !/exist|duplicate/i.test(up.error.message)) guardado = false
  if (guardado) {
    const { error } = await supabase.from('documentos').insert({
      passagem_id: p.id,
      tipo: 'passagem',
      categoria: null,
      data,
      turno,
      storage_path: chave,
      nome,
      tamanho: blob.size,
    })
    if (error && error.code !== '23505') guardado = false
  }
  return { blob, nome, guardado }
}
