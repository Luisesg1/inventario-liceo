import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const body = await req.json()
    const { codigo, nombre, apellidos, rut, email, password } = body as {
      codigo?: string; nombre?: string; apellidos?: string
      rut?: string; email?: string; password?: string
    }

    if (!codigo?.trim()) return json({ error: 'Código requerido' }, 400)

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 1. Validar código de invitación
    const { data: cfg, error: cfgError } = await admin
      .from('configuracion')
      .select('valor')
      .eq('clave', 'codigo_invitacion')
      .single()

    if (cfgError || !cfg) return json({ error: 'Error de configuración' }, 500)
    if (codigo.trim() !== cfg.valor.trim()) return json({ error: 'Código de invitación incorrecto' }, 400)

    // Solo validar código — si no vienen los demás datos, retornar OK (modo legacy)
    if (!nombre || !email || !password) return json({ ok: true })

    // 2. Crear usuario en Supabase Auth
    const nombreCompleto = `${nombre.trim()} ${(apellidos ?? '').trim()}`.trim()
    const { data: authData, error: createError } = await admin.auth.admin.createUser({
      email: email.trim(),
      password: password,
      email_confirm: true,
      user_metadata: { nombre: nombreCompleto, rut: rut?.trim() ?? null, via_invitacion: 'true' },
    })

    if (createError || !authData.user) {
      const msg = createError?.message ?? ''
      const traducido = msg.includes('already been registered') || msg.includes('already registered')
        ? 'Ya existe una cuenta con ese correo electrónico.'
        : 'Error al crear la cuenta: ' + msg
      return json({ error: traducido }, 400)
    }

    const userId = authData.user.id

    // 3. Esperar un momento para que el trigger de BD (si existe) cree la fila primero
    await new Promise(r => setTimeout(r, 800))

    // 4. Upsert en tabla usuarios con RUT (funciona haya o no trigger previo)
    const { error: upsertError } = await admin.from('usuarios').upsert({
      id: userId,
      nombre: nombreCompleto,
      rut: rut?.trim() || null,
      email: email.trim().toLowerCase(),
      rol: 'docente',
      debe_cambiar_password: false,
    }, { onConflict: 'id' })

    if (upsertError) {
      console.error('upsert usuarios error:', upsertError.message)
      await admin.auth.admin.deleteUser(userId)
      return json({ error: 'Error al registrar usuario: ' + upsertError.message }, 500)
    }

    // 5. Permisos por defecto para docente (upsert por si el trigger ya los creó)
    await admin.from('permisos_usuario').upsert({
      usuario_id: userId,
      permisos: {
        ver_inventario: false, agregar_bien: false, editar_bien: false,
        eliminar_bien: false, eliminar_lote: false, gestionar_categorias: false,
        importar_csv: false, gestionar_usuarios: false, exportar: false,
        registrar_prestamo: false, registrar_incidencia: false,
        ver_tickets: true, gestionar_tickets: false, crear_ticket: true,
      },
      categorias: ['todos'],
    }, { onConflict: 'usuario_id' })

    return json({ ok: true, creado: true })

  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
