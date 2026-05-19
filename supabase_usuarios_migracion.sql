-- ══════════════════════════════════════════════════════════
--  Migración: permitir múltiples cuentas por RUT
--  Ejecutar en Supabase SQL Editor
-- ══════════════════════════════════════════════════════════

-- Eliminar restricción UNIQUE en rut
-- (el índice se borra automáticamente al soltar el constraint)
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rut_key;
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rut_unique;
