import { useState, useMemo } from 'react'
import { useTabela } from '../utils/useTabela.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { C, fmtBRL, fmtNum, fmtData, hoje } from '../utils/helpers.js'
import { Secao, Tabela, Modal, Campo, Grid, Btn, useToast } from '../components/UI.jsx'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts'

const CATS_R = [
  { value:'salario',      label:'💼 Salário / Pró-labore' },
  { value:'freela',       label:'💻 Freelance / Bico' },
  { value:'aluguel_rec',  label:'🏠 Aluguel Recebido' },
  { value:'investimento', label:'📈 Investimentos' },
  { value:'bonus',        label:'🎁 Bônus / Presente' },
  { value:'outro',        label:'📦 Outro' },
]
const CATS_D = [
  { value:'moradia',      label:'🏠 Moradia / Aluguel' },
  { value:'alimentacao',  label:'🍽️ Alimentação' },
  { value:'carro',        label:'🚗 Carro / Combustível' },
  { value:'saude',        label:'🏥 Saúde / Plano' },
  { value:'educacao',     label:'📚 Educação' },
  { value:'lazer',        label:'🎉 Lazer / Viagem' },
  { value:'vestuario',    label:'👕 Vestuário' },
  { value:'servicos',     label:'📱 Serviços / Assinaturas' },
  { value:'financiamento',label:'🏦 Financiamento / Parcela' },
  { value:'pessoal',      label:'👤 Pessoal / Higiene' },
  { value:'familia',      label:'👨‍👩‍👧 Família / Filhos' },
  { value:'outro',        label:'📦 Outro' },
]

const CORES = ['#5A9A35','#D46A1A','#2A8A78','#8A3A18','#3D6B25','#C03520','#7EC240','#F08A30']

export default function FinanceiroPessoal() {
  const { user, perfil } = useAuth()
  const { toast, ToastContainer } = useToast()
  const { dados: receitas, loading: loadR, inserir: inserirR, remover: removerR } = useTabela('receitas_pessoal')
  const { dados: despesas, loading: loadD, inserir: inserirD, remover: removerD } = useTabela('despesas_pessoal')
  const [aba, setAba] = useState('resumo')
  const [modalR, setModalR] = useState(false)
  const [modalD, setModalD] = useState(false)

  const vR = { data: hoje(), categoria: 'salario', descricao: '', valor: '', obs: '' }
  const vD = { data: hoje(), categoria: 'moradia', descricao: '', valor: '', obs: '' }
  const [fR, setFR] = useState(vR)
  const [fD, setFD] = useState(vD)

  async function salvarR() {
    if (!fR.valor || !fR.descricao) { toast('Preencha valor e descrição', 'erro'); return }
    try {
      await inserirR({ ...fR, valor: parseFloat(fR.valor) })
      toast('Receita pessoal lançada!'); setModalR(false); setFR(vR)
    } catch(e) { toast(e.message, 'erro') }
  }

  async function salvarD() {
    if (!fD.valor || !fD.descricao) { toast('Preencha valor e descrição', 'erro'); return }
    try {
      await inserirD({ ...fD, valor: parseFloat(fD.valor) })
      toast('Despesa pessoal lançada!'); setModalD(false); setFD(vD)
    } catch(e) { toast(e.message, 'erro') }
  }

  const totalRec = receitas.reduce((s,r) => s + parseFloat(r.valor||0), 0)
  const totalDes = despesas.reduce((s,r) => s + parseFloat(r.valor||0), 0)
  const saldo = totalRec - totalDes

  const mesAtual = hoje().slice(0,7)
  const recMes = receitas.filter(r => r.data?.slice(0,7) === mesAtual).reduce((s,r) => s + parseFloat(r.valor||0), 0)
  const desMes = despesas.filter(r => r.data?.slice(0,7) === mesAtual).reduce((s,r) => s + parseFloat(r.valor||0), 0)

  const porCatD = useMemo(() => {
    const m = {}
    despesas.forEach(r => { m[r.categoria] = (m[r.categoria]||0) + parseFloat(r.valor||0) })
    return Object.entries(m).sort((a,b) => b[1]-a[1]).map(([cat,val]) => ({
      name: CATS_D.find(c=>c.value===cat)?.label?.replace(/^.*? /,'') || cat,
      value: val
    }))
  }, [despesas])

  const abas = [
    { id:'resumo',   l:'📊 Resumo' },
    { id:'receitas', l:'💰 Receitas' },
    { id:'despesas', l:'💸 Despesas' },
  ]

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <ToastContainer />
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <h2 style={{ fontSize:22, fontWeight:800, color:C.ambar, fontFamily:"'Syne',sans-serif" }}>👤 Financeiro Pessoal</h2>
          <p style={{ color:C.textoMuted, fontSize:13 }}>Controle separado das finanças pessoais</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <Btn cor={C.verdeClaro} onClick={()=>setModalR(true)}>+ Receita</Btn>
          <Btn cor={C.critico} outline onClick={()=>setModalD(true)}>+ Despesa</Btn>
        </div>
      </div>

      {/* Cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:20 }}>
        {[
          { l:'Receita total',   v:fmtBRL(totalRec), c:C.verdeClaro },
          { l:'Despesa total',   v:fmtBRL(totalDes), c:C.critico },
          { l:'Saldo total',     v:fmtBRL(saldo),    c:saldo>=0?C.verdeVivo:C.critico },
          { l:'Resultado do mês',v:fmtBRL(recMes-desMes), c:(recMes-desMes)>=0?C.verdeVivo:C.critico },
        ].map((s,i) => (
          <div key={i} style={{ background:C.bgCard, border:`1px solid ${C.border}`, borderLeft:`3px solid ${s.c}`, borderRadius:10, padding:'12px 14px' }}>
            <div style={{ fontSize:10, color:C.textoMuted, textTransform:'uppercase', fontWeight:600 }}>{s.l}</div>
            <div style={{ fontSize:18, fontWeight:800, color:s.c, fontFamily:'monospace', marginTop:4 }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Abas */}
      <div style={{ display:'flex', gap:2, marginBottom:16, borderBottom:`1px solid ${C.border}` }}>
        {abas.map(a => (
          <button key={a.id} onClick={()=>setAba(a.id)} style={{
            padding:'8px 14px', border:'none', background:'transparent',
            borderBottom:aba===a.id?`2px solid ${C.ambar}`:'2px solid transparent',
            color:aba===a.id?C.ambar:C.textoMuted, fontSize:12, fontWeight:600, cursor:'pointer',
          }}>{a.l}</button>
        ))}
      </div>

      {aba==='resumo' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <Secao titulo="Despesas por categoria" icon="💸" cor={C.critico}>
            {porCatD.length === 0 ? (
              <div style={{ color:C.textoMuted, fontSize:13 }}>Nenhuma despesa ainda</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={porCatD} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                      {porCatD.map((_,i) => <Cell key={i} fill={CORES[i%CORES.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v)=>fmtBRL(v)} />
                  </PieChart>
                </ResponsiveContainer>
                {porCatD.map((c,i) => (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:`1px solid ${C.border}`, fontSize:12 }}>
                    <span style={{ color:C.textoSub }}>{c.name}</span>
                    <span style={{ color:C.critico, fontWeight:700 }}>{fmtBRL(c.value)}</span>
                  </div>
                ))}
              </>
            )}
          </Secao>

          <Secao titulo="Receitas do mês" icon="💰" cor={C.verdeClaro}>
            <div style={{ fontSize:28, fontWeight:800, color:C.verdeVivo, fontFamily:'monospace' }}>{fmtBRL(recMes)}</div>
            <div style={{ fontSize:13, color:C.textoMuted, marginTop:4 }}>Despesas: {fmtBRL(desMes)}</div>
            <div style={{ marginTop:12, padding:'10px', background:C.bgInput, borderRadius:8 }}>
              <div style={{ fontSize:12, color:C.textoMuted }}>Sobra do mês:</div>
              <div style={{ fontSize:22, fontWeight:800, color:(recMes-desMes)>=0?C.verdeVivo:C.critico, fontFamily:'monospace' }}>
                {fmtBRL(recMes-desMes)}
              </div>
              {totalRec > 0 && (
                <div style={{ fontSize:11, color:C.textoMuted, marginTop:4 }}>
                  Comprometido: {fmtNum((totalDes/totalRec)*100,1)}% da receita
                </div>
              )}
            </div>
          </Secao>
        </div>
      )}

      {aba==='receitas' && (
        <Secao titulo={`${receitas.length} receitas pessoais`} icon="💰" cor={C.verdeClaro}
          acao={<Btn size="sm" cor={C.verdeClaro} onClick={()=>setModalR(true)}>+ Nova</Btn>}>
          <Tabela colunas={[
            { key:'data',      label:'Data',      render:r=>fmtData(r.data) },
            { key:'categoria', label:'Categoria', render:r=>CATS_R.find(c=>c.value===r.categoria)?.label||r.categoria },
            { key:'descricao', label:'Descrição' },
            { key:'valor',     label:'Valor',     render:r=><strong style={{color:C.verdeClaro}}>{fmtBRL(r.valor)}</strong> },
          ]} dados={receitas} loading={loadR} onDelete={r=>{if(confirm('Excluir?'))removerR(r.id)}} />
        </Secao>
      )}

      {aba==='despesas' && (
        <Secao titulo={`${despesas.length} despesas pessoais`} icon="💸" cor={C.critico}
          acao={<Btn size="sm" cor={C.critico} onClick={()=>setModalD(true)}>+ Nova</Btn>}>
          <Tabela colunas={[
            { key:'data',      label:'Data',      render:r=>fmtData(r.data) },
            { key:'categoria', label:'Categoria', render:r=>CATS_D.find(c=>c.value===r.categoria)?.label||r.categoria },
            { key:'descricao', label:'Descrição' },
            { key:'valor',     label:'Valor',     render:r=><strong style={{color:C.critico}}>{fmtBRL(r.valor)}</strong> },
          ]} dados={despesas} loading={loadD} onDelete={r=>{if(confirm('Excluir?'))removerD(r.id)}} />
        </Secao>
      )}

      {/* Modal Receita */}
      {modalR && (
        <Modal titulo="Receita Pessoal" onClose={()=>setModalR(false)}>
          <Grid cols={2}>
            <Campo label="Data" type="date" value={fR.data} onChange={v=>setFR(f=>({...f,data:v}))} />
            <Campo label="Categoria" type="select" value={fR.categoria} onChange={v=>setFR(f=>({...f,categoria:v}))} options={CATS_R} />
          </Grid>
          <Campo label="Descrição" value={fR.descricao} onChange={v=>setFR(f=>({...f,descricao:v}))} required />
          <Campo label="Valor (R$)" type="number" step="0.01" value={fR.valor} onChange={v=>setFR(f=>({...f,valor:v}))} required />
          <Campo label="Obs" type="textarea" value={fR.obs} onChange={v=>setFR(f=>({...f,obs:v}))} />
          <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:8}}>
            <Btn outline cor={C.textoMuted} onClick={()=>setModalR(false)}>Cancelar</Btn>
            <Btn cor={C.verdeClaro} onClick={salvarR}>Lançar</Btn>
          </div>
        </Modal>
      )}

      {/* Modal Despesa */}
      {modalD && (
        <Modal titulo="Despesa Pessoal" onClose={()=>setModalD(false)}>
          <Grid cols={2}>
            <Campo label="Data" type="date" value={fD.data} onChange={v=>setFD(f=>({...f,data:v}))} />
            <Campo label="Categoria" type="select" value={fD.categoria} onChange={v=>setFD(f=>({...f,categoria:v}))} options={CATS_D} />
          </Grid>
          <Campo label="Descrição" value={fD.descricao} onChange={v=>setFD(f=>({...f,descricao:v}))} required />
          <Campo label="Valor (R$)" type="number" step="0.01" value={fD.valor} onChange={v=>setFD(f=>({...f,valor:v}))} required />
          <Campo label="Obs" type="textarea" value={fD.obs} onChange={v=>setFD(f=>({...f,obs:v}))} />
          <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:8}}>
            <Btn outline cor={C.textoMuted} onClick={()=>setModalD(false)}>Cancelar</Btn>
            <Btn cor={C.critico} onClick={salvarD}>Lançar</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}
