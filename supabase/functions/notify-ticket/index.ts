import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')!
const ADMIN_EMAIL   = Deno.env.get('ADMIN_EMAIL')!
const ADMIN_EMAIL_2 = Deno.env.get('ADMIN_EMAIL_2')

serve(async (req) => {
  try {
    const { record } = await req.json()
    const t = record

    const area = t.area_reporte === 'Otro' && t.area_otro
      ? `Otro — ${t.area_otro}` : (t.area_reporte ?? t.titulo ?? '—')

    const sectionLabel = (text: string) =>
      `<p style="margin:0 0 10px;font-size:11px;font-weight:800;color:#d4a017;text-transform:uppercase;letter-spacing:0.07em;padding-bottom:6px;border-bottom:1.5px solid rgba(212,160,23,0.25)">${text}</p>`

    const field = (label: string, value: string) =>
      `<div style="margin-bottom:10px">
        <p style="margin:0 0 2px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em">${label}</p>
        <p style="margin:0;font-size:14px;color:#111827">${value}</p>
      </div>`

    const html = `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:580px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
        <div style="background:#1a237e;padding:20px 24px">
          <h2 style="color:#f0d060;margin:0;font-size:18px">🎫 Nuevo ticket — Liceo JHJ</h2>
          <p style="color:rgba(255,255,255,0.6);margin:4px 0 0;font-size:13px">${new Date(t.creado_en).toLocaleString('es-CL')}</p>
        </div>
        <div style="padding:24px">

          <div style="background:#f8faff;border:1px solid #e0e7ff;border-radius:10px;padding:16px;margin-bottom:16px">
            ${sectionLabel('Información de contacto')}
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 20px">
              ${field('Nombre', t.creado_por_nombre ?? '—')}
              ${t.rol_solicitante ? field('Rol', t.rol_solicitante) : ''}
            </div>
            ${t.correo_contacto ? field('Correo electrónico', `<a href="mailto:${t.correo_contacto}" style="color:#1a237e">${t.correo_contacto}</a>`) : ''}
          </div>

          <div style="background:#f8faff;border:1px solid #e0e7ff;border-radius:10px;padding:16px;margin-bottom:16px">
            ${sectionLabel('Reporte de falla o incidencia')}
            ${field('Área del reporte', area)}
            ${t.lugar_falla ? field('Lugar donde se detecta la falla', t.lugar_falla) : ''}
            ${t.marca_modelo_falla ? field('Marca y modelo del dispositivo', t.marca_modelo_falla) : ''}
            ${t.descripcion ? `
            <div style="margin-top:4px">
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em">Descripción de la falla</p>
              <div style="background:#fff;border-left:3px solid #1a237e;padding:10px 14px;border-radius:0 6px 6px 0;font-size:14px;color:#374151">${t.descripcion}</div>
            </div>` : ''}
          </div>

        </div>
      </div>`

    const destinatarios = [{ email: ADMIN_EMAIL, name: 'Admin JHJ' }]
    if (ADMIN_EMAIL_2) destinatarios.push({ email: ADMIN_EMAIL_2, name: 'Admin JHJ' })

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender:      { name: 'Inventario JHJ', email: ADMIN_EMAIL },
        to:          destinatarios,
        subject:     `🎫 Nuevo ticket: ${area}`,
        htmlContent: html,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error('Brevo error:', res.status, body)
      return new Response(`Brevo error: ${body}`, { status: 500 })
    }

    console.log('Email enviado a', destinatarios.map(d => d.email).join(', '))
    return new Response('OK', { status: 200 })
  } catch (e) {
    return new Response(String(e), { status: 500 })
  }
})
