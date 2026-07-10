import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? 'https://sistema.liceojhj.cl,https://liceojhj.cl')
  .split(',').map((s: string) => s.trim()).filter(Boolean)

const corsHeaders = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Vary': 'Origin',
});

const TABLAS_BACKUP = [
  "bienes", "categorias", "usuarios", "permisos_rol", "permisos_usuario",
  "prestamos", "tickets", "requerimientos", "ausencias", "dias_compensatorios",
  "audit_logs", "actividades", "configuracion", "incidencias", "dias_inhabilitados",
];

function json(data: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin")
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });

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

    return json({ ok: true, archivo: nombreArchivo, fecha, tipo: tipoCorto });

  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
