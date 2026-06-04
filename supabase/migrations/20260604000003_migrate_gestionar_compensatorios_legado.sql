-- ═══════════════════════════════════════════════════════════════════════
--  MIGRACIÓN: eliminar permiso legado gestionar_compensatorios
--  Para cada usuario que tenga gestionar_compensatorios=true, activa
--  crear_compensatorios y editar_compensatorios, luego elimina la key legado.
-- ═══════════════════════════════════════════════════════════════════════

UPDATE permisos_usuario
SET permisos = (permisos
  || jsonb_build_object(
       'crear_compensatorios', true,
       'editar_compensatorios', true
     )
  ) - 'gestionar_compensatorios'
WHERE (permisos->>'gestionar_compensatorios')::boolean = true;

-- Para el resto de usuarios que tengan la key pero en false, solo eliminarla
UPDATE permisos_usuario
SET permisos = permisos - 'gestionar_compensatorios'
WHERE permisos ? 'gestionar_compensatorios'
  AND (permisos->>'gestionar_compensatorios')::boolean IS NOT TRUE;
