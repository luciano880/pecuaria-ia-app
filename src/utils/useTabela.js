import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { enfileirar } from './offlineQueue.js'

// Limpa strings vazias para null antes de enviar ao Supabase
function limpar(obj) {
  const r = {}
  for (const [k, v] of Object.entries(obj)) {
    r[k] = (v === '' || v === undefined) ? null : v
  }
  return r
}

export function useTabela(tabela, filtrosExtra = {}) {
  const { user } = useAuth()
  const [dados,    setDados]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [erro,     setErro]     = useState(null)

  const carregar = useCallback(async () => {
    if (!user) return
    setLoading(true)
    let q = supabase.from(tabela).select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    Object.entries(filtrosExtra).forEach(([k, v]) => { q = q.eq(k, v) })
    const { data, error } = await q
    if (error) setErro(error.message)
    else setDados(data || [])
    setLoading(false)
  }, [user, tabela, JSON.stringify(filtrosExtra)])

  useEffect(() => { carregar() }, [carregar])

  async function inserir(registro) {
    const payload = { ...limpar(registro), user_id: user.id }

    // Se offline, enfileirar e adicionar localmente
    if (!navigator.onLine) {
      const op = enfileirar({ tipo: 'insert', tabela, dados: payload })
      const registroLocal = { ...payload, id: op.id_temp, _offline: true, created_at: op.criado_em }
      setDados(prev => [registroLocal, ...prev])
      return registroLocal
    }

    try {
      const { data, error } = await supabase
        .from(tabela).insert(payload).select().single()
      if (error) throw error
      setDados(prev => [data, ...prev])
      return data
    } catch (e) {
      // Se falhar por rede, enfileirar
      if (e.message?.includes('fetch') || e.message?.includes('network')) {
        const op = enfileirar({ tipo: 'insert', tabela, dados: payload })
        const registroLocal = { ...payload, id: op.id_temp, _offline: true, created_at: op.criado_em }
        setDados(prev => [registroLocal, ...prev])
        return registroLocal
      }
      throw e
    }
  }

  async function atualizar(id, registro) {
    const payload = limpar(registro)

    if (!navigator.onLine) {
      enfileirar({ tipo: 'update', tabela, registro_id: id, dados: { ...payload, user_id: user.id } })
      setDados(prev => prev.map(r => r.id === id ? { ...r, ...payload, _offline: true } : r))
      return { ...payload, id }
    }

    try {
      const { data, error } = await supabase
        .from(tabela).update(payload).eq('id', id).eq('user_id', user.id).select().single()
      if (error) throw error
      setDados(prev => prev.map(r => r.id === id ? data : r))
      return data
    } catch (e) {
      if (e.message?.includes('fetch') || e.message?.includes('network')) {
        enfileirar({ tipo: 'update', tabela, registro_id: id, dados: { ...payload, user_id: user.id } })
        setDados(prev => prev.map(r => r.id === id ? { ...r, ...payload, _offline: true } : r))
        return { ...payload, id }
      }
      throw e
    }
  }

  async function remover(id) {
    if (!navigator.onLine) {
      enfileirar({ tipo: 'delete', tabela, registro_id: id, user_id: user.id })
      setDados(prev => prev.filter(r => r.id !== id))
      return
    }

    try {
      const { error } = await supabase
        .from(tabela).delete().eq('id', id).eq('user_id', user.id)
      if (error) throw error
      setDados(prev => prev.filter(r => r.id !== id))
    } catch (e) {
      if (e.message?.includes('fetch') || e.message?.includes('network')) {
        enfileirar({ tipo: 'delete', tabela, registro_id: id, user_id: user.id })
        setDados(prev => prev.filter(r => r.id !== id))
        return
      }
      throw e
    }
  }

  return { dados, loading, erro, carregar, inserir, atualizar, remover }
}
