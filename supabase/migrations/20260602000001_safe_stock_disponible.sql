-- ═══════════════════════════════════════════════════════════════════════
-- STOCK SEGURO: cantidad_total + incrementar_disponible_seguro
-- ═══════════════════════════════════════════════════════════════════════
-- Problema: bienes.cantidad se inflaba más allá del total real del
-- inventario porque las devoluciones añadían un incremento calculado
-- desde notas que podía ser mayor que lo que realmente se había
-- descontado de bienes.cantidad al prestar.
--
-- Solución:
--   1. Añadir bienes.cantidad_total = snapshot del total real (nunca cambia
--      salvo cuando se edita el inventario manualmente).
--   2. Sanar disponibles actuales que ya excedan el total.
--   3. Crear función incrementar_disponible_seguro que aplica LEAST para
--      impedir que disponible > cantidad_total.
--   4. Actualizar devolver_prestamo para usar esa función.
-- ═══════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────
-- 1. Columna cantidad_total
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE bienes ADD COLUMN IF NOT EXISTS cantidad_total integer;

-- Poblar: total real = disponible actual + unidades en préstamos activos
UPDATE bienes b
SET cantidad_total = b.cantidad + COALESCE((
  SELECT SUM(COALESCE(p.cantidad, 1))
  FROM prestamos p
  WHERE p.bien_id = b.id
    AND p.fecha_devolucion_real IS NULL
), 0)
WHERE b.cantidad_total IS NULL;

-- ─────────────────────────────────────────────────────────────────────
-- 2. Auto-sanar: si disponible ya excede total, corregirlo
-- ─────────────────────────────────────────────────────────────────────
UPDATE bienes
SET cantidad = GREATEST(0, LEAST(cantidad, cantidad_total))
WHERE cantidad_total IS NOT NULL
  AND cantidad > cantidad_total;

-- ─────────────────────────────────────────────────────────────────────
-- 3. Función segura de incremento de disponible
--    Garantiza: disponible + incremento nunca supera cantidad_total
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION incrementar_disponible_seguro(
  p_bien_id    bigint,
  p_incremento integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total  integer;
  v_actual integer;
  v_nuevo  integer;
BEGIN
  SELECT COALESCE(cantidad_total, cantidad + p_incremento), cantidad
    INTO v_total, v_actual
  FROM bienes
  WHERE id = p_bien_id;

  -- disponible = LEAST(total, actual + incremento) — nunca supera total
  v_nuevo := GREATEST(0, LEAST(v_total, v_actual + p_incremento));

  UPDATE bienes SET cantidad = v_nuevo WHERE id = p_bien_id;
  RETURN v_nuevo;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 4. Actualizar devolver_prestamo para usar el incremento seguro
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION devolver_prestamo(
  p_prestamo_id     bigint,
  p_devuelto_por    text,
  p_restaurar_stock boolean DEFAULT false  -- mantenido por compatibilidad
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

  -- Restaurar con protección: disponible nunca supera cantidad_total
  PERFORM incrementar_disponible_seguro(v_bien_id, v_cantidad);
END;
$$;
