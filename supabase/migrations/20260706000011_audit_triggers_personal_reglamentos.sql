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
