import { useState, useMemo } from 'react'
import { useTabela } from '../utils/useTabela.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { C, fmtData, fmtNum, fmtBRL, hoje } from '../utils/helpers.js'
import { Secao, Tabela, Modal, Campo, Grid, Btn, useToast } from '../components/UI.jsx'

export default function ProducaoLeite() {
  const { perfil } = useAuth()
  const { dados, loading, inserir } = useTabela('producao_leite')
  const { dados: entregas, inserir: inserirEntrega } = useTabela('entrega_leite')
  const { dados: animais } = useTabela('animais', { segmento: 'leite', categoria: 'lactacao' })
  const [modal, setModal] = useState(false)
  const [modalEntrega, setModalEntrega] = useState(false)
  const [aba, setAba] = useState('diario')
  const { toast, ToastContainer } = useToast()

  const [form, setForm] = useState({ brinco:'', data: hoje(), litros_manha:0, litros_tarde:0, litros_noite:0, obs:'' })
  const [fEnt, setFEnt] = useState({ data: hoje(), litros:0, preco_litro: 2.39, laticinio:'', obs:'' })

  function set(k,v) { setForm(f => ({ ...f, [k]: v })) }
  function setE(k,v) { setFEnt(f => ({ ...f, [k]: v })) }

  async function salvar() {
    if (!form.brinco) { toast('Informe o brinco', 'erro'); return }
    try {
      const animal = animais.find(a => a.brinco === form.brinco)
      await inserir({ ...form, animal_id: animal?.id || null })
      toast('Produção registrada!')
      setModal(false)
    } catch(e) { toast(e.message, 'erro') }
  }

  async function salvarEntrega() {
    try {
      const vt = parseFloat(fEnt.litros) * parseFloat(fEnt.preco_litro)
      await inserirEntrega({ ...fEnt, valor_total: vt })
      toast('Entrega registrada!')
      setModalEntrega(false)
    } catch(e) { toast(e.message, 'erro') }
  }

  // Agrupamento por dia
  const porDia = useMemo(() => {
    const map = {}
    dados.forEach(r => {
      if (!map[r.data]) map[r.data] = { data: r.data, total: 0, vacas: 0 }
      map[r.data].total += parseFloat(r.total_litros || 0)
      map[r.data].vacas++
    })
    return Object.values(map).sort((a,b) => b.data.localeCompare(a.data)).slice(0, 30)
  }, [dados])

  // Agrupamento por mês
  const porMes = useMemo(() => {
    const map = {}
    dados.forEach(r => {
      const mes = r.data?.slice(0,7)
      if (!mes) return
      if (!map[mes]) map[mes] = { mes, total: 0, dias: new Set() }
      map[mes].total += parseFloat(r.total_litros || 0)
      map[mes].dias.add(r.data)
    })
    return Object.values(map).sort((a,b) => b.mes.localeCompare(a.mes))
      .map(m => ({ ...m, media_dia: m.total / (m.dias.size || 1), dias: m.dias.size }))
  }, [dados])

  // Total hoje
  const totalHoje = dados.filter(r => r.data === hoje()).reduce((s,r) => s + parseFloat(r.total_litros||0), 0)
  const mediaVaca  = animais.length > 0 ? totalHoje / animais.length : 0
  const totalMes   = porMes[0]?.total || 0
  const receitaMes = entregas.filter(e => e.data?.slice(0,7) === hoje().slice(0,7))
    .reduce((s,e) => s + parseFloat(e.valor_total||0), 0)

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <ToastContainer />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: C.leiteAccent }}>🥛 Produção de Leite</h2>
          <p style={{ color: C.textoMuted, fontSize: 13 }}>Lançamento diário, relatório mensal e entregas</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn cor={C.leitePrimary} onClick={() => setModal(true)}>+ Lançar Produção</Btn>
          <Btn cor={C.verde} outline onClick={() => setModalEntrega(true)}>+ Entrega</Btn>
        </div>
      </div>

      {/* Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Total hoje', val: `${fmtNum(totalHoje,1)} L`, cor: C.leiteAccent },
          { label: 'Média/vaca hoje', val: `${fmtNum(mediaVaca,1)} L`, cor: C.verdeClaro },
          { label: 'Total do mês', val: `${fmtNum(totalMes,0)} L`, cor: C.ambar },
          { label: 'Receita do mês', val: fmtBRL(receitaMes), cor: C.verdeVivo },
        ].map((s,i) => (
          <div key={i} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderLeft: `3px solid ${s.cor}`, borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, color: C.textoMuted, textTransform: 'uppercase', fontWeight: 600 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.cor, fontFamily: 'monospace', marginTop: 4 }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: `1px solid ${C.border}` }}>
        {[{id:'diario',label:'📅 Diário'},{id:'mensal',label:'📊 Mensal'},{id:'entregas',label:'🚚 Entregas'}].map(a => (
          <button key={a.id} onClick={() => setAba(a.id)} style={{
            padding: '8px 16px', border: 'none', background: 'transparent',
            borderBottom: aba === a.id ? `2px solid ${C.leiteAccent}` : '2px solid transparent',
            color: aba === a.id ? C.leiteAccent : C.textoMuted,
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>{a.label}</button>
        ))}
      </div>

      {aba === 'diario' && (
        <Secao titulo="Produção por Animal — Últimos 30 dias" icon="🥛">
          <Tabela colunas={[
            { key: 'brinco', label: 'Brinco', render: r => `#${r.brinco}` },
            { key: 'data', label: 'Data', render: r => fmtData(r.data) },
            { key: 'litros_manha', label: 'Manhã', render: r => `${r.litros_manha}L` },
            { key: 'litros_tarde', label: 'Tarde', render: r => `${r.litros_tarde}L` },
            { key: 'litros_noite', label: 'Noite', render: r => `${r.litros_noite}L` },
            { key: 'total_litros', label: 'Total', render: r => <strong style={{ color: C.leiteAccent }}>{r.total_litros}L</strong> },
          ]} dados={dados.slice(0,100)} loading={loading} />
        </Secao>
      )}

      {aba === 'mensal' && (
        <Secao titulo="Produção Mensal" icon="📊">
          <Tabela colunas={[
            { key: 'mes', label: 'Mês', render: r => {
              const [y,m] = r.mes.split('-')
              return new Date(y, m-1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
            }},
            { key: 'total', label: 'Total (L)', render: r => <strong style={{ color: C.leiteAccent }}>{fmtNum(r.total,0)} L</strong> },
            { key: 'media_dia', label: 'Média/dia', render: r => `${fmtNum(r.media_dia,1)} L` },
            { key: 'dias', label: 'Dias registrados' },
          ]} dados={porMes} loading={false} />
        </Secao>
      )}

      {aba === 'entregas' && (
        <Secao titulo="Entregas ao Laticínio" icon="🚚"
          acao={<Btn size="sm" cor={C.verde} onClick={() => setModalEntrega(true)}>+ Nova</Btn>}>
          <Tabela colunas={[
            { key: 'data', label: 'Data', render: r => fmtData(r.data) },
            { key: 'litros', label: 'Litros', render: r => `${fmtNum(r.litros,1)} L` },
            { key: 'preco_litro', label: 'Preço/L', render: r => fmtBRL(r.preco_litro) },
            { key: 'valor_total', label: 'Total', render: r => <strong style={{ color: C.verdeVivo }}>{fmtBRL(r.valor_total)}</strong> },
            { key: 'laticinio', label: 'Laticínio' },
          ]} dados={entregas} loading={false} />
        </Secao>
      )}

      {/* Modal lançamento */}
      {modal && (
        <Modal titulo="Lançar Produção de Leite" onClose={() => setModal(false)}>
          <Grid cols={2}>
            <Campo label="Nº Brinco" value={form.brinco} onChange={v => set('brinco', v)} required placeholder="ex: 0042" />
            <Campo label="Data" type="date" value={form.data} onChange={v => set('data', v)} required />
          </Grid>
          <Grid cols={3}>
            <Campo label="Manhã (L)" type="number" step="0.1" value={form.litros_manha} onChange={v => set('litros_manha', v)} />
            <Campo label="Tarde (L)" type="number" step="0.1" value={form.litros_tarde} onChange={v => set('litros_tarde', v)} />
            <Campo label="Noite (L)" type="number" step="0.1" value={form.litros_noite} onChange={v => set('litros_noite', v)} />
          </Grid>
          <div style={{ background: C.bgInput, borderRadius: 6, padding: '8px 12px', fontSize: 13, color: C.leiteAccent, marginBottom: 12 }}>
            Total: <strong>{(parseFloat(form.litros_manha||0) + parseFloat(form.litros_tarde||0) + parseFloat(form.litros_noite||0)).toFixed(1)} L</strong>
          </div>
          <Campo label="Observações" type="textarea" value={form.obs} onChange={v => set('obs', v)} />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Btn outline cor={C.textoMuted} onClick={() => setModal(false)}>Cancelar</Btn>
            <Btn cor={C.leitePrimary} onClick={salvar}>Registrar</Btn>
          </div>
        </Modal>
      )}

      {/* Modal entrega */}
      {modalEntrega && (
        <Modal titulo="Registrar Entrega de Leite" onClose={() => setModalEntrega(false)}>
          <Grid cols={2}>
            <Campo label="Data" type="date" value={fEnt.data} onChange={v => setE('data', v)} />
            <Campo label="Laticínio" value={fEnt.laticinio} onChange={v => setE('laticinio', v)} placeholder="Nome do laticínio" />
          </Grid>
          <Grid cols={2}>
            <Campo label="Litros entregues" type="number" step="0.1" value={fEnt.litros} onChange={v => setE('litros', v)} />
            <Campo label="Preço por litro (R$)" type="number" step="0.001" value={fEnt.preco_litro} onChange={v => setE('preco_litro', v)} />
          </Grid>
          <div style={{ background: C.bgInput, borderRadius: 6, padding: '8px 12px', fontSize: 13, color: C.verdeVivo, marginBottom: 12 }}>
            Valor total: <strong>{fmtBRL(parseFloat(fEnt.litros||0) * parseFloat(fEnt.preco_litro||0))}</strong>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Btn outline cor={C.textoMuted} onClick={() => setModalEntrega(false)}>Cancelar</Btn>
            <Btn cor={C.verde} onClick={salvarEntrega}>Registrar entrega</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}
