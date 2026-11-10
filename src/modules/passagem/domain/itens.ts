import type { Turno } from '../../../domain/turno'
import { duracaoEtapa } from '../../relatorio/domain/tempos'
import type { Atividade, StatusAtividade, Tempos } from '../../relatorio/domain/tipos'
import type { Preventiva, StatusPreventiva } from '../../preventivas/domain/preventiva'
import type { ItemTurno } from './tipos'

const STATUS_PREV: Record<StatusPreventiva, StatusAtividade> = {
  Concluído: 'Concluída',
  'Em andamento': 'Em andamento',
  'Não realizado': 'Não realizada',
}

function atuacao(t: Tempos): Pick<ItemTurno, 'atuacao' | 'minutos'> {
  const a = t.atu
  if (!a || a.na || !a.i) return { atuacao: null, minutos: null }
  return { atuacao: { i: a.i, f: a.f }, minutos: duracaoEtapa(a) }
}

export function itemDeAtividade(a: Atividade, equipe: string[]): ItemTurno {
  return {
    id: a.id,
    origem: 'atividade',
    categoria: a.categoria,
    tipoPrev: a.tipo_prev,
    titulo: a.titulo,
    local: a.local,
    sistema: a.sistema,
    cim: a.cim,
    status: a.status,
    motivo: a.motivo,
    reprogPedido: a.reprog_pedido,
    reprogData: a.reprog_data,
    reprogStatus: a.reprog_status,
    ...atuacao(a.tempos),
    equipe,
  }
}

/** Uma preventiva aparece em todo turno em que houve atuação (primeiro dia e dias extras). */
export function preventivaNoTurno(p: Pick<Preventiva, 'data' | 'turno' | 'dias'>, data: string, turno: Turno) {
  return (p.data === data && p.turno === turno) || p.dias.some((d) => d.data === data && d.turno === turno)
}

export function itemDePreventiva(
  p: Preventiva,
  m: { sistemaNome: string; codigo: string; tipoPrev: string } | undefined,
  equipe: string[],
  data: string,
  turno: Turno,
): ItemTurno {
  const dia = p.data === data && p.turno === turno ? p.tempos : (p.dias.find((d) => d.data === data && d.turno === turno)?.tempos ?? {})
  const total = 1 + p.dias.length
  const n = p.data === data && p.turno === turno ? 1 : p.dias.findIndex((d) => d.data === data && d.turno === turno) + 2
  return {
    id: p.id,
    origem: 'preventiva',
    categoria: 'Preventiva',
    tipoPrev: m?.tipoPrev ?? null,
    titulo: `${m ? `${m.sistemaNome} ${m.codigo}` : p.modelo_id}${total > 1 ? ` · dia ${n}/${total}` : ''}`,
    local: p.local,
    sistema: m?.sistemaNome ?? null,
    cim: null,
    status: STATUS_PREV[p.status],
    motivo: p.motivo,
    reprogPedido: p.reprog_pedido,
    reprogData: p.reprog_data,
    reprogStatus: p.reprog_status,
    ...atuacao(dia),
    equipe,
  }
}

/** Ordem do turno: pelo início da atuação; sem horário vai para o fim. */
export function ordenarItens(itens: ItemTurno[], turno: Turno): ItemTurno[] {
  const base = turno === 'Noturno' ? 18 * 60 : 6 * 60
  const chave = (x: ItemTurno) => {
    if (!x.atuacao?.i) return Number.MAX_SAFE_INTEGER
    const [h, mm] = x.atuacao.i.split(':').map(Number)
    return (((h ?? 0) * 60 + (mm ?? 0) - base) % 1440 + 1440) % 1440
  }
  return [...itens].sort((a, b) => chave(a) - chave(b))
}
