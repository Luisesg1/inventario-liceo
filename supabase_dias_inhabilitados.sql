-- ══════════════════════════════════════════════════════════
--  Días inhabilitados — Liceo JHJ
--  Feriados extra, puentes, días especiales
--  Ejecutar en Supabase SQL Editor
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS dias_inhabilitados (
  fecha      date        PRIMARY KEY,
  motivo     text        NOT NULL DEFAULT '',
  origen     text        NOT NULL DEFAULT 'admin'
             CHECK (origen IN ('admin')),
  creado_por uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  creado_en  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE dias_inhabilitados ENABLE ROW LEVEL SECURITY;

-- Todos los autenticados pueden ver
CREATE POLICY "dias_inhabilitados_select"
  ON dias_inhabilitados FOR SELECT TO authenticated USING (true);

-- Solo usuarios autenticados pueden insertar/eliminar
-- (el frontend restringe la UI solo a admin)
CREATE POLICY "dias_inhabilitados_insert"
  ON dias_inhabilitados FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "dias_inhabilitados_delete"
  ON dias_inhabilitados FOR DELETE TO authenticated
  USING (true);
