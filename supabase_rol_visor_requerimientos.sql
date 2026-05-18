-- ══════════════════════════════════════════════════════════
--  Rol visor_requerimientos
--  Ejecutar en Supabase → SQL Editor (solo si hay CHECK en usuarios.rol)
-- ══════════════════════════════════════════════════════════

-- Si la columna rol tiene restricción CHECK, ampliarla así:
-- ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
-- ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check
--   CHECK (rol IN (
--     'admin', 'editor', 'encargado', 'docente', 'soporte', 'visor_requerimientos'
--   ));

-- El rol se asigna desde Gestión de usuarios en la app.
-- Acceso: Requerimientos (solo lectura) + Tickets (propios).
