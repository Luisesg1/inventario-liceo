-- Reglas de negocio: RUT, correo y teléfono únicos en todo el sistema.

-- 1. usuarios.rut único (permitir NULL, bloquear duplicados cuando se ingresa)
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_rut_unique
  ON public.usuarios(rut)
  WHERE rut IS NOT NULL AND rut <> '';

-- 2. contrataciones.correo único (cuando se ingresa)
CREATE UNIQUE INDEX IF NOT EXISTS contrataciones_correo_unique
  ON public.contrataciones(correo)
  WHERE correo IS NOT NULL AND correo <> '';

-- 3. contrataciones.telefono único (cuando se ingresa)
CREATE UNIQUE INDEX IF NOT EXISTS contrataciones_telefono_unique
  ON public.contrataciones(telefono)
  WHERE telefono IS NOT NULL AND telefono <> '';

-- 4. reemplazos: agregar columnas de RUT para cumplir regla "RUT es llave principal"
--    funcionario_id/reemplazante_id (UUID) se mantienen como FK de auth.
--    Las columnas _rut permiten cruzar registros históricos aunque el usuario sea borrado.
ALTER TABLE public.reemplazos
  ADD COLUMN IF NOT EXISTS funcionario_rut text,
  ADD COLUMN IF NOT EXISTS reemplazante_rut text;

-- Poblar funcionario_rut y reemplazante_rut desde usuarios existentes
UPDATE public.reemplazos r
SET funcionario_rut = u.rut
FROM public.usuarios u
WHERE r.funcionario_id = u.id AND u.rut IS NOT NULL AND r.funcionario_rut IS NULL;

UPDATE public.reemplazos r
SET reemplazante_rut = u.rut
FROM public.usuarios u
WHERE r.reemplazante_id = u.id AND u.rut IS NOT NULL AND r.reemplazante_rut IS NULL;
