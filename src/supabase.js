import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// ── Guarda de configuración ────────────────────────────────────────────────
// Las variables VITE_* se "hornean" en el bundle durante `vite build`. Si el
// build se generó sin ellas (p. ej. Vercel sin las Environment Variables, o un
// clon sin `.env`), `createClient` lanzaría "supabaseUrl is required" y la app
// quedaría en pantalla en blanco con un error críptico. Aquí lo detectamos
// antes y mostramos un mensaje claro sobre qué falta y cómo resolverlo.
if (!url || !key) {
  const faltantes = [!url && 'VITE_SUPABASE_URL', !key && 'VITE_SUPABASE_ANON_KEY'].filter(Boolean)
  const mensaje = `Falta configurar ${faltantes.join(' y ')}`
  console.error(
    `[Configuración] ${mensaje}. Estas variables deben definirse ANTES de compilar ` +
    `(vite build las incluye en el bundle). En local: archivo .env. En Vercel: ` +
    `Settings → Environment Variables + Redeploy.`
  )

  if (typeof document !== 'undefined') {
    document.body.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f1f5f9;font-family:Inter,system-ui,sans-serif;padding:20px;">
        <div style="max-width:440px;text-align:center;background:#fff;border:1px solid #e6e9f0;border-radius:20px;padding:40px 32px;box-shadow:0 8px 30px rgba(15,23,42,0.08);">
          <div style="width:60px;height:60px;border-radius:18px;margin:0 auto 18px;display:flex;align-items:center;justify-content:center;background:#fee2e2;color:#dc2626;font-size:30px;">⚠️</div>
          <h2 style="margin:0 0 8px;font-size:19px;font-weight:700;color:#0f172a;">Configuración incompleta</h2>
          <p style="margin:0 0 16px;font-size:14px;color:#64748b;line-height:1.6;">${mensaje}. La aplicación no puede conectarse a la base de datos.</p>
          <p style="margin:0;font-size:12.5px;color:#94a3b8;line-height:1.6;">Define las variables de entorno antes de compilar y vuelve a desplegar. Revisa la consola para más detalle.</p>
        </div>
      </div>`
  }

  throw new Error(mensaje)
}

// Capturar tokens del hash ANTES de que createClient los limpie
const hashParams  = new URLSearchParams(window.location.hash.slice(1))
const queryParams = new URLSearchParams(window.location.search)

// Flujo legacy (hash): type=recovery en el fragment
const esRecuperacionHash = hashParams.get('type') === 'recovery'

// Flujo PKCE (moderno): Supabase envía ?code=... sin indicar el tipo en la URL.
// Variable de módulo (en memoria): se pierde en cada recarga, eliminando el riesgo
// de que el flag persista en sessionStorage y active SetPassword en un login normal.
const codigoPKCE = queryParams.get('code')
const esRecuperacionPKCE = !!codigoPKCE

export const esRecuperacion = esRecuperacionHash || esRecuperacionPKCE

// Si es recovery por hash legacy, guardamos tokens para setSession manual
export const recoveryTokens = esRecuperacionHash
  ? {
      access_token:  hashParams.get('access_token')  ?? '',
      refresh_token: hashParams.get('refresh_token') ?? '',
    }
  : null

// Interceptor global: detecta respuestas 401 (JWT expirado/inválido) en cualquier
// llamada a Supabase y dispara un evento único. Así la app reacciona de inmediato
// —sin esperar el chequeo periódico de 30s— y puede mostrar un aviso claro.
// Solo 401 (auth): un 403 es denegación de RLS por permisos, no sesión caída.
let sesionExpiradaEmitida = false
const fetchConInterceptor = async (input, init) => {
  const res = await fetch(input, init)
  if (res.status === 401 && !sesionExpiradaEmitida) {
    sesionExpiradaEmitida = true
    window.dispatchEvent(new CustomEvent('sesion-expirada'))
  }
  return res
}

// Permite rearmar el interceptor tras un nuevo login (la sesión anterior expiró
// una vez; la nueva debe poder volver a emitir el evento si también cae).
export const resetSesionExpirada = () => { sesionExpiradaEmitida = false }

// Con PKCE, createClient detecta el ?code= automáticamente y dispara PASSWORD_RECOVERY
export const supabase = createClient(url, key, {
  global: { fetch: fetchConInterceptor },
})

// Limpiar flag de sessionStorage después de que Supabase procese el code
if (codigoPKCE) {
  setTimeout(() => sessionStorage.removeItem('supabase_pkce_recovery'), 5000)
}