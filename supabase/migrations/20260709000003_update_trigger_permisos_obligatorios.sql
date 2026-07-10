-- Actualiza el trigger fn_crear_permisos_usuario para incluir los permisos
-- obligatorios (Tickets, Mis Ausencias, Reglamentos) en el fallback hardcoded.
-- El paso principal sigue siendo leer desde permisos_rol; este fallback solo
-- aplica si la tabla no tiene fila para el rol del usuario recién insertado.

CREATE OR REPLACE FUNCTION public.fn_crear_permisos_usuario()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_permisos JSONB;
  -- Permisos obligatorios presentes en TODOS los roles (Mis Ausencias, Tickets, Reglamentos)
  v_obligatorios CONSTANT JSONB := '{
    "ver_propias_ausencias": true, "exportar_ausencias": true,
    "ver_tickets": true, "crear_ticket": true, "editar_ticket": true, "exportar_tickets": true,
    "ver_reglamentos": true, "descargar_reglamentos": true
  }'::JSONB;
BEGIN
  -- 1. Leer permisos del rol desde la tabla viva (editada en Mantenedor de Roles)
  SELECT permisos INTO v_permisos
  FROM public.permisos_rol
  WHERE rol = NEW.rol;

  -- 2. Fallback si el rol no tiene fila en permisos_rol (muy raro en producción)
  IF v_permisos IS NULL THEN
    v_permisos := CASE NEW.rol
      WHEN 'directivo' THEN '{
        "ver_inventario": true, "agregar_bien": true, "editar_bien": true,
        "importar_csv": true, "exportar": true,
        "registrar_prestamo": true, "registrar_incidencia": true,
        "ver_auditoria_inventario": true
      }'::JSONB || v_obligatorios
      WHEN 'soporte' THEN '{
        "gestionar_tickets": true, "eliminar_ticket": true, "ver_alertas_tickets": true
      }'::JSONB || v_obligatorios
      WHEN 'visor_requerimientos' THEN
        '{"ver_tickets": true}'::JSONB
      ELSE
        v_obligatorios
    END;
  END IF;

  -- 3. Insertar solo si no existe aún (el Edge Function puede llegar después y actualizar)
  INSERT INTO public.permisos_usuario (usuario_id, permisos, categorias)
  VALUES (NEW.id, v_permisos, ARRAY['todos'])
  ON CONFLICT (usuario_id) DO NOTHING;

  RETURN NEW;
END;
$$;
