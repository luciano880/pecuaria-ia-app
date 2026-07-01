import { useState, useEffect, createContext, useContext } from 'react'
import { supabase } from '../utils/supabase.js'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [perfil,  setPerfil]  = useState(null)  // { segmento: 'leite'|'corte', nome, fazenda }
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      if (data.session?.user) carregarPerfil(data.session.user.id)
      else setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_ev, session) => {
      setUser(session?.user ?? null)
      if (session?.user) carregarPerfil(session.user.id)
      else { setPerfil(null); setLoading(false) }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  async function carregarPerfil(uid) {
    let { data } = await supabase
      .from('perfis')
      .select('*')
      .eq('id', uid)
      .single()

    // Rede de segurança: se não existe perfil, cria um padrão automaticamente
    if (!data) {
      const { data: userData } = await supabase.auth.getUser()
      const email = userData?.user?.email || ''
      const { data: novoPerfil } = await supabase
        .from('perfis')
        .insert({
          id: uid,
          email,
          nome: email.split('@')[0] || 'Produtor',
          fazenda: 'Minha Fazenda',
          segmento: 'leite',
        })
        .select()
        .single()
      data = novoPerfil
    }

    setPerfil(data)
    setLoading(false)
  }

  async function login(email, senha) {
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) throw error
  }

  async function cadastrar(email, senha, nome, fazenda, segmento) {
    const { data, error } = await supabase.auth.signUp({ email, password: senha })
    if (error) throw error

    if (data.user) {
      // Tenta criar o perfil. Se a sessão ainda não propagou (confirmação de e-mail
      // pendente), tenta novamente algumas vezes antes de desistir.
      let tentativas = 0
      let perfilCriado = false
      while (tentativas < 3 && !perfilCriado) {
        const { error: perfilError } = await supabase.from('perfis').upsert({
          id: data.user.id, email, nome, fazenda, segmento,
        })
        if (!perfilError) {
          perfilCriado = true
        } else {
          tentativas++
          await new Promise(r => setTimeout(r, 500))
        }
      }
      if (!perfilCriado) {
        console.error('Não foi possível criar o perfil após o cadastro')
      }
    }
  }

  async function logout() {
    await supabase.auth.signOut()
  }

  // Recuperação: envia OTP de 6 dígitos por e-mail via Supabase Magic Link / OTP
  async function enviarOTP(email) {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    })
    if (error) throw error
  }

  async function verificarOTP(email, token) {
    const { error } = await supabase.auth.verifyOtp({
      email, token, type: 'email',
    })
    if (error) throw error
  }

  async function redefinirSenha(novaSenha) {
    const { error } = await supabase.auth.updateUser({ password: novaSenha })
    if (error) throw error
  }

  return (
    <AuthCtx.Provider value={{
      user, perfil, loading,
      login, cadastrar, logout,
      enviarOTP, verificarOTP, redefinirSenha,
      carregarPerfil, setPerfil,
    }}>
      {children}
    </AuthCtx.Provider>
  )
}

export function useAuth() {
  return useContext(AuthCtx)
}
