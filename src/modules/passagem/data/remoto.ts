import type { Turno } from '../../../domain/turno'
import { supabase } from '../../../lib/supabase'
import { listarPessoas, type PessoaEquipe } from '../../relatorio/data/remoto'
import type { Atividade } from '../../relatorio/domain/tipos'
import { prevDb } from '../../preventivas/data/local'
import { atualizarModelos } from '../../preventivas/data/remoto'
import type { Preventiva } from '../../preventivas/domain/preventiva'
import { itemDeAtividade, itemDePreventiva, ordenarItens, preventivaNoTurno } from '../domain/itens'
import type { ItemTurno, Passagem } from '../domain/tipos'

function falhou(error: { message: string } | null): asserts error is null {
  if (error) throw new Error(error.message)
}

const ORDEM: Record<Turno, number> = { Diurno: 0, Noturno: 1 }

export async function buscarPassagem(data: string, turno: Turno): Promise<Passagem | null> {
  const { data: p, error } = await supabase.from('passagens').select('*').eq('data', data).eq('turno', turno).maybeSingle()
  falhou(error)
  return (p as Passagem | null) ?? null
}

/** A passagem mais recente antes deste turno (Diurno vem antes do Noturno no mesmo dia). */
export async function passagemAnterior(data: string, turno: Turno): Promise<Passagem | null> {
  const { data: l, error } = await supabase.from('passagens').select('*').lte('data', data).order('data', { ascending: false }).limit(4)
  falhou(error)
  const antes = ((l ?? []) as Passagem[]).filter((p) => p.data < data || (p.data === data && ORDEM[p.turno] < ORDEM[turno]))
  antes.sort((a, b) => (a.data === b.data ? ORDEM[b.turno] - ORDEM[a.turno] : b.data.localeCompare(a.data)))
  return antes[0] ?? null
}

const nomes = (ids: string[], pessoas: PessoaEquipe[]) => ids.map((id) => pessoas.find((p) => p.id === id)?.nome || 'Sem nome')

function diasAntes(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

/** Tudo o que foi feito no turno, lido do Relatório e das Preventivas. */
export async function itensDoTurno(data: string, turno: Turno): Promise<ItemTurno[]> {
  const [ativ, prev, pessoas] = await Promise.all([
    supabase.from('atividades').select('*, atividade_equipe(profile_id, ordem)').eq('data', data).eq('turno', turno).order('ordem'),
    // Preventiva de vários dias: começa até 30 dias antes e tem um dia extra neste turno.
    supabase.from('preventivas').select('*, preventiva_equipe(profile_id, ordem)').gte('data', diasAntes(data, 30)).lte('data', data),
    listarPessoas(),
  ])
  falhou(ativ.error)
  falhou(prev.error)
  let modelos = await prevDb.modelos.toArray()
  if (!modelos.length) modelos = await atualizarModelos().catch(() => [])
  type Eq = { profile_id: string; ordem: number }[]
  const ids = (eq: Eq) => [...eq].sort((a, b) => a.ordem - b.ordem).map((e) => e.profile_id)
  const itens: ItemTurno[] = []
  for (const r of (ativ.data ?? []) as (Atividade & { atividade_equipe: Eq })[]) {
    itens.push(itemDeAtividade(r, nomes(ids(r.atividade_equipe), pessoas)))
  }
  for (const r of (prev.data ?? []) as (Preventiva & { preventiva_equipe: Eq })[]) {
    if (!preventivaNoTurno(r, data, turno)) continue
    const m = modelos.find((x) => x.id === r.modelo_id)
    itens.push(itemDePreventiva(r, m, nomes(ids(r.preventiva_equipe), pessoas), data, turno))
  }
  return ordenarItens(itens, turno)
}
