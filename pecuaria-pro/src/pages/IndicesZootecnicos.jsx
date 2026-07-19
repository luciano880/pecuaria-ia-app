import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../utils/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { C, fmtNum, fmtData, hoje } from '../utils/helpers.js'
import { Secao, useToast } from '../components/UI.jsx'

// ── Card de índice ────────────────────────────────────────────
function CardIndice({ icon, titulo, valor, unidade, meta, descricao, cor, status }) {
  const corStatus = status === 'bom' ? C.verdeClaro : status === 'atencao' ? C.ambar : C.critico
  return (
    <div style={{
      background: C.bgCard, border: `1px solid ${C.border}`,
      borderLeft: `4px solid ${corStatus}`,
      borderRadius: 12, padding: '16px 18px',
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
        <div style={{ fontSize:11, color:C.textoMuted, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px' }}>
          {icon} {titulo}
        </div>
        <span style={{
          fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:4,
          background:`${corStatus}22`, color:corStatus,
        }}>
          {status === 'bom' ? '✅ BOM' : status === 'atencao' ? '⚠️ ATENÇÃO' : '🚨 CRÍTICO'}
        </span>
      </div>
      <div style={{ fontSize:28, fontWeight:800, color:corStatus, fontFamily:"'Syne',sans-serif", letterSpacing:'-1px' }}>
        {valor} <span style={{ fontSize:14, fontWeight:500, color:C.textoMuted }}>{unidade}</span>
      </div>
      {meta && (
        <div style={{ fontSize:11, color:C.textoMuted, marginTop:4 }}>
          Meta Embrapa: {meta}
        </div>
      )}
      {descricao && (
        <div style={{ fontSize:11, color:C.textoSub, marginTop:6, lineHeight:1.5 }}>
          {descricao}
        </div>
      )}
    </div>
  )
}

export default function IndicesZootecnicos() {
  const { user } = useAuth()
  const { toast, ToastContainer } = useToast()
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!user) return
    calcularIndices()
  }, [user])

  async function calcularIndices() {
    setCarregando(true)
    try {
      const hoje_str = hoje()

      // Buscar animais fêmeas ativas
      const { data: animais } = await supabase.from('animais').select('*')
        .eq('user_id', user.id).eq('ativo', true)
        .in('categoria', ['lactacao','seca','novilha','bezerra'])

      // Buscar todos os partos
      const { data: partos } = await supabase.from('reproducao').select('*')
        .eq('user_id', user.id).eq('tipo', 'parto').order('data_evento')

      // Buscar reproduções (coberturas e diagnósticos)
      const { data: repros } = await supabase.from('reproducao').select('*')
        .eq('user_id', user.id).order('data_evento', { ascending: false })

      const total = animais?.length || 0
      const lactantes = animais?.filter(a => a.categoria === 'lactacao').length || 0
      const secas = animais?.filter(a => a.categoria === 'seca').length || 0
      const novilhas = animais?.filter(a => a.categoria === 'novilha').length || 0
      const bezerras = animais?.filter(a => a.categoria === 'bezerra').length || 0

      const pctLactantes = total > 0 ? (lactantes / (lactantes + secas)) * 100 : 0
      const pctSecas = total > 0 ? (secas / (lactantes + secas)) * 100 : 0

      // ── IEPA — Intervalo Entre Partos Atual ──────────────────
      // Média dos intervalos entre partos consecutivos por animal
      const intervalos = []
      const partosPorAnimal = {}
      ;(partos || []).forEach(p => {
        if (!partosPorAnimal[p.brinco]) partosPorAnimal[p.brinco] = []
        partosPorAnimal[p.brinco].push(p.data_evento)
      })
      Object.values(partosPorAnimal).forEach(datas => {
        const sorted = [...datas].sort()
        for (let i = 1; i < sorted.length; i++) {
          const dias = Math.round((new Date(sorted[i]) - new Date(sorted[i-1])) / 86400000)
          if (dias > 200 && dias < 800) intervalos.push(dias)
        }
      })
      const iepa = intervalos.length > 0 ? Math.round(intervalos.reduce((s,v)=>s+v,0)/intervalos.length) : null

      // ── IEPP — Intervalo Entre Partos Previsto ───────────────
      // Baseado nas previsões de parto cadastradas
      const previstas = (repros || []).filter(r => r.previsao_parto && r.resultado === 'positivo')
      const iepp = previstas.length > 0 ? 365 + 60 : null // Gestação 283d + DEA meta 60-80d = ~365d ideal Embrapa

      // ── DEL — Dias Em Lactação ──────────────────────────────
      // Média dos dias desde o último parto das vacas em lactação
      const delsAnimais = []
      const partosMap = {}
      ;(partos || []).forEach(p => {
        if (!partosMap[p.brinco] || p.data_evento > partosMap[p.brinco]) {
          partosMap[p.brinco] = p.data_evento
        }
      })
      ;(animais || []).filter(a => a.categoria === 'lactacao').forEach(a => {
        if (partosMap[a.brinco]) {
          const dias = Math.round((new Date(hoje_str) - new Date(partosMap[a.brinco])) / 86400000)
          if (dias > 0 && dias < 500) delsAnimais.push(dias)
        }
      })
      const del = delsAnimais.length > 0 ? Math.round(delsAnimais.reduce((s,v)=>s+v,0)/delsAnimais.length) : null

      // ── DEA — Dias Em Aberto ────────────────────────────────
      // Dias desde o parto até a confirmação de prenhez (diagnóstico positivo)
      const deasAnimais = []
      ;(animais || []).filter(a => a.categoria === 'lactacao').forEach(a => {
        const ultimoParto = partosMap[a.brinco]
        if (!ultimoParto) return
        const diagPos = (repros || []).find(r =>
          r.brinco === a.brinco &&
          r.tipo === 'diagnostico' &&
          r.resultado === 'positivo' &&
          r.data_evento > ultimoParto
        )
        if (diagPos) {
          const dias = Math.round((new Date(diagPos.data_evento) - new Date(ultimoParto)) / 86400000)
          if (dias > 0 && dias < 400) deasAnimais.push(dias)
        } else {
          // Se não tem diagnóstico positivo, está em aberto ainda
          const diasAberto = Math.round((new Date(hoje_str) - new Date(ultimoParto)) / 86400000)
          if (diasAberto > 0 && diasAberto < 400) deasAnimais.push(diasAberto)
        }
      })
      const dea = deasAnimais.length > 0 ? Math.round(deasAnimais.reduce((s,v)=>s+v,0)/deasAnimais.length) : null

      // ── NASCIMENTOS ─────────────────────────────────────────
      const todosPartos = partos || []
      const totalN= todosPartos.length
      const femeas = todosPartos.filter(p => p.sexo_cria === 'F').length
      const machos = todosPartos.filter(p => p.sexo_cria === 'M').length
      const natimortos = todosPartos.filter(p => p.obs?.toLowerCase().includes('natimorto') || p.obs?.toLowerCase().includes('morto')).length
      const pctFemeas = totalN > 0 ? (femeas/totalN)*100 : 0
      const pctMachos = totalN > 0 ? (machos/totalN)*100 : 0
      const pctNati = totalN > 0 ? (natimortos/totalN)*100 : 0

      // ── GENEALOGIA por brinco ───────────────────────────────
      const genealogia = (animais || [])
        .filter(a => a.mae_brinco)
        .slice(0, 10)
        .map(a => {
          const mae = animais?.find(m => m.brinco === a.mae_brinco)
          return { brinco: a.brinco, nome: a.nome, mae_brinco: a.mae_brinco, mae_nome: mae?.nome, mae_cat: mae?.categoria }
        })

      setDados({
        total, lactantes, secas, novilhas, bezerras,
        pctLactantes, pctSecas,
        iepa, iepp, del, dea,
        intervalos: intervalos.length,
        nascimentos: { total: totalN, femeas, machos, natimortos, pctFemeas, pctMachos, pctNati },
        genealogia,
      })
    } catch(e) {
      console.error(e)
    } finally {
      setCarregando(false)
    }
  }

  if (carregando) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'50vh', flexDirection:'column', gap:12 }}>
      <div className="pulse" style={{ fontSize:32 }}>🐄</div>
      <div style={{ color:C.textoMuted, fontSize:13 }}>Calculando índices...</div>
    </div>
  )

  if (!dados) return null

  return (
    <div style={{ maxWidth: 1000, margin:'0 auto' }}>
      <ToastContainer />
      <div style={{ marginBottom:24 }}>
        <h2 style={{ fontSize:22, fontWeight:800, color:C.leiteAccent, fontFamily:"'Syne',sans-serif" }}>📊 Índices Zootécnicos</h2>
        <p style={{ color:C.textoMuted, fontSize:13 }}>Indicadores de desempenho do rebanho — referência Embrapa</p>
      </div>

      {/* ── Composição do rebanho ── */}
      <Secao titulo="Composição do Rebanho" icon="🐄" cor={C.leiteAccent}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10 }}>
          {[
            { l:'Total fêmeas', v:dados.total, c:C.texto },
            { l:'🥛 Lactantes', v:`${dados.lactantes} (${fmtNum(dados.pctLactantes,0)}%)`, c:C.leiteAccent },
            { l:'🔵 Secas',     v:`${dados.secas} (${fmtNum(dados.pctSecas,0)}%)`,     c:C.ambar },
            { l:'🌱 Novilhas',  v:dados.novilhas, c:C.verdeClaro },
            { l:'🍼 Bezerras',  v:dados.bezerras, c:C.verdeVivo },
          ].map((s,i) => (
            <div key={i} style={{ background:C.bgInput, borderRadius:8, padding:'10px 12px', textAlign:'center' }}>
              <div style={{ fontSize:10, color:C.textoMuted, textTransform:'uppercase', fontWeight:600, marginBottom:4 }}>{s.l}</div>
              <div style={{ fontSize:18, fontWeight:800, color:s.c, fontFamily:'monospace' }}>{s.v}</div>
            </div>
          ))}
        </div>

        {/* Barra visual */}
        <div style={{ marginTop:16, height:24, borderRadius:12, overflow:'hidden', display:'flex', background:C.bgInput }}>
          {dados.lactantes > 0 && (
            <div style={{ width:`${dados.pctLactantes}%`, background:C.leiteAccent, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'#fff', fontWeight:700 }}>
              {fmtNum(dados.pctLactantes,0)}%
            </div>
          )}
          {dados.secas > 0 && (
            <div style={{ width:`${dados.pctSecas}%`, background:C.ambar, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'#fff', fontWeight:700 }}>
              {fmtNum(dados.pctSecas,0)}%
            </div>
          )}
        </div>
        <div style={{ display:'flex', gap:16, marginTop:6, fontSize:11, color:C.textoMuted }}>
          <span style={{ color:C.leiteAccent }}>● Lactantes</span>
          <span style={{ color:C.ambar }}>● Secas</span>
          <span style={{ color:C.textoMuted }}>Meta: 85% lactantes / 15% secas</span>
        </div>
      </Secao>

      {/* ── Índices reprodutivos ── */}
      <Secao titulo="Índices Reprodutivos" icon="🐄" cor={C.verde}>
        {dados.intervalos < 3 && (
          <div style={{ background:`${C.ambar}18`, border:`1px solid ${C.ambar}`, borderRadius:8, padding:'8px 14px', marginBottom:14, fontSize:12, color:C.ambar }}>
            ⚠️ Poucos partos registrados ({dados.intervalos} intervalos). Cadastre mais partos para índices mais precisos.
          </div>
        )}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12 }}>
          <CardIndice
            icon="📅" titulo="IEPP — Intervalo Entre Partos Previsto"
            valor={dados.iepp ? fmtNum(dados.iepp,0) : '—'}
            unidade="dias"
            meta="365 dias (12 meses)"
            descricao="Intervalo ideal entre partos. Base: gestação 283d + DEA ideal de 82d."
            status={!dados.iepp ? 'atencao' : dados.iepp <= 395 ? 'bom' : dados.iepp <= 430 ? 'atencao' : 'critico'}
          />
          <CardIndice
            icon="📊" titulo="IEPA — Intervalo Entre Partos Atual"
            valor={dados.iepa ? fmtNum(dados.iepa,0) : '—'}
            unidade="dias"
            meta="365-395 dias"
            descricao={dados.iepa ? `Média de ${dados.intervalos} intervalos calculados do histórico de partos.` : 'Cadastre pelo menos 2 partos por animal para calcular.'}
            status={!dados.iepa ? 'atencao' : dados.iepa <= 395 ? 'bom' : dados.iepa <= 430 ? 'atencao' : 'critico'}
          />
          <CardIndice
            icon="🥛" titulo="DEL — Dias Em Lactação"
            valor={dados.del ? fmtNum(dados.del,0) : '—'}
            unidade="dias"
            meta="150-180 dias (média ideal)"
            descricao="Média de dias em lactação das vacas em produção. Acima de 200d indica vacas tardias."
            status={!dados.del ? 'atencao' : dados.del <= 180 ? 'bom' : dados.del <= 220 ? 'atencao' : 'critico'}
          />
          <CardIndice
            icon="⏳" titulo="DEA — Dias Em Aberto"
            valor={dados.dea ? fmtNum(dados.dea,0) : '—'}
            unidade="dias"
            meta="60-90 dias"
            descricao="Dias desde o parto até a prenhez confirmada. Acima de 120d indica problema reprodutivo."
            status={!dados.dea ? 'atencao' : dados.dea <= 90 ? 'bom' : dados.dea <= 120 ? 'atencao' : 'critico'}
          />
        </div>
      </Secao>

      {/* ── Nascimentos ── */}
      <Secao titulo="Nascimentos Registrados" icon="🐣" cor={C.verdeVivo}>
        {dados.nascimentos.total === 0 ? (
          <div style={{ color:C.textoMuted, fontSize:13 }}>Nenhum parto registrado ainda. Cadastre partos na aba Reprodução.</div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
            {[
              { l:'Total partos',  v:dados.nascimentos.total, c:C.texto },
              { l:'🚺 Fêmeas',    v:`${dados.nascimentos.femeas} (${fmtNum(dados.nascimentos.pctFemeas,0)}%)`, c:C.leiteAccent },
              { l:'🚹 Machos',    v:`${dados.nascimentos.machos} (${fmtNum(dados.nascimentos.pctMachos,0)}%)`, c:C.ambar },
              { l:'💀 Natimortos',v:`${dados.nascimentos.natimortos} (${fmtNum(dados.nascimentos.pctNati,1)}%)`, c:dados.nascimentos.natimortos>0?C.critico:C.verdeClaro },
            ].map((s,i) => (
              <div key={i} style={{ background:C.bgInput, borderRadius:8, padding:'12px', textAlign:'center' }}>
                <div style={{ fontSize:10, color:C.textoMuted, textTransform:'uppercase', fontWeight:600, marginBottom:4 }}>{s.l}</div>
                <div style={{ fontSize:18, fontWeight:800, color:s.c, fontFamily:'monospace' }}>{s.v}</div>
              </div>
            ))}
          </div>
        )}
        {dados.nascimentos.total > 0 && (
          <div style={{ marginTop:12, fontSize:12, color:C.textoMuted, lineHeight:1.7 }}>
            ℹ️ Natimortos são contabilizados quando a observação do parto contém "natimorto" ou "morto". Taxa acima de 3% requer atenção veterinária.
          </div>
        )}
      </Secao>

      {/* ── Genealogia ── */}
      <Secao titulo="Genealogia — Relação Mãe × Filha" icon="🧬" cor={C.ambar}>
        {dados.genealogia.length === 0 ? (
          <div style={{ color:C.textoMuted, fontSize:13 }}>
            Nenhuma relação genealógica encontrada. Cadastre o brinco da mãe ao registrar animais.
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ borderBottom:`2px solid ${C.border}` }}>
                {['Brinco','Nome','Mãe (Brinco)','Nome da Mãe','Cat. da Mãe'].map(h => (
                  <th key={h} style={{ padding:'8px 12px', textAlign:'left', color:C.textoMuted, fontSize:11, textTransform:'uppercase', fontWeight:600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dados.genealogia.map((g,i) => (
                <tr key={i} style={{ borderBottom:`1px solid ${C.border}` }}>
                  <td style={{ padding:'8px 12px', color:C.ambar, fontWeight:700 }}>#{g.brinco}</td>
                  <td style={{ padding:'8px 12px', color:C.texto }}>{g.nome||'—'}</td>
                  <td style={{ padding:'8px 12px', color:C.leiteAccent, fontWeight:700 }}>#{g.mae_brinco}</td>
                  <td style={{ padding:'8px 12px', color:C.textoSub }}>{g.mae_nome||'—'}</td>
                  <td style={{ padding:'8px 12px', color:C.textoMuted, textTransform:'capitalize' }}>{g.mae_cat||'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ marginTop:12, fontSize:11, color:C.textoMuted }}>
          ℹ️ Para ver mais relações, cadastre o campo "Brinco da Mãe" ao registrar cada animal.
        </div>
      </Secao>

      {/* Botão atualizar */}
      <div style={{ textAlign:'center', marginTop:8 }}>
        <button onClick={calcularIndices} style={{
          padding:'8px 20px', borderRadius:8,
          border:`1px solid ${C.border}`, background:C.bgCard,
          color:C.textoMuted, fontSize:12, cursor:'pointer',
        }}>🔄 Recalcular índices</button>
      </div>
    </div>
  )
}
