// netlify/functions/criar-assinatura.js
// Cria uma assinatura recorrente (Preapproval) no Mercado Pago e devolve o link de pagamento.

const PRECOS = {
  pro:     { valor: 64.90, titulo: 'PecuáriaIA — Plano Pro' },
  premium: { valor: 89.90, titulo: 'PecuáriaIA — Plano Premium' },
}

const SITE = 'https://pecuaria-ia.netlify.app'

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const { plano, email, user_id } = await req.json()

    if (!PRECOS[plano]) {
      return Response.json({ error: 'Plano inválido.' }, { status: 400 })
    }
    if (!email || !user_id) {
      return Response.json({ error: 'E-mail e usuário são obrigatórios.' }, { status: 400 })
    }

    const { valor, titulo } = PRECOS[plano]

    // 1) Cria o Preapproval (assinatura recorrente mensal) no Mercado Pago
    const resp = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        reason: titulo,
        external_reference: `${user_id}|${plano}`,   // volta no webhook para sabermos quem é
        payer_email: email,
        back_url: `${SITE}/configuracoes?assinatura=ok`,
        status: 'pending',
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: valor,
          currency_id: 'BRL',
        },
      }),
    })

    const data = await resp.json()

    if (!resp.ok) {
      return Response.json(
        { error: data.message || 'Erro ao criar assinatura no Mercado Pago.', detalhe: data },
        { status: 502 }
      )
    }

    // 2) Guarda o id da assinatura no perfil (para o webhook casar depois)
    try {
      await fetch(`${process.env.SUPABASE_URL}/rest/v1/perfis?id=eq.${user_id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.SUPABASE_SERVICE_ROLE,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          mp_preapproval_id: data.id,
          mp_status: data.status,
          plano_contratado: plano,
        }),
      })
    } catch (e) {
      // não bloqueia o pagamento; o webhook ainda consegue casar via external_reference
      console.error('Falha ao salvar preapproval_id:', e.message)
    }

    // 3) Devolve o link de pagamento para o app redirecionar
    return Response.json({
      id: data.id,
      init_point: data.init_point,     // URL onde o produtor paga
      status: data.status,
    })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export const config = { path: '/api/criar-assinatura' }
