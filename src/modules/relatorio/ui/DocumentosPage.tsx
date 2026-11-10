import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

interface Documento {
  id: string
  tipo: 'relatorio' | 'os' | 'rm' | 'roteiro' | 'passagem'
  categoria: string | null
  data: string
  turno: string
  storage_path: string
  nome: string
  tamanho: number | null
  gerado_em: string
}

const ROTULO = { relatorio: 'Relatório', os: 'OS', rm: 'Registro de manutenção', roteiro: 'Roteiro', passagem: 'Passagem de turno' }

/** PDFs guardados no servidor. Todo usuário ativo vê os documentos de todos os turnos (regra do banco, migração 0006). */
export function DocumentosPage() {
  const [docs, setDocs] = useState<Documento[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('documentos')
      .select('*')
      .order('data', { ascending: false })
      .order('gerado_em', { ascending: false })
      .limit(300)
      .then(({ data, error }) => (error ? setErro('Não foi possível carregar os documentos.') : setDocs((data ?? []) as Documento[])))
  }, [])

  async function baixar(d: Documento) {
    const { data, error } = await supabase.storage.from('documentos').createSignedUrl(d.storage_path, 120, { download: d.nome })
    if (error || !data) {
      alert('Não foi possível baixar este PDF.')
      return
    }
    const link = document.createElement('a')
    link.href = data.signedUrl
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  const dias = [...new Set((docs ?? []).map((d) => d.data))]
  return (
    <section>
      <h2>Documentos</h2>
      <p className="hint">PDFs gerados no app, separados por dia e turno.</p>
      {erro && <p role="alert" className="error">{erro}</p>}
      {docs && !docs.length && <p className="hint">Nenhum PDF guardado ainda.</p>}
      {dias.map((dia) => (
        <div key={dia} className="card">
          <h3>{dia.split('-').reverse().join('/')}</h3>
          {(['Noturno', 'Diurno'] as const).map((t) => {
            const l = (docs ?? []).filter((d) => d.data === dia && d.turno === t)
            if (!l.length) return null
            return (
              <div key={t}>
                <p className="hint"><b>{t}</b></p>
                {l.map((d) => (
                  <div key={d.id} className="atividade">
                    <span className="num pdf">PDF</span>
                    <div className="meio">
                      <b className="quebra">{d.nome}</b>
                      <small>
                        {d.categoria} · {ROTULO[d.tipo]}
                        {d.tamanho ? ` · ${Math.round(d.tamanho / 1024)} KB` : ''}
                      </small>
                    </div>
                    <button type="button" className="mini" onClick={() => void baixar(d)} aria-label={`Baixar ${d.nome}`}>⬇</button>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      ))}
    </section>
  )
}
