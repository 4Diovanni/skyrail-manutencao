import { supabase } from '../../../lib/supabase'
import type { Atividade, StatusReprog } from '../domain/tipos'

export interface PessoaEquipe {
  id: string
  nome: string | null
  matricula: string | null
}

export interface FotoRemota {
  id: string
  atividade_id: string
  storage_path: string
  legenda: string | null
  ordem: number
}

function falhou(error: { message: string } | null): asserts error is null {
  if (error) throw new Error(error.message)
}

export async function listarAtividades(data: string): Promise<(Atividade & { equipe: string[] })[]> {
  const { data: rows, error } = await supabase
    .from('atividades')
    .select('*, atividade_equipe(profile_id, ordem)')
    .eq('data', data)
    .order('ordem')
  falhou(error)
  return (rows ?? []).map((r) => {
    const { atividade_equipe, ...a } = r as Atividade & { atividade_equipe: { profile_id: string; ordem: number }[] }
    return { ...a, equipe: [...atividade_equipe].sort((x, y) => x.ordem - y.ordem).map((e) => e.profile_id) }
  })
}

export async function buscarAtividade(id: string) {
  const { data, error } = await supabase
    .from('atividades')
    .select('*, atividade_equipe(profile_id, ordem), atividade_fotos(*)')
    .eq('id', id)
    .maybeSingle()
  falhou(error)
  if (!data) return null
  const { atividade_equipe, atividade_fotos, ...a } = data as Atividade & {
    atividade_equipe: { profile_id: string; ordem: number }[]
    atividade_fotos: FotoRemota[]
  }
  return {
    atividade: a as Atividade,
    equipe: [...atividade_equipe].sort((x, y) => x.ordem - y.ordem).map((e) => e.profile_id),
    fotos: [...atividade_fotos].sort((x, y) => x.ordem - y.ordem),
  }
}

export async function listarPessoas(): Promise<PessoaEquipe[]> {
  const { data, error } = await supabase.from('profiles').select('id, nome, matricula').eq('ativo', true).order('nome')
  falhou(error)
  return data ?? []
}

export async function listarCatalogo(tabela: 'catalogo_locais' | 'catalogo_sistemas'): Promise<string[]> {
  const { data, error } = await supabase.from(tabela).select('codigo').eq('ativo', true).order('ordem')
  falhou(error)
  return (data ?? []).map((r) => r.codigo as string)
}

export async function urlFoto(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('fotos').createSignedUrl(path, 3600)
  return data?.signedUrl ?? null
}

export async function excluirAtividade(id: string) {
  const { error } = await supabase.from('atividades').delete().eq('id', id)
  falhou(error)
}

export async function listarReprogramacoesPendentes(): Promise<Atividade[]> {
  const { data, error } = await supabase.from('atividades').select('*').eq('reprog_status', 'pendente').order('data')
  falhou(error)
  return (data ?? []) as Atividade[]
}

export async function decidirReprogramacao(id: string, decisao: Exclude<StatusReprog, 'pendente'>) {
  const { error } = await supabase.from('atividades').update({ reprog_status: decisao }).eq('id', id)
  falhou(error)
}
