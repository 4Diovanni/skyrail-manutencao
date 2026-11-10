import { useEffect, useRef, useState } from 'react'
import { comprimirFoto } from '../../data/fotos'
import { localDb, type FotoLocal } from '../../data/local'
import { urlFoto } from '../../data/remoto'

type EstadoImagem = 'carregando' | 'pronta' | 'erro'

/**
 * Mostra a foto local (blob ainda não enviado) ou a remota (URL assinada).
 * O object URL é criado e revogado no mesmo efeito, direto no <img>,
 * para não sobrar uma URL revogada em memória (o StrictMode monta duas vezes).
 */
function Imagem({ f }: { f: FotoLocal }) {
  const ref = useRef<HTMLImageElement>(null)
  const [estado, setEstado] = useState<EstadoImagem>('carregando')

  useEffect(() => {
    const img = ref.current
    if (!img) return
    let ativo = true
    let objeto: string | null = null
    if (f.blob) {
      objeto = URL.createObjectURL(f.blob)
      img.src = objeto
    } else if (f.storagePath) {
      void urlFoto(f.storagePath)
        .then((u) => {
          if (!ativo) return
          if (u) img.src = u
          else setEstado('erro')
        })
        .catch(() => {
          if (ativo) setEstado('erro')
        })
    }
    return () => {
      ativo = false
      img.removeAttribute('src')
      if (objeto) URL.revokeObjectURL(objeto)
    }
  }, [f.blob, f.storagePath])

  return (
    <div className={`im ${estado}`}>
      <img ref={ref} alt={f.legenda || 'Foto da atividade'} onLoad={() => setEstado('pronta')} onError={() => setEstado(ref.current?.getAttribute('src') ? 'erro' : 'carregando')} />
      {estado === 'carregando' && <span className="im-aviso">Carregando…</span>}
      {estado === 'erro' && <span className="im-aviso">Não foi possível abrir a foto</span>}
    </div>
  )
}

function Miniatura({ f, onLegenda, onMover, onRemover }: { f: FotoLocal; onLegenda: (v: string) => void; onMover: (d: -1 | 1) => void; onRemover: () => void }) {
  return (
    <div className="foto">
      <Imagem f={f} />
      <input type="text" placeholder="Legenda da foto" value={f.legenda} onChange={(e) => onLegenda(e.target.value)} />
      <div className="acoes">
        <button type="button" className="mini" onClick={() => onMover(-1)} aria-label="Mover para trás">←</button>
        <button type="button" className="mini" onClick={() => onMover(1)} aria-label="Mover para frente">→</button>
        <button type="button" className="mini perigo" onClick={onRemover} aria-label="Remover">✕</button>
      </div>
    </div>
  )
}

export function FotosCampo({ atividadeId, onMudou }: { atividadeId: string; onMudou: () => void }) {
  const [fotos, setFotos] = useState<FotoLocal[]>([])
  const [ocupado, setOcupado] = useState<string | null>(null)

  async function recarregar() {
    const l = await localDb.fotos.where('atividadeId').equals(atividadeId).toArray()
    setFotos(l.filter((f) => !f.removida).sort((a, b) => a.ordem - b.ordem))
  }
  useEffect(() => {
    void recarregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atividadeId])

  async function adicionar(files: File[]) {
    if (!files.length) return
    const base = fotos.length ? Math.max(...fotos.map((f) => f.ordem)) + 1 : 0
    for (let n = 0; n < files.length; n++) {
      setOcupado(`Ajustando foto ${n + 1} de ${files.length}…`)
      try {
        const blob = await comprimirFoto(files[n]!)
        await localDb.fotos.put({ id: crypto.randomUUID(), atividadeId, ordem: base + n, legenda: '', blob })
      } catch {
        alert('Não foi possível adicionar uma das fotos.')
      }
    }
    setOcupado(null)
    await recarregar()
    onMudou()
  }

  async function mover(i: number, d: -1 | 1) {
    const j = i + d
    const a = fotos[i]
    const b = fotos[j]
    if (!a || !b) return
    await localDb.fotos.bulkUpdate([
      { key: a.id, changes: { ordem: b.ordem } },
      { key: b.id, changes: { ordem: a.ordem } },
    ])
    await recarregar()
    onMudou()
  }

  async function remover(f: FotoLocal) {
    if (f.storagePath) await localDb.fotos.update(f.id, { removida: true })
    else await localDb.fotos.delete(f.id)
    await recarregar()
    onMudou()
  }

  return (
    <div className="fotos">
      {fotos.map((f, i) => (
        <Miniatura
          key={f.id}
          f={f}
          onLegenda={(v) => {
            setFotos((l) => l.map((x) => (x.id === f.id ? { ...x, legenda: v } : x)))
            void localDb.fotos.update(f.id, { legenda: v }).then(onMudou)
          }}
          onMover={(d) => void mover(i, d)}
          onRemover={() => void remover(f)}
        />
      ))}
      <label className="addfoto">
        <span aria-hidden>📷</span>
        {ocupado ?? 'Adicionar fotos'}
        <small>câmera ou galeria</small>
        <input type="file" accept="image/*" multiple hidden onChange={(e) => {
            // copia antes de limpar o campo: limpar esvazia a FileList original
            const lista = Array.from(e.target.files ?? [])
            e.target.value = ''
            void adicionar(lista)
          }} />
      </label>
    </div>
  )
}
