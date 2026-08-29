import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../utils/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { C, fmtBRL, fmtNum, fmtData, LABEL_CATEGORIA } from '../utils/helpers.js'
import { Secao, Btn, useToast } from '../components/UI.jsx'

export default function FinanceiroAnimal() {
  const { user, perfil } = useAuth()
  const seg = perfil?.segmento
  const { toast, ToastContainer } = useToast()
  const [animais, setAnimais] = useState([])
  const [receitas, setReceitas] = useState([])
  const [despesas, setDespesas] = useState([])
  const [producao, setProducao] = useState([])
  const [entregas, setEntregas] = useState([])
  const [loading, setLoading] = useState(true)
  const [ordenar, setOrdenar] = useState('lucro') // lucro | receita | custo | brinco

  useEffect(() => { if (user && seg) carregar() }, [user, seg])

  async function carregar() {
    setLoading(true)
    const [aRes, rRes, dRes, pRes, eRes] = await Promise.all([
      supabase.from('animais').select('*').eq('user_id', user.id).eq('segmento', seg),
      supabase.from('receitas').select('*').eq('user_id', user.id).eq('segmento', seg),
      supabase.from('despesas').select('*').eq('user_id', user.id).eq('segmento', seg),
      supabase.from('producao_leite').select('*').eq('user_id', user.id).eq('segmento', seg),
      supabase.from('entrega_leite').select('*').eq('user_id', user.id).eq('segmento', seg),
    ])
    setAnimais(aRes.data || [])
    setReceitas(rRes.data || [])
    setDespesas(dRes.data || [])
    setProducao(pRes.data || [])
    setEntregas(eRes.data || [])
    setLoading(false)
  }

  const isLeite = seg === 'leite' || seg === 'ovino_leite' || seg === 'caprino_leite'

  // Cálculo financeiro por animal
  const analise = useMemo(() => {
    const ativos = animais.filter(a => a.ativo !== false)
    const nAtivos = ativos.length || 1

    // Despesas totais do rebanho (para ratear)
    const despesaTotal = despesas.reduce((s, d) => s + parseFloat(d.valor || 0), 0)
    const despesaPorAnimal = despesaTotal / nAtivos

    // Receitas diretas por animal (venda com animal vinculado ou por brinco na descrição)
    const receitaDiretaPorBrinco = {}
    receitas.forEach(r => {
      // Tenta associar por brinco mencionado na descrição
      const match = ativos.find(a => r.descricao?.includes(a.brinco))
      if (match) {
        receitaDiretaPorBrinco[match.brinco] = (receitaDiretaPorBrinco[match.brinco] || 0) + parseFloat(r.valor || 0)
      }
    })

    // Produção de leite por animal (receita estimada)
    const litrosPorBrinco = {}
    producao.forEach(p => {
      const litros = parseFloat(p.total_litros || 0) ||
        (parseFloat(p.litros_manha || 0) + parseFloat(p.litros_tarde || 0) + parseFloat(p.litros_noite || 0))
      litrosPorBrinco[p.brinco] = (litrosPorBrinco[p.brinco] || 0) + litros
    })

    // Preço médio do leite: das entregas (mais preciso) ou receitas de venda
    let precoLitro = 0
    if (entregas.length > 0) {
      const totL = entregas.reduce((s, e) => s + parseFloat(e.litros || 0), 0)
      const totV = entregas.reduce((s, e) => s + parseFloat(e.valor_total || 0), 0)
      precoLitro = totL > 0 ? totV / totL : 0
    }
    if (precoLitro === 0) {
      const recLeite = receitas.filter(r => r.categoria === 'venda_leite')
      const totalLitrosVendidos = recLeite.reduce((s, r) => s + parseFloat(r.quantidade || 0), 0)
      const totalReceitaLeite = recLeite.reduce((s, r) => s + parseFloat(r.valor || 0), 0)
      precoLitro = totalLitrosVendidos > 0 ? totalReceitaLeite / totalLitrosVendidos : 0
    }

    const linhas = ativos.map(a => {
      const receitaDireta = receitaDiretaPorBrinco[a.brinco] || 0
      const litros = litrosPorBrinco[a.brinco] || 0
      const receitaLeite = litros * precoLitro
      const receitaTotal = receitaDireta + receitaLeite
      const custo = despesaPorAnimal
      const lucro = receitaTotal - custo
      return {
        brinco: a.brinco,
        nome: a.nome,
        categoria: a.categoria,
        litros,
        receitaLeite,
        receitaDireta,
        receitaTotal,
        custo,
        lucro,
      }
    })

    // Ordenar
    linhas.sort((x, y) => {
      if (ordenar === 'lucro') return y.lucro - x.lucro
      if (ordenar === 'receita') return y.receitaTotal - x.receitaTotal
      if (ordenar === 'custo') return y.custo - x.custo
      return String(x.brinco).localeCompare(String(y.brinco))
    })

    return { linhas, despesaTotal, despesaPorAnimal, nAtivos, precoLitro }
  }, [animais, receitas, despesas, producao, entregas, ordenar])

  const totalReceita = analise.linhas.reduce((s, l) => s + l.receitaTotal, 0)
  const totalLucro = analise.linhas.reduce((s, l) => s + l.lucro, 0)
  const lucrativos = analise.linhas.filter(l => l.lucro > 0).length
  const prejuizo = analise.linhas.filter(l => l.lucro < 0).length

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <ToastContainer />

      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: C.ambar, fontFamily: "'Syne',sans-serif" }}>💰 Financeiro por Animal</h2>
        <p style={{ color: C.textoMuted, fontSize: 13 }}>Custo e lucro individual · Rateio automático das despesas do rebanho</p>
      </div>

      {/* Como funciona */}
      <div style={{ background: `${C.ambar}11`, border: `1px solid ${C.ambar}44`, borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 12, color: C.textoSub, lineHeight: 1.7 }}>
        💡 <strong style={{ color: C.ambar }}>Como é calculado:</strong> As despesas totais do rebanho são divididas igualmente entre os animais ativos (rateio). A receita vem da produção de leite de cada animal + vendas vinculadas ao brinco. Para vincular uma venda a um animal, inclua o número do brinco na descrição da receita.
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.textoMuted }}>⏳ Calculando...</div>
      ) : analise.linhas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.textoMuted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🐄</div>
          Cadastre animais e lance despesas para ver a análise financeira individual.
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 20 }}>
            {[
              { l: 'Custo/animal (rateio)', v: fmtBRL(analise.despesaPorAnimal), c: C.critico },
              { l: 'Receita total', v: fmtBRL(totalReceita), c: C.verdeClaro },
              { l: 'Resultado total', v: fmtBRL(totalLucro), c: totalLucro >= 0 ? C.verdeVivo : C.critico },
              { l: '✅ Lucrativos', v: lucrativos, c: C.verdeClaro },
              { l: '⚠️ No prejuízo', v: prejuizo, c: C.critico },
            ].map((s, i) => (
              <div key={i} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderLeft: `3px solid ${s.c}`, borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 10, color: C.textoMuted, textTransform: 'uppercase', fontWeight: 600 }}>{s.l}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: s.c, fontFamily: 'monospace', marginTop: 4 }}>{s.v}</div>
              </div>
            ))}
          </div>

          {/* Ordenação */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: C.textoMuted, alignSelf: 'center' }}>Ordenar por:</span>
            {[
              { id: 'lucro', l: '💰 Lucro' },
              { id: 'receita', l: '📈 Receita' },
              { id: 'custo', l: '📉 Custo' },
              { id: 'brinco', l: '🏷️ Brinco' },
            ].map(o => (
              <button key={o.id} onClick={() => setOrdenar(o.id)} style={{
                padding: '5px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 600,
                border: `1px solid ${ordenar === o.id ? C.ambar : C.border}`,
                background: ordenar === o.id ? `${C.ambar}22` : 'transparent',
                color: ordenar === o.id ? C.ambar : C.textoMuted,
              }}>{o.l}</button>
            ))}
          </div>

          {/* Tabela por animal */}
          <Secao titulo={`${analise.linhas.length} animais analisados`} icon="🐄" cor={C.ambar}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                    <th style={{ textAlign: 'left', padding: '8px 10px', color: C.textoMuted, fontWeight: 600 }}>Brinco</th>
                    <th style={{ textAlign: 'left', padding: '8px 10px', color: C.textoMuted, fontWeight: 600 }}>Categoria</th>
                    {isLeite && <th style={{ textAlign: 'right', padding: '8px 10px', color: C.textoMuted, fontWeight: 600 }}>Litros</th>}
                    <th style={{ textAlign: 'right', padding: '8px 10px', color: C.textoMuted, fontWeight: 600 }}>Receita</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', color: C.textoMuted, fontWeight: 600 }}>Custo</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', color: C.textoMuted, fontWeight: 600 }}>Lucro</th>
                  </tr>
                </thead>
                <tbody>
                  {analise.linhas.map((l, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${C.border}`, background: l.lucro < 0 ? `${C.critico}0A` : 'transparent' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 700, color: C.texto }}>#{l.brinco}</td>
                      <td style={{ padding: '8px 10px', color: C.textoSub, fontSize: 12 }}>{LABEL_CATEGORIA[l.categoria] || l.categoria}</td>
                      {isLeite && <td style={{ padding: '8px 10px', textAlign: 'right', color: C.textoSub, fontFamily: 'monospace' }}>{fmtNum(l.litros, 0)} L</td>}
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: C.verdeClaro, fontFamily: 'monospace' }}>{fmtBRL(l.receitaTotal)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: C.critico, fontFamily: 'monospace' }}>{fmtBRL(l.custo)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: l.lucro >= 0 ? C.verdeVivo : C.critico }}>{fmtBRL(l.lucro)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Secao>

          {/* Nota sobre rateio */}
          <div style={{ marginTop: 14, fontSize: 12, color: C.textoMuted, lineHeight: 1.7, background: C.bgCard, borderRadius: 8, padding: '12px 16px' }}>
            📊 <strong style={{ color: C.textoSub }}>Rateio atual:</strong> {fmtBRL(analise.despesaTotal)} de despesas ÷ {analise.nAtivos} animais ativos = {fmtBRL(analise.despesaPorAnimal)} por animal.
            {isLeite && analise.precoLitro > 0 && <><br />🥛 <strong style={{ color: C.textoSub }}>Preço médio do leite:</strong> {fmtBRL(analise.precoLitro)}/litro (calculado das vendas registradas).</>}
          </div>
        </>
      )}
    </div>
  )
}
