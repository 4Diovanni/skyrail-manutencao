import { useEffect, useState } from 'react'
import { localDb } from '../data/local'
import { listarCatalogo, listarPessoas, type PessoaEquipe } from '../data/remoto'

export interface Referencias {
  pessoas: PessoaEquipe[]
  locais: string[]
  sistemas: string[]
}

const VAZIO: Referencias = { pessoas: [], locais: [], sistemas: [] }

/** Pessoas e catálogos: busca no servidor e guarda cópia local para usar offline. */
export function useReferencias(): Referencias {
  const [ref, setRef] = useState<Referencias>(VAZIO)
  useEffect(() => {
    let vivo = true
    localDb.cache.get('referencias').then((c) => {
      if (vivo && c) setRef(c.valor as Referencias)
    })
    Promise.all([listarPessoas(), listarCatalogo('catalogo_locais'), listarCatalogo('catalogo_sistemas')])
      .then(([pessoas, locais, sistemas]) => {
        const v = { pessoas, locais, sistemas }
        if (vivo) setRef(v)
        void localDb.cache.put({ chave: 'referencias', valor: v })
      })
      .catch(() => {
        // sem rede: fica com a cópia local
      })
    return () => {
      vivo = false
    }
  }, [])
  return ref
}

export function nomePessoa(pessoas: PessoaEquipe[], id: string | null | undefined): string {
  if (!id) return ''
  const p = pessoas.find((x) => x.id === id)
  return p?.nome || p?.matricula || 'Pessoa não encontrada'
}
