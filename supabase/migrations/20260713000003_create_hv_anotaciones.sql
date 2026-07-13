-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN 20260713000003 — Tabla hv_anotaciones (Anotaciones / Incidencias)
-- ──────────────────────────────────────────────────────────────────────────────
-- Registra hechos importantes de la vida laboral de cada funcionario:
-- atrasos, inasistencias, felicitaciones, amonestaciones, etc.
--
-- Aplicar manualmente en el SQL Editor de Supabase.
-- ══════════════════════════════════════════════════════════════════════════════

create table if not exists public.hv_anotaciones (
  id                 uuid primary key default gen_random_uuid(),
  rut                text not null references public.hv_personas(rut) on delete cascade,
  tipo               text not null check (tipo in (
    'atraso','inasistencia','ausencia_injustificada','licencia_medica',
    'felicitacion','reconocimiento','llamado_atencion','amonestacion',
    'observacion_jefatura','participacion_destacada','reunion_direccion','otro'
  )),
  fecha              date not null,
  hora               time,
  descripcion        text not null,
  estado             text default 'activo' check (estado in ('activo','resuelto','archivado')),
  evidencia_url      text,
  evidencia_nombre   text,
  creado_en          timestamptz default now(),
  creado_por_id      uuid references auth.users(id),
  creado_por_nombre  text
);

create index if not exists idx_hv_anotaciones_rut on public.hv_anotaciones(rut);
create index if not exists idx_hv_anotaciones_tipo on public.hv_anotaciones(tipo);
create index if not exists idx_hv_anotaciones_fecha on public.hv_anotaciones(fecha);

alter table public.hv_anotaciones enable row level security;

drop policy if exists "hv_anot_select" on public.hv_anotaciones;
create policy "hv_anot_select" on public.hv_anotaciones
  for select using (es_admin() or tiene_permiso('ver_hoja_vida'));

drop policy if exists "hv_anot_insert" on public.hv_anotaciones;
create policy "hv_anot_insert" on public.hv_anotaciones
  for insert with check (es_admin() or tiene_permiso('crear_hoja_vida'));

drop policy if exists "hv_anot_update" on public.hv_anotaciones;
create policy "hv_anot_update" on public.hv_anotaciones
  for update using (es_admin() or tiene_permiso('editar_hoja_vida'));

drop policy if exists "hv_anot_delete" on public.hv_anotaciones;
create policy "hv_anot_delete" on public.hv_anotaciones
  for delete using (es_admin() or tiene_permiso('eliminar_hoja_vida'));

-- ── REVERSIÓN ──
-- drop table if exists public.hv_anotaciones cascade;
