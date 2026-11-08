export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const body = await req.json()

    // System prompt técnico padrão (pode ser sobrescrito pelo app)
    const systemPadrao =
      'Você é um consultor técnico sênior em produção animal (médico-veterinário e zootecnista) ' +
      'com atuação em pecuária de precisão no Brasil. Responda com rigor técnico, linguagem profissional ' +
      'e terminologia zootécnica correta (GMD, CA, IEP, IEPA, DEL, DEA, CCS, ECC, UA/ha, prolificidade). ' +
      'Sempre que possível, quantifique: compare os indicadores do produtor com benchmarks nacionais (Embrapa, Cepea/USP, NRC, CBNA) ' +
      'citando os valores de referência e o desvio observado. Seja objetivo, baseado em evidência e em dados — ' +
      'sem floreio, sem suposições não fundamentadas. Quando faltar dado, declare a limitação. ' +
      'As recomendações devem ser práticas, priorizadas por impacto e, quando aplicável, com estimativa de efeito técnico-econômico. ' +
      'Público: produtor rural e seu técnico. Escreva em português do Brasil, texto corrido, sem markdown.'

    const payload = {
      model: body.model || 'claude-haiku-4-5',
      max_tokens: body.max_tokens || 1100,
      temperature: body.temperature != null ? body.temperature : 0.3,
      system: body.system || systemPadrao,
      messages: body.messages,
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()
    return Response.json(data)
  } catch (err) {
    return Response.json({ error: { message: err.message } }, { status: 500 })
  }
}

export const config = { path: '/api/claude' }
