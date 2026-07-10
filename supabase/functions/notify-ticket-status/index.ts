
const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')!
const ADMIN_EMAIL   = Deno.env.get('ADMIN_EMAIL')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  try {
    const { correo, nombre, area, estado, notas } = await req.json()

    if (!correo) return new Response('No correo', { status: 400, headers: cors })

    const estadoColor = estado === 'Resuelto' ? '#16a34a' : estado === 'Abierto' ? '#1d4ed8' : '#d97706'
    const estadoBg    = estado === 'Resuelto' ? '#dcfce7' : estado === 'Abierto' ? '#dbeafe' : '#fef9c3'
    const estadoIcon  = estado === 'Resuelto' ? '✅' : estado === 'Abierto' ? '🔵' : '🔄'

    const htmlContent = `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:580px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
        <div style="background:#1a237e;padding:20px 24px">
          <h2 style="color:#f0d060;margin:0;font-size:18px">${estadoIcon} Actualización de tu ticket — Sistema de Gestión Liceo JHJ</h2>
        </div>
        <div style="padding:24px">
          <p style="margin:0 0 16px;font-size:15px;color:#374151">Hola <strong>${nombre ?? 'solicitante'}</strong>,</p>
          <p style="margin:0 0 20px;font-size:14px;color:#374151">
            Tu ticket <strong>"${area}"</strong> ha sido actualizado.
          </p>

          <div style="display:inline-block;background:${estadoBg};border-radius:8px;padding:10px 18px;margin-bottom:20px">
            <span style="font-size:14px;font-weight:700;color:${estadoColor}">${estadoIcon} ${estado}</span>
          </div>

          ${notas ? `
          <div style="background:#f9fafb;border-left:4px solid #1a237e;padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:20px">
            <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Notas del encargado</p>
            <p style="margin:0;font-size:14px;color:#374151">${notas}</p>
          </div>` : ''}

          <p style="margin-top:24px;font-size:12px;color:#9ca3af">
            Si tienes alguna duda, comunícate con el encargado de tecnología del establecimiento.
          </p>
        </div>
      </div>`

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender:      { name: 'Sistema de Gestión Liceo JHJ', email: ADMIN_EMAIL },
        to:          [{ email: correo, name: nombre ?? correo }],
        subject:     `${estadoIcon} Tu ticket "${area}" está ${estado}`,
        htmlContent,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error('Brevo error', res.status, body)
      return new Response(`Brevo error: ${body}`, { status: 500, headers: cors })
    }

    console.log('Email enviado a', correo)
    return new Response('OK', { status: 200, headers: cors })
  } catch (e) {
    console.error('catch error:', String(e))
    return new Response(String(e), { status: 500, headers: cors })
  }
})
