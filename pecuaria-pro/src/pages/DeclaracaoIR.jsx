import { useState, useEffect, useRef } from 'react'
import { supabase } from '../utils/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { C, fmtBRL, fmtNum, fmtData, hoje, chamarIA } from '../utils/helpers.js'
import { Secao, Btn, useToast } from '../components/UI.jsx'

// ── Tabelas progressivas IR 2025 (ano-base 2024) ─────────────
const TABELA_IR_PF = [
  { ate: 26963.20, aliq: 0,    ded: 0        },
  { ate: 33919.80, aliq: 7.5,  ded: 2022.24  },
  { ate: 45012.60, aliq: 15,   ded: 4566.23  },
  { ate: 55976.16, aliq: 22.5, ded: 7942.17  },
  { ate: Infinity, aliq: 27.5, ded: 10750.57 },
]
function calcIRPF(base) {
  for (const f of TABELA_IR_PF) {
    if (base <= f.ate) return Math.max(0, base*(f.aliq/100) - f.ded)
  }
  return 0
}

// IR Atividade Rural — 20% do lucro (simplificado Livro Caixa)
function calcIRRural(lucro) {
  return Math.max(0, lucro * 0.20)
}

const CATS_R_RURAL = { venda_leite:'Venda de Leite', venda_animal:'Venda de Animal', venda_bezerro:'Venda de Bezerro', subvencao:'Subvenção/Pronaf', servico:'Serviço', arrendamento:'Arrendamento', outro:'Outro' }
const CATS_D_RURAL = { alimentacao:'Alimentação Animal', sanidade:'Sanidade', reproducao:'Reprodução', mao_obra:'Mão de Obra', energia:'Energia', combustivel:'Combustível', manutencao:'Manutenção', arrendamento:'Arrendamento', impostos:'Impostos/ITR', financiamento:'Financiamento', sementes_insumos:'Sementes/Insumos', outro:'Outro' }
const CATS_R_PF    = { salario:'Salário/Pró-labore', freela:'Freelance/Bico', aluguel_rec:'Aluguel Recebido', investimento:'Investimentos', bonus:'Bônus/Presente', outro:'Outro' }
const CATS_D_PF    = { moradia:'Moradia/Aluguel', saude:'Saúde/Plano', educacao:'Educação', outros_dedutiveis:'Outros Dedutíveis' }

export default function DeclaracaoIR() {
  const { user, perfil } = useAuth()
  const { toast, ToastContainer } = useToast()
  const anoAtual = new Date().getFullYear()
  const [anoBase, setAnoBase] = useState(anoAtual - 1)
  const [dados,   setDados]   = useState(null)
  const [loadIA,  setLoadIA]  = useState(false)
  const [relIA,   setRelIA]   = useState(null)
  const [carregando, setCarregando] = useState(false)
  const relRef = useRef(null)

  useEffect(() => { if (user) carregar() }, [user, anoBase])

  async function carregar() {
    setCarregando(true)
    try {
      const ini = `${anoBase}-01-01`
      const fim = `${anoBase}-12-31`

      const [recRuralRes, desRuralRes, recPFRes, desPFRes] = await Promise.all([
        supabase.from('receitas').select('*').eq('user_id',user.id).gte('data',ini).lte('data',fim),
        supabase.from('despesas').select('*').eq('user_id',user.id).gte('data',ini).lte('data',fim),
        supabase.from('receitas_pessoal').select('*').eq('user_id',user.id).gte('data',ini).lte('data',fim),
        supabase.from('despesas_pessoal').select('*').eq('user_id',user.id).gte('data',ini).lte('data',fim),
      ])

      const recRural = recRuralRes.data || []
      const desRural = desRuralRes.data || []
      const recPF    = recPFRes.data    || []
      const desPF    = desPFRes.data    || []

      // ── Rural ──
      const totalRecRural = recRural.reduce((s,r)=>s+parseFloat(r.valor||0),0)
      const totalDesRural = desRural.filter(d=>d.deducivel_ir).reduce((s,r)=>s+parseFloat(r.valor||0),0)
      const lucroRural    = Math.max(0, totalRecRural - totalDesRural)
      const irRural       = calcIRRural(lucroRural)

      // Agrupar por categoria
      const recRuralCat = {}; recRural.forEach(r=>{ recRuralCat[r.categoria]=(recRuralCat[r.categoria]||0)+parseFloat(r.valor||0) })
      const desRuralCat = {}; desRural.filter(d=>d.deducivel_ir).forEach(r=>{ desRuralCat[r.categoria]=(desRuralCat[r.categoria]||0)+parseFloat(r.valor||0) })

      // ── Pessoal ──
      const totalRecPF = recPF.reduce((s,r)=>s+parseFloat(r.valor||0),0)
      const totalDesPF = desPF.filter(d=>['saude','educacao','outros_dedutiveis'].includes(d.categoria)).reduce((s,r)=>s+parseFloat(r.valor||0),0)
      const basePF     = Math.max(0, totalRecPF - totalDesPF)
      const irPF       = calcIRPF(basePF)

      const recPFCat = {}; recPF.forEach(r=>{ recPFCat[r.categoria]=(recPFCat[r.categoria]||0)+parseFloat(r.valor||0) })
      const desPFCat = {}; desPF.filter(d=>['saude','educacao','outros_dedutiveis'].includes(d.categoria)).forEach(r=>{ desPFCat[r.categoria]=(desPFCat[r.categoria]||0)+parseFloat(r.valor||0) })

      // ── Total ──
      const baseTotal  = lucroRural + basePF
      const irTotal    = irRural + irPF
      const irJaPago   = 0 // pode ser implementado futuramente
      const irDevido   = Math.max(0, irTotal - irJaPago)

      setDados({ anoBase, recRural, desRural, recPF, desPF, totalRecRural, totalDesRural, lucroRural, irRural, recRuralCat, desRuralCat, totalRecPF, totalDesPF, basePF, irPF, recPFCat, desPFCat, baseTotal, irTotal, irDevido })
    } catch(e) { toast(e.message,'erro') }
    finally { setCarregando(false) }
  }

  async function gerarRelatorioIA() {
    if (!dados) return
    setLoadIA(true); setRelIA(null)
    try {
      const txt = await chamarIA(`Você é contador especialista em IR pessoa física e atividade rural brasileira.

DECLARAÇÃO IR — ${perfil?.nome} — ${perfil?.fazenda} — ANO-BASE: ${dados.anoBase}

=== ATIVIDADE RURAL (Lei 8.023/1990) ===
Receita bruta rural: ${fmtBRL(dados.totalRecRural)}
${Object.entries(dados.recRuralCat).map(([k,v])=>`  ${CATS_R_RURAL[k]||k}: ${fmtBRL(v)}`).join('\n')}
Despesas dedutíveis: ${fmtBRL(dados.totalDesRural)}
${Object.entries(dados.desRuralCat).map(([k,v])=>`  ${CATS_D_RURAL[k]||k}: ${fmtBRL(v)}`).join('\n')}
Lucro tributável rural: ${fmtBRL(dados.lucroRural)}
IR atividade rural (20%): ${fmtBRL(dados.irRural)}

=== RENDIMENTOS PESSOA FÍSICA ===
Rendimentos totais: ${fmtBRL(dados.totalRecPF)}
${Object.entries(dados.recPFCat).map(([k,v])=>`  ${CATS_R_PF[k]||k}: ${fmtBRL(v)}`).join('\n')}
Deduções PF (saúde/educação): ${fmtBRL(dados.totalDesPF)}
Base de cálculo PF: ${fmtBRL(dados.basePF)}
IR pessoa física: ${fmtBRL(dados.irPF)}

=== APURAÇÃO TOTAL ===
Base total: ${fmtBRL(dados.baseTotal)}
IR total estimado: ${fmtBRL(dados.irTotal)}
IR a pagar: ${fmtBRL(dados.irDevido)}

Gere um relatório completo com:
1. RESUMO EXECUTIVO
2. ATIVIDADE RURAL — orientações para preenchimento do DIRPF
3. RENDIMENTOS PF — como declarar cada categoria
4. DEDUÇÕES LEGAIS — o que mais pode deduzir
5. ALERTAS E OPORTUNIDADES — planejamento tributário
6. ORIENTAÇÕES PRÁTICAS — próximos passos

Linguagem clara para produtor rural. Sem markdown ou asteriscos.`)
      setRelIA(txt)
      setTimeout(()=>relRef.current?.scrollIntoView({behavior:'smooth'}),200)
      toast('Relatório IR gerado!')
    } catch(e) { toast(e.message,'erro') }
    finally { setLoadIA(false) }
  }

  async function baixarPDF() {
    if (!dados || !relIA) return
    try {
      const { jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const doc = new jsPDF()
      const addTable = (opts) => typeof doc.autoTable==='function' ? doc.autoTable(opts) : autoTable(doc,opts)

      // Header
      doc.setFillColor(30,60,15); doc.rect(0,0,210,28,'F')
      doc.setTextColor(238,232,208); doc.setFontSize(16); doc.setFont('helvetica','bold')
      doc.text('PecuariaIA - Declaracao IR', 14, 12)
      doc.setFontSize(9); doc.setFont('helvetica','normal')
      doc.text(`${perfil?.nome} | ${perfil?.fazenda} | Ano-base: ${dados.anoBase}`, 14, 21)
      doc.setTextColor(30,30,30); let y = 35

      // Resumo
      doc.setFontSize(12); doc.setFont('helvetica','bold'); doc.text('RESUMO DA DECLARACAO', 14, y); y+=7
      addTable({ startY:y, head:[['Item','Valor']], body:[
        ['Receita rural bruta', fmtBRL(dados.totalRecRural)],
        ['Despesas dedutíveis rural', fmtBRL(dados.totalDesRural)],
        ['Lucro rural tributável', fmtBRL(dados.lucroRural)],
        ['IR atividade rural (20%)', fmtBRL(dados.irRural)],
        ['',''],
        ['Rendimentos PF', fmtBRL(dados.totalRecPF)],
        ['Deduções PF', fmtBRL(dados.totalDesPF)],
        ['Base cálculo PF', fmtBRL(dados.basePF)],
        ['IR pessoa física', fmtBRL(dados.irPF)],
        ['',''],
        ['IR TOTAL ESTIMADO', fmtBRL(dados.irTotal)],
      ], theme:'striped', headStyles:{fillColor:[30,80,20]}, margin:{left:14,right:14} })
      y = (doc.lastAutoTable?.finalY||y+80) + 10

      // Receitas rurais
      if (Object.keys(dados.recRuralCat).length>0) {
        doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.text('RECEITAS RURAIS', 14, y); y+=6
        addTable({ startY:y, head:[['Categoria','Valor']], body:Object.entries(dados.recRuralCat).map(([k,v])=>[CATS_R_RURAL[k]||k, fmtBRL(v)]), theme:'striped', headStyles:{fillColor:[30,80,20]}, margin:{left:14,right:14} })
        y = (doc.lastAutoTable?.finalY||y+40) + 10
      }

      // Despesas rurais
      if (Object.keys(dados.desRuralCat).length>0) {
        doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.text('DESPESAS DEDUTIVEIS RURAIS', 14, y); y+=6
        addTable({ startY:y, head:[['Categoria','Valor']], body:Object.entries(dados.desRuralCat).map(([k,v])=>[CATS_D_RURAL[k]||k, fmtBRL(v)]), theme:'striped', headStyles:{fillColor:[30,80,20]}, margin:{left:14,right:14} })
        y = (doc.lastAutoTable?.finalY||y+40) + 10
      }

      // Rendimentos PF
      if (Object.keys(dados.recPFCat).length>0) {
        if (y > 230) { doc.addPage(); y = 20 }
        doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.text('RENDIMENTOS PESSOA FISICA', 14, y); y+=6
        addTable({ startY:y, head:[['Categoria','Valor']], body:Object.entries(dados.recPFCat).map(([k,v])=>[CATS_R_PF[k]||k, fmtBRL(v)]), theme:'striped', headStyles:{fillColor:[30,80,20]}, margin:{left:14,right:14} })
        y = (doc.lastAutoTable?.finalY||y+40) + 10
      }

      // Relatório IA
      if (relIA) {
        doc.addPage(); y = 20
        doc.setFontSize(12); doc.setFont('helvetica','bold'); doc.text('ORIENTACOES E ANALISE IA', 14, y); y+=8
        doc.setFontSize(8); doc.setFont('helvetica','normal')
        const linhas = doc.splitTextToSize(relIA, 182)
        linhas.forEach(linha => {
          if (y > 280) { doc.addPage(); y = 20 }
          doc.text(linha, 14, y); y+=4
        })
      }

      // Rodapé
      doc.setFontSize(7); doc.setTextColor(150)
      doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')} - PecuariaIA`, 14, 290)
      doc.save(`IR_${perfil?.fazenda?.replace(/\s/g,'_')}_${dados.anoBase}.pdf`)
      toast('PDF baixado!')
    } catch(e) { toast('Erro ao gerar PDF: '+e.message,'erro') }
  }

  async function exportarTXT() {
    if (!relIA) return
    const conteudo = `DECLARAÇÃO IR — ${perfil?.nome} — ${perfil?.fazenda} — ANO-BASE: ${dados.anoBase}
Gerado em: ${new Date().toLocaleString('pt-BR')}

=== RESUMO ===
Receita rural bruta: ${fmtBRL(dados.totalRecRural)}
Despesas dedutíveis rural: ${fmtBRL(dados.totalDesRural)}
Lucro rural tributável: ${fmtBRL(dados.lucroRural)}
IR atividade rural: ${fmtBRL(dados.irRural)}
Rendimentos PF: ${fmtBRL(dados.totalRecPF)}
Deduções PF: ${fmtBRL(dados.totalDesPF)}
IR pessoa física: ${fmtBRL(dados.irPF)}
IR TOTAL ESTIMADO: ${fmtBRL(dados.irTotal)}

=== ANÁLISE IA ===
${relIA}`
    const blob = new Blob([conteudo],{type:'text/plain;charset=utf-8'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download=`IR_${perfil?.fazenda?.replace(/\s/g,'_')}_${dados.anoBase}.txt`; a.click()
    URL.revokeObjectURL(url); toast('Exportado!')
  }

  async function exportarXLSX() {
    if (!dados) return
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
        {Item:'Receita rural bruta', Valor:dados.totalRecRural},
        {Item:'Despesas dedutíveis rural', Valor:dados.totalDesRural},
        {Item:'Lucro rural tributável', Valor:dados.lucroRural},
        {Item:'IR atividade rural (20%)', Valor:dados.irRural},
        {Item:'Rendimentos PF', Valor:dados.totalRecPF},
        {Item:'Deduções PF', Valor:dados.totalDesPF},
        {Item:'Base cálculo PF', Valor:dados.basePF},
        {Item:'IR pessoa física', Valor:dados.irPF},
        {Item:'IR TOTAL', Valor:dados.irTotal},
      ]), 'Resumo IR')
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dados.recRural.map(r=>({Data:r.data,Categoria:r.categoria,Descricao:r.descricao,Valor:r.valor}))), 'Receitas Rurais')
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dados.desRural.map(r=>({Data:r.data,Categoria:r.categoria,Descricao:r.descricao,Valor:r.valor,Deducivel:r.deducivel_ir?'Sim':'Não'}))), 'Despesas Rurais')
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dados.recPF.map(r=>({Data:r.data,Categoria:r.categoria,Descricao:r.descricao,Valor:r.valor}))), 'Rendimentos PF')
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dados.desPF.map(r=>({Data:r.data,Categoria:r.categoria,Descricao:r.descricao,Valor:r.valor}))), 'Despesas PF')
      XLSX.writeFile(wb, `IR_${perfil?.fazenda?.replace(/\s/g,'_')}_${dados.anoBase}.xlsx`)
      toast('Excel exportado!')
    } catch(e) { toast(e.message,'erro') }
  }

  return (
    <div style={{maxWidth:900,margin:'0 auto'}}>
      <ToastContainer/>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
        <div>
          <h2 style={{fontSize:22,fontWeight:800,color:C.ambar,fontFamily:"'Syne',sans-serif"}}>📋 Declaração IR</h2>
          <p style={{color:C.textoMuted,fontSize:13}}>Apuração automática — Rural + Pessoa Física</p>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
          <select value={anoBase} onChange={e=>setAnoBase(parseInt(e.target.value))} style={{padding:'8px 12px',borderRadius:6,border:`1.5px solid ${C.border}`,background:C.bgInput,color:C.texto,fontSize:13}}>
            {[anoAtual-1,anoAtual-2,anoAtual-3].map(a=><option key={a} value={a}>{a}</option>)}
          </select>
          <Btn cor={C.ambar} onClick={gerarRelatorioIA} disabled={loadIA||!dados}>
            {loadIA?'⏳ Gerando...':'🤖 Relatório IA'}
          </Btn>
          {relIA && <>
            <Btn cor={C.verdeClaro} onClick={baixarPDF}>📄 PDF</Btn>
            <Btn cor={C.verde} outline onClick={exportarXLSX}>📊 Excel</Btn>
            <Btn cor={C.textoMuted} outline onClick={exportarTXT}>📝 .txt</Btn>
          </>}
        </div>
      </div>

      {carregando ? (
        <div style={{textAlign:'center',padding:40,color:C.textoMuted}}>⏳ Carregando dados...</div>
      ) : dados ? (<>

        {/* ── Cards resumo ── */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
          {[
            {l:'IR Atividade Rural',  v:fmtBRL(dados.irRural),  sub:`Base: ${fmtBRL(dados.lucroRural)}`, c:C.verde},
            {l:'IR Pessoa Física',    v:fmtBRL(dados.irPF),     sub:`Base: ${fmtBRL(dados.basePF)}`,    c:C.ambar},
            {l:'IR TOTAL ESTIMADO',   v:fmtBRL(dados.irTotal),  sub:`Ano-base ${dados.anoBase}`,         c:C.critico},
          ].map((s,i)=>(
            <div key={i} style={{background:C.bgCard,border:`2px solid ${s.c}`,borderRadius:12,padding:'16px 18px',textAlign:'center'}}>
              <div style={{fontSize:11,color:C.textoMuted,textTransform:'uppercase',fontWeight:600,marginBottom:6}}>{s.l}</div>
              <div style={{fontSize:24,fontWeight:800,color:s.c,fontFamily:"'Syne',sans-serif"}}>{s.v}</div>
              <div style={{fontSize:11,color:C.textoMuted,marginTop:4}}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Atividade Rural ── */}
        <Secao titulo={`Atividade Rural — ${dados.anoBase}`} icon="🌾" cor={C.verde}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:C.verdeClaro,marginBottom:8,textTransform:'uppercase'}}>💰 Receitas ({dados.recRural.length} lançamentos)</div>
              {Object.entries(dados.recRuralCat).sort((a,b)=>b[1]-a[1]).map(([k,v])=>(
                <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:`1px solid ${C.border}`,fontSize:12}}>
                  <span style={{color:C.textoSub}}>{CATS_R_RURAL[k]||k}</span>
                  <span style={{color:C.verdeClaro,fontWeight:700}}>{fmtBRL(v)}</span>
                </div>
              ))}
              {Object.keys(dados.recRuralCat).length===0&&<div style={{color:C.textoMuted,fontSize:12}}>Nenhuma receita no período</div>}
              <div style={{display:'flex',justifyContent:'space-between',padding:'8px 0',marginTop:4,fontSize:13,fontWeight:700}}>
                <span style={{color:C.texto}}>Total receitas</span>
                <span style={{color:C.verdeClaro}}>{fmtBRL(dados.totalRecRural)}</span>
              </div>
            </div>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:C.critico,marginBottom:8,textTransform:'uppercase'}}>💸 Despesas dedutíveis ({dados.desRural.filter(d=>d.deducivel_ir).length})</div>
              {Object.entries(dados.desRuralCat).sort((a,b)=>b[1]-a[1]).map(([k,v])=>(
                <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:`1px solid ${C.border}`,fontSize:12}}>
                  <span style={{color:C.textoSub}}>{CATS_D_RURAL[k]||k}</span>
                  <span style={{color:C.critico,fontWeight:700}}>{fmtBRL(v)}</span>
                </div>
              ))}
              {Object.keys(dados.desRuralCat).length===0&&<div style={{color:C.textoMuted,fontSize:12}}>Nenhuma despesa dedutível</div>}
              <div style={{display:'flex',justifyContent:'space-between',padding:'8px 0',marginTop:4,fontSize:13,fontWeight:700}}>
                <span style={{color:C.texto}}>Total deduções</span>
                <span style={{color:C.critico}}>{fmtBRL(dados.totalDesRural)}</span>
              </div>
            </div>
          </div>
          <div style={{marginTop:14,background:C.bgInput,borderRadius:8,padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontSize:11,color:C.textoMuted}}>Lucro tributável rural</div>
              <div style={{fontSize:20,fontWeight:800,color:C.verde,fontFamily:'monospace'}}>{fmtBRL(dados.lucroRural)}</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:11,color:C.textoMuted}}>IR rural (alíquota 20% — Lei 8.023/1990)</div>
              <div style={{fontSize:20,fontWeight:800,color:C.ambar,fontFamily:'monospace'}}>{fmtBRL(dados.irRural)}</div>
            </div>
          </div>
        </Secao>

        {/* ── Pessoa Física ── */}
        <Secao titulo={`Rendimentos Pessoa Física — ${dados.anoBase}`} icon="👤" cor={C.ambar}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:C.verdeClaro,marginBottom:8,textTransform:'uppercase'}}>💰 Rendimentos ({dados.recPF.length})</div>
              {Object.entries(dados.recPFCat).sort((a,b)=>b[1]-a[1]).map(([k,v])=>(
                <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:`1px solid ${C.border}`,fontSize:12}}>
                  <span style={{color:C.textoSub}}>{CATS_R_PF[k]||k}</span>
                  <span style={{color:C.verdeClaro,fontWeight:700}}>{fmtBRL(v)}</span>
                </div>
              ))}
              {Object.keys(dados.recPFCat).length===0&&<div style={{color:C.textoMuted,fontSize:12}}>Nenhum rendimento no período</div>}
              <div style={{display:'flex',justifyContent:'space-between',padding:'8px 0',marginTop:4,fontSize:13,fontWeight:700}}>
                <span style={{color:C.texto}}>Total rendimentos</span>
                <span style={{color:C.verdeClaro}}>{fmtBRL(dados.totalRecPF)}</span>
              </div>
            </div>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:C.critico,marginBottom:8,textTransform:'uppercase'}}>🏥 Deduções legais PF</div>
              {Object.entries(dados.desPFCat).sort((a,b)=>b[1]-a[1]).map(([k,v])=>(
                <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:`1px solid ${C.border}`,fontSize:12}}>
                  <span style={{color:C.textoSub}}>{CATS_D_PF[k]||k}</span>
                  <span style={{color:C.critico,fontWeight:700}}>{fmtBRL(v)}</span>
                </div>
              ))}
              {Object.keys(dados.desPFCat).length===0&&<div style={{color:C.textoMuted,fontSize:12}}>Nenhuma dedução PF lançada</div>}
              <div style={{fontSize:11,color:C.ambar,marginTop:8,lineHeight:1.6}}>
                💡 No financeiro pessoal, marque gastos com Saúde e Educação como dedutíveis para aparecerem aqui.
              </div>
            </div>
          </div>
          <div style={{marginTop:14,background:C.bgInput,borderRadius:8,padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontSize:11,color:C.textoMuted}}>Base de cálculo PF</div>
              <div style={{fontSize:20,fontWeight:800,color:C.ambar,fontFamily:'monospace'}}>{fmtBRL(dados.basePF)}</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:11,color:C.textoMuted}}>IR PF (tabela progressiva)</div>
              <div style={{fontSize:20,fontWeight:800,color:C.ambar,fontFamily:'monospace'}}>{fmtBRL(dados.irPF)}</div>
            </div>
          </div>
        </Secao>

        {/* ── Tabela progressiva ── */}
        <Secao titulo="Tabela Progressiva IR 2025" icon="📊" cor={C.textoMuted}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead>
              <tr style={{borderBottom:`2px solid ${C.border}`}}>
                {['Base de Cálculo','Alíquota','Dedução'].map(h=>(
                  <th key={h} style={{padding:'8px 12px',textAlign:'left',color:C.textoMuted,fontSize:11,textTransform:'uppercase',fontWeight:600}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                {faixa:'Até R$ 26.963,20',aliq:'Isento',ded:'—'},
                {faixa:'R$ 26.963,21 até R$ 33.919,80',aliq:'7,5%',ded:'R$ 2.022,24'},
                {faixa:'R$ 33.919,81 até R$ 45.012,60',aliq:'15%',ded:'R$ 4.566,23'},
                {faixa:'R$ 45.012,61 até R$ 55.976,16',aliq:'22,5%',ded:'R$ 7.942,17'},
                {faixa:'Acima de R$ 55.976,16',aliq:'27,5%',ded:'R$ 10.750,57'},
              ].map((r,i)=>(
                <tr key={i} style={{borderBottom:`1px solid ${C.border}`,background:i%2===0?'transparent':`${C.verde}08`}}>
                  <td style={{padding:'7px 12px',color:C.texto}}>{r.faixa}</td>
                  <td style={{padding:'7px 12px',color:C.ambar,fontWeight:700}}>{r.aliq}</td>
                  <td style={{padding:'7px 12px',color:C.textoSub}}>{r.ded}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{marginTop:10,fontSize:11,color:C.textoMuted}}>
            📚 Base legal: Lei 8.023/1990 (Atividade Rural) · IN RFB 1700/2017 · Tabela IRPF 2025
          </div>
        </Secao>

        {/* ── Relatório IA ── */}
        {!relIA && (
          <div style={{textAlign:'center',padding:24}}>
            <button onClick={gerarRelatorioIA} disabled={loadIA} style={{padding:'12px 28px',borderRadius:10,border:'none',background:C.ambar,color:'#fff',fontSize:14,fontWeight:700,cursor:loadIA?'not-allowed':'pointer'}}>
              {loadIA?'⏳ Gerando relatório com IA...':'🤖 Gerar Orientações com IA'}
            </button>
            <div style={{fontSize:12,color:C.textoMuted,marginTop:8}}>Análise personalizada + orientações para declaração</div>
          </div>
        )}

        {relIA && (
          <div ref={relRef} style={{background:C.bgCard,border:`2px solid ${C.ambar}`,borderRadius:12,overflow:'hidden',marginTop:8}}>
            <div style={{background:C.ambar,padding:'10px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{color:'#fff',fontWeight:700,fontSize:13}}>🤖 Orientações IR — {perfil?.fazenda} — {dados.anoBase}</span>
              <div style={{display:'flex',gap:8}}>
                <button onClick={baixarPDF} style={{background:'transparent',border:'1px solid #fff',borderRadius:6,color:'#fff',fontSize:11,fontWeight:600,padding:'4px 10px',cursor:'pointer'}}>📄 PDF</button>
                <button onClick={exportarTXT} style={{background:'transparent',border:'1px solid #fff',borderRadius:6,color:'#fff',fontSize:11,fontWeight:600,padding:'4px 10px',cursor:'pointer'}}>📝 .txt</button>
              </div>
            </div>
            <div style={{padding:'18px 20px',fontSize:13,lineHeight:1.9,whiteSpace:'pre-wrap',color:C.texto}}>{relIA}</div>
          </div>
        )}

      </>) : (
        <div style={{textAlign:'center',padding:40,color:C.textoMuted}}>Nenhum dado encontrado para {anoBase}</div>
      )}
    </div>
  )
}
