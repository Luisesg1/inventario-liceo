-- ══════════════════════════════════════════════════════════
--  Préstamos / Asignación Temporal — Liceo JHJ
--  Ejecutar en Supabase SQL Editor
-- ══════════════════════════════════════════════════════════

-- ── 1. Tabla principal ────────────────────────────────────
CREATE TABLE IF NOT EXISTS prestamos (
  id                      bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bien_id                 bigint      NOT NULL REFERENCES bienes(id) ON DELETE CASCADE,
  prestado_a              text        NOT NULL,           -- nombre de quien recibe
  cargo                   text,                           -- ej: "Profesor de Matemáticas"
  fecha_prestamo          timestamptz NOT NULL DEFAULT now(),
  fecha_devolucion_esperada date       NOT NULL,          -- cuándo debe volver
  fecha_devolucion_real   timestamptz,                    -- null = aún prestado
  notas                   text,
  registrado_por          uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  registrado_por_nombre   text        NOT NULL,
  devuelto_por_nombre     text,                           -- quien marcó la devolución
  creado_en               timestamptz NOT NULL DEFAULT now(),
  actualizado_en          timestamptz NOT NULL DEFAULT now()
);

-- ── 2. Índices ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS prestamos_bien_id_idx      ON prestamos(bien_id);
CREATE INDEX IF NOT EXISTS prestamos_activo_idx       ON prestamos(bien_id) WHERE fecha_devolucion_real IS NULL;
CREATE INDEX IF NOT EXISTS prestamos_registrado_idx   ON prestamos(registrado_por);

-- ── 3. Trigger: actualizar_en automático ─────────────────
CREATE OR REPLACE FUNCTION fn_set_actualizado_en()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.actualizado_en = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prestamos_actualizado_en ON prestamos;
CREATE TRIGGER trg_prestamos_actualizado_en
  BEFORE UPDATE ON prestamos
  FOR EACH ROW EXECUTE FUNCTION fn_set_actualizado_en();

-- ── 4. RLS ────────────────────────────────────────────────
ALTER TABLE prestamos ENABLE ROW LEVEL SECURITY;

-- Todos los usuarios autenticados pueden leer préstamos
CREATE POLICY "prestamos_select" ON prestamos
  FOR SELECT TO authenticated USING (true);

-- Cualquier usuario autenticado puede crear un préstamo
CREATE POLICY "prestamos_insert" ON prestamos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- Solo quien lo registró o un admin puede editarlo / marcarlo como devuelto
CREATE POLICY "prestamos_update" ON prestamos
  FOR UPDATE TO authenticated USING (
    registrado_por = auth.uid()
    OR EXISTS (
      SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin'
    )
  );

-- Solo admin puede eliminar registros de préstamos
CREATE POLICY "prestamos_delete" ON prestamos
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin'
    )
  );

-- ── 5. Vista: préstamos activos con datos del bien ────────
CREATE OR REPLACE VIEW v_prestamos_activos AS
SELECT
  p.id,
  p.bien_id,
  b.nombre          AS bien_nombre,
  b.codigo          AS bien_codigo,
  b.categoria       AS bien_categoria,
  p.prestado_a,
  p.cargo,
  p.fecha_prestamo,
  p.fecha_devolucion_esperada,
  p.notas,
  p.registrado_por_nombre,
  p.creado_en,
  -- días restantes (negativo = vencido)
  (p.fecha_devolucion_esperada - CURRENT_DATE) AS dias_restantes
FROM prestamos p
JOIN bienes b ON b.id = p.bien_id
WHERE p.fecha_devolucion_real IS NULL
ORDER BY p.fecha_devolucion_esperada ASC;

-- ── 6. Función: marcar devolución ────────────────────────
CREATE OR REPLACE FUNCTION devolver_prestamo(
  p_prestamo_id   bigint,
  p_devuelto_por  text
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
