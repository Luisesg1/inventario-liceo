import { supabase } from '../supabase'

// ── Servicio de Backups (Edge Functions con service_role) ────────────────────
// Operaciones de respaldo que corren en el servidor (admin-only por RLS + rol).
// Devuelven la promesa de supabase.functions.invoke ({ data, error }) tal cual.

// Genera el respaldo mensual completo del sistema.
export const generarBackupMensual = () =>
  supabase.functions.invoke('backup-mensual')

// Restaura el sistema al estado de un respaldo dado (nombre de archivo).
export const restaurarBackup = (archivo: string) =>
  supabase.functions.invoke('restaurar-backup', { body: { archivo } })
