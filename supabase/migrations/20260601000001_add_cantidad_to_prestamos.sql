-- Agrega columna cantidad a prestamos (para préstamos de libros por unidades)
ALTER TABLE prestamos
  ADD COLUMN IF NOT EXISTS cantidad integer NOT NULL DEFAULT 1 CHECK (cantidad > 0);

-- Actualiza devolver_prestamo para restaurar stock opcionalmente
CREATE OR REPLACE FUNCTION devolver_prestamo(
  p_prestamo_id     bigint,
  p_devuelto_por    text,
  p_restaurar_stock boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cantidad integer;
  v_bien_id  bigint;
BEGIN
  SELECT cantidad, bien_id INTO v_cantidad, v_bien_id
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

  -- Restaurar stock en bienes cuando es préstamo de libros
  IF p_restaurar_stock AND v_cantidad > 0 THEN
    UPDATE bienes SET
      cantidad = GREATEST(0, cantidad + v_cantidad)
    WHERE id = v_bien_id;
  END IF;
END;
$$;
