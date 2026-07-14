// supabase/functions/crear-usuario/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") ?? "contacto.liceobjhj@gmail.com";

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? 'https://sistema.liceojhj.cl,https://liceojhj.cl,https://inventario-liceo.vercel.app')
  .split(',').map((s: string) => s.trim()).filter(Boolean)

const corsHeaders = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Vary': 'Origin',
});

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin")
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }

  const h = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } });

  try {
    // 1. Verificar token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return h({ error: "No autorizado: falta token." }, 401);
    }
    const accessToken = authHeader.replace("Bearer ", "");

    // 2. Verificar sesión
    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    );

    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser();
    if (authError || !user) return h({ error: "Sesión inválida o expirada." }, 401);

    // 3. Verificar que es admin
    const { data: solicitante, error: rolError } = await supabaseAnon
      .from("usuarios").select("rol").eq("id", user.id).single();

    if (rolError || !solicitante) return h({ error: "No se pudo verificar el rol." }, 403);
    if (solicitante.rol !== "admin") return h({ error: "Solo los administradores pueden crear usuarios." }, 403);

    // 4. Validar body
    const body = await req.json();
    const { nombre, rut, email, rol, passwordOverride, skipEmail } = body as { nombre?: string; rut?: string; email?: string; rol?: string; passwordOverride?: string; skipEmail?: boolean };

    if (!nombre?.trim()) return h({ error: "El campo 'nombre' es requerido." }, 400);
    if (!email?.trim())  return h({ error: "El campo 'email' es requerido." }, 400);

    // Roles base/legacy conocidos + cualquier rol personalizado existente en
    // `permisos_rol` (creado desde el Mantenedor de Roles). Así un usuario puede
    // crearse con un rol nuevo sin que se degrade silenciosamente a "docente".
    const rolesBaseValidos = ["admin", "directivo", "coordinador", "docente", "asistente", "administrativo", "encargado_inventario", "encargado_soporte", "encargado_permisos", "editor", "encargado", "soporte", "visor_requerimientos"];
    let rolFinal = "docente";
    if (rol && rolesBaseValidos.includes(rol)) {
      rolFinal = rol;
    } else if (rol) {
      const { data: rolPersonalizado } = await supabaseAnon
        .from("permisos_rol").select("rol").eq("rol", rol).maybeSingle();
      if (rolPersonalizado) rolFinal = rol;
    }

    // 5. Validar RUT único (si se proporciona)
    if (rut?.trim()) {
      const rutLimpio = rut.trim();
      const { data: rutExistente } = await supabaseAnon
        .from("usuarios").select("id, nombre").eq("rut", rutLimpio).maybeSingle();
      if (rutExistente) {
        return h({ error: `Ya existe un usuario con el RUT ${rutLimpio} (${rutExistente.nombre}). No se permiten RUT duplicados.` }, 409);
      }
    }

    // 6. Cliente admin
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 7. Crear usuario con contraseña temporal (o la provista por el llamador)
    const passwordTemporal = passwordOverride?.trim() || generarPassword();
    console.log("Creando usuario:", email.trim());

    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password: passwordTemporal,
      email_confirm: true,
    });

    if (createError || !authData.user) {
      const msg = createError?.message ?? ""
      const traducido = msg.includes("already been registered") || msg.includes("already registered")
        ? "Ya existe un usuario con ese correo electrónico."
        : "Error al crear el usuario: " + msg
      return h({ error: traducido }, 400);
    }

    const nuevoUserId = authData.user.id;

    // 7. Insertar en tabla usuarios
    const { data: usuarioInsertado, error: insertError } = await supabaseAdmin
      .from("usuarios")
      .insert({
        id: nuevoUserId,
        nombre: nombre.trim(),
        rut: rut?.trim() || null,
        email: email.trim().toLowerCase(),
        rol: rolFinal,
        debe_cambiar_password: true,
      })
      .select().single();

    if (insertError) {
      await supabaseAdmin.auth.admin.deleteUser(nuevoUserId);
      return h({ error: `Error al registrar usuario: ${insertError.message}` }, 500);
    }

    // 8. Permisos por defecto. La tabla `permisos_rol` es la fuente viva
    //    (editable desde el Mantenedor de Roles): si el rol tiene fila allí, se
    //    usan esos permisos; si no (p. ej. admin, que no se seedea), se cae al
    //    mapa estático getPermisosDefault().
    let permisosDefault = getPermisosDefault(rolFinal);
    const { data: permRolRow } = await supabaseAnon
      .from("permisos_rol").select("permisos").eq("rol", rolFinal).maybeSingle();
    if (permRolRow?.permisos && Object.keys(permRolRow.permisos).length > 0) {
      permisosDefault = { ...permisosDefault, ...permRolRow.permisos };
    }

    const { error: permisosError } = await supabaseAdmin.from("permisos_usuario").insert({
      usuario_id: nuevoUserId,
      permisos: permisosDefault,
      categorias: ["todos"],
    });
    if (permisosError) console.warn("Permisos no insertados:", permisosError.message);

    // 9. Enviar email (opcional — se omite si skipEmail es true)
    const siteUrl = Deno.env.get("SITE_URL") ?? "https://liceojhj.cl";
    let emailEnviado = false;
    let emailError: string | undefined;

    if (!skipEmail) {
      const brevoKey  = Deno.env.get("BREVO_API_KEY");
      const resendKey = Deno.env.get("RESEND_API_KEY");

      if (brevoKey) {
        const result = await enviarEmailBrevo({ brevoKey, para: email.trim(), nombreDestinatario: nombre.trim(), passwordTemporal, siteUrl });
        emailEnviado = result.ok;
        emailError = result.error;
      } else if (resendKey) {
        emailEnviado = await enviarEmailResend({ resendKey, para: email.trim(), nombreDestinatario: nombre.trim(), passwordTemporal, siteUrl });
      } else {
        emailEnviado = await enviarEmailSMTP({ para: email.trim(), nombreDestinatario: nombre.trim(), passwordTemporal, siteUrl });
      }
      console.log("Email enviado:", emailEnviado, "Error:", emailError);
    }

    // Solo exponer la contraseña temporal cuando el email NO llegó al usuario
    // (fallo de envío o skipEmail). Si el email fue exitoso, la contraseña no
    // tiene por qué aparecer en el response ni en los logs de Edge Functions.
    const necesitaPassword = skipEmail || !emailEnviado;

    return h({
      usuario: usuarioInsertado,
      emailEnviado,
      emailError: emailError ?? null,
      ...(necesitaPassword && { passwordTemporal }),
      mensaje: skipEmail
        ? `Usuario creado. Correo omitido — contraseña temporal: ${passwordTemporal}`
        : emailEnviado
          ? `Usuario creado y email enviado a ${email.trim()}`
          : `Usuario creado. No se pudo enviar email — contraseña temporal: ${passwordTemporal}`,
    }, 200);

  } catch (err) {
    console.error("Error inesperado:", String(err));
    return h({ error: "Error interno del servidor." }, 500);
  }
});

// ── Email via Brevo API ──────────────────────────────────────────────────────
async function enviarEmailBrevo({
  brevoKey, para, nombreDestinatario, passwordTemporal, siteUrl
}: { brevoKey: string; para: string; nombreDestinatario: string; passwordTemporal: string; siteUrl: string }): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoKey,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "Sistema de Gestión Liceo JHJ", email: ADMIN_EMAIL },
        to: [{ email: para, name: nombreDestinatario }],
        subject: "Tu acceso al Sistema de Gestión Liceo JHJ",
        htmlContent: emailHtml({ nombreDestinatario, para, passwordTemporal, siteUrl }),
      }),
    });
    const data = await res.json();
    console.log("Brevo response:", JSON.stringify(data));
    if (res.ok) return { ok: true };
    return { ok: false, error: JSON.stringify(data) };
  } catch (err) {
    console.error("Error Brevo:", String(err));
    return { ok: false, error: String(err) };
  }
}

// ── Email via Resend API ─────────────────────────────────────────────────────
async function enviarEmailResend({
  resendKey, para, nombreDestinatario, passwordTemporal, siteUrl
}: { resendKey: string; para: string; nombreDestinatario: string; passwordTemporal: string; siteUrl: string }): Promise<boolean> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Sistema de Gestión Liceo JHJ <onboarding@resend.dev>",
        to: [para],
        subject: "Tu acceso al Sistema de Gestión Liceo JHJ",
        html: emailHtml({ nombreDestinatario, para, passwordTemporal, siteUrl }),
      }),
    });
    const data = await res.json();
    console.log("Resend response:", JSON.stringify(data));
    return res.ok;
  } catch (err) {
    console.error("Error Resend:", String(err));
    return false;
  }
}

// ── Email via SMTP (usando fetch a Gmail API con Basic Auth base64) ───────────
async function enviarEmailSMTP({
  para, nombreDestinatario, passwordTemporal, siteUrl
}: { para: string; nombreDestinatario: string; passwordTemporal: string; siteUrl: string }): Promise<boolean> {
  try {
    const smtpUser = Deno.env.get("SMTP_USER")!;
    const smtpPass = Deno.env.get("SMTP_PASS")!;

    // Construir email en formato RFC 2822
    const emailContent = [
      `From: Sistema de Gestión Liceo JHJ <${smtpUser}>`,
      `To: ${para}`,
      `Subject: Tu acceso al Sistema de Inventario Liceo`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=UTF-8`,
      ``,
      emailHtml({ nombreDestinatario, para, passwordTemporal, siteUrl }),
    ].join("\r\n");

    // Codificar en base64url para Gmail API
    const encoded = btoa(unescape(encodeURIComponent(emailContent)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    // Obtener token OAuth2 usando Client Credentials con App Password
    // Gmail API requiere OAuth — con App Password usamos SMTP directamente
    // Como fallback, intentamos con el relay smtp2go si está configurado
    const smtp2goKey = Deno.env.get("SMTP2GO_KEY");
    if (smtp2goKey) {
      const res = await fetch("https://api.smtp2go.com/v3/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: smtp2goKey,
          to: [para],
          sender: `Sistema de Gestión Liceo JHJ <${smtpUser}>`,
          subject: "Tu acceso al Sistema de Gestión Liceo JHJ",
          html_body: emailHtml({ nombreDestinatario, para, passwordTemporal, siteUrl }),
        }),
      });
      const data = await res.json();
      console.log("SMTP2GO response:", JSON.stringify(data));
      return res.ok;
    }

    console.warn("No hay RESEND_API_KEY ni SMTP2GO_KEY configurados");
    return false;

  } catch (err) {
    console.error("Error SMTP:", String(err));
    return false;
  }
}

// ── HTML del email ────────────────────────────────────────────────────────────
function emailHtml({ nombreDestinatario, para, passwordTemporal, siteUrl }: {
  nombreDestinatario: string; para: string; passwordTemporal: string; siteUrl: string;
}): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family:'Segoe UI',Arial,sans-serif;background:#f3f4f6;margin:0;padding:24px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);border:1px solid #e5e7eb;">
    <div style="background:#1e40af;padding:28px 32px;text-align:center;">
      <div style="font-size:32px;margin-bottom:8px;">🏫</div>
      <h1 style="color:#fff;margin:0;font-size:18px;font-weight:700;">Sistema de Gestión Liceo JHJ</h1>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 16px;font-size:15px;color:#111827;">Hola <strong>${nombreDestinatario}</strong>,</p>
      <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
        El administrador te ha creado una cuenta en el Sistema de Gestión Liceo JHJ. Usa estas credenciales para ingresar:
      </p>
      <div style="background:#f8faff;border:1px solid #bfdbfe;border-radius:10px;padding:20px;margin-bottom:24px;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;">Correo</p>
        <p style="margin:0 0 16px;font-size:15px;color:#1e40af;font-weight:600;">${para}</p>
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;">Contraseña temporal</p>
        <p style="margin:0;font-size:24px;font-weight:800;color:#111827;font-family:'Courier New',monospace;background:#fff;border:1.5px dashed #93c5fd;border-radius:6px;padding:8px 14px;display:inline-block;letter-spacing:0.05em;">${passwordTemporal}</p>
      </div>
      <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:12px 16px;margin-bottom:24px;">
        <p style="margin:0;font-size:13px;color:#92400e;">⚠️ <strong>Importante:</strong> Al ingresar por primera vez deberás crear tu propia contraseña.</p>
      </div>
      <div style="text-align:center;margin-bottom:24px;">
        <a href="${siteUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:15px;font-weight:600;">Ir al sistema →</a>
      </div>
      <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">Si tienes problemas para ingresar, contacta al administrador.</p>
    </div>
  </div>
</body>
</html>`;
}

// ── Generar contraseña temporal legible ──────────────────────────────────────
function generarPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const nums  = "23456789";
  const rand  = (chars: string) => chars[Math.floor(Math.random() * chars.length)];
  return `${Array.from({length:3},()=>rand(upper)).join('')}-${Array.from({length:3},()=>rand(nums)).join('')}-${Array.from({length:3},()=>rand(lower)).join('')}`;
}

// ── Permisos por defecto (fallback cuando permisos_rol no tiene fila para el rol)
// La fuente viva es la tabla `permisos_rol` (leída en el paso 8 del flujo principal).
// Este objeto solo actúa cuando esa tabla no tiene entrada para el rol dado.
// Mantiene TODAS las claves conocidas para que el merge posterior sea completo.
function getPermisosDefault(rol: string): Record<string, boolean> {
  const vacio: Record<string, boolean> = {
    // Inventario
    ver_inventario: false, agregar_bien: false, editar_bien: false,
    eliminar_bien: false, eliminar_lote: false, gestionar_categorias: false,
    importar_csv: false, exportar: false,
    registrar_prestamo: false, registrar_incidencia: false, ver_auditoria_inventario: false,
    // Campos inventario
    ver_campos: false, agregar_campo: false, editar_campo: false, ocultar_campo: false,
    eliminar_campo: false, reordenar_campos: false, gestionar_campos_base: false,
    gestionar_campos: false, // legacy
    // Tickets
    ver_tickets: false, crear_ticket: false, editar_ticket: false,
    gestionar_tickets: false, eliminar_ticket: false,
    ver_alertas_tickets: false, exportar_tickets: false,
    // Requerimientos
    ver_requerimientos: false, crear_requerimiento: false, editar_requerimiento: false,
    eliminar_requerimiento: false, importar_requerimientos: false,
    exportar_requerimientos: false, ver_auditoria_requerimientos: false,
    // Ausencias
    ver_propias_ausencias: false, ver_ausencias: false, crear_ausencias: false,
    editar_ausencias: false, eliminar_ausencias: false, aprobar_ausencias: false,
    exportar_ausencias: false, ver_auditoria_permisos: false,
    // Compensatorios
    ver_compensatorios: false, crear_compensatorios: false, editar_compensatorios: false,
    eliminar_compensatorios: false, exportar_compensatorios: false, ver_auditoria_compensatorios: false,
    // Ajustes y usuarios
    ver_ajustes: false, gestionar_ajustes: false, guardar_cambios_ajustes: false,
    gestionar_usuarios: false, invitar_usuario: false, editar_usuario: false,
    eliminar_usuario: false, notificar_ausencia_correo: false,
    editar_roles_permisos: false, gestionar_roles: false, ver_historial_usuarios: false,
    // Reglamentos
    ver_reglamentos: false, crear_reglamentos: false, editar_reglamentos: false,
    eliminar_reglamentos: false, descargar_reglamentos: false,
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
  };

  // Permisos obligatorios presentes en todos los roles (Mis Ausencias, Tickets, Reglamentos)
  const obligatorios = {
    ver_propias_ausencias: true, exportar_ausencias: true,
    ver_tickets: true, crear_ticket: true, editar_ticket: true, exportar_tickets: true,
    ver_reglamentos: true, descargar_reglamentos: true,
  };

  if (rol === "admin") return Object.fromEntries(Object.keys(vacio).map(k => [k, true]));

  const staffBase = { ...vacio, ...obligatorios };

  switch (rol) {
    case "directivo":
      return {
        ...vacio, ...obligatorios,
        ver_inventario: true, agregar_bien: true, editar_bien: true,
        importar_csv: true, exportar: true,
        registrar_prestamo: true, registrar_incidencia: true, ver_auditoria_inventario: true,
      };
    case "coordinador":
    case "docente":
    case "asistente":
    case "administrativo":
      return { ...staffBase };
    case "soporte":
      return {
        ...staffBase,
        gestionar_tickets: true, eliminar_ticket: true, ver_alertas_tickets: true,
      };
    case "encargado_inventario":
      return {
        ...vacio, ...obligatorios,
        ver_inventario: true, agregar_bien: true, editar_bien: true,
        exportar: true, registrar_prestamo: true, registrar_incidencia: true,
      };
    case "encargado_soporte":
      return { ...vacio, ...obligatorios, gestionar_tickets: true, ver_alertas_tickets: true };
    case "encargado_permisos":
      return { ...vacio, ...obligatorios, ver_inventario: true, gestionar_usuarios: true };
    case "visor_requerimientos":
      return { ...vacio, ver_tickets: true };
    case "editor":
      return {
        ...vacio, ...obligatorios,
        ver_inventario: true, agregar_bien: true, editar_bien: true,
        exportar: true, registrar_prestamo: true, registrar_incidencia: true,
      };
    default:
      return { ...vacio, ...obligatorios };
  }
}

