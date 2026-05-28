-- Agrega 'soporte' a la lista de roles válidos en la columna rol de la tabla usuarios.
-- Primero elimina el constraint existente (si existe), luego lo recrea con el valor incluido.

DO $$
DECLARE
  v_conname text;
BEGIN
  SELECT c.conname INTO v_conname
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  JOIN pg_namespace n ON t.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND t.relname  = 'usuarios'
    AND c.contype  = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%rol%';

  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.usuarios DROP CONSTRAINT %I', v_conname);
  END IF;
END $$;

ALTER TABLE public.usuarios
  ADD CONSTRAINT usuarios_rol_check CHECK (
    rol IN (
      'admin', 'directivo', 'coordinador', 'docente', 'asistente', 'administrativo',
      'soporte',
      'encargado_inventario', 'encargado_soporte', 'encargado_permisos',
      'editor', 'encargado', 'visor_requerimientos'
    )
  );
