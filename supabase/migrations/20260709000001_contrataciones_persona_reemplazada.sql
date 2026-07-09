-- ═══════════════════════════════════════════════════════════════════════════
-- Requerimiento N°10 — Campo "Persona a reemplazar" en Contrataciones
-- ---------------------------------------------------------------------------
-- Cuando una contratación es de tipo "reemplazo", debe registrar a quién
-- reemplaza. La persona reemplazada DEBE estar registrada en el sistema
-- (tabla `usuarios`), igual que en el módulo de Reemplazos. Se agrega:
--   · persona_reemplazada_id     → FK a public.usuarios(id) ON DELETE SET NULL.
--   · persona_reemplazada_nombre → snapshot del nombre (para conservar el dato
--                                  aunque la referencia cambie/se elimine).
--
-- Aplicar manualmente en Supabase → SQL Editor (workflow del proyecto).
-- Idempotente: reejecutable; corrige una FK previa que apuntara a otra tabla.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.contrataciones
  ADD COLUMN IF NOT EXISTS persona_reemplazada_id uuid,
  ADD COLUMN IF NOT EXISTS persona_reemplazada_nombre text;

-- Asegura que la FK de persona_reemplazada_id apunte a `usuarios` (elimina
-- cualquier FK previa sobre esa columna, p. ej. una versión anterior que
-- referenciaba `contrataciones`).
DO $$
DECLARE v_conname text;
BEGIN
  SELECT c.conname INTO v_conname
  FROM pg_constraint c
  WHERE c.conrelid = 'public.contrataciones'::regclass
    AND c.contype  = 'f'
    AND c.conkey = ARRAY[
      (SELECT a.attnum FROM pg_attribute a
        WHERE a.attrelid = 'public.contrataciones'::regclass
          AND a.attname = 'persona_reemplazada_id')
    ];
  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.contrataciones DROP CONSTRAINT %I', v_conname);
  END IF;
END $$;

ALTER TABLE public.contrataciones
  ADD CONSTRAINT contrataciones_persona_reemplazada_fk
  FOREIGN KEY (persona_reemplazada_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;

-- Índice para búsquedas/joins por la persona reemplazada.
CREATE INDEX IF NOT EXISTS idx_contrataciones_persona_reemplazada
  ON public.contrataciones(persona_reemplazada_id);

-- ─── Rollback ───────────────────────────────────────────────────────────────
-- DROP INDEX IF EXISTS public.idx_contrataciones_persona_reemplazada;
-- ALTER TABLE public.contrataciones
--   DROP CONSTRAINT IF EXISTS contrataciones_persona_reemplazada_fk,
--   DROP COLUMN IF EXISTS persona_reemplazada_id,
--   DROP COLUMN IF EXISTS persona_reemplazada_nombre;
