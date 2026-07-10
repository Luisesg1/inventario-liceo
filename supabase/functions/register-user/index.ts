import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Orígenes permitidos. Configurable con ALLOWED_ORIGINS (lista separada por comas).
// CORS no detiene clientes no-navegador (curl); el control real es el código de
// invitación + el rate limit. Esto es defensa en profundidad.
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ??
  'https://sistema.liceojhj.cl,https://liceojhj.cl')
  .split(',').map(s => s.trim()).filter(Boolean)

const esOrigenPermitido = (o: string | null) =>
  !!o && (ALLOWED_ORIGINS.includes(o) || /^http:\/\/localhost(:\d+)?$/.test(o))

const corsPara = (origin: string | null) => ({
  'Access-Control-Allow-Origin': esOrigenPermitido(origin) ? origin! : ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Vary': 'Origin',
})

// Límite de intentos por IP: 10 cada 10 minutos.
const RL_MAX = 10
const RL_VENTANA_SEG = 600

serve(async (req) => {
  const cors = corsPara(req.headers.get('origin'))
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const body = await req.json()
    const { codigo, nombre, apellidos, rut, email, password } = body as {
      codigo?: string; nombre?: string; apellidos?: string
      rut?: string; email?: string; password?: string
    }

    if (!codigo?.trim()) {
      console.log('[400] codigo vacío')
      return json({ error: 'Código requerido' }, 400)
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 0. Rate limit por IP — evita forzar el código de invitación por fuerza bruta.
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'desconocida'
    const { data: dentroDelLimite, error: rlError } = await admin.rpc('consumir_rate_limit', {
      p_clave: `register-user:${ip}`,
      p_max: RL_MAX,
      p_ventana_seg: RL_VENTANA_SEG,
    })
    if (rlError) {
      // No dejamos pasar en silencio: si el limitador no responde, es preferible
      // registrar y continuar antes que bloquear el registro legítimo.
      console.error('[rate-limit] error:', rlError.message)
    } else if (dentroDelLimite === false) {
      console.log('[429] rate limit excedido para IP:', ip)
      return json({ error: 'Demasiados intentos. Vuelve a intentarlo en unos minutos.' }, 429)
    }

    // 1. Validar código de invitación
    const { data: cfg, error: cfgError } = await admin
      .from('configuracion')
      .select('valor')
      .eq('clave', 'codigo_invitacion')
      .single()

    if (cfgError || !cfg) {
      console.error('[500] config error:', cfgError?.message)
      return json({ error: 'Error de configuración' }, 500)
    }
    if (codigo.trim() !== cfg.valor.trim()) {
      // No registrar el código esperado ni el recibido: quedarían en los logs.
      console.log('[400] código de invitación incorrecto desde IP:', ip)
      return json({ error: 'Código de invitación incorrecto' }, 400)
    }

    // Solo validar código — si no vienen los demás datos, retornar OK (modo legacy)
    if (!nombre || !email || !password) return json({ ok: true })

    // 2. Crear usuario en Supabase Auth
    const nombreCompleto = `${nombre.trim()} ${(apellidos ?? '').trim()}`.trim()
    const emailNorm = email.trim().toLowerCase()

    console.log('[info] creando auth user para:', emailNorm)

    const { data: authData, error: createError } = await admin.auth.admin.createUser({
      email: emailNorm,
      password: password,
      email_confirm: true,
      user_metadata: { nombre: nombreCompleto, rut: rut?.trim() ?? null, via_invitacion: 'true' },
    })

    if (createError || !authData.user) {
      const msg = createError?.message ?? ''
      console.error('[auth] createUser falló:', msg)
      const esYaRegistrado = msg.includes('already been registered') || msg.includes('already registered')
      if (!esYaRegistrado) {
        console.error('[400] error no esperado de createUser:', msg)
        return json({ error: 'Error al crear la cuenta: ' + msg }, 400)
      }
      // Email existe en auth — verificar si también existe en la tabla usuarios
      const { data: usuarioExistente } = await admin
        .from('usuarios')
        .select('id')
        .eq('email', emailNorm)
        .maybeSingle()
      if (usuarioExistente) {
        console.log('[400] cuenta activa duplicada para:', emailNorm)
        return json({ error: 'Ya existe una cuenta con ese correo electrónico.' }, 400)
      }
      // Auth huérfano: buscar ID via SQL y eliminar
      console.log('[info] buscando auth huérfano para:', emailNorm)
      const { data: authHuerfanoId, error: rpcErr } = await admin.rpc('get_auth_user_id_by_email', { user_email: emailNorm })
      console.log('[info] auth huérfano ID:', authHuerfanoId, 'rpcErr:', rpcErr?.message)
      if (authHuerfanoId) {
        const { error: delErr } = await admin.auth.admin.deleteUser(authHuerfanoId)
        console.log('[info] delete auth huérfano:', delErr?.message ?? 'ok')
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
        console.error('[400] reintento falló:', createError2?.message)
        return json({ error: 'Error al crear la cuenta. (' + (createError2?.message ?? 'reintento fallido') + ')' }, 400)
      }
      console.log('[info] reintento exitoso, nuevo userId:', authData2.user.id)
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

    // 5. Permisos base para docente (auto-registro).
    // La tabla permisos_rol es la fuente viva (leída a continuación); este objeto
    // solo actúa como fallback si la tabla no tiene fila para 'docente'.
    // Incluye TODAS las claves conocidas para que el merge sea completo.
    const permisosDocente = {
      // Inventario
      ver_inventario: false, agregar_bien: false, editar_bien: false,
      eliminar_bien: false, eliminar_lote: false, gestionar_categorias: false,
      importar_csv: false, exportar: false,
      registrar_prestamo: false, registrar_incidencia: false, ver_auditoria_inventario: false,
      // Campos inventario
      ver_campos: false, agregar_campo: false, editar_campo: false, ocultar_campo: false,
      eliminar_campo: false, reordenar_campos: false, gestionar_campos_base: false,
      gestionar_campos: false,
      // Tickets (obligatorios)
      ver_tickets: true, crear_ticket: true, editar_ticket: true, exportar_tickets: true,
      gestionar_tickets: false, eliminar_ticket: false, ver_alertas_tickets: false,
      // Requerimientos
      ver_requerimientos: false, crear_requerimiento: false, editar_requerimiento: false,
      eliminar_requerimiento: false, importar_requerimientos: false,
      exportar_requerimientos: false, ver_auditoria_requerimientos: false,
      // Ausencias (obligatorios)
      ver_propias_ausencias: true, exportar_ausencias: true,
      ver_ausencias: false, crear_ausencias: false, editar_ausencias: false,
      eliminar_ausencias: false, aprobar_ausencias: false, ver_auditoria_permisos: false,
      // Compensatorios
      ver_compensatorios: false, crear_compensatorios: false, editar_compensatorios: false,
      eliminar_compensatorios: false, exportar_compensatorios: false, ver_auditoria_compensatorios: false,
      // Ajustes y usuarios
      ver_ajustes: false, gestionar_ajustes: false, guardar_cambios_ajustes: false,
      gestionar_usuarios: false, invitar_usuario: false, editar_usuario: false,
      eliminar_usuario: false, notificar_ausencia_correo: false,
      editar_roles_permisos: false, gestionar_roles: false, ver_historial_usuarios: false,
      // Reglamentos (obligatorios)
      ver_reglamentos: true, descargar_reglamentos: true,
      crear_reglamentos: false, editar_reglamentos: false, eliminar_reglamentos: false,
      gestionar_versiones_reglamentos: false, administrar_reglamentos: false, ver_auditoria_reglamentos: false,
      // Personal
      ver_contrataciones: false, crear_contrataciones: false, editar_contrataciones: false, eliminar_contrataciones: false,
      ver_reemplazos: false, crear_reemplazos: false, editar_reemplazos: false, eliminar_reemplazos: false,
      ver_documentos_personal: false, subir_documentos_personal: false, eliminar_documentos_personal: false,
      ver_auditoria_personal: false,
      // Papelera
      ver_papelera: false, restaurar_registros: false, eliminar_permanentemente: false, ver_auditoria_papelera: false,
      // Backups
      ver_backups: false, crear_backups: false, descargar_backups: false, renombrar_backups: false,
      editar_descripcion_backups: false, duplicar_backups: false, restaurar_backups: false,
      eliminar_backups: false, ver_actividad_backups: false,
    }

    // Permisos del rol docente desde la fuente viva `permisos_rol` (editable en
    // el Mantenedor de Roles). Si no hay fila, se usa la copia estática de
    // respaldo. El auto-registro siempre asigna rol 'docente' por seguridad.
    let permisosFinal = permisosDocente
    const { data: rolDocente } = await admin
      .from('permisos_rol').select('permisos').eq('rol', 'docente').maybeSingle()
    if (rolDocente?.permisos && Object.keys(rolDocente.permisos).length > 0) {
      permisosFinal = { ...permisosDocente, ...rolDocente.permisos }
    }

    const { error: permisosError } = await admin.from('permisos_usuario').upsert({
      usuario_id: userId,
      permisos: permisosFinal,
      categorias: ['todos'],
    }, { onConflict: 'usuario_id' })

    if (permisosError) {
      // El trigger de BD debería haber creado los permisos; registrar para diagnóstico
      console.error('permisos_usuario upsert error:', permisosError.message, permisosError.details ?? '')
      // Intentar insert directo como fallback
      const { error: insertError } = await admin.from('permisos_usuario').insert({
        usuario_id: userId,
        permisos: permisosFinal,
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
