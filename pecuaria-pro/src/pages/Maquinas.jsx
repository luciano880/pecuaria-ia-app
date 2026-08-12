import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { C, fmtData, hoje, fmtNum } from '../utils/helpers.js'
import { Secao, Modal, Campo, Grid, Btn, Tabela, useToast } from '../components/UI.jsx'

const TIPOS = [
  { value:'trator',        label:'🚜 Trator' },
  { value:'caminhao',      label:'🚛 Caminhão' },
  { value:'colheitadeira', label:'🌾 Colheitadeira' },
  { value:'implemento',    label:'🔧 Implemento' },
  { value:'moto',          label:'🏍️ Moto' },
  { value:'outro',         label:'⚙️ Outro' },
]

const TIPOS_MAN = [
  { value:'troca_oleo',      label:'🛢️ Troca de Óleo' },
  { value:'filtro_oleo',     label:'🔵 Filtro de Óleo' },
  { value:'filtro_ar',       label:'💨 Filtro de Ar' },
  { value:'filtro_combustivel',label:'⛽ Filtro de Combustível' },
  { value:'filtro_hidraulico',label:'🔧 Filtro Hidráulico' },
  { value:'filtro_cabine',   label:'🪟 Filtro de Cabine' },
  { value:'correia',         label:'⚙️ Correia' },
  { value:'pneu',            label:'🔴 Pneu' },
  { value:'bateria',         label:'🔋 Bateria' },
  { value:'revisao_geral',   label:'📋 Revisão Geral' },
  { value:'reparo',          label:'🔨 Reparo/Conserto' },
  { value:'outro',           label:'📦 Outro' },
]

const LABEL_TIPO    = Object.fromEntries(TIPOS.map(t=>[t.value,t.label]))
const LABEL_MAN     = Object.fromEntries(TIPOS_MAN.map(t=>[t.value,t.label]))

export default function Maquinas() {
  const { user } = useAuth()
  const { toast, ToastContainer } = useToast()
  const [maquinas,    setMaquinas]    = useState([])
  const [manutencoes, setManutencoes] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [aba,         setAba]         = useState('maquinas')
  const [maqSel,      setMaqSel]      = useState(null) // máquina selecionada para ver ficha
  const [modalMaq,    setModalMaq]    = useState(false)
  const [modalMan,    setModalMan]    = useState(false)
  const [editMaq,     setEditMaq]     = useState(null)

  const vMaq = { nome:'', tipo:'trator', marca:'', modelo:'', ano:'', placa:'', horimetro_atual:0, km_atual:0, proxima_revisao_horas:'', proxima_revisao_km:'', obs:'' }
  const vMan = { maquina_id:'', tipo:'troca_oleo', data:hoje(), horimetro:0, km:0, descricao:'', pecas_usadas:'', valor_total:'', proxima_horas:'', proximo_km:'', oficina:'', obs:'' }
  const [fMaq, setFMaq] = useState(vMaq)
  const [fMan, setFMan] = useState(vMan)

  useEffect(() => { if (user) carregar() }, [user])

  async function carregar() {
    setLoading(true)
    const [mRes, manRes] = await Promise.all([
      supabase.from('maquinas').select('*').eq('user_id', user.id).order('nome'),
      supabase.from('manutencoes_maquina').select('*').eq('user_id', user.id).order('data', { ascending: false }),
    ])
    setMaquinas(mRes.data || [])
    setManutencoes(manRes.data || [])
    setLoading(false)
  }

  async function salvarMaq() {
    if (!fMaq.nome) { toast('Nome obrigatório', 'erro'); return }
    try {
      const payload = {
        ...fMaq,
        horimetro_atual: parseFloat(fMaq.horimetro_atual) || 0,
        km_atual: parseFloat(fMaq.km_atual) || 0,
        proxima_revisao_horas: fMaq.proxima_revisao_horas ? parseFloat(fMaq.proxima_revisao_horas) : null,
        proxima_revisao_km: fMaq.proxima_revisao_km ? parseFloat(fMaq.proxima_revisao_km) : null,
        ano: fMaq.ano ? parseInt(fMaq.ano) : null,
      }
      if (editMaq) {
        await supabase.from('maquinas').update(payload).eq('id', editMaq).eq('user_id', user.id)
        toast('Máquina atualizada!')
      } else {
        await supabase.from('maquinas').insert({ ...payload, user_id: user.id })
        toast('Máquina cadastrada!')
      }
      setModalMaq(false); setFMaq(vMaq); setEditMaq(null)
      carregar()
    } catch(e) { toast(e.message, 'erro') }
  }

  async function salvarMan() {
    if (!fMan.maquina_id || !fMan.tipo) { toast('Selecione a máquina e o tipo', 'erro'); return }
    try {
      const payload = {
        ...fMan,
        horimetro: parseFloat(fMan.horimetro) || 0,
        km: parseFloat(fMan.km) || 0,
        valor_total: fMan.valor_total ? parseFloat(fMan.valor_total) : null,
        proxima_horas: fMan.proxima_horas ? parseFloat(fMan.proxima_horas) : null,
        proximo_km: fMan.proximo_km ? parseFloat(fMan.proximo_km) : null,
      }
      await supabase.from('manutencoes_maquina').insert({ ...payload, user_id: user.id })

      // Atualizar horímetro/km da máquina
      const maq = maquinas.find(m => m.id === fMan.maquina_id)
      if (maq) {
        const updates = {}
        if (payload.horimetro > maq.horimetro_atual) updates.horimetro_atual = payload.horimetro
        if (payload.km > maq.km_atual) updates.km_atual = payload.km
        if (payload.proxima_horas) updates.proxima_revisao_horas = payload.proxima_horas
        if (payload.proximo_km) updates.proxima_revisao_km = payload.proximo_km
        if (Object.keys(updates).length) {
          await supabase.from('maquinas').update(updates).eq('id', maq.id).eq('user_id', user.id)
        }
      }

      toast('Manutenção registrada!')
      setModalMan(false); setFMan(vMan)
      carregar()
    } catch(e) { toast(e.message, 'erro') }
  }

  async function excluirMaq(id) {
    if (!confirm('Excluir esta máquina e todo o histórico?')) return
    await supabase.from('manutencoes_maquina').delete().eq('maquina_id', id).eq('user_id', user.id)
    await supabase.from('maquinas').delete().eq('id', id).eq('user_id', user.id)
    toast('Removida!'); carregar()
  }

  async function excluirMan(id) {
    if (!confirm('Excluir esta manutenção?')) return
    await supabase.from('manutencoes_maquina').delete().eq('id', id).eq('user_id', user.id)
    toast('Removida!'); carregar()
  }

  // Calcular status de manutenção
  function statusMaq(maq) {
    const mans = manutencoes.filter(m => m.maquina_id === maq.id)
    if (!mans.length) return { cor: C.textoMuted, label: 'Sem histórico' }
    if (maq.proxima_revisao_horas && maq.horimetro_atual >= maq.proxima_revisao_horas) {
      return { cor: C.critico, label: '🚨 Revisão atrasada' }
    }
    if (maq.proxima_revisao_horas && maq.horimetro_atual >= maq.proxima_revisao_horas - 50) {
      return { cor: C.ambar, label: '⚠️ Revisão próxima' }
    }
    if (maq.proxima_revisao_km && maq.km_atual >= maq.proxima_revisao_km) {
      return { cor: C.critico, label: '🚨 Revisão atrasada' }
    }
    return { cor: C.verdeClaro, label: '✅ Em dia' }
  }

  const maqSelecionada = maquinas.find(m => m.id === maqSel)
  const mansDaMaq = manutencoes.filter(m => m.maquina_id === maqSel)

  // Alertas
  const alertas = maquinas.filter(m => {
    if (m.proxima_revisao_horas && m.horimetro_atual >= m.proxima_revisao_horas - 50) return true
    if (m.proxima_revisao_km && m.km_atual >= m.proxima_revisao_km - 500) return true
    return false
  })

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <ToastContainer />

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <h2 style={{ fontSize:22, fontWeight:800, color:C.ambar, fontFamily:"'Syne',sans-serif" }}>🚜 Máquinas & Manutenção</h2>
          <p style={{ color:C.textoMuted, fontSize:13 }}>Tratores, caminhões, implementos e histórico de manutenção</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <Btn cor={C.ambar} onClick={()=>{ setFMaq(vMaq); setEditMaq(null); setModalMaq(true) }}>+ Máquina</Btn>
          <Btn cor={C.verdeClaro} outline onClick={()=>{ setFMan({...vMan, maquina_id: maqSel||''}); setModalMan(true) }}>🔧 + Manutenção</Btn>
        </div>
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <div style={{ background:`${C.critico}18`, border:`1px solid ${C.critico}`, borderRadius:10, padding:'10px 16px', marginBottom:16, fontSize:13 }}>
          <strong style={{ color:C.critico }}>⚠️ {alertas.length} máquina(s) com manutenção próxima ou atrasada:</strong>
          <div style={{ marginTop:6 }}>
            {alertas.map(m => {
              const s = statusMaq(m)
              return <div key={m.id} style={{ color:s.cor, fontSize:12, marginTop:3 }}>• {LABEL_TIPO[m.tipo]||m.tipo} {m.nome} — {s.label}</div>
            })}
          </div>
        </div>
      )}

      {/* Abas */}
      <div style={{ display:'flex', gap:2, marginBottom:16, borderBottom:`1px solid ${C.border}` }}>
        {[
          { id:'maquinas',    l:`🚜 Máquinas (${maquinas.length})` },
          { id:'manutencoes', l:`🔧 Histórico (${manutencoes.length})` },
          ...(maqSelecionada ? [{ id:'ficha', l:`📋 ${maqSelecionada.nome}` }] : []),
        ].map(a=>(
          <button key={a.id} onClick={()=>setAba(a.id)} style={{
            padding:'8px 14px', border:'none', background:'transparent',
            borderBottom:aba===a.id?`2px solid ${C.ambar}`:'2px solid transparent',
            color:aba===a.id?C.ambar:C.textoMuted, fontSize:12, fontWeight:600, cursor:'pointer',
          }}>{a.l}</button>
        ))}
      </div>

      {/* ── ABA MÁQUINAS ── */}
      {aba==='maquinas' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:14 }}>
          {loading ? (
            <div style={{ color:C.textoMuted, padding:40, textAlign:'center' }}>⏳ Carregando...</div>
          ) : maquinas.length === 0 ? (
            <div style={{ color:C.textoMuted, padding:40, textAlign:'center', gridColumn:'1/-1' }}>
              <div style={{ fontSize:40, marginBottom:12 }}>🚜</div>
              <div>Nenhuma máquina cadastrada</div>
              <button onClick={()=>setModalMaq(true)} style={{ marginTop:12, padding:'8px 20px', borderRadius:8, border:`1px solid ${C.ambar}`, background:'transparent', color:C.ambar, cursor:'pointer' }}>+ Cadastrar primeira máquina</button>
            </div>
          ) : maquinas.map(m => {
            const s = statusMaq(m)
            const mans = manutencoes.filter(x => x.maquina_id === m.id)
            const ultimaMan = mans[0]
            return (
              <div key={m.id} style={{ background:C.bgCard, border:`1px solid ${C.border}`, borderTop:`3px solid ${s.cor}`, borderRadius:12, padding:18, cursor:'pointer', transition:'transform 0.15s' }}
                onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'}
                onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                  <div>
                    <div style={{ fontSize:28, marginBottom:4 }}>{LABEL_TIPO[m.tipo]?.split(' ')[0]||'⚙️'}</div>
                    <div style={{ fontSize:15, fontWeight:800, color:C.texto }}>{m.nome}</div>
                    <div style={{ fontSize:12, color:C.textoMuted }}>{m.marca} {m.modelo} {m.ano ? `· ${m.ano}` : ''}</div>
                  </div>
                  <span style={{ fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:4, background:`${s.cor}22`, color:s.cor }}>{s.label}</span>
                </div>

                {/* Horímetro/KM */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
                  {m.tipo !== 'implemento' && (
                    <>
                      <div style={{ background:C.bgInput, borderRadius:6, padding:'8px 10px' }}>
                        <div style={{ fontSize:10, color:C.textoMuted, fontWeight:600 }}>⏱️ HORÍMETRO</div>
                        <div style={{ fontSize:16, fontWeight:800, color:C.ambar, fontFamily:'monospace' }}>{fmtNum(m.horimetro_atual,0)}h</div>
                        {m.proxima_revisao_horas && <div style={{ fontSize:10, color:C.textoMuted }}>Próx: {fmtNum(m.proxima_revisao_horas,0)}h</div>}
                      </div>
                      <div style={{ background:C.bgInput, borderRadius:6, padding:'8px 10px' }}>
                        <div style={{ fontSize:10, color:C.textoMuted, fontWeight:600 }}>🛣️ KM</div>
                        <div style={{ fontSize:16, fontWeight:800, color:C.verdeClaro, fontFamily:'monospace' }}>{fmtNum(m.km_atual,0)}</div>
                        {m.proxima_revisao_km && <div style={{ fontSize:10, color:C.textoMuted }}>Próx: {fmtNum(m.proxima_revisao_km,0)}</div>}
                      </div>
                    </>
                  )}
                </div>

                {/* Última manutenção */}
                {ultimaMan && (
                  <div style={{ fontSize:11, color:C.textoMuted, marginBottom:12 }}>
                    🔧 Última: {LABEL_MAN[ultimaMan.tipo]?.replace(/^.*? /,'')||ultimaMan.tipo} em {fmtData(ultimaMan.data)}
                  </div>
                )}

                <div style={{ display:'flex', gap:6 }}>
                  <Btn size="sm" cor={C.ambar} onClick={()=>{ setMaqSel(m.id); setAba('ficha') }}>📋 Ficha</Btn>
                  <Btn size="sm" cor={C.verdeClaro} onClick={()=>{ setFMan({...vMan, maquina_id:m.id, horimetro:m.horimetro_atual, km:m.km_atual}); setModalMan(true) }}>🔧 Manutenção</Btn>
                  <Btn size="sm" cor={C.verde} outline onClick={()=>{ setFMaq({...vMaq,...m}); setEditMaq(m.id); setModalMaq(true) }}>✏️</Btn>
                  <Btn size="sm" cor={C.critico} outline onClick={()=>excluirMaq(m.id)}>🗑️</Btn>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── ABA HISTÓRICO GERAL ── */}
      {aba==='manutencoes' && (
        <Secao titulo="Histórico de Manutenções" icon="🔧" cor={C.ambar}
          acao={<Btn size="sm" cor={C.ambar} onClick={()=>setModalMan(true)}>+ Nova</Btn>}>
          <Tabela colunas={[
            { key:'data',        label:'Data',     render:r=>fmtData(r.data) },
            { key:'maquina',     label:'Máquina',  render:r=>maquinas.find(m=>m.id===r.maquina_id)?.nome||'—' },
            { key:'tipo',        label:'Tipo',      render:r=>LABEL_MAN[r.tipo]||r.tipo },
            { key:'horimetro',   label:'Horímetro', render:r=>r.horimetro>0?`${fmtNum(r.horimetro,0)}h`:'—' },
            { key:'km',          label:'KM',        render:r=>r.km>0?fmtNum(r.km,0):'—' },
            { key:'descricao',   label:'Descrição' },
            { key:'valor_total', label:'Valor',     render:r=>r.valor_total?`R$ ${fmtNum(r.valor_total,2)}`:'—' },
          ]} dados={manutencoes} loading={loading} onDelete={r=>excluirMan(r.id)} />
        </Secao>
      )}

      {/* ── ABA FICHA DA MÁQUINA ── */}
      {aba==='ficha' && maqSelecionada && (
        <div>
          {/* Header */}
          <div style={{ background:`linear-gradient(135deg, ${C.ambar}33, ${C.bgCard})`, border:`1px solid ${C.border}`, borderRadius:14, padding:'18px 22px', marginBottom:18 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <div style={{ fontSize:36, marginBottom:4 }}>{LABEL_TIPO[maqSelecionada.tipo]?.split(' ')[0]||'⚙️'}</div>
                <h2 style={{ fontSize:22, fontWeight:800, color:C.texto, fontFamily:"'Syne',sans-serif" }}>{maqSelecionada.nome}</h2>
                <div style={{ color:C.textoSub, fontSize:13, marginTop:2 }}>
                  {maqSelecionada.marca} {maqSelecionada.modelo}
                  {maqSelecionada.ano ? ` · ${maqSelecionada.ano}` : ''}
                  {maqSelecionada.placa ? ` · Placa: ${maqSelecionada.placa}` : ''}
                </div>
              </div>
              <Btn size="sm" cor={C.ambar} onClick={()=>{ setFMan({...vMan, maquina_id:maqSelecionada.id, horimetro:maqSelecionada.horimetro_atual, km:maqSelecionada.km_atual}); setModalMan(true) }}>🔧 + Manutenção</Btn>
            </div>
          </div>

          {/* KPIs */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:18 }}>
            {[
              { l:'⏱️ Horímetro atual', v:`${fmtNum(maqSelecionada.horimetro_atual,0)}h`, c:C.ambar },
              { l:'🛣️ KM atual',        v:fmtNum(maqSelecionada.km_atual,0),               c:C.verdeClaro },
              { l:'🔧 Manutenções',     v:mansDaMaq.length,                                c:C.texto },
              { l:'💰 Total gasto',     v:`R$ ${fmtNum(mansDaMaq.reduce((s,m)=>s+parseFloat(m.valor_total||0),0),2)}`, c:C.critico },
            ].map((s,i)=>(
              <div key={i} style={{ background:C.bgCard, border:`1px solid ${C.border}`, borderLeft:`3px solid ${s.c}`, borderRadius:10, padding:'12px 14px' }}>
                <div style={{ fontSize:10, color:C.textoMuted, textTransform:'uppercase', fontWeight:600 }}>{s.l}</div>
                <div style={{ fontSize:18, fontWeight:800, color:s.c, fontFamily:'monospace', marginTop:4 }}>{s.v}</div>
              </div>
            ))}
          </div>

          {/* Próximas revisões */}
          {(maqSelecionada.proxima_revisao_horas || maqSelecionada.proxima_revisao_km) && (
            <div style={{ background:C.bgCard, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 16px', marginBottom:16 }}>
              <div style={{ fontSize:12, fontWeight:700, color:C.textoMuted, marginBottom:8, textTransform:'uppercase' }}>Próximas Revisões Programadas</div>
              <div style={{ display:'flex', gap:20 }}>
                {maqSelecionada.proxima_revisao_horas && (
                  <div>
                    <div style={{ fontSize:11, color:C.textoMuted }}>Por horímetro</div>
                    <div style={{ fontSize:16, fontWeight:800, color:maqSelecionada.horimetro_atual >= maqSelecionada.proxima_revisao_horas ? C.critico : C.ambar, fontFamily:'monospace' }}>
                      {fmtNum(maqSelecionada.proxima_revisao_horas,0)}h
                    </div>
                    <div style={{ fontSize:11, color:C.textoMuted }}>
                      Faltam: {Math.max(0, maqSelecionada.proxima_revisao_horas - maqSelecionada.horimetro_atual)}h
                    </div>
                  </div>
                )}
                {maqSelecionada.proxima_revisao_km && (
                  <div>
                    <div style={{ fontSize:11, color:C.textoMuted }}>Por KM</div>
                    <div style={{ fontSize:16, fontWeight:800, color:maqSelecionada.km_atual >= maqSelecionada.proxima_revisao_km ? C.critico : C.ambar, fontFamily:'monospace' }}>
                      {fmtNum(maqSelecionada.proxima_revisao_km,0)} km
                    </div>
                    <div style={{ fontSize:11, color:C.textoMuted }}>
                      Faltam: {Math.max(0, maqSelecionada.proxima_revisao_km - maqSelecionada.km_atual)} km
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Histórico */}
          <Secao titulo={`Histórico — ${mansDaMaq.length} manutenções`} icon="🔧" cor={C.ambar}>
            {mansDaMaq.length === 0 ? (
              <div style={{ color:C.textoMuted, padding:20, textAlign:'center' }}>Nenhuma manutenção registrada</div>
            ) : mansDaMaq.map((m, i) => (
              <div key={m.id} style={{ padding:'12px 0', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
                    <span style={{ fontSize:14, fontWeight:700, color:C.texto }}>{LABEL_MAN[m.tipo]||m.tipo}</span>
                    <span style={{ fontSize:11, color:C.textoMuted }}>{fmtData(m.data)}</span>
                    {m.horimetro > 0 && <span style={{ fontSize:11, color:C.ambar }}>⏱️ {fmtNum(m.horimetro,0)}h</span>}
                    {m.km > 0 && <span style={{ fontSize:11, color:C.verdeClaro }}>🛣️ {fmtNum(m.km,0)} km</span>}
                  </div>
                  {m.descricao && <div style={{ fontSize:12, color:C.textoSub, marginBottom:3 }}>{m.descricao}</div>}
                  {m.pecas_usadas && <div style={{ fontSize:11, color:C.textoMuted }}>🔩 Peças: {m.pecas_usadas}</div>}
                  {m.oficina && <div style={{ fontSize:11, color:C.textoMuted }}>🏪 {m.oficina}</div>}
                  {m.proxima_horas && <div style={{ fontSize:11, color:C.ambar }}>→ Próxima revisão: {fmtNum(m.proxima_horas,0)}h</div>}
                  {m.obs && <div style={{ fontSize:11, color:C.textoMuted, fontStyle:'italic', marginTop:3 }}>{m.obs}</div>}
                </div>
                <div style={{ textAlign:'right', flexShrink:0, marginLeft:12 }}>
                  {m.valor_total > 0 && <div style={{ fontSize:15, fontWeight:700, color:C.critico }}>R$ {fmtNum(m.valor_total,2)}</div>}
                  <button onClick={()=>excluirMan(m.id)} style={{ background:'none', border:`1px solid ${C.border}`, borderRadius:4, color:C.textoMuted, fontSize:10, padding:'2px 6px', cursor:'pointer', marginTop:4 }}>✕</button>
                </div>
              </div>
            ))}
          </Secao>

          {/* Obs */}
          {maqSelecionada.obs && (
            <div style={{ marginTop:12, background:C.bgCard, border:`1px solid ${C.border}`, borderRadius:8, padding:'10px 14px', fontSize:12, color:C.textoSub }}>
              📝 {maqSelecionada.obs}
            </div>
          )}
        </div>
      )}

      {/* ── Modal Máquina ── */}
      {modalMaq && (
        <Modal titulo={editMaq ? `Editar — ${fMaq.nome}` : 'Cadastrar Máquina'} onClose={()=>{ setModalMaq(false); setEditMaq(null); setFMaq(vMaq) }}>
          <Grid cols={2}>
            <Campo label="Nome / Identificação" value={fMaq.nome} onChange={v=>setFMaq(f=>({...f,nome:v}))} required placeholder="ex: Trator Amarelo, MF 275"/>
            <Campo label="Tipo" type="select" value={fMaq.tipo} onChange={v=>setFMaq(f=>({...f,tipo:v}))} options={TIPOS}/>
          </Grid>
          <Grid cols={3}>
            <Campo label="Marca" value={fMaq.marca||''} onChange={v=>setFMaq(f=>({...f,marca:v}))} placeholder="Massey, John Deere..."/>
            <Campo label="Modelo" value={fMaq.modelo||''} onChange={v=>setFMaq(f=>({...f,modelo:v}))} placeholder="275, 5075E..."/>
            <Campo label="Ano" type="number" value={fMaq.ano||''} onChange={v=>setFMaq(f=>({...f,ano:v}))} placeholder="2018"/>
          </Grid>
          <Grid cols={2}>
            <Campo label="Placa / Nº Série" value={fMaq.placa||''} onChange={v=>setFMaq(f=>({...f,placa:v}))}/>
            <Campo label="⏱️ Horímetro atual (h)" type="number" step="0.1" value={fMaq.horimetro_atual} onChange={v=>setFMaq(f=>({...f,horimetro_atual:v}))}/>
          </Grid>
          <Grid cols={2}>
            <Campo label="🛣️ KM atual" type="number" value={fMaq.km_atual} onChange={v=>setFMaq(f=>({...f,km_atual:v}))}/>
            <Campo label="Próxima revisão (h)" type="number" value={fMaq.proxima_revisao_horas||''} onChange={v=>setFMaq(f=>({...f,proxima_revisao_horas:v}))} placeholder="ex: 500"/>
          </Grid>
          <Campo label="Próxima revisão (km)" type="number" value={fMaq.proxima_revisao_km||''} onChange={v=>setFMaq(f=>({...f,proxima_revisao_km:v}))} placeholder="ex: 50000"/>
          <Campo label="Observações" type="textarea" value={fMaq.obs||''} onChange={v=>setFMaq(f=>({...f,obs:v}))}/>
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:8 }}>
            <Btn outline cor={C.textoMuted} onClick={()=>{ setModalMaq(false); setEditMaq(null) }}>Cancelar</Btn>
            <Btn cor={C.ambar} onClick={salvarMaq}>Salvar</Btn>
          </div>
        </Modal>
      )}

      {/* ── Modal Manutenção ── */}
      {modalMan && (
        <Modal titulo="Registrar Manutenção" onClose={()=>setModalMan(false)}>
          <Grid cols={2}>
            <Campo label="Máquina" type="select" value={fMan.maquina_id} onChange={v=>setFMan(f=>({...f,maquina_id:v}))}
              options={maquinas.map(m=>({ value:m.id, label:`${LABEL_TIPO[m.tipo]?.split(' ')[0]||'⚙️'} ${m.nome}` }))}/>
            <Campo label="Tipo de manutenção" type="select" value={fMan.tipo} onChange={v=>setFMan(f=>({...f,tipo:v}))} options={TIPOS_MAN}/>
          </Grid>
          <Grid cols={2}>
            <Campo label="Data" type="date" value={fMan.data} onChange={v=>setFMan(f=>({...f,data:v}))}/>
            <Campo label="Valor total (R$)" type="number" step="0.01" value={fMan.valor_total||''} onChange={v=>setFMan(f=>({...f,valor_total:v}))} placeholder="ex: 350.00"/>
          </Grid>
          <Grid cols={2}>
            <Campo label="⏱️ Horímetro (h)" type="number" step="0.1" value={fMan.horimetro||''} onChange={v=>setFMan(f=>({...f,horimetro:v}))}/>
            <Campo label="🛣️ KM" type="number" value={fMan.km||''} onChange={v=>setFMan(f=>({...f,km:v}))}/>
          </Grid>
          <Campo label="Descrição" value={fMan.descricao||''} onChange={v=>setFMan(f=>({...f,descricao:v}))} placeholder="ex: Troca óleo motor 15W40, 12L"/>
          <Campo label="🔩 Peças/Filtros usados" value={fMan.pecas_usadas||''} onChange={v=>setFMan(f=>({...f,pecas_usadas:v}))} placeholder="ex: Filtro óleo WD950, Filtro ar primário..."/>
          <Grid cols={2}>
            <Campo label="Próxima revisão em (h)" type="number" value={fMan.proxima_horas||''} onChange={v=>setFMan(f=>({...f,proxima_horas:v}))} placeholder="ex: 2500"/>
            <Campo label="Próxima revisão em (km)" type="number" value={fMan.proximo_km||''} onChange={v=>setFMan(f=>({...f,proximo_km:v}))} placeholder="ex: 55000"/>
          </Grid>
          <Campo label="Oficina / Responsável" value={fMan.oficina||''} onChange={v=>setFMan(f=>({...f,oficina:v}))} placeholder="ex: Oficina do Zé, Concessionária..."/>
          <Campo label="Observações" type="textarea" value={fMan.obs||''} onChange={v=>setFMan(f=>({...f,obs:v}))}/>
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:8 }}>
            <Btn outline cor={C.textoMuted} onClick={()=>setModalMan(false)}>Cancelar</Btn>
            <Btn cor={C.ambar} onClick={salvarMan}>Registrar</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}
