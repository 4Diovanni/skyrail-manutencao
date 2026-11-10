#!/usr/bin/env node
// Cria (ou reativa) um usuário do app pelo RE, com senha provisória aleatória.
// Roda só na máquina do admin. A service_role key vem do ambiente e NUNCA vai para o repositório.
//
// Uso:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... LOGIN_DOMAIN=l17.local \
//     npm run criar-usuario -- --re 53000000 --nome "Nome Sobrenome" [--perfil tecnico|supervisor|admin]
import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, v, i, arr) => (v.startsWith('--') ? [...acc, [v.slice(2), arr[i + 1]]] : acc), []),
)
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
const dominio = process.env.LOGIN_DOMAIN || 'l17.local'
const perfil = args.perfil || 'tecnico'

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.')
if (!/^[0-9]{4,12}$/.test(args.re || '')) throw new Error('Informe --re com a matrícula (só números).')
if (!args.nome) throw new Error('Informe --nome.')
if (!['tecnico', 'supervisor', 'admin'].includes(perfil)) throw new Error('Perfil inválido.')

// Senha provisória aleatória (nunca uma senha padrão igual para todos).
const senha = randomBytes(9).toString('base64url') + '7a'
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const { data, error } = await sb.auth.admin.createUser({
  email: `${args.re}@${dominio}`,
  password: senha,
  email_confirm: true,
})
if (error) throw error

const { error: e2 } = await sb
  .from('profiles')
  .update({ nome: args.nome, matricula: args.re, perfil, ativo: true, deve_trocar_senha: true })
  .eq('id', data.user.id)
if (e2) throw e2

console.log(`Usuário criado: RE ${args.re} (${perfil}).`)
console.log(`Senha provisória (entregue pessoalmente; a troca é obrigatória no 1º acesso): ${senha}`)
