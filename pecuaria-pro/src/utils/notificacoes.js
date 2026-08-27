// Sistema de notificações locais (PWA) - alertas de vacina, cio, parto, revisão
import { supabase } from './supabase.js'

const PERM_KEY = 'pecuaria_notif_permitida'
const ULTIMA_CHECK_KEY = 'pecuaria_ultima_notif_check'

// Pedir permissão de notificação
export async function pedirPermissao() {
  if (!('Notification' in window)) return 'nao_suportado'
  if (Notification.permission === 'granted') {
    localStorage.setItem(PERM_KEY, 'sim')
    return 'granted'
  }
  if (Notification.permission === 'denied') return 'denied'
  const result = await Notification.requestPermission()
  if (result === 'granted') localStorage.setItem(PERM_KEY, 'sim')
  return result
}

export function notificacoesAtivas() {
  return ('Notification' in window) && Notification.permission === 'granted'
}

// Disparar uma notificação
export function notificar(titulo, corpo, tag) {
  if (!notificacoesAtivas()) return
  try {
    // Via service worker (funciona mesmo com app fechado no Android)
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(titulo, {
          body: corpo,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: tag || 'pecuaria',
          vibrate: [200, 100, 200],
          requireInteraction: false,
        })
      })
    } else {
      new Notification(titulo, { body: corpo, icon: '/icon-192.png', tag })
    }
  } catch (e) {
    console.log('Erro ao notificar:', e)
  }
}

// Verificar alertas pendentes e notificar (roda 1x por dia)
export async function verificarAlertas(userId, segmento) {
  if (!notificacoesAtivas() || !userId) return

  // Só verifica 1x por dia
  const hoje = new Date().toISOString().slice(0, 10)
  const ultimaCheck = localStorage.getItem(ULTIMA_CHECK_KEY)
  if (ultimaCheck === hoje) return
  localStorage.setItem(ULTIMA_CHECK_KEY, hoje)

  const hj = new Date()
  const em7dias = new Date(hj.getTime() + 7 * 86400000).toISOString().slice(0, 10)
  const hojeStr = hj.toISOString().slice(0, 10)

  try {
    // 1. Vacinas/vermífugos próximos (próxima dose em até 7 dias)
    const { data: vacinas } = await supabase
      .from('vacinacoes').select('*')
      .eq('user_id', userId).eq('segmento', segmento)
      .gte('proxima_dose', hojeStr).lte('proxima_dose', em7dias)
    if (vacinas?.length) {
      notificar(
        `💉 ${vacinas.length} vacina(s) próxima(s)`,
        `Você tem vacinações programadas nos próximos 7 dias.`,
        'vacinas'
      )
    }

    // 2. Partos previstos (reprodução com previsão próxima)
    const { data: repro } = await supabase
      .from('reproducao').select('*')
      .eq('user_id', userId).eq('segmento', segmento)
      .in('tipo', ['cobertura', 'iatf'])
    if (repro?.length) {
      const gestacao = segmento?.includes('ovino') ? 147 : segmento?.includes('caprino') ? 150 : 283
      const partosProximos = repro.filter(r => {
        if (!r.data_evento) return false
        const previsao = new Date(new Date(r.data_evento).getTime() + gestacao * 86400000)
        const diasAte = Math.ceil((previsao - hj) / 86400000)
        return diasAte >= 0 && diasAte <= 7
      })
      if (partosProximos.length) {
        notificar(
          `🐄 ${partosProximos.length} parto(s) previsto(s)`,
          `Fêmeas com parto previsto nos próximos 7 dias. Prepare a maternidade.`,
          'partos'
        )
      }
    }

    // 3. Fim de carência de medicamentos (leite/carne liberado)
    const { data: aplicacoes } = await supabase
      .from('aplicacoes').select('*')
      .eq('user_id', userId).eq('segmento', segmento)
      .eq('fim_carencia_leite', hojeStr)
    if (aplicacoes?.length) {
      notificar(
        `✅ Carência encerrada`,
        `${aplicacoes.length} animal(is) com leite/carne liberado para comercialização hoje.`,
        'carencia'
      )
    }

    // 4. Revisão de máquinas próxima
    const { data: maquinas } = await supabase
      .from('maquinas').select('*')
      .eq('user_id', userId).eq('segmento', segmento)
    if (maquinas?.length) {
      const revisaoProxima = maquinas.filter(m => {
        if (m.proxima_revisao_horas && m.horimetro_atual >= m.proxima_revisao_horas - 20) return true
        return false
      })
      if (revisaoProxima.length) {
        notificar(
          `🚜 Revisão de máquina`,
          `${revisaoProxima.length} máquina(s) precisam de revisão em breve.`,
          'maquinas'
        )
      }
    }
  } catch (e) {
    console.log('Erro ao verificar alertas:', e)
  }
}

// Iniciar verificação periódica
export function iniciarVerificacaoAlertas(userId, segmento) {
  if (!notificacoesAtivas()) return
  // Verificar ao abrir
  setTimeout(() => verificarAlertas(userId, segmento), 3000)
  // Verificar a cada 6 horas se app ficar aberto
  const interval = setInterval(() => verificarAlertas(userId, segmento), 6 * 3600 * 1000)
  return () => clearInterval(interval)
}
