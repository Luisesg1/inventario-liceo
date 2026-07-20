-- ═══════════════════════════════════════════════════════════════════════════
-- RPC set_cuenta_activa — activa o desactiva una cuenta de usuario
-- ---------------------------------------------------------------------------
-- El UPDATE directo en `usuarios` pasa la política `usuarios_update`, que
-- incluye crear_ausencias / editar_ausencias entre sus condiciones. Eso
-- permite a un gestor de ausencias desactivar cuentas ajenas, lo cual no
-- corresponde. Esta función restringe la acción solo a admin o gestionar_usuarios.
--
-- Aplicar manualmente en el SQL Editor de Supabase.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.set_cuenta_activa(
  p_usuario_id uuid,
  p_activo     boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.es_admin() OR public.tiene_permiso('gestionar_usuarios')) THEN
    RAISE EXCEPTION 'Sin permiso para activar o desactivar cuentas';
  END IF;

  IF p_usuario_id = auth.uid() THEN
    RAISE EXCEPTION 'No puedes modificar el estado de tu propia cuenta';
  END IF;

  UPDATE public.usuarios
     SET activo = p_activo
   WHERE id = p_usuario_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_cuenta_activa(uuid, boolean) TO authenticated;
