-- devolver_prestamo restaura bienes.cantidad al devolver un libro.
-- bienes.cantidad representa el disponible real (no el total).
-- El total se computa como bienes.cantidad + sum(prestamos activos).
CREATE OR REPLACE FUNCTION devolver_prestamo(
  p_prestamo_id     bigint,
  p_devuelto_por    text,
  p_restaurar_stock boolean DEFAULT false  -- mantenido por compatibilidad, ahora siempre restaura si hay cantidad
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cantidad integer;
  v_bien_id  bigint;
BEGIN
  SELECT COALESCE(cantidad, 1), bien_id
    INTO v_cantidad, v_bien_id
  FROM prestamos
  WHERE id = p_prestamo_id
    AND fecha_devolucion_real IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Préstamo no encontrado o ya devuelto';
  END IF;

  UPDATE prestamos SET
    fecha_devolucion_real = now(),
    devuelto_por_nombre   = p_devuelto_por,
    actualizado_en        = now()
  WHERE id = p_prestamo_id;

  -- Restaurar stock: bienes.cantidad += cantidad_prestada
  UPDATE bienes SET
    cantidad = GREATEST(0, cantidad + v_cantidad)
  WHERE id = v_bien_id;
END;
$$;
