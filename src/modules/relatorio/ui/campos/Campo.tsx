import type { ReactNode } from 'react'

export function Campo({ rotulo, obrigatorio, children }: { rotulo: string; obrigatorio?: boolean; children: ReactNode }) {
  return (
    <label className="campo">
      <span>
        {rotulo}
        {obrigatorio && <b className="req"> *</b>}
      </span>
      {children}
    </label>
  )
}

export function Texto(props: { valor: string | null | undefined; onChange: (v: string) => void; placeholder?: string; linhas?: number }) {
  const { valor, onChange, placeholder, linhas } = props
  return linhas ? (
    <textarea rows={linhas} value={valor ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
  ) : (
    <input type="text" value={valor ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
  )
}

/** Botões de opção única; tocar de novo na opção marcada desmarca (como no app original). */
export function Opcoes<T extends string>(props: { opcoes: readonly T[]; valor: T | null | undefined; onChange: (v: T | null) => void; obrigatoria?: boolean }) {
  const { opcoes, valor, onChange, obrigatoria } = props
  return (
    <div className="chips">
      {opcoes.map((o) => (
        <button
          type="button"
          key={o}
          className={`chip ${valor === o ? 'on' : ''}`}
          aria-pressed={valor === o}
          onClick={() => onChange(valor === o && !obrigatoria ? null : o)}
        >
          {o}
        </button>
      ))}
    </div>
  )
}
