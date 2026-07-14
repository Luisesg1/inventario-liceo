-- ============================================================
-- 1. Normalizar externo_rut y snapshot_rut existentes en ausencias
--    (quitar puntos, guiones, espacios — dejar solo dígitos + K)
-- ============================================================
UPDATE public.ausencias
SET externo_rut = regexp_replace(upper(externo_rut), '[^0-9K]', '', 'g')
WHERE externo_rut IS NOT NULL
  AND externo_rut <> regexp_replace(upper(externo_rut), '[^0-9K]', '', 'g');

UPDATE public.ausencias
SET snapshot_rut = regexp_replace(upper(snapshot_rut), '[^0-9K]', '', 'g')
WHERE snapshot_rut IS NOT NULL
  AND snapshot_rut <> regexp_replace(upper(snapshot_rut), '[^0-9K]', '', 'g');

-- ============================================================
-- 2. Trigger: sincronizar usuarios → contrataciones
--    Cuando cambia nombre o email en usuarios, propagar a
--    contrataciones donde el RUT coincida.
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_contrataciones_desde_usuarios()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rut_norm text;
BEGIN
  -- Solo actuar si cambió nombre o email
  IF (NEW.nombre IS NOT DISTINCT FROM OLD.nombre) AND
     (NEW.email  IS NOT DISTINCT FROM OLD.email)  THEN
    RETURN NEW;
  END IF;

  -- Normalizar RUT para hacer el match (sin puntos ni guiones)
  rut_norm := regexp_replace(upper(COALESCE(NEW.rut, '')), '[^0-9K]', '', 'g');
  IF rut_norm = '' THEN
    RETURN NEW;
  END IF;

  UPDATE public.contrataciones
  SET
    nombre_completo = CASE WHEN NEW.nombre IS DISTINCT FROM OLD.nombre THEN NEW.nombre ELSE nombre_completo END,
    correo          = CASE WHEN NEW.email  IS DISTINCT FROM OLD.email  THEN NEW.email  ELSE correo END
  WHERE regexp_replace(upper(COALESCE(rut, '')), '[^0-9K]', '', 'g') = rut_norm;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_contrataciones_desde_usuarios ON public.usuarios;
CREATE TRIGGER trg_sync_contrataciones_desde_usuarios
  AFTER UPDATE OF nombre, email ON public.usuarios
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_contrataciones_desde_usuarios();
