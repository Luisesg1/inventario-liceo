-- ═══════════════════════════════════════════════════════════════════════════
-- Requerimiento N°5 — Roles personalizados asignables a usuarios
-- ---------------------------------------------------------------------------
-- La columna `usuarios.rol` tenía un CHECK con una lista FIJA de roles
-- (ver 20260528000000_add_soporte_to_rol_constraint.sql), lo que impedía
-- asignar a un usuario un rol creado dinámicamente en el Mantenedor de Roles
-- (tabla `permisos_rol`): el INSERT/UPDATE violaba el constraint.
--
-- Se reemplaza el CHECK estático por una validación por TRIGGER que acepta:
--   · los roles base/legacy conocidos, y
--   · cualquier rol que exista en `permisos_rol` (los personalizados).
--
-- Aplicar manualmente en Supabase → SQL Editor (workflow del proyecto).
-- Rollback al final del archivo.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Quitar el CHECK estático de `rol` (cualquiera sea su nombre).
DO $$
DECLARE v_conname text;
BEGIN
  SELECT c.conname INTO v_conname
  FROM pg_constraint c
  JOIN pg_class t     ON c.conrelid = t.oid
  JOIN pg_namespace n ON t.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND t.relname  = 'usuarios'
    AND c.contype  = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%rol%';

  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.usuarios DROP CONSTRAINT %I', v_conname);
  END IF;
END $$;

-- 2. Función de validación: rol base/legacy conocido, o presente en permisos_rol.
CREATE OR REPLACE FUNCTION public.validar_rol_usuario()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.rol IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.rol IN (
        'admin', 'directivo', 'coordinador', 'docente', 'asistente',
        'administrativo', 'soporte', 'visor_requerimientos',
        -- legacy
        'encargado_inventario', 'encargado_soporte', 'encargado_permisos',
        'editor', 'encargado'
     )
     OR EXISTS (SELECT 1 FROM public.permisos_rol WHERE rol = NEW.rol) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Rol invalido: "%". No es un rol base ni existe en permisos_rol.', NEW.rol;
END;
$$;

-- 3. Trigger BEFORE INSERT/UPDATE del rol.
DROP TRIGGER IF EXISTS trg_validar_rol_usuario ON public.usuarios;
CREATE TRIGGER trg_validar_rol_usuario
  BEFORE INSERT OR UPDATE OF rol ON public.usuarios
  FOR EACH ROW EXECUTE FUNCTION public.validar_rol_usuario();

-- ─── Rollback (si se necesita revertir) ─────────────────────────────────────
-- DROP TRIGGER IF EXISTS trg_validar_rol_usuario ON public.usuarios;
-- DROP FUNCTION IF EXISTS public.validar_rol_usuario();
-- ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_rol_check CHECK (
--   rol IN ('admin','directivo','coordinador','docente','asistente','administrativo',
--           'soporte','encargado_inventario','encargado_soporte','encargado_permisos',
--           'editor','encargado','visor_requerimientos'));
