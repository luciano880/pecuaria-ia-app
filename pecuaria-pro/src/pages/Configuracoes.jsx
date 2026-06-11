import { useState } from 'react'
import { supabase } from '../utils/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { C } from '../utils/helpers.js'
import { Secao, Campo, Grid, Btn, useToast } from '../components/UI.jsx'

export default function Configuracoes() {
  const auth = useAuth()
  const user = auth.user
  const perfil = auth.perfil
  const { toast, ToastContainer } = useToast()
  const [nome,     setNome]     = useState(perfil?.nome     || '')
  const [fazenda,  setFazenda]  = useState(perfil?.fazenda  || '')
  const [segmento, setSegmento] = useState(perfil?.segmento || 'leite')
  const [salvando, setSalvando] = useState(false)
  const [novaSenha,     setNovaSenha]     = useState('')
  const [confirmaSenha, setConfirmaSenha] = useState('')
  const [salvandoSenha, setSalvandoSenha] = useState(false)

  async function salvarPerfil() {
    setSalvando(true)
    try {
      const { error } = await supabase
        .from('perfis')
        .update({ nome, fazenda, segmento })
        .eq('id', user.id)
      if (error) throw error
      toast('Salvo! Recarregando...')
      setTimeout(() => window.location.href = '/', 1500)
    } catch (e) {
      toast(e.message, 'erro')
    } finally {
      setSalvando(false)
    }
  }

  async function alterarSenha() {
    if (novaSenha.length < 6) { toast('Senha deve ter ao menos 6 caracteres', 'erro'); return }
    if (novaSenha !== confirmaSenha) { toast('Senhas nao coincidem', 'erro'); return }
    setSalvandoSenha(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: novaSenha })
      if (error) throw error
      toast('Senha alterada!')
      setNovaSenha(''); setConfirmaSenha('')
    } catch (e) { toast(e.message, 'erro') }
    finally { setSalvandoSenha(false) }
  }

  const segOpts = [
    { value:'leite', icon:'🥛', label:'Pecuaria Leiteira', cor: C.leitePrimary, acc: C.leiteAccent },
    { value:'corte', icon:'🥩', label:'Pecuaria de Corte',  cor: C.cortePrimary, acc: C.corteAccent },
  ]

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <ToastContainer />
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: C.texto }}>Configuracoes</h2>
      </div>
      <Secao titulo="Dados da Fazenda" icon="🏡" cor={C.verdeClaro}>
        <Grid cols={2}>
          <Campo label="Seu nome" value={nome} onChange={setNome} />
          <Campo label="Nome da fazenda" value={fazenda} onChange={setFazenda} />
        </Grid>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display:'block', fontSize:11, color:C.textoSub, marginBottom:8, fontWeight:600, textTransform:'uppercase' }}>
            Segmento
          </label>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {segOpts.map(s => (
              <button key={s.value} onClick={() => setSegmento(s.value)} style={{
                padding:'16px 12px', borderRadius:10,
                border: segmento===s.value ? '2px solid '+s.acc : '2px solid '+C.border,
                background: segmento===s.value ? s.cor+'44' : C.bgInput,
                color: segmento===s.value ? s.acc : C.textoSub,
                fontWeight:700, fontSize:13, cursor:'pointer', textAlign:'center',
              }}>
                <div style={{ fontSize:28, marginBottom:6 }}>{s.icon}</div>
                {s.label}
                {segmento===s.value && <div style={{ fontSize:11, marginTop:4 }}>Selecionado</div>}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end' }}>
          <Btn cor={C.verde} onClick={salvarPerfil} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar perfil'}
          </Btn>
        </div>
      </Secao>
      <Secao titulo="Alterar Senha" icon="🔒" cor={C.ambar}>
        <Campo label="Nova senha" type="password" value={novaSenha} onChange={setNovaSenha} placeholder="Min. 6 caracteres" />
        <Campo label="Confirmar senha" type="password" value={confirmaSenha} onChange={setConfirmaSenha} placeholder="Repita" />
        <div style={{ display:'flex', justifyContent:'flex-end' }}>
          <Btn cor={C.ambar} onClick={alterarSenha} disabled={salvandoSenha}>
            {salvandoSenha ? 'Alterando...' : 'Alterar senha'}
          </Btn>
        </div>
      </Secao>
    </div>
  )
}
