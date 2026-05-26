-- Columnas de computadores que faltaban en la tabla
ALTER TABLE bienes ADD COLUMN IF NOT EXISTS tipo_almacenamiento TEXT;
ALTER TABLE bienes ADD COLUMN IF NOT EXISTS ram_slots        TEXT;

-- Licencia Windows
ALTER TABLE bienes ADD COLUMN IF NOT EXISTS licencia_windows    TEXT;
ALTER TABLE bienes ADD COLUMN IF NOT EXISTS win_version         TEXT;
ALTER TABLE bienes ADD COLUMN IF NOT EXISTS win_tipo_licencia   TEXT;
ALTER TABLE bienes ADD COLUMN IF NOT EXISTS win_proveedor       TEXT;
ALTER TABLE bienes ADD COLUMN IF NOT EXISTS win_factura         TEXT;
ALTER TABLE bienes ADD COLUMN IF NOT EXISTS win_fecha_factura   DATE;
ALTER TABLE bienes ADD COLUMN IF NOT EXISTS win_orden           TEXT;

-- Licencia Office
ALTER TABLE bienes ADD COLUMN IF NOT EXISTS licencia_office     TEXT;
ALTER TABLE bienes ADD COLUMN IF NOT EXISTS off_version         TEXT;
ALTER TABLE bienes ADD COLUMN IF NOT EXISTS off_tipo_licencia   TEXT;
ALTER TABLE bienes ADD COLUMN IF NOT EXISTS off_proveedor       TEXT;
ALTER TABLE bienes ADD COLUMN IF NOT EXISTS off_factura         TEXT;
ALTER TABLE bienes ADD COLUMN IF NOT EXISTS off_fecha_factura   DATE;
ALTER TABLE bienes ADD COLUMN IF NOT EXISTS off_orden           TEXT;

-- Columnas de artículos tecnológicos que faltaban
ALTER TABLE bienes ADD COLUMN IF NOT EXISTS tecnologia TEXT;
ALTER TABLE bienes ADD COLUMN IF NOT EXISTS consumible TEXT;
