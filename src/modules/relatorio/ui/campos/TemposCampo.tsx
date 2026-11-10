import { definirHorario, duracaoEtapa, formatarMinutos, marcarNA } from '../../domain/tempos'
import { ETAPAS, type Tempos } from '../../domain/tipos'

export function TemposCampo({ valor, onChange }: { valor: Tempos; onChange: (t: Tempos) => void }) {
  const atu = valor.atu
  const total = duracaoEtapa(atu)
  return (
    <>
      <p className="hint">Ao informar o término de uma etapa, o início da seguinte é preenchido. O tempo total é o da “Atuação até a liberação”.</p>
      <div className="tempos">
        {ETAPAS.map(([k, rotulo]) => {
          const p = valor[k] ?? { i: '', f: '' }
          const d = duracaoEtapa(p)
          return (
            <fieldset key={k} className={`tempo ${k === 'atu' ? 'atu' : ''}`}>
              <legend>
                {rotulo} <em>{d != null ? formatarMinutos(d) : p.na ? 'N/A' : '—'}</em>
              </legend>
              <label>
                Início
                <input type="time" value={p.i} disabled={p.na} onChange={(e) => onChange(definirHorario(valor, k, 'i', e.target.value))} />
              </label>
              <label>
                Término
                <input type="time" value={p.f} disabled={p.na} onChange={(e) => onChange(definirHorario(valor, k, 'f', e.target.value))} />
              </label>
              <label className="na">
                <input type="checkbox" checked={!!p.na} onChange={(e) => onChange(marcarNA(valor, k, e.target.checked))} /> Não se aplica
              </label>
            </fieldset>
          )
        })}
      </div>
      <p className="total">
        ⏱ Tempo de atuação: <b>{total != null ? `${formatarMinutos(total)} (${atu?.i} às ${atu?.f})` : '—'}</b>
      </p>
    </>
  )
}
