-- ══════════════════════════════════════════════════════════
--  Tickets — Liceo JHJ
--  Ejecutar en Supabase SQL Editor
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tickets (
  id                bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  titulo            text        NOT NULL,
  descripcion       text,
  bien_id           bigint      REFERENCES bienes(id) ON DELETE SET NULL,
  bien_nombre       text,
  prioridad         text        NOT NULL DEFAULT 'media'
                    CHECK (prioridad IN ('baja', 'media', 'alta')),
  estado            text        NOT NULL DEFAULT 'Abierto'
                    CHECK (estado IN ('Abierto', 'En proceso', 'Resuelto')),
  notas             text,
  creado_por        uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  creado_por_nombre text        NOT NULL,
  creado_en         timestamptz NOT NULL DEFAULT now(),
  actualizado_en    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tickets_estado_idx    ON tickets(estado);
CREATE INDEX IF NOT EXISTS tickets_prioridad_idx ON tickets(prioridad);
CREATE INDEX IF NOT EXISTS tickets_bien_id_idx   ON tickets(bien_id);

CREATE OR REPLACE FUNCTION fn_set_tickets_actualizado_en()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.actualizado_en = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_tickets_actualizado_en ON tickets;
CREATE TRIGGER trg_tickets_actualizado_en
  BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION fn_set_tickets_actualizado_en();

ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tickets_select" ON tickets FOR SELECT TO authenticated USING (true);
CREATE POLICY "tickets_insert" ON tickets FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "tickets_update" ON tickets FOR UPDATE TO authenticated USING (true);
CREATE POLICY "tickets_delete" ON tickets FOR DELETE TO authenticated USING (true);

-- ══════════════════════════════════════════════════════════
--  Migraciones
-- ══════════════════════════════════════════════════════════

-- 1. Historial de notas (array JSON de { texto, fecha })
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS notas_historial jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2. Prioridad puede ser NULL (sin asignar)
ALTER TABLE tickets
  ALTER COLUMN prioridad DROP NOT NULL,
  ALTER COLUMN prioridad SET DEFAULT NULL;
