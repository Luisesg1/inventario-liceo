-- Profesores solo ven reglamentos vigentes.
-- Admins y usuarios con administrar_reglamentos ven todo.

-- Reemplazar política SELECT de reglamentos
DROP POLICY IF EXISTS "reglamentos_select" ON public.reglamentos;

CREATE POLICY "reglamentos_select" ON public.reglamentos
  FOR SELECT TO authenticated
  USING (
    public.tiene_permiso('ver_reglamentos')
    AND (
      -- Admin o gestor del módulo: ve todo
      public.es_admin()
      OR public.tiene_permiso('administrar_reglamentos')
      OR public.tiene_permiso('editar_reglamentos')
      OR public.tiene_permiso('crear_reglamentos')
      -- Resto: solo vigentes y no eliminados
      OR estado = 'Vigente'
    )
  );

-- Versiones: misma lógica (profesor solo ve versiones de docs vigentes)
DROP POLICY IF EXISTS "reg_versiones_select" ON public.reglamentos_versiones;

CREATE POLICY "reg_versiones_select" ON public.reglamentos_versiones
  FOR SELECT TO authenticated
  USING (
    public.tiene_permiso('ver_reglamentos')
    AND (
      public.es_admin()
      OR public.tiene_permiso('administrar_reglamentos')
      OR public.tiene_permiso('editar_reglamentos')
      OR public.tiene_permiso('crear_reglamentos')
      OR EXISTS (
        SELECT 1 FROM public.reglamentos r
        WHERE r.id = reglamentos_versiones.reglamento_id
          AND r.estado = 'Vigente'
      )
    )
  );
