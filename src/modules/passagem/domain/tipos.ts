import type { Turno } from '../../../domain/turno'
import type { StatusAtividade, StatusReprog } from '../../relatorio/domain/tipos'

export interface LinhaCondicao {
  /** Indicador, ex.: "Operação assistida". */
  i: string
  /** Condição registrada. */
  c: string
  /** Texto preenchido pelo app a partir das atividades (some se a pessoa editar). */
  auto?: boolean
}

export interface Ocorrencia {
  /** Local e equipamento. */
  l: string
  /** Descrição e ação requerida. */
  d: string
}

export interface Programada {
  nome: string
  tipo: string
  local: string
}

export type Prioridade = 'alta' | 'media' | 'baixa'
export const PRIORIDADES: [Prioridade, string, string][] = [
  ['alta', 'Ocorrências de alta prioridade', 'Condição e continuidade requerida'],
  ['media', 'Ocorrências de média prioridade', 'Ocorrência e ação requerida'],
  ['baixa', 'Ocorrências de baixa prioridade', 'Ocorrência'],
]

export const INTRO_PADRAO = 'Registro da condição operacional, do atendimento corretivo e das ocorrências transferidas ao turno seguinte.'
export const CONDICOES_PADRAO = ['Operação assistida', 'Rondas e checklists', 'Ocorrências atendidas', 'Ocorrências críticas']

/** O que a equipe escreve na passagem (tabela "passagens"). */
export interface Passagem {
  id: string
  data: string
  turno: Turno
  intro: string | null
  condicoes: LinhaCondicao[]
  alta: Ocorrencia[]
  media: Ocorrencia[]
  baixa: Ocorrencia[]
  programadas: Programada[]
  encerramento: string | null
  versao: number
  enviado_por: string | null
  enviado_em: string
}

export type RascunhoPassagem = Omit<Passagem, 'versao' | 'enviado_por' | 'enviado_em'> & { versaoBase: number | null }

/**
 * Uma atividade do turno, vinda do Relatório (atividades) ou das Preventivas.
 * A passagem só lê estes dados; quem altera é o módulo de origem.
 */
export interface ItemTurno {
  id: string
  origem: 'atividade' | 'preventiva'
  categoria: 'Corretiva' | 'Preventiva'
  tipoPrev: string | null
  titulo: string
  local: string | null
  sistema: string | null
  cim: string | null
  status: StatusAtividade
  motivo: string | null
  reprogPedido: boolean
  reprogData: string | null
  reprogStatus: StatusReprog | null
  /** Início e fim da atuação, "HH:MM". */
  atuacao: { i: string; f: string } | null
  minutos: number | null
  equipe: string[]
}
