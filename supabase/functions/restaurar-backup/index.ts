import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Tablas que se incluyen en el backup de seguridad pre-restauración
const TABLAS_SEGURIDAD = [
  "configuracion", "categorias", "dias_inhabilitados",
  "bienes", "requerimientos", "tickets",
  "ausencias", "dias_compensatorios",
  "prestamos", "incidencias", "actividades",
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
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "No autorizado: falta token." }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const supabaseUser  = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // ── 1. Verificar que el llamador es administrador ─────────────────────
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) return json({ error: "Token inválido o expirado." }, 401);

    const { data: perfil } = await supabaseAdmin
      .from("usuarios").select("nombre, rol").eq("id", user.id).maybeSingle();

    if (perfil?.rol !== "admin") {
      return json({ error: "Solo administradores pueden restaurar backups." }, 403);
    }

    // ── 2. Obtener nombre del archivo desde el body ──────────────────────
    const body = await req.json().catch(() => ({}));
    const { archivo } = body as { archivo?: string };
    if (!archivo) return json({ error: "Se requiere el nombre del archivo." }, 400);

    // ── 3. Descargar backup desde Storage ────────────────────────────────
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from("backups").download(archivo);

    if (downloadError || !fileData) {
      return json({ error: `No se pudo descargar el backup: ${downloadError?.message ?? "archivo no encontrado"}` }, 400);
    }

    const backupText = await fileData.text();

    // ── 4. Parsear y validar estructura del backup ───────────────────────
    let backup: Record<string, unknown>;
    try {
      backup = JSON.parse(backupText);
    } catch {
      return json({ error: "El archivo no es un JSON válido o está dañado." }, 400);
    }

    const validaciones: [boolean, string][] = [
      [!backup.version,                             "El backup no tiene versión definida."],
      [!backup.generated_at,                        "El backup no tiene fecha de creación."],
      [!backup.tables || typeof backup.tables !== "object", "El backup no contiene datos por tabla."],
      [!String(backup.app ?? "").includes("Liceo"), "El backup no corresponde a este sistema."],
      [Object.keys(backup.tables as object).length === 0, "El backup está vacío."],
    ];
    for (const [cond, msg] of validaciones) {
      if (cond) return json({ error: `Backup inválido: ${msg}` }, 400);
    }

    const tables = backup.tables as Record<string, unknown[]>;
    const ahora  = new Date().toISOString();

    // ── 5. Crear backup de seguridad con estado actual ───────────────────
    const safetyTables: Record<string, unknown[]> = {};
    const snapshots = await Promise.allSettled(
      TABLAS_SEGURIDAD.map(t => supabaseAdmin.from(t).select("*"))
    );
    TABLAS_SEGURIDAD.forEach((tabla, i) => {
      const r = snapshots[i];
      safetyTables[tabla] = r.status === "fulfilled" ? (r.value.data ?? []) : [];
    });

    const safetyBackup = {
      version:        "1.0",
      schema_version: "2026.06",
      generated_at:   ahora,
      generated_by:   { id: user.id, nombre: perfil.nombre, rol: "admin" },
      tipo:           "seguridad_pre_restauracion",
      app:            "Sistema de Gestión Liceo JHJ",
      warning:        "Backup de seguridad generado automáticamente antes de una restauración.",
      tables:         safetyTables,
    };

    const safetyFilename = `backup_seguridad_${ahora.slice(0, 10)}_${Date.now()}.json`;
    const { error: safetyError } = await supabaseAdmin.storage
      .from("backups")
      .upload(safetyFilename, new TextEncoder().encode(JSON.stringify(safetyBackup, null, 2)), {
        contentType: "application/json",
        upsert: false,
      });

    if (safetyError) {
      return json({ error: `No se pudo crear el backup de seguridad previo: ${safetyError.message}` }, 500);
    }

    // ── 6. Ejecutar restauración vía RPC (transaccional, con service role) ─
    const { data: resultado, error: rpcError } = await supabaseAdmin.rpc(
      "restaurar_datos_backup",
      { datos: tables }
    );

    if (rpcError) {
      return json({
        ok: false,
        error: `No se completó la restauración. El sistema conserva el estado anterior gracias al backup de seguridad generado automáticamente. Error técnico: ${rpcError.message}`,
        backup_seguridad: safetyFilename,
      }, 500);
    }

    if (!resultado?.ok) {
      return json({
        ok: false,
        error: resultado?.error ?? "Error desconocido en la restauración.",
        backup_seguridad: safetyFilename,
        tablas: resultado?.tablas,
      }, 500);
    }

    // ── 7. Registrar en auditoría ────────────────────────────────────────
    try {
      await supabaseAdmin.from("audit_logs").insert({
        bien_nombre:    `Restauración desde backup: ${archivo}`,
        accion:         "crear",
        cambios: {
          operacion:         "restauracion_backup",
          archivo_restaurado: archivo,
          backup_seguridad:   safetyFilename,
          tablas:             resultado.tablas,
        },
        usuario_id:     user.id,
        usuario_nombre: perfil.nombre,
        usuario_rol:    "admin",
        modulo:         "backup",
        creado_en:      ahora,
      });
    } catch { /* ignorar si constraint rechaza */ }

    return json({
      ok:                true,
      archivo_restaurado: archivo,
      backup_seguridad:   safetyFilename,
      tablas:             resultado.tablas,
    });

  } catch (err) {
    return json({ ok: false, error: String(err) }, 500);
  }
});
