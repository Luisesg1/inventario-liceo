-- ═══════════════════════════════════════════════════════════════════════
--  MÓDULO BACKUPS — Metadatos de respaldos + auditoría
--  Ejecutar en Supabase Dashboard → SQL Editor (aplicación manual).
-- ---------------------------------------------------------------------------
--  El bucket privado `backups` y las edge functions `backup-mensual` /
--  `restaurar-backup` ya existen (ver 20260618000001_backup_storage.sql).
--  Storage NO permite guardar nombre personalizado ni descripción por archivo;
--  esta tabla es una CAPA DE METADATOS que se superpone a los objetos del
--  bucket usando el nombre de archivo como clave.
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Extender el CHECK de accion en audit_logs ─────────────────────────
--  El módulo registra acciones propias (renombrar, duplicar, descargar…).
--  Se recrea el constraint con la UNIÓN de todos los valores usados en la app.
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_accion_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_accion_check CHECK (
  accion IN (
    'crear', 'editar', 'eliminar', 'baja',
    'enviado_a_papelera', 'restaurado',
    'eliminado_permanente_manual', 'eliminado_permanente_auto',
    'descargar', 'nueva_version',
    'renombrar', 'duplicar'
  )
);

-- ── 2. Tabla de metadatos de backups ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.backups_meta (
  archivo              TEXT PRIMARY KEY,               -- nombre del objeto en el bucket
  nombre_personalizado TEXT,                           -- alias editable del respaldo
  descripcion          TEXT,
  tipo                 TEXT NOT NULL DEFAULT 'completo' -- completo | base_datos | archivos
                         CHECK (tipo IN ('completo', 'base_datos', 'archivos')),
  estado               TEXT NOT NULL DEFAULT 'correcto' -- correcto | en_proceso | error
                         CHECK (estado IN ('correcto', 'en_proceso', 'error')),
  observaciones        TEXT,
  created_by           UUID,
  created_by_nombre    TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_backups_meta_created_at ON public.backups_meta (created_at DESC);

-- ── 3. RLS: solo administradores ─────────────────────────────────────────
ALTER TABLE public.backups_meta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "backups_meta_admin_all" ON public.backups_meta;
CREATE POLICY "backups_meta_admin_all"
  ON public.backups_meta FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND rol = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND rol = 'admin')
  );

-- ── 4. Preferencia de automatización (interfaz preparada) ────────────────
--  Se guarda en la tabla `configuracion` (clave/valor) para no crear tablas
--  extra. Valores admitidos: 'desactivado' | 'diario' | 'semanal' | 'mensual'.
INSERT INTO public.configuracion (clave, valor)
SELECT 'backup_auto_frecuencia', 'mensual'
WHERE NOT EXISTS (
  SELECT 1 FROM public.configuracion WHERE clave = 'backup_auto_frecuencia'
);
