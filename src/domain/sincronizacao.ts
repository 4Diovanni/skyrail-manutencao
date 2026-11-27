/** Texto da última sincronização boa, para o técnico saber se o que fez já chegou ao servidor. */
export function textoUltimaSincronizacao(iso: string | null, agora: Date = new Date()): string {
  if (!iso) return 'Ainda não sincronizou neste aparelho'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Ainda não sincronizou neste aparelho'
  const tz = 'America/Sao_Paulo'
  const dia = (x: Date) => x.toLocaleDateString('pt-BR', { timeZone: tz })
  const hora = d.toLocaleTimeString('pt-BR', { timeZone: tz, hour: '2-digit', minute: '2-digit' })
  const ontem = new Date(agora.getTime() - 24 * 60 * 60 * 1000)
  if (dia(d) === dia(agora)) return `Sincronizado hoje às ${hora}`
  if (dia(d) === dia(ontem)) return `Sincronizado ontem às ${hora}`
  const data = d.toLocaleDateString('pt-BR', { timeZone: tz, day: '2-digit', month: '2-digit' })
  return `Sincronizado em ${data} às ${hora}`
}
