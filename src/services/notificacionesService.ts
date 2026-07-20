import { supabase } from '../supabase'

// ── Servicio de Notificaciones (Edge Functions de correo) ────────────────────
// Envía correos vía las Edge Functions notify-*. Son best-effort: el llamador
// decide si await + manejo de error o fire-and-forget con .catch(). Devuelven
// la promesa de supabase.functions.invoke tal cual para no cambiar el contrato.

export const notificarNuevoTicket = (body: Record<string, unknown>) =>
  supabase.functions.invoke('notify-new-ticket', { body })

export const notificarEstadoTicket = (body: Record<string, unknown>) =>
  supabase.functions.invoke('notify-ticket-status', { body })

export const notificarAusencia = (body: Record<string, unknown>) =>
  supabase.functions.invoke('notify-ausencia', { body })

export const notificarPermisoAdministrativo = (body: Record<string, unknown>) =>
  supabase.functions.invoke('notify-permiso-administrativo', { body })
