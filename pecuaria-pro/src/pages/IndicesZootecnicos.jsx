import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { C, fmtNum, hoje } from '../utils/helpers.js'
import { Secao, useToast } from '../components/UI.jsx'

function CardIndice({ icon, titulo, valor, unidade, meta, descricao, status }) {
  const corStatus = status==='bom' ? C.verdeClaro : status==='atencao' ? C.ambar : C.critico
  return (
    <div style={{ background:C.bgCard, border:`1px solid ${C.border}`, borderLeft:`4px solid ${corStatus}`, borderRadius:12, padding:'16px 18px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
        <div style={{ fontSize:11, color:C.textoMuted, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px' }}>{icon} {titulo}</div>
        <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:4, background:`${corStatus}22`, color:corStatus }}>
          {status==='bom'?'✅ BOM':status==='atencao'?'⚠️ ATENÇÃO':'🚨 CRÍTICO'}
        </span>
      </div>
      <div style={{ fontSize:28, fontWeight:800, color:corStatus, fontFamily:"'Syne',sans-serif", letterSpacing:'-1px' }}>
        {valor} <span style={{ fontSize:14, fontWeight:500, color:C.textoMuted }}>{unidade}</span>
      </div>
      {meta && <div style={{ fontSize:11, color:C.textoMuted, marginTop:4 }}>Meta Embrapa: {meta}</div>}
      {descricao && <div style={{ fontSize:11, color:C.textoSub, marginTop:6, lineHeight:1.5 }}>{descricao}</div>}
    </div>
  )
}

export default function IndicesZootecnicos() {
  const { user, perfil } = useAuth()
  const seg = perfil?.segmento || 'leite'
  const { ToastContainer } = useToast()
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => { if (user) calcularIndices() }, [user, seg])

  async function calcularIndices() {
    setCarregando(true)
    try {
      const hj = hoje()

      const catsLeite = ['lactacao','seca','novilha','bezerra']
      const catsCorte = ['bezerro','bezerro_desmamado','garrote','novilho','boi_gordo','vaca','touro']
      const cats = seg==='leite' ? catsLeite : catsCorte

      const [animRes, partosRes, reprosRes, pesagensRes] = await Promise.all([
        supabase.from('animais').select('*').eq('user_id',user.id).eq('ativo',true).in('categoria',cats),
        supabase.from('reproducao').select('*').eq('user_id',user.id).eq('tipo','parto').order('data_evento'),
        supabase.from('reproducao').select('*').eq('user_id',user.id).order('data_evento',{ascending:false}),
        supabase.from('pesagens').select('*').eq('user_id',user.id).order('data'),
      ])

      const animais = animRes.data || []
      const partos  = partosRes.data || []
      const repros  = reprosRes.data || []
      const pesagens = pesagensRes.data || []

      // ── Último parto por animal ─────────────────────────────
      const ultimoParto = {}
      partos.forEach(p => {
        if (!ultimoParto[p.brinco] || p.data_evento > ultimoParto[p.brinco])
          ultimoParto[p.brinco] = p.data_evento
      })

      // ── IEPA ────────────────────────────────────────────────
      const intervalos = []
      const partosPorAnimal = {}
      partos.forEach(p => {
        if (!partosPorAnimal[p.brinco]) partosPorAnimal[p.brinco] = []
        partosPorAnimal[p.brinco].push(p.data_evento)
      })
      Object.values(partosPorAnimal).forEach(datas => {
        const sorted = [...datas].sort()
        for (let i=1; i<sorted.length; i++) {
          const dias = Math.round((new Date(sorted[i])-new Date(sorted[i-1]))/86400000)
          if (dias>200 && dias<800) intervalos.push(dias)
        }
      })
      const iepa = intervalos.length>0 ? Math.round(intervalos.reduce((s,v)=>s+v,0)/intervalos.length) : null

      // ── DEA ─────────────────────────────────────────────────
      const deas = []
      animais.forEach(a => {
        const up = ultimoParto[a.brinco]
        if (!up) return
        const diagPos = repros.find(r => r.brinco===a.brinco && r.tipo==='diagnostico' && r.resultado==='positivo' && r.data_evento>up)
        const dias = diagPos
          ? Math.round((new Date(diagPos.data_evento)-new Date(up))/86400000)
          : Math.round((new Date(hj)-new Date(up))/86400000)
        if (dias>0 && dias<400) deas.push(dias)
      })
      const dea = deas.length>0 ? Math.round(deas.reduce((s,v)=>s+v,0)/deas.length) : null

      // ── Nascimentos ─────────────────────────────────────────
      const totalN    = partos.length
      const femeas    = partos.filter(p=>p.sexo_cria==='F').length
      const machos    = partos.filter(p=>p.sexo_cria==='M').length
      const natimortos= partos.filter(p=>p.obs?.toLowerCase().includes('natimorto')||p.obs?.toLowerCase().includes('morto')).length
      const pctF = totalN>0 ? (femeas/totalN)*100 : 0
      const pctM = totalN>0 ? (machos/totalN)*100 : 0
      const pctN = totalN>0 ? (natimortos/totalN)*100 : 0

      // ── Genealogia ──────────────────────────────────────────
      const genealogia = animais.filter(a=>a.mae_brinco).slice(0,10).map(a => {
        const mae = animais.find(m=>m.brinco===a.mae_brinco)
        return { brinco:a.brinco, nome:a.nome, mae_brinco:a.mae_brinco, mae_nome:mae?.nome, mae_cat:mae?.categoria }
      })

      if (seg==='leite') {
        // ── Índices exclusivos LEITE ────────────────────────
        const lactantes = animais.filter(a=>a.categoria==='lactacao').length
        const secas     = animais.filter(a=>a.categoria==='seca').length
        const novilhas  = animais.filter(a=>a.categoria==='novilha').length
        const bezerras  = animais.filter(a=>a.categoria==='bezerra').length
        const total     = lactantes + secas
        const pctLact   = total>0 ? (lactantes/total)*100 : 0
        const pctSeca   = total>0 ? (secas/total)*100 : 0

        // DEL
        const dels = []
        animais.filter(a=>a.categoria==='lactacao').forEach(a => {
          const up = ultimoParto[a.brinco]
          if (up) {
            const dias = Math.round((new Date(hj)-new Date(up))/86400000)
            if (dias>0 && dias<500) dels.push(dias)
          }
        })
        const del = dels.length>0 ? Math.round(dels.reduce((s,v)=>s+v,0)/dels.length) : null

        setDados({ seg:'leite', total:animais.length, lactantes, secas, novilhas, bezerras, pctLact, pctSeca, iepa, del, dea, intervalos:intervalos.length, nascimentos:{totalN,femeas,machos,natimortos,pctF,pctM,pctN}, genealogia })
      } else {
        // ── Índices exclusivos CORTE ────────────────────────
        const bezerros  = animais.filter(a=>['bezerro','bezerro_desmamado'].includes(a.categoria)).length
        const garrotes  = animais.filter(a=>a.categoria==='garrote').length
        const novilhos  = animais.filter(a=>a.categoria==='novilho').length
        const boisGordos= animais.filter(a=>a.categoria==='boi_gordo').length
        const vacas     = animais.filter(a=>a.categoria==='vaca').length
        const touros    = animais.filter(a=>a.categoria==='touro').length

        // GMD médio do rebanho
        const gmds = []
        animais.forEach(a => {
          const pesoAnimal = pesagens.filter(p=>p.brinco===a.brinco).sort((x,y)=>x.data.localeCompare(y.data))
          if (pesoAnimal.length>=2) {
            const primeiro = pesoAnimal[0]; const ultimo = pesoAnimal[pesoAnimal.length-1]
            const dias = Math.max(1, (new Date(ultimo.data)-new Date(primeiro.data))/86400000)
            const gmd = (parseFloat(ultimo.peso_kg)-parseFloat(primeiro.peso_kg))/dias
            if (gmd>0 && gmd<5) gmds.push(gmd)
          }
        })
        const gmdMedio = gmds.length>0 ? gmds.reduce((s,v)=>s+v,0)/gmds.length : null

        // Taxa de natalidade = partos / vacas * 100
        const txNatalidade = vacas>0 ? (totalN/vacas)*100 : null

        setDados({ seg:'corte', total:animais.length, bezerros, garrotes, novilhos, boisGordos, vacas, touros, iepa, dea, gmdMedio, txNatalidade, intervalos:intervalos.length, nascimentos:{totalN,femeas,machos,natimortos,pctF,pctM,pctN}, genealogia })
      }
    } catch(e) { console.error(e) }
    finally { setCarregando(false) }
  }

  if (carregando) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'50vh',flexDirection:'column',gap:12}}>
      <div className="pulse" style={{fontSize:32}}>🐄</div>
      <div style={{color:C.textoMuted,fontSize:13}}>Calculando índices...</div>
    </div>
  )
  if (!dados) return null

  return (
    <div style={{maxWidth:1000,margin:'0 auto'}}>
      <ToastContainer />
      <div style={{marginBottom:24}}>
        <h2 style={{fontSize:22,fontWeight:800,color:seg==='leite'?C.leiteAccent:C.corteAccent,fontFamily:"'Syne',sans-serif"}}>
          📊 Índices Zootécnicos — {seg==='leite'?'🥛 Pecuária Leiteira':'🥩 Pecuária de Corte'}
        </h2>
        <p style={{color:C.textoMuted,fontSize:13}}>Indicadores de desempenho — referência Embrapa</p>
      </div>

      {/* ══ LEITE ══ */}
      {dados.seg==='leite' && (<>
        <Secao titulo="Composição do Rebanho" icon="🐄" cor={C.leiteAccent}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10}}>
            {[
              {l:'Total fêmeas', v:dados.total,                                           c:C.texto},
              {l:'🥛 Lactantes', v:`${dados.lactantes} (${fmtNum(dados.pctLact,0)}%)`,   c:C.leiteAccent},
              {l:'🔵 Secas',     v:`${dados.secas} (${fmtNum(dados.pctSeca,0)}%)`,       c:C.ambar},
              {l:'🌱 Novilhas',  v:dados.novilhas,                                        c:C.verdeClaro},
              {l:'🍼 Bezerras',  v:dados.bezerras,                                        c:C.verdeVivo},
            ].map((s,i)=>(
              <div key={i} style={{background:C.bgInput,borderRadius:8,padding:'10px 12px',textAlign:'center'}}>
                <div style={{fontSize:10,color:C.textoMuted,textTransform:'uppercase',fontWeight:600,marginBottom:4}}>{s.l}</div>
                <div style={{fontSize:18,fontWeight:800,color:s.c,fontFamily:'monospace'}}>{s.v}</div>
              </div>
            ))}
          </div>
          <div style={{marginTop:12,height:22,borderRadius:10,overflow:'hidden',display:'flex',background:C.bgInput}}>
            {dados.lactantes>0&&<div style={{width:`${dados.pctLact}%`,background:C.leiteAccent,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,color:'#fff',fontWeight:700}}>{fmtNum(dados.pctLact,0)}%</div>}
            {dados.secas>0&&<div style={{width:`${dados.pctSeca}%`,background:C.ambar,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,color:'#fff',fontWeight:700}}>{fmtNum(dados.pctSeca,0)}%</div>}
          </div>
          <div style={{display:'flex',gap:16,marginTop:6,fontSize:11,color:C.textoMuted}}>
            <span style={{color:C.leiteAccent}}>● Lactantes</span>
            <span style={{color:C.ambar}}>● Secas</span>
            <span>Meta: 85% lactantes / 15% secas</span>
          </div>
        </Secao>

        <Secao titulo="Índices Reprodutivos — Leite" icon="🐄" cor={C.verde}>
          {dados.intervalos<3&&<div style={{background:`${C.ambar}18`,border:`1px solid ${C.ambar}`,borderRadius:8,padding:'8px 14px',marginBottom:14,fontSize:12,color:C.ambar}}>⚠️ Poucos partos registrados. Cadastre mais para índices precisos.</div>}
          <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12}}>
            <CardIndice icon="📅" titulo="IEPA — Intervalo Entre Partos Atual"
              valor={dados.iepa?fmtNum(dados.iepa,0):'—'} unidade="dias"
              meta="365–395 dias"
              descricao={dados.iepa?`Média de ${dados.intervalos} intervalos do histórico.`:'Cadastre pelo menos 2 partos por animal.'}
              status={!dados.iepa?'atencao':dados.iepa<=395?'bom':dados.iepa<=430?'atencao':'critico'}/>
            <CardIndice icon="🥛" titulo="DEL — Dias Em Lactação"
              valor={dados.del?fmtNum(dados.del,0):'—'} unidade="dias"
              meta="150–180 dias"
              descricao="Média de dias em lactação das vacas em produção."
              status={!dados.del?'atencao':dados.del<=180?'bom':dados.del<=220?'atencao':'critico'}/>
            <CardIndice icon="⏳" titulo="DEA — Dias Em Aberto"
              valor={dados.dea?fmtNum(dados.dea,0):'—'} unidade="dias"
              meta="60–90 dias"
              descricao="Dias do parto até a prenhez confirmada."
              status={!dados.dea?'atencao':dados.dea<=90?'bom':dados.dea<=120?'atencao':'critico'}/>
            <CardIndice icon="📊" titulo="IEPP — Intervalo Entre Partos Previsto"
              valor="365" unidade="dias"
              meta="365 dias (12 meses)"
              descricao="Referência Embrapa: gestação 283d + DEA ideal 82d = 365d."
              status={!dados.dea?'atencao':dados.dea<=90?'bom':dados.dea<=120?'atencao':'critico'}/>
          </div>
        </Secao>
      </>)}

      {/* ══ CORTE ══ */}
      {dados.seg==='corte' && (<>
        <Secao titulo="Composição do Rebanho" icon="🥩" cor={C.corteAccent}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:10}}>
            {[
              {l:'🐄 Vacas',      v:dados.vacas,      c:C.corteAccent},
              {l:'🐂 Touros',     v:dados.touros,     c:C.ambar},
              {l:'🐮 Bezerros',   v:dados.bezerros,   c:C.verdeVivo},
              {l:'🐃 Garrotes',   v:dados.garrotes,   c:C.verdeClaro},
              {l:'🐄 Novilhos',   v:dados.novilhos,   c:C.verde},
              {l:'🥩 Boi Gordo',  v:dados.boisGordos, c:C.critico},
            ].map((s,i)=>(
              <div key={i} style={{background:C.bgInput,borderRadius:8,padding:'10px 12px',textAlign:'center'}}>
                <div style={{fontSize:10,color:C.textoMuted,textTransform:'uppercase',fontWeight:600,marginBottom:4}}>{s.l}</div>
                <div style={{fontSize:18,fontWeight:800,color:s.c,fontFamily:'monospace'}}>{s.v}</div>
              </div>
            ))}
          </div>
        </Secao>

        <Secao titulo="Índices de Desempenho — Corte" icon="📈" cor={C.corteAccent}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12}}>
            <CardIndice icon="⚖️" titulo="GMD — Ganho Médio Diário"
              valor={dados.gmdMedio?fmtNum(dados.gmdMedio,2):'—'} unidade="kg/dia"
              meta="1,2–1,5 kg/dia (confinamento)"
              descricao="Média do GMD de todos os animais com pelo menos 2 pesagens."
              status={!dados.gmdMedio?'atencao':dados.gmdMedio>=1.2?'bom':dados.gmdMedio>=0.8?'atencao':'critico'}/>
            <CardIndice icon="⏳" titulo="DEA — Dias Em Aberto"
              valor={dados.dea?fmtNum(dados.dea,0):'—'} unidade="dias"
              meta="Até 120 dias"
              descricao="Dias do parto até a prenhez confirmada. Meta no corte: até 120d."
              status={!dados.dea?'atencao':dados.dea<=120?'bom':dados.dea<=180?'atencao':'critico'}/>
            <CardIndice icon="📅" titulo="IEPA — Intervalo Entre Partos"
              valor={dados.iepa?fmtNum(dados.iepa,0):'—'} unidade="dias"
              meta="365–420 dias"
              descricao="No corte é aceitável até 420 dias (14 meses)."
              status={!dados.iepa?'atencao':dados.iepa<=420?'bom':dados.iepa<=450?'atencao':'critico'}/>
            <CardIndice icon="🐣" titulo="Taxa de Natalidade"
              valor={dados.txNatalidade?fmtNum(dados.txNatalidade,0):'—'} unidade="%"
              meta="Acima de 80%"
              descricao="Partos registrados / vacas em reprodução × 100."
              status={!dados.txNatalidade?'atencao':dados.txNatalidade>=80?'bom':dados.txNatalidade>=60?'atencao':'critico'}/>
          </div>
        </Secao>
      </>)}

      {/* ══ NASCIMENTOS (ambos) ══ */}
      <Secao titulo="Nascimentos Registrados" icon="🐣" cor={C.verdeVivo}>
        {dados.nascimentos.totalN===0?(
          <div style={{color:C.textoMuted,fontSize:13,padding:16,textAlign:'center'}}>
            Nenhum parto registrado. Cadastre partos na aba Reprodução.
          </div>
        ):(
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
            {[
              {l:'Total partos',   v:dados.nascimentos.totalN,                                            c:C.texto},
              {l:'🚺 Fêmeas',     v:`${dados.nascimentos.femeas} (${fmtNum(dados.nascimentos.pctF,0)}%)`,c:C.leiteAccent},
              {l:'🚹 Machos',     v:`${dados.nascimentos.machos} (${fmtNum(dados.nascimentos.pctM,0)}%)`,c:C.ambar},
              {l:'💀 Natimortos', v:`${dados.nascimentos.natimortos} (${fmtNum(dados.nascimentos.pctN,1)}%)`,c:dados.nascimentos.natimortos>0?C.critico:C.verdeClaro},
            ].map((s,i)=>(
              <div key={i} style={{background:C.bgInput,borderRadius:8,padding:'12px',textAlign:'center'}}>
                <div style={{fontSize:10,color:C.textoMuted,textTransform:'uppercase',fontWeight:600,marginBottom:4}}>{s.l}</div>
                <div style={{fontSize:18,fontWeight:800,color:s.c,fontFamily:'monospace'}}>{s.v}</div>
              </div>
            ))}
          </div>
        )}
      </Secao>

      {/* ══ GENEALOGIA (ambos) ══ */}
      <Secao titulo="Genealogia — Relação Mãe × Filha" icon="🧬" cor={C.ambar}>
        {dados.genealogia.length===0?(
          <div style={{color:C.textoMuted,fontSize:13}}>Cadastre o brinco da mãe ao registrar animais para ver a genealogia.</div>
        ):(
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead>
              <tr style={{borderBottom:`2px solid ${C.border}`}}>
                {['Brinco','Nome','Mãe (Brinco)','Nome da Mãe','Cat. da Mãe'].map(h=>(
                  <th key={h} style={{padding:'8px 12px',textAlign:'left',color:C.textoMuted,fontSize:11,textTransform:'uppercase',fontWeight:600}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dados.genealogia.map((g,i)=>(
                <tr key={i} style={{borderBottom:`1px solid ${C.border}`}}>
                  <td style={{padding:'8px 12px',color:C.ambar,fontWeight:700}}>#{g.brinco}</td>
                  <td style={{padding:'8px 12px',color:C.texto}}>{g.nome||'—'}</td>
                  <td style={{padding:'8px 12px',color:C.leiteAccent,fontWeight:700}}>#{g.mae_brinco}</td>
                  <td style={{padding:'8px 12px',color:C.textoSub}}>{g.mae_nome||'—'}</td>
                  <td style={{padding:'8px 12px',color:C.textoMuted,textTransform:'capitalize'}}>{g.mae_cat||'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Secao>

      <div style={{textAlign:'center',marginTop:8}}>
        <button onClick={calcularIndices} style={{padding:'8px 20px',borderRadius:8,border:`1px solid ${C.border}`,background:C.bgCard,color:C.textoMuted,fontSize:12,cursor:'pointer'}}>
          🔄 Recalcular índices
        </button>
      </div>
    </div>
  )
}
