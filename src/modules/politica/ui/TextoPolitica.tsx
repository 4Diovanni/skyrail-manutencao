import { SECOES, TEXTO_PROVISORIO, VERSAO_POLITICA } from '../domain/politica'

/** Corpo da política (texto puro, sem HTML montado a partir de dados). */
export function TextoPolitica() {
  return (
    <div className="card texto-politica">
      {TEXTO_PROVISORIO && <p className="selo-provisorio">Texto provisório · versão de testes</p>}
      {SECOES.map((s) => (
        <section key={s.titulo}>
          <h3>{s.titulo}</h3>
          {s.paragrafos.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </section>
      ))}
      <p className="hint">Versão do texto: {VERSAO_POLITICA}</p>
    </div>
  )
}
