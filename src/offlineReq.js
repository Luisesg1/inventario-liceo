// src/offlineReq.js — Utilidades offline para Requerimientos
const KEYS = {
  cache:      'req_cache',
  pendientes: 'req_pendientes',
  editados:   'req_editados',
}

// ── Caché de datos ────────────────────────────────────────────────────────

export function cachearRequerimientos(items) {
  try { localStorage.setItem(KEYS.cache, JSON.stringify(items)) } catch {}
}

export function obtenerCacheRequerimientos() {
  try { return JSON.parse(localStorage.getItem(KEYS.cache) || 'null') } catch { return null }
}

// ── Cola de pendientes (nuevos creados offline) ───────────────────────────

export function obtenerPendientesReq() {
  try { return JSON.parse(localStorage.getItem(KEYS.pendientes) || '[]') } catch { return [] }
}

export function agregarPendienteReq(item) {
  const id = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const nuevo = { ...item, id, _pendiente: true, creado_en: new Date().toISOString() }
  const lista = obtenerPendientesReq()
  lista.push(nuevo)
  try { localStorage.setItem(KEYS.pendientes, JSON.stringify(lista)) } catch {}
  return id
}

export function eliminarPendienteReq(id) {
  const lista = obtenerPendientesReq().filter(p => p.id !== id)
  try { localStorage.setItem(KEYS.pendientes, JSON.stringify(lista)) } catch {}
}

// ── Mapa de ediciones pendientes ({ reqId: payload }) ────────────────────

export function obtenerEditadosReq() {
  try { return JSON.parse(localStorage.getItem(KEYS.editados) || '{}') } catch { return {} }
}

export function guardarEditadoReq(id, payload) {
  const mapa = obtenerEditadosReq()
  mapa[id] = payload
  try { localStorage.setItem(KEYS.editados, JSON.stringify(mapa)) } catch {}
}

export function eliminarEditadoReq(id) {
  const mapa = obtenerEditadosReq()
  delete mapa[id]
  try { localStorage.setItem(KEYS.editados, JSON.stringify(mapa)) } catch {}
}
