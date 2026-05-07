// supabase/functions/editar-usuario/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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
    if (solicitante.rol !== "admin") return json({ error: "Solo los administradores pueden editar usuarios." }, 403);

    // 3. Validar body
    const body = await req.json();
    const { userId, email, password } = body as {
      userId?: string;
      email?: string;
      password?: string;
    };

    if (!userId) return json({ error: "El campo 'userId' es requerido." }, 400);

    const updates: { email?: string; password?: string } = {};
    if (email?.trim())    updates.email    = email.trim();
    if (password?.trim()) updates.password = password.trim();

    if (Object.keys(updates).length === 0) {
      return json({ ok: true, mensaje: "Nada que actualizar en Auth." }, 200);
    }

    // 4. Cliente admin para actualizar en Supabase Auth
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      updates
    );

    if (updateError) {
      return json({ error: updateError.message }, 400);
    }

    // Si se cambió la contraseña, cerrar todas las sesiones activas del usuario
    if (updates.password) {
      await fetch(
        `${Deno.env.get("SUPABASE_URL")}/auth/v1/admin/users/${userId}/logout`,
        {
          method: "POST",
          headers: {
            "apikey": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ scope: "global" }),
        }
      );
    }

    return json({ ok: true }, 200);

  } catch (err) {
    console.error("Error inesperado:", String(err));
    return json({ error: "Error interno del servidor." }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
