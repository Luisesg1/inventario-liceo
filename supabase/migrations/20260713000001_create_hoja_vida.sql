-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN 20260713000001 — Módulo Hoja de Vida del Personal
-- ──────────────────────────────────────────────────────────────────────────────
-- Crea las tablas del módulo Hoja de Vida: hv_personas (anclaje por RUT),
-- hv_historial_laboral, hv_capacitaciones, hv_evaluaciones, hv_observaciones.
-- Todas usan RLS mediante la función tiene_permiso() ya existente.
-- Los documentos reutilizan personal_documentos (ya existe).
-- Las ausencias reutilizan la tabla ausencias (ya existe).
--
-- Aplicar manualmente en el SQL Editor de Supabase.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. hv_personas: anclaje por RUT (una fila por persona) ───────────────────
create table if not exists public.hv_personas (
  id                             uuid primary key default gen_random_uuid(),
  rut                            text not null unique,
  foto_url                       text,
  fecha_nacimiento               date,
  direccion                      text,
  estado_civil                   text check (estado_civil in ('soltero','casado','conviviente','divorciado','viudo','otro')),
  correo_personal                text,
  contacto_emergencia_nombre     text,
  contacto_emergencia_telefono   text,
  contacto_emergencia_relacion   text,
  observaciones_personales       text,
  departamento                   text,
  jornada                        text check (jornada in ('completa','media','parcial','otro')),
  jefatura_directa               text,
  fecha_ingreso                  date,
  estado_laboral                 text default 'activo' check (estado_laboral in ('activo','inactivo','licencia','comision','otro')),
  creado_en                      timestamptz default now(),
  actualizado_en                 timestamptz default now(),
  actualizado_por_id             uuid references auth.users(id),
  actualizado_por_nombre         text
);

-- ── 2. hv_historial_laboral ───────────────────────────────────────────────────
create table if not exists public.hv_historial_laboral (
  id                 uuid primary key default gen_random_uuid(),
  rut                text not null references public.hv_personas(rut) on delete cascade,
  tipo               text not null check (tipo in ('ingreso','ascenso','cambio_cargo','cambio_contrato','cambio_departamento','renovacion','reincorporacion','termino','otro')),
  descripcion        text,
  fecha_evento       date not null,
  cargo_anterior     text,
  cargo_nuevo        text,
  creado_en          timestamptz default now(),
  creado_por_id      uuid references auth.users(id),
  creado_por_nombre  text
);

-- ── 3. hv_capacitaciones ──────────────────────────────────────────────────────
create table if not exists public.hv_capacitaciones (
  id                 uuid primary key default gen_random_uuid(),
  rut                text not null references public.hv_personas(rut) on delete cascade,
  nombre_curso       text not null,
  institucion        text,
  horas              integer,
  fecha_inicio       date,
  fecha_termino      date,
  certificado_url    text,
  observaciones      text,
  creado_en          timestamptz default now(),
  creado_por_id      uuid references auth.users(id),
  creado_por_nombre  text
);

-- ── 4. hv_evaluaciones ────────────────────────────────────────────────────────
create table if not exists public.hv_evaluaciones (
  id                 uuid primary key default gen_random_uuid(),
  rut                text not null references public.hv_personas(rut) on delete cascade,
  evaluador          text,
  fecha_evaluacion   date not null,
  puntaje            numeric(5,2),
  calificacion       text check (calificacion in ('sobresaliente','muy_bien','bien','deficiente','otro')),
  observaciones      text,
  creado_en          timestamptz default now(),
  creado_por_id      uuid references auth.users(id),
  creado_por_nombre  text
);

-- ── 5. hv_observaciones ───────────────────────────────────────────────────────
create table if not exists public.hv_observaciones (
  id                 uuid primary key default gen_random_uuid(),
  rut                text not null references public.hv_personas(rut) on delete cascade,
  comentario         text not null,
  creado_en          timestamptz default now(),
  creado_por_id      uuid references auth.users(id),
  creado_por_nombre  text
);

-- ── 6. Trigger para actualizar actualizado_en en hv_personas ─────────────────
create or replace function public.fn_hv_set_actualizado_en()
returns trigger language plpgsql security definer as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

drop trigger if exists trg_hv_personas_updated on public.hv_personas;
create trigger trg_hv_personas_updated
  before update on public.hv_personas
  for each row execute function public.fn_hv_set_actualizado_en();

-- ── 7. Índices útiles ─────────────────────────────────────────────────────────
create index if not exists idx_hv_historial_rut on public.hv_historial_laboral(rut);
create index if not exists idx_hv_capacitaciones_rut on public.hv_capacitaciones(rut);
create index if not exists idx_hv_evaluaciones_rut on public.hv_evaluaciones(rut);
create index if not exists idx_hv_observaciones_rut on public.hv_observaciones(rut);

-- ── 8. RLS ────────────────────────────────────────────────────────────────────
alter table public.hv_personas          enable row level security;
alter table public.hv_historial_laboral enable row level security;
alter table public.hv_capacitaciones    enable row level security;
alter table public.hv_evaluaciones      enable row level security;
alter table public.hv_observaciones     enable row level security;

-- hv_personas
drop policy if exists "hv_personas_select" on public.hv_personas;
create policy "hv_personas_select" on public.hv_personas
  for select using (es_admin() or tiene_permiso('ver_hoja_vida'));

drop policy if exists "hv_personas_insert" on public.hv_personas;
create policy "hv_personas_insert" on public.hv_personas
  for insert with check (es_admin() or tiene_permiso('ver_hoja_vida'));

drop policy if exists "hv_personas_update" on public.hv_personas;
create policy "hv_personas_update" on public.hv_personas
  for update using (es_admin() or tiene_permiso('editar_hoja_vida'));

drop policy if exists "hv_personas_delete" on public.hv_personas;
create policy "hv_personas_delete" on public.hv_personas
  for delete using (es_admin() or tiene_permiso('eliminar_hoja_vida'));

-- hv_historial_laboral
drop policy if exists "hv_historial_select" on public.hv_historial_laboral;
create policy "hv_historial_select" on public.hv_historial_laboral
  for select using (es_admin() or tiene_permiso('ver_hoja_vida'));

drop policy if exists "hv_historial_insert" on public.hv_historial_laboral;
create policy "hv_historial_insert" on public.hv_historial_laboral
  for insert with check (es_admin() or tiene_permiso('crear_hoja_vida'));

drop policy if exists "hv_historial_update" on public.hv_historial_laboral;
create policy "hv_historial_update" on public.hv_historial_laboral
  for update using (es_admin() or tiene_permiso('editar_hoja_vida'));

drop policy if exists "hv_historial_delete" on public.hv_historial_laboral;
create policy "hv_historial_delete" on public.hv_historial_laboral
  for delete using (es_admin() or tiene_permiso('eliminar_hoja_vida'));

-- hv_capacitaciones
drop policy if exists "hv_cap_select" on public.hv_capacitaciones;
create policy "hv_cap_select" on public.hv_capacitaciones
  for select using (es_admin() or tiene_permiso('ver_hoja_vida'));

drop policy if exists "hv_cap_insert" on public.hv_capacitaciones;
create policy "hv_cap_insert" on public.hv_capacitaciones
  for insert with check (es_admin() or tiene_permiso('crear_hoja_vida'));

drop policy if exists "hv_cap_update" on public.hv_capacitaciones;
create policy "hv_cap_update" on public.hv_capacitaciones
  for update using (es_admin() or tiene_permiso('editar_hoja_vida'));

drop policy if exists "hv_cap_delete" on public.hv_capacitaciones;
create policy "hv_cap_delete" on public.hv_capacitaciones
  for delete using (es_admin() or tiene_permiso('eliminar_hoja_vida'));

-- hv_evaluaciones
drop policy if exists "hv_eval_select" on public.hv_evaluaciones;
create policy "hv_eval_select" on public.hv_evaluaciones
  for select using (es_admin() or tiene_permiso('ver_hoja_vida'));

drop policy if exists "hv_eval_insert" on public.hv_evaluaciones;
create policy "hv_eval_insert" on public.hv_evaluaciones
  for insert with check (es_admin() or tiene_permiso('crear_hoja_vida'));

drop policy if exists "hv_eval_update" on public.hv_evaluaciones;
create policy "hv_eval_update" on public.hv_evaluaciones
  for update using (es_admin() or tiene_permiso('editar_hoja_vida'));

drop policy if exists "hv_eval_delete" on public.hv_evaluaciones;
create policy "hv_eval_delete" on public.hv_evaluaciones
  for delete using (es_admin() or tiene_permiso('eliminar_hoja_vida'));

-- hv_observaciones
drop policy if exists "hv_obs_select" on public.hv_observaciones;
create policy "hv_obs_select" on public.hv_observaciones
  for select using (es_admin() or tiene_permiso('ver_hoja_vida'));

drop policy if exists "hv_obs_insert" on public.hv_observaciones;
create policy "hv_obs_insert" on public.hv_observaciones
  for insert with check (es_admin() or tiene_permiso('crear_hoja_vida'));

drop policy if exists "hv_obs_update" on public.hv_observaciones;
create policy "hv_obs_update" on public.hv_observaciones
  for update using (es_admin() or tiene_permiso('editar_hoja_vida'));

drop policy if exists "hv_obs_delete" on public.hv_observaciones;
create policy "hv_obs_delete" on public.hv_observaciones
  for delete using (es_admin() or tiene_permiso('eliminar_hoja_vida'));

-- ── REVERSIÓN ────────────────────────────────────────────────────────────────
-- drop table if exists public.hv_observaciones cascade;
-- drop table if exists public.hv_evaluaciones cascade;
-- drop table if exists public.hv_capacitaciones cascade;
-- drop table if exists public.hv_historial_laboral cascade;
-- drop table if exists public.hv_personas cascade;
-- drop function if exists public.fn_hv_set_actualizado_en();
