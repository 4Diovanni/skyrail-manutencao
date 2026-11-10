import { turnoDe } from '../../../domain/turno'
import { temposVazios } from './tempos'
import type { Atividade, Categoria, RascunhoAtividade } from './tipos'

export function novoRascunho(data: string, categoria: Categoria, ordem: number, agora = new Date()): RascunhoAtividade {
  return {
    id: crypto.randomUUID(),
    data,
    turno: turnoDe(agora),
    categoria,
    tipo_prev: null,
    ordem,
    titulo: '',
    status: 'Concluída',
    motivo: null,
    local: null,
    sistema: null,
    hora_informe: null,
    equipamento: null,
    sintoma: null,
    diagnostico: null,
    intervencao: null,
    resultado: null,
    feito: null,
    nao_conformidades: null,
    cim: null,
    tempos: temposVazios(),
    os: {},
    registro: {},
    resp_tecnico_id: null,
    lider_id: null,
    gestor_id: null,
    reprog_pedido: false,
    reprog_data: null,
    equipe: [],
    versaoBase: null,
  }
}

/** Converte o rascunho na linha da tabela atividades (sem campos que o banco controla). */
export function rascunhoParaLinha(r: RascunhoAtividade) {
  const { equipe: _e, versaoBase: _v, ...linha } = r
  const limpo = (s: string | null) => (s && s.trim() ? s.trim() : null)
  return {
    ...linha,
    titulo: linha.titulo.trim(),
    motivo: limpo(linha.motivo),
    tipo_prev: linha.categoria === 'Preventiva' ? linha.tipo_prev : null,
    reprog_pedido: linha.status === 'Concluída' ? false : linha.reprog_pedido,
    reprog_data: linha.status === 'Concluída' || !linha.reprog_pedido ? null : linha.reprog_data,
  }
}

export function atividadeParaRascunho(a: Atividade, equipe: string[]): RascunhoAtividade {
  const { versao, enviado_em: _e, reprog_status: _s, ...resto } = a
  return { ...resto, tempos: { ...temposVazios(), ...a.tempos }, equipe, versaoBase: versao }
}
