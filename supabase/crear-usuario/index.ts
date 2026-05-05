// supabase/functions/crear-usuario/index.ts
// Edge Function para crear usuarios desde el frontend de forma segura.
// Requiere que el solicitante esté autenticado y tenga rol 'admin'.
// Usa inviteUserByEmail para que el usuario establezca su propia contraseña.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  // ── Preflight CORS ─────────────────────────────────────────────────────────
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── 1. Extraer JWT del header Authorization ────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return json({ error: "No autorizado: falta token." }, 401);
    }
    const accessToken = authHeader.replace("Bearer ", "");

    // ── 2. Cliente con anon key para verificar al solicitante ──────────────
    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    );

    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser();
    if (authError || !user) {
      return json({ error: "Sesión inválida o expirada." }, 401);
    }

    // ── 3. Verificar que el solicitante es admin en la tabla usuarios ───────
    const { data: solicitante, error: rolError } = await supabaseAnon
      .from("usuarios")
      .select("rol")
      .eq("id", user.id)
      .single();

    if (rolError || !solicitante) {
      return json({ error: "No se pudo verificar el rol del solicitante." }, 403);
    }
    if (solicitante.rol !== "admin") {
      return json({ error: "Acceso denegado: solo los administradores pueden crear usuarios." }, 403);
    }

    // ── 4. Leer y validar el body (sin campo password) ─────────────────────
    const body = await req.json();
    const { nombre, email, rol } = body as {
      nombre?: string;
      email?: string;
      rol?: string;
    };

    if (!nombre?.trim()) return json({ error: "El campo 'nombre' es requerido." }, 400);
    if (!email?.trim())  return json({ error: "El campo 'email' es requerido." }, 400);

    const rolesValidos = ["admin", "editor", "encargado"];
    const rolFinal = rolesValidos.includes(rol ?? "") ? rol! : "encargado";

    // ── 5. Cliente admin (service_role) ────────────────────────────────────
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ── 6. Enviar invitación por email (el usuario establece su contraseña) ─
    const siteUrl = Deno.env.get("SITE_URL") ?? "";
    const { data: inviteData, error: inviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email.trim(), {
        data: { nombre: nombre.trim(), rol: rolFinal },
        redirectTo: `${siteUrl}/set-password`,
      });

    if (inviteError || !inviteData.user) {
      const msg = inviteError?.message ?? "Error desconocido al enviar la invitación.";
      return json({ error: msg }, 400);
    }

    const nuevoUserId = inviteData.user.id;

    // ── 7. Insertar en la tabla pública 'usuarios' ─────────────────────────
    const { data: usuarioInsertado, error: insertError } = await supabaseAdmin
      .from("usuarios")
      .insert({
        id:     nuevoUserId,
        nombre: nombre.trim(),
        email:  email.trim().toLowerCase(),
        rol:    rolFinal,
      })
      .select()
      .single();

    if (insertError) {
      // Si falló el insert, limpiar el usuario de Auth para no dejar huérfanos
      await supabaseAdmin.auth.admin.deleteUser(nuevoUserId);
      return json({
        error: `Usuario invitado pero falló el registro en la tabla: ${insertError.message}`,
      }, 500);
    }

    // ── 8. Insertar permisos por defecto según rol ─────────────────────────
    const permisosDefault = getPermisosDefault(rolFinal);
    const { error: permisosError } = await supabaseAdmin
      .from("permisos_usuario")
      .insert({
        usuario_id: nuevoUserId,
        permisos:   permisosDefault,
        categorias: ["todos"],
      });

    if (permisosError) {
      // No es crítico: el usuario se creó; los permisos se pueden asignar luego
      console.warn("Advertencia: no se pudieron insertar permisos por defecto:", permisosError.message);
    }

    // ── 9. Respuesta exitosa ───────────────────────────────────────────────
    return json({
      usuario: usuarioInsertado,
      mensaje: `Invitación enviada a ${email.trim()}`,
    }, 200);

  } catch (err) {
    console.error("Error inesperado en crear-usuario:", err);
    return json({ error: "Error interno del servidor." }, 500);
  }
});

// ── Permisos por defecto según rol ──────────────────────────────────────────
function getPermisosDefault(rol: string): Record<string, boolean> {
  const base = {
    ver_inventario:       false,
    agregar_bien:         false,
    editar_bien:          false,
    eliminar_bien:        false,
    eliminar_lote:        false,
    gestionar_categorias: false,
    importar_csv:         false,
    gestionar_usuarios:   false,
    exportar:             false,
  };

  switch (rol) {
    case "admin":
      return Object.fromEntries(Object.keys(base).map((k) => [k, true]));
    case "editor":
      return { ...base, ver_inventario: true, agregar_bien: true, editar_bien: true, exportar: true };
    default: // encargado
      return { ...base, ver_inventario: true, exportar: true };
  }
}

// ── Helper JSON response ─────────────────────────────────────────────────────
function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}