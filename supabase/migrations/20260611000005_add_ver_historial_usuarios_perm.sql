-- Agrega permiso ver_historial_usuarios
-- Admin lo recibe habilitado; todos los demás roles lo reciben deshabilitado.

UPDATE permisos_rol
SET permisos = permisos || '{"ver_historial_usuarios": true}'::jsonb,
    updated_at = now()
WHERE rol = 'admin';

UPDATE permisos_rol
SET permisos = permisos || '{"ver_historial_usuarios": false}'::jsonb,
    updated_at = now()
WHERE rol != 'admin';

-- Propagar a permisos_usuario existentes de admins
UPDATE permisos_usuario pu
SET permisos = permisos || '{"ver_historial_usuarios": true}'::jsonb
FROM usuarios u
WHERE u.id = pu.usuario_id AND u.rol = 'admin';
