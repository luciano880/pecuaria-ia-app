import { useState } from 'react'
import { useTabela } from '../utils/useTabela.js'
import { supabase } from '../utils/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { C, fmtNum, fmtBRL, hoje, diasCobertura, statusDias } from '../utils/helpers.js'
import { Secao, Tabela, Modal, Campo, Grid, Btn, useToast, Card } from '../components/UI.jsx'

export default function Estoque() {
  const { user, perfil } = useAuth()
  const seg = perfil?.segmento
  const cor = seg === 'leite' ? C.leiteAccent : C.corteAccent

  const { dados: insumos, loading, inserir, atualizar, carregar } = useTabela('estoque_insumos', { segmento: seg })
  const { dados: dietas, inserir: inserirDieta } = useTabela('dietas', { segmento: seg })
  const { toast, ToastContainer } = useToast()

  const [aba, setAba] = useState('estoque')
  const [modal, setModal] = useState(false)
  const [modalMov, setModalMov] = useState(null) // insumo selecionado para movimentação
  const [modalDieta, setModalDieta] = useState(false)
  const [editando, setEditando] = useState(null)

  const cats = [
    { value: 'silagem',     label: '🌽 Silagem' },
    { value: 'pre_secado',  label: '🌿 Pré-secado' },
    { value: 'feno',        label: '🌾 Feno' },
    { value: 'racao',       label: '🧺 Ração' },
    { value: 'concentrado', label: '🟤 Concentrado' },
    { value: 'sal_mineral', label: '🧂 Sal Mineral' },
    { value: 'milho',       label: '🌽 Milho (grão)' },
    { value: 'soja',        label: '🫘 Farelo de Soja' },
    { value: 'volumoso',    label: '🌱 Volumoso' },
    { value: 'aditivo',     label: '⚗️ Aditivo' },
    { value: 'outro',       label: '📦 Outro' },
  ]

  const LABEL_CAT = Object.fromEntries(cats.map(c => [c.value, c.label]))

  const vazio = { nome:'', categoria:'silagem', quantidade:0, unidade:'kg',
    consumo_diario:0, estoque_minimo:0, preco_unitario:0, fornecedor:'' }
  const [form, setForm] = useState(vazio)
  const [fMov, setFMov] = useState({ tipo:'entrada', quantidade:0, data: hoje(), motivo:'' })
  const [fDieta, setFDieta] = useState({
    lote:'', data_inicio: hoje(),
    silagem_kg_cab_dia:0, concentrado_kg_cab_dia:0, sal_mineral_g_cab_dia:0, obs:''
  })

  function set(k,v)  { setForm(f => ({ ...f, [k]: v })) }
  function setD(k,v) { setFDieta(f => ({ ...f, [k]: v })) }

  function abrirNovo()  { setForm(vazio); setEditando(null); setModal(true) }
  function abrirEditar(row) { setForm({ ...vazio, ...row }); setEditando(row.id); setModal(true) }

  async function salvar() {
    if (!form.nome) { toast('Nome obrigatório', 'erro'); return }
    try {
      const numerico = (v) => v === '' || v === null || v === undefined ? null : parseFloat(v) || 0
      const payload = {
        ...form, segmento: seg,
        quantidade: numerico(form.quantidade),
        consumo_diario: numerico(form.consumo_diario),
        estoque_minimo: numerico(form.estoque_minimo),
        preco_unitario: numerico(form.preco_unitario),
      }
      if (editando) await atualizar(editando, payload)
      else await inserir(payload)
      toast(editando ? 'Insumo atualizado!' : 'Insumo cadastrado!')
      setModal(false)
    } catch(e) { toast(e.message, 'erro') }
  }

  async function salvarMov() {
    if (!fMov.quantidade || fMov.quantidade <= 0) { toast('Quantidade inválida', 'erro'); return }
    try {
      await supabase.from('movimentacoes_estoque').insert({
        user_id: user.id, insumo_id: modalMov.id,
        tipo: fMov.tipo, quantidade: parseFloat(fMov.quantidade),
        data: fMov.data, motivo: fMov.motivo,
      })
      const delta = fMov.tipo === 'entrada'
        ? parseFloat(modalMov.quantidade) + parseFloat(fMov.quantidade)
        : Math.max(0, parseFloat(modalMov.quantidade) - parseFloat(fMov.quantidade))
      await atualizar(modalMov.id, { quantidade: delta })
      toast(`${fMov.tipo === 'entrada' ? 'Entrada' : 'Saída'} registrada!`)
      setModalMov(null)
    } catch(e) { toast(e.message, 'erro') }
  }

  async function salvarDieta() {
    if (!fDieta.lote) { toast('Informe o lote', 'erro'); return }
    try {
      await inserirDieta({ ...fDieta, segmento: seg })
      toast('Dieta cadastrada!')
      setModalDieta(false)
    } catch(e) { toast(e.message, 'erro') }
  }

  // Alertas de estoque baixo
  const estoqueBaixo = insumos.filter(i => parseFloat(i.quantidade) <= parseFloat(i.estoque_minimo || 0))
  const coberturaDias = insumos.map(i => ({
    ...i, dias: diasCobertura(i.quantidade, i.consumo_diario)
  }))

  const colunas = [
    { key: 'nome', label: 'Insumo' },
    { key: 'categoria', label: 'Categoria', render: r => LABEL_CAT[r.categoria] || r.categoria },
    { key: 'quantidade', label: 'Estoque', render: r => (
      <span style={{ color: parseFloat(r.quantidade) <= parseFloat(r.estoque_minimo||0) ? C.critico : C.texto, fontWeight: 700, fontFamily: 'monospace' }}>
        {fmtNum(r.quantidade)} {r.unidade}
      </span>
    )},
    { key: 'consumo_diario', label: 'Consumo/dia', render: r => r.consumo_diario > 0 ? `${r.consumo_diario} ${r.unidade}/dia` : '—' },
    { key: 'dias', label: 'Cobertura', render: r => {
      const dias = diasCobertura(r.quantidade, r.consumo_diario)
      if (dias === 999) return <span style={{ color: C.textoMuted }}>—</span>
      const s = statusDias(dias)
      return <span style={{ color: s.cor, fontWeight: 700 }}>{s.icon} {dias}d</span>
    }},
    { key: 'preco_unitario', label: 'Preço/un', render: r => r.preco_unitario > 0 ? fmtBRL(r.preco_unitario) : '—' },
    { key: 'acoes', label: '', render: r => (
      <div style={{ display: 'flex', gap: 4 }}>
        <Btn size="sm" cor={C.verdeClaro} onClick={() => {
          setModalMov(r)
          setFMov({ tipo: 'entrada', quantidade: '', data: hoje(), motivo: '' })
        }}>📥 Entrada</Btn>
        <Btn size="sm" cor={C.critico} onClick={() => {
          setModalMov(r)
          setFMov({ tipo: 'saida', quantidade: '', data: hoje(), motivo: 'Consumo' })
        }}>📤 Baixa</Btn>
        <Btn size="sm" cor={C.verde} outline onClick={() => abrirEditar(r)}>✏️</Btn>
      </div>
    )},
  ]

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <ToastContainer />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: cor }}>🌽 Estoque & Dietas</h2>
          <p style={{ color: C.textoMuted, fontSize: 13 }}>Insumos, silagem, ração e formulação de dietas</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn cor={seg === 'leite' ? C.leitePrimary : C.cortePrimary} onClick={abrirNovo}>+ Insumo</Btn>
          <Btn cor={C.ambar} outline onClick={() => setModalDieta(true)}>+ Dieta</Btn>
        </div>
      </div>

      {/* Alerta estoque baixo */}
      {estoqueBaixo.length > 0 && (
        <div style={{
          background: `${C.critico}18`, border: `1px solid ${C.critico}`,
          borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13,
        }}>
          <strong style={{ color: C.critico }}>⚠️ {estoqueBaixo.length} insumo(s) abaixo do estoque mínimo: </strong>
          <span style={{ color: C.texto }}>{estoqueBaixo.map(i => i.nome).join(', ')}</span>
        </div>
      )}

      {/* Abas */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: `1px solid ${C.border}` }}>
        {[{id:'estoque',label:'📦 Estoque'},{id:'dietas',label:'🥣 Dietas'}].map(a => (
          <button key={a.id} onClick={() => setAba(a.id)} style={{
            padding: '8px 16px', border: 'none', background: 'transparent',
            borderBottom: aba === a.id ? `2px solid ${cor}` : '2px solid transparent',
            color: aba === a.id ? cor : C.textoMuted,
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>{a.label}</button>
        ))}
      </div>

      {aba === 'estoque' && (
        <Secao titulo="Insumos Cadastrados" icon="📦">
          <Tabela colunas={colunas} dados={insumos} loading={loading} />
        </Secao>
      )}

      {aba === 'dietas' && (
        <Secao titulo="Dietas por Lote" icon="🥣"
          acao={<Btn size="sm" cor={C.ambar} onClick={() => setModalDieta(true)}>+ Nova dieta</Btn>}>
          <Tabela colunas={[
            { key: 'lote', label: 'Lote' },
            { key: 'data_inicio', label: 'Início', render: r => r.data_inicio },
            { key: 'silagem_kg_cab_dia', label: 'Silagem/cab/dia', render: r => `${r.silagem_kg_cab_dia} kg` },
            { key: 'concentrado_kg_cab_dia', label: 'Concentrado/cab/dia', render: r => `${r.concentrado_kg_cab_dia} kg` },
            { key: 'sal_mineral_g_cab_dia', label: 'Sal mineral/cab/dia', render: r => `${r.sal_mineral_g_cab_dia} g` },
          ]} dados={dietas} loading={false} />
          <div style={{ marginTop: 16, padding: '12px 14px', background: C.bgInput, borderRadius: 8, fontSize: 12, color: C.textoSub, lineHeight: 1.8 }}>
            <strong style={{ color: C.ambar }}>📚 Referências Embrapa/CBNA:</strong><br />
            {seg === 'leite'
              ? '• Silagem milho: 25-35 kg/vaca/dia · Pré-secado (gramíneas): 15-25 kg/dia · Feno: 2-4 kg/cab/dia\n• Concentrado: 1kg/3L leite acima da manutenção · Sal mineral: 80-100g/cab/dia · MS total: 2,5-3,5% PV'
              : '• Silagem: 1t/boi/100 dias · Pré-secado: até 40% da MS da dieta · Feno: máx 2 kg/cab/dia em terminação\n• Confinamento: 2,2% PV em MS · Relação volumoso:concentrado 50:50 a 40:60 · GMD esperado: 1,2-1,5 kg/dia'
            }
          </div>
        </Secao>
      )}

      {/* Modal insumo */}
      {modal && (
        <Modal titulo={editando ? 'Editar Insumo' : 'Cadastrar Insumo'} onClose={() => setModal(false)}>
          <Grid cols={2}>
            <Campo label="Nome do insumo" value={form.nome} onChange={v => set('nome', v)} required />
            <Campo label="Categoria" type="select" value={form.categoria} onChange={v => set('categoria', v)} options={cats} />
          </Grid>
          <Grid cols={3}>
            <Campo label="Quantidade em estoque" type="number" step="0.1" value={form.quantidade} onChange={v => set('quantidade', v)} />
            <Campo label="Unidade" type="select" value={form.unidade} onChange={v => set('unidade', v)}
              options={['kg','ton','L','saco','fardo']} />
            <Campo label="Consumo diário" type="number" step="0.1" value={form.consumo_diario} onChange={v => set('consumo_diario', v)} />
          </Grid>
          <Grid cols={2}>
            <Campo label="Estoque mínimo" type="number" step="0.1" value={form.estoque_minimo} onChange={v => set('estoque_minimo', v)} />
            <Campo label="Preço por unidade (R$)" type="number" step="0.01" value={form.preco_unitario} onChange={v => set('preco_unitario', v)} />
          </Grid>
          <Campo label="Fornecedor" value={form.fornecedor} onChange={v => set('fornecedor', v)} />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <Btn outline cor={C.textoMuted} onClick={() => setModal(false)}>Cancelar</Btn>
            <Btn cor={seg === 'leite' ? C.leitePrimary : C.cortePrimary} onClick={salvar}>Salvar</Btn>
          </div>
        </Modal>
      )}

      {/* Modal movimentação */}
      {modalMov && (
        <Modal titulo={fMov.tipo === 'entrada' ? `📥 Entrada — ${modalMov.nome}` : `📤 Baixa de Estoque — ${modalMov.nome}`} onClose={() => setModalMov(null)}>
          {/* Status atual */}
          <div style={{
            background: C.bgInput, borderRadius: 8, padding: '10px 14px',
            marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: 11, color: C.textoMuted, textTransform: 'uppercase', fontWeight: 600 }}>Estoque atual</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.texto, fontFamily: 'monospace', marginTop: 2 }}>
                {fmtNum(modalMov.quantidade)} {modalMov.unidade}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: C.textoMuted, textTransform: 'uppercase', fontWeight: 600 }}>Após movimentação</div>
              <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'monospace', marginTop: 2,
                color: fMov.tipo === 'entrada' ? C.verdeClaro : C.critico }}>
                {fMov.tipo === 'entrada'
                  ? fmtNum(parseFloat(modalMov.quantidade || 0) + parseFloat(fMov.quantidade || 0))
                  : fmtNum(Math.max(0, parseFloat(modalMov.quantidade || 0) - parseFloat(fMov.quantidade || 0)))
                } {modalMov.unidade}
              </div>
            </div>
          </div>

          {/* Tipo de movimentação */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
            {[
              { v: 'entrada', icon: '📥', label: 'Entrada', cor: C.verdeClaro },
              { v: 'saida',   icon: '📤', label: 'Baixa / Consumo', cor: C.critico },
            ].map(t => (
              <button key={t.v} onClick={() => setFMov(f => ({ ...f, tipo: t.v }))} style={{
                padding: '10px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
                border: `2px solid ${fMov.tipo === t.v ? t.cor : C.border}`,
                background: fMov.tipo === t.v ? `${t.cor}22` : C.bgInput,
                color: fMov.tipo === t.v ? t.cor : C.textoMuted,
                fontWeight: 700, fontSize: 13,
              }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          <Grid cols={2}>
            <Campo label={`Quantidade (${modalMov.unidade})`} type="number" step="0.1"
              value={fMov.quantidade}
              onChange={v => setFMov(f => ({ ...f, quantidade: v }))} />
            <Campo label="Data" type="date" value={fMov.data}
              onChange={v => setFMov(f => ({ ...f, data: v }))} />
          </Grid>
          <Campo label="Motivo" value={fMov.motivo}
            onChange={v => setFMov(f => ({ ...f, motivo: v }))}
            placeholder={fMov.tipo === 'entrada' ? 'ex: Compra, NF 1234...' : 'ex: Consumo semanal, Fornecimento lote A...'} />

          {/* Alerta se baixa deixa estoque negativo */}
          {fMov.tipo === 'saida' && parseFloat(fMov.quantidade || 0) > parseFloat(modalMov.quantidade || 0) && (
            <div style={{ background: `${C.critico}22`, border: `1px solid ${C.critico}`, borderRadius: 6, padding: '8px 12px', fontSize: 12, color: C.critico, marginBottom: 12 }}>
              ⚠️ Quantidade maior que o estoque disponível! O saldo ficará zerado.
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <Btn outline cor={C.textoMuted} onClick={() => setModalMov(null)}>Cancelar</Btn>
            <Btn cor={fMov.tipo === 'entrada' ? C.verdeClaro : C.critico} onClick={salvarMov}>
              {fMov.tipo === 'entrada' ? '📥 Registrar entrada' : '📤 Dar baixa'}
            </Btn>
          </div>
        </Modal>
      )}

      {/* Modal dieta */}
      {modalDieta && (
        <Modal titulo="Cadastrar Dieta por Lote" onClose={() => setModalDieta(false)}>
          <Grid cols={2}>
            <Campo label="Nome do lote" value={fDieta.lote} onChange={v => setD('lote', v)} required placeholder="ex: Lote A — Lactação" />
            <Campo label="Data de início" type="date" value={fDieta.data_inicio} onChange={v => setD('data_inicio', v)} />
          </Grid>
          <Grid cols={3}>
            <Campo label="Silagem (kg/cab/dia)" type="number" step="0.1" value={fDieta.silagem_kg_cab_dia} onChange={v => setD('silagem_kg_cab_dia', v)} />
            <Campo label="Concentrado (kg/cab/dia)" type="number" step="0.1" value={fDieta.concentrado_kg_cab_dia} onChange={v => setD('concentrado_kg_cab_dia', v)} />
            <Campo label="Sal mineral (g/cab/dia)" type="number" step="1" value={fDieta.sal_mineral_g_cab_dia} onChange={v => setD('sal_mineral_g_cab_dia', v)} />
          </Grid>
          <Campo label="Observações / outros ingredientes" type="textarea" value={fDieta.obs} onChange={v => setD('obs', v)} />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <Btn outline cor={C.textoMuted} onClick={() => setModalDieta(false)}>Cancelar</Btn>
            <Btn cor={C.ambar} onClick={salvarDieta}>Cadastrar dieta</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}
