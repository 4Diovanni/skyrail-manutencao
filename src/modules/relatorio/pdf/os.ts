import type { PDFDocument, PDFImage } from 'pdf-lib'
import { nomeDe, type DadosDocumento } from './dados'
import { A4, COR, novoDocumento, Pagina, Tabela } from './folha'
import { dataBR } from './texto'

export async function carregarAssinaturas(doc: PDFDocument, d: DadosDocumento) {
  const imgs: Record<string, PDFImage> = {}
  for (const [k, bytes] of Object.entries(d.assinaturas)) {
    try {
      imgs[k] = await doc.embedPng(bytes)
    } catch {
      // assinatura inválida: fica em branco
    }
  }
  return (id: string | null | undefined, papel: string) => (id ? (imgs[`${id}:${papel}`] ?? null) : null)
}

const marca = (txt: string, on: boolean) => `${txt} (${on ? ' X ' : '    '})`

/** Ordem de Serviço – Registro de Manutenção Corretiva (FO.MNT.S.0003), mesma estrutura do app original. */
export async function gerarOS(d: DadosDocumento): Promise<Uint8Array> {
  const a = d.atividade
  const os = a.os
  const { doc, f } = await novoDocumento(`OS - ${a.titulo}`)
  const p = new Pagina(doc.addPage([A4.w, A4.h]), f)
  const assin = await carregarAssinaturas(doc, d)
  const t = new Tabela([97.75, 62, 77.7, 118, 33.9, 171, 33.9, 214], A4.w - 80)
  const G = COR.cinzaForm
  const L = COR.cinzaForm2
  const tempo = (k: keyof typeof a.tempos) => a.tempos[k] ?? { i: '', f: '' }
  const [y, m, dd] = a.data.split('-')
  const fimAtu = tempo('atu').f
  const dh0 = (os.data_hora_final ?? '').trim()
  const dataHoraFinal = dh0 ? (dh0.length === 10 && fimAtu ? `${dh0} ${fimAtu}` : dh0) : fimAtu ? `${dataBR(a.data)} ${fimAtu}` : ''

  t.linha(47, [
    { span: 2, texto: 'Metrô L17 Ouro', negrito: true, alinhar: 'centro' },
    { span: 4, texto: 'REGISTRO DE MANUTENÇÃO CORRETIVA', negrito: true, alinhar: 'centro', tamanho: 11 },
    { span: 2, texto: 'Código Doc: FO.MNT.S.0003\nRevisão: 00\nEmissão: 31/07/2026', alinhar: 'centro' },
  ])
  t.linha(4, [{ span: 8, semBorda: true }])
  const cab = (txt: string) => t.linha(13.5, [{ span: 8, texto: txt, fundo: G, negrito: true, alinhar: 'centro' }])
  const lv = (l1: string, v1: string | null | undefined, l2: string, v2: string | null | undefined) =>
    t.linha(18, [
      { span: 2, texto: l1, fundo: L, negrito: true },
      { span: 2, texto: v1 ?? '' },
      { span: 2, texto: l2, fundo: L, negrito: true },
      { span: 2, texto: v2 ?? '' },
    ])
  cab('IDENTIFICAÇÃO DA OCORRÊNCIA')
  lv('Nº DA OS:', os.numero, 'Nº DO CHAMADO METRÔ:', os.chamado ?? a.cim)
  lv('DATA:', dataBR(a.data), 'ESTAÇÃO / LOCAL:', a.local)
  lv('EQUIPAMENTO/TREM:', a.equipamento, 'CÓDIGO / ALARME:', os.codigo)
  t.linha(18, [
    { span: 2, texto: 'SISTEMA:', fundo: L, negrito: true },
    { span: 2, texto: a.sistema ?? '' },
    { span: 1, texto: os.impacto === 'Com impacto' ? 'X' : '', negrito: true, alinhar: 'centro' },
    { span: 1, texto: 'IMPACTO OPERACIONAL', fundo: L, negrito: true },
    { span: 1, texto: os.impacto === 'Sem impacto' ? 'X' : '', negrito: true, alinhar: 'centro' },
    { span: 1, texto: 'SEM IMPACTO OPERACIONAL', fundo: L, negrito: true },
  ])
  cab('REGISTRO DA FALHA')
  t.linha(39, [
    { span: 2, texto: 'FALHA / SINTOMA:', fundo: L, negrito: true },
    { span: 6, texto: a.sintoma ?? '', topo: true },
  ])
  cab('APONTAMENTO DE TEMPOS')
  t.linha(16.5, [
    { span: 1, texto: 'DATA:', fundo: L, negrito: true },
    { span: 3, texto: `${dd}  /  ${m}  /  ${y}`, negrito: true },
    { span: 2, texto: 'HORA INÍCIO:', fundo: L, negrito: true, alinhar: 'centro' },
    { span: 2, texto: 'HORA FIM:', fundo: L, negrito: true, alinhar: 'centro' },
  ])
  for (const [rot, k] of [['PREPARAÇÃO', 'prep'], ['DESLOCAMENTO', 'desl'], ['ATUAÇÃO', 'atu'], ['RETORNO', 'ret']] as const) {
    const tt = tempo(k)
    t.linha(15, [
      { span: 4, texto: rot, negrito: true, alinhar: 'centro' },
      { span: 2, texto: tt.i || (tt.na ? 'N/A' : ''), alinhar: 'centro' },
      { span: 2, texto: tt.f || (tt.na ? 'N/A' : ''), alinhar: 'centro' },
    ])
  }
  cab('DIAGNÓSTICO E EXECUÇÃO')
  t.linha(13.5, [{ span: 8, texto: 'Descrição da Ocorrência/ Atividade', fundo: L, negrito: true, alinhar: 'centro' }])
  t.linha(52, [{ span: 8, texto: a.diagnostico ?? '', topo: true }])
  t.linha(13.5, [{ span: 8, texto: 'Descrição da Atuação', fundo: L, negrito: true, alinhar: 'centro' }])
  const atuacao = [a.intervencao, a.resultado ? `Resultado: ${a.resultado}` : ''].filter(Boolean).join('\n') || (a.feito ?? '')
  t.linha(142.5, [{ span: 8, texto: atuacao, topo: true }])
  t.linha(32, [
    { span: 1, texto: 'CAUSA DA OCORRÊNCIA:', fundo: L, negrito: true },
    { span: 7, texto: os.causa ?? '' },
  ])
  cab('MATERIAIS / COMPONENTES')
  t.linha(23, [
    { span: 4, texto: 'HOUVE SUBSTITUIÇÃO DE COMPONENTE?', negrito: true, alinhar: 'centro' },
    { span: 1, texto: os.substituicao === 'Sim' ? 'X' : '', negrito: true, alinhar: 'centro' },
    { span: 1, texto: 'SIM', negrito: true },
    { span: 1, texto: os.substituicao === 'Não' ? 'X' : '', negrito: true, alinhar: 'centro' },
    { span: 1, texto: 'NÃO', negrito: true },
  ])
  t.linha(18, [
    { span: 7, texto: 'MATERIAIS E PEÇAS:', fundo: L, negrito: true, alinhar: 'centro' },
    { span: 1, texto: 'QUANTIDADE:', fundo: L, negrito: true },
  ])
  const mats = (os.materiais ?? []).filter((x) => x.d || x.q).slice(0, 7)
  for (let i = 0; i < 7; i++) t.linha(18, [{ span: 7, texto: mats[i]?.d ?? '' }, { span: 1, texto: mats[i]?.q ?? '', alinhar: 'centro' }])
  cab('ENCERRAMENTO')
  const st = os.status_reparo
  const lb = os.liberacao
  const linhasEnc: [string, string][] = [
    [marca('Definitivo', st === 'Definitivo'), marca('Liberado sem restrição', lb === 'Liberado sem restrição')],
    [marca('Provisório', st === 'Provisório'), marca('Liberado com restrição', lb === 'Liberado com restrição')],
    [marca('Não reparado', st === 'Não reparado'), marca('Não liberado', lb === 'Não liberado')],
  ]
  linhasEnc.forEach(([s1, s2], i) =>
    t.linha(19.5, [
      i === 0 ? { span: 2, texto: 'STATUS DO REPARO:', fundo: L, negrito: true, alinhar: 'centro', altura: 58.5 } : { span: 2, semBorda: true },
      { span: 2, texto: s1 },
      i === 0 ? { span: 2, texto: 'LIBERAÇÃO:', fundo: L, negrito: true, alinhar: 'centro', altura: 58.5 } : { span: 2, semBorda: true },
      { span: 2, texto: s2 },
    ]),
  )
  cab('EQUIPE E RESPONSÁVEIS')
  t.linha(13.5, [
    { span: 4, texto: 'NOME', fundo: G, negrito: true, alinhar: 'centro' },
    { span: 2, texto: 'MATRÍCULA', fundo: G, negrito: true, alinhar: 'centro' },
    { span: 2, texto: 'ASSINATURA', fundo: G, negrito: true, alinhar: 'centro' },
  ])
  for (let i = 0; i < 7; i++) {
    const pessoa = d.equipe[i]
    t.linha(17, [
      { span: 4, texto: pessoa ? (pessoa.nome ?? '') : '' },
      { span: 2, texto: pessoa?.matricula ?? '', alinhar: 'centro' },
      { span: 2, imagem: assin(pessoa?.id, 'equipe') },
    ])
  }
  t.linha(30, [
    { span: 2, texto: 'RESP. TÉCNICO:', fundo: L, negrito: true },
    { span: 2, texto: nomeDe(d, a.resp_tecnico_id) },
    { span: 2, texto: 'ASSINATURA:', fundo: L, negrito: true },
    { span: 2, imagem: assin(a.resp_tecnico_id, 'resp_tecnico') },
  ])
  t.linha(28.5, [
    { span: 2, texto: 'DATA/HORA FINAL:', fundo: L, negrito: true },
    { span: 2, texto: dataHoraFinal },
    { span: 2, texto: 'RESP. LIBERAÇÃO:', fundo: L, negrito: true },
    { span: 2, texto: os.resp_liberacao ?? '' },
  ])
  t.desenhar(p, 40, 40, A4.h - 80, 8)
  return doc.save()
}
