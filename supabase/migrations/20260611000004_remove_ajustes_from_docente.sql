-- Quita los permisos de Ajustes del rol docente (y roles equivalentes: coordinador,
-- asistente, administrativo). Ajustes es una sección de configuración del sistema
-- que solo deben manejar administradores y soporte.

-- 1. Actualizar la tabla permisos_rol
UPDATE public.permisos_rol
SET permisos = permisos
  - 'gestionar_ajustes'
  - 'ver_ajustes'
  - 'guardar_cambios_ajustes'
  || jsonb_build_object(
       'gestionar_ajustes',       false,
       'ver_ajustes',             false,
       'guardar_cambios_ajustes', false
     )
WHERE rol IN ('docente', 'coordinador', 'asistente', 'administrativo');

-- 2. Actualizar permisos_usuario de todos los usuarios con esos roles
UPDATE public.permisos_usuario pu
SET permisos = pu.permisos
  - 'gestionar_ajustes'
  - 'ver_ajustes'
  - 'guardar_cambios_ajustes'
  || jsonb_build_object(
       'gestionar_ajustes',       false,
       'ver_ajustes',             false,
       'guardar_cambios_ajustes', false
     )
FROM public.usuarios u
WHERE pu.usuario_id = u.id
  AND u.rol IN ('docente', 'coordinador', 'asistente', 'administrativo');
