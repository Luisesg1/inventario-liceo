-- ═══════════════════════════════════════════════════════════════════════
--  FUNCIÓN: restaurar_datos_backup
--  Restaura 11 tablas operativas desde un JSONB de backup.
--  Tablas protegidas (NO se tocan): usuarios, permisos_rol,
--  permisos_usuario, audit_logs, auth.users
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION restaurar_datos_backup(datos JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        UUID    := auth.uid();
  v_es_admin   BOOLEAN;
  registros    JSONB;
  n_items      INT;
  resultados   JSONB   := '{}';
  t            TEXT;
  tablas_orden TEXT[]  := ARRAY[
    'configuracion',
    'categorias',
    'dias_inhabilitados',
    'bienes',
    'requerimientos',
    'tickets',
    'ausencias',
    'dias_compensatorios',
    'prestamos',
    'incidencias',
    'actividades'
  ];
BEGIN
  -- Solo administradores autenticados
  SELECT (rol = 'admin') INTO v_es_admin FROM usuarios WHERE id = v_uid;
  IF NOT COALESCE(v_es_admin, FALSE) THEN
    RAISE EXCEPTION 'Solo administradores pueden restaurar backups';
  END IF;

  -- Deshabilitar FK y triggers para esta transacción (se restaura automáticamente al terminar)
  PERFORM set_config('session_replication_role', 'replica', true);

  -- ── Eliminar datos en orden correcto (dependientes primero) ───────────
  DELETE FROM actividades;
  DELETE FROM incidencias;
  DELETE FROM prestamos;
  DELETE FROM dias_compensatorios;
  DELETE FROM ausencias;
  DELETE FROM tickets;
  DELETE FROM requerimientos;
  DELETE FROM dias_inhabilitados;
  DELETE FROM bienes;
  DELETE FROM categorias;
  DELETE FROM configuracion;

  -- ── Insertar desde backup en orden correcto (padres primero) ──────────
  FOREACH t IN ARRAY tablas_orden LOOP
    registros := datos -> t;

    -- Si la tabla no está en el backup, omitir sin error
    IF registros IS NULL OR jsonb_typeof(registros) != 'array' THEN
      resultados := resultados || jsonb_build_object(t, jsonb_build_object('omitido', true));
      CONTINUE;
    END IF;

    n_items := jsonb_array_length(registros);

    IF n_items > 0 THEN
      BEGIN
        EXECUTE format(
          'INSERT INTO %I SELECT * FROM jsonb_populate_recordset(null::%I, $1)',
          t, t
        ) USING registros;
        resultados := resultados || jsonb_build_object(t, jsonb_build_object('ok', true, 'registros', n_items));
      EXCEPTION WHEN OTHERS THEN
        -- Si una tabla falla, reportar el error pero continuar con el resto
        resultados := resultados || jsonb_build_object(t, jsonb_build_object(
          'error', SQLERRM,
          'intentados', n_items
        ));
      END;
    ELSE
      resultados := resultados || jsonb_build_object(t, jsonb_build_object('ok', true, 'registros', 0));
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'tablas', resultados);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM, 'tablas', resultados);
END;
$$;

-- Solo usuarios autenticados pueden invocarla; la función verifica admin internamente
REVOKE ALL ON FUNCTION restaurar_datos_backup(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION restaurar_datos_backup(JSONB) TO authenticated;
