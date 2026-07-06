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
