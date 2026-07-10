// src/utils/permisos.js
// ═══════════════════════════════════════════════════════════════════════════
// MOTOR DE PERMISOS — capa de consumo del catálogo (src/config/permisos.js)
// ---------------------------------------------------------------------------
// `construirPermisos(usuario, permisosRaw)` centraliza EN UN SOLO LUGAR las
// reglas que antes estaban dispersas por App.jsx:
//   · bypass de admin,
//   · restricciones duras por rol (RESTRICCIONES_ROL),
//   · valores por defecto backward-compat (DEFAULTS_PERMISO),
//   · merge del JSONB rol + usuario (ya fusionado antes de llegar aquí).
//
// Devuelve:
//   · `can(clave)`            → chequeo atómico de un permiso (la regla única).
//   · `mods[modulo][accion]`  → matriz genérica derivada del catálogo; es la API
//                               escalable para módulos FUTUROS (no requiere tocar
//                               este archivo si el módulo se registra en MODULOS).
//   · flags/objetos con nombre (permisosTickets, permisosReqs, …) que preservan
//     los contratos de props que consumen las páginas actuales.
//   · `paginaBloqueada(pagina)` y `paginaSegura(pagina)` → guardas de ruta
//     data-driven (reemplazan el antiguo `soloAdmin`/`soloStaff`).
// ═══════════════════════════════════════════════════════════════════════════

import {
  MODULOS,
  MODULO_DE_PERMISO,
  DEFAULTS_PERMISO,
  RESTRICCIONES_ROL,
  GUARDAS_RUTA,
  PERMISOS_OBLIGATORIOS,
  PAGINAS_OBLIGATORIAS,
} from '../config/permisos'

// Módulos obligatorios (Mis Ausencias, Tickets, Reglamentos): sus permisos base
// se conceden a TODOS los roles, por encima de cualquier restricción de rol.
const OBLIGATORIOS_SET = new Set(PERMISOS_OBLIGATORIOS)
const PAGINAS_OBLIGATORIAS_SET = new Set(PAGINAS_OBLIGATORIAS)

// Páginas del grupo Ausencias — para el fallback de redirección (a "Mis ausencias").
const PAGINAS_AUSENCIAS = new Set(['permisos', 'compensatorios', 'auditoria_permisos'])

export function construirPermisos(usuario, permisosRaw) {
  const rol         = usuario?.rol
  const esAdmin     = rol === 'admin'
  const esVisorReq  = rol === 'visor_requerimientos'
  const esSoporte   = rol === 'soporte'
  const esDirectivo = rol === 'directivo'
  const p           = permisosRaw ?? {}

  const restric         = RESTRICCIONES_ROL[rol] ?? {}
  const modulosNegados  = new Set(restric.modulosNegados ?? [])
  const rolPermiteModulo = (moduloKey) => !modulosNegados.has(moduloKey)

  // ── Regla única de permiso ────────────────────────────────────────────────
  const can = (clave) => {
    if (esAdmin) return true
    // Módulos obligatorios: siempre concedidos, aun si el rol tiene el módulo
    // negado o el JSONB lo trae en false. Prevalecen sobre cualquier restricción.
    if (OBLIGATORIOS_SET.has(clave)) return true
    const modKey = MODULO_DE_PERMISO[clave]
    if (modKey && modulosNegados.has(modKey)) return false
    const val = p[clave]
    if (val === undefined || val === null) return DEFAULTS_PERMISO[clave] ?? false
    return !!val
  }

  // ── Matriz genérica por módulo/acción (API escalable) ─────────────────────
  // Si un módulo tiene varias claves con la misma `accion`, se combinan con OR.
  const mods = {}
  for (const m of MODULOS) {
    const acc = {}
    for (const perm of m.permisos) acc[perm.accion] = (acc[perm.accion] ?? false) || can(perm.key)
    mods[m.key] = acc
  }

  // ── Flags/objetos con nombre (contratos de las páginas actuales) ──────────
  const puedeVerInventario          = can('ver_inventario')
  const puedeVerAuditoriaInventario = can('ver_auditoria_inventario')

  const puedeVerTickets        = can('ver_tickets') || can('gestionar_tickets')
  const puedeGestionarTickets  = can('gestionar_tickets')
  const puedeVerAlertasTickets = can('ver_alertas_tickets') || (esSoporte && rolPermiteModulo('tickets'))
  const puedeVerAuditoriaTickets = can('gestionar_tickets')
  const permisosTickets = {
    verPropios: can('ver_tickets'),
    crear:      can('crear_ticket'),
    editar:     can('editar_ticket'),
    gestionar:  can('gestionar_tickets'),
    eliminar:   can('eliminar_ticket'),
    exportar:   can('exportar_tickets'),
  }

  const permisosReqs = {
    ver:          can('ver_requerimientos'),
    crear:        can('crear_requerimiento'),
    editar:       can('editar_requerimiento'),
    eliminar:     can('eliminar_requerimiento'),
    importar:     can('importar_requerimientos'),
    exportar:     can('exportar_requerimientos'),
    verAuditoria: can('ver_auditoria_requerimientos'),
  }
  const puedeVerAuditoriaReq = permisosReqs.verAuditoria

  // "Mis Ausencias" es un módulo obligatorio → el grupo Ausencias es accesible
  // para todos (la gestión de ausencias de terceros sigue gateada aparte).
  const puedeAccederAusencias = can('ver_propias_ausencias')
  const permisosAusencia = {
    ver:          can('ver_ausencias'),
    crear:        can('crear_ausencias'),
    editar:       can('editar_ausencias'),
    eliminar:     can('eliminar_ausencias'),
    aprobar:      can('aprobar_ausencias'),
    exportar:     can('exportar_ausencias'),
    verAuditoria: can('ver_auditoria_permisos'),
    invitarUsuario:       can('invitar_usuario'),
    editarUsuario:        can('editar_usuario'),
    eliminarUsuario:      can('eliminar_usuario'),
    verHistorialUsuarios: can('ver_historial_usuarios'),
  }
  const puedeVerAuditoriaPermisos = permisosAusencia.verAuditoria
  const puedeGestionarAusencias   = esAdmin || can('crear_ausencias') || can('editar_ausencias')

  const permisosComp = {
    ver:          can('ver_compensatorios'),
    crear:        can('crear_compensatorios'),
    editar:       can('editar_compensatorios'),
    eliminar:     can('eliminar_compensatorios'),
    exportar:     can('exportar_compensatorios'),
    verAuditoria: can('ver_auditoria_compensatorios'),
  }
  const puedeVerCompensatorios          = permisosComp.ver
  const puedeVerAuditoriaCompensatorios = permisosComp.verAuditoria

  const puedeAccederUsuarios = esAdmin || can('invitar_usuario') || can('editar_usuario')
    || can('eliminar_usuario') || can('gestionar_usuarios') || can('editar_roles_permisos')
  const puedeGestionarAjustes = esAdmin || (!esDirectivo
    && (can('gestionar_ajustes') || can('ver_ajustes') || can('guardar_cambios_ajustes')))
  const puedeGestionarRoles = can('gestionar_roles')

  const puedeGestionarCampos = esAdmin || can('gestionar_campos') || can('ver_campos')
  const permisosCampos = {
    ver:           esAdmin || can('ver_campos')           || can('gestionar_campos'),
    agregar:       esAdmin || can('agregar_campo')        || can('gestionar_campos'),
    editar:        esAdmin || can('editar_campo')         || can('gestionar_campos'),
    ocultar:       esAdmin || can('ocultar_campo')        || can('gestionar_campos'),
    eliminar:      esAdmin || can('eliminar_campo')       || can('gestionar_campos'),
    reordenar:     esAdmin || can('reordenar_campos')     || can('gestionar_campos'),
    gestionarBase: esAdmin || can('gestionar_campos_base') || can('gestionar_campos'),
  }

  const puedeVerAuditoriaGeneral = esAdmin
    || can('ver_auditoria_inventario')
    || can('ver_auditoria_requerimientos')
    || can('ver_auditoria_permisos')
    || can('ver_auditoria_compensatorios')
    || can('ver_auditoria_personal')
    || can('ver_auditoria_reglamentos')
    || can('ver_auditoria_papelera')
    || can('ver_actividad_backups')

  // Backups: módulo asignable por permisos (admin recibe todo por bypass).
  const permisosBackups = {
    ver:               can('ver_backups'),
    crear:             can('crear_backups'),
    descargar:         can('descargar_backups'),
    renombrar:         can('renombrar_backups'),
    editarDescripcion: can('editar_descripcion_backups'),
    duplicar:          can('duplicar_backups'),
    restaurar:         can('restaurar_backups'),
    eliminar:          can('eliminar_backups'),
    verActividad:      can('ver_actividad_backups'),
  }
  const puedeVerBackups = permisosBackups.ver

  const permisosPersonal = {
    ver_contrataciones:           can('ver_contrataciones'),
    crear_contrataciones:         can('crear_contrataciones'),
    editar_contrataciones:        can('editar_contrataciones'),
    eliminar_contrataciones:      can('eliminar_contrataciones'),
    ver_reemplazos:               can('ver_reemplazos'),
    crear_reemplazos:             can('crear_reemplazos'),
    editar_reemplazos:            can('editar_reemplazos'),
    eliminar_reemplazos:          can('eliminar_reemplazos'),
    ver_documentos_personal:      can('ver_documentos_personal'),
    subir_documentos_personal:    can('subir_documentos_personal'),
    eliminar_documentos_personal: can('eliminar_documentos_personal'),
    ver_auditoria_personal:       can('ver_auditoria_personal'),
  }
  const puedeVerPersonal = esAdmin
    || permisosPersonal.ver_contrataciones
    || permisosPersonal.ver_reemplazos
    || permisosPersonal.ver_documentos_personal

  const puedeVerPapelera          = can('ver_papelera')
  const puedeVerAuditoriaPapelera = can('ver_auditoria_papelera')
  const permisosPapelera = {
    restaurar:          can('restaurar_registros'),
    eliminarPermanente: can('eliminar_permanentemente'),
    verAuditoria:       can('ver_auditoria_papelera'),
  }

  const puedeAdministrarReglamentos = can('administrar_reglamentos')
  const permisosReglamentos = {
    ver:          can('ver_reglamentos'),
    crear:        can('crear_reglamentos'),
    editar:       can('editar_reglamentos'),
    eliminar:     can('eliminar_reglamentos'),
    descargar:    can('descargar_reglamentos'),
    versiones:    esAdmin || can('gestionar_versiones_reglamentos') || puedeAdministrarReglamentos,
    administrar:  puedeAdministrarReglamentos,
    verAuditoria: can('ver_auditoria_reglamentos'),
  }
  const puedeVerReglamentos = permisosReglamentos.ver

  // Objeto expuesto — se referencia dentro de las guardas de ruta declarativas.
  const perm = {
    usuario, rol, esAdmin, esVisorReq, esSoporte, esDirectivo,
    can, mods, rolPermiteModulo,
    // flags con nombre
    puedeVerInventario, puedeVerAuditoriaInventario,
    puedeVerTickets, puedeGestionarTickets, puedeVerAlertasTickets, puedeVerAuditoriaTickets, permisosTickets,
    permisosReqs, puedeVerAuditoriaReq,
    puedeAccederAusencias, permisosAusencia, puedeVerAuditoriaPermisos, puedeGestionarAusencias,
    permisosComp, puedeVerCompensatorios, puedeVerAuditoriaCompensatorios,
    puedeAccederUsuarios, puedeGestionarAjustes, puedeGestionarRoles,
    puedeGestionarCampos, permisosCampos,
    puedeVerAuditoriaGeneral,
    puedeVerBackups, permisosBackups,
    permisosPersonal, puedeVerPersonal,
    puedeVerPapelera, puedeVerAuditoriaPapelera, permisosPapelera,
    puedeAdministrarReglamentos, permisosReglamentos, puedeVerReglamentos,
  }

  // ── Guardas de ruta ───────────────────────────────────────────────────────
  const evaluarGuarda = (guarda) => {
    if (guarda == null) return true
    if (typeof guarda === 'function') return guarda(perm)
    if (Array.isArray(guarda)) return guarda.some((k) => can(k))
    return can(guarda)
  }

  // ¿La página está vetada para este usuario? (equivale al antiguo `soloAdmin`)
  const paginaBloqueada = (pagina) => {
    if (esAdmin) return false
    // Páginas de módulos obligatorios: siempre accesibles (incluso si el rol
    // tiene una whitelist de páginas que no las incluye).
    if (PAGINAS_OBLIGATORIAS_SET.has(pagina)) return false
    if (restric.paginasPermitidas && !restric.paginasPermitidas.includes(pagina)) return true
    const guarda = GUARDAS_RUTA[pagina]
    if (guarda === undefined) return false
    return !evaluarGuarda(guarda)
  }

  // Página segura efectiva: aplica los fallbacks de UX heredados de App.jsx.
  const soloStaff = (pagina) =>
    pagina === 'inventario' || (pagina === 'requerimientos' && !permisosReqs.ver)

  const paginaSegura = (pagina) => {
    if (!usuario) return pagina
    // Módulos obligatorios: nunca se redirige fuera de ellos.
    if (PAGINAS_OBLIGATORIAS_SET.has(pagina)) return pagina
    if (!puedeVerInventario && soloStaff(pagina)) return 'tickets'
    if (esVisorReq && restric.paginasPermitidas && !restric.paginasPermitidas.includes(pagina)) return 'requerimientos'
    if (!esAdmin && paginaBloqueada(pagina)) {
      return PAGINAS_AUSENCIAS.has(pagina)
        ? (puedeAccederAusencias ? 'mis_ausencias' : 'dashboard')
        : 'dashboard'
    }
    return pagina
  }

  perm.paginaBloqueada = paginaBloqueada
  perm.paginaSegura    = paginaSegura
  return perm
}
