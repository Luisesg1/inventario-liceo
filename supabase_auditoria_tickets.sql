-- ═══════════════════════════════════════════════════════════════════════
--  AUDITORÍA — Tickets
--  Ejecutar en Supabase Dashboard → SQL Editor
--  Requiere haber ejecutado supabase_auditoria.sql primero.
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Política RLS para auditoría de tickets ─────────────────────────
DROP POLICY IF EXISTS "audit_tickets_select" ON audit_logs;

-- Admin ve todo. Gestores de tickets también pueden ver la auditoría.
CREATE POLICY "audit_tickets_select" ON audit_logs
  FOR SELECT USING (
    modulo = 'tickets' AND (
      EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
      OR EXISTS (
        SELECT 1 FROM permisos_usuario
        WHERE usuario_id = auth.uid()
          AND (permisos->>'gestionar_tickets')::boolean = true
      )
    )
  );

-- ── 2. Trigger: auditoría de tickets ─────────────────────────────────
DROP TRIGGER  IF EXISTS trg_audit_tickets ON tickets;
DROP FUNCTION IF EXISTS fn_audit_tickets();

CREATE OR REPLACE FUNCTION fn_audit_tickets()
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
    'titulo', 'descripcion', 'area_reporte', 'lugar_falla',
    'marca_modelo_falla', 'prioridad', 'estado', 'notas'
  ];
  v_col     text;
  v_old_val text;
  v_new_val text;
  v_nombre  text;
BEGIN
  SELECT nombre, rol INTO v_usuario_nombre, v_usuario_rol
  FROM usuarios WHERE id = auth.uid();
  v_usuario_nombre := COALESCE(
    v_usuario_nombre,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.creado_por_nombre ELSE NEW.creado_por_nombre END,
    'Sistema'
  );

  IF TG_OP = 'INSERT' THEN
    v_nombre := '#' || NEW.id::text || ' — ' || LEFT(COALESCE(NEW.titulo, ''), 60);
    INSERT INTO audit_logs (bien_id, bien_nombre, categoria, accion, cambios, usuario_id, usuario_nombre, usuario_rol, modulo)
    VALUES (NEW.id, v_nombre, NULL, 'crear', '[]'::jsonb, auth.uid(), v_usuario_nombre, v_usuario_rol, 'tickets');

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
      v_nombre := '#' || COALESCE(NEW.id, OLD.id)::text || ' — ' || LEFT(COALESCE(NEW.titulo, OLD.titulo, ''), 60);
      INSERT INTO audit_logs (bien_id, bien_nombre, categoria, accion, cambios, usuario_id, usuario_nombre, usuario_rol, modulo)
      VALUES (
        COALESCE(NEW.id, OLD.id),
        v_nombre,
        NULL,
        'editar',
        v_cambios,
        auth.uid(),
        v_usuario_nombre,
        v_usuario_rol,
        'tickets'
      );
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    v_nombre := '#' || OLD.id::text || ' — ' || LEFT(COALESCE(OLD.titulo, ''), 60);
    INSERT INTO audit_logs (bien_id, bien_nombre, categoria, accion, cambios, usuario_id, usuario_nombre, usuario_rol, modulo)
    VALUES (OLD.id, v_nombre, NULL, 'eliminar', '[]'::jsonb, auth.uid(), v_usuario_nombre, v_usuario_rol, 'tickets');
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_audit_tickets
  AFTER INSERT OR UPDATE OR DELETE ON tickets
  FOR EACH ROW EXECUTE FUNCTION fn_audit_tickets();

-- ═══════════════════════════════════════════════════════════════════════
--  ✓ Listo. Ejecuta este archivo en el SQL Editor de Supabase.
--  Verifica que el trigger aparece en la tabla tickets.
-- ═══════════════════════════════════════════════════════════════════════
