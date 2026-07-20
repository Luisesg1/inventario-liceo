import { getAccessToken } from '../utils/auth'

// ── Capa de servicios: Edge Functions ───────────────────────────────────────
// Centraliza el patrón repetido de invocar una Edge Function por POST con el
// token de sesión y parsear la respuesta. Antes estaba copiado (fetch + headers
// + res.json + manejo de !res.ok) en cada página que llama crear/editar/eliminar
// usuario. Un solo lugar = un solo contrato de error.

const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`

// Invoca la Edge Function `nombre` con `body` (POST JSON). Devuelve siempre
// { data, error, status } de forma uniforme, sin lanzar:
//   · data   = JSON de la respuesta (o null si no hubo cuerpo válido)
//   · error  = mensaje string en fallo HTTP/red, o null si todo salió bien
//   · status = código HTTP (0 si no hubo respuesta por error de red)
// El token se pide fresco en cada llamada (getSession refresca el JWT).
export async function invocarFuncion(nombre, body = undefined) {
  try {
    const token = await getAccessToken()
    const res = await fetch(`${BASE}/${nombre}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return { data, error: data?.error ?? 'Error desconocido.', status: res.status }
    return { data, error: null, status: res.status }
  } catch {
    return { data: null, error: 'No se pudo conectar.', status: 0 }
  }
}
