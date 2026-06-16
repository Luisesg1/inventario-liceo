-- ═══════════════════════════════════════════════════════════════════════
--  SISTEMA DE PAPELERA — Soft Delete + Eliminación automática 30 días
--  Ejecutar en Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Extender constraint de accion en audit_logs ───────────────────────
ALTER TABLE audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_accion_check;

ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_accion_check
  CHECK (accion IN (
    'crear', 'editar', 'eliminar', 'baja',
    'enviado_a_papelera', 'restaurado',
    'eliminado_permanente_manual', 'eliminado_permanente_auto'
  ));

-- ── 2. Soft delete: bienes ───────────────────────────────────────────────
ALTER TABLE bienes
  ADD COLUMN IF NOT EXISTS is_deleted        BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by        UUID,
  ADD COLUMN IF NOT EXISTS deleted_by_nombre TEXT;

-- ── 3. Soft delete: tickets ──────────────────────────────────────────────
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS is_deleted        BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by        UUID,
  ADD COLUMN IF NOT EXISTS deleted_by_nombre TEXT;

-- ── 4. Soft delete: ausencias ────────────────────────────────────────────
ALTER TABLE ausencias
  ADD COLUMN IF NOT EXISTS is_deleted        BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by        UUID,
  ADD COLUMN IF NOT EXISTS deleted_by_nombre TEXT;

-- ── 5. Soft delete: requerimientos ──────────────────────────────────────
ALTER TABLE requerimientos
  ADD COLUMN IF NOT EXISTS is_deleted        BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by        UUID,
  ADD COLUMN IF NOT EXISTS deleted_by_nombre TEXT;

-- ── 6. Soft delete: dias_compensatorios ─────────────────────────────────
ALTER TABLE dias_compensatorios
  ADD COLUMN IF NOT EXISTS is_deleted        BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by        UUID,
  ADD COLUMN IF NOT EXISTS deleted_by_nombre TEXT;

-- ── 7. Índices de rendimiento para consultas de papelera ─────────────────
CREATE INDEX IF NOT EXISTS idx_bienes_papelera
  ON bienes(deleted_at) WHERE is_deleted = TRUE;
CREATE INDEX IF NOT EXISTS idx_tickets_papelera
  ON tickets(deleted_at) WHERE is_deleted = TRUE;
CREATE INDEX IF NOT EXISTS idx_ausencias_papelera
  ON ausencias(deleted_at) WHERE is_deleted = TRUE;
CREATE INDEX IF NOT EXISTS idx_reqs_papelera
  ON requerimientos(deleted_at) WHERE is_deleted = TRUE;
CREATE INDEX IF NOT EXISTS idx_comp_papelera
  ON dias_compensatorios(deleted_at) WHERE is_deleted = TRUE;

-- ── 8. RPC: registrar acción de papelera en audit_logs ──────────────────
CREATE OR REPLACE FUNCTION log_accion_papelera(
  p_registro_id    TEXT,
  p_nombre         TEXT,
  p_accion         TEXT,
  p_usuario_id     UUID,
  p_usuario_nombre TEXT,
  p_usuario_rol    TEXT,
  p_modulo         TEXT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_logs (
    bien_nombre, accion, cambios,
    usuario_id, usuario_nombre, usuario_rol,
    modulo, creado_en
  ) VALUES (
    COALESCE(p_nombre, 'Registro ' || p_registro_id),
    p_accion,
    jsonb_build_object('registro_id', p_registro_id, 'modulo', p_modulo),
    p_usuario_id,
    COALESCE(p_usuario_nombre, 'Sistema'),
    COALESCE(p_usuario_rol, 'sistema'),
    p_modulo,
    NOW()
  );
END;
$$;

-- ── 9. RPC: obtener todos los registros en papelera ─────────────────────
DROP FUNCTION IF EXISTS get_papelera();

CREATE OR REPLACE FUNCTION get_papelera()
RETURNS TABLE (
  id                TEXT,
  tabla             TEXT,
  modulo            TEXT,
  nombre            TEXT,
  deleted_at        TIMESTAMPTZ,
  deleted_by        UUID,
  deleted_by_nombre TEXT,
  expira_en         TIMESTAMPTZ,
  dias_restantes    INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        UUID    := auth.uid();
  v_es_admin   BOOLEAN := FALSE;
  v_tiene_perm BOOLEAN := FALSE;
BEGIN
  SELECT TRUE INTO v_es_admin
  FROM usuarios WHERE usuarios.id = v_uid AND rol = 'admin';
  v_es_admin := COALESCE(v_es_admin, FALSE);

  IF NOT v_es_admin THEN
    SELECT (permisos->>'ver_papelera')::boolean INTO v_tiene_perm
    FROM permisos_usuario WHERE usuario_id = v_uid;

    IF NOT COALESCE(v_tiene_perm, FALSE) THEN
      SELECT (pr.permisos->>'ver_papelera')::boolean INTO v_tiene_perm
      FROM permisos_rol pr
      JOIN usuarios u ON u.rol = pr.rol
      WHERE u.id = v_uid
      LIMIT 1;
    END IF;

    IF NOT COALESCE(v_tiene_perm, FALSE) THEN
      RAISE EXCEPTION 'access_denied';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    b.id::TEXT, 'bienes'::TEXT, 'inventario'::TEXT,
    COALESCE(b.nombre, 'Sin nombre'),
    b.deleted_at, b.deleted_by, b.deleted_by_nombre,
    b.deleted_at + INTERVAL '30 days',
    GREATEST(0, CEIL(EXTRACT(EPOCH FROM (b.deleted_at + INTERVAL '30 days' - NOW())) / 86400))::INTEGER
  FROM bienes b
  WHERE b.is_deleted = TRUE AND b.deleted_at IS NOT NULL

  UNION ALL

  SELECT
    t.id::TEXT, 'tickets'::TEXT, 'tickets'::TEXT,
    COALESCE(t.titulo, 'Sin título'),
    t.deleted_at, t.deleted_by, t.deleted_by_nombre,
    t.deleted_at + INTERVAL '30 days',
    GREATEST(0, CEIL(EXTRACT(EPOCH FROM (t.deleted_at + INTERVAL '30 days' - NOW())) / 86400))::INTEGER
  FROM tickets t
  WHERE t.is_deleted = TRUE AND t.deleted_at IS NOT NULL

  UNION ALL

  SELECT
    a.id::TEXT, 'ausencias'::TEXT, 'ausencias'::TEXT,
    COALESCE(a.snapshot_nombre, 'Ausencia') || COALESCE(' — ' || a.tipo, ''),
    a.deleted_at, a.deleted_by, a.deleted_by_nombre,
    a.deleted_at + INTERVAL '30 days',
    GREATEST(0, CEIL(EXTRACT(EPOCH FROM (a.deleted_at + INTERVAL '30 days' - NOW())) / 86400))::INTEGER
  FROM ausencias a
  WHERE a.is_deleted = TRUE AND a.deleted_at IS NOT NULL

  UNION ALL

  SELECT
    r.id::TEXT, 'requerimientos'::TEXT, 'requerimientos'::TEXT,
    'Req. N° ' || COALESCE(r.numero_req::TEXT, r.id::TEXT),
    r.deleted_at, r.deleted_by, r.deleted_by_nombre,
    r.deleted_at + INTERVAL '30 days',
    GREATEST(0, CEIL(EXTRACT(EPOCH FROM (r.deleted_at + INTERVAL '30 days' - NOW())) / 86400))::INTEGER
  FROM requerimientos r
  WHERE r.is_deleted = TRUE AND r.deleted_at IS NOT NULL

  UNION ALL

  SELECT
    dc.id::TEXT, 'dias_compensatorios'::TEXT, 'compensatorios'::TEXT,
    'Compensatorio — ' || COALESCE(TO_CHAR(dc.fecha_ganado, 'DD/MM/YYYY'), dc.id::TEXT),
    dc.deleted_at, dc.deleted_by, dc.deleted_by_nombre,
    dc.deleted_at + INTERVAL '30 days',
    GREATEST(0, CEIL(EXTRACT(EPOCH FROM (dc.deleted_at + INTERVAL '30 days' - NOW())) / 86400))::INTEGER
  FROM dias_compensatorios dc
  WHERE dc.is_deleted = TRUE AND dc.deleted_at IS NOT NULL

  ORDER BY 5 DESC;
END;
$$;

-- ── 10. Función de limpieza automática por expiración ────────────────────
CREATE OR REPLACE FUNCTION limpiar_papelera_expirada()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INTEGER := 0;
  r       RECORD;
BEGIN
  -- Bienes
  FOR r IN
    SELECT id, COALESCE(nombre, 'Registro ' || id::TEXT) AS nom
    FROM bienes
    WHERE is_deleted = TRUE AND deleted_at IS NOT NULL
      AND deleted_at + INTERVAL '30 days' <= NOW()
  LOOP
    INSERT INTO audit_logs (bien_id, bien_nombre, accion, cambios,
                            usuario_nombre, usuario_rol, modulo, creado_en)
    VALUES (r.id, r.nom, 'eliminado_permanente_auto',
            '{"sistema": true}'::jsonb,
            'Sistema', 'sistema', 'inventario', NOW());
    DELETE FROM bienes WHERE id = r.id;
    v_total := v_total + 1;
  END LOOP;

  -- Tickets
  FOR r IN
    SELECT id, COALESCE(titulo, 'Ticket ' || id::TEXT) AS nom
    FROM tickets
    WHERE is_deleted = TRUE AND deleted_at IS NOT NULL
      AND deleted_at + INTERVAL '30 days' <= NOW()
  LOOP
    INSERT INTO audit_logs (bien_nombre, accion, cambios,
                            usuario_nombre, usuario_rol, modulo, creado_en)
    VALUES (r.nom, 'eliminado_permanente_auto',
            '{"sistema": true}'::jsonb,
            'Sistema', 'sistema', 'tickets', NOW());
    DELETE FROM tickets WHERE id = r.id;
    v_total := v_total + 1;
  END LOOP;

  -- Ausencias
  FOR r IN
    SELECT id, COALESCE(snapshot_nombre, 'Ausencia') AS nom
    FROM ausencias
    WHERE is_deleted = TRUE AND deleted_at IS NOT NULL
      AND deleted_at + INTERVAL '30 days' <= NOW()
  LOOP
    INSERT INTO audit_logs (bien_nombre, accion, cambios,
                            usuario_nombre, usuario_rol, modulo, creado_en)
    VALUES (r.nom, 'eliminado_permanente_auto',
            '{"sistema": true}'::jsonb,
            'Sistema', 'sistema', 'ausencias', NOW());
    DELETE FROM ausencias WHERE id = r.id;
    v_total := v_total + 1;
  END LOOP;

  -- Requerimientos
  FOR r IN
    SELECT id, 'Req. N° ' || COALESCE(numero_req::TEXT, id::TEXT) AS nom
    FROM requerimientos
    WHERE is_deleted = TRUE AND deleted_at IS NOT NULL
      AND deleted_at + INTERVAL '30 days' <= NOW()
  LOOP
    INSERT INTO audit_logs (bien_nombre, accion, cambios,
                            usuario_nombre, usuario_rol, modulo, creado_en)
    VALUES (r.nom, 'eliminado_permanente_auto',
            '{"sistema": true}'::jsonb,
            'Sistema', 'sistema', 'requerimientos', NOW());
    DELETE FROM requerimientos WHERE id = r.id;
    v_total := v_total + 1;
  END LOOP;

  -- Días Compensatorios
  FOR r IN
    SELECT id,
           'Compensatorio — ' || COALESCE(TO_CHAR(fecha_ganado, 'DD/MM/YYYY'), id::TEXT) AS nom
    FROM dias_compensatorios
    WHERE is_deleted = TRUE AND deleted_at IS NOT NULL
      AND deleted_at + INTERVAL '30 days' <= NOW()
  LOOP
    INSERT INTO audit_logs (bien_nombre, accion, cambios,
                            usuario_nombre, usuario_rol, modulo, creado_en)
    VALUES (r.nom, 'eliminado_permanente_auto',
            '{"sistema": true}'::jsonb,
            'Sistema', 'sistema', 'compensatorios', NOW());
    DELETE FROM dias_compensatorios WHERE id = r.id;
    v_total := v_total + 1;
  END LOOP;

  RETURN v_total;
END;
$$;

-- ── 11. Programar limpieza diaria con pg_cron (3:00 AM UTC) ─────────────
-- Nota: requiere extensión pg_cron habilitada en
-- Supabase Dashboard → Database → Extensions → pg_cron
-- Si pg_cron no está disponible, ejecutar manualmente:
--   SELECT limpiar_papelera_expirada();
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('limpiar-papelera-diaria');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    PERFORM cron.schedule(
      'limpiar-papelera-diaria',
      '0 3 * * *',
      'SELECT limpiar_papelera_expirada()'
    );
  END IF;
END $$;

-- ── 12. Agregar permisos de papelera a permisos_rol ─────────────────────
UPDATE permisos_rol
SET permisos = permisos || jsonb_build_object(
    'ver_papelera',           TRUE,
    'restaurar_registros',    TRUE,
    'eliminar_permanentemente', TRUE
  ),
  updated_at = NOW()
WHERE rol = 'admin';

UPDATE permisos_rol
SET permisos = permisos || jsonb_build_object(
    'ver_papelera',           FALSE,
    'restaurar_registros',    FALSE,
    'eliminar_permanentemente', FALSE
  ),
  updated_at = NOW()
WHERE rol != 'admin';
