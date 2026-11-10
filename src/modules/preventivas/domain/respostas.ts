import type { ConteudoModelo, ItemChecklist } from './modelo'

export type Resultado = 'OK' | 'NOK' | 'NA'

export interface Resposta {
  r?: Resultado
  obs?: string
  /** Valores medidos, por id da medição */
  med?: Record<string, number | null>
}

/** Chave da resposta: "<item>" para itens gerais, "<item>@<unidade>" para itens por unidade. */
export type Respostas = Record<string, Resposta>

export function chave(item: string, unidade?: string | null): string {
  return unidade ? `${item}@${unidade}` : item
}

export function todasUnidades(c: ConteudoModelo): string[] {
  return c.unidades?.grupos.flatMap((g) => g.unidades) ?? []
}

/** Todas as linhas que precisam de resposta, na ordem do formulário. */
export function linhas(c: ConteudoModelo): { item: string; unidade?: string }[] {
  const out: { item: string; unidade?: string }[] = []
  const uns = todasUnidades(c)
  for (const g of c.grupos) {
    for (const item of g.itens) {
      if (g.escopo === 'unidade') for (const unidade of uns) out.push({ item, unidade })
      else out.push({ item })
    }
  }
  return out
}

export interface Progresso {
  total: number
  respondidos: number
  nok: number
  na: number
}

export function progresso(c: ConteudoModelo, resp: Respostas): Progresso {
  const p: Progresso = { total: 0, respondidos: 0, nok: 0, na: 0 }
  for (const l of linhas(c)) {
    p.total++
    const r = resp[chave(l.item, l.unidade)]?.r
    if (r) p.respondidos++
    if (r === 'NOK') p.nok++
    if (r === 'NA') p.na++
  }
  return p
}

/** Marca OK tudo o que ainda está sem resposta (não sobrescreve NOK/NA já marcados). */
export function marcarPendentesOk(c: ConteudoModelo, resp: Respostas, filtro?: (l: { item: string; unidade?: string }) => boolean): Respostas {
  const novo: Respostas = { ...resp }
  for (const l of linhas(c)) {
    if (filtro && !filtro(l)) continue
    const k = chave(l.item, l.unidade)
    if (!novo[k]?.r) novo[k] = { ...novo[k], r: 'OK' }
  }
  return novo
}

/** true quando o valor está fora dos limites (limite ausente não restringe). */
export function foraDoLimite(valor: number | null | undefined, min: number | null, max: number | null): boolean {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return false
  return (min !== null && valor < min) || (max !== null && valor > max)
}

/** Medições do item que estão fora dos limites. */
export function medicoesForaDoLimite(item: ItemChecklist, r: Resposta | undefined): string[] {
  return (item.medicoes ?? []).filter((m) => foraDoLimite(r?.med?.[m.id], m.min, m.max)).map((m) => m.id)
}
