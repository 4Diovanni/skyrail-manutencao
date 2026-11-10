import { A4, COR, linhaTabela, novoDocumento, Pagina, TabelaPaginada, type Celula } from '../../relatorio/pdf/folha'
import { dataBR, diaDaSemana, quebrarLinhas } from '../../relatorio/pdf/texto'
import { formatarMinutos } from '../../relatorio/domain/tempos'
import { conferirProgramadas, pedidosReprog, resumoTurno } from '../domain/passagem'
import { PRIORIDADES, type ItemTurno, type Passagem } from '../domain/tipos'
import type { PDFFont } from 'pdf-lib'

export interface DocumentoTurno {
  nome: string
  tipo: string
}

export interface DadosPassagemPdf {
  passagem: Pick<Passagem, 'data' | 'turno' | 'intro' | 'condicoes' | 'alta' | 'media' | 'baixa' | 'programadas' | 'encerramento'> & { versao?: number }
  itens: ItemTurno[]
  documentos: DocumentoTurno[]
}

const MARGEM = 28
const LARG = A4.w - 2 * MARGEM
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const ROTULO_DOC: Record<string, string> = { relatorio: 'Relatório', os: 'OS', rm: 'Registro de manutenção', roteiro: 'Roteiro', passagem: 'Passagem' }

function dataLonga(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return `${String(d).padStart(2, '0')} de ${MESES[(m ?? 1) - 1]} de ${y} · ${diaDaSemana(iso)}`
}

/** Cabeçalho do FO.MNT.S.0009 em toda página. Devolve o y onde o conteúdo começa. */
function cabecalho(p: Pagina, d: DadosPassagemPdf): number {
  const turnoCor = d.passagem.turno === 'Noturno' ? COR.noturno : COR.diurno
  linhaTabela(p, MARGEM, 20, 38, [
    { w: LARG * 0.18, texto: 'Metrô L17 Ouro', negrito: true, alinhar: 'centro', tamanho: 8 },
    { w: LARG * 0.6, texto: 'RELATÓRIO OPERACIONAL\nPASSAGEM DE TURNO', negrito: true, alinhar: 'centro', tamanho: 11 },
    { w: LARG * 0.22, texto: 'FO.MNT.S.0009\nRev.: 00', alinhar: 'centro', tamanho: 7.5 },
  ])
  linhaTabela(p, MARGEM, 58, 14, [
    { w: LARG * 0.78, fundo: COR.ardosia },
    { w: LARG * 0.22, fundo: turnoCor },
  ])
  p.texto('Manutenção de Sistemas BYD - Linha 17 Ouro', MARGEM, 61.5, { tamanho: 7.5, cor: COR.branco, alinhar: 'centro', largura: LARG * 0.78 })
  p.texto(d.passagem.turno, MARGEM + LARG * 0.78, 61.5, { tamanho: 8, cor: COR.branco, fonte: p.f.negrito, alinhar: 'centro', largura: LARG * 0.22 })
  return 84
}

/** Altura de uma linha para o texto mais longo caber sem encolher. */
function altura(cels: { texto?: string; negrito?: boolean; tamanho?: number }[], larguras: number[], f: { normal: PDFFont; negrito: PDFFont }, base: number, min = 15) {
  let h = min
  cels.forEach((c, i) => {
    if (!c.texto) return
    const t = c.tamanho ?? base
    const n = quebrarLinhas(c.texto, c.negrito ? f.negrito : f.normal, t, (larguras[i] ?? 50) - 5).length
    h = Math.max(h, n * t * 1.2 + 5)
  })
  return h
}

export async function gerarPassagem(d: DadosPassagemPdf): Promise<Uint8Array> {
  const { passagem: r, itens } = d
  const { doc, f } = await novoDocumento(`Passagem de turno ${dataBR(r.data)} ${r.turno}`)
  // 20 colunas de grade; cada bloco usa spans.
  const t = new TabelaPaginada(Array(20).fill(1), LARG)
  const W = (de: number, n: number) => t.w(de, n)
  const B = 8
  const G = COR.cinzaForm
  const G2 = COR.cinzaForm2

  type C = Omit<Celula, 'w'> & { span: number }
  const linha = (cels: C[], op: { repetir?: boolean; juntoCom?: number; min?: number } = {}) => {
    let col = 0
    const larguras = cels.map((c) => {
      const w = W(col, c.span)
      col += c.span
      return w
    })
    t.linhaP(altura(cels, larguras, f, B, op.min), cels, op)
  }
  const espaco = (h = 8) => t.linhaP(h, [{ span: 20, semBorda: true }])
  const titulo = (s: string) => {
    espaco(6)
    t.linhaP(18, [{ span: 20, semBorda: true, texto: s, negrito: true, tamanho: 11 }], { juntoCom: 2 })
  }

  t.linhaP(18, [{ span: 20, semBorda: true, texto: 'Relatório de passagem de turno', negrito: true, tamanho: 13 }])
  t.linhaP(14, [{ span: 20, semBorda: true, texto: dataLonga(r.data), tamanho: 9 }])
  if (r.intro?.trim()) linha([{ span: 20, semBorda: true, texto: r.intro.trim(), tamanho: 9 }])

  // 1 Condição operacional
  titulo('1 Condição operacional e entrega')
  linha([{ span: 6, texto: 'Indicador', negrito: true, fundo: G }, { span: 14, texto: 'Condição registrada', negrito: true, fundo: G }], { repetir: true })
  const cond = r.condicoes.filter((c) => c.i || c.c)
  for (const c of cond.length ? cond : [{ i: '—', c: '—' }]) linha([{ span: 6, texto: c.i, negrito: true, fundo: G2 }, { span: 14, texto: c.c || '—' }])

  // 2 Resumo das atividades
  titulo('2 Resumo das atividades do turno')
  if (itens.length) {
    const res = resumoTurno(itens)
    linha(
      [
        { span: 5, texto: `${res.total}\natividades`, negrito: true, alinhar: 'centro', tamanho: 10 },
        { span: 5, texto: `${res.corretivas}\ncorretivas`, negrito: true, alinhar: 'centro', tamanho: 10 },
        { span: 5, texto: `${res.preventivas}\npreventivas`, negrito: true, alinhar: 'centro', tamanho: 10 },
        { span: 5, texto: `${res.minutos ? formatarMinutos(res.minutos) : '—'}\natuação`, negrito: true, alinhar: 'centro', tamanho: 10 },
      ],
      { min: 30 },
    )
    linha([{ span: 20, semBorda: true, texto: `${res.concluidas} concluída(s) · ${res.andamento} em andamento · ${res.naoRealizadas} não realizada(s)`, tamanho: 8.5 }])
    if (r.programadas.length) {
      const cf = conferirProgramadas(r.programadas, itens)
      linha([
        {
          span: 20,
          semBorda: true,
          tamanho: 8.5,
          texto: `Preventivas programadas: ${cf.map((c) => `${c.p.nome} ${c.p.tipo}${c.p.local ? ` – ${c.p.local}` : ''} (${c.item ? c.item.status.toLowerCase() : 'não recebida'})`).join(' · ')}`,
        },
      ])
    }
    const S = 7.5
    linha(
      [
        { span: 1, texto: 'Nº', negrito: true, fundo: G, tamanho: S },
        { span: 3, texto: 'Tipo', negrito: true, fundo: G, tamanho: S },
        { span: 6, texto: 'Atividade', negrito: true, fundo: G, tamanho: S },
        { span: 3, texto: 'Local · Sistema', negrito: true, fundo: G, tamanho: S },
        { span: 3, texto: 'Equipe', negrito: true, fundo: G, tamanho: S },
        { span: 2, texto: 'Status', negrito: true, fundo: G, tamanho: S },
        { span: 2, texto: 'Atuação', negrito: true, fundo: G, tamanho: S },
      ],
      { repetir: true },
    )
    itens.forEach((x, i) => {
      const atividade = x.titulo + (x.status === 'Não realizada' && x.motivo ? `\nMotivo: ${x.motivo}` : '')
      const tipo = `${x.categoria}${x.tipoPrev ? ` ${x.tipoPrev}` : ''}${x.cim && x.cim.toUpperCase() !== 'N/A' ? `\nCIM ${x.cim}` : ''}`
      const atu = x.atuacao ? `${x.minutos != null ? formatarMinutos(x.minutos) : ''}\n${x.atuacao.i}–${x.atuacao.f}` : '—'
      linha([
        { span: 1, texto: String(i + 1).padStart(2, '0'), tamanho: S, alinhar: 'centro' },
        { span: 3, texto: tipo, tamanho: S },
        { span: 6, texto: atividade, tamanho: S },
        { span: 3, texto: [x.local, x.sistema].filter(Boolean).join(' · ') || '—', tamanho: S },
        { span: 3, texto: x.equipe.join(', ') || '—', tamanho: S },
        { span: 2, texto: x.status, tamanho: S, negrito: true },
        { span: 2, texto: atu, tamanho: S, alinhar: 'centro' },
      ])
    })
    const rp = pedidosReprog(itens)
    if (rp.length) {
      espaco(6)
      t.linhaP(16, [{ span: 20, semBorda: true, texto: 'Pedidos de reprogramação', negrito: true, tamanho: 10 }], { juntoCom: 2 })
      linha(
        [
          { span: 7, texto: 'Atividade', negrito: true, fundo: G, tamanho: S },
          { span: 8, texto: 'Motivo', negrito: true, fundo: G, tamanho: S },
          { span: 5, texto: 'Reprogramada para', negrito: true, fundo: G, tamanho: S },
        ],
        { repetir: true },
      )
      for (const x of rp) {
        const sit = x.reprogStatus === 'aprovado' ? 'aprovado' : x.reprogStatus === 'recusado' ? 'recusado' : 'aguardando aprovação'
        linha([
          { span: 7, texto: `${x.titulo}${x.local ? ` · ${x.local}` : ''}`, tamanho: S, negrito: true },
          { span: 8, texto: x.motivo || '—', tamanho: S },
          { span: 5, texto: `${x.reprogData ? dataBR(x.reprogData) : 'A definir'}\n${sit}`, tamanho: S },
        ])
      }
    }
  } else {
    linha([{ span: 20, semBorda: true, texto: 'Nenhuma atividade enviada neste turno.', tamanho: 9 }])
  }

  // 3 a 5 Ocorrências
  PRIORIDADES.forEach(([k, nome, rotulo], i) => {
    titulo(`${i + 3} ${nome}`)
    linha([{ span: 6, texto: 'Local e equipamento', negrito: true, fundo: G }, { span: 14, texto: rotulo, negrito: true, fundo: G }], { repetir: true })
    const lista = r[k].filter((o) => o.l || o.d)
    for (const o of lista.length ? lista : [{ l: '—', d: 'Sem ocorrências registradas.' }]) linha([{ span: 6, texto: o.l || '—', negrito: true }, { span: 14, texto: o.d || '—' }])
  })

  // 6 Encerramento
  titulo('6 Encerramento e transferência')
  linha([{ span: 20, texto: r.encerramento?.trim() || '—' }], { min: 24 })

  // 7 Documentos do turno
  if (d.documentos.length) {
    titulo('7 Relatórios do turno (enviados em PDF separado)')
    linha(
      [
        { span: 1, texto: 'Nº', negrito: true, fundo: G, tamanho: 7.5 },
        { span: 15, texto: 'Documento', negrito: true, fundo: G, tamanho: 7.5 },
        { span: 4, texto: 'Tipo', negrito: true, fundo: G, tamanho: 7.5 },
      ],
      { repetir: true },
    )
    d.documentos.forEach((x, i) =>
      linha([
        { span: 1, texto: String(i + 1).padStart(2, '0'), tamanho: 7.5, alinhar: 'centro' },
        { span: 15, texto: x.nome, tamanho: 7.5 },
        { span: 4, texto: ROTULO_DOC[x.tipo] ?? x.tipo, tamanho: 7.5 },
      ]),
    )
  }

  const nova = () => {
    const p = new Pagina(doc.addPage([A4.w, A4.h]), f)
    return { p, y: cabecalho(p, d) }
  }
  const primeira = nova()
  t.desenharPaginado(primeira.p, MARGEM, primeira.y, A4.h - 40, B, nova)

  const total = doc.getPageCount()
  doc.getPages().forEach((pg, i) => {
    const p = new Pagina(pg, f)
    p.texto(`Passagem de turno · ${dataBR(r.data)} · ${r.turno}${d.passagem.versao ? ` · versão ${d.passagem.versao}` : ''}`, MARGEM, A4.h - 22, { tamanho: 7, cor: COR.cinza })
    p.texto(`Operação e Manutenção da Linha 17 Ouro · página ${i + 1} de ${total}`, MARGEM, A4.h - 22, { tamanho: 7, cor: COR.cinza, alinhar: 'dir', largura: LARG })
  })
  return doc.save()
}
