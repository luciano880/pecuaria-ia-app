import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ScannerBrinco from '../components/ScannerBrinco.jsx'
import { useTabela } from '../utils/useTabela.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { C, fmtData, hoje, getCategoriasSegmento, LABEL_CATEGORIA, limparPayload } from '../utils/helpers.js'
import { Secao, Tabela, Modal, Campo, Grid, Btn, useToast } from '../components/UI.jsx'

export default function Animais() {
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const seg = perfil?.segmento
  const { dados, loading, inserir, atualizar, remover } = useTabela('animais', { segmento: seg })
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [busca, setBusca] = useState('')
  const [scannerBusca, setScannerBusca] = useState(false)
  const [scannerCadastro, setScannerCadastro] = useState(false)
  const { toast, ToastContainer } = useToast()

  const CATS = getCategoriasSegmento(seg)

  const vazio = { brinco:'', nome:'', raca:'', sexo:'F', data_nascimento:'', categoria: CATS[0],
    lote:'', mae_brinco:'', peso_entrada:'', obs:'' }
  const [form, setForm] = useState(vazio)

  // Atualizar categoria padrão quando o segmento carregar/mudar
  useEffect(() => {
    if (seg && !editando) {
      setForm(f => ({ ...f, categoria: CATS.includes(f.categoria) ? f.categoria : CATS[0] }))
    }
  }, [seg])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function abrirNovo() { setForm({ ...vazio, categoria: CATS[0] }); setEditando(null); setModal(true) }
  function abrirEditar(row) { setForm({ ...vazio, ...row }); setEditando(row.id); setModal(true) }

  async function salvar() {
    if (!form.brinco) { toast('Número do brinco obrigatório', 'erro'); return }
    try {
      // Converter campos numéricos vazios para null
      const payload = limparPayload({ ...form, segmento: seg })
      if (editando) await atualizar(editando, payload)
      else await inserir(payload)
      toast(editando ? 'Animal atualizado!' : 'Animal cadastrado!')
      setModal(false)
    } catch (e) { toast(e.message, 'erro') }
  }

  async function excluir(row) {
    if (!confirm(`Excluir animal brinco ${row.brinco}?`)) return
    try { await remover(row.id); toast('Animal removido!') }
    catch (e) { toast(e.message, 'erro') }
  }

  const filtrados = dados.filter(a =>
    String(a.brinco ?? '').toLowerCase().includes(busca.toLowerCase()) ||
    String(a.nome ?? '').toLowerCase().includes(busca.toLowerCase()) ||
    String(a.categoria ?? '').toLowerCase().includes(busca.toLowerCase())
  )

  // Resumo por categoria
  const resumo = CATS.map(cat => ({
    cat, count: dados.filter(a => a.categoria === cat && a.ativo !== false).length
  })).filter(r => r.count > 0)

  const colunas = [
    { key: 'brinco', label: 'Brinco', render: r => (
      <button onClick={() => navigate(`/animais/${r.brinco}`)} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: C.ambar, fontWeight: 700, fontSize: 13,
        textDecoration: 'underline', padding: 0,
      }}>#{r.brinco}</button>
    )},
    { key: 'nome',      label: 'Nome' },
    { key: 'categoria', label: 'Categoria', render: r => LABEL_CATEGORIA[r.categoria] || r.categoria },
    { key: 'raca',      label: 'Raça' },
    { key: 'lote',      label: 'Lote' },
    { key: 'data_nascimento', label: 'Nascimento', render: r => fmtData(r.data_nascimento) },
    { key: 'peso_entrada', label: 'Peso entrada', render: r => r.peso_entrada ? `${r.peso_entrada} kg` : '—' },
  ]

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <ToastContainer />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: seg === 'leite' ? C.leiteAccent : seg === 'corte' ? C.corteAccent : seg === 'ovino_leite' ? C.ovinoLeiteAccent : seg === 'ovino_corte' ? C.ovinoCorteAccent : seg === 'caprino_leite' ? C.caprinoLeiteAccent : C.caprinoCorteAccent }}>
            🏷️ Cadastro de Animais
          </h2>
          <p style={{ color: C.textoMuted, fontSize: 13 }}>Controle por número de brinco</p>
        </div>
        <Btn onClick={abrirNovo} cor={seg === 'leite' ? C.leitePrimary : seg === 'corte' ? C.cortePrimary : seg === 'ovino_leite' ? C.ovinoLeitePrimary : seg === 'ovino_corte' ? C.ovinoCortePrimary : seg === 'caprino_leite' ? C.caprinoLeitePrimary : C.caprinoCortePrimary}>
          + Novo Animal
        </Btn>
      </div>

      {/* Resumo por categoria */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {resumo.map(r => (
          <div key={r.cat} style={{
            background: C.bgCard, border: `1px solid ${C.border}`,
            borderRadius: 8, padding: '6px 14px', fontSize: 12,
          }}>
            <span style={{ color: C.textoMuted }}>{LABEL_CATEGORIA[r.cat]}: </span>
            <strong style={{ color: C.texto }}>{r.count}</strong>
          </div>
        ))}
        <div style={{
          background: `${C.verde}22`, border: `1px solid ${C.verde}`,
          borderRadius: 8, padding: '6px 14px', fontSize: 12,
        }}>
          <span style={{ color: C.textoMuted }}>Total: </span>
          <strong style={{ color: C.verdeVivo }}>{dados.filter(a => a.ativo !== false).length}</strong>
        </div>
      </div>

      {/* Busca com scanner */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="🔍 Buscar por brinco, nome ou categoria..."
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 8,
            border: `1.5px solid ${C.border}`, background: C.bgInput,
            color: C.texto, fontSize: 13, boxSizing: 'border-box',
          }}
        />
        <button onClick={() => setScannerBusca(true)} title="Escanear brinco" style={{
          padding: '10px 16px', borderRadius: 8, border: `1.5px solid ${C.verdeVivo}`,
          background: `${C.verdeVivo}22`, color: C.verdeVivo, fontSize: 18, cursor: 'pointer',
        }}>📷</button>
      </div>

      <Secao titulo={`${filtrados.length} animais`} icon="🐄">
        <Tabela colunas={colunas} dados={filtrados} loading={loading}
          onEdit={abrirEditar} onDelete={excluir} />
      </Secao>

      {modal && (
        <Modal titulo={editando ? 'Editar Animal' : 'Cadastrar Animal'} onClose={() => setModal(false)} largura={600}>
          <Grid cols={2}>
            <div>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:C.textoSub, marginBottom:6 }}>Nº Brinco <span style={{color:C.critico}}>*</span></label>
              <div style={{ display:'flex', gap:6 }}>
                <input value={form.brinco} onChange={e => set('brinco', e.target.value)} placeholder="ex: 0042"
                  style={{ flex:1, padding:'10px 12px', borderRadius:8, border:`1.5px solid ${C.border}`, background:C.bgInput, color:C.texto, fontSize:14, boxSizing:'border-box' }} />
                <button type="button" onClick={() => setScannerCadastro(true)} title="Escanear brinco" style={{
                  padding:'0 14px', borderRadius:8, border:`1.5px solid ${C.verdeVivo}`,
                  background:`${C.verdeVivo}22`, color:C.verdeVivo, fontSize:18, cursor:'pointer'
                }}>📷</button>
              </div>
            </div>
            <Campo label="Nome (opcional)" value={form.nome} onChange={v => set('nome', v)} placeholder="ex: Mimosa" />
          </Grid>
          <Grid cols={2}>
            <Campo label="Categoria" type="select" value={form.categoria} onChange={v => set('categoria', v)}
              options={CATS.map(c => ({ value: c, label: LABEL_CATEGORIA[c] || c }))} required />
            <Campo label="Sexo" type="select" value={form.sexo} onChange={v => set('sexo', v)}
              options={[{ value: 'F', label: 'Fêmea' }, { value: 'M', label: 'Macho' }]} />
          </Grid>
          <Grid cols={2}>
            <Campo label="Raça" value={form.raca} onChange={v => set('raca', v)} placeholder="ex: Gir Leiteiro" />
            <Campo label="Lote" value={form.lote} onChange={v => set('lote', v)} placeholder="ex: Lote A" />
          </Grid>
          <Grid cols={2}>
            <Campo label="Data de Nascimento" type="date" value={form.data_nascimento} onChange={v => set('data_nascimento', v)} />
            <Campo label="Peso de Entrada (kg)" type="number" step="0.1" value={form.peso_entrada} onChange={v => set('peso_entrada', v)} />
          </Grid>
          <Grid cols={2}>
            <Campo label="Brinco da Mãe" value={form.mae_brinco} onChange={v => set('mae_brinco', v)} placeholder="ex: 0015" />
            <Campo label="Brinco do Pai / Sêmen" value={form.pai_brinco} onChange={v => set('pai_brinco', v)} />
          </Grid>
          <Campo label="Observações" type="textarea" value={form.obs} onChange={v => set('obs', v)} />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <Btn outline cor={C.textoMuted} onClick={() => setModal(false)}>Cancelar</Btn>
            <Btn cor={seg === 'leite' ? C.leitePrimary : seg === 'corte' ? C.cortePrimary : seg === 'ovino_leite' ? C.ovinoLeitePrimary : seg === 'ovino_corte' ? C.ovinoCortePrimary : seg === 'caprino_leite' ? C.caprinoLeitePrimary : C.caprinoCortePrimary} onClick={salvar}>
              {editando ? 'Salvar alterações' : 'Cadastrar'}
            </Btn>
          </div>
        </Modal>
      )}

      {/* Scanner para busca */}
      {scannerBusca && (
        <ScannerBrinco
          onLer={(valor) => { setBusca(valor); setScannerBusca(false) }}
          onClose={() => setScannerBusca(false)}
        />
      )}

      {/* Scanner para cadastro */}
      {scannerCadastro && (
        <ScannerBrinco
          onLer={(valor) => { set('brinco', valor); setScannerCadastro(false) }}
          onClose={() => setScannerCadastro(false)}
        />
      )}
    </div>
  )
}
