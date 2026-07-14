-- Migración: Estado en contrataciones + campo activo en usuarios
-- Parte 1: estados de contrato, Parte 2: desactivación de cuentas

BEGIN;

-- ═══════════════════════════════════════════════════════════════
-- 1. Columna estado en contrataciones
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE contrataciones
  ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'vigente';

COMMENT ON COLUMN contrataciones.estado IS
  'vigente | por_vencer | finalizado | no_renovado | suspendido';

-- Poblar registros existentes según fecha_termino
UPDATE contrataciones SET estado = 'finalizado'
WHERE fecha_termino IS NOT NULL
  AND fecha_termino::date < CURRENT_DATE;

UPDATE contrataciones SET estado = 'por_vencer'
WHERE fecha_termino IS NOT NULL
  AND fecha_termino::date >= CURRENT_DATE
  AND fecha_termino::date <= (CURRENT_DATE + INTERVAL '30 days');

-- Los que no tienen fecha_termino o están lejos quedan como 'vigente' (default)

-- ═══════════════════════════════════════════════════════════════
-- 2. Campo activo en usuarios (desactivación lógica, distinto de is_deleted)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN usuarios.activo IS
  'false = cuenta desactivada (no puede iniciar sesión), conserva historial. Distinto de is_deleted (papelera).';

-- ═══════════════════════════════════════════════════════════════
-- 3. Índices para consultas frecuentes
-- ═══════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_contrataciones_estado ON contrataciones(estado);
CREATE INDEX IF NOT EXISTS idx_usuarios_activo ON usuarios(activo);

COMMIT;
