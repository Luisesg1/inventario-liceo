-- ═══════════════════════════════════════════════════════════════════════════
-- F03 — RPC SECURITY DEFINER para escritura segura en audit_logs
--
-- Problema: el cliente hacía INSERT directo; un usuario podía suplantar a otro
-- pasando un usuario_id distinto al suyo en el payload.
--
-- Solución: función SECURITY DEFINER que deriva usuario_id/nombre/rol desde
-- auth.uid() internamente. El cliente solo pasa los campos del "qué", nunca
-- el "quién". Se elimina la política INSERT permisiva de audit_logs.
--
-- Aplicar manualmente en el SQL Editor de Supabase.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Función RPC ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_auditoria(
  p_accion      text,
  p_modulo      text,
  p_bien_nombre text    DEFAULT NULL,
  p_bien_id     uuid    DEFAULT NULL,
  p_categoria   text    DEFAULT NULL,
  p_cambios     jsonb   DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario_id     uuid;
  v_usuario_nombre text;
  v_usuario_rol    text;
BEGIN
  v_usuario_id := auth.uid();

  SELECT nombre, rol
    INTO v_usuario_nombre, v_usuario_rol
    FROM public.usuarios
   WHERE id = v_usuario_id
   LIMIT 1;

  INSERT INTO public.audit_logs (
    bien_id, bien_nombre, categoria,
    accion, cambios,
    usuario_id, usuario_nombre, usuario_rol,
    modulo
  ) VALUES (
    p_bien_id, p_bien_nombre, p_categoria,
    p_accion, COALESCE(p_cambios, '[]'::jsonb),
    v_usuario_id, v_usuario_nombre, v_usuario_rol,
    p_modulo
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_auditoria(text, text, text, uuid, text, jsonb)
  TO authenticated;

-- ── 2. Eliminar la política INSERT permisiva del cliente ────────────────────
DROP POLICY IF EXISTS "audit_logs_insert" ON public.audit_logs;
