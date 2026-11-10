import type { PessoaEquipe } from '../../data/remoto'

export function EquipeCampo({ pessoas, valor, onChange }: { pessoas: PessoaEquipe[]; valor: string[]; onChange: (v: string[]) => void }) {
  function alternar(id: string) {
    onChange(valor.includes(id) ? valor.filter((x) => x !== id) : [...valor, id])
  }
  return (
    <div className="lista-pessoas">
      {pessoas.map((p) => (
        <label key={p.id} className={`pessoa ${valor.includes(p.id) ? 'on' : ''}`}>
          <input type="checkbox" checked={valor.includes(p.id)} onChange={() => alternar(p.id)} />
          <span>{p.nome || 'Sem nome'}</span>
          <small>{p.matricula}</small>
        </label>
      ))}
      {!pessoas.length && <p className="hint">Nenhuma pessoa carregada ainda.</p>}
    </div>
  )
}

export function PessoaSelect({ pessoas, valor, onChange }: { pessoas: PessoaEquipe[]; valor: string | null; onChange: (v: string | null) => void }) {
  return (
    <select value={valor ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">Ninguém indicado</option>
      {pessoas.map((p) => (
        <option key={p.id} value={p.id}>
          {p.nome || p.matricula}
        </option>
      ))}
    </select>
  )
}
