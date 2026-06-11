import { useState } from 'react'
import { supabase } from '../utils/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { C } from '../utils/helpers.js'
import { Secao, Campo, Grid, Btn, useToast } from '../components/UI.jsx'

export default function Configuracoes() {
  const { user, perfil, setPerfil } = useAuth()
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
      // Recarrega o perfil do banco e força reload da página
      await carregarPerfil(user.id)
      toast('✅ Salvo! Recarregando...')
      setTimeout(() => window.location.href = '/', 1200)
    } catch (e) {
      toast(e.message, 'erro')
    } finally {
      setSalvando(false)
    }
  }

  async function alterarSenha() {
    if (novaSenha.length < 6) { toast('Senha deve ter ao menos 6 caracteres', 'erro'); return }
    if (novaSenha !== confirmaSenha) { toast('Senhas não coincidem', 'erro'); return }
    setSalvandoSenha(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: novaSenha })
      if (error) throw error
      toast('Senha alterada!'); setNovaSenha(''); setConfirmaSenha('')
    } catch (e) { toast(e.message, 'erro') }
    finally { setSalvandoSenha(false) }
  }

  const segOpts = [
    { value:'leite', icon:'🥛', label:'Pecuária Leiteira', cor: C.leitePrimary, acc: C.leiteAccent },
    { value:'corte', icon:'🥩', label:'Pecuária de Corte',  cor: C.cortePrimary, acc: C.corteAccent },
  ]

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <ToastContainer />
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: C.texto, fontFamily:"'Syne',sans-serif" }}>⚙️ Configurações</h2>
        <p style={{ color: C.textoMuted, fontSize: 13 }}>Perfil, fazenda, segmento e segurança</p>
      </div>

      <Secao titulo="Dados da Fazenda" icon="🏡" cor={C.verdeClaro}>
        <Grid cols={2}>
          <Campo label="Seu nome" value={nome} onChange={setNome} />
          <Campo label="Nome da fazenda" value={fazenda} onChange={setFazenda} />
        </Grid>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display:'block', fontSize:11, color:C.textoSub, marginBottom:8, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px' }}>
            Segmento da propriedade
          </label>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {segOpts.map(s => (
              <button key={s.value} onClick={() => setSegmento(s.value)} style={{
                padding:'16px 12px', borderRadius:10,
                border:`2px solid ${segmento===s.value?s.acc:C.border}`,
                background:segmento===s.value?`${s.cor}44`:C.bgInput,
                color:segmento===s.value?s.acc:C.textoSub,
                fontWeight:700, fontSize:13, cursor:'pointer', textAlign:'center', transition:'all 0.15s',
              }}>
                <div style={{ fontSize:28, marginBottom:6 }}>{s.icon}</div>
                {s.label}
                {segmento===s.value&&<div style={{ fontSize:11, marginTop:4, opacity:0.8 }}>✓ Selecionado</div>}
              </button>
            ))}
          </div>
          {segmento !== perfil?.segmento && (
            <div style={{ marginTop:10, padding:'8px 12px', background:`${C.ambar}22`, border:`1px solid ${C.ambar}`, borderRadius:6, fontSize:12, color:C.ambar }}>
              ⚠️ O menu será atualizado após salvar.
            </div>
          )}
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end' }}>
          <Btn cor={C.verde} onClick={salvarPerfil} disabled={salvando}>
            {salvando?'⏳ Salvando...':'💾 Salvar perfil'}
          </Btn>
        </div>
      </Secao>

      <Secao titulo="Alterar Senha" icon="🔒" cor={C.ambar}>
        <Campo label="Nova senha" type="password" value={novaSenha} onChange={setNovaSenha} placeholder="Min. 6 caracteres" />
        <Campo label="Confirmar nova senha" type="password" value={confirmaSenha} onChange={setConfirmaSenha} placeholder="Repita a senha" />
        <div style={{ display:'flex', justifyContent:'flex-end' }}>
          <Btn cor={C.ambar} onClick={alterarSenha} disabled={salvandoSenha}>
            {salvandoSenha?'⏳ Alterando...':'🔒 Alterar senha'}
          </Btn>
        </div>
      </Secao>

      <Secao titulo="Sobre o Sistema" icon="ℹ️" cor={C.textoMuted}>
        <div style={{ fontSize:12, color:C.textoMuted, lineHeight:1.8 }}>
          <div>📦 Banco: Supabase · 🔐 Auth: OTP por e-mail · 🤖 IA: Claude Sonnet 4</div>
          <div>⚛️ Frontend: React + Vite · 📊 Gráficos: Recharts</div>
          <div style={{ marginTop:8, color:C.verdeClaro }}>📚 Referências: Embrapa · CBNA · NRC · MAPA · CFMV</div>
        </div>
      </Secao>
    </div>
  )
}
