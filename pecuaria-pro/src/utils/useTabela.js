import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'

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
    const { data, error } = await supabase
      .from(tabela).insert({ ...registro, user_id: user.id }).select().single()
    if (error) throw error
    setDados(prev => [data, ...prev])
    return data
  }

  async function atualizar(id, registro) {
    const { data, error } = await supabase
      .from(tabela).update(registro).eq('id', id).eq('user_id', user.id).select().single()
    if (error) throw error
    setDados(prev => prev.map(r => r.id === id ? data : r))
    return data
  }

  async function remover(id) {
    const { error } = await supabase
      .from(tabela).delete().eq('id', id).eq('user_id', user.id)
    if (error) throw error
    setDados(prev => prev.filter(r => r.id !== id))
  }

  return { dados, loading, erro, carregar, inserir, atualizar, remover }
}
