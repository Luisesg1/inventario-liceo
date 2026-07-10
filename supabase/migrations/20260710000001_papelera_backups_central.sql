-- ═══════════════════════════════════════════════════════════════════════
--  REQUERIMIENTO N°15 — Integrar backups en la Papelera central
--  Ejecutar en Supabase Dashboard → SQL Editor (aplicación manual).
-- ───────────────────────────────────────────────────────────────────────
--  Extiende get_papelera() para incluir los respaldos marcados como
--  is_deleted = true en backups_meta. El campo id devuelto es el nombre
--  del archivo (archivo TEXT), que es la PK de backups_meta.
--  Los backups no tienen expiración automática (expira_en = NULL,
--  dias_restantes = NULL).
-- ═══════════════════════════════════════════════════════════════════════

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

  UNION ALL

  -- Backups: sin expiración automática (expira_en y dias_restantes son NULL)
  SELECT
    bm.archivo::TEXT, 'backups_meta'::TEXT, 'backups'::TEXT,
    COALESCE(bm.nombre_personalizado, bm.archivo),
    bm.deleted_at, bm.deleted_by, bm.deleted_by_nombre,
    NULL::TIMESTAMPTZ,
    NULL::INTEGER
  FROM backups_meta bm
  WHERE bm.is_deleted = TRUE AND bm.deleted_at IS NOT NULL

  ORDER BY 5 DESC NULLS LAST;
END;
$$;
