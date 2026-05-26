-- ═══════════════════════════════════════════════════════════════════════
--  AUDITORÍA DE AUSENCIAS — registra altas/ediciones/bajas de la tabla
--  `ausencias` en audit_logs (modulo='ausencias').
--  Requiere supabase_auditoria.sql y supabase_auditoria_modulos.sql.
-- ═══════════════════════════════════════════════════════════════════════

-- ── RLS: ver con permiso ver_auditoria_permisos (mismo que módulo permisos) ──
DROP POLICY IF EXISTS "audit_ausencias_select" ON audit_logs;
CREATE POLICY "audit_ausencias_select" ON audit_logs
  FOR SELECT USING (
    modulo = 'ausencias' AND EXISTS (
      SELECT 1 FROM permisos_usuario
      WHERE usuario_id = auth.uid()
        AND (permisos->>'ver_auditoria_permisos')::boolean = true
    )
  );

-- ── Helpers de etiquetas legibles ───────────────────────────────────────
CREATE OR REPLACE FUNCTION _ausencia_tipo_label(t text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE t
    WHEN 'licencia_medica'        THEN 'Licencia médica'
    WHEN 'permiso_administrativo' THEN 'Permiso administrativo'
    WHEN 'justificativo'          THEN 'Ausencia sin justificar'
    WHEN 'dias_compensatorios'    THEN 'Días compensatorios'
    ELSE COALESCE(t, 'Ausencia') END
$$;

CREATE OR REPLACE FUNCTION _ausencia_jornada_label(j text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE j
    WHEN 'medio_dia'     THEN 'Medio día'
    WHEN 'dia_completo'  THEN 'Día completo'
    WHEN 'personalizado' THEN 'Personalizado'
    WHEN 'reposo'        THEN 'Desde / Hasta'
    ELSE COALESCE(j, '—') END
$$;

-- ── Trigger ──────────────────────────────────────────────────────────────
DROP TRIGGER  IF EXISTS trg_audit_ausencias ON ausencias;
DROP FUNCTION IF EXISTS fn_audit_ausencias();

CREATE OR REPLACE FUNCTION fn_audit_ausencias()
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

  -- Persona afectada (interna, externa o snapshot)
  SELECT nombre INTO v_persona FROM usuarios WHERE id = v_rec.usuario_id;
  v_persona := COALESCE(v_persona, v_rec.externo_nombre, v_rec.snapshot_nombre, 'Funcionario');

  v_nombre := _ausencia_tipo_label(v_rec.tipo) || ' · ' || v_persona;

  IF TG_OP = 'INSERT' THEN
    v_cambios := jsonb_build_array(
      jsonb_build_object('campo','periodo','anterior',NULL,'nuevo',
        to_char(NEW.fecha_inicio,'DD-MM-YYYY') ||
        CASE WHEN NEW.fecha_fin IS DISTINCT FROM NEW.fecha_inicio
             THEN ' → ' || to_char(NEW.fecha_fin,'DD-MM-YYYY') ELSE '' END),
      jsonb_build_object('campo','jornada','anterior',NULL,'nuevo', _ausencia_jornada_label(NEW.jornada))
    );
    IF NEW.notas IS NOT NULL AND NEW.notas <> '' THEN
      v_cambios := v_cambios || jsonb_build_array(
        jsonb_build_object('campo','notas','anterior',NULL,'nuevo', NEW.notas));
    END IF;

    INSERT INTO audit_logs (bien_id, bien_nombre, categoria, accion, cambios, usuario_id, usuario_nombre, usuario_rol, modulo)
    VALUES (NULL, v_nombre, NULL, 'crear', v_cambios, auth.uid(), v_actor_nombre, v_actor_rol, 'ausencias');

  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.tipo IS DISTINCT FROM OLD.tipo THEN
      v_cambios := v_cambios || jsonb_build_array(jsonb_build_object('campo','tipo',
        'anterior', _ausencia_tipo_label(OLD.tipo), 'nuevo', _ausencia_tipo_label(NEW.tipo)));
    END IF;
    IF NEW.fecha_inicio IS DISTINCT FROM OLD.fecha_inicio THEN
      v_cambios := v_cambios || jsonb_build_array(jsonb_build_object('campo','fecha_inicio',
        'anterior', to_char(OLD.fecha_inicio,'DD-MM-YYYY'), 'nuevo', to_char(NEW.fecha_inicio,'DD-MM-YYYY')));
    END IF;
    IF NEW.fecha_fin IS DISTINCT FROM OLD.fecha_fin THEN
      v_cambios := v_cambios || jsonb_build_array(jsonb_build_object('campo','fecha_fin',
        'anterior', to_char(OLD.fecha_fin,'DD-MM-YYYY'), 'nuevo', to_char(NEW.fecha_fin,'DD-MM-YYYY')));
    END IF;
    IF NEW.jornada IS DISTINCT FROM OLD.jornada THEN
      v_cambios := v_cambios || jsonb_build_array(jsonb_build_object('campo','jornada',
        'anterior', _ausencia_jornada_label(OLD.jornada), 'nuevo', _ausencia_jornada_label(NEW.jornada)));
    END IF;
    IF NEW.periodo IS DISTINCT FROM OLD.periodo THEN
      v_cambios := v_cambios || jsonb_build_array(jsonb_build_object('campo','periodo',
        'anterior', OLD.periodo, 'nuevo', NEW.periodo));
    END IF;
    IF NEW.hora_inicio IS DISTINCT FROM OLD.hora_inicio THEN
      v_cambios := v_cambios || jsonb_build_array(jsonb_build_object('campo','hora_inicio',
        'anterior', OLD.hora_inicio, 'nuevo', NEW.hora_inicio));
    END IF;
    IF NEW.hora_fin IS DISTINCT FROM OLD.hora_fin THEN
      v_cambios := v_cambios || jsonb_build_array(jsonb_build_object('campo','hora_fin',
        'anterior', OLD.hora_fin, 'nuevo', NEW.hora_fin));
    END IF;
    IF NEW.notas IS DISTINCT FROM OLD.notas THEN
      v_cambios := v_cambios || jsonb_build_array(jsonb_build_object('campo','notas',
        'anterior', OLD.notas, 'nuevo', NEW.notas));
    END IF;

    IF jsonb_array_length(v_cambios) > 0 THEN
      INSERT INTO audit_logs (bien_id, bien_nombre, categoria, accion, cambios, usuario_id, usuario_nombre, usuario_rol, modulo)
      VALUES (NULL, v_nombre, NULL, 'editar', v_cambios, auth.uid(), v_actor_nombre, v_actor_rol, 'ausencias');
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (bien_id, bien_nombre, categoria, accion, cambios, usuario_id, usuario_nombre, usuario_rol, modulo)
    VALUES (NULL, v_nombre, NULL, 'eliminar', '[]'::jsonb, auth.uid(), v_actor_nombre, v_actor_rol, 'ausencias');
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_audit_ausencias
  AFTER INSERT OR UPDATE OR DELETE ON ausencias
  FOR EACH ROW EXECUTE FUNCTION fn_audit_ausencias();

-- ═══════════════════════════════════════════════════════════════════════
--  ✓ Listo. Las ausencias registradas a partir de ahora aparecerán en la
--  auditoría (modulo='ausencias').
-- ═══════════════════════════════════════════════════════════════════════
