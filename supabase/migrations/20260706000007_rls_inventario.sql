-- ═══════════════════════════════════════════════════════════════════════════
-- FASE 2 DE SEGURIDAD — RLS real para Inventario (hallazgo C1)
-- ---------------------------------------------------------------------------
-- Tablas: bienes, categorias, prestamos, incidencias, actividades.
--
-- ── Notas de diseño (verificadas en Inventario.jsx / CamposCategoria.jsx) ───
--   · Los CAMPOS de categoría viven DENTRO de `categorias` (CamposCategoria solo
--     hace UPDATE sobre categorias). Por eso categorias UPDATE admite además los
--     permisos de campos (agregar_campo, editar_campo, ...).
--   · `categorias` es dato de referencia leído por muchos módulos (Dashboard,
--     Usuarios/wizard de permisos, Auditoría, ImportarCSV) → SELECT abierto a
--     autenticados (no sensible: nombres/íconos/definición de campos).
--   · Acoplamiento préstamos↔stock: registrar/devolver un préstamo hace UPDATE de
--     bienes.cantidad (Inventario.jsx:1624/1859) → bienes UPDATE admite
--     registrar_prestamo. Soft-delete y restauración también son UPDATE.
--   · bienes/incidencias/requerimientos se borran de forma permanente SOLO desde
--     la Papelera (DELETE directo) → DELETE exige eliminar_permanentemente.
--   · `prestamos` conserva la regla "solo quien lo registró (o con permiso) edita".
--
-- Requiere: es_admin(), tiene_permiso() (20260706000003, corregida en 0006).
-- Aplicar manualmente en el SQL Editor, en orden.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Borrado dinámico de políticas previas ───────────────────────────────────
DO $$
DECLARE r record; t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['bienes','categorias','prestamos','incidencias','actividades']
  LOOP
    FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, t);
    END LOOP;
  END LOOP;
END $$;

ALTER TABLE public.bienes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prestamos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidencias  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actividades  ENABLE ROW LEVEL SECURITY;

-- ── bienes ──────────────────────────────────────────────────────────────────
CREATE POLICY "bienes_select" ON public.bienes
  FOR SELECT TO authenticated
  USING (public.tiene_permiso('ver_inventario') OR public.tiene_permiso('ver_auditoria_inventario'));
CREATE POLICY "bienes_insert" ON public.bienes
  FOR INSERT TO authenticated
  WITH CHECK (public.tiene_permiso('agregar_bien') OR public.tiene_permiso('importar_csv'));
CREATE POLICY "bienes_update" ON public.bienes
  FOR UPDATE TO authenticated
  USING (
    public.tiene_permiso('editar_bien') OR public.tiene_permiso('eliminar_bien')
    OR public.tiene_permiso('eliminar_lote') OR public.tiene_permiso('registrar_prestamo')
    OR public.tiene_permiso('restaurar_registros')
  )
  WITH CHECK (
    public.tiene_permiso('editar_bien') OR public.tiene_permiso('eliminar_bien')
    OR public.tiene_permiso('eliminar_lote') OR public.tiene_permiso('registrar_prestamo')
    OR public.tiene_permiso('restaurar_registros')
  );
CREATE POLICY "bienes_delete" ON public.bienes
  FOR DELETE TO authenticated
  USING (public.tiene_permiso('eliminar_permanentemente'));

-- ── categorias (incluye definición de campos; referencia no sensible) ───────
CREATE POLICY "categorias_select" ON public.categorias
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "categorias_insert" ON public.categorias
  FOR INSERT TO authenticated WITH CHECK (public.tiene_permiso('gestionar_categorias'));
CREATE POLICY "categorias_update" ON public.categorias
  FOR UPDATE TO authenticated
  USING (
    public.tiene_permiso('gestionar_categorias') OR public.tiene_permiso('gestionar_campos')
    OR public.tiene_permiso('agregar_campo') OR public.tiene_permiso('editar_campo')
    OR public.tiene_permiso('ocultar_campo') OR public.tiene_permiso('eliminar_campo')
    OR public.tiene_permiso('reordenar_campos') OR public.tiene_permiso('gestionar_campos_base')
  )
  WITH CHECK (
    public.tiene_permiso('gestionar_categorias') OR public.tiene_permiso('gestionar_campos')
    OR public.tiene_permiso('agregar_campo') OR public.tiene_permiso('editar_campo')
    OR public.tiene_permiso('ocultar_campo') OR public.tiene_permiso('eliminar_campo')
    OR public.tiene_permiso('reordenar_campos') OR public.tiene_permiso('gestionar_campos_base')
  );
CREATE POLICY "categorias_delete" ON public.categorias
  FOR DELETE TO authenticated
  USING (public.tiene_permiso('gestionar_categorias') OR public.tiene_permiso('eliminar_permanentemente'));

-- ── prestamos (conserva regla de propiedad + gating por permiso) ────────────
CREATE POLICY "prestamos_select" ON public.prestamos
  FOR SELECT TO authenticated
  USING (public.tiene_permiso('ver_inventario') OR public.tiene_permiso('ver_auditoria_inventario'));
CREATE POLICY "prestamos_insert" ON public.prestamos
  FOR INSERT TO authenticated WITH CHECK (public.tiene_permiso('registrar_prestamo'));
CREATE POLICY "prestamos_update" ON public.prestamos
  FOR UPDATE TO authenticated
  USING (registrado_por = auth.uid() OR public.tiene_permiso('registrar_prestamo'))
  WITH CHECK (registrado_por = auth.uid() OR public.tiene_permiso('registrar_prestamo'));
CREATE POLICY "prestamos_delete" ON public.prestamos
  FOR DELETE TO authenticated
  USING (public.tiene_permiso('registrar_prestamo') OR public.tiene_permiso('eliminar_permanentemente'));

-- ── incidencias ─────────────────────────────────────────────────────────────
CREATE POLICY "incidencias_select" ON public.incidencias
  FOR SELECT TO authenticated
  USING (public.tiene_permiso('ver_inventario') OR public.tiene_permiso('ver_auditoria_inventario'));
CREATE POLICY "incidencias_insert" ON public.incidencias
  FOR INSERT TO authenticated WITH CHECK (public.tiene_permiso('registrar_incidencia'));
CREATE POLICY "incidencias_update" ON public.incidencias
  FOR UPDATE TO authenticated
  USING (public.tiene_permiso('registrar_incidencia'))
  WITH CHECK (public.tiene_permiso('registrar_incidencia'));
CREATE POLICY "incidencias_delete" ON public.incidencias
  FOR DELETE TO authenticated
  USING (public.tiene_permiso('registrar_incidencia') OR public.tiene_permiso('eliminar_permanentemente'));

-- ── actividades (bitácora de inventario; insert desde cliente — ver C3) ─────
CREATE POLICY "actividades_select" ON public.actividades
  FOR SELECT TO authenticated
  USING (public.tiene_permiso('ver_inventario') OR public.tiene_permiso('ver_auditoria_inventario'));
CREATE POLICY "actividades_insert" ON public.actividades
  FOR INSERT TO authenticated
  WITH CHECK (
    public.tiene_permiso('agregar_bien') OR public.tiene_permiso('editar_bien')
    OR public.tiene_permiso('eliminar_bien') OR public.tiene_permiso('eliminar_lote')
    OR public.tiene_permiso('registrar_prestamo') OR public.tiene_permiso('registrar_incidencia')
    OR public.tiene_permiso('importar_csv') OR public.tiene_permiso('gestionar_categorias')
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN: usuario sin ver_inventario → select * from bienes = 0 filas;
-- con ver_inventario carga; registrar/devolver préstamo ajusta stock sin error;
-- editar campos de una categoría funciona con permisos de campos. Admin: OK.
-- ═══════════════════════════════════════════════════════════════════════════
