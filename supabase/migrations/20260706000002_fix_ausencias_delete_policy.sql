-- ═══════════════════════════════════════════════════════════════════════
--  FIX — Eliminación definitiva de AUSENCIAS desde la Papelera
-- ═══════════════════════════════════════════════════════════════════════
--
--  Problema:
--  La tabla `ausencias` tiene RLS habilitado con políticas de SELECT / INSERT
--  / UPDATE, pero NUNCA se creó una política de DELETE (a diferencia de
--  tickets, reglamentos, dias_inhabilitados, dias_compensatorios…).
--
--  Consecuencia: cuando la Papelera ejecuta un DELETE directo del cliente
--    supabase.from('ausencias').delete().eq('id', …)
--  PostgREST/Postgres, al no encontrar política de DELETE, filtra la fila y
--  elimina 0 registros SIN devolver error. El frontend quitaba la fila de la
--  UI de forma optimista → el registro "desaparecía visualmente" pero seguía
--  vivo en Supabase (registro huérfano que había que borrar a mano).
--
--  El soft-delete y la restauración SÍ funcionaban porque van por
--  soft_delete_ausencia() (SECURITY DEFINER, ignora RLS) y por un UPDATE
--  (política existente), respectivamente.
--
--  Solución (idempotente, no destructiva):
--    1. Política de DELETE para `ausencias`, alineada con el resto de tablas
--       del sistema (FOR DELETE TO authenticated USING (true)). Requisito
--       necesario pero NO suficiente como control de acceso: es demasiado
--       amplia (cualquier autenticado). El control fino vive en la RPC.
--    2. RPC hard_delete_ausencia(): único camino que usa la Papelera. Es
--       SECURITY DEFINER y ANTES de borrar valida en el servidor, con
--       auth.uid() (no con datos que envía el cliente), que el usuario sea
--       admin o tenga el permiso `eliminar_permanentemente` — misma lógica
--       que get_papelera(). Devuelve cuántas filas eliminó para que el
--       frontend detecte fallos en lugar de asumir éxito. La traza en
--       audit_logs la sigue escribiendo la Papelera (log_accion_papelera),
--       igual que para el resto de módulos, para no duplicar registros.
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Asegurar RLS y política de DELETE ────────────────────────────────
ALTER TABLE ausencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ausencias_delete" ON ausencias;
CREATE POLICY "ausencias_delete" ON ausencias
  FOR DELETE TO authenticated USING (true);

-- ── 2. RPC de eliminación definitiva (garantizada + permiso en servidor) ─
--  El parámetro p_id es TEXT porque la Papelera entrega el id como texto
--  (get_papelera lo castea a TEXT). Se convierte a BIGINT dentro de la RPC.
--  La identidad se toma de auth.uid(): no se confía en datos del cliente.
DROP FUNCTION IF EXISTS hard_delete_ausencia(bigint, uuid, text, text);
DROP FUNCTION IF EXISTS hard_delete_ausencia(text, uuid, text, text);
DROP FUNCTION IF EXISTS hard_delete_ausencia(text);

CREATE OR REPLACE FUNCTION hard_delete_ausencia(
  p_id TEXT
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        UUID    := auth.uid();
  v_es_admin   BOOLEAN := FALSE;
  v_tiene_perm BOOLEAN := FALSE;
  v_deleted    INTEGER;
BEGIN
  -- ── Control de acceso en el servidor (misma lógica que get_papelera) ──
  SELECT TRUE INTO v_es_admin
  FROM usuarios WHERE usuarios.id = v_uid AND rol = 'admin';
  v_es_admin := COALESCE(v_es_admin, FALSE);

  IF NOT v_es_admin THEN
    -- Permiso por usuario
    SELECT (permisos->>'eliminar_permanentemente')::boolean INTO v_tiene_perm
    FROM permisos_usuario WHERE usuario_id = v_uid;

    -- Permiso por rol (fallback)
    IF NOT COALESCE(v_tiene_perm, FALSE) THEN
      SELECT (pr.permisos->>'eliminar_permanentemente')::boolean INTO v_tiene_perm
      FROM permisos_rol pr
      JOIN usuarios u ON u.rol = pr.rol
      WHERE u.id = v_uid
      LIMIT 1;
    END IF;

    IF NOT COALESCE(v_tiene_perm, FALSE) THEN
      RAISE EXCEPTION 'access_denied'
        USING HINT = 'Falta el permiso eliminar_permanentemente';
    END IF;
  END IF;

  -- ── Borrado físico garantizado ──
  DELETE FROM ausencias WHERE id = p_id::BIGINT;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════
--  ✓ Tras aplicar: la eliminación definitiva de ausencias borra realmente
--    la fila en Supabase. Ya no quedan registros huérfanos ni hace falta
--    borrarlos manualmente desde el panel de Supabase.
-- ═══════════════════════════════════════════════════════════════════════
