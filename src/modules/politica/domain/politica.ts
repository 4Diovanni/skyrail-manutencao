/**
 * Política de uso do app (Anexo I, item 2c do contrato).
 *
 * O texto oficial é do contratante e ainda não foi entregue (Cláusula 8.2). Até lá vale este texto
 * PROVISÓRIO, que só explica o funcionamento do aceite. Quando o texto oficial chegar:
 *   1. troque SECOES pelo texto recebido;
 *   2. mude VERSAO_POLITICA (ex.: '1') e TEXTO_PROVISORIO para false.
 * Com a versão nova, todos aceitam de novo no próximo acesso.
 */
export const VERSAO_POLITICA = '0-provisoria'
export const TEXTO_PROVISORIO = true

export type SecaoPolitica = { titulo: string; paragrafos: string[] }

export const SECOES: SecaoPolitica[] = [
  {
    titulo: 'Texto provisório',
    paragrafos: [
      'Esta é uma versão de testes. O texto oficial da política de uso será fornecido pelo contratante e substituirá este conteúdo.',
      'Quando o texto oficial for publicado, o app pedirá um novo aceite no próximo acesso.',
    ],
  },
  {
    titulo: 'Como funciona o aceite',
    paragrafos: [
      'O app só libera as telas depois que você lê e aceita a política.',
      'O aceite fica registrado com o seu usuário, a data e a hora do servidor e a versão do texto.',
      'Você pode ler a política de novo a qualquer momento pelo menu, em "Política de uso".',
    ],
  },
]

/** Precisa mostrar a tela de aceite? Só quando a versão atual ainda não foi aceita. */
export function precisaAceitar(versaoAtual: string, versaoAceita: string | null): boolean {
  return versaoAceita !== versaoAtual
}

/** Chave do aceite guardado no aparelho, por pessoa (o app precisa abrir sem internet depois do aceite). */
export function chaveAceiteLocal(userId: string): string {
  return `skyrail:politica-aceita:${userId}`
}

/** "25/11/2026 às 17:42", no fuso de São Paulo. */
export function textoDataAceite(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const fmt = (o: Intl.DateTimeFormatOptions) => d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', ...o })
  return `${fmt({ day: '2-digit', month: '2-digit', year: 'numeric' })} às ${fmt({ hour: '2-digit', minute: '2-digit' })}`
}
