import { useState } from 'react'
import { supabase } from '../utils/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { C, chamarIA, hoje } from '../utils/helpers.js'

export default function AnaliseIA() {
  const { user, perfil } = useAuth()
  const seg = perfil?.segmento
  const cor = seg === 'leite' ? C.leiteAccent : C.corteAccent
  const [analise, setAnalise] = useState(null)
  const [loading, setLoading] = useState(false)
  const [modulo, setModulo] = useState('geral')

  const modulos = seg === 'leite' ? [
    { id: 'geral',      label: '🏠 Diagnóstico Geral' },
    { id: 'producao',   label: '🥛 Produção & Margem' },
    { id: 'nutricao',   label: '🌽 Nutrição & Dieta' },
    { id: 'sanidade',   label: '💊 Sanidade & Carências' },
    { id: 'reproducao', label: '🐄 Reprodução' },
  ] : [
    { id: 'geral',      label: '🏠 Diagnóstico Geral' },
    { id: 'confinamento', label: '⚖️ Confinamento & GMD' },
    { id: 'nutricao',   label: '🌽 Nutrição & Dieta' },
    { id: 'sanidade',   label: '💊 Sanidade & Carências' },
    { id: 'reproducao', label: '🐄 Reprodução' },
  ]

  async function analisar() {
    setLoading(true); setAnalise(null)
    try {
      // Buscar dados reais do Supabase
      const [animRes, prodRes, aplRes, estRes, pesRes] = await Promise.all([
        supabase.from('animais').select('categoria').eq('user_id', user.id).eq('segmento', seg),
        seg === 'leite'
          ? supabase.from('producao_leite').select('total_litros,data').eq('user_id', user.id).gte('data', new Date(Date.now() - 30*86400000).toISOString().split('T')[0])
          : supabase.from('pesagens').select('*').eq('user_id', user.id).gte('data', new Date(Date.now() - 60*86400000).toISOString().split('T')[0]),
        supabase.from('aplicacoes').select('*').eq('user_id', user.id).gte('fim_carencia_leite', hoje()),
        supabase.from('estoque_insumos').select('*').eq('user_id', user.id),
        supabase.from('pesagens').select('*').eq('user_id', user.id),
      ])

      const animais = animRes.data || []
      const estoque = estRes.data || []
      const carencias = aplRes.data || []

      let contexto = `Fazenda: ${perfil?.fazenda} | Segmento: ${seg === 'leite' ? 'Pecuária Leiteira' : 'Pecuária de Corte'}\n`
      contexto += `Rebanho: ${animais.length} animais ativos\n`

      if (seg === 'leite') {
        const prod = prodRes.data || []
        const totalLitros30d = prod.reduce((s,r) => s + parseFloat(r.total_litros||0), 0)
        const mediaLitrosDia = prod.length > 0 ? totalLitros30d / (new Set(prod.map(r=>r.data)).size) : 0
        contexto += `Produção últimos 30 dias: ${totalLitros30d.toFixed(0)} L | Média/dia: ${mediaLitrosDia.toFixed(1)} L\n`
      } else {
        const pesagens = prodRes.data || []
        contexto += `Pesagens últimos 60 dias: ${pesagens.length} registros\n`
      }

      contexto += `Animais em carência: ${carencias.length}\n`
      contexto += `Insumos em estoque:\n`
      estoque.forEach(i => {
        const dias = i.consumo_diario > 0 ? Math.floor(i.quantidade / i.consumo_diario) : null
        contexto += `  - ${i.nome}: ${i.quantidade} ${i.unidade}${dias ? ` (${dias} dias)` : ''}\n`
      })

      const prompts = {
        geral: `Veterinário/zootecnista especialista em pecuária brasileira (Embrapa, CBNA). Diagnóstico em 4 seções: 1-PONTOS POSITIVOS, 2-ATENÇÃO, 3-RISCOS, 4-PLANO DESTA SEMANA. Direto ao produtor, sem markdown.`,
        producao: `Especialista em produção leiteira (Embrapa, Milkpoint). Analise produção, indicadores e sugira melhorias em eficiência leiteira. Sem markdown.`,
        confinamento: `Especialista em confinamento bovino (Embrapa, Cepea). Analise GMD, dieta e rentabilidade. Benchmarks nacionais. Sem markdown.`,
        nutricao: `Nutricionista animal (CBNA, NRC, Embrapa). Analise estoque, dieta e custo nutricional. Deficiências e ajustes práticos. Sem markdown.`,
        sanidade: `Médico veterinário (MAPA, CFMV). Analise carências e vacinação. Riscos sanitários e calendário para Sul do Brasil. Sem markdown.`,
        reproducao: `Especialista em reprodução bovina (Embrapa, CBRA). IEP, taxa de concepção, gargalos. Compare com IEP<365d, concepção>60%. Sem markdown.`,
      }

      const prompt = `${prompts[modulo] || prompts.geral}\n\nDados:\n${contexto}\n\nData: ${new Date().toLocaleDateString('pt-BR')}`

      const texto = await chamarIA(prompt, 700)
      setAnalise(texto)
    } catch(e) {
      setAnalise(`Erro: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: cor }}>🤖 Análise IA</h2>
        <p style={{ color: C.textoMuted, fontSize: 13 }}>
          Diagnóstico inteligente baseado nos seus dados reais · Referências: Embrapa, CBNA, NRC, MAPA
        </p>
      </div>

      {/* Seletor de módulo */}
      <div style={{
        background: C.bgCard, border: `1px solid ${C.border}`,
        borderRadius: 12, padding: 16, marginBottom: 20,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.textoMuted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>
          Selecione o foco da análise
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {modulos.map(m => (
            <button key={m.id} onClick={() => setModulo(m.id)} style={{
              padding: '8px 14px', borderRadius: 8,
              border: `1.5px solid ${modulo === m.id ? cor : C.border}`,
              background: modulo === m.id ? `${cor}22` : C.bgInput,
              color: modulo === m.id ? cor : C.textoMuted,
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>{m.label}</button>
          ))}
        </div>
      </div>

      <button onClick={analisar} disabled={loading} style={{
        width: '100%', padding: '15px 0', borderRadius: 10, border: 'none',
        background: loading ? C.border : `linear-gradient(135deg, ${C.verde}, ${C.verdeClaro})`,
        color: '#fff', fontSize: 15, fontWeight: 700,
        cursor: loading ? 'not-allowed' : 'pointer',
        boxShadow: loading ? 'none' : `0 4px 20px ${C.verde}55`,
        marginBottom: 20,
      }}>
        {loading ? '⏳ Analisando seus dados com IA...' : '🤖 Gerar Análise Inteligente'}
      </button>

      {analise && (
        <div style={{
          background: C.bgCard, border: `2px solid ${C.ambar}`,
          borderRadius: 12, overflow: 'hidden',
        }}>
          <div style={{ background: C.ambar, padding: '10px 16px', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span>🧠</span>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>
              {modulos.find(m => m.id === modulo)?.label} — {perfil?.fazenda}
            </span>
          </div>
          <div style={{ padding: '18px 20px', fontSize: 13.5, lineHeight: 1.85, whiteSpace: 'pre-wrap', color: C.texto }}>
            {analise}
          </div>
        </div>
      )}
    </div>
  )
}
