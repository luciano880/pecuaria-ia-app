// ── Design tokens ─────────────────────────────────────────────
export const C = {
  bg:          '#0A1508',
  bgCard:      '#141F0F',
  bgInput:     '#1C2E14',
  border:      '#243D18',
  verde:       '#3D6B25',
  verdeClaro:  '#5A9A35',
  verdeVivo:   '#7EC240',
  ambar:       '#D46A1A',
  ambarClaro:  '#F08A30',
  critico:     '#C03520',
  texto:       '#EEE8D0',
  textoSub:    '#A0B090',
  textoMuted:  '#607050',
  leitePrimary:'#2A8A78',
  leiteAccent: '#3DBDAD',
  cortePrimary:'#8A3A18',
  corteAccent: '#D46030',
  ovinoLeitePrimary:'#6A4A9A',
  ovinoLeiteAccent: '#9B7FD4',
  ovinoCortePrimary:'#7A5A1A',
  ovinoCorteAccent: '#C49A40',
  caprinoLeitePrimary:'#1A6A5A',
  caprinoLeiteAccent: '#2DB89A',
  caprinoCortePrimary:'#5A3A1A',
  caprinoCorteAccent: '#A06030',
}

export function getCor(segmento) {
  if (segmento === 'leite')        return { primary: C.leitePrimary,       accent: C.leiteAccent }
  if (segmento === 'corte')        return { primary: C.cortePrimary,       accent: C.corteAccent }
  if (segmento === 'ovino_leite')  return { primary: C.ovinoLeitePrimary,  accent: C.ovinoLeiteAccent }
  if (segmento === 'ovino_corte')  return { primary: C.ovinoCortePrimary,  accent: C.ovinoCorteAccent }
  if (segmento === 'caprino_leite') return { primary: C.caprinoLeitePrimary, accent: C.caprinoLeiteAccent }
  if (segmento === 'caprino_corte') return { primary: C.caprinoCortePrimary, accent: C.caprinoCorteAccent }
  return { primary: C.verde, accent: C.verdeClaro }
}

export function getEspecie(segmento) {
  if (segmento?.startsWith('ovino'))   return 'ovino'
  if (segmento?.startsWith('caprino')) return 'caprino'
  return 'bovino'
}

export function getLabelSegmento(segmento) {
  if (segmento === 'leite')       return '🥛 Bovinos Leiteiros'
  if (segmento === 'corte')       return '🥩 Bovinos de Corte'
  if (segmento === 'ovino_leite') return '🐑 Ovinos Leiteiros'
  if (segmento === 'ovino_corte')   return '🐑 Ovinos de Corte'
  if (segmento === 'caprino_leite') return '🐐 Caprinos Leiteiros'
  if (segmento === 'caprino_corte') return '🐐 Caprinos de Corte'
  return '🐄 Pecuária'
}

// Limpa payload — converte strings vazias para null, numbers para parseFloat
export function limparPayload(obj) {
  const result = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === '' || v === undefined) {
      result[k] = null
    } else if (typeof v === 'string' && !isNaN(v) && v.trim() !== '' && !v.includes('-')) {
      result[k] = parseFloat(v)
    } else {
      result[k] = v
    }
  }
  return result
}

export function statusDias(dias) {
  if (dias <= 0)  return { cor: C.critico,   label: 'VENCIDO', icon: '🚨' }
  if (dias < 15)  return { cor: C.critico,   label: 'CRÍTICO', icon: '⚠️' }
  if (dias < 30)  return { cor: C.ambar,     label: 'ATENÇÃO', icon: '🔔' }
  return               { cor: C.verdeClaro, label: 'OK',      icon: '✅' }
}

export function diasCobertura(estoque, consumo) {
  if (!consumo || consumo <= 0) return 999
  return Math.floor(estoque / consumo)
}

export const fmtBRL = (n = 0) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)

export const fmtNum = (n = 0, dec = 0) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: dec }).format(n)

export const fmtData = (d) => {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}

export const fmtMes = (mes) => {
  if (!mes) return '—'
  const [y, m] = mes.split('-')
  return new Date(y, m - 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
}

export const hoje = () => new Date().toISOString().split('T')[0]

export const diasAte = (dataStr) => {
  if (!dataStr) return null
  const diff = new Date(dataStr + 'T12:00:00') - new Date()
  return Math.ceil(diff / 86400000)
}

export async function chamarIA(prompt, maxTokens = 800) {
  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(()=>({}))
    throw new Error(err?.error?.message || `Erro ${res.status}`)
  }
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  return data.content?.map(b => b.text || '').join('') || ''
}

export const CATEGORIAS_LEITE = ['lactacao','seca','novilha','bezerra','touro']
export const CATEGORIAS_CORTE = ['bezerro','bezerro_desmamado','garrote','novilho','boi_gordo','vaca','touro']
export const CATEGORIAS_OVINO_LEITE = ['ovelha_lactacao','ovelha_seca','borrega','cordeiro','carneiro']
export const CATEGORIAS_OVINO_CORTE = ['cordeiro','borrego','ovelha','carneiro','capao']

export const LABEL_CATEGORIA = {
  // Bovinos leite
  lactacao:'Vaca em Lactação', seca:'Vaca Seca', novilha:'Novilha', bezerra:'Bezerra', touro:'Touro',
  // Bovinos corte
  bezerro:'Bezerro', bezerro_desmamado:'Bezerro Desmamado', garrote:'Garrote',
  novilho:'Novilho', boi_gordo:'Boi Gordo', vaca:'Vaca',
  // Ovinos leite
  ovelha_lactacao:'Ovelha em Lactação', ovelha_seca:'Ovelha Seca', borrega:'Borrega',
  // Caprinos
  cabra_lactacao:'Cabra em Lactação', cabra_seca:'Cabra Seca', cabrita:'Cabrita',
  cabrito:'Cabrito', bode:'Bode', capao_caprino:'Capão Caprino',
  // Ovinos corte/geral
  cordeiro:'Cordeiro', borrego:'Borrego', ovelha:'Ovelha', carneiro:'Carneiro', capao:'Capão',
}

export function getCategoriasSegmento(seg) {
  if (seg === 'leite')       return CATEGORIAS_LEITE
  if (seg === 'corte')       return CATEGORIAS_CORTE
  if (seg === 'ovino_leite') return CATEGORIAS_OVINO_LEITE
  if (seg === 'ovino_corte')   return CATEGORIAS_OVINO_CORTE
  if (seg === 'caprino_leite') return ['cabra_lactacao','cabra_seca','cabrita','cabrito','bode']
  if (seg === 'caprino_corte') return ['cabrito','cabrita','cabra','bode','capao_caprino']
  return CATEGORIAS_LEITE
}

// Gerar PDF relatório mensal
export async function gerarPDFRelatorio(perfil, dados) {
  try {
    const jsPDFModule = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const { jsPDF } = jsPDFModule
    const doc = new jsPDF()
    const mes = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

    // Wrapper para autoTable compatível com ambas as versões
    const addTable = (opts) => {
      if (typeof doc.autoTable === 'function') {
        doc.autoTable(opts)
      } else {
        autoTable(doc, opts)
      }
    }

    // Header
    doc.setFillColor(61, 107, 37)
    doc.rect(0, 0, 210, 30, 'F')
    doc.setTextColor(238, 232, 208)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('PecuariaIA - Relatorio Mensal', 14, 14)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`${perfil?.fazenda || ''} | ${perfil?.nome || ''} | ${mes}`, 14, 23)
    doc.setTextColor(30, 30, 30)

    let y = 40

    // Resumo financeiro
    if (dados.financeiro) {
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.text('Resumo Financeiro', 14, y); y += 8
      addTable({
        startY: y,
        head: [['Item', 'Valor']],
        body: [
          ['Receita total', fmtBRL(dados.financeiro.receitas)],
          ['Despesa total', fmtBRL(dados.financeiro.despesas)],
          ['Resultado liquido', fmtBRL(dados.financeiro.lucro)],
        ],
        theme: 'striped',
        headStyles: { fillColor: [61,107,37] },
        margin: { left: 14, right: 14 },
      })
      y = (doc.lastAutoTable?.finalY || y + 40) + 12
    }

    // Animais
    if (dados.animais?.length) {
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.text('Rebanho por Categoria', 14, y); y += 8
      const catMap = {}
      dados.animais.forEach(a => { catMap[a.categoria] = (catMap[a.categoria]||0)+1 })
      addTable({
        startY: y,
        head: [['Categoria', 'Quantidade']],
        body: Object.entries(catMap).map(([k,v]) => [LABEL_CATEGORIA[k]||k, v]),
        theme: 'striped',
        headStyles: { fillColor: [61,107,37] },
        margin: { left: 14, right: 14 },
      })
      y = (doc.lastAutoTable?.finalY || y + 40) + 12
    }

    // Alertas
    if (dados.alertas?.length) {
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.text('Alertas Pendentes', 14, y); y += 8
      addTable({
        startY: y,
        head: [['Tipo', 'Descricao', 'Data']],
        body: dados.alertas.map(a => [a.tipo, a.titulo, fmtData(a.data_alerta)]),
        theme: 'striped',
        headStyles: { fillColor: [192, 53, 32] },
        margin: { left: 14, right: 14 },
      })
    }

    // Rodapé
    doc.setFontSize(8)
    doc.setTextColor(150)
    doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')} - PecuariaIA`, 14, 285)
    doc.save(`Relatorio_${(perfil?.fazenda||'fazenda').replace(/\s/g,'_')}_${mes}.pdf`)
  } catch(e) {
    console.error('Erro ao gerar PDF:', e)
    alert('Erro ao gerar PDF: ' + e.message)
  }
}

// Exportar Excel
export async function exportarExcel(nomeArquivo, abas) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  abas.forEach(({ nome, dados }) => {
    const ws = XLSX.utils.json_to_sheet(dados)
    XLSX.utils.book_append_sheet(wb, ws, nome.slice(0,31))
  })
  XLSX.writeFile(wb, `${nomeArquivo}.xlsx`)
}
