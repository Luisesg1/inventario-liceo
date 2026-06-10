-- ═══════════════════════════════════════════════════════════════════════
--  SOPORTE COMPLETO PARA TIPO 'cometido' EN AUSENCIAS
--
--  Diagnóstico previo:
--    · ausencias.tipo  → TEXT sin CHECK ni ENUM → ya acepta 'cometido'
--    · No existe ningún enum PostgreSQL para tipos de ausencia
--    · No existe CHECK constraint sobre ausencias.tipo
--    · No existen vistas ni RPCs que filtren por tipo de ausencia
--    · Las políticas RLS de ausencias son basadas en permisos JSONB,
--      no en el valor de tipo → ningún cambio de RLS requerido
--    · _ausencia_tipo_label() actualizada en migración 20260610000001
--
--  Esta migración es IDEMPOTENTE: se puede aplicar más de una vez sin
--  efectos secundarios.
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Documentar los valores válidos de ausencias.tipo ──────────────
COMMENT ON COLUMN ausencias.tipo IS
  'Tipo de ausencia. Valores válidos: licencia_medica | permiso_administrativo | justificativo | dias_compensatorios | cometido';

-- ── 2. Re-confirmar _ausencia_tipo_label() con todos los tipos ────────
--  (idempotente — CREATE OR REPLACE)
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

-- ── 3. Verificar que no exista CHECK constraint que rechace 'cometido' ─
--  Si existiera, este bloque lo elimina de forma segura antes de que
--  se intente insertar un registro de tipo 'cometido'.
DO $$
DECLARE
  v_conname text;
BEGIN
  SELECT c.conname INTO v_conname
  FROM   pg_constraint c
  JOIN   pg_class      t ON c.conrelid = t.oid
  JOIN   pg_namespace  n ON t.relnamespace = n.oid
  WHERE  n.nspname   = 'public'
    AND  t.relname   = 'ausencias'
    AND  c.contype   = 'c'
    AND  pg_get_constraintdef(c.oid) ILIKE '%tipo%';

  IF v_conname IS NOT NULL THEN
    RAISE NOTICE 'Eliminando CHECK constraint % de ausencias.tipo', v_conname;
    EXECUTE format('ALTER TABLE public.ausencias DROP CONSTRAINT %I', v_conname);
  ELSE
    RAISE NOTICE 'ausencias.tipo no tiene CHECK constraint — no se requiere cambio de esquema';
  END IF;
END $$;

-- ── 4. Verificar que el trigger de auditoría sigue activo ─────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname   = 'trg_audit_ausencias'
      AND tgrelid  = 'public.ausencias'::regclass
  ) THEN
    RAISE WARNING 'El trigger trg_audit_ausencias NO está activo en ausencias. Ejecutar migración 20260526000000 primero.';
  ELSE
    RAISE NOTICE 'Trigger trg_audit_ausencias activo — auditoría de cometidos operativa';
  END IF;
END $$;

-- ── 5. Asegurar que las ausencias tipo 'cometido' no toquen compensatorios
--  El trigger fn_audit_ausencias solo llama a _ausencia_tipo_label() y
--  registra en audit_logs. No descuenta saldo compensatorio (eso lo hace
--  la app únicamente para tipo='dias_compensatorios'). No hay cambio aquí.
--  Este bloque es solo un comentario de verificación.

-- ═══════════════════════════════════════════════════════════════════════
--  RESUMEN DE PERMISOS RLS PARA 'cometido'
--
--  Las políticas RLS de ausencias verifican permisos JSONB del usuario
--  (ver_ausencias, crear_ausencias, editar_ausencias, eliminar_ausencias,
--  ver_propias_ausencias). No filtran por tipo de ausencia.
--
--  Resultado: 'cometido' hereda exactamente los mismos permisos que
--  'licencia_medica', 'permiso_administrativo', etc. — sin cambio de RLS.
-- ═══════════════════════════════════════════════════════════════════════
