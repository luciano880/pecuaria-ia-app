import { useState, useEffect, createContext, useContext } from 'react'
import { supabase } from '../utils/supabase.js'
import { soDigitos, cpfValido, normalizarEmail, statusTrial } from '../utils/trial.js'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [perfil,  setPerfil]  = useState(null)  // { segmento, nome, fazenda, cpf, plano, trial_fim, ... }
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

  // ── Cadastro com CPF único + trial de 14 dias ──────────────
  async function cadastrar(email, senha, nome, fazenda, segmento, cpf) {
    const cpfLimpo = soDigitos(cpf)

    // 1) Valida o CPF localmente
    if (!cpfValido(cpfLimpo)) {
      throw new Error('CPF inválido. Confira os números.')
    }

    // 2) Esse CPF já usou trial alguma vez? (barra reuso do período grátis)
    const { data: jaUsou } = await supabase
      .from('trials_usados')
      .select('cpf')
      .eq('cpf', cpfLimpo)
      .maybeSingle()
    if (jaUsou) {
      throw new Error('Este CPF já utilizou o período de teste gratuito. Faça login ou assine um plano.')
    }

    // 3) Cria o usuário no Supabase Auth
    const emailNorm = normalizarEmail(email)
    const { data, error } = await supabase.auth.signUp({ email: emailNorm, password: senha })
    if (error) {
      if (error.message?.toLowerCase().includes('already'))
        throw new Error('Este e-mail já está cadastrado. Faça login.')
      throw error
    }

    // 4) Cria o perfil com CPF + trial (o trigger do banco registra o CPF em trials_usados)
    if (data.user) {
      const agora = new Date()
      const fim = new Date(agora.getTime() + 14 * 24 * 60 * 60 * 1000)

      let tentativas = 0
      let perfilCriado = false
      while (tentativas < 3 && !perfilCriado) {
        const { error: perfilError } = await supabase.from('perfis').upsert({
          id: data.user.id,
          email: emailNorm,
          nome, fazenda, segmento,
          cpf: cpfLimpo,
          plano: 'trial',
          trial_iniciado_em: agora.toISOString(),
          trial_fim: fim.toISOString(),
          assinatura_ativa: false,
        })
        if (!perfilError) {
          perfilCriado = true
        } else if (perfilError.code === '23505') {
          // violação de unicidade = CPF já existe em outra conta
          throw new Error('Este CPF já está cadastrado em outra conta.')
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
      email: normalizarEmail(email),
      options: { shouldCreateUser: false },
    })
    if (error) throw error
  }

  async function verificarOTP(email, token) {
    const { error } = await supabase.auth.verifyOtp({
      email: normalizarEmail(email), token, type: 'email',
    })
    if (error) throw error
  }

  async function redefinirSenha(novaSenha) {
    const { error } = await supabase.auth.updateUser({ password: novaSenha })
    if (error) throw error
  }

  // Status do trial para uso em toda a aplicação
  const trial = statusTrial(perfil)

  return (
    <AuthCtx.Provider value={{
      user, perfil, loading,
      login, cadastrar, logout,
      enviarOTP, verificarOTP, redefinirSenha,
      carregarPerfil, setPerfil,
      trial,                         // { estado, diasRestantes, bloqueado }
    }}>
      {children}
    </AuthCtx.Provider>
  )
}

export function useAuth() {
  return useContext(AuthCtx)
}
