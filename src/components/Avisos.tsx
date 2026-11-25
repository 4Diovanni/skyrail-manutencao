import { dispensar, useAvisos } from '../lib/avisos'

/** Avisos de envio (concluído, na fila, falhou). Fica logo abaixo do topo, em qualquer tela. */
export function Avisos() {
  const avisos = useAvisos()
  if (!avisos.length) return null
  return (
    <div className="avisos">
      {avisos.map((a) => (
        <div key={a.id} className={`aviso-envio ${a.tipo}`} role={a.tipo === 'erro' ? 'alert' : 'status'}>
          <span>{a.texto}</span>
          <button type="button" aria-label="Fechar aviso" onClick={() => dispensar(a.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
