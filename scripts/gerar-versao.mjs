#!/usr/bin/env node
// Grava dist/versao.json com o commit do build. O pipeline de homologação usa
// esse arquivo para saber se a Netlify já publicou o commit que acabou de entrar.
// COMMIT_REF vem da Netlify; GITHUB_SHA do GitHub Actions; senão, o git local.
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

function commitLocal() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch {
    return 'desconhecido'
  }
}

const commit = process.env.COMMIT_REF || process.env.GITHUB_SHA || commitLocal()
writeFileSync('dist/versao.json', JSON.stringify({ commit, geradoEm: new Date().toISOString() }) + '\n')
console.log(`dist/versao.json: ${commit}`)
