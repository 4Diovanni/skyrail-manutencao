import type { Turno } from '../../../domain/turno'
import { diaDaSemana } from '../../relatorio/pdf/texto'

const ddmmaaaa = (iso: string) => iso.split('-').reverse().join('')

/** Pasta e nome no mesmo padrão dos outros PDFs; a versão no nome preserva os anteriores. */
export function caminhoPassagem(data: string, turno: Turno, versao: number) {
  const pasta = `Passagem de turno/${data} ${diaDaSemana(data)}/${turno}`
  const nome = `Passagem_de_turno_${ddmmaaaa(data)}_${turno}_v${versao}.pdf`
  return { pasta, nome, caminho: `${pasta}/${nome}` }
}

