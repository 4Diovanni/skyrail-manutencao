import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { sairComAviso } from '../../../app/sair'
import { buscarAceite, guardarAceiteNoAparelho, registrarAceite, versaoAceitaNoAparelho } from '../data/aceite'
import { precisaAceitar, VERSAO_POLITICA } from '../domain/politica'
import { TextoPolitica } from './TextoPolitica'

type Estado = 'verificando' | 'aceita' | 'pendente' | 'erro'

/**
 * Só libera as telas depois do aceite da versão atual da política.
 * Depois de aceitar, o aparelho guarda a versão aceita, para o app abrir sem internet em campo.
 */
export function AceitePolitica({ userId, children }: { userId: string; children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>(() =>
    precisaAceitar(VERSAO_POLITICA, versaoAceitaNoAparelho(userId)) ? 'verificando' : 'aceita',
  )
  const [marcado, setMarcado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erroEnvio, setErroEnvio] = useState<string | null>(null)

  const verificar = useCallback(async () => {
    setEstado('verificando')
    try {
      const a = await buscarAceite(userId, VERSAO_POLITICA)
      if (a) guardarAceiteNoAparelho(userId, a.versao)
      setEstado(a ? 'aceita' : 'pendente')
    } catch {
      setEstado('erro')
    }
  }, [userId])

  useEffect(() => {
    if (estado === 'verificando') void verificar()
    // só na abertura; "Tentar de novo" chama verificar de novo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  async function aceitar() {
    setEnviando(true)
    setErroEnvio(null)
    try {
      await registrarAceite(VERSAO_POLITICA)
      guardarAceiteNoAparelho(userId, VERSAO_POLITICA)
      setEstado('aceita')
    } catch {
      setErroEnvio('Não foi possível registrar o aceite. Confira a internet e tente de novo.')
    } finally {
      setEnviando(false)
    }
  }

  if (estado === 'aceita') return <>{children}</>
  if (estado === 'verificando') return <p className="center">Carregando…</p>
  if (estado === 'erro') {
    return (
      <main className="login">
        <h1>Política de uso</h1>
        <p role="alert">Não foi possível conferir o aceite da política de uso. Confira a internet e tente de novo.</p>
        <div className="acoes-politica">
          <button type="button" onClick={() => void verificar()}>Tentar de novo</button>
          <button type="button" className="sec" onClick={() => void sairComAviso()}>Sair</button>
        </div>
      </main>
    )
  }

  return (
    <main className="aceite-politica">
      <h1>Política de uso</h1>
      <p className="hint">Leia antes de começar. O app é liberado depois do aceite.</p>
      <TextoPolitica />
      <label className="marcar-aceite">
        <input type="checkbox" checked={marcado} onChange={(e) => setMarcado(e.target.checked)} />
        <span>Li e aceito a política de uso</span>
      </label>
      {erroEnvio && <p role="alert" className="error">{erroEnvio}</p>}
      <div className="acoes-politica">
        <button type="button" disabled={!marcado || enviando} onClick={() => void aceitar()}>
          {enviando ? 'Registrando…' : 'Aceitar e continuar'}
        </button>
        <button type="button" className="sec" onClick={() => void sairComAviso()}>Sair</button>
      </div>
    </main>
  )
}
