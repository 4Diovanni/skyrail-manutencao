import { useEffect, useMemo, useState } from 'react'
import { comprimirFoto } from '../../data/fotos'
import { localDb, type FotoLocal } from '../../data/local'
import { urlFoto } from '../../data/remoto'

function useUrl(f: FotoLocal): string | null {
  const local = useMemo(() => (f.blob ? URL.createObjectURL(f.blob) : null), [f.blob])
  const [remota, setRemota] = useState<string | null>(null)
  useEffect(() => () => {
    if (local) URL.revokeObjectURL(local)
  }, [local])
  useEffect(() => {
    if (!f.blob && f.storagePath) void urlFoto(f.storagePath).then(setRemota)
  }, [f.blob, f.storagePath])
  return local ?? remota
}

function Miniatura({ f, onLegenda, onMover, onRemover }: { f: FotoLocal; onLegenda: (v: string) => void; onMover: (d: -1 | 1) => void; onRemover: () => void }) {
  const url = useUrl(f)
  return (
    <div className="foto">
      <div className="im" style={url ? { backgroundImage: `url("${url}")` } : undefined} />
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

  async function adicionar(files: FileList | null) {
    if (!files?.length) return
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
        <input type="file" accept="image/*" multiple hidden onChange={(e) => { void adicionar(e.target.files); e.target.value = '' }} />
      </label>
    </div>
  )
}
