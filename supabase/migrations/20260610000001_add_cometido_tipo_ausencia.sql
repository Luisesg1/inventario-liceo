-- ═══════════════════════════════════════════════════════════════════════
--  Agrega el tipo de ausencia 'cometido' a la función de etiquetas de
--  auditoría. No requiere cambios en el esquema (ausencias.tipo es TEXT
--  sin CHECK constraint).
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION _ausencia_tipo_label(t text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE t
    WHEN 'licencia_medica'        THEN 'Licencia médica'
    WHEN 'permiso_administrativo' THEN 'Permiso administrativo'
    WHEN 'justificativo'          THEN 'Ausencia sin justificar'
    WHEN 'dias_compensatorios'    THEN 'Días compensatorios'
    WHEN 'cometido'               THEN 'Cometido'
    ELSE COALESCE(t, 'Ausencia') END
$$;
