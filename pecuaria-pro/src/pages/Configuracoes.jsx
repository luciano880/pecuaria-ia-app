import { useState, useRef } from 'react'
import { supabase } from '../utils/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { C, hoje } from '../utils/helpers.js'
import { Secao, Campo, Grid, Btn, useToast } from '../components/UI.jsx'

// ── Parser de XML NF-e ────────────────────────────────────────
function parseNFe(xmlStr) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlStr, 'text/xml')

  const get = (el, tag) => el?.getElementsByTagName(tag)?.[0]?.textContent?.trim() || ''

  const itens = []
  const dets = doc.getElementsByTagName('det')

  for (const det of dets) {
    const prod = det.getElementsByTagName('prod')[0]
    if (!prod) continue

    const xProd = get(prod, 'xProd').toLowerCase()
    const qCom  = parseFloat(get(prod, 'qCom') || '0')
    const uCom  = get(prod, 'uCom')
    const vProd = parseFloat(get(prod, 'vProd') || '0')
    const ncm   = get(prod, 'NCM')

    // Classificar automaticamente por nome/NCM
    let categoria = 'outro'
    if (/silagem|milho silagem|sorgo/i.test(xProd)) categoria = 'silagem'
    else if (/pre.?secado|feno/i.test(xProd)) categoria = 'pre_secado'
    else if (/milho/i.test(xProd) && !/silagem/i.test(xProd)) categoria = 'milho'
    else if (/soja|farelo/i.test(xProd)) categoria = 'soja'
    else if (/racao|ração/i.test(xProd)) categoria = 'racao'
    else if (/concentrado/i.test(xProd)) categoria = 'concentrado'
    else if (/sal mineral|mineral/i.test(xProd)) categoria = 'sal_mineral'
    else if (/ureia|urea|nitrogenio/i.test(xProd)) categoria = 'aditivo'
    else if (/adubo|fertilizante|npk|map|dap|potassio|fosfato/i.test(xProd)) categoria = 'outro'

    // Unidade → padrão kg
    let unidade = 'kg'
    if (/^(L|LT|LIT)/i.test(uCom)) unidade = 'L'
    else if (/^(T|TON)/i.test(uCom)) unidade = 'ton'
    else if (/^(SC|SAC)/i.test(uCom)) { unidade = 'kg'; } // saco → converter kg se possível

    itens.push({
      nome: get(prod, 'xProd'),
      categoria,
      quantidade: qCom,
      unidade,
      preco_unitario: qCom > 0 ? vProd / qCom : 0,
      valor_total: vProd,
    })
  }

  const emitente = get(doc, 'xNome') || get(doc, 'xFant') || 'NF-e'
  const dataEmissao = get(doc, 'dhEmi')?.slice(0, 10) || hoje()
  const nNF = get(doc, 'nNF')

  return { itens, emitente, dataEmissao, nNF }
}

export default function Configuracoes() {
  const { user, perfil } = useAuth()
  const { toast, ToastContainer } = useToast()
  const [nome,     setNome]     = useState(perfil?.nome     || '')
  const [fazenda,  setFazenda]  = useState(perfil?.fazenda  || '')
  const [segmento, setSegmento] = useState(perfil?.segmento || 'leite')
  const [salvando, setSalvando] = useState(false)
  const [novaSenha,     setNovaSenha]     = useState('')
  const [confirmaSenha, setConfirmaSenha] = useState('')
  const [salvandoSenha, setSalvandoSenha] = useState(false)

  // Backup
  const [fazendoBackup,    setFazendoBackup]    = useState(false)
  const [restaurando,      setRestaurando]       = useState(false)
  const [importandoXML,    setImportandoXML]     = useState(false)
  const [itensXML,         setItensXML]          = useState([])
  const [infoXML,          setInfoXML]           = useState(null)
  const [itensSelec,       setItensSelec]        = useState({})
  const inputBackup = useRef(null)
  const inputXML    = useRef(null)

  async function salvarPerfil() {
    setSalvando(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const uid = sessionData?.session?.user?.id
      if (!uid) { toast('Sessão expirada.', 'erro'); setSalvando(false); return }
      const { error } = await supabase.from('perfis')
        .upsert({ id: uid, email: perfil?.email || user?.email, nome, fazenda, segmento })
      if (error) throw error
      toast('✅ Salvo! Recarregando...')
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map(r => r.unregister()))
      }
      setTimeout(() => { window.location.href = window.location.origin + '/?reload=' + Date.now() }, 1000)
    } catch (e) { toast(e.message, 'erro'); setSalvando(false) }
  }

  async function alterarSenha() {
    if (novaSenha.length < 6) { toast('Senha deve ter ao menos 6 caracteres', 'erro'); return }
    if (novaSenha !== confirmaSenha) { toast('Senhas não coincidem', 'erro'); return }
    setSalvandoSenha(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: novaSenha })
      if (error) throw error
      toast('Senha alterada!')
      setNovaSenha(''); setConfirmaSenha('')
    } catch (e) { toast(e.message, 'erro') }
    finally { setSalvandoSenha(false) }
  }

  // ── BACKUP ──────────────────────────────────────────────────
  async function gerarBackup() {
    setFazendoBackup(true)
    try {
      const tabelas = [
        'animais','pesagens','producao_leite','reproducao',
        'medicamentos','aplicacoes','vacinacoes','lotes','dietas',
        'estoque_insumos','movimentacoes_estoque','alertas',
        'entrega_leite','receitas','despesas','contas_receber','declaracao_ir'
      ]
      const backup = {
        versao: '1.0',
        fazenda: perfil?.fazenda,
        data: new Date().toISOString(),
        dados: {}
      }
      for (const t of tabelas) {
        const { data } = await supabase.from(t).select('*').eq('user_id', user.id)
        backup.dados[t] = data || []
      }
      const json = JSON.stringify(backup, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `backup_${perfil?.fazenda?.replace(/\s/g,'_')}_${hoje()}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast(`✅ Backup gerado com ${Object.values(backup.dados).reduce((s,d)=>s+d.length,0)} registros!`)
    } catch(e) { toast(e.message, 'erro') }
    finally { setFazendoBackup(false) }
  }

  // ── RESTAURAR BACKUP ────────────────────────────────────────
  async function restaurarBackup(e) {
    const file = e.target.files[0]
    if (!file) return
    if (!confirm('⚠️ Restaurar vai ADICIONAR os dados do backup. Registros existentes não serão apagados. Continuar?')) return
    setRestaurando(true)
    try {
      const text = await file.text()
      const backup = JSON.parse(text)
      if (!backup.dados) throw new Error('Arquivo de backup inválido')

      let total = 0
      const tabelas = Object.keys(backup.dados)
      for (const tabela of tabelas) {
        const registros = backup.dados[tabela]
        if (!registros?.length) continue
        // Remover id para evitar conflito, manter user_id
        const limpos = registros.map(r => {
          const { id, ...rest } = r
          return { ...rest, user_id: user.id }
        })
        // Inserir em lotes de 50
        for (let i = 0; i < limpos.length; i += 50) {
          const lote = limpos.slice(i, i + 50)
          await supabase.from(tabela).upsert(lote, { ignoreDuplicates: true })
          total += lote.length
        }
      }
      toast(`✅ ${total} registros restaurados!`)
    } catch(e) { toast('Erro ao restaurar: ' + e.message, 'erro') }
    finally { setRestaurando(false); e.target.value = '' }
  }

  // ── IMPORTAR XML NF-e ───────────────────────────────────────
  async function lerXML(e) {
    const file = e.target.files[0]
    if (!file) return
    try {
      const text = await file.text()
      const { itens, emitente, dataEmissao, nNF } = parseNFe(text)
      if (!itens.length) { toast('Nenhum produto encontrado no XML', 'erro'); return }
      setItensXML(itens)
      setInfoXML({ emitente, dataEmissao, nNF })
      // Selecionar todos por padrão
      const sel = {}
      itens.forEach((_, i) => { sel[i] = true })
      setItensSelec(sel)
      toast(`📄 NF-e lida! ${itens.length} produtos encontrados.`)
    } catch(e) { toast('Erro ao ler XML: ' + e.message, 'erro') }
    e.target.value = ''
  }

  async function importarItens() {
    setImportandoXML(true)
    try {
      const seg = perfil?.segmento || 'leite'
      let importados = 0
      for (const [i, item] of itensXML.entries()) {
        if (!itensSelec[i]) continue
        // Verificar se já existe insumo com mesmo nome
        const { data: existente } = await supabase
          .from('estoque_insumos')
          .select('id, quantidade')
          .eq('user_id', user.id)
          .ilike('nome', item.nome)
          .single()

        if (existente) {
          // Adicionar ao estoque existente
          await supabase.from('estoque_insumos').update({
            quantidade: parseFloat(existente.quantidade || 0) + item.quantidade,
            updated_at: new Date().toISOString()
          }).eq('id', existente.id)
          // Registrar movimentação
          await supabase.from('movimentacoes_estoque').insert({
            user_id: user.id,
            insumo_id: existente.id,
            tipo: 'entrada',
            quantidade: item.quantidade,
            data: infoXML.dataEmissao,
            motivo: `NF-e ${infoXML.nNF} — ${infoXML.emitente}`
          })
        } else {
          // Criar novo insumo
          const { data: novo } = await supabase.from('estoque_insumos').insert({
            user_id: user.id,
            segmento: seg,
            nome: item.nome,
            categoria: item.categoria,
            quantidade: item.quantidade,
            unidade: item.unidade,
            preco_unitario: item.preco_unitario,
            fornecedor: infoXML.emitente,
            consumo_diario: 0,
            estoque_minimo: 0,
          }).select().single()
          if (novo) {
            await supabase.from('movimentacoes_estoque').insert({
              user_id: user.id,
              insumo_id: novo.id,
              tipo: 'entrada',
              quantidade: item.quantidade,
              data: infoXML.dataEmissao,
              motivo: `NF-e ${infoXML.nNF} — ${infoXML.emitente}`
            })
          }
        }
        importados++
      }
      toast(`✅ ${importados} itens importados para o estoque!`)
      setItensXML([]); setInfoXML(null); setItensSelec({})
    } catch(e) { toast(e.message, 'erro') }
    finally { setImportandoXML(false) }
  }

  const segOpts = [
    { value:'leite', icon:'🥛', label:'Pecuária Leiteira', cor: C.leitePrimary, acc: C.leiteAccent },
    { value:'corte', icon:'🥩', label:'Pecuária de Corte',  cor: C.cortePrimary, acc: C.corteAccent },
  ]

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <ToastContainer />
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: C.texto, fontFamily:"'Syne',sans-serif" }}>⚙️ Configurações</h2>
        <p style={{ color: C.textoMuted, fontSize: 13 }}>Perfil, segmento, backup e importação</p>
      </div>

      {/* Segmento atual */}
      <div style={{ background:`${perfil?.segmento==='leite'?C.leitePrimary:C.cortePrimary}22`, border:`1px solid ${perfil?.segmento==='leite'?C.leiteAccent:C.corteAccent}`, borderRadius:10, padding:'10px 16px', marginBottom:20, fontSize:13, color:C.texto }}>
        Segmento atual: <strong style={{ color: perfil?.segmento==='leite'?C.leiteAccent:C.corteAccent }}>
          {perfil?.segmento==='leite'?'🥛 Pecuária Leiteira':'🥩 Pecuária de Corte'}
        </strong>
      </div>

      {/* Dados da fazenda */}
      <Secao titulo="Dados da Fazenda" icon="🏡" cor={C.verdeClaro}>
        <Grid cols={2}>
          <Campo label="Seu nome" value={nome} onChange={setNome} />
          <Campo label="Nome da fazenda" value={fazenda} onChange={setFazenda} />
        </Grid>
        <div style={{ marginBottom:16 }}>
          <label style={{ display:'block', fontSize:11, color:C.textoSub, marginBottom:8, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px' }}>Segmento</label>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {segOpts.map(s=>(
              <button key={s.value} onClick={()=>setSegmento(s.value)} style={{
                padding:'16px 12px', borderRadius:10,
                border:`2px solid ${segmento===s.value?s.acc:C.border}`,
                background:segmento===s.value?`${s.cor}44`:C.bgInput,
                color:segmento===s.value?s.acc:C.textoSub,
                fontWeight:700, fontSize:13, cursor:'pointer', textAlign:'center',
              }}>
                <div style={{ fontSize:28, marginBottom:6 }}>{s.icon}</div>
                {s.label}
                {segmento===s.value&&<div style={{ fontSize:11, marginTop:4, opacity:0.8 }}>✓ Selecionado</div>}
              </button>
            ))}
          </div>
          {segmento!==perfil?.segmento&&(
            <div style={{ marginTop:10, padding:'8px 12px', background:`${C.ambar}22`, border:`1px solid ${C.ambar}`, borderRadius:6, fontSize:12, color:C.ambar }}>
              ⚠️ Ao salvar, o app vai recarregar com o novo segmento.
            </div>
          )}
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end' }}>
          <Btn cor={C.verde} onClick={salvarPerfil} disabled={salvando}>
            {salvando?'⏳ Salvando...':'💾 Salvar perfil'}
          </Btn>
        </div>
      </Secao>

      {/* Backup e Restauração */}
      <Secao titulo="Backup & Restauração" icon="💾" cor={C.ambar}>
        <p style={{ fontSize:12, color:C.textoMuted, marginBottom:16, lineHeight:1.7 }}>
          O backup exporta <strong style={{color:C.texto}}>todos os seus dados</strong> em formato JSON.
          Guarde o arquivo em local seguro. Para restaurar, faça upload do arquivo de backup.
        </p>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          <Btn cor={C.ambar} onClick={gerarBackup} disabled={fazendoBackup}>
            {fazendoBackup?'⏳ Gerando...':'📥 Baixar Backup Completo'}
          </Btn>
          <Btn cor={C.verde} outline onClick={()=>inputBackup.current?.click()} disabled={restaurando}>
            {restaurando?'⏳ Restaurando...':'📤 Restaurar Backup'}
          </Btn>
          <input ref={inputBackup} type="file" accept=".json" style={{display:'none'}} onChange={restaurarBackup}/>
        </div>
        <div style={{ marginTop:12, padding:'8px 12px', background:`${C.border}`, borderRadius:6, fontSize:11, color:C.textoMuted }}>
          ⚠️ A restauração adiciona dados sem apagar os existentes. Ideal para migrar para outro dispositivo.
        </div>
      </Secao>

      {/* Importar XML NF-e */}
      <Secao titulo="Importar NF-e para Estoque" icon="📄" cor={C.verdeClaro}>
        <p style={{ fontSize:12, color:C.textoMuted, marginBottom:16, lineHeight:1.7 }}>
          Importe o XML da Nota Fiscal Eletrônica de compra de <strong style={{color:C.texto}}>ração, silagem, insumos</strong> e outros produtos.
          O sistema identifica automaticamente a categoria e lança no estoque.
        </p>
        <Btn cor={C.verdeClaro} onClick={()=>inputXML.current?.click()}>
          📄 Selecionar XML da NF-e
        </Btn>
        <input ref={inputXML} type="file" accept=".xml" style={{display:'none'}} onChange={lerXML}/>

        {/* Preview dos itens do XML */}
        {itensXML.length > 0 && infoXML && (
          <div style={{ marginTop:16 }}>
            <div style={{ background:`${C.verde}22`, border:`1px solid ${C.verde}`, borderRadius:8, padding:'10px 14px', marginBottom:12, fontSize:12 }}>
              <div style={{ color:C.texto, fontWeight:600 }}>📄 NF-e {infoXML.nNF} — {infoXML.emitente}</div>
              <div style={{ color:C.textoMuted, marginTop:2 }}>Data: {infoXML.dataEmissao} · {itensXML.length} produtos</div>
            </div>

            <div style={{ marginBottom:10, fontSize:11, color:C.textoMuted, fontWeight:600, textTransform:'uppercase' }}>
              Selecione os itens para importar:
            </div>

            {itensXML.map((item, i) => (
              <div key={i} style={{
                display:'flex', alignItems:'center', gap:12,
                padding:'10px 12px', marginBottom:6,
                background: itensSelec[i] ? `${C.verde}18` : C.bgInput,
                border:`1px solid ${itensSelec[i]?C.verdeClaro:C.border}`,
                borderRadius:8, cursor:'pointer',
              }} onClick={()=>setItensSelec(s=>({...s,[i]:!s[i]}))}>
                <div style={{
                  width:20, height:20, borderRadius:4, flexShrink:0,
                  background: itensSelec[i]?C.verdeClaro:C.border,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:12, color:'#fff',
                }}>
                  {itensSelec[i]?'✓':''}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:C.texto }}>{item.nome}</div>
                  <div style={{ fontSize:11, color:C.textoMuted, marginTop:2 }}>
                    {item.quantidade} {item.unidade} · R$ {item.preco_unitario.toFixed(2)}/un ·
                    <span style={{
                      marginLeft:6, background:`${C.verde}22`, color:C.verdeClaro,
                      padding:'1px 6px', borderRadius:4, fontSize:10,
                    }}>{item.categoria}</span>
                  </div>
                </div>
                <div style={{ fontSize:14, fontWeight:700, color:C.ambar }}>
                  R$ {item.valor_total.toFixed(2)}
                </div>
              </div>
            ))}

            <div style={{ display:'flex', gap:10, marginTop:12, justifyContent:'flex-end' }}>
              <Btn outline cor={C.textoMuted} onClick={()=>{setItensXML([]);setInfoXML(null)}}>Cancelar</Btn>
              <Btn cor={C.verdeClaro} onClick={importarItens} disabled={importandoXML||!Object.values(itensSelec).some(Boolean)}>
              {importandoXML ? '⏳ Importando...' : `✅ Importar ${Object.values(itensSelec).filter(Boolean).length} itens`}
              </Btn>
            </div>
          </div>
        )}
      </Secao>

      {/* Alterar Senha */}
      <Secao titulo="Alterar Senha" icon="🔒" cor={C.ambar}>
        <Campo label="Nova senha" type="password" value={novaSenha} onChange={setNovaSenha} placeholder="Min. 6 caracteres" />
        <Campo label="Confirmar nova senha" type="password" value={confirmaSenha} onChange={setConfirmaSenha} placeholder="Repita a senha" />
        <div style={{ display:'flex', justifyContent:'flex-end' }}>
          <Btn cor={C.ambar} onClick={alterarSenha} disabled={salvandoSenha}>
            {salvandoSenha?'⏳ Alterando...':'🔒 Alterar senha'}
          </Btn>
        </div>
      </Secao>

      {/* Sobre */}
      <Secao titulo="Sobre o Sistema" icon="ℹ️" cor={C.textoMuted}>
        <div style={{ fontSize:12, color:C.textoMuted, lineHeight:1.8 }}>
          <div>📦 Banco: Supabase · 🔐 Auth: OTP por e-mail · 🤖 IA: Claude Sonnet 4</div>
          <div>⚛️ Frontend: React + Vite · 📊 Gráficos: Recharts</div>
          <div style={{ marginTop:8, color:C.verdeClaro }}>📚 Referências: Embrapa · CBNA · NRC · MAPA · CFMV</div>
        </div>
      </Secao>
    </div>
  )
}
