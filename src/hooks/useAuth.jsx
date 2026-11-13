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

    // Rede de segurança: se não existe perfil, cria usando os dados do cadastro
    // que foram guardados nos metadados do usuário (funciona com confirmação de e-mail).
    if (!data) {
      const { data: userData } = await supabase.auth.getUser()
      const u = userData?.user
      const email = u?.email || ''
      const meta = u?.user_metadata || {}

      const agora = new Date()
      const fim = new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000)

      const { data: novoPerfil } = await supabase
        .from('perfis')
        .insert({
          id: uid,
          email,
          nome: meta.nome || email.split('@')[0] || 'Produtor',
          fazenda: meta.fazenda || 'Minha Fazenda',
          segmento: meta.segmento || 'leite',
          cpf: meta.cpf || null,
          plano: 'trial',
          trial_iniciado_em: agora.toISOString(),
          trial_fim: fim.toISOString(),
          assinatura_ativa: false,
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

  // ── Cadastro com CPF único + trial de 30 dias ──────────────
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

    // 3) Cria o usuário no Supabase Auth, guardando os dados do cadastro nos metadados.
    // Esses metadados são usados para montar o perfil quando a pessoa confirmar o e-mail e entrar.
    const emailNorm = normalizarEmail(email)
    const { data, error } = await supabase.auth.signUp({
      email: emailNorm,
      password: senha,
      options: { data: { nome, fazenda, segmento, cpf: cpfLimpo } },
    })
    if (error) {
      if (error.message?.toLowerCase().includes('already'))
        throw new Error('Este e-mail já está cadastrado. Faça login.')
      throw error
    }

    // 4) Se o cadastro já criou sessão (confirmação de e-mail DESLIGADA), cria o perfil agora.
    //    Se a confirmação estiver LIGADA, não há sessão ainda e o RLS bloquearia o insert —
    //    nesse caso o perfil é criado por carregarPerfil() assim que a pessoa confirmar e entrar.
    const temSessao = !!data.session
    if (data.user && temSessao) {
      const agora = new Date()
      const fim = new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000)
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
      if (perfilError && perfilError.code === '23505') {
        throw new Error('Este CPF já está cadastrado em outra conta.')
      }
    }

    // Informa à tela se precisa confirmar o e-mail (sem sessão = precisa confirmar)
    return { precisaConfirmarEmail: !temSessao }
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
