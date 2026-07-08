import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
const ADMIN_EMAIL   = Deno.env.get("ADMIN_EMAIL");

// Envía un correo a todos los administradores con el resultado de un backup
// automático (éxito o error). Silencioso si faltan credenciales Brevo.
async function notificarAdmins(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  ok: boolean,
  detalle: string,
) {
  try {
    if (!BREVO_API_KEY || !ADMIN_EMAIL) return;
    const { data: admins } = await supabaseAdmin
      .from("usuarios").select("email, nombre").eq("rol", "admin");
    const to = (admins ?? [])
      .filter((u: { email?: string }) => u.email)
      .map((u: { email: string; nombre?: string }) => ({ email: u.email, name: u.nombre ?? u.email }));
    if (!to.length) return;

    const color   = ok ? "#15803d" : "#b91c1c";
    const bg      = ok ? "#dcfce7" : "#fee2e2";
    const titulo  = ok ? "✅ Backup automático completado" : "⚠️ Falló el backup automático";
    const html = `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
        <div style="background:#1a237e;padding:20px 24px">
          <h2 style="color:#f0d060;margin:0;font-size:18px">🗄️ Respaldo del sistema — Liceo JHJ</h2>
        </div>
        <div style="padding:24px">
          <div style="background:${bg};border-radius:8px;padding:10px 16px;margin-bottom:18px;display:inline-block">
            <span style="font-size:14px;font-weight:700;color:${color}">${titulo}</span>
          </div>
          <p style="margin:0;font-size:14px;color:#374151;line-height:1.6">${detalle}</p>
          <p style="margin-top:22px;font-size:12px;color:#9ca3af">Ingresa al módulo <strong>Backups</strong> para ver el historial y gestionar los respaldos.</p>
        </div>
      </div>`;

    await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender:  { name: "Sistema de Gestión Liceo JHJ", email: ADMIN_EMAIL },
        to,
        subject: ok ? "✅ Backup automático del sistema" : "⚠️ Falló el backup automático",
        htmlContent: html,
      }),
    });
  } catch (e) {
    console.error("No se pudo enviar el correo de backup:", String(e));
  }
}

const TABLAS_BACKUP = [
  "bienes", "categorias", "usuarios", "permisos_rol", "permisos_usuario",
  "prestamos", "tickets", "requerimientos", "ausencias", "dias_compensatorios",
  "audit_logs", "actividades", "configuracion", "incidencias", "dias_inhabilitados",
];

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "No autorizado: falta token." }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY      = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Cliente con service role para leer todas las tablas sin restricción de RLS
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Determinar si la llamada viene del sistema (pg_cron / service role directo)
    const token = authHeader.slice(7);
    const esLlamadaSistema = token === SERVICE_ROLE;

    let usuarioNombre = "Sistema (automático mensual)";
    let usuarioId: string | null = null;
    let usuarioRol = "sistema";

    if (!esLlamadaSistema) {
      // Verificar que el usuario es administrador
      const supabaseUsuario = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authError } = await supabaseUsuario.auth.getUser();
      if (authError || !user) return json({ error: "Token inválido." }, 401);

      const { data: perfil } = await supabaseAdmin
        .from("usuarios")
        .select("nombre, rol")
        .eq("id", user.id)
        .maybeSingle();

      if (perfil?.rol !== "admin") {
        return json({ error: "Solo administradores pueden generar backups." }, 403);
      }

      usuarioNombre = perfil.nombre;
      usuarioId     = user.id;
      usuarioRol    = perfil.rol;
    }

    // Leer todas las tablas (service role bypasses RLS)
    const resultados = await Promise.allSettled(
      TABLAS_BACKUP.map((t) => supabaseAdmin.from(t).select("*"))
    );

    const tables: Record<string, unknown[]> = {};
    TABLAS_BACKUP.forEach((tabla, i) => {
      const r = resultados[i];
      tables[tabla] = r.status === "fulfilled" ? (r.value.data ?? []) : [];
    });

    const totalRegistros = Object.values(tables).reduce((acc, r) => acc + r.length, 0);

    // Construir objeto backup
    const ahora = new Date().toISOString();
    const tipo  = esLlamadaSistema ? "automatico_mensual" : "manual_almacenado";
    const backup = {
      version:        "1.0",
      schema_version: "2026.06",
      generated_at:   ahora,
      generated_by:   { id: usuarioId, nombre: usuarioNombre, rol: usuarioRol },
      tipo,
      total_registros: totalRegistros,
      tablas_incluidas: TABLAS_BACKUP,
      app:     "Sistema de Gestión Liceo JHJ",
      warning: "Este archivo contiene información sensible del sistema. Guárdelo en un lugar seguro.",
      tables,
    };

    const jsonStr = JSON.stringify(backup, null, 2);
    const fecha         = ahora.slice(0, 10);
    const tipoCorto     = esLlamadaSistema ? "auto" : "manual";
    const nombreArchivo = `backup_${tipoCorto}_${fecha}_${Date.now()}.json`;

    // Subir a Supabase Storage (bucket "backups")
    const { error: uploadError } = await supabaseAdmin.storage
      .from("backups")
      .upload(nombreArchivo, new TextEncoder().encode(jsonStr), {
        contentType: "application/json",
        upsert: false,
      });

    if (uploadError) {
      if (esLlamadaSistema) {
        await notificarAdmins(supabaseAdmin, false,
          `No se pudo guardar el respaldo automático en el almacenamiento.<br><br><strong>Detalle técnico:</strong> ${uploadError.message}`);
      }
      return json({ error: `Error al guardar en Storage: ${uploadError.message}` }, 500);
    }

    // Registrar en audit_logs
    try {
      await supabaseAdmin.from("audit_logs").insert({
        bien_nombre:    `Backup ${tipo === "automatico_mensual" ? "automático mensual" : "manual almacenado"}`,
        accion:         "crear",
        cambios:        { tipo_backup: tipoCorto, archivo: nombreArchivo, tablas: TABLAS_BACKUP, total_registros: totalRegistros },
        usuario_id:     usuarioId,
        usuario_nombre: usuarioNombre,
        usuario_rol:    usuarioRol,
        modulo:         "backup",
        creado_en:      ahora,
      });
    } catch { /* ignorar si constraint rechaza */ }

    // Avisar por correo solo en respaldos automáticos (los manuales se ven en la UI)
    if (esLlamadaSistema) {
      await notificarAdmins(supabaseAdmin, true,
        `Se generó correctamente el respaldo automático <strong>${nombreArchivo}</strong> con <strong>${totalRegistros.toLocaleString("es-CL")} registros</strong> de ${TABLAS_BACKUP.length} tablas.`);
    }

    return json({ ok: true, archivo: nombreArchivo, fecha, tipo: tipoCorto });

  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
