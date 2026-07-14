-- Migración: permisos granulares para Hoja de Vida
-- Agrega 6 claves nuevas al módulo hoja_vida:
--   · ver_capacitaciones_hv   (default true en motor → no rompe acceso existente)
--   · ver_evaluaciones_hv     (default true en motor)
--   · ver_ausencias_hv        (default true en motor)
--   · crear_anotaciones_hv    (motor hace fallback a crear_hoja_vida si no está seteado)
--   · editar_anotaciones_hv   (motor hace fallback a editar_hoja_vida)
--   · eliminar_anotaciones_hv (motor hace fallback a eliminar_hoja_vida)
--
-- Esta migración inyecta valores iniciales en permisos_rol y permisos_usuario
-- para que el Mantenedor de Roles muestre el estado correcto desde el primer día.
-- IDEMPOTENTE: usa jsonb_build_object con || para no pisar claves ya existentes.

-- ─── permisos_rol ────────────────────────────────────────────────────────────
UPDATE permisos_rol
SET permisos = permisos || jsonb_build_object(
  -- tabs de vista: true si el rol ya tiene ver_hoja_vida
  'ver_capacitaciones_hv',   COALESCE((permisos->>'ver_hoja_vida')::boolean, false),
  'ver_evaluaciones_hv',     COALESCE((permisos->>'ver_hoja_vida')::boolean, false),
  'ver_ausencias_hv',        COALESCE((permisos->>'ver_hoja_vida')::boolean, false),
  -- anotaciones: hereda del perm general actual
  'crear_anotaciones_hv',    COALESCE((permisos->>'crear_hoja_vida')::boolean, false),
  'editar_anotaciones_hv',   COALESCE((permisos->>'editar_hoja_vida')::boolean, false),
  'eliminar_anotaciones_hv', COALESCE((permisos->>'eliminar_hoja_vida')::boolean, false)
)
WHERE permisos ? 'ver_hoja_vida'
  AND NOT (permisos ? 'ver_capacitaciones_hv');

-- ─── permisos_usuario ────────────────────────────────────────────────────────
UPDATE permisos_usuario
SET permisos = permisos || jsonb_build_object(
  'ver_capacitaciones_hv',   COALESCE((permisos->>'ver_hoja_vida')::boolean, false),
  'ver_evaluaciones_hv',     COALESCE((permisos->>'ver_hoja_vida')::boolean, false),
  'ver_ausencias_hv',        COALESCE((permisos->>'ver_hoja_vida')::boolean, false),
  'crear_anotaciones_hv',    COALESCE((permisos->>'crear_hoja_vida')::boolean, false),
  'editar_anotaciones_hv',   COALESCE((permisos->>'editar_hoja_vida')::boolean, false),
  'eliminar_anotaciones_hv', COALESCE((permisos->>'eliminar_hoja_vida')::boolean, false)
)
WHERE permisos ? 'ver_hoja_vida'
  AND NOT (permisos ? 'ver_capacitaciones_hv');
