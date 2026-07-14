-- Agrega columnas externo_rut y snapshot_rut a ausencias si no existen.
-- Estas columnas son usadas por la función es_ausencia_propia (RLS) y por
-- Hoja de Vida para buscar ausencias de funcionarios externos.
-- La migración es segura: usa IF NOT EXISTS para no romper si ya existen.

ALTER TABLE public.ausencias
  ADD COLUMN IF NOT EXISTS externo_nombre  text,
  ADD COLUMN IF NOT EXISTS externo_rut     text,
  ADD COLUMN IF NOT EXISTS snapshot_nombre text,
  ADD COLUMN IF NOT EXISTS snapshot_rut    text;

-- Índices para acelerar las búsquedas por RUT en Hoja de Vida
CREATE INDEX IF NOT EXISTS idx_ausencias_externo_rut
  ON public.ausencias (externo_rut)
  WHERE externo_rut IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ausencias_snapshot_rut
  ON public.ausencias (snapshot_rut)
  WHERE snapshot_rut IS NOT NULL;
