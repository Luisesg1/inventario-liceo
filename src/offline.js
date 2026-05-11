// src/offline.js — Utilidades para modo sin conexión
const KEYS = {
  bienes:     'inv_cache_bienes',
  categorias: 'inv_cache_cats',
  permisos:   'inv_cache_permisos',
  pendientes: 'inv_pendientes',
}

// ── Caché de datos ────────────────────────────────────────────────────────

export function cachearBienes(bienes) {
  try { localStorage.setItem(KEYS.bienes, JSON.stringify(bienes)) } catch {}
}

export function cachearCategorias(cats) {
  try { localStorage.setItem(KEYS.categorias, JSON.stringify(cats)) } catch {}
}

export function cachearPermisos(obj) {
  try { localStorage.setItem(KEYS.permisos, JSON.stringify(obj)) } catch {}
}

export function obtenerCacheBienes() {
  try { return JSON.parse(localStorage.getItem(KEYS.bienes) || 'null') } catch { return null }
}

export function obtenerCacheCategorias() {
  try { return JSON.parse(localStorage.getItem(KEYS.categorias) || 'null') } catch { return null }
}

export function obtenerCachePermisos() {
  try { return JSON.parse(localStorage.getItem(KEYS.permisos) || 'null') } catch { return null }
}

// ── Cola de pendientes ────────────────────────────────────────────────────

export function obtenerPendientes() {
  try { return JSON.parse(localStorage.getItem(KEYS.pendientes) || '[]') } catch { return [] }
}

export function agregarPendiente(bien) {
  const id = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const item = { ...bien, id, _pendiente: true, creado_en: new Date().toISOString() }
  const lista = obtenerPendientes()
  lista.push(item)
  try { localStorage.setItem(KEYS.pendientes, JSON.stringify(lista)) } catch {}
  return id
}

export function eliminarPendiente(id) {
  const lista = obtenerPendientes().filter(p => p.id !== id)
  try { localStorage.setItem(KEYS.pendientes, JSON.stringify(lista)) } catch {}
}
