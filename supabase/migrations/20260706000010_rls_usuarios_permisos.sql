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
