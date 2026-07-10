-- ═══════════════════════════════════════════════════════════════════════════
-- F05 — Rate limiting para endpoints públicos (register-user)
-- ---------------------------------------------------------------------------
-- `register-user` es un endpoint SIN autenticación (auto-registro con código de
-- invitación). Sin límite de intentos, el código de invitación es forzable por
-- fuerza bruta. Este limitador de ventana fija por clave (IP) lo mitiga.
--
-- La tabla solo la toca el service_role desde las Edge Functions (RLS activa sin
-- políticas ⇒ inaccesible para anon/authenticated). Aplicar manualmente.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.rate_limit (
  clave          text        PRIMARY KEY,
  intentos       int         NOT NULL DEFAULT 0,
  ventana_inicio timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rate_limit ENABLE ROW LEVEL SECURITY;
-- Sin políticas: solo el service_role (Edge Functions) puede leer/escribir.

-- Consume un intento para `p_clave`. Devuelve TRUE si sigue dentro del límite,
-- FALSE si lo excede. Ventana fija: al vencer p_ventana_seg, el contador se
-- reinicia. Atómico vía UPSERT.
CREATE OR REPLACE FUNCTION public.consumir_rate_limit(
  p_clave      text,
  p_max        int,
  p_ventana_seg int
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_intentos int;
BEGIN
  INSERT INTO public.rate_limit (clave, intentos, ventana_inicio)
       VALUES (p_clave, 1, now())
  ON CONFLICT (clave) DO UPDATE SET
    intentos = CASE
      WHEN public.rate_limit.ventana_inicio < now() - make_interval(secs => p_ventana_seg)
        THEN 1
        ELSE public.rate_limit.intentos + 1
    END,
    ventana_inicio = CASE
      WHEN public.rate_limit.ventana_inicio < now() - make_interval(secs => p_ventana_seg)
        THEN now()
        ELSE public.rate_limit.ventana_inicio
    END
  RETURNING intentos INTO v_intentos;

  RETURN v_intentos <= p_max;
END;
$$;

-- Opcional: limpieza periódica de claves viejas (ejecutar a mano o vía cron):
-- DELETE FROM public.rate_limit WHERE ventana_inicio < now() - interval '1 day';
