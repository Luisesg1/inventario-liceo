import { supabase } from '../supabase'

// ── Servicio de Registro público (Edge Function register-user) ───────────────
// Auto-registro con código de invitación. Sin sesión previa. Devuelven la
// promesa de supabase.functions.invoke ({ data, error }) tal cual.

// Pre-valida solo el código de invitación (sin crear la cuenta).
export const validarCodigoInvitacion = (codigo) =>
  supabase.functions.invoke('register-user', { body: { codigo } })

// Registra la cuenta completa. payload: { codigo, nombre, apellidos, rut, email, password }
export const registrarConInvitacion = (payload) =>
  supabase.functions.invoke('register-user', { body: payload })
