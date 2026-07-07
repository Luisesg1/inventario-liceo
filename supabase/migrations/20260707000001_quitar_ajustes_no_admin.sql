-- ═══════════════════════════════════════════════════════════════════════════
-- AJUSTE DE PERMISOS — "Personalizar" (Ajustes) solo para admin
-- ---------------------------------------------------------------------------
-- El preset original otorgaba gestionar_ajustes/ver_ajustes/guardar_cambios_ajustes
-- a coordinador, docente, asistente, administrativo y soporte, lo que les
-- permitía editar la configuración GLOBAL del sistema (logo, nombre, colores)
-- desde Ajustes → Personalizar. Debe quedar solo para el administrador.
--
-- Con la RLS de configuracion (20260706000009) esos permisos además habilitaban
-- ESCRITURA real del branding vía API, así que esto también cierra ese acceso.
--
-- Se corrige la fuente viva en la BD:
--   1. permisos_rol      → todos los roles distintos de admin.
--   2. permisos_usuario  → todos los usuarios cuyo rol no es admin.
-- El frontend (src/config/permisos.js) ya se actualizó en el mismo cambio.
--
-- App.jsx tiene realtime sobre permisos_usuario, así que los usuarios conectados
-- verán desaparecer el menú Ajustes sin necesidad de recargar.
--
-- NOTA: el fallback hardcodeado del trigger fn_crear_permisos_usuario todavía
-- trae estos permisos en true, pero está inactivo mientras permisos_rol tenga
-- fila para el rol (que la tiene). No se toca para no arriesgar la creación de
-- usuarios. Aplicar manualmente en el SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Fuente por rol
UPDATE public.permisos_rol
SET permisos = permisos || '{"gestionar_ajustes":false,"ver_ajustes":false,"guardar_cambios_ajustes":false}'::jsonb
WHERE rol <> 'admin';

-- 2. Usuarios existentes (por si el permiso quedó fusionado en su JSONB)
UPDATE public.permisos_usuario pu
SET permisos = pu.permisos || '{"gestionar_ajustes":false,"ver_ajustes":false,"guardar_cambios_ajustes":false}'::jsonb
FROM public.usuarios u
WHERE u.id = pu.usuario_id
  AND u.rol <> 'admin';

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN:
--   · Docente conectado: el menú "Ajustes" desaparece (realtime) o al recargar.
--   · Admin: sigue viendo y usando Ajustes → Personalizar.
--   · 🔒 Docente vía API: update configuracion set valor='x' where clave='logo_url'
--       → error de política (ya no tiene guardar_cambios_ajustes/gestionar_ajustes).
-- ═══════════════════════════════════════════════════════════════════════════
