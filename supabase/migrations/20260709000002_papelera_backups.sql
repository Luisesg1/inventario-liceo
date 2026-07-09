-- ═══════════════════════════════════════════════════════════════════════
--  REQUERIMIENTO N°8 — Papelera de Backups (soft-delete)
--  Ejecutar en Supabase Dashboard → SQL Editor (aplicación manual).
-- ---------------------------------------------------------------------------
--  Hasta ahora, eliminar un backup borraba el objeto del bucket de forma
--  permanente e inmediata. Esta migración agrega una PAPELERA LÓGICA sobre la
--  tabla de metadatos `backups_meta`: al "eliminar" un respaldo se marca como
--  borrado (is_deleted = true) conservando el archivo en Storage; desde la
--  Papelera se puede RESTAURAR (is_deleted = false) o ELIMINAR de forma
--  PERMANENTE (recién ahí se borra el objeto del bucket + la fila de meta).
--
--  Consistente con el patrón de la Papelera general del sistema
--  (ver 20260616000001_sistema_papelera.sql): mismas columnas is_deleted /
--  deleted_at / deleted_by / deleted_by_nombre.
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Columnas de soft-delete en backups_meta ───────────────────────────
ALTER TABLE public.backups_meta
  ADD COLUMN IF NOT EXISTS is_deleted        BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by        UUID,
  ADD COLUMN IF NOT EXISTS deleted_by_nombre TEXT;

-- Índice parcial: la Papelera consulta solo los marcados como borrados y la
-- lista principal solo los activos. Un índice sobre is_deleted acelera ambos.
CREATE INDEX IF NOT EXISTS idx_backups_meta_is_deleted
  ON public.backups_meta (is_deleted);

-- ── 2. Acciones de auditoría del módulo backup ───────────────────────────
--  El envío a papelera / restauración / borrado permanente se registran en
--  audit_logs (modulo='backup'). Reutilizamos los valores ya existentes en el
--  CHECK de accion. Se recrea el constraint de forma idempotente por si algún
--  entorno no tuviera todos los valores (unión de todos los usados en la app).
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_accion_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_accion_check CHECK (
  accion IN (
    'crear', 'editar', 'eliminar', 'baja',
    'enviado_a_papelera', 'restaurado',
    'eliminado_permanente_manual', 'eliminado_permanente_auto',
    'descargar', 'nueva_version',
    'renombrar', 'duplicar',
    'eliminacion_multiple', 'vaciado_papelera'
  )
);

-- ── 3. Nota ──────────────────────────────────────────────────────────────
--  No se requieren nuevas políticas RLS: la política existente
--  "backups_meta_admin_all" (FOR ALL, solo rol admin) ya cubre el UPDATE del
--  flag is_deleted y el DELETE de la fila al borrar de forma permanente.
