import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')!
const ADMIN_EMAIL   = Deno.env.get('ADMIN_EMAIL')!
const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { titulo, descripcion, lugar_falla, creado_por_nombre, correo_solicitante } =
      await req.json() as {
        titulo:              string
        descripcion?:        string
        lugar_falla?:        string
        creado_por_nombre?:  string
        correo_solicitante?: string
      }

    // Destinatarios = quienes pueden resolver tickets:
    //  · rol admin o soporte (legacy)
    //  · cualquier usuario con permiso gestionar_tickets
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const [{ data: porRol }, { data: permRows }] = await Promise.all([
      admin.from('usuarios').select('email, nombre, rol').in('rol', ['admin', 'soporte']),
      admin.from('permisos_usuario').select('permisos, usuario:usuario_id(email, nombre)'),
    ])

    const porPermiso = (permRows ?? [])
      .filter((r: any) => r.permisos?.gestionar_tickets && r.usuario?.email)
      .map((r: any) => ({ email: r.usuario.email, nombre: r.usuario.nombre }))

    // Combinar y deduplicar por email
    const mapa = new Map<string, { email: string; name: string }>()
    ;[...(porRol ?? []), ...porPermiso].forEach((u: any) => {
      if (u?.email) mapa.set(u.email.toLowerCase(), { email: u.email, name: u.nombre ?? u.email })
    })
    const soporteUsers = [...mapa.values()]

    if (!soporteUsers.length) {
      console.log('No hay destinatarios que puedan resolver tickets, omitiendo notificación')
      return new Response('OK (sin destinatarios)', { status: 200, headers: cors })
    }

    const htmlContent = `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:580px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
        <div style="background:#1a237e;padding:20px 24px">
          <h2 style="color:#f0d060;margin:0;font-size:18px">🎫 Nuevo ticket de soporte — Sistema de Gestión Liceo JHJ</h2>
        </div>
        <div style="padding:24px">
          <div style="background:#dbeafe;border-radius:8px;padding:10px 18px;margin-bottom:20px;display:inline-block">
            <span style="font-size:14px;font-weight:700;color:#1d4ed8">🔵 Abierto — requiere atención</span>
          </div>

          <table style="width:100%;border-collapse:collapse;font-size:14px;color:#374151;margin-bottom:20px">
            <tr>
              <td style="padding:6px 0;font-weight:600;width:140px">Área / Falla</td>
              <td style="padding:6px 0">${titulo}</td>
            </tr>
            ${lugar_falla ? `
            <tr>
              <td style="padding:6px 0;font-weight:600">Ubicación</td>
              <td style="padding:6px 0">📍 ${lugar_falla}</td>
            </tr>` : ''}
            ${creado_por_nombre ? `
            <tr>
              <td style="padding:6px 0;font-weight:600">Solicitante</td>
              <td style="padding:6px 0">${creado_por_nombre}</td>
            </tr>` : ''}
            ${correo_solicitante ? `
            <tr>
              <td style="padding:6px 0;font-weight:600">Correo contacto</td>
              <td style="padding:6px 0">${correo_solicitante}</td>
            </tr>` : ''}
          </table>

          ${descripcion ? `
          <div style="background:#f9fafb;border-left:4px solid #1a237e;padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:20px">
            <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Descripción</p>
            <p style="margin:0;font-size:14px;color:#374151">${descripcion}</p>
          </div>` : ''}

          <p style="margin-top:24px;font-size:12px;color:#9ca3af">
            Ingresa al sistema para gestionar este ticket y asignar prioridad.
          </p>
        </div>
      </div>`

    const to = soporteUsers.map(u => ({ email: u.email, name: u.name }))

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender:      { name: 'Sistema de Gestión Liceo JHJ', email: ADMIN_EMAIL },
        to,
        subject:     `🎫 Nuevo ticket: ${titulo}`,
        htmlContent,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error('Brevo error', res.status, body)
      return new Response(`Brevo error: ${body}`, { status: 500, headers: cors })
    }

    console.log('Notificación enviada a', to.map(d => d.email).join(', '))
    return new Response('OK', { status: 200, headers: cors })
  } catch (e) {
    console.error('catch error:', String(e))
    return new Response(String(e), { status: 500, headers: cors })
  }
})
