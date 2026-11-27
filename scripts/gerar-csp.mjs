#!/usr/bin/env node
// Grava dist/_headers com a Content-Security-Policy do site (a Netlify junta com os headers do netlify.toml).
// O app só carrega código do próprio site e só conversa com o Supabase do ambiente que está sendo publicado
// (homologação ou produção), lido de VITE_SUPABASE_URL no momento do build.
import { writeFileSync } from 'node:fs'

/** Monta a política a partir da URL do Supabase. Sem URL válida, aceita qualquer projeto *.supabase.co. */
export function montarCsp(supabaseUrl) {
  let https = 'https://*.supabase.co'
  let wss = 'wss://*.supabase.co'
  try {
    const u = new URL(supabaseUrl)
    if (u.protocol === 'https:') {
      https = u.origin
      wss = `wss://${u.host}`
    }
  } catch {
    // mantém o curinga
  }
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    // fotos e assinatura vêm do Storage por URL assinada; miniaturas locais são blob:
    `img-src 'self' blob: data: ${https}`,
    `connect-src 'self' ${https} ${wss}`,
    "font-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const csp = montarCsp(process.env.VITE_SUPABASE_URL)
  writeFileSync('dist/_headers', `/*\n  Content-Security-Policy: ${csp}\n`)
  console.log(`dist/_headers: ${csp}`)
}
