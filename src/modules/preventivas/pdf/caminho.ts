import { diaDaSemana, slug } from '../../relatorio/pdf/texto'
import type { ModeloChecklist } from '../domain/modelo'
import type { Preventiva } from '../domain/preventiva'

export type TipoDocPrev = 'relatorio' | 'roteiro' | 'rm'

const ddmmaaaa = (iso: string) => iso.split('-').reverse().join('')
const SUBPASTA: Record<TipoDocPrev, string> = { relatorio: 'Relatórios', roteiro: 'Roteiros', rm: 'Registros de manutenção' }
const PREFIXO: Record<TipoDocPrev, string> = { relatorio: 'Preventiva', roteiro: 'Roteiro', rm: 'RM_Preventiva' }

/**
 * Nome e pasta do PDF da preventiva, no mesmo padrão do relatório:
 * Preventiva/<data dia-da-semana>/<Turno>/<Relatórios | Roteiros | Registros de manutenção>/<arquivo>.pdf
 * A versão vai no nome, então cada reenvio gera um arquivo novo sem apagar o anterior.
 */
export function caminhoPreventiva(
  p: Pick<Preventiva, 'data' | 'turno' | 'versao' | 'local'>,
  m: Pick<ModeloChecklist, 'sistemaNome' | 'codigo'>,
  tipo: TipoDocPrev,
): { pasta: string; nome: string; caminho: string } {
  const pasta = `Preventiva/${p.data} ${diaDaSemana(p.data)}/${p.turno}/${SUBPASTA[tipo]}`
  const partes = [PREFIXO[tipo], slug(m.codigo), ddmmaaaa(p.data), p.turno, slug(m.sistemaNome)]
  if (p.local) partes.push(slug(p.local))
  const nome = `${partes.filter(Boolean).join('_')}_v${p.versao}.pdf`
  return { pasta, nome, caminho: `${pasta}/${nome}` }
}
