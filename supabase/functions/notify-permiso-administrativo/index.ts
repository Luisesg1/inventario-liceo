
const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')!
const ADMIN_EMAIL   = Deno.env.get('ADMIN_EMAIL')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function fmtFecha(d: string) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('es-CL', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

const JORNADA_LABEL: Record<string, string> = {
  medio_dia:     'Medio día',
  dia_completo:  'Día completo',
  personalizado: 'Personalizado',
  reposo:        'Desde / Hasta',
}

const PERIODO_LABEL: Record<string, string> = {
  manana: 'Mañana',
  tarde:  'Tarde',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { correo, nombre, fechaInicio, fechaFin, jornada, periodo, horaInicio, horaFin, notas, diasRestantes, maxDias } = await req.json()

    if (!correo) return new Response('Sin correo', { status: 400, headers: cors })

    const jornadaLabel = JORNADA_LABEL[jornada] ?? jornada ?? '—'
    const mismaFecha   = fechaInicio === fechaFin

    const periodoHtml = jornada === 'medio_dia' && periodo
      ? `<div style="margin-bottom:12px">
           <p style="margin:0 0 3px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em">Período</p>
           <p style="margin:0;font-size:14px;color:#111827">${PERIODO_LABEL[periodo] ?? periodo}</p>
         </div>`
      : ''

    const horariosHtml = jornada === 'personalizado' && horaInicio && horaFin
      ? `<div style="margin-bottom:12px">
           <p style="margin:0 0 3px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em">Horario</p>
           <p style="margin:0;font-size:14px;color:#111827">${horaInicio} – ${horaFin}</p>
         </div>`
      : ''

    const fechaHtml = mismaFecha
      ? `<div style="margin-bottom:12px">
           <p style="margin:0 0 3px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em">Fecha</p>
           <p style="margin:0;font-size:14px;color:#111827">${fmtFecha(fechaInicio)}</p>
         </div>`
      : `<div style="margin-bottom:12px">
           <p style="margin:0 0 3px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em">Período de ausencia</p>
           <p style="margin:0;font-size:14px;color:#111827">Desde ${fmtFecha(fechaInicio)}</p>
           <p style="margin:4px 0 0;font-size:14px;color:#111827">Hasta ${fmtFecha(fechaFin)}</p>
         </div>`

    const notasHtml = notas
      ? `<div style="background:#fefce8;border-left:4px solid #d97706;padding:12px 16px;border-radius:0 8px 8px 0;margin-top:4px">
           <p style="margin:0 0 5px;font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.05em">Motivo / Notas</p>
           <p style="margin:0;font-size:14px;color:#374151">${notas}</p>
         </div>`
      : ''

    const htmlContent = `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:580px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
        <div style="background:#1a237e;padding:20px 24px">
          <h2 style="color:#f0d060;margin:0;font-size:18px">📋 Permiso administrativo registrado</h2>
          <p style="color:rgba(255,255,255,0.65);margin:4px 0 0;font-size:13px">Liceo Juvenal Hernández Jaque</p>
        </div>
        <div style="padding:24px">

          <p style="margin:0 0 20px;font-size:15px;color:#374151">
            Hola <strong>${nombre ?? 'usuario'}</strong>, tu permiso administrativo ha sido registrado en el sistema.
            A continuación encontrarás el detalle:
          </p>

          <div style="background:#f8faff;border:1px solid #e0e7ff;border-radius:10px;padding:16px;margin-bottom:16px">
            <p style="margin:0 0 12px;font-size:11px;font-weight:800;color:#3730a3;text-transform:uppercase;letter-spacing:0.07em;padding-bottom:8px;border-bottom:1.5px solid #e0e7ff">
              Detalle del permiso
            </p>

            ${fechaHtml}

            <div style="margin-bottom:12px">
              <p style="margin:0 0 3px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em">Jornada</p>
              <p style="margin:0;font-size:14px;color:#111827">${jornadaLabel}</p>
            </div>

            ${periodoHtml}
            ${horariosHtml}
          </div>

          ${notasHtml}

          ${diasRestantes !== null && diasRestantes !== undefined ? (() => {
            const agotado  = diasRestantes <= 0
            const bajo     = diasRestantes === 1
            const bg       = agotado ? '#fee2e2' : bajo ? '#ffedd5' : '#f0fdf4'
            const border   = agotado ? '#fca5a5' : bajo ? '#fdba74' : '#86efac'
            const color    = agotado ? '#b91c1c' : bajo ? '#c2410c' : '#15803d'
            const icon     = agotado ? '🔴' : bajo ? '🟠' : '🟢'
            const mensaje  = agotado
              ? `Has agotado tu cuota de permisos administrativos (${maxDias ?? 6} días en el año).`
              : `Te quedan <strong>${diasRestantes} día${diasRestantes !== 1 ? 's' : ''}</strong> de permiso administrativo disponible${diasRestantes !== 1 ? 's' : ''} en el año (cuota: ${maxDias ?? 6} días).`
            return `<div style="background:${bg};border:1px solid ${border};border-radius:10px;padding:14px 18px;margin-top:16px;display:flex;align-items:flex-start;gap:10px">
              <span style="font-size:18px;line-height:1">${icon}</span>
              <p style="margin:0;font-size:14px;color:${color};font-weight:600">${mensaje}</p>
            </div>`
          })() : ''}

          <p style="margin-top:24px;font-size:12px;color:#9ca3af;border-top:1px solid #f3f4f6;padding-top:16px">
            Este es un correo automático de respaldo. Si los datos no son correctos, comunícate con el encargado de permisos del establecimiento.
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
        subject:     `📋 Permiso administrativo registrado — ${fmtFecha(fechaInicio)}`,
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
