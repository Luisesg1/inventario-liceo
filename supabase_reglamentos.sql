-- ═══════════════════════════════════════════════════════════════════════
--  MÓDULO REGLAMENTOS — Tablas, Storage, RLS, Papelera, Auditoría
--  Ejecutar en Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Tabla principal reglamentos ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS reglamentos (
  id                 BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre             TEXT         NOT NULL,
  descripcion        TEXT,
  categoria          TEXT         NOT NULL DEFAULT 'Otros',
  estado             TEXT         NOT NULL DEFAULT 'Vigente',
  fecha_publicacion  DATE,
  storage_path       TEXT,
  url                TEXT,
  tamano_bytes       BIGINT,
  nombre_archivo     TEXT,
  visitas            INTEGER      NOT NULL DEFAULT 0,
  descargas          INTEGER      NOT NULL DEFAULT 0,
  version_actual     TEXT         NOT NULL DEFAULT '1.0',
  creado_por         UUID         REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_por_nombre  TEXT,
  creado_en          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  actualizado_en     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  -- Soft delete (integración papelera)
  is_deleted         BOOLEAN      NOT NULL DEFAULT FALSE,
  deleted_at         TIMESTAMPTZ,
  deleted_by         UUID,
  deleted_by_nombre  TEXT
);

-- ── 2. Tabla de historial de versiones ──────────────────────────────────
CREATE TABLE IF NOT EXISTS reglamentos_versiones (
  id                 BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reglamento_id      BIGINT       NOT NULL REFERENCES reglamentos(id) ON DELETE CASCADE,
  version            TEXT         NOT NULL,
  storage_path       TEXT         NOT NULL,
  url                TEXT         NOT NULL,
  nombre_archivo     TEXT,
  tamano_bytes       BIGINT,
  notas              TEXT,
  creado_por         UUID         REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_por_nombre  TEXT,
  creado_en          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── 3. Índices ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_reglamentos_categoria  ON reglamentos(categoria);
CREATE INDEX IF NOT EXISTS idx_reglamentos_estado     ON reglamentos(estado);
CREATE INDEX IF NOT EXISTS idx_reglamentos_is_deleted ON reglamentos(is_deleted);
CREATE INDEX IF NOT EXISTS idx_reglamentos_papelera   ON reglamentos(deleted_at) WHERE is_deleted = TRUE;
CREATE INDEX IF NOT EXISTS idx_reglamentos_creado_en  ON reglamentos(creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_reg_versiones_reg_id   ON reglamentos_versiones(reglamento_id);

-- ── 4. RLS ─────────────────────────────────────────────────────────────
ALTER TABLE reglamentos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE reglamentos_versiones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reglamentos_select"     ON reglamentos;
DROP POLICY IF EXISTS "reglamentos_insert"     ON reglamentos;
DROP POLICY IF EXISTS "reglamentos_update"     ON reglamentos;
DROP POLICY IF EXISTS "reglamentos_delete"     ON reglamentos;
DROP POLICY IF EXISTS "reg_versiones_select"   ON reglamentos_versiones;
DROP POLICY IF EXISTS "reg_versiones_insert"   ON reglamentos_versiones;
DROP POLICY IF EXISTS "reg_versiones_delete"   ON reglamentos_versiones;

CREATE POLICY "reglamentos_select"   ON reglamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "reglamentos_insert"   ON reglamentos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "reglamentos_update"   ON reglamentos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "reglamentos_delete"   ON reglamentos FOR DELETE TO authenticated USING (true);
CREATE POLICY "reg_versiones_select" ON reglamentos_versiones FOR SELECT TO authenticated USING (true);
CREATE POLICY "reg_versiones_insert" ON reglamentos_versiones FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "reg_versiones_delete" ON reglamentos_versiones FOR DELETE TO authenticated USING (true);

-- ── 5. Extender constraint audit_logs para nuevas acciones ───────────────
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_accion_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_accion_check CHECK (
  accion IN (
    'crear', 'editar', 'eliminar', 'baja',
    'enviado_a_papelera', 'restaurado',
    'eliminado_permanente_manual', 'eliminado_permanente_auto',
    'descargar', 'nueva_version'
  )
);

-- ── 6. Actualizar get_papelera para incluir reglamentos ──────────────────
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
      FROM permisos_rol pr JOIN usuarios u ON u.rol = pr.rol
      WHERE u.id = v_uid LIMIT 1;
    END IF;

    IF NOT COALESCE(v_tiene_perm, FALSE) THEN
      RAISE EXCEPTION 'access_denied';
    END IF;
  END IF;

  RETURN QUERY
  SELECT b.id::TEXT, 'bienes'::TEXT, 'inventario'::TEXT,
    COALESCE(b.nombre, 'Sin nombre'),
    b.deleted_at, b.deleted_by, b.deleted_by_nombre,
    b.deleted_at + INTERVAL '30 days',
    GREATEST(0, CEIL(EXTRACT(EPOCH FROM (b.deleted_at + INTERVAL '30 days' - NOW())) / 86400))::INTEGER
  FROM bienes b WHERE b.is_deleted = TRUE AND b.deleted_at IS NOT NULL

  UNION ALL

  SELECT t.id::TEXT, 'tickets'::TEXT, 'tickets'::TEXT,
    COALESCE(t.titulo, 'Sin título'),
    t.deleted_at, t.deleted_by, t.deleted_by_nombre,
    t.deleted_at + INTERVAL '30 days',
    GREATEST(0, CEIL(EXTRACT(EPOCH FROM (t.deleted_at + INTERVAL '30 days' - NOW())) / 86400))::INTEGER
  FROM tickets t WHERE t.is_deleted = TRUE AND t.deleted_at IS NOT NULL

  UNION ALL

  SELECT a.id::TEXT, 'ausencias'::TEXT, 'ausencias'::TEXT,
    COALESCE(a.snapshot_nombre, 'Ausencia') || COALESCE(' — ' || a.tipo, ''),
    a.deleted_at, a.deleted_by, a.deleted_by_nombre,
    a.deleted_at + INTERVAL '30 days',
    GREATEST(0, CEIL(EXTRACT(EPOCH FROM (a.deleted_at + INTERVAL '30 days' - NOW())) / 86400))::INTEGER
  FROM ausencias a WHERE a.is_deleted = TRUE AND a.deleted_at IS NOT NULL

  UNION ALL

  SELECT r.id::TEXT, 'requerimientos'::TEXT, 'requerimientos'::TEXT,
    'Req. N° ' || COALESCE(r.numero_req::TEXT, r.id::TEXT),
    r.deleted_at, r.deleted_by, r.deleted_by_nombre,
    r.deleted_at + INTERVAL '30 days',
    GREATEST(0, CEIL(EXTRACT(EPOCH FROM (r.deleted_at + INTERVAL '30 days' - NOW())) / 86400))::INTEGER
  FROM requerimientos r WHERE r.is_deleted = TRUE AND r.deleted_at IS NOT NULL

  UNION ALL

  SELECT dc.id::TEXT, 'dias_compensatorios'::TEXT, 'compensatorios'::TEXT,
    'Compensatorio — ' || COALESCE(TO_CHAR(dc.fecha_ganado, 'DD/MM/YYYY'), dc.id::TEXT),
    dc.deleted_at, dc.deleted_by, dc.deleted_by_nombre,
    dc.deleted_at + INTERVAL '30 days',
    GREATEST(0, CEIL(EXTRACT(EPOCH FROM (dc.deleted_at + INTERVAL '30 days' - NOW())) / 86400))::INTEGER
  FROM dias_compensatorios dc WHERE dc.is_deleted = TRUE AND dc.deleted_at IS NOT NULL

  UNION ALL

  SELECT rg.id::TEXT, 'reglamentos'::TEXT, 'reglamentos'::TEXT,
    COALESCE(rg.nombre, 'Documento'),
    rg.deleted_at, rg.deleted_by, rg.deleted_by_nombre,
    rg.deleted_at + INTERVAL '30 days',
    GREATEST(0, CEIL(EXTRACT(EPOCH FROM (rg.deleted_at + INTERVAL '30 days' - NOW())) / 86400))::INTEGER
  FROM reglamentos rg WHERE rg.is_deleted = TRUE AND rg.deleted_at IS NOT NULL

  ORDER BY 5 DESC;
END;
$$;

-- ── 7. Actualizar limpiar_papelera_expirada para incluir reglamentos ──────
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
  FOR r IN SELECT id, COALESCE(nombre, 'Registro ' || id::TEXT) AS nom FROM bienes
    WHERE is_deleted = TRUE AND deleted_at IS NOT NULL AND deleted_at + INTERVAL '30 days' <= NOW()
  LOOP
    INSERT INTO audit_logs (bien_id, bien_nombre, accion, cambios, usuario_nombre, usuario_rol, modulo, creado_en)
    VALUES (r.id, r.nom, 'eliminado_permanente_auto', '{"sistema": true}'::jsonb, 'Sistema', 'sistema', 'inventario', NOW());
    DELETE FROM bienes WHERE id = r.id;
    v_total := v_total + 1;
  END LOOP;

  FOR r IN SELECT id, COALESCE(titulo, 'Ticket ' || id::TEXT) AS nom FROM tickets
    WHERE is_deleted = TRUE AND deleted_at IS NOT NULL AND deleted_at + INTERVAL '30 days' <= NOW()
  LOOP
    INSERT INTO audit_logs (bien_nombre, accion, cambios, usuario_nombre, usuario_rol, modulo, creado_en)
    VALUES (r.nom, 'eliminado_permanente_auto', '{"sistema": true}'::jsonb, 'Sistema', 'sistema', 'tickets', NOW());
    DELETE FROM tickets WHERE id = r.id;
    v_total := v_total + 1;
  END LOOP;

  FOR r IN SELECT id, COALESCE(snapshot_nombre, 'Ausencia') AS nom FROM ausencias
    WHERE is_deleted = TRUE AND deleted_at IS NOT NULL AND deleted_at + INTERVAL '30 days' <= NOW()
  LOOP
    INSERT INTO audit_logs (bien_nombre, accion, cambios, usuario_nombre, usuario_rol, modulo, creado_en)
    VALUES (r.nom, 'eliminado_permanente_auto', '{"sistema": true}'::jsonb, 'Sistema', 'sistema', 'ausencias', NOW());
    DELETE FROM ausencias WHERE id = r.id;
    v_total := v_total + 1;
  END LOOP;

  FOR r IN SELECT id, 'Req. N° ' || COALESCE(numero_req::TEXT, id::TEXT) AS nom FROM requerimientos
    WHERE is_deleted = TRUE AND deleted_at IS NOT NULL AND deleted_at + INTERVAL '30 days' <= NOW()
  LOOP
    INSERT INTO audit_logs (bien_nombre, accion, cambios, usuario_nombre, usuario_rol, modulo, creado_en)
    VALUES (r.nom, 'eliminado_permanente_auto', '{"sistema": true}'::jsonb, 'Sistema', 'sistema', 'requerimientos', NOW());
    DELETE FROM requerimientos WHERE id = r.id;
    v_total := v_total + 1;
  END LOOP;

  FOR r IN SELECT id, 'Compensatorio — ' || COALESCE(TO_CHAR(fecha_ganado, 'DD/MM/YYYY'), id::TEXT) AS nom FROM dias_compensatorios
    WHERE is_deleted = TRUE AND deleted_at IS NOT NULL AND deleted_at + INTERVAL '30 days' <= NOW()
  LOOP
    INSERT INTO audit_logs (bien_nombre, accion, cambios, usuario_nombre, usuario_rol, modulo, creado_en)
    VALUES (r.nom, 'eliminado_permanente_auto', '{"sistema": true}'::jsonb, 'Sistema', 'sistema', 'compensatorios', NOW());
    DELETE FROM dias_compensatorios WHERE id = r.id;
    v_total := v_total + 1;
  END LOOP;

  FOR r IN SELECT id, COALESCE(nombre, 'Documento ' || id::TEXT) AS nom FROM reglamentos
    WHERE is_deleted = TRUE AND deleted_at IS NOT NULL AND deleted_at + INTERVAL '30 days' <= NOW()
  LOOP
    INSERT INTO audit_logs (bien_nombre, accion, cambios, usuario_nombre, usuario_rol, modulo, creado_en)
    VALUES (r.nom, 'eliminado_permanente_auto', '{"sistema": true}'::jsonb, 'Sistema', 'sistema', 'reglamentos', NOW());
    DELETE FROM reglamentos WHERE id = r.id;
    v_total := v_total + 1;
  END LOOP;

  RETURN v_total;
END;
$$;

-- ── 8. Storage bucket reglamentos ────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'reglamentos', 'reglamentos', TRUE, 52428800,
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.ms-excel'
  ]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "reglamentos_storage_read"   ON storage.objects;
DROP POLICY IF EXISTS "reglamentos_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "reglamentos_storage_delete" ON storage.objects;

CREATE POLICY "reglamentos_storage_read"   ON storage.objects FOR SELECT   TO authenticated USING (bucket_id = 'reglamentos');
CREATE POLICY "reglamentos_storage_insert" ON storage.objects FOR INSERT   TO authenticated WITH CHECK (bucket_id = 'reglamentos');
CREATE POLICY "reglamentos_storage_delete" ON storage.objects FOR DELETE   TO authenticated USING (bucket_id = 'reglamentos');

-- ── 9. Agregar permisos de reglamentos a permisos_rol ────────────────────
UPDATE permisos_rol
SET permisos = permisos || jsonb_build_object(
  'ver_reglamentos',               TRUE,
  'crear_reglamentos',             TRUE,
  'editar_reglamentos',            TRUE,
  'eliminar_reglamentos',          TRUE,
  'descargar_reglamentos',         TRUE,
  'gestionar_versiones_reglamentos', TRUE,
  'ver_auditoria_reglamentos',     TRUE
), updated_at = NOW()
WHERE rol = 'admin';

UPDATE permisos_rol
SET permisos = permisos || jsonb_build_object(
  'ver_reglamentos',               FALSE,
  'crear_reglamentos',             FALSE,
  'editar_reglamentos',            FALSE,
  'eliminar_reglamentos',          FALSE,
  'descargar_reglamentos',         FALSE,
  'gestionar_versiones_reglamentos', FALSE,
  'ver_auditoria_reglamentos',     FALSE
), updated_at = NOW()
WHERE rol != 'admin';

-- ═══════════════════════════════════════════════════════════════════════
--  ✓ Listo. Verifica que las tablas reglamentos y reglamentos_versiones
--  aparecen en el Dashboard de Supabase, el bucket 'reglamentos' fue
--  creado en Storage, y que get_papelera() incluye reglamentos.
-- ═══════════════════════════════════════════════════════════════════════
