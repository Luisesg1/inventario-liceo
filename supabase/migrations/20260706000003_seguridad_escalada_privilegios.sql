-- ═══════════════════════════════════════════════════════════════════════════
-- FASE 1 DE SEGURIDAD — Cierre de escalada de privilegios (hallazgo C2)
-- + funciones reutilizables para reforzar RLS de dominio (hallazgo C1)
-- ---------------------------------------------------------------------------
-- Contexto (auditoría 2026-07-06):
--   · El motor de permisos vive en el frontend; la BD expone RLS permisiva.
--   · `usuarios.rol` se actualiza DIRECTO desde el cliente (Usuarios.jsx:1197),
--     por lo que un no-admin podría auto-promoverse a 'admin' vía API REST.
--
-- Esta migración NO reescribe la RLS de las tablas de dominio (eso es la Fase 2,
-- que debe validarse flujo por flujo). Aquí solo:
--   1. es_admin()      → helper server-side (¿el llamante es admin?).
--   2. tiene_permiso() → helper para las políticas RLS de la Fase 2.
--   3. Trigger BEFORE UPDATE en `usuarios` que BLOQUEA que un no-admin cambie
--      `rol` o `is_deleted`. Corte quirúrgico del vector de escalada, sin tocar
--      ninguna lectura ni los updates legítimos (nombre, rut, debe_cambiar_password).
--
-- IMPACTO / COMPATIBILIDAD (revisar antes de aplicar):
--   · Edge Functions (service_role) → auth.uid() es NULL ⇒ el trigger las deja
--     pasar (p. ej. register-user upsert rol='docente'). OK.
--   · Admin cambiando roles desde Usuarios.jsx ⇒ es_admin() = true ⇒ permitido.
--   · Usuario cambiando su propio nombre/rut/password ⇒ rol sin cambios ⇒ permitido.
--   · Un no-admin intentando `update usuarios set rol='admin'` ⇒ EXCEPTION.
--
-- REVERSIÓN: al final del archivo (comentada).
-- Aplicar manualmente en el SQL Editor de Supabase (ver [project_migraciones_manual]).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Helper: ¿el usuario autenticado es admin? ────────────────────────────
CREATE OR REPLACE FUNCTION public.es_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid() AND rol = 'admin'
  );
$$;

-- ── 2. Helper: ¿el usuario tiene una clave de permiso concreta? ─────────────
-- Reproduce la regla del motor (src/utils/permisos.js): admin siempre true;
-- si no, se lee el JSONB fusionado rol+usuario. Para RLS de la Fase 2.
CREATE OR REPLACE FUNCTION public.tiene_permiso(clave text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    public.es_admin()
    OR COALESCE(
      (SELECT (pu.permisos ->> clave)::boolean
         FROM public.permisos_usuario pu
        WHERE pu.usuario_id = auth.uid()),
      (SELECT (pr.permisos ->> clave)::boolean
         FROM public.usuarios u
         JOIN public.permisos_rol pr ON pr.rol = u.rol
        WHERE u.id = auth.uid()),
      false
    );
$$;

-- ── 3. Trigger anti-escalada en `usuarios` ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_bloquear_cambio_rol()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Llamadas de backend con service_role no tienen auth.uid() ⇒ se permiten.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Admin puede cambiar cualquier cosa.
  IF public.es_admin() THEN
    RETURN NEW;
  END IF;

  -- No-admin: no puede alterar rol ni el flag de borrado lógico.
  IF NEW.rol IS DISTINCT FROM OLD.rol THEN
    RAISE EXCEPTION 'No autorizado: solo un administrador puede cambiar el rol.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.is_deleted IS DISTINCT FROM OLD.is_deleted THEN
    RAISE EXCEPTION 'No autorizado: solo un administrador puede dar de baja usuarios.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bloquear_cambio_rol ON public.usuarios;

CREATE TRIGGER trg_bloquear_cambio_rol
  BEFORE UPDATE ON public.usuarios
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_bloquear_cambio_rol();

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN (ejecutar tras aplicar, como un usuario NO admin):
--   update usuarios set rol='admin' where id = auth.uid();
--   → debe fallar con "No autorizado: solo un administrador puede cambiar el rol."
--   update usuarios set nombre='X' where id = auth.uid();  → debe funcionar.
-- Y como admin: cambiar el rol de otro usuario → debe funcionar.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── REVERSIÓN (descomentar para deshacer) ───────────────────────────────────
-- DROP TRIGGER IF EXISTS trg_bloquear_cambio_rol ON public.usuarios;
-- DROP FUNCTION IF EXISTS public.fn_bloquear_cambio_rol();
-- DROP FUNCTION IF EXISTS public.tiene_permiso(text);
-- DROP FUNCTION IF EXISTS public.es_admin();
