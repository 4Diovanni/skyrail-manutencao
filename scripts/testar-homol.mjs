#!/usr/bin/env node
// Testa o site de homologação publicado na Netlify, depois do merge na branch homologacao.
//
// Variáveis:
//   HOMOL_URL                 endereço do site (ex.: https://skyrail-homol.netlify.app)
//   HOMOL_SUPABASE_URL        URL do Supabase de homologação
//   HOMOL_SUPABASE_ANON_KEY   chave pública (publishable/anon) do Supabase de homologação
//   COMMIT_ESPERADO           (opcional) espera a Netlify publicar este commit antes de testar
//   HOMOL_TESTE_RE / HOMOL_TESTE_SENHA  (opcionais) usuário fictício para testar o login
//   PASTA_BAIXADOS            (opcional) onde salvar o JS publicado para a checagem de segredos
//
// Sai com código 1 se qualquer checagem falhar. Escreve um resumo em GITHUB_STEP_SUMMARY.
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const env = process.env
const site = (env.HOMOL_URL || '').replace(/\/+$/, '')
const supabaseUrl = (env.HOMOL_SUPABASE_URL || '').replace(/\/+$/, '')
const anonKey = env.HOMOL_SUPABASE_ANON_KEY || ''
const commitEsperado = env.COMMIT_ESPERADO || ''
const pasta = env.PASTA_BAIXADOS || 'homol-baixado'
const esperaMaxMs = Number(env.ESPERA_MAX_MS || 15 * 60 * 1000)

const resultados = []
function registrar(nome, ok, detalhe = '') {
  resultados.push({ nome, ok, detalhe })
  console.log(`${ok ? 'OK  ' : 'FALHOU'} ${nome}${detalhe ? ` — ${detalhe}` : ''}`)
}
async function checar(nome, fn) {
  try {
    registrar(nome, true, (await fn()) || '')
  } catch (e) {
    registrar(nome, false, e instanceof Error ? e.message : String(e))
  }
}
function exigir(cond, msg) {
  if (!cond) throw new Error(msg)
}
const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

async function buscar(url, init) {
  const r = await fetch(url, { redirect: 'follow', ...init, headers: { 'cache-control': 'no-cache', ...init?.headers } })
  return r
}

// Para o Supabase: um 5xx ou falha de rede momentânea (ex.: 522 do Cloudflare) não reprova a homologação.
// Tenta de novo com espera crescente (3, 6, 12 s); um 4xx volta na hora, porque é erro de verdade.
async function buscarComRetry(url, init, tentativas = 4) {
  let ultimo = ''
  for (let i = 0; i < tentativas; i++) {
    if (i) await dormir(3000 * 2 ** (i - 1))
    try {
      const r = await buscar(url, init)
      if (r.status < 500) return r
      ultimo = `HTTP ${r.status}`
    } catch (e) {
      ultimo = e instanceof Error ? e.message : String(e)
    }
  }
  throw new Error(`${ultimo} após ${tentativas} tentativas`)
}

function finalizar() {
  const falhas = resultados.filter((r) => !r.ok)
  const linhas = [
    `## Homologação: ${falhas.length ? 'FALHOU' : 'OK'}`,
    '',
    `Site: ${site || '(não configurado)'}${commitEsperado ? ` · commit \`${commitEsperado.slice(0, 7)}\`` : ''}`,
    '',
    '| Checagem | Resultado | Detalhe |',
    '| --- | --- | --- |',
    ...resultados.map((r) => `| ${r.nome} | ${r.ok ? '✅' : '❌'} | ${r.detalhe.replace(/\|/g, '/').replace(/\n/g, ' ')} |`),
    '',
  ]
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, linhas.join('\n'))
  writeFileSync('homol-resultado.md', linhas.join('\n'))
  process.exit(falhas.length ? 1 : 0)
}

// 0. Configuração
await checar('Configuração do pipeline', async () => {
  const faltando = ['HOMOL_URL', 'HOMOL_SUPABASE_URL', 'HOMOL_SUPABASE_ANON_KEY'].filter((n) => !env[n])
  exigir(!faltando.length, `faltam as variáveis do repositório: ${faltando.join(', ')}`)
})
if (resultados.some((r) => !r.ok)) finalizar()

// 1. A Netlify já publicou o commit novo?
await checar('Netlify publicou o commit', async () => {
  if (!commitEsperado) return 'sem commit esperado; testando o que estiver no ar'
  const inicio = Date.now()
  let visto = ''
  while (Date.now() - inicio < esperaMaxMs) {
    try {
      const r = await buscar(`${site}/versao.json?t=${Date.now()}`)
      if (r.status === 401) {
        throw new Error(
          'o site pede login da Netlify (Visitor access). O pipeline não consegue passar por ele; libere o acesso do site de homol ou configure uma senha.',
        )
      }
      if (r.ok) {
        visto = (await r.json()).commit || ''
        if (visto === commitEsperado) return `publicado em ${Math.round((Date.now() - inicio) / 1000)} s`
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes('Visitor access')) throw e
      // site ainda subindo; tenta de novo
    }
    await dormir(20_000)
  }
  throw new Error(
    `depois de ${Math.round(esperaMaxMs / 60000)} min o site ainda mostra ${visto ? `o commit ${visto.slice(0, 7)}` : 'nenhuma versão'}. Veja o log de deploy na Netlify.`,
  )
})
if (resultados.some((r) => !r.ok)) finalizar()

// 2. Página inicial, noindex e robots.txt
let html = ''
await checar('Página abre (HTTP 200)', async () => {
  const r = await buscar(`${site}/`)
  exigir(r.ok, `HTTP ${r.status}`)
  html = await r.text()
  exigir(html.includes('id="root"'), 'HTML sem a div root do app')
  const robots = r.headers.get('x-robots-tag') || ''
  exigir(/noindex/i.test(robots), `header X-Robots-Tag sem noindex ("${robots}")`)
  exigir(/<meta name="robots" content="[^"]*noindex/i.test(html), 'meta robots noindex ausente')
  return 'com noindex no header e na meta'
})
await checar('robots.txt bloqueia buscadores', async () => {
  const r = await buscar(`${site}/robots.txt`)
  exigir(r.ok, `HTTP ${r.status}`)
  exigir(/Disallow:\s*\/\s*$/m.test(await r.text()), 'sem "Disallow: /"')
})

// 3. JS publicado aponta para o Supabase de homologação (e é salvo para a checagem de segredos)
await checar('Bundle aponta para o Supabase de homologação', async () => {
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map((m) => m[1])
  exigir(scripts.length, 'nenhum <script src> no index.html')
  mkdirSync(pasta, { recursive: true })
  // Segue os imports entre chunks (o Vite divide o código em vários arquivos em /assets).
  const fila = scripts.map((src) => new URL(src, `${site}/`).href)
  const entradas = new Set(fila)
  const vistos = new Set(fila)
  let texto = ''
  while (fila.length) {
    const url = fila.shift()
    const r = await buscar(url)
    const ehJs = (r.headers.get('content-type') || '').includes('javascript')
    if (!entradas.has(url) && (!r.ok || !ehJs)) continue // nome que só parecia um chunk
    exigir(r.ok, `${new URL(url).pathname}: HTTP ${r.status}`)
    const js = await r.text()
    texto += js
    writeFileSync(join(pasta, new URL(url).pathname.split('/').pop()), js)
    for (const m of js.matchAll(/(?:\.\/|assets\/)([\w.-]+\.js)\b/g)) {
      const prox = new URL(`/assets/${m[1]}`, `${site}/`).href
      if (!vistos.has(prox)) {
        vistos.add(prox)
        fila.push(prox)
      }
    }
  }
  exigir(texto.includes(supabaseUrl), `o JS não contém ${supabaseUrl}; a variável VITE_SUPABASE_URL da Netlify está errada?`)
  return `${vistos.size} arquivo(s) JS`
})

// 4. Supabase de homologação no ar
await checar('Supabase (Auth) responde', async () => {
  const r = await buscarComRetry(`${supabaseUrl}/auth/v1/health`, { headers: { apikey: anonKey } })
  exigir(r.ok, `HTTP ${r.status}`)
})

// 5. Login com usuário fictício e leitura do próprio perfil (migrações + RLS)
if (env.HOMOL_TESTE_RE && env.HOMOL_TESTE_SENHA) {
  await checar('Login e leitura do perfil (RLS)', async () => {
    const dominio = env.HOMOL_LOGIN_DOMAIN || 'l17.local'
    const r = await buscarComRetry(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anonKey, 'content-type': 'application/json' },
      body: JSON.stringify({ email: `${env.HOMOL_TESTE_RE}@${dominio}`, password: env.HOMOL_TESTE_SENHA }),
    })
    exigir(r.ok, `login recusado (HTTP ${r.status})`)
    const { access_token } = await r.json()
    const p = await buscarComRetry(`${supabaseUrl}/rest/v1/profiles?select=id&limit=1`, {
      headers: { apikey: anonKey, authorization: `Bearer ${access_token}` },
    })
    exigir(p.ok, `tabela profiles: HTTP ${p.status} (migrações aplicadas?)`)
    const linhas = await p.json()
    exigir(Array.isArray(linhas) && linhas.length > 0, 'o usuário de teste não enxerga o próprio perfil')
  })
} else {
  registrar('Login e leitura do perfil (RLS)', true, 'pulado: secrets HOMOL_TESTE_RE e HOMOL_TESTE_SENHA não configurados')
}

// 6. A tela de login renderiza num celular, sem erro de JavaScript
await checar('Tela de login abre no celular', async () => {
  let playwright
  try {
    playwright = await import('playwright')
  } catch {
    return 'pulado: playwright não instalado'
  }
  const browser = await playwright.chromium.launch()
  try {
    const page = await browser.newPage({ ...playwright.devices['Pixel 5'] })
    const erros = []
    page.on('pageerror', (e) => erros.push(e.message))
    await page.goto(`${site}/login`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Entrar' }).waitFor({ timeout: 20_000 })
    exigir(!erros.length, `erro de JavaScript: ${erros[0]}`)
    const largura = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    exigir(largura <= 0, `rolagem horizontal de ${largura}px`)
  } finally {
    await browser.close()
  }
})

finalizar()
