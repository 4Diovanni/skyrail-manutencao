import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { problemasSenha } from './credenciais'

export function TrocarSenhaPage() {
  const { perfil, recarregarPerfil } = useAuth()
  const navigate = useNavigate()
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [erros, setErros] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const p = problemasSenha(senha, perfil?.matricula)
    if (senha !== confirma) p.push('As duas senhas não são iguais.')
    setErros(p)
    if (p.length) return
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    if (error) {
      setErros(['Não foi possível trocar a senha. Tente de novo.'])
      setBusy(false)
      return
    }
    await supabase.rpc('concluir_troca_senha')
    await recarregarPerfil()
    setBusy(false)
    navigate('/', { replace: true })
  }

  return (
    <main className="login">
      <h1>Crie a sua senha</h1>
      <p className="hint">
        {perfil?.deve_trocar_senha
          ? 'Este é o seu primeiro acesso. Troque a senha provisória por uma senha só sua.'
          : 'Escolha uma nova senha.'}
      </p>
      <form onSubmit={onSubmit}>
        <label>
          Nova senha
          <input type="password" autoComplete="new-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
        </label>
        <label>
          Repita a nova senha
          <input type="password" autoComplete="new-password" required value={confirma} onChange={(e) => setConfirma(e.target.value)} />
        </label>
        {erros.map((m) => (
          <p key={m} role="alert" className="error">{m}</p>
        ))}
        <button type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Salvar senha'}</button>
      </form>
    </main>
  )
}
