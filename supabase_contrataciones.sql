-- ══════════════════════════════════════════════════════════════
-- Módulo: Contrataciones y Reemplazos — Liceo JHJ
-- Ejecutar en el SQL Editor de Supabase
-- ══════════════════════════════════════════════════════════════

-- ── Tabla: contrataciones ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contrataciones (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre_completo text        NOT NULL,
  rut             text        NOT NULL,
  correo          text,
  telefono        text,
  cargo           text        NOT NULL,
  estamento       text        NOT NULL DEFAULT 'docente',
  tipo_contrato   text        NOT NULL DEFAULT 'contrata',
  fecha_inicio    date        NOT NULL,
  fecha_termino   date,
  horas           integer     CHECK (horas IS NULL OR horas >= 0),
  observaciones   text,
  creado_por      uuid        REFERENCES public.usuarios(id) ON DELETE SET NULL,
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_en  timestamptz NOT NULL DEFAULT now()
);

-- ── Tabla: reemplazos ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reemplazos (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  funcionario_id      uuid        REFERENCES public.usuarios(id) ON DELETE SET NULL,
  funcionario_nombre  text        NOT NULL,
  motivo              text        NOT NULL DEFAULT 'licencia_medica',
  reemplazante_id     uuid        REFERENCES public.usuarios(id) ON DELETE SET NULL,
  reemplazante_nombre text,
  cargo               text,
  asignatura          text,
  curso               text,
  fecha_inicio        date        NOT NULL,
  fecha_termino       date,
  horas               integer     CHECK (horas IS NULL OR horas >= 0),
  observaciones       text,
  estado              text        NOT NULL DEFAULT 'pendiente',
  ausencia_id         bigint      REFERENCES public.ausencias(id) ON DELETE SET NULL,
  contratacion_id     uuid        REFERENCES public.contrataciones(id) ON DELETE SET NULL,
  creado_por          uuid        REFERENCES public.usuarios(id) ON DELETE SET NULL,
  creado_en           timestamptz NOT NULL DEFAULT now(),
  actualizado_en      timestamptz NOT NULL DEFAULT now()
);

-- ── Tabla: personal_documentos ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.personal_documentos (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre          text        NOT NULL,
  tipo_doc        text        NOT NULL DEFAULT 'otro',
  url             text        NOT NULL,
  storage_path    text,
  tamanio         bigint,
  mime_type       text,
  contratacion_id uuid        REFERENCES public.contrataciones(id) ON DELETE CASCADE,
  reemplazo_id    uuid        REFERENCES public.reemplazos(id) ON DELETE CASCADE,
  subido_por      uuid        REFERENCES public.usuarios(id) ON DELETE SET NULL,
  subido_en       timestamptz NOT NULL DEFAULT now()
);

-- ── Tabla: personal_audit_logs ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.personal_audit_logs (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  accion          text        NOT NULL,
  tabla_afectada  text        NOT NULL,
  registro_id     uuid,
  registro_nombre text,
  usuario_id      uuid        REFERENCES public.usuarios(id) ON DELETE SET NULL,
  usuario_nombre  text,
  usuario_rol     text,
  cambios         jsonb,
  creado_en       timestamptz NOT NULL DEFAULT now()
);

-- ── Índices ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_contrataciones_rut
  ON public.contrataciones(rut);
CREATE INDEX IF NOT EXISTS idx_contrataciones_fecha_termino
  ON public.contrataciones(fecha_termino);
CREATE INDEX IF NOT EXISTS idx_contrataciones_creado_en
  ON public.contrataciones(creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_reemplazos_estado
  ON public.reemplazos(estado);
CREATE INDEX IF NOT EXISTS idx_reemplazos_funcionario_id
  ON public.reemplazos(funcionario_id);
CREATE INDEX IF NOT EXISTS idx_reemplazos_ausencia_id
  ON public.reemplazos(ausencia_id);
CREATE INDEX IF NOT EXISTS idx_reemplazos_fecha_inicio
  ON public.reemplazos(fecha_inicio);

CREATE INDEX IF NOT EXISTS idx_personal_docs_contratacion
  ON public.personal_documentos(contratacion_id);
CREATE INDEX IF NOT EXISTS idx_personal_docs_reemplazo
  ON public.personal_documentos(reemplazo_id);

CREATE INDEX IF NOT EXISTS idx_personal_audit_creado_en
  ON public.personal_audit_logs(creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_personal_audit_tabla
  ON public.personal_audit_logs(tabla_afectada);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.contrataciones      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reemplazos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_audit_logs ENABLE ROW LEVEL SECURITY;

-- Contrataciones
CREATE POLICY "contrataciones_select" ON public.contrataciones
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "contrataciones_insert" ON public.contrataciones
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "contrataciones_update" ON public.contrataciones
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "contrataciones_delete" ON public.contrataciones
  FOR DELETE TO authenticated USING (true);

-- Reemplazos
CREATE POLICY "reemplazos_select" ON public.reemplazos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "reemplazos_insert" ON public.reemplazos
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "reemplazos_update" ON public.reemplazos
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "reemplazos_delete" ON public.reemplazos
  FOR DELETE TO authenticated USING (true);

-- Documentos
CREATE POLICY "personal_docs_select" ON public.personal_documentos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "personal_docs_insert" ON public.personal_documentos
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "personal_docs_update" ON public.personal_documentos
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "personal_docs_delete" ON public.personal_documentos
  FOR DELETE TO authenticated USING (true);

-- Auditoría
CREATE POLICY "personal_audit_select" ON public.personal_audit_logs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "personal_audit_insert" ON public.personal_audit_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- ── Storage bucket ───────────────────────────────────────────
-- Ejecutar también en Storage → Buckets → New bucket:
-- Nombre: personal-docs
-- Public: false
--
-- O via SQL:
INSERT INTO storage.buckets (id, name, public)
VALUES ('personal-docs', 'personal-docs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "personal_docs_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'personal-docs');
CREATE POLICY "personal_docs_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'personal-docs');
CREATE POLICY "personal_docs_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'personal-docs');
