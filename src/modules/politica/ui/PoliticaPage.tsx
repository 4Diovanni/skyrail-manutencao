import { useEffect, useState } from 'react'
import { useAuth } from '../../../auth/AuthContext'
import { buscarAceite, type Aceite } from '../data/aceite'
import { textoDataAceite, VERSAO_POLITICA } from '../domain/politica'
import { TextoPolitica } from './TextoPolitica'

/** A política para consulta depois do aceite (pelo menu). */
export function PoliticaPage() {
  const uid = useAuth().session?.user.id
  const [aceite, setAceite] = useState<Aceite | null | undefined>(undefined)

  useEffect(() => {
    if (!uid) return
    buscarAceite(uid, VERSAO_POLITICA).then(setAceite, () => setAceite(null))
  }, [uid])

  return (
    <section className="pagina-politica">
      <h2>Política de uso</h2>
      {aceite && <p className="hint">Você aceitou esta versão em {textoDataAceite(aceite.aceito_em)}.</p>}
      <TextoPolitica />
    </section>
  )
}
