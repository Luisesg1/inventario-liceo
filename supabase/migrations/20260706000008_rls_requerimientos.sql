-- ═══════════════════════════════════════════════════════════════════════════
-- FASE 2 DE SEGURIDAD — RLS real para Requerimientos (hallazgo C1)
-- ---------------------------------------------------------------------------
-- Tabla `requerimientos` (+ bucket 'requerimientos').
--
-- ── Notas de diseño (verificadas en Requerimientos.jsx) ─────────────────────
--   · NO hay propiedad por usuario: `solicitante` es texto libre (nombre), no un
--     FK. La lista se filtra solo por is_deleted (1172) → SELECT = ver_requerimientos.
--   · Papelera restaura vía UPDATE is_deleted → UPDATE admite restaurar_registros.
--   · Borrado permanente desde la Papelera (DELETE directo).
--
-- ⚠️ BUCKET 'requerimientos' ES PÚBLICO (public=true, forzado con ON CONFLICT DO
--   UPDATE) y la app usa getPublicUrl (Requerimientos.jsx:228). Las imágenes son
--   accesibles por URL sin autenticación. No se cambia a privado aquí (rompería
--   la visualización); si las imágenes son sensibles, requiere bucket privado +
--   createSignedUrl. Aquí solo se endurece la ESCRITURA. Ver [[project_auditoria_seguridad]].
--
-- Requiere: es_admin(), tiene_permiso() (20260706000003). Aplicar manualmente.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='requerimientos'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.requerimientos', r.policyname);
  END LOOP;
END $$;

ALTER TABLE public.requerimientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "requerimientos_select" ON public.requerimientos
  FOR SELECT TO authenticated USING (public.tiene_permiso('ver_requerimientos'));
CREATE POLICY "requerimientos_insert" ON public.requerimientos
  FOR INSERT TO authenticated
  WITH CHECK (public.tiene_permiso('crear_requerimiento') OR public.tiene_permiso('importar_requerimientos'));
CREATE POLICY "requerimientos_update" ON public.requerimientos
  FOR UPDATE TO authenticated
  USING (public.tiene_permiso('editar_requerimiento') OR public.tiene_permiso('restaurar_registros'))
  WITH CHECK (public.tiene_permiso('editar_requerimiento') OR public.tiene_permiso('restaurar_registros'));
CREATE POLICY "requerimientos_delete" ON public.requerimientos
  FOR DELETE TO authenticated
  USING (public.tiene_permiso('eliminar_permanentemente') OR public.tiene_permiso('eliminar_requerimiento'));

-- ── Storage 'requerimientos' — solo ESCRITURA (bucket público en lectura) ───
DROP POLICY IF EXISTS "requerimientos_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "requerimientos_storage_delete" ON storage.objects;
-- (nombres reales pueden variar; si existían otras políticas de escritura para
--  este bucket, elimínalas manualmente para evitar OR permisivo.)

CREATE POLICY "requerimientos_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'requerimientos' AND (
      public.tiene_permiso('crear_requerimiento')
      OR public.tiene_permiso('editar_requerimiento')
      OR public.tiene_permiso('importar_requerimientos')
    )
  );
CREATE POLICY "requerimientos_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'requerimientos' AND (
      public.tiene_permiso('editar_requerimiento')
      OR public.tiene_permiso('eliminar_requerimiento')
      OR public.tiene_permiso('eliminar_permanentemente')
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN: sin ver_requerimientos → select * from requerimientos = 0 filas;
-- con el permiso, la lista carga; crear/editar/subir imagen funciona. Admin: OK.
-- ═══════════════════════════════════════════════════════════════════════════
