import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { C, getCor, fmtData, fmtBRL, fmtNum, hoje, LABEL_CATEGORIA, diasAte } from '../utils/helpers.js'
import { Secao, Modal, Campo, Grid, Btn, useToast } from '../components/UI.jsx'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

export default function FichaAnimal() {
  const { brinco } = useParams()
  const { user, perfil } = useAuth()
  const navigate = useNavigate()
  const seg = perfil?.segmento
  const { accent } = getCor(seg || 'leite')
  const { toast, ToastContainer } = useToast()

  const [animal,      setAnimal]      = useState(null)
  const [pesagens,    setPesagens]    = useState([])
  const [reproducao,  setReproducao]  = useState([])
  const [aplicacoes,  setAplicacoes]  = useState([])
  const [vacinacoes,  setVacinacoes]  = useState([])
  const [producao,    setProducao]    = useState([])
  const [carregando,  setCarregando]  = useState(true)
  const [aba,         setAba]         = useState('resumo')
  const [modalPeso,   setModalPeso]   = useState(false)
  const [modalEdit,   setModalEdit]   = useState(false)
  const [modalParto,  setModalParto]  = useState(false)
  const [novoPeso,    setNovoPeso]    = useState({ data: hoje(), peso_kg: '', obs: '' })
  const [formParto,   setFormParto]   = useState({
    data_parto_real: hoje(), sexo_cria: 'F',
    peso_cria_kg: '', brinco_cria: '', obs: ''
  })

  useEffect(() => {
    if (!user || !brinco) return
    carregarTudo()
  }, [user, brinco])

  async function carregarTudo() {
    setCarregando(true)
    const [animRes] = await Promise.all([
      supabase.from('animais').select('*').eq('user_id', user.id).eq('brinco', brinco).single(),
    ])
    if (animRes.error || !animRes.data) { navigate('/animais'); return }
    setAnimal(animRes.data)

    const id = animRes.data.id
    const [pesRes, repRes, aplRes, vacRes, prodRes] = await Promise.all([
      supabase.from('pesagens').select('*').eq('user_id', user.id).eq('animal_id', id).order('data'),
      supabase.from('reproducao').select('*').eq('user_id', user.id).eq('animal_id', id).order('data_evento', { ascending: false }),
      supabase.from('aplicacoes').select('*').eq('user_id', user.id).eq('animal_id', id).order('data_aplicacao', { ascending: false }),
      supabase.from('vacinacoes').select('*').eq('user_id', user.id).eq('animal_id', id).order('data_aplicacao', { ascending: false }),
      supabase.from('producao_leite').select('*').eq('user_id', user.id).eq('animal_id', id).order('data'),
    ])
    setPesagens(pesRes.data || [])
    setReproducao(repRes.data || [])
    setAplicacoes(aplRes.data || [])
    setVacinacoes(vacRes.data || [])
    setProducao(prodRes.data || [])
    setCarregando(false)
  }

  async function salvarParto() {
    try {
      await supabase.from('reproducao').insert({
        user_id: user.id,
        animal_id: animal.id,
        brinco: animal.brinco,
        tipo: 'parto',
        data_evento: formParto.data_parto_real,
        data_parto_real: formParto.data_parto_real,
        sexo_cria: formParto.sexo_cria,
        peso_cria_kg: formParto.peso_cria_kg === '' ? null : parseFloat(formParto.peso_cria_kg) || null,
        brinco_cria: formParto.brinco_cria || null,
        resultado: 'positivo',
        obs: formParto.obs || null,
      })
      toast('Parto registrado!')
      setModalParto(false)
      setFormParto({ data_parto_real: hoje(), sexo_cria: 'F', peso_cria_kg: '', brinco_cria: '', obs: '' })
      carregarTudo()
    } catch(e) { toast(e.message, 'erro') }
  }

  async function salvarPeso() {
    if (!novoPeso.peso_kg) { toast('Informe o peso', 'erro'); return }
    const { error } = await supabase.from('pesagens').insert({
      user_id: user.id, animal_id: animal.id,
      brinco: animal.brinco, ...novoPeso,
    })
    if (error) { toast(error.message, 'erro'); return }
    toast('Pesagem registrada!')
    setModalPeso(false)
    setNovoPeso({ data: hoje(), peso_kg: '', obs: '' })
    carregarTudo()
  }

  async function salvarAnimal(dados) {
    const { error } = await supabase.from('animais').update(dados).eq('id', animal.id)
    if (error) { toast(error.message, 'erro'); return }
    setAnimal(prev => ({ ...prev, ...dados }))
    toast('Animal atualizado!')
    setModalEdit(false)
  }

  // Calcular GMD
  function calcGMD() {
    if (pesagens.length < 2) return null
    const sorted = [...pesagens].sort((a, b) => a.data.localeCompare(b.data))
    const primeira = sorted[0]
    const ultima   = sorted[sorted.length - 1]
    const dias = Math.max(1, (new Date(ultima.data) - new Date(primeira.data)) / 86400000)
    return (parseFloat(ultima.peso_kg) - parseFloat(primeira.peso_kg)) / dias
  }

  // Calcular idade
  function calcIdade() {
    if (!animal?.data_nascimento) return null
    const diff = Date.now() - new Date(animal.data_nascimento).getTime()
    const meses = Math.floor(diff / (1000 * 60 * 60 * 24 * 30.44))
    if (meses < 24) return `${meses} meses`
    return `${Math.floor(meses / 12)} anos e ${meses % 12} meses`
  }

  // Carências ativas
  const carenciasAtivas = aplicacoes.filter(a => {
    const dL = a.fim_carencia_leite ? diasAte(a.fim_carencia_leite) : null
    const dC = a.fim_carencia_carne ? diasAte(a.fim_carencia_carne) : null
    return (dL !== null && dL >= 0) || (dC !== null && dC >= 0)
  })

  // Dados do gráfico de peso
  const grafPeso = pesagens.map(p => ({ data: p.data.slice(5), peso: parseFloat(p.peso_kg) }))

  // Dados do gráfico de produção
  const grafProd = producao.slice(-30).map(p => ({ data: p.data.slice(5), litros: parseFloat(p.total_litros || 0) }))

  const gmd = calcGMD()
  const pesoAtual = pesagens.length > 0 ? parseFloat(pesagens[pesagens.length - 1]?.peso_kg) : animal?.peso_entrada
  const idade = calcIdade()

  if (carregando) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', flexDirection: 'column', gap: 12 }}>
      <div className="pulse" style={{ fontSize: 32 }}>🐄</div>
      <div style={{ color: C.textoMuted, fontSize: 13 }}>Carregando ficha...</div>
    </div>
  )

  if (!animal) return null

  const abas = [
    { id: 'resumo',    label: '📋 Resumo' },
    { id: 'peso',      label: '⚖️ Pesagens' },
    { id: 'reproducao',label: '🐄 Reprodução' },
    { id: 'sanidade',  label: '💊 Sanidade' },
    ...(seg === 'leite' ? [{ id: 'producao', label: '🥛 Produção' }] : []),
  ]

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <ToastContainer />

      {/* ── Header da ficha ── */}
      <div style={{
        background: `linear-gradient(135deg, ${accent}33, ${C.bgCard})`,
        border: `1px solid ${C.border}`, borderRadius: 16,
        padding: '20px 24px', marginBottom: 20,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <button onClick={() => navigate('/animais')} style={{
              background: 'none', border: 'none', color: C.textoMuted,
              fontSize: 12, cursor: 'pointer', marginBottom: 8, padding: 0,
            }}>← Voltar para Animais</button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: `linear-gradient(135deg, ${accent}44, ${accent}22)`,
                border: `2px solid ${accent}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, flexShrink: 0,
              }}>
                {animal.sexo === 'M' ? '🐂' : '🐄'}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h1 style={{
                    fontFamily: "'Syne', sans-serif",
                    fontSize: 24, fontWeight: 800, color: C.texto,
                  }}>
                    #{animal.brinco}
                  </h1>
                  {animal.nome && (
                    <span style={{ fontSize: 16, color: C.textoSub }}>— {animal.nome}</span>
                  )}
                </div>
                <div style={{ color: C.textoSub, fontSize: 13, marginTop: 3 }}>
                  {LABEL_CATEGORIA[animal.categoria] || animal.categoria}
                  {animal.raca ? ` · ${animal.raca}` : ''}
                  {animal.lote ? ` · Lote: ${animal.lote}` : ''}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <Btn size="sm" cor={C.verdeClaro} onClick={() => setModalParto(true)}>🐣 Parto</Btn>
            <Btn size="sm" cor={accent} onClick={() => setModalPeso(true)}>⚖️ Pesagem</Btn>
            <Btn size="sm" cor={C.ambar} outline onClick={() => setModalEdit(true)}>✏️ Editar</Btn>
          </div>
        </div>
      </div>

      {/* ── Cards rápidos ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { icon: '⚖️', label: 'Peso atual', valor: pesoAtual ? `${pesoAtual} kg` : '—', cor: accent },
          { icon: '📈', label: 'GMD', valor: gmd !== null ? `${fmtNum(gmd, 2)} kg/d` : '—', cor: gmd !== null && gmd >= 1.2 ? C.verdeClaro : C.ambar },
          { icon: '🎂', label: 'Idade', valor: idade || '—', cor: C.textoSub },
          { icon: '⚠️', label: 'Em carência', valor: carenciasAtivas.length > 0 ? `${carenciasAtivas.length} med.` : 'Nenhuma', cor: carenciasAtivas.length > 0 ? C.critico : C.verdeClaro },
        ].map((c, i) => (
          <div key={i} style={{
            background: C.bgCard, border: `1px solid ${C.border}`,
            borderTop: `3px solid ${c.cor}`, borderRadius: 10, padding: '12px 14px',
          }}>
            <div style={{ fontSize: 10, color: C.textoMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {c.icon} {c.label}
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: c.cor, fontFamily: 'monospace', marginTop: 5 }}>
              {c.valor}
            </div>
          </div>
        ))}
      </div>

      {/* ── Alerta carência ── */}
      {carenciasAtivas.length > 0 && (
        <div style={{
          background: `${C.critico}18`, border: `1px solid ${C.critico}`,
          borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13,
        }}>
          <strong style={{ color: C.critico }}>⚠️ Animal em carência:</strong>
          {carenciasAtivas.map(a => (
            <div key={a.id} style={{ color: C.texto, fontSize: 12, marginTop: 4 }}>
              • {a.medicamento_nome}
              {a.fim_carencia_leite && diasAte(a.fim_carencia_leite) >= 0 &&
                ` — Leite impróprio até ${fmtData(a.fim_carencia_leite)} (${diasAte(a.fim_carencia_leite)}d)`}
              {a.fim_carencia_carne && diasAte(a.fim_carencia_carne) >= 0 &&
                ` — Abate vedado até ${fmtData(a.fim_carencia_carne)} (${diasAte(a.fim_carencia_carne)}d)`}
            </div>
          ))}
        </div>
      )}

      {/* ── Abas ── */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 16, borderBottom: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
        {abas.map(a => (
          <button key={a.id} onClick={() => setAba(a.id)} style={{
            padding: '8px 14px', border: 'none', background: 'transparent',
            borderBottom: aba === a.id ? `2px solid ${accent}` : '2px solid transparent',
            color: aba === a.id ? accent : C.textoMuted,
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>{a.label}</button>
        ))}
      </div>

      {/* ── RESUMO ── */}
      {aba === 'resumo' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Dados cadastrais */}
          <Secao titulo="Dados Cadastrais" icon="📋" cor={accent}>
            {[
              { l: 'Brinco',         v: `#${animal.brinco}` },
              { l: 'Nome',           v: animal.nome || '—' },
              { l: 'Categoria',      v: LABEL_CATEGORIA[animal.categoria] || animal.categoria },
              { l: 'Raça',           v: animal.raca || '—' },
              { l: 'Sexo',           v: animal.sexo === 'M' ? 'Macho' : 'Fêmea' },
              { l: 'Nascimento',     v: fmtData(animal.data_nascimento) },
              { l: 'Lote',           v: animal.lote || '—' },
              { l: 'Brinco da mãe',  v: animal.mae_brinco ? `#${animal.mae_brinco}` : '—' },
              { l: 'Pai/Sêmen',      v: animal.pai_brinco || '—' },
              { l: 'Peso de entrada',v: animal.peso_entrada ? `${animal.peso_entrada} kg` : '—' },
            ].map((item, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '6px 0', borderBottom: `1px solid ${C.border}`,
                fontSize: 13,
              }}>
                <span style={{ color: C.textoMuted }}>{item.l}</span>
                <span style={{ color: C.texto, fontWeight: 500 }}>{item.v}</span>
              </div>
            ))}
            {animal.obs && (
              <div style={{ marginTop: 10, fontSize: 12, color: C.textoSub, fontStyle: 'italic' }}>
                📝 {animal.obs}
              </div>
            )}
          </Secao>

          {/* Histórico resumido */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Secao titulo="Último peso registrado" icon="⚖️" cor={C.ambar}>
              {pesagens.length === 0 ? (
                <div style={{ color: C.textoMuted, fontSize: 13 }}>Nenhuma pesagem registrada</div>
              ) : (
                <>
                  <div style={{ fontSize: 28, fontWeight: 800, color: C.ambar, fontFamily: 'monospace' }}>
                    {pesagens[pesagens.length - 1]?.peso_kg} kg
                  </div>
                  <div style={{ fontSize: 12, color: C.textoMuted, marginTop: 4 }}>
                    {fmtData(pesagens[pesagens.length - 1]?.data)} · {pesagens.length} pesagens no total
                  </div>
                  {gmd !== null && (
                    <div style={{ marginTop: 8, fontSize: 13, color: gmd >= 1.2 ? C.verdeClaro : C.ambar }}>
                      GMD médio: <strong>{fmtNum(gmd, 2)} kg/dia</strong>
                      <span style={{ color: C.textoMuted, fontSize: 11, marginLeft: 6 }}>
                        (ref. Embrapa: 1,2-1,5 kg/dia)
                      </span>
                    </div>
                  )}
                </>
              )}
            </Secao>

            <Secao titulo="Reprodução" icon="🐄" cor={C.verdeClaro}>
              {reproducao.length === 0 ? (
                <div style={{ color: C.textoMuted, fontSize: 13 }}>Nenhum evento reprodutivo</div>
              ) : (
                reproducao.slice(0, 3).map(r => (
                  <div key={r.id} style={{ fontSize: 12, padding: '5px 0', borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ color: C.textoSub }}>{fmtData(r.data_evento)}</span>
                    <span style={{ color: C.texto, marginLeft: 8 }}>{r.tipo}</span>
                    {r.resultado && <span style={{ color: r.resultado === 'positivo' ? C.verdeVivo : C.critico, marginLeft: 8 }}>· {r.resultado}</span>}
                    {r.previsao_parto && <span style={{ color: C.ambar, marginLeft: 8 }}>→ parto: {fmtData(r.previsao_parto)}</span>}
                  </div>
                ))
              )}
            </Secao>

            {seg === 'leite' && (
              <Secao titulo="Produção recente" icon="🥛" cor={C.leiteAccent}>
                {producao.length === 0 ? (
                  <div style={{ color: C.textoMuted, fontSize: 13 }}>Sem produção registrada</div>
                ) : (
                  <>
                    <div style={{ fontSize: 22, fontWeight: 800, color: C.leiteAccent, fontFamily: 'monospace' }}>
                      {fmtNum(producao[producao.length - 1]?.total_litros, 1)} L
                    </div>
                    <div style={{ fontSize: 12, color: C.textoMuted, marginTop: 4 }}>
                      Último lançamento: {fmtData(producao[producao.length - 1]?.data)}
                    </div>
                    <div style={{ fontSize: 12, color: C.textoMuted }}>
                      Média 30 dias: {fmtNum(producao.slice(-30).reduce((s, p) => s + parseFloat(p.total_litros || 0), 0) / Math.min(producao.length, 30), 1)} L/dia
                    </div>
                  </>
                )}
              </Secao>
            )}
          </div>
        </div>
      )}

      {/* ── PESAGENS ── */}
      {aba === 'peso' && (
        <Secao titulo="Histórico de Pesagens" icon="⚖️" cor={C.ambar}
          acao={<Btn size="sm" cor={C.ambar} onClick={() => setModalPeso(true)}>+ Nova</Btn>}>
          {grafPeso.length > 1 && (
            <div style={{ marginBottom: 20 }}>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={grafPeso} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="data" tick={{ fontSize: 10, fill: C.textoMuted }} />
                  <YAxis tick={{ fontSize: 10, fill: C.textoMuted }} domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="peso" name="Peso (kg)" stroke={C.ambar} strokeWidth={2} dot={{ fill: C.ambar, r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                {['Data', 'Peso (kg)', 'GMD desde anterior', 'Obs'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: C.textoMuted, fontSize: 11, textTransform: 'uppercase', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...pesagens].reverse().map((p, i, arr) => {
                const anterior = arr[i + 1]
                let gmdItem = null
                if (anterior) {
                  const dias = Math.max(1, (new Date(p.data) - new Date(anterior.data)) / 86400000)
                  gmdItem = (parseFloat(p.peso_kg) - parseFloat(anterior.peso_kg)) / dias
                }
                return (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '8px 12px', color: C.texto }}>{fmtData(p.data)}</td>
                    <td style={{ padding: '8px 12px', color: C.ambar, fontWeight: 700, fontFamily: 'monospace' }}>{p.peso_kg} kg</td>
                    <td style={{ padding: '8px 12px', color: gmdItem !== null ? (gmdItem >= 1.2 ? C.verdeClaro : C.ambar) : C.textoMuted }}>
                      {gmdItem !== null ? `${fmtNum(gmdItem, 2)} kg/d` : '—'}
                    </td>
                    <td style={{ padding: '8px 12px', color: C.textoMuted, fontSize: 12 }}>{p.obs || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {pesagens.length === 0 && <div style={{ color: C.textoMuted, padding: 20, textAlign: 'center' }}>Nenhuma pesagem registrada</div>}
        </Secao>
      )}

      {/* ── REPRODUÇÃO ── */}
      {aba === 'reproducao' && (
        <Secao titulo="Histórico Reprodutivo" icon="🐄" cor={C.verdeClaro}>
          {reproducao.length === 0 ? (
            <div style={{ color: C.textoMuted, padding: 20, textAlign: 'center' }}>Nenhum evento reprodutivo registrado</div>
          ) : reproducao.map(r => (
            <div key={r.id} style={{
              padding: '12px 0', borderBottom: `1px solid ${C.border}`,
              display: 'flex', gap: 16, alignItems: 'flex-start',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                background: `${C.verde}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
              }}>
                {r.tipo === 'parto' ? '🐣' : r.tipo === 'cobertura' || r.tipo === 'iatf' ? '💉' : r.tipo === 'diagnostico' ? '🔬' : '⚠️'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, color: C.texto, fontSize: 13, textTransform: 'capitalize' }}>{r.tipo.replace('_', ' ')}</span>
                  <span style={{ fontSize: 12, color: C.textoMuted }}>{fmtData(r.data_evento)}</span>
                </div>
                {r.touro_semen && <div style={{ fontSize: 12, color: C.textoSub, marginTop: 3 }}>Touro/Sêmen: {r.touro_semen}</div>}
                {r.resultado && (
                  <div style={{ fontSize: 12, marginTop: 3, color: r.resultado === 'positivo' ? C.verdeVivo : r.resultado === 'negativo' ? C.critico : C.ambar, fontWeight: 600 }}>
                    Resultado: {r.resultado}
                  </div>
                )}
                {r.previsao_parto && (
                  <div style={{ fontSize: 12, color: C.ambar, marginTop: 3 }}>
                    Previsão de parto: {fmtData(r.previsao_parto)}
                    {diasAte(r.previsao_parto) !== null && diasAte(r.previsao_parto) >= 0 && ` (${diasAte(r.previsao_parto)} dias)`}
                  </div>
                )}
                {r.tipo === 'parto' && r.brinco_cria && (
                  <div style={{ fontSize: 12, color: C.verdeClaro, marginTop: 3 }}>
                    Cria: #{r.brinco_cria} · {r.sexo_cria === 'M' ? 'Macho' : 'Fêmea'} · {r.peso_cria_kg ? `${r.peso_cria_kg} kg` : ''}
                  </div>
                )}
                {r.obs && <div style={{ fontSize: 11, color: C.textoMuted, marginTop: 3, fontStyle: 'italic' }}>{r.obs}</div>}
              </div>
            </div>
          ))}
        </Secao>
      )}

      {/* ── SANIDADE ── */}
      {aba === 'sanidade' && (
        <>
          <Secao titulo="Aplicações de Medicamentos" icon="💉" cor={C.critico}>
            {aplicacoes.length === 0 ? (
              <div style={{ color: C.textoMuted, padding: 20, textAlign: 'center' }}>Nenhuma aplicação registrada</div>
            ) : aplicacoes.map(a => (
              <div key={a.id} style={{ padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: C.texto, fontSize: 13 }}>{a.medicamento_nome}</div>
                    <div style={{ fontSize: 12, color: C.textoSub, marginTop: 2 }}>
                      {fmtData(a.data_aplicacao)} · Dose: {a.dose} {a.unidade}
                      {a.responsavel ? ` · ${a.responsavel}` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 11 }}>
                    {a.fim_carencia_leite && (
                      <div style={{ color: diasAte(a.fim_carencia_leite) >= 0 ? C.critico : C.verdeClaro }}>
                        🥛 Leite: {diasAte(a.fim_carencia_leite) >= 0 ? `${diasAte(a.fim_carencia_leite)}d restantes` : `Liberado em ${fmtData(a.fim_carencia_leite)}`}
                      </div>
                    )}
                    {a.fim_carencia_carne && (
                      <div style={{ color: diasAte(a.fim_carencia_carne) >= 0 ? C.critico : C.verdeClaro }}>
                        🥩 Abate: {diasAte(a.fim_carencia_carne) >= 0 ? `${diasAte(a.fim_carencia_carne)}d restantes` : `Liberado em ${fmtData(a.fim_carencia_carne)}`}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </Secao>

          <Secao titulo="Vacinações" icon="🧪" cor={C.verdeClaro}>
            {vacinacoes.length === 0 ? (
              <div style={{ color: C.textoMuted, padding: 20, textAlign: 'center' }}>Nenhuma vacinação registrada</div>
            ) : vacinacoes.map(v => (
              <div key={v.id} style={{ padding: '8px 0', borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600, color: C.texto }}>{v.vacina}</span>
                  <span style={{ color: C.textoMuted }}>{fmtData(v.data_aplicacao)}</span>
                </div>
                {v.proxima_dose && (
                  <div style={{ fontSize: 11, color: C.ambar, marginTop: 2 }}>
                    Próxima dose: {fmtData(v.proxima_dose)}
                    {diasAte(v.proxima_dose) !== null && diasAte(v.proxima_dose) >= 0 && ` (${diasAte(v.proxima_dose)} dias)`}
                  </div>
                )}
              </div>
            ))}
          </Secao>
        </>
      )}

      {/* ── PRODUÇÃO (leite) ── */}
      {aba === 'producao' && seg === 'leite' && (
        <Secao titulo="Histórico de Produção" icon="🥛" cor={C.leiteAccent}>
          {grafProd.length > 1 && (
            <div style={{ marginBottom: 20 }}>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={grafProd} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="data" tick={{ fontSize: 10, fill: C.textoMuted }} />
                  <YAxis tick={{ fontSize: 10, fill: C.textoMuted }} />
                  <Tooltip contentStyle={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="litros" name="Litros" stroke={C.leiteAccent} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                {['Data', 'Manhã', 'Tarde', 'Noite', 'Total'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: C.textoMuted, fontSize: 11, textTransform: 'uppercase', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...producao].reverse().slice(0, 60).map((p, i) => (
                <tr key={p.id} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? 'transparent' : `${C.verde}08` }}>
                  <td style={{ padding: '8px 12px', color: C.texto }}>{fmtData(p.data)}</td>
                  <td style={{ padding: '8px 12px', color: C.textoSub }}>{p.litros_manha}L</td>
                  <td style={{ padding: '8px 12px', color: C.textoSub }}>{p.litros_tarde}L</td>
                  <td style={{ padding: '8px 12px', color: C.textoSub }}>{p.litros_noite}L</td>
                  <td style={{ padding: '8px 12px', color: C.leiteAccent, fontWeight: 700, fontFamily: 'monospace' }}>{p.total_litros}L</td>
                </tr>
              ))}
            </tbody>
          </table>
          {producao.length === 0 && <div style={{ color: C.textoMuted, padding: 20, textAlign: 'center' }}>Sem produção registrada</div>}
        </Secao>
      )}

      {/* Modal nova pesagem */}
      {modalPeso && (
        <Modal titulo={`Nova pesagem — #${animal.brinco}`} onClose={() => setModalPeso(false)}>
          <Grid cols={2}>
            <Campo label="Data" type="date" value={novoPeso.data} onChange={v => setNovoPeso(p => ({ ...p, data: v }))} required />
            <Campo label="Peso (kg)" type="number" step="0.1" value={novoPeso.peso_kg} onChange={v => setNovoPeso(p => ({ ...p, peso_kg: v }))} required placeholder="ex: 385.5" />
          </Grid>
          <Campo label="Observações" type="textarea" value={novoPeso.obs} onChange={v => setNovoPeso(p => ({ ...p, obs: v }))} />
          {pesoAtual && novoPeso.peso_kg && (
            <div style={{ background: C.bgInput, borderRadius: 6, padding: '8px 12px', fontSize: 12, color: C.ambar, marginBottom: 12 }}>
              Variação: <strong>{(parseFloat(novoPeso.peso_kg) - pesoAtual).toFixed(1)} kg</strong> desde a última pesagem
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Btn outline cor={C.textoMuted} onClick={() => setModalPeso(false)}>Cancelar</Btn>
            <Btn cor={C.ambar} onClick={salvarPeso}>Registrar</Btn>
          </div>
        </Modal>
      )}

      {/* Modal parto */}
      {modalParto && (
        <Modal titulo={`Registrar Parto — #${animal.brinco}`} onClose={() => setModalParto(false)}>
          <div style={{ background: `${C.verdeClaro}18`, border: `1px solid ${C.verdeClaro}`, borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 12, color: C.textoSub }}>
            🐄 Previsão Embrapa: 283 dias de gestação para bovinos
          </div>
          <Grid cols={2}>
            <Campo label="Data do parto" type="date" value={formParto.data_parto_real} onChange={v => setFormParto(f => ({ ...f, data_parto_real: v }))} required />
            <Campo label="Sexo da cria" type="select" value={formParto.sexo_cria} onChange={v => setFormParto(f => ({ ...f, sexo_cria: v }))}
              options={[{ value: 'F', label: 'Fêmea' }, { value: 'M', label: 'Macho' }]} />
          </Grid>
          <Grid cols={2}>
            <Campo label="Peso da cria (kg)" type="number" step="0.1" value={formParto.peso_cria_kg} onChange={v => setFormParto(f => ({ ...f, peso_cria_kg: v }))} placeholder="ex: 38.5" />
            <Campo label="Brinco da cria" value={formParto.brinco_cria} onChange={v => setFormParto(f => ({ ...f, brinco_cria: v }))} placeholder="ex: 0087" />
          </Grid>
          <Campo label="Observações" type="textarea" value={formParto.obs} onChange={v => setFormParto(f => ({ ...f, obs: v }))} />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <Btn outline cor={C.textoMuted} onClick={() => setModalParto(false)}>Cancelar</Btn>
            <Btn cor={C.verdeClaro} onClick={salvarParto}>🐣 Registrar parto</Btn>
          </div>
        </Modal>
      )}

      {/* Modal editar animal */}
      {modalEdit && (
        <EditarAnimal animal={animal} onSave={salvarAnimal} onClose={() => setModalEdit(false)} seg={seg} />
      )}
    </div>
  )
}

function EditarAnimal({ animal, onSave, onClose, seg }) {
  const cats = seg === 'leite'
    ? ['lactacao','seca','novilha','bezerra','touro']
    : ['bezerro','bezerro_desmamado','garrote','novilho','boi_gordo','vaca','touro']

  const [form, setForm] = useState({
    ...animal,
    nome: animal.nome || '',
    raca: animal.raca || '',
    lote: animal.lote || '',
    mae_brinco: animal.mae_brinco || '',
    pai_brinco: animal.pai_brinco || '',
    obs: animal.obs || '',
    data_nascimento: animal.data_nascimento || '',
    peso_entrada: animal.peso_entrada || '',
  })
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function handleSave() {
    onSave({
      ...form,
      peso_entrada: form.peso_entrada === '' ? null : parseFloat(form.peso_entrada) || null,
      data_nascimento: form.data_nascimento === '' ? null : form.data_nascimento,
    })
  }

  return (
    <Modal titulo={`Editar — #${animal.brinco}`} onClose={onClose} largura={580}>
      <Grid cols={2}>
        <Campo label="Nome" value={form.nome} onChange={v => set('nome', v)} />
        <Campo label="Categoria" type="select" value={form.categoria} onChange={v => set('categoria', v)}
          options={cats.map(c => ({ value: c, label: LABEL_CATEGORIA[c] || c }))} />
      </Grid>
      <Grid cols={2}>
        <Campo label="Raça" value={form.raca} onChange={v => set('raca', v)} />
        <Campo label="Lote" value={form.lote} onChange={v => set('lote', v)} />
      </Grid>
      <Grid cols={2}>
        <Campo label="Data de nascimento" type="date" value={form.data_nascimento} onChange={v => set('data_nascimento', v)} />
        <Campo label="Peso de entrada (kg)" type="number" step="0.1" value={form.peso_entrada} onChange={v => set('peso_entrada', v)} />
      </Grid>
      <Grid cols={2}>
        <Campo label="Brinco da mãe" value={form.mae_brinco} onChange={v => set('mae_brinco', v)} />
        <Campo label="Pai/Sêmen" value={form.pai_brinco} onChange={v => set('pai_brinco', v)} />
      </Grid>
      <Campo label="Observações" type="textarea" value={form.obs} onChange={v => set('obs', v)} />
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
        <Btn outline cor={C.textoMuted} onClick={onClose}>Cancelar</Btn>
        <Btn cor={C.verdeClaro} onClick={handleSave}>Salvar</Btn>
      </div>
    </Modal>
  )
}
