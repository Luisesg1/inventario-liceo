// src/pages/Papelera.jsx
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Trash2, RotateCcw, AlertTriangle, Package2,
  Ticket, Calendar, ShoppingCart, Gift, Clock,
  RefreshCw, X, CheckCircle2, ChevronDown, Users,
} from 'lucide-react'
import { supabase } from '../supabase'

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
  const urgente  = diasRestantes <= 3
  const muyUrgente = diasRestantes <= 1

  const color = muyUrgente ? '#dc2626'
    : urgente ? '#f97316'
    : '#64748b'
  const bg    = muyUrgente ? '#fef2f2'
    : urgente ? '#fff7ed'
    : '#f1f5f9'
  const border = muyUrgente ? '#fca5a5'
    : urgente ? '#fed7aa'
    : '#e2e8f0'

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

// ── Componente principal ──────────────────────────────────────────────────
export default function Papelera({ usuario, permisos = {} }) {
  const esAdmin              = usuario?.rol === 'admin'
  const puedeRestaurar       = esAdmin || !!permisos.restaurar
  const puedeEliminarPerm    = esAdmin || !!permisos.eliminarPermanente

  const [items,        setItems]        = useState([])
  const [cargando,     setCargando]     = useState(true)
  const [filtroModulo, setFiltroModulo] = useState('')
  const [confirmacion, setConfirmacion] = useState(null) // { id, tabla, modulo, nombre, accion }
  const [procesando,   setProcesando]   = useState(false)
  const [aviso,        setAviso]        = useState(null) // { tipo: 'ok'|'error', msg }

  const mostrarAviso = (tipo, msg) => {
    setAviso({ tipo, msg })
    setTimeout(() => setAviso(null), 4000)
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

  const filtrados = filtroModulo
    ? items.filter(i => i.modulo === filtroModulo)
    : items

  // Conteo por módulo
  const conteos = items.reduce((acc, i) => {
    acc[i.modulo] = (acc[i.modulo] ?? 0) + 1
    return acc
  }, {})

  // ── Restaurar ────────────────────────────────────────────────────────────
  async function restaurar(item) {
    setProcesando(true)

    let error
    if (item.tabla === 'usuarios') {
      // Restaurar usuario: desbanea en Auth vía RPC SECURITY DEFINER
      ;({ error } = await supabase.rpc('restaurar_usuario', {
        p_id: item.id,
        p_usuario_id: usuario.id,
        p_usuario_nombre: usuario.nombre,
        p_usuario_rol: usuario.rol,
      }))
    } else {
      ;({ error } = await supabase
        .from(item.tabla)
        .update({ is_deleted: false, deleted_at: null, deleted_by: null, deleted_by_nombre: null })
        .eq('id', item.id))

      if (!error) {
        supabase.rpc('log_accion_papelera', {
          p_registro_id: item.id, p_nombre: item.nombre, p_accion: 'restaurado',
          p_usuario_id: usuario.id, p_usuario_nombre: usuario.nombre,
          p_usuario_rol: usuario.rol, p_modulo: item.modulo,
        }).then(null, () => {})
      }
    }

    if (error) {
      mostrarAviso('error', 'Error al restaurar: ' + error.message)
      setProcesando(false)
      setConfirmacion(null)
      return
    }

    setItems(prev => prev.filter(i => i.id !== item.id || i.tabla !== item.tabla))
    mostrarAviso('ok', 'Registro restaurado correctamente.')
    setProcesando(false)
    setConfirmacion(null)
  }

  // ── Eliminar permanentemente ─────────────────────────────────────────────
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
      // Eliminar definitivamente de Supabase Auth vía Edge Function
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
          const json = await res.json().catch(() => ({}))
          error = { message: json.error ?? 'Error al eliminar usuario' }
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

  function confirmar(item, accion) {
    setConfirmacion({ ...item, accion })
  }

  async function ejecutarConfirmacion() {
    if (!confirmacion) return
    if (confirmacion.accion === 'restaurar') await restaurar(confirmacion)
    else await eliminarPermanente(confirmacion)
  }

  // ── Render ───────────────────────────────────────────────────────────────
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

      {/* Modal de confirmación */}
      <AnimatePresence>
        {confirmacion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
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
                  {procesando && (
                    <svg style={{ animation: 'spin 0.7s linear infinite' }} width={14} height={14} viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3"/>
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="3" strokeLinecap="round"/>
                    </svg>
                  )}
                  {confirmacion.accion === 'restaurar' ? 'Restaurar' : 'Eliminar definitivamente'}
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
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
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
                  return (
                    <tr
                      key={`${item.tabla}-${item.id}`}
                      style={{
                        borderBottom: idx < filtrados.length - 1 ? '1px solid #f1f5f9' : 'none',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}
                    >
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
                              onClick={() => confirmar(item, 'restaurar')}
                              title="Restaurar registro"
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                padding: '5px 12px', borderRadius: 7,
                                border: '1px solid #bfdbfe',
                                background: '#eff6ff', color: '#2563eb',
                                fontSize: 12, fontWeight: 500, cursor: 'pointer',
                              }}
                            >
                              <RotateCcw size={12} />
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
