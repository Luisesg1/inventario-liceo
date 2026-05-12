import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const ADMIN_EMAIL    = Deno.env.get('ADMIN_EMAIL')!

serve(async (req) => {
  try {
    const { record } = await req.json()
    const t = record

    const area = t.area_reporte === 'Otro' && t.area_otro
      ? `Otro — ${t.area_otro}` : (t.area_reporte ?? t.titulo ?? '—')

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
        <div style="background:#1a237e;padding:20px 24px">
          <h2 style="color:#f0d060;margin:0;font-size:18px">🎫 Nuevo ticket — Liceo JHJ</h2>
        </div>
        <div style="padding:24px">
          <h3 style="margin:0 0 16px;color:#111827;font-size:16px">${area}</h3>

          <table style="width:100%;border-collapse:collapse;font-size:14px;color:#374151">
            <tr><td style="padding:6px 0;font-weight:700;width:160px">Nombre</td><td>${t.creado_por_nombre ?? '—'}</td></tr>
            ${t.rol_solicitante ? `<tr><td style="padding:6px 0;font-weight:700">Rol</td><td>${t.rol_solicitante}</td></tr>` : ''}
            ${t.correo_contacto ? `<tr><td style="padding:6px 0;font-weight:700">Correo</td><td>${t.correo_contacto}</td></tr>` : ''}
            <tr><td style="padding:6px 0;font-weight:700">Área</td><td>${area}</td></tr>
            ${t.lugar_falla ? `<tr><td style="padding:6px 0;font-weight:700">Lugar</td><td>${t.lugar_falla}</td></tr>` : ''}
            ${t.marca_modelo_falla ? `<tr><td style="padding:6px 0;font-weight:700">Dispositivo</td><td>${t.marca_modelo_falla}</td></tr>` : ''}
          </table>

          ${t.descripcion ? `
          <div style="margin-top:16px;background:#f9fafb;border-left:4px solid #1a237e;padding:12px 16px;border-radius:0 8px 8px 0">
            <p style="margin:0;font-size:13px;color:#374151">${t.descripcion}</p>
          </div>` : ''}

          <p style="margin-top:20px;font-size:12px;color:#9ca3af">
            Ticket creado el ${new Date(t.creado_en).toLocaleString('es-CL')}
          </p>
        </div>
      </div>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Inventario JHJ <onboarding@resend.dev>',
        to:   [ADMIN_EMAIL],
        subject: `🎫 Nuevo ticket: ${area}`,
        html,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error('Resend error:', res.status, body)
      return new Response(`Resend error: ${body}`, { status: 500 })
    }

    console.log('Email enviado a', ADMIN_EMAIL)
    return new Response('OK', { status: 200 })
  } catch (e) {
    return new Response(String(e), { status: 500 })
  }
})
