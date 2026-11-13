// src/utils/trial.js
// Validação de CPF, normalização de e-mail e status do trial

// ── CPF ─────────────────────────────────────────────────────
// Remove tudo que não é dígito
export function soDigitos(v = '') {
  return String(v).replace(/\D/g, '')
}

// Máscara 000.000.000-00 enquanto digita
export function mascararCPF(v = '') {
  const d = soDigitos(v).slice(0, 11)
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

// Validação oficial dos dígitos verificadores do CPF
export function cpfValido(v = '') {
  const cpf = soDigitos(v)
  if (cpf.length !== 11) return false
  if (/^(\d)\1{10}$/.test(cpf)) return false // todos iguais (111.111...)

  let soma = 0
  for (let i = 0; i < 9; i++) soma += parseInt(cpf[i]) * (10 - i)
  let d1 = 11 - (soma % 11)
  if (d1 >= 10) d1 = 0
  if (d1 !== parseInt(cpf[9])) return false

  soma = 0
  for (let i = 0; i < 10; i++) soma += parseInt(cpf[i]) * (11 - i)
  let d2 = 11 - (soma % 11)
  if (d2 >= 10) d2 = 0
  if (d2 !== parseInt(cpf[10])) return false

  return true
}

// ── E-mail ──────────────────────────────────────────────────
// Normaliza para impedir o truque do Gmail (joao+1@gmail / joao.1@gmail)
export function normalizarEmail(email = '') {
  const e = String(email).trim().toLowerCase()
  const [local, dominio] = e.split('@')
  if (!dominio) return e
  let user = local.split('+')[0]            // remove +alias
  if (dominio === 'gmail.com' || dominio === 'googlemail.com') {
    user = user.replace(/\./g, '')          // pontos não contam no Gmail
  }
  return `${user}@${dominio}`
}

// ── Status do trial (cálculo local, espelha status_trial do banco) ──
export function statusTrial(perfil) {
  if (!perfil) return { estado: 'ativo', diasRestantes: 30, bloqueado: false }
  if (perfil.assinatura_ativa || perfil.plano === 'pro' || perfil.plano === 'premium') {
    return { estado: 'assinante', diasRestantes: null, bloqueado: false }
  }
  const fim = perfil.trial_fim ? new Date(perfil.trial_fim) : null
  if (!fim) return { estado: 'ativo', diasRestantes: 30, bloqueado: false }

  const agora = new Date()
  const ms = fim.getTime() - agora.getTime()
  const dias = Math.ceil(ms / (1000 * 60 * 60 * 24))

  if (ms <= 0) return { estado: 'expirado', diasRestantes: 0, bloqueado: true }
  return { estado: 'ativo', diasRestantes: dias, bloqueado: false }
}
