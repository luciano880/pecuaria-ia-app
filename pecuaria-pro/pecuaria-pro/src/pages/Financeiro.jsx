import { useState, useMemo, useRef, useEffect } from 'react'
import { useTabela } from '../utils/useTabela.js'
import { supabase } from '../utils/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { C, fmtBRL, fmtNum, fmtData, hoje, chamarIA, exportarExcel } from '../utils/helpers.js'
import { Secao, Tabela, Modal, Campo, Grid, Btn, useToast } from '../components/UI.jsx'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from 'recharts'

const TABELA_IR = [
  { ate: 26963.20, aliq: 0,    deducao: 0 },
  { ate: 33919.80, aliq: 7.5,  deducao: 2022.24 },
  { ate: 45012.60, aliq: 15,   deducao: 4566.23 },
  { ate: 55976.16, aliq: 22.5, deducao: 7942.17 },
  { ate: Infinity, aliq: 27.5, deducao: 10750.57 },
]
function calcIR(base) {
  for (const f of TABELA_IR) {
    if (base <= f.ate) return Math.max(0, base * (f.aliq/100) - f.deducao)
  }
  return 0
}

const CATS_R = ['venda_leite','venda_animal','venda_bezerro','subvencao','servico','arrendamento','outro']
const CATS_D = ['alimentacao','sanidade','reproducao','mao_obra','energia','combustivel','manutencao','arrendamento','impostos','financiamento','sementes_insumos','outro']
const LBL = {
  venda_leite:'Venda de Leite',venda_animal:'Venda de Animal',venda_bezerro:'Venda de Bezerro',
  subvencao:'Subvenção/Pronaf',servico:'Serviço',arrendamento:'Arrendamento',
  alimentacao:'Alimentação Animal',sanidade:'Sanidade',reproducao:'Reprodução',
  mao_obra:'Mão de Obra',energia:'Energia',combustivel:'Combustível',
  manutencao:'Manutenção',impostos:'Impostos/ITR',financiamento:'Financiamento',
  sementes_insumos:'Sementes/Insumos',outro:'Outro',
}

function Tip({active,payload,label,prefix='',suffix=''}) {
  if(!active||!payload?.length) return null
  return (
    <div style={{background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 12px',fontSize:12}}>
      <div style={{color:C.textoMuted,marginBottom:4}}>{label}</div>
      {payload.map((p,i)=><div key={i} style={{color:p.color,fontWeight:700}}>{p.name}: {prefix}{fmtNum(p.value,0)}{suffix}</div>)}
    </div>
  )
}

export default function Financeiro() {
  const { user, perfil } = useAuth()
  const seg = perfil?.segmento
  const { toast, ToastContainer } = useToast()
  const { dados: receitas, loading: loadR, inserir: inserirR, remover: removerR } = useTabela('receitas')
  const { dados: despesas, loading: loadD, inserir: inserirD, remover: removerD } = useTabela('despesas')
  const { dados: contasReceber, loading: loadCR, inserir: inserirCR, atualizar: atualizarCR, carregar: recarregarCR } = useTabela('contas_receber')
  const [aba, setAba] = useState('resumo')
  const [modalR, setModalR] = useState(false)
  const [modalD, setModalD] = useState(false)
  const [modalCR, setModalCR] = useState(false)
  const [anoIR, setAnoIR] = useState(new Date().getFullYear()-1)
  const [relIA, setRelIA] = useState(null)
  const [loadIA, setLoadIA] = useState(false)
  const relRef = useRef(null)

  const vR = {data:hoje(),categoria:'venda_leite',descricao:'',valor:'',quantidade:'',unidade:'L',nota_fiscal:'',comprador:'',obs:''}
  const vD = {data:hoje(),categoria:'alimentacao',descricao:'',valor:'',fornecedor:'',nota_fiscal:'',deducivel_ir:true,obs:''}
  const vCR = {descricao:'',categoria:'cheque',valor:'',data_emissao:hoje(),data_vencimento:'',pagador:'',banco:'',numero_cheque:'',obs:''}
  const [fR, setFR] = useState(vR)
  const [fD, setFD] = useState(vD)
  const [fCR, setFCR] = useState(vCR)
  const sR = (k,v) => setFR(f=>({...f,[k]:v}))
  const sD = (k,v) => setFD(f=>({...f,[k]:v}))
  const sCR = (k,v) => setFCR(f=>({...f,[k]:v}))

  // Verificar contas a receber vencidas/hoje e lançar automaticamente
  async function processarContasVencidas() {
    const hj = hoje()
    const pendentes = contasReceber.filter(c =>
      c.status === 'pendente' && c.data_vencimento <= hj
    )
    for (const conta of pendentes) {
      try {
        // Lançar como receita automaticamente
        const { data: rec } = await supabase.from('receitas').insert({
          user_id: user.id,
          data: conta.data_vencimento,
          categoria: 'outro',
          descricao: `[AUTO] ${conta.descricao} — ${conta.categoria === 'cheque' ? `Cheque ${conta.numero_cheque || ''}` : conta.categoria}`,
          valor: conta.valor,
          comprador: conta.pagador || null,
          obs: `Lançado automaticamente do A Receber`,
        }).select().single()
        // Marcar como recebido
        await atualizarCR(conta.id, {
          status: 'recebido',
          data_recebimento: hj,
          receita_id: rec?.id || null,
        })
        toast(`✅ ${conta.descricao} — R$ ${conta.valor} lançado automaticamente!`)
      } catch(e) {
        console.error('Erro ao processar conta:', e)
      }
    }
    if (pendentes.length > 0) recarregarCR()
  }

  // Processar contas vencidas ao carregar
  useEffect(() => {
    if (contasReceber.length > 0) processarContasVencidas()
  }, [contasReceber.length])
  async function salvarR() {
    if(!fR.valor||!fR.descricao){toast('Preencha valor e descrição','erro');return}
    try{
      await inserirR({
        ...fR,
        valor: fR.valor===''?null:parseFloat(fR.valor),
        quantidade: fR.quantidade===''?null:(fR.quantidade?parseFloat(fR.quantidade):null),
      })
      toast('Receita lançada!');setModalR(false);setFR(vR)
    }catch(e){toast(e.message,'erro')}
  }
  async function salvarD() {
    if(!fD.valor||!fD.descricao){toast('Preencha valor e descrição','erro');return}
    try{
      await inserirD({
        ...fD,
        valor: fD.valor===''?null:parseFloat(fD.valor),
      })
      toast('Despesa lançada!');setModalD(false);setFD(vD)
    }catch(e){toast(e.message,'erro')}
  }

  async function salvarCR() {
    if(!fCR.valor||!fCR.descricao||!fCR.data_vencimento){
      toast('Preencha descrição, valor e data de vencimento','erro'); return
    }
    try{
      await inserirCR({
        ...fCR,
        valor: parseFloat(fCR.valor),
        status: 'pendente',
      })
      toast('Conta a receber cadastrada!')
      setModalCR(false); setFCR(vCR)
    }catch(e){toast(e.message,'erro')}
  }

  async function marcarRecebido(conta) {
    try {
      // Lançar receita
      await supabase.from('receitas').insert({
        user_id: user.id,
        data: hoje(),
        categoria: 'outro',
        descricao: conta.descricao,
        valor: conta.valor,
        comprador: conta.pagador || null,
      })
      await atualizarCR(conta.id, { status: 'recebido', data_recebimento: hoje() })
      toast('✅ Recebido e lançado nas receitas!')
    } catch(e) { toast(e.message,'erro') }
  }

  async function cancelarConta(conta) {
    if (!confirm('Cancelar esta conta?')) return
    await atualizarCR(conta.id, { status: 'cancelado' })
    toast('Conta cancelada')
  }

  const totalRec = receitas.reduce((s,r)=>s+parseFloat(r.valor||0),0)
  const totalDes = despesas.reduce((s,r)=>s+parseFloat(r.valor||0),0)
  const lucro = totalRec - totalDes
  const mesAtual = hoje().slice(0,7)
  const recMes = receitas.filter(r=>r.data?.slice(0,7)===mesAtual).reduce((s,r)=>s+parseFloat(r.valor||0),0)
  const desMes = despesas.filter(r=>r.data?.slice(0,7)===mesAtual).reduce((s,r)=>s+parseFloat(r.valor||0),0)

  const anoAtual = new Date().getFullYear()
  const recAno = receitas.filter(r=>r.data?.startsWith(String(anoAtual))).reduce((s,r)=>s+parseFloat(r.valor||0),0)
  const desAno = despesas.filter(r=>r.data?.startsWith(String(anoAtual))&&r.deducivel_ir).reduce((s,r)=>s+parseFloat(r.valor||0),0)
  const lucTrib = Math.max(0,recAno-desAno)
  const irEst = calcIR(lucTrib)

  const porMes = useMemo(()=>{
    const m={}
    receitas.forEach(r=>{const ms=r.data?.slice(0,7);if(!ms)return;if(!m[ms])m[ms]={mes:ms,receitas:0,despesas:0};m[ms].receitas+=parseFloat(r.valor||0)})
    despesas.forEach(r=>{const ms=r.data?.slice(0,7);if(!ms)return;if(!m[ms])m[ms]={mes:ms,receitas:0,despesas:0};m[ms].despesas+=parseFloat(r.valor||0)})
    return Object.values(m).sort((a,b)=>b.mes.localeCompare(a.mes)).map(x=>({...x,lucro:x.receitas-x.despesas}))
  },[receitas,despesas])

  const porCatR = useMemo(()=>{const m={};receitas.forEach(r=>{m[r.categoria]=(m[r.categoria]||0)+parseFloat(r.valor||0)});return Object.entries(m).sort((a,b)=>b[1]-a[1])},[receitas])
  const porCatD = useMemo(()=>{const m={};despesas.forEach(r=>{m[r.categoria]=(m[r.categoria]||0)+parseFloat(r.valor||0)});return Object.entries(m).sort((a,b)=>b[1]-a[1])},[despesas])

  async function gerarIR() {
    setLoadIA(true);setRelIA(null)
    const rA = receitas.filter(r=>r.data?.startsWith(String(anoIR)))
    const dA = despesas.filter(r=>r.data?.startsWith(String(anoIR)))
    const rB = rA.reduce((s,r)=>s+parseFloat(r.valor||0),0)
    const dD = dA.filter(r=>r.deducivel_ir).reduce((s,r)=>s+parseFloat(r.valor||0),0)
    const lT = Math.max(0,rB-dD)
    const ir = calcIR(lT)
    const rCat={};rA.forEach(r=>{rCat[r.categoria]=(rCat[r.categoria]||0)+parseFloat(r.valor||0)})
    const dCat={};dA.forEach(r=>{dCat[r.categoria]=(dCat[r.categoria]||0)+parseFloat(r.valor||0)})
    try {
      const texto = await chamarIA(`Você é contador especialista em IR rural brasileiro (Lei 8.023/1990, IN RFB 1700/2017, Livro Caixa Rural).

Gere relatório completo para declaração IR:
FAZENDA: ${perfil?.fazenda} | ANO-BASE: ${anoIR} | SEGMENTO: ${seg==='leite'?'Leiteira':'Corte'}

RECEITAS BRUTAS: ${fmtBRL(rB)}
${Object.entries(rCat).map(([k,v])=>`  - ${LBL[k]||k}: ${fmtBRL(v)}`).join('\n')}

DESPESAS DEDUTÍVEIS: ${fmtBRL(dD)}
${Object.entries(dCat).map(([k,v])=>`  - ${LBL[k]||k}: ${fmtBRL(v)}`).join('\n')}

Lucro tributável: ${fmtBRL(lT)} | IR estimado: ${fmtBRL(ir)}

Seções: 1-RESUMO EXECUTIVO 2-RECEITAS 3-DESPESAS DEDUTÍVEIS 4-APURAÇÃO IR 5-ORIENTAÇÕES PARA DECLARAÇÃO 6-ALERTAS E OPORTUNIDADES
Linguagem clara ao produtor. Sem markdown ou asteriscos.`)
      setRelIA(texto)
      await supabase.from('declaracao_ir').upsert({user_id:user.id,ano_base:anoIR,receita_bruta:rB,despesas_dedutiveis:dD,lucro_tributavel:lT,imposto_devido:ir,status:'pronto'},{onConflict:'user_id,ano_base'})
      toast('Relatório IR gerado!')
    } catch(e){toast(e.message,'erro')}
    finally{setLoadIA(false);setTimeout(()=>relRef.current?.scrollIntoView({behavior:'smooth'}),200)}
  }

  function exportarTXT() {
    if(!relIA) return
    const blob = new Blob([`RELATÓRIO IR RURAL\nFazenda: ${perfil?.fazenda}\nAno-base: ${anoIR}\n\n${relIA}`],{type:'text/plain;charset=utf-8'})
    const url=URL.createObjectURL(blob)
    const a=document.createElement('a');a.href=url;a.download=`IR_${perfil?.fazenda}_${anoIR}.txt`;a.click()
    URL.revokeObjectURL(url);toast('Exportado!')
  }

  async function exportarXLSX() {
    try {
      await exportarExcel(`Financeiro_${perfil?.fazenda}`,[
        {nome:'Receitas',dados:receitas.map(r=>({Data:r.data,Categoria:LBL[r.categoria]||r.categoria,Descrição:r.descricao,Valor:r.valor,Comprador:r.comprador||''}))},
        {nome:'Despesas',dados:despesas.map(r=>({Data:r.data,Categoria:LBL[r.categoria]||r.categoria,Descrição:r.descricao,Valor:r.valor,Fornecedor:r.fornecedor||'',Dedutível:r.deducivel_ir?'Sim':'Não'}))},
        {nome:'Resumo Mensal',dados:porMes.map(m=>({Mês:m.mes,Receitas:m.receitas.toFixed(2),Despesas:m.despesas.toFixed(2),Resultado:m.lucro.toFixed(2)}))},
      ])
      toast('Excel exportado!')
    } catch(e){toast(e.message,'erro')}
  }

  const abas=[
    {id:'resumo',l:'📊 Resumo'},
    {id:'receitas',l:'💰 Receitas'},
    {id:'despesas',l:'💸 Despesas'},
    {id:'receber',l:`📬 A Receber ${contasReceber.filter(c=>c.status==='pendente').length > 0 ? `(${contasReceber.filter(c=>c.status==='pendente').length})` : ''}`},
    {id:'ir',l:'📋 IR Rural'},
  ]

  return (
    <div style={{maxWidth:1000,margin:'0 auto'}}>
      <ToastContainer/>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <div>
          <h2 style={{fontSize:22,fontWeight:800,color:C.ambar,fontFamily:"'Syne',sans-serif"}}>💰 Financeiro</h2>
          <p style={{color:C.textoMuted,fontSize:13}}>Receitas, despesas, custo de produção e IR rural</p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <Btn cor={C.verdeClaro} onClick={()=>setModalR(true)}>+ Receita</Btn>
          <Btn cor={C.critico} outline onClick={()=>setModalD(true)}>+ Despesa</Btn>
          <Btn cor={C.ambar} outline onClick={()=>setModalCR(true)}>📬 + A Receber</Btn>
          <Btn cor={C.ambar} outline onClick={exportarXLSX}>📥 Excel</Btn>
        </div>
      </div>

      {/* Cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:20}}>
        {[
          {l:'Receita total',v:fmtBRL(totalRec),c:C.verdeClaro},
          {l:'Despesa total',v:fmtBRL(totalDes),c:C.critico},
          {l:'Resultado total',v:fmtBRL(lucro),c:lucro>=0?C.verdeVivo:C.critico},
          {l:`IR estimado ${anoAtual}`,v:fmtBRL(irEst),c:C.ambar},
        ].map((s,i)=>(
          <div key={i} style={{background:C.bgCard,border:`1px solid ${C.border}`,borderLeft:`3px solid ${s.c}`,borderRadius:10,padding:'12px 14px'}}>
            <div style={{fontSize:10,color:C.textoMuted,textTransform:'uppercase',fontWeight:600}}>{s.l}</div>
            <div style={{fontSize:18,fontWeight:800,color:s.c,fontFamily:"'Syne',sans-serif",marginTop:4}}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Abas */}
      <div style={{display:'flex',gap:2,marginBottom:16,borderBottom:`1px solid ${C.border}`,flexWrap:'wrap'}}>
        {abas.map(a=>(
          <button key={a.id} onClick={()=>setAba(a.id)} style={{padding:'8px 14px',border:'none',background:'transparent',borderBottom:aba===a.id?`2px solid ${C.ambar}`:'2px solid transparent',color:aba===a.id?C.ambar:C.textoMuted,fontSize:12,fontWeight:600,cursor:'pointer'}}>{a.l}</button>
        ))}
      </div>

      {aba==='resumo'&&(
        <>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:16}}>
            {[{l:'Receitas do mês',v:fmtBRL(recMes),c:C.verdeClaro},{l:'Despesas do mês',v:fmtBRL(desMes),c:C.critico},{l:'Resultado do mês',v:fmtBRL(recMes-desMes),c:recMes>=desMes?C.verdeVivo:C.critico}].map((s,i)=>(
              <div key={i} style={{background:C.bgInput,borderRadius:8,padding:'10px 12px'}}>
                <div style={{fontSize:10,color:C.textoMuted,textTransform:'uppercase',fontWeight:600}}>{s.l}</div>
                <div style={{fontSize:18,fontWeight:800,color:s.c,fontFamily:"monospace",marginTop:4}}>{s.v}</div>
              </div>
            ))}
          </div>
          <Secao titulo="Evolução Mensal" icon="📈">
            {porMes.length===0?(
              <div style={{textAlign:'center',padding:24,color:C.textoMuted,fontSize:13}}>Lance receitas e despesas para ver a evolução mensal</div>
            ):(
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={porMes.slice(0,6).reverse()} margin={{top:0,right:0,left:-10,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                  <XAxis dataKey="mes" tick={{fontSize:10,fill:C.textoMuted}}/>
                  <YAxis tick={{fontSize:10,fill:C.textoMuted}}/>
                  <Tooltip content={<Tip prefix="R$ "/>}/>
                  <Bar dataKey="receitas" name="Receitas" fill={C.verdeClaro} radius={[4,4,0,0]}/>
                  <Bar dataKey="despesas" name="Despesas" fill={C.critico} radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Secao>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            <Secao titulo="Receitas por categoria" icon="💰" cor={C.verdeClaro}>
              {porCatR.map(([cat,val])=>(
                <div key={cat} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:`1px solid ${C.border}`,fontSize:12}}>
                  <span style={{color:C.textoSub}}>{LBL[cat]||cat}</span>
                  <span style={{color:C.verdeClaro,fontWeight:700}}>{fmtBRL(val)}</span>
                </div>
              ))}
              {porCatR.length===0&&<div style={{color:C.textoMuted,fontSize:12}}>Nenhuma receita ainda</div>}
            </Secao>
            <Secao titulo="Despesas por categoria" icon="💸" cor={C.critico}>
              {porCatD.map(([cat,val])=>(
                <div key={cat} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:`1px solid ${C.border}`,fontSize:12}}>
                  <span style={{color:C.textoSub}}>{LBL[cat]||cat}</span>
                  <span style={{color:C.critico,fontWeight:700}}>{fmtBRL(val)}</span>
                </div>
              ))}
              {porCatD.length===0&&<div style={{color:C.textoMuted,fontSize:12}}>Nenhuma despesa ainda</div>}
            </Secao>
          </div>
        </>
      )}

      {aba==='receitas'&&(
        <Secao titulo={`${receitas.length} receitas`} icon="💰" cor={C.verdeClaro} acao={<Btn size="sm" cor={C.verdeClaro} onClick={()=>setModalR(true)}>+ Nova</Btn>}>
          <Tabela colunas={[
            {key:'data',label:'Data',render:r=>fmtData(r.data)},
            {key:'categoria',label:'Categoria',render:r=>LBL[r.categoria]||r.categoria},
            {key:'descricao',label:'Descrição'},
            {key:'quantidade',label:'Qtd',render:r=>r.quantidade?`${fmtNum(r.quantidade,1)} ${r.unidade||''}`:'—'},
            {key:'valor',label:'Valor',render:r=><strong style={{color:C.verdeClaro}}>{fmtBRL(r.valor)}</strong>},
            {key:'comprador',label:'Cliente'},
          ]} dados={receitas} loading={loadR} onDelete={r=>{if(confirm('Excluir?'))removerR(r.id)}}/>
        </Secao>
      )}

      {aba==='despesas'&&(
        <Secao titulo={`${despesas.length} despesas`} icon="💸" cor={C.critico} acao={<Btn size="sm" cor={C.critico} onClick={()=>setModalD(true)}>+ Nova</Btn>}>
          <Tabela colunas={[
            {key:'data',label:'Data',render:r=>fmtData(r.data)},
            {key:'categoria',label:'Categoria',render:r=>LBL[r.categoria]||r.categoria},
            {key:'descricao',label:'Descrição'},
            {key:'valor',label:'Valor',render:r=><strong style={{color:C.critico}}>{fmtBRL(r.valor)}</strong>},
            {key:'deducivel_ir',label:'Ded.IR',render:r=>r.deducivel_ir?<span style={{color:C.verdeClaro}}>✓</span>:'—'},
            {key:'fornecedor',label:'Fornecedor'},
          ]} dados={despesas} loading={loadD} onDelete={r=>{if(confirm('Excluir?'))removerD(r.id)}}/>
        </Secao>
      )}

      {aba==='receber'&&(
        <>
          {/* Cards resumo */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:16}}>
            {[
              {l:'Pendentes',v:contasReceber.filter(c=>c.status==='pendente').length,val:fmtBRL(contasReceber.filter(c=>c.status==='pendente').reduce((s,c)=>s+parseFloat(c.valor||0),0)),c:C.ambar},
              {l:'Vencidos hoje',v:contasReceber.filter(c=>c.status==='pendente'&&c.data_vencimento<=hoje()).length,val:'',c:C.critico},
              {l:'Recebidos',v:contasReceber.filter(c=>c.status==='recebido').length,val:fmtBRL(contasReceber.filter(c=>c.status==='recebido').reduce((s,c)=>s+parseFloat(c.valor||0),0)),c:C.verdeClaro},
            ].map((s,i)=>(
              <div key={i} style={{background:C.bgCard,border:`1px solid ${C.border}`,borderLeft:`3px solid ${s.c}`,borderRadius:10,padding:'12px 14px'}}>
                <div style={{fontSize:10,color:C.textoMuted,textTransform:'uppercase',fontWeight:600}}>{s.l}</div>
                <div style={{fontSize:22,fontWeight:800,color:s.c,fontFamily:'monospace',marginTop:4}}>{s.v}</div>
                {s.val&&<div style={{fontSize:11,color:C.textoSub,marginTop:2}}>{s.val}</div>}
              </div>
            ))}
          </div>

          {/* Lista de contas */}
          <Secao titulo="Contas a Receber" icon="📬" cor={C.ambar}
            acao={<Btn size="sm" cor={C.ambar} onClick={()=>setModalCR(true)}>+ Nova</Btn>}>
            {contasReceber.length===0?(
              <div style={{color:C.textoMuted,padding:24,textAlign:'center'}}>Nenhuma conta cadastrada</div>
            ):contasReceber.map(c=>{
              const diasRestantes = Math.ceil((new Date(c.data_vencimento)-new Date())/(1000*60*60*24))
              const vencido = diasRestantes < 0 && c.status==='pendente'
              const venceHoje = diasRestantes === 0 && c.status==='pendente'
              return (
                <div key={c.id} style={{
                  padding:'14px 0', borderBottom:`1px solid ${C.border}`,
                  display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12
                }}>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                      <span style={{
                        fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:4,
                        background: c.status==='recebido'?`${C.verdeClaro}22`:vencido?`${C.critico}22`:venceHoje?`${C.ambar}22`:`${C.ambar}11`,
                        color: c.status==='recebido'?C.verdeClaro:vencido?C.critico:venceHoje?C.ambar:C.textoMuted,
                      }}>
                        {c.status==='recebido'?'✅ RECEBIDO':vencido?'🚨 VENCIDO':venceHoje?'⚠️ VENCE HOJE':'⏳ PENDENTE'}
                      </span>
                      <span style={{fontSize:12,color:C.textoMuted}}>{c.categoria?.toUpperCase()}</span>
                      {c.numero_cheque&&<span style={{fontSize:11,color:C.textoMuted}}>Nº {c.numero_cheque}</span>}
                    </div>
                    <div style={{fontSize:14,fontWeight:600,color:C.texto}}>{c.descricao}</div>
                    <div style={{fontSize:12,color:C.textoMuted,marginTop:3}}>
                      {c.pagador&&`${c.pagador} · `}
                      Emissão: {fmtData(c.data_emissao)} →
                      Vencimento: <strong style={{color:vencido?C.critico:venceHoje?C.ambar:C.texto}}>{fmtData(c.data_vencimento)}</strong>
                      {c.status==='pendente'&&diasRestantes>0&&<span style={{color:C.textoMuted}}> ({diasRestantes}d)</span>}
                    </div>
                  </div>
                  <div style={{textAlign:'right',flexShrink:0}}>
                    <div style={{fontSize:18,fontWeight:800,color:c.status==='recebido'?C.verdeClaro:C.ambar,fontFamily:'monospace'}}>
                      {fmtBRL(c.valor)}
                    </div>
                    {c.status==='pendente'&&(
                      <div style={{display:'flex',gap:6,marginTop:6,justifyContent:'flex-end'}}>
                        <Btn size="sm" cor={C.verdeClaro} onClick={()=>marcarRecebido(c)}>✅ Recebido</Btn>
                        <Btn size="sm" cor={C.critico} outline onClick={()=>cancelarConta(c)}>✗</Btn>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </Secao>
        </>
      )}

      {aba==='ir'&&(
        <>
          <Secao titulo="Apuração IR — Atividade Rural" icon="📋" cor={C.ambar}>
            <p style={{fontSize:12,color:C.textoMuted,marginBottom:16,lineHeight:1.7}}>
              Base legal: Lei 8.023/1990 · IN RFB 1700/2017 · Livro Caixa Rural
            </p>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:16}}>
              {[{l:`Receita bruta ${anoAtual}`,v:fmtBRL(recAno),c:C.verdeClaro},{l:`Despesas dedutíveis`,v:fmtBRL(desAno),c:C.critico},{l:'IR estimado',v:fmtBRL(irEst),c:C.ambar}].map((s,i)=>(
                <div key={i} style={{background:C.bgInput,borderRadius:8,padding:'10px 12px'}}>
                  <div style={{fontSize:10,color:C.textoMuted,textTransform:'uppercase',fontWeight:600}}>{s.l}</div>
                  <div style={{fontSize:18,fontWeight:800,color:s.c,fontFamily:'monospace',marginTop:4}}>{s.v}</div>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:10,alignItems:'flex-end',flexWrap:'wrap'}}>
              <div>
                <label style={{fontSize:11,color:C.textoSub,fontWeight:600,display:'block',marginBottom:4}}>ANO-BASE</label>
                <select value={anoIR} onChange={e=>setAnoIR(parseInt(e.target.value))} style={{padding:'8px 12px',borderRadius:6,border:`1.5px solid ${C.border}`,background:C.bgInput,color:C.texto,fontSize:13}}>
                  {[anoAtual-1,anoAtual-2,anoAtual-3].map(a=><option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <button onClick={gerarIR} disabled={loadIA} style={{flex:1,padding:'11px 0',borderRadius:8,border:'none',background:loadIA?C.border:C.ambar,color:'#fff',fontWeight:700,fontSize:13,cursor:loadIA?'not-allowed':'pointer'}}>
                {loadIA?'⏳ Gerando com IA...':'🤖 Gerar Relatório IR'}
              </button>
            </div>
          </Secao>
          {relIA&&(
            <div ref={relRef} style={{background:C.bgCard,border:`2px solid ${C.ambar}`,borderRadius:12,overflow:'hidden'}}>
              <div style={{background:C.ambar,padding:'10px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{color:'#fff',fontWeight:700,fontSize:13}}>📋 Relatório IR — {perfil?.fazenda} — {anoIR}</span>
                <button onClick={exportarTXT} style={{background:'transparent',border:'1px solid #fff',borderRadius:6,color:'#fff',fontSize:11,fontWeight:600,padding:'4px 10px',cursor:'pointer'}}>⬇️ .txt</button>
              </div>
              <div style={{padding:'18px 20px',fontSize:13,lineHeight:1.9,whiteSpace:'pre-wrap',color:C.texto}}>{relIA}</div>
            </div>
          )}
        </>
      )}

      {/* Modal A Receber */}
      {modalCR&&(
        <Modal titulo="Cadastrar Conta a Receber" onClose={()=>setModalCR(false)}>
          <Grid cols={2}>
            <Campo label="Tipo" type="select" value={fCR.categoria} onChange={v=>sCR('categoria',v)}
              options={[
                {value:'cheque',label:'💵 Cheque'},
                {value:'duplicata',label:'📄 Duplicata'},
                {value:'pix_agendado',label:'📲 PIX Agendado'},
                {value:'boleto',label:'🏦 Boleto'},
                {value:'outro',label:'📦 Outro'},
              ]}/>
            <Campo label="Nº Cheque / Referência" value={fCR.numero_cheque} onChange={v=>sCR('numero_cheque',v)} placeholder="ex: 000123"/>
          </Grid>
          <Campo label="Descrição" value={fCR.descricao} onChange={v=>sCR('descricao',v)} required placeholder="ex: Venda de 3 bezerros — João Silva"/>
          <Grid cols={2}>
            <Campo label="Valor (R$)" type="number" step="0.01" value={fCR.valor} onChange={v=>sCR('valor',v)} required/>
            <Campo label="Pagador / Devedor" value={fCR.pagador} onChange={v=>sCR('pagador',v)} placeholder="Nome de quem vai pagar"/>
          </Grid>
          <Grid cols={2}>
            <Campo label="Data de emissão" type="date" value={fCR.data_emissao} onChange={v=>sCR('data_emissao',v)}/>
            <Campo label="Data de vencimento" type="date" value={fCR.data_vencimento} onChange={v=>sCR('data_vencimento',v)} required/>
          </Grid>
          <Campo label="Banco" value={fCR.banco} onChange={v=>sCR('banco',v)} placeholder="ex: Banco do Brasil, Sicoob..."/>
          <Campo label="Observações" type="textarea" value={fCR.obs} onChange={v=>sCR('obs',v)}/>
          <div style={{background:`${C.ambar}18`,border:`1px solid ${C.ambar}`,borderRadius:6,padding:'8px 12px',fontSize:12,color:C.textoSub,marginBottom:12}}>
            💡 Quando chegar a data de vencimento, o sistema lança automaticamente nas receitas e marca como recebido.
          </div>
          <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
            <Btn outline cor={C.textoMuted} onClick={()=>setModalCR(false)}>Cancelar</Btn>
            <Btn cor={C.ambar} onClick={salvarCR}>📬 Cadastrar</Btn>
          </div>
        </Modal>
      )}

      {/* Modal Receita */}
      {modalR&&(
        <Modal titulo="Lançar Receita" onClose={()=>setModalR(false)}>
          <Grid cols={2}>
            <Campo label="Data" type="date" value={fR.data} onChange={v=>sR('data',v)} required/>
            <Campo label="Categoria" type="select" value={fR.categoria} onChange={v=>sR('categoria',v)} options={CATS_R.map(c=>({value:c,label:LBL[c]}))}/>
          </Grid>
          <Campo label="Descrição" value={fR.descricao} onChange={v=>sR('descricao',v)} required/>
          <Grid cols={3}>
            <Campo label="Valor (R$)" type="number" step="0.01" value={fR.valor} onChange={v=>sR('valor',v)} required/>
            <Campo label="Quantidade" type="number" step="0.1" value={fR.quantidade} onChange={v=>sR('quantidade',v)}/>
            <Campo label="Unidade" value={fR.unidade} onChange={v=>sR('unidade',v)}/>
          </Grid>
          <Grid cols={2}>
            <Campo label="Comprador/Cliente" value={fR.comprador} onChange={v=>sR('comprador',v)}/>
            <Campo label="Nº Nota Fiscal" value={fR.nota_fiscal} onChange={v=>sR('nota_fiscal',v)}/>
          </Grid>
          <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:8}}>
            <Btn outline cor={C.textoMuted} onClick={()=>setModalR(false)}>Cancelar</Btn>
            <Btn cor={C.verdeClaro} onClick={salvarR}>Lançar</Btn>
          </div>
        </Modal>
      )}

      {/* Modal Despesa */}
      {modalD&&(
        <Modal titulo="Lançar Despesa" onClose={()=>setModalD(false)}>
          <Grid cols={2}>
            <Campo label="Data" type="date" value={fD.data} onChange={v=>sD('data',v)} required/>
            <Campo label="Categoria" type="select" value={fD.categoria} onChange={v=>sD('categoria',v)} options={CATS_D.map(c=>({value:c,label:LBL[c]}))}/>
          </Grid>
          <Campo label="Descrição" value={fD.descricao} onChange={v=>sD('descricao',v)} required/>
          <Grid cols={2}>
            <Campo label="Valor (R$)" type="number" step="0.01" value={fD.valor} onChange={v=>sD('valor',v)} required/>
            <Campo label="Fornecedor" value={fD.fornecedor} onChange={v=>sD('fornecedor',v)}/>
          </Grid>
          <Grid cols={2}>
            <Campo label="Nº Nota Fiscal" value={fD.nota_fiscal} onChange={v=>sD('nota_fiscal',v)}/>
            <div style={{marginBottom:12}}>
              <label style={{display:'block',fontSize:11,color:C.textoSub,marginBottom:4,fontWeight:600}}>Dedutível no IR?</label>
              <div style={{display:'flex',gap:8}}>
                {[{v:true,l:'✓ Sim'},{v:false,l:'✗ Não'}].map(o=>(
                  <button key={String(o.v)} onClick={()=>sD('deducivel_ir',o.v)} style={{flex:1,padding:'8px',borderRadius:6,border:`1.5px solid ${fD.deducivel_ir===o.v?(o.v?C.verdeClaro:C.critico):C.border}`,background:fD.deducivel_ir===o.v?`${o.v?C.verdeClaro:C.critico}22`:C.bgInput,color:fD.deducivel_ir===o.v?(o.v?C.verdeClaro:C.critico):C.textoMuted,fontSize:12,fontWeight:600,cursor:'pointer'}}>{o.l}</button>
                ))}
              </div>
            </div>
          </Grid>
          <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:8}}>
            <Btn outline cor={C.textoMuted} onClick={()=>setModalD(false)}>Cancelar</Btn>
            <Btn cor={C.critico} onClick={salvarD}>Lançar</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}
