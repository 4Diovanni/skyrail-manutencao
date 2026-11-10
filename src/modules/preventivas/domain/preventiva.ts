import type { Turno } from '../../../domain/turno'
import { temposVazios } from '../../relatorio/domain/tempos'
import type { StatusReprog, Tempos } from '../../relatorio/domain/tipos'
import type { ModeloChecklist } from './modelo'
import { progresso, type Respostas } from './respostas'

export type StatusPreventiva = 'Em andamento' | 'Concluído' | 'Não realizado'
export const STATUS_PREVENTIVA: readonly StatusPreventiva[] = ['Em andamento', 'Concluído', 'Não realizado']

export interface Instrumento {
  nome: string
  calibracao?: string
  obs?: string
}

export interface DiaAtuacao {
  data: string
  turno: Turno
  tempos: Tempos
}

export interface Ocorrencia {
  id: string
  item?: string | null
  unidade?: string | null
  texto: string
}

/** Uma preventiva como fica no banco (tabela public.preventivas). */
export interface Preventiva {
  id: string
  modelo_id: string
  modelo_versao: number
  data: string
  turno: Turno
  local: string | null
  linha: string
  os_numero: string | null
  campos: Record<string, string>
  instrumentos: Instrumento[]
  tempos: Tempos
  dias: DiaAtuacao[]
  respostas: Respostas
  ocorrencias: Ocorrencia[]
  observacoes: string | null
  status: StatusPreventiva
  motivo: string | null
  supervisor_id: string | null
  resp_tecnico_id: string | null
  lider_id: string | null
  gestor_id: string | null
  reprog_pedido: boolean
  reprog_data: string | null
  reprog_status: StatusReprog | null
  criado_por: string
  versao: number
  enviado_em: string
}

/** Rascunho local: o que a equipe preenche antes de tocar em "Enviar". */
export type RascunhoPreventiva = Omit<Preventiva, 'modelo_versao' | 'versao' | 'enviado_em' | 'reprog_status' | 'criado_por'> & {
  equipe: string[]
  versaoBase: number | null
}

export function novaPreventiva(modelo: Pick<ModeloChecklist, 'id'>, data: string, turno: Turno): RascunhoPreventiva {
  return {
    id: crypto.randomUUID(),
    modelo_id: modelo.id,
    data,
    turno,
    local: null,
    linha: 'Linha 17 Ouro',
    os_numero: null,
    campos: {},
    instrumentos: [],
    tempos: temposVazios(),
    dias: [],
    respostas: {},
    ocorrencias: [],
    observacoes: null,
    status: 'Em andamento',
    motivo: null,
    supervisor_id: null,
    resp_tecnico_id: null,
    lider_id: null,
    gestor_id: null,
    reprog_pedido: false,
    reprog_data: null,
    equipe: [],
    versaoBase: null,
  }
}

const limpo = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null)

/** Converte o rascunho na linha da tabela preventivas (sem campos que o banco controla). */
export function rascunhoParaLinha(r: RascunhoPreventiva) {
  const { equipe: _e, versaoBase: _v, ...linha } = r
  const concluido = linha.status === 'Concluído'
  return {
    ...linha,
    local: limpo(linha.local),
    os_numero: limpo(linha.os_numero),
    motivo: limpo(linha.motivo),
    observacoes: limpo(linha.observacoes),
    instrumentos: linha.instrumentos.filter((i) => i.nome.trim()),
    ocorrencias: linha.ocorrencias.filter((o) => o.texto.trim()),
    campos: Object.fromEntries(Object.entries(linha.campos).filter(([, v]) => v && v.trim())),
    reprog_pedido: concluido ? false : linha.reprog_pedido,
    reprog_data: concluido || !linha.reprog_pedido ? null : linha.reprog_data,
  }
}

export function preventivaParaRascunho(p: Preventiva, equipe: string[]): RascunhoPreventiva {
  const { versao, enviado_em: _e, reprog_status: _s, modelo_versao: _m, criado_por: _c, ...resto } = p
  return { ...resto, tempos: { ...temposVazios(), ...p.tempos }, equipe, versaoBase: versao }
}

/** O que impede o envio. Rascunho "Em andamento" pode ir incompleto (a preventiva continua outro dia). */
export function errosEnvio(r: RascunhoPreventiva, modelo: ModeloChecklist | undefined): string[] {
  const e: string[] = []
  if (!modelo) e.push('O checklist desta preventiva ainda não foi carregado neste aparelho.')
  if (!limpo(r.local)) e.push(`Informe: ${modelo?.conteudo.local.rotulo ?? 'local'}.`)
  if (!r.equipe.length) e.push('Marque quem está na equipe.')
  if (r.status === 'Não realizado' && !limpo(r.motivo)) e.push('Informe o motivo da não realização.')
  if (r.reprog_pedido && r.status !== 'Concluído' && !limpo(r.motivo)) e.push('Informe o motivo do pedido de reprogramação.')
  if (modelo && r.status === 'Concluído') {
    const p = progresso(modelo.conteudo, r.respostas)
    if (p.respondidos < p.total) e.push(`Para concluir, responda todos os itens (faltam ${p.total - p.respondidos}).`)
  }
  return e
}
