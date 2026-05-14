// supabase/functions/crear-usuario/index.ts
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

    // 2. Verificar sesión
    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    );

    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser();
    if (authError || !user) return json({ error: "Sesión inválida o expirada." }, 401);

    // 3. Verificar que es admin
    const { data: solicitante, error: rolError } = await supabaseAnon
      .from("usuarios").select("rol").eq("id", user.id).single();

    if (rolError || !solicitante) return json({ error: "No se pudo verificar el rol." }, 403);
    if (solicitante.rol !== "admin") return json({ error: "Solo los administradores pueden crear usuarios." }, 403);

    // 4. Validar body
    const body = await req.json();
    const { nombre, email, rol } = body as { nombre?: string; email?: string; rol?: string };

    if (!nombre?.trim()) return json({ error: "El campo 'nombre' es requerido." }, 400);
    if (!email?.trim())  return json({ error: "El campo 'email' es requerido." }, 400);

    const rolesValidos = ["admin", "editor", "encargado"];
    const rolFinal = rolesValidos.includes(rol ?? "") ? rol! : "encargado";

    // 5. Cliente admin
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 6. Crear usuario con contraseña temporal
    const passwordTemporal = generarPassword();
    console.log("Creando usuario:", email.trim());

    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password: passwordTemporal,
      email_confirm: true,
    });

    if (createError || !authData.user) {
      return json({ error: createError?.message ?? "Error al crear el usuario." }, 400);
    }

    const nuevoUserId = authData.user.id;

    // 7. Insertar en tabla usuarios
    const { data: usuarioInsertado, error: insertError } = await supabaseAdmin
      .from("usuarios")
      .insert({
        id: nuevoUserId,
        nombre: nombre.trim(),
        email: email.trim().toLowerCase(),
        rol: rolFinal,
        debe_cambiar_password: true,
      })
      .select().single();

    if (insertError) {
      await supabaseAdmin.auth.admin.deleteUser(nuevoUserId);
      return json({ error: `Error al registrar usuario: ${insertError.message}` }, 500);
    }

    // 8. Permisos por defecto
    const { error: permisosError } = await supabaseAdmin.from("permisos_usuario").insert({
      usuario_id: nuevoUserId,
      permisos: getPermisosDefault(rolFinal),
      categorias: ["todos"],
    });
    if (permisosError) console.warn("Permisos no insertados:", permisosError.message);

    // 9. Enviar email via Brevo
    const siteUrl = Deno.env.get("SITE_URL") ?? "https://inventario-liceo.vercel.app";
    const brevoKey = Deno.env.get("BREVO_API_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");
    let emailEnviado = false;
    let emailError: string | undefined;

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

    return json({
      usuario: usuarioInsertado,
      emailEnviado,
      emailError: emailError ?? null,
      passwordTemporal, // siempre incluida por si falla el email
      mensaje: emailEnviado
        ? `Usuario creado y email enviado a ${email.trim()}`
        : `Usuario creado. No se pudo enviar email — contraseña temporal: ${passwordTemporal}`,
    }, 200);

  } catch (err) {
    console.error("Error inesperado:", String(err));
    return json({ error: "Error interno del servidor." }, 500);
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
        sender: { name: "Liceo JHJ", email: "luiseduardosotoguti@gmail.com" },
        to: [{ email: para, name: nombreDestinatario }],
        subject: "Tu acceso al Sistema de Inventario Liceo",
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
        from: "Inventario Liceo <onboarding@resend.dev>",
        to: [para],
        subject: "Tu acceso al Sistema de Inventario Liceo",
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
      `From: Inventario Liceo <${smtpUser}>`,
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
          sender: `Inventario Liceo <${smtpUser}>`,
          subject: "Tu acceso al Sistema de Inventario Liceo",
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
      <h1 style="color:#fff;margin:0;font-size:18px;font-weight:700;">Sistema de Inventario</h1>
      <p style="color:#bfdbfe;margin:4px 0 0;font-size:13px;">Liceo JHJ</p>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 16px;font-size:15px;color:#111827;">Hola <strong>${nombreDestinatario}</strong>,</p>
      <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
        El administrador te ha creado una cuenta en el Sistema de Inventario Escolar. Usa estas credenciales para ingresar:
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

// ── Permisos por defecto ──────────────────────────────────────────────────────
function getPermisosDefault(rol: string): Record<string, boolean> {
  const base = {
    ver_inventario: false, agregar_bien: false, editar_bien: false,
    eliminar_bien: false, eliminar_lote: false, gestionar_categorias: false,
    importar_csv: false, gestionar_usuarios: false, exportar: false,
    registrar_prestamo: false, registrar_incidencia: false,
  };
  switch (rol) {
    case "admin":  return Object.fromEntries(Object.keys(base).map(k => [k, true]));
    case "editor": return { ...base, ver_inventario: true, agregar_bien: true, editar_bien: true, exportar: true, registrar_prestamo: true, registrar_incidencia: true };
    default:       return { ...base, ver_inventario: true, exportar: true };
  }
}

// ── Helper JSON ───────────────────────────────────────────────────────────────
function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}