// netlify/functions/cancelar-assinatura.js
// Cancela a assinatura recorrente do produtor no Mercado Pago.
// O webhook depois confirma o status 'cancelled' e bloqueia o acesso.

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const { user_id } = await req.json()
    if (!user_id) {
      return Response.json({ error: 'Usuário não informado.' }, { status: 400 })
    }

    // 1) Busca o preapproval_id do produtor no Supabase
    const perfilResp = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/perfis?id=eq.${user_id}&select=mp_preapproval_id`,
      {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE}`,
        },
      }
    )
    const perfis = await perfilResp.json()
    const preapprovalId = perfis?.[0]?.mp_preapproval_id

    if (!preapprovalId) {
      return Response.json({ error: 'Nenhuma assinatura ativa encontrada.' }, { status: 404 })
    }

    // 2) Cancela a assinatura no Mercado Pago
    const mpResp = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ status: 'cancelled' }),
    })

    if (!mpResp.ok) {
      const detalhe = await mpResp.text()
      return Response.json({ error: 'Erro ao cancelar no Mercado Pago.', detalhe }, { status: 502 })
    }

    // 3) Atualiza o perfil imediatamente (o webhook também confirmará)
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/perfis?id=eq.${user_id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ mp_status: 'cancelled', assinatura_ativa: false, plano: 'expirado' }),
    })

    return Response.json({ ok: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export const config = { path: '/api/cancelar-assinatura' }
