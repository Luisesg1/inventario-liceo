// supabase/functions/crear-usuario/index.ts
// Edge Function para crear usuarios desde el frontend de forma segura.
// Requiere que el solicitante esté autenticado y tenga rol 'admin'.

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

    // ── 4. Leer y validar el body ──────────────────────────────────────────
    const body = await req.json();
    const { nombre, email, password, rol } = body as {
      nombre?: string;
      email?: string;
      password?: string;
      rol?: string;
    };

    if (!nombre?.trim()) return json({ error: "El campo 'nombre' es requerido." }, 400);
    if (!email?.trim())  return json({ error: "El campo 'email' es requerido." }, 400);
    if (!password)       return json({ error: "El campo 'password' es requerido." }, 400);
    if (password.length < 6) return json({ error: "La contraseña debe tener al menos 6 caracteres." }, 400);

    const rolesValidos = ["admin", "editor", "encargado"];
    const rolFinal = rolesValidos.includes(rol ?? "") ? rol! : "encargado";

    // ── 5. Cliente admin (service_role) para crear el auth user ───────────
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: nuevoAuth, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true, // lo confirma automáticamente (sin email de verificación)
    });

    if (createError || !nuevoAuth.user) {
      // Supabase devuelve "User already registered" si el email ya existe
      const msg = createError?.message ?? "Error desconocido al crear el usuario en Auth.";
      return json({ error: msg }, 400);
    }

    // ── 6. Insertar en la tabla pública 'usuarios' ─────────────────────────
    const { data: usuarioInsertado, error: insertError } = await supabaseAdmin
      .from("usuarios")
      .insert({
        id:     nuevoAuth.user.id,
        nombre: nombre.trim(),
        email:  email.trim().toLowerCase(),
        rol:    rolFinal,
      })
      .select()
      .single();

    if (insertError) {
      // Si falló el insert, intentamos limpiar el usuario de Auth para no dejar huérfanos
      await supabaseAdmin.auth.admin.deleteUser(nuevoAuth.user.id);
      return json({ error: `Usuario creado en Auth pero falló el registro en la tabla: ${insertError.message}` }, 500);
    }

    // ── 7. Respuesta exitosa ───────────────────────────────────────────────
    return json({ usuario: usuarioInsertado }, 200);

  } catch (err) {
    console.error("Error inesperado en crear-usuario:", err);
    return json({ error: "Error interno del servidor." }, 500);
  }
});

// ── Helper ──────────────────────────────────────────────────────────────────
function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}