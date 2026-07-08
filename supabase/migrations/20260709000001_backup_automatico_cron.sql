-- ═══════════════════════════════════════════════════════════════════════
--  BACKUPS AUTOMÁTICOS REALES — pg_cron + pg_net
--  Ejecutar en Supabase Dashboard → SQL Editor (aplicación manual).
-- ---------------------------------------------------------------------------
--  Un único job diario lee la preferencia `backup_auto_frecuencia`
--  (configuracion) y decide si hoy corresponde generar un respaldo:
--     · diario      → todos los días
--     · semanal     → los lunes
--     · mensual     → el día 1 de cada mes
--     · desactivado → nunca
--  Si corresponde (y no existe ya un backup automático de hoy), invoca la
--  edge function `backup-mensual` con el service_role para que la trate como
--  llamada del sistema y genere un archivo `backup_auto_*`.
--
--  ┌─ REQUISITOS (una sola vez, desde el Dashboard) ──────────────────────────┐
--  │ 1. Database → Extensions: habilitar `pg_cron` y `pg_net`.                 │
--  │ 2. Database → Vault → New secret, crear DOS secretos:                     │
--  │      · name = project_url        → https://<TU-REF>.supabase.co          │
--  │      · name = service_role_key   → (Settings → API → service_role)       │
--  │    (Se guardan cifrados en Vault; NO van en este archivo ni en git.)      │
--  │ 3. Ejecutar esta migración.                                              │
--  └───────────────────────────────────────────────────────────────────────────┘
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Función que decide y dispara el backup automático ─────────────────
CREATE OR REPLACE FUNCTION public.disparar_backup_automatico()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net, vault
AS $$
DECLARE
  v_frec      text;
  v_due       boolean := false;
  v_ya_existe boolean;
  v_url       text;
  v_key       text;
BEGIN
  -- Frecuencia configurada (por defecto 'mensual' si no existe la clave)
  SELECT valor INTO v_frec FROM public.configuracion WHERE clave = 'backup_auto_frecuencia';
  v_frec := COALESCE(v_frec, 'mensual');

  IF v_frec = 'diario' THEN
    v_due := true;
  ELSIF v_frec = 'semanal' THEN
    v_due := (EXTRACT(DOW FROM now()) = 1);   -- 1 = lunes
  ELSIF v_frec = 'mensual' THEN
    v_due := (EXTRACT(DAY FROM now()) = 1);    -- día 1 del mes
  ELSE
    v_due := false;                            -- desactivado / desconocido
  END IF;

  IF NOT v_due THEN
    RETURN;
  END IF;

  -- Idempotencia: no duplicar si ya hay un backup automático de hoy
  SELECT EXISTS(
    SELECT 1 FROM storage.objects
    WHERE bucket_id = 'backups'
      AND name LIKE 'backup_auto_' || to_char(now(), 'YYYY-MM-DD') || '%'
  ) INTO v_ya_existe;

  IF v_ya_existe THEN
    RETURN;
  END IF;

  -- Secretos desde Vault (no viajan en git)
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'project_url';
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'service_role_key';

  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE NOTICE 'Faltan secretos project_url/service_role_key en Vault; se omite el backup automático.';
    RETURN;
  END IF;

  -- Invocar la edge function como llamada del sistema
  PERFORM net.http_post(
    url     := v_url || '/functions/v1/backup-mensual',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_key
               ),
    body    := '{}'::jsonb
  );
END;
$$;

-- ── 2. Programar el job diario (04:00 UTC) ───────────────────────────────
-- El job corre todos los días; la función decide si hoy toca segun la
-- frecuencia. Requiere pg_cron habilitado.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('backup-automatico-diario');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    PERFORM cron.schedule(
      'backup-automatico-diario',
      '0 4 * * *',
      'SELECT public.disparar_backup_automatico()'
    );
  ELSE
    RAISE NOTICE 'pg_cron no está habilitado: habilítalo en Database → Extensions y vuelve a ejecutar este bloque.';
  END IF;
END $$;

-- Para probar manualmente sin esperar al cron:
--   SELECT public.disparar_backup_automatico();
-- (solo genera archivo si la frecuencia dice que hoy corresponde)
