import { duracaoEtapa, formatarMinutos } from '../domain/tempos'
import { nomeDe, type DadosDocumento } from './dados'
import { A4, COR, novoDocumento, Pagina, Tabela } from './folha'
import { carregarAssinaturas } from './os'
import { dataBR } from './texto'

/** Registro de Manutenção da preventiva (FO.MNT.S.0008), mesma estrutura do app original. */
export async function gerarRM(d: DadosDocumento): Promise<Uint8Array> {
  const a = d.atividade
  const { doc, f } = await novoDocumento(`Registro de Manutenção - ${a.titulo}`)
  const p = new Pagina(doc.addPage([A4.w, A4.h]), f)
  const assin = await carregarAssinaturas(doc, d)
  const t = new Tabela([21.71, 18, 14, 13, 13, 13, 13, 17, 14, 13], A4.w - 60)
  const G = COR.cinzaForm

  const par = (v: string | null) => (v ?? '').split(/\n+/).map((x) => x.trim()).filter(Boolean)
  const linhas: { t: string; b?: boolean }[] = []
  if (a.titulo) linhas.push({ t: a.titulo, b: true })
  par(a.feito).forEach((x) => linhas.push({ t: x }))
  const nc = par(a.nao_conformidades)
  if (nc.length) {
    linhas.push({ t: 'Anomalias / pendências identificadas:', b: true })
    nc.forEach((x) => linhas.push({ t: `- ${x}` }))
  }
  const at = a.tempos.atu
  if (at?.i || at?.f) {
    const dur = duracaoEtapa(at)
    linhas.push({ t: `Tempo de atuação: ${at.i || '--:--'} às ${at.f || '--:--'}${dur != null ? ` (${formatarMinutos(dur)})` : ''}` })
  }
  while (linhas.length > 30) {
    const x = linhas.pop()!
    linhas[linhas.length - 1]!.t += ` ${x.t}`
  }
  const tecs = d.equipe.map((x) => x.nome || x.matricula || '')
  const ck = (k: string, txt: string) => `${a.tipo_prev === k ? '[X]' : '[ ]'} ${txt}`

  t.linha(53, [
    { span: 1, texto: 'Metrô L17 Ouro', negrito: true, alinhar: 'centro', tamanho: 7 },
    { span: 7, texto: 'REGISTRO DE MANUTENÇÃO', negrito: true, alinhar: 'centro', tamanho: 14 },
    { span: 2, texto: 'FO.MNT.S.0008\nRev.: 00\nData: 31/07/2026', alinhar: 'centro' },
  ])
  const lv = (l: string, v: string | null | undefined) =>
    t.linha(15, [{ span: 2, texto: l, fundo: G, negrito: true }, { span: 8, texto: v ?? '', negrito: true, alinhar: 'centro' }])
  lv('DATA', dataBR(a.data))
  lv('ESTAÇÃO / LOCAL:', a.local)
  lv('SISTEMA:', a.sistema)
  lv('EQUIPAMENTO:', a.equipamento)
  t.linha(10, [{ span: 10, semBorda: true }])
  t.linha(15.75, [{ span: 10, texto: 'NÍVEL DE MANUTENÇÃO', fundo: G, negrito: true, alinhar: 'centro' }])
  t.linha(40, [
    { span: 2, texto: ck('PQ', 'QUINZENAL (15D)') },
    { span: 2, texto: ck('P1', 'MENSAL (1M)') },
    { span: 2, texto: ck('P3', 'TRIMESTRAL (3M)') },
    { span: 2, texto: ck('P6', 'SEMESTRAL (6M)') },
    { span: 2, texto: ck('P12', 'ANUAL (1A)') },
  ])
  t.linha(10, [{ span: 10, semBorda: true }])
  t.linha(15.75, [{ span: 10, texto: 'REGISTRO DE ATIVIDADES REALIZADAS', fundo: G, negrito: true, alinhar: 'centro' }])
  t.linha(15.75, [
    { span: 8, texto: 'DESCRIÇÃO DA ATIVIDADE / ANOMALIA E AÇÃO TOMADA', fundo: G, negrito: true, alinhar: 'centro' },
    { span: 2, texto: 'TÉCNICOS', fundo: G, negrito: true, alinhar: 'centro' },
  ])
  for (let i = 0; i < 30; i++) {
    const l = linhas[i]
    t.linha(17, [{ span: 8, texto: l?.t ?? '', negrito: l?.b }, { span: 2, texto: tecs[i] ?? '', alinhar: 'centro' }])
  }
  t.linha(10, [{ span: 10, semBorda: true }])
  t.linha(15.75, [{ span: 10, texto: 'APROVAÇÕES', fundo: G, negrito: true, alinhar: 'centro' }])
  t.linha(15.75, [
    { span: 3, texto: 'TÉCNICO', fundo: G, negrito: true, alinhar: 'centro' },
    { span: 3, texto: 'Líder de Manutenção', fundo: G, negrito: true, alinhar: 'centro' },
    { span: 4, texto: 'GESTOR', fundo: G, negrito: true, alinhar: 'centro' },
  ])
  const tecId = a.resp_tecnico_id ?? d.equipe[0]?.id ?? null
  const tecPapel = a.resp_tecnico_id ? 'resp_tecnico' : 'equipe'
  t.linha(15.75, [
    { span: 3, texto: `Nome: ${nomeDe(d, tecId)}` },
    { span: 3, texto: `Nome: ${nomeDe(d, a.lider_id)}` },
    { span: 4, texto: `Nome: ${nomeDe(d, a.gestor_id)}` },
  ])
  t.linha(34, [
    { span: 3, imagem: assin(tecId, tecPapel), texto: 'Assinatura:', topo: true },
    { span: 3, imagem: assin(a.lider_id, 'lider'), texto: 'Assinatura:', topo: true },
    { span: 4, imagem: assin(a.gestor_id, 'gestor'), texto: 'Assinatura:', topo: true },
  ])
  t.linha(15.75, [{ span: 3, texto: `Data: ${dataBR(a.data)}` }, { span: 3, texto: 'Data:' }, { span: 4, texto: 'Data:' }])
  t.linha(10, [{ span: 10, semBorda: true }])
  t.linha(45, [{ span: 10, texto: `OBSERVAÇÕES: ${a.registro.obs ?? ''}`, topo: true }])
  t.desenhar(p, 30, 40, A4.h - 80, 7.5)
  return doc.save()
}
