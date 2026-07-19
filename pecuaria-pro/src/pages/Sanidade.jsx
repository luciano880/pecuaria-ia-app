import { useState } from 'react'
import { useTabela } from '../utils/useTabela.js'
import { supabase } from '../utils/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { C, fmtData, hoje, diasAte } from '../utils/helpers.js'
import { Secao, Tabela, Modal, Campo, Grid, Btn, useToast, BadgeAlerta } from '../components/UI.jsx'

export default function Sanidade() {
  const { user, perfil } = useAuth()
  const seg = perfil?.segmento
  const cor = seg === 'leite' ? C.leiteAccent : C.corteAccent

  const { dados: medicamentos, loading: loadMed, inserir: inserirMed, remover: removerMed } = useTabela('medicamentos')
  const { dados: aplicacoes, loading: loadApl, inserir: inserirApl, carregar: recarregarApl, remover: removerApl } = useTabela('aplicacoes')
  const { dados: vacinacoes, loading: loadVac, inserir: inserirVac, remover: removerVac } = useTabela('vacinacoes')
  const { dados: animais } = useTabela('animais', { segmento: seg })
  const { toast, ToastContainer } = useToast()

  const [aba, setAba] = useState('carencias')
  const [modalMed, setModalMed] = useState(false)
  const [modalApl, setModalApl] = useState(false)
  const [modalVac, setModalVac] = useState(false)

  // Forms
  const [fMed, setFMed] = useState({ nome:'', principio_ativo:'', tipo:'antibiotico', via_aplicacao:'IM',
    carencia_leite:0, carencia_carne:0, estoque_atual:0, unidade:'mL', estoque_minimo:0, obs:'' })
  const [fApl, setFApl] = useState({ brinco:'', medicamento_id:'', data_aplicacao: hoje(), dose:'', responsavel:'', obs:'' })
  const [fVac, setFVac] = useState({ brinco:'', lote_vacinado:'', vacina:'', data_aplicacao: hoje(), proxima_dose:'', responsavel:'', obs:'' })

  function setM(k, v) { setFMed(f => ({ ...f, [k]: v })) }
  function setA(k, v) { setFApl(f => ({ ...f, [k]: v })) }
  function setV(k, v) { setFVac(f => ({ ...f, [k]: v })) }

  async function excluirMed(row) {
    if (!confirm(`Excluir medicamento "${row.nome}"?`)) return
    try { await removerMed(row.id); toast('Medicamento removido!') } catch(e) { toast(e.message,'erro') }
  }
  async function excluirApl(row) {
    if (!confirm(`Excluir aplicação de ${row.medicamento_nome} no brinco #${row.brinco}?`)) return
    try { await removerApl(row.id); toast('Aplicação removida!') } catch(e) { toast(e.message,'erro') }
  }
  async function excluirVac(row) {
    if (!confirm(`Excluir vacinação de ${row.vacina}?`)) return
    try { await removerVac(row.id); toast('Vacinação removida!') } catch(e) { toast(e.message,'erro') }
  }

  async function salvarMed() {
    if (!fMed.nome) { toast('Nome do medicamento obrigatório', 'erro'); return }
    try { await inserirMed(fMed); toast('Medicamento cadastrado!'); setModalMed(false) }
    catch (e) { toast(e.message, 'erro') }
  }

  async function salvarApl() {
    if (!fApl.brinco || !fApl.medicamento_id) { toast('Brinco e medicamento obrigatórios', 'erro'); return }
    const med = medicamentos.find(m => m.id === parseInt(fApl.medicamento_id))
    if (!med) { toast('Medicamento não encontrado', 'erro'); return }
    const animal = animais.find(a => a.brinco === fApl.brinco)
    const dataBase = new Date(fApl.data_aplicacao)
    const fimLeite = med.carencia_leite > 0
      ? new Date(dataBase.getTime() + med.carencia_leite * 86400000).toISOString().split('T')[0] : null
    const fimCarne = med.carencia_carne > 0
      ? new Date(dataBase.getTime() + med.carencia_carne * 86400000).toISOString().split('T')[0] : null
    try {
      await inserirApl({
        ...fApl, animal_id: animal?.id || null,
        medicamento_nome: med.nome,
        carencia_leite_dias: med.carencia_leite,
        carencia_carne_dias: med.carencia_carne,
        unidade: med.unidade,
        fim_carencia_leite: fimLeite,
        fim_carencia_carne: fimCarne,
        dose: fApl.dose === '' ? null : (fApl.dose ? parseFloat(fApl.dose) : null),
      })
      // Gerar alertas no Supabase
      if (animal && (fimLeite || fimCarne)) {
        await supabase.rpc('gerar_alerta_carencia', {
          p_user_id: user.id, p_brinco: fApl.brinco,
          p_animal_id: animal.id, p_medicamento: med.nome,
          p_fim_leite: fimLeite, p_fim_carne: fimCarne,
        })
      }
      // Baixar estoque do medicamento
      await supabase.from('medicamentos').update({
        estoque_atual: Math.max(0, (med.estoque_atual || 0) - parseFloat(fApl.dose || 0))
      }).eq('id', med.id)
      toast('Aplicação registrada com alerta de carência!')
      setModalApl(false)
    } catch (e) { toast(e.message, 'erro') }
  }

  async function salvarVac() {
    if (!fVac.vacina) { toast('Nome da vacina obrigatório', 'erro'); return }
    try {
      await inserirVac(fVac)

      // Baixa automática no estoque de vacinas
      const { data: estoqueVac } = await supabase
        .from('estoque_insumos')
        .select('id, quantidade')
        .eq('user_id', user.id)
        .eq('categoria', 'vacina')
        .ilike('nome', `%${fVac.vacina}%`)
        .maybeSingle()

      if (estoqueVac) {
        const qtdBaixa = parseFloat(fVac.dose || 1)
        const novaQtd = Math.max(0, parseFloat(estoqueVac.quantidade || 0) - qtdBaixa)
        await supabase.from('estoque_insumos').update({ quantidade: novaQtd }).eq('id', estoqueVac.id)
        await supabase.from('movimentacoes_estoque').insert({
          user_id: user.id, insumo_id: estoqueVac.id,
          tipo: 'saida', quantidade: qtdBaixa,
          data: fVac.data_aplicacao || hoje(),
          motivo: `Vacinação: ${fVac.vacina} — brinco #${fVac.brinco || 'lote'}`,
        })
        toast(`Vacinação registrada! Baixa de ${qtdBaixa} dose(s) no estoque.`)
      } else {
        toast('Vacinação registrada! ⚠️ Vacina não encontrada no estoque.')
      }
      setModalVac(false)
    } catch(e) { toast(e.message, 'erro') }
  }

  // Animais em carência HOJE
  const emCarenciaLeite = aplicacoes.filter(a => {
    if (!a.fim_carencia_leite) return false
    const d = diasAte(a.fim_carencia_leite)
    return d !== null && d >= 0
  })
  const emCarenciaCarne = aplicacoes.filter(a => {
    if (!a.fim_carencia_carne) return false
    const d = diasAte(a.fim_carencia_carne)
    return d !== null && d >= 0
  })

  const colsApl = [
    { key: 'brinco', label: 'Brinco', render: r => <strong style={{ color: C.ambar }}>#{r.brinco}</strong> },
    { key: 'medicamento_nome', label: 'Medicamento' },
    { key: 'data_aplicacao', label: 'Aplicação', render: r => fmtData(r.data_aplicacao) },
    { key: 'dose', label: 'Dose', render: r => r.dose ? `${r.dose} ${r.unidade || ''}` : '—' },
    {
      key: 'fim_carencia_leite', label: 'Car. Leite',
      render: r => r.fim_carencia_leite ? (
        <span style={{ color: diasAte(r.fim_carencia_leite) <= 0 ? C.ok : C.critico }}>
          {fmtData(r.fim_carencia_leite)}
          {diasAte(r.fim_carencia_leite) > 0 && ` (${diasAte(r.fim_carencia_leite)}d)`}
        </span>
      ) : '—'
    },
    {
      key: 'fim_carencia_carne', label: 'Car. Carne',
      render: r => r.fim_carencia_carne ? (
        <span style={{ color: diasAte(r.fim_carencia_carne) <= 0 ? C.ok : C.critico }}>
          {fmtData(r.fim_carencia_carne)}
          {diasAte(r.fim_carencia_carne) > 0 && ` (${diasAte(r.fim_carencia_carne)}d)`}
        </span>
      ) : '—'
    },
  ]

  const abas = [
    { id: 'carencias', label: '🚨 Carências Ativas' },
    { id: 'aplicacoes', label: '💉 Histórico Aplicações' },
    { id: 'vacinas', label: '🧪 Vacinações' },
    { id: 'medicamentos', label: '💊 Medicamentos' },
  ]

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <ToastContainer />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: cor }}>💊 Sanidade Animal</h2>
          <p style={{ color: C.textoMuted, fontSize: 13 }}>Medicamentos, carências e vacinações</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn cor={C.ambar} onClick={() => setModalApl(true)}>+ Aplicação</Btn>
          <Btn cor={C.verde} outline onClick={() => setModalVac(true)}>+ Vacina</Btn>
        </div>
      </div>

      {/* Cards de alerta */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
        <div style={{ background: C.bgCard, border: `1px solid ${C.critico}`, borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, color: C.critico, fontWeight: 700, textTransform: 'uppercase' }}>⚠️ Em Carência — Leite</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: C.critico, fontFamily: 'monospace', marginTop: 6 }}>{emCarenciaLeite.length}</div>
          <div style={{ fontSize: 11, color: C.textoMuted }}>animais com leite inapropriado</div>
        </div>
        <div style={{ background: C.bgCard, border: `1px solid ${C.ambar}`, borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, color: C.ambar, fontWeight: 700, textTransform: 'uppercase' }}>⚠️ Em Carência — Carne</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: C.ambar, fontFamily: 'monospace', marginTop: 6 }}>{emCarenciaCarne.length}</div>
          <div style={{ fontSize: 11, color: C.textoMuted }}>animais inapropriados para abate</div>
        </div>
        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, color: C.textoMuted, fontWeight: 700, textTransform: 'uppercase' }}>💊 Medicamentos</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: C.texto, fontFamily: 'monospace', marginTop: 6 }}>{medicamentos.length}</div>
          <div style={{ fontSize: 11, color: C.textoMuted }}>cadastrados no sistema</div>
        </div>
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: `1px solid ${C.border}`, paddingBottom: 0 }}>
        {abas.map(a => (
          <button key={a.id} onClick={() => setAba(a.id)} style={{
            padding: '8px 14px', borderRadius: '6px 6px 0 0', border: 'none',
            background: aba === a.id ? C.bgCard : 'transparent',
            borderBottom: aba === a.id ? `2px solid ${cor}` : '2px solid transparent',
            color: aba === a.id ? cor : C.textoMuted,
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>{a.label}</button>
        ))}
      </div>

      {aba === 'carencias' && (
        <Secao titulo="Animais em Carência Ativa" icon="🚨" cor={C.critico}>
          {emCarenciaLeite.length === 0 && emCarenciaCarne.length === 0
            ? <div style={{ color: C.ok, textAlign: 'center', padding: 20 }}>✅ Nenhum animal em carência no momento</div>
            : <Tabela colunas={colsApl} dados={[...new Map([...emCarenciaLeite,...emCarenciaCarne].map(a=>[a.id,a])).values()]} loading={false} />
          }
        </Secao>
      )}

      {aba === 'aplicacoes' && (
        <Secao titulo="Histórico de Aplicações" icon="💉">
          <Tabela colunas={colsApl} dados={aplicacoes} loading={loadApl} onDelete={excluirApl} />
        </Secao>
      )}

      {aba === 'vacinas' && (
        <Secao titulo="Vacinações" icon="🧪" acao={<Btn size="sm" cor={C.verde} onClick={() => setModalVac(true)}>+ Nova</Btn>}>
          <Tabela colunas={[
            { key: 'brinco', label: 'Brinco', render: r => r.brinco ? `#${r.brinco}` : r.lote_vacinado || '—' },
            { key: 'vacina', label: 'Vacina' },
            { key: 'data_aplicacao', label: 'Data', render: r => fmtData(r.data_aplicacao) },
            { key: 'proxima_dose', label: 'Próxima dose', render: r => fmtData(r.proxima_dose) },
            { key: 'responsavel', label: 'Responsável' },
          ]} dados={vacinacoes} loading={loadVac} onDelete={excluirVac} />
        </Secao>
      )}

      {aba === 'medicamentos' && (
        <Secao titulo="Medicamentos Cadastrados" icon="💊"
          acao={<Btn size="sm" cor={C.ambar} onClick={() => setModalMed(true)}>+ Novo</Btn>}>
          <Tabela colunas={[
            { key: 'nome', label: 'Nome' },
            { key: 'tipo', label: 'Tipo' },
            { key: 'via_aplicacao', label: 'Via' },
            { key: 'carencia_leite', label: 'Car. Leite', render: r => `${r.carencia_leite}d` },
            { key: 'carencia_carne', label: 'Car. Carne', render: r => `${r.carencia_carne}d` },
            { key: 'estoque_atual', label: 'Estoque', render: r => `${r.estoque_atual} ${r.unidade}` },
          ]} dados={medicamentos} loading={loadMed} onDelete={excluirMed} />
        </Secao>
      )}

      {/* Modal novo medicamento */}
      {modalMed && (
        <Modal titulo="Cadastrar Medicamento" onClose={() => setModalMed(false)}>
          <Campo label="Nome do medicamento" value={fMed.nome} onChange={v => setM('nome', v)} required />
          <Campo label="Princípio ativo" value={fMed.principio_ativo} onChange={v => setM('principio_ativo', v)} />
          <Grid cols={2}>
            <Campo label="Tipo" type="select" value={fMed.tipo} onChange={v => setM('tipo', v)}
              options={['antibiotico','antiparasitario','vitamina','vacina','hormonio','outro']} />
            <Campo label="Via de aplicação" type="select" value={fMed.via_aplicacao} onChange={v => setM('via_aplicacao', v)}
              options={['IM','SC','IV','oral','topico','intramamario']} />
          </Grid>
          <Grid cols={2}>
            <Campo label="Carência leite (dias)" type="number" value={fMed.carencia_leite} onChange={v => setM('carencia_leite', v)} />
            <Campo label="Carência carne (dias)" type="number" value={fMed.carencia_carne} onChange={v => setM('carencia_carne', v)} />
          </Grid>
          <Grid cols={3}>
            <Campo label="Estoque atual" type="number" step="0.1" value={fMed.estoque_atual} onChange={v => setM('estoque_atual', v)} />
            <Campo label="Unidade" type="select" value={fMed.unidade} onChange={v => setM('unidade', v)}
              options={['mL','g','comprimido','dose','frasco']} />
            <Campo label="Estoque mínimo" type="number" step="0.1" value={fMed.estoque_minimo} onChange={v => setM('estoque_minimo', v)} />
          </Grid>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <Btn outline cor={C.textoMuted} onClick={() => setModalMed(false)}>Cancelar</Btn>
            <Btn cor={C.ambar} onClick={salvarMed}>Cadastrar</Btn>
          </div>
        </Modal>
      )}

      {/* Modal aplicação */}
      {modalApl && (
        <Modal titulo="Registrar Aplicação de Medicamento" onClose={() => setModalApl(false)}>
          <Grid cols={2}>
            <Campo label="Nº Brinco do animal" value={fApl.brinco} onChange={v => setA('brinco', v)} required placeholder="ex: 0042" />
            <Campo label="Data da aplicação" type="date" value={fApl.data_aplicacao} onChange={v => setA('data_aplicacao', v)} required />
          </Grid>
          <Campo label="Medicamento" type="select" value={fApl.medicamento_id} onChange={v => setA('medicamento_id', v)} required
            options={medicamentos.map(m => ({ value: m.id, label: `${m.nome} (Car.leite: ${m.carencia_leite}d / Car.carne: ${m.carencia_carne}d)` }))} />
          <Grid cols={2}>
            <Campo label="Dose aplicada" type="number" step="0.1" value={fApl.dose} onChange={v => setA('dose', v)} placeholder="ex: 10" />
            <Campo label="Responsável" value={fApl.responsavel} onChange={v => setA('responsavel', v)} placeholder="Nome do aplicador" />
          </Grid>
          <Campo label="Observações" type="textarea" value={fApl.obs} onChange={v => setA('obs', v)} />
          <div style={{ background: `${C.critico}18`, border: `1px solid ${C.critico}`, borderRadius: 6, padding: '8px 12px', fontSize: 12, color: C.texto, marginBottom: 12 }}>
            ⚠️ O sistema calculará automaticamente os prazos de carência e gerará alertas.
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Btn outline cor={C.textoMuted} onClick={() => setModalApl(false)}>Cancelar</Btn>
            <Btn cor={C.critico} onClick={salvarApl}>Registrar aplicação</Btn>
          </div>
        </Modal>
      )}

      {/* Modal vacinação */}
      {modalVac && (
        <Modal titulo="Registrar Vacinação" onClose={() => setModalVac(false)}>
          <Grid cols={2}>
            <Campo label="Brinco (individual)" value={fVac.brinco} onChange={v => setV('brinco', v)} placeholder="Deixe vazio para lote" />
            <Campo label="Lote vacinado" value={fVac.lote_vacinado} onChange={v => setV('lote_vacinado', v)} placeholder="ex: Lote A — 45 animais" />
          </Grid>
          <Campo label="Vacina" value={fVac.vacina} onChange={v => setV('vacina', v)} required placeholder="ex: Febre Aftosa, Brucelose..." />
          <Grid cols={2}>
            <Campo label="Data de aplicação" type="date" value={fVac.data_aplicacao} onChange={v => setV('data_aplicacao', v)} />
            <Campo label="Próxima dose" type="date" value={fVac.proxima_dose} onChange={v => setV('proxima_dose', v)} />
          </Grid>
          <Campo label="Responsável" value={fVac.responsavel} onChange={v => setV('responsavel', v)} />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Btn outline cor={C.textoMuted} onClick={() => setModalVac(false)}>Cancelar</Btn>
            <Btn cor={C.verde} onClick={salvarVac}>Registrar</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}
