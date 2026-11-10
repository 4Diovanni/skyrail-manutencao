/** Estrutura de um modelo de checklist (coluna checklist_modelos.conteudo e o JSON de importação). */

export type TipoPrev = 'P0' | 'PQ' | 'P1' | 'P3' | 'P6' | 'P12' | 'P2A' | 'P3A' | 'P5A'

export interface Medicao {
  id: string
  rotulo: string
  min: number | null
  max: number | null
}

export interface ItemChecklist {
  id: string
  curto?: string
  atividade: string
  comoFazer?: string
  criterio?: string
  acaoNok?: string
  ferramentas?: string
  parametro?: string
  requisitos?: { titulo: string; linhas: string[] }
  medicoes?: Medicao[]
  figuras?: number[]
}

/** "unidade": o item é respondido para cada unidade (ex.: cada porta). "geral": uma resposta só. */
export type Escopo = 'unidade' | 'geral'

export interface GrupoChecklist {
  titulo: string
  subtitulo?: string
  escopo: Escopo
  itens: string[]
}

export interface Unidades {
  /** Ex.: "Porta" */
  rotulo: string
  /** Ex.: Fachada 1 → PDM11, PDM13... */
  grupos: { nome: string; unidades: string[] }[]
}

export interface CampoExtra {
  id: string
  rotulo: string
  opcoes?: string[]
}

export interface ConteudoModelo {
  titulo: string
  tituloRoteiro?: string
  plano?: string
  referencia?: string
  revisaoReferencia?: string
  nota?: string
  sistemaTexto?: string
  equipamento?: string
  tituloGeral?: string
  local: { rotulo: string; opcoes?: string[] }
  camposExtras?: CampoExtra[]
  unidades?: Unidades
  /** Medição feita em cada unidade (ex.: tensão da correia de cada porta). */
  medicaoUnidade?: { item: string; rotulo: string; min: number | null; max: number | null }
  grupos: GrupoChecklist[]
  itens: ItemChecklist[]
  figuras?: Record<string, string>
  guia?: { titulo: string; texto?: string; lista?: string[] }[]
  semGuiaPorItem?: boolean
  tabelas?: { titulo: string; campo?: string; linhas: { rotulo: string; figura?: number; texto: string }[] }[]
  ferramentasLista?: { categoria: string; itens: { texto: string; itens: string[] }[] }[]
}

export interface ModeloChecklist {
  id: string
  sistema: string
  sistemaNome: string
  sistemaDescricao?: string | null
  codigo: string
  tipoPrev: TipoPrev
  periodicidade: string
  rotulo?: string | null
  resumo?: string | null
  formulario?: string | null
  ordem: number
  ativo: boolean
  versao?: number
  conteudo: ConteudoModelo
}

/** Confere a consistência de um modelo; devolve a lista de problemas (vazia = ok). */
export function problemasModelo(m: ModeloChecklist): string[] {
  const p: string[] = []
  const c = m.conteudo
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(m.id)) p.push(`id inválido: ${m.id}`)
  if (!c.titulo) p.push('sem título')
  const ids = new Set<string>()
  for (const it of c.itens) {
    if (ids.has(it.id)) p.push(`item repetido: ${it.id}`)
    ids.add(it.id)
    if (!it.atividade) p.push(`item ${it.id} sem atividade`)
    const meds = new Set<string>()
    for (const md of it.medicoes ?? []) {
      if (meds.has(md.id)) p.push(`medição repetida no item ${it.id}: ${md.id}`)
      meds.add(md.id)
      if (md.min !== null && md.max !== null && md.min > md.max) p.push(`limites invertidos em ${it.id}/${md.id}`)
    }
  }
  const usados = new Set<string>()
  for (const g of c.grupos) {
    if (g.escopo === 'unidade' && !c.unidades) p.push(`grupo "${g.titulo}" é por unidade mas o modelo não tem unidades`)
    for (const id of g.itens) {
      if (!ids.has(id)) p.push(`grupo "${g.titulo}" cita item inexistente: ${id}`)
      if (usados.has(id)) p.push(`item ${id} aparece em mais de um grupo`)
      usados.add(id)
    }
  }
  for (const id of ids) if (!usados.has(id)) p.push(`item ${id} fora de qualquer grupo`)
  if (c.medicaoUnidade && !ids.has(c.medicaoUnidade.item)) p.push(`medição por unidade cita item inexistente: ${c.medicaoUnidade.item}`)
  return p
}
