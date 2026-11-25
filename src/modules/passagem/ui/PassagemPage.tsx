import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Turno } from '../../../domain/turno'
import { formatarMinutos } from '../../relatorio/domain/tempos'
import { avisar } from '../../../lib/avisos'
import { enviarPassagem, versaoNoServidor } from '../data/envio'
import { useAuth } from '../../../auth/AuthContext'
import { chavePassagem, descartarLocal, minhaPassagem, salvarLocal } from '../data/local'
import { buscarPassagem, itensDoTurno, passagemAnterior } from '../data/remoto'
import {
  aplicarAutomatico,
  conferirProgramadas,
  novaPassagem,
  passagemParaRascunho,
  pedidosReprog,
  resumoTurno,
  temConteudo,
  textoEmail,
  turnoAtual,
} from '../domain/passagem'
import type { ItemTurno, Passagem, RascunhoPassagem } from '../domain/tipos'
import { CondicoesCampo, OcorrenciasCampo, ProgramadasCampo, TrazerAnterior } from './campos'
import { ItensTurno } from './ItensTurno'

const dataBR = (iso: string) => iso.split('-').reverse().join('/')

export function PassagemPage() {
  const [qs, setQs] = useSearchParams()
  const [padrao] = useState(() => turnoAtual(new Date()))
  const data = qs.get('data') || padrao.data
  const turno = (qs.get('turno') as Turno) || padrao.turno
  // A key zera todo o estado ao trocar de dia ou turno.
  return <PassagemTurno key={chavePassagem(data, turno)} data={data} turno={turno} escolher={(d, t) => setQs({ data: d, turno: t })} />
}

function PassagemTurno({ data, turno, escolher }: { data: string; turno: Turno; escolher: (data: string, turno: Turno) => void }) {
  const chave = chavePassagem(data, turno)
  // null = nada salvo no aparelho; undefined = ainda lendo.
  const uid = useAuth().session?.user.id
  const local = useLiveQuery(() => minhaPassagem(data, turno), [chave, uid])
  const [servidor, setServidor] = useState<Passagem | null | undefined>(undefined)
  const [anterior, setAnterior] = useState<Passagem | null>(null)
  const [itens, setItens] = useState<ItemTurno[] | null>(null)
  const [semRede, setSemRede] = useState(false)
  const [editado, setEditado] = useState<RascunhoPassagem | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [recarga, setRecarga] = useState(0)

  // Passagem do servidor, turno anterior e atividades do turno.
  useEffect(() => {
    let vivo = true
    Promise.all([buscarPassagem(data, turno), passagemAnterior(data, turno), itensDoTurno(data, turno)])
      .then(([p, a, i]) => {
        if (!vivo) return
        setServidor(p)
        setAnterior(a)
        setItens(i)
        setSemRede(false)
      })
      .catch(() => {
        if (!vivo) return
        setServidor(null)
        setItens([])
        setSemRede(true)
      })
    return () => {
      vivo = false
    }
  }, [data, turno, recarga])

  // Rascunho: o que foi editado agora; senão o do aparelho; senão o do servidor; senão um novo.
  const base =
    editado ??
    (local === undefined || servidor === undefined ? null : (local?.dados ?? (servidor ? passagemParaRascunho(servidor) : novaPassagem(data, turno))))
  const r = base && itens ? aplicarAutomatico(base, itens) : base

  function mudar(f: (x: RascunhoPassagem) => RascunhoPassagem) {
    if (!r) return
    const novo = f(r)
    setEditado(novo)
    void salvarLocal(novo)
  }

  async function enviar() {
    if (!r) return
    setEnviando(true)
    setMsg(null)
    try {
      const v = await versaoNoServidor(r).catch(() => null)
      if (v != null && v !== r.versaoBase && !confirm(`Outra pessoa enviou esta passagem (versão ${v}) depois que você abriu. Enviar agora substitui a versão dela, que fica no histórico. Continuar?`)) return
      const res = await enviarPassagem(r)
      if (res.ok) {
        await descartarLocal(r.data, r.turno)
        setEditado(null)
        avisar('ok', `Passagem enviada (versão ${res.versao}).`)
        setRecarga((n) => n + 1)
      } else if (res.offline) {
        await salvarLocal(r, 'fila')
        avisar('fila', 'Sem internet: a passagem ficou na fila e será enviada quando a conexão voltar.')
      } else {
        await salvarLocal(r, 'erro', res.mensagem)
        avisar('erro', `O servidor recusou o envio: ${res.mensagem}. A passagem ficou salva no aparelho.`)
      }
    } finally {
      setEnviando(false)
    }
  }

  async function pdf() {
    if (!servidor) {
      avisar('erro', 'Envie a passagem antes de gerar o PDF.')
      return
    }
    if (local) {
      avisar('erro', 'Há alterações neste aparelho que ainda não foram enviadas. Envie a passagem para o PDF sair com elas.')
      return
    }
    setMsg('Gerando PDF…')
    try {
      const { gerarEGuardarPassagem } = await import('../pdf/servico')
      const { entregarPdf } = await import('../../relatorio/pdf/servico')
      const res = await gerarEGuardarPassagem(data, turno)
      setMsg(res.guardado ? 'PDF gerado e guardado em Documentos.' : 'PDF gerado, mas não foi possível guardar no servidor. Ele fica só neste aparelho.')
      await entregarPdf(res.blob, res.nome)
    } catch (e) {
      setMsg(`Erro ao gerar o PDF: ${(e as Error).message}`)
    }
  }

  async function copiarEmail() {
    if (!r || !itens) return
    const t = textoEmail(r, itens)
    try {
      await navigator.clipboard.writeText(t)
      setMsg('Texto do e-mail copiado. Cole no e-mail da passagem.')
    } catch {
      prompt('Copie o texto do e-mail:', t)
    }
  }

  const res = itens ? resumoTurno(itens) : null
  const reprog = itens ? pedidosReprog(itens) : []
  const conf = r && itens ? conferirProgramadas(r.programadas, itens) : []

  return (
    <div className="pagina-pass">
      <h2 className="pass-titulo">Passagem de turno</h2>
      <div className="row topo-dia">
        <label className="campo">
          <span>Data</span>
          <input type="date" value={data} onChange={(e) => e.target.value && escolher(e.target.value, turno)} />
        </label>
        <div className="campo">
          <span>Turno</span>
          <div className="chips">
            {(['Diurno', 'Noturno'] as Turno[]).map((t) => (
              <button type="button" key={t} className={`chip ${turno === t ? 'on' : ''}`} onClick={() => escolher(data, t)}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {semRede && <p className="aviso">Sem conexão com o servidor. As atividades do turno não puderam ser carregadas.</p>}
      {local && local.estado !== 'rascunho' && (
        <p className={`aviso ${local.estado === 'erro' ? 'erro' : ''}`}>
          {local.estado === 'fila' ? 'Esta passagem está na fila de envio.' : `Erro no último envio: ${local.erro ?? ''}`}
        </p>
      )}
      <p className="hint pass-status">
        {servidor ? `Enviada: versão ${servidor.versao}, ${new Date(servidor.enviado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.` : 'Ainda não enviada.'}
        {local?.estado === 'rascunho' ? ' Alterações salvas neste aparelho.' : ''}
      </p>

      {r && anterior && !temConteudo(r) && <TrazerAnterior anterior={anterior} onTrazer={(f) => mudar(f)} />}

      <section className="card">
        <h3>Atividades do turno</h3>
        {!itens && <p className="hint">Carregando atividades do turno…</p>}
        {res && (
          <div className="pass-kpis">
            <div><b>{res.total}</b><span>atividades</span></div>
            <div><b>{res.corretivas}</b><span>corretivas</span></div>
            <div><b>{res.preventivas}</b><span>preventivas</span></div>
            <div><b>{res.minutos ? formatarMinutos(res.minutos) : '—'}</b><span>atuação</span></div>
          </div>
        )}
        {itens && <ItensTurno itens={itens} />}
        <p className="hint">Vem do Relatório e das Preventivas enviados neste turno. Para corrigir, edite a atividade no módulo dela.</p>
      </section>

      {reprog.length > 0 && (
        <section className="card pass-reprog">
          <h3>Pedidos de reprogramação</h3>
          {reprog.map((x) => (
            <div key={x.id} className="pass-reprog-item">
              <b>{x.titulo}</b>
              <small>{[x.local, x.motivo].filter(Boolean).join(' · ')}</small>
              <span className={`tag rp-${x.reprogStatus ?? 'pendente'}`}>
                {x.reprogData ? `Para ${dataBR(x.reprogData)}` : 'Data a definir'} · {x.reprogStatus === 'aprovado' ? 'aprovado' : x.reprogStatus === 'recusado' ? 'recusado' : 'aguardando o admin'}
              </span>
            </div>
          ))}
        </section>
      )}

      {r && (
        <>
          <ProgramadasCampo valor={r.programadas} conferencia={conf} onChange={(programadas) => mudar((x) => ({ ...x, programadas }))} />
          <CondicoesCampo valor={r.condicoes} onChange={(condicoes) => mudar((x) => ({ ...x, condicoes }))} />
          <OcorrenciasCampo r={r} onChange={(k, lista) => mudar((x) => ({ ...x, [k]: lista }))} />
          <section className="card">
            <h3>Encerramento e transferência</h3>
            <textarea
              rows={3}
              value={r.encerramento ?? ''}
              placeholder="Ex.: Turno entregue ao noturno com as ocorrências acima. Sem pendências críticas."
              onChange={(e) => mudar((x) => ({ ...x, encerramento: e.target.value }))}
            />
          </section>
          {msg && <p className="aviso" role="status">{msg}</p>}
          <div className="barra pass-barra">
            <button type="button" className="secundario" onClick={() => void copiarEmail()} disabled={!itens} aria-label="Copiar texto do e-mail">
              E-mail
            </button>
            <button type="button" className="secundario" onClick={() => void pdf()} aria-label="Gerar PDF da passagem">
              PDF
            </button>
            <button type="button" onClick={() => void enviar()} disabled={enviando}>
              {enviando ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
        </>
      )}
      {!r && <p className="hint">Carregando a passagem…</p>}
    </div>
  )
}
