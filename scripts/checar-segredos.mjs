#!/usr/bin/env node
// Procura segredos que nunca podem ir para o repositório nem para o bundle.
//   node scripts/checar-segredos.mjs          -> arquivos versionados (git ls-files)
//   node scripts/checar-segredos.mjs dist     -> arquivos gerados pelo build
// Encontra: secret key nova do Supabase (sb_secret_...), JWT com role service_role
// e chaves privadas (PEM). Sai com código 1 se achar algo.
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const alvo = process.argv[2]
const esteArquivo = 'scripts/checar-segredos.mjs'

function listarPasta(pasta) {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome)
    return statSync(caminho).isDirectory() ? listarPasta(caminho) : [caminho]
  })
}

const arquivos = alvo
  ? listarPasta(alvo)
  : execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean)

const regras = [
  { nome: 'secret key do Supabase (sb_secret_)', re: /sb_secret_[A-Za-z0-9_-]{10,}/g },
  { nome: 'chave privada (PEM)', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
]
const jwt = /eyJ[A-Za-z0-9_-]{5,}\.(eyJ[A-Za-z0-9_-]{5,})\.[A-Za-z0-9_-]{10,}/g

function papelDoJwt(payload) {
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')).role
  } catch {
    return undefined
  }
}

const achados = []
for (const arquivo of arquivos) {
  if (arquivo === esteArquivo) continue
  let texto
  try {
    texto = readFileSync(arquivo, 'utf8')
  } catch {
    continue
  }
  if (texto.includes('\0')) continue // binário
  const nomeExibido = alvo ? relative('.', arquivo) : arquivo
  for (const { nome, re } of regras) {
    if (re.test(texto)) achados.push(`${nomeExibido}: ${nome}`)
    re.lastIndex = 0
  }
  for (const m of texto.matchAll(jwt)) {
    if (papelDoJwt(m[1]) === 'service_role') achados.push(`${nomeExibido}: JWT com role service_role`)
  }
}

if (achados.length) {
  console.error('Segredos encontrados (troque a chave no Supabase e remova do código):')
  for (const a of achados) console.error(`  - ${a}`)
  process.exit(1)
}
console.log(`Nenhum segredo encontrado em ${arquivos.length} arquivos${alvo ? ` de ${alvo}/` : ' versionados'}.`)
