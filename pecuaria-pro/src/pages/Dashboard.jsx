import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { supabase } from '../utils/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { C, getCor, fmtBRL, fmtNum, fmtMes, hoje, gerarPDFRelatorio } from '../utils/helpers.js'

function KPI({ icon, label, valor, sub, cor, delay = 0, onClick }) {
  return (
    <div className={`fade-up delay-${delay}`} onClick={onClick} style={{
      background: C.bgCard, border: `1px solid ${C.border}`,
      borderTop: `3px solid ${cor}`, borderRadius: 12, padding: '18px 20px',
      cursor: onClick ? 'pointer' : 'default', transition: 'transform 0.15s',
    }}
    onMouseEnter={e => onClick && (e.currentTarget.style.transform = 'translateY(-2px)')}
    onMouseLeave={e => onClick && (e.currentTarget.style.transform = 'translateY(0)')}>
      <div style={{ fontSize: 11, color: C.textoMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: cor, fontFamily: "'Syne', sans-serif", letterSpacing: '-0.5px', lineHeight: 1 }}>
        {valor}
      </div>
      {sub && <div style={{ fontSize: 11, color: C.textoSub, marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

function Tip({ active, payload, label, prefix='', suffix='' }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
      <div style={{ color: C.textoMuted, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontWeight: 700 }}>{p.name}: {prefix}{fmtNum(p.value,1)}{suffix}</div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const { user, perfil } = useAuth()
  const navigate = useNavigate()
  const seg = perfil?.segmento
  const { accent } = getCor(seg || 'leite')
  const [stats, setStats] = useState({ totalAnimais:0, alertas:[], carencias:0, totalLitrosHoje:0, estoquesBaixos:0, receitaMes:0, despesaMes:0 })
  const [grafProd, setGrafProd] = useState([])
  const [grafFin,  setGrafFin]  = useState([])
  const [carregando, setCarregando] = useState(true)
  const [gerandoPDF, setGerandoPDF] = useState(false)
  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  useEffect(() => {
    if (!user) return
    async function load() {
      const mesAtual = hoje().slice(0,7)
      const dias30 = new Date(Date.now()-30*86400000).toISOString().split('T')[0]

      const [animRes, alertRes, estRes, recRes, desRes] = await Promise.all([
        supabase.from('animais').select('id,categoria').eq('user_id',user.id).eq('segmento',seg||'leite').eq('ativo',true),
        supabase.from('alertas').select('*').eq('user_id',user.id).eq('lido',false).order('data_alerta').limit(8),
        supabase.from('estoque_insumos').select('nome,quantidade,estoque_minimo').eq('user_id',user.id),
        supabase.from('receitas').select('valor,data').eq('user_id',user.id).gte('data', mesAtual+'-01'),
        supabase.from('despesas').select('valor,data').eq('user_id',user.id).gte('data', mesAtual+'-01'),
      ])

      const estoquesBaixos = (estRes.data||[]).filter(i=>parseFloat(i.quantidade)<=parseFloat(i.estoque_minimo||0)).length
      const receitaMes = (recRes.data||[]).reduce((s,r)=>s+parseFloat(r.valor||0),0)
      const despesaMes = (desRes.data||[]).reduce((s,r)=>s+parseFloat(r.valor||0),0)

      let totalLitrosHoje = 0
      let totalPesagens = 0
      let grafProdData = []

      if (seg === 'leite') {
        // Buscar produção de leite
        const prodRes = await supabase.from('producao_leite').select('total_litros,data').eq('user_id',user.id).gte('data', dias30).order('data')
        totalLitrosHoje = (prodRes.data||[]).filter(r=>r.data===hoje()).reduce((s,r)=>s+parseFloat(r.total_litros||0),0)
        const prodMap = {}
        ;(prodRes.data||[]).forEach(r => { prodMap[r.data?.slice(5)] = (prodMap[r.data?.slice(5)]||0)+parseFloat(r.total_litros||0) })
        grafProdData = Array.from({length:14},(_,i)=>{
          const d = new Date(Date.now()-(13-i)*86400000)
          const k = `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
          return { dia: k, litros: prodMap[k]||0 }
        })
      } else {
        // Buscar pesagens para corte
        const pesRes = await supabase.from('pesagens').select('peso_kg,data').eq('user_id',user.id).gte('data', dias30).order('data')
        totalPesagens = (pesRes.data||[]).length
        const pesMap = {}
        ;(pesRes.data||[]).forEach(r => {
          const k = r.data?.slice(5)
          if (!pesMap[k]) pesMap[k] = { total: 0, count: 0 }
          pesMap[k].total += parseFloat(r.peso_kg||0)
          pesMap[k].count++
        })
        grafProdData = Array.from({length:14},(_,i)=>{
          const d = new Date(Date.now()-(13-i)*86400000)
          const k = `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
          const m = pesMap[k]
          return { dia: k, peso: m ? Math.round(m.total/m.count) : 0 }
        })
      }

      const finMap = {}
      ;[...(recRes.data||[])].forEach(r => {
        const m = r.data?.slice(0,7); if(!m) return
        if(!finMap[m]) finMap[m]={mes:m,receitas:0,despesas:0}
        finMap[m].receitas+=parseFloat(r.valor||0)
      })
      ;[...(desRes.data||[])].forEach(r => {
        const m = r.data?.slice(0,7); if(!m) return
        if(!finMap[m]) finMap[m]={mes:m,receitas:0,despesas:0}
        finMap[m].despesas+=parseFloat(r.valor||0)
      })

      setStats({ totalAnimais:(animRes.data||[]).length, alertas:alertRes.data||[], carencias:(alertRes.data||[]).filter(a=>a.tipo?.startsWith('carencia')).length, totalLitrosHoje, totalPesagens, estoquesBaixos, receitaMes, despesaMes })
      setGrafProd(grafProdData)
      setGrafFin(Object.values(finMap))
      setCarregando(false)
    }
    load()
  },[user,seg])

  async function gerarPDF() {
    setGerandoPDF(true)
    try {
      const [animRes,alertRes,recRes,desRes] = await Promise.all([
        supabase.from('animais').select('categoria').eq('user_id',user.id),
        supabase.from('alertas').select('*').eq('user_id',user.id).eq('lido',false),
        supabase.from('receitas').select('valor').eq('user_id',user.id),
        supabase.from('despesas').select('valor').eq('user_id',user.id),
      ])
      const rec = (recRes.data||[]).reduce((s,r)=>s+parseFloat(r.valor||0),0)
      const des = (desRes.data||[]).reduce((s,r)=>s+parseFloat(r.valor||0),0)
      await gerarPDFRelatorio(perfil,{financeiro:{receitas:rec,despesas:des,lucro:rec-des},animais:animRes.data||[],alertas:alertRes.data||[]})
    } finally { setGerandoPDF(false) }
  }

  async function marcarLido(id) {
    await supabase.from('alertas').update({lido:true}).eq('id',id)
    setStats(s=>({...s,alertas:s.alertas.filter(a=>a.id!==id)}))
  }

  if (carregando) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh',flexDirection:'column',gap:12}}>
      <div className="pulse" style={{fontSize:36}}>🐄</div>
      <div style={{color:C.textoMuted,fontSize:13}}>Carregando dados da fazenda...</div>
    </div>
  )

  return (
    <div style={{maxWidth:1100,margin:'0 auto'}}>
      {/* Header */}
      <div className="fade-up" style={{
        background:`linear-gradient(135deg, ${C.verde}66 0%, ${C.bgCard} 65%)`,
        border:`1px solid ${C.border}`, borderRadius:16, padding:'22px 28px',
        marginBottom:24, display:'flex', justifyContent:'space-between', alignItems:'center',
      }}>
        <div>
          <div style={{fontSize:11,color:C.textoSub,fontWeight:600,textTransform:'uppercase',letterSpacing:'1px',marginBottom:4}}>
            {new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})}
          </div>
          <h1 style={{fontFamily:"'Syne',sans-serif",fontSize:28,fontWeight:800,color:C.texto,letterSpacing:'-0.5px'}}>
            {saudacao}, {perfil?.nome?.split(' ')[0]} 👋
          </h1>
          <div style={{color:C.textoSub,fontSize:13,marginTop:4}}>
            {perfil?.fazenda} · {seg==='leite'?'🥛 Pecuária Leiteira':'🥩 Pecuária de Corte'}
          </div>
        </div>
        <button onClick={gerarPDF} disabled={gerandoPDF} style={{
          padding:'10px 20px', borderRadius:8, border:`1.5px solid ${C.ambar}`,
          background:gerandoPDF?C.border:`${C.ambar}22`, color:C.ambar,
          fontWeight:700, fontSize:13, cursor:gerandoPDF?'not-allowed':'pointer',
          display:'flex', alignItems:'center', gap:6,
        }}>
          {gerandoPDF?'⏳ Gerando...':'📄 Relatório PDF'}
        </button>
      </div>

      {/* KPIs — diferentes por segmento */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:24}}>
        <KPI delay={1} icon="🐄" label="Rebanho ativo" valor={stats.totalAnimais} cor={accent} sub="animais ativos" onClick={()=>navigate('/animais')} />
        {seg==='leite'
          ? <KPI delay={2} icon="🥛" label="Litros hoje" valor={`${fmtNum(stats.totalLitrosHoje,1)} L`} cor={C.leiteAccent} sub="produção do dia" onClick={()=>navigate('/producao-leite')} />
          : <KPI delay={2} icon="⚖️" label="Pesagens" valor={stats.totalPesagens||0} cor={C.corteAccent} sub="registradas" onClick={()=>navigate('/pesagens')} />
        }
        <KPI delay={3} icon="💰" label="Receita do mês" valor={fmtBRL(stats.receitaMes)} cor={C.verdeVivo} sub={`Resultado: ${fmtBRL(stats.receitaMes-stats.despesaMes)}`} onClick={()=>navigate('/financeiro')} />
        <KPI delay={4} icon="🔔" label="Alertas ativos" valor={stats.alertas.length} cor={stats.alertas.length>0?C.critico:C.verdeClaro} sub={`${stats.carencias} em carência`} />
      </div>

      {/* Gráficos — diferentes por segmento */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:20}}>

        {/* Gráfico 1: Leite → produção / Corte → pesagens/GMD */}
        <div className="fade-up delay-2" style={{background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:14,padding:20}}>
          <div style={{fontSize:12,fontWeight:700,color:C.textoMuted,textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:16}}>
            {seg==='leite' ? '🥛 Produção — últimos 14 dias' : '⚖️ Pesagens — últimos 14 dias'}
          </div>
          {seg==='leite' ? (
            <ResponsiveContainer width="100%" height={170}>
              <AreaChart data={grafProd} margin={{top:0,right:0,left:-20,bottom:0}}>
                <defs>
                  <linearGradient id="gL" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.leiteAccent} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={C.leiteAccent} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                <XAxis dataKey="dia" tick={{fontSize:10,fill:C.textoMuted}}/>
                <YAxis tick={{fontSize:10,fill:C.textoMuted}}/>
                <Tooltip content={<Tip suffix=" L"/>}/>
                <Area type="monotone" dataKey="litros" name="Litros" stroke={C.leiteAccent} fill="url(#gL)" strokeWidth={2} dot={false}/>
              </AreaChart>
            </ResponsiveContainer>
          ) : grafProd.length > 0 ? (
            <ResponsiveContainer width="100%" height={170}>
              <AreaChart data={grafProd} margin={{top:0,right:0,left:-20,bottom:0}}>
                <defs>
                  <linearGradient id="gC" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.corteAccent} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={C.corteAccent} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                <XAxis dataKey="dia" tick={{fontSize:10,fill:C.textoMuted}}/>
                <YAxis tick={{fontSize:10,fill:C.textoMuted}}/>
                <Tooltip content={<Tip suffix=" kg"/>}/>
                <Area type="monotone" dataKey="peso" name="Peso médio" stroke={C.corteAccent} fill="url(#gC)" strokeWidth={2} dot={false}/>
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{height:170,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:8}}>
              <div style={{fontSize:28}}>⚖️</div>
              <div style={{fontSize:12,color:C.textoMuted,textAlign:'center'}}>Registre pesagens para ver a evolução de peso</div>
              <button onClick={()=>navigate('/pesagens')} style={{marginTop:4,padding:'6px 14px',borderRadius:6,border:`1px solid ${C.corteAccent}`,background:'transparent',color:C.corteAccent,fontSize:11,fontWeight:600,cursor:'pointer'}}>Ir para Pesagens →</button>
            </div>
          )}
        </div>

        <div className="fade-up delay-3" style={{background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:14,padding:20}}>
          <div style={{fontSize:12,fontWeight:700,color:C.textoMuted,textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:16}}>
            💰 Receitas x Despesas
          </div>
          {grafFin.length===0?(
            <div style={{height:170,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:8}}>
              <div style={{fontSize:28}}>📊</div>
              <div style={{fontSize:12,color:C.textoMuted}}>Lance receitas e despesas para ver o gráfico</div>
              <button onClick={()=>navigate('/financeiro')} style={{marginTop:4,padding:'6px 14px',borderRadius:6,border:`1px solid ${C.ambar}`,background:'transparent',color:C.ambar,fontSize:11,fontWeight:600,cursor:'pointer'}}>Ir para Financeiro →</button>
            </div>
          ):(
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={grafFin} margin={{top:0,right:0,left:-20,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                <XAxis dataKey="mes" tick={{fontSize:10,fill:C.textoMuted}} tickFormatter={fmtMes}/>
                <YAxis tick={{fontSize:10,fill:C.textoMuted}}/>
                <Tooltip content={<Tip prefix="R$ "/>}/>
                <Bar dataKey="receitas" name="Receitas" fill={C.verdeClaro} radius={[4,4,0,0]}/>
                <Bar dataKey="despesas" name="Despesas" fill={C.critico} radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Alertas + Atalhos */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
        <div className="fade-up delay-3" style={{background:C.bgCard,border:`1px solid ${stats.alertas.length>0?C.critico:C.border}`,borderRadius:14,overflow:'hidden'}}>
          <div style={{padding:'12px 16px',borderBottom:`1px solid ${C.border}`,background:stats.alertas.length>0?`${C.critico}18`:'transparent',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:12,fontWeight:700,color:stats.alertas.length>0?C.critico:C.textoMuted,textTransform:'uppercase',letterSpacing:'0.5px'}}>🔔 Alertas ({stats.alertas.length})</span>
            {stats.alertas.length>0&&<span className="pulse" style={{width:8,height:8,borderRadius:'50%',background:C.critico,display:'block'}}/>}
          </div>
          <div style={{maxHeight:260,overflowY:'auto'}}>
            {stats.alertas.length===0?(
              <div style={{padding:'24px 16px',textAlign:'center',color:C.verdeClaro,fontSize:13}}>✅ Nenhum alerta pendente</div>
            ):stats.alertas.map((a,i)=>(
              <div key={a.id} className="slide-in" style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'10px 16px',borderBottom:`1px solid ${C.border}`,animationDelay:`${i*0.05}s`}}>
                <div style={{flex:1,marginRight:8}}>
                  <div style={{fontSize:12,fontWeight:600,color:a.tipo?.startsWith('carencia')?C.critico:C.ambar}}>
                    {a.tipo==='carencia_leite'?'🥛':a.tipo==='carencia_carne'?'🥩':'🔔'} {a.titulo}
                  </div>
                  <div style={{fontSize:11,color:C.textoMuted,marginTop:2,lineHeight:1.4}}>{a.descricao}</div>
                </div>
                <button onClick={()=>marcarLido(a.id)} style={{background:'none',border:`1px solid ${C.border}`,borderRadius:5,color:C.textoMuted,fontSize:10,padding:'3px 7px',cursor:'pointer',whiteSpace:'nowrap',flexShrink:0}}>✓</button>
              </div>
            ))}
          </div>
        </div>

        <div className="fade-up delay-4" style={{background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:14,overflow:'hidden'}}>
          <div style={{padding:'12px 16px',borderBottom:`1px solid ${C.border}`}}>
            <span style={{fontSize:12,fontWeight:700,color:C.textoMuted,textTransform:'uppercase',letterSpacing:'0.5px'}}>Acesso rápido</span>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:1,background:C.border}}>
            {(seg==='leite'?[
              {to:'/animais',icon:'🏷️',label:'Animais'},{to:'/producao-leite',icon:'🥛',label:'Produção'},
              {to:'/reproducao',icon:'🐄',label:'Reprodução'},{to:'/sanidade',icon:'💊',label:'Sanidade'},
              {to:'/estoque',icon:'🌽',label:'Estoque'},{to:'/financeiro',icon:'💰',label:'Financeiro'},
            ]:[
              {to:'/animais',icon:'🏷️',label:'Animais'},{to:'/pesagens',icon:'⚖️',label:'Pesagens'},
              {to:'/reproducao',icon:'🐄',label:'Reprodução'},{to:'/sanidade',icon:'💊',label:'Sanidade'},
              {to:'/estoque',icon:'🌽',label:'Estoque'},{to:'/financeiro',icon:'💰',label:'Financeiro'},
            ]).map(a=>(
              <button key={a.to} onClick={()=>navigate(a.to)} style={{background:C.bgCard,border:'none',padding:'18px 8px',cursor:'pointer',textAlign:'center',transition:'background 0.12s'}}
                onMouseEnter={e=>e.currentTarget.style.background=`${accent}18`}
                onMouseLeave={e=>e.currentTarget.style.background=C.bgCard}>
                <div style={{fontSize:22,marginBottom:5}}>{a.icon}</div>
                <div style={{fontSize:11,fontWeight:600,color:C.textoSub}}>{a.label}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mercado — só do segmento ativo */}
      <div className="fade-up delay-4" style={{background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:14,padding:'14px 18px',display:'flex',gap:24,flexWrap:'wrap'}}>
        {(seg==='leite' ? [
          {icon:'🥛',txt:'Leite: R$2,39/L em alta (+10,5% mar/26). Custos pressionados.'},
          {icon:'💧',txt:'Produção nacional crescendo. Importações de lácteos +33%. Médio prazo incerto.'},
          {icon:'🌽',txt:'Ração: milho e soja estáveis. Sal mineral com leve alta.'},
        ] : [
          {icon:'🥩',txt:'Corte: Arroba >R$300 há +1 ano. 10mi cabeças confinadas projetadas.'},
          {icon:'⚖️',txt:'Boi gordo em alta. Custo de reposição pressionado. GMD meta: 1,2-1,5 kg/dia.'},
          {icon:'🌽',txt:'Milho e soja estáveis. Boa janela para compra de insumos.'},
        ]).map((i,x)=>(
          <div key={x} style={{display:'flex',gap:8,fontSize:12,color:C.textoSub,flex:1,minWidth:200}}>
            <span>{i.icon}</span><span style={{lineHeight:1.5}}>{i.txt}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
