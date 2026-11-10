import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { useAuth } from '../../../auth/AuthContext'
import { enviarMinhaAssinatura, minhaAssinaturaUrl } from '../data/assinaturas'

const W = 600
const H = 220

/** Cada pessoa desenha ou envia a própria assinatura. Ela só entra num documento quando a pessoa toca em "Assinar". */
export function MinhaAssinaturaPage() {
  const { perfil } = useAuth()
  const canvas = useRef<HTMLCanvasElement>(null)
  const desenhando = useRef(false)
  const [vazio, setVazio] = useState(true)
  const [atual, setAtual] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    if (perfil) void minhaAssinaturaUrl(perfil.id).then(setAtual)
  }, [perfil])

  const ctx = () => {
    const c = canvas.current!.getContext('2d')!
    c.lineWidth = 3
    c.lineCap = 'round'
    c.lineJoin = 'round'
    c.strokeStyle = '#0b2a6b'
    return c
  }
  const ponto = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = canvas.current!.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }
  }
  function inicio(e: PointerEvent<HTMLCanvasElement>) {
    canvas.current!.setPointerCapture(e.pointerId)
    desenhando.current = true
    const { x, y } = ponto(e)
    const c = ctx()
    c.beginPath()
    c.moveTo(x, y)
  }
  function mover(e: PointerEvent<HTMLCanvasElement>) {
    if (!desenhando.current) return
    const { x, y } = ponto(e)
    const c = ctx()
    c.lineTo(x, y)
    c.stroke()
    setVazio(false)
  }
  function limpar() {
    ctx().clearRect(0, 0, W, H)
    setVazio(true)
  }

  async function carregarArquivo(file: File | undefined) {
    if (!file) return
    const bmp = await createImageBitmap(file)
    const c = ctx()
    c.clearRect(0, 0, W, H)
    const k = Math.min(W / bmp.width, H / bmp.height)
    c.drawImage(bmp, (W - bmp.width * k) / 2, (H - bmp.height * k) / 2, bmp.width * k, bmp.height * k)
    setVazio(false)
  }

  async function salvar() {
    if (!perfil || vazio) return
    const png = await new Promise<Blob | null>((ok) => canvas.current!.toBlob(ok, 'image/png'))
    if (!png) return
    try {
      await enviarMinhaAssinatura(perfil.id, png)
      setMsg('Assinatura salva. Ela só aparece num documento quando você tocar em “Assinar” na atividade.')
      setAtual(await minhaAssinaturaUrl(perfil.id))
      limpar()
    } catch {
      setMsg('Não foi possível salvar. Verifique a internet.')
    }
  }

  return (
    <section>
      <h2>Minha assinatura</h2>
      <p className="hint">Só você pode enviar ou trocar a sua assinatura. Ninguém consegue assinar por você.</p>
      {atual && (
        <div className="card">
          <b>Assinatura atual</b>
          <img src={atual} alt="Sua assinatura atual" className="assinatura-atual" />
        </div>
      )}
      <div className="card">
        <b>{atual ? 'Trocar assinatura' : 'Criar assinatura'}</b>
        <p className="hint">Assine com o dedo ou a caneta no quadro abaixo, ou envie uma foto da assinatura em fundo branco.</p>
        <canvas
          ref={canvas}
          width={W}
          height={H}
          className="quadro-assinatura"
          onPointerDown={inicio}
          onPointerMove={mover}
          onPointerUp={() => (desenhando.current = false)}
          onPointerCancel={() => (desenhando.current = false)}
        />
        <div className="row">
          <button type="button" className="sec" onClick={limpar}>Limpar</button>
          <label className="botao sec">
            Enviar foto
            <input type="file" accept="image/*" hidden onChange={(e) => void carregarArquivo(e.target.files?.[0])} />
          </label>
        </div>
        <button type="button" disabled={vazio} onClick={() => void salvar()} style={{ width: '100%', marginTop: 10 }}>
          Salvar assinatura
        </button>
        {msg && <p className="hint">{msg}</p>}
      </div>
    </section>
  )
}
