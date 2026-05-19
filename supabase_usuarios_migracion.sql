-- ══════════════════════════════════════════════════════════
--  Migración: permitir múltiples cuentas por RUT
--  Ejecutar en Supabase SQL Editor
-- ══════════════════════════════════════════════════════════

-- Eliminar restricción UNIQUE en rut (si existe)
-- Permite que una persona tenga más de una cuenta con el mismo RUT
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rut_key;
DROP INDEX IF EXISTS usuarios_rut_idx;
DROP INDEX IF EXISTS usuarios_rut_unique;
