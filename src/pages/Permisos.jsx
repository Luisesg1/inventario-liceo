// src/pages/Permisos.jsx
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CalendarCheck, Plus, Loader2, X, ChevronDown, Search,
  UserPlus, Info, CalendarRange, Save, CheckCircle2,
  Eye, Pencil, Trash2, AlertCircle, AlertTriangle,
  Users, Gift, UserX, Download,
} from 'lucide-react'
import { supabase } from '../supabase'
import { getSaldoCompensatorio, descontarCompensatorios, restaurarCompensatorios } from './Compensatorios'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import './Permisos.css'

// ── Constants ──────────────────────────────────────────────────────────────

const MAX_AUSENCIAS = 6

const ROL_LABEL = {
  admin:          'Administrador',
  directivo:      'Directivo',
  coordinador:    'Coordinador',
  docente:        'Docente',
  asistente:      'Asistente de la educación',
  administrativo: 'Administrativo',
  // Legacy
  encargado_inventario:'Encargado inventario',
  encargado_soporte:   'Encargado Soporte técnico',
  encargado_permisos:  'Encargado Permisos',
  editor:              'Editor',
  encargado:           'Encargado',
  soporte:             'Soporte',
  visor_requerimientos:'Visor requerimientos',
}

const ROLES_ACTIVOS = [
  { value: 'admin',          label: 'Administrador' },
  { value: 'directivo',      label: 'Directivo' },
  { value: 'coordinador',    label: 'Coordinador' },
  { value: 'docente',        label: 'Docente' },
  { value: 'asistente',      label: 'Asistente de la educación' },
  { value: 'administrativo', label: 'Administrativo' },
]

const TIPOS_PERMISO = [
  { value: 'licencia_medica',        label: 'Licencia médica' },
  { value: 'permiso_administrativo', label: 'Permiso administrativo' },
  { value: 'justificativo',          label: 'Ausencia sin justificar' },
  { value: 'dias_compensatorios',    label: 'Días compensatorios' },
]

// Tipos que NO descuentan del cupo (solo quedan registrados)
const TIPOS_SIN_DESCUENTO = new Set(['licencia_medica', 'dias_compensatorios'])

const MAX_NOTAS = 400

const TIPO_LABEL = Object.fromEntries(TIPOS_PERMISO.map(t => [t.value, t.label]))

// Estilos visuales por tipo
const TIPO_STYLE = {
  licencia_medica:        { bg: '#eff6ff',             color: '#1d4ed8', icon: '🏥' },
  permiso_administrativo: { bg: '#fef9c3',             color: '#854d0e', icon: '📋' },
  justificativo:          { bg: '#ecfeff',             color: '#0e7490', icon: '📝' },
  dias_compensatorios:    { bg: 'rgba(99,102,241,0.1)', color: '#4f46e5', icon: '🎁' },
}

const JORNADAS = [
  { value: 'medio_dia',     label: 'Medio día' },
  { value: 'dia_completo',  label: 'Día completo' },
  { value: 'personalizado', label: 'Personalizado' },
  { value: 'reposo',        label: 'Desde / Hasta' },
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

// Cuenta días hábiles entre dos fechas (Lun-Vie, excluye inhabilitados)
function diasHabiles(fechaInicio, fechaFin, inhabilitados = new Set()) {
  if (!fechaInicio || !fechaFin) return 0
  let total = 0
  const cur = new Date(fechaInicio + 'T12:00:00')
  const fin = new Date(fechaFin   + 'T12:00:00')
  if (isNaN(cur) || isNaN(fin) || fin < cur) return 0
  while (cur <= fin) {
    const dow = cur.getDay()
    const iso = cur.toISOString().slice(0, 10)
    if (dow !== 0 && dow !== 6 && !inhabilitados.has(iso)) total++
    cur.setDate(cur.getDate() + 1)
  }
  return total
}

// Cuenta todos los días calendario (Lun-Dom) — para licencia médica
function diasCalendario(fechaInicio, fechaFin) {
  if (!fechaInicio || !fechaFin) return 0
  const s = new Date(fechaInicio + 'T12:00:00')
  const e = new Date(fechaFin   + 'T12:00:00')
  if (isNaN(s) || isNaN(e) || e < s) return 0
  return Math.round((e - s) / 86400000) + 1
}

// tipo: 'licencia_medica' → todos los días | resto → solo hábiles
function calcDuration(fechaInicio, fechaFin, jornada, inhabilitados = new Set(), tipo = '') {
  if (!fechaInicio || !fechaFin) return null
  if (jornada === 'medio_dia') return '½ día'
  const h = tipo === 'licencia_medica'
    ? diasCalendario(fechaInicio, fechaFin)
    : diasHabiles(fechaInicio, fechaFin, inhabilitados)
  if (h === 0) return null
  if (tipo === 'licencia_medica') return h === 1 ? '1 día' : `${h} días`
  return h === 1 ? '1 día hábil' : `${h} días hábiles`
}

// Calcula días reales (float) de una lista de ausencias.
// soloDescuento=true excluye tipos que no descuentan cupo (ej. licencia_medica)
function calcDiasTotales(rows, soloDescuento = false, inhabilitados = new Set()) {
  let total = 0
  rows.forEach(p => {
    if (soloDescuento && TIPOS_SIN_DESCUENTO.has(p.tipo)) return
    if (p.jornada === 'medio_dia') {
      total += 0.5
    } else if (p.jornada === 'personalizado' && p.hora_inicio && p.hora_fin) {
      const [sh, sm] = p.hora_inicio.split(':').map(Number)
      const [eh, em] = p.hora_fin.split(':').map(Number)
      const horas = (eh * 60 + em - (sh * 60 + sm)) / 60
      total += Math.max(0, horas / 8)
    } else if (p.fecha_inicio && p.fecha_fin) {
      // licencia médica cuenta todos los días (Lun-Dom)
      // permiso administrativo solo cuenta días hábiles (Lun-Vie)
      total += p.tipo === 'licencia_medica'
        ? diasCalendario(p.fecha_inicio, p.fecha_fin)
        : diasHabiles(p.fecha_inicio, p.fecha_fin, inhabilitados)
    }
  })
  return total
}

function fmtDias(d) {
  if (d === 0)   return '0'
  if (d === 0.5) return '½'
  if (d % 1 === 0) return String(d)
  return d.toFixed(1)
}

// Colores progresivos según días usados vs cuota
function getAusenciaColors(dias, max = MAX_AUSENCIAS) {
  const restantes = Math.max(max - dias, 0)
  if (dias >= max)    return { dot: '#b91c1c', text: '#b91c1c' } // rojo — agotada
  if (restantes <= 1) return { dot: '#ea580c', text: '#ea580c' } // naranja — 1 restante
  if (restantes <= 2) return { dot: '#d97706', text: '#b45309' } // ámbar — 2 restantes
  return { dot: '#1a237e', text: '#64748b' }                      // azul — normal
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

function validarRut(rut) {
  const clean = rut.replace(/\./g, '').replace('-', '').toUpperCase()
  if (clean.length < 2) return false
  const cuerpo = clean.slice(0, -1)
  const dv = clean.slice(-1)
  let suma = 0, multiplo = 2
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i]) * multiplo
    multiplo = multiplo < 7 ? multiplo + 1 : 2
  }
  const esperado = 11 - (suma % 11)
  const dvEsperado = esperado === 11 ? '0' : esperado === 10 ? 'K' : esperado.toString()
  return dv === dvEsperado
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

function PermisoDots({ dias = 0, max = MAX_AUSENCIAS }) {
  const restantes = Math.max(max - dias, 0)
  const agotada   = dias >= max
  const { dot: dotColor, text: textColor } = getAusenciaColors(dias, max)
  const bold = dias > 0 && restantes <= 2
  return (
    <div className="mp-counter">
      <div className="mp-dots">
        {Array.from({ length: max }).map((_, i) => {
          const filled = Math.min(Math.max(dias - i, 0), 1)
          const bg = filled >= 1
            ? dotColor
            : filled > 0
              ? `linear-gradient(90deg, ${dotColor} ${filled * 100}%, #e2e8f0 ${filled * 100}%)`
              : '#e2e8f0'
          return <span key={i} className="mp-dot" style={{ background: bg }} />
        })}
      </div>
      {agotada ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#fef2f2', border: '1.5px solid #fca5a5',
          borderRadius: 9, padding: '8px 12px', marginTop: 4,
        }}>
          <AlertTriangle size={14} style={{ color: '#dc2626', flexShrink: 0 }} />
          <div>
            <span style={{ fontSize: 13, color: '#dc2626', fontWeight: 700, display: 'block', lineHeight: 1.3 }}>
              Cuota agotada — {fmtDias(dias)}/{max} días usados este año
            </span>
            <span style={{ fontSize: 11.5, color: '#ef4444', display: 'block', marginTop: 1 }}>
              {dias > max
                ? `Se excedió la cuota por ${fmtDias(dias - max)} día${dias - max !== 1 ? 's' : ''}`
                : 'No quedan días disponibles para este usuario'}
            </span>
          </div>
        </div>
      ) : (
        <span className="mp-counter-label" style={{ color: textColor, fontWeight: bold ? 600 : 400 }}>
          {dias === 0
            ? `Sin ausencias este año · ${max} días disponibles`
            : restantes <= 1
              ? `⚠️ Solo queda ${fmtDias(restantes)} día hábil este año`
              : restantes <= 2
                ? `⚠️ Quedan ${fmtDias(restantes)} días · úsalos con cuidado`
                : `Quedan ${fmtDias(restantes)} días este año (${fmtDias(dias)} usados)`}
        </span>
      )}
    </div>
  )
}

// ── CalendarioFeriados ─────────────────────────────────────────────────────

const CAL_MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const CAL_DIAS  = ['Lu','Ma','Mi','Ju','Vi','Sá','Do']

function CalendarioFeriados({
  value, onChange, min, max,
  inhabilitados = new Set(), etiquetas = new Map(),
  placeholder = 'Seleccionar fecha',
}) {
  const [abierto, setAbierto] = useState(false)
  const ref  = useRef(null)
  const hoyIso = new Date().toISOString().slice(0, 10)

  const parsedVal = value ? new Date(value + 'T12:00:00') : null
  const [mes,  setMes]  = useState(() => parsedVal?.getMonth()     ?? new Date().getMonth())
  const [anio, setAnio] = useState(() => parsedVal?.getFullYear()  ?? new Date().getFullYear())

  useEffect(() => {
    function onOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  // Navegar al mes del valor externo
  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T12:00:00')
      setMes(d.getMonth()); setAnio(d.getFullYear())
    }
  }, [value])

  function anterior() { mes === 0 ? (setMes(11), setAnio(a => a - 1)) : setMes(m => m - 1) }
  function siguiente() { mes === 11 ? (setMes(0), setAnio(a => a + 1)) : setMes(m => m + 1) }

  // Construir grilla del mes
  let dowInicio = new Date(anio, mes, 1).getDay()
  dowInicio = dowInicio === 0 ? 6 : dowInicio - 1 // Lun=0
  const diasEnMes = new Date(anio, mes + 1, 0).getDate()
  const celdas = [...Array(dowInicio).fill(null), ...Array.from({ length: diasEnMes }, (_, i) => i + 1)]
  while (celdas.length % 7 !== 0) celdas.push(null)

  function seleccionar(d) {
    if (!d) return
    const iso = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    if (min && iso < min) return
    if (max && iso > max) return
    onChange(iso); setAbierto(false)
  }

  function displayValue() {
    if (!value) return placeholder
    const [y, m, d] = value.split('-')
    return `${d}/${m}/${y}`
  }

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      {/* Trigger */}
      <button type="button" className="mp-input"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', width: '100%', textAlign: 'left' }}
        onClick={() => setAbierto(a => !a)}>
        <span style={{ color: value ? '#374151' : '#9ca3af', fontSize: 13 }}>{displayValue()}</span>
        <CalendarCheck size={13} strokeWidth={2} style={{ color: '#94a3b8', flexShrink: 0 }} />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {abierto && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.14 } }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.10 } }}
            style={{
              position: 'absolute', zIndex: 9999, top: 'calc(100% + 6px)', left: 0,
              background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0',
              boxShadow: '0 8px 32px rgba(0,0,0,0.14)', padding: '14px 12px',
              minWidth: 264, userSelect: 'none',
            }}>

            {/* Navegación mes */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <button type="button" onClick={anterior}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 10px', borderRadius: 6, color: '#475569', fontSize: 18, lineHeight: 1 }}>
                ‹
              </button>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: '#111827' }}>
                {CAL_MESES[mes]} {anio}
              </span>
              <button type="button" onClick={siguiente}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 10px', borderRadius: 6, color: '#475569', fontSize: 18, lineHeight: 1 }}>
                ›
              </button>
            </div>

            {/* Encabezados días */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
              {CAL_DIAS.map((d, i) => (
                <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: i >= 5 ? '#fca5a5' : '#94a3b8', paddingBottom: 4 }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Celdas de días */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
              {celdas.map((d, i) => {
                if (!d) return <div key={`v${i}`} />
                const iso = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                const dow = new Date(iso + 'T12:00:00').getDay()
                const esFinSemana  = dow === 0 || dow === 6
                const esInhab      = inhabilitados.has(iso)
                const esSel        = iso === value
                const esHoy        = iso === hoyIso
                const deshabilitado = (min && iso < min) || (max && iso > max)
                const etiqueta     = etiquetas.get(iso)

                let bg = 'transparent'
                let color = esFinSemana ? '#94a3b8' : '#111827'
                let fw = 400
                if (deshabilitado) color = '#d1d5db'
                else if (esSel)   { bg = '#1a237e'; color = '#fff'; fw = 700 }
                else if (esInhab) { bg = '#fef2f2'; color = '#dc2626' }

                return (
                  <div key={iso}
                    title={etiqueta ?? (esFinSemana ? 'Fin de semana' : undefined)}
                    onClick={() => !deshabilitado && seleccionar(d)}
                    onMouseEnter={e => { if (!deshabilitado && !esSel) e.currentTarget.style.background = '#f1f5f9' }}
                    onMouseLeave={e => { if (!esSel) e.currentTarget.style.background = esInhab ? '#fef2f2' : 'transparent' }}
                    style={{
                      position: 'relative', textAlign: 'center', fontSize: 12.5, fontWeight: fw,
                      padding: '5px 2px', borderRadius: 7, cursor: deshabilitado ? 'default' : 'pointer',
                      background: bg, color,
                      border: esHoy && !esSel ? '1.5px solid #1a237e' : '1.5px solid transparent',
                    }}>
                    {d}
                    {esInhab && !esSel && (
                      <span style={{
                        position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)',
                        width: 3, height: 3, borderRadius: '50%', background: '#ef4444', display: 'block',
                      }} />
                    )}
                  </div>
                )
              })}
            </div>

            {/* Leyenda */}
            <div style={{ display: 'flex', gap: 12, marginTop: 10, paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#94a3b8' }}>
                <span style={{ width: 8, height: 8, borderRadius: 3, background: '#fef2f2', border: '1px solid #fca5a5', display: 'inline-block', flexShrink: 0 }} />
                Feriado / Inhábil
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#94a3b8' }}>
                <span style={{ width: 8, height: 8, borderRadius: 3, border: '1.5px solid #1a237e', display: 'inline-block', flexShrink: 0 }} />
                Hoy
              </span>
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── ModalVerPermiso ────────────────────────────────────────────────────────

function ModalVerPermiso({ permiso, onClose, onEditar, onEliminar, diasInhabilitados = new Set() }) {
  const u       = userFromPermiso(permiso) ?? {}
  const nombre  = u.nombre ?? '—'
  const duracion = calcDuration(permiso.fecha_inicio, permiso.fecha_fin, permiso.jornada, diasInhabilitados, permiso.tipo)

  return (
    <AnimatePresence>
      <motion.div className="mp-overlay" variants={overlayV} initial="hidden" animate="visible" exit="exit"
        onClick={e => { if (e.target === e.currentTarget) onClose?.() }}>
        <motion.div className="mp-modal mp-modal--sm" variants={modalV} initial="hidden" animate="visible" exit="exit">

          <div className="mp-header">
            <div className="mp-header-left">
              <div className="mp-header-icon"><CalendarCheck size={18} strokeWidth={2} /></div>
              <div>
                <p className="mp-header-title">Detalle de la ausencia</p>
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
                <span className="permisos-badge permisos-badge--tipo" style={{
                  background: TIPO_STYLE[permiso.tipo]?.bg ?? '#f1f5f9',
                  color: TIPO_STYLE[permiso.tipo]?.color ?? '#475569',
                }}>
                  {TIPO_STYLE[permiso.tipo]?.icon ?? ''} {TIPO_LABEL[permiso.tipo] ?? permiso.tipo}
                </span>
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
            {onEliminar && (
              <button className="mp-btn-danger" onClick={onEliminar}>
                <Trash2 size={14} strokeWidth={2.5} /> Eliminar
              </button>
            )}
            <div style={{ flex: 1 }} />
            <button className="mp-btn-cancel" onClick={onClose}>Cerrar</button>
            {onEditar && (
              <button className="mp-btn-save" onClick={onEditar}>
                <Pencil size={14} strokeWidth={2.5} /> Editar
              </button>
            )}
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
            <p className="mp-confirm-title">¿Eliminar ausencia?</p>
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

function ModalPermiso({ usuarios, usuarioActual, onClose, onGuardar, onGetPermisosUsados, onUsuarioCreado, editData, diasInhabilitados = new Set(), feriadosLabels = new Map() }) {
  const isEdit = !!editData

  const userInit = isEdit ? userFromPermiso(editData) : null

  const [usuarioSel,        setUsuarioSel]        = useState(userInit)
  const [dropdownOpen,      setDropdownOpen]      = useState(false)
  const [busqueda,          setBusqueda]          = useState('')
  const [modoCrear,         setModoCrear]         = useState(false)
  const [rutNuevo,          setRutNuevo]          = useState('')
  const [nombresNuevo,      setNombresNuevo]      = useState('')
  const [apellidosNuevo,    setApellidosNuevo]    = useState('')
  const [emailNuevo,        setEmailNuevo]        = useState('')
  const [rolNuevo,          setRolNuevo]          = useState('')
  const [creandoUser,            setCreandoUser]            = useState(false)
  const [nuevoFE,                setNuevoFE]                = useState({})

  function setNFE(field, msg) { setNuevoFE(p => ({ ...p, [field]: msg })) }
  function clearNFE(field)    { setNuevoFE(p => ({ ...p, [field]: '' })) }
  const [usuarioEncontrado,      setUsuarioEncontrado]      = useState(null)
  const [usuarioEncontradoEmail, setUsuarioEncontradoEmail] = useState(null)
  const [permisosUsados,    setPermisosUsados]    = useState(0)
  const [cargandoPermisos,  setCargandoPermisos]  = useState(false)
  const [saldoComp,         setSaldoComp]         = useState(null)  // { disponible, records }
  const [cargandoComp,      setCargandoComp]      = useState(false)

  const [fechaInicio, setFechaInicio] = useState(isEdit ? (editData.fecha_inicio ?? '') : '')
  const [fechaFin,    setFechaFin]    = useState(isEdit ? (editData.fecha_fin   ?? '') : '')
  const [jornada,     setJornada]     = useState(isEdit ? (editData.jornada     ?? 'dia_completo') : 'dia_completo')
  const [periodo,     setPeriodo]     = useState(isEdit ? (editData.periodo     ?? 'am') : 'am')
  const [horaInicio,  setHoraInicio]  = useState(isEdit ? (editData.hora_inicio ?? '08:00') : '08:00')
  const [horaFin,     setHoraFin]     = useState(isEdit ? (editData.hora_fin    ?? '17:00') : '17:00')
  const [tipoPermiso, setTipoPermiso] = useState(isEdit ? (editData.tipo  ?? '') : '')
  const [notas,       setNotas]       = useState(isEdit ? (editData.notas ?? '') : '')
  const [recordatorio, setRecordatorio] = useState(isEdit ? !!editData.recordatorio : false)
  const [diasRecord,  setDiasRecord]  = useState(isEdit && editData.recordatorio ? editData.recordatorio : '1')
  const [compSubMode,   setCompSubMode]   = useState('horas') // 'dias' | 'horas' — sub-modo de Personalizado en compensatorios
  const [compDiasInput, setCompDiasInput] = useState('')
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
    if (!fechaInicio || !fechaFin) return
    if (jornada === 'medio_dia' || jornada === 'personalizado') return
    setJornada(fechaInicio === fechaFin ? 'dia_completo' : 'reposo')
  }, [fechaInicio, fechaFin])

  useEffect(() => {
    if (!usuarioSel || !onGetPermisosUsados) return
    setCargandoPermisos(true)
    onGetPermisosUsados(usuarioSel.id, usuarioSel.rut)
      .then(n => setPermisosUsados(n ?? 0))
      .catch(() => setPermisosUsados(0))
      .finally(() => setCargandoPermisos(false))
  }, [usuarioSel?.id, usuarioSel?.rut])

  // Carga saldo compensatorio cuando el usuario cambia o el tipo es compensatorios
  useEffect(() => {
    if (tipoPermiso !== 'dias_compensatorios' || !usuarioSel?.id) {
      setSaldoComp(null); return
    }
    setCargandoComp(true)
    // Resuelve todos los IDs que comparten el mismo RUT (misma persona, distintas cuentas)
    const extraIds = usuarioSel.rut
      ? usuarios
          .filter(u => u.rut && normRut(u.rut) === normRut(usuarioSel.rut) && u.id !== usuarioSel.id)
          .map(u => u.id)
      : []
    getSaldoCompensatorio(usuarioSel.id, extraIds)
      .then(s => setSaldoComp(s))
      .catch(() => setSaldoComp({ disponible: 0, records: [] }))
      .finally(() => setCargandoComp(false))
  }, [tipoPermiso, usuarioSel?.id])

  const duracion    = calcDuration(fechaInicio, fechaFin, jornada, diasInhabilitados, tipoPermiso)
  const tipoLabel   = TIPOS_PERMISO.find(t => t.value === tipoPermiso)?.label
  const jornadaLabel = JORNADAS.find(j => j.value === jornada)?.label

  const usuariosFiltrados = (() => {
    const seenRut = new Set()
    return usuarios.filter(u => {
      // Deduplica por RUT: si ya se mostró alguien con el mismo RUT, ocultar
      if (u.rut) {
        const key = normRut(u.rut)
        if (seenRut.has(key)) return false
        seenRut.add(key)
      }
      if (!busqueda.trim()) return true
      const q    = normStr(busqueda)
      const qRut = normRut(busqueda)
      return normStr(u.nombre).includes(q)
        || normStr(u.rut ?? '').includes(q)
        || (qRut.length > 0 && normRut(u.rut ?? '').includes(qRut))
    })
  })()

  // Resetear sub-modo al salir de Personalizado o de compensatorios
  useEffect(() => {
    if (jornada !== 'personalizado') { setCompSubMode('horas'); setCompDiasInput('') }
  }, [jornada])
  useEffect(() => {
    if (tipoPermiso !== 'dias_compensatorios') { setCompSubMode('horas'); setCompDiasInput('') }
  }, [tipoPermiso])

  // Días a descontar del saldo compensatorio (float)
  const diasCompAUsar = (() => {
    if (tipoPermiso !== 'dias_compensatorios' || !fechaInicio || !fechaFin) return 0
    if (jornada === 'medio_dia') return 0.5
    if (jornada === 'personalizado' && horaInicio && horaFin) {
      const [sh, sm] = horaInicio.split(':').map(Number)
      const [eh, em] = horaFin.split(':').map(Number)
      return Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60 / 8)
    }
    return diasHabiles(fechaInicio, fechaFin, diasInhabilitados)
  })()

  // Notas siempre obligatorias (motivo de la licencia / permiso)
  const formValido = !!usuarioSel && !!fechaInicio && !!fechaFin && !!tipoPermiso
    && notas.trim().length > 0

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

  // Buscar usuario interno por email al escribirlo
  useEffect(() => {
    if (!emailNuevo.trim()) { setUsuarioEncontradoEmail(null); return }
    const encontrado = usuarios.find(u =>
      u.email?.toLowerCase() === emailNuevo.trim().toLowerCase()
    )
    setUsuarioEncontradoEmail(encontrado ?? null)
  }, [emailNuevo, usuarios])

  function seleccionar(u) {
    setUsuarioSel(u); setDropdownOpen(false); setBusqueda(''); setModoCrear(false)
    setRutNuevo(''); setNombresNuevo(''); setApellidosNuevo(''); setEmailNuevo(''); setRolNuevo('')
    setUsuarioEncontrado(null); setUsuarioEncontradoEmail(null)
  }

  async function handleCrearUsuario() {
    setNuevoFE({})
    let ok = true
    if (!rutNuevo.trim()) { setNFE('rut', 'El RUT es requerido'); ok = false }
    else if (!validarRut(rutNuevo)) { setNFE('rut', 'RUT no válido'); ok = false }
    if (!nombresNuevo.trim()) { setNFE('nombres', 'Ingresa al menos 1 nombre'); ok = false }
    if (apellidosNuevo.trim().split(/\s+/).length < 2) { setNFE('apellidos', 'Ingresa al menos 2 apellidos'); ok = false }
    if (!emailNuevo.trim()) { setNFE('email', 'El correo es requerido'); ok = false }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNuevo.trim())) { setNFE('email', 'Correo no válido'); ok = false }
    if (!rolNuevo) { setNFE('rol', 'Selecciona un rol'); ok = false }
    if (!ok) return
    const nombre = `${nombresNuevo.trim()} ${apellidosNuevo.trim()}`.trim()
    const rut    = rutNuevo.trim()

    // Si el email coincide con un usuario interno, vincularlo y guardar su RUT
    const interno = usuarioEncontradoEmail ?? usuarios.find(u =>
      u.email?.toLowerCase() === emailNuevo.trim().toLowerCase()
    )
    if (interno) {
      if (!interno.rut && rut) {
        await supabase.from('usuarios').update({ rut }).eq('id', interno.id)
      }
      seleccionar({ ...interno, rut: interno.rut || rut })
      return
    }

    // Crear usuario real en el sistema vía edge function
    setCreandoUser(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crear-usuario`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ nombre, rut, email: emailNuevo.trim(), rol: rolNuevo }),
        }
      )
      const json = await res.json()
      if (!res.ok) {
        setNFE('server', json.error ?? 'Error al crear el usuario.')
        return
      }
      const nuevoUsuario = { ...json.usuario, rut }
      onUsuarioCreado(nuevoUsuario)
      seleccionar(nuevoUsuario)
    } catch {
      setNFE('server', 'No se pudo conectar al servidor.')
    } finally {
      setCreandoUser(false)
    }
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
        tipoPermiso,
        notas: notas.trim() || null,
        recordatorio: recordatorio ? diasRecord : null,
      })
      onClose?.()
    } catch (err) {
      setErrorGuardar(err.message === 'DUPLICADO'
        ? 'Este usuario ya tiene una ausencia en ese período de fechas.'
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
                <p className="mp-header-title">{isEdit ? 'Editar ausencia' : 'Registrar ausencia'}</p>
                <p className="mp-header-sub">
                  {usuarioActual?.nombre
                    ? <>Hola, <strong>{usuarioActual.nombre}</strong> — {isEdit ? 'modifica los datos de la ausencia.' : 'registra ausencias y días autorizados.'}</>
                    : isEdit ? 'Modifica los datos de la ausencia.' : 'Registra ausencias y días autorizados para usuarios.'}
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
                              style={nuevoFE.rut ? { borderColor: '#dc2626' } : {}}
                              onChange={e => { setRutNuevo(formatRut(e.target.value)); clearNFE('rut') }} />
                            {nuevoFE.rut && <span style={{ fontSize: 11, color: '#dc2626', marginTop: 2, display: 'block' }}>{nuevoFE.rut}</span>}

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
                                  <div>
                                    <input type="text" className="mp-input mp-input--sm" placeholder="Nombres"
                                      style={nuevoFE.nombres ? { borderColor: '#dc2626' } : {}}
                                      value={nombresNuevo} onChange={e => { setNombresNuevo(e.target.value); clearNFE('nombres') }} />
                                    {nuevoFE.nombres && <span style={{ fontSize: 11, color: '#dc2626', marginTop: 2, display: 'block' }}>{nuevoFE.nombres}</span>}
                                  </div>
                                  <div>
                                    <input type="text" className="mp-input mp-input--sm" placeholder="Apellidos"
                                      style={nuevoFE.apellidos ? { borderColor: '#dc2626' } : {}}
                                      value={apellidosNuevo} onChange={e => { setApellidosNuevo(e.target.value); clearNFE('apellidos') }} />
                                    {nuevoFE.apellidos && <span style={{ fontSize: 11, color: '#dc2626', marginTop: 2, display: 'block' }}>{nuevoFE.apellidos}</span>}
                                  </div>
                                </div>
                                <input type="email" className="mp-input mp-input--sm" placeholder="Correo electrónico *"
                                  style={nuevoFE.email ? { borderColor: '#dc2626' } : {}}
                                  value={emailNuevo} onChange={e => { setEmailNuevo(e.target.value); clearNFE('email') }} />
                                {nuevoFE.email && <span style={{ fontSize: 11, color: '#dc2626', marginTop: 2, display: 'block' }}>{nuevoFE.email}</span>}

                                <AnimatePresence>
                                  {usuarioEncontradoEmail && (
                                    <motion.div className="mp-rut-found"
                                      variants={slideV} initial="hidden" animate="visible" exit="exit">
                                      <div className="mp-rut-found-info">
                                        <div className="mp-avatar" style={{ background: getAvatarColor(usuarioEncontradoEmail.nombre), width: 26, height: 26, fontSize: 10 }}>
                                          {getInitials(usuarioEncontradoEmail.nombre)}
                                        </div>
                                        <div>
                                          <div className="mp-rut-found-name">{usuarioEncontradoEmail.nombre}</div>
                                          <div className="mp-rut-found-sub">Usuario registrado — se vinculará automáticamente</div>
                                        </div>
                                      </div>
                                      <button type="button" className="mp-btn-save mp-btn--sm"
                                        onClick={handleCrearUsuario}>
                                        Seleccionar
                                      </button>
                                    </motion.div>
                                  )}
                                </AnimatePresence>

                                {!usuarioEncontradoEmail && (
                                  <>
                                    <select className="mp-input mp-input--sm" value={rolNuevo}
                                      style={nuevoFE.rol ? { borderColor: '#dc2626' } : {}}
                                      onChange={e => { setRolNuevo(e.target.value); clearNFE('rol') }}>
                                      <option value="">Seleccionar rol *</option>
                                      {ROLES_ACTIVOS.map(({ value, label }) => (
                                        <option key={value} value={value}>{label}</option>
                                      ))}
                                    </select>
                                    {nuevoFE.rol && <span style={{ fontSize: 11, color: '#dc2626', marginTop: 2, display: 'block' }}>{nuevoFE.rol}</span>}
                                  </>
                                )}

                                {nuevoFE.server && (
                                  <div style={{ fontSize: 12, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '6px 10px' }}>
                                    {nuevoFE.server}
                                  </div>
                                )}
                                <div className="mp-new-user-actions">
                                  <button type="button" className="mp-btn-cancel mp-btn--sm" onClick={() => setModoCrear(false)}>Cancelar</button>
                                  {!usuarioEncontradoEmail && (
                                    <button type="button" className="mp-btn-save mp-btn--sm"
                                      disabled={!rutNuevo.trim() || !nombresNuevo.trim() || !apellidosNuevo.trim() || !emailNuevo.trim() || !rolNuevo || creandoUser}
                                      onClick={handleCrearUsuario}>
                                      {creandoUser ? 'Creando…' : 'Crear usuario'}
                                    </button>
                                  )}
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
                      <PermisoDots dias={permisosUsados} />
                    </motion.div>
                  )}
                  {cargandoPermisos && (
                    <motion.div variants={slideV} initial="hidden" animate="visible" exit="exit" style={{ marginTop: 8 }}>
                      <span className="mp-loading-text">Verificando ausencias…</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>

              {/* Tipo de permiso */}
              <section>
                <p className="mp-section-label">Tipo de ausencia</p>
                <select className="mp-select" value={tipoPermiso}
                  onChange={e => setTipoPermiso(e.target.value)}>
                  <option value="">Seleccionar tipo…</option>
                  {TIPOS_PERMISO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </section>

              {/* ── Panel visual compensatorios ── */}
              <AnimatePresence>
                {tipoPermiso === 'dias_compensatorios' && (
                  <motion.section
                    key="comp-panel"
                    variants={slideV} initial="hidden" animate="visible" exit="exit"
                  >
                    <p className="mp-section-label">Saldo compensatorio</p>

                    {/* Saldo + barra */}
                    <div style={{
                      background: 'rgba(99,102,241,0.05)',
                      border: '1.5px solid rgba(99,102,241,0.16)',
                      borderRadius: 11,
                      padding: '11px 13px',
                      marginBottom: 10,
                    }}>
                      {cargandoComp ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#94a3b8', fontSize: 12 }}>
                          <Loader2 size={13} className="animate-spin" /> Verificando saldo…
                        </div>
                      ) : (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: (saldoComp?.disponible ?? 0) > 0 ? 8 : 0 }}>
                            <span style={{ fontSize: 11.5, color: '#6366f1', fontWeight: 600 }}>Disponible</span>
                            <span style={{ fontSize: 15, fontWeight: 800, color: (saldoComp?.disponible ?? 0) > 0 ? '#4f46e5' : '#dc2626' }}>
                              {saldoComp ? fmtDias(saldoComp.disponible) : '0'} día{(saldoComp?.disponible ?? 0) !== 1 ? 's' : ''}
                            </span>
                          </div>
                          {(saldoComp?.disponible ?? 0) > 0 && (() => {
                            const pct = Math.min(100, Math.max(0,
                              ((saldoComp.disponible - diasCompAUsar) / saldoComp.disponible) * 100
                            ))
                            const overdrawn = diasCompAUsar > saldoComp.disponible
                            const barColor  = overdrawn ? '#dc2626'
                              : (saldoComp.disponible - diasCompAUsar) <= 0.5 ? '#f59e0b'
                              : '#6366f1'
                            return (
                              <>
                                <div style={{ height: 5, background: 'rgba(99,102,241,0.12)', borderRadius: 99, overflow: 'hidden' }}>
                                  <div style={{
                                    height: '100%', width: `${pct}%`,
                                    background: barColor, borderRadius: 99,
                                    transition: 'width 0.3s ease, background 0.2s',
                                  }} />
                                </div>
                                {diasCompAUsar > 0 && (
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: 11, color: '#94a3b8' }}>
                                    <span>Usando {fmtDias(diasCompAUsar)} día{diasCompAUsar !== 1 ? 's' : ''}</span>
                                    <span style={{ fontWeight: 600, color: overdrawn ? '#dc2626' : '#059669' }}>
                                      Restantes {fmtDias(Math.max(saldoComp.disponible - diasCompAUsar, 0))}
                                    </span>
                                  </div>
                                )}
                              </>
                            )
                          })()}
                          {(saldoComp?.disponible ?? 0) === 0 && (
                            <p style={{ margin: '3px 0 0', fontSize: 11.5, color: '#dc2626', fontWeight: 600 }}>
                              ⚠ Sin saldo disponible
                            </p>
                          )}
                        </>
                      )}
                    </div>

                    {/* Selección rápida */}
                    <p className="mp-field-label" style={{ marginBottom: 6 }}>Selección rápida</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 4 }}>
                      {[
                        { j: 'medio_dia',     label: 'Medio día',      sub: '½ día hábil',      autoFill: true  },
                        { j: 'dia_completo',  label: '1 día hábil',    sub: 'Jornada completa', autoFill: true  },
                        { j: 'personalizado', label: 'Personalizado',  sub: 'Definir horario',  autoFill: false },
                        { j: 'reposo',        label: 'Desde / Hasta',  sub: 'Rango de fechas',  autoFill: false },
                      ].map(opt => {
                        const active = jornada === opt.j
                        return (
                          <button
                            key={opt.j}
                            type="button"
                            onClick={() => {
                              setJornada(opt.j)
                              if (opt.autoFill) {
                                const hoy = new Date().toISOString().slice(0, 10)
                                if (!fechaInicio) { setFechaInicio(hoy); setFechaFin(hoy) }
                                else if (!fechaFin) setFechaFin(fechaInicio)
                              }
                            }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '9px 10px',
                              border: `1.5px solid ${active ? '#6366f1' : '#e2e8f0'}`,
                              borderRadius: 10,
                              background: active ? 'rgba(99,102,241,0.07)' : '#fafafa',
                              cursor: 'pointer', textAlign: 'left',
                              transition: 'border-color 0.15s, background 0.15s',
                              fontFamily: 'inherit',
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: 12.5, fontWeight: active ? 700 : 500, color: active ? '#4f46e5' : '#374151', lineHeight: 1.2 }}>
                                {opt.label}
                              </p>
                              <p style={{ margin: '1px 0 0', fontSize: 11, color: active ? '#6366f1' : '#94a3b8' }}>
                                {opt.sub}
                              </p>
                            </div>
                            {active && (
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1', flexShrink: 0 }} />
                            )}
                          </button>
                        )
                      })}
                    </div>

                    {/* Vista previa rápida (medio día / 1 día hábil) */}
                    <AnimatePresence>
                      {(jornada === 'medio_dia' || jornada === 'dia_completo') && fechaInicio && (
                        <motion.div
                          key="comp-preview"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto', transition: { duration: 0.15 } }}
                          exit={{ opacity: 0, height: 0, transition: { duration: 0.12 } }}
                          style={{ overflow: 'hidden' }}
                        >
                          <div style={{
                            background: '#f8fafc', border: '1px solid #e2e8f0',
                            borderRadius: 8, padding: '7px 12px',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            marginTop: 2,
                          }}>
                            <span style={{ fontSize: 11.5, color: '#64748b' }}>Vista previa</span>
                            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a' }}>
                              {jornada === 'medio_dia' ? '½ día' : '1 día hábil'} · {formatFecha(fechaInicio)}
                            </span>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* ── Sub-modo Personalizado: Días / Horas ── */}
                    <AnimatePresence>
                      {jornada === 'personalizado' && (
                        <motion.div
                          key="comp-submode"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto', transition: { duration: 0.15 } }}
                          exit={{ opacity: 0, height: 0, transition: { duration: 0.12 } }}
                          style={{ overflow: 'hidden', marginTop: 8 }}
                        >
                          {/* Toggle */}
                          <div style={{ display: 'flex', gap: 3, background: '#f1f5f9', borderRadius: 8, padding: 3, marginBottom: 10 }}>
                            {[{ k: 'dias', label: 'Días' }, { k: 'horas', label: 'Horas' }].map(opt => (
                              <button
                                key={opt.k}
                                type="button"
                                onClick={() => setCompSubMode(opt.k)}
                                style={{
                                  flex: 1, padding: '5px 0', border: 'none', borderRadius: 6,
                                  cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
                                  background: compSubMode === opt.k ? '#fff' : 'transparent',
                                  color: compSubMode === opt.k ? '#4f46e5' : '#94a3b8',
                                  boxShadow: compSubMode === opt.k ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                  transition: 'all 0.15s',
                                }}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>

                          {/* ── Modo Días ── */}
                          {compSubMode === 'dias' && (() => {
                            const numVal   = Math.max(parseFloat(compDiasInput) || 0, 0)
                            const enteros  = Math.floor(numVal)
                            const frac     = parseFloat((numVal - enteros).toFixed(2))
                            const fracLbl  = frac === 0.5 ? '½ día' : frac > 0 ? `~${Math.round(frac * 8)}h` : null
                            const distrib  = enteros > 0 && fracLbl ? `${enteros} día${enteros !== 1 ? 's' : ''} + ${fracLbl}` : null
                            const restantes = saldoComp ? Math.max(saldoComp.disponible - numVal, 0) : null
                            return (
                              <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                  <input
                                    type="number" min="0.5" step="0.5"
                                    value={compDiasInput}
                                    onChange={e => {
                                      const v = e.target.value
                                      setCompDiasInput(v)
                                      const n = parseFloat(v)
                                      if (!isNaN(n) && n > 0) {
                                        const totalMin = Math.round(n * 8 * 60)
                                        const hh = String(Math.floor(totalMin / 60)).padStart(2, '0')
                                        const mm = String(totalMin % 60).padStart(2, '0')
                                        setHoraInicio('00:00')
                                        setHoraFin(`${hh}:${mm}`)
                                        if (!fechaInicio) {
                                          const hoy = new Date().toISOString().slice(0, 10)
                                          setFechaInicio(hoy); setFechaFin(hoy)
                                        }
                                      } else {
                                        setHoraInicio('00:00'); setHoraFin('00:00')
                                      }
                                    }}
                                    placeholder="ej: 1.5"
                                    className="mp-input"
                                    style={{ width: 88, textAlign: 'center', fontSize: 16, fontWeight: 700 }}
                                  />
                                  <span style={{ fontSize: 13, color: '#475569' }}>días</span>
                                </div>
                                {numVal > 0 && (
                                  <div style={{
                                    background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.12)',
                                    borderRadius: 8, padding: '8px 10px',
                                  }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                      <span style={{ color: '#6366f1', fontWeight: 600 }}>
                                        Usarás {fmtDias(numVal)} día{numVal !== 1 ? 's' : ''}
                                      </span>
                                      {restantes !== null && (
                                        <span style={{ fontWeight: 600, color: restantes === 0 ? '#dc2626' : '#059669' }}>
                                          Restan {fmtDias(restantes)}
                                        </span>
                                      )}
                                    </div>
                                    {distrib && (
                                      <p style={{ margin: '3px 0 0', fontSize: 11, color: '#94a3b8' }}>{distrib}</p>
                                    )}
                                  </div>
                                )}
                              </>
                            )
                          })()}

                          {/* ── Modo Horas ── */}
                          {compSubMode === 'horas' && (
                            <>
                              <p style={{ margin: '0 0 6px', fontSize: 11.5, color: '#94a3b8' }}>
                                Configura el horario en la sección de período ↓
                              </p>
                              {diasCompAUsar > 0 && saldoComp && (
                                <div style={{
                                  background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.12)',
                                  borderRadius: 8, padding: '8px 10px',
                                }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                    <span style={{ color: '#6366f1', fontWeight: 600 }}>
                                      ~{Math.round(diasCompAUsar * 8)}h · {fmtDias(diasCompAUsar)} días
                                    </span>
                                    <span style={{ fontWeight: 600, color: (saldoComp.disponible - diasCompAUsar) <= 0 ? '#dc2626' : '#059669' }}>
                                      Restan {fmtDias(Math.max(saldoComp.disponible - diasCompAUsar, 0))}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.section>
                )}
              </AnimatePresence>

              {/* Período */}
              <section>
                <p className="mp-section-label">Período de ausencia</p>
                <div className="mp-date-row" style={{ marginBottom: 12 }}>
                  <div className="mp-field-group">
                    <label className="mp-field-label">Fecha inicio</label>
                    <CalendarioFeriados
                      value={fechaInicio} onChange={setFechaInicio}
                      inhabilitados={diasInhabilitados} etiquetas={feriadosLabels}
                      placeholder="Seleccionar…"
                    />
                  </div>
                  <div className="mp-field-group">
                    <label className="mp-field-label">Fecha fin</label>
                    <CalendarioFeriados
                      value={fechaFin} onChange={setFechaFin}
                      min={fechaInicio}
                      inhabilitados={diasInhabilitados} etiquetas={feriadosLabels}
                      placeholder="Seleccionar…"
                    />
                  </div>
                </div>
                {tipoPermiso !== 'dias_compensatorios' && (
                  <div className="mp-jornada-pills">
                    {JORNADAS.map(j => (
                      <button key={j.value} type="button" className={`mp-jornada-pill ${jornada === j.value ? 'active' : ''}`}
                        onClick={() => setJornada(j.value)}>{j.label}</button>
                    ))}
                  </div>
                )}
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
                  {jornada === 'personalizado' && !(tipoPermiso === 'dias_compensatorios' && compSubMode === 'dias') && (
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

              {/* Notas — obligatorias */}
              <section>
                <p className="mp-section-label">
                  {tipoPermiso === 'licencia_medica'
                    ? 'Motivo de la licencia médica'
                    : tipoPermiso === 'permiso_administrativo'
                      ? 'Motivo del permiso administrativo'
                      : tipoPermiso === 'justificativo'
                        ? 'Motivo de la ausencia sin justificar'
                        : tipoPermiso === 'dias_compensatorios'
                          ? 'Motivo del uso de compensatorios'
                          : 'Motivo'}
                  {' '}<span style={{ color: '#ef4444', fontWeight: 700 }}>*</span>
                </p>
                <textarea className="mp-textarea"
                  placeholder={
                    tipoPermiso === 'licencia_medica'
                      ? 'Ej: Consulta médica / reposo prescrito…'
                      : tipoPermiso === 'permiso_administrativo'
                        ? 'Ej: Trámite notarial, actividad institucional…'
                        : tipoPermiso === 'justificativo'
                          ? 'Ej: Justificación de inasistencia…'
                          : tipoPermiso === 'dias_compensatorios'
                            ? 'Ej: Uso de días ganados por desfile 18 sept…'
                            : 'Escribe el motivo de la ausencia…'
                  }
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
                    <span className="mp-checkbox-label">Recordar antes del inicio de la ausencia</span>
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
              <p className="mp-summary-title">Resumen de la ausencia</p>

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
                      <>
                        <div className="mp-summary-row">
                          <span className="mp-summary-label">Cuota este año</span>
                          <span className="mp-summary-value" style={{ color: getAusenciaColors(permisosUsados).text }}>
                            {fmtDias(permisosUsados)}/{MAX_AUSENCIAS} días
                          </span>
                        </div>
                        <div className="mp-quota-wrap">
                          <div className="mp-quota-bar">
                            <div className="mp-quota-fill" style={{
                              width: `${Math.min((permisosUsados / MAX_AUSENCIAS) * 100, 100)}%`,
                              background: permisosUsados >= MAX_AUSENCIAS ? '#dc2626'
                                : Math.max(MAX_AUSENCIAS - permisosUsados, 0) <= 1 ? '#ea580c'
                                : Math.max(MAX_AUSENCIAS - permisosUsados, 0) <= 2 ? '#d97706'
                                : '#6366f1',
                            }} />
                          </div>
                          <div className="mp-quota-row">
                            <span style={{ color: '#94a3b8' }}>
                              {permisosUsados === 0 ? 'Sin ausencias registradas' : `${fmtDias(permisosUsados)} usados`}
                            </span>
                            <span style={{ color: getAusenciaColors(permisosUsados).text, fontWeight: 600 }}>
                              {permisosUsados >= MAX_AUSENCIAS
                                ? 'Cuota agotada'
                                : `${fmtDias(Math.max(MAX_AUSENCIAS - permisosUsados, 0))} disponibles`}
                            </span>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Saldo compensatorio */}
                    {tipoPermiso === 'dias_compensatorios' && (
                      <AnimatePresence>
                        <motion.div
                          key="comp-saldo"
                          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          style={{ marginTop: 10, background: 'rgba(79,70,229,0.07)', border: '1.5px solid rgba(99,102,241,0.2)',
                            borderRadius: 12, padding: '12px 14px' }}
                        >
                          <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, color: '#6366f1',
                            textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                            🎁 Saldo compensatorio
                          </p>
                          {cargandoComp ? (
                            <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>Cargando saldo…</p>
                          ) : (
                            <>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                                <span style={{ color: '#475569' }}>Disponible</span>
                                <span style={{ fontWeight: 700, color: '#4f46e5' }}>
                                  {saldoComp ? fmtDias(saldoComp.disponible) : '—'} día{saldoComp?.disponible !== 1 ? 's' : ''}
                                </span>
                              </div>
                              {diasCompAUsar > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                                  <span style={{ color: '#475569' }}>A descontar</span>
                                  <span style={{ fontWeight: 700, color: '#dc2626' }}>
                                    −{fmtDias(diasCompAUsar)} día{diasCompAUsar !== 1 ? 's' : ''}
                                  </span>
                                </div>
                              )}
                              {saldoComp && diasCompAUsar > 0 && (
                                <>
                                  <div style={{ height: 1, background: 'rgba(99,102,241,0.15)', margin: '6px 0' }} />
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                                    <span style={{ fontWeight: 600, color: '#374151' }}>Restante</span>
                                    <span style={{ fontWeight: 800,
                                      color: (saldoComp.disponible - diasCompAUsar) < 0 ? '#dc2626' : '#059669' }}>
                                      {Math.max(saldoComp.disponible - diasCompAUsar, 0) === 0.5
                                        ? '½'
                                        : Math.max(saldoComp.disponible - diasCompAUsar, 0).toFixed(1).replace('.0', '')} día{Math.max(saldoComp.disponible - diasCompAUsar, 0) !== 1 ? 's' : ''}
                                    </span>
                                  </div>
                                  {saldoComp.disponible < diasCompAUsar && (
                                    <p style={{ margin: '6px 0 0', fontSize: 11.5, color: '#dc2626', fontWeight: 600 }}>
                                      ⚠ Saldo insuficiente para este período
                                    </p>
                                  )}
                                </>
                              )}
                            </>
                          )}
                        </motion.div>
                      </AnimatePresence>
                    )}

                    {duracion && (
                      <div style={{ paddingTop: 6 }}>
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
                <p className="mp-info-text">Durante este período, el usuario se marcará con ausencia en el sistema.</p>
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
                : <><Save size={14} strokeWidth={2.5} />{isEdit ? 'Guardar cambios' : 'Guardar ausencia'}</>}
            </button>
          </div>

        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ── DiaRow ─────────────────────────────────────────────────────────────────

function DiaRow({ item, isEditing, editFecha, editMotivo, onStartEdit, onEditFecha, onEditMotivo, onSaveEdit, onCancelEdit, onEliminar, guardandoEdit, confirmando, onPedirConfirm, onCancelConfirm }) {
  const esAPI = item.origen === 'api'
  return (
    <div className="inh-row">
      {isEditing ? (
        <>
          <input type="date" className="mp-input"
            style={{ width: 126, padding: '3px 7px', fontSize: 12, height: 28, flexShrink: 0 }}
            value={editFecha} onChange={e => onEditFecha(e.target.value)} />
          <input className="mp-input"
            style={{ flex: 1, padding: '3px 8px', fontSize: 12.5, height: 28, minWidth: 0 }}
            value={editMotivo} onChange={e => onEditMotivo(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter')  onSaveEdit(item.fecha, editFecha, editMotivo, item.origen)
              if (e.key === 'Escape') onCancelEdit()
            }} autoFocus />
          <button className="inh-btn-ok" onClick={() => onSaveEdit(item.fecha, editFecha, editMotivo, item.origen)} disabled={guardandoEdit || !editFecha}>✓</button>
          <button className="inh-btn-x" onClick={onCancelEdit}>✕</button>
        </>
      ) : confirmando ? (
        <>
          <span style={{ flex: 1, fontSize: 12, color: '#6b7280' }}>
            ¿Eliminar <strong style={{ color: '#374151' }}>{item.motivo}</strong>?
          </span>
          <button className="inh-btn-x" onClick={onCancelConfirm} style={{ fontSize: 12, padding: '3px 8px' }}>No</button>
          <button className="inh-btn-ok inh-btn-ok--danger" onClick={() => onEliminar(item.fecha)}>Eliminar</button>
        </>
      ) : (
        <>
          <span className={`inh-chip ${esAPI ? 'inh-chip--api' : 'inh-chip--admin'}`}>
            {formatFecha(item.fecha)}
          </span>
          <span className="inh-row-name">{item.motivo}</span>
          <div className="inh-row-actions">
            <button className="inh-action-btn" title="Editar" onClick={() => onStartEdit(item.fecha, item.motivo)}>
              <Pencil size={11} strokeWidth={2} />
            </button>
            <button className="inh-action-btn inh-action-btn--danger" title="Eliminar" onClick={onPedirConfirm}>
              <Trash2 size={11} strokeWidth={2} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── ModalDiasInhabilitados ─────────────────────────────────────────────────

function ModalDiasInhabilitados({ feriadosAPI, diasAdmin, cargandoAPI, onClose, onAgregar, onEliminar, onEditar }) {
  const [mostrarForm, setMostrarForm] = useState(false)
  const [nuevaFecha,  setNuevaFecha]  = useState('')
  const [nuevaFechaHasta, setNuevaFechaHasta] = useState('')
  const [nuevoMotivo, setNuevoMotivo] = useState('')
  const [guardando,   setGuardando]   = useState(false)
  const [errGuardar,  setErrGuardar]  = useState('')
  const [editando,    setEditando]    = useState(null)   // fecha original siendo editada
  const [editFecha,   setEditFecha]   = useState('')     // nueva fecha (puede cambiar)
  const [editMotivo,  setEditMotivo]  = useState('')
  const [guardandoEdit, setGuardandoEdit] = useState(false)
  const [confirmarEliminar, setConfirmarEliminar] = useState(null) // fecha del item a eliminar

  const year  = new Date().getFullYear()
  const total = feriadosAPI.length + diasAdmin.length

  // Set y mapa para el CalendarioFeriados dentro del form
  const inhabSet = new Set([...feriadosAPI.map(f => f.fecha), ...diasAdmin.map(d => d.fecha)])
  const etiqMap  = new Map([
    ...feriadosAPI.map(f => [f.fecha, f.motivo]),
    ...diasAdmin.map(d  => [d.fecha, d.motivo]),
  ])

  async function handleAgregar() {
    if (!nuevaFecha || !nuevoMotivo.trim()) return
    setGuardando(true); setErrGuardar('')
    try {
      await onAgregar(nuevaFecha, nuevoMotivo.trim(), nuevaFechaHasta || null)
      setNuevaFecha(''); setNuevaFechaHasta(''); setNuevoMotivo(''); setMostrarForm(false)
    } catch { setErrGuardar('No se pudo guardar. Intenta de nuevo.') }
    finally  { setGuardando(false) }
  }

  async function handleSaveEdit(fechaOriginal, nuevaFecha, nuevoMotivo, origen) {
    if (!nuevoMotivo.trim() || !nuevaFecha) return
    setGuardandoEdit(true)
    try { await onEditar(fechaOriginal, nuevaFecha, nuevoMotivo.trim(), origen); setEditando(null) }
    catch {} finally { setGuardandoEdit(false) }
  }

  const colStyle = { display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }
  const headStyle = {
    padding: '14px 18px 10px',
    borderBottom: '1px solid #f1f5f9',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8,
  }

  return (
    <AnimatePresence>
      <motion.div className="mp-overlay" variants={overlayV} initial="hidden" animate="visible" exit="exit"
        onClick={e => { if (e.target === e.currentTarget) onClose?.() }}>
        <motion.div className="mp-modal" variants={modalV} initial="hidden" animate="visible" exit="exit"
          style={{ maxWidth: 700, width: '95vw' }}>

          {/* ── Header ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CalendarCheck size={17} strokeWidth={2} style={{ color: '#475569' }} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>
                  Días inhabilitados {year}
                </p>
                <p style={{ margin: '1px 0 0', fontSize: 12.5, color: '#94a3b8' }}>
                  {total > 0 ? `${total} días configurados` : 'Sin días configurados'} · feriados y días especiales
                </p>
              </div>
            </div>
            <button className="mp-close-btn" onClick={onClose}><X size={16} strokeWidth={2.5} /></button>
          </div>

          {/* ── Body 2 cols ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: '52vh', borderBottom: '1px solid #f1f5f9' }}>

            {/* LEFT: Feriados oficiales */}
            <div style={{ ...colStyle, borderRight: '1px solid #f1f5f9' }}>
              <div style={headStyle}>
                <div>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Feriados oficiales</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11.5, color: '#cbd5e1' }}>Chile {year} · nager.date</p>
                </div>
              </div>
              <div style={{ overflowY: 'auto', flex: 1, padding: '6px 10px' }}>
                {cargandoAPI ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8', fontSize: 13, padding: '12px 4px' }}>
                    <Loader2 size={14} className="animate-spin" /> Cargando…
                  </div>
                ) : feriadosAPI.length === 0 ? (
                  <p style={{ fontSize: 13, color: '#cbd5e1', padding: '12px 4px', margin: 0 }}>Sin datos disponibles.</p>
                ) : (
                  feriadosAPI.map(f => (
                    <DiaRow key={f.fecha} item={f}
                      isEditing={editando === f.fecha} editFecha={editFecha} editMotivo={editMotivo}
                      onStartEdit={(fecha, mot) => { setEditando(fecha); setEditFecha(fecha); setEditMotivo(mot) }}
                      onEditFecha={setEditFecha} onEditMotivo={setEditMotivo}
                      onSaveEdit={handleSaveEdit} onCancelEdit={() => setEditando(null)}
                      onEliminar={onEliminar} guardandoEdit={guardandoEdit}
                      confirmando={confirmarEliminar === f.fecha}
                      onPedirConfirm={() => setConfirmarEliminar(f.fecha)}
                      onCancelConfirm={() => setConfirmarEliminar(null)}
                    />
                  ))
                )}
              </div>
            </div>

            {/* RIGHT: Días especiales */}
            <div style={{ ...colStyle }}>
              <div style={headStyle}>
                <div>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Días especiales</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11.5, color: '#cbd5e1' }}>Puentes, días del colegio, etc.</p>
                </div>
                {!mostrarForm && (
                  <button onClick={() => setMostrarForm(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#0f172a', color: '#fff', border: 'none', borderRadius: 7, padding: '5px 11px', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0, letterSpacing: '-0.01em' }}>
                    <Plus size={11} strokeWidth={2.5} /> Agregar
                  </button>
                )}
              </div>
              <div style={{ overflowY: 'auto', flex: 1, padding: '6px 10px' }}>
                {diasAdmin.length === 0 && !mostrarForm ? (
                  <div style={{ padding: '20px 4px', textAlign: 'center' }}>
                    <p style={{ fontSize: 12.5, color: '#cbd5e1', margin: '0 0 10px' }}>Sin días especiales registrados.</p>
                    <button onClick={() => setMostrarForm(true)}
                      style={{ background: 'none', border: '1.5px dashed #e2e8f0', borderRadius: 8, padding: '6px 16px', fontSize: 12, color: '#94a3b8', cursor: 'pointer', fontFamily: 'inherit' }}>
                      + Agregar el primero
                    </button>
                  </div>
                ) : (
                  <>
                    {diasAdmin.map(d => (
                      <DiaRow key={d.fecha} item={d}
                        isEditing={editando === d.fecha} editFecha={editFecha} editMotivo={editMotivo}
                        onStartEdit={(fecha, mot) => { setEditando(fecha); setEditFecha(fecha); setEditMotivo(mot) }}
                        onEditFecha={setEditFecha} onEditMotivo={setEditMotivo}
                        onSaveEdit={handleSaveEdit} onCancelEdit={() => setEditando(null)}
                        onEliminar={onEliminar} guardandoEdit={guardandoEdit}
                        confirmando={confirmarEliminar === d.fecha}
                        onPedirConfirm={() => setConfirmarEliminar(d.fecha)}
                        onCancelConfirm={() => setConfirmarEliminar(null)}
                      />
                    ))}

                    {/* Form agregar */}
                    <AnimatePresence>
                      {mostrarForm && (
                        <motion.div variants={slideV} initial="hidden" animate="visible" exit="exit"
                          style={{ padding: '12px 6px', borderTop: diasAdmin.length > 0 ? '1px solid #f1f5f9' : 'none', marginTop: diasAdmin.length > 0 ? 4 : 0 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div>
                              <label className="mp-field-label" style={{ display: 'block', marginBottom: 4 }}>Desde</label>
                              <CalendarioFeriados
                                value={nuevaFecha}
                                onChange={(f) => { setNuevaFecha(f); if (nuevaFechaHasta && nuevaFechaHasta < f) setNuevaFechaHasta('') }}
                                inhabilitados={inhabSet} etiquetas={etiqMap}
                                placeholder="Seleccionar fecha…"
                              />
                            </div>
                            <div>
                              <label className="mp-field-label" style={{ display: 'block', marginBottom: 4 }}>
                                Hasta <span style={{ color: '#cbd5e1', fontWeight: 400 }}>(opcional)</span>
                              </label>
                              <CalendarioFeriados
                                value={nuevaFechaHasta} onChange={setNuevaFechaHasta}
                                min={nuevaFecha}
                                inhabilitados={inhabSet} etiquetas={etiqMap}
                                placeholder="Mismo día si lo dejas vacío…"
                              />
                            </div>
                            <div>
                              <label className="mp-field-label" style={{ display: 'block', marginBottom: 4 }}>Motivo</label>
                              <input type="text" className="mp-input"
                                placeholder="Ej: Vacaciones de invierno, Día puente…"
                                value={nuevoMotivo} onChange={e => setNuevoMotivo(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleAgregar() }} />
                            </div>
                            {errGuardar && <span style={{ fontSize: 12, color: '#dc2626' }}>{errGuardar}</span>}
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => { setMostrarForm(false); setNuevaFecha(''); setNuevaFechaHasta(''); setNuevoMotivo(''); setErrGuardar('') }}
                                style={{ flex: 1, background: 'none', border: '1px solid #e2e8f0', borderRadius: 7, padding: '7px 0', fontSize: 12.5, color: '#64748b', cursor: 'pointer', fontFamily: 'inherit' }}>
                                Cancelar
                              </button>
                              <button onClick={handleAgregar}
                                disabled={!nuevaFecha || !nuevoMotivo.trim() || guardando}
                                style={{ flex: 2, background: '#0f172a', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 0', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: (!nuevaFecha || !nuevoMotivo.trim() || guardando) ? 0.45 : 1 }}>
                                {guardando ? 'Guardando…' : 'Guardar día'}
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}
              </div>
            </div>

          </div>

          {/* ── Footer ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px' }}>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>
              {total} {total === 1 ? 'día inhabilitado' : 'días inhabilitados'} en {year}
            </span>
            <button className="mp-btn-cancel" onClick={onClose}>Cerrar</button>
          </div>

        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ── Permisos (página) ──────────────────────────────────────────────────────

export default function Permisos({ usuario, permisos: permisosAcceso = {}, modoMisAusencias = false }) {
  const esAdmin         = usuario.rol === 'admin'
  // En modoMisAusencias nunca se permite gestión global
  const puedeGestionar  = !modoMisAusencias && (permisosAcceso.gestionar !== undefined ? permisosAcceso.gestionar : esAdmin)
  const [usuarios,        setUsuarios]        = useState([])
  const [permisos,        setPermisos]        = useState([])
  const [cargando,        setCargando]        = useState(true)
  const [modalAbierto,    setModalAbierto]    = useState(false)
  const [permisoVer,      setPermisoVer]      = useState(null)
  const [permisoEditar,   setPermisoEditar]   = useState(null)
  const [permisoEliminar, setPermisoEliminar] = useState(null)
  const [eliminando,      setEliminando]      = useState(false)
  const [errorEliminar,   setErrorEliminar]   = useState('')
  const [busqueda,        setBusqueda]        = useState('')
  const [filtroTipo,      setFiltroTipo]      = useState('')
  const [filtroRol,       setFiltroRol]       = useState('')
  const [expandidos,      setExpandidos]      = useState(new Set()) // keys de grupos abiertos
  const [paginaP,         setPaginaP]         = useState(1)
  const [seleccionados,   setSeleccionados]   = useState(new Set()) // IDs de ausencias seleccionadas para exportar
  const [exportMenuOpen,  setExportMenuOpen]  = useState(false)
  const exportMenuRef = useRef(null)

  // ── Días inhabilitados (feriados + puentes) ────────────────────────────
  const [diasInhabilitados,  setDiasInhabilitados]  = useState(new Set())
  const [feriadosAPI,        setFeriadosAPI]        = useState([])   // [{fecha, nombre}]
  const [diasAdmin,          setDiasAdmin]          = useState([])   // rows de DB
  const [cargandoAPI,        setCargandoAPI]        = useState(false)
  const [modalInhabilitados, setModalInhabilitados] = useState(false)
  const [emailNotif,         setEmailNotif]         = useState(null) // null | 'ok' | 'error'

  function toggleColapso(key) {
    setExpandidos(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function toggleSeleccion(id) {
    setSeleccionados(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Cierra el menú de exportación al hacer click fuera
  useEffect(() => {
    function handler(e) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) setExportMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Limpia selección al cambiar filtros o página
  useEffect(() => { setSeleccionados(new Set()) }, [busqueda, filtroTipo, filtroRol, paginaP])

  useEffect(() => { cargarDatos(); cargarDiasInhabilitados() }, [])

  async function cargarDatos() {
    setCargando(true)

    if (modoMisAusencias) {
      // Obtener datos frescos del usuario desde la BD (el RUT puede haber sido
      // asignado después de iniciar sesión, así que no confiamos en usuario.rut)
      const { data: freshUser } = await supabase
        .from('usuarios')
        .select('id, rut, nombre, email, rol')
        .eq('id', usuario.id)
        .maybeSingle()

      const rutRaw      = freshUser?.rut ?? usuario.rut ?? null
      const rutNorm     = normRut(rutRaw ?? '')
      const rutFormated = rutNorm ? formatRut(rutNorm) : null
      // Cubrir todos los formatos posibles en DB: '20.469.215-7', '20469215-7', '204692157'
      const rutFormatos = [...new Set([rutRaw, rutNorm || null, rutFormated].filter(Boolean))]

      // 1. Todos los IDs con el mismo RUT normalizado (cualquier formato en DB)
      const { data: todosUs } = await supabase.from('usuarios').select('id, rut')
      const allIds = [...new Set([
        usuario.id,
        ...(rutNorm ? (todosUs ?? [])
          .filter(u => normRut(u.rut ?? '') === rutNorm)
          .map(u => u.id) : []),
      ])]

      // 2. Consultas en paralelo: usuario_id, externo_rut, snapshot_rut
      //    Se usan .in() con ambos formatos de RUT para máxima compatibilidad
      const sel = '*, usuario:usuario_id(id, nombre, email, rol, rut)'
      const consultas = [
        supabase.from('ausencias').select(sel)
          .in('usuario_id', allIds)
          .order('fecha_inicio', { ascending: false }),
        ...(rutFormatos.length ? [
          supabase.from('ausencias').select(sel).in('externo_rut',  rutFormatos),
          supabase.from('ausencias').select(sel).in('snapshot_rut', rutFormatos),
        ] : []),
      ]
      const resultados = await Promise.all(consultas)

      // 3. Unir, deduplicar por ID y ordenar por fecha desc
      const vistos = new Set()
      const allPermisos = resultados
        .flatMap(r => r.data ?? [])
        .filter(p => { if (vistos.has(p.id)) return false; vistos.add(p.id); return true })
        .sort((a, b) => (b.fecha_inicio ?? '').localeCompare(a.fecha_inicio ?? ''))

      setUsuarios([freshUser ?? usuario])
      setPermisos(allPermisos)
      setCargando(false)
      return
    }

    let { data: us, error: usErr } = await supabase
      .from('usuarios').select('id, nombre, email, rol, rut').order('nombre')
    if (usErr) {
      ;({ data: us } = await supabase
        .from('usuarios').select('id, nombre, email, rol').order('nombre'))
    }
    const { data: ps } = await supabase
      .from('ausencias')
      .select('*, usuario:usuario_id(id, nombre, email, rol, rut)')
      .order('fecha_inicio', { ascending: false })
    setUsuarios(us ?? [])
    setPermisos(ps ?? [])
    setCargando(false)
  }

  async function cargarDiasInhabilitados() {
    setCargandoAPI(true)
    const year = new Date().getFullYear()

    // 1. Fechas ya en DB para este año
    const { data: dbRows } = await supabase
      .from('dias_inhabilitados').select('fecha')
      .gte('fecha', `${year}-01-01`).lte('fecha', `${year}-12-31`)
    const dbFechas = new Set((dbRows ?? []).map(r => r.fecha))

    // 2. Sync feriados oficiales → DB (solo los nuevos, no re-inserta borrados)
    try {
      const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/CL`)
      if (res.ok) {
        const apiData = await res.json()
        const nuevos = apiData
          .filter(f => !dbFechas.has(f.date))
          .map(f => ({ fecha: f.date, motivo: f.localName, origen: 'api' }))
        if (nuevos.length > 0) {
          await supabase.from('dias_inhabilitados').insert(nuevos)
        }
      }
    } catch (e) { console.warn('API feriados no disponible:', e) }

    // 3. DB como fuente de verdad
    const { data: allRows } = await supabase
      .from('dias_inhabilitados').select('*').order('fecha')
    const rows = allRows ?? []

    setFeriadosAPI(rows.filter(r => r.origen === 'api'))
    setDiasAdmin(rows.filter(r => r.origen === 'admin'))
    setDiasInhabilitados(new Set(rows.map(r => r.fecha)))
    setCargandoAPI(false)
  }

  async function handleAgregarDia(fecha, motivo, fechaHasta) {
    const { data: sessionData } = await supabase.auth.getSession()
    const uid = sessionData?.session?.user?.id ?? null
    // Construir el rango desde→hasta (un registro por día). Si no hay "hasta", un solo día.
    const fin = (fechaHasta && fechaHasta >= fecha) ? fechaHasta : fecha
    const rows = []
    const cur = new Date(fecha + 'T12:00:00')
    const end = new Date(fin   + 'T12:00:00')
    while (cur <= end) {
      rows.push({ fecha: cur.toISOString().slice(0, 10), motivo, origen: 'admin', creado_por: uid })
      cur.setDate(cur.getDate() + 1)
    }
    const { error } = await supabase
      .from('dias_inhabilitados')
      .upsert(rows, { onConflict: 'fecha' })
    if (error) throw error
    await cargarDiasInhabilitados()
  }

  async function handleEliminarDia(fecha) {
    const { error } = await supabase.from('dias_inhabilitados').delete().eq('fecha', fecha)
    if (error) throw error
    await cargarDiasInhabilitados()
  }

  async function handleEditarDia(fechaOriginal, nuevaFecha, nuevoMotivo, origen) {
    if (fechaOriginal !== nuevaFecha) {
      // La fecha cambió: delete + insert (fecha es PK)
      const { error: delErr } = await supabase
        .from('dias_inhabilitados').delete().eq('fecha', fechaOriginal)
      if (delErr) throw delErr
      const { error: insErr } = await supabase
        .from('dias_inhabilitados').insert({ fecha: nuevaFecha, motivo: nuevoMotivo, origen })
      if (insErr) throw insErr
    } else {
      // Solo cambió el motivo
      const { error } = await supabase
        .from('dias_inhabilitados').update({ motivo: nuevoMotivo }).eq('fecha', fechaOriginal)
      if (error) throw error
    }
    await cargarDiasInhabilitados()
  }

  async function handleGetPermisosUsados(userId, rut) {
    const year  = new Date().getFullYear()
    const desde = `${year}-01-01`
    const hasta = `${year}-12-31`
    const cols  = 'jornada, fecha_inicio, fecha_fin, hora_inicio, hora_fin, tipo'

    // IDs que comparten el mismo RUT
    let userIds = userId ? [userId] : []
    if (rut) {
      const { data: mismoRut } = await supabase.from('usuarios').select('id').eq('rut', rut)
      if (mismoRut?.length) userIds = [...new Set([...userIds, ...mismoRut.map(u => u.id)])]
    }

    let rows = []

    if (userIds.length) {
      const { data } = await supabase.from('ausencias').select(cols)
        .in('usuario_id', userIds).gte('fecha_inicio', desde).lte('fecha_inicio', hasta)
      if (data) rows = [...rows, ...data]
    }
    if (rut) {
      const { data } = await supabase.from('ausencias').select(cols)
        .eq('externo_rut', rut).gte('fecha_inicio', desde).lte('fecha_inicio', hasta)
      if (data) rows = [...rows, ...data]
    }

    return calcDiasTotales(rows, true, diasInhabilitados) // solo tipos que descuentan cupo, solo días hábiles
  }

  function handleUsuarioCreado(nuevoUsuario) {
    setUsuarios(prev => [...prev, nuevoUsuario])
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
      // Snapshot para recuperar si el usuario es borrado (el RUT manda)
      snapshot_rut:    u?.isExterno ? null : (u?.rut ?? null),
      snapshot_nombre: u?.isExterno ? null : (u?.nombre ?? null),
      fecha_inicio:   datos.fechaInicio,
      fecha_fin:      datos.fechaFin,
      jornada:        datos.jornada,
      periodo:        datos.periodo,
      hora_inicio:    datos.horaInicio,
      hora_fin:       datos.horaFin,
      tipo:           datos.tipoPermiso,
      notas:          datos.notas || null,
      recordatorio:   datos.recordatorio,
    }

    let error
    if (datos.id) {
      ;({ error } = await supabase.from('ausencias').update(payload).eq('id', datos.id))
    } else {
      ;({ error } = await supabase.from('ausencias').insert(payload))
    }
    if (error) throw error

    // Descontar saldo compensatorio si aplica (ausencia nueva)
    if (!datos.id && datos.tipoPermiso === 'dias_compensatorios') {
      const uid = u?.isExterno ? null : (u?.id ?? null)
      if (uid) {
        let diasADescontar = 0
        if (datos.jornada === 'medio_dia') {
          diasADescontar = 0.5
        } else if (datos.jornada === 'personalizado' && datos.horaInicio && datos.horaFin) {
          const [sh, sm] = datos.horaInicio.split(':').map(Number)
          const [eh, em] = datos.horaFin.split(':').map(Number)
          diasADescontar = Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60 / 8)
        } else {
          diasADescontar = diasHabiles(datos.fechaInicio, datos.fechaFin, diasInhabilitados)
        }
        if (diasADescontar > 0) {
          const rut      = u?.isExterno ? null : (u?.rut ?? null)
          const extraIds = rut
            ? usuarios.filter(usr => usr.rut && normRut(usr.rut) === normRut(rut) && usr.id !== uid).map(usr => usr.id)
            : []
          try { await descontarCompensatorios(uid, diasADescontar, extraIds) } catch (e) { console.error('[compensatorios] error al descontar:', e) }
        }
      }
    }

    // ── Correos en ausencias nuevas ───────────────────────────────────────
    if (!datos.id) {
      const correoSolicitante = u?.email ?? null
      const nombrePersona     = u?.nombre ?? 'usuario'

      // Detalle común de la ausencia
      const detalle = {
        tipo:        datos.tipoPermiso,
        fechaInicio: datos.fechaInicio,
        fechaFin:    datos.fechaFin,
        jornada:     datos.jornada,
        periodo:     datos.periodo ?? null,
        horaInicio:  datos.horaInicio ?? null,
        horaFin:     datos.horaFin ?? null,
        notas:       datos.notas ?? null,
      }

      // 1) Correo al SOLICITANTE (todos los tipos)
      if (correoSolicitante) {
        if (datos.tipoPermiso === 'permiso_administrativo') {
          // Permiso administrativo conserva su correo con cuota de días
          let diasRestantes = null
          try {
            const diasUsados = await handleGetPermisosUsados(u?.id ?? null, u?.rut ?? null)
            diasRestantes = Math.max(MAX_AUSENCIAS - diasUsados, 0)
          } catch { /* se envía igual */ }
          try {
            const { error: fnError } = await supabase.functions.invoke('notify-permiso-administrativo', {
              body: {
                correo: correoSolicitante, nombre: nombrePersona,
                fechaInicio: datos.fechaInicio, fechaFin: datos.fechaFin,
                jornada: datos.jornada, periodo: datos.periodo ?? null,
                horaInicio: datos.horaInicio ?? null, horaFin: datos.horaFin ?? null,
                notas: datos.notas ?? null, diasRestantes, maxDias: MAX_AUSENCIAS,
              },
            })
            setEmailNotif(fnError ? 'error' : 'ok')
          } catch { setEmailNotif('error') }
        } else if (datos.tipoPermiso !== 'licencia_medica') {
          // Resto de tipos (días compensatorios, justificativos, etc.)
          // La licencia médica NO envía correo al trabajador
          try {
            const { error: fnError } = await supabase.functions.invoke('notify-ausencia', {
              body: { correo: correoSolicitante, destinatario: nombrePersona, persona: nombrePersona, modo: 'solicitante', ...detalle },
            })
            setEmailNotif(fnError ? 'error' : 'ok')
          } catch { setEmailNotif('error') }
        }
      }

      // 2) Correos de RESPALDO a quienes tengan notificar_ausencia_correo
      try {
        const { data: backups } = await supabase
          .from('permisos_usuario')
          .select('permisos, usuario:usuario_id(nombre, email)')
        const destinatarios = (backups ?? [])
          .filter(b => b.permisos?.notificar_ausencia_correo && b.usuario?.email)
          // evitar duplicado con el solicitante
          .filter(b => b.usuario.email.toLowerCase() !== (correoSolicitante ?? '').toLowerCase())
        for (const b of destinatarios) {
          await supabase.functions.invoke('notify-ausencia', {
            body: { correo: b.usuario.email, destinatario: b.usuario.nombre ?? null, persona: nombrePersona, modo: 'respaldo', ...detalle },
          })
        }
      } catch { /* silencioso */ }
    }

    await cargarDatos()
  }

  async function handleEliminar() {
    if (!permisoEliminar || eliminando) return
    setErrorEliminar('')
    setEliminando(true)
    try {
      const p = permisoEliminar
      const { error } = await supabase.from('ausencias').delete().eq('id', p.id)
      if (error) throw error

      // Si era una ausencia de compensatorios, devolver el saldo al usuario
      if (p.tipo === 'dias_compensatorios' && p.usuario_id) {
        let diasARestaurar = 0
        if (p.jornada === 'medio_dia') {
          diasARestaurar = 0.5
        } else if (p.jornada === 'personalizado' && p.hora_inicio && p.hora_fin) {
          const [sh, sm] = p.hora_inicio.split(':').map(Number)
          const [eh, em] = p.hora_fin.split(':').map(Number)
          diasARestaurar = Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60 / 8)
        } else {
          diasARestaurar = diasHabiles(p.fecha_inicio, p.fecha_fin, diasInhabilitados)
        }
        if (diasARestaurar > 0) {
          const rut      = p.usuario?.rut ?? p.snapshot_rut ?? null
          const extraIds = rut
            ? usuarios.filter(u => u.rut && normRut(u.rut) === normRut(rut) && u.id !== p.usuario_id).map(u => u.id)
            : []
          try {
            await restaurarCompensatorios(p.usuario_id, diasARestaurar, extraIds)
          } catch (e) {
            console.error('[compensatorios] error al restaurar:', e)
            setErrorEliminar('Ausencia eliminada, pero no se pudo restaurar el saldo compensatorio.')
          }
        }
      }

      setPermisoEliminar(null)
      setPermisoVer(null)
      await cargarDatos()
    } catch {
      setErrorEliminar('No se pudo eliminar. Agrega la política DELETE en Supabase.')
    } finally { setEliminando(false) }
  }

  function exportarRegistros(formato) {
    setExportMenuOpen(false)
    // Si hay selección manual, exporta solo esos; si no, exporta todos los filtrados
    const registros = seleccionados.size > 0
      ? permisos.filter(p => seleccionados.has(p.id))
      : permisosFiltrados
    if (registros.length === 0) return

    const rows = registros.map(p => {
      const u       = resolveUser(p)
      const nombre  = u?.nombre ?? '—'
      const rut     = u?.rut ?? p.externo_rut ?? p.snapshot_rut ?? '—'
      const rol     = ROL_LABEL[u?.rol] ?? (u?.isExterno ? 'Externo' : '—')
      const tipo    = TIPO_LABEL[p.tipo] ?? p.tipo
      const jornada = JORNADA_LABEL[p.jornada] ?? p.jornada
      const duracion = calcDuration(p.fecha_inicio, p.fecha_fin, p.jornada, diasInhabilitados, p.tipo) ?? '—'
      const horas   = p.jornada === 'personalizado' && p.hora_inicio && p.hora_fin
        ? `${p.hora_inicio} – ${p.hora_fin}` : '—'
      const obj = {
        'Nombre':          nombre,
        'RUT':             rut,
        'Rol':             rol,
        'Tipo de ausencia': tipo,
        'Fecha inicio':    p.fecha_inicio ? formatFecha(p.fecha_inicio) : '—',
        'Fecha fin':       p.fecha_fin    ? formatFecha(p.fecha_fin)    : '—',
        'Jornada':         jornada,
        'Días usados':     duracion,
        'Horas (si aplica)': horas,
        'Motivo':          p.notas ?? '—',
      }
      if (p.tipo === 'licencia_medica') {
        obj['N° licencia médica'] = p.numero_licencia ?? p.notas ?? '—'
      }
      if (p.tipo === 'dias_compensatorios') {
        obj['Saldo compensatorio'] = '(ver módulo compensatorios)'
      }
      return obj
    })

    // Encabezados dinámicos (incluye columnas extra según tipos seleccionados)
    const headers = [
      'Nombre','RUT','Rol','Tipo de ausencia','Fecha inicio','Fecha fin',
      'Jornada','Días usados','Horas (si aplica)','Motivo',
      ...( registros.some(p => p.tipo === 'licencia_medica')      ? ['N° licencia médica']     : []),
      ...( registros.some(p => p.tipo === 'dias_compensatorios')   ? ['Saldo compensatorio']    : []),
    ]

    if (formato === 'csv') {
      const csv = [
        headers.map(h => `"${h}"`).join(','),
        ...rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')),
      ].join('\n')
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = 'ausencias.csv'; a.click()
      URL.revokeObjectURL(url)

    } else if (formato === 'excel') {
      const table = `<table><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>${
        rows.map(r => `<tr>${headers.map(h => `<td>${r[h] ?? ''}</td>`).join('')}</tr>`).join('')
      }</table>`
      const blob = new Blob([table], { type: 'application/vnd.ms-excel;charset=utf-8;' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = 'ausencias.xls'; a.click()
      URL.revokeObjectURL(url)

    } else if (formato === 'pdf') {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

      // Encabezado
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.setTextColor(26, 35, 126) // #1a237e
      doc.text('Ausencias registradas', 14, 16)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(100, 116, 139) // #64748b
      const subtitulo = `Exportado el ${new Date().toLocaleDateString('es-CL')} · ${registros.length} ${registros.length === 1 ? 'registro' : 'registros'}`
      doc.text(subtitulo, 14, 22)

      autoTable(doc, {
        startY: 27,
        head: [headers],
        body: rows.map(r => headers.map(h => r[h] ?? '')),
        styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
        headStyles: { fillColor: [26, 35, 126], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 0: { cellWidth: 32 }, 1: { cellWidth: 22 }, 9: { cellWidth: 40 } },
        margin: { left: 14, right: 14 },
        didDrawPage: (data) => {
          // Pie de página con número de página
          doc.setFontSize(7.5)
          doc.setTextColor(148, 163, 184)
          doc.text(
            `Pág. ${data.pageNumber}`,
            doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 8,
            { align: 'center' }
          )
        },
      })

      doc.save('ausencias.pdf')
    }
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

  const thisYear = new Date().getFullYear()

  // Mapa fecha → etiqueta para el calendario (feriados + días especiales)
  const feriadosLabelsMap = (() => {
    const m = new Map()
    feriadosAPI.forEach(f => m.set(f.fecha, f.motivo))
    diasAdmin.forEach(d => m.set(d.fecha, d.motivo))
    return m
  })()

  // ── Resuelve el usuario de una ausencia (incluso si fue borrado) ──────────
  function resolveUser(p) {
    if (p.usuario) return p.usuario
    if (p.externo_nombre) return { nombre: p.externo_nombre, rut: p.externo_rut, email: p.externo_email, rol: null, isExterno: true }
    // Usuario interno borrado: buscar por snapshot_rut en usuarios actuales
    if (p.snapshot_rut) {
      const found = usuarios.find(u => normRut(u.rut ?? '') === normRut(p.snapshot_rut))
      if (found) return found
    }
    return null // borrado sin reemplazo → se oculta
  }

  // ── Stats para KPI header ────────────────────────────────────────────────
  const licenciasMedicas = permisos.filter(p => p.tipo === 'licencia_medica')
  const permisosAdmin    = permisos.filter(p => p.tipo === 'permiso_administrativo')
  const justificativos   = permisos.filter(p => p.tipo === 'justificativo')
  const compensatorios   = permisos.filter(p => p.tipo === 'dias_compensatorios')
  const totalDiasInhab = feriadosAPI.length + diasAdmin.length

  // Personas ausentes HOY (período activo incluye la fecha de hoy), únicas por RUT
  const hoyStr = new Date().toISOString().slice(0, 10)
  const ausentesHoy = (() => {
    const set = new Set()
    permisos.forEach(p => {
      if (!(p.fecha_inicio && p.fecha_fin && p.fecha_inicio <= hoyStr && hoyStr <= p.fecha_fin)) return
      const u = resolveUser(p)
      if (!u) return // usuario borrado sin reemplazo → no se cuenta (igual que la lista)
      set.add(u.rut ? normRut(u.rut) : (u.id ?? u.nombre))
    })
    return set.size
  })()

  // Personas únicas (por RUT) de un tipo con ausencia activa hoy
  const personasHoyDe = (arr) => {
    const set = new Set()
    arr.forEach(p => {
      if (!(p.fecha_inicio && p.fecha_fin && p.fecha_inicio <= hoyStr && hoyStr <= p.fecha_fin)) return
      const u = resolveUser(p)
      if (!u) return
      set.add(u.rut ? normRut(u.rut) : (u.id ?? u.nombre))
    })
    return set.size
  }
  const fechaHoyCorta = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long' })

  // ── Stats por RUT (año actual, sin filtrar) ────────────────────────────────
  const userStatsMap = (() => {
    const map = {}
    permisos.forEach(p => {
      const rut = p.usuario?.rut ?? p.externo_rut ?? p.snapshot_rut
      const key = rut ? normRut(rut) : (p.usuario_id ?? '__ext__')
      if (!map[key]) map[key] = { count: 0, dias: 0 }
      const startYear = p.fecha_inicio ? parseInt(p.fecha_inicio.slice(0, 4)) : null
      if (startYear === thisYear) {
        map[key].count++
        // Solo suma días hábiles si el tipo descuenta del cupo
        if (!TIPOS_SIN_DESCUENTO.has(p.tipo)) {
          map[key].dias += calcDiasTotales([p], false, diasInhabilitados)
        }
      }
    })
    return map
  })()

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const permisosFiltrados = permisos.filter(p => {
    const u = resolveUser(p)
    if (!u) return false // ocultar borrados sin reemplazo
    if (busqueda.trim()) {
      const q    = normStr(busqueda)
      const qRut = normRut(busqueda)
      const ok   = normStr(u.nombre ?? '').includes(q)
        || normStr(u.email ?? '').includes(q)
        || (qRut.length > 1 && normRut(u.rut ?? '').includes(qRut))
      if (!ok) return false
    }
    if (filtroTipo && p.tipo !== filtroTipo) return false
    if (filtroRol  && (p.usuario?.rol ?? null) !== filtroRol) return false
    return true
  })

  // ── Agrupado por usuario (RUT como clave) ─────────────────────────────────
  const grupos = (() => {
    const map = {}
    const order = []
    permisosFiltrados.forEach(p => {
      const u   = resolveUser(p)
      if (!u) return
      const rut = u.rut ?? p.externo_rut ?? p.snapshot_rut
      const key = rut ? normRut(rut) : (u.id ?? p.id)
      if (!map[key]) { map[key] = { usuario: u, ausencias: [] }; order.push(key) }
      map[key].ausencias.push(p)
    })
    return order.map(k => map[k])
  })()

  useEffect(() => { setPaginaP(1) }, [permisosFiltrados.length])

  const POR_PAG_P    = 10
  const totalPagsP   = Math.ceil(grupos.length / POR_PAG_P)
  const gruposPagP   = grupos.slice((paginaP - 1) * POR_PAG_P, paginaP * POR_PAG_P)
  const pBtnP = (dis) => ({ padding: '5px 11px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: dis ? '#f9fafb' : '#fff', color: dis ? '#d1d5db' : '#374151', cursor: dis ? 'default' : 'pointer', fontSize: 13, fontWeight: 600 })

  return (
    <div className="permisos-page">

      {/* Toast email */}
      <AnimatePresence>
        {emailNotif && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <motion.div
              key="email-notif"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              onAnimationComplete={() => {
                if (emailNotif) setTimeout(() => setEmailNotif(null), 5000)
              }}
              style={{
                pointerEvents: 'auto',
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '16px 24px', borderRadius: 12,
                background: emailNotif === 'ok' ? '#dcfce7' : '#fee2e2',
                border: `1px solid ${emailNotif === 'ok' ? '#86efac' : '#fca5a5'}`,
                boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                color: emailNotif === 'ok' ? '#15803d' : '#b91c1c',
                fontWeight: 600, fontSize: 15, whiteSpace: 'nowrap',
              }}
            >
              <span style={{ fontSize: 16 }}>{emailNotif === 'ok' ? '✅' : '⚠️'}</span>
              {emailNotif === 'ok'
                ? 'Correo enviado correctamente'
                : 'No se pudo enviar el correo'}
              <button
                onClick={() => setEmailNotif(null)}
                style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer',
                  color: 'inherit', fontSize: 14, opacity: 0.6, padding: 0, lineHeight: 1 }}
              >✕</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="permisos-header">
        <div>
          <h1 className="permisos-title">{modoMisAusencias ? 'Mis ausencias' : 'Gestión de ausencias'}</h1>
          <p className="permisos-subtitle">
            {modoMisAusencias
              ? 'Historial de tus ausencias registradas.'
              : 'Gestiona las ausencias del personal.'}
          </p>
        </div>
      </div>

      {/* ── KPI Cards — solo en Gestión de ausencias ── */}
      {!modoMisAusencias && !cargando && permisos.length > 0 && (
        <div className="aus-stats-grid">
          {[
            // Destacada: ausentes hoy
            {
              label: ausentesHoy === 1 ? 'Persona ausente hoy' : 'Personas ausentes hoy',
              value: ausentesHoy,
              sub: ausentesHoy === 0 ? 'Nadie está ausente hoy' : `con ausencia activa el ${fechaHoyCorta}`,
              icon: ausentesHoy === 0 ? <CheckCircle2 size={16} strokeWidth={2} /> : <UserX size={16} strokeWidth={2} />,
              iconBg: ausentesHoy === 0 ? 'rgba(22,163,74,0.10)'  : 'rgba(220,38,38,0.10)',
              iconColor: ausentesHoy === 0 ? '#16a34a'            : '#dc2626',
              valueColor: ausentesHoy === 0 ? '#16a34a'           : '#dc2626',
            },
            // Por tipo — al día de hoy. Solo aparece si hay personas hoy.
            (() => { const n = personasHoyDe(licenciasMedicas); return n > 0 && {
              label: 'Con licencia médica',
              value: n,
              sub: `${n === 1 ? '1 persona' : `${n} personas`} hoy`,
              icon: <AlertTriangle size={16} strokeWidth={2} />,
              iconBg: 'rgba(29,78,216,0.10)', iconColor: '#1d4ed8',
            } })(),
            (() => { const n = personasHoyDe(permisosAdmin); return n > 0 && {
              label: 'Con permiso administrativo',
              value: n,
              sub: `${n === 1 ? '1 persona' : `${n} personas`} hoy`,
              icon: <CalendarCheck size={16} strokeWidth={2} />,
              iconBg: 'rgba(133,77,14,0.10)', iconColor: '#854d0e',
            } })(),
            (() => { const n = personasHoyDe(justificativos); return n > 0 && {
              label: 'Sin justificar',
              value: n,
              sub: `${n === 1 ? '1 persona' : `${n} personas`} hoy`,
              icon: <AlertCircle size={16} strokeWidth={2} />,
              iconBg: 'rgba(14,116,144,0.10)', iconColor: '#0e7490',
            } })(),
            (() => { const n = personasHoyDe(compensatorios); return n > 0 && {
              label: 'Con día compensatorio',
              value: n,
              sub: `${n === 1 ? '1 persona' : `${n} personas`} hoy`,
              icon: <Gift size={16} strokeWidth={2} />,
              iconBg: 'rgba(99,102,241,0.10)', iconColor: '#4f46e5',
            } })(),
          ].filter(Boolean).map((s, i) => (
            <motion.div key={i} className="aus-stat-card"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.28 } }}>
              <div className="aus-stat-icon" style={{ background: s.iconBg, color: s.iconColor }}>
                {s.icon}
              </div>
              <div className="aus-stat-value" style={s.valueColor ? { color: s.valueColor } : undefined}>{s.value}</div>
              <div className="aus-stat-label">{s.label}</div>
              {s.sub && <div className="aus-stat-sub">{s.sub}</div>}
            </motion.div>
          ))}
        </div>
      )}

      <div className="permisos-card">
        <div className="permisos-card-header">
          <div className="permisos-card-header-left">
            <div className="permisos-card-icon"><CalendarCheck size={16} strokeWidth={2} /></div>
            <div>
              <p className="permisos-card-title">Ausencias registradas</p>
              <p className="permisos-card-desc">Períodos de ausencia autorizados para los usuarios.</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {!modoMisAusencias && usuario?.rol === 'admin' && (
              <button className="permisos-dias-btn" onClick={() => setModalInhabilitados(true)}
                title="Gestionar días inhabilitados (feriados, puentes)">
                <CalendarCheck size={14} strokeWidth={2.5} />
                Días inhabilitados
                {totalDiasInhab > 0 && (
                  <span className="permisos-dias-badge">{totalDiasInhab}</span>
                )}
              </button>
            )}
            {/* Botón Exportar — siempre visible; exporta seleccionados o filtrados */}
            {permisos.length > 0 && (
              <div style={{ position: 'relative' }} ref={exportMenuRef}>
                <button
                  className="permisos-dias-btn"
                  onClick={() => setExportMenuOpen(prev => !prev)}
                  style={seleccionados.size > 0
                    ? { display: 'flex', alignItems: 'center', gap: 6, background: '#f0fdf4', border: '1.5px solid #86efac', color: '#15803d' }
                    : { display: 'flex', alignItems: 'center', gap: 6 }}
                  title={seleccionados.size > 0
                    ? `Exportar ${seleccionados.size} seleccionado${seleccionados.size !== 1 ? 's' : ''}`
                    : `Exportar ${permisosFiltrados.length} registro${permisosFiltrados.length !== 1 ? 's' : ''} filtrados`}
                >
                  <Download size={14} strokeWidth={2.5} />
                  {seleccionados.size > 0 ? `Exportar (${seleccionados.size})` : 'Exportar'}
                  <ChevronDown size={12} strokeWidth={2.5} style={{ transition: 'transform 0.18s', transform: exportMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                </button>
                {exportMenuOpen && (
                  <div style={{
                    position: 'absolute', right: 0, top: 'calc(100% + 4px)',
                    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 9,
                    boxShadow: '0 6px 24px rgba(0,0,0,0.10)', zIndex: 200,
                    minWidth: 160, overflow: 'hidden', padding: '4px 0',
                  }}>
                    {/* Cabecera del menú: indica qué se va a exportar */}
                    <div style={{ padding: '7px 14px 5px', fontSize: 11, color: '#94a3b8', borderBottom: '1px solid #f1f5f9', marginBottom: 2 }}>
                      {seleccionados.size > 0
                        ? `${seleccionados.size} seleccionado${seleccionados.size !== 1 ? 's' : ''}`
                        : `${permisosFiltrados.length} registro${permisosFiltrados.length !== 1 ? 's' : ''} filtrados`}
                    </div>
                    {[
                      { label: 'PDF',   fmt: 'pdf',   icon: '📄' },
                      { label: 'Excel', fmt: 'excel', icon: '📊' },
                      { label: 'CSV',   fmt: 'csv',   icon: '📋' },
                    ].map(({ label, fmt, icon }) => (
                      <button key={fmt} onClick={() => exportarRegistros(fmt)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                          padding: '9px 14px', background: 'none', border: 'none',
                          cursor: 'pointer', fontSize: 13, color: '#374151', textAlign: 'left',
                          fontFamily: 'inherit', transition: 'background 0.12s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                      >
                        <span>{icon}</span>{label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {puedeGestionar && (
              <button className="permisos-btn-primary" onClick={() => setModalAbierto(true)}>
                <Plus size={14} strokeWidth={2.5} /> Registrar ausencia
              </button>
            )}
          </div>
        </div>

        {/* ── Buscador + Filtros ── */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '10px 16px', borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
          {/* Búsqueda por nombre solo en modo gestión (no tiene sentido en mis ausencias) */}
          {!modoMisAusencias && (
            <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
              <Search size={13} strokeWidth={2.5}
                style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
              <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, RUT o email…"
                style={{ width: '100%', boxSizing: 'border-box', paddingLeft: 30, paddingRight: 10, paddingTop: 7, paddingBottom: 7, border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', color: '#374151', background: '#f8fafc' }} />
            </div>
          )}
          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
            style={{ padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, color: '#374151', background: '#f8fafc', cursor: 'pointer' }}>
            <option value="">Todos los tipos</option>
            {TIPOS_PERMISO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          {/* Filtro por rol solo en modo gestión */}
          {!modoMisAusencias && (
            <select value={filtroRol} onChange={e => setFiltroRol(e.target.value)}
              style={{ padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, color: '#374151', background: '#f8fafc', cursor: 'pointer' }}>
              <option value="">Todos los roles</option>
              {ROLES_ACTIVOS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
          )}
          {(busqueda || filtroTipo || filtroRol) && (
            <button onClick={() => { setBusqueda(''); setFiltroTipo(''); setFiltroRol('') }}
              style={{ padding: '6px 10px', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#dc2626', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <X size={12} strokeWidth={2.5} /> Limpiar
            </button>
          )}
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
              No hay ausencias registradas aún.
            </div>
          ) : grupos.length === 0 ? (
            <div className="permisos-empty">
              <div className="permisos-empty-icon"><Search size={20} strokeWidth={1.5} /></div>
              No se encontraron resultados para los filtros aplicados.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 16 }}>
              {gruposPagP.map(({ usuario: u, ausencias: aus }) => {
                const rut      = u.rut ?? u.externo_rut
                const statsKey = rut ? normRut(rut) : (u.id ?? 'unknown')
                const cardKey  = u.id ?? rut ?? u.nombre
                const abierto  = expandidos.has(cardKey)
                const stats    = userStatsMap[statsKey] ?? { count: 0, dias: 0 }
                const restantes = Math.max(MAX_AUSENCIAS - stats.dias, 0)
                const agotada   = stats.dias >= MAX_AUSENCIAS
                const { dot: dotColor, text: textColor } = getAusenciaColors(stats.dias)
                const diasFmt   = fmtDias(stats.dias)
                const rolLabel    = ROL_LABEL[u.rol] ?? u.rol ?? 'Externo'

                const todosSeleccionados = aus.every(p => seleccionados.has(p.id))
                const algunoSeleccionado = aus.some(p => seleccionados.has(p.id))

                function toggleUsuario(e) {
                  e.stopPropagation()
                  setSeleccionados(prev => {
                    const next = new Set(prev)
                    if (todosSeleccionados) {
                      aus.forEach(p => next.delete(p.id))
                    } else {
                      aus.forEach(p => next.add(p.id))
                    }
                    return next
                  })
                }

                return (
                  <div key={cardKey}
                    style={{
                      border: algunoSeleccionado ? '1.5px solid #c7d2fe' : '1px solid #e9edf5',
                      borderRadius: 12, overflow: 'hidden', background: '#fff',
                      transition: 'border-color 0.15s',
                    }}>

                    {/* ── Cabecera del usuario (clickeable) ── */}
                    <div onClick={() => toggleColapso(cardKey)} className="permisos-user-header"
                      style={{ borderBottom: abierto ? '1px solid #f0f4f8' : 'none' }}>
                      {/* Checkbox de usuario — selecciona/deselecciona todas sus ausencias */}
                      <input
                        type="checkbox"
                        checked={todosSeleccionados}
                        ref={el => { if (el) el.indeterminate = algunoSeleccionado && !todosSeleccionados }}
                        onChange={toggleUsuario}
                        onClick={e => e.stopPropagation()}
                        title={todosSeleccionados ? 'Deseleccionar todas' : 'Seleccionar todas las ausencias'}
                        style={{ width: 15, height: 15, cursor: 'pointer', flexShrink: 0, accentColor: '#4f46e5', marginRight: 4 }}
                      />
                      {/* Izquierda: avatar + nombre + rol */}
                      <div className="aus-user-left">
                        <div className="permisos-avatar" style={{ background: getAvatarColor(u.nombre ?? ''), width: 38, height: 38, fontSize: 13, flexShrink: 0 }}>
                          {getInitials(u.nombre ?? '')}
                        </div>
                        <div>
                          <div className="aus-user-name">{u.nombre ?? '—'}</div>
                          <span className="permisos-badge permisos-badge--rol" style={{ marginTop: 3, display: 'inline-flex' }}>{rolLabel}</span>
                        </div>
                      </div>
                      {/* Centro: correo + RUT */}
                      <div className="aus-user-center">
                        {u.email && (
                          <div style={{ fontSize: 12, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {u.email}
                          </div>
                        )}
                        {u.rut && <div className="aus-user-meta">{u.rut}</div>}
                      </div>
                      {/* Derecha: barra de cuota + chevron */}
                      <div className="aus-user-right">
                        <div className="aus-quota-wrap">
                          <div className="aus-quota-bar">
                            <div className="aus-quota-fill" style={{
                              width: `${Math.min((stats.dias / MAX_AUSENCIAS) * 100, 100)}%`,
                              background: agotada ? '#dc2626' : restantes <= 1 ? '#ea580c' : restantes <= 2 ? '#d97706' : '#6366f1',
                            }} />
                          </div>
                          <div className="aus-quota-label" style={{ color: textColor }}>
                            {agotada ? 'Cuota agotada' : `${diasFmt} / ${MAX_AUSENCIAS} días`}
                          </div>
                        </div>
                        <ChevronDown size={13} strokeWidth={2.5}
                          style={{ color: '#94a3b8', flexShrink: 0, transition: 'transform 0.22s', transform: abierto ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
                      </div>
                    </div>

                    {/* ── Filas de ausencias (colapsables) ── */}
                    <AnimatePresence initial={false}>
                      {abierto && (
                        <motion.div key="rows"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto', transition: { duration: 0.2 } }}
                          exit={{ opacity: 0, height: 0, transition: { duration: 0.15 } }}
                          style={{ overflow: 'hidden' }}>
                          {/* Contenedor interno que agrupa los registros */}
                          <div style={{
                            background: '#f8fafc',
                            padding: '8px 12px',
                            display: 'flex', flexDirection: 'column', gap: 5,
                          }}>
                          {aus.map((p) => {
                            const duracion = calcDuration(p.fecha_inicio, p.fecha_fin, p.jornada, diasInhabilitados, p.tipo)
                            const sel = seleccionados.has(p.id)
                            return (
                              <div key={p.id} className="permisos-ausencia-row" style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '8px 10px',
                                borderRadius: 8,
                                border: `1px solid ${sel ? '#c7d2fe' : '#eef0f5'}`,
                                background: sel ? 'rgba(99,102,241,0.05)' : '#fff',
                                transition: 'background 0.15s, border-color 0.15s',
                              }}>
                                {/* Checkbox de selección */}
                                <input
                                  type="checkbox"
                                  checked={sel}
                                  onChange={() => toggleSeleccion(p.id)}
                                  onClick={e => e.stopPropagation()}
                                  title="Seleccionar para exportar"
                                  style={{ width: 14, height: 14, cursor: 'pointer', flexShrink: 0, accentColor: '#4f46e5' }}
                                />
                                <span className="permisos-badge permisos-badge--tipo" style={{
                                  flexShrink: 0,
                                  background: TIPO_STYLE[p.tipo]?.bg ?? '#f1f5f9',
                                  color: TIPO_STYLE[p.tipo]?.color ?? '#475569',
                                }}>
                                  {TIPO_STYLE[p.tipo]?.icon ?? ''} {TIPO_LABEL[p.tipo] ?? p.tipo}
                                </span>
                                <span style={{ fontSize: 12.5, color: '#475569', flex: 1, whiteSpace: 'nowrap', minWidth: 0 }}>
                                  {formatFecha(p.fecha_inicio)}
                                  <span style={{ color: '#cbd5e1', margin: '0 5px' }}>→</span>
                                  {formatFecha(p.fecha_fin)}
                                </span>
                                <span className="permisos-badge permisos-badge--jornada" style={{ flexShrink: 0 }}>{JORNADA_LABEL[p.jornada] ?? p.jornada}</span>
                                {duracion && <span style={{ fontSize: 11.5, color: '#94a3b8', flexShrink: 0 }}>{duracion}</span>}
                                <div className="aus-row-actions">
                                  <button className="permisos-action-btn" title="Ver" onClick={e => { e.stopPropagation(); setPermisoVer(modoMisAusencias ? { ...p, usuario: p.usuario ?? usuario } : p) }} style={{ color: '#64748b', width: 28, height: 28 }}>
                                    <Eye size={13} strokeWidth={2} />
                                  </button>
                                  {puedeGestionar && (
                                    <button className="permisos-action-btn" title="Editar" onClick={e => { e.stopPropagation(); abrirEditar(p) }} style={{ color: '#64748b', width: 28, height: 28 }}>
                                      <Pencil size={13} strokeWidth={2} />
                                    </button>
                                  )}
                                  {puedeGestionar && (
                                    <button className="permisos-action-btn permisos-action-btn--danger" title="Eliminar" onClick={e => { e.stopPropagation(); abrirEliminar(p) }} style={{ color: '#ef4444', width: 28, height: 28 }}>
                                      <Trash2 size={13} strokeWidth={2} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                  </div>
                )
              })}
            </div>
          )}

          {/* Paginación ausencias */}
          {totalPagsP > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '14px 16px', flexWrap: 'wrap' }}>
              <button onClick={() => setPaginaP(1)} disabled={paginaP === 1} style={pBtnP(paginaP === 1)}>«</button>
              <button onClick={() => setPaginaP(p => p - 1)} disabled={paginaP === 1} style={pBtnP(paginaP === 1)}>‹ Ant.</button>
              <span style={{ fontSize: 13, color: '#6b7280', padding: '0 6px' }}>Pág. {paginaP} / {totalPagsP} · {grupos.length} personas</span>
              <button onClick={() => setPaginaP(p => p + 1)} disabled={paginaP >= totalPagsP} style={pBtnP(paginaP >= totalPagsP)}>Sig. ›</button>
              <button onClick={() => setPaginaP(totalPagsP)} disabled={paginaP >= totalPagsP} style={pBtnP(paginaP >= totalPagsP)}>»</button>
            </div>
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
          onUsuarioCreado={handleUsuarioCreado}
          diasInhabilitados={diasInhabilitados}
          feriadosLabels={feriadosLabelsMap}
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
          onUsuarioCreado={handleUsuarioCreado}
          diasInhabilitados={diasInhabilitados}
          feriadosLabels={feriadosLabelsMap}
        />
      )}

      {permisoVer && (
        <ModalVerPermiso
          permiso={permisoVer}
          onClose={() => setPermisoVer(null)}
          onEditar={modoMisAusencias ? undefined : () => abrirEditar(permisoVer)}
          onEliminar={modoMisAusencias ? undefined : () => abrirEliminar(permisoVer)}
          diasInhabilitados={diasInhabilitados}
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

      {modalInhabilitados && (
        <ModalDiasInhabilitados
          feriadosAPI={feriadosAPI}
          diasAdmin={diasAdmin}
          cargandoAPI={cargandoAPI}
          onClose={() => setModalInhabilitados(false)}
          onAgregar={handleAgregarDia}
          onEliminar={handleEliminarDia}
          onEditar={handleEditarDia}
        />
      )}

    </div>
  )
}
