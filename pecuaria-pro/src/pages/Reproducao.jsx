import { useState } from 'react'
import { useTabela } from '../utils/useTabela.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { C, fmtData, hoje, diasAte, limparPayload } from '../utils/helpers.js'
import { Secao, Tabela, Modal, Campo, Grid, Btn, useToast } from '../components/UI.jsx'

export default function Reproducao() {
  const { perfil } = useAuth()
  const seg = perfil?.segmento
  const cor = seg === 'leite' ? C.leiteAccent : C.corteAccent
  const { dados, loading, inserir, atualizar } = useTabela('reproducao')
  const { dados: animais } = useTabela('animais', { segmento: seg, sexo: 'F' })
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const { toast, ToastContainer } = useToast()

  const vazio = { brinco:'', tipo:'cobertura', data_evento: hoje(), touro_semen:'',
    resultado:'aguardando', previsao_parto:'', data_parto_real:'',
    sexo_cria:'', peso_cria_kg:'', brinco_cria:'', obs:'' }
  const [form, setForm] = useState(vazio)
  function set(k,v) { setForm(f => ({ ...f, [k]: v })) }

  // Calcular previsão de parto (283 dias para bovinos - Embrapa)
  function calcularParto(dataCobertura) {
    if (!dataCobertura) return ''
    const d = new Date(dataCobertura)
    d.setDate(d.getDate() + 283)
    return d.toISOString().split('T')[0]
  }

  function abrirNovo() { setForm(vazio); setEditando(null); setModal(true) }
  function abrirEditar(row) { setForm({ ...vazio, ...row }); setEditando(row.id); setModal(true) }

  async function salvar() {
    if (!form.brinco || !form.tipo) { toast('Brinco e tipo obrigatórios', 'erro'); return }
    const animal = animais.find(a => a.brinco === form.brinco)
    try {
      const payload = limparPayload({
        ...form,
        animal_id: animal?.id || null,
        data_evento: form.data_evento === '' ? hoje() : form.data_evento,
      })
      if (editando) await atualizar(editando, payload)
      else await inserir(payload)
      toast(editando ? 'Evento atualizado!' : 'Evento reprodutivo registrado!')
      setModal(false)
    } catch(e) { toast(e.message, 'erro') }
  }

  // Prenhas com parto próximo (30 dias)
  const partoProximo = dados.filter(r => {
    if (r.tipo !== 'diagnostico' && r.tipo !== 'cobertura' && r.tipo !== 'iatf') return false
    if (r.resultado !== 'positivo') return false
    if (!r.previsao_parto) return false
    const d = diasAte(r.previsao_parto)
    return d !== null && d >= 0 && d <= 30
  })

  const tipoOpts = [
    { value: 'cobertura', label: '🐂 Cobertura natural' },
    { value: 'iatf', label: '🧫 IATF / Inseminação' },
    { value: 'diagnostico', label: '🔬 Diagnóstico de gestação' },
    { value: 'parto', label: '🐄 Parto' },
    { value: 'aborto', label: '⚠️ Aborto' },
  ]

  const colunas = [
    { key: 'brinco', label: 'Brinco', render: r => <strong style={{ color: C.ambar }}>#{r.brinco}</strong> },
    { key: 'tipo', label: 'Evento', render: r => tipoOpts.find(t => t.value === r.tipo)?.label || r.tipo },
    { key: 'data_evento', label: 'Data', render: r => fmtData(r.data_evento) },
    { key: 'touro_semen', label: 'Touro/Sêmen' },
    {
      key: 'resultado', label: 'Resultado',
      render: r => r.resultado ? (
        <span style={{
          color: r.resultado === 'positivo' ? C.verdeVivo : r.resultado === 'negativo' ? C.critico : C.ambar,
          fontWeight: 600, fontSize: 12
        }}>{r.resultado}</span>
      ) : '—'
    },
    { key: 'previsao_parto', label: 'Prev. Parto', render: r => {
      if (!r.previsao_parto) return '—'
      const d = diasAte(r.previsao_parto)
      return <span style={{ color: d !== null && d <= 30 ? C.ambar : C.texto }}>
        {fmtData(r.previsao_parto)} {d !== null && d >= 0 ? `(${d}d)` : ''}
      </span>
    }},
    { key: 'brinco_cria', label: 'Cria', render: r => r.brinco_cria ? `#${r.brinco_cria}` : '—' },
  ]

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <ToastContainer />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: cor }}>🐄 Reprodução</h2>
          <p style={{ color: C.textoMuted, fontSize: 13 }}>Coberturas, IATF, diagnósticos e partos · Previsão: 283 dias (Embrapa)</p>
        </div>
        <Btn onClick={abrirNovo} cor={seg === 'leite' ? C.leitePrimary : C.cortePrimary}>+ Novo Evento</Btn>
      </div>

      {/* Alertas de parto próximo */}
      {partoProximo.length > 0 && (
        <div style={{
          background: `${C.ambar}18`, border: `1px solid ${C.ambar}`,
          borderRadius: 10, padding: '12px 16px', marginBottom: 16,
        }}>
          <div style={{ color: C.ambar, fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
            🔔 {partoProximo.length} animal(is) com parto previsto nos próximos 30 dias
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {partoProximo.map(r => (
              <span key={r.id} style={{
                background: C.bgCard, border: `1px solid ${C.ambar}`,
                borderRadius: 6, padding: '4px 10px', fontSize: 12, color: C.texto,
              }}>
                #{r.brinco} — {diasAte(r.previsao_parto)}d
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Prenhes confirmadas', val: dados.filter(r => r.resultado === 'positivo').length, cor: C.verdeClaro },
          { label: 'Parto próximo (30d)', val: partoProximo.length, cor: C.ambar },
          { label: 'Partos registrados', val: dados.filter(r => r.tipo === 'parto').length, cor: C.leitePrimary },
          { label: 'Total eventos', val: dados.length, cor: C.textoMuted },
        ].map((s, i) => (
          <div key={i} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, color: C.textoMuted, textTransform: 'uppercase', fontWeight: 600 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.cor, fontFamily: 'monospace', marginTop: 4 }}>{s.val}</div>
          </div>
        ))}
      </div>

      <Secao titulo="Eventos Reprodutivos" icon="🐄">
        <Tabela colunas={colunas} dados={dados} loading={loading} onEdit={abrirEditar} />
      </Secao>

      {modal && (
        <Modal titulo={editando ? 'Editar Evento' : 'Registrar Evento Reprodutivo'} onClose={() => setModal(false)} largura={580}>
          <Grid cols={2}>
            <Campo label="Nº Brinco" value={form.brinco} onChange={v => set('brinco', v)} required placeholder="ex: 0042" />
            <Campo label="Tipo de evento" type="select" value={form.tipo} onChange={v => {
              set('tipo', v)
              if ((v === 'cobertura' || v === 'iatf') && form.data_evento)
                set('previsao_parto', calcularParto(form.data_evento))
            }} options={tipoOpts} required />
          </Grid>
          <Grid cols={2}>
            <Campo label="Data do evento" type="date" value={form.data_evento} onChange={v => {
              set('data_evento', v)
              if (form.tipo === 'cobertura' || form.tipo === 'iatf')
                set('previsao_parto', calcularParto(v))
            }} required />
            <Campo label="Touro / Sêmen" value={form.touro_semen} onChange={v => set('touro_semen', v)} placeholder="Nome ou código" />
          </Grid>
          {(form.tipo === 'diagnostico' || form.tipo === 'cobertura' || form.tipo === 'iatf') && (
            <Grid cols={2}>
              <Campo label="Resultado" type="select" value={form.resultado} onChange={v => set('resultado', v)}
                options={[{value:'aguardando',label:'Aguardando'},{value:'positivo',label:'✅ Positivo (prenha)'},{value:'negativo',label:'❌ Negativo (vazia)'}]} />
              <Campo label="Previsão de parto" type="date" value={form.previsao_parto} onChange={v => set('previsao_parto', v)} />
            </Grid>
          )}
          {form.tipo === 'parto' && (
            <>
              <Grid cols={2}>
                <Campo label="Data real do parto" type="date" value={form.data_parto_real} onChange={v => set('data_parto_real', v)} />
                <Campo label="Sexo da cria" type="select" value={form.sexo_cria} onChange={v => set('sexo_cria', v)}
                  options={[{value:'F',label:'Fêmea'},{value:'M',label:'Macho'}]} />
              </Grid>
              <Grid cols={2}>
                <Campo label="Peso da cria (kg)" type="number" step="0.1" value={form.peso_cria_kg} onChange={v => set('peso_cria_kg', v)} />
                <Campo label="Brinco da cria" value={form.brinco_cria} onChange={v => set('brinco_cria', v)} placeholder="ex: 0087" />
              </Grid>
            </>
          )}
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
