-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN 20260713000002 — Agregar permisos Hoja de Vida a permisos_rol
-- ──────────────────────────────────────────────────────────────────────────────
-- Agrega las claves del módulo hoja_vida a todos los roles existentes
-- en la tabla permisos_rol, con valor false por defecto.
-- El admin no necesita actualización (bypass por rol).
--
-- Aplicar manualmente en el SQL Editor de Supabase.
-- ══════════════════════════════════════════════════════════════════════════════

UPDATE public.permisos_rol
SET permisos = permisos || jsonb_build_object(
  'ver_hoja_vida',      false,
  'crear_hoja_vida',    false,
  'editar_hoja_vida',   false,
  'eliminar_hoja_vida', false,
  'exportar_hoja_vida', false
)
WHERE permisos IS NOT NULL;

-- ── REVERSIÓN ─────────────────────────────────────────────────────────────────
-- UPDATE public.permisos_rol
-- SET permisos = permisos
--   - 'ver_hoja_vida'
--   - 'crear_hoja_vida'
--   - 'editar_hoja_vida'
--   - 'eliminar_hoja_vida'
--   - 'exportar_hoja_vida'
-- WHERE permisos IS NOT NULL;
