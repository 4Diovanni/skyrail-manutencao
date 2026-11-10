import { createClient } from '@supabase/supabase-js'
import { env } from './env'

// Só a chave anon (pública). Toda proteção de dados é feita por RLS no banco.
export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
})
