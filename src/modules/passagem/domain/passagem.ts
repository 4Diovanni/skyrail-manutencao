import type { Turno } from '../../../domain/turno'
import { formatarMinutos } from '../../relatorio/domain/tempos'
import {
  CONDICOES_PADRAO,
  INTRO_PADRAO,
  PRIORIDADES,
  type ItemTurno,
  type Ocorrencia,
  type Passagem,
  type Programada,
  type RascunhoPassagem,
} from './tipos'

export function novaPassagem(data: string, turno: Turno, id: string = crypto.randomUUID()): RascunhoPassagem {
  return {
    id,
    data,
    turno,
    intro: INTRO_PADRAO,
    condicoes: CONDICOES_PADRAO.map((i) => ({ i, c: '' })),
    alta: [],
    media: [],
    baixa: [],
    programadas: [],
    encerramento: '',
    versaoBase: null,
  }
}

export const passagemParaRascunho = (p: Passagem): RascunhoPassagem => {
  const { versao, enviado_por: _a, enviado_em: _b, ...resto } = p
  return { ...resto, versaoBase: versao }
}

const limpo = (s: string | null | undefined) => (s ?? '').trim()
const ocorrenciasValidas = (l: Ocorrencia[]) => l.map((o) => ({ l: limpo(o.l), d: limpo(o.d) })).filter((o) => o.l || o.d)

/** O que vai para o banco: textos aparados, linhas vazias fora. */
export function rascunhoParaLinha(r: RascunhoPassagem) {
  return {
    id: r.id,
    data: r.data,
    turno: r.turno,
    intro: limpo(r.intro) || null,
    condicoes: r.condicoes.map((c) => ({ i: limpo(c.i), c: limpo(c.c), ...(c.auto ? { auto: true } : {}) })).filter((c) => c.i || c.c),
    alta: ocorrenciasValidas(r.alta),
    media: ocorrenciasValidas(r.media),
    baixa: ocorrenciasValidas(r.baixa),
    programadas: r.programadas.map((p) => ({ nome: limpo(p.nome), tipo: p.tipo, local: limpo(p.local) })).filter((p) => p.nome || p.tipo),
    encerramento: limpo(r.encerramento) || null,
  }
}

export const norm = (t: string | null | undefined) =>
  String(t ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

/** Resumo do turno para o topo da tela e do PDF. */
export function resumoTurno(itens: ItemTurno[]) {
  const n = (f: (x: ItemTurno) => boolean) => itens.filter(f).length
  return {
    total: itens.length,
    corretivas: n((x) => x.categoria === 'Corretiva'),
    preventivas: n((x) => x.categoria === 'Preventiva'),
    concluidas: n((x) => x.status === 'Concluída'),
    andamento: n((x) => x.status === 'Em andamento'),
    naoRealizadas: n((x) => x.status === 'Não realizada'),
    minutos: itens.reduce((s, x) => s + (x.minutos ?? 0), 0),
  }
}

/** Texto automático de "Ocorrências atendidas" (regra do app antigo). */
export function textoOcorrenciasAtendidas(itens: ItemTurno[]): string {
  if (!itens.length) return ''
  const cor = itens.filter((x) => x.categoria === 'Corretiva')
  const pre = itens.filter((x) => x.categoria === 'Preventiva')
  const cim = cor.filter((x) => x.cim && x.cim.toUpperCase() !== 'N/A').length
  const lista = cor
    .map((x) => [x.local, x.titulo].filter(Boolean).join(' '))
    .slice(0, 6)
    .join(', ')
  const s = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`
  return (
    s(cor.length, 'atendimento corretivo', 'atendimentos corretivos') +
    (cim ? ` (${cim} com CIM)` : '') +
    (pre.length ? ` e ${s(pre.length, 'preventiva', 'preventivas')}` : '') +
    (lista ? ` — ${lista}` : '')
  )
}

/** Preenche "Ocorrências atendidas" se estiver vazia ou ainda for o texto automático. */
export function aplicarAutomatico(r: RascunhoPassagem, itens: ItemTurno[]): RascunhoPassagem {
  const txt = textoOcorrenciasAtendidas(itens)
  if (!txt) return r
  let mudou = false
  const condicoes = r.condicoes.map((c) => {
    if (c.i !== 'Ocorrências atendidas' || (c.c && !c.auto) || c.c === txt) return c
    mudou = true
    return { ...c, c: txt, auto: true }
  })
  return mudou ? { ...r, condicoes } : r
}

/** Confere cada preventiva programada com as preventivas enviadas no turno. */
export function conferirProgramadas(programadas: Programada[], itens: ItemTurno[]) {
  const usados = new Set<string>()
  return programadas.map((p) => {
    if (!p.nome.trim() || !p.tipo) return { p, ok: false, incompleta: true, item: null as ItemTurno | null }
    const item =
      itens.find(
        (x) =>
          !usados.has(x.id) &&
          x.categoria === 'Preventiva' &&
          x.tipoPrev === p.tipo &&
          norm([x.titulo, x.sistema, x.local].join(' ')).includes(norm(p.nome)) &&
          (!p.local.trim() || norm([x.titulo, x.local].join(' ')).includes(norm(p.local))),
      ) ?? null
    if (item) usados.add(item.id)
    return { p, ok: !!item, incompleta: false, item }
  })
}

/** Atividades do turno com pedido de reprogramação (só pedido explícito, como no app antigo). */
export const pedidosReprog = (itens: ItemTurno[]) => itens.filter((x) => x.reprogPedido)

export interface OpcoesTrazer {
  ocorrencias: boolean
  condicoes: boolean
  encerramento: boolean
  programadas: boolean
}

/** Traz do turno anterior o que a equipe escolher, sem duplicar o que já existe. */
export function trazerDoAnterior(atual: RascunhoPassagem, ant: Passagem, op: OpcoesTrazer) {
  const r = { ...atual }
  let n = 0
  if (op.ocorrencias) {
    for (const [k] of PRIORIDADES) {
      const lista = [...r[k]]
      for (const o of ant[k]) {
        if (!lista.some((x) => norm(x.l) === norm(o.l) && norm(x.d) === norm(o.d))) {
          lista.push({ l: o.l, d: o.d })
          n++
        }
      }
      r[k] = lista
    }
  }
  if (op.condicoes) {
    const cond = [...r.condicoes]
    for (const c of ant.condicoes) {
      if (c.auto) continue
      const idx = cond.findIndex((x) => x.i === c.i)
      if (idx < 0) cond.push({ i: c.i, c: c.c })
      else if (!cond[idx]!.c.trim()) cond[idx] = { i: c.i, c: c.c }
    }
    r.condicoes = cond
  }
  if (op.encerramento && ant.encerramento) r.encerramento = ant.encerramento
  if (op.programadas) {
    const prog = [...r.programadas]
    for (const p of ant.programadas) {
      if (!prog.some((q) => norm(q.nome) === norm(p.nome) && q.tipo === p.tipo && norm(q.local) === norm(p.local))) prog.push({ ...p })
    }
    r.programadas = prog
  }
  return { passagem: r, ocorrenciasTrazidas: n }
}

const dataBR = (iso: string) => iso.split('-').reverse().join('/')
const curto = (t: string | null | undefined) => String(t ?? '').replace(/\s+/g, ' ').trim()

/** Texto pronto para colar no e-mail, no formato do app antigo. */
export function textoEmail(r: RascunhoPassagem, itens: ItemTurno[]): string {
  const res = resumoTurno(itens)
  const cor = itens.filter((x) => x.categoria === 'Corretiva')
  const pre = itens.filter((x) => x.categoria === 'Preventiva')
  const cond = (nome: string) => r.condicoes.find((c) => norm(c.i).includes(norm(nome)))?.c ?? ''
  const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`
  const L: string[] = []
  L.push('Para: Liderança da Manutenção L17 · Supervisão')
  L.push(`Assunto: Passagem de turno | Manutenção L17 | ${r.turno} | ${dataBR(r.data)}`)
  L.push('Anexos: FO.MNT.S.0009 + relatórios FO.MNT.S.0012')
  L.push('')
  const st = [
    res.concluidas && plural(res.concluidas, 'concluída', 'concluídas'),
    res.andamento && `${res.andamento} em andamento`,
    res.naoRealizadas && plural(res.naoRealizadas, 'não realizada', 'não realizadas'),
  ].filter(Boolean)
  const partes = [
    curto(cond('operação assistida')).replace(/[.;]+$/, '') || (r.alta.length ? 'Ver ocorrências de alta prioridade' : 'Sem impacto relevante'),
    `${plural(res.total, 'atividade', 'atividades')} (${plural(res.corretivas, 'corretiva', 'corretivas')}, ${plural(res.preventivas, 'preventiva', 'preventivas')})`,
    ...(st.length ? [st.join(', ')] : []),
    ...(res.minutos ? [formatarMinutos(res.minutos)] : []),
  ]
  L.push('1. RESUMO')
  L.push(partes.join(' · '))
  L.push('2. CORRETIVAS')
  if (cor.length)
    cor.forEach((x) =>
      L.push('• ' + [x.local, curto(x.titulo), x.cim && x.cim.toUpperCase() !== 'N/A' ? `CIM ${x.cim}` : 'sem CIM', x.status.toLowerCase()].filter(Boolean).join(' · ')),
    )
  else L.push('Sem corretivas no turno')
  L.push('3. PREVENTIVAS')
  if (pre.length)
    pre.forEach((x) => {
      const extra =
        (x.status === 'Não realizada' && x.motivo ? ` (${curto(x.motivo)})` : '') +
        (x.reprogPedido ? ` · reprogramar${x.reprogData ? ` p/ ${dataBR(x.reprogData)}` : ''}` : '')
      L.push('• ' + [x.tipoPrev && !x.titulo.includes(x.tipoPrev) ? x.tipoPrev : null, curto(x.titulo), x.local].filter(Boolean).join(' ') + ` ${x.status.toLowerCase()}${extra}`)
    })
  else L.push('Sem preventivas no turno')
  L.push('4. OCORRÊNCIAS')
  let alguma = false
  for (const [k, nome] of PRIORIDADES) {
    const it = r[k].filter((o) => (o.l || o.d).trim())
    if (!it.length) continue
    alguma = true
    L.push(`${nome}:`)
    it.forEach((o) => L.push('• ' + [curto(o.l), curto(o.d)].filter(Boolean).join(' – ')))
  }
  if (!alguma) L.push('Sem ocorrências transferidas')
  if (curto(r.encerramento)) {
    L.push('5. ENCERRAMENTO')
    L.push(curto(r.encerramento))
  }
  return L.join('\n')
}

/** Turno em andamento: o Noturno começa às 18h e a passagem leva a data do início do turno. */
export function turnoAtual(agora: Date): { data: string; turno: Turno } {
  const h = agora.getHours()
  const d = new Date(agora)
  if (h < 6) d.setDate(d.getDate() - 1)
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { data: iso, turno: h >= 18 || h < 6 ? 'Noturno' : 'Diurno' }
}

/** A passagem já tem algo escrito pela equipe? */
export const temConteudo = (p: Pick<RascunhoPassagem, 'alta' | 'media' | 'baixa' | 'encerramento' | 'condicoes'>) =>
  p.alta.length + p.media.length + p.baixa.length > 0 || !!limpo(p.encerramento) || p.condicoes.some((c) => !c.auto && limpo(c.c))
