import { supabase } from '../supabase'

// Token de acceso fresco de la sesión actual. getSession() refresca el JWT si
// está por vencer, así que SIEMPRE hay que pedirlo al momento de usarlo —
// nunca cachearlo en un estado/context, o se sirve un token vencido.
// Centraliza el patrón `getSession()` + extracción de access_token que estaba
// repetido en cada punto que invoca una Edge Function.
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data?.session?.access_token ?? null
}

// Id del usuario de la sesión actual (o null si no hay sesión).
export async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data?.session?.user?.id ?? null
}
