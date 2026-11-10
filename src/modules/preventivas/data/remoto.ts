import { supabase } from '../../../lib/supabase'
import type { ModeloChecklist } from '../domain/modelo'
import type { Preventiva } from '../domain/preventiva'
import { prevDb } from './local'

export interface FotoRemota {
  id: string
  preventiva_id: string
  ocorrencia_id: string | null
  storage_path: string
  legenda: string | null
  ordem: number
}

function falhou(error: { message: string } | null): asserts error is null {
  if (error) throw new Error(error.message)
}

type LinhaModelo = {
  id: string
  sistema: string
  sistema_nome: string
  sistema_descricao: string | null
  codigo: string
  tipo_prev: ModeloChecklist['tipoPrev']
  periodicidade: string
  rotulo: string | null
  resumo: string | null
  formulario: string | null
  ordem: number
  ativo: boolean
  versao: number
  conteudo: ModeloChecklist['conteudo']
}

const deLinha = (l: LinhaModelo): ModeloChecklist => ({
  id: l.id,
  sistema: l.sistema,
  sistemaNome: l.sistema_nome,
  sistemaDescricao: l.sistema_descricao,
  codigo: l.codigo,
  tipoPrev: l.tipo_prev,
  periodicidade: l.periodicidade,
  rotulo: l.rotulo,
  resumo: l.resumo,
  formulario: l.formulario,
  ordem: l.ordem,
  ativo: l.ativo,
  versao: l.versao,
  conteudo: l.conteudo,
})

/** Baixa todos os modelos e guarda no aparelho, para abrir checklists sem internet. */
export async function atualizarModelos(): Promise<ModeloChecklist[]> {
  const { data, error } = await supabase.from('checklist_modelos').select('*').order('ordem')
  falhou(error)
  const modelos = ((data ?? []) as LinhaModelo[]).map(deLinha)
  await prevDb.transaction('rw', prevDb.modelos, async () => {
    await prevDb.modelos.clear()
    await prevDb.modelos.bulkPut(modelos)
  })
  return modelos
}

export async function listarPreventivas(desde: string): Promise<(Preventiva & { equipe: string[] })[]> {
  const { data, error } = await supabase
    .from('preventivas')
    .select('*, preventiva_equipe(profile_id, ordem)')
    .gte('data', desde)
    .order('data', { ascending: false })
    .limit(200)
  falhou(error)
  return (data ?? []).map((r) => {
    const { preventiva_equipe, ...p } = r as Preventiva & { preventiva_equipe: { profile_id: string; ordem: number }[] }
    return { ...p, equipe: [...preventiva_equipe].sort((x, y) => x.ordem - y.ordem).map((e) => e.profile_id) }
  })
}

export async function buscarPreventiva(id: string) {
  const { data, error } = await supabase
    .from('preventivas')
    .select('*, preventiva_equipe(profile_id, ordem), preventiva_fotos(*)')
    .eq('id', id)
    .maybeSingle()
  falhou(error)
  if (!data) return null
  const { preventiva_equipe, preventiva_fotos, ...p } = data as Preventiva & {
    preventiva_equipe: { profile_id: string; ordem: number }[]
    preventiva_fotos: FotoRemota[]
  }
  return {
    preventiva: p as Preventiva,
    equipe: [...preventiva_equipe].sort((x, y) => x.ordem - y.ordem).map((e) => e.profile_id),
    fotos: [...preventiva_fotos].sort((x, y) => x.ordem - y.ordem),
  }
}

export async function excluirPreventiva(id: string) {
  const { error } = await supabase.from('preventivas').delete().eq('id', id)
  falhou(error)
}
