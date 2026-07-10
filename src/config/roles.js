// src/config/roles.js
// ═══════════════════════════════════════════════════════════════════════════
// METADATOS DE ROLES (presentación) + helpers
// ---------------------------------------------------------------------------
// La lista VIVA de roles del sistema (incluidos los personalizados creados en
// el Mantenedor de Roles) vive en la tabla `permisos_rol` de Supabase. Este
// archivo solo aporta:
//   · el "chrome" visual de los roles base (label / ícono / descripción), y
//   · utilidades para clasificar y presentar cualquier rol (base o custom).
//
// El hook `useRoles()` (src/hooks/useRoles.js) fusiona estos metadatos con las
// filas de `permisos_rol`, de modo que un rol nuevo aparece en Gestión de
// Usuarios sin reiniciar la app ni limpiar caché.
// ═══════════════════════════════════════════════════════════════════════════

// Roles base del sistema — se usa para CLASIFICAR (qué filas de permisos_rol
// son "personalizadas"). Debe reflejar la misma lista base que MantenedorRoles.
export const ROLES_BASE = [
  'admin', 'directivo', 'coordinador', 'docente',
  'asistente', 'administrativo', 'soporte', 'visor_requerimientos',
]

// Roles legacy: existen para usuarios antiguos pero NO se ofrecen como opción
// nueva ni se listan como "personalizados" en Gestión de Usuarios.
export const ROLES_LEGACY = [
  'encargado_inventario', 'encargado_soporte', 'encargado_permisos',
  'editor', 'encargado',
]

// Etiquetas legibles de los roles base.
export const ROL_LABEL = {
  admin: 'Administrador', directivo: 'Directivo', coordinador: 'Coordinador',
  docente: 'Docente', asistente: 'Asistente de la educación',
  administrativo: 'Administrativo', soporte: 'Soporte técnico',
  visor_requerimientos: 'Visor requerimientos',
}

// Roles base OFRECIDOS en los selectores/tarjetas de Gestión de Usuarios
// (orden y textos actuales). `visor_requerimientos` se administra pero, como
// hasta ahora, no se ofrece como opción de creación.
export const ROLES_BASE_META = [
  { key: 'admin',          label: 'Administrador',             icon: '⚙️',  desc: 'Acceso completo a todos los módulos' },
  { key: 'directivo',      label: 'Directivo',                 icon: '🏛️', desc: 'Inventario, préstamos y auditoría' },
  { key: 'coordinador',    label: 'Coordinador',               icon: '📋', desc: 'Tickets, ausencias y ajustes' },
  { key: 'docente',        label: 'Docente',                   icon: '📚', desc: 'Tickets, ausencias y ajustes' },
  { key: 'asistente',      label: 'Asistente de la educación', icon: '🤝', desc: 'Tickets, ausencias y ajustes' },
  { key: 'administrativo',       label: 'Administrativo',       icon: '🗂️', desc: 'Tickets, ausencias y ajustes' },
  { key: 'soporte',              label: 'Soporte técnico',      icon: '🔧', desc: 'Gestión completa de tickets' },
  { key: 'visor_requerimientos', label: 'Visor requerimientos', icon: '👁️', desc: 'Solo visualización de tickets' },
]

// Colores de rol — usados en tarjetas de usuarios y avatar del mantenedor.
// `dot` es el color del indicador circular en el mantenedor de roles.
export const ROL_COLORES = {
  admin:                { bg: '#e8eaf6', color: '#1a237e', dot: '#1a237e' },
  directivo:            { bg: '#fce7f3', color: '#9d174d', dot: '#db2777' },
  coordinador:          { bg: '#ede9fe', color: '#5b21b6', dot: '#7c3aed' },
  docente:              { bg: '#fef3c7', color: '#92400e', dot: '#d97706' },
  asistente:            { bg: '#f3f4f6', color: '#374151', dot: '#6b7280' },
  administrativo:       { bg: '#dcfce7', color: '#15803d', dot: '#16a34a' },
  soporte:              { bg: '#e0f2fe', color: '#0369a1', dot: '#0284c7' },
  visor_requerimientos: { bg: '#f3e8ff', color: '#6b21a8', dot: '#9333ea' },
  // Legacy
  encargado_inventario: { bg: '#dcfce7', color: '#15803d', dot: '#16a34a' },
  encargado_soporte:    { bg: '#e0f2fe', color: '#0369a1', dot: '#0284c7' },
  encargado_permisos:   { bg: '#f3e8ff', color: '#6b21a8', dot: '#9333ea' },
  editor:               { bg: '#dcfce7', color: '#15803d', dot: '#16a34a' },
  encargado:            { bg: '#f3f4f6', color: '#374151', dot: '#6b7280' },
}

// Prettifica la key de un rol personalizado: "mi_rol_nuevo" → "Mi rol nuevo".
export function prettyRol(key) {
  const s = String(key ?? '').trim()
  if (!s) return ''
  return s.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())
}

// Etiqueta legible de CUALQUIER rol (base con label propio, o custom prettificado).
export function labelDeRol(key) {
  return ROL_LABEL[key] ?? prettyRol(key)
}

// Ícono de CUALQUIER rol. Los base tienen ícono propio; los custom, uno genérico.
export function iconoDeRol(key) {
  return ROLES_BASE_META.find(r => r.key === key)?.icon ?? '🏷️'
}
