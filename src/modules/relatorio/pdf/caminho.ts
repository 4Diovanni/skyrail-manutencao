import type { Atividade } from '../domain/tipos'
import { diaDaSemana, slug } from './texto'

export type TipoDoc = 'relatorio' | 'os' | 'rm'

const ddmmaaaa = (iso: string) => iso.split('-').reverse().join('')

/**
 * Nome e pasta do PDF no servidor, na mesma organização do app original:
 * <Categoria>/<data dia-da-semana>/<Turno>/<Relatórios | OS | Registros de manutenção>/<arquivo>.pdf
 * A versão entra no nome para cada reenvio gerar um arquivo novo, sem apagar o anterior.
 */
export function caminhoDocumento(a: Atividade, tipo: TipoDoc, numero: number): { pasta: string; nome: string; caminho: string } {
  const sub = tipo === 'relatorio' ? 'Relatórios' : tipo === 'rm' ? 'Registros de manutenção' : 'OS'
  const pasta = `${a.categoria}/${a.data} ${diaDaSemana(a.data)}/${a.turno}/${sub}`
  const d = ddmmaaaa(a.data)
  const v = `v${a.versao}`
  const nome =
    tipo === 'relatorio'
      ? `${a.categoria}_${d}_${a.turno}_${String(numero).padStart(2, '0')}_${slug(a.titulo)}_${v}.pdf`
      : tipo === 'rm'
        ? `RM_Preventiva_${slug(a.tipo_prev)}_${d}_${a.turno}_${slug(a.titulo)}_${v}.pdf`
        : `OS_${slug(a.os.numero || 'sem-numero')}_${d}_${a.turno}_${slug(a.titulo)}_${v}.pdf`
  return { pasta, nome, caminho: `${pasta}/${nome}` }
}

/** Storage do Supabase não aceita acentos e espaços nas chaves: normaliza só o caminho técnico. */
export function chaveStorage(caminho: string): string {
  return caminho
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9/_.-]+/g, '_')
}
