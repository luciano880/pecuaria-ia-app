// Fila de operações offline - salva localmente e sincroniza quando volta a internet
import { supabase } from './supabase.js'

const QUEUE_KEY = 'pecuaria_offline_queue'

// Ler fila do localStorage
export function getFila() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
  } catch { return [] }
}

// Salvar fila
function salvarFila(fila) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(fila))
}

// Adicionar operação à fila
export function enfileirar(op) {
  const fila = getFila()
  fila.push({ ...op, id_temp: `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`, criado_em: new Date().toISOString() })
  salvarFila(fila)
  return fila[fila.length - 1]
}

// Quantidade de operações pendentes
export function contarPendentes() {
  return getFila().length
}

// Verificar se está online
export function estaOnline() {
  return navigator.onLine
}

// Sincronizar toda a fila com o Supabase
export async function sincronizar() {
  if (!navigator.onLine) return { ok: false, motivo: 'offline' }
  const fila = getFila()
  if (fila.length === 0) return { ok: true, sincronizados: 0 }

  let sincronizados = 0
  const restantes = []

  for (const op of fila) {
    try {
      if (op.tipo === 'insert') {
        const { error } = await supabase.from(op.tabela).insert(op.dados)
        if (error) throw error
      } else if (op.tipo === 'update') {
        const { error } = await supabase.from(op.tabela).update(op.dados).eq('id', op.registro_id).eq('user_id', op.dados.user_id)
        if (error) throw error
      } else if (op.tipo === 'delete') {
        const { error } = await supabase.from(op.tabela).delete().eq('id', op.registro_id).eq('user_id', op.user_id)
        if (error) throw error
      }
      sincronizados++
    } catch (e) {
      // Se falhar, mantém na fila para tentar depois
      restantes.push(op)
    }
  }

  salvarFila(restantes)
  return { ok: true, sincronizados, restantes: restantes.length }
}

// Auto-sincronizar quando a internet voltar
let sincronizando = false
export function iniciarAutoSync(onSync) {
  const tentar = async () => {
    if (sincronizando || !navigator.onLine) return
    sincronizando = true
    const res = await sincronizar()
    sincronizando = false
    if (res.sincronizados > 0 && onSync) onSync(res)
  }

  window.addEventListener('online', tentar)
  // Tentar a cada 30 segundos se houver pendências
  setInterval(tentar, 30000)
  // Tentar ao iniciar
  tentar()

  return () => window.removeEventListener('online', tentar)
}
