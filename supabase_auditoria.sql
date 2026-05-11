-- ═══════════════════════════════════════════════════════════════════════
--  AUDITORÍA DE CAMBIOS — Inventario Liceo JHJ
--  Ejecutar completo en Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Tabla audit_logs ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  bien_id       uuid,                          -- puede ser NULL si el bien fue eliminado
  bien_nombre   text        NOT NULL,
  categoria     text,
  accion        text        NOT NULL CHECK (accion IN ('crear','editar','eliminar')),
  cambios       jsonb       NOT NULL DEFAULT '[]'::jsonb,
  usuario_id    uuid,
  usuario_nombre text       NOT NULL DEFAULT 'Sistema',
  dispositivo   text,                          -- user-agent del navegador
  creado_en     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_bien_id   ON audit_logs (bien_id);
CREATE INDEX IF NOT EXISTS idx_audit_usuario   ON audit_logs (usuario_id);
CREATE INDEX IF NOT EXISTS idx_audit_creado_en ON audit_logs (creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_audit_accion    ON audit_logs (accion);

-- ── 2. Row Level Security ────────────────────────────────────────────────
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins leen todo
CREATE POLICY "audit_admin_select" ON audit_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
  );

-- Cada usuario ve sus propios registros
CREATE POLICY "audit_own_select" ON audit_logs
  FOR SELECT USING (usuario_id = auth.uid());

-- Cualquier usuario autenticado puede insertar (lo hace el trigger)
CREATE POLICY "audit_insert" ON audit_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Solo admins pueden actualizar (para añadir dispositivo vía RPC)
CREATE POLICY "audit_update" ON audit_logs
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
    OR usuario_id = auth.uid()
  );

-- Nadie elimina registros de auditoría
-- (no se crea policy DELETE → queda denegado por defecto)

-- ── 3. Función del trigger ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_audit_bienes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario_nombre text;
  v_cambios        jsonb := '[]'::jsonb;
  v_campos         text[] := ARRAY[
    'nombre','categoria','estado','ubicacion','responsable','obs','cantidad',
    'codigo','tipo','marca','modelo','numero_serie','pantalla',
    'cpu','ram','ram_tipo','ram_slots','memoria','tipo_almacenamiento','sistema_operativo',
    'isbn','autor','genero',
    'licencia_windows','win_version','licencia_office','off_version',
    'fecha_adquisicion','proveedor','numero_factura','numero_orden','fondo','garantia',
    'tecnologia','consumible'
  ];
  v_col     text;
  v_old_val text;
  v_new_val text;
BEGIN
  -- Nombre del usuario que realizó la acción
  SELECT nombre INTO v_usuario_nombre
  FROM usuarios WHERE id = auth.uid();
  v_usuario_nombre := COALESCE(v_usuario_nombre, 'Sistema');

  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (bien_id, bien_nombre, categoria, accion, cambios, usuario_id, usuario_nombre)
    VALUES (NEW.id, COALESCE(NEW.nombre,''), NEW.categoria, 'crear', '[]'::jsonb, auth.uid(), v_usuario_nombre);

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
    -- Solo registrar si hubo cambios reales
    IF jsonb_array_length(v_cambios) > 0 THEN
      INSERT INTO audit_logs (bien_id, bien_nombre, categoria, accion, cambios, usuario_id, usuario_nombre)
      VALUES (
        NEW.id,
        COALESCE(NEW.nombre, OLD.nombre, ''),
        COALESCE(NEW.categoria, OLD.categoria),
        'editar',
        v_cambios,
        auth.uid(),
        v_usuario_nombre
      );
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (bien_id, bien_nombre, categoria, accion, cambios, usuario_id, usuario_nombre)
    VALUES (OLD.id, COALESCE(OLD.nombre,''), OLD.categoria, 'eliminar', '[]'::jsonb, auth.uid(), v_usuario_nombre);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ── 4. Trigger sobre tabla bienes ────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_audit_bienes ON bienes;
CREATE TRIGGER trg_audit_bienes
  AFTER INSERT OR UPDATE OR DELETE ON bienes
  FOR EACH ROW EXECUTE FUNCTION fn_audit_bienes();

-- ── 5. RPC: añadir dispositivo (user-agent) desde el frontend ────────────
CREATE OR REPLACE FUNCTION set_audit_dispositivo(p_bien_id uuid, p_dispositivo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE audit_logs
  SET dispositivo = p_dispositivo
  WHERE bien_id   = p_bien_id
    AND usuario_id = auth.uid()
    AND creado_en  > now() - interval '15 seconds'
    AND dispositivo IS NULL
  ;
END;
$$;

-- ── 6. RPC: restaurar un campo a su valor anterior ───────────────────────
CREATE OR REPLACE FUNCTION restaurar_campo_auditoria(p_audit_id uuid, p_campo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bien_id  uuid;
  v_anterior text;
BEGIN
  -- Solo admins pueden restaurar
  IF NOT EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin') THEN
    RAISE EXCEPTION 'No autorizado: solo administradores pueden restaurar cambios';
  END IF;

  -- Obtener bien_id y valor anterior del campo indicado
  SELECT
    bien_id,
    (SELECT c->>'anterior'
     FROM jsonb_array_elements(cambios) c
     WHERE c->>'campo' = p_campo
     LIMIT 1)
  INTO v_bien_id, v_anterior
  FROM audit_logs
  WHERE id = p_audit_id;

  IF v_bien_id IS NULL THEN
    RAISE EXCEPTION 'Registro de auditoría no encontrado';
  END IF;

  -- Aplicar el valor restaurado con columna dinámica segura
  EXECUTE format('UPDATE bienes SET %I = $1 WHERE id = $2', p_campo)
  USING v_anterior, v_bien_id;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════
--  ✓ Listo. Verifica en Table Editor que audit_logs aparece creada.
--  La auditoría empieza a funcionar automáticamente con el trigger.
-- ═══════════════════════════════════════════════════════════════════════
