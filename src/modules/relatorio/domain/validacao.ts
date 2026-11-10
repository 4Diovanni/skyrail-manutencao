import { ETAPAS, type RascunhoAtividade } from './tipos'

const preenchido = (v: string | null | undefined) => !!(v ?? '').trim()

/**
 * Campos que faltam para gerar o PDF (regra do app original, função faltando()).
 * Lista vazia = pode gerar.
 */
export function camposFaltando(a: RascunhoAtividade): string[] {
  const f: string[] = []
  if (!preenchido(a.titulo)) f.push('Título da atividade')
  if (!a.status) f.push('Status (Concluída, Em andamento ou Não realizada)')
  if (!a.equipe.length) f.push('Equipe da atividade')
  if (!preenchido(a.local)) f.push('Local')
  if (!preenchido(a.sistema)) f.push('Sistema')
  if (a.categoria === 'Preventiva' && !a.tipo_prev) f.push('Tipo de preventiva')
  if (a.status === 'Não realizada') {
    if (!preenchido(a.motivo)) f.push('Motivo da não realização')
    return f
  }
  if (!preenchido(a.equipamento)) f.push('Equipamento')
  if (a.categoria === 'Corretiva') {
    if (!preenchido(a.sintoma)) f.push('Sintoma')
    if (!preenchido(a.diagnostico)) f.push('Diagnóstico')
    if (!preenchido(a.intervencao)) f.push('Intervenção')
  } else if (!preenchido(a.feito)) {
    f.push('O que foi feito')
  }
  for (const [k, rotulo] of ETAPAS) {
    const p = a.tempos[k]
    if (k === 'atu') {
      if (!p?.i) f.push(`Horário de início – ${rotulo}`)
      if (!p?.f && a.status !== 'Em andamento') f.push(`Horário de fim – ${rotulo}`)
      continue
    }
    if (p?.na) continue
    if (!p?.i || !p?.f) f.push(`${rotulo} – preencha início e fim ou marque N/A`)
  }
  return f
}

/** Erros que impedem o envio ao servidor (espelham as regras do banco). */
export function errosEnvio(a: RascunhoAtividade): string[] {
  const e: string[] = []
  if (!preenchido(a.titulo)) e.push('Preencha o título da atividade.')
  if (a.categoria === 'Preventiva' && !a.tipo_prev) e.push('Escolha o tipo de preventiva.')
  if (a.status === 'Não realizada' && !preenchido(a.motivo)) e.push('Informe o motivo da não realização.')
  if (a.reprog_pedido && !preenchido(a.motivo)) e.push('Informe o motivo do pedido de reprogramação.')
  return e
}
