import { useState } from 'react'
import { useAuth } from '../hooks/useAuth.jsx'
import { C } from '../utils/helpers.js'

// ── Telas possíveis: 'login' | 'cadastro' | 'recuperar' | 'otp' | 'nova_senha'
export default function AuthPage() {
  const [tela, setTela] = useState('login')
  const [emailOTP, setEmailOTP] = useState('')

  return (
    <div style={{
      minHeight: '100vh',
      background: C.bg,
      backgroundImage: 'radial-gradient(ellipse 80% 60% at 50% -10%, #1A3A0D 0%, transparent 70%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
    }}>
      {/* Painel central */}
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 52, marginBottom: 10 }}>🐄</div>
          <h1 style={{
            color: C.texto, fontSize: 26, fontWeight: 800,
            letterSpacing: '-0.5px', marginBottom: 6,
          }}>PecuáriaIA</h1>
          <p style={{ color: C.textoMuted, fontSize: 13 }}>
            Gestão inteligente de rebanhos
          </p>
        </div>

        {/* Card de formulário */}
        <div style={{
          background: C.bgCard,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          padding: '28px 28px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}>
          {tela === 'login'      && <TelaLogin    setTela={setTela} setEmailOTP={setEmailOTP} />}
          {tela === 'cadastro'   && <TelaCadastro  setTela={setTela} />}
          {tela === 'recuperar'  && <TelaRecuperar setTela={setTela} setEmailOTP={setEmailOTP} />}
          {tela === 'otp'        && <TelaOTP       setTela={setTela} emailOTP={emailOTP} />}
          {tela === 'nova_senha' && <TelaNovaSenha setTela={setTela} />}
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: C.textoMuted, marginTop: 20 }}>
          Dados protegidos por Supabase · Brasil 2026
        </p>
      </div>
    </div>
  )
}

// ── Componentes de campo reutilizáveis ─────────────────────────────────────
function Campo({ label, type = 'text', value, onChange, placeholder, autoComplete }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{
        display: 'block', fontSize: 11, fontWeight: 600,
        color: C.textoSub, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px',
      }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        style={{
          width: '100%', padding: '11px 14px',
          background: C.bgInput, border: `1.5px solid ${C.border}`,
          borderRadius: 8, color: C.texto, fontSize: 14,
          transition: 'border-color 0.15s',
        }}
        onFocus={e => e.target.style.borderColor = C.verdeClaro}
        onBlur={e  => e.target.style.borderColor = C.border}
      />
    </div>
  )
}

function Btn({ children, onClick, loading, cor = C.verde, tipo = 'button' }) {
  return (
    <button
      type={tipo}
      onClick={onClick}
      disabled={loading}
      style={{
        width: '100%', padding: '13px 0', borderRadius: 9, border: 'none',
        background: loading ? C.border : cor,
        color: '#fff', fontWeight: 700, fontSize: 14,
        cursor: loading ? 'not-allowed' : 'pointer',
        transition: 'opacity 0.15s',
        marginTop: 6,
      }}
    >
      {loading ? '⏳ Aguarde...' : children}
    </button>
  )
}

function Erro({ msg }) {
  if (!msg) return null
  return (
    <div style={{
      background: `${C.terracota}22`, border: `1px solid ${C.terracota}`,
      borderRadius: 7, padding: '9px 12px', fontSize: 13,
      color: '#F08070', marginBottom: 14,
    }}>⚠️ {msg}</div>
  )
}

function Sucesso({ msg }) {
  if (!msg) return null
  return (
    <div style={{
      background: `${C.verde}22`, border: `1px solid ${C.verde}`,
      borderRadius: 7, padding: '9px 12px', fontSize: 13,
      color: C.verdeVivo, marginBottom: 14,
    }}>✅ {msg}</div>
  )
}

function Link({ onClick, children }) {
  return (
    <span
      onClick={onClick}
      style={{ color: C.ambar, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
    >{children}</span>
  )
}

// ── Tela Login ─────────────────────────────────────────────────────────────
function TelaLogin({ setTela, setEmailOTP }) {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro,  setErro]  = useState('')
  const [load,  setLoad]  = useState(false)

  async function entrar() {
    setErro('')
    if (!email || !senha) { setErro('Preencha e-mail e senha.'); return }
    setLoad(true)
    try { await login(email, senha) }
    catch (e) { setErro('E-mail ou senha incorretos.') }
    finally { setLoad(false) }
  }

  return (
    <>
      <h2 style={{ color: C.texto, fontSize: 18, fontWeight: 700, marginBottom: 22 }}>
        Entrar na conta
      </h2>
      <Erro msg={erro} />
      <Campo label="E-mail" type="email" value={email} onChange={setEmail}
        placeholder="seu@email.com" autoComplete="email" />
      <Campo label="Senha" type="password" value={senha} onChange={setSenha}
        placeholder="••••••••" autoComplete="current-password" />
      <div style={{ textAlign: 'right', marginBottom: 16, marginTop: -6 }}>
        <Link onClick={() => { setEmailOTP(email); setTela('recuperar') }}>
          Esqueci a senha
        </Link>
      </div>
      <Btn onClick={entrar} loading={load} cor={C.verde}>Entrar</Btn>
      <p style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: C.textoMuted }}>
        Não tem conta?{' '}
        <Link onClick={() => setTela('cadastro')}>Criar conta</Link>
      </p>
    </>
  )
}

// ── Tela Cadastro ──────────────────────────────────────────────────────────
function TelaCadastro({ setTela }) {
  const { cadastrar } = useAuth()
  const [nome,      setNome]      = useState('')
  const [fazenda,   setFazenda]   = useState('')
  const [segmento,  setSegmento]  = useState('')
  const [email,     setEmail]     = useState('')
  const [senha,     setSenha]     = useState('')
  const [confirma,  setConfirma]  = useState('')
  const [erro,      setErro]      = useState('')
  const [load,      setLoad]      = useState(false)

  async function criar() {
    setErro('')
    if (!nome || !fazenda || !segmento || !email || !senha)
      return setErro('Preencha todos os campos.')
    if (senha.length < 6)
      return setErro('Senha deve ter ao menos 6 caracteres.')
    if (senha !== confirma)
      return setErro('As senhas não coincidem.')
    setLoad(true)
    try {
      await cadastrar(email, senha, nome, fazenda, segmento)
    } catch (e) {
      setErro(e.message || 'Erro ao criar conta.')
    } finally {
      setLoad(false)
    }
  }

  return (
    <>
      <h2 style={{ color: C.texto, fontSize: 18, fontWeight: 700, marginBottom: 22 }}>
        Criar conta
      </h2>
      <Erro msg={erro} />
      <Campo label="Seu nome" value={nome} onChange={setNome} placeholder="João da Silva" />
      <Campo label="Nome da fazenda" value={fazenda} onChange={setFazenda} placeholder="Fazenda São João" />

      {/* Seletor de segmento */}
      <div style={{ marginBottom: 14 }}>
        <label style={{
          display: 'block', fontSize: 11, fontWeight: 600, color: C.textoSub,
          marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px',
        }}>Segmento da propriedade</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { val: 'leite', icon: '🥛', label: 'Pecuária Leiteira', cor: C.leitePrimary, acc: C.leiteAccent },
            { val: 'corte', icon: '🥩', label: 'Pecuária de Corte', cor: C.cortePrimary, acc: C.corteAccent },
          ].map(s => (
            <button
              key={s.val}
              type="button"
              onClick={() => setSegmento(s.val)}
              style={{
                padding: '12px 8px', borderRadius: 9,
                border: `2px solid ${segmento === s.val ? s.acc : C.border}`,
                background: segmento === s.val ? `${s.cor}44` : C.bgInput,
                color: segmento === s.val ? s.acc : C.textoSub,
                fontWeight: 700, fontSize: 12, cursor: 'pointer',
                transition: 'all 0.15s', textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 22, marginBottom: 4 }}>{s.icon}</div>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <Campo label="E-mail" type="email" value={email} onChange={setEmail} placeholder="seu@email.com" />
      <Campo label="Senha" type="password" value={senha} onChange={setSenha} placeholder="Min. 6 caracteres" />
      <Campo label="Confirmar senha" type="password" value={confirma} onChange={setConfirma} placeholder="Repita a senha" />

      <Btn onClick={criar} loading={load} cor={C.verde}>Criar conta</Btn>
      <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: C.textoMuted }}>
        Já tem conta?{' '}
        <Link onClick={() => setTela('login')}>Entrar</Link>
      </p>
    </>
  )
}

// ── Tela Recuperar senha ───────────────────────────────────────────────────
function TelaRecuperar({ setTela, setEmailOTP }) {
  const { enviarOTP } = useAuth()
  const [email, setEmail] = useState('')
  const [erro,  setErro]  = useState('')
  const [ok,    setOk]    = useState('')
  const [load,  setLoad]  = useState(false)

  async function enviar() {
    setErro(''); setOk('')
    if (!email) return setErro('Informe o e-mail cadastrado.')
    setLoad(true)
    try {
      await enviarOTP(email)
      setEmailOTP(email)
      setOk('Código enviado! Verifique sua caixa de entrada.')
      setTimeout(() => setTela('otp'), 1800)
    } catch (e) {
      setErro('E-mail não encontrado ou erro ao enviar.')
    } finally {
      setLoad(false)
    }
  }

  return (
    <>
      <h2 style={{ color: C.texto, fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
        Recuperar senha
      </h2>
      <p style={{ color: C.textoMuted, fontSize: 13, marginBottom: 22 }}>
        Enviaremos um código OTP de 6 dígitos para o seu e-mail.
      </p>
      <Erro msg={erro} />
      <Sucesso msg={ok} />
      <Campo label="E-mail cadastrado" type="email" value={email} onChange={setEmail}
        placeholder="seu@email.com" />
      <Btn onClick={enviar} loading={load} cor={C.ambar}>Enviar código OTP</Btn>
      <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: C.textoMuted }}>
        <Link onClick={() => setTela('login')}>← Voltar ao login</Link>
      </p>
    </>
  )
}

// ── Tela OTP ───────────────────────────────────────────────────────────────
function TelaOTP({ setTela, emailOTP }) {
  const { verificarOTP } = useAuth()
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [erro,   setErro]   = useState('')
  const [load,   setLoad]   = useState(false)

  function handleDigit(i, val) {
    if (!/^\d?$/.test(val)) return
    const novo = [...digits]
    novo[i] = val
    setDigits(novo)
    if (val && i < 5) document.getElementById(`otp-${i + 1}`)?.focus()
  }

  function handleKey(i, e) {
    if (e.key === 'Backspace' && !digits[i] && i > 0)
      document.getElementById(`otp-${i - 1}`)?.focus()
  }

  async function verificar() {
    const token = digits.join('')
    if (token.length < 6) { setErro('Digite o código completo de 6 dígitos.'); return }
    setErro(''); setLoad(true)
    try {
      await verificarOTP(emailOTP, token)
      setTela('nova_senha')
    } catch (e) {
      setErro('Código inválido ou expirado. Solicite um novo.')
    } finally {
      setLoad(false)
    }
  }

  return (
    <>
      <h2 style={{ color: C.texto, fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
        Verificar código
      </h2>
      <p style={{ color: C.textoMuted, fontSize: 13, marginBottom: 24 }}>
        Código enviado para <strong style={{ color: C.texto }}>{emailOTP}</strong>
      </p>
      <Erro msg={erro} />

      {/* Campos OTP individuais */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 24 }}>
        {digits.map((d, i) => (
          <input
            key={i}
            id={`otp-${i}`}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={e => handleDigit(i, e.target.value)}
            onKeyDown={e => handleKey(i, e)}
            style={{
              width: 48, height: 56,
              textAlign: 'center',
              fontSize: 22, fontWeight: 700,
              fontFamily: "'JetBrains Mono', monospace",
              background: C.bgInput,
              border: `2px solid ${d ? C.ambar : C.border}`,
              borderRadius: 10,
              color: C.texto,
              transition: 'border-color 0.15s',
            }}
          />
        ))}
      </div>

      <Btn onClick={verificar} loading={load} cor={C.ambar}>Verificar código</Btn>
      <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: C.textoMuted }}>
        Não recebeu?{' '}
        <Link onClick={() => setTela('recuperar')}>Reenviar código</Link>
      </p>
    </>
  )
}

// ── Tela Nova Senha ────────────────────────────────────────────────────────
function TelaNovaSenha({ setTela }) {
  const { redefinirSenha } = useAuth()
  const [senha,    setSenha]    = useState('')
  const [confirma, setConfirma] = useState('')
  const [erro,     setErro]     = useState('')
  const [ok,       setOk]       = useState('')
  const [load,     setLoad]     = useState(false)

  async function salvar() {
    setErro(''); setOk('')
    if (senha.length < 6) return setErro('Senha deve ter ao menos 6 caracteres.')
    if (senha !== confirma) return setErro('As senhas não coincidem.')
    setLoad(true)
    try {
      await redefinirSenha(senha)
      setOk('Senha redefinida com sucesso!')
      setTimeout(() => setTela('login'), 1800)
    } catch (e) {
      setErro('Erro ao redefinir senha. Tente novamente.')
    } finally {
      setLoad(false)
    }
  }

  return (
    <>
      <h2 style={{ color: C.texto, fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
        Nova senha
      </h2>
      <p style={{ color: C.textoMuted, fontSize: 13, marginBottom: 22 }}>
        Escolha uma nova senha para sua conta.
      </p>
      <Erro msg={erro} />
      <Sucesso msg={ok} />
      <Campo label="Nova senha" type="password" value={senha} onChange={setSenha}
        placeholder="Min. 6 caracteres" />
      <Campo label="Confirmar senha" type="password" value={confirma} onChange={setConfirma}
        placeholder="Repita a nova senha" />
      <Btn onClick={salvar} loading={load} cor={C.verde}>Salvar nova senha</Btn>
    </>
  )
}
