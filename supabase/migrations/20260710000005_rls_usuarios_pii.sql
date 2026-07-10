-- ═══════════════════════════════════════════════════════════════════════════
-- F04 — Restringir la lectura de PII en `usuarios` (nombre / email / rut)
-- ---------------------------------------------------------------------------
-- ⚠️⚠️ MIGRACIÓN DE ALTO RIESGO — TOCA EL CAMINO DE LOGIN ⚠️⚠️
-- Reemplaza la política `usuarios_select` con USING(true) (todo autenticado veía
-- la PII de todos) por una que solo permite:
--   · la fila PROPIA (login, App.jsx / "Mis ausencias" / Dashboard perfil), y
--   · usuarios con un permiso de STAFF que legítimamente necesita ver a otros
--     (ausencias, compensatorios, personal, gestión de usuarios, auditoría).
--
-- Un docente/usuario base SIN esos permisos ya NO puede leer filas ajenas.
--
-- PRERREQUISITO DE CÓDIGO (ya desplegado): el flujo "Mis ausencias" de un docente
-- (Permisos.jsx) hacía un escaneo completo `select('id, rut')` para agrupar
-- cuentas con el mismo RUT. Se reemplazó por el RPC `ids_usuarios_mi_rut()`
-- (SECURITY DEFINER) definido aquí. Aplicar esta migración DESPUÉS de desplegar
-- ese cambio de front (o el docente no verá sus ausencias por RUT duplicado).
--
-- Requiere: es_admin(), tiene_permiso() (0003 / 0006). Aplicar manualmente en un
-- momento de baja actividad. Reversión de emergencia al final.
-- Ver [[project_auditoria_seguridad]].
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. ¿El llamante puede listar usuarios ajenos? (STABLE ⇒ 1 evaluación/consulta)
CREATE OR REPLACE FUNCTION public.puede_listar_usuarios()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    public.es_admin()
    -- Ausencias
    OR public.tiene_permiso('ver_ausencias')
    OR public.tiene_permiso('crear_ausencias')
    OR public.tiene_permiso('editar_ausencias')
    OR public.tiene_permiso('ver_auditoria_permisos')
    -- Compensatorios
    OR public.tiene_permiso('ver_compensatorios')
    OR public.tiene_permiso('crear_compensatorios')
    OR public.tiene_permiso('editar_compensatorios')
    OR public.tiene_permiso('ver_auditoria_compensatorios')
    -- Personal
    OR public.tiene_permiso('ver_contrataciones')
    OR public.tiene_permiso('ver_reemplazos')
    OR public.tiene_permiso('ver_documentos_personal')
    OR public.tiene_permiso('ver_auditoria_personal')
    -- Gestión de usuarios / roles / auditoría
    OR public.tiene_permiso('gestionar_usuarios')
    OR public.tiene_permiso('editar_usuario')
    OR public.tiene_permiso('editar_roles_permisos')
    OR public.tiene_permiso('gestionar_roles')
    OR public.tiene_permiso('ver_historial_usuarios')
    OR public.tiene_permiso('invitar_usuario')
    OR public.tiene_permiso('eliminar_usuario')
    -- Papelera (restaura/elimina filas de usuarios)
    OR public.tiene_permiso('restaurar_registros')
    OR public.tiene_permiso('eliminar_permanentemente');
$$;

GRANT EXECUTE ON FUNCTION public.puede_listar_usuarios() TO authenticated;

-- ── 2. IDs de usuarios que comparten el RUT del llamante ────────────────────
--   Reemplaza el escaneo completo `select('id, rut')` del front. Normaliza el
--   RUT igual que normRut() en JS: deja solo [0-9K] en mayúsculas.
CREATE OR REPLACE FUNCTION public.ids_usuarios_mi_rut()
RETURNS TABLE(id uuid)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH yo AS (
    SELECT regexp_replace(upper(coalesce(rut, '')), '[^0-9K]', '', 'g') AS r
      FROM public.usuarios
     WHERE usuarios.id = auth.uid()
  )
  SELECT auth.uid()
  UNION
  SELECT u.id
    FROM public.usuarios u, yo
   WHERE yo.r <> ''
     AND regexp_replace(upper(coalesce(u.rut, '')), '[^0-9K]', '', 'g') = yo.r;
$$;

GRANT EXECUTE ON FUNCTION public.ids_usuarios_mi_rut() TO authenticated;

-- ── 3. Reemplazar la política SELECT permisiva ──────────────────────────────
DROP POLICY IF EXISTS "usuarios_select" ON public.usuarios;
CREATE POLICY "usuarios_select" ON public.usuarios
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.puede_listar_usuarios()
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN (probar el LOGIN primero):
--   · Login de un docente sin permisos → carga su perfil (fila propia) OK.
--   · Docente: "Mis ausencias" sigue mostrando las propias (RPC ids_usuarios_mi_rut).
--   · 🔒 Docente: select * from usuarios → SOLO su fila.
--   · Gestor de ausencias / compensatorios / personal / usuarios → ve la lista completa.
--   · Admin → ve todo.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── REVERSIÓN de emergencia (restablece la lectura abierta) ─────────────────
-- DROP POLICY IF EXISTS "usuarios_select" ON public.usuarios;
-- CREATE POLICY "usuarios_select" ON public.usuarios
--   FOR SELECT TO authenticated USING (true);
