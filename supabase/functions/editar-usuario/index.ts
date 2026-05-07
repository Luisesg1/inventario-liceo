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
    // 1. Verificar token del admin
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

    // 4. Cliente admin
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 5. Manejo especial cuando se cambia la contraseña
    if (updates.password) {
      // Obtener email del usuario objetivo
      const { data: targetUserData } = await supabaseAdmin.auth.admin.getUserById(userId);
      const targetEmail = targetUserData?.user?.email;

      if (targetEmail) {
        // Cliente sin sesión activa para operaciones de auth del usuario objetivo
        const supabasePublic = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { auth: { autoRefreshToken: false, persistSession: false } }
        );

        // Verificar que la nueva contraseña no sea igual a la actual
        console.log("[editar-usuario] verificando si la contraseña es igual...");
        const { data: samePassData, error: samePassError } = await supabasePublic.auth.signInWithPassword({
          email: targetEmail,
          password: updates.password,
        });
        console.log("[editar-usuario] signIn para mismo-pass:", { ok: !samePassError, error: samePassError?.message });
        if (!samePassError && samePassData?.session) {
          await supabaseAdmin.auth.admin.signOut(samePassData.session.access_token, "local");
          return json({ error: "La nueva contraseña es igual a la actual." }, 400);
        }

        // Actualizar contraseña
        console.log("[editar-usuario] actualizando contraseña en Auth...");
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, updates);
        if (updateError) {
          console.log("[editar-usuario] error al actualizar:", updateError.message);
          return json({ error: updateError.message }, 400);
        }
        console.log("[editar-usuario] contraseña actualizada OK");

        // Iniciar sesión con la nueva contraseña para obtener un JWT válido
        console.log("[editar-usuario] haciendo signIn con nueva contraseña para obtener JWT...");
        const { data: loginData, error: loginError } = await supabasePublic.auth.signInWithPassword({
          email: targetEmail,
          password: updates.password,
        });
        console.log("[editar-usuario] signIn post-cambio:", {
          ok: !loginError,
          tieneSession: !!loginData?.session,
          error: loginError?.message,
        });

        if (loginData?.session) {
          const logoutUrl = `${Deno.env.get("SUPABASE_URL")}/auth/v1/logout?scope=global`;
          console.log("[editar-usuario] llamando POST logout:", logoutUrl);
          const logoutRes = await fetch(logoutUrl, {
            method: "POST",
            headers: {
              "apikey": Deno.env.get("SUPABASE_ANON_KEY")!,
              "Authorization": `Bearer ${loginData.session.access_token}`,
              "Content-Type": "application/json",
            },
          });
          console.log("[editar-usuario] logout status:", logoutRes.status, await logoutRes.text());
        } else {
          console.log("[editar-usuario] no se obtuvo sesión — no se pudo cerrar sesiones");
        }

        return json({ ok: true }, 200);
      }
    }

    // 6. Actualizar email u otros cambios (sin contraseña)
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, updates);
    if (updateError) return json({ error: updateError.message }, 400);

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
