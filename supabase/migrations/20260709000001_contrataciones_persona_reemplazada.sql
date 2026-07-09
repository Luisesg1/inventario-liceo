-- ═══════════════════════════════════════════════════════════════════════════
-- Requerimiento N°10 — Campo "Persona a reemplazar" en Contrataciones
-- ---------------------------------------------------------------------------
-- Cuando una contratación es de tipo "reemplazo", debe registrar a quién
-- reemplaza. Se agrega:
--   · persona_reemplazada_id     → FK a la contratación de la persona reemplazada
--                                  (ON DELETE SET NULL para no perder el registro).
--   · persona_reemplazada_nombre → snapshot del nombre (mismo patrón que
--                                  reemplazos.reemplazante_nombre) para conservar
--                                  el dato aunque la referencia cambie/se elimine.
--
-- Aplicar manualmente en Supabase → SQL Editor (workflow del proyecto).
-- Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.contrataciones
  ADD COLUMN IF NOT EXISTS persona_reemplazada_id uuid
    REFERENCES public.contrataciones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS persona_reemplazada_nombre text;

-- Índice para búsquedas/joins por la persona reemplazada.
CREATE INDEX IF NOT EXISTS idx_contrataciones_persona_reemplazada
  ON public.contrataciones(persona_reemplazada_id);

-- ─── Rollback ───────────────────────────────────────────────────────────────
-- DROP INDEX IF EXISTS public.idx_contrataciones_persona_reemplazada;
-- ALTER TABLE public.contrataciones
--   DROP COLUMN IF EXISTS persona_reemplazada_id,
--   DROP COLUMN IF EXISTS persona_reemplazada_nombre;
