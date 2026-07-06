-- ═══════════════════════════════════════════════════════════════════════════
-- FASE 2 DE SEGURIDAD — RLS real para Tickets y Reglamentos (hallazgo C1)
-- ---------------------------------------------------------------------------
-- Reemplaza las políticas permisivas de `tickets`, `reglamentos` y
-- `reglamentos_versiones` por políticas basadas en `tiene_permiso()`.
--
-- Incluye una CORRECCIÓN de tiene_permiso(): las claves `crear_ticket` y
-- `exportar_tickets` tienen default=true en el catálogo (src/config/permisos.js:
-- DEFAULTS_PERMISO). La versión de 20260706000003 devolvía false cuando la clave
-- no estaba en el JSONB, lo que bloquearía crear tickets a usuarios que dependen
-- del default. Aquí se redefine con ese backward-compat.
--
-- ── Modelo de propiedad de TICKETS (Tickets.jsx) ────────────────────────────
--   · Gestor (gestionar_tickets): ve/gestiona todos.
--   · No gestor: ve solo los propios (creado_por = auth.uid(), Tickets.jsx:132).
--   · Soft-delete = UPDATE is_deleted (272/301, permiso eliminar_ticket).
--   · Delete permanente = Papelera vía DELETE directo (no RPC).
--
-- ── Contadores de REGLAMENTOS ───────────────────────────────────────────────
--   Ver/descargar un documento hace UPDATE de visitas/descargas (Reglamentos.jsx
--   321/335) desde CUALQUIER lector. Por eso el UPDATE admite también
--   ver_reglamentos/descargar_reglamentos. (Mejora futura: mover los contadores
--   a un RPC SECURITY DEFINER.)
--
-- ⚠️ BUCKET 'reglamentos' ES PÚBLICO (public=true): los archivos son accesibles
--   por URL SIN autenticación. La app los sirve con getPublicUrl (Reglamentos.jsx
--   :207), por lo que NO se cambia a privado aquí (rompería las descargas). Si los
--   documentos no deben ser de acceso público, requiere un cambio coordinado:
--   bucket privado + createSignedUrl. Ver [[project_auditoria_seguridad]].
--   Mientras el bucket sea público, endurecer la política de SELECT de storage no
--   surte efecto; aquí solo se endurece la ESCRITURA (insert/delete).
--
-- Requiere: es_admin(), tiene_permiso() (20260706000003). Aplicar manualmente.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Corrección de tiene_permiso() con defaults backward-compat ──────────────
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
      -- Defaults del catálogo (DEFAULTS_PERMISO): claves asumidas activas si no
      -- están explícitamente en el JSONB.
      CASE clave
        WHEN 'crear_ticket'     THEN true
        WHEN 'exportar_tickets' THEN true
        ELSE false
      END
    );
$$;

-- ── Borrado dinámico de políticas previas (evita OR con USING(true) heredado) ─
DO $$
DECLARE
  r record;
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tickets', 'reglamentos', 'reglamentos_versiones']
  LOOP
    FOR r IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, t);
    END LOOP;
  END LOOP;
END $$;

ALTER TABLE public.tickets               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reglamentos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reglamentos_versiones ENABLE ROW LEVEL SECURITY;

-- ── tickets ─────────────────────────────────────────────────────────────────
CREATE POLICY "tickets_select" ON public.tickets
  FOR SELECT TO authenticated
  USING (
    public.tiene_permiso('gestionar_tickets')
    OR public.tiene_permiso('ver_historial_usuarios')
    OR creado_por = auth.uid()
  );
CREATE POLICY "tickets_insert" ON public.tickets
  FOR INSERT TO authenticated
  WITH CHECK (public.tiene_permiso('crear_ticket') AND creado_por = auth.uid());
CREATE POLICY "tickets_update" ON public.tickets
  FOR UPDATE TO authenticated
  USING (
    public.tiene_permiso('gestionar_tickets')
    OR public.tiene_permiso('eliminar_ticket')
    OR creado_por = auth.uid()
  )
  WITH CHECK (
    public.tiene_permiso('gestionar_tickets')
    OR public.tiene_permiso('eliminar_ticket')
    OR creado_por = auth.uid()
  );
CREATE POLICY "tickets_delete" ON public.tickets
  FOR DELETE TO authenticated
  USING (public.tiene_permiso('eliminar_permanentemente') OR public.tiene_permiso('eliminar_ticket'));

-- ── reglamentos ─────────────────────────────────────────────────────────────
CREATE POLICY "reglamentos_select" ON public.reglamentos
  FOR SELECT TO authenticated USING (public.tiene_permiso('ver_reglamentos'));
CREATE POLICY "reglamentos_insert" ON public.reglamentos
  FOR INSERT TO authenticated WITH CHECK (public.tiene_permiso('crear_reglamentos'));
-- UPDATE amplio: incluye lectores porque ver/descargar incrementan contadores.
CREATE POLICY "reglamentos_update" ON public.reglamentos
  FOR UPDATE TO authenticated
  USING (
    public.tiene_permiso('ver_reglamentos')
    OR public.tiene_permiso('editar_reglamentos')
    OR public.tiene_permiso('eliminar_reglamentos')
    OR public.tiene_permiso('descargar_reglamentos')
    OR public.tiene_permiso('gestionar_versiones_reglamentos')
    OR public.tiene_permiso('administrar_reglamentos')
  )
  WITH CHECK (
    public.tiene_permiso('ver_reglamentos')
    OR public.tiene_permiso('editar_reglamentos')
    OR public.tiene_permiso('eliminar_reglamentos')
    OR public.tiene_permiso('descargar_reglamentos')
    OR public.tiene_permiso('gestionar_versiones_reglamentos')
    OR public.tiene_permiso('administrar_reglamentos')
  );
CREATE POLICY "reglamentos_delete" ON public.reglamentos
  FOR DELETE TO authenticated
  USING (public.tiene_permiso('eliminar_permanentemente') OR public.tiene_permiso('eliminar_reglamentos'));

-- ── reglamentos_versiones ───────────────────────────────────────────────────
CREATE POLICY "reg_versiones_select" ON public.reglamentos_versiones
  FOR SELECT TO authenticated USING (public.tiene_permiso('ver_reglamentos'));
CREATE POLICY "reg_versiones_insert" ON public.reglamentos_versiones
  FOR INSERT TO authenticated
  WITH CHECK (
    public.tiene_permiso('crear_reglamentos')
    OR public.tiene_permiso('editar_reglamentos')
    OR public.tiene_permiso('gestionar_versiones_reglamentos')
    OR public.tiene_permiso('administrar_reglamentos')
  );
CREATE POLICY "reg_versiones_delete" ON public.reglamentos_versiones
  FOR DELETE TO authenticated
  USING (
    public.tiene_permiso('gestionar_versiones_reglamentos')
    OR public.tiene_permiso('administrar_reglamentos')
    OR public.tiene_permiso('eliminar_permanentemente')
  );

-- ── Storage 'reglamentos' — solo ESCRITURA (el bucket es público en lectura) ─
DROP POLICY IF EXISTS "reglamentos_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "reglamentos_storage_delete" ON storage.objects;

CREATE POLICY "reglamentos_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'reglamentos' AND (
      public.tiene_permiso('crear_reglamentos')
      OR public.tiene_permiso('editar_reglamentos')
      OR public.tiene_permiso('gestionar_versiones_reglamentos')
      OR public.tiene_permiso('administrar_reglamentos')
    )
  );
CREATE POLICY "reglamentos_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'reglamentos' AND (
      public.tiene_permiso('eliminar_reglamentos')
      OR public.tiene_permiso('gestionar_versiones_reglamentos')
      OR public.tiene_permiso('administrar_reglamentos')
      OR public.tiene_permiso('eliminar_permanentemente')
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN sugerida:
--   · Usuario normal (crear_ticket): crea ticket y ve SOLO los suyos.
--     select * from tickets → solo filas con creado_por = su id.
--   · Soporte (gestionar_tickets): ve y gestiona todos.
--   · Sin ver_reglamentos: select * from reglamentos → 0 filas.
--   · Con ver_reglamentos: el listado carga y abrir/descargar incrementa
--     contadores sin error.
--   · Admin: todo funciona sin cambios.
-- ═══════════════════════════════════════════════════════════════════════════
