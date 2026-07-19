import { useState, useRef } from 'react'
import { useTabela } from '../utils/useTabela.js'
import { supabase } from '../utils/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { C, fmtNum, fmtBRL, hoje, diasCobertura, statusDias } from '../utils/helpers.js'
import { Secao, Tabela, Modal, Campo, Grid, Btn, useToast } from '../components/UI.jsx'

// Parser NF-e XML
function parseNFe(xmlStr) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlStr, 'text/xml')
  const get = (el, tag) => el?.getElementsByTagName(tag)?.[0]?.textContent?.trim() || ''
  const itens = []
  for (const det of doc.getElementsByTagName('det')) {
    const prod = det.getElementsByTagName('prod')[0]
    if (!prod) continue
    const xProd = get(prod, 'xProd').toLowerCase()
    const qCom  = parseFloat(get(prod, 'qCom') || '0')
    const uCom  = get(prod, 'uCom')
    const vProd = parseFloat(get(prod, 'vProd') || '0')
    let categoria = 'outro'
    if (/silagem|milho silagem|sorgo/i.test(xProd)) categoria = 'silagem'
    else if (/pre.?secado|feno/i.test(xProd)) categoria = 'pre_secado'
    else if (/milho/i.test(xProd) && !/silagem/i.test(xProd)) categoria = 'milho'
    else if (/soja|farelo/i.test(xProd)) categoria = 'soja'
    else if (/racao|ração/i.test(xProd)) categoria = 'racao'
    else if (/concentrado/i.test(xProd)) categoria = 'concentrado'
    else if (/sal mineral|mineral/i.test(xProd)) categoria = 'sal_mineral'
    else if (/vacina|imuno|ftosa|carbunc|botul|clostr|brucel/i.test(xProd)) categoria = 'vacina'
    let unidade = 'kg'
    if (/^(L|LT|LIT)/i.test(uCom)) unidade = 'L'
    else if (/^(T|TON)/i.test(uCom)) unidade = 'ton'
    else if (/^(UN|DOSE|DOS)/i.test(uCom)) unidade = 'dose'
    itens.push({
      nome: get(prod, 'xProd'),
      categoria, quantidade: qCom, unidade,
      preco_unitario: qCom > 0 ? vProd / qCom : 0,
      valor_total: vProd,
    })
  }
  return {
    itens,
    emitente: get(doc, 'xNome') || get(doc, 'xFant') || 'NF-e',
    dataEmissao: get(doc, 'dhEmi')?.slice(0, 10) || hoje(),
    nNF: get(doc, 'nNF'),
  }
}

export default function Estoque() {
  const { user, perfil } = useAuth()
  const seg = perfil?.segmento
  const cor = seg === 'leite' ? C.leiteAccent : C.corteAccent
  const { toast, ToastContainer } = useToast()

  const { dados: insumos, loading, inserir, atualizar, carregar, remover } = useTabela('estoque_insumos', { segmento: seg })
  const { dados: dietas, inserir: inserirDieta, remover: removerDieta } = useTabela('dietas', { segmento: seg })

  const [aba,        setAba]        = useState('estoque')
  const [modal,      setModal]      = useState(false)
  const [modalMov,   setModalMov]   = useState(null)
  const [modalDieta, setModalDieta] = useState(false)
  const [editando,   setEditando]   = useState(null)
  const [itensXML,   setItensXML]   = useState([])
  const [infoXML,    setInfoXML]    = useState(null)
  const [itensSelec, setItensSelec] = useState({})
  const [importando, setImportando] = useState(false)
  const inputXML = useRef(null)

  const CATS = [
    { value:'silagem',    label:'🌽 Silagem' },
    { value:'pre_secado', label:'🌿 Pré-secado' },
    { value:'feno',       label:'🌾 Feno' },
    { value:'racao',      label:'🧺 Ração' },
    { value:'concentrado',label:'🟤 Concentrado' },
    { value:'sal_mineral',label:'🧂 Sal Mineral' },
    { value:'milho',      label:'🌽 Milho (grão)' },
    { value:'soja',       label:'🫘 Farelo de Soja' },
    { value:'volumoso',   label:'🌱 Volumoso' },
    { value:'aditivo',    label:'⚗️ Aditivo' },
    { value:'vacina',     label:'💉 Vacina' },
    { value:'medicamento',label:'💊 Medicamento' },
    { value:'outro',      label:'📦 Outro' },
  ]
  const LABEL_CAT = Object.fromEntries(CATS.map(c => [c.value, c.label]))

  const vazio = { nome:'', categoria:'silagem', quantidade:0, unidade:'kg', consumo_diario:0, estoque_minimo:0, preco_unitario:0, fornecedor:'' }
  const [form, setForm] = useState(vazio)
  const [fMov, setFMov] = useState({ tipo:'entrada', quantidade:'', data:hoje(), motivo:'' })
  const [fDieta, setFDieta] = useState({ lote:'', data_inicio:hoje(), silagem_kg_cab_dia:0, concentrado_kg_cab_dia:0, sal_mineral_g_cab_dia:0, obs:'' })

  function set(k,v)  { setForm(f => ({ ...f, [k]: v })) }
  function setD(k,v) { setFDieta(f => ({ ...f, [k]: v })) }

  function abrirNovo()    { setForm(vazio); setEditando(null); setModal(true) }
  function abrirEditar(r) { setForm({ ...vazio, ...r }); setEditando(r.id); setModal(true) }

  async function excluirInsumo(r) {
    if (!confirm(`Excluir "${r.nome}"?`)) return
    try { await remover(r.id); toast('Removido!') } catch(e) { toast(e.message,'erro') }
  }
  async function excluirDieta(r) {
    if (!confirm(`Excluir dieta do lote "${r.lote}"?`)) return
    try { await removerDieta(r.id); toast('Dieta removida!') } catch(e) { toast(e.message,'erro') }
  }

  async function salvar() {
    if (!form.nome) { toast('Nome obrigatório','erro'); return }
    try {
      const n = v => (v===''||v===null||v===undefined) ? null : parseFloat(v)||0
      const payload = { ...form, segmento:seg, quantidade:n(form.quantidade), consumo_diario:n(form.consumo_diario), estoque_minimo:n(form.estoque_minimo), preco_unitario:n(form.preco_unitario) }
      if (editando) await atualizar(editando, payload)
      else await inserir(payload)
      toast(editando ? 'Atualizado!' : 'Cadastrado!')
      setModal(false)
    } catch(e) { toast(e.message,'erro') }
  }

  async function salvarMov() {
    if (!fMov.quantidade || fMov.quantidade <= 0) { toast('Quantidade inválida','erro'); return }
    try {
      await supabase.from('movimentacoes_estoque').insert({
        user_id:user.id, insumo_id:modalMov.id,
        tipo:fMov.tipo, quantidade:parseFloat(fMov.quantidade),
        data:fMov.data, motivo:fMov.motivo||null,
      })
      const delta = fMov.tipo==='entrada'
        ? parseFloat(modalMov.quantidade)+parseFloat(fMov.quantidade)
        : Math.max(0, parseFloat(modalMov.quantidade)-parseFloat(fMov.quantidade))
      await atualizar(modalMov.id, { quantidade:delta })
      toast(fMov.tipo==='entrada' ? 'Entrada registrada!' : 'Baixa registrada!')
      setModalMov(null)
    } catch(e) { toast(e.message,'erro') }
  }

  async function salvarDieta() {
    if (!fDieta.lote) { toast('Informe o lote','erro'); return }
    try { await inserirDieta({ ...fDieta, segmento:seg }); toast('Dieta cadastrada!'); setModalDieta(false) }
    catch(e) { toast(e.message,'erro') }
  }

  // ── Importar XML NF-e ─────────────────────────────────────
  async function lerXML(e) {
    const file = e.target.files[0]
    if (!file) return
    try {
      const text = await file.text()
      const { itens, emitente, dataEmissao, nNF } = parseNFe(text)
      if (!itens.length) { toast('Nenhum produto encontrado no XML','erro'); return }
      setItensXML(itens); setInfoXML({ emitente, dataEmissao, nNF })
      const sel = {}; itens.forEach((_,i) => { sel[i] = true }); setItensSelec(sel)
      setAba('xml')
      toast(`📄 NF-e lida! ${itens.length} produtos.`)
    } catch(e) { toast('Erro ao ler XML: '+e.message,'erro') }
    e.target.value = ''
  }

  async function importarItens() {
    setImportando(true)
    try {
      let importados = 0
      for (const [i, item] of itensXML.entries()) {
        if (!itensSelec[i]) continue
        const { data: exist } = await supabase.from('estoque_insumos').select('id,quantidade').eq('user_id',user.id).ilike('nome',item.nome).maybeSingle()
        if (exist) {
          await supabase.from('estoque_insumos').update({ quantidade: parseFloat(exist.quantidade||0)+item.quantidade }).eq('id',exist.id)
          await supabase.from('movimentacoes_estoque').insert({ user_id:user.id, insumo_id:exist.id, tipo:'entrada', quantidade:item.quantidade, data:infoXML.dataEmissao, motivo:`NF-e ${infoXML.nNF} — ${infoXML.emitente}` })
        } else {
          const { data: novo } = await supabase.from('estoque_insumos').insert({ user_id:user.id, segmento:seg, nome:item.nome, categoria:item.categoria, quantidade:item.quantidade, unidade:item.unidade, preco_unitario:item.preco_unitario, fornecedor:infoXML.emitente, consumo_diario:0, estoque_minimo:0 }).select().single()
          if (novo) await supabase.from('movimentacoes_estoque').insert({ user_id:user.id, insumo_id:novo.id, tipo:'entrada', quantidade:item.quantidade, data:infoXML.dataEmissao, motivo:`NF-e ${infoXML.nNF} — ${infoXML.emitente}` })
        }
        importados++
      }
      toast(`✅ ${importados} itens importados!`)
      setItensXML([]); setInfoXML(null); setItensSelec({})
      setAba('estoque'); carregar()
    } catch(e) { toast(e.message,'erro') }
    finally { setImportando(false) }
  }

  const estoqueBaixo = insumos.filter(i => parseFloat(i.quantidade) <= parseFloat(i.estoque_minimo||0))
  const vacinas = insumos.filter(i => i.categoria === 'vacina' || i.categoria === 'medicamento')

  const colunas = [
    { key:'nome',      label:'Insumo' },
    { key:'categoria', label:'Categoria', render:r => LABEL_CAT[r.categoria]||r.categoria },
    { key:'quantidade',label:'Estoque', render:r => (
      <span style={{ color:parseFloat(r.quantidade)<=parseFloat(r.estoque_minimo||0)?C.critico:C.texto, fontWeight:700, fontFamily:'monospace' }}>
        {fmtNum(r.quantidade,1)} {r.unidade}
      </span>
    )},
    { key:'consumo_diario',label:'Consumo/dia', render:r => r.consumo_diario>0?`${r.consumo_diario} ${r.unidade}/dia`:'—' },
    { key:'dias',label:'Cobertura', render:r => {
      const dias = diasCobertura(r.quantidade,r.consumo_diario)
      if (dias===999) return <span style={{color:C.textoMuted}}>—</span>
      const s = statusDias(dias)
      return <span style={{color:s.cor,fontWeight:700}}>{s.icon} {dias}d</span>
    }},
    { key:'preco_unitario',label:'Preço/un', render:r => r.preco_unitario>0?fmtBRL(r.preco_unitario):'—' },
    { key:'acoes',label:'', render:r => (
      <div style={{display:'flex',gap:4}}>
        <Btn size="sm" cor={C.verdeClaro} onClick={() => { setModalMov(r); setFMov({tipo:'entrada',quantidade:'',data:hoje(),motivo:''}) }}>📥</Btn>
        <Btn size="sm" cor={C.critico}   onClick={() => { setModalMov(r); setFMov({tipo:'saida',quantidade:'',data:hoje(),motivo:'Consumo'}) }}>📤</Btn>
        <Btn size="sm" cor={C.verde} outline onClick={() => abrirEditar(r)}>✏️</Btn>
      </div>
    )},
  ]

  const abaList = [
    { id:'estoque', l:'📦 Estoque' },
    { id:'vacinas', l:`💉 Vacinas (${vacinas.length})` },
    { id:'dietas',  l:'🥣 Dietas' },
    { id:'xml',     l:'📄 Importar NF-e' },
  ]

  return (
    <div style={{maxWidth:1000,margin:'0 auto'}}>
      <ToastContainer />
      <input ref={inputXML} type="file" accept=".xml" style={{display:'none'}} onChange={lerXML}/>

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <div>
          <h2 style={{fontSize:22,fontWeight:800,color:cor,fontFamily:"'Syne',sans-serif"}}>🌽 Estoque & Dietas</h2>
          <p style={{color:C.textoMuted,fontSize:13}}>Insumos, vacinas, silagem, ração e dietas</p>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <Btn cor={cor} onClick={abrirNovo}>+ Insumo</Btn>
          <Btn cor={C.critico} outline onClick={() => { setForm({...vazio,categoria:'vacina',unidade:'dose'}); setEditando(null); setModal(true) }}>💉 + Vacina</Btn>
          <Btn cor={C.ambar} outline onClick={() => setModalDieta(true)}>+ Dieta</Btn>
          <Btn cor={C.verdeClaro} outline onClick={() => inputXML.current?.click()}>📄 XML NF-e</Btn>
        </div>
      </div>

      {/* Alerta estoque baixo */}
      {estoqueBaixo.length > 0 && (
        <div style={{background:`${C.critico}18`,border:`1px solid ${C.critico}`,borderRadius:10,padding:'10px 16px',marginBottom:16,fontSize:13}}>
          <strong style={{color:C.critico}}>⚠️ {estoqueBaixo.length} item(ns) abaixo do mínimo: </strong>
          <span style={{color:C.texto}}>{estoqueBaixo.map(i=>i.nome).join(', ')}</span>
        </div>
      )}

      {/* Abas */}
      <div style={{display:'flex',gap:2,marginBottom:16,borderBottom:`1px solid ${C.border}`,flexWrap:'wrap'}}>
        {abaList.map(a => (
          <button key={a.id} onClick={()=>setAba(a.id)} style={{
            padding:'8px 14px',border:'none',background:'transparent',
            borderBottom:aba===a.id?`2px solid ${cor}`:'2px solid transparent',
            color:aba===a.id?cor:C.textoMuted,fontSize:12,fontWeight:600,cursor:'pointer',
          }}>{a.l}</button>
        ))}
      </div>

      {/* ── ABA ESTOQUE ── */}
      {aba==='estoque' && (
        <Secao titulo={`${insumos.filter(i=>i.categoria!=='vacina'&&i.categoria!=='medicamento').length} insumos`} icon="📦" cor={cor}
          acao={<Btn size="sm" cor={cor} onClick={abrirNovo}>+ Novo</Btn>}>
          <Tabela colunas={colunas} dados={insumos.filter(i=>i.categoria!=='vacina'&&i.categoria!=='medicamento')} loading={loading} onDelete={excluirInsumo}/>
        </Secao>
      )}

      {/* ── ABA VACINAS ── */}
      {aba==='vacinas' && (
        <Secao titulo={`${vacinas.length} vacinas e medicamentos em estoque`} icon="💉" cor={C.critico}
          acao={<Btn size="sm" cor={C.critico} onClick={()=>{setForm({...vazio,categoria:'vacina',unidade:'dose'});setEditando(null);setModal(true)}}>+ Nova Vacina</Btn>}>
          {vacinas.length===0 ? (
            <div style={{color:C.textoMuted,padding:24,textAlign:'center'}}>
              <div style={{fontSize:28,marginBottom:8}}>💉</div>
              <div>Nenhuma vacina cadastrada</div>
              <div style={{fontSize:12,marginTop:4}}>Clique em "+ Vacina" ou importe pelo XML da NF-e</div>
            </div>
          ) : (
            <Tabela colunas={colunas} dados={vacinas} loading={loading} onDelete={excluirInsumo}/>
          )}
          <div style={{marginTop:12,padding:'8px 12px',background:`${C.ambar}18`,border:`1px solid ${C.ambar}`,borderRadius:6,fontSize:12,color:C.ambar}}>
            💡 Ao aplicar uma vacina na aba <strong>Sanidade</strong>, a quantidade é descontada automaticamente do estoque.
          </div>
        </Secao>
      )}

      {/* ── ABA DIETAS ── */}
      {aba==='dietas' && (
        <Secao titulo="Dietas por Lote" icon="🥣" cor={C.ambar}
          acao={<Btn size="sm" cor={C.ambar} onClick={()=>setModalDieta(true)}>+ Nova Dieta</Btn>}>
          <Tabela colunas={[
            { key:'lote',                   label:'Lote' },
            { key:'data_inicio',            label:'Início',     render:r=>r.data_inicio||'—' },
            { key:'silagem_kg_cab_dia',     label:'Silagem/cab',render:r=>`${r.silagem_kg_cab_dia||0} kg` },
            { key:'concentrado_kg_cab_dia', label:'Conc./cab',  render:r=>`${r.concentrado_kg_cab_dia||0} kg` },
            { key:'sal_mineral_g_cab_dia',  label:'Sal/cab',    render:r=>`${r.sal_mineral_g_cab_dia||0} g` },
            { key:'obs',                    label:'Obs',        render:r=>r.obs||'—' },
          ]} dados={dietas} loading={false} onDelete={excluirDieta}/>
        </Secao>
      )}

      {/* ── ABA XML ── */}
      {aba==='xml' && (
        <Secao titulo="Importar NF-e para Estoque" icon="📄" cor={C.verdeClaro}>
          <p style={{fontSize:12,color:C.textoMuted,marginBottom:16,lineHeight:1.7}}>
            Importe o XML da Nota Fiscal Eletrônica. O sistema identifica automaticamente ração, silagem, vacinas e outros insumos.
          </p>
          <Btn cor={C.verdeClaro} onClick={()=>inputXML.current?.click()}>📄 Selecionar XML</Btn>

          {itensXML.length>0 && infoXML && (
            <div style={{marginTop:16}}>
              <div style={{background:`${C.verde}22`,border:`1px solid ${C.verde}`,borderRadius:8,padding:'10px 14px',marginBottom:12,fontSize:12}}>
                <div style={{color:C.texto,fontWeight:600}}>NF-e {infoXML.nNF} — {infoXML.emitente}</div>
                <div style={{color:C.textoMuted,marginTop:2}}>{infoXML.dataEmissao} · {itensXML.length} produtos</div>
              </div>
              {itensXML.map((item,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 12px',marginBottom:6,background:itensSelec[i]?`${C.verde}18`:C.bgInput,border:`1px solid ${itensSelec[i]?C.verdeClaro:C.border}`,borderRadius:8,cursor:'pointer'}}
                  onClick={()=>setItensSelec(s=>({...s,[i]:!s[i]}))}>
                  <div style={{width:20,height:20,borderRadius:4,flexShrink:0,background:itensSelec[i]?C.verdeClaro:C.border,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,color:'#fff'}}>
                    {itensSelec[i]?'✓':''}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:600,color:C.texto}}>{item.nome}</div>
                    <div style={{fontSize:11,color:C.textoMuted,marginTop:2}}>
                      {item.quantidade} {item.unidade} · R$ {item.preco_unitario.toFixed(2)}/un ·
                      <span style={{marginLeft:6,background:`${C.verde}22`,color:C.verdeClaro,padding:'1px 6px',borderRadius:4,fontSize:10}}>{LABEL_CAT[item.categoria]||item.categoria}</span>
                    </div>
                  </div>
                  <div style={{fontSize:14,fontWeight:700,color:C.ambar}}>R$ {item.valor_total.toFixed(2)}</div>
                </div>
              ))}
              <div style={{display:'flex',gap:10,marginTop:12,justifyContent:'flex-end'}}>
                <Btn outline cor={C.textoMuted} onClick={()=>{setItensXML([]);setInfoXML(null);setAba('estoque')}}>Cancelar</Btn>
                <Btn cor={C.verdeClaro} onClick={importarItens} disabled={importando||!Object.values(itensSelec).some(Boolean)}>
                  {importando?'⏳ Importando...':`✅ Importar ${Object.values(itensSelec).filter(Boolean).length} itens`}
                </Btn>
              </div>
            </div>
          )}
        </Secao>
      )}

      {/* Modal cadastro insumo/vacina */}
      {modal && (
        <Modal titulo={editando?(form.categoria==='vacina'?'Editar Vacina':'Editar Insumo'):(form.categoria==='vacina'?'Cadastrar Vacina':'Cadastrar Insumo')} onClose={()=>setModal(false)}>
          <Grid cols={2}>
            <Campo label="Nome" value={form.nome} onChange={v=>set('nome',v)} required/>
            <Campo label="Categoria" type="select" value={form.categoria} onChange={v=>set('categoria',v)} options={CATS}/>
          </Grid>
          <Grid cols={3}>
            <Campo label="Quantidade" type="number" step="0.1" value={form.quantidade} onChange={v=>set('quantidade',v)}/>
            <Campo label="Unidade" type="select" value={form.unidade} onChange={v=>set('unidade',v)}
              options={['kg','g','L','mL','ton','dose','frasco','saco','rolo'].map(u=>({value:u,label:u}))}/>
            <Campo label="Estoque mínimo" type="number" step="0.1" value={form.estoque_minimo} onChange={v=>set('estoque_minimo',v)}/>
          </Grid>
          <Grid cols={2}>
            <Campo label="Consumo diário" type="number" step="0.1" value={form.consumo_diario} onChange={v=>set('consumo_diario',v)}/>
            <Campo label="Preço unitário (R$)" type="number" step="0.01" value={form.preco_unitario} onChange={v=>set('preco_unitario',v)}/>
          </Grid>
          <Campo label="Fornecedor" value={form.fornecedor||''} onChange={v=>set('fornecedor',v)}/>
          <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:8}}>
            <Btn outline cor={C.textoMuted} onClick={()=>setModal(false)}>Cancelar</Btn>
            <Btn cor={cor} onClick={salvar}>Salvar</Btn>
          </div>
        </Modal>
      )}

      {/* Modal movimentação */}
      {modalMov && (
        <Modal titulo={fMov.tipo==='entrada'?`📥 Entrada — ${modalMov.nome}`:`📤 Baixa — ${modalMov.nome}`} onClose={()=>setModalMov(null)}>
          <div style={{background:C.bgInput,borderRadius:8,padding:'10px 14px',marginBottom:16,display:'flex',justifyContent:'space-between'}}>
            <div>
              <div style={{fontSize:11,color:C.textoMuted,textTransform:'uppercase',fontWeight:600}}>Estoque atual</div>
              <div style={{fontSize:20,fontWeight:800,color:C.texto,fontFamily:'monospace',marginTop:2}}>{fmtNum(modalMov.quantidade,1)} {modalMov.unidade}</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:11,color:C.textoMuted,textTransform:'uppercase',fontWeight:600}}>Após movimentação</div>
              <div style={{fontSize:20,fontWeight:800,fontFamily:'monospace',marginTop:2,color:fMov.tipo==='entrada'?C.verdeClaro:C.critico}}>
                {fMov.tipo==='entrada'
                  ? fmtNum(parseFloat(modalMov.quantidade||0)+parseFloat(fMov.quantidade||0),1)
                  : fmtNum(Math.max(0,parseFloat(modalMov.quantidade||0)-parseFloat(fMov.quantidade||0)),1)
                } {modalMov.unidade}
              </div>
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14}}>
            {[{v:'entrada',icon:'📥',label:'Entrada',cor:C.verdeClaro},{v:'saida',icon:'📤',label:'Baixa/Consumo',cor:C.critico}].map(t=>(
              <button key={t.v} onClick={()=>setFMov(f=>({...f,tipo:t.v}))} style={{padding:'10px',borderRadius:8,cursor:'pointer',textAlign:'center',border:`2px solid ${fMov.tipo===t.v?t.cor:C.border}`,background:fMov.tipo===t.v?`${t.cor}22`:C.bgInput,color:fMov.tipo===t.v?t.cor:C.textoMuted,fontWeight:700,fontSize:13}}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          <Grid cols={2}>
            <Campo label={`Quantidade (${modalMov.unidade})`} type="number" step="0.1" value={fMov.quantidade} onChange={v=>setFMov(f=>({...f,quantidade:v}))}/>
            <Campo label="Data" type="date" value={fMov.data} onChange={v=>setFMov(f=>({...f,data:v}))}/>
          </Grid>
          <Campo label="Motivo" value={fMov.motivo} onChange={v=>setFMov(f=>({...f,motivo:v}))} placeholder={fMov.tipo==='entrada'?'ex: Compra, NF 1234...':'ex: Consumo, Vacinação lote A...'}/>
          <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:8}}>
            <Btn outline cor={C.textoMuted} onClick={()=>setModalMov(null)}>Cancelar</Btn>
            <Btn cor={fMov.tipo==='entrada'?C.verdeClaro:C.critico} onClick={salvarMov}>
              {fMov.tipo==='entrada'?'📥 Registrar entrada':'📤 Dar baixa'}
            </Btn>
          </div>
        </Modal>
      )}

      {/* Modal dieta */}
      {modalDieta && (
        <Modal titulo="Cadastrar Dieta" onClose={()=>setModalDieta(false)}>
          <Grid cols={2}>
            <Campo label="Lote / Grupo" value={fDieta.lote} onChange={v=>setD('lote',v)} required/>
            <Campo label="Data início" type="date" value={fDieta.data_inicio} onChange={v=>setD('data_inicio',v)}/>
          </Grid>
          <Grid cols={3}>
            <Campo label="Silagem (kg/cab/dia)" type="number" step="0.1" value={fDieta.silagem_kg_cab_dia} onChange={v=>setD('silagem_kg_cab_dia',v)}/>
            <Campo label="Conc. (kg/cab/dia)" type="number" step="0.1" value={fDieta.concentrado_kg_cab_dia} onChange={v=>setD('concentrado_kg_cab_dia',v)}/>
            <Campo label="Sal (g/cab/dia)" type="number" step="1" value={fDieta.sal_mineral_g_cab_dia} onChange={v=>setD('sal_mineral_g_cab_dia',v)}/>
          </Grid>
          <Campo label="Observações" type="textarea" value={fDieta.obs} onChange={v=>setD('obs',v)}/>
          <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:8}}>
            <Btn outline cor={C.textoMuted} onClick={()=>setModalDieta(false)}>Cancelar</Btn>
            <Btn cor={C.ambar} onClick={salvarDieta}>Salvar Dieta</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}
