-- Sincroniza el seed de `permisos_rol` con TODOS los módulos del catálogo
-- (src/config/permisos.js). El seed original (20260609000001) no incluía las
-- claves de los módulos añadidos después: Reglamentos, Personal, Papelera, ni
-- algunas de Ausencias/Ajustes (ver_historial_usuarios, administrar_reglamentos…).
--
-- Estrategia idempotente y no destructiva: se fusiona un objeto con TODAS las
-- claves del catálogo en `false` DEBAJO de los permisos existentes
--   permisos = <todas_en_false> || permisos
-- El operador `||` de jsonb hace que el lado derecho (los valores YA guardados)
-- prevalezca, de modo que:
--   · las claves faltantes se agregan en `false` (módulos nuevos son admin-only),
--   · ninguna configuración existente se pierde ni se sobreescribe,
--   · re-ejecutar la migración no cambia nada.
--
-- `admin` no vive en esta tabla (App.jsx le concede todo por bypass de rol), por
-- lo que todos los roles aquí reciben los módulos nuevos deshabilitados, acorde
-- a la matriz oficial (Reglamentos/Personal/Papelera = solo administrador).

UPDATE permisos_rol
SET permisos = '{
  "ver_inventario": false, "agregar_bien": false, "editar_bien": false,
  "eliminar_bien": false, "eliminar_lote": false, "gestionar_categorias": false,
  "importar_csv": false, "exportar": false, "registrar_prestamo": false,
  "registrar_incidencia": false, "ver_auditoria_inventario": false,

  "ver_campos": false, "agregar_campo": false, "editar_campo": false,
  "ocultar_campo": false, "eliminar_campo": false, "reordenar_campos": false,
  "gestionar_campos_base": false, "gestionar_campos": false,

  "ver_tickets": false, "crear_ticket": false, "editar_ticket": false,
  "gestionar_tickets": false, "eliminar_ticket": false, "ver_alertas_tickets": false,
  "exportar_tickets": false,

  "ver_requerimientos": false, "crear_requerimiento": false, "editar_requerimiento": false,
  "eliminar_requerimiento": false, "importar_requerimientos": false,
  "exportar_requerimientos": false, "ver_auditoria_requerimientos": false,

  "ver_propias_ausencias": false, "ver_ausencias": false, "crear_ausencias": false,
  "editar_ausencias": false, "eliminar_ausencias": false, "aprobar_ausencias": false,
  "exportar_ausencias": false, "ver_auditoria_permisos": false,

  "ver_compensatorios": false, "crear_compensatorios": false, "editar_compensatorios": false,
  "eliminar_compensatorios": false, "exportar_compensatorios": false,
  "ver_auditoria_compensatorios": false,

  "ver_ajustes": false, "gestionar_ajustes": false, "guardar_cambios_ajustes": false,
  "gestionar_usuarios": false, "invitar_usuario": false, "editar_usuario": false,
  "eliminar_usuario": false, "notificar_ausencia_correo": false,
  "editar_roles_permisos": false, "gestionar_roles": false, "ver_historial_usuarios": false,

  "ver_reglamentos": false, "crear_reglamentos": false, "editar_reglamentos": false,
  "eliminar_reglamentos": false, "descargar_reglamentos": false,
  "gestionar_versiones_reglamentos": false, "administrar_reglamentos": false,
  "ver_auditoria_reglamentos": false,

  "ver_contrataciones": false, "crear_contrataciones": false, "editar_contrataciones": false,
  "eliminar_contrataciones": false, "ver_reemplazos": false, "crear_reemplazos": false,
  "editar_reemplazos": false, "eliminar_reemplazos": false, "ver_documentos_personal": false,
  "subir_documentos_personal": false, "eliminar_documentos_personal": false,
  "ver_auditoria_personal": false,

  "ver_papelera": false, "restaurar_registros": false, "eliminar_permanentemente": false,
  "ver_auditoria_papelera": false
}'::jsonb || permisos,
    updated_at = NOW();
