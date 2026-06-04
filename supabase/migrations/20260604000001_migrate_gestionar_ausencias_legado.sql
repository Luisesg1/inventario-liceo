-- ═══════════════════════════════════════════════════════════════════════
--  MIGRACIÓN: eliminar permiso legado gestionar_ausencias
--  Para cada usuario que tenga gestionar_ausencias=true, activa
--  crear_ausencias y editar_ausencias, luego elimina la key legado.
-- ═══════════════════════════════════════════════════════════════════════

UPDATE permisos_usuario
SET permisos = (permisos
  || jsonb_build_object(
       'crear_ausencias', true,
       'editar_ausencias', true
     )
  ) - 'gestionar_ausencias'
WHERE (permisos->>'gestionar_ausencias')::boolean = true;

-- Para el resto de usuarios que tengan la key pero en false, solo eliminarla
UPDATE permisos_usuario
SET permisos = permisos - 'gestionar_ausencias'
WHERE permisos ? 'gestionar_ausencias'
  AND (permisos->>'gestionar_ausencias')::boolean IS NOT TRUE;
