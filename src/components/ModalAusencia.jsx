// src/components/ModalAusencia.jsx
import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CalendarCheck, X, ChevronDown, Info,
  CalendarRange, CheckCircle2, Save, Search,
  UserPlus, AlertTriangle, AlertCircle,
} from 'lucide-react'
import './ModalAusencia.css'

// ── Constants ──────────────────────────────────────────────────────────────

const MAX_PERMISOS = 6

const ROL_LABEL = {
  admin:                'Administrador',
  editor:               'Editor',
  encargado:            'Encargado',
  docente:              'Docente',
  soporte:              'Soporte',
  visor_requerimientos: 'Visor requerimientos',
}

const TIPOS_PERMISO = [
  { value: 'vacaciones',            label: 'Vacaciones' },
  { value: 'licencia_medica',       label: 'Licencia médica' },
  { value: 'permiso_administrativo', label: 'Permiso administrativo' },
  { value: 'permiso_personal',      label: 'Permiso personal' },
  { value: 'otro',                  label: 'Otro' },
]

const JORNADAS = [
  { value: 'medio_dia',    label: 'Medio día' },
  { value: 'dia_completo', label: 'Día completo' },
  { value: 'personalizado', label: 'Personalizado' },
]

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

// ── Animations ─────────────────────────────────────────────────────────────

const overlayVariants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.18 } },
  exit:    { opacity: 0, transition: { duration: 0.15 } },
}
const modalVariants = {
  hidden:  { opacity: 0, scale: 0.95, y: 14 },
  visible: { opacity: 1, scale: 1,    y: 0,  transition: { type: 'spring', stiffness: 380, damping: 34 } },
  exit:    { opacity: 0, scale: 0.96, y: 8,  transition: { duration: 0.14 } },
}
const slideVariants = {
  hidden:  { opacity: 0, height: 0 },
  visible: { opacity: 1, height: 'auto', transition: { duration: 0.18 } },
  exit:    { opacity: 0, height: 0,      transition: { duration: 0.12 } },
}

// ── PermisoDots ────────────────────────────────────────────────────────────

function PermisoDots({ usados, max = MAX_PERMISOS }) {
  const restantes = max - usados
  const excedido  = restantes < 0
  const advertencia = restantes === 1

  return (
    <div className="maus-permisos-counter">
      <div className="maus-permisos-dots">
        {Array.from({ length: max }).map((_, i) => (
          <span
            key={i}
            className={`maus-dot ${i < usados ? (excedido || usados > max ? 'maus-dot--over' : 'maus-dot--used') : 'maus-dot--free'}`}
          />
        ))}
        {excedido && Array.from({ length: Math.abs(restantes) }).map((_, i) => (
          <span key={`over-${i}`} className="maus-dot maus-dot--over" />
        ))}
      </div>
      <div className="maus-permisos-label">
        {excedido ? (
          <span className="maus-permisos-text maus-permisos-text--error">
            {usados} de {max} usados
            <span className="maus-permisos-extra"> · {Math.abs(restantes)} en exceso</span>
          </span>
        ) : (
          <span className={`maus-permisos-text ${advertencia ? 'maus-permisos-text--warn' : ''}`}>
            {usados} de {max} usados
          </span>
        )}
      </div>

      <AnimatePresence>
        {advertencia && !excedido && (
          <motion.div
            className="maus-alert maus-alert--warn"
            variants={slideVariants} initial="hidden" animate="visible" exit="exit"
          >
            <AlertTriangle size={13} strokeWidth={2} />
            Queda solo 1 permiso disponible
          </motion.div>
        )}
        {excedido && (
          <motion.div
            className="maus-alert maus-alert--error"
            variants={slideVariants} initial="hidden" animate="visible" exit="exit"
          >
            <AlertCircle size={13} strokeWidth={2} />
            Usuario excedió el límite permitido ({Math.abs(restantes)} en exceso)
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────

/**
 * @param {Object}   props
 * @param {Array}    props.usuarios              — [{ id, nombre, email, rol, rut? }]
 * @param {Function} props.onClose
 * @param {Function} props.onGuardar             — async (datos) => void
 * @param {Function} props.onGetPermisosUsados   — async (userId) => number
 * @param {Function} props.onCrearUsuario        — async ({ rut, nombres, apellidos }) => usuario
 */
export default function ModalAusencia({
  usuarios = [], onClose, onGuardar,
  onGetPermisosUsados, onCrearUsuario,
}) {
  // ── Usuario ──────────────────────────────────────────
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null)
  const [userDropdownOpen,    setUserDropdownOpen]    = useState(false)
  const [busqueda,            setBusqueda]            = useState('')
  const [modoCrear,           setModoCrear]           = useState(false)
  const [rutNuevo,            setRutNuevo]            = useState('')
  const [nombresNuevo,        setNombresNuevo]        = useState('')
  const [apellidosNuevo,      setApellidosNuevo]      = useState('')
  const [creandoUsuario,      setCreandoUsuario]      = useState(false)
  const [permisosUsados,      setPermisosUsados]      = useState(0)
  const [cargandoPermisos,    setCargandoPermisos]    = useState(false)

  // ── Permiso ──────────────────────────────────────────
  const [fechaInicio,      setFechaInicio]      = useState('')
  const [fechaFin,         setFechaFin]         = useState('')
  const [jornada,          setJornada]          = useState('dia_completo')
  const [periodo,          setPeriodo]          = useState('am')
  const [horaInicio,       setHoraInicio]       = useState('08:00')
  const [horaFin,          setHoraFin]          = useState('17:00')
  const [tipoPermiso,      setTipoPermiso]      = useState('')
  const [motivoOtro,       setMotivoOtro]       = useState('')
  const [notas,            setNotas]            = useState('')
  const [recordatorio,     setRecordatorio]     = useState(false)
  const [diasRecordatorio, setDiasRecordatorio] = useState('1')
  const [guardando,        setGuardando]        = useState(false)

  const dropdownRef  = useRef(null)
  const searchRef    = useRef(null)

  // Cerrar dropdown fuera
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setUserDropdownOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Focus buscador al abrir dropdown
  useEffect(() => {
    if (userDropdownOpen && searchRef.current) searchRef.current.focus()
  }, [userDropdownOpen])

  // Sincronizar fechaFin
  useEffect(() => {
    if (fechaInicio && fechaFin && fechaFin < fechaInicio) setFechaFin(fechaInicio)
  }, [fechaInicio, fechaFin])

  // Cargar permisos usados al seleccionar usuario
  useEffect(() => {
    if (!usuarioSeleccionado || !onGetPermisosUsados) return
    setCargandoPermisos(true)
    onGetPermisosUsados(usuarioSeleccionado.id)
      .then(n => setPermisosUsados(n ?? 0))
      .catch(() => setPermisosUsados(0))
      .finally(() => setCargandoPermisos(false))
  }, [usuarioSeleccionado?.id])

  // ── Derived ──────────────────────────────────────────
  const duracion    = calcDuration(fechaInicio, fechaFin, jornada)
  const tipoLabel   = TIPOS_PERMISO.find(t => t.value === tipoPermiso)?.label
  const jornadaLabel = JORNADAS.find(j => j.value === jornada)?.label
  const restantes   = MAX_PERMISOS - permisosUsados
  const excedido    = restantes < 0

  const usuariosFiltrados = usuarios.filter(u => {
    if (!busqueda.trim()) return true
    const q = normStr(busqueda)
    return normStr(u.nombre).includes(q) || normStr(u.rut ?? '').includes(q)
  })

  const formValido = !!usuarioSeleccionado && !!fechaInicio && !!fechaFin && !!tipoPermiso
    && (tipoPermiso !== 'otro' || motivoOtro.trim().length > 0)

  // ── Handlers ─────────────────────────────────────────

  function seleccionarUsuario(u) {
    setUsuarioSeleccionado(u)
    setUserDropdownOpen(false)
    setBusqueda('')
    setModoCrear(false)
  }

  async function handleCrearUsuario() {
    if (!rutNuevo.trim() || !nombresNuevo.trim() || !apellidosNuevo.trim()) return
    setCreandoUsuario(true)
    try {
      const nuevoU = await onCrearUsuario?.({
        rut: rutNuevo.trim(),
        nombres: nombresNuevo.trim(),
        apellidos: apellidosNuevo.trim(),
      })
      if (nuevoU) seleccionarUsuario(nuevoU)
    } finally {
      setCreandoUsuario(false)
    }
  }

  async function handleGuardar() {
    if (!formValido || guardando) return
    setGuardando(true)
    try {
      await onGuardar?.({
        usuario:    usuarioSeleccionado,
        fechaInicio,
        fechaFin,
        jornada,
        periodo:    jornada === 'medio_dia'    ? periodo    : null,
        horaInicio: jornada === 'personalizado' ? horaInicio : null,
        horaFin:    jornada === 'personalizado' ? horaFin    : null,
        tipoPermiso,
        motivoOtro: tipoPermiso === 'otro' ? motivoOtro.trim() : null,
        notas:      notas.trim() || null,
        recordatorio: recordatorio ? diasRecordatorio : null,
      })
      onClose?.()
    } finally {
      setGuardando(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      <motion.div
        className="maus-overlay"
        variants={overlayVariants} initial="hidden" animate="visible" exit="exit"
        onClick={e => { if (e.target === e.currentTarget) onClose?.() }}
      >
        <motion.div
          className="maus-modal"
          variants={modalVariants} initial="hidden" animate="visible" exit="exit"
        >
          {/* ── Header ──────────────────────────────────────── */}
          <div className="maus-header">
            <div className="maus-header-left">
              <div className="maus-header-icon">
                <CalendarCheck size={18} strokeWidth={2} />
              </div>
              <div>
                <p className="maus-header-title">Registrar permiso</p>
                <p className="maus-header-sub">Registra permisos y días autorizados para usuarios.</p>
              </div>
            </div>
            <button className="maus-close-btn" onClick={onClose} aria-label="Cerrar">
              <X size={16} strokeWidth={2.5} />
            </button>
          </div>

          {/* ── Body ────────────────────────────────────────── */}
          <div className="maus-body">

            {/* ── COLUMNA IZQUIERDA ────────────────────────── */}
            <div className="maus-form-col">

              {/* Sección: Usuario */}
              <section>
                <p className="maus-section-label">Usuario</p>
                <div className="maus-user-wrap" ref={dropdownRef}>

                  {/* Trigger */}
                  <button
                    type="button"
                    className={`maus-user-trigger ${userDropdownOpen ? 'open' : ''}`}
                    onClick={() => { setUserDropdownOpen(o => !o); setModoCrear(false) }}
                  >
                    {usuarioSeleccionado ? (
                      <>
                        <div className="maus-user-avatar" style={{ background: getAvatarColor(usuarioSeleccionado.nombre) }}>
                          {getInitials(usuarioSeleccionado.nombre)}
                        </div>
                        <div className="maus-user-info">
                          <div className="maus-user-name">{usuarioSeleccionado.nombre}</div>
                          <div className="maus-user-email">
                            {usuarioSeleccionado.rut ? `${usuarioSeleccionado.rut} · ` : ''}{usuarioSeleccionado.email}
                          </div>
                        </div>
                        <span className="maus-rol-tag">{ROL_LABEL[usuarioSeleccionado.rol] ?? usuarioSeleccionado.rol}</span>
                      </>
                    ) : (
                      <span className="maus-user-placeholder">Buscar o seleccionar usuario…</span>
                    )}
                    <ChevronDown size={14} strokeWidth={2.5} className={`maus-user-chevron ${userDropdownOpen ? 'open' : ''}`} />
                  </button>

                  {/* Dropdown */}
                  <AnimatePresence>
                    {userDropdownOpen && (
                      <motion.div
                        className="maus-dropdown"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0, transition: { duration: 0.13 } }}
                        exit={{ opacity: 0, y: -4, transition: { duration: 0.10 } }}
                      >
                        {/* Buscador */}
                        <div className="maus-search-wrap">
                          <Search size={13} className="maus-search-icon" strokeWidth={2.5} />
                          <input
                            ref={searchRef}
                            type="text"
                            className="maus-search-input"
                            placeholder="Buscar por nombre o RUT…"
                            value={busqueda}
                            onChange={e => { setBusqueda(e.target.value); setModoCrear(false) }}
                          />
                        </div>

                        {/* Lista */}
                        <div className="maus-dropdown-list">
                          {usuariosFiltrados.length === 0 && !modoCrear ? (
                            <div className="maus-dropdown-empty">
                              No se encontró ningún usuario
                            </div>
                          ) : (
                            usuariosFiltrados.map(u => (
                              <div
                                key={u.id}
                                className={`maus-dropdown-item ${usuarioSeleccionado?.id === u.id ? 'selected' : ''}`}
                                onClick={() => seleccionarUsuario(u)}
                              >
                                <div className="maus-user-avatar" style={{ background: getAvatarColor(u.nombre), width: 28, height: 28, fontSize: 11 }}>
                                  {getInitials(u.nombre)}
                                </div>
                                <div className="maus-user-info">
                                  <div className="maus-user-name">{u.nombre}</div>
                                  <div className="maus-user-email">{u.rut ? `${u.rut} · ` : ''}{u.email}</div>
                                </div>
                                <span className="maus-rol-tag">{ROL_LABEL[u.rol] ?? u.rol}</span>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Crear usuario */}
                        {!modoCrear ? (
                          <div className="maus-dropdown-footer">
                            <button
                              type="button"
                              className="maus-create-user-btn"
                              onClick={() => setModoCrear(true)}
                            >
                              <UserPlus size={13} strokeWidth={2.5} />
                              Registrar nuevo usuario
                            </button>
                          </div>
                        ) : (
                          <div className="maus-new-user-form">
                            <p className="maus-new-user-title">Nuevo usuario</p>
                            <div className="maus-new-user-fields">
                              <input
                                type="text"
                                className="maus-input maus-input--sm"
                                placeholder="RUT (ej: 12.345.678-9)"
                                value={rutNuevo}
                                onChange={e => setRutNuevo(e.target.value)}
                              />
                              <div className="maus-date-row">
                                <input
                                  type="text"
                                  className="maus-input maus-input--sm"
                                  placeholder="Nombres"
                                  value={nombresNuevo}
                                  onChange={e => setNombresNuevo(e.target.value)}
                                />
                                <input
                                  type="text"
                                  className="maus-input maus-input--sm"
                                  placeholder="Apellidos"
                                  value={apellidosNuevo}
                                  onChange={e => setApellidosNuevo(e.target.value)}
                                />
                              </div>
                              <div className="maus-new-user-actions">
                                <button
                                  type="button"
                                  className="maus-btn-cancel maus-btn-cancel--sm"
                                  onClick={() => setModoCrear(false)}
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  className="maus-btn-save maus-btn-save--sm"
                                  disabled={!rutNuevo.trim() || !nombresNuevo.trim() || !apellidosNuevo.trim() || creandoUsuario}
                                  onClick={handleCrearUsuario}
                                >
                                  {creandoUsuario ? 'Creando…' : 'Crear usuario'}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Contador de permisos */}
                <AnimatePresence>
                  {usuarioSeleccionado && !cargandoPermisos && (
                    <motion.div
                      variants={slideVariants} initial="hidden" animate="visible" exit="exit"
                      style={{ marginTop: 10 }}
                    >
                      <PermisoDots usados={permisosUsados} />
                    </motion.div>
                  )}
                  {cargandoPermisos && (
                    <motion.div
                      variants={slideVariants} initial="hidden" animate="visible" exit="exit"
                      style={{ marginTop: 8 }}
                    >
                      <div className="maus-permisos-loading">Verificando permisos…</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>

              {/* Sección: Tipo de permiso */}
              <section>
                <p className="maus-section-label">Tipo de permiso</p>
                <select
                  className="maus-select"
                  value={tipoPermiso}
                  onChange={e => { setTipoPermiso(e.target.value); setMotivoOtro('') }}
                >
                  <option value="">Seleccionar tipo…</option>
                  {TIPOS_PERMISO.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>

                <AnimatePresence>
                  {tipoPermiso === 'otro' && (
                    <motion.div
                      variants={slideVariants} initial="hidden" animate="visible" exit="exit"
                      style={{ marginTop: 10 }}
                    >
                      <textarea
                        className="maus-textarea"
                        placeholder="Escriba el motivo del permiso…"
                        value={motivoOtro}
                        onChange={e => setMotivoOtro(e.target.value)}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>

              {/* Sección: Período */}
              <section>
                <p className="maus-section-label">Período del permiso</p>

                <div className="maus-date-row" style={{ marginBottom: 12 }}>
                  <div className="maus-field-group">
                    <label className="maus-field-label">Fecha inicio</label>
                    <input
                      type="date"
                      className="maus-input"
                      value={fechaInicio}
                      onChange={e => setFechaInicio(e.target.value)}
                    />
                  </div>
                  <div className="maus-field-group">
                    <label className="maus-field-label">Fecha fin</label>
                    <input
                      type="date"
                      className="maus-input"
                      value={fechaFin}
                      min={fechaInicio || undefined}
                      onChange={e => setFechaFin(e.target.value)}
                    />
                  </div>
                </div>

                {/* Jornada */}
                <div className="maus-jornada-pills">
                  {JORNADAS.map(j => (
                    <button
                      key={j.value}
                      type="button"
                      className={`maus-jornada-pill ${jornada === j.value ? 'active' : ''}`}
                      onClick={() => setJornada(j.value)}
                    >
                      {j.label}
                    </button>
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  {jornada === 'medio_dia' && (
                    <motion.div key="medio_dia" className="maus-jornada-extra" variants={slideVariants} initial="hidden" animate="visible" exit="exit">
                      <p className="maus-field-label" style={{ marginBottom: 0 }}>Período del día</p>
                      <div className="maus-am-pm">
                        {[{ v: 'am', l: 'AM — Mañana' }, { v: 'pm', l: 'PM — Tarde' }].map(({ v, l }) => (
                          <button
                            key={v}
                            type="button"
                            className={`maus-am-pm-btn ${periodo === v ? 'active' : ''}`}
                            onClick={() => setPeriodo(v)}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                  {jornada === 'personalizado' && (
                    <motion.div key="personalizado" className="maus-jornada-extra" variants={slideVariants} initial="hidden" animate="visible" exit="exit">
                      <div className="maus-date-row">
                        <div className="maus-field-group">
                          <label className="maus-field-label">Hora inicio</label>
                          <input type="time" className="maus-input" value={horaInicio} onChange={e => setHoraInicio(e.target.value)} />
                        </div>
                        <div className="maus-field-group">
                          <label className="maus-field-label">Hora fin</label>
                          <input type="time" className="maus-input" value={horaFin} onChange={e => setHoraFin(e.target.value)} />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>

              {/* Sección: Notas */}
              <section>
                <p className="maus-section-label">
                  Notas <span style={{ color: '#cbd5e1', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>(opcional)</span>
                </p>
                <textarea
                  className="maus-textarea"
                  placeholder="Información adicional sobre el permiso…"
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                />
              </section>

              {/* Sección: Recordatorio */}
              <section>
                <p className="maus-section-label">
                  Recordatorio <span style={{ color: '#cbd5e1', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>(opcional)</span>
                </p>
                <div className="maus-reminder-row">
                  <label className="maus-checkbox-wrap">
                    <input
                      type="checkbox"
                      className="maus-checkbox"
                      checked={recordatorio}
                      onChange={e => setRecordatorio(e.target.checked)}
                    />
                    <span className="maus-checkbox-label">Recordar antes del inicio del permiso</span>
                  </label>
                  <AnimatePresence>
                    {recordatorio && (
                      <motion.div
                        initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto', transition: { duration: 0.15 } }}
                        exit={{ opacity: 0, width: 0, transition: { duration: 0.12 } }}
                        style={{ overflow: 'hidden' }}
                      >
                        <select
                          className="maus-select"
                          style={{ width: 'auto', minWidth: 140 }}
                          value={diasRecordatorio}
                          onChange={e => setDiasRecordatorio(e.target.value)}
                        >
                          {RECORDATORIO_OPTS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </section>

            </div>

            {/* ── COLUMNA DERECHA — Resumen ─────────────────── */}
            <div className="maus-summary-col">
              <p className="maus-summary-title">Resumen del permiso</p>

              <div className="maus-summary-card">
                {usuarioSeleccionado ? (
                  <>
                    <div className="maus-summary-user">
                      <div
                        className="maus-user-avatar"
                        style={{ background: getAvatarColor(usuarioSeleccionado.nombre), width: 36, height: 36, fontSize: 13 }}
                      >
                        {getInitials(usuarioSeleccionado.nombre)}
                      </div>
                      <div className="maus-summary-user-info">
                        <p className="maus-summary-user-name">{usuarioSeleccionado.nombre}</p>
                        <p className="maus-summary-user-email">
                          {usuarioSeleccionado.rut ?? usuarioSeleccionado.email}
                        </p>
                      </div>
                    </div>

                    {usuarioSeleccionado.rut && (
                      <div className="maus-summary-row">
                        <span className="maus-summary-row-label">RUT</span>
                        <span className="maus-summary-row-value">{usuarioSeleccionado.rut}</span>
                      </div>
                    )}

                    <div className="maus-summary-row">
                      <span className="maus-summary-row-label">Rol</span>
                      <span className="maus-summary-row-value">{ROL_LABEL[usuarioSeleccionado.rol] ?? usuarioSeleccionado.rol ?? '—'}</span>
                    </div>

                    <div className="maus-summary-row">
                      <span className="maus-summary-row-label">Tipo</span>
                      <span className="maus-summary-row-value">{tipoLabel ?? '—'}</span>
                    </div>

                    <div className="maus-summary-row">
                      <span className="maus-summary-row-label">Inicio</span>
                      <span className="maus-summary-row-value">{formatFecha(fechaInicio)}</span>
                    </div>

                    <div className="maus-summary-row">
                      <span className="maus-summary-row-label">Fin</span>
                      <span className="maus-summary-row-value">{formatFecha(fechaFin)}</span>
                    </div>

                    <div className="maus-summary-row">
                      <span className="maus-summary-row-label">Jornada</span>
                      <span className="maus-summary-row-value">{jornadaLabel}</span>
                    </div>

                    {/* Permisos restantes */}
                    {!cargandoPermisos && (
                      <div className="maus-summary-row" style={{ marginTop: 2 }}>
                        <span className="maus-summary-row-label">Restantes</span>
                        <span className={`maus-summary-row-value ${excedido ? 'maus-value--error' : restantes === 1 ? 'maus-value--warn' : ''}`}>
                          {excedido ? `−${Math.abs(restantes)} permisos` : `${restantes} de ${MAX_PERMISOS}`}
                        </span>
                      </div>
                    )}

                    {/* Badge estado */}
                    <AnimatePresence>
                      {restantes === 1 && !excedido && !cargandoPermisos && (
                        <motion.div
                          variants={slideVariants} initial="hidden" animate="visible" exit="exit"
                          className="maus-summary-alert maus-summary-alert--warn"
                        >
                          <AlertTriangle size={11} strokeWidth={2.5} />
                          Queda solo 1 permiso disponible
                        </motion.div>
                      )}
                      {excedido && !cargandoPermisos && (
                        <motion.div
                          variants={slideVariants} initial="hidden" animate="visible" exit="exit"
                          className="maus-summary-alert maus-summary-alert--error"
                        >
                          <AlertCircle size={11} strokeWidth={2.5} />
                          Usuario excedió el límite
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {duracion && (
                      <div style={{ paddingTop: 10 }}>
                        <div className="maus-duration-badge">
                          <CalendarRange size={12} strokeWidth={2.5} />
                          {duracion}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="maus-summary-empty">Completa el formulario para ver el resumen</p>
                )}
              </div>

              <div className="maus-info-card">
                <Info size={14} className="maus-info-card-icon" />
                <p className="maus-info-card-text">
                  Durante este período, el usuario se marcará con permiso en el sistema.
                </p>
              </div>
            </div>

          </div>

          {/* ── Footer ──────────────────────────────────────── */}
          <div className="maus-footer">
            {excedido && (
              <span className="maus-footer-warn">
                <AlertCircle size={13} strokeWidth={2} />
                Límite de permisos excedido
              </span>
            )}
            <button className="maus-btn-cancel" onClick={onClose}>Cancelar</button>
            <button
              className="maus-btn-save"
              disabled={!formValido || guardando}
              onClick={handleGuardar}
            >
              {guardando ? (
                <><CheckCircle2 size={14} strokeWidth={2.5} />Guardando…</>
              ) : (
                <><Save size={14} strokeWidth={2.5} />Guardar permiso</>
              )}
            </button>
          </div>

        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
