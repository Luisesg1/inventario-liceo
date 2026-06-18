-- ═══════════════════════════════════════════════════════════════════════
--  BUCKET DE BACKUPS — Almacenamiento privado para respaldos automáticos
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Crear bucket privado ──────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'backups',
  'backups',
  false,
  104857600,                    -- 100 MB por archivo
  ARRAY['application/json']
)
ON CONFLICT (id) DO NOTHING;

-- ── 2. Políticas de acceso (solo administradores) ────────────────────────

-- Leer/descargar backups
CREATE POLICY "backups_select_admin"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'backups'
    AND EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE id = auth.uid() AND rol = 'admin'
    )
  );

-- El service role (Edge Function) sube los archivos — bypasses RLS por defecto.
-- Esta política permite también que el admin suba desde el cliente si es necesario.
CREATE POLICY "backups_insert_admin"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'backups'
    AND EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE id = auth.uid() AND rol = 'admin'
    )
  );

-- Eliminar backups viejos (opcional, uso futuro)
CREATE POLICY "backups_delete_admin"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'backups'
    AND EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE id = auth.uid() AND rol = 'admin'
    )
  );
