-- ══════════════════════════════════════════════════════════
--  Imágenes en observación de requerimientos
--  Ejecutar en Supabase → SQL Editor
-- ══════════════════════════════════════════════════════════

-- URLs de imágenes adjuntas (array JSON de strings)
ALTER TABLE requerimientos
  ADD COLUMN IF NOT EXISTS observacion_imagenes jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN requerimientos.observacion_imagenes IS
  'URLs públicas de imágenes en Storage (bucket requerimientos)';

-- Bucket para archivos (público para mostrar en la app con URL directa)
INSERT INTO storage.buckets (id, name, public)
VALUES ('requerimientos', 'requerimientos', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Políticas Storage (usuarios autenticados)
DROP POLICY IF EXISTS "req_imgs_select" ON storage.objects;
CREATE POLICY "req_imgs_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'requerimientos');

DROP POLICY IF EXISTS "req_imgs_insert" ON storage.objects;
CREATE POLICY "req_imgs_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'requerimientos' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "req_imgs_update" ON storage.objects;
CREATE POLICY "req_imgs_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'requerimientos');

DROP POLICY IF EXISTS "req_imgs_delete" ON storage.objects;
CREATE POLICY "req_imgs_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'requerimientos');
