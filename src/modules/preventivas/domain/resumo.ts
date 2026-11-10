import { duracaoEtapa, formatarMinutos } from '../../relatorio/domain/tempos'
import type { ConteudoModelo, ModeloChecklist } from './modelo'
import type { RascunhoPreventiva } from './preventiva'
import { chave, foraDoLimite, todasUnidades } from './respostas'

type P = Pick<RascunhoPreventiva, 'respostas' | 'ocorrencias' | 'tempos' | 'local' | 'os_numero' | 'observacoes'>

export interface Resumo {
  /** Itens por unidade × unidades */
  porUnidade: { total: number; ok: number; nok: { item: string; unidade: string }[]; na: number; branco: Record<string, string[]> }
  geral: { total: number; ok: number; nok: string[]; na: number; branco: string[] }
}

export const itensPorUnidade = (c: ConteudoModelo) => c.grupos.filter((g) => g.escopo === 'unidade').flatMap((g) => g.itens)
export const itensGerais = (c: ConteudoModelo) => c.grupos.filter((g) => g.escopo === 'geral').flatMap((g) => g.itens)

export function resumir(c: ConteudoModelo, p: P): Resumo {
  const r: Resumo = {
    porUnidade: { total: 0, ok: 0, nok: [], na: 0, branco: {} },
    geral: { total: 0, ok: 0, nok: [], na: 0, branco: [] },
  }
  const uns = c.unidades ? todasUnidades(c) : []
  for (const unidade of uns) {
    for (const item of itensPorUnidade(c)) {
      r.porUnidade.total++
      const v = p.respostas[chave(item, unidade)]?.r
      if (v === 'OK') r.porUnidade.ok++
      else if (v === 'NOK') r.porUnidade.nok.push({ item, unidade })
      else if (v === 'NA') r.porUnidade.na++
      else (r.porUnidade.branco[item] ??= []).push(unidade)
    }
  }
  for (const item of itensGerais(c)) {
    r.geral.total++
    const v = p.respostas[item]?.r
    if (v === 'OK') r.geral.ok++
    else if (v === 'NOK') r.geral.nok.push(item)
    else if (v === 'NA') r.geral.na++
    else r.geral.branco.push(item)
  }
  return r
}

/** Textos de uma unidade (observações, ocorrências e medição) para a coluna "Observações". */
export function obsUnidade(c: ConteudoModelo, p: P, unidade: string, incluirMedicao = true): string {
  const out: string[] = []
  const mu = c.medicaoUnidade
  if (mu && incluirMedicao) {
    const v = p.respostas[chave(mu.item, unidade)]?.med?.un
    if (v != null) out.push(`${mu.rotulo.replace(/ \([^)]*\)/, '')}: ${v}${foraDoLimite(v, mu.min, mu.max) ? ' (fora da faixa)' : ''}`)
  }
  for (const item of itensPorUnidade(c)) {
    const r = p.respostas[chave(item, unidade)]
    const textos = [r?.obs?.trim(), ...p.ocorrencias.filter((o) => o.unidade === unidade && o.item === item).map((o) => o.texto.trim())].filter(Boolean)
    const unicos = [...new Set(textos)]
    if (unicos.length) out.push(`Item ${item}: ${unicos.join(' / ')}`)
    else if (r?.r === 'NOK') out.push(`Item ${item}: NOK`)
  }
  return out.join(' · ')
}

/** Observações de um item geral (texto do item, medições e ocorrências ligadas a ele). */
export function obsGeral(c: ConteudoModelo, p: P, item: string): string {
  const r = p.respostas[item]
  const it = c.itens.find((i) => i.id === item)
  const meds = (it?.medicoes ?? [])
    .filter((m) => r?.med?.[m.id] != null)
    .map((m) => `${m.rotulo}: ${r!.med![m.id]}${foraDoLimite(r!.med![m.id], m.min, m.max) ? ' (fora do limite)' : ''}`)
  const textos = [r?.obs?.trim(), ...p.ocorrencias.filter((o) => !o.unidade && o.item === item).map((o) => o.texto.trim())].filter(Boolean)
  return [...meds, ...new Set(textos)].join(' · ')
}

const curto = (c: ConteudoModelo, id: string) => {
  const it = c.itens.find((i) => i.id === id)
  return it?.curto ?? it?.atividade.slice(0, 60) ?? ''
}

/** Linhas do Registro de Manutenção (FO.MNT.S.0008), no mesmo texto do app original. */
export function linhasRegistro(m: ModeloChecklist, p: P): string[] {
  const c = m.conteudo
  const s = resumir(c, p)
  const L: string[] = []
  const local = p.local || '—'
  const os = p.os_numero ? `, ordem ${p.os_numero}` : ''
  const nivel = `${m.periodicidade.toLowerCase()} (${m.codigo})`
  const totalOk = s.porUnidade.ok + s.geral.ok
  const totalNok = s.porUnidade.nok.length + s.geral.nok.length
  const totalNa = s.porUnidade.na + s.geral.na
  const brancos = Object.values(s.porUnidade.branco).reduce((n, a) => n + a.length, 0) + s.geral.branco.length
  const fim = `sendo ${totalOk} OK e ${totalNok} NOK${totalNok ? ' por conta das observações descritas abaixo' : ''}${totalNa ? `, ${totalNa} NA` : ''}${brancos ? ` e ${brancos} não executado(s)` : ''}.`
  const ref = c.referencia ? `, conforme roteiro do manual ${c.referencia}` : ''
  if (c.unidades && s.porUnidade.total) {
    const nu = todasUnidades(c).length
    L.push(
      `Foi realizada a manutenção preventiva ${nivel} ${c.sistemaTexto ? `do ${c.sistemaTexto}` : `de ${m.sistemaNome}`} na ${c.local.rotulo.toLowerCase()} ${local}${os}${ref}, com ${itensPorUnidade(c).length} itens verificados em ${nu} ${c.unidades.rotulo.toLowerCase()}s (${s.porUnidade.total} verificações) e ${s.geral.total} atividade(s) geral(is), ${fim}`,
    )
  } else {
    L.push(`Foi realizada a manutenção preventiva ${nivel} de ${m.sistemaNome} em ${local}${os}${ref}, com ${s.geral.total} itens de inspeção verificados, ${fim}`)
  }
  const atu = p.tempos.atu
  const dur = atu ? duracaoEtapa(atu) : null
  if (atu?.i && atu.f && dur != null) L.push(`Atuação das ${atu.i} às ${atu.f} (${formatarMinutos(dur)}).`)
  if (totalNok) {
    L.push('Não conformidades (NOK) identificadas:')
    for (const { item, unidade } of s.porUnidade.nok) {
      const t = obsUnidadeItem(p, item, unidade)
      L.push(`• ${unidade} – Item ${item} (${curto(c, item)}): ${t || 'não conformidade registrada sem descrição.'}`)
    }
    for (const item of s.geral.nok) {
      L.push(`• Item ${item} (${curto(c, item)}): ${obsGeral(c, p, item) || 'não conformidade registrada sem descrição.'}`)
    }
  }
  const outras = itensGerais(c)
    .filter((i) => p.respostas[i]?.r !== 'NOK' && obsGeral(c, p, i))
    .map((i) => `• Item ${i} (${curto(c, i)}): ${obsGeral(c, p, i)}`)
  if (outras.length) L.push('Outras observações registradas:', ...outras)
  for (const [item, uns] of Object.entries(s.porUnidade.branco)) {
    L.push(`Pendência: item ${item} (${curto(c, item)}) não executado em ${uns.length} ${c.unidades?.rotulo.toLowerCase() ?? 'unidade'}(s): ${uns.join(', ')}.`)
  }
  if (s.geral.branco.length) L.push(`Pendência: item(ns) ${s.geral.branco.join(', ')} sem registro de execução.`)
  if (p.observacoes?.trim()) L.push(`Observação geral: ${p.observacoes.trim()}`)
  return L
}

function obsUnidadeItem(p: P, item: string, unidade: string): string {
  const r = p.respostas[chave(item, unidade)]
  const t = [r?.obs?.trim(), ...p.ocorrencias.filter((o) => o.unidade === unidade && o.item === item).map((o) => o.texto.trim())].filter(Boolean)
  return [...new Set(t)].join(' / ')
}
