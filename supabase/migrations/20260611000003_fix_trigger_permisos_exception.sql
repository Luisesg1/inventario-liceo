-- Corrige fn_crear_permisos_usuario para que los errores internos NO reviertan
-- la creación del usuario. Si el INSERT en permisos_usuario falla por cualquier
-- motivo (constraint, RLS, etc.), el trigger registra un WARNING y continúa.
-- El Edge Function register-user se encarga de crear los permisos igualmente.

CREATE OR REPLACE FUNCTION public.fn_crear_permisos_usuario()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_permisos JSONB;
BEGIN
  BEGIN
    -- Intentar obtener permisos del rol desde permisos_rol
    SELECT permisos INTO v_permisos
    FROM public.permisos_rol
    WHERE rol = NEW.rol;

    -- Si no hay entrada en permisos_rol, usar defaults hardcoded según el rol
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

    INSERT INTO public.permisos_usuario (usuario_id, permisos, categorias)
    VALUES (NEW.id, v_permisos, '["todos"]'::jsonb)
    ON CONFLICT (usuario_id) DO NOTHING;

  EXCEPTION WHEN OTHERS THEN
    -- No bloquear la creación del usuario si falla el INSERT de permisos.
    -- El Edge Function register-user intentará crearlos igualmente.
    RAISE WARNING 'fn_crear_permisos_usuario: no se pudo crear permisos para %, error: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;
