#!/usr/bin/env node
// Teste ponta a ponta com o Supabase simulado (dados fictícios), no tamanho do Pixel 5:
// login → aceitar a política → criar uma corretiva → enviar → gerar o PDF → ver em Documentos.
//
// Uso: VITE_SUPABASE_URL=https://e2e-ficticio.supabase.co VITE_SUPABASE_ANON_KEY=anon-e2e npm run build
//      node scripts/e2e/ponta-a-ponta.mjs
// Precisa do pacote playwright com o Chromium (no CI: npm install --no-save playwright && npx playwright install chromium).
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { criarBackend } from './supabase-falso.mjs'

const SUPABASE = process.env.VITE_SUPABASE_URL || 'https://e2e-ficticio.supabase.co'
const PORTA = 4179
const SITE = `http://localhost:${PORTA}`
const SAIDA = 'e2e-saida'
const RE = '90000001'
const SENHA = 'senha-ficticia-123'

const { chromium, devices } = createRequire(import.meta.url)('playwright')
mkdirSync(SAIDA, { recursive: true })

const servidor = spawn('npx', ['vite', 'preview', '--port', String(PORTA), '--strictPort'], { stdio: 'ignore', detached: true })
const encerrar = () => {
  try {
    process.kill(-servidor.pid)
  } catch {
    // já encerrado
  }
}
process.on('exit', encerrar)

async function esperarSite() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${SITE}/login`)).ok) return
    } catch {
      // ainda subindo
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('vite preview não subiu')
}

let passo = 'início'
const etapa = (nome) => {
  passo = nome
  console.log(`• ${nome}`)
}

const browser = await chromium.launch()
const errosJs = []
try {
  await esperarSite()
  const backend = criarBackend({ re: RE, senha: SENHA })
  const contexto = await browser.newContext({ ...devices['Pixel 5'], acceptDownloads: true })
  await backend.ligar(contexto, SUPABASE)
  const page = await contexto.newPage()
  page.on('pageerror', (e) => errosJs.push(e.message))
  page.on('dialog', (d) => d.accept())

  etapa('login com RE e senha')
  await page.goto(`${SITE}/login`)
  await page.getByLabel('Matrícula (RE)').fill(RE)
  await page.getByLabel('Senha').fill(SENHA)
  await page.getByRole('button', { name: 'Entrar' }).click()

  etapa('aceitar a política de uso')
  await page.getByLabel('Li e aceito a política de uso').check()
  await page.getByRole('button', { name: 'Aceitar e continuar' }).click()

  etapa('criar uma corretiva')
  await page.getByRole('button', { name: /Nova corretiva/ }).or(page.getByRole('link', { name: /Nova corretiva/ })).click()
  await page.getByText('Estação Ficticia').waitFor() // formulário e listas carregados
  await page.waitForLoadState('networkidle')
  const titulo = page.getByPlaceholder(/Falha no reset/)
  await titulo.fill('Falha fictícia no contador de eixos')
  await page.getByRole('button', { name: 'Não realizada', exact: true }).click()
  await page.getByPlaceholder(/Sem liberação do CCO/).fill('Sem liberação do CCO (teste fictício)')
  await page.locator('label.pessoa', { hasText: 'Técnico Teste Um' }).click()
  await page.getByRole('button', { name: 'Estação Ficticia' }).click()
  await page.getByRole('button', { name: 'Sinalização' }).click()
  if ((await titulo.inputValue()) !== 'Falha fictícia no contador de eixos') throw new Error('o título digitado se perdeu')
  await page.screenshot({ path: `${SAIDA}/1-formulario.png` })

  etapa('enviar')
  await page.getByRole('button', { name: 'Enviar', exact: true }).click()
  await page.getByText(/enviad/i).first().waitFor()
  if (backend.db.atividades?.length !== 1) throw new Error('a atividade não chegou ao servidor')

  etapa('gerar o PDF do relatório')
  await page.goto(`${SITE}/relatorio`)
  const [arquivo] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.getByRole('button', { name: 'PDF', exact: true }).first().click(),
  ])
  await arquivo.saveAs(`${SAIDA}/${arquivo.suggestedFilename()}`)
  if (!backend.db.documentos?.length) throw new Error('o PDF não foi registrado em documentos')
  if (![...backend.arquivos.keys()].some((k) => k.startsWith('documentos/'))) throw new Error('o PDF não foi guardado no Storage')

  etapa('ver o PDF em Documentos')
  await page.goto(`${SITE}/documentos`)
  await page.getByText(arquivo.suggestedFilename()).waitFor()
  await page.screenshot({ path: `${SAIDA}/2-documentos.png`, fullPage: true })

  if (errosJs.length) throw new Error(`erros de JavaScript: ${errosJs.join(' | ')}`)
  console.log(`OK: ponta a ponta passou (${arquivo.suggestedFilename()}).`)
} catch (e) {
  console.error(`FALHOU no passo "${passo}": ${e.message}`)
  const pagina = browser.contexts()[0]?.pages()[0]
  if (pagina) await pagina.screenshot({ path: `${SAIDA}/falha.png`, fullPage: true }).catch(() => {})
  process.exitCode = 1
} finally {
  await browser.close()
  encerrar()
  process.exit()
}
