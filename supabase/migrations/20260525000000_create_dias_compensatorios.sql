-- Tabla: dias_compensatorios
-- Almacena días ganados por desfiles, trabajo de verano, etc.
-- saldo_restante comienza igual a cantidad y se reduce cuando se usan en Ausencias

CREATE TABLE IF NOT EXISTS dias_compensatorios (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id       UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo             TEXT NOT NULL CHECK (tipo IN ('desfile','trabajo_verano','actividad_institucional','reemplazo','otro')),
  cantidad         NUMERIC(4,1) NOT NULL CHECK (cantidad > 0),
  saldo_restante   NUMERIC(4,1) NOT NULL CHECK (saldo_restante >= 0),
  fecha_ganado     DATE NOT NULL,
  vence_en         DATE,
  motivo           TEXT,
  observaciones    TEXT,
  estado           TEXT DEFAULT 'disponible' CHECK (estado IN ('disponible','usado','vencido')),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  created_by       UUID REFERENCES usuarios(id) ON DELETE SET NULL
);

ALTER TABLE dias_compensatorios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comp_all" ON dias_compensatorios USING (true) WITH CHECK (true);
