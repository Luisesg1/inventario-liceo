// supabase/functions/eliminar-usuario/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? 'https://sistema.liceojhj.cl,https://liceojhj.cl')
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

  try {
    // 1. Verificar token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "No autorizado: falta token." }, 401);
    }
    const accessToken = authHeader.replace("Bearer ", "");

    // 2. Verificar sesión y rol admin
    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    );

    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser();
    if (authError || !user) return json({ error: "Sesión inválida o expirada." }, 401);

    const { data: solicitante, error: rolError } = await supabaseAnon
      .from("usuarios").select("rol").eq("id", user.id).single();

    if (rolError || !solicitante) return json({ error: "No se pudo verificar el rol." }, 403);
    if (solicitante.rol !== "admin") return json({ error: "Solo los administradores pueden eliminar usuarios." }, 403);

    // 3. Validar body
    const body = await req.json();
    const { userId } = body as { userId?: string };
    if (!userId) return json({ error: "El campo 'userId' es requerido." }, 400);

    // No permitir que el admin se elimine a sí mismo
    if (userId === user.id) return json({ error: "No puedes eliminarte a ti mismo." }, 400);

    // 4. Cliente admin para eliminar de Supabase Auth
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 5. Eliminar de Supabase Auth primero — si esto falla, no tocamos la BD
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) {
      return json({ error: deleteError.message }, 400);
    }

    // 6. Auth eliminado — limpiar permisos y desvincular ausencias.
    // La fila de usuarios NO se borra aquí: el soft_delete_usuario RPC la marca
    // is_deleted=true para que quede en la papelera con su historial.
    await supabaseAdmin.from("permisos_usuario").delete().eq("usuario_id", userId);
    await supabaseAdmin.from("ausencias").update({ usuario_id: null }).eq("usuario_id", userId);

    return json({ ok: true }, 200);

  } catch (err) {
    console.error("Error inesperado:", String(err));
    return json({ error: "Error interno del servidor." }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200, origin: string | null = null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}
