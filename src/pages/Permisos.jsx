// src/pages/Permisos.jsx
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CalendarCheck, Plus, Loader2, X, ChevronDown, Search,
  UserPlus, Info, CalendarRange, Save, CheckCircle2,
  Eye, Pencil, Trash2, AlertCircle,
} from 'lucide-react'
import { supabase } from '../supabase'
import './Permisos.css'

// ── Constants ──────────────────────────────────────────────────────────────

const ROL_LABEL = {
  admin:                'Administrador',
  editor:               'Editor',
  encargado:            'Encargado',
  docente:              'Docente',
  soporte:              'Soporte',
  visor_requerimientos: 'Visor requerimientos',
}

const TIPOS_PERMISO = [
  { value: 'personal', label: 'Personales' },
  { value: 'ausencia', label: 'Ausencia' },
  { value: 'medico',   label: 'Médico' },
  { value: 'licencia', label: 'Licencia' },
  { value: 'otro',     label: 'Otro' },
]

const MAX_NOTAS   = 400
const MAX_MOTIVO  = 300

const TIPO_LABEL = Object.fromEntries(TIPOS_PERMISO.map(t => [t.value, t.label]))

const JORNADAS = [
  { value: 'medio_dia',     label: 'Medio día' },
  { value: 'dia_completo',  label: 'Día completo' },
  { value: 'personalizado', label: 'Personalizado' },
  { value: 'reposo',        label: 'Reposo' },
]

const JORNADA_LABEL = Object.fromEntries(JORNADAS.map(j => [j.value, j.label]))

const RECORDATORIO_OPTS = [
  { value: '1', label: '1 día antes' },
  { value: '2', label: '2 días antes' },
  { value: '7', label: '1 semana antes' },
]

const AVATAR_COLORS = [
  '#1a237e','#283593','#1565c0','#0277bd',
  '#00695c','#2e7d32','#558b2f','#6a1b9a',
  '#ad1457','#c62828','#4527a0','#00838f',
]

// ── Helpers ────────────────────────────────────────────────────────────────

function getAvatarColor(name = '') {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function getInitials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join('')
}

function calcDuration(fechaInicio, fechaFin, jornada) {
  if (!fechaInicio || !fechaFin) return null
  const start = new Date(fechaInicio + 'T12:00:00')
  const end   = new Date(fechaFin   + 'T12:00:00')
  if (isNaN(start) || isNaN(end) || end < start) return null
  const diffDays = Math.round((end - start) / 86400000) + 1
  if (jornada === 'medio_dia') return '½ día'
  return diffDays === 1 ? '1 día' : `${diffDays} días`
}

function formatFecha(fecha) {
  if (!fecha) return '—'
  const [y, m, d] = fecha.split('-')
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  return `${parseInt(d)} ${meses[parseInt(m) - 1]} ${y}`
}

function normStr(s = '') {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function formatRut(raw = '') {
  const clean = raw.replace(/[^0-9kK]/g, '').toUpperCase()
  if (clean.length < 2) return clean
  const verif = clean.slice(-1)
  const body  = clean.slice(0, -1)
  const formatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${formatted}-${verif}`
}

function normRut(r = '') {
  return r.replace(/[^0-9kK]/g, '').toUpperCase()
}

function userFromPermiso(p) {
  if (p.usuario) return p.usuario
  if (p.externo_nombre) return { id: null, nombre: p.externo_nombre, rut: p.externo_rut, rol: null, isExterno: true }
  return null
}

// ── Animations ─────────────────────────────────────────────────────────────

const overlayV = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.18 } },
  exit:    { opacity: 0, transition: { duration: 0.15 } },
}
const modalV = {
  hidden:  { opacity: 0, scale: 0.95, y: 14 },
  visible: { opacity: 1, scale: 1,    y: 0,  transition: { type: 'spring', stiffness: 380, damping: 34 } },
  exit:    { opacity: 0, scale: 0.96, y: 8,  transition: { duration: 0.14 } },
}
const slideV = {
  hidden:  { opacity: 0, height: 0 },
  visible: { opacity: 1, height: 'auto', transition: { duration: 0.18 } },
  exit:    { opacity: 0, height: 0,      transition: { duration: 0.12 } },
}

// ── PermisoDots ────────────────────────────────────────────────────────────

function PermisoDots({ usados }) {
  return (
    <div className="mp-counter">
      <div className="mp-dots">
        {Array.from({ length: Math.max(usados, 1) }).map((_, i) => (
          <span key={i} className="mp-dot mp-dot--used" />
        ))}
      </div>
      <span className="mp-counter-label">
        {usados === 0 ? 'Sin permisos registrados' : `${usados} permiso${usados !== 1 ? 's' : ''} registrado${usados !== 1 ? 's' : ''}`}
      </span>
    </div>
  )
}

// ── ModalVerPermiso ────────────────────────────────────────────────────────

function ModalVerPermiso({ permiso, onClose, onEditar, onEliminar }) {
  const u       = userFromPermiso(permiso) ?? {}
  const nombre  = u.nombre ?? '—'
  const duracion = calcDuration(permiso.fecha_inicio, permiso.fecha_fin, permiso.jornada)

  return (
    <AnimatePresence>
      <motion.div className="mp-overlay" variants={overlayV} initial="hidden" animate="visible" exit="exit"
        onClick={e => { if (e.target === e.currentTarget) onClose?.() }}>
        <motion.div className="mp-modal mp-modal--sm" variants={modalV} initial="hidden" animate="visible" exit="exit">

          <div className="mp-header">
            <div className="mp-header-left">
              <div className="mp-header-icon"><CalendarCheck size={18} strokeWidth={2} /></div>
              <div>
                <p className="mp-header-title">Detalle del permiso</p>
                <p className="mp-header-sub">{formatFecha(permiso.fecha_inicio)} — {formatFecha(permiso.fecha_fin)}</p>
              </div>
            </div>
            <button className="mp-close-btn" onClick={onClose}><X size={16} strokeWidth={2.5} /></button>
          </div>

          <div className="mp-ver-body">
            <div className="mp-ver-user">
              <div className="mp-avatar" style={{ background: getAvatarColor(nombre), width: 44, height: 44, fontSize: 15 }}>
                {getInitials(nombre)}
              </div>
              <div>
                <p className="mp-summary-user-name" style={{ fontSize: 15 }}>{nombre}</p>
                <p className="mp-summary-user-email">{u.rut ?? ROL_LABEL[u.rol] ?? u.rol ?? 'Usuario externo'}</p>
              </div>
            </div>

            <div className="mp-ver-grid">
              <div className="mp-ver-field">
                <span className="mp-section-label" style={{ marginBottom: 4 }}>Tipo</span>
                <span className="permisos-badge permisos-badge--tipo">{TIPO_LABEL[permiso.tipo] ?? permiso.tipo}</span>
              </div>
              <div className="mp-ver-field">
                <span className="mp-section-label" style={{ marginBottom: 4 }}>Jornada</span>
                <span className="permisos-badge permisos-badge--jornada">{JORNADA_LABEL[permiso.jornada] ?? permiso.jornada}</span>
              </div>
              <div className="mp-ver-field">
                <span className="mp-section-label" style={{ marginBottom: 4 }}>Fecha inicio</span>
                <span className="mp-ver-value">{formatFecha(permiso.fecha_inicio)}</span>
              </div>
              <div className="mp-ver-field">
                <span className="mp-section-label" style={{ marginBottom: 4 }}>Fecha fin</span>
                <span className="mp-ver-value">{formatFecha(permiso.fecha_fin)}</span>
              </div>
              {permiso.jornada === 'medio_dia' && permiso.periodo && (
                <div className="mp-ver-field">
                  <span className="mp-section-label" style={{ marginBottom: 4 }}>Período</span>
                  <span className="mp-ver-value">{permiso.periodo === 'am' ? 'AM — Mañana' : 'PM — Tarde'}</span>
                </div>
              )}
              {permiso.jornada === 'personalizado' && permiso.hora_inicio && (
                <div className="mp-ver-field">
                  <span className="mp-section-label" style={{ marginBottom: 4 }}>Horario</span>
                  <span className="mp-ver-value">{permiso.hora_inicio} — {permiso.hora_fin}</span>
                </div>
              )}
              {duracion && (
                <div className="mp-ver-field">
                  <span className="mp-section-label" style={{ marginBottom: 4 }}>Duración</span>
                  <div className="mp-duration-badge" style={{ display: 'inline-flex' }}>
                    <CalendarRange size={12} strokeWidth={2.5} />{duracion}
                  </div>
                </div>
              )}
              {permiso.recordatorio && (
                <div className="mp-ver-field">
                  <span className="mp-section-label" style={{ marginBottom: 4 }}>Recordatorio</span>
                  <span className="mp-ver-value">
                    {permiso.recordatorio === '1' ? '1 día antes'
                      : permiso.recordatorio === '7' ? '1 semana antes'
                      : `${permiso.recordatorio} días antes`}
                  </span>
                </div>
              )}
            </div>

            {permiso.notas && (
              <div className="mp-ver-notas">
                <p className="mp-section-label" style={{ marginBottom: 6 }}>Notas</p>
                <p className="mp-ver-notas-text">{permiso.notas}</p>
              </div>
            )}
          </div>

          <div className="mp-footer">
            <button className="mp-btn-danger" onClick={onEliminar}>
              <Trash2 size={14} strokeWidth={2.5} /> Eliminar
            </button>
            <div style={{ flex: 1 }} />
            <button className="mp-btn-cancel" onClick={onClose}>Cerrar</button>
            <button className="mp-btn-save" onClick={onEditar}>
              <Pencil size={14} strokeWidth={2.5} /> Editar
            </button>
          </div>

        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ── ModalConfirmarEliminar ─────────────────────────────────────────────────

function ModalConfirmarEliminar({ onClose, onConfirmar, eliminando, errorEliminar }) {
  return (
    <AnimatePresence>
      <motion.div className="mp-overlay" variants={overlayV} initial="hidden" animate="visible" exit="exit"
        onClick={e => { if (e.target === e.currentTarget) onClose?.() }}>
        <motion.div className="mp-modal mp-modal--confirm" variants={modalV} initial="hidden" animate="visible" exit="exit">

          <div className="mp-confirm-body">
            <div className="mp-confirm-icon"><Trash2 size={24} strokeWidth={1.5} /></div>
            <p className="mp-confirm-title">¿Eliminar permiso?</p>
            <p className="mp-confirm-desc">Esta acción no se puede deshacer. El registro desaparecerá permanentemente.</p>
          </div>

          <div className="mp-footer">
            {errorEliminar && (
              <span className="mp-footer-warn"><AlertCircle size={13} strokeWidth={2} />{errorEliminar}</span>
            )}
            <button className="mp-btn-cancel" onClick={onClose}>Cancelar</button>
            <button className="mp-btn-danger" disabled={eliminando} onClick={onConfirmar}>
              {eliminando
                ? 'Eliminando…'
                : <><Trash2 size={14} strokeWidth={2.5} /> Eliminar</>}
            </button>
          </div>

        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ── ModalPermiso ───────────────────────────────────────────────────────────

function ModalPermiso({ usuarios, usuarioActual, onClose, onGuardar, onGetPermisosUsados, editData }) {
  const isEdit = !!editData

  const userInit = isEdit ? userFromPermiso(editData) : null

  const [usuarioSel,        setUsuarioSel]        = useState(userInit)
  const [dropdownOpen,      setDropdownOpen]      = useState(false)
  const [busqueda,          setBusqueda]          = useState('')
  const [modoCrear,         setModoCrear]         = useState(true)
  const [rutNuevo,          setRutNuevo]          = useState('')
  const [nombresNuevo,      setNombresNuevo]      = useState('')
  const [apellidosNuevo,    setApellidosNuevo]    = useState('')
  const [emailNuevo,        setEmailNuevo]        = useState('')
  const [creandoUser,       setCreandoUser]       = useState(false)
  const [usuarioEncontrado, setUsuarioEncontrado] = useState(null)
  const [permisosUsados,    setPermisosUsados]    = useState(0)
  const [cargandoPermisos,  setCargandoPermisos]  = useState(false)

  const [fechaInicio, setFechaInicio] = useState(isEdit ? (editData.fecha_inicio ?? '') : '')
  const [fechaFin,    setFechaFin]    = useState(isEdit ? (editData.fecha_fin   ?? '') : '')
  const [jornada,     setJornada]     = useState(isEdit ? (editData.jornada     ?? 'dia_completo') : 'dia_completo')
  const [periodo,     setPeriodo]     = useState(isEdit ? (editData.periodo     ?? 'am') : 'am')
  const [horaInicio,  setHoraInicio]  = useState(isEdit ? (editData.hora_inicio ?? '08:00') : '08:00')
  const [horaFin,     setHoraFin]     = useState(isEdit ? (editData.hora_fin    ?? '17:00') : '17:00')
  const [tipoPermiso, setTipoPermiso] = useState(isEdit ? (editData.tipo        ?? '') : '')
  const [motivoOtro,  setMotivoOtro]  = useState(isEdit && editData.tipo === 'otro' ? (editData.notas ?? '') : '')
  const [notas,       setNotas]       = useState(isEdit && editData.tipo !== 'otro' ? (editData.notas ?? '') : '')
  const [recordatorio, setRecordatorio] = useState(isEdit ? !!editData.recordatorio : false)
  const [diasRecord,  setDiasRecord]  = useState(isEdit && editData.recordatorio ? editData.recordatorio : '1')
  const [guardando,   setGuardando]   = useState(false)
  const [errorGuardar, setErrorGuardar] = useState('')

  const dropdownRef = useRef(null)
  const searchRef   = useRef(null)

  useEffect(() => {
    function handler(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (dropdownOpen && searchRef.current) searchRef.current.focus()
  }, [dropdownOpen])

  useEffect(() => {
    if (!fechaInicio) return
    if (!fechaFin) { setFechaFin(fechaInicio); return }
    if (fechaFin < fechaInicio) setFechaFin(fechaInicio)
  }, [fechaInicio])

  useEffect(() => {
    if (!usuarioSel || !onGetPermisosUsados) return
    setCargandoPermisos(true)
    onGetPermisosUsados(usuarioSel.id, usuarioSel.rut)
      .then(n => setPermisosUsados(n ?? 0))
      .catch(() => setPermisosUsados(0))
      .finally(() => setCargandoPermisos(false))
  }, [usuarioSel?.id, usuarioSel?.rut])

  const duracion    = calcDuration(fechaInicio, fechaFin, jornada)
  const tipoLabel   = TIPOS_PERMISO.find(t => t.value === tipoPermiso)?.label
  const jornadaLabel = JORNADAS.find(j => j.value === jornada)?.label

  const usuariosFiltrados = usuarios.filter(u => {
    if (!busqueda.trim()) return true
    const q    = normStr(busqueda)
    const qRut = normRut(busqueda)
    return normStr(u.nombre).includes(q)
      || normStr(u.rut ?? '').includes(q)
      || (qRut.length > 0 && normRut(u.rut ?? '').includes(qRut))
  })

  const formValido = !!usuarioSel && !!fechaInicio && !!fechaFin && !!tipoPermiso
    && (tipoPermiso !== 'otro' || motivoOtro.trim().length > 0)

  useEffect(() => {
    const rut = rutNuevo.trim()
    if (!rut) { setUsuarioEncontrado(null); setNombresNuevo(''); setApellidosNuevo(''); return }
    const encontrado = usuarios.find(u => normRut(u.rut ?? '') === normRut(rut))
    if (encontrado) {
      setUsuarioEncontrado(encontrado)
      const partes = (encontrado.nombre ?? '').trim().split(/\s+/)
      setNombresNuevo(partes.slice(0, 2).join(' '))
      setApellidosNuevo(partes.slice(2).join(' '))
    } else {
      setUsuarioEncontrado(null)
    }
  }, [rutNuevo, usuarios])

  function seleccionar(u) {
    setUsuarioSel(u); setDropdownOpen(false); setBusqueda(''); setModoCrear(false)
    setRutNuevo(''); setNombresNuevo(''); setApellidosNuevo(''); setEmailNuevo(''); setUsuarioEncontrado(null)
  }

  function handleCrearUsuario() {
    if (!rutNuevo.trim() || !nombresNuevo.trim() || !apellidosNuevo.trim()) return
    const nombre = `${nombresNuevo.trim()} ${apellidosNuevo.trim()}`.trim()
    seleccionar({ id: null, nombre, rut: rutNuevo.trim(), email: emailNuevo.trim() || null, rol: null, isExterno: true })
  }

  async function handleGuardar() {
    if (!formValido || guardando) return
    setErrorGuardar('')
    setGuardando(true)
    try {
      await onGuardar?.({
        id: editData?.id ?? null,
        usuario: usuarioSel, fechaInicio, fechaFin, jornada,
        periodo:    jornada === 'medio_dia'     ? periodo    : null,
        horaInicio: jornada === 'personalizado' ? horaInicio : null,
        horaFin:    jornada === 'personalizado' ? horaFin    : null,
        tipoPermiso, motivoOtro: tipoPermiso === 'otro' ? motivoOtro.trim() : null,
        notas: notas.trim() || null,
        recordatorio: recordatorio ? diasRecord : null,
      })
      onClose?.()
    } catch (err) {
      setErrorGuardar(err.message === 'DUPLICADO'
        ? 'Este usuario ya tiene un permiso en ese período de fechas.'
        : 'Ocurrió un error al guardar. Intenta de nuevo.')
    } finally { setGuardando(false) }
  }

  return (
    <AnimatePresence>
      <motion.div className="mp-overlay" variants={overlayV} initial="hidden" animate="visible" exit="exit"
        onClick={e => { if (e.target === e.currentTarget) onClose?.() }}>
        <motion.div className="mp-modal" variants={modalV} initial="hidden" animate="visible" exit="exit">

          {/* Header */}
          <div className="mp-header">
            <div className="mp-header-left">
              <div className="mp-header-icon"><CalendarCheck size={18} strokeWidth={2} /></div>
              <div>
                <p className="mp-header-title">{isEdit ? 'Editar permiso' : 'Registrar permiso'}</p>
                <p className="mp-header-sub">
                  {usuarioActual?.nombre
                    ? <>Hola, <strong>{usuarioActual.nombre}</strong> — {isEdit ? 'modifica los datos del permiso.' : 'registra permisos y días autorizados.'}</>
                    : isEdit ? 'Modifica los datos del permiso.' : 'Registra permisos y días autorizados para usuarios.'}
                </p>
              </div>
            </div>
            <button className="mp-close-btn" onClick={onClose}><X size={16} strokeWidth={2.5} /></button>
          </div>

          {/* Body */}
          <div className="mp-body">

            {/* ── Columna izquierda ── */}
            <div className="mp-form-col">

              {/* Usuario */}
              <section>
                <p className="mp-section-label">Usuario</p>
                <div className="mp-user-wrap" ref={dropdownRef}>
                  <button
                    type="button"
                    className={`mp-user-trigger ${dropdownOpen ? 'open' : ''}`}
                    onClick={() => setDropdownOpen(o => !o)}
                  >
                    {usuarioSel ? (
                      <>
                        <div className="mp-avatar" style={{ background: getAvatarColor(usuarioSel.nombre) }}>
                          {getInitials(usuarioSel.nombre)}
                        </div>
                        <div className="mp-user-info">
                          <div className="mp-user-name">{usuarioSel.nombre}</div>
                          <div className="mp-user-email">{usuarioSel.rut ? `${usuarioSel.rut} · ` : ''}{usuarioSel.email}</div>
                        </div>
                        <span className="mp-rol-tag">{ROL_LABEL[usuarioSel.rol] ?? usuarioSel.rol ?? 'Externo'}</span>
                      </>
                    ) : (
                      <span className="mp-user-placeholder">Buscar o seleccionar usuario…</span>
                    )}
                    <ChevronDown size={14} strokeWidth={2.5} className={`mp-chevron ${dropdownOpen ? 'open' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {dropdownOpen && (
                      <motion.div className="mp-dropdown"
                        initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.13 } }}
                        exit={{ opacity: 0, y: -4, transition: { duration: 0.10 } }}>
                        <div className="mp-search-wrap">
                          <Search size={13} className="mp-search-icon" strokeWidth={2.5} />
                          <input ref={searchRef} type="text" className="mp-search-input"
                            placeholder="Buscar por nombre o RUT…"
                            value={busqueda} onChange={e => setBusqueda(e.target.value)} />
                        </div>
                        <div className="mp-dropdown-list">
                          {usuariosFiltrados.length === 0 && !modoCrear
                            ? <div className="mp-dropdown-empty">No se encontró ningún usuario</div>
                            : usuariosFiltrados.map(u => (
                              <div key={u.id} className={`mp-dropdown-item ${usuarioSel?.id === u.id ? 'selected' : ''}`}
                                onClick={() => seleccionar(u)}>
                                <div className="mp-avatar" style={{ background: getAvatarColor(u.nombre), width: 28, height: 28, fontSize: 11 }}>
                                  {getInitials(u.nombre)}
                                </div>
                                <div className="mp-user-info">
                                  <div className="mp-user-name">{u.nombre}</div>
                                  <div className="mp-user-email">{u.rut ? `${u.rut} · ` : ''}{u.email}</div>
                                </div>
                                <span className="mp-rol-tag">{ROL_LABEL[u.rol] ?? u.rol}</span>
                              </div>
                            ))
                          }
                        </div>
                        {!modoCrear ? (
                          <div className="mp-dropdown-footer">
                            <button type="button" className="mp-create-user-btn" onClick={() => setModoCrear(true)}>
                              <UserPlus size={13} strokeWidth={2.5} /> Registrar nuevo usuario
                            </button>
                          </div>
                        ) : (
                          <div className="mp-new-user-form">
                            <p className="mp-new-user-title">Nuevo usuario</p>
                            <input type="text" className="mp-input mp-input--sm" placeholder="RUT (ej: 12.345.678-9)"
                              value={rutNuevo}
                              onChange={e => setRutNuevo(formatRut(e.target.value))} />

                            <AnimatePresence>
                              {usuarioEncontrado && (
                                <motion.div className="mp-rut-found"
                                  variants={slideV} initial="hidden" animate="visible" exit="exit">
                                  <div className="mp-rut-found-info">
                                    <div className="mp-avatar" style={{ background: getAvatarColor(usuarioEncontrado.nombre), width: 26, height: 26, fontSize: 10 }}>
                                      {getInitials(usuarioEncontrado.nombre)}
                                    </div>
                                    <div>
                                      <div className="mp-rut-found-name">{usuarioEncontrado.nombre}</div>
                                      <div className="mp-rut-found-sub">Usuario ya registrado</div>
                                    </div>
                                  </div>
                                  <button type="button" className="mp-btn-save mp-btn--sm"
                                    onClick={() => seleccionar(usuarioEncontrado)}>
                                    Seleccionar
                                  </button>
                                </motion.div>
                              )}
                            </AnimatePresence>

                            {!usuarioEncontrado && (
                              <>
                                <div className="mp-date-row">
                                  <input type="text" className="mp-input mp-input--sm" placeholder="Nombres"
                                    value={nombresNuevo} onChange={e => setNombresNuevo(e.target.value)} />
                                  <input type="text" className="mp-input mp-input--sm" placeholder="Apellidos"
                                    value={apellidosNuevo} onChange={e => setApellidosNuevo(e.target.value)} />
                                </div>
                                <input type="email" className="mp-input mp-input--sm" placeholder="Correo electrónico"
                                  value={emailNuevo} onChange={e => setEmailNuevo(e.target.value)} />
                                <div className="mp-new-user-actions">
                                  <button type="button" className="mp-btn-cancel mp-btn--sm" onClick={() => setModoCrear(false)}>Cancelar</button>
                                  <button type="button" className="mp-btn-save mp-btn--sm"
                                    disabled={!rutNuevo.trim() || !nombresNuevo.trim() || !apellidosNuevo.trim() || !emailNuevo.trim() || creandoUser}
                                    onClick={handleCrearUsuario}>
                                    {creandoUser ? 'Creando…' : 'Crear usuario'}
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <AnimatePresence>
                  {usuarioSel && !cargandoPermisos && (
                    <motion.div variants={slideV} initial="hidden" animate="visible" exit="exit" style={{ marginTop: 10 }}>
                      <PermisoDots usados={permisosUsados} />
                    </motion.div>
                  )}
                  {cargandoPermisos && (
                    <motion.div variants={slideV} initial="hidden" animate="visible" exit="exit" style={{ marginTop: 8 }}>
                      <span className="mp-loading-text">Verificando permisos…</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>

              {/* Tipo de permiso */}
              <section>
                <p className="mp-section-label">Tipo de permiso</p>
                <select className="mp-select" value={tipoPermiso}
                  onChange={e => { setTipoPermiso(e.target.value); setMotivoOtro('') }}>
                  <option value="">Seleccionar tipo…</option>
                  {TIPOS_PERMISO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <AnimatePresence>
                  {tipoPermiso === 'otro' && (
                    <motion.div variants={slideV} initial="hidden" animate="visible" exit="exit" style={{ marginTop: 10 }}>
                      <textarea className="mp-textarea" placeholder="Escriba el motivo del permiso…"
                        maxLength={MAX_MOTIVO}
                        value={motivoOtro} onChange={e => setMotivoOtro(e.target.value)} />
                      <span className={`mp-char-count ${motivoOtro.length > MAX_MOTIVO * 0.9 ? 'mp-char-count--warn' : ''}`}>
                        {motivoOtro.length}/{MAX_MOTIVO}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>

              {/* Período */}
              <section>
                <p className="mp-section-label">Período del permiso</p>
                <div className="mp-date-row" style={{ marginBottom: 12 }}>
                  <div className="mp-field-group">
                    <label className="mp-field-label">Fecha inicio</label>
                    <input type="date" className="mp-input" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
                  </div>
                  <div className="mp-field-group">
                    <label className="mp-field-label">Fecha fin</label>
                    <input type="date" className="mp-input" value={fechaFin} onChange={e => setFechaFin(e.target.value)} />
                  </div>
                </div>
                <div className="mp-jornada-pills">
                  {JORNADAS.map(j => (
                    <button key={j.value} type="button" className={`mp-jornada-pill ${jornada === j.value ? 'active' : ''}`}
                      onClick={() => setJornada(j.value)}>{j.label}</button>
                  ))}
                </div>
                <AnimatePresence mode="wait">
                  {jornada === 'medio_dia' && (
                    <motion.div key="md" className="mp-jornada-extra" variants={slideV} initial="hidden" animate="visible" exit="exit">
                      <p className="mp-field-label" style={{ marginBottom: 0 }}>Período del día</p>
                      <div className="mp-am-pm">
                        {[{ v: 'am', l: 'AM — Mañana' }, { v: 'pm', l: 'PM — Tarde' }].map(({ v, l }) => (
                          <button key={v} type="button" className={`mp-am-pm-btn ${periodo === v ? 'active' : ''}`}
                            onClick={() => setPeriodo(v)}>{l}</button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                  {jornada === 'personalizado' && (
                    <motion.div key="custom" className="mp-jornada-extra" variants={slideV} initial="hidden" animate="visible" exit="exit">
                      <div className="mp-date-row">
                        <div className="mp-field-group">
                          <label className="mp-field-label">Hora inicio</label>
                          <input type="time" className="mp-input" value={horaInicio} onChange={e => setHoraInicio(e.target.value)} />
                        </div>
                        <div className="mp-field-group">
                          <label className="mp-field-label">Hora fin</label>
                          <input type="time" className="mp-input" value={horaFin} onChange={e => setHoraFin(e.target.value)} />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>

              {/* Notas */}
              <section>
                <p className="mp-section-label">Notas <span style={{ color: '#cbd5e1', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>(opcional)</span></p>
                <textarea className="mp-textarea" placeholder="Información adicional sobre el permiso…"
                  maxLength={MAX_NOTAS}
                  value={notas} onChange={e => setNotas(e.target.value)} />
                <span className={`mp-char-count ${notas.length > MAX_NOTAS * 0.9 ? 'mp-char-count--warn' : ''}`}>
                  {notas.length}/{MAX_NOTAS}
                </span>
              </section>

              {/* Recordatorio */}
              <section>
                <p className="mp-section-label">Recordatorio <span style={{ color: '#cbd5e1', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>(opcional)</span></p>
                <div className="mp-reminder-row">
                  <label className="mp-checkbox-wrap">
                    <input type="checkbox" className="mp-checkbox" checked={recordatorio} onChange={e => setRecordatorio(e.target.checked)} />
                    <span className="mp-checkbox-label">Recordar antes del inicio del permiso</span>
                  </label>
                  <AnimatePresence>
                    {recordatorio && (
                      <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto', transition: { duration: 0.15 } }}
                        exit={{ opacity: 0, width: 0, transition: { duration: 0.12 } }} style={{ overflow: 'hidden' }}>
                        <select className="mp-select" style={{ width: 'auto', minWidth: 140 }} value={diasRecord} onChange={e => setDiasRecord(e.target.value)}>
                          {RECORDATORIO_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </section>

            </div>

            {/* ── Columna derecha — Resumen ── */}
            <div className="mp-summary-col">
              <p className="mp-summary-title">Resumen del permiso</p>

              <div className="mp-summary-card">
                {usuarioSel ? (
                  <>
                    <div className="mp-summary-user">
                      <div className="mp-avatar" style={{ background: getAvatarColor(usuarioSel.nombre), width: 36, height: 36, fontSize: 13 }}>
                        {getInitials(usuarioSel.nombre)}
                      </div>
                      <div>
                        <p className="mp-summary-user-name">{usuarioSel.nombre}</p>
                        <p className="mp-summary-user-email">{usuarioSel.rut ?? usuarioSel.email}</p>
                      </div>
                    </div>

                    {usuarioSel.rut && (
                      <div className="mp-summary-row">
                        <span className="mp-summary-label">RUT</span>
                        <span className="mp-summary-value">{usuarioSel.rut}</span>
                      </div>
                    )}
                    <div className="mp-summary-row">
                      <span className="mp-summary-label">Rol</span>
                      <span className="mp-summary-value">{ROL_LABEL[usuarioSel.rol] ?? usuarioSel.rol ?? '—'}</span>
                    </div>
                    <div className="mp-summary-row">
                      <span className="mp-summary-label">Tipo</span>
                      <span className="mp-summary-value">{tipoLabel ?? '—'}</span>
                    </div>
                    <div className="mp-summary-row">
                      <span className="mp-summary-label">Inicio</span>
                      <span className="mp-summary-value">{formatFecha(fechaInicio)}</span>
                    </div>
                    <div className="mp-summary-row">
                      <span className="mp-summary-label">Fin</span>
                      <span className="mp-summary-value">{formatFecha(fechaFin)}</span>
                    </div>
                    <div className="mp-summary-row">
                      <span className="mp-summary-label">Jornada</span>
                      <span className="mp-summary-value">{jornadaLabel}</span>
                    </div>
                    {!cargandoPermisos && (
                      <div className="mp-summary-row">
                        <span className="mp-summary-label">Historial</span>
                        <span className="mp-summary-value">
                          {permisosUsados === 0 ? 'Sin permisos' : `${permisosUsados} permiso${permisosUsados !== 1 ? 's' : ''}`}
                        </span>
                      </div>
                    )}

                    {duracion && (
                      <div style={{ paddingTop: 10 }}>
                        <div className="mp-duration-badge">
                          <CalendarRange size={12} strokeWidth={2.5} />{duracion}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="mp-summary-empty">Completa el formulario para ver el resumen</p>
                )}
              </div>

              <div className="mp-info-card">
                <Info size={14} className="mp-info-icon" />
                <p className="mp-info-text">Durante este período, el usuario se marcará con permiso en el sistema.</p>
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="mp-footer">
            {errorGuardar && (
              <span className="mp-footer-warn"><AlertCircle size={13} strokeWidth={2} />{errorGuardar}</span>
            )}
            <button className="mp-btn-cancel" onClick={onClose}>Cancelar</button>
            <button className="mp-btn-save" disabled={!formValido || guardando} onClick={handleGuardar}>
              {guardando
                ? <><CheckCircle2 size={14} strokeWidth={2.5} />Guardando…</>
                : <><Save size={14} strokeWidth={2.5} />{isEdit ? 'Guardar cambios' : 'Guardar permiso'}</>}
            </button>
          </div>

        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ── Permisos (página) ──────────────────────────────────────────────────────

export default function Permisos({ usuario }) {
  const [usuarios,        setUsuarios]        = useState([])
  const [permisos,        setPermisos]        = useState([])
  const [cargando,        setCargando]        = useState(true)
  const [modalAbierto,    setModalAbierto]    = useState(false)
  const [permisoVer,      setPermisoVer]      = useState(null)
  const [permisoEditar,   setPermisoEditar]   = useState(null)
  const [permisoEliminar, setPermisoEliminar] = useState(null)
  const [eliminando,      setEliminando]      = useState(false)
  const [errorEliminar,   setErrorEliminar]   = useState('')

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setCargando(true)
    // Intentar con rut; si el campo no existe en la tabla, reintentar sin él
    let { data: us, error: usErr } = await supabase
      .from('usuarios').select('id, nombre, email, rol, rut').order('nombre')
    if (usErr) {
      ;({ data: us } = await supabase
        .from('usuarios').select('id, nombre, email, rol').order('nombre'))
    }
    // Join sin rut para que no falle si la columna no existe en usuarios
    const { data: ps } = await supabase
      .from('ausencias')
      .select('*, usuario:usuario_id(id, nombre, email, rol)')
      .order('fecha_inicio', { ascending: false })
    setUsuarios(us ?? [])
    setPermisos(ps ?? [])
    setCargando(false)
  }

  async function handleGetPermisosUsados(userId, rut) {
    if (userId) {
      const { count } = await supabase
        .from('ausencias').select('*', { count: 'exact', head: true }).eq('usuario_id', userId)
      return count ?? 0
    }
    if (rut) {
      const { count } = await supabase
        .from('ausencias').select('*', { count: 'exact', head: true }).eq('externo_rut', rut)
      return count ?? 0
    }
    return 0
  }

  async function handleGuardar(datos) {
    const u = datos.usuario

    // Validar duplicados por solapamiento de fechas
    if (u?.id && !u.isExterno) {
      let q = supabase.from('ausencias')
        .select('id', { count: 'exact', head: true })
        .eq('usuario_id', u.id)
        .lte('fecha_inicio', datos.fechaFin)
        .gte('fecha_fin',    datos.fechaInicio)
      if (datos.id) q = q.neq('id', datos.id)
      const { count } = await q
      if (count > 0) throw new Error('DUPLICADO')
    } else if (u?.isExterno && u.rut) {
      let q = supabase.from('ausencias')
        .select('id', { count: 'exact', head: true })
        .eq('externo_rut', u.rut)
        .lte('fecha_inicio', datos.fechaFin)
        .gte('fecha_fin',    datos.fechaInicio)
      if (datos.id) q = q.neq('id', datos.id)
      const { count } = await q
      if (count > 0) throw new Error('DUPLICADO')
    }

    const payload = {
      usuario_id:      u?.isExterno ? null    : (u?.id ?? null),
      externo_nombre:  u?.isExterno ? u.nombre : null,
      externo_rut:     u?.isExterno ? u.rut    : null,
      externo_email:   u?.isExterno ? (u.email ?? null) : null,
      fecha_inicio:   datos.fechaInicio,
      fecha_fin:      datos.fechaFin,
      jornada:        datos.jornada,
      periodo:        datos.periodo,
      hora_inicio:    datos.horaInicio,
      hora_fin:       datos.horaFin,
      tipo:           datos.tipoPermiso,
      notas:          datos.motivoOtro || datos.notas || null,
      recordatorio:   datos.recordatorio,
    }

    let error
    if (datos.id) {
      ;({ error } = await supabase.from('ausencias').update(payload).eq('id', datos.id))
    } else {
      ;({ error } = await supabase.from('ausencias').insert(payload))
    }
    if (error) throw error
    await cargarDatos()
  }

  async function handleEliminar() {
    if (!permisoEliminar || eliminando) return
    setErrorEliminar('')
    setEliminando(true)
    try {
      const { error } = await supabase.from('ausencias').delete().eq('id', permisoEliminar.id)
      if (error) throw error
      setPermisoEliminar(null)
      setPermisoVer(null)
      await cargarDatos()
    } catch {
      setErrorEliminar('No se pudo eliminar. Agrega la política DELETE en Supabase.')
    } finally { setEliminando(false) }
  }

  function abrirEditar(p) {
    setPermisoVer(null)
    setPermisoEditar(p)
  }

  function abrirEliminar(p) {
    setErrorEliminar('')
    setPermisoVer(null)
    setPermisoEliminar(p)
  }

  return (
    <div className="permisos-page">

      <div className="permisos-header">
        <div>
          <h1 className="permisos-title">Permisos</h1>
          <p className="permisos-subtitle">Gestiona los permisos administrativos del sistema.</p>
        </div>
      </div>

      <div className="permisos-card">
        <div className="permisos-card-header">
          <div className="permisos-card-header-left">
            <div className="permisos-card-icon"><CalendarCheck size={16} strokeWidth={2} /></div>
            <div>
              <p className="permisos-card-title">Permisos registrados</p>
              <p className="permisos-card-desc">Períodos de permiso autorizados para los usuarios.</p>
            </div>
          </div>
          <button className="permisos-btn-primary" onClick={() => setModalAbierto(true)}>
            <Plus size={14} strokeWidth={2.5} /> Registrar permiso
          </button>
        </div>

        <div className="permisos-table-wrap">
          {cargando ? (
            <div className="permisos-loading">
              <Loader2 size={18} className="animate-spin" style={{ margin: '0 auto 8px', display: 'block' }} />
              Cargando…
            </div>
          ) : permisos.length === 0 ? (
            <div className="permisos-empty">
              <div className="permisos-empty-icon"><CalendarCheck size={20} strokeWidth={1.5} /></div>
              No hay permisos registrados aún.
            </div>
          ) : (
            <table className="permisos-table">
              <thead>
                <tr>
                  <th>Usuario</th><th>Tipo</th><th>Inicio</th><th>Fin</th><th>Jornada</th><th></th>
                </tr>
              </thead>
              <tbody>
                {permisos.map(p => {
                  const u = p.usuario ?? { nombre: p.externo_nombre, rut: p.externo_rut }
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="permisos-user-cell">
                          <div className="permisos-avatar" style={{ background: getAvatarColor(u.nombre ?? '') }}>
                            {getInitials(u.nombre ?? '')}
                          </div>
                          <div>
                            <div className="permisos-user-name">{u.nombre ?? '—'}</div>
                            <div className="permisos-user-email">{u.rut ?? ROL_LABEL[u.rol] ?? u.rol}</div>
                          </div>
                        </div>
                      </td>
                      <td><span className="permisos-badge permisos-badge--tipo">{TIPO_LABEL[p.tipo] ?? p.tipo}</span></td>
                      <td style={{ color: '#475569' }}>{formatFecha(p.fecha_inicio)}</td>
                      <td style={{ color: '#475569' }}>{formatFecha(p.fecha_fin)}</td>
                      <td><span className="permisos-badge permisos-badge--jornada">{JORNADA_LABEL[p.jornada] ?? p.jornada}</span></td>
                      <td>
                        <div className="permisos-actions">
                          <button className="permisos-action-btn" title="Ver" onClick={() => setPermisoVer(p)}>
                            <Eye size={14} strokeWidth={2} />
                          </button>
                          <button className="permisos-action-btn" title="Editar" onClick={() => abrirEditar(p)}>
                            <Pencil size={14} strokeWidth={2} />
                          </button>
                          <button className="permisos-action-btn permisos-action-btn--danger" title="Eliminar" onClick={() => abrirEliminar(p)}>
                            <Trash2 size={14} strokeWidth={2} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modalAbierto && (
        <ModalPermiso
          usuarios={usuarios}
          usuarioActual={usuario}
          onClose={() => setModalAbierto(false)}
          onGuardar={handleGuardar}
          onGetPermisosUsados={handleGetPermisosUsados}
        />
      )}

      {permisoEditar && (
        <ModalPermiso
          usuarios={usuarios}
          usuarioActual={usuario}
          editData={permisoEditar}
          onClose={() => setPermisoEditar(null)}
          onGuardar={handleGuardar}
          onGetPermisosUsados={handleGetPermisosUsados}
        />
      )}

      {permisoVer && (
        <ModalVerPermiso
          permiso={permisoVer}
          onClose={() => setPermisoVer(null)}
          onEditar={() => abrirEditar(permisoVer)}
          onEliminar={() => abrirEliminar(permisoVer)}
        />
      )}

      {permisoEliminar && (
        <ModalConfirmarEliminar
          eliminando={eliminando}
          errorEliminar={errorEliminar}
          onClose={() => { setPermisoEliminar(null); setErrorEliminar('') }}
          onConfirmar={handleEliminar}
        />
      )}

    </div>
  )
}
