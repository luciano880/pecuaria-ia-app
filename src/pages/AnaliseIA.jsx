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

  async function analisar() {
    setLoading(true); setAnalise(null)
    try {
      // Buscar dados reais do Supabase
      const [animRes, prodRes, aplRes, estRes, pesRes] = await Promise.all([
        supabase.from('animais').select('categoria').eq('user_id', user.id).eq('segmento', seg),
        (seg === 'leite' || seg === 'ovino_leite' || seg === 'caprino_leite')
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
        ovino_leite:'Ovinos Leiteiros', ovino_corte:'Ovinos de Corte',
        caprino_leite:'Caprinos Leiteiros', caprino_corte:'Caprinos de Corte'
      }
      let contexto = `Fazenda: ${perfil?.fazenda} | Segmento: ${segLabel[seg]||seg}\n`
      contexto += `Rebanho: ${animais.length} animais ativos\n`

      if (seg === 'leite' || seg === 'ovino_leite' || seg === 'caprino_leite') {
        const prod = prodRes.data || []
        const totalLitros30d = prod.reduce((s,r) => s + parseFloat(r.total_litros||0), 0)
        const mediaLitrosDia = prod.length > 0 ? totalLitros30d / (new Set(prod.map(r=>r.data)).size) : 0
        contexto += `Produção últimos 30 dias: ${totalLitros30d.toFixed(0)} L | Média/dia: ${mediaLitrosDia.toFixed(1)} L\n`
        if(seg==='ovino_leite') contexto += `Meta raça Lacaune: 200-400L/lactação (150d) | Meta Santa Inês: 80-120L\n`
        else if(seg==='caprino_leite') contexto += `Meta Saanen: 600-900L/lactação (270d) | Meta Alpina: 500-700L | Meta Anglo-Nubiana: 300-500L (Embrapa CNPCO/IDF)\n`
        else contexto += `Meta rebanho: >25L/vaca/dia (Embrapa CNPGL) | CCS: meta <400.000, limite legal 500.000 céls/mL (IN76/77-2018)\n`
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

      const base = `Atue como consultor técnico sênior (médico-veterinário/zootecnista) em ${animal}, Brasil. ` +
        `Referências técnicas: ${ref}. ` +
        `Regras de redação: linguagem técnico-profissional, terminologia zootécnica correta, texto corrido sem markdown. ` +
        `Para cada indicador do produtor, confronte com o benchmark nacional citando o valor de referência e o desvio (% ou absoluto). ` +
        `Fundamente em dados; onde faltar informação, aponte a lacuna e o que coletar. ` +
        `Recomendações priorizadas por impacto, com meta numérica e, quando possível, estimativa de efeito técnico-econômico.`

      const prompts = {
        geral: `${base} Estruture o diagnóstico técnico em 5 blocos numerados: ` +
          `1. SÍNTESE DO REBANHO (status geral e principais indicadores vs. metas); ` +
          `2. PONTOS FORTES (o que está dentro ou acima do benchmark, com os números); ` +
          `3. PONTOS DE ATENÇÃO (indicadores abaixo da meta, com o desvio e a causa provável); ` +
          `4. RISCOS CRÍTICOS (sanitários, nutricionais ou reprodutivos que exigem ação imediata); ` +
          `5. PLANO DE AÇÃO DA SEMANA (3 a 5 medidas objetivas, priorizadas, com meta e prazo).`,
        producao: `${base} Analise o desempenho leiteiro: produção total e média/animal/dia vs. meta da raça, ` +
          `persistência de lactação e DEL médio, eficiência (L por kg de MS ou por UA), e qualidade (CCS/CBT quando houver). ` +
          `Aponte os gargalos de produtividade e as 3 a 5 intervenções de maior retorno, com meta numérica e impacto esperado em litros.`,
        confinamento: `${base} Analise crescimento/terminação: GMD observado vs. meta da raça/categoria, ` +
          `conversão alimentar estimada, uniformidade do lote, projeção de peso e data de abate, e custo por arroba/kg produzido. ` +
          `Indique os ajustes de manejo e dieta de maior retorno, com GMD-alvo e efeito esperado no prazo de terminação.`,
        nutricao: `${base} Faça o diagnóstico nutricional: adequação da dieta às exigências (NRC/CBNA) por categoria, ` +
          `balanço energético-proteico aparente, relação volumoso:concentrado, e cobertura de estoque (dias) por insumo. ` +
          `Sinalize deficiências e riscos (acidose, carências minerais) e proponha ajustes de formulação priorizados por custo-benefício.`,
        sanidade: `${base} Faça a avaliação sanitária: animais em período de carência e impacto na comercialização, ` +
          `aderência ao calendário sanitário obrigatório e recomendado para o Sul do Brasil, e principais riscos epidemiológicos da estação. ` +
          `Entregue um calendário sanitário objetivo (o que, quando e por quê) e as ações preventivas prioritárias.`,
        reproducao: `${base} Avalie a eficiência reprodutiva e os gargalos do ciclo. ` +
          `${isCaprino ? 'Benchmarks (Embrapa CNPCO): IEPA <240 d, taxa de natalidade >90%, prolificidade >1,8 cabritos/parto, gestação 150 d.' : isOvino ? 'Benchmarks: IEPA <270 d, taxa de natalidade >90%, prolificidade >1,5 cordeiros/parto, gestação 147 d.' : 'Benchmarks: IEP <365 d, taxa de concepção >60%, DEA <90 d, taxa de prenhez por estação de monta.'} ` +
          `Compare cada índice com a meta, identifique a causa provável do desvio e proponha o plano reprodutivo (manejo, nutrição pré-cobertura, protocolo de IATF quando aplicável).`,
      }

      const prompt = `${prompts[modulo] || prompts.geral}\n\n=== DADOS DO PRODUTOR ===\n${contexto}\nData da análise: ${new Date().toLocaleDateString('pt-BR')}`

      const texto = await chamarIA(prompt, 1300, { temperature: 0.25 })
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
        <h2 style={{ fontSize: 22, fontWeight: 800, color: cor }}>🤖 Análise Técnica IA</h2>
        <p style={{ color: C.textoMuted, fontSize: 13 }}>
          Diagnóstico zootécnico com base nos seus dados reais, confrontados com benchmarks nacionais · {
            perfil?.segmento === 'leite' ? 'Referências: Embrapa CNPGL, CBNA, NRC Dairy, MAPA' :
            perfil?.segmento === 'corte' ? 'Referências: Embrapa CNPGC, Cepea/USP, CBNA, NRC Beef' :
            perfil?.segmento === 'ovino_leite' ? 'Referências: Embrapa CNPCO, SEBRAE Ovinos, NRC Small Ruminants' :
            perfil?.segmento === 'ovino_corte' ? 'Referências: Embrapa CNPCO, SEBRAE Ovinos, ACOB, NRC Small Ruminants' :
            perfil?.segmento === 'caprino_leite' ? 'Referências: Embrapa CNPCO, ACOC, NRC Small Ruminants, IDF' :
            perfil?.segmento === 'caprino_corte' ? 'Referências: Embrapa CNPCO, ACOC, NRC Small Ruminants, MAPA' :
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
