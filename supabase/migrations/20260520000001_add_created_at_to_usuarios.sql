-- Agrega created_at a la tabla usuarios y la rellena desde auth.users
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

UPDATE usuarios u
SET created_at = au.created_at
FROM auth.users au
WHERE u.id = au.id
  AND u.created_at IS NULL;

ALTER TABLE usuarios ALTER COLUMN created_at SET DEFAULT NOW();
