-- ══════════════════════════════════════════════════════════
--  Migración: días inhabilitados — origen 'api' + UPDATE policy
--  Ejecutar en Supabase SQL Editor
-- ══════════════════════════════════════════════════════════

-- 1. Permitir origen 'api' (feriados sincronizados desde nager.date)
ALTER TABLE dias_inhabilitados
  DROP CONSTRAINT IF EXISTS dias_inhabilitados_origen_check;

ALTER TABLE dias_inhabilitados
  ADD CONSTRAINT dias_inhabilitados_origen_check
  CHECK (origen IN ('admin', 'api'));

-- 2. Política de actualización (para editar el motivo de cualquier día)
DROP POLICY IF EXISTS "dias_inhabilitados_update" ON dias_inhabilitados;
CREATE POLICY "dias_inhabilitados_update"
  ON dias_inhabilitados FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);
