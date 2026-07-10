-- ═══════════════════════════════════════════════════════════════════════════
-- FASE 2 DE SEGURIDAD — SCRIPT COMBINADO (aplicar de una vez en el SQL Editor)
-- Contiene las migraciones 0003→0011 en orden. Corre todo en una transacción:
-- si una sentencia falla, se revierte TODO (all-or-nothing).
-- Tras aplicar: probar login + checklist docs/PRUEBAS_RLS_POR_ROL.md
-- RECORDATORIO: la parte de triggers (0011) requiere subir el dist nuevo al hosting.
-- ═══════════════════════════════════════════════════════════════════════════


-- ###########################################################################
-- ###  20260706000003_seguridad_escalada_privilegios
-- ###########################################################################
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


-- ###########################################################################
-- ###  20260706000004_rls_personal
-- ###########################################################################
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


-- ###########################################################################
-- ###  20260706000005_rls_ausencias_compensatorios
-- ###########################################################################
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


-- ###########################################################################
-- ###  20260706000006_rls_tickets_reglamentos
-- ###########################################################################
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


-- ###########################################################################
-- ###  20260706000007_rls_inventario
-- ###########################################################################
-- ═══════════════════════════════════════════════════════════════════════════
-- FASE 2 DE SEGURIDAD — RLS real para Inventario (hallazgo C1)
-- ---------------------------------------------------------------------------
-- Tablas: bienes, categorias, prestamos, incidencias, actividades.
--
-- ── Notas de diseño (verificadas en Inventario.jsx / CamposCategoria.jsx) ───
--   · Los CAMPOS de categoría viven DENTRO de `categorias` (CamposCategoria solo
--     hace UPDATE sobre categorias). Por eso categorias UPDATE admite además los
--     permisos de campos (agregar_campo, editar_campo, ...).
--   · `categorias` es dato de referencia leído por muchos módulos (Dashboard,
--     Usuarios/wizard de permisos, Auditoría, ImportarCSV) → SELECT abierto a
--     autenticados (no sensible: nombres/íconos/definición de campos).
--   · Acoplamiento préstamos↔stock: registrar/devolver un préstamo hace UPDATE de
--     bienes.cantidad (Inventario.jsx:1624/1859) → bienes UPDATE admite
--     registrar_prestamo. Soft-delete y restauración también son UPDATE.
--   · bienes/incidencias/requerimientos se borran de forma permanente SOLO desde
--     la Papelera (DELETE directo) → DELETE exige eliminar_permanentemente.
--   · `prestamos` conserva la regla "solo quien lo registró (o con permiso) edita".
--
-- Requiere: es_admin(), tiene_permiso() (20260706000003, corregida en 0006).
-- Aplicar manualmente en el SQL Editor, en orden.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Borrado dinámico de políticas previas ───────────────────────────────────
DO $$
DECLARE r record; t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['bienes','categorias','prestamos','incidencias','actividades']
  LOOP
    FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, t);
    END LOOP;
  END LOOP;
END $$;

ALTER TABLE public.bienes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prestamos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidencias  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actividades  ENABLE ROW LEVEL SECURITY;

-- ── bienes ──────────────────────────────────────────────────────────────────
CREATE POLICY "bienes_select" ON public.bienes
  FOR SELECT TO authenticated
  USING (public.tiene_permiso('ver_inventario') OR public.tiene_permiso('ver_auditoria_inventario'));
CREATE POLICY "bienes_insert" ON public.bienes
  FOR INSERT TO authenticated
  WITH CHECK (public.tiene_permiso('agregar_bien') OR public.tiene_permiso('importar_csv'));
CREATE POLICY "bienes_update" ON public.bienes
  FOR UPDATE TO authenticated
  USING (
    public.tiene_permiso('editar_bien') OR public.tiene_permiso('eliminar_bien')
    OR public.tiene_permiso('eliminar_lote') OR public.tiene_permiso('registrar_prestamo')
    OR public.tiene_permiso('restaurar_registros')
  )
  WITH CHECK (
    public.tiene_permiso('editar_bien') OR public.tiene_permiso('eliminar_bien')
    OR public.tiene_permiso('eliminar_lote') OR public.tiene_permiso('registrar_prestamo')
    OR public.tiene_permiso('restaurar_registros')
  );
CREATE POLICY "bienes_delete" ON public.bienes
  FOR DELETE TO authenticated
  USING (public.tiene_permiso('eliminar_permanentemente'));

-- ── categorias (incluye definición de campos; referencia no sensible) ───────
CREATE POLICY "categorias_select" ON public.categorias
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "categorias_insert" ON public.categorias
  FOR INSERT TO authenticated WITH CHECK (public.tiene_permiso('gestionar_categorias'));
CREATE POLICY "categorias_update" ON public.categorias
  FOR UPDATE TO authenticated
  USING (
    public.tiene_permiso('gestionar_categorias') OR public.tiene_permiso('gestionar_campos')
    OR public.tiene_permiso('agregar_campo') OR public.tiene_permiso('editar_campo')
    OR public.tiene_permiso('ocultar_campo') OR public.tiene_permiso('eliminar_campo')
    OR public.tiene_permiso('reordenar_campos') OR public.tiene_permiso('gestionar_campos_base')
  )
  WITH CHECK (
    public.tiene_permiso('gestionar_categorias') OR public.tiene_permiso('gestionar_campos')
    OR public.tiene_permiso('agregar_campo') OR public.tiene_permiso('editar_campo')
    OR public.tiene_permiso('ocultar_campo') OR public.tiene_permiso('eliminar_campo')
    OR public.tiene_permiso('reordenar_campos') OR public.tiene_permiso('gestionar_campos_base')
  );
CREATE POLICY "categorias_delete" ON public.categorias
  FOR DELETE TO authenticated
  USING (public.tiene_permiso('gestionar_categorias') OR public.tiene_permiso('eliminar_permanentemente'));

-- ── prestamos (conserva regla de propiedad + gating por permiso) ────────────
CREATE POLICY "prestamos_select" ON public.prestamos
  FOR SELECT TO authenticated
  USING (public.tiene_permiso('ver_inventario') OR public.tiene_permiso('ver_auditoria_inventario'));
CREATE POLICY "prestamos_insert" ON public.prestamos
  FOR INSERT TO authenticated WITH CHECK (public.tiene_permiso('registrar_prestamo'));
CREATE POLICY "prestamos_update" ON public.prestamos
  FOR UPDATE TO authenticated
  USING (registrado_por = auth.uid() OR public.tiene_permiso('registrar_prestamo'))
  WITH CHECK (registrado_por = auth.uid() OR public.tiene_permiso('registrar_prestamo'));
CREATE POLICY "prestamos_delete" ON public.prestamos
  FOR DELETE TO authenticated
  USING (public.tiene_permiso('registrar_prestamo') OR public.tiene_permiso('eliminar_permanentemente'));

-- ── incidencias ─────────────────────────────────────────────────────────────
CREATE POLICY "incidencias_select" ON public.incidencias
  FOR SELECT TO authenticated
  USING (public.tiene_permiso('ver_inventario') OR public.tiene_permiso('ver_auditoria_inventario'));
CREATE POLICY "incidencias_insert" ON public.incidencias
  FOR INSERT TO authenticated WITH CHECK (public.tiene_permiso('registrar_incidencia'));
CREATE POLICY "incidencias_update" ON public.incidencias
  FOR UPDATE TO authenticated
  USING (public.tiene_permiso('registrar_incidencia'))
  WITH CHECK (public.tiene_permiso('registrar_incidencia'));
CREATE POLICY "incidencias_delete" ON public.incidencias
  FOR DELETE TO authenticated
  USING (public.tiene_permiso('registrar_incidencia') OR public.tiene_permiso('eliminar_permanentemente'));

-- ── actividades (bitácora de inventario; insert desde cliente — ver C3) ─────
CREATE POLICY "actividades_select" ON public.actividades
  FOR SELECT TO authenticated
  USING (public.tiene_permiso('ver_inventario') OR public.tiene_permiso('ver_auditoria_inventario'));
CREATE POLICY "actividades_insert" ON public.actividades
  FOR INSERT TO authenticated
  WITH CHECK (
    public.tiene_permiso('agregar_bien') OR public.tiene_permiso('editar_bien')
    OR public.tiene_permiso('eliminar_bien') OR public.tiene_permiso('eliminar_lote')
    OR public.tiene_permiso('registrar_prestamo') OR public.tiene_permiso('registrar_incidencia')
    OR public.tiene_permiso('importar_csv') OR public.tiene_permiso('gestionar_categorias')
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN: usuario sin ver_inventario → select * from bienes = 0 filas;
-- con ver_inventario carga; registrar/devolver préstamo ajusta stock sin error;
-- editar campos de una categoría funciona con permisos de campos. Admin: OK.
-- ═══════════════════════════════════════════════════════════════════════════


-- ###########################################################################
-- ###  20260706000008_rls_requerimientos
-- ###########################################################################
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
-- IMPORTANTE: las políticas ORIGINALES de este bucket se llaman `req_imgs_*`
-- (supabase_requerimientos_imagenes.sql). Hay que BORRARLAS por su nombre real,
-- o su WITH CHECK permisivo (solo bucket_id) anularía por OR la restricción.
DROP POLICY IF EXISTS "req_imgs_insert" ON storage.objects;
DROP POLICY IF EXISTS "req_imgs_update" ON storage.objects;
DROP POLICY IF EXISTS "req_imgs_delete" ON storage.objects;
DROP POLICY IF EXISTS "requerimientos_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "requerimientos_storage_delete" ON storage.objects;
-- `req_imgs_select` se conserva: el bucket es público en lectura (getPublicUrl).

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


-- ###########################################################################
-- ###  20260706000009_rls_configuracion_auditoria
-- ###########################################################################
-- ═══════════════════════════════════════════════════════════════════════════
-- FASE 2 DE SEGURIDAD — RLS para Configuración y Auditoría global (C1 + C3 parcial)
-- ---------------------------------------------------------------------------
-- Cierra la Fase 2 con las dos tablas transversales: `configuracion` y
-- `audit_logs`.
--
-- ── configuracion ───────────────────────────────────────────────────────────
--   Contiene branding (logo_url, colores, nombres) Y el codigo_invitacion.
--   · El branding se carga ANTES del login (App.jsx:214, sin sesión) → debe ser
--     legible por anónimos. Pero codigo_invitacion NO debe filtrarse (quien lo
--     lee puede auto-registrarse). Se separa por fila:
--       - branding (clave <> 'codigo_invitacion'): legible por todos.
--       - codigo_invitacion: solo gestores de usuarios (Usuarios.jsx:1116).
--   · Escritura separada por fila: branding ↔ permisos de ajustes;
--     codigo_invitacion ↔ permisos de usuarios (Usuarios.jsx:1124 / Ajustes.jsx:298).
--
-- ── audit_logs (bitácora global de todos los módulos) ───────────────────────
--   · SELECT: cualquier permiso de auditoría (o ver_historial_usuarios). El
--     filtrado por módulo lo hace la app; todos los lectores son staff de confianza.
--   · INSERT: se escribe desde el cliente (C3). WITH CHECK impide suplantar la
--     identidad de OTRO usuario (usuario_id debe ser el propio o NULL/sistema).
--     Migrar a triggers sigue pendiente (C3). Ver [[project_auditoria_seguridad]].
--   · UPDATE/DELETE: solo admin (las correcciones usan RPC SECURITY DEFINER que
--     ignora RLS).
--
-- Requiere: es_admin(), tiene_permiso() (20260706000003 / corregida en 0006).
-- Aplicar manualmente. Es la última migración de la Fase 2 de dominio.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Borrado dinámico de políticas previas ───────────────────────────────────
DO $$
DECLARE r record; t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['configuracion','audit_logs']
  LOOP
    FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, t);
    END LOOP;
  END LOOP;
END $$;

ALTER TABLE public.configuracion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs    ENABLE ROW LEVEL SECURITY;

-- ── configuracion: lectura ──────────────────────────────────────────────────
-- Branding público (incluye anónimos, para el login). Oculta codigo_invitacion.
CREATE POLICY "configuracion_branding_select" ON public.configuracion
  FOR SELECT TO anon, authenticated
  USING (clave <> 'codigo_invitacion');
-- codigo_invitacion: solo gestores de usuarios.
CREATE POLICY "configuracion_codigo_select" ON public.configuracion
  FOR SELECT TO authenticated
  USING (
    clave = 'codigo_invitacion' AND (
      public.tiene_permiso('gestionar_usuarios')
      OR public.tiene_permiso('invitar_usuario')
      OR public.tiene_permiso('editar_usuario')
    )
  );

-- ── configuracion: escritura (separada por fila) ────────────────────────────
CREATE POLICY "configuracion_insert" ON public.configuracion
  FOR INSERT TO authenticated
  WITH CHECK (
    (clave = 'codigo_invitacion' AND (
        public.tiene_permiso('gestionar_usuarios') OR public.tiene_permiso('invitar_usuario') OR public.tiene_permiso('editar_usuario')))
    OR (clave <> 'codigo_invitacion' AND (
        public.tiene_permiso('guardar_cambios_ajustes') OR public.tiene_permiso('gestionar_ajustes')))
  );
CREATE POLICY "configuracion_update" ON public.configuracion
  FOR UPDATE TO authenticated
  USING (
    (clave = 'codigo_invitacion' AND (
        public.tiene_permiso('gestionar_usuarios') OR public.tiene_permiso('invitar_usuario') OR public.tiene_permiso('editar_usuario')))
    OR (clave <> 'codigo_invitacion' AND (
        public.tiene_permiso('guardar_cambios_ajustes') OR public.tiene_permiso('gestionar_ajustes')))
  )
  WITH CHECK (
    (clave = 'codigo_invitacion' AND (
        public.tiene_permiso('gestionar_usuarios') OR public.tiene_permiso('invitar_usuario') OR public.tiene_permiso('editar_usuario')))
    OR (clave <> 'codigo_invitacion' AND (
        public.tiene_permiso('guardar_cambios_ajustes') OR public.tiene_permiso('gestionar_ajustes')))
  );
CREATE POLICY "configuracion_delete" ON public.configuracion
  FOR DELETE TO authenticated
  USING (public.es_admin());

-- ── audit_logs ──────────────────────────────────────────────────────────────
CREATE POLICY "audit_logs_select" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    public.tiene_permiso('ver_auditoria_inventario')
    OR public.tiene_permiso('ver_auditoria_requerimientos')
    OR public.tiene_permiso('ver_auditoria_permisos')
    OR public.tiene_permiso('ver_auditoria_compensatorios')
    OR public.tiene_permiso('gestionar_tickets')
    OR public.tiene_permiso('ver_auditoria_reglamentos')
    OR public.tiene_permiso('ver_auditoria_papelera')
    OR public.tiene_permiso('ver_auditoria_personal')
    OR public.tiene_permiso('ver_historial_usuarios')
  );
-- Inserción desde el cliente: no se puede atribuir a otro usuario.
CREATE POLICY "audit_logs_insert" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid() OR usuario_id IS NULL);
CREATE POLICY "audit_logs_update" ON public.audit_logs
  FOR UPDATE TO authenticated USING (public.es_admin()) WITH CHECK (public.es_admin());
CREATE POLICY "audit_logs_delete" ON public.audit_logs
  FOR DELETE TO authenticated USING (public.es_admin());

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN:
--   · Anónimo (sin login): el logo/nombre del establecimiento se muestran, pero
--     select valor from configuracion where clave='codigo_invitacion' → 0 filas.
--   · Gestor de usuarios: ve y edita el codigo_invitacion.
--   · Usuario sin permisos de auditoría: select * from audit_logs → 0 filas.
--   · Intentar insertar en audit_logs con usuario_id ajeno → error de política.
--   · Admin: todo funciona sin cambios.
-- ═══════════════════════════════════════════════════════════════════════════


-- ###########################################################################
-- ###  20260706000010_rls_usuarios_permisos
-- ###########################################################################
-- ═══════════════════════════════════════════════════════════════════════════
-- FASE 2 DE SEGURIDAD — RLS para usuarios y permisos_usuario (tablas núcleo)
-- ---------------------------------------------------------------------------
-- ⚠️⚠️ MIGRACIÓN DE ALTO RIESGO — LEER ANTES DE APLICAR ⚠️⚠️
-- Estas tablas se leen en casi toda la app (incluido el LOGIN) y se crearon a
-- mano (no están en el repo). Aplica esta migración SOLO después de haber
-- verificado y probado 0003→0009, y en un momento de baja actividad. Si algo
-- sale mal, la sección de REVERSIÓN (al final) restablece el acceso abierto.
--
-- ── Decisiones de diseño (verificadas en el código) ─────────────────────────
--   · usuarios.SELECT queda ABIERTO a autenticados. Es OBLIGATORIO: el login
--     (App.jsx:288, fila propia) y "Mis ausencias" de un docente (Permisos.jsx:
--     2135 lee TODOS los usuarios para el match por RUT), Dashboard, Compensatorios,
--     Personal, Auditoría, etc. dependen de leer usuarios ajenos (nombre/rut/email).
--     Restringirlo rompería esos flujos; el blindaje real está en la ESCRITURA
--     y en el trigger anti-escalada de 0003.
--     · PII: nombre/email/rut quedan visibles a todo usuario autenticado (staff).
--       Endurecerlo requiere refactor (mover el match por RUT a un RPC
--       SECURITY DEFINER). Ver [[project_auditoria_seguridad]].
--   · usuarios.UPDATE: admin, el propio usuario (debe_cambiar_password), gestores
--     de usuarios (nombre/rol*), restauración desde Papelera (nombre) y gestores
--     de ausencias (rut, Permisos.jsx:903). (*) El cambio de `rol`/`is_deleted`
--     sigue BLOQUEADO para no-admin por el trigger fn_bloquear_cambio_rol (0003).
--   · usuarios.INSERT/DELETE: alta/baja pasan por Edge Functions con service_role
--     (ignoran RLS); desde el cliente solo admin / eliminar_usuario.
--   · permisos_usuario.SELECT: la fila propia (login, App.jsx:240/303; Dashboard;
--     Inventario) + gestores de usuarios + gestores de ausencias (Permisos.jsx:2441
--     lee todas para notificar por correo).
--   · permisos_usuario.WRITE: gestores de usuarios (Usuarios.jsx:1198 upsert). El
--     trigger fn_crear_permisos_usuario (SECURITY DEFINER) crea la fila inicial.
--
-- ⚠️ NOTA DE COMPORTAMIENTO — asignación de roles:
--   El trigger de 0003 hace que SOLO un admin pueda cambiar `usuarios.rol`. Si en
--   tu operación hay gestores de usuarios NO admin que deban asignar roles, avísame
--   y relajamos el trigger para permitir `editar_roles_permisos` (con la
--   contrapartida de reintroducir riesgo de escalada delegada).
--
-- Requiere: es_admin(), tiene_permiso() (0003 / corregida en 0006). Aplicar a mano.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Borrado dinámico de políticas previas ───────────────────────────────────
DO $$
DECLARE r record; t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['usuarios','permisos_usuario']
  LOOP
    FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, t);
    END LOOP;
  END LOOP;
END $$;

ALTER TABLE public.usuarios         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permisos_usuario ENABLE ROW LEVEL SECURITY;

-- ── usuarios ────────────────────────────────────────────────────────────────
-- SELECT abierto a autenticados (imprescindible; ver notas). El cambio de rol
-- lo protege el trigger fn_bloquear_cambio_rol (0003), no esta política.
CREATE POLICY "usuarios_select" ON public.usuarios
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "usuarios_insert" ON public.usuarios
  FOR INSERT TO authenticated WITH CHECK (public.es_admin());
CREATE POLICY "usuarios_update" ON public.usuarios
  FOR UPDATE TO authenticated
  USING (
    public.es_admin()
    OR id = auth.uid()
    OR public.tiene_permiso('editar_usuario')
    OR public.tiene_permiso('gestionar_usuarios')
    OR public.tiene_permiso('restaurar_registros')
    OR public.tiene_permiso('crear_ausencias')
    OR public.tiene_permiso('editar_ausencias')
  )
  WITH CHECK (
    public.es_admin()
    OR id = auth.uid()
    OR public.tiene_permiso('editar_usuario')
    OR public.tiene_permiso('gestionar_usuarios')
    OR public.tiene_permiso('restaurar_registros')
    OR public.tiene_permiso('crear_ausencias')
    OR public.tiene_permiso('editar_ausencias')
  );
CREATE POLICY "usuarios_delete" ON public.usuarios
  FOR DELETE TO authenticated
  USING (
    public.es_admin()
    OR public.tiene_permiso('eliminar_usuario')
    OR public.tiene_permiso('eliminar_permanentemente')
  );

-- ── permisos_usuario ────────────────────────────────────────────────────────
CREATE POLICY "permisos_usuario_select" ON public.permisos_usuario
  FOR SELECT TO authenticated
  USING (
    usuario_id = auth.uid()
    OR public.es_admin()
    OR public.tiene_permiso('editar_usuario')
    OR public.tiene_permiso('gestionar_usuarios')
    OR public.tiene_permiso('editar_roles_permisos')
    OR public.tiene_permiso('crear_ausencias')
    OR public.tiene_permiso('editar_ausencias')
  );
CREATE POLICY "permisos_usuario_insert" ON public.permisos_usuario
  FOR INSERT TO authenticated
  WITH CHECK (
    public.es_admin()
    OR public.tiene_permiso('editar_usuario')
    OR public.tiene_permiso('gestionar_usuarios')
    OR public.tiene_permiso('editar_roles_permisos')
  );
CREATE POLICY "permisos_usuario_update" ON public.permisos_usuario
  FOR UPDATE TO authenticated
  USING (
    public.es_admin()
    OR public.tiene_permiso('editar_usuario')
    OR public.tiene_permiso('gestionar_usuarios')
    OR public.tiene_permiso('editar_roles_permisos')
  )
  WITH CHECK (
    public.es_admin()
    OR public.tiene_permiso('editar_usuario')
    OR public.tiene_permiso('gestionar_usuarios')
    OR public.tiene_permiso('editar_roles_permisos')
  );
CREATE POLICY "permisos_usuario_delete" ON public.permisos_usuario
  FOR DELETE TO authenticated
  USING (
    public.es_admin()
    OR public.tiene_permiso('gestionar_usuarios')
    OR public.tiene_permiso('editar_usuario')
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN (crítica — probar el LOGIN primero):
--   · Cerrar sesión y volver a entrar con un docente → carga su perfil y permisos
--     (login OK).
--   · Docente: "Mis ausencias" sigue mostrando las propias (lee usuarios por RUT).
--   · 🔒 Docente: update usuarios set rol='admin' where id=auth.uid() → ERROR (trigger).
--   · 🔒 Docente: update usuarios set nombre='x' where id=<otro> → 0 filas afectadas
--        (no es gestor; solo puede su propia fila).
--   · Admin y gestor de usuarios: editar usuario y permisos funciona.
--   · Gestor de ausencias: registrar ausencia dispara notificaciones sin error.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── REVERSIÓN de emergencia (restablece acceso abierto si algo se rompe) ─────
-- ALTER TABLE public.usuarios         DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.permisos_usuario DISABLE ROW LEVEL SECURITY;
-- (o recrear políticas USING(true) según el estado previo)


-- ###########################################################################
-- ###  20260706000011_audit_triggers_personal_reglamentos
-- ###########################################################################
-- ═══════════════════════════════════════════════════════════════════════════
-- FASE 2 DE SEGURIDAD — C3: auditoría por triggers (Personal y Reglamentos)
-- ---------------------------------------------------------------------------
-- Cierra el hallazgo C3 (auditoría falsificable) completando el patrón de
-- triggers que YA existe para bienes, tickets, requerimientos, ausencias,
-- dias_compensatorios y permisos_usuario. Estas eran las últimas tablas de
-- DATOS que registraban su auditoría desde el cliente (identidad falsificable):
--   · contrataciones, reemplazos, personal_documentos  (Personal.jsx auditLog)
--   · reglamentos                                       (Reglamentos.jsx auditoria)
--
-- Ahora la identidad la fija el servidor con auth.uid() (no se puede suplantar ni
-- omitir). El formato de `cambios` es el mismo que consume Auditoría:
-- [{campo, anterior, nuevo}]. Los triggers escriben en audit_logs (modulo) y,
-- para Personal, también en personal_audit_logs (que alimenta su pestaña propia).
--
-- ⚠️ IMPORTANTE — evitar DOBLE registro:
--   Esta migración va ACOMPAÑADA de un cambio en el frontend que neutraliza los
--   inserts de auditoría desde el cliente en Personal.jsx (auditLog) y
--   Reglamentos.jsx (auditoria). Aplica ambos juntos (deploy del front + esta
--   migración). Si aplicas solo la migración sin el front nuevo, cada acción se
--   registrará DOS veces hasta que subas el front.
--
-- NO se triggeriza (siguen en el cliente, protegidos contra suplantación por el
-- WITH CHECK de 0009): la bitácora de ACCIONES de Papelera (restaurar/eliminar)
-- y los cambios de CAMPOS (ModalCamposCategoria) — son logs semánticos/de acción,
-- no diffs de fila. Ver [[project_auditoria_seguridad]].
--
-- Requiere: tablas de 0004 (personal_*) y audit_logs. Aplicar manualmente.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Trigger de Personal (contrataciones / reemplazos / personal_documentos) ──
DROP TRIGGER IF EXISTS trg_audit_personal ON public.contrataciones;
DROP TRIGGER IF EXISTS trg_audit_personal ON public.reemplazos;
DROP TRIGGER IF EXISTS trg_audit_personal ON public.personal_documentos;
DROP FUNCTION IF EXISTS public.fn_audit_personal();

CREATE OR REPLACE FUNCTION public.fn_audit_personal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_nombre text;
  v_actor_rol    text;
  v_new_j jsonb := to_jsonb(NEW);
  v_old_j jsonb := to_jsonb(OLD);
  v_name_col text;
  v_accion text;
  v_id text;
  v_nombre text;
  v_cambios jsonb := '[]'::jsonb;
  v_col text;
  v_old_val text;
  v_new_val text;
  v_skip text[] := ARRAY['id','creado_en','actualizado_en','creado_por','subido_en','subido_por'];
BEGIN
  SELECT nombre, rol INTO v_actor_nombre, v_actor_rol FROM usuarios WHERE id = auth.uid();
  v_actor_nombre := COALESCE(v_actor_nombre, 'Sistema');

  v_name_col := CASE TG_TABLE_NAME
                  WHEN 'contrataciones' THEN 'nombre_completo'
                  WHEN 'reemplazos'     THEN 'funcionario_nombre'
                  ELSE 'nombre'
                END;

  IF TG_OP = 'INSERT' THEN
    v_accion := 'crear';  v_id := v_new_j->>'id';  v_nombre := v_new_j->>v_name_col;
  ELSIF TG_OP = 'DELETE' THEN
    v_accion := 'eliminar';  v_id := v_old_j->>'id';  v_nombre := v_old_j->>v_name_col;
  ELSE
    v_accion := 'editar';  v_id := v_new_j->>'id';  v_nombre := v_new_j->>v_name_col;
    FOR v_col IN SELECT jsonb_object_keys(v_new_j) LOOP
      IF v_col = ANY(v_skip) THEN CONTINUE; END IF;
      v_old_val := v_old_j->>v_col;  v_new_val := v_new_j->>v_col;
      IF v_old_val IS DISTINCT FROM v_new_val THEN
        v_cambios := v_cambios || jsonb_build_array(
          jsonb_build_object('campo', v_col, 'anterior', v_old_val, 'nuevo', v_new_val));
      END IF;
    END LOOP;
    IF jsonb_array_length(v_cambios) = 0 THEN
      RETURN COALESCE(NEW, OLD);  -- sin cambios relevantes → no registrar
    END IF;
  END IF;

  v_nombre := COALESCE(NULLIF(v_nombre, ''), TG_TABLE_NAME || ' #' || COALESCE(v_id, '?'));

  -- Bitácora propia del módulo Personal
  INSERT INTO personal_audit_logs
    (accion, tabla_afectada, registro_id, registro_nombre, usuario_id, usuario_nombre, usuario_rol, cambios)
  VALUES
    (v_accion, TG_TABLE_NAME, v_id::uuid, v_nombre, auth.uid(), v_actor_nombre, v_actor_rol, v_cambios);

  -- Bitácora global (audit_logs) — bien_id NULL porque el id es uuid
  INSERT INTO audit_logs
    (bien_id, bien_nombre, categoria, accion, cambios, usuario_id, usuario_nombre, usuario_rol, modulo)
  VALUES
    (NULL, v_nombre, NULL, v_accion, v_cambios, auth.uid(), v_actor_nombre, v_actor_rol, 'personal');

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_audit_personal
  AFTER INSERT OR UPDATE OR DELETE ON public.contrataciones
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_personal();
CREATE TRIGGER trg_audit_personal
  AFTER INSERT OR UPDATE OR DELETE ON public.reemplazos
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_personal();
CREATE TRIGGER trg_audit_personal
  AFTER INSERT OR UPDATE OR DELETE ON public.personal_documentos
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_personal();

-- ── Trigger de Reglamentos ──────────────────────────────────────────────────
-- INSERT='crear'; is_deleted false→true='eliminar' (borrado lógico = el "eliminar"
-- del usuario); true→false='crear' (restaurar). El DELETE físico NO se registra
-- aquí: lo hace la bitácora de acciones de la Papelera. Los contadores
-- visitas/descargas se ignoran para no inundar la auditoría.
DROP TRIGGER  IF EXISTS trg_audit_reglamentos ON public.reglamentos;
DROP FUNCTION IF EXISTS public.fn_audit_reglamentos();

CREATE OR REPLACE FUNCTION public.fn_audit_reglamentos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_nombre text;
  v_actor_rol    text;
  v_new_j jsonb := to_jsonb(NEW);
  v_old_j jsonb := to_jsonb(OLD);
  v_accion text;
  v_cambios jsonb := '[]'::jsonb;
  v_col text;
  v_old_val text;
  v_new_val text;
  v_skip text[] := ARRAY['id','creado_en','actualizado_en','creado_por','creado_por_nombre',
                         'visitas','descargas','is_deleted','deleted_at','deleted_by','deleted_by_nombre'];
BEGIN
  SELECT nombre, rol INTO v_actor_nombre, v_actor_rol FROM usuarios WHERE id = auth.uid();
  v_actor_nombre := COALESCE(v_actor_nombre, 'Sistema');

  IF TG_OP = 'INSERT' THEN
    v_accion := 'crear';
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.is_deleted = false AND NEW.is_deleted = true THEN
      v_accion := 'eliminar';
    ELSIF OLD.is_deleted = true AND NEW.is_deleted = false THEN
      v_accion := 'crear';
    ELSE
      v_accion := 'editar';
      FOR v_col IN SELECT jsonb_object_keys(v_new_j) LOOP
        IF v_col = ANY(v_skip) THEN CONTINUE; END IF;
        v_old_val := v_old_j->>v_col;  v_new_val := v_new_j->>v_col;
        IF v_old_val IS DISTINCT FROM v_new_val THEN
          v_cambios := v_cambios || jsonb_build_array(
            jsonb_build_object('campo', v_col, 'anterior', v_old_val, 'nuevo', v_new_val));
        END IF;
      END LOOP;
      IF jsonb_array_length(v_cambios) = 0 THEN
        RETURN NEW;  -- solo cambiaron contadores u otros campos ignorados
      END IF;
    END IF;
  ELSE
    RETURN OLD;  -- DELETE físico: lo registra la Papelera
  END IF;

  INSERT INTO audit_logs
    (bien_id, bien_nombre, categoria, accion, cambios, usuario_id, usuario_nombre, usuario_rol, modulo)
  VALUES
    (COALESCE(NEW.id, OLD.id), COALESCE(NEW.nombre, OLD.nombre), COALESCE(NEW.categoria, OLD.categoria),
     v_accion, v_cambios, auth.uid(), v_actor_nombre, v_actor_rol, 'reglamentos');

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_audit_reglamentos
  AFTER INSERT OR UPDATE ON public.reglamentos
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_reglamentos();

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN (aplicar junto con el front que neutraliza auditLog/auditoria):
--   · Crear/editar/eliminar una contratación → aparece UNA entrada en Auditoría
--     de Personal (no dos) con el usuario correcto.
--   · Editar un reglamento → una entrada 'editar'; enviarlo a Papelera → 'eliminar';
--     abrir/descargar (contadores) → NO genera entradas.
--   · El usuario que figura en la auditoría es siempre el real (no falsificable).
-- ═══════════════════════════════════════════════════════════════════════════

