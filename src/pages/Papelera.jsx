// src/pages/Papelera.jsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Trash2, RotateCcw, AlertTriangle, Package2,
  Ticket, Calendar, ShoppingCart, Gift, Clock,
  RefreshCw, CheckCircle2, Users, Square, CheckSquare,
  Minus,
} from 'lucide-react'
import { supabase } from '../supabase'

// ── Configuración de conflictos por tabla ─────────────────────────────────
const RESTORE_CONFIG = {
  bienes:             { nombreField: 'nombre', uniqueFields: [] },
  tickets:            { nombreField: 'titulo', uniqueFields: [] },
  usuarios:           { nombreField: 'nombre', uniqueFields: [
    { field: 'email', label: 'Correo electrónico' },
    { field: 'rut',   label: 'RUT' },
  ]},
  ausencias:          { nombreField: null, uniqueFields: [] },
  requerimientos:     { nombreField: null, uniqueFields: [] },
  dias_compensatorios:{ nombreField: null, uniqueFields: [] },
}

// ── Configuración por módulo ──────────────────────────────────────────────
const MODULO_CONFIG = {
  inventario:     { label: 'Inventario',    Icon: Package2,    color: '#3b82f6', bg: '#eff6ff' },
  tickets:        { label: 'Tickets',       Icon: Ticket,      color: '#8b5cf6', bg: '#f5f3ff' },
  ausencias:      { label: 'Ausencias',     Icon: Calendar,    color: '#f59e0b', bg: '#fffbeb' },
  requerimientos: { label: 'Requerimientos',Icon: ShoppingCart,color: '#10b981', bg: '#f0fdf4' },
  compensatorios: { label: 'Compensatorios',Icon: Gift,        color: '#ef4444', bg: '#fef2f2' },
  usuarios:       { label: 'Usuarios',      Icon: Users,       color: '#0891b2', bg: '#ecfeff' },
}

const FILTROS_MODULO = [
  { value: '', label: 'Todos' },
  { value: 'inventario',     label: 'Inventario' },
  { value: 'tickets',        label: 'Tickets' },
  { value: 'ausencias',      label: 'Ausencias' },
  { value: 'requerimientos', label: 'Requerimientos' },
  { value: 'compensatorios', label: 'Compensatorios' },
  { value: 'usuarios',       label: 'Usuarios' },
]

const BUCKET_REQ_IMGS = 'requerimientos'
const TEXTO_VACIAR    = 'VACIA PAPELERA'

// ── Helpers de imagen para requerimientos ────────────────────────────────
function pathDesdeUrlPublica(url) {
  try {
    const u = new URL(url)
    const mark = '/object/public/requerimientos/'
    const i = u.pathname.indexOf(mark)
    if (i >= 0) return decodeURIComponent(u.pathname.slice(i + mark.length).split('?')[0])
  } catch { /* ignore */ }
  return null
}

async function borrarImagenesRequerimiento(reqId) {
  try {
    const { data: req } = await supabase
      .from('requerimientos').select('observacion_imagenes').eq('id', reqId).single()
    const urls = Array.isArray(req?.observacion_imagenes) ? req.observacion_imagenes : []
    if (!urls.length) return
    const paths = urls.map(pathDesdeUrlPublica).filter(Boolean)
    if (paths.length) await supabase.storage.from(BUCKET_REQ_IMGS).remove(paths)
  } catch { /* silencioso */ }
}

// ── Helpers de tiempo ─────────────────────────────────────────────────────
function fmtFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function ExpiresChip({ diasRestantes }) {
  const urgente    = diasRestantes <= 3
  const muyUrgente = diasRestantes <= 1
  const color  = muyUrgente ? '#dc2626' : urgente ? '#f97316' : '#64748b'
  const bg     = muyUrgente ? '#fef2f2' : urgente ? '#fff7ed' : '#f1f5f9'
  const border = muyUrgente ? '#fca5a5' : urgente ? '#fed7aa' : '#e2e8f0'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 999,
      fontSize: 12, fontWeight: 600, letterSpacing: '0.01em',
      color, background: bg, border: `1px solid ${border}`,
    }}>
      {(urgente || muyUrgente) && <AlertTriangle size={11} />}
      {diasRestantes === 0 ? 'Hoy' : `${diasRestantes} día${diasRestantes !== 1 ? 's' : ''}`}
    </span>
  )
}

// ── Spinner inline ────────────────────────────────────────────────────────
function Spinner({ size = 14, color = '#fff' }) {
  return (
    <svg style={{ animation: 'spin 0.7s linear infinite' }} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke={`${color}40`} strokeWidth="3"/>
      <path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="3" strokeLinecap="round"/>
    </svg>
  )
}

// ── Componente principal ──────────────────────────────────────────────────
export default function Papelera({ usuario, permisos = {} }) {
  const esAdmin           = usuario?.rol === 'admin'
  const puedeRestaurar    = esAdmin || !!permisos.restaurar
  const puedeEliminarPerm = esAdmin || !!permisos.eliminarPermanente

  // ── Estado base ──────────────────────────────────────────────────────────
  const [items,           setItems]           = useState([])
  const [cargando,        setCargando]        = useState(true)
  const [filtroModulo,    setFiltroModulo]    = useState('')
  const [confirmacion,    setConfirmacion]    = useState(null)
  const [procesando,      setProcesando]      = useState(false)
  const [aviso,           setAviso]           = useState(null)
  const [verificando,     setVerificando]     = useState(null)
  const [conflictoNombre, setConflictoNombre] = useState(null)
  const [conflictoUnico,  setConflictoUnico]  = useState(null)

  // ── Estado de selección y modales masivos ────────────────────────────────
  const [seleccionados,      setSeleccionados]      = useState(new Set())
  const [modalElimMasiva,    setModalElimMasiva]    = useState(false)
  const [modalVaciar,        setModalVaciar]        = useState(false)
  const [textVaciar,         setTextVaciar]         = useState('')
  const inputVaciarRef = useRef(null)

  const mostrarAviso = (tipo, msg) => {
    setAviso({ tipo, msg })
    setTimeout(() => setAviso(null), 5000)
  }

  // ── Helpers de selección ──────────────────────────────────────────────
  const itemKey = item => `${item.tabla}-${item.id}`

  const filtrados = filtroModulo
    ? items.filter(i => i.modulo === filtroModulo)
    : items

  const todosSeleccionados = filtrados.length > 0 &&
    filtrados.every(i => seleccionados.has(itemKey(i)))
  const algunoSeleccionado = filtrados.some(i => seleccionados.has(itemKey(i)))

  // Items actualmente seleccionados (de todos los items, no solo filtrados)
  const itemsSeleccionados = items.filter(i => seleccionados.has(itemKey(i)))

  function toggleSeleccion(item) {
    setSeleccionados(prev => {
      const next = new Set(prev)
      const key = itemKey(item)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleTodos() {
    if (todosSeleccionados) {
      setSeleccionados(prev => {
        const next = new Set(prev)
        filtrados.forEach(i => next.delete(itemKey(i)))
        return next
      })
    } else {
      setSeleccionados(prev => {
        const next = new Set(prev)
        filtrados.forEach(i => next.add(itemKey(i)))
        return next
      })
    }
  }

  // Limpiar selección al cambiar filtro
  useEffect(() => { setSeleccionados(new Set()) }, [filtroModulo])

  // Focus input al abrir modal vaciar
  useEffect(() => {
    if (modalVaciar) {
      setTextVaciar('')
      setTimeout(() => inputVaciarRef.current?.focus(), 100)
    }
  }, [modalVaciar])

  // ── Helpers de conflictos ──────────────────────────────────────────────
  async function calcularNombreRestaurado(tabla, field, nombreBase) {
    const base = nombreBase.replace(/ \(Restaurado(?: \d+)?\)$/, '')
    const { data } = await supabase
      .from(tabla).select(field).eq('is_deleted', false).like(field, `${base} (Restaurado%`)
    if (!data?.length) return `${base} (Restaurado)`
    let maxN = 1
    for (const r of data) {
      const m = r[field]?.match(/\(Restaurado(?: (\d+))?\)$/)
      if (m) { const n = m[1] ? parseInt(m[1]) : 1; if (n >= maxN) maxN = n + 1 }
    }
    return `${base} (Restaurado${maxN > 1 ? ' ' + maxN : ''})`
  }

  async function verificarConflictos(item) {
    const cfg = RESTORE_CONFIG[item.tabla]
    if (!cfg) return null

    if (cfg.uniqueFields.length) {
      const fields = cfg.uniqueFields.map(f => f.field).join(',')
      const { data: reg } = await supabase
        .from(item.tabla).select(fields).eq('id', item.id).single()
      if (reg) {
        const conflictivos = []
        for (const uf of cfg.uniqueFields) {
          const val = reg[uf.field]
          if (!val) continue
          const { data: ex } = await supabase
            .from(item.tabla).select('id').eq(uf.field, val).eq('is_deleted', false).limit(1)
          if (ex?.length) conflictivos.push({ field: uf.field, label: uf.label, valor: val })
        }
        if (conflictivos.length) return { tipo: 'unico', campos: conflictivos }
      }
    }

    if (cfg.nombreField) {
      const { data: reg } = await supabase
        .from(item.tabla).select(cfg.nombreField).eq('id', item.id).single()
      const nombreActual = reg?.[cfg.nombreField]
      if (nombreActual) {
        const { data: ex } = await supabase
          .from(item.tabla).select('id').eq(cfg.nombreField, nombreActual).eq('is_deleted', false).limit(1)
        if (ex?.length) {
          const nombreNuevo = await calcularNombreRestaurado(item.tabla, cfg.nombreField, nombreActual)
          return { tipo: 'nombre', nombreActual, nombreNuevo }
        }
      }
    }

    return null
  }

  async function iniciarRestaurar(item) {
    setVerificando(item.id + item.tabla)
    const resultado = await verificarConflictos(item)
    setVerificando(null)
    if (resultado?.tipo === 'unico') {
      setConflictoUnico({ item, campos: resultado.campos })
    } else if (resultado?.tipo === 'nombre') {
      setConflictoNombre({ item, nombreActual: resultado.nombreActual, nombreNuevo: resultado.nombreNuevo })
    } else {
      setConfirmacion({ ...item, accion: 'restaurar' })
    }
  }

  const cargar = useCallback(async () => {
    setCargando(true)
    const { data, error } = await supabase.rpc('get_papelera')
    if (error) {
      mostrarAviso('error', 'Error al cargar la papelera: ' + error.message)
      setItems([])
    } else {
      setItems(data ?? [])
    }
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // Conteo por módulo
  const conteos = items.reduce((acc, i) => {
    acc[i.modulo] = (acc[i.modulo] ?? 0) + 1
    return acc
  }, {})

  // ── Restaurar (sin cambios) ───────────────────────────────────────────────
  async function restaurar(item, nombreNuevo = null) {
    setProcesando(true)
    const nombreAudit = nombreNuevo ?? item.nombre

    let error
    if (item.tabla === 'usuarios') {
      ;({ error } = await supabase.rpc('restaurar_usuario', {
        p_id: item.id, p_usuario_id: usuario.id,
        p_usuario_nombre: usuario.nombre, p_usuario_rol: usuario.rol,
      }))
      if (!error && nombreNuevo) {
        await supabase.from('usuarios').update({ nombre: nombreNuevo }).eq('id', item.id)
      }
    } else {
      ;({ error } = await supabase
        .from(item.tabla)
        .update({ is_deleted: false, deleted_at: null, deleted_by: null, deleted_by_nombre: null })
        .eq('id', item.id))

      if (!error && nombreNuevo) {
        const cfg = RESTORE_CONFIG[item.tabla]
        if (cfg?.nombreField) {
          await supabase.from(item.tabla).update({ [cfg.nombreField]: nombreNuevo }).eq('id', item.id)
        }
      }
      if (!error) {
        supabase.rpc('log_accion_papelera', {
          p_registro_id: item.id, p_nombre: nombreAudit, p_accion: 'restaurado',
          p_usuario_id: usuario.id, p_usuario_nombre: usuario.nombre,
          p_usuario_rol: usuario.rol, p_modulo: item.modulo,
        }).then(null, () => {})
      }
    }

    if (error) {
      mostrarAviso('error', 'Error al restaurar: ' + error.message)
      setProcesando(false)
      setConfirmacion(null)
      setConflictoNombre(null)
      setConflictoUnico(null)
      return
    }

    setItems(prev => prev.filter(i => i.id !== item.id || i.tabla !== item.tabla))
    mostrarAviso('ok', nombreNuevo
      ? `Restaurado como "${nombreNuevo}".`
      : 'Registro restaurado correctamente.')
    setProcesando(false)
    setConfirmacion(null)
    setConflictoNombre(null)
    setConflictoUnico(null)
  }

  // ── Eliminar permanentemente (individual, sin cambios) ───────────────────
  async function eliminarPermanente(item) {
    setProcesando(true)

    if (item.tabla === 'requerimientos') {
      await borrarImagenesRequerimiento(item.id)
    }

    supabase.rpc('log_accion_papelera', {
      p_registro_id: item.id, p_nombre: item.nombre, p_accion: 'eliminado_permanente_manual',
      p_usuario_id: usuario.id, p_usuario_nombre: usuario.nombre,
      p_usuario_rol: usuario.rol, p_modulo: item.modulo,
    }).then(null, () => {})

    let error
    if (item.tabla === 'usuarios') {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData?.session?.access_token
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/eliminar-usuario`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ userId: item.id }),
          }
        )
        if (!res.ok) {
          // 400 = usuario ya no existe en Supabase Auth → eliminar registro directamente
          if (res.status === 400) {
            ;({ error } = await supabase.from('usuarios').delete().eq('id', item.id))
          } else {
            const json = await res.json().catch(() => ({}))
            error = { message: json.error ?? 'Error al eliminar usuario' }
          }
        }
      } catch {
        error = { message: 'No se pudo conectar con el servidor.' }
      }
    } else {
      ;({ error } = await supabase.from(item.tabla).delete().eq('id', item.id))
    }

    if (error) {
      mostrarAviso('error', 'Error al eliminar: ' + error.message)
      setProcesando(false)
      setConfirmacion(null)
      return
    }

    setItems(prev => prev.filter(i => i.id !== item.id || i.tabla !== item.tabla))
    mostrarAviso('ok', 'Registro eliminado permanentemente.')
    setProcesando(false)
    setConfirmacion(null)
  }

  // ── Eliminar un item individualmente (helper usado en masiva) ─────────────
  async function eliminarUnItem(item, accionAudit) {
    if (item.tabla === 'requerimientos') {
      await borrarImagenesRequerimiento(item.id)
    }

    let error
    if (item.tabla === 'usuarios') {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData?.session?.access_token
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/eliminar-usuario`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ userId: item.id }),
          }
        )
        if (!res.ok) {
          // 400 = usuario ya no existe en Supabase Auth → eliminar registro directamente
          if (res.status === 400) {
            ;({ error } = await supabase.from('usuarios').delete().eq('id', item.id))
          } else {
            const json = await res.json().catch(() => ({}))
            error = { message: json.error ?? 'Error al eliminar usuario' }
          }
        }
      } catch {
        error = { message: 'No se pudo conectar con el servidor.' }
      }
    } else {
      ;({ error } = await supabase.from(item.tabla).delete().eq('id', item.id))
    }

    if (!error) {
      supabase.rpc('log_accion_papelera', {
        p_registro_id: item.id, p_nombre: item.nombre, p_accion: accionAudit,
        p_usuario_id: usuario.id, p_usuario_nombre: usuario.nombre,
        p_usuario_rol: usuario.rol, p_modulo: item.modulo,
      }).then(null, () => {})
    }

    return error
  }

  // ── Eliminar seleccionados (masiva) ──────────────────────────────────────
  async function ejecutarEliminarSeleccionados() {
    if (!itemsSeleccionados.length) return
    setProcesando(true)

    const eliminadosOk = []
    const errores = []

    for (const item of itemsSeleccionados) {
      const err = await eliminarUnItem(item, 'eliminacion_multiple')
      if (err) errores.push(item.nombre)
      else eliminadosOk.push(itemKey(item))
    }

    setItems(prev => prev.filter(i => !eliminadosOk.includes(itemKey(i))))
    setSeleccionados(new Set())
    setModalElimMasiva(false)
    setProcesando(false)

    if (errores.length === 0) {
      mostrarAviso('ok', `${eliminadosOk.length} elemento${eliminadosOk.length !== 1 ? 's' : ''} eliminado${eliminadosOk.length !== 1 ? 's' : ''} permanentemente.`)
    } else {
      mostrarAviso('error', `${eliminadosOk.length} eliminados, ${errores.length} con error.`)
    }
  }

  // ── Vaciar papelera (todos los items) ────────────────────────────────────
  async function ejecutarVaciarPapelera() {
    if (!items.length) return
    setProcesando(true)

    const eliminadosOk = []
    const errores = []

    for (const item of items) {
      const err = await eliminarUnItem(item, 'vaciado_papelera')
      if (err) errores.push(item.nombre)
      else eliminadosOk.push(itemKey(item))
    }

    setItems(prev => prev.filter(i => !eliminadosOk.includes(itemKey(i))))
    setSeleccionados(new Set())
    setModalVaciar(false)
    setTextVaciar('')
    setProcesando(false)

    if (errores.length === 0) {
      mostrarAviso('ok', 'Papelera vaciada correctamente.')
    } else {
      mostrarAviso('error', `${eliminadosOk.length} eliminados, ${errores.length} con error.`)
    }
  }

  function confirmar(item, accion) {
    setConfirmacion({ ...item, accion })
  }

  async function ejecutarConfirmacion() {
    if (!confirmacion) return
    if (confirmacion.accion === 'restaurar') await restaurar(confirmacion)
    else await eliminarPermanente(confirmacion)
  }

  // ── Render ───────────────────────────────────────────────────────────────
  const haySeleccion = itemsSeleccionados.length > 0

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Toast */}
      <AnimatePresence>
        {aviso && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            style={{
              position: 'fixed', top: 20, right: 24, zIndex: 9999,
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 18px', borderRadius: 10,
              background: aviso.tipo === 'ok' ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${aviso.tipo === 'ok' ? '#bbf7d0' : '#fca5a5'}`,
              color: aviso.tipo === 'ok' ? '#15803d' : '#dc2626',
              boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
              fontSize: 13, fontWeight: 500, maxWidth: 380,
            }}
          >
            {aviso.tipo === 'ok'
              ? <CheckCircle2 size={16} />
              : <AlertTriangle size={16} />}
            {aviso.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: eliminar individual / restaurar */}
      <AnimatePresence>
        {confirmacion && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 9000,
              background: 'rgba(0,0,0,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onClick={() => !procesando && setConfirmacion(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: '#fff', borderRadius: 14,
                padding: '28px 28px 24px',
                width: '100%', maxWidth: 440,
                boxShadow: '0 20px 60px rgba(0,0,0,0.20)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: confirmacion.accion === 'restaurar' ? '#eff6ff' : '#fef2f2',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {confirmacion.accion === 'restaurar'
                    ? <RotateCcw size={20} color="#3b82f6" />
                    : <Trash2 size={20} color="#dc2626" />}
                </div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginBottom: 4 }}>
                    {confirmacion.accion === 'restaurar' ? 'Restaurar registro' : 'Eliminar permanentemente'}
                  </p>
                  <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
                    {confirmacion.accion === 'restaurar'
                      ? `¿Restaurar "${confirmacion.nombre}" al módulo de ${MODULO_CONFIG[confirmacion.modulo]?.label ?? confirmacion.modulo}?`
                      : `¿Eliminar permanentemente "${confirmacion.nombre}"? Esta acción no se puede deshacer.`}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setConfirmacion(null)}
                  disabled={procesando}
                  style={{
                    padding: '8px 18px', borderRadius: 8, border: '1px solid #e5e7eb',
                    background: '#fff', color: '#374151',
                    fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={ejecutarConfirmacion}
                  disabled={procesando}
                  style={{
                    padding: '8px 18px', borderRadius: 8, border: 'none',
                    background: confirmacion.accion === 'restaurar' ? '#3b82f6' : '#dc2626',
                    color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    opacity: procesando ? 0.7 : 1,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  {procesando && <Spinner />}
                  {confirmacion.accion === 'restaurar' ? 'Restaurar' : 'Eliminar definitivamente'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: eliminar seleccionados */}
      <AnimatePresence>
        {modalElimMasiva && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 9200,
              background: 'rgba(0,0,0,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onClick={() => !procesando && setModalElimMasiva(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: '#fff', borderRadius: 14,
                padding: '28px 28px 24px',
                width: '100%', maxWidth: 460,
                boxShadow: '0 20px 60px rgba(0,0,0,0.20)',
              }}
            >
              <div style={{ display: 'flex', gap: 14, marginBottom: 18 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, background: '#fef2f2', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Trash2 size={20} color="#dc2626" />
                </div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginBottom: 6 }}>
                    Eliminar permanentemente
                  </p>
                  <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.55, margin: 0 }}>
                    Los elementos seleccionados serán eliminados permanentemente y no podrán recuperarse.
                  </p>
                  <div style={{
                    marginTop: 12, padding: '8px 12px', borderRadius: 8,
                    background: '#fef2f2', border: '1px solid #fca5a5',
                    fontSize: 13, fontWeight: 600, color: '#991b1b',
                  }}>
                    {itemsSeleccionados.length} elemento{itemsSeleccionados.length !== 1 ? 's' : ''} seleccionado{itemsSeleccionados.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setModalElimMasiva(false)}
                  disabled={procesando}
                  style={{
                    padding: '8px 18px', borderRadius: 8, border: '1px solid #e5e7eb',
                    background: '#fff', color: '#374151', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={ejecutarEliminarSeleccionados}
                  disabled={procesando}
                  style={{
                    padding: '8px 18px', borderRadius: 8, border: 'none',
                    background: '#dc2626', color: '#fff',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    opacity: procesando ? 0.7 : 1,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  {procesando && <Spinner />}
                  Eliminar definitivamente
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: vaciar papelera */}
      <AnimatePresence>
        {modalVaciar && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 9300,
              background: 'rgba(0,0,0,0.55)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onClick={() => !procesando && setModalVaciar(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: '#fff', borderRadius: 14,
                padding: '28px 28px 24px',
                width: '100%', maxWidth: 480,
                boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
              }}
            >
              <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, background: '#fef2f2', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Trash2 size={22} color="#dc2626" />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 700, fontSize: 16, color: '#111827', marginBottom: 8 }}>
                    Vaciar papelera
                  </p>
                  <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6, margin: '0 0 16px' }}>
                    Se eliminarán permanentemente <strong>todos los {items.length} elemento{items.length !== 1 ? 's' : ''}</strong> almacenados en la papelera. Esta acción no se puede deshacer.
                  </p>
                  <p style={{ fontSize: 12, color: '#374151', fontWeight: 600, marginBottom: 8 }}>
                    Para confirmar, escribe:
                    <span style={{
                      display: 'inline-block', marginLeft: 6,
                      fontFamily: 'monospace', background: '#f1f5f9',
                      padding: '1px 8px', borderRadius: 4, color: '#dc2626',
                      border: '1px solid #e2e8f0', letterSpacing: '0.05em',
                    }}>
                      {TEXTO_VACIAR}
                    </span>
                  </p>
                  <input
                    ref={inputVaciarRef}
                    type="text"
                    value={textVaciar}
                    onChange={e => setTextVaciar(e.target.value)}
                    placeholder={TEXTO_VACIAR}
                    disabled={procesando}
                    style={{
                      width: '100%', padding: '9px 12px',
                      border: `1.5px solid ${textVaciar === TEXTO_VACIAR ? '#fca5a5' : '#e5e7eb'}`,
                      borderRadius: 8, fontSize: 13,
                      fontFamily: 'monospace', letterSpacing: '0.05em',
                      outline: 'none', boxSizing: 'border-box',
                      background: textVaciar === TEXTO_VACIAR ? '#fef2f2' : '#fff',
                      color: '#111827',
                    }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setModalVaciar(false)}
                  disabled={procesando}
                  style={{
                    padding: '8px 18px', borderRadius: 8, border: '1px solid #e5e7eb',
                    background: '#fff', color: '#374151', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={ejecutarVaciarPapelera}
                  disabled={procesando || textVaciar !== TEXTO_VACIAR}
                  style={{
                    padding: '8px 20px', borderRadius: 8, border: 'none',
                    background: '#dc2626', color: '#fff',
                    fontSize: 13, fontWeight: 600,
                    cursor: (procesando || textVaciar !== TEXTO_VACIAR) ? 'not-allowed' : 'pointer',
                    opacity: (procesando || textVaciar !== TEXTO_VACIAR) ? 0.4 : 1,
                    display: 'flex', alignItems: 'center', gap: 6,
                    transition: 'opacity 0.15s',
                  }}
                >
                  {procesando && <Spinner />}
                  Vaciar papelera
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: conflicto de nombre */}
      <AnimatePresence>
        {conflictoNombre && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 9100, background: 'rgba(0,0,0,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => !procesando && setConflictoNombre(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }} onClick={e => e.stopPropagation()}
              style={{ background: '#fff', borderRadius: 14, padding: '28px 28px 24px',
                width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.20)' }}>
              <div style={{ display: 'flex', gap: 14, marginBottom: 18 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#fff7ed', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertTriangle size={20} color="#f97316" />
                </div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginBottom: 6 }}>
                    Nombre duplicado
                  </p>
                  <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.55, margin: 0 }}>
                    Ya existe un registro activo con el mismo nombre:
                  </p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', margin: '6px 0 10px',
                    padding: '6px 10px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                    {conflictoNombre.nombreActual}
                  </p>
                  <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.55, margin: '0 0 6px' }}>
                    Si continúas, el registro restaurado se guardará como:
                  </p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#0891b2', margin: 0,
                    padding: '6px 10px', background: '#ecfeff', borderRadius: 6, border: '1px solid #a5f3fc' }}>
                    {conflictoNombre.nombreNuevo}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setConflictoNombre(null)} disabled={procesando}
                  style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #e5e7eb',
                    background: '#fff', color: '#374151', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button onClick={() => restaurar(conflictoNombre.item, conflictoNombre.nombreNuevo)}
                  disabled={procesando}
                  style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#3b82f6',
                    color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6, opacity: procesando ? 0.7 : 1 }}>
                  {procesando && <Spinner />}
                  Restaurar de todas formas
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: conflicto de campo único */}
      <AnimatePresence>
        {conflictoUnico && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 9100, background: 'rgba(0,0,0,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => !procesando && setConflictoUnico(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }} onClick={e => e.stopPropagation()}
              style={{ background: '#fff', borderRadius: 14, padding: '28px 28px 24px',
                width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.20)' }}>
              <div style={{ display: 'flex', gap: 14, marginBottom: 18 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#fef2f2', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertTriangle size={20} color="#dc2626" />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginBottom: 6 }}>
                    Conflicto en campo único
                  </p>
                  <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.55, margin: '0 0 12px' }}>
                    No se puede restaurar porque ya existe un registro activo con el mismo valor en:
                  </p>
                  {conflictoUnico.campos.map(c => (
                    <div key={c.field} style={{ marginBottom: 10,
                      padding: '8px 12px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fca5a5' }}>
                      <p style={{ margin: '0 0 2px', fontSize: 12, fontWeight: 600, color: '#991b1b' }}>
                        {c.label}
                      </p>
                      <p style={{ margin: 0, fontSize: 13, color: '#374151', fontFamily: 'monospace' }}>
                        {c.valor}
                      </p>
                    </div>
                  ))}
                  <p style={{ fontSize: 12, color: '#9ca3af', margin: '10px 0 0', lineHeight: 1.5 }}>
                    Debes modificar el valor de {conflictoUnico.campos.length === 1 ? 'este campo' : 'estos campos'} en el registro activo o eliminarlo antes de restaurar.
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => setConflictoUnico(null)}
                  style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #e5e7eb',
                    background: '#fff', color: '#374151', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                  Entendido
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Trash2 size={18} color="#64748b" />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>
              Papelera
              {items.length > 0 && (
                <span style={{
                  marginLeft: 10, fontSize: 13, fontWeight: 600,
                  background: '#f1f5f9', color: '#64748b',
                  padding: '2px 10px', borderRadius: 999,
                }}>
                  {items.length}
                </span>
              )}
            </h1>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0' }}>
              Los registros se eliminan automáticamente después de 30 días
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {puedeEliminarPerm && items.length > 0 && (
            <button
              onClick={() => setModalVaciar(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 8,
                border: '1px solid #fca5a5', background: '#fef2f2',
                color: '#dc2626', fontSize: 13, fontWeight: 500, cursor: 'pointer',
              }}
            >
              <Trash2 size={13} />
              Vaciar papelera
            </button>
          )}
          <button
            onClick={cargar}
            disabled={cargando}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 8,
              border: '1px solid #e5e7eb', background: '#fff',
              color: '#374151', fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}
          >
            <RefreshCw size={13} style={{ animation: cargando ? 'spin 0.7s linear infinite' : 'none' }} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Banner informativo */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: '12px 16px', borderRadius: 10,
        background: '#fefce8', border: '1px solid #fde68a',
        marginBottom: 20,
      }}>
        <Clock size={16} color="#d97706" style={{ marginTop: 1, flexShrink: 0 }} />
        <p style={{ margin: 0, fontSize: 13, color: '#92400e', lineHeight: 1.5 }}>
          <strong>Política de retención:</strong> Los registros enviados a la Papelera permanecen disponibles durante <strong>30 días</strong>.
          Pasado ese tiempo, se eliminan permanentemente de forma automática sin posibilidad de recuperación.
        </p>
      </div>

      {/* Filtros por módulo */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {FILTROS_MODULO.map(f => {
          const count = f.value ? (conteos[f.value] ?? 0) : items.length
          const activo = filtroModulo === f.value
          const cfg = f.value ? MODULO_CONFIG[f.value] : null
          return (
            <button
              key={f.value}
              onClick={() => setFiltroModulo(f.value)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 999,
                border: activo ? `1.5px solid ${cfg?.color ?? '#94a3b8'}` : '1px solid #e5e7eb',
                background: activo ? (cfg?.bg ?? '#f1f5f9') : '#fff',
                color: activo ? (cfg?.color ?? '#374151') : '#64748b',
                fontSize: 12, fontWeight: activo ? 600 : 500, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {f.label}
              {count > 0 && (
                <span style={{
                  background: activo ? (cfg?.color ?? '#94a3b8') : '#e5e7eb',
                  color: activo ? '#fff' : '#64748b',
                  borderRadius: 999, padding: '1px 7px',
                  fontSize: 11, fontWeight: 700,
                }}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Barra de acciones (solo cuando hay selección) */}
      <AnimatePresence>
        {haySeleccion && puedeEliminarPerm && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            style={{ overflow: 'hidden', marginBottom: 12 }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 16px', borderRadius: 10,
              background: '#fef2f2', border: '1px solid #fca5a5',
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#991b1b' }}>
                {itemsSeleccionados.length} elemento{itemsSeleccionados.length !== 1 ? 's' : ''} seleccionado{itemsSeleccionados.length !== 1 ? 's' : ''}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setSeleccionados(new Set())}
                  style={{
                    padding: '6px 12px', borderRadius: 7, border: '1px solid #e5e7eb',
                    background: '#fff', color: '#64748b', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  }}
                >
                  Deseleccionar
                </button>
                <button
                  onClick={() => setModalElimMasiva(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 14px', borderRadius: 7, border: 'none',
                    background: '#dc2626', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  <Trash2 size={13} />
                  Eliminar seleccionados permanentemente
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabla */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        {cargando ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              border: '3px solid #e5e7eb', borderTopColor: '#3b82f6',
              animation: 'spin 0.7s linear infinite', margin: '0 auto 12px',
            }} />
            Cargando papelera…
          </div>
        ) : filtrados.length === 0 ? (
          <div style={{ padding: '56px 24px', textAlign: 'center' }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: '#f8fafc', border: '1px solid #e5e7eb',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <Trash2 size={24} color="#cbd5e1" />
            </div>
            <p style={{ fontWeight: 600, color: '#374151', marginBottom: 4 }}>
              {filtroModulo ? `No hay registros de ${MODULO_CONFIG[filtroModulo]?.label} en la papelera` : 'La papelera está vacía'}
            </p>
            <p style={{ fontSize: 13, color: '#94a3b8' }}>
              Los registros eliminados aparecerán aquí durante 30 días
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  {/* Checkbox "seleccionar todos" */}
                  {puedeEliminarPerm && (
                    <th style={{
                      padding: '11px 14px 11px 16px', textAlign: 'center',
                      background: '#fafafa', width: 40,
                    }}>
                      <button
                        onClick={toggleTodos}
                        title={todosSeleccionados ? 'Deseleccionar todos' : 'Seleccionar todos'}
                        style={{
                          background: 'none', border: 'none', padding: 0,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: algunoSeleccionado ? '#dc2626' : '#cbd5e1',
                        }}
                      >
                        {todosSeleccionados
                          ? <CheckSquare size={16} color="#dc2626" />
                          : algunoSeleccionado
                          ? <Minus size={16} color="#dc2626" />
                          : <Square size={16} color="#cbd5e1" />}
                      </button>
                    </th>
                  )}
                  {['Tipo', 'Nombre', 'Eliminado por', 'Fecha eliminación', 'Expira en', 'Acciones'].map(h => (
                    <th key={h} style={{
                      padding: '11px 16px', textAlign: 'left',
                      fontSize: 11, fontWeight: 600, color: '#94a3b8',
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                      background: '#fafafa', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map((item, idx) => {
                  const cfg = MODULO_CONFIG[item.modulo] ?? { label: item.modulo, color: '#64748b', bg: '#f1f5f9' }
                  const { Icon } = cfg
                  const estaSeleccionado = seleccionados.has(itemKey(item))
                  return (
                    <tr
                      key={`${item.tabla}-${item.id}`}
                      style={{
                        borderBottom: idx < filtrados.length - 1 ? '1px solid #f1f5f9' : 'none',
                        transition: 'background 0.1s',
                        background: estaSeleccionado ? '#fff5f5' : undefined,
                      }}
                      onMouseEnter={e => { if (!estaSeleccionado) e.currentTarget.style.background = '#fafafa' }}
                      onMouseLeave={e => { e.currentTarget.style.background = estaSeleccionado ? '#fff5f5' : '' }}
                    >
                      {/* Checkbox individual */}
                      {puedeEliminarPerm && (
                        <td style={{ padding: '12px 14px 12px 16px', textAlign: 'center' }}>
                          <button
                            onClick={() => toggleSeleccion(item)}
                            style={{
                              background: 'none', border: 'none', padding: 0,
                              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >
                            {estaSeleccionado
                              ? <CheckSquare size={16} color="#dc2626" />
                              : <Square size={16} color="#cbd5e1" />}
                          </button>
                        </td>
                      )}
                      {/* Tipo */}
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '3px 10px', borderRadius: 999,
                          background: cfg.bg, color: cfg.color,
                          fontSize: 12, fontWeight: 600,
                        }}>
                          {Icon && <Icon size={11} />}
                          {cfg.label}
                        </span>
                      </td>
                      {/* Nombre */}
                      <td style={{ padding: '12px 16px', maxWidth: 260 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#1e293b', wordBreak: 'break-word' }}>
                          {item.nombre}
                        </p>
                      </td>
                      {/* Eliminado por */}
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
                          {item.deleted_by_nombre ?? '—'}
                        </p>
                      </td>
                      {/* Fecha eliminación */}
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
                          {fmtFecha(item.deleted_at)}
                        </p>
                      </td>
                      {/* Expira en */}
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <ExpiresChip diasRestantes={item.dias_restantes ?? 0} />
                      </td>
                      {/* Acciones */}
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {puedeRestaurar && (
                            <button
                              onClick={() => iniciarRestaurar(item)}
                              title="Restaurar registro"
                              disabled={!!verificando}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                padding: '5px 12px', borderRadius: 7,
                                border: '1px solid #bfdbfe',
                                background: '#eff6ff', color: '#2563eb',
                                fontSize: 12, fontWeight: 500, cursor: verificando ? 'wait' : 'pointer',
                                opacity: verificando ? 0.7 : 1,
                              }}
                            >
                              {verificando === item.id + item.tabla
                                ? <Spinner size={12} color="#2563eb" />
                                : <RotateCcw size={12} />}
                              Restaurar
                            </button>
                          )}
                          {puedeEliminarPerm && (
                            <button
                              onClick={() => confirmar(item, 'eliminar')}
                              title="Eliminar permanentemente"
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                padding: '5px 12px', borderRadius: 7,
                                border: '1px solid #fca5a5',
                                background: '#fef2f2', color: '#dc2626',
                                fontSize: 12, fontWeight: 500, cursor: 'pointer',
                              }}
                            >
                              <Trash2 size={12} />
                              Eliminar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
