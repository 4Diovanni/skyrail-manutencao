// Supabase simulado para o teste ponta a ponta: responde, dentro do navegador do Playwright,
// às chamadas de Auth, REST (PostgREST) e Storage que o app faz. Tudo em memória e com dados fictícios.

const UID = '00000000-0000-4000-8000-0000000000e1'
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: UID, role: 'authenticated', exp: 4102444800 })}.assinatura-ficticia`

/** Coluna que liga a tabela filha à mãe nos selects aninhados (ex.: atividade_equipe.atividade_id). */
const FK = { atividades: 'atividade_id', preventivas: 'preventiva_id' }

export function criarBackend({ re, senha }) {
  const user = { id: UID, aud: 'authenticated', role: 'authenticated', email: `${re}@l17.local` }
  const db = {
    profiles: [{ id: UID, nome: 'Técnico Teste Um', matricula: re, perfil: 'tecnico', ativo: true, deve_trocar_senha: false }],
    catalogo_locais: [{ codigo: 'Estação Ficticia', ativo: true, ordem: 1 }],
    catalogo_sistemas: [{ codigo: 'Sinalização', ativo: true, ordem: 1 }],
  }
  const arquivos = new Map()
  const tabela = (t) => (db[t] ??= [])

  function filtrar(linhas, params) {
    let r = linhas
    for (const [col, expr] of params) {
      if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(col)) continue
      const [op, ...resto] = expr.split('.')
      const val = resto.join('.')
      const comoTexto = (v) => (v === null || v === undefined ? 'null' : String(v))
      if (op === 'eq') r = r.filter((l) => comoTexto(l[col]) === val)
      else if (op === 'neq') r = r.filter((l) => comoTexto(l[col]) !== val)
      else if (op === 'in') {
        const vals = val.replace(/^\(|\)$/g, '').split(',').map((v) => v.replace(/^"|"$/g, ''))
        r = r.filter((l) => vals.includes(comoTexto(l[col])))
      } else if (op === 'is') r = r.filter((l) => comoTexto(l[col]) === val)
    }
    return r
  }

  function projetar(t, linhas, select) {
    const aninhados = [...(select || '').matchAll(/(\w+)\(([^)]*)\)/g)].map((m) => m[1])
    if (!aninhados.length) return linhas
    return linhas.map((l) => {
      const out = { ...l }
      for (const filho of aninhados) out[filho] = tabela(filho).filter((f) => f[FK[t]] === l.id)
      return out
    })
  }

  function ordenar(linhas, order) {
    if (!order) return linhas
    const crit = order.split(',').map((o) => o.split('.'))
    return [...linhas].sort((a, b) => {
      for (const [col, dir] of crit) {
        if (a[col] === b[col]) continue
        const s = a[col] > b[col] ? 1 : -1
        return dir === 'desc' ? -s : s
      }
      return 0
    })
  }

  async function rest(route, req, url) {
    const t = url.pathname.replace('/rest/v1/', '')
    const params = [...url.searchParams.entries()]
    const um = (req.headers()['accept'] || '').includes('vnd.pgrst.object')
    const responder = (status, corpo) =>
      route.fulfill({ status, contentType: 'application/json', body: corpo === undefined ? '' : JSON.stringify(corpo) })
    const metodo = req.method()

    if (t.startsWith('rpc/')) return responder(200, null)

    if (metodo === 'GET' || metodo === 'HEAD') {
      let r = ordenar(filtrar(tabela(t), params), url.searchParams.get('order'))
      const limite = url.searchParams.get('limit')
      if (limite) r = r.slice(0, +limite)
      r = projetar(t, r, url.searchParams.get('select'))
      if (um) return r.length === 1 ? responder(200, r[0]) : responder(406, { code: 'PGRST116', message: 'sem linha' })
      return responder(200, r)
    }
    if (metodo === 'DELETE') {
      const sai = new Set(filtrar(tabela(t), params))
      db[t] = tabela(t).filter((l) => !sai.has(l))
      return responder(204)
    }
    if (metodo === 'PATCH') {
      const mudar = JSON.parse(req.postData() || '{}')
      for (const l of filtrar(tabela(t), params)) Object.assign(l, mudar)
      return responder(204)
    }
    // POST: insert ou upsert
    const prefer = req.headers()['prefer'] || ''
    const upsert = prefer.includes('merge-duplicates')
    const chave = (url.searchParams.get('on_conflict') || (t.endsWith('_equipe') ? `${FK[t.replace('_equipe', 's')] ?? ''},profile_id` : 'id')).split(',')
    const corpo = JSON.parse(req.postData() || '[]')
    const novas = Array.isArray(corpo) ? corpo : [corpo]
    const salvas = []
    for (const n of novas) {
      const i = tabela(t).findIndex((l) => chave.every((k) => n[k] !== undefined && l[k] === n[k]))
      if (i >= 0 && !upsert) return responder(409, { code: '23505', message: 'duplicate key value violates unique constraint' })
      const antiga = i >= 0 ? tabela(t)[i] : {}
      const linha = {
        ...antiga,
        ...n,
        id: antiga.id ?? n.id ?? crypto.randomUUID(),
        versao: (antiga.versao ?? 0) + 1,
        criado_por: antiga.criado_por ?? UID,
        gerado_por: antiga.gerado_por ?? UID,
        gerado_em: antiga.gerado_em ?? new Date().toISOString(),
        enviado_em: new Date().toISOString(),
      }
      if (i >= 0) tabela(t)[i] = linha
      else tabela(t).push(linha)
      salvas.push(linha)
    }
    if (!prefer.includes('return=representation')) return responder(201)
    return responder(201, um ? salvas[0] : salvas)
  }

  async function storage(route, req, url) {
    const p = url.pathname.replace('/storage/v1/', '')
    let m
    if ((m = p.match(/^object\/sign\/([^/]+)\/(.+)$/))) {
      const chave = `${m[1]}/${decodeURIComponent(m[2])}`
      if (!arquivos.has(chave)) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'Object not found' }) })
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ signedURL: `/object/sign/${chave}?token=ficticio` }) })
    }
    if ((m = p.match(/^object\/(?:authenticated\/|sign\/)?([^/]+)\/(.+)$/))) {
      const chave = `${m[1]}/${decodeURIComponent(m[2])}`
      if (req.method() === 'POST' || req.method() === 'PUT') {
        if (arquivos.has(chave) && req.method() === 'POST' && req.headers()['x-upsert'] !== 'true')
          return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'The resource already exists' }) })
        arquivos.set(chave, req.postDataBuffer() ?? Buffer.alloc(0))
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Key: chave }) })
      }
      if (!arquivos.has(chave)) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'Object not found' }) })
      return route.fulfill({ status: 200, contentType: 'application/octet-stream', body: arquivos.get(chave) })
    }
    if (p.startsWith('object')) return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    return route.fulfill({ status: 404, body: '' })
  }

  async function auth(route, req, url) {
    const p = url.pathname
    if (p.endsWith('/token')) {
      const corpo = JSON.parse(req.postData() || '{}')
      if (corpo.email !== user.email || corpo.password !== senha)
        return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }) })
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ access_token: jwt, refresh_token: 'refresh-ficticio', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user }),
      })
    }
    if (p.endsWith('/user')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) })
    if (p.endsWith('/logout')) return route.fulfill({ status: 204, body: '' })
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  }

  /** Liga o backend simulado a um contexto do Playwright, interceptando o domínio do Supabase. */
  async function ligar(contexto, supabaseUrl) {
    await contexto.route(`${supabaseUrl}/**`, async (route) => {
      const req = route.request()
      const url = new URL(req.url())
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } })
      if (url.pathname.startsWith('/rest/v1/')) return rest(route, req, url)
      if (url.pathname.startsWith('/storage/v1/')) return storage(route, req, url)
      if (url.pathname.startsWith('/auth/v1/')) return auth(route, req, url)
      return route.fulfill({ status: 404, body: '' })
    })
  }

  return { ligar, db, arquivos }
}
