// src/config/permisos.js
// ═══════════════════════════════════════════════════════════════════════════
// FUENTE ÚNICA DE VERDAD DE PERMISOS
// ---------------------------------------------------------------------------
// Todo el catálogo de permisos del sistema vive aquí, agrupado por módulo.
// Antes estaba duplicado en Usuarios.jsx y MantenedorRoles.jsx; ahora ambos
// (y cualquier módulo futuro) derivan sus estructuras de esta definición.
//
// ┌─ CÓMO AGREGAR UN NUEVO MÓDULO ───────────────────────────────────────────┐
// │ 1. Agrega un objeto a MODULOS con su `key`, `label`, `icon`, `pasoLabel`  │
// │    y su lista de `permisos` (cada uno con key/accion/label/labelCorto/desc)│
// │ 2. En App.jsx expón los booleanos del módulo (esAdmin || !!p.<clave>) y   │
// │    agrega su gate en `soloAdmin`.                                          │
// │ 3. En Layout.jsx muestra el ítem de menú detrás de su `puedeVer…`.         │
// │ Con eso el wizard de Usuarios y el Mantenedor de Roles lo toman solos.     │
// └───────────────────────────────────────────────────────────────────────────┘
//
// `accion` sigue una taxonomía consistente para todos los módulos:
//   ver · crear · editar · eliminar · exportar · aprobar · importar ·
//   administrar · auditoria · accion (acciones específicas del módulo)
// ═══════════════════════════════════════════════════════════════════════════

export const MODULOS = [
  {
    key: 'inventario', label: 'Inventario', icon: '📦', pasoLabel: 'Inventario',
    descripcion: 'Acciones sobre bienes, categorías, préstamos e incidencias.',
    permisos: [
      { key: 'ver_inventario',           accion: 'ver',         label: 'Ver inventario',                     labelCorto: 'Ver inv.',     desc: 'Permite visualizar todos los bienes registrados en el sistema.' },
      { key: 'agregar_bien',             accion: 'crear',       label: 'Agregar bien',                       labelCorto: 'Agregar',      desc: 'Permite registrar nuevos bienes en el inventario.' },
      { key: 'editar_bien',              accion: 'editar',      label: 'Editar bien',                        labelCorto: 'Editar',       desc: 'Permite modificar la información de bienes ya registrados.' },
      { key: 'eliminar_bien',            accion: 'eliminar',    label: 'Eliminar bien',                      labelCorto: 'Eliminar',     desc: 'Permite eliminar bienes individuales del inventario.' },
      { key: 'eliminar_lote',            accion: 'eliminar',    label: 'Eliminar en lote',                   labelCorto: 'Lote',         desc: 'Permite eliminar múltiples bienes al mismo tiempo.' },
      { key: 'gestionar_categorias',     accion: 'administrar', label: 'Gestionar categorías de inventario', labelCorto: 'Categ.',       desc: 'Permite crear, editar y eliminar categorías de bienes.' },
      { key: 'importar_csv',             accion: 'importar',    label: 'Importar CSV',                       labelCorto: 'CSV',          desc: 'Permite cargar bienes en masa desde un archivo CSV.' },
      { key: 'exportar',                 accion: 'exportar',    label: 'Exportar inventario',                labelCorto: 'Exportar',     desc: 'Permite exportar el inventario completo o filtrado a Excel o PDF.' },
      { key: 'registrar_prestamo',       accion: 'accion',      label: 'Registrar préstamo',                 labelCorto: 'Préstamo',     desc: 'Permite registrar el préstamo de un bien a un funcionario o sala.' },
      { key: 'registrar_incidencia',     accion: 'accion',      label: 'Registrar incidencia',               labelCorto: 'Incidencia',   desc: 'Permite reportar fallas, daños o incidencias asociadas a bienes.' },
      { key: 'ver_auditoria_inventario', accion: 'auditoria',   label: 'Ver auditoría de inventario',        labelCorto: 'Aud. Inv.',    desc: 'Permite ver el historial de cambios en el módulo de inventario.' },
    ],
  },
  {
    key: 'configurar_campos', label: 'Campos inventario', icon: '🔧', pasoLabel: 'Campos inv.',
    descripcion: 'Permite administrar los campos de las categorías de inventario: agregar, editar, ocultar, eliminar y reordenar campos.',
    permisos: [
      { key: 'ver_campos',            accion: 'ver',         label: 'Ver campos inventario',            labelCorto: 'Ver campos',    desc: 'Permite acceder a la sección de campos inventario desde el menú lateral y ver la configuración de cada categoría.' },
      { key: 'agregar_campo',         accion: 'crear',       label: 'Agregar campos',                   labelCorto: 'Agregar campo', desc: 'Permite agregar nuevos campos personalizados a cualquier categoría de inventario.' },
      { key: 'editar_campo',          accion: 'editar',      label: 'Editar campos',                    labelCorto: 'Editar campo',  desc: 'Permite renombrar campos del sistema y modificar campos personalizados existentes.' },
      { key: 'ocultar_campo',         accion: 'editar',      label: 'Ocultar / mostrar campos',         labelCorto: 'Ocultar campo', desc: 'Permite activar o desactivar la visibilidad de campos del sistema en cada categoría.' },
      { key: 'eliminar_campo',        accion: 'eliminar',    label: 'Eliminar campos',                  labelCorto: 'Eliminar campo',desc: 'Permite eliminar campos personalizados de una categoría de inventario.' },
      { key: 'reordenar_campos',      accion: 'editar',      label: 'Reordenar campos',                 labelCorto: 'Reordenar',     desc: 'Permite cambiar el orden en que se muestran los campos arrastrando y soltando.' },
      { key: 'gestionar_campos_base', accion: 'administrar', label: 'Gestionar campos base protegidos', labelCorto: 'Campos base',   desc: 'Permite editar y reorganizar campos protegidos del sistema (marcados como 🔒 base).' },
    ],
  },
  {
    key: 'tickets', label: 'Tickets', icon: '🎫', pasoLabel: 'Tickets',
    descripcion: 'Acceso al módulo de tickets de soporte.',
    permisos: [
      { key: 'ver_tickets',         accion: 'ver',         label: 'Ver tickets propios',         labelCorto: 'Ver tick.',    desc: 'Permite ver los tickets creados por el propio usuario.' },
      { key: 'crear_ticket',        accion: 'crear',       label: 'Crear nuevo ticket',          labelCorto: 'Crear tick.',  desc: 'Permite abrir solicitudes de soporte técnico.', default: true },
      { key: 'editar_ticket',       accion: 'editar',      label: 'Editar ticket propio',        labelCorto: 'Editar tick.', desc: 'Permite editar un ticket propio mientras está abierto.' },
      { key: 'gestionar_tickets',   accion: 'administrar', label: 'Gestionar todos los tickets', labelCorto: 'Gest. tick.',  desc: 'Permite ver, responder y cambiar el estado de cualquier ticket.' },
      { key: 'eliminar_ticket',     accion: 'eliminar',    label: 'Eliminar tickets',            labelCorto: 'Elim. tick.',  desc: 'Permite eliminar tickets del sistema de forma permanente.' },
      { key: 'ver_alertas_tickets', accion: 'accion',      label: 'Ver alertas de tickets',      labelCorto: 'Alert. tick.', desc: 'Muestra un banner de alertas con tickets abiertos en el Dashboard.' },
      { key: 'exportar_tickets',    accion: 'exportar',    label: 'Exportar tickets',            labelCorto: 'Exp. tick.',   desc: 'Permite exportar el listado de tickets a CSV, Excel o PDF.', default: true },
    ],
  },
  {
    key: 'requerimientos', label: 'Requerimientos', icon: '🛒', pasoLabel: 'Requerimientos',
    descripcion: 'Acceso al módulo de requerimientos y compras.',
    permisos: [
      { key: 'ver_requerimientos',           accion: 'ver',       label: 'Ver requerimientos',       labelCorto: 'Ver req.',    desc: 'Permite consultar las solicitudes de compra o requerimientos registrados.' },
      { key: 'crear_requerimiento',          accion: 'crear',     label: 'Crear requerimiento',      labelCorto: 'Crear req.',  desc: 'Permite ingresar nuevas solicitudes de compra o requerimientos.' },
      { key: 'editar_requerimiento',         accion: 'editar',    label: 'Editar requerimiento',     labelCorto: 'Editar req.', desc: 'Permite modificar requerimientos ya registrados.' },
      { key: 'eliminar_requerimiento',       accion: 'eliminar',  label: 'Eliminar requerimiento',   labelCorto: 'Elim. req.',  desc: 'Permite eliminar requerimientos del sistema.' },
      { key: 'importar_requerimientos',      accion: 'importar',  label: 'Importar requerimientos',  labelCorto: 'Imp. req.',   desc: 'Permite cargar requerimientos en masa desde un archivo.' },
      { key: 'exportar_requerimientos',      accion: 'exportar',  label: 'Exportar requerimientos',  labelCorto: 'Exp. req.',   desc: 'Permite exportar el listado de requerimientos a Excel o PDF.' },
      { key: 'ver_auditoria_requerimientos', accion: 'auditoria', label: 'Ver auditoría de compras',  labelCorto: 'Aud. Req.',   desc: 'Permite ver el historial de cambios en el módulo de requerimientos.' },
    ],
  },
  {
    key: 'ausencia', label: 'Ausencia', icon: '📅', pasoLabel: 'Ausencia',
    descripcion: 'Acceso al módulo de ausencias del personal. Cada acción puede activarse de forma independiente.',
    permisos: [
      { key: 'ver_propias_ausencias', accion: 'ver',       label: 'Ver propias ausencias',        labelCorto: 'Ver prop.',   desc: 'Permite al usuario ver su propio registro de ausencias (Mis ausencias).' },
      { key: 'ver_ausencias',         accion: 'ver',       label: 'Ver ausencias del personal',   labelCorto: 'Ver aus.',    desc: 'Permite consultar el registro de ausencias de todo el personal.' },
      { key: 'crear_ausencias',       accion: 'crear',     label: 'Registrar ausencias',          labelCorto: 'Crear aus.',  desc: 'Permite ingresar nuevas ausencias para cualquier funcionario.' },
      { key: 'editar_ausencias',      accion: 'editar',    label: 'Editar ausencias',             labelCorto: 'Editar aus.', desc: 'Permite modificar ausencias ya registradas.' },
      { key: 'eliminar_ausencias',    accion: 'eliminar',  label: 'Eliminar ausencias',           labelCorto: 'Elim. aus.',  desc: 'Permite eliminar registros de ausencias del sistema.' },
      { key: 'aprobar_ausencias',     accion: 'aprobar',   label: 'Aprobar / rechazar ausencias', labelCorto: 'Aprob. aus.', desc: 'Permite cambiar el estado de una ausencia a Aprobada o Rechazada.' },
      { key: 'exportar_ausencias',    accion: 'exportar',  label: 'Exportar ausencias',           labelCorto: 'Exp. aus.',   desc: 'Permite exportar el registro de ausencias a PDF o Excel.' },
      { key: 'ver_auditoria_permisos',accion: 'auditoria', label: 'Ver auditoría de ausencias',   labelCorto: 'Aud. Aus.',   desc: 'Permite ver el historial de cambios en el módulo de ausencias.' },
    ],
  },
  {
    key: 'compensatorios', label: 'Compensatorios', icon: '🗓️', pasoLabel: 'Compensatorios',
    descripcion: 'Acceso al módulo de días compensatorios (desfiles, trabajo de verano, reemplazos, etc.). Cada acción puede activarse de forma independiente.',
    permisos: [
      { key: 'ver_compensatorios',           accion: 'ver',       label: 'Ver días compensatorios',        labelCorto: 'Ver comp.',    desc: 'Permite consultar el registro de días compensatorios del personal.' },
      { key: 'crear_compensatorios',         accion: 'crear',     label: 'Registrar compensatorios',       labelCorto: 'Crear comp.',  desc: 'Permite ingresar nuevos días compensatorios para cualquier funcionario.' },
      { key: 'editar_compensatorios',        accion: 'editar',    label: 'Editar compensatorios',          labelCorto: 'Editar comp.', desc: 'Permite modificar registros de días compensatorios ya existentes.' },
      { key: 'eliminar_compensatorios',      accion: 'eliminar',  label: 'Eliminar compensatorios',        labelCorto: 'Elim. comp.',  desc: 'Permite eliminar registros de días compensatorios del sistema.' },
      { key: 'exportar_compensatorios',      accion: 'exportar',  label: 'Exportar compensatorios',        labelCorto: 'Exp. comp.',   desc: 'Permite exportar el registro de días compensatorios a PDF, Excel o CSV.' },
      { key: 'ver_auditoria_compensatorios', accion: 'auditoria', label: 'Ver auditoría de compensatorios',labelCorto: 'Aud. Comp.',   desc: 'Permite acceder al historial y auditoría de movimientos de días compensatorios.' },
    ],
  },
  {
    key: 'ajustes', label: 'Ajustes y usuarios', icon: '⚙️', pasoLabel: 'Ajustes',
    descripcion: 'Control de acceso a la sección de Ajustes: personalización visual, gestión de usuarios y configuración de roles.',
    permisos: [
      { key: 'ver_ajustes',             accion: 'ver',         label: 'Ver ajustes',                 labelCorto: 'Ver aj.',      desc: 'Permite acceder y visualizar la sección de Ajustes del sistema.' },
      { key: 'gestionar_ajustes',       accion: 'administrar', label: 'Personalizar sistema',        labelCorto: 'Ajustes',      desc: 'Permite acceder a la configuración visual del sistema (logo, colores, nombre).' },
      { key: 'guardar_cambios_ajustes', accion: 'editar',      label: 'Guardar cambios de ajustes',  labelCorto: 'Guardar aj.',  desc: 'Permite guardar cambios realizados en la configuración general del sistema.' },
      { key: 'gestionar_usuarios',      accion: 'administrar', label: 'Gestionar usuarios',          labelCorto: 'Gest. usr.',   desc: 'Permite ver y administrar la lista completa de usuarios del sistema.' },
      { key: 'invitar_usuario',         accion: 'crear',       label: 'Invitar usuarios',            labelCorto: 'Invitar',      desc: 'Permite enviar invitaciones para que nuevos usuarios accedan al sistema.' },
      { key: 'editar_usuario',          accion: 'editar',      label: 'Editar usuarios',             labelCorto: 'Editar usr.',  desc: 'Permite modificar datos, rol y permisos de usuarios existentes.' },
      { key: 'eliminar_usuario',        accion: 'eliminar',    label: 'Eliminar usuarios',           labelCorto: 'Elim. usr.',   desc: 'Permite dar de baja cuentas de usuario del sistema.' },
      { key: 'notificar_ausencia_correo', accion: 'accion',    label: 'Notificar ausencia por correo', labelCorto: 'Notif. correo', desc: 'Permite enviar notificaciones automáticas por correo al registrar una ausencia.' },
      { key: 'editar_roles_permisos',   accion: 'administrar', label: 'Editar roles/permisos',       labelCorto: 'Editar roles', desc: 'Permite modificar los roles y permisos asignados a los usuarios.' },
      { key: 'gestionar_roles',         accion: 'administrar', label: 'Gestionar roles del sistema',  labelCorto: 'Roles',        desc: 'Permite administrar los permisos predeterminados de cada rol desde el Mantenedor de Roles.' },
      { key: 'ver_historial_usuarios',  accion: 'ver',         label: 'Ver historial de usuarios',   labelCorto: 'Historial',    desc: 'Permite ver el historial completo de actividad, tickets, ausencias e inventario de cada usuario.' },
    ],
  },
  {
    key: 'reglamentos', label: 'Reglamentos', icon: '📖', pasoLabel: 'Reglamentos',
    descripcion: 'Acceso al módulo de documentos institucionales: reglamentos, protocolos, manuales y circulares.',
    permisos: [
      { key: 'ver_reglamentos',                  accion: 'ver',         label: 'Ver reglamentos',              labelCorto: 'Ver regl.',   desc: 'Permite consultar el listado de documentos institucionales.' },
      { key: 'crear_reglamentos',                accion: 'crear',       label: 'Crear reglamentos',            labelCorto: 'Crear regl.', desc: 'Permite subir nuevos documentos institucionales.' },
      { key: 'editar_reglamentos',               accion: 'editar',      label: 'Editar reglamentos',           labelCorto: 'Editar regl.',desc: 'Permite modificar datos de documentos existentes.' },
      { key: 'eliminar_reglamentos',             accion: 'eliminar',    label: 'Eliminar reglamentos',         labelCorto: 'Elim. regl.', desc: 'Permite enviar documentos a la papelera.' },
      { key: 'descargar_reglamentos',            accion: 'exportar',    label: 'Descargar reglamentos',        labelCorto: 'Desc. regl.', desc: 'Permite descargar archivos de documentos.' },
      { key: 'gestionar_versiones_reglamentos',  accion: 'administrar', label: 'Gestionar versiones',          labelCorto: 'Versiones',   desc: 'Permite subir nuevas versiones de documentos.' },
      { key: 'administrar_reglamentos',          accion: 'administrar', label: 'Administrar reglamentos',       labelCorto: 'Admin. regl.',desc: 'Gestión completa del módulo: habilita las acciones avanzadas (gestión de versiones) sin depender de permisos individuales. Pensado para responsables del módulo.' },
      { key: 'ver_auditoria_reglamentos',        accion: 'auditoria',   label: 'Ver auditoría de reglamentos', labelCorto: 'Aud. Regl.',  desc: 'Permite ver el historial de cambios en el módulo de reglamentos.' },
    ],
  },
  {
    key: 'personal', label: 'Personal', icon: '🧑‍🏫', pasoLabel: 'Personal',
    descripcion: 'Acceso al módulo de Personal: contrataciones, reemplazos y documentos del personal del establecimiento.',
    permisos: [
      { key: 'ver_contrataciones',           accion: 'ver',       label: 'Ver contrataciones',            labelCorto: 'Ver contrat.',   desc: 'Permite ver el listado de contrataciones del personal.' },
      { key: 'crear_contrataciones',         accion: 'crear',     label: 'Crear contrataciones',          labelCorto: 'Crear contrat.', desc: 'Permite registrar nuevas contrataciones de personal.' },
      { key: 'editar_contrataciones',        accion: 'editar',    label: 'Editar contrataciones',         labelCorto: 'Editar contrat.',desc: 'Permite modificar contrataciones ya registradas.' },
      { key: 'eliminar_contrataciones',      accion: 'eliminar',  label: 'Eliminar contrataciones',       labelCorto: 'Elim. contrat.', desc: 'Permite eliminar registros de contrataciones y sus documentos.' },
      { key: 'ver_reemplazos',               accion: 'ver',       label: 'Ver reemplazos',                labelCorto: 'Ver reempl.',    desc: 'Permite ver el listado de reemplazos del personal.' },
      { key: 'crear_reemplazos',             accion: 'crear',     label: 'Crear reemplazos',              labelCorto: 'Crear reempl.',  desc: 'Permite registrar nuevos reemplazos por ausencias del personal.' },
      { key: 'editar_reemplazos',            accion: 'editar',    label: 'Editar reemplazos',             labelCorto: 'Editar reempl.', desc: 'Permite modificar reemplazos ya registrados.' },
      { key: 'eliminar_reemplazos',          accion: 'eliminar',  label: 'Eliminar reemplazos',           labelCorto: 'Elim. reempl.',  desc: 'Permite eliminar registros de reemplazos del sistema.' },
      { key: 'ver_documentos_personal',      accion: 'ver',       label: 'Ver documentos del personal',   labelCorto: 'Ver docs.',      desc: 'Permite ver y descargar los documentos asociados al personal.' },
      { key: 'subir_documentos_personal',    accion: 'crear',     label: 'Subir documentos del personal', labelCorto: 'Subir docs.',    desc: 'Permite subir nuevos documentos (contratos, anexos, decretos, etc.).' },
      { key: 'eliminar_documentos_personal', accion: 'eliminar',  label: 'Eliminar documentos del personal', labelCorto: 'Elim. docs.', desc: 'Permite eliminar documentos del personal de forma permanente.' },
      { key: 'ver_auditoria_personal',       accion: 'auditoria', label: 'Ver auditoría de personal',      labelCorto: 'Aud. Pers.',     desc: 'Permite ver el historial de cambios en el módulo de Personal.' },
    ],
  },
  {
    key: 'papelera', label: 'Papelera', icon: '🗑️', pasoLabel: 'Papelera',
    descripcion: 'Control de acceso a la Papelera de reciclaje. Los registros eliminados se conservan 30 días antes de borrarse automáticamente.',
    permisos: [
      { key: 'ver_papelera',             accion: 'ver',       label: 'Ver Papelera',             labelCorto: 'Ver pap.',    desc: 'Permite acceder a la Papelera y ver los registros eliminados de todos los módulos.' },
      { key: 'restaurar_registros',      accion: 'accion',    label: 'Restaurar registros',      labelCorto: 'Restaurar',   desc: 'Permite restaurar registros desde la Papelera al módulo de origen.' },
      { key: 'eliminar_permanentemente', accion: 'eliminar',  label: 'Eliminar permanentemente', labelCorto: 'Elim. perm.', desc: 'Permite eliminar registros de forma permanente e irrecuperable desde la Papelera.' },
      { key: 'ver_auditoria_papelera',   accion: 'auditoria', label: 'Ver auditoría de papelera',labelCorto: 'Aud. Pap.',   desc: 'Permite ver el historial de acciones realizadas en la Papelera.' },
    ],
  },
]

// Permisos legado que existen por compatibilidad pero NO se muestran agrupados
// en el wizard (se conservan para PERMISOS_VACIO y presets de rol antiguos).
export const PERMISOS_LEGACY = [
  { key: 'gestionar_campos', accion: 'administrar', label: 'Gestionar campos de inventario (legado)', labelCorto: 'Campos', desc: 'Permiso heredado de gestión completa de campos. Se conserva por compatibilidad.' },
]

// ─── Derivaciones (no editar a mano; se calculan del catálogo) ───────────────

// Lista plana de todas las acciones — shape { key, accion, label, labelCorto, desc }
export const ACCIONES = [
  ...MODULOS.flatMap(m => m.permisos),
  ...PERMISOS_LEGACY,
]

// Grupos para el wizard de Usuarios (con paso y descripción)
// Los pasos 1 y 2 son "Nivel de acceso" y "Módulos"; los módulos empiezan en 3.
export const GRUPOS_USUARIOS = MODULOS.map((m, i) => ({
  key: m.key,
  label: m.label,
  paso: i + 3,
  soloPersonalizado: false,
  descripcion: m.descripcion,
  permisos: m.permisos.map(p => p.key),
}))

// Grupos para el Mantenedor de Roles (con icono)
export const GRUPOS_ROLES = MODULOS.map(m => ({
  key: m.key,
  label: m.label,
  icon: m.icon,
  permisos: m.permisos.map(p => p.key),
}))

// Pasos del stepper del wizard, derivados del orden de MODULOS
export const STEPS_MODULOS = MODULOS.map((m, i) => ({ n: i + 3, label: m.pasoLabel }))

// Último paso del wizard = 2 pasos fijos + un paso por módulo
export const ULTIMO_PASO = 2 + MODULOS.length

// Todas las claves de permiso en false — base para presets y merges
export const PERMISOS_VACIO = Object.fromEntries(ACCIONES.map(a => [a.key, false]))

// Todas las claves de permiso (útil para validaciones)
export const TODAS_LAS_CLAVES = ACCIONES.map(a => a.key)

// ═══════════════════════════════════════════════════════════════════════════
// CAPA DE CONSUMO — estructuras declarativas para el motor de permisos
// (src/utils/permisos.js). Todo esto es DATO, sin lógica de UI. Agregar un
// módulo nuevo a MODULOS lo integra automáticamente en el motor; solo hay que
// registrar aquí sus guardas de ruta (GUARDAS_RUTA) y, si aplica, restricciones
// duras por rol (RESTRICCIONES_ROL).
// ═══════════════════════════════════════════════════════════════════════════

// Mapa clave-de-permiso → key del módulo al que pertenece (derivado del catálogo)
export const MODULO_DE_PERMISO = Object.fromEntries(
  MODULOS.flatMap(m => m.permisos.map(p => [p.key, m.key]))
)

// Valores por defecto cuando la clave NO está presente en el JSONB del usuario.
// Backward-compat: históricamente `crear_ticket`/`exportar_tickets` se asumían
// habilitados salvo que estuvieran explícitamente en `false` (`p.x !== false`).
export const DEFAULTS_PERMISO = Object.fromEntries(
  ACCIONES.filter(a => a.default !== undefined).map(a => [a.key, a.default])
)

// Restricciones duras por rol — prevalecen sobre el JSONB almacenado. Garantizan
// la matriz oficial aunque un usuario legacy tenga permisos "stale".
//   · modulosNegados: keys de MODULOS que el rol NO puede usar bajo ninguna
//     circunstancia (equivale a los antiguos `rolPermite*` de App.jsx).
//   · paginasPermitidas: si está definido, el rol SOLO puede abrir esas páginas.
export const RESTRICCIONES_ROL = {
  directivo: { modulosNegados: ['tickets', 'requerimientos', 'ausencia'] },
  soporte:   { modulosNegados: ['requerimientos'] },
  visor_requerimientos: { paginasPermitidas: ['dashboard', 'requerimientos', 'tickets'] },
}

// Guardas de ruta declarativas: página → permiso(s) requerido(s).
// Valor admitido:
//   · string            → requiere ese permiso (vía can()).
//   · string[]          → requiere CUALQUIERA de esos permisos (OR).
//   · (perm) => boolean → predicado libre sobre el objeto del motor.
// Las páginas no listadas quedan accesibles (dashboard, mis_ausencias se
// resuelven aparte con lógica de fallback en el motor).
export const GUARDAS_RUTA = {
  // 'inventario' NO se lista: su acceso se resuelve con el fallback soloStaff del
  // motor (staff sin inventario se redirige a tickets, no se bloquea a dashboard).
  auditoria:                'ver_auditoria_inventario',
  tickets:                  ['ver_tickets', 'gestionar_tickets'],
  auditoria_tickets:        'gestionar_tickets',
  requerimientos:           'ver_requerimientos',
  auditoria_requerimientos: 'ver_auditoria_requerimientos',
  compensatorios:           'ver_compensatorios',
  permisos:                 ['crear_ausencias', 'editar_ausencias'],
  auditoria_permisos:       ['ver_auditoria_permisos', 'ver_auditoria_compensatorios'],
  campos:                   ['ver_campos', 'gestionar_campos'],
  usuarios:                 ['invitar_usuario', 'editar_usuario', 'eliminar_usuario', 'gestionar_usuarios', 'editar_roles_permisos'],
  // Ajustes (personalización) veta a directivo aunque tenga el flag (matriz oficial).
  ajustes:                  (perm) => !perm.esDirectivo && ['gestionar_ajustes', 'ver_ajustes', 'guardar_cambios_ajustes'].some(k => perm.can(k)),
  mantenedor_roles:         'gestionar_roles',
  auditoria_general:        (perm) => perm.esAdmin,
  papelera:                 'ver_papelera',
  papelera_auditoria:       'ver_auditoria_papelera',
  reglamentos:              'ver_reglamentos',
  reglamentos_auditoria:    'ver_auditoria_reglamentos',
  personal:                 ['ver_contrataciones', 'ver_reemplazos', 'ver_documentos_personal'],
  personal_contrataciones:  ['ver_contrataciones', 'ver_reemplazos', 'ver_documentos_personal'],
  personal_reemplazos:      ['ver_contrataciones', 'ver_reemplazos', 'ver_documentos_personal'],
  personal_documentos:      ['ver_contrataciones', 'ver_reemplazos', 'ver_documentos_personal'],
  // Backups es un módulo exclusivo de administradores (no se expone en el wizard
  // de permisos): la guarda solo deja pasar al rol admin.
  backups:                  (perm) => perm.esAdmin,
  backups_actividad:        (perm) => perm.esAdmin,
}

// ─── Presets de rol (FUENTE ÚNICA) ──────────────────────────────────────────
// Definición única de los permisos base de cada rol. Consumida por:
//   · src/pages/Usuarios.jsx  (botón "Aplicar rol" del wizard de creación)
//   · src/App.jsx             (fallback cuando la BD aún no devolvió permisos)
// La tabla `permisos_rol` en Supabase es la fuente viva en runtime (editable
// desde el Mantenedor de Roles); su seed inicial debe reflejar estos valores.
export const PRESETS_ROL = {
  admin: {
    permisos:   Object.fromEntries(ACCIONES.map((a) => [a.key, true])),
    categorias: ['todos'],
  },
  directivo: {
    permisos: {
      ...PERMISOS_VACIO,
      ver_inventario: true, agregar_bien: true, editar_bien: true,
      importar_csv: true, exportar: true,
      registrar_prestamo: true, registrar_incidencia: true,
      ver_auditoria_inventario: true,
    },
    categorias: ['todos'],
  },
  coordinador: {
    permisos: {
      ...PERMISOS_VACIO,
      ver_tickets: true, crear_ticket: true, editar_ticket: true, exportar_tickets: true,
      ver_propias_ausencias: true, exportar_ausencias: true,
    },
    categorias: ['todos'],
  },
  docente: {
    permisos: {
      ...PERMISOS_VACIO,
      ver_tickets: true, crear_ticket: true, editar_ticket: true, exportar_tickets: true,
      ver_propias_ausencias: true, exportar_ausencias: true,
    },
    categorias: ['todos'],
  },
  asistente: {
    permisos: {
      ...PERMISOS_VACIO,
      ver_tickets: true, crear_ticket: true, editar_ticket: true, exportar_tickets: true,
      ver_propias_ausencias: true, exportar_ausencias: true,
    },
    categorias: ['todos'],
  },
  administrativo: {
    permisos: {
      ...PERMISOS_VACIO,
      ver_tickets: true, crear_ticket: true, editar_ticket: true, exportar_tickets: true,
      ver_propias_ausencias: true, exportar_ausencias: true,
    },
    categorias: ['todos'],
  },
  soporte: {
    permisos: {
      ...PERMISOS_VACIO,
      ver_tickets: true, crear_ticket: true, editar_ticket: true,
      gestionar_tickets: true, eliminar_ticket: true, ver_alertas_tickets: true, exportar_tickets: true,
      ver_propias_ausencias: true, exportar_ausencias: true,
    },
    categorias: ['todos'],
  },
  visor_requerimientos: { permisos: { ...PERMISOS_VACIO, ver_tickets: true }, categorias: [] },

  // ── Legacy — roles anteriores, conservados para usuarios ya existentes ──
  encargado_inventario: { permisos: { ver_inventario: true, agregar_bien: true, editar_bien: true, eliminar_bien: false, eliminar_lote: false, gestionar_categorias: false, importar_csv: false, gestionar_usuarios: false, exportar: true, registrar_prestamo: true, registrar_incidencia: true, ver_tickets: false, gestionar_tickets: false }, categorias: ['todos'] },
  encargado_soporte:    { permisos: { ...PERMISOS_VACIO, ver_tickets: true, gestionar_tickets: true, ver_alertas_tickets: true }, categorias: ['todos'] },
  encargado_permisos:   { permisos: { ...PERMISOS_VACIO, ver_inventario: true, gestionar_usuarios: true, ver_tickets: true }, categorias: ['todos'] },
  editor:               { permisos: { ver_inventario: true, agregar_bien: true, editar_bien: true, eliminar_bien: false, eliminar_lote: false, gestionar_categorias: false, importar_csv: false, gestionar_usuarios: false, exportar: true, registrar_prestamo: true, registrar_incidencia: true, ver_tickets: true, gestionar_tickets: false }, categorias: ['todos'] },
  encargado:            { permisos: { ver_inventario: true, agregar_bien: false, editar_bien: false, eliminar_bien: false, eliminar_lote: false, gestionar_categorias: false, importar_csv: false, gestionar_usuarios: false, exportar: false, registrar_prestamo: false, registrar_incidencia: false, ver_tickets: true, gestionar_tickets: false }, categorias: ['todos'] },
}
