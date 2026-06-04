-- ═══════════════════════════════════════════════════════════════════════
--  AUDITORÍA DE COMPENSATORIOS — registra altas/ediciones/bajas de la
--  tabla `dias_compensatorios` en audit_logs (modulo='compensatorios').
--  Requiere supabase_auditoria.sql y supabase_auditoria_modulos.sql.
-- ═══════════════════════════════════════════════════════════════════════

-- ── RLS: ver con permiso ver_auditoria_compensatorios ──────────────────
DROP POLICY IF EXISTS "audit_compensatorios_select" ON audit_logs;
CREATE POLICY "audit_compensatorios_select" ON audit_logs
  FOR SELECT USING (
    modulo = 'compensatorios' AND EXISTS (
      SELECT 1 FROM permisos_usuario
      WHERE usuario_id = auth.uid()
        AND (permisos->>'ver_auditoria_compensatorios')::boolean = true
    )
  );

-- ── Helpers de etiquetas legibles ─────────────────────────────────────
CREATE OR REPLACE FUNCTION _comp_tipo_label(t text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE t
    WHEN 'desfile'                  THEN 'Desfile'
    WHEN 'trabajo_verano'           THEN 'Trabajo de verano'
    WHEN 'actividad_institucional'  THEN 'Actividad institucional'
    WHEN 'reemplazo'                THEN 'Reemplazo'
    WHEN 'otro'                     THEN 'Otro'
    ELSE COALESCE(t, 'Compensatorio') END
$$;

CREATE OR REPLACE FUNCTION _comp_estado_label(e text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE e
    WHEN 'disponible' THEN 'Disponible'
    WHEN 'usado'      THEN 'Usado'
    WHEN 'vencido'    THEN 'Vencido'
    ELSE COALESCE(e, '—') END
$$;

-- ── Trigger ────────────────────────────────────────────────────────────
DROP TRIGGER  IF EXISTS trg_audit_compensatorios ON dias_compensatorios;
DROP FUNCTION IF EXISTS fn_audit_compensatorios();

CREATE OR REPLACE FUNCTION fn_audit_compensatorios()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_nombre text;
  v_actor_rol    text;
  v_persona      text;
  v_nombre       text;
  v_cambios      jsonb := '[]'::jsonb;
  v_rec          record;
BEGIN
  SELECT nombre, rol INTO v_actor_nombre, v_actor_rol FROM usuarios WHERE id = auth.uid();
  v_actor_nombre := COALESCE(v_actor_nombre, 'Sistema');

  v_rec := COALESCE(NEW, OLD);

  SELECT nombre INTO v_persona FROM usuarios WHERE id = v_rec.usuario_id;
  v_persona := COALESCE(v_persona, 'Funcionario');

  v_nombre := _comp_tipo_label(v_rec.tipo) || ' · ' || v_persona;

  IF TG_OP = 'INSERT' THEN
    v_cambios := jsonb_build_array(
      jsonb_build_object('campo','tipo',           'anterior',NULL,'nuevo', _comp_tipo_label(NEW.tipo)),
      jsonb_build_object('campo','cantidad',        'anterior',NULL,'nuevo', NEW.cantidad::text),
      jsonb_build_object('campo','fecha_ganado',    'anterior',NULL,'nuevo', to_char(NEW.fecha_ganado,'DD-MM-YYYY'))
    );
    IF NEW.motivo IS NOT NULL AND NEW.motivo <> '' THEN
      v_cambios := v_cambios || jsonb_build_array(
        jsonb_build_object('campo','motivo','anterior',NULL,'nuevo', NEW.motivo));
    END IF;

    INSERT INTO audit_logs (bien_id, bien_nombre, categoria, accion, cambios, usuario_id, usuario_nombre, usuario_rol, modulo)
    VALUES (NULL, v_nombre, NULL, 'crear', v_cambios, auth.uid(), v_actor_nombre, v_actor_rol, 'compensatorios');

  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.tipo IS DISTINCT FROM OLD.tipo THEN
      v_cambios := v_cambios || jsonb_build_array(jsonb_build_object('campo','tipo',
        'anterior', _comp_tipo_label(OLD.tipo), 'nuevo', _comp_tipo_label(NEW.tipo)));
    END IF;
    IF NEW.cantidad IS DISTINCT FROM OLD.cantidad THEN
      v_cambios := v_cambios || jsonb_build_array(jsonb_build_object('campo','cantidad',
        'anterior', OLD.cantidad::text, 'nuevo', NEW.cantidad::text));
    END IF;
    IF NEW.saldo_restante IS DISTINCT FROM OLD.saldo_restante THEN
      v_cambios := v_cambios || jsonb_build_array(jsonb_build_object('campo','saldo_restante',
        'anterior', OLD.saldo_restante::text, 'nuevo', NEW.saldo_restante::text));
    END IF;
    IF NEW.fecha_ganado IS DISTINCT FROM OLD.fecha_ganado THEN
      v_cambios := v_cambios || jsonb_build_array(jsonb_build_object('campo','fecha_ganado',
        'anterior', to_char(OLD.fecha_ganado,'DD-MM-YYYY'), 'nuevo', to_char(NEW.fecha_ganado,'DD-MM-YYYY')));
    END IF;
    IF NEW.vence_en IS DISTINCT FROM OLD.vence_en THEN
      v_cambios := v_cambios || jsonb_build_array(jsonb_build_object('campo','vence_en',
        'anterior', to_char(OLD.vence_en,'DD-MM-YYYY'), 'nuevo', to_char(NEW.vence_en,'DD-MM-YYYY')));
    END IF;
    IF NEW.motivo IS DISTINCT FROM OLD.motivo THEN
      v_cambios := v_cambios || jsonb_build_array(jsonb_build_object('campo','motivo',
        'anterior', OLD.motivo, 'nuevo', NEW.motivo));
    END IF;
    IF NEW.observaciones IS DISTINCT FROM OLD.observaciones THEN
      v_cambios := v_cambios || jsonb_build_array(jsonb_build_object('campo','observaciones',
        'anterior', OLD.observaciones, 'nuevo', NEW.observaciones));
    END IF;
    IF NEW.estado IS DISTINCT FROM OLD.estado THEN
      v_cambios := v_cambios || jsonb_build_array(jsonb_build_object('campo','estado',
        'anterior', _comp_estado_label(OLD.estado), 'nuevo', _comp_estado_label(NEW.estado)));
    END IF;

    IF jsonb_array_length(v_cambios) > 0 THEN
      INSERT INTO audit_logs (bien_id, bien_nombre, categoria, accion, cambios, usuario_id, usuario_nombre, usuario_rol, modulo)
      VALUES (NULL, v_nombre, NULL, 'editar', v_cambios, auth.uid(), v_actor_nombre, v_actor_rol, 'compensatorios');
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (bien_id, bien_nombre, categoria, accion, cambios, usuario_id, usuario_nombre, usuario_rol, modulo)
    VALUES (NULL, v_nombre, NULL, 'eliminar', '[]'::jsonb, auth.uid(), v_actor_nombre, v_actor_rol, 'compensatorios');
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_audit_compensatorios
  AFTER INSERT OR UPDATE OR DELETE ON dias_compensatorios
  FOR EACH ROW EXECUTE FUNCTION fn_audit_compensatorios();

-- ═══════════════════════════════════════════════════════════════════════
--  ✓ Listo. Los compensatorios registrados a partir de ahora aparecerán
--  en la auditoría (modulo='compensatorios').
-- ═══════════════════════════════════════════════════════════════════════
