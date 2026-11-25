import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { env } from '../lib/env'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { usuarioParaEmail } from './credenciais'

export function LoginPage() {
  const { session } = useAuth()
  const [re, setRe] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const email = usuarioParaEmail(re, env.loginDomain)
    if (!email) {
      setError('Digite a sua matrícula (RE), só números.')
      return
    }
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Matrícula ou senha inválidas.')
    setBusy(false)
  }

  return (
    <main className="login">
      <h1>SkyRail L17 · Manutenção</h1>
      <form onSubmit={onSubmit}>
        <label>
          Matrícula (RE)
          <input inputMode="numeric" autoComplete="username" required value={re} onChange={(e) => setRe(e.target.value)} />
        </label>
        <label>
          Senha
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p role="alert" className="error">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
      </form>
      <p className="hint">Esqueceu a senha? Peça ao administrador para gerar uma nova senha provisória.</p>
      <p className="hint versao-app">Versão {__APP_VERSION__}</p>
    </main>
  )
}
