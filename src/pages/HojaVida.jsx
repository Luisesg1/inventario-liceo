// src/pages/HojaVida.jsx
import { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Search, Plus, Edit2, Trash2, FileText, Download,
  Loader2, X, BookOpen, Award, Calendar, ClipboardList,
  MessageSquare, History, Briefcase, Phone, Mail, MapPin,
  ChevronRight, ChevronDown, User, Users, Star, Info,
  AlertTriangle, CheckCircle, Printer, Filter,
} from 'lucide-react'
import { supabase } from '../supabase'
import './HojaVida.css'

// ── Constantes ───────────────────────────────────────────────────────────────
const POR_PAGINA = 12

const overlayV = { hidden: { opacity: 0 }, visible: { opacity: 1 }, exit: { opacity: 0 } }
const modalV = {
  hidden:  { opacity: 0, scale: 0.95, y: 12 },
  visible: { opacity: 1, scale: 1,    y: 0,  transition: { type: 'spring', stiffness: 400, damping: 30 } },
  exit:    { opacity: 0, scale: 0.95, y: 8,  transition: { duration: 0.15 } },
}

const TABS = [
  { id: 'info_personal',  label: 'Info. Personal',  Icon: User },
  { id: 'info_laboral',   label: 'Info. Laboral',   Icon: Briefcase },
  { id: 'historial',      label: 'Historial',        Icon: History },
  { id: 'documentos',     label: 'Documentos',       Icon: FileText },
  { id: 'capacitaciones', label: 'Capacitaciones',   Icon: BookOpen },
  { id: 'evaluaciones',   label: 'Evaluaciones',     Icon: Star },
  { id: 'ausencias',      label: 'Perm. y Licencias', Icon: Calendar },
  { id: 'observaciones',  label: 'Observaciones',    Icon: MessageSquare },
  { id: 'historial_sys',  label: 'Historial Sistema', Icon: ClipboardList },
]

const TIPO_HISTORIAL = {
  ingreso:              'Ingreso',
  ascenso:              'Ascenso',
  cambio_cargo:         'Cambio de cargo',
  cambio_contrato:      'Cambio de contrato',
  cambio_departamento:  'Cambio de departamento',
  renovacion:           'Renovación',
  reincorporacion:      'Reincorporación',
  termino:              'Término',
  otro:                 'Otro',
}

const CALIFICACION_MAP = {
  sobresaliente: { label: 'Sobresaliente', color: '#16a34a', bg: '#f0fdf4' },
  muy_bien:      { label: 'Muy bien',      color: '#0891b2', bg: '#ecfeff' },
  bien:          { label: 'Bien',          color: '#d97706', bg: '#fffbeb' },
  deficiente:    { label: 'Deficiente',    color: '#dc2626', bg: '#fef2f2' },
  otro:          { label: 'Otro',          color: '#6b7280', bg: '#f9fafb' },
}

const ESTADO_LABORAL_MAP = {
  activo:    { label: 'Activo',    color: '#16a34a', bg: '#f0fdf4' },
  inactivo:  { label: 'Inactivo',  color: '#6b7280', bg: '#f9fafb' },
  licencia:  { label: 'Licencia',  color: '#d97706', bg: '#fffbeb' },
  comision:  { label: 'Comisión',  color: '#0891b2', bg: '#ecfeff' },
  otro:      { label: 'Otro',      color: '#6b7280', bg: '#f9fafb' },
}

const ESTADO_CONTRATO_MAP = {
  vigente:  { label: 'Vigente',  color: '#16a34a', bg: '#f0fdf4' },
  por_vencer:{ label: 'Por vencer', color: '#d97706', bg: '#fffbeb' },
  vencido:  { label: 'Vencido',  color: '#dc2626', bg: '#fef2f2' },
}

const TIPOS_DOC_MAP = {
  contrato:    'Contrato',
  anexo:       'Anexo',
  certificado: 'Certificado',
  afp:         'AFP',
  salud:       'Salud (Isapre/Fonasa)',
  licencia:    'Licencia médica',
  titulo:      'Título / Diploma',
  evaluacion:  'Evaluación',
  decreto:     'Decreto',
  otro:        'Otro',
}

const ESTAMENTO_MAP = {
  docente:         'Docente',
  asistente:       'Asistente de la Educación',
  administrativo:  'Administrativo',
  directivo:       'Directivo',
  otro:            'Otro',
}

const CONTRATO_MAP = {
  planta:    'Planta',
  contrata:  'Contrata',
  honorarios:'Honorarios',
  reemplazante: 'Reemplazante',
  otro:      'Otro',
}

// ── Utilidades ───────────────────────────────────────────────────────────────
function formatRut(rut) {
  if (!rut) return ''
  const clean = rut.replace(/[^0-9kK]/g, '')
  if (clean.length < 2) return clean
  const cuerpo = clean.slice(0, -1)
  const dv     = clean.slice(-1).toUpperCase()
  return cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + dv
}

function formatFecha(fecha) {
  if (!fecha) return '—'
  const d = new Date(fecha + 'T12:00:00')
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatFechaCorta(fecha) {
  if (!fecha) return '—'
  const d = new Date(fecha + 'T12:00:00')
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })
}

function calcularEdad(fechaNac) {
  if (!fechaNac) return null
  const hoy  = new Date()
  const nac  = new Date(fechaNac + 'T12:00:00')
  let edad   = hoy.getFullYear() - nac.getFullYear()
  const m    = hoy.getMonth() - nac.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--
  return edad
}

function calcularAntiguedad(fecha) {
  if (!fecha) return null
  const hoy   = new Date()
  const ini   = new Date(fecha + 'T12:00:00')
  let años    = hoy.getFullYear() - ini.getFullYear()
  let meses   = hoy.getMonth() - ini.getMonth()
  if (meses < 0) { años--; meses += 12 }
  if (años === 0 && meses === 0) return 'Menos de 1 mes'
  const partes = []
  if (años > 0)  partes.push(`${años} año${años > 1 ? 's' : ''}`)
  if (meses > 0) partes.push(`${meses} mes${meses > 1 ? 'es' : ''}`)
  return partes.join(' y ')
}

function calcularEstadoContrato(fechaTermino) {
  if (!fechaTermino) return 'vigente'
  const term = new Date(fechaTermino + 'T12:00:00')
  const hoy  = new Date()
  const dias = Math.ceil((term - hoy) / 86400000)
  if (dias < 0)  return 'vencido'
  if (dias <= 30) return 'por_vencer'
  return 'vigente'
}

function formatBytes(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function iniciales(nombre) {
  if (!nombre) return '?'
  return nombre.trim().split(/\s+/).slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

// ── Badges ───────────────────────────────────────────────────────────────────
function EstadoBadge({ estado, mapa = ESTADO_CONTRATO_MAP }) {
  const s = mapa[estado] ?? { label: estado, color: '#6b7280', bg: '#f9fafb' }
  return (
    <span className="hv-badge" style={{ color: s.color, background: s.bg, border: `1px solid ${s.color}22` }}>
      {s.label}
    </span>
  )
}

// ── Confirm modal ─────────────────────────────────────────────────────────────
function ConfirmModal({ mensaje, onConfirmar, onCancelar, cargando }) {
  return (
    <motion.div className="hv-overlay" variants={overlayV} initial="hidden" animate="visible" exit="exit"
      onClick={onCancelar}>
      <motion.div className="hv-modal hv-modal--sm" variants={modalV} onClick={e => e.stopPropagation()}>
        <div className="hv-modal-header">
          <h3>Confirmar eliminación</h3>
          <button className="hv-modal-close" onClick={onCancelar}><X size={16} /></button>
        </div>
        <div style={{ padding: '20px 24px' }}>
          <p style={{ margin: 0, color: '#374151' }}>{mensaje}</p>
        </div>
        <div className="hv-modal-footer">
          <button className="hv-btn hv-btn--ghost" onClick={onCancelar} disabled={cargando}>Cancelar</button>
          <button className="hv-btn hv-btn--danger" onClick={onConfirmar} disabled={cargando}>
            {cargando ? <Loader2 size={14} className="hv-spin" /> : <Trash2 size={14} />}
            {cargando ? 'Eliminando…' : 'Eliminar'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Modal Info Personal ───────────────────────────────────────────────────────
function ModalInfoPersonal({ datos, onGuardar, onCerrar, guardando }) {
  const [form, setForm] = useState({
    fecha_nacimiento:             datos?.fecha_nacimiento ?? '',
    direccion:                    datos?.direccion ?? '',
    estado_civil:                 datos?.estado_civil ?? '',
    correo_personal:              datos?.correo_personal ?? '',
    contacto_emergencia_nombre:   datos?.contacto_emergencia_nombre ?? '',
    contacto_emergencia_telefono: datos?.contacto_emergencia_telefono ?? '',
    contacto_emergencia_relacion: datos?.contacto_emergencia_relacion ?? '',
    observaciones_personales:     datos?.observaciones_personales ?? '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <motion.div className="hv-overlay" variants={overlayV} initial="hidden" animate="visible" exit="exit"
      onClick={onCerrar}>
      <motion.div className="hv-modal" variants={modalV} onClick={e => e.stopPropagation()}>
        <div className="hv-modal-header">
          <h3>Información Personal</h3>
          <button className="hv-modal-close" onClick={onCerrar}><X size={16} /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); onGuardar(form) }} className="hv-modal-body">
          <div className="hv-form-grid">
            <div className="hv-form-group">
              <label>Fecha de nacimiento</label>
              <input type="date" value={form.fecha_nacimiento} onChange={e => set('fecha_nacimiento', e.target.value)} />
            </div>
            <div className="hv-form-group">
              <label>Estado civil</label>
              <select value={form.estado_civil} onChange={e => set('estado_civil', e.target.value)}>
                <option value="">Sin especificar</option>
                <option value="soltero">Soltero/a</option>
                <option value="casado">Casado/a</option>
                <option value="conviviente">Conviviente</option>
                <option value="divorciado">Divorciado/a</option>
                <option value="viudo">Viudo/a</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div className="hv-form-group hv-form-group--full">
              <label>Dirección</label>
              <input value={form.direccion} onChange={e => set('direccion', e.target.value)} placeholder="Calle, número, ciudad" />
            </div>
            <div className="hv-form-group hv-form-group--full">
              <label>Correo personal</label>
              <input type="email" value={form.correo_personal} onChange={e => set('correo_personal', e.target.value)} placeholder="correo@personal.cl" />
            </div>
          </div>

          <p className="hv-form-section-title"><Phone size={13} /> Contacto de emergencia</p>
          <div className="hv-form-grid">
            <div className="hv-form-group">
              <label>Nombre</label>
              <input value={form.contacto_emergencia_nombre} onChange={e => set('contacto_emergencia_nombre', e.target.value)} placeholder="Nombre del contacto" />
            </div>
            <div className="hv-form-group">
              <label>Teléfono</label>
              <input value={form.contacto_emergencia_telefono} onChange={e => set('contacto_emergencia_telefono', e.target.value)} placeholder="+56 9 1234 5678" />
            </div>
            <div className="hv-form-group">
              <label>Relación</label>
              <input value={form.contacto_emergencia_relacion} onChange={e => set('contacto_emergencia_relacion', e.target.value)} placeholder="Ej: Cónyuge, Padre/Madre" />
            </div>
          </div>

          <div className="hv-form-group hv-form-group--full" style={{ marginTop: 4 }}>
            <label>Observaciones personales</label>
            <textarea rows={3} value={form.observaciones_personales} onChange={e => set('observaciones_personales', e.target.value)} placeholder="Notas adicionales sobre el funcionario…" />
          </div>

          <div className="hv-modal-footer">
            <button type="button" className="hv-btn hv-btn--ghost" onClick={onCerrar}>Cancelar</button>
            <button type="submit" className="hv-btn hv-btn--primary" disabled={guardando}>
              {guardando ? <Loader2 size={14} className="hv-spin" /> : null}
              {guardando ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

// ── Modal Info Laboral ────────────────────────────────────────────────────────
function ModalInfoLaboral({ datos, onGuardar, onCerrar, guardando }) {
  const [form, setForm] = useState({
    departamento:   datos?.departamento ?? '',
    jornada:        datos?.jornada ?? '',
    fecha_ingreso:  datos?.fecha_ingreso ?? '',
    jefatura_directa: datos?.jefatura_directa ?? '',
    estado_laboral: datos?.estado_laboral ?? 'activo',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <motion.div className="hv-overlay" variants={overlayV} initial="hidden" animate="visible" exit="exit"
      onClick={onCerrar}>
      <motion.div className="hv-modal" variants={modalV} onClick={e => e.stopPropagation()}>
        <div className="hv-modal-header">
          <h3>Información Laboral</h3>
          <button className="hv-modal-close" onClick={onCerrar}><X size={16} /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); onGuardar(form) }} className="hv-modal-body">
          <div className="hv-form-grid">
            <div className="hv-form-group">
              <label>Departamento / Unidad</label>
              <input value={form.departamento} onChange={e => set('departamento', e.target.value)} placeholder="Ej: Unidad Técnica Pedagógica" />
            </div>
            <div className="hv-form-group">
              <label>Jornada</label>
              <select value={form.jornada} onChange={e => set('jornada', e.target.value)}>
                <option value="">Sin especificar</option>
                <option value="completa">Completa</option>
                <option value="media">Media jornada</option>
                <option value="parcial">Parcial</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div className="hv-form-group">
              <label>Fecha de ingreso</label>
              <input type="date" value={form.fecha_ingreso} onChange={e => set('fecha_ingreso', e.target.value)} />
            </div>
            <div className="hv-form-group">
              <label>Estado laboral</label>
              <select value={form.estado_laboral} onChange={e => set('estado_laboral', e.target.value)}>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
                <option value="licencia">En licencia</option>
                <option value="comision">En comisión</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div className="hv-form-group hv-form-group--full">
              <label>Jefatura directa</label>
              <input value={form.jefatura_directa} onChange={e => set('jefatura_directa', e.target.value)} placeholder="Nombre de la jefatura directa" />
            </div>
          </div>
          <div className="hv-modal-footer">
            <button type="button" className="hv-btn hv-btn--ghost" onClick={onCerrar}>Cancelar</button>
            <button type="submit" className="hv-btn hv-btn--primary" disabled={guardando}>
              {guardando ? <Loader2 size={14} className="hv-spin" /> : null}
              {guardando ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

// ── Modal Historial ───────────────────────────────────────────────────────────
const FORM_HISTORIAL_VACIO = { tipo: 'ingreso', descripcion: '', fecha_evento: '', cargo_anterior: '', cargo_nuevo: '' }

function ModalHistorial({ datos, onGuardar, onCerrar, guardando }) {
  const [form, setForm] = useState(datos ?? FORM_HISTORIAL_VACIO)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const esEdicion = !!datos?.id

  return (
    <motion.div className="hv-overlay" variants={overlayV} initial="hidden" animate="visible" exit="exit"
      onClick={onCerrar}>
      <motion.div className="hv-modal" variants={modalV} onClick={e => e.stopPropagation()}>
        <div className="hv-modal-header">
          <h3>{esEdicion ? 'Editar evento' : 'Registrar evento en historial'}</h3>
          <button className="hv-modal-close" onClick={onCerrar}><X size={16} /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); onGuardar(form) }} className="hv-modal-body">
          <div className="hv-form-grid">
            <div className="hv-form-group">
              <label>Tipo de evento *</label>
              <select value={form.tipo} onChange={e => set('tipo', e.target.value)} required>
                {Object.entries(TIPO_HISTORIAL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="hv-form-group">
              <label>Fecha del evento *</label>
              <input type="date" value={form.fecha_evento} onChange={e => set('fecha_evento', e.target.value)} required />
            </div>
            <div className="hv-form-group">
              <label>Cargo anterior</label>
              <input value={form.cargo_anterior} onChange={e => set('cargo_anterior', e.target.value)} placeholder="Cargo previo" />
            </div>
            <div className="hv-form-group">
              <label>Cargo nuevo</label>
              <input value={form.cargo_nuevo} onChange={e => set('cargo_nuevo', e.target.value)} placeholder="Cargo resultante" />
            </div>
            <div className="hv-form-group hv-form-group--full">
              <label>Descripción</label>
              <textarea rows={3} value={form.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="Detalle del cambio o evento…" />
            </div>
          </div>
          <div className="hv-modal-footer">
            <button type="button" className="hv-btn hv-btn--ghost" onClick={onCerrar}>Cancelar</button>
            <button type="submit" className="hv-btn hv-btn--primary" disabled={guardando}>
              {guardando ? <Loader2 size={14} className="hv-spin" /> : null}
              {guardando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Registrar'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

// ── Modal Capacitación ────────────────────────────────────────────────────────
const FORM_CAP_VACIO = { nombre_curso: '', institucion: '', horas: '', fecha_inicio: '', fecha_termino: '', observaciones: '' }

function ModalCapacitacion({ datos, onGuardar, onCerrar, guardando }) {
  const [form, setForm] = useState(datos ?? FORM_CAP_VACIO)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <motion.div className="hv-overlay" variants={overlayV} initial="hidden" animate="visible" exit="exit"
      onClick={onCerrar}>
      <motion.div className="hv-modal" variants={modalV} onClick={e => e.stopPropagation()}>
        <div className="hv-modal-header">
          <h3>{datos?.id ? 'Editar capacitación' : 'Registrar capacitación'}</h3>
          <button className="hv-modal-close" onClick={onCerrar}><X size={16} /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); onGuardar(form) }} className="hv-modal-body">
          <div className="hv-form-grid">
            <div className="hv-form-group hv-form-group--full">
              <label>Nombre del curso / capacitación *</label>
              <input value={form.nombre_curso} onChange={e => set('nombre_curso', e.target.value)} placeholder="Ej: Primeros Auxilios" required />
            </div>
            <div className="hv-form-group">
              <label>Institución</label>
              <input value={form.institucion} onChange={e => set('institucion', e.target.value)} placeholder="Ej: Cruz Roja" />
            </div>
            <div className="hv-form-group">
              <label>Horas</label>
              <input type="number" min="1" value={form.horas} onChange={e => set('horas', e.target.value)} placeholder="Ej: 24" />
            </div>
            <div className="hv-form-group">
              <label>Fecha inicio</label>
              <input type="date" value={form.fecha_inicio} onChange={e => set('fecha_inicio', e.target.value)} />
            </div>
            <div className="hv-form-group">
              <label>Fecha término</label>
              <input type="date" value={form.fecha_termino} onChange={e => set('fecha_termino', e.target.value)} />
            </div>
            <div className="hv-form-group hv-form-group--full">
              <label>Observaciones</label>
              <textarea rows={2} value={form.observaciones} onChange={e => set('observaciones', e.target.value)} placeholder="Detalles adicionales…" />
            </div>
          </div>
          <div className="hv-modal-footer">
            <button type="button" className="hv-btn hv-btn--ghost" onClick={onCerrar}>Cancelar</button>
            <button type="submit" className="hv-btn hv-btn--primary" disabled={guardando}>
              {guardando ? <Loader2 size={14} className="hv-spin" /> : null}
              {guardando ? 'Guardando…' : datos?.id ? 'Guardar cambios' : 'Registrar'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

// ── Modal Evaluación ──────────────────────────────────────────────────────────
const FORM_EVAL_VACIO = { evaluador: '', fecha_evaluacion: '', puntaje: '', calificacion: '', observaciones: '' }

function ModalEvaluacion({ datos, onGuardar, onCerrar, guardando }) {
  const [form, setForm] = useState(datos ?? FORM_EVAL_VACIO)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <motion.div className="hv-overlay" variants={overlayV} initial="hidden" animate="visible" exit="exit"
      onClick={onCerrar}>
      <motion.div className="hv-modal" variants={modalV} onClick={e => e.stopPropagation()}>
        <div className="hv-modal-header">
          <h3>{datos?.id ? 'Editar evaluación' : 'Registrar evaluación'}</h3>
          <button className="hv-modal-close" onClick={onCerrar}><X size={16} /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); onGuardar(form) }} className="hv-modal-body">
          <div className="hv-form-grid">
            <div className="hv-form-group">
              <label>Evaluador</label>
              <input value={form.evaluador} onChange={e => set('evaluador', e.target.value)} placeholder="Nombre del evaluador" />
            </div>
            <div className="hv-form-group">
              <label>Fecha de evaluación *</label>
              <input type="date" value={form.fecha_evaluacion} onChange={e => set('fecha_evaluacion', e.target.value)} required />
            </div>
            <div className="hv-form-group">
              <label>Puntaje</label>
              <input type="number" step="0.01" min="0" max="100" value={form.puntaje} onChange={e => set('puntaje', e.target.value)} placeholder="Ej: 85.50" />
            </div>
            <div className="hv-form-group">
              <label>Calificación</label>
              <select value={form.calificacion} onChange={e => set('calificacion', e.target.value)}>
                <option value="">Sin calificación</option>
                {Object.entries(CALIFICACION_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div className="hv-form-group hv-form-group--full">
              <label>Observaciones</label>
              <textarea rows={3} value={form.observaciones} onChange={e => set('observaciones', e.target.value)} placeholder="Comentarios de la evaluación…" />
            </div>
          </div>
          <div className="hv-modal-footer">
            <button type="button" className="hv-btn hv-btn--ghost" onClick={onCerrar}>Cancelar</button>
            <button type="submit" className="hv-btn hv-btn--primary" disabled={guardando}>
              {guardando ? <Loader2 size={14} className="hv-spin" /> : null}
              {guardando ? 'Guardando…' : datos?.id ? 'Guardar cambios' : 'Registrar'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

// ── Modal Observación ─────────────────────────────────────────────────────────
function ModalObservacion({ datos, onGuardar, onCerrar, guardando }) {
  const [comentario, setComentario] = useState(datos?.comentario ?? '')

  return (
    <motion.div className="hv-overlay" variants={overlayV} initial="hidden" animate="visible" exit="exit"
      onClick={onCerrar}>
      <motion.div className="hv-modal hv-modal--sm" variants={modalV} onClick={e => e.stopPropagation()}>
        <div className="hv-modal-header">
          <h3>{datos?.id ? 'Editar observación' : 'Agregar observación'}</h3>
          <button className="hv-modal-close" onClick={onCerrar}><X size={16} /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); onGuardar({ comentario }) }} className="hv-modal-body">
          <div className="hv-form-group hv-form-group--full">
            <label>Comentario *</label>
            <textarea rows={4} value={comentario} onChange={e => setComentario(e.target.value)} placeholder="Escriba la observación interna…" required />
          </div>
          <div className="hv-modal-footer">
            <button type="button" className="hv-btn hv-btn--ghost" onClick={onCerrar}>Cancelar</button>
            <button type="submit" className="hv-btn hv-btn--primary" disabled={guardando || !comentario.trim()}>
              {guardando ? <Loader2 size={14} className="hv-spin" /> : null}
              {guardando ? 'Guardando…' : datos?.id ? 'Guardar' : 'Agregar'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function HojaVida({ usuario, permisos }) {
  // Vista
  const [vista,         setVista]         = useState('lista')
  const [seleccionado,  setSeleccionado]  = useState(null) // latest contratacion row

  // Lista
  const [contrataciones, setContrataciones] = useState([])
  const [cargando,        setCargando]       = useState(true)
  const [busq,            setBusq]           = useState('')
  const [filtroEstado,    setFiltroEstado]   = useState('')
  const [filtroEstamento, setFiltroEstamento]= useState('')
  const [pagina,          setPagina]         = useState(1)
  const [mostrarFiltros,  setMostrarFiltros] = useState(false)

  // Detalle
  const [hvPersona,     setHvPersona]     = useState(null)
  const [historial,     setHistorial]     = useState([])
  const [capacitaciones,setCapacitaciones]= useState([])
  const [evaluaciones,  setEvaluaciones]  = useState([])
  const [observaciones, setObservaciones] = useState([])
  const [documentos,    setDocumentos]    = useState([])
  const [ausencias,     setAusencias]     = useState([])
  const [auditLogs,     setAuditLogs]     = useState([])
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [tabActiva,     setTabActiva]     = useState('info_personal')

  // Modal
  const [modal,    setModal]    = useState(null) // { tipo, datos? }
  const [guardando,setGuardando]= useState(false)
  const [toast,    setToast]    = useState(null) // { tipo: 'ok'|'error', msg }
  const toastRef = useRef(null)

  // ── Carga lista ──────────────────────────────────────────────────────────
  useEffect(() => {
    cargarLista()
  }, [])

  async function cargarLista() {
    setCargando(true)
    const { data } = await supabase
      .from('contrataciones')
      .select('id, nombre_completo, rut, cargo, estamento, tipo_contrato, fecha_termino, horas, correo, telefono, creado_en')
      .order('nombre_completo', { ascending: true })
    setCargando(false)
    if (!data) return
    // Deduplicar por RUT, quedarse con la primera aparición (ya ordenado por nombre)
    const visto = new Set()
    const dedup = []
    for (const c of data) {
      const rut = (c.rut ?? '').replace(/[^0-9kK]/g, '').toUpperCase()
      const key  = rut || c.nombre_completo?.toLowerCase()
      if (!key || visto.has(key)) continue
      visto.add(key)
      dedup.push(c)
    }
    setContrataciones(dedup)
  }

  // ── Filtrado y paginación ────────────────────────────────────────────────
  const personasFiltradas = useMemo(() => {
    const q = busq.toLowerCase().trim()
    return contrataciones.filter(c => {
      if (q) {
        const rq = q.replace(/[^0-9k]/g, '')
        const ok = c.nombre_completo?.toLowerCase().includes(q)
          || (rq && c.rut?.toLowerCase().replace(/[^0-9k]/g, '').includes(rq))
          || c.cargo?.toLowerCase().includes(q)
          || c.correo?.toLowerCase().includes(q)
        if (!ok) return false
      }
      if (filtroEstamento && c.estamento !== filtroEstamento) return false
      if (filtroEstado) {
        const est = calcularEstadoContrato(c.fecha_termino)
        if (est !== filtroEstado) return false
      }
      return true
    })
  }, [contrataciones, busq, filtroEstamento, filtroEstado])

  const totalPaginas = Math.max(1, Math.ceil(personasFiltradas.length / POR_PAGINA))
  const paginaActual = Math.min(pagina, totalPaginas)
  const personasPagina = personasFiltradas.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA)

  useEffect(() => { setPagina(1) }, [busq, filtroEstamento, filtroEstado])

  // ── Abrir detalle ────────────────────────────────────────────────────────
  async function abrirDetalle(persona) {
    setSeleccionado(persona)
    setVista('detalle')
    setTabActiva('info_personal')
    cargarDetalle(persona)
  }

  async function cargarDetalle(persona) {
    if (!persona) return
    setCargandoDetalle(true)
    const rut = (persona.rut ?? '').replace(/[^0-9kK]/g, '').toUpperCase()

    // 1. Upsert hv_personas (crea si no existe)
    const { data: hvRaw } = await supabase.from('hv_personas')
      .upsert({ rut }, { onConflict: 'rut', ignoreDuplicates: true })
      .select()

    const { data: hvData } = await supabase.from('hv_personas')
      .select('*').eq('rut', rut).maybeSingle()
    setHvPersona(hvData)

    // 2. Cargar todos los datos en paralelo
    const [
      { data: hist },
      { data: caps },
      { data: evals },
      { data: obs },
      { data: docs },
      { data: aus },
      { data: audit },
    ] = await Promise.all([
      supabase.from('hv_historial_laboral').select('*').eq('rut', rut).order('fecha_evento', { ascending: false }),
      supabase.from('hv_capacitaciones').select('*').eq('rut', rut).order('fecha_inicio', { ascending: false }),
      supabase.from('hv_evaluaciones').select('*').eq('rut', rut).order('fecha_evaluacion', { ascending: false }),
      supabase.from('hv_observaciones').select('*').eq('rut', rut).order('creado_en', { ascending: false }),
      // Documentos: busca por todas las contrataciones del rut
      supabase.from('personal_documentos')
        .select('*, contratacion:contratacion_id(nombre_completo, rut)')
        .eq('contratacion_id', persona.id)
        .order('subido_en', { ascending: false }),
      // Ausencias por nombre
      supabase.from('ausencias')
        .select('id, tipo_ausencia, fecha_inicio, fecha_fin, dias, estado, creado_en')
        .ilike('nombre_funcionario', `%${persona.nombre_completo ?? ''}%`)
        .order('fecha_inicio', { ascending: false })
        .limit(50),
      // Auditoría
      supabase.from('audit_logs')
        .select('id, accion, modulo, bien_nombre, usuario_nombre, created_at')
        .ilike('bien_nombre', `%${persona.nombre_completo ?? ''}%`)
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    setHistorial(hist ?? [])
    setCapacitaciones(caps ?? [])
    setEvaluaciones(evals ?? [])
    setObservaciones(obs ?? [])
    setDocumentos(docs ?? [])
    setAusencias(aus ?? [])
    setAuditLogs(audit ?? [])
    setCargandoDetalle(false)
  }

  // ── Toast ────────────────────────────────────────────────────────────────
  function mostrarToast(tipo, msg) {
    clearTimeout(toastRef.current)
    setToast({ tipo, msg })
    toastRef.current = setTimeout(() => setToast(null), 3500)
  }

  // ── Auditoría ────────────────────────────────────────────────────────────
  async function registrarAuditoria(accion, descripcion) {
    await supabase.rpc('log_auditoria', {
      p_accion:      accion,
      p_modulo:      'hoja_vida',
      p_bien_nombre: seleccionado?.nombre_completo ?? '',
      p_bien_id:     hvPersona?.id ?? null,
      p_cambios:     [],
    }).catch(() => {})
  }

  // ── Guardar info personal ────────────────────────────────────────────────
  async function handleGuardarInfoPersonal(form) {
    setGuardando(true)
    const rut = (seleccionado.rut ?? '').replace(/[^0-9kK]/g, '').toUpperCase()
    const { error } = await supabase.from('hv_personas').update({
      ...form,
      actualizado_por_id:     usuario.id,
      actualizado_por_nombre: usuario.nombre,
    }).eq('rut', rut)
    setGuardando(false)
    if (error) { mostrarToast('error', 'Error al guardar información personal'); return }
    setModal(null)
    mostrarToast('ok', 'Información personal actualizada')
    await registrarAuditoria('editar', 'Información personal actualizada')
    cargarDetalle(seleccionado)
  }

  // ── Guardar info laboral ─────────────────────────────────────────────────
  async function handleGuardarInfoLaboral(form) {
    setGuardando(true)
    const rut = (seleccionado.rut ?? '').replace(/[^0-9kK]/g, '').toUpperCase()
    const { error } = await supabase.from('hv_personas').update({
      ...form,
      actualizado_por_id:     usuario.id,
      actualizado_por_nombre: usuario.nombre,
    }).eq('rut', rut)
    setGuardando(false)
    if (error) { mostrarToast('error', 'Error al guardar información laboral'); return }
    setModal(null)
    mostrarToast('ok', 'Información laboral actualizada')
    await registrarAuditoria('editar', 'Información laboral actualizada')
    cargarDetalle(seleccionado)
  }

  // ── Historial laboral ────────────────────────────────────────────────────
  async function handleGuardarHistorial(form) {
    setGuardando(true)
    const rut = (seleccionado.rut ?? '').replace(/[^0-9kK]/g, '').toUpperCase()
    const payload = {
      ...form,
      rut,
      creado_por_id:     usuario.id,
      creado_por_nombre: usuario.nombre,
    }
    const esEdicion = !!form.id
    const op = esEdicion
      ? supabase.from('hv_historial_laboral').update(payload).eq('id', form.id)
      : supabase.from('hv_historial_laboral').insert(payload)
    const { error } = await op
    setGuardando(false)
    if (error) { mostrarToast('error', 'Error al guardar el evento'); return }
    setModal(null)
    mostrarToast('ok', esEdicion ? 'Evento actualizado' : 'Evento registrado')
    await registrarAuditoria(esEdicion ? 'editar' : 'crear', 'Historial laboral')
    cargarDetalle(seleccionado)
  }

  async function handleEliminarHistorial(id) {
    const { error } = await supabase.from('hv_historial_laboral').delete().eq('id', id)
    if (error) { mostrarToast('error', 'Error al eliminar el evento'); return }
    setModal(null)
    mostrarToast('ok', 'Evento eliminado')
    await registrarAuditoria('eliminar', 'Historial laboral')
    cargarDetalle(seleccionado)
  }

  // ── Capacitaciones ───────────────────────────────────────────────────────
  async function handleGuardarCapacitacion(form) {
    setGuardando(true)
    const rut = (seleccionado.rut ?? '').replace(/[^0-9kK]/g, '').toUpperCase()
    const payload = {
      ...form,
      rut,
      horas: form.horas ? Number(form.horas) : null,
      fecha_inicio:   form.fecha_inicio   || null,
      fecha_termino:  form.fecha_termino  || null,
      creado_por_id:     usuario.id,
      creado_por_nombre: usuario.nombre,
    }
    const esEdicion = !!form.id
    const op = esEdicion
      ? supabase.from('hv_capacitaciones').update(payload).eq('id', form.id)
      : supabase.from('hv_capacitaciones').insert(payload)
    const { error } = await op
    setGuardando(false)
    if (error) { mostrarToast('error', 'Error al guardar la capacitación'); return }
    setModal(null)
    mostrarToast('ok', esEdicion ? 'Capacitación actualizada' : 'Capacitación registrada')
    await registrarAuditoria(esEdicion ? 'editar' : 'crear', 'Capacitación')
    cargarDetalle(seleccionado)
  }

  async function handleEliminarCapacitacion(id) {
    const { error } = await supabase.from('hv_capacitaciones').delete().eq('id', id)
    if (error) { mostrarToast('error', 'Error al eliminar'); return }
    setModal(null)
    mostrarToast('ok', 'Capacitación eliminada')
    await registrarAuditoria('eliminar', 'Capacitación')
    cargarDetalle(seleccionado)
  }

  // ── Evaluaciones ─────────────────────────────────────────────────────────
  async function handleGuardarEvaluacion(form) {
    setGuardando(true)
    const rut = (seleccionado.rut ?? '').replace(/[^0-9kK]/g, '').toUpperCase()
    const payload = {
      ...form,
      rut,
      puntaje: form.puntaje !== '' && form.puntaje != null ? Number(form.puntaje) : null,
      calificacion: form.calificacion || null,
      creado_por_id:     usuario.id,
      creado_por_nombre: usuario.nombre,
    }
    const esEdicion = !!form.id
    const op = esEdicion
      ? supabase.from('hv_evaluaciones').update(payload).eq('id', form.id)
      : supabase.from('hv_evaluaciones').insert(payload)
    const { error } = await op
    setGuardando(false)
    if (error) { mostrarToast('error', 'Error al guardar la evaluación'); return }
    setModal(null)
    mostrarToast('ok', esEdicion ? 'Evaluación actualizada' : 'Evaluación registrada')
    await registrarAuditoria(esEdicion ? 'editar' : 'crear', 'Evaluación')
    cargarDetalle(seleccionado)
  }

  async function handleEliminarEvaluacion(id) {
    const { error } = await supabase.from('hv_evaluaciones').delete().eq('id', id)
    if (error) { mostrarToast('error', 'Error al eliminar'); return }
    setModal(null)
    mostrarToast('ok', 'Evaluación eliminada')
    await registrarAuditoria('eliminar', 'Evaluación')
    cargarDetalle(seleccionado)
  }

  // ── Observaciones ────────────────────────────────────────────────────────
  async function handleGuardarObservacion(form) {
    setGuardando(true)
    const rut = (seleccionado.rut ?? '').replace(/[^0-9kK]/g, '').toUpperCase()
    const payload = {
      ...form,
      rut,
      creado_por_id:     usuario.id,
      creado_por_nombre: usuario.nombre,
    }
    const esEdicion = !!form.id
    const op = esEdicion
      ? supabase.from('hv_observaciones').update(payload).eq('id', form.id)
      : supabase.from('hv_observaciones').insert(payload)
    const { error } = await op
    setGuardando(false)
    if (error) { mostrarToast('error', 'Error al guardar la observación'); return }
    setModal(null)
    mostrarToast('ok', esEdicion ? 'Observación actualizada' : 'Observación agregada')
    await registrarAuditoria(esEdicion ? 'editar' : 'crear', 'Observación')
    cargarDetalle(seleccionado)
  }

  async function handleEliminarObservacion(id) {
    const { error } = await supabase.from('hv_observaciones').delete().eq('id', id)
    if (error) { mostrarToast('error', 'Error al eliminar'); return }
    setModal(null)
    mostrarToast('ok', 'Observación eliminada')
    await registrarAuditoria('eliminar', 'Observación')
    cargarDetalle(seleccionado)
  }

  // ── PDF export ───────────────────────────────────────────────────────────
  async function exportarPDF() {
    if (!seleccionado) return
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const doc = new jsPDF()
      const nombre = seleccionado.nombre_completo ?? 'Funcionario'
      doc.setFontSize(18)
      doc.setTextColor(26, 35, 126)
      doc.text('Hoja de Vida del Personal', 14, 20)
      doc.setFontSize(13)
      doc.setTextColor(0)
      doc.text(nombre, 14, 30)
      doc.setFontSize(10)
      doc.setTextColor(100)
      doc.text(`RUT: ${formatRut(seleccionado.rut)} · Cargo: ${seleccionado.cargo ?? '—'}`, 14, 38)
      doc.text(`Generado el ${new Date().toLocaleDateString('es-CL')} a las ${new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`, 14, 44)

      let y = 54
      const addSection = (title) => {
        doc.setFontSize(11)
        doc.setTextColor(26, 35, 126)
        doc.text(title, 14, y)
        y += 6
        doc.setDrawColor(180, 190, 220)
        doc.line(14, y, 196, y)
        y += 4
        doc.setTextColor(0)
        doc.setFontSize(10)
      }

      // Información laboral
      if (hvPersona) {
        addSection('Información Laboral')
        const filas = [
          ['Departamento', hvPersona.departamento ?? '—'],
          ['Jornada',      hvPersona.jornada ?? '—'],
          ['Fecha ingreso', hvPersona.fecha_ingreso ? formatFecha(hvPersona.fecha_ingreso) : '—'],
          ['Estado laboral', ESTADO_LABORAL_MAP[hvPersona.estado_laboral]?.label ?? hvPersona.estado_laboral ?? '—'],
          ['Jefatura directa', hvPersona.jefatura_directa ?? '—'],
        ]
        autoTable(doc, { startY: y, head: [], body: filas, margin: { left: 14 }, styles: { fontSize: 9 }, columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 } } })
        y = doc.lastAutoTable.finalY + 8
      }

      // Historial
      if (historial.length > 0) {
        if (y > 230) { doc.addPage(); y = 20 }
        addSection('Historial Laboral')
        autoTable(doc, {
          startY: y,
          head: [['Fecha', 'Tipo', 'Descripción']],
          body: historial.map(h => [formatFecha(h.fecha_evento), TIPO_HISTORIAL[h.tipo] ?? h.tipo, h.descripcion ?? '—']),
          margin: { left: 14 },
          styles: { fontSize: 8 },
        })
        y = doc.lastAutoTable.finalY + 8
      }

      // Capacitaciones
      if (capacitaciones.length > 0) {
        if (y > 230) { doc.addPage(); y = 20 }
        addSection('Capacitaciones')
        autoTable(doc, {
          startY: y,
          head: [['Curso', 'Institución', 'Horas', 'Fecha']],
          body: capacitaciones.map(c => [c.nombre_curso, c.institucion ?? '—', c.horas ?? '—', formatFecha(c.fecha_termino)]),
          margin: { left: 14 },
          styles: { fontSize: 8 },
        })
        y = doc.lastAutoTable.finalY + 8
      }

      // Evaluaciones
      if (evaluaciones.length > 0) {
        if (y > 230) { doc.addPage(); y = 20 }
        addSection('Evaluaciones')
        autoTable(doc, {
          startY: y,
          head: [['Fecha', 'Evaluador', 'Puntaje', 'Calificación']],
          body: evaluaciones.map(e => [formatFecha(e.fecha_evaluacion), e.evaluador ?? '—', e.puntaje ?? '—', CALIFICACION_MAP[e.calificacion]?.label ?? e.calificacion ?? '—']),
          margin: { left: 14 },
          styles: { fontSize: 8 },
        })
      }

      doc.save(`hoja_vida_${(nombre).replace(/\s+/g, '_')}.pdf`)
      mostrarToast('ok', 'PDF exportado correctamente')
      await registrarAuditoria('exportar', 'PDF Hoja de Vida')
    } catch {
      mostrarToast('error', 'Error al exportar el PDF')
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="hv-page">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className={`hv-toast hv-toast--${toast.tipo}`}
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
          >
            {toast.tipo === 'ok' ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── VISTA LISTA ──────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {vista === 'lista' && (
          <motion.div key="lista" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* Encabezado */}
            <div className="hv-page-header">
              <div>
                <h1 className="hv-page-title">Hoja de Vida del Personal</h1>
                <p className="hv-page-desc">Expediente digital del personal del establecimiento</p>
              </div>
            </div>

            {/* Barra de búsqueda y filtros */}
            <div className="hv-toolbar">
              <div className="hv-search-wrap">
                <Search size={15} className="hv-search-icon" />
                <input
                  className="hv-search"
                  placeholder="Buscar por nombre, RUT, cargo o correo…"
                  value={busq}
                  onChange={e => setBusq(e.target.value)}
                />
                {busq && (
                  <button className="hv-search-clear" onClick={() => setBusq('')}>
                    <X size={14} />
                  </button>
                )}
              </div>
              <button
                className={`hv-btn hv-btn--ghost ${mostrarFiltros ? 'hv-btn--active' : ''}`}
                onClick={() => setMostrarFiltros(f => !f)}
              >
                <Filter size={14} />
                Filtros
                {(filtroEstamento || filtroEstado) && <span className="hv-filter-dot" />}
              </button>
            </div>

            {/* Filtros expandibles */}
            <AnimatePresence>
              {mostrarFiltros && (
                <motion.div className="hv-filters"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}>
                  <div className="hv-filters-inner">
                    <div className="hv-form-group">
                      <label>Estamento</label>
                      <select value={filtroEstamento} onChange={e => setFiltroEstamento(e.target.value)}>
                        <option value="">Todos</option>
                        {Object.entries(ESTAMENTO_MAP).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                    <div className="hv-form-group">
                      <label>Estado contrato</label>
                      <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
                        <option value="">Todos</option>
                        <option value="vigente">Vigente</option>
                        <option value="por_vencer">Por vencer</option>
                        <option value="vencido">Vencido</option>
                      </select>
                    </div>
                    {(filtroEstamento || filtroEstado) && (
                      <button className="hv-btn hv-btn--ghost" onClick={() => { setFiltroEstamento(''); setFiltroEstado('') }}>
                        <X size={13} /> Limpiar
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Contador */}
            {!cargando && (
              <p className="hv-count">
                {personasFiltradas.length} funcionario{personasFiltradas.length !== 1 ? 's' : ''} encontrado{personasFiltradas.length !== 1 ? 's' : ''}
                {(busq || filtroEstamento || filtroEstado) && ` · mostrando ${personasPagina.length} de ${personasFiltradas.length}`}
              </p>
            )}

            {/* Tabla */}
            {cargando ? (
              <div className="hv-loading">
                <Loader2 size={28} className="hv-spin" />
                <span>Cargando personal…</span>
              </div>
            ) : personasFiltradas.length === 0 ? (
              <div className="hv-empty">
                <Users size={40} />
                <p>{busq || filtroEstamento || filtroEstado ? 'Sin resultados para los filtros aplicados' : 'No hay personal registrado'}</p>
                {(busq || filtroEstamento || filtroEstado) && (
                  <button className="hv-btn hv-btn--ghost" onClick={() => { setBusq(''); setFiltroEstamento(''); setFiltroEstado('') }}>
                    Limpiar filtros
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="hv-table-wrap">
                  <table className="hv-table">
                    <thead>
                      <tr>
                        <th>Funcionario</th>
                        <th>RUT</th>
                        <th>Cargo / Estamento</th>
                        <th>Contrato</th>
                        <th>Estado</th>
                        <th>Ingresado</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {personasPagina.map(c => {
                        const estado = calcularEstadoContrato(c.fecha_termino)
                        const antig  = calcularAntiguedad(c.creado_en?.slice(0, 10))
                        return (
                          <tr key={c.id} className="hv-table-row" onClick={() => abrirDetalle(c)}>
                            <td>
                              <div className="hv-persona-cell">
                                <div className="hv-avatar">{iniciales(c.nombre_completo)}</div>
                                <div>
                                  <p className="hv-persona-nombre">{c.nombre_completo}</p>
                                  {c.correo && <p className="hv-persona-sub">{c.correo}</p>}
                                </div>
                              </div>
                            </td>
                            <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{formatRut(c.rut)}</td>
                            <td>
                              <p style={{ margin: 0, fontSize: 13 }}>{c.cargo ?? '—'}</p>
                              {c.estamento && <p className="hv-persona-sub">{ESTAMENTO_MAP[c.estamento] ?? c.estamento}</p>}
                            </td>
                            <td>{CONTRATO_MAP[c.tipo_contrato] ?? c.tipo_contrato ?? '—'}</td>
                            <td><EstadoBadge estado={estado} /></td>
                            <td>
                              <p style={{ margin: 0, fontSize: 12 }}>{formatFechaCorta(c.creado_en?.slice(0, 10))}</p>
                              {antig && <p className="hv-persona-sub">{antig}</p>}
                            </td>
                            <td>
                              <button
                                className="hv-btn hv-btn--sm hv-btn--primary"
                                onClick={e => { e.stopPropagation(); abrirDetalle(c) }}
                              >
                                Ver HV <ChevronRight size={13} />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Paginación */}
                {totalPaginas > 1 && (
                  <div className="hv-pagination">
                    <button className="hv-btn hv-btn--ghost hv-btn--sm" disabled={paginaActual === 1} onClick={() => setPagina(p => p - 1)}>
                      Anterior
                    </button>
                    <span className="hv-pagination-info">Página {paginaActual} de {totalPaginas}</span>
                    <button className="hv-btn hv-btn--ghost hv-btn--sm" disabled={paginaActual === totalPaginas} onClick={() => setPagina(p => p + 1)}>
                      Siguiente
                    </button>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}

        {/* ── VISTA DETALLE ───────────────────────────────────────────────── */}
        {vista === 'detalle' && seleccionado && (
          <motion.div key="detalle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* Cabecera de retorno */}
            <div className="hv-detail-topbar">
              <button className="hv-btn hv-btn--ghost" onClick={() => { setVista('lista'); setSeleccionado(null) }}>
                <ArrowLeft size={15} /> Volver al listado
              </button>
              {permisos.exportar && (
                <button className="hv-btn hv-btn--ghost" onClick={exportarPDF}>
                  <Download size={14} /> Exportar PDF
                </button>
              )}
            </div>

            {cargandoDetalle ? (
              <div className="hv-loading">
                <Loader2 size={28} className="hv-spin" />
                <span>Cargando hoja de vida…</span>
              </div>
            ) : (
              <>
                {/* Encabezado del funcionario */}
                <div className="hv-detail-header">
                  <div className="hv-detail-avatar">{iniciales(seleccionado.nombre_completo)}</div>
                  <div className="hv-detail-info">
                    <h2 className="hv-detail-nombre">{seleccionado.nombre_completo}</h2>
                    <p className="hv-detail-cargo">{seleccionado.cargo ?? '—'} {seleccionado.estamento ? `· ${ESTAMENTO_MAP[seleccionado.estamento] ?? seleccionado.estamento}` : ''}</p>
                    <div className="hv-detail-meta">
                      {seleccionado.correo && <span><Mail size={12} />{seleccionado.correo}</span>}
                      {seleccionado.telefono && <span><Phone size={12} />{seleccionado.telefono}</span>}
                      <span><User size={12} />{formatRut(seleccionado.rut)}</span>
                    </div>
                  </div>
                  <div className="hv-detail-kpis">
                    <div className="hv-kpi">
                      <span className="hv-kpi-val">{documentos.length}</span>
                      <span className="hv-kpi-label">Documentos</span>
                    </div>
                    <div className="hv-kpi">
                      <span className="hv-kpi-val">{capacitaciones.length}</span>
                      <span className="hv-kpi-label">Capacitaciones</span>
                    </div>
                    <div className="hv-kpi">
                      <span className="hv-kpi-val">{evaluaciones.length}</span>
                      <span className="hv-kpi-label">Evaluaciones</span>
                    </div>
                    <div className="hv-kpi">
                      <span className="hv-kpi-val">{ausencias.length}</span>
                      <span className="hv-kpi-label">Ausencias</span>
                    </div>
                  </div>
                </div>

                {/* Estado y antigüedad */}
                <div className="hv-detail-badges">
                  <EstadoBadge estado={hvPersona?.estado_laboral ?? 'activo'} mapa={ESTADO_LABORAL_MAP} />
                  <EstadoBadge estado={calcularEstadoContrato(seleccionado.fecha_termino)} />
                  {(hvPersona?.fecha_ingreso || seleccionado.creado_en) && (
                    <span className="hv-badge" style={{ color: '#1a237e', background: '#e8eaf6', border: '1px solid #c5cae922' }}>
                      {calcularAntiguedad((hvPersona?.fecha_ingreso ?? seleccionado.creado_en?.slice(0, 10)))} de antigüedad
                    </span>
                  )}
                </div>

                {/* Tabs */}
                <div className="hv-tabs-wrap">
                  <div className="hv-tabs">
                    {TABS.map(t => (
                      <button
                        key={t.id}
                        className={`hv-tab ${tabActiva === t.id ? 'hv-tab--active' : ''}`}
                        onClick={() => setTabActiva(t.id)}
                      >
                        <t.Icon size={13} />
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Contenido de cada tab */}
                <div className="hv-tab-content">

                  {/* TAB: Información Personal */}
                  {tabActiva === 'info_personal' && (
                    <div className="hv-card">
                      <div className="hv-card-header">
                        <h3>Información Personal</h3>
                        {permisos.editar && (
                          <button className="hv-btn hv-btn--ghost hv-btn--sm" onClick={() => setModal({ tipo: 'info_personal' })}>
                            <Edit2 size={13} /> Editar
                          </button>
                        )}
                      </div>
                      <div className="hv-info-grid">
                        <InfoField label="RUT" value={formatRut(seleccionado.rut)} />
                        <InfoField label="Nombre completo" value={seleccionado.nombre_completo} />
                        <InfoField label="Fecha de nacimiento" value={formatFecha(hvPersona?.fecha_nacimiento)} />
                        <InfoField label="Edad" value={hvPersona?.fecha_nacimiento ? `${calcularEdad(hvPersona.fecha_nacimiento)} años` : null} />
                        <InfoField label="Estado civil" value={hvPersona?.estado_civil ? (
                          { soltero: 'Soltero/a', casado: 'Casado/a', conviviente: 'Conviviente', divorciado: 'Divorciado/a', viudo: 'Viudo/a', otro: 'Otro' }[hvPersona.estado_civil] ?? hvPersona.estado_civil
                        ) : null} />
                        <InfoField label="Dirección" value={hvPersona?.direccion} />
                        <InfoField label="Correo institucional" value={seleccionado.correo} icon={<Mail size={12} />} />
                        <InfoField label="Correo personal" value={hvPersona?.correo_personal} icon={<Mail size={12} />} />
                        <InfoField label="Teléfono" value={seleccionado.telefono} icon={<Phone size={12} />} />
                      </div>
                      {(hvPersona?.contacto_emergencia_nombre) && (
                        <div style={{ marginTop: 20 }}>
                          <p className="hv-section-label"><Phone size={12} /> Contacto de emergencia</p>
                          <div className="hv-info-grid">
                            <InfoField label="Nombre" value={hvPersona.contacto_emergencia_nombre} />
                            <InfoField label="Teléfono" value={hvPersona.contacto_emergencia_telefono} />
                            <InfoField label="Relación" value={hvPersona.contacto_emergencia_relacion} />
                          </div>
                        </div>
                      )}
                      {hvPersona?.observaciones_personales && (
                        <div className="hv-obs-block">
                          <p className="hv-section-label"><Info size={12} /> Observaciones personales</p>
                          <p className="hv-obs-text">{hvPersona.observaciones_personales}</p>
                        </div>
                      )}
                      {!hvPersona?.fecha_nacimiento && !hvPersona?.direccion && !hvPersona?.estado_civil && (
                        <EmptyState msg="Información personal pendiente de completar" accion={permisos.editar ? () => setModal({ tipo: 'info_personal' }) : null} btnLabel="Completar ahora" />
                      )}
                    </div>
                  )}

                  {/* TAB: Información Laboral */}
                  {tabActiva === 'info_laboral' && (
                    <div className="hv-card">
                      <div className="hv-card-header">
                        <h3>Información Laboral</h3>
                        {permisos.editar && (
                          <button className="hv-btn hv-btn--ghost hv-btn--sm" onClick={() => setModal({ tipo: 'info_laboral' })}>
                            <Edit2 size={13} /> Editar
                          </button>
                        )}
                      </div>
                      <div className="hv-info-grid">
                        <InfoField label="Cargo" value={seleccionado.cargo} />
                        <InfoField label="Estamento" value={ESTAMENTO_MAP[seleccionado.estamento] ?? seleccionado.estamento} />
                        <InfoField label="Departamento / Unidad" value={hvPersona?.departamento} />
                        <InfoField label="Jornada" value={hvPersona?.jornada ? ({ completa: 'Completa', media: 'Media jornada', parcial: 'Parcial', otro: 'Otro' })[hvPersona.jornada] : null} />
                        <InfoField label="Horas contratadas" value={seleccionado.horas != null ? `${seleccionado.horas} hrs` : null} />
                        <InfoField label="Tipo de contrato" value={CONTRATO_MAP[seleccionado.tipo_contrato] ?? seleccionado.tipo_contrato} />
                        <InfoField label="Fecha de ingreso" value={formatFecha(hvPersona?.fecha_ingreso ?? seleccionado.creado_en?.slice(0, 10))} />
                        <InfoField label="Fecha de término" value={formatFecha(seleccionado.fecha_termino)} />
                        <InfoField label="Antigüedad" value={calcularAntiguedad(hvPersona?.fecha_ingreso ?? seleccionado.creado_en?.slice(0, 10))} />
                        <InfoField label="Estado laboral" value={ESTADO_LABORAL_MAP[hvPersona?.estado_laboral ?? 'activo']?.label} />
                        <InfoField label="Jefatura directa" value={hvPersona?.jefatura_directa} />
                      </div>
                    </div>
                  )}

                  {/* TAB: Historial Laboral */}
                  {tabActiva === 'historial' && (
                    <div className="hv-card">
                      <div className="hv-card-header">
                        <h3>Historial Laboral</h3>
                        {permisos.crear && (
                          <button className="hv-btn hv-btn--primary hv-btn--sm" onClick={() => setModal({ tipo: 'historial' })}>
                            <Plus size={13} /> Registrar evento
                          </button>
                        )}
                      </div>
                      {historial.length === 0 ? (
                        <EmptyState msg="Sin eventos registrados en el historial laboral" accion={permisos.crear ? () => setModal({ tipo: 'historial' }) : null} btnLabel="Registrar primer evento" />
                      ) : (
                        <div className="hv-timeline">
                          {historial.map(h => (
                            <div key={h.id} className="hv-timeline-item">
                              <div className="hv-timeline-dot" />
                              <div className="hv-timeline-body">
                                <div className="hv-timeline-top">
                                  <span className="hv-badge" style={{ color: '#1a237e', background: '#e8eaf6', border: 'none', fontSize: 11 }}>
                                    {TIPO_HISTORIAL[h.tipo] ?? h.tipo}
                                  </span>
                                  <span className="hv-timeline-date">{formatFechaCorta(h.fecha_evento)}</span>
                                  {(permisos.editar || permisos.eliminar) && (
                                    <div className="hv-row-actions">
                                      {permisos.editar && (
                                        <button className="hv-icon-btn" onClick={() => setModal({ tipo: 'historial', datos: h })}>
                                          <Edit2 size={13} />
                                        </button>
                                      )}
                                      {permisos.eliminar && (
                                        <button className="hv-icon-btn hv-icon-btn--danger" onClick={() => setModal({ tipo: 'confirm_historial', id: h.id, msg: '¿Eliminar este evento del historial?' })}>
                                          <Trash2 size={13} />
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                                {h.descripcion && <p className="hv-timeline-desc">{h.descripcion}</p>}
                                {(h.cargo_anterior || h.cargo_nuevo) && (
                                  <p className="hv-timeline-cargos">
                                    {h.cargo_anterior && <span>Antes: <b>{h.cargo_anterior}</b></span>}
                                    {h.cargo_anterior && h.cargo_nuevo && <ChevronRight size={11} />}
                                    {h.cargo_nuevo    && <span>Después: <b>{h.cargo_nuevo}</b></span>}
                                  </p>
                                )}
                                {h.creado_por_nombre && (
                                  <p className="hv-timeline-meta">Registrado por {h.creado_por_nombre}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB: Documentos */}
                  {tabActiva === 'documentos' && (
                    <div className="hv-card">
                      <div className="hv-card-header">
                        <h3>Documentos</h3>
                        <p className="hv-card-sub">Los documentos se gestionan desde el módulo Personal → Documentos</p>
                      </div>
                      {documentos.length === 0 ? (
                        <EmptyState msg="Sin documentos cargados para este funcionario" />
                      ) : (
                        <div className="hv-docs-grid">
                          {documentos.map(d => (
                            <div key={d.id} className="hv-doc-card">
                              <FileText size={22} className="hv-doc-icon" />
                              <div className="hv-doc-info">
                                <p className="hv-doc-nombre">{d.nombre}</p>
                                <p className="hv-doc-meta">
                                  {TIPOS_DOC_MAP[d.tipo_doc] ?? d.tipo_doc}
                                  {d.tamanio ? ` · ${formatBytes(d.tamanio)}` : ''}
                                </p>
                                <p className="hv-doc-meta">{formatFechaCorta(d.subido_en?.slice(0, 10))}</p>
                              </div>
                              {d.url && (
                                <a href={d.url} target="_blank" rel="noreferrer" className="hv-btn hv-btn--ghost hv-btn--sm" onClick={e => e.stopPropagation()}>
                                  <Download size={12} />
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB: Capacitaciones */}
                  {tabActiva === 'capacitaciones' && (
                    <div className="hv-card">
                      <div className="hv-card-header">
                        <h3>Capacitaciones</h3>
                        {permisos.crear && (
                          <button className="hv-btn hv-btn--primary hv-btn--sm" onClick={() => setModal({ tipo: 'capacitacion' })}>
                            <Plus size={13} /> Agregar
                          </button>
                        )}
                      </div>
                      {capacitaciones.length === 0 ? (
                        <EmptyState msg="Sin capacitaciones registradas" accion={permisos.crear ? () => setModal({ tipo: 'capacitacion' }) : null} btnLabel="Registrar primera capacitación" />
                      ) : (
                        <div className="hv-items-list">
                          {capacitaciones.map(c => (
                            <div key={c.id} className="hv-item">
                              <div className="hv-item-icon"><BookOpen size={16} /></div>
                              <div className="hv-item-body">
                                <div className="hv-item-top">
                                  <p className="hv-item-title">{c.nombre_curso}</p>
                                  {(permisos.editar || permisos.eliminar) && (
                                    <div className="hv-row-actions">
                                      {permisos.editar && <button className="hv-icon-btn" onClick={() => setModal({ tipo: 'capacitacion', datos: c })}><Edit2 size={13} /></button>}
                                      {permisos.eliminar && <button className="hv-icon-btn hv-icon-btn--danger" onClick={() => setModal({ tipo: 'confirm_cap', id: c.id, msg: '¿Eliminar esta capacitación?' })}><Trash2 size={13} /></button>}
                                    </div>
                                  )}
                                </div>
                                <p className="hv-item-sub">
                                  {c.institucion && <span>{c.institucion}</span>}
                                  {c.horas && <span>{c.horas} hrs</span>}
                                  {c.fecha_termino && <span>{formatFechaCorta(c.fecha_termino)}</span>}
                                </p>
                                {c.observaciones && <p className="hv-item-obs">{c.observaciones}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB: Evaluaciones */}
                  {tabActiva === 'evaluaciones' && (
                    <div className="hv-card">
                      <div className="hv-card-header">
                        <h3>Evaluaciones</h3>
                        {permisos.crear && (
                          <button className="hv-btn hv-btn--primary hv-btn--sm" onClick={() => setModal({ tipo: 'evaluacion' })}>
                            <Plus size={13} /> Agregar
                          </button>
                        )}
                      </div>
                      {evaluaciones.length === 0 ? (
                        <EmptyState msg="Sin evaluaciones registradas" accion={permisos.crear ? () => setModal({ tipo: 'evaluacion' }) : null} btnLabel="Registrar primera evaluación" />
                      ) : (
                        <div className="hv-items-list">
                          {evaluaciones.map(e => (
                            <div key={e.id} className="hv-item">
                              <div className="hv-item-icon"><Star size={16} /></div>
                              <div className="hv-item-body">
                                <div className="hv-item-top">
                                  <div>
                                    <p className="hv-item-title">{formatFechaCorta(e.fecha_evaluacion)}</p>
                                    {e.evaluador && <p className="hv-item-sub-sm">Evaluador: {e.evaluador}</p>}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    {e.calificacion && (
                                      <span className="hv-badge" style={{ color: CALIFICACION_MAP[e.calificacion]?.color, background: CALIFICACION_MAP[e.calificacion]?.bg }}>
                                        {CALIFICACION_MAP[e.calificacion]?.label}
                                      </span>
                                    )}
                                    {e.puntaje != null && <span className="hv-puntaje">{Number(e.puntaje).toFixed(1)} pts</span>}
                                    {(permisos.editar || permisos.eliminar) && (
                                      <div className="hv-row-actions">
                                        {permisos.editar && <button className="hv-icon-btn" onClick={() => setModal({ tipo: 'evaluacion', datos: e })}><Edit2 size={13} /></button>}
                                        {permisos.eliminar && <button className="hv-icon-btn hv-icon-btn--danger" onClick={() => setModal({ tipo: 'confirm_eval', id: e.id, msg: '¿Eliminar esta evaluación?' })}><Trash2 size={13} /></button>}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {e.observaciones && <p className="hv-item-obs">{e.observaciones}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB: Permisos y Licencias */}
                  {tabActiva === 'ausencias' && (
                    <div className="hv-card">
                      <div className="hv-card-header">
                        <h3>Permisos y Licencias</h3>
                        <p className="hv-card-sub">Datos desde el módulo de Ausencias</p>
                      </div>
                      {ausencias.length === 0 ? (
                        <EmptyState msg="Sin permisos ni licencias registrados para este funcionario" />
                      ) : (
                        <div className="hv-table-wrap">
                          <table className="hv-table">
                            <thead>
                              <tr>
                                <th>Tipo</th>
                                <th>Fecha inicio</th>
                                <th>Fecha fin</th>
                                <th>Días</th>
                                <th>Estado</th>
                              </tr>
                            </thead>
                            <tbody>
                              {ausencias.map(a => (
                                <tr key={a.id}>
                                  <td>{a.tipo_ausencia ?? '—'}</td>
                                  <td>{formatFecha(a.fecha_inicio)}</td>
                                  <td>{formatFecha(a.fecha_fin)}</td>
                                  <td>{a.dias ?? '—'}</td>
                                  <td>
                                    <span className="hv-badge" style={{
                                      color: a.estado === 'aprobada' ? '#16a34a' : a.estado === 'rechazada' ? '#dc2626' : '#d97706',
                                      background: a.estado === 'aprobada' ? '#f0fdf4' : a.estado === 'rechazada' ? '#fef2f2' : '#fffbeb',
                                    }}>
                                      {a.estado ?? '—'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB: Observaciones */}
                  {tabActiva === 'observaciones' && (
                    <div className="hv-card">
                      <div className="hv-card-header">
                        <h3>Observaciones internas</h3>
                        {permisos.crear && (
                          <button className="hv-btn hv-btn--primary hv-btn--sm" onClick={() => setModal({ tipo: 'observacion' })}>
                            <Plus size={13} /> Agregar
                          </button>
                        )}
                      </div>
                      {observaciones.length === 0 ? (
                        <EmptyState msg="Sin observaciones registradas" accion={permisos.crear ? () => setModal({ tipo: 'observacion' }) : null} btnLabel="Agregar observación" />
                      ) : (
                        <div className="hv-items-list">
                          {observaciones.map(o => (
                            <div key={o.id} className="hv-obs-item">
                              <div className="hv-obs-body">
                                <p className="hv-obs-text">{o.comentario}</p>
                                <p className="hv-timeline-meta">
                                  {o.creado_por_nombre && `${o.creado_por_nombre} · `}
                                  {formatFechaCorta(o.creado_en?.slice(0, 10))}
                                </p>
                              </div>
                              {(permisos.editar || permisos.eliminar) && (
                                <div className="hv-row-actions hv-row-actions--end">
                                  {permisos.editar && <button className="hv-icon-btn" onClick={() => setModal({ tipo: 'observacion', datos: o })}><Edit2 size={13} /></button>}
                                  {permisos.eliminar && <button className="hv-icon-btn hv-icon-btn--danger" onClick={() => setModal({ tipo: 'confirm_obs', id: o.id, msg: '¿Eliminar esta observación?' })}><Trash2 size={13} /></button>}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB: Historial del Sistema */}
                  {tabActiva === 'historial_sys' && (
                    <div className="hv-card">
                      <div className="hv-card-header">
                        <h3>Historial del Sistema</h3>
                        <p className="hv-card-sub">Acciones registradas en auditoría relacionadas con este funcionario</p>
                      </div>
                      {auditLogs.length === 0 ? (
                        <EmptyState msg="Sin registros de auditoría para este funcionario" />
                      ) : (
                        <div className="hv-table-wrap">
                          <table className="hv-table">
                            <thead>
                              <tr>
                                <th>Fecha</th>
                                <th>Acción</th>
                                <th>Módulo</th>
                                <th>Usuario</th>
                              </tr>
                            </thead>
                            <tbody>
                              {auditLogs.map(l => (
                                <tr key={l.id}>
                                  <td style={{ fontSize: 12, color: '#64748b' }}>
                                    {new Date(l.created_at).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}
                                  </td>
                                  <td>
                                    <span className="hv-badge" style={{ color: '#1a237e', background: '#e8eaf6' }}>
                                      {l.accion}
                                    </span>
                                  </td>
                                  <td style={{ fontSize: 12 }}>{l.modulo ?? '—'}</td>
                                  <td style={{ fontSize: 12 }}>{l.usuario_nombre ?? '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modales ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {modal?.tipo === 'info_personal' && (
          <ModalInfoPersonal
            datos={hvPersona}
            onGuardar={handleGuardarInfoPersonal}
            onCerrar={() => setModal(null)}
            guardando={guardando}
          />
        )}
        {modal?.tipo === 'info_laboral' && (
          <ModalInfoLaboral
            datos={hvPersona}
            onGuardar={handleGuardarInfoLaboral}
            onCerrar={() => setModal(null)}
            guardando={guardando}
          />
        )}
        {modal?.tipo === 'historial' && (
          <ModalHistorial
            datos={modal.datos}
            onGuardar={handleGuardarHistorial}
            onCerrar={() => setModal(null)}
            guardando={guardando}
          />
        )}
        {modal?.tipo === 'capacitacion' && (
          <ModalCapacitacion
            datos={modal.datos}
            onGuardar={handleGuardarCapacitacion}
            onCerrar={() => setModal(null)}
            guardando={guardando}
          />
        )}
        {modal?.tipo === 'evaluacion' && (
          <ModalEvaluacion
            datos={modal.datos}
            onGuardar={handleGuardarEvaluacion}
            onCerrar={() => setModal(null)}
            guardando={guardando}
          />
        )}
        {modal?.tipo === 'observacion' && (
          <ModalObservacion
            datos={modal.datos}
            onGuardar={handleGuardarObservacion}
            onCerrar={() => setModal(null)}
            guardando={guardando}
          />
        )}
        {modal?.tipo?.startsWith('confirm_') && (
          <ConfirmModal
            mensaje={modal.msg}
            onCancelar={() => setModal(null)}
            cargando={guardando}
            onConfirmar={async () => {
              setGuardando(true)
              if (modal.tipo === 'confirm_historial') await handleEliminarHistorial(modal.id)
              if (modal.tipo === 'confirm_cap')       await handleEliminarCapacitacion(modal.id)
              if (modal.tipo === 'confirm_eval')      await handleEliminarEvaluacion(modal.id)
              if (modal.tipo === 'confirm_obs')       await handleEliminarObservacion(modal.id)
              setGuardando(false)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Helpers de UI ─────────────────────────────────────────────────────────────
function InfoField({ label, value, icon }) {
  return (
    <div className="hv-info-field">
      <span className="hv-info-label">{icon && <span style={{ marginRight: 4 }}>{icon}</span>}{label}</span>
      <span className="hv-info-value">{value ?? <span className="hv-info-empty">—</span>}</span>
    </div>
  )
}

function EmptyState({ msg, accion, btnLabel }) {
  return (
    <div className="hv-empty-state">
      <Info size={28} />
      <p>{msg}</p>
      {accion && (
        <button className="hv-btn hv-btn--ghost hv-btn--sm" onClick={accion}>
          <Plus size={13} /> {btnLabel}
        </button>
      )}
    </div>
  )
}
