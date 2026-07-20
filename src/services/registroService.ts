import { supabase } from '../supabase'

// ── Servicio de Registro público (Edge Function register-user) ───────────────
// Auto-registro con código de invitación. Sin sesión previa. Devuelven la
// promesa de supabase.functions.invoke ({ data, error }) tal cual.

export interface RegistroPayload {
  codigo: string
  nombre: string
  apellidos: string
  rut: string
  email: string
  password: string
}

// Pre-valida solo el código de invitación (sin crear la cuenta).
export const validarCodigoInvitacion = (codigo: string) =>
  supabase.functions.invoke('register-user', { body: { codigo } })

// Registra la cuenta completa.
export const registrarConInvitacion = (payload: RegistroPayload) =>
  supabase.functions.invoke('register-user', { body: payload })
