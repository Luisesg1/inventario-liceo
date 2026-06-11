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
    const emailNorm = email.trim().toLowerCase()

    const { data: authData, error: createError } = await admin.auth.admin.createUser({
      email: emailNorm,
      password: password,
      email_confirm: true,
      user_metadata: { nombre: nombreCompleto, rut: rut?.trim() ?? null, via_invitacion: 'true' },
    })

    if (createError || !authData.user) {
      const msg = createError?.message ?? ''
      const esYaRegistrado = msg.includes('already been registered') || msg.includes('already registered')
      if (!esYaRegistrado) {
        return json({ error: 'Error al crear la cuenta: ' + msg }, 400)
      }
      // Email existe en auth — verificar si también existe en la tabla usuarios
      const { data: usuarioExistente } = await admin
        .from('usuarios')
        .select('id')
        .eq('email', emailNorm)
        .maybeSingle()
      if (usuarioExistente) {
        // Cuenta completamente activa — no permitir duplicado
        return json({ error: 'Ya existe una cuenta con ese correo electrónico.' }, 400)
      }
      // Auth huérfano: fila de usuarios fue borrada pero el auth entry quedó.
      // Buscar el ID en auth.users via función SQL (más confiable que listUsers paginado)
      const { data: authHuerfanoId } = await admin.rpc('get_auth_user_id_by_email', { user_email: emailNorm })
      if (authHuerfanoId) {
        await admin.auth.admin.deleteUser(authHuerfanoId)
        await new Promise(r => setTimeout(r, 600))
      }
      // Reintentar creación
      const { data: authData2, error: createError2 } = await admin.auth.admin.createUser({
        email: emailNorm,
        password: password,
        email_confirm: true,
        user_metadata: { nombre: nombreCompleto, rut: rut?.trim() ?? null, via_invitacion: 'true' },
      })
      if (createError2 || !authData2.user) {
        return json({ error: 'Error al crear la cuenta. Si el problema persiste, contacta al administrador. (' + (createError2?.message ?? 'reintento fallido') + ')' }, 400)
      }
      // Continuar con el auth recién creado
      Object.assign(authData, authData2)
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

    // 5. Permisos por defecto para docente — coincide con PERMISOS_POR_ROL.docente del frontend
    const permisosDocente = {
      // Inventario — sin acceso
      ver_inventario: false, agregar_bien: false, editar_bien: false,
      eliminar_bien: false, eliminar_lote: false, gestionar_categorias: false,
      importar_csv: false, gestionar_usuarios: false, exportar: false,
      registrar_prestamo: false, registrar_incidencia: false,
      // Tickets
      ver_tickets: true, crear_ticket: true, editar_ticket: true,
      gestionar_tickets: false, eliminar_ticket: false,
      ver_alertas_tickets: false, exportar_tickets: true,
      // Ausencias
      ver_propias_ausencias: true, exportar_ausencias: true,
      ver_ausencias: false, crear_ausencias: false, editar_ausencias: false,
      eliminar_ausencias: false, aprobar_ausencias: false,
      // Ajustes
      gestionar_ajustes: true, ver_ajustes: true, guardar_cambios_ajustes: true,
      // Sin acceso al resto
      ver_requerimientos: false, crear_requerimiento: false, editar_requerimiento: false,
      eliminar_requerimiento: false, importar_requerimientos: false,
      exportar_requerimientos: false, ver_auditoria_requerimientos: false,
      ver_compensatorios: false, ver_auditoria_permisos: false,
      ver_auditoria_compensatorios: false, ver_auditoria_inventario: false,
      gestionar_campos: false, ver_campos: false,
      invitar_usuario: false, editar_usuario: false, eliminar_usuario: false,
      editar_roles_permisos: false,
    }

    const { error: permisosError } = await admin.from('permisos_usuario').upsert({
      usuario_id: userId,
      permisos: permisosDocente,
      categorias: ['todos'],
    }, { onConflict: 'usuario_id' })

    if (permisosError) {
      // El trigger de BD debería haber creado los permisos; registrar para diagnóstico
      console.error('permisos_usuario upsert error:', permisosError.message, permisosError.details ?? '')
      // Intentar insert directo como fallback
      const { error: insertError } = await admin.from('permisos_usuario').insert({
        usuario_id: userId,
        permisos: permisosDocente,
        categorias: ['todos'],
      }).select().limit(1)
      if (insertError) {
        console.error('permisos_usuario insert fallback error:', insertError.message)
      }
    }

    return json({ ok: true, creado: true })

  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
