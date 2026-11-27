/**
 * Supabase simulado em memória, só para testes das filas de envio.
 * Cobre o que o app usa no envio: from().select/upsert/insert/delete com eq/in, single/maybeSingle,
 * e storage.from().upload/remove. Permite programar falhas para ver o que acontece com os dados.
 */
type Linha = Record<string, unknown>
type Op = 'select' | 'upsert' | 'insert' | 'delete' | 'upload' | 'remove'
type Resposta = { data: unknown; error: { message: string; code?: string } | null }

/** Chave de cada tabela (o upsert troca a linha com a mesma chave). */
const CHAVES: Record<string, string[]> = {
  atividade_equipe: ['atividade_id', 'profile_id'],
  preventiva_equipe: ['preventiva_id', 'profile_id'],
}

export function criarSupabaseFalso() {
  const tabelas: Record<string, Linha[]> = {}
  const arquivos = new Map<string, Blob>()
  const chamadas: { alvo: string; op: Op }[] = []
  const falhas: { alvo: string; op: Op; mensagem: string; vezes: number }[] = []

  const linhas = (t: string) => (tabelas[t] ??= [])

  /** Registra a chamada e devolve a falha programada para algum dos alvos, se houver. */
  function falhaProgramada(alvos: string | string[], op: Op): Resposta | null {
    const lista = Array.isArray(alvos) ? alvos : [alvos]
    chamadas.push({ alvo: lista[0]!, op })
    const f = falhas.find((x) => lista.includes(x.alvo) && x.op === op && x.vezes > 0)
    if (!f) return null
    f.vezes--
    return { data: null, error: { message: f.mensagem } }
  }

  class Consulta implements PromiseLike<Resposta> {
    private op: Op = 'select'
    private payload: Linha[] = []
    private chave: string[]
    private filtros: ((l: Linha) => boolean)[] = []
    private modo: 'lista' | 'single' | 'maybe' = 'lista'
    private devolver = false
    private tabela: string

    constructor(tabela: string) {
      this.tabela = tabela
      this.chave = CHAVES[tabela] ?? ['id']
    }
    select() {
      this.devolver = true
      return this
    }
    upsert(v: Linha | Linha[], opts?: { onConflict?: string }) {
      this.op = 'upsert'
      this.payload = Array.isArray(v) ? v : [v]
      if (opts?.onConflict) this.chave = opts.onConflict.split(',')
      return this
    }
    insert(v: Linha | Linha[]) {
      this.op = 'insert'
      this.payload = Array.isArray(v) ? v : [v]
      return this
    }
    delete() {
      this.op = 'delete'
      return this
    }
    eq(col: string, val: unknown) {
      this.filtros.push((l) => l[col] === val)
      return this
    }
    in(col: string, vals: unknown[]) {
      this.filtros.push((l) => vals.includes(l[col]))
      return this
    }
    single() {
      this.modo = 'single'
      return this
    }
    maybeSingle() {
      this.modo = 'maybe'
      return this
    }

    private executar(): Resposta {
      const falha = falhaProgramada(this.tabela, this.op)
      if (falha) return falha
      const tab = linhas(this.tabela)
      let resultado: Linha[] = []
      if (this.op === 'select') {
        resultado = tab.filter((l) => this.filtros.every((f) => f(l)))
      } else if (this.op === 'delete') {
        const ficam = tab.filter((l) => !this.filtros.every((f) => f(l)))
        tabelas[this.tabela] = ficam
      } else {
        for (const novo of this.payload) {
          const i = tab.findIndex((l) => this.chave.every((k) => l[k] === novo[k]))
          if (i >= 0 && this.op === 'insert') return { data: null, error: { message: 'duplicate key', code: '23505' } }
          const antigo = i >= 0 ? tab[i] : undefined
          const linha = { ...antigo, ...novo, id: antigo?.id ?? novo.id ?? crypto.randomUUID(), versao: ((antigo?.versao as number) ?? 0) + 1 }
          if (i >= 0) tab[i] = linha
          else tab.push(linha)
          resultado.push(linha)
        }
      }
      if (!this.devolver && this.op !== 'select') return { data: null, error: null }
      if (this.modo === 'lista') return { data: resultado, error: null }
      if (this.modo === 'maybe') return { data: resultado[0] ?? null, error: null }
      return resultado.length === 1 ? { data: resultado[0], error: null } : { data: null, error: { message: 'esperava 1 linha' } }
    }

    then<A = Resposta, B = never>(ok?: ((v: Resposta) => A | PromiseLike<A>) | null, erro?: ((e: unknown) => B | PromiseLike<B>) | null) {
      return Promise.resolve().then(() => this.executar()).then(ok, erro)
    }
  }

  const supabase = {
    from: (tabela: string) => new Consulta(tabela),
    storage: {
      from: (bucket: string) => ({
        async upload(path: string, blob: Blob) {
          const falha = falhaProgramada([`${bucket}/${path}`, bucket], 'upload')
          if (falha) return falha
          arquivos.set(`${bucket}/${path}`, blob)
          return { data: { path }, error: null }
        },
        async remove(paths: string[]) {
          const falha = falhaProgramada(bucket, 'remove')
          if (falha) return falha
          paths.forEach((p) => arquivos.delete(`${bucket}/${p}`))
          return { data: null, error: null }
        },
      }),
    },
  }

  return {
    supabase,
    tabelas,
    arquivos,
    chamadas,
    /** Linhas de uma tabela no "servidor". */
    linhas,
    /** A próxima operação (ou as próximas `vezes`) nesse alvo devolve erro do servidor. */
    falhar(alvo: string, op: Op, mensagem: string, vezes = 1) {
      falhas.push({ alvo, op, mensagem, vezes })
    },
    limpar() {
      for (const k of Object.keys(tabelas)) delete tabelas[k]
      arquivos.clear()
      chamadas.length = 0
      falhas.length = 0
    },
  }
}

export type SupabaseFalso = ReturnType<typeof criarSupabaseFalso>
