-- Función auxiliar para buscar un auth user por email directamente en auth.users
-- Usada por el Edge Function register-user para detectar y limpiar auth entries huérfanos
-- (caso: usuario borrado de la tabla usuarios pero el auth entry quedó intacto)

CREATE OR REPLACE FUNCTION public.get_auth_user_id_by_email(user_email TEXT)
RETURNS UUID LANGUAGE sql SECURITY DEFINER AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(user_email) LIMIT 1;
$$;
