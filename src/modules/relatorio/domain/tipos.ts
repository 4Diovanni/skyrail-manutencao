import type { Turno } from '../../../domain/turno'

export type Categoria = 'Corretiva' | 'Preventiva'
export type StatusAtividade = 'Concluída' | 'Em andamento' | 'Não realizada'
export type StatusReprog = 'pendente' | 'aprovado' | 'recusado'

export const TIPOS_PREV = ['P0', 'PQ', 'P1', 'P3', 'P6', 'P12', 'P2A', 'P3A', 'P5A'] as const
export type TipoPrev = (typeof TIPOS_PREV)[number]

export const ETAPAS = [
  ['prep', 'Preparação'],
  ['desl', 'Deslocamento'],
  ['lib', 'Liberação do CCO'],
  ['atu', 'Atuação até a liberação'],
  ['ret', 'Retorno à base'],
] as const
export type Etapa = (typeof ETAPAS)[number][0]

export interface Intervalo {
  i: string
  f: string
  na?: boolean
}
export type Tempos = Partial<Record<Etapa, Intervalo>>

export interface DadosOS {
  numero?: string
  chamado?: string
  codigo?: string
  impacto?: 'Com impacto' | 'Sem impacto'
  causa?: string
  substituicao?: 'Sim' | 'Não'
  materiais?: { d: string; q: string }[]
  status_reparo?: 'Definitivo' | 'Provisório' | 'Não reparado'
  liberacao?: 'Liberado sem restrição' | 'Liberado com restrição' | 'Não liberado'
  resp_liberacao?: string
  data_hora_final?: string
}

export interface DadosRegistro {
  obs?: string
}

/** Uma atividade como fica no banco (tabela public.atividades). */
export interface Atividade {
  id: string
  data: string
  turno: Turno
  categoria: Categoria
  tipo_prev: TipoPrev | null
  ordem: number
  titulo: string
  status: StatusAtividade
  motivo: string | null
  local: string | null
  sistema: string | null
  hora_informe: string | null
  equipamento: string | null
  sintoma: string | null
  diagnostico: string | null
  intervencao: string | null
  resultado: string | null
  feito: string | null
  nao_conformidades: string | null
  cim: string | null
  tempos: Tempos
  os: DadosOS
  registro: DadosRegistro
  resp_tecnico_id: string | null
  lider_id: string | null
  gestor_id: string | null
  reprog_pedido: boolean
  reprog_data: string | null
  reprog_status: StatusReprog | null
  versao: number
  enviado_em: string
}

/** Rascunho local: o que o técnico preenche antes de tocar em "Enviar". */
export type RascunhoAtividade = Omit<Atividade, 'versao' | 'enviado_em' | 'reprog_status'> & {
  equipe: string[]
  versaoBase: number | null
}
