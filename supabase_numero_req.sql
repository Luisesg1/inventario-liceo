-- Agregar columna número manual a requerimientos
ALTER TABLE requerimientos ADD COLUMN IF NOT EXISTS numero_req TEXT;
