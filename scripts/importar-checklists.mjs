#!/usr/bin/env node
// Importa (ou atualiza) os modelos de checklist das preventivas a partir de supabase/seed/checklists.json.
// Roda só na máquina do admin. A service_role key vem do ambiente e NUNCA vai para o repositório.
// Pode rodar de novo sem problema: modelos com o mesmo id são atualizados e, se o conteúdo
// mudar, a versão do modelo sobe (as preventivas já feitas guardam a versão que usaram).
//
// Uso:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run importar-checklists [-- arquivo.json]
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.')

const arquivo = process.argv[2] || new URL('../supabase/seed/checklists.json', import.meta.url)
const dados = JSON.parse(readFileSync(arquivo, 'utf8'))
if (dados.formato !== 'skyrail-checklists' || !Array.isArray(dados.modelos)) throw new Error('Arquivo não é um pacote de checklists.')

const linhas = dados.modelos.map((m) => ({
  id: m.id,
  sistema: m.sistema,
  sistema_nome: m.sistemaNome,
  sistema_descricao: m.sistemaDescricao ?? null,
  codigo: m.codigo,
  tipo_prev: m.tipoPrev,
  periodicidade: m.periodicidade,
  rotulo: m.rotulo ?? null,
  resumo: m.resumo ?? null,
  formulario: m.formulario ?? null,
  ordem: m.ordem,
  ativo: m.ativo,
  conteudo: m.conteudo,
}))

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
for (let i = 0; i < linhas.length; i += 10) {
  const { error } = await sb.from('checklist_modelos').upsert(linhas.slice(i, i + 10), { onConflict: 'id' })
  if (error) throw error
}
console.log(`${linhas.length} modelos de checklist importados.`)
