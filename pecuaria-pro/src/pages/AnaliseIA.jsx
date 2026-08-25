import { useState } from 'react'
import { supabase } from '../utils/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { C, chamarIA, hoje } from '../utils/helpers.js'

export default function AnaliseIA() {
  const { user, perfil } = useAuth()
  const seg = perfil?.segmento
  const cor = seg === 'leite' ? C.leiteAccent : seg === 'ovino_leite' ? C.ovinoLeiteAccent : seg === 'ovino_corte' ? C.ovinoCorteAccent : C.corteAccent
  const [analise, setAnalise] = useState(null)
  const [loading, setLoading] = useState(false)
  const [modulo, setModulo] = useState('geral')

  const modulos = (seg === 'leite' || seg === 'ovino_leite' || seg === 'caprino_leite') ? [
    { id: 'geral',      label: '🏠 Diagnóstico Geral' },
    { id: 'producao',   label: seg === 'ovino_leite' ? '🐑 Produção & Leite' : seg === 'caprino_leite' ? '🐐 Produção & Leite' : '🥛 Produção & Margem' },
    { id: 'nutricao',   label: '🌿 Nutrição & Dieta' },
    { id: 'sanidade',   label: '💊 Sanidade & Carências' },
    { id: 'reproducao', label: seg === 'ovino_leite' ? '🐑 Reprodução Ovina' : seg === 'caprino_leite' ? '🐐 Reprodução Caprina' : '🐄 Reprodução' },
  ] : [
    { id: 'geral',        label: '🏠 Diagnóstico Geral' },
    { id: 'confinamento', label: seg === 'ovino_corte' ? '🐑 Engorda & GMD' : seg === 'caprino_corte' ? '🐐 Engorda & GMD' : '⚖️ Confinamento & GMD' },
    { id: 'nutricao',     label: '🌿 Nutrição & Dieta' },
    { id: 'sanidade',     label: '💊 Sanidade & Carências' },
    { id: 'reproducao',   label: seg === 'ovino_corte' ? '🐑 Reprodução Ovina' : seg === 'caprino_corte' ? '🐐 Reprodução Caprina' : '🐄 Reprodução' },
  ]
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

      const segLabel = {
        leite:'Bovinos Leiteiros', corte:'Bovinos de Corte',
        ovino_leite:'Ovinos Leiteiros', ovino_corte:'Ovinos de Corte'
      }
      let contexto = `Fazenda: ${perfil?.fazenda} | Segmento: ${segLabel[seg]||seg}\n`
      contexto += `Rebanho: ${animais.length} animais ativos\n`

      if (seg === 'leite' || seg === 'ovino_leite') {
        const prod = prodRes.data || []
        const totalLitros30d = prod.reduce((s,r) => s + parseFloat(r.total_litros||0), 0)
        const mediaLitrosDia = prod.length > 0 ? totalLitros30d / (new Set(prod.map(r=>r.data)).size) : 0
        contexto += `Produção últimos 30 dias: ${totalLitros30d.toFixed(0)} L | Média/dia: ${mediaLitrosDia.toFixed(1)} L\n`
        if(seg==='ovino_leite') contexto += `Meta raça Lacaune: 200-400L/lactação (150d) | Meta Santa Inês: 80-120L\n`
        else if(seg==='caprino_leite') contexto += `Meta Saanen: 600-900L/lactação (270d) | Meta Alpina: 500-700L | Meta Anglo-Nubiana: 300-500L (Embrapa CNPCO/IDF)\n`
        else contexto += `Meta rebanho: >25L/vaca/dia (Embrapa CNPGL) | CCS meta: <400.000 céls/mL (IN77/2018)\n`
      } else {
        const pesagens = prodRes.data || []
        contexto += `Pesagens últimos 60 dias: ${pesagens.length} registros\n`
        if(seg==='ovino_corte') contexto += `Meta GMD Dorper: 300g/dia | Meta Santa Inês: 200g/dia | Peso abate: 35-45kg (Embrapa CNPCO)\n`
        else if(seg==='caprino_corte') contexto += `Meta GMD cabrito: 150-200g/dia | Peso abate: 25-35kg (cabrito leite: 8-12kg) | Rendimento carcaça: 45-50% (Embrapa CNPCO)\n`
        else contexto += `Meta GMD Nelore: 1,2kg/dia | Cruzados: 1,5kg/dia | Peso abate: 480-520kg (Cepea/USP)\n`
      }

      contexto += `Animais em carência: ${carencias.length}\n`
      contexto += `Insumos em estoque:\n`
      estoque.forEach(i => {
        const dias = i.consumo_diario > 0 ? Math.floor(i.quantidade / i.consumo_diario) : null
        contexto += `  - ${i.nome}: ${i.quantidade} ${i.unidade}${dias ? ` (${dias} dias)` : ''}\n`
      })

      const refs = {
        leite:       'Embrapa Gado de Leite (CNPGL), Milkpoint, CBNA, NRC 2001 Dairy, MAPA',
        corte:       'Embrapa Gado de Corte (CNPGC), Cepea/USP, CBNA, NRC Beef, ANUALPEC, MAPA',
        ovino_leite:   'Embrapa Caprinos e Ovinos (CNPCO), SEBRAE Ovinos, ACOB, NRC Small Ruminants, MAPA',
        ovino_corte:   'Embrapa Caprinos e Ovinos (CNPCO), SEBRAE Ovinos, ACOB, NRC Small Ruminants, MAPA',
        caprino_leite: 'Embrapa Caprinos e Ovinos (CNPCO), ACOC, NRC Small Ruminants, MAPA, IDF',
        caprino_corte: 'Embrapa Caprinos e Ovinos (CNPCO), ACOC, NRC Small Ruminants, MAPA',
      }
      const esp = {
        leite:'bovinos leiteiros', corte:'bovinos de corte',
        ovino_leite:'ovinos leiteiros', ovino_corte:'ovinos de corte',
        caprino_leite:'caprinos leiteiros', caprino_corte:'caprinos de corte',
      }
      const segAtual = perfil?.segmento || 'leite'
      const ref = refs[segAtual] || refs.leite
      const animal = esp[segAtual] || 'bovinos'
      const isOvino = segAtual?.includes('ovino')
      const isCaprino = segAtual?.includes('caprino')
      const isPequeno = isOvino || isCaprino

      const prompts = {
        geral: `Veterinário/zootecnista especialista em ${animal} no Brasil. Referências: ${ref}. Diagnóstico em 4 seções: 1-PONTOS POSITIVOS, 2-ATENÇÃO, 3-RISCOS, 4-PLANO DESTA SEMANA. Direto ao produtor, sem markdown.`,
        producao: `Especialista em produção de leite de ${animal}. Referências: ${ref}. Analise produção, DEL, eficiência leiteira e sugira melhorias práticas. Sem markdown.`,
        confinamento: `Especialista em crescimento/engorda de ${animal}. Referências: ${ref}. Analise GMD, conversão alimentar, projeção de abate e rentabilidade. Benchmarks nacionais. Sem markdown.`,
        nutricao: `Nutricionista animal especialista em ${animal}. Referências: ${ref}. Analise estoque, dieta e custo nutricional. Identifique deficiências e sugira ajustes práticos. Sem markdown.`,
        sanidade: `Médico veterinário especialista em ${animal}. Referências: ${ref}. Analise carências, vacinação e riscos sanitários. Calendário sanitário para Sul do Brasil. Sem markdown.`,
        reproducao: `Especialista em reprodução de ${animal}. Referências: ${ref}. Analise índices reprodutivos e gargalos. ${isCaprino ? 'Compare com: IEPA<240d, natalidade>90%, prolificidade>1,8 cabritos/parto, gestação 150d (Embrapa CNPCO).' : isOvino ? 'Compare com: IEPA<270d, natalidade>90%, prolificidade>1,5 cordeiros/parto.' : 'Compare com: IEP<365d, concepção>60%, DEA<90d.'} Sem markdown.`,
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
          Diagnóstico inteligente baseado nos seus dados reais · {
            perfil?.segmento === 'leite' ? 'Referências: Embrapa CNPGL, CBNA, NRC Dairy, MAPA' :
            perfil?.segmento === 'corte' ? 'Referências: Embrapa CNPGC, Cepea/USP, CBNA, NRC Beef' :
            perfil?.segmento === 'ovino_leite' ? 'Referências: Embrapa CNPCO, SEBRAE Ovinos, NRC Small Ruminants' :
            'Referências: Embrapa CNPCO, SEBRAE Ovinos, ACOB, NRC Small Ruminants'
          }
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
