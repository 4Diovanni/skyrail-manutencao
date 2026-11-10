/** Escolha de um ou mais itens de um catálogo (Local, Sistema). Guarda como "A / B", igual ao app original. */
export function MultiChips({ itens, valor, onChange }: { itens: string[]; valor: string | null; onChange: (v: string | null) => void }) {
  const sel = (valor ?? '').split(/\s*\/\s*/).filter(Boolean)
  const extras = sel.filter((s) => !itens.includes(s))
  function alternar(item: string) {
    const novo = sel.includes(item) ? sel.filter((x) => x !== item) : [...sel, item]
    const ordenado = [...itens, ...extras].filter((x) => novo.includes(x))
    onChange(ordenado.length ? ordenado.join(' / ') : null)
  }
  return (
    <div className="chips">
      {[...itens, ...extras].map((i) => (
        <button type="button" key={i} className={`chip ${sel.includes(i) ? 'on' : ''}`} aria-pressed={sel.includes(i)} onClick={() => alternar(i)}>
          {i}
        </button>
      ))}
      {!itens.length && <span className="hint">Lista vazia. Conecte-se à internet uma vez para carregar.</span>}
    </div>
  )
}
