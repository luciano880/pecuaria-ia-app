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
}

export function getCor(segmento) {
  return segmento === 'leite'
    ? { primary: C.leitePrimary, accent: C.leiteAccent }
    : { primary: C.cortePrimary, accent: C.corteAccent }
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

export async function chamarIA(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  return data.content?.map(b => b.text || '').join('') || ''
}

export const CATEGORIAS_LEITE = ['lactacao','seca','novilha','bezerra','touro']
export const CATEGORIAS_CORTE = ['bezerro','bezerro_desmamado','garrote','novilho','boi_gordo','vaca','touro']
export const LABEL_CATEGORIA = {
  lactacao:'Vaca em Lactação', seca:'Vaca Seca', novilha:'Novilha',
  bezerra:'Bezerra', touro:'Touro',
  bezerro:'Bezerro', bezerro_desmamado:'Bezerro Desmamado',
  garrote:'Garrote', novilho:'Novilho', boi_gordo:'Boi Gordo', vaca:'Vaca',
}

// Gerar PDF relatório mensal
export async function gerarPDFRelatorio(perfil, dados) {
  const { jsPDF } = await import('jspdf')
  await import('jspdf-autotable')
  const doc = new jsPDF()
  const mes = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  // Header
  doc.setFillColor(61, 107, 37)
  doc.rect(0, 0, 210, 30, 'F')
  doc.setTextColor(238, 232, 208)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('PecuáriaIA — Relatório Mensal', 14, 14)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`${perfil?.fazenda} | ${perfil?.nome} | ${mes}`, 14, 23)

  // Reset cor
  doc.setTextColor(30, 30, 30)

  let y = 40

  // Resumo financeiro
  if (dados.financeiro) {
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Resumo Financeiro', 14, y); y += 8
    doc.autoTable({
      startY: y,
      head: [['Item', 'Valor']],
      body: [
        ['Receita total', fmtBRL(dados.financeiro.receitas)],
        ['Despesa total', fmtBRL(dados.financeiro.despesas)],
        ['Resultado líquido', fmtBRL(dados.financeiro.lucro)],
      ],
      theme: 'striped',
      headStyles: { fillColor: [61,107,37] },
      margin: { left: 14, right: 14 },
    })
    y = doc.lastAutoTable.finalY + 12
  }

  // Animais
  if (dados.animais?.length) {
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Rebanho por Categoria', 14, y); y += 8
    const catMap = {}
    dados.animais.forEach(a => { catMap[a.categoria] = (catMap[a.categoria]||0)+1 })
    doc.autoTable({
      startY: y,
      head: [['Categoria', 'Quantidade']],
      body: Object.entries(catMap).map(([k,v]) => [LABEL_CATEGORIA[k]||k, v]),
      theme: 'striped',
      headStyles: { fillColor: [61,107,37] },
      margin: { left: 14, right: 14 },
    })
    y = doc.lastAutoTable.finalY + 12
  }

  // Alertas
  if (dados.alertas?.length) {
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Alertas Pendentes', 14, y); y += 8
    doc.autoTable({
      startY: y,
      head: [['Tipo', 'Descrição', 'Data']],
      body: dados.alertas.map(a => [a.tipo, a.titulo, fmtData(a.data_alerta)]),
      theme: 'striped',
      headStyles: { fillColor: [192, 53, 32] },
      margin: { left: 14, right: 14 },
    })
  }

  // Rodapé
  doc.setFontSize(8)
  doc.setTextColor(150)
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')} — PecuáriaIA`, 14, 285)

  doc.save(`Relatorio_${perfil?.fazenda}_${mes}.pdf`)
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
