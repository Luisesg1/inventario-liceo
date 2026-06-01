-- ══════════════════════════════════════════════════════
-- RECUPERACIÓN: restaurar bienes.cantidad desincronizados
-- ══════════════════════════════════════════════════════
-- Ejecutar SOLO SI bienes.cantidad quedó en 0 (u otro valor incorrecto)
-- antes de haber aplicado la migración 000001.
--
-- Lo que hace: suma de vuelta las unidades de los préstamos activos
-- usando COALESCE(cantidad, 1) — si la columna no existía aún, asume 1
-- por registro. Después de esto, aplica 000001 para que los próximos
-- préstamos guarden la cantidad correctamente.
--
-- IMPORTANTE: ejecutar 000001 primero, luego este script.
UPDATE bienes b
SET cantidad = b.cantidad + COALESCE((
    SELECT SUM(COALESCE(p.cantidad, 1))
    FROM prestamos p
    WHERE p.bien_id = b.id
      AND p.fecha_devolucion_real IS NULL
  ), 0)
WHERE b.categoria IN (
  SELECT id FROM categorias
  WHERE lower(label) LIKE '%libro%'
     OR lower(label) LIKE '%libreria%'
     OR lower(label) LIKE '%biblio%'
);
