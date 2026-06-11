import { useState, useMemo } from 'react'
import { useTabela } from '../utils/useTabela.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { C, fmtData, fmtNum, hoje } from '../utils/helpers.js'
import { Secao, Tabela, Modal, Campo, Grid, Btn, useToast } from '../components/UI.jsx'

export default function Pesagens() {
  const { perfil } = useAuth()
  const seg = perfil?.segmento
  const cor = seg === 'leite' ? C.leiteAccent : C.corteAccent
  const { dados, loading, inserir } = useTabela('pesagens')
  const { dados: animais } = useTabela('animais', { segmento: seg })
  const [modal, setModal] = useState(false)
  const { toast, ToastContainer } = useToast()
  const [form, setForm] = useState({ brinco:'', data: hoje(), peso_kg:'', obs:'' })
  function set(k,v) { setForm(f => ({ ...f, [k]: v })) }

  async function salvar() {
    if (!form.brinco || !form.peso_kg) { toast('Brinco e peso obrigatórios', 'erro'); return }
    const animal = animais.find(a => a.brinco === form.brinco)
    try {
      await inserir({ ...form, animal_id: animal?.id || null })
      toast('Pesagem registrada!')
      setModal(false)
      setForm({ brinco:'', data: hoje(), peso_kg:'', obs:'' })
    } catch(e) { toast(e.message, 'erro') }
  }

  // GMD por animal (últimas 2 pesagens)
  const gmdPorAnimal = useMemo(() => {
    const map = {}
    dados.forEach(p => {
      if (!map[p.brinco]) map[p.brinco] = []
      map[p.brinco].push(p)
    })
    return Object.entries(map).map(([brinco, pesagens]) => {
      const sorted = pesagens.sort((a,b) => b.data.localeCompare(a.data))
      const ultima = sorted[0]
      const anterior = sorted[1]
      let gmd = null
      if (anterior) {
        const dias = Math.max(1, (new Date(ultima.data) - new Date(anterior.data)) / 86400000)
        gmd = (parseFloat(ultima.peso_kg) - parseFloat(anterior.peso_kg)) / dias
      }
      return { brinco, ultima_pesagem: ultima.data, peso_atual: ultima.peso_kg, gmd, total_pesagens: pesagens.length }
    }).sort((a,b) => b.ultima_pesagem?.localeCompare(a.ultima_pesagem))
  }, [dados])

  const mediaGMD = gmdPorAnimal.filter(a => a.gmd !== null).reduce((s,a,_,arr) => s + a.gmd/arr.length, 0)

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <ToastContainer />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: cor }}>⚖️ Pesagens & GMD</h2>
          <p style={{ color: C.textoMuted, fontSize: 13 }}>
            Controle de peso por brinco · GMD = Ganho Médio Diário (referência Embrapa: 1,2-1,5 kg/dia)
          </p>
        </div>
        <Btn cor={seg === 'leite' ? C.leitePrimary : C.cortePrimary} onClick={() => setModal(true)}>+ Nova Pesagem</Btn>
      </div>

      {/* Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderLeft: `3px solid ${cor}`, borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 10, color: C.textoMuted, textTransform: 'uppercase', fontWeight: 600 }}>Total pesagens</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: cor, fontFamily: 'monospace', marginTop: 4 }}>{dados.length}</div>
        </div>
        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.ambar}`, borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 10, color: C.textoMuted, textTransform: 'uppercase', fontWeight: 600 }}>GMD médio do lote</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.ambar, fontFamily: 'monospace', marginTop: 4 }}>
            {mediaGMD > 0 ? `${fmtNum(mediaGMD,2)} kg/d` : '—'}
          </div>
        </div>
        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.verdeClaro}`, borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 10, color: C.textoMuted, textTransform: 'uppercase', fontWeight: 600 }}>Animais pesados</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.verdeClaro, fontFamily: 'monospace', marginTop: 4 }}>{gmdPorAnimal.length}</div>
        </div>
      </div>

      <Secao titulo="GMD por Animal" icon="📊">
        <Tabela colunas={[
          { key: 'brinco', label: 'Brinco', render: r => <strong style={{ color: C.ambar }}>#{r.brinco}</strong> },
          { key: 'peso_atual', label: 'Peso atual', render: r => `${r.peso_atual} kg` },
          { key: 'ultima_pesagem', label: 'Última pesagem', render: r => fmtData(r.ultima_pesagem) },
          { key: 'gmd', label: 'GMD', render: r => {
            if (r.gmd === null) return <span style={{ color: C.textoMuted }}>—</span>
            const cor = r.gmd >= 1.2 ? C.verdeClaro : r.gmd >= 0.8 ? C.ambar : C.critico
            return <span style={{ color: cor, fontWeight: 700 }}>{fmtNum(r.gmd,2)} kg/dia</span>
          }},
          { key: 'total_pesagens', label: 'Nº pesagens' },
        ]} dados={gmdPorAnimal} loading={loading} />
      </Secao>

      <Secao titulo="Histórico de Pesagens" icon="📋">
        <Tabela colunas={[
          { key: 'brinco', label: 'Brinco', render: r => `#${r.brinco}` },
          { key: 'data', label: 'Data', render: r => fmtData(r.data) },
          { key: 'peso_kg', label: 'Peso (kg)', render: r => <strong>{r.peso_kg} kg</strong> },
          { key: 'obs', label: 'Obs' },
        ]} dados={dados.slice(0,100)} loading={loading} />
      </Secao>

      {modal && (
        <Modal titulo="Registrar Pesagem" onClose={() => setModal(false)}>
          <Grid cols={2}>
            <Campo label="Nº Brinco" value={form.brinco} onChange={v => set('brinco', v)} required placeholder="ex: 0042" />
            <Campo label="Data da pesagem" type="date" value={form.data} onChange={v => set('data', v)} required />
          </Grid>
          <Campo label="Peso (kg)" type="number" step="0.1" value={form.peso_kg} onChange={v => set('peso_kg', v)} required placeholder="ex: 385.5" />
          <Campo label="Observações" type="textarea" value={form.obs} onChange={v => set('obs', v)} />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <Btn outline cor={C.textoMuted} onClick={() => setModal(false)}>Cancelar</Btn>
            <Btn cor={seg === 'leite' ? C.leitePrimary : C.cortePrimary} onClick={salvar}>Registrar</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}
