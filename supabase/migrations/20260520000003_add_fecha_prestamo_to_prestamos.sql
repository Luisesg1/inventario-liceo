ALTER TABLE prestamos ADD COLUMN IF NOT EXISTS fecha_prestamo DATE;
ALTER TABLE prestamos ALTER COLUMN fecha_devolucion_esperada DROP NOT NULL;
