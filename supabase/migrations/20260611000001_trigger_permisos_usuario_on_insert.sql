-- Trigger: crear permisos_usuario automáticamente cuando se inserta un usuario
-- Garantiza que todo usuario recién registrado tenga permisos desde el primer login,
-- independientemente de si el Edge Function register-user logra completar el upsert.

CREATE OR REPLACE FUNCTION public.fn_crear_permisos_usuario()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_permisos JSONB;
BEGIN
  -- 1. Intentar obtener permisos del rol desde permisos_rol
  SELECT permisos INTO v_permisos
  FROM public.permisos_rol
  WHERE rol = NEW.rol;

  -- 2. Si no hay entrada en permisos_rol, usar defaults hardcoded según el rol
  IF v_permisos IS NULL THEN
    v_permisos := CASE NEW.rol
      WHEN 'docente' THEN '{
        "ver_tickets": true, "crear_ticket": true, "editar_ticket": true, "exportar_tickets": true,
        "ver_propias_ausencias": true, "exportar_ausencias": true,
        "gestionar_ajustes": true, "ver_ajustes": true, "guardar_cambios_ajustes": true
      }'::JSONB
      WHEN 'coordinador' THEN '{
        "ver_tickets": true, "crear_ticket": true, "editar_ticket": true, "exportar_tickets": true,
        "ver_propias_ausencias": true, "exportar_ausencias": true,
        "gestionar_ajustes": true, "ver_ajustes": true, "guardar_cambios_ajustes": true
      }'::JSONB
      WHEN 'asistente' THEN '{
        "ver_tickets": true, "crear_ticket": true, "editar_ticket": true, "exportar_tickets": true,
        "ver_propias_ausencias": true, "exportar_ausencias": true,
        "gestionar_ajustes": true, "ver_ajustes": true, "guardar_cambios_ajustes": true
      }'::JSONB
      WHEN 'administrativo' THEN '{
        "ver_tickets": true, "crear_ticket": true, "editar_ticket": true, "exportar_tickets": true,
        "ver_propias_ausencias": true, "exportar_ausencias": true,
        "gestionar_ajustes": true, "ver_ajustes": true, "guardar_cambios_ajustes": true
      }'::JSONB
      WHEN 'soporte' THEN '{
        "ver_tickets": true, "crear_ticket": true, "editar_ticket": true,
        "gestionar_tickets": true, "eliminar_ticket": true, "ver_alertas_tickets": true, "exportar_tickets": true,
        "ver_propias_ausencias": true, "exportar_ausencias": true,
        "gestionar_ajustes": true, "ver_ajustes": true, "guardar_cambios_ajustes": true
      }'::JSONB
      WHEN 'directivo' THEN '{
        "ver_inventario": true, "agregar_bien": true, "editar_bien": true,
        "importar_csv": true, "exportar": true,
        "registrar_prestamo": true, "registrar_incidencia": true,
        "ver_auditoria_inventario": true
      }'::JSONB
      WHEN 'visor_requerimientos' THEN '{"ver_tickets": true}'::JSONB
      ELSE '{}'::JSONB
    END;
  END IF;

  -- 3. Insertar solo si no existe aún (el Edge Function puede llegar después y actualizar)
  INSERT INTO public.permisos_usuario (usuario_id, permisos, categorias)
  VALUES (NEW.id, v_permisos, '["todos"]'::jsonb)
  ON CONFLICT (usuario_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Eliminar trigger anterior si existía
DROP TRIGGER IF EXISTS trg_crear_permisos_usuario ON public.usuarios;

CREATE TRIGGER trg_crear_permisos_usuario
  AFTER INSERT ON public.usuarios
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_crear_permisos_usuario();
