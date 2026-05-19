-- ═══════════════════════════════════════════════════════════════════════
--  AUDITORÍA — Módulos Requerimientos y Permisos
--  Ejecutar en Supabase Dashboard → SQL Editor
--  Requiere haber ejecutado supabase_auditoria.sql primero.
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Agregar columna módulo a audit_logs ───────────────────────────────
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS modulo TEXT NOT NULL DEFAULT 'inventario';
UPDATE audit_logs SET modulo = 'inventario' WHERE modulo IS NULL OR modulo = '';
CREATE INDEX IF NOT EXISTS idx_audit_modulo ON audit_logs (modulo);

-- ── 2. Políticas RLS para acceso granular por módulo ─────────────────────
-- Usuarios con permiso ver_auditoria_requerimientos
DROP POLICY IF EXISTS "audit_req_select"      ON audit_logs;
DROP POLICY IF EXISTS "audit_permisos_select" ON audit_logs;

CREATE POLICY "audit_req_select" ON audit_logs
  FOR SELECT USING (
    modulo = 'requerimientos' AND EXISTS (
      SELECT 1 FROM permisos_usuario
      WHERE usuario_id = auth.uid()
        AND (permisos->>'ver_auditoria_requerimientos')::boolean = true
    )
  );

CREATE POLICY "audit_permisos_select" ON audit_logs
  FOR SELECT USING (
    modulo = 'permisos' AND EXISTS (
      SELECT 1 FROM permisos_usuario
      WHERE usuario_id = auth.uid()
        AND (permisos->>'ver_auditoria_permisos')::boolean = true
    )
  );

-- ── 3. Trigger: auditoría de requerimientos ──────────────────────────────
DROP TRIGGER  IF EXISTS trg_audit_requerimientos ON requerimientos;
DROP FUNCTION IF EXISTS fn_audit_requerimientos();

CREATE OR REPLACE FUNCTION fn_audit_requerimientos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario_nombre text;
  v_usuario_rol    text;
  v_cambios        jsonb := '[]'::jsonb;
  v_campos         text[] := ARRAY[
    'numero_req','fecha','contenido','solicitante','fondo','dimension',
    'sub_dimension','accion','monto_solicitado','monto_real','estado',
    'fecha_recepcion','orden_compra','rut_proveedor','numero_factura',
    'evidencia','observacion'
  ];
  v_col     text;
  v_old_val text;
  v_new_val text;
  v_nombre  text;
BEGIN
  SELECT nombre, rol INTO v_usuario_nombre, v_usuario_rol
  FROM usuarios WHERE id = auth.uid();
  v_usuario_nombre := COALESCE(v_usuario_nombre, 'Sistema');

  IF TG_OP = 'INSERT' THEN
    v_nombre := COALESCE(
      NULLIF(NEW.numero_req, ''),
      '#' || NEW.id::text
    ) || ' — ' || LEFT(COALESCE(NEW.contenido, ''), 60);
    INSERT INTO audit_logs (bien_id, bien_nombre, categoria, accion, cambios, usuario_id, usuario_nombre, usuario_rol, modulo)
    VALUES (NEW.id, v_nombre, NEW.fondo, 'crear', '[]'::jsonb, auth.uid(), v_usuario_nombre, v_usuario_rol, 'requerimientos');

  ELSIF TG_OP = 'UPDATE' THEN
    FOREACH v_col IN ARRAY v_campos LOOP
      v_old_val := to_jsonb(OLD) ->> v_col;
      v_new_val := to_jsonb(NEW) ->> v_col;
      IF v_old_val IS DISTINCT FROM v_new_val THEN
        v_cambios := v_cambios || jsonb_build_array(
          jsonb_build_object('campo', v_col, 'anterior', v_old_val, 'nuevo', v_new_val)
        );
      END IF;
    END LOOP;
    IF jsonb_array_length(v_cambios) > 0 THEN
      v_nombre := COALESCE(
        NULLIF(COALESCE(NEW.numero_req, OLD.numero_req), ''),
        '#' || COALESCE(NEW.id, OLD.id)::text
      ) || ' — ' || LEFT(COALESCE(NEW.contenido, OLD.contenido, ''), 60);
      INSERT INTO audit_logs (bien_id, bien_nombre, categoria, accion, cambios, usuario_id, usuario_nombre, usuario_rol, modulo)
      VALUES (
        COALESCE(NEW.id, OLD.id),
        v_nombre,
        COALESCE(NEW.fondo, OLD.fondo),
        'editar',
        v_cambios,
        auth.uid(),
        v_usuario_nombre,
        v_usuario_rol,
        'requerimientos'
      );
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    v_nombre := COALESCE(
      NULLIF(OLD.numero_req, ''),
      '#' || OLD.id::text
    ) || ' — ' || LEFT(COALESCE(OLD.contenido, ''), 60);
    INSERT INTO audit_logs (bien_id, bien_nombre, categoria, accion, cambios, usuario_id, usuario_nombre, usuario_rol, modulo)
    VALUES (OLD.id, v_nombre, OLD.fondo, 'eliminar', '[]'::jsonb, auth.uid(), v_usuario_nombre, v_usuario_rol, 'requerimientos');
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_audit_requerimientos
  AFTER INSERT OR UPDATE OR DELETE ON requerimientos
  FOR EACH ROW EXECUTE FUNCTION fn_audit_requerimientos();

-- ── 4. Trigger: auditoría de cambios de permisos ─────────────────────────
DROP TRIGGER  IF EXISTS trg_audit_permisos ON permisos_usuario;
DROP FUNCTION IF EXISTS fn_audit_permisos();

CREATE OR REPLACE FUNCTION fn_audit_permisos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_nombre   text;
  v_actor_rol      text;
  v_target_nombre  text;
  v_cambios        jsonb := '[]'::jsonb;
  v_key            text;
  v_old_val        text;
  v_new_val        text;
  v_permisos_keys  text[];
BEGIN
  SELECT nombre, rol INTO v_actor_nombre, v_actor_rol
  FROM usuarios WHERE id = auth.uid();
  v_actor_nombre := COALESCE(v_actor_nombre, 'Sistema');

  -- Nombre del usuario cuyo permiso cambia
  SELECT nombre INTO v_target_nombre
  FROM usuarios WHERE id = COALESCE(NEW.usuario_id, OLD.usuario_id);
  v_target_nombre := COALESCE(v_target_nombre, 'Usuario desconocido');

  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (bien_id, bien_nombre, categoria, accion, cambios, usuario_id, usuario_nombre, usuario_rol, modulo)
    VALUES (NULL, 'Permisos de ' || v_target_nombre, NULL, 'crear', '[]'::jsonb, auth.uid(), v_actor_nombre, v_actor_rol, 'permisos');

  ELSIF TG_OP = 'UPDATE' THEN
    -- Comparar cada clave del objeto permisos
    SELECT array_agg(k) INTO v_permisos_keys
    FROM (
      SELECT DISTINCT jsonb_object_keys(COALESCE(OLD.permisos,'{}')) AS k
      UNION
      SELECT DISTINCT jsonb_object_keys(COALESCE(NEW.permisos,'{}')) AS k
    ) keys;

    IF v_permisos_keys IS NOT NULL THEN
      FOREACH v_key IN ARRAY v_permisos_keys LOOP
        v_old_val := COALESCE(OLD.permisos ->> v_key, 'false');
        v_new_val := COALESCE(NEW.permisos ->> v_key, 'false');
        IF v_old_val IS DISTINCT FROM v_new_val THEN
          v_cambios := v_cambios || jsonb_build_array(
            jsonb_build_object('campo', v_key, 'anterior', v_old_val, 'nuevo', v_new_val)
          );
        END IF;
      END LOOP;
    END IF;

    IF jsonb_array_length(v_cambios) > 0 THEN
      INSERT INTO audit_logs (bien_id, bien_nombre, categoria, accion, cambios, usuario_id, usuario_nombre, usuario_rol, modulo)
      VALUES (NULL, 'Permisos de ' || v_target_nombre, NULL, 'editar', v_cambios, auth.uid(), v_actor_nombre, v_actor_rol, 'permisos');
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_audit_permisos
  AFTER INSERT OR UPDATE ON permisos_usuario
  FOR EACH ROW EXECUTE FUNCTION fn_audit_permisos();

-- ═══════════════════════════════════════════════════════════════════════
--  ✓ Listo. Verifica que aparecen los triggers en la tabla requerimientos
--  y permisos_usuario en el Dashboard de Supabase.
-- ═══════════════════════════════════════════════════════════════════════
