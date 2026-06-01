-- El disponible se calcula como bienes.cantidad - sum(prestamos.cantidad activos).
-- devolver_prestamo NO debe modificar bienes.cantidad.
CREATE OR REPLACE FUNCTION devolver_prestamo(
  p_prestamo_id     bigint,
  p_devuelto_por    text,
  p_restaurar_stock boolean DEFAULT false  -- mantenido por compatibilidad, ignorado
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE prestamos SET
    fecha_devolucion_real = now(),
    devuelto_por_nombre   = p_devuelto_por,
    actualizado_en        = now()
  WHERE id = p_prestamo_id
    AND fecha_devolucion_real IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Préstamo no encontrado o ya devuelto';
  END IF;
END;
$$;
