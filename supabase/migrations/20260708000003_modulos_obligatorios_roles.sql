-- ═══════════════════════════════════════════════════════════════════════════
-- Requerimiento N°7 — Módulos obligatorios para TODOS los roles
-- ---------------------------------------------------------------------------
-- Mis Ausencias, Tickets y Reglamentos son parte de la configuración base de
-- cualquier rol. Roles como "directivo" tenían estos permisos en false (o
-- ausentes) en `permisos_rol`, y además el motor los vetaba por restricción de
-- rol. Esta migración:
--   1. Fuerza los permisos obligatorios en TODAS las filas de `permisos_rol`.
--   2. Los fuerza en TODAS las filas de `permisos_usuario` (usuarios existentes).
--   3. Blinda el trigger `fn_crear_permisos_usuario` para que todo usuario nuevo
--      los reciba, cualquiera sea la fuente de sus permisos.
--
-- Fuente única de las claves: PERMISOS_OBLIGATORIOS en src/config/permisos.js.
-- El motor (src/utils/permisos.js) además los concede en runtime, por lo que la
-- persistencia aquí es para que la BD y la UI queden consistentes.
--
-- Aplicar manualmente en Supabase → SQL Editor (workflow del proyecto).
-- Idempotente: puede re-ejecutarse sin efectos adversos.
-- ═══════════════════════════════════════════════════════════════════════════

-- JSONB con los módulos obligatorios en true.
--   Mis Ausencias : ver_propias_ausencias, exportar_ausencias
--   Tickets       : ver_tickets, crear_ticket, editar_ticket, exportar_tickets
--   Reglamentos   : ver_reglamentos, descargar_reglamentos

-- 1. Todos los roles (permisos_rol). `permisos || obligatorios` → obligatorios mandan.
UPDATE public.permisos_rol
SET permisos = permisos || '{
  "ver_propias_ausencias": true,
  "exportar_ausencias": true,
  "ver_tickets": true,
  "crear_ticket": true,
  "editar_ticket": true,
  "exportar_tickets": true,
  "ver_reglamentos": true,
  "descargar_reglamentos": true
}'::jsonb,
    updated_at = NOW()
WHERE NOT (permisos @> '{
  "ver_propias_ausencias": true,
  "exportar_ausencias": true,
  "ver_tickets": true,
  "crear_ticket": true,
  "editar_ticket": true,
  "exportar_tickets": true,
  "ver_reglamentos": true,
  "descargar_reglamentos": true
}'::jsonb);

-- 2. Todos los usuarios existentes (permisos_usuario).
UPDATE public.permisos_usuario
SET permisos = permisos || '{
  "ver_propias_ausencias": true,
  "exportar_ausencias": true,
  "ver_tickets": true,
  "crear_ticket": true,
  "editar_ticket": true,
  "exportar_tickets": true,
  "ver_reglamentos": true,
  "descargar_reglamentos": true
}'::jsonb
WHERE NOT (permisos @> '{
  "ver_propias_ausencias": true,
  "exportar_ausencias": true,
  "ver_tickets": true,
  "crear_ticket": true,
  "editar_ticket": true,
  "exportar_tickets": true,
  "ver_reglamentos": true,
  "descargar_reglamentos": true
}'::jsonb);

-- 3. Trigger de alta: garantizar obligatorios en todo usuario nuevo.
CREATE OR REPLACE FUNCTION public.fn_crear_permisos_usuario()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_permisos JSONB;
  v_obligatorios JSONB := '{
    "ver_propias_ausencias": true,
    "exportar_ausencias": true,
    "ver_tickets": true,
    "crear_ticket": true,
    "editar_ticket": true,
    "exportar_tickets": true,
    "ver_reglamentos": true,
    "descargar_reglamentos": true
  }'::jsonb;
BEGIN
  BEGIN
    -- Permisos base del rol desde permisos_rol.
    SELECT permisos INTO v_permisos
    FROM public.permisos_rol
    WHERE rol = NEW.rol;

    -- Si no hay entrada en permisos_rol, defaults hardcoded según el rol.
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

    -- Garantizar SIEMPRE los módulos obligatorios (Mis Ausencias, Tickets, Reglamentos).
    v_permisos := COALESCE(v_permisos, '{}'::jsonb) || v_obligatorios;

    INSERT INTO public.permisos_usuario (usuario_id, permisos, categorias)
    VALUES (NEW.id, v_permisos, ARRAY['todos'])
    ON CONFLICT (usuario_id) DO NOTHING;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'fn_crear_permisos_usuario: no se pudo crear permisos para %, error: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;
