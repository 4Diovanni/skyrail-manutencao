import { formatarMinutos } from '../../relatorio/domain/tempos'
import type { ItemTurno } from '../domain/tipos'

const COR_STATUS: Record<string, string> = { Concluída: 'ok', 'Em andamento': 'and', 'Não realizada': 'nok' }

export function ItensTurno({ itens }: { itens: ItemTurno[] }) {
  if (!itens.length) return <p className="hint">Nenhuma atividade enviada neste turno.</p>
  return (
    <ol className="pass-itens">
      {itens.map((x, i) => (
        <li key={x.id} className="pass-item">
          <span className="pass-num">{String(i + 1).padStart(2, '0')}</span>
          <div className="pass-item-meio">
            <b>{x.titulo}</b>
            <small>
              <span className={`pass-cat ${x.categoria === 'Preventiva' ? 'prev' : 'cor'}`}>
                {x.categoria}
                {x.tipoPrev ? ` ${x.tipoPrev}` : ''}
              </span>
              {[x.local, x.sistema && x.sistema !== x.titulo ? x.sistema : null, x.cim && x.cim.toUpperCase() !== 'N/A' ? `CIM ${x.cim}` : null]
                .filter(Boolean)
                .join(' · ')}
            </small>
            {x.equipe.length > 0 && <small>{x.equipe.join(', ')}</small>}
            {x.status === 'Não realizada' && x.motivo && <small className="pass-motivo">Motivo: {x.motivo}</small>}
          </div>
          <div className="pass-item-fim">
            <span className={`tag st-${COR_STATUS[x.status]}`}>{x.status}</span>
            {x.atuacao && (
              <small>
                {x.atuacao.i}
                {x.atuacao.f ? `–${x.atuacao.f}` : ''}
                {x.minutos != null ? ` · ${formatarMinutos(x.minutos)}` : ''}
              </small>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
