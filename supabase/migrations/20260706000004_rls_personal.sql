-- ═══════════════════════════════════════════════════════════════════════════
-- FASE 2 DE SEGURIDAD — RLS real para el módulo Personal (hallazgo C1)
-- ---------------------------------------------------------------------------
-- Reemplaza las políticas permisivas `USING (true)` de las tablas de Personal
-- por políticas basadas en `tiene_permiso()` (creada en 20260706000003), de modo
-- que la base de datos aplique la MISMA matriz de permisos que el frontend.
--
-- Cubre también el bucket privado `personal-docs`: hoy cualquier usuario
-- autenticado podía DESCARGAR contratos/decretos vía `.download()` porque la
-- política de storage solo miraba el bucket_id. Aquí se gatea por permiso.
--
-- ── Mapa flujo → permiso (verificado contra src/pages/Personal.jsx) ─────────
--   contrataciones:  SELECT (609,640,791,1491,2164) → ver (cualquiera de Personal)
--                    INSERT (819)  → crear_contrataciones
--                    UPDATE (814)  → editar_contrataciones
--                    DELETE (828,839) → eliminar_contrataciones
--   reemplazos:      SELECT (610,1486,2165) → ver (cualquiera de Personal)
--                    INSERT (1522) → crear_reemplazos
--                    UPDATE (1517) → editar_reemplazos
--                    DELETE (1531,1542) → eliminar_reemplazos
--   personal_documentos: SELECT (1347,2163) → ver (cualquiera de Personal)
--                    INSERT (2179) → subir_documentos_personal
--                    DELETE (2194) → eliminar_documentos_personal
--   personal_audit_logs: SELECT (1350,2521) → ver_auditoria_personal o ver Personal
--                    INSERT (146)  → identidad propia (usuario_id = auth.uid())
--   storage 'personal-docs': download(2201)/upload(2176)/remove(2193)
--
-- NOTA (C3): la auditoría se sigue insertando desde el cliente; el WITH CHECK
-- de identidad evita suplantar a otro usuario, pero la migración a triggers de
-- BD sigue pendiente. Ver [[project_auditoria_seguridad]].
--
-- Requiere: funciones es_admin() y tiene_permiso() (migración 20260706000003).
-- Aplicar manualmente en el SQL Editor de Supabase.
-- REVERSIÓN: al final (comentada).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Helper de lectura del módulo (cualquier permiso de vista de Personal) ────
-- El módulo cruza tablas entre pestañas (reemplazos lee contrataciones, docs
-- lee ambas), así que la lectura se concede si el usuario ve CUALQUIER sección.
CREATE OR REPLACE FUNCTION public.puede_ver_personal()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.tiene_permiso('ver_contrataciones')
      OR public.tiene_permiso('ver_reemplazos')
      OR public.tiene_permiso('ver_documentos_personal');
$$;

-- ── Borrado dinámico de políticas previas (evita OR con políticas renombradas) ─
DO $$
DECLARE r record; t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['contrataciones','reemplazos','personal_documentos','personal_audit_logs']
  LOOP
    FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, t);
    END LOOP;
  END LOOP;
END $$;

-- ── contrataciones ──────────────────────────────────────────────────────────
CREATE POLICY "contrataciones_select" ON public.contrataciones
  FOR SELECT TO authenticated USING (public.puede_ver_personal());
CREATE POLICY "contrataciones_insert" ON public.contrataciones
  FOR INSERT TO authenticated WITH CHECK (public.tiene_permiso('crear_contrataciones'));
CREATE POLICY "contrataciones_update" ON public.contrataciones
  FOR UPDATE TO authenticated
  USING (public.tiene_permiso('editar_contrataciones'))
  WITH CHECK (public.tiene_permiso('editar_contrataciones'));
CREATE POLICY "contrataciones_delete" ON public.contrataciones
  FOR DELETE TO authenticated USING (public.tiene_permiso('eliminar_contrataciones'));

-- ── reemplazos ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "reemplazos_select" ON public.reemplazos;
DROP POLICY IF EXISTS "reemplazos_insert" ON public.reemplazos;
DROP POLICY IF EXISTS "reemplazos_update" ON public.reemplazos;
DROP POLICY IF EXISTS "reemplazos_delete" ON public.reemplazos;

CREATE POLICY "reemplazos_select" ON public.reemplazos
  FOR SELECT TO authenticated USING (public.puede_ver_personal());
CREATE POLICY "reemplazos_insert" ON public.reemplazos
  FOR INSERT TO authenticated WITH CHECK (public.tiene_permiso('crear_reemplazos'));
CREATE POLICY "reemplazos_update" ON public.reemplazos
  FOR UPDATE TO authenticated
  USING (public.tiene_permiso('editar_reemplazos'))
  WITH CHECK (public.tiene_permiso('editar_reemplazos'));
CREATE POLICY "reemplazos_delete" ON public.reemplazos
  FOR DELETE TO authenticated USING (public.tiene_permiso('eliminar_reemplazos'));

-- ── personal_documentos ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "personal_docs_select" ON public.personal_documentos;
DROP POLICY IF EXISTS "personal_docs_insert" ON public.personal_documentos;
DROP POLICY IF EXISTS "personal_docs_update" ON public.personal_documentos;
DROP POLICY IF EXISTS "personal_docs_delete" ON public.personal_documentos;

CREATE POLICY "personal_docs_select" ON public.personal_documentos
  FOR SELECT TO authenticated USING (public.puede_ver_personal());
CREATE POLICY "personal_docs_insert" ON public.personal_documentos
  FOR INSERT TO authenticated WITH CHECK (public.tiene_permiso('subir_documentos_personal'));
-- El código no actualiza documentos; se gatea igual por defensa en profundidad.
CREATE POLICY "personal_docs_update" ON public.personal_documentos
  FOR UPDATE TO authenticated
  USING (public.tiene_permiso('subir_documentos_personal'))
  WITH CHECK (public.tiene_permiso('subir_documentos_personal'));
CREATE POLICY "personal_docs_delete" ON public.personal_documentos
  FOR DELETE TO authenticated USING (public.tiene_permiso('eliminar_documentos_personal'));

-- ── personal_audit_logs ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "personal_audit_select" ON public.personal_audit_logs;
DROP POLICY IF EXISTS "personal_audit_insert" ON public.personal_audit_logs;

CREATE POLICY "personal_audit_select" ON public.personal_audit_logs
  FOR SELECT TO authenticated
  USING (public.tiene_permiso('ver_auditoria_personal') OR public.puede_ver_personal());
-- Inserción: solo a nombre propio (no-repudio parcial hasta migrar a triggers).
CREATE POLICY "personal_audit_insert" ON public.personal_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid());

-- ── Storage: bucket privado 'personal-docs' ─────────────────────────────────
DROP POLICY IF EXISTS "personal_docs_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "personal_docs_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "personal_docs_storage_delete" ON storage.objects;

CREATE POLICY "personal_docs_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'personal-docs' AND public.puede_ver_personal());
CREATE POLICY "personal_docs_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'personal-docs' AND public.tiene_permiso('subir_documentos_personal'));
CREATE POLICY "personal_docs_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'personal-docs' AND public.tiene_permiso('eliminar_documentos_personal'));

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN sugerida (con un usuario SIN permisos de Personal):
--   select * from contrataciones;        → 0 filas (antes: todas)
--   insert into contrataciones(...) ...;  → error de política
-- Con un usuario CON 'ver_contrataciones': el listado de la app debe cargar OK.
-- Con admin: todo el módulo debe funcionar sin cambios.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── REVERSIÓN (restaura el estado permisivo previo) ─────────────────────────
-- DROP POLICY IF EXISTS "contrataciones_select" ON public.contrataciones;
-- ... (recrear las políticas con USING (true) de supabase_contrataciones.sql)
-- DROP FUNCTION IF EXISTS public.puede_ver_personal();
