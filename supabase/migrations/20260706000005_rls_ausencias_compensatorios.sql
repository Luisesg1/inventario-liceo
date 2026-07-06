-- ═══════════════════════════════════════════════════════════════════════════
-- FASE 2 DE SEGURIDAD — RLS real para Ausencias y Compensatorios (hallazgo C1)
-- ---------------------------------------------------------------------------
-- Reemplaza las políticas permisivas de `ausencias`, `dias_compensatorios` y
-- `dias_inhabilitados` por políticas basadas en `tiene_permiso()`.
--
-- IMPORTANTE — combinación OR de políticas permissive:
--   Postgres combina TODAS las políticas PERMISSIVE de un mismo comando con OR.
--   Como las políticas actuales de estas tablas se crearon a mano (no están en
--   el repo), esta migración BORRA DINÁMICAMENTE todas las políticas previas de
--   cada tabla antes de crear las nuevas. Así se garantiza que ningún
--   `USING (true)` heredado siga abriendo el acceso.
--
-- ── Modelo de propiedad de AUSENCIAS (verificado en Permisos.jsx) ───────────
--   · Gestión (ver_ausencias): ve todas.  · Mis ausencias (ver_propias): ve las
--     suyas, que se identifican por usuario_id = auth.uid(), por RUT en
--     externo_rut/snapshot_rut, o por otra cuenta con el mismo RUT normalizado
--     (Permisos.jsx:2119-2156). Se replica normRut() en SQL (norm_rut).
--   · Lecturas cruzadas: Personal (reemplazos↔ausencias, 611/1488) y el
--     Historial de usuarios (count) también leen ausencias → se conceden.
--
-- ── Acoplamiento cruzado de COMPENSATORIOS (verificado) ─────────────────────
--   `dias_compensatorios` NO se muta solo desde Compensatorios.jsx: al crear o
--   borrar una ausencia de tipo 'dias_compensatorios', Permisos.jsx descuenta/
--   restaura el saldo de OTROS usuarios (descontar/restaurarCompensatorios).
--   Ese actor tiene permisos de AUSENCIAS, no de compensatorios. Por eso el
--   UPDATE admite también crear/editar/eliminar_ausencias y restaurar_registros.
--   (Mejora futura: mover descontar/restaurar a un RPC SECURITY DEFINER para
--   poder ceñir el UPDATE solo a permisos de compensatorios. Ver [[project_auditoria_seguridad]].)
--
-- Requiere: es_admin(), tiene_permiso() (20260706000003) y puede_ver_personal()
-- (20260706000004). Aplicar manualmente en el SQL Editor, en orden.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Helper: normalizar RUT igual que normRut() del frontend ─────────────────
-- JS: r.replace(/[.\-\s]/g,'').toLowerCase()
CREATE OR REPLACE FUNCTION public.norm_rut(r text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(regexp_replace(coalesce(r, ''), '[.[:space:]-]', '', 'g'));
$$;

-- ── Helper: ¿la fila de ausencia pertenece al usuario autenticado? ──────────
CREATE OR REPLACE FUNCTION public.es_ausencia_propia(
  p_usuario_id  uuid,
  p_externo_rut text,
  p_snapshot_rut text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  mi_rut text;
BEGIN
  IF p_usuario_id = auth.uid() THEN
    RETURN true;
  END IF;

  SELECT public.norm_rut(rut) INTO mi_rut FROM public.usuarios WHERE id = auth.uid();
  IF mi_rut IS NULL OR mi_rut = '' THEN
    RETURN false;
  END IF;

  IF public.norm_rut(p_externo_rut) = mi_rut THEN RETURN true; END IF;
  IF public.norm_rut(p_snapshot_rut) = mi_rut THEN RETURN true; END IF;
  IF p_usuario_id IS NOT NULL AND EXISTS (
       SELECT 1 FROM public.usuarios
       WHERE id = p_usuario_id AND public.norm_rut(rut) = mi_rut
     ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- ── Borrado dinámico de políticas previas (evita OR con USING(true) heredado) ─
DO $$
DECLARE
  r record;
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ausencias', 'dias_compensatorios', 'dias_inhabilitados']
  LOOP
    FOR r IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, t);
    END LOOP;
  END LOOP;
END $$;

ALTER TABLE public.ausencias           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dias_compensatorios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dias_inhabilitados  ENABLE ROW LEVEL SECURITY;

-- ── ausencias ───────────────────────────────────────────────────────────────
CREATE POLICY "ausencias_select" ON public.ausencias
  FOR SELECT TO authenticated
  USING (
    public.tiene_permiso('ver_ausencias')
    OR public.puede_ver_personal()
    OR public.tiene_permiso('ver_historial_usuarios')
    OR (
      public.tiene_permiso('ver_propias_ausencias')
      AND public.es_ausencia_propia(usuario_id, externo_rut, snapshot_rut)
    )
  );
CREATE POLICY "ausencias_insert" ON public.ausencias
  FOR INSERT TO authenticated
  WITH CHECK (public.tiene_permiso('crear_ausencias'));
CREATE POLICY "ausencias_update" ON public.ausencias
  FOR UPDATE TO authenticated
  USING (public.tiene_permiso('editar_ausencias') OR public.tiene_permiso('restaurar_registros'))
  WITH CHECK (public.tiene_permiso('editar_ausencias') OR public.tiene_permiso('restaurar_registros'));
-- DELETE permanente (solo desde la Papelera). El soft-delete usa el RPC
-- soft_delete_ausencia (SECURITY DEFINER) y no pasa por esta política.
CREATE POLICY "ausencias_delete" ON public.ausencias
  FOR DELETE TO authenticated
  USING (public.tiene_permiso('eliminar_permanentemente'));

-- ── dias_compensatorios ─────────────────────────────────────────────────────
CREATE POLICY "dias_comp_select" ON public.dias_compensatorios
  FOR SELECT TO authenticated
  USING (
    public.tiene_permiso('ver_compensatorios')
    OR public.tiene_permiso('crear_ausencias')
    OR public.tiene_permiso('editar_ausencias')
    OR public.tiene_permiso('eliminar_ausencias')
  );
CREATE POLICY "dias_comp_insert" ON public.dias_compensatorios
  FOR INSERT TO authenticated
  WITH CHECK (public.tiene_permiso('crear_compensatorios'));
-- UPDATE amplio por el acoplamiento cruzado (descontar/restaurar saldo desde
-- el flujo de ausencias + restauración desde Papelera + soft-delete del módulo).
CREATE POLICY "dias_comp_update" ON public.dias_compensatorios
  FOR UPDATE TO authenticated
  USING (
    public.tiene_permiso('editar_compensatorios')
    OR public.tiene_permiso('eliminar_compensatorios')
    OR public.tiene_permiso('crear_ausencias')
    OR public.tiene_permiso('editar_ausencias')
    OR public.tiene_permiso('eliminar_ausencias')
    OR public.tiene_permiso('restaurar_registros')
  )
  WITH CHECK (
    public.tiene_permiso('editar_compensatorios')
    OR public.tiene_permiso('eliminar_compensatorios')
    OR public.tiene_permiso('crear_ausencias')
    OR public.tiene_permiso('editar_ausencias')
    OR public.tiene_permiso('eliminar_ausencias')
    OR public.tiene_permiso('restaurar_registros')
  );
CREATE POLICY "dias_comp_delete" ON public.dias_compensatorios
  FOR DELETE TO authenticated
  USING (public.tiene_permiso('eliminar_permanentemente') OR public.tiene_permiso('eliminar_compensatorios'));

-- ── dias_inhabilitados (calendario compartido de días bloqueados) ───────────
-- Dato no sensible (feriados/fechas bloqueadas); lo consulta todo el módulo de
-- Ausencias y el cálculo de días hábiles de Compensatorios.
CREATE POLICY "dias_inhab_select" ON public.dias_inhabilitados
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "dias_inhab_insert" ON public.dias_inhabilitados
  FOR INSERT TO authenticated
  WITH CHECK (public.tiene_permiso('crear_ausencias') OR public.tiene_permiso('editar_ausencias'));
CREATE POLICY "dias_inhab_update" ON public.dias_inhabilitados
  FOR UPDATE TO authenticated
  USING (public.tiene_permiso('crear_ausencias') OR public.tiene_permiso('editar_ausencias'))
  WITH CHECK (public.tiene_permiso('crear_ausencias') OR public.tiene_permiso('editar_ausencias'));
CREATE POLICY "dias_inhab_delete" ON public.dias_inhabilitados
  FOR DELETE TO authenticated
  USING (public.tiene_permiso('crear_ausencias') OR public.tiene_permiso('editar_ausencias'));

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN sugerida:
--   · Docente (solo ver_propias_ausencias): "Mis ausencias" muestra las propias
--     (incluidas las registradas contra su RUT) y NINGUNA ajena.
--   · Gestor de ausencias: ve todas; puede crear/editar; al borrar una ausencia
--     de compensatorios, el saldo se restaura sin error.
--   · Usuario sin permisos: select * from ausencias → 0 filas.
--   · Admin: todo funciona sin cambios.
-- ═══════════════════════════════════════════════════════════════════════════
