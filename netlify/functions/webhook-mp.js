// netlify/functions/webhook-mp.js
// Recebe as notificações do Mercado Pago e libera/bloqueia a assinatura no Supabase.
// Regra de ouro: NUNCA confiar no corpo da notificação — sempre consultar o status
// real na API do MP usando o Access Token secreto.

async function atualizarPerfil(filtro, campos) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/perfis?${filtro}`
  await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(campos),
  })
}

export default async (req) => {
  // O MP espera um 200 rápido. Respondemos ok mesmo em erro interno para evitar reenvios infinitos,
  // mas logamos tudo para depuração.
  try {
    // A notificação pode vir por query (?type=...&data.id=...) ou no corpo JSON.
    const url = new URL(req.url)
    let tipo = url.searchParams.get('type') || url.searchParams.get('topic')
    let id   = url.searchParams.get('data.id') || url.searchParams.get('id')

    if (!tipo || !id) {
      try {
        const body = await req.json()
        tipo = tipo || body.type || body.topic
        id   = id   || body?.data?.id || body?.id
      } catch { /* corpo vazio */ }
    }

    // Só tratamos eventos de assinatura
    if (!id || !(tipo && tipo.includes('preapproval'))) {
      return new Response('ignored', { status: 200 })
    }

    // 1) Consulta o status REAL da assinatura no Mercado Pago
    const mpResp = await fetch(`https://api.mercadopago.com/preapproval/${id}`, {
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    })
    if (!mpResp.ok) {
      console.error('MP preapproval lookup falhou:', await mpResp.text())
      return new Response('ok', { status: 200 })
    }
    const sub = await mpResp.json()

    // external_reference = "user_id|plano"
    const [userId, plano] = (sub.external_reference || '').split('|')
    const status = sub.status  // authorized | paused | cancelled | pending

    // 2) Define os campos conforme o status
    let campos
    if (status === 'authorized') {
      // Pagamento aprovado → libera. Próximo ciclo em +1 mês.
      const ate = new Date()
      ate.setMonth(ate.getMonth() + 1)
      campos = {
        assinatura_ativa: true,
        plano: plano || 'pro',
        mp_status: status,
        mp_preapproval_id: sub.id,
        assinatura_desde: new Date().toISOString(),
        assinatura_ate: ate.toISOString(),
      }
    } else if (status === 'cancelled' || status === 'paused') {
      // Cancelou ou pagamento falhou → bloqueia (volta a somente-leitura)
      campos = {
        assinatura_ativa: false,
        plano: 'expirado',
        mp_status: status,
      }
    } else {
      // pending e outros → só registra o status, sem mudar acesso
      campos = { mp_status: status, mp_preapproval_id: sub.id }
    }

    // 3) Atualiza o perfil — por id do usuário se tivermos, senão pelo preapproval_id
    if (userId) {
      await atualizarPerfil(`id=eq.${userId}`, campos)
    } else {
      await atualizarPerfil(`mp_preapproval_id=eq.${sub.id}`, campos)
    }

    return new Response('ok', { status: 200 })
  } catch (err) {
    console.error('webhook-mp erro:', err.message)
    return new Response('ok', { status: 200 })
  }
}

export const config = { path: '/api/webhook-mp' }
