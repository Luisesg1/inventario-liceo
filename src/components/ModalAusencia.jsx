// src/components/ModalAusencia.jsx
import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CalendarOff, X, ChevronDown, Clock, Info,
  CalendarRange, CheckCircle2, Save,
} from 'lucide-react'
import './ModalAusencia.css'

// ── Helpers ────────────────────────────────────────────────────────────────

const ROL_LABEL = {
  admin:                'Administrador',
  editor:               'Editor',
  encargado:            'Encargado',
  docente:              'Docente',
  soporte:              'Soporte',
  visor_requerimientos: 'Visor requerimientos',
}

const TIPOS_AUSENCIA = [
  { value: 'vacaciones',       label: 'Vacaciones' },
  { value: 'licencia_medica',  label: 'Licencia médica' },
  { value: 'permiso_personal', label: 'Permiso personal' },
  { value: 'capacitacion',     label: 'Capacitación' },
  { value: 'otro',             label: 'Otro' },
]

const JORNADAS = [
  { value: 'medio_dia',    label: 'Medio día' },
  { value: 'dia_completo', label: 'Día completo' },
  { value: 'personalizado', label: 'Personalizado' },
]

const RECORDATORIO_OPTS = [
  { value: '1',  label: '1 día antes' },
  { value: '2',  label: '2 días antes' },
  { value: '7',  label: '1 semana antes' },
]

const AVATAR_COLORS = [
  '#1a237e', '#283593', '#1565c0', '#0277bd',
  '#00695c', '#2e7d32', '#558b2f', '#6a1b9a',
  '#ad1457', '#c62828', '#4527a0', '#00838f',
]

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
  const diffMs   = end - start
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1
  if (jornada === 'medio_dia') return '½ día'
  if (diffDays === 1) return '1 día'
  return `${diffDays} días`
}

function formatFecha(fecha) {
  if (!fecha) return '—'
  const [y, m, d] = fecha.split('-')
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  return `${parseInt(d)} ${meses[parseInt(m) - 1]} ${y}`
}

// ── Overlay animation ──────────────────────────────────────────────────────
const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.18 } },
  exit:   { opacity: 0, transition: { duration: 0.15 } },
}

const modalVariants = {
  hidden:  { opacity: 0, scale: 0.95, y: 14 },
  visible: { opacity: 1, scale: 1,    y: 0, transition: { type: 'spring', stiffness: 380, damping: 34 } },
  exit:    { opacity: 0, scale: 0.96, y: 8, transition: { duration: 0.14 } },
}

// ── Component ──────────────────────────────────────────────────────────────

/**
 * @param {Object}   props
 * @param {Array}    props.usuarios    — [{ id, nombre, email, rol }]
 * @param {Function} props.onClose
 * @param {Function} props.onGuardar  — recibe el objeto de ausencia
 */
export default function ModalAusencia({ usuarios = [], onClose, onGuardar }) {
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null)
  const [userDropdownOpen,    setUserDropdownOpen]    = useState(false)
  const [fechaInicio,         setFechaInicio]         = useState('')
  const [fechaFin,            setFechaFin]            = useState('')
  const [jornada,             setJornada]             = useState('dia_completo')
  const [periodo,             setPeriodo]             = useState('am')
  const [horaInicio,          setHoraInicio]          = useState('08:00')
  const [horaFin,             setHoraFin]             = useState('17:00')
  const [tipoAusencia,        setTipoAusencia]        = useState('')
  const [notas,               setNotas]               = useState('')
  const [recordatorio,        setRecordatorio]        = useState(false)
  const [diasRecordatorio,    setDiasRecordatorio]    = useState('1')
  const [guardando,           setGuardando]           = useState(false)

  const dropdownRef = useRef(null)

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setUserDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Sincronizar fechaFin si es menor que fechaInicio
  useEffect(() => {
    if (fechaInicio && fechaFin && fechaFin < fechaInicio) setFechaFin(fechaInicio)
  }, [fechaInicio, fechaFin])

  const duracion = calcDuration(fechaInicio, fechaFin, jornada)
  const tipoLabel = TIPOS_AUSENCIA.find(t => t.value === tipoAusencia)?.label
  const jornadaLabel = JORNADAS.find(j => j.value === jornada)?.label

  const formValido = !!usuarioSeleccionado && !!fechaInicio && !!fechaFin && !!tipoAusencia

  async function handleGuardar() {
    if (!formValido || guardando) return
    setGuardando(true)
    try {
      await onGuardar?.({
        usuario:       usuarioSeleccionado,
        fechaInicio,
        fechaFin,
        jornada,
        periodo:       jornada === 'medio_dia'     ? periodo    : null,
        horaInicio:    jornada === 'personalizado'  ? horaInicio : null,
        horaFin:       jornada === 'personalizado'  ? horaFin    : null,
        tipoAusencia,
        notas:         notas.trim() || null,
        recordatorio:  recordatorio ? diasRecordatorio : null,
      })
      onClose?.()
    } finally {
      setGuardando(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      <motion.div
        className="maus-overlay"
        variants={overlayVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}
      >
        <motion.div
          className="maus-modal"
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {/* ── Header ─────────────────────────────────────────── */}
          <div className="maus-header">
            <div className="maus-header-left">
              <div className="maus-header-icon">
                <CalendarOff size={18} strokeWidth={2} />
              </div>
              <div>
                <p className="maus-header-title">Registrar ausencia</p>
                <p className="maus-header-sub">Registra el período en el que el usuario estará ausente.</p>
              </div>
            </div>
            <button className="maus-close-btn" onClick={onClose} aria-label="Cerrar">
              <X size={16} strokeWidth={2.5} />
            </button>
          </div>

          {/* ── Body ───────────────────────────────────────────── */}
          <div className="maus-body">

            {/* ────── COLUMNA IZQUIERDA — Formulario ────────────── */}
            <div className="maus-form-col">

              {/* Sección: Usuario */}
              <section>
                <p className="maus-section-label">Usuario</p>
                <div className="maus-user-wrap" ref={dropdownRef}>
                  <button
                    type="button"
                    className={`maus-user-trigger ${userDropdownOpen ? 'open' : ''}`}
                    onClick={() => setUserDropdownOpen(o => !o)}
                  >
                    {usuarioSeleccionado ? (
                      <>
                        <div
                          className="maus-user-avatar"
                          style={{ background: getAvatarColor(usuarioSeleccionado.nombre) }}
                        >
                          {getInitials(usuarioSeleccionado.nombre)}
                        </div>
                        <div className="maus-user-info">
                          <div className="maus-user-name">{usuarioSeleccionado.nombre}</div>
                          <div className="maus-user-email">{usuarioSeleccionado.email}</div>
                        </div>
                        <span className="maus-rol-tag">
                          {ROL_LABEL[usuarioSeleccionado.rol] ?? usuarioSeleccionado.rol}
                        </span>
                      </>
                    ) : (
                      <span className="maus-user-placeholder">Seleccionar usuario…</span>
                    )}
                    <ChevronDown
                      size={14}
                      strokeWidth={2.5}
                      className={`maus-user-chevron ${userDropdownOpen ? 'open' : ''}`}
                    />
                  </button>

                  <AnimatePresence>
                    {userDropdownOpen && (
                      <motion.div
                        className="maus-dropdown"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0, transition: { duration: 0.12 } }}
                        exit={{ opacity: 0, y: -4, transition: { duration: 0.10 } }}
                      >
                        {usuarios.length === 0 ? (
                          <div style={{ padding: '12px', textAlign: 'center', fontSize: 12.5, color: '#94a3b8' }}>
                            Sin usuarios disponibles
                          </div>
                        ) : (
                          usuarios.map(u => (
                            <div
                              key={u.id}
                              className={`maus-dropdown-item ${usuarioSeleccionado?.id === u.id ? 'selected' : ''}`}
                              onClick={() => { setUsuarioSeleccionado(u); setUserDropdownOpen(false) }}
                            >
                              <div
                                className="maus-user-avatar"
                                style={{ background: getAvatarColor(u.nombre), width: 28, height: 28, fontSize: 11 }}
                              >
                                {getInitials(u.nombre)}
                              </div>
                              <div className="maus-user-info">
                                <div className="maus-user-name">{u.nombre}</div>
                                <div className="maus-user-email">{u.email}</div>
                              </div>
                              <span className="maus-rol-tag">{ROL_LABEL[u.rol] ?? u.rol}</span>
                            </div>
                          ))
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </section>

              {/* Sección: Período */}
              <section>
                <p className="maus-section-label">Período de ausencia</p>

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

                {/* Tipo de jornada */}
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

                {/* Extra según jornada */}
                <AnimatePresence mode="wait">
                  {jornada === 'medio_dia' && (
                    <motion.div
                      key="medio_dia"
                      className="maus-jornada-extra"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto', transition: { duration: 0.18 } }}
                      exit={{ opacity: 0, height: 0, transition: { duration: 0.12 } }}
                    >
                      <p className="maus-field-label" style={{ marginBottom: 0 }}>Período del día</p>
                      <div className="maus-am-pm">
                        <button
                          type="button"
                          className={`maus-am-pm-btn ${periodo === 'am' ? 'active' : ''}`}
                          onClick={() => setPeriodo('am')}
                        >
                          AM — Mañana
                        </button>
                        <button
                          type="button"
                          className={`maus-am-pm-btn ${periodo === 'pm' ? 'active' : ''}`}
                          onClick={() => setPeriodo('pm')}
                        >
                          PM — Tarde
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {jornada === 'personalizado' && (
                    <motion.div
                      key="personalizado"
                      className="maus-jornada-extra"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto', transition: { duration: 0.18 } }}
                      exit={{ opacity: 0, height: 0, transition: { duration: 0.12 } }}
                    >
                      <div className="maus-date-row">
                        <div className="maus-field-group">
                          <label className="maus-field-label">Hora inicio</label>
                          <input
                            type="time"
                            className="maus-input"
                            value={horaInicio}
                            onChange={e => setHoraInicio(e.target.value)}
                          />
                        </div>
                        <div className="maus-field-group">
                          <label className="maus-field-label">Hora fin</label>
                          <input
                            type="time"
                            className="maus-input"
                            value={horaFin}
                            onChange={e => setHoraFin(e.target.value)}
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>

              {/* Sección: Tipo de ausencia */}
              <section>
                <p className="maus-section-label">Tipo de ausencia</p>
                <select
                  className="maus-select"
                  value={tipoAusencia}
                  onChange={e => setTipoAusencia(e.target.value)}
                >
                  <option value="">Seleccionar tipo…</option>
                  {TIPOS_AUSENCIA.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </section>

              {/* Sección: Notas */}
              <section>
                <p className="maus-section-label">Notas <span style={{ color: '#cbd5e1', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>(opcional)</span></p>
                <textarea
                  className="maus-textarea"
                  placeholder="Agregar información adicional sobre la ausencia…"
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                />
              </section>

              {/* Sección: Recordatorio */}
              <section>
                <p className="maus-section-label">Recordatorio <span style={{ color: '#cbd5e1', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>(opcional)</span></p>
                <div className="maus-reminder-row">
                  <label className="maus-checkbox-wrap">
                    <input
                      type="checkbox"
                      className="maus-checkbox"
                      checked={recordatorio}
                      onChange={e => setRecordatorio(e.target.checked)}
                    />
                    <span className="maus-checkbox-label">Recordar antes del inicio de la ausencia</span>
                  </label>

                  <AnimatePresence>
                    {recordatorio && (
                      <motion.div
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto', transition: { duration: 0.15 } }}
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

            {/* ────── COLUMNA DERECHA — Resumen ─────────────────── */}
            <div className="maus-summary-col">
              <p className="maus-summary-title">Resumen de ausencia</p>

              <div className="maus-summary-card">
                {usuarioSeleccionado ? (
                  <>
                    <div className="maus-summary-user">
                      <div
                        className="maus-user-avatar"
                        style={{
                          background: getAvatarColor(usuarioSeleccionado.nombre),
                          width: 36, height: 36, fontSize: 13,
                        }}
                      >
                        {getInitials(usuarioSeleccionado.nombre)}
                      </div>
                      <div className="maus-summary-user-info">
                        <p className="maus-summary-user-name">{usuarioSeleccionado.nombre}</p>
                        <p className="maus-summary-user-email">{usuarioSeleccionado.email}</p>
                      </div>
                    </div>

                    <div className="maus-summary-row">
                      <span className="maus-summary-row-label">Rol</span>
                      <span className="maus-summary-row-value">
                        {ROL_LABEL[usuarioSeleccionado.rol] ?? usuarioSeleccionado.rol}
                      </span>
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
                  Durante este período, el usuario se marcará como ausente en el sistema.
                </p>
              </div>
            </div>

          </div>

          {/* ── Footer ─────────────────────────────────────────── */}
          <div className="maus-footer">
            <button className="maus-btn-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button
              className="maus-btn-save"
              disabled={!formValido || guardando}
              onClick={handleGuardar}
            >
              {guardando ? (
                <>
                  <CheckCircle2 size={14} strokeWidth={2.5} />
                  Guardando…
                </>
              ) : (
                <>
                  <Save size={14} strokeWidth={2.5} />
                  Guardar ausencia
                </>
              )}
            </button>
          </div>

        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
