-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN 20260713000004 — Incluir ver_hoja_vida en puede_ver_personal()
-- ──────────────────────────────────────────────────────────────────────────────
-- La función puede_ver_personal() controla la RLS SELECT de contrataciones,
-- reemplazos y personal_documentos. El módulo Hoja de Vida lee contrataciones
-- para construir su listado de funcionarios, pero un usuario con solo
-- ver_hoja_vida no pasaba la política y veía 0 registros.
--
-- Solución: agregar ver_hoja_vida como condición OR adicional.
--
-- Aplicar manualmente en el SQL Editor de Supabase.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.puede_ver_personal()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.tiene_permiso('ver_contrataciones')
      OR public.tiene_permiso('ver_reemplazos')
      OR public.tiene_permiso('ver_documentos_personal')
      OR public.tiene_permiso('ver_hoja_vida');
$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN:
--   Con un usuario que tenga SOLO ver_hoja_vida:
--     SELECT count(*) FROM contrataciones;  → debe devolver todos los registros
--   El listado de Hoja de Vida debe mostrar todos los funcionarios.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── REVERSIÓN ────────────────────────────────────────────────────────────────
-- CREATE OR REPLACE FUNCTION public.puede_ver_personal()
-- RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
-- AS $$ SELECT public.tiene_permiso('ver_contrataciones')
--          OR public.tiene_permiso('ver_reemplazos')
--          OR public.tiene_permiso('ver_documentos_personal'); $$;
