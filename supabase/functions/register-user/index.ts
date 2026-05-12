import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const INVITE_CODE         = Deno.env.get('INVITE_CODE')!
const SUPABASE_URL        = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { nombre, email, password, codigo } = await req.json()

    if (!codigo || codigo.trim() !== INVITE_CODE.trim()) {
      return json({ error: 'Código de invitación incorrecto' }, 400)
    }
    if (!nombre?.trim() || !email?.trim() || !password) {
      return json({ error: 'Faltan campos obligatorios' }, 400)
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
    })

    if (authError) {
      const msg = authError.message.includes('already registered')
        ? 'Este correo ya está registrado'
        : authError.message
      return json({ error: msg }, 400)
    }

    const { error: dbError } = await admin.from('usuarios').insert({
      id:     authData.user.id,
      nombre: nombre.trim(),
      email:  email.trim().toLowerCase(),
      rol:    'docente',
    })

    if (dbError) {
      await admin.auth.admin.deleteUser(authData.user.id)
      return json({ error: 'Error al crear el perfil: ' + dbError.message }, 500)
    }

    return json({ ok: true })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
