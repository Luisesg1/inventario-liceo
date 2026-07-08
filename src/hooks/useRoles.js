// src/hooks/useRoles.js
// ═══════════════════════════════════════════════════════════════════════════
// Hook: lista VIVA de roles asignables + sus permisos.
// ---------------------------------------------------------------------------
// Lee la MISMA tabla `permisos_rol` que escribe el Mantenedor de Roles, por lo
// que cualquier rol nuevo (o cambio de permisos de un rol) aparece en Gestión
// de Usuarios sin reiniciar la app ni limpiar caché: basta con montar la vista
// (o llamar a `recargar()`).
//
// Devuelve:
//   · rolesDisponibles → [{ key, label, icon, desc, esBase }] base + custom
//   · rolesBase / rolesCustom → los subconjuntos por separado
//   · permisosDe(key)  → { permisos, categorias } tomados de la BD (fuente viva);
//                        si el rol aún no tiene fila, cae al preset estático.
//   · cargando, recargar()
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import { PERMISOS_VACIO, PRESETS_ROL } from '../config/permisos'
import {
  ROLES_BASE, ROLES_BASE_META, ROLES_LEGACY, labelDeRol, iconoDeRol,
} from '../config/roles'

export function useRoles() {
  const [rolesBD, setRolesBD] = useState([]) // filas crudas de permisos_rol
  const [cargando, setCargando] = useState(true)

  const recargar = useCallback(async () => {
    setCargando(true)
    const { data } = await supabase
      .from('permisos_rol')
      .select('rol, permisos, descripcion')
    setRolesBD(data ?? [])
    setCargando(false)
  }, [])

  useEffect(() => { recargar() }, [recargar])

  // Personalizados = filas de la BD que no son base ni legacy.
  const rolesCustom = rolesBD
    .filter(r => !ROLES_BASE.includes(r.rol) && !ROLES_LEGACY.includes(r.rol))
    .map(r => ({
      key: r.rol,
      label: labelDeRol(r.rol),
      icon: iconoDeRol(r.rol),
      desc: r.descripcion || 'Rol personalizado',
      esBase: false,
    }))

  const rolesBase = ROLES_BASE_META.map(m => ({ ...m, esBase: true }))
  const rolesDisponibles = [...rolesBase, ...rolesCustom]

  // Permisos/categorías de un rol. La BD manda (fuente viva editable desde el
  // Mantenedor). Si no hay fila (p. ej. admin, que no se seedea), cae al preset
  // estático. Las categorías no se guardan en permisos_rol, así que siempre se
  // resuelven desde el preset (o 'todos' por defecto).
  const permisosDe = useCallback((key) => {
    const fila = rolesBD.find(r => r.rol === key)
    if (fila?.permisos) {
      return {
        permisos: { ...PERMISOS_VACIO, ...fila.permisos },
        categorias: PRESETS_ROL[key]?.categorias ?? ['todos'],
      }
    }
    const preset = PRESETS_ROL[key]
    return preset
      ? { permisos: { ...PERMISOS_VACIO, ...preset.permisos }, categorias: [...preset.categorias] }
      : { permisos: { ...PERMISOS_VACIO }, categorias: ['todos'] }
  }, [rolesBD])

  return { rolesDisponibles, rolesBase, rolesCustom, permisosDe, cargando, recargar }
}
