import { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Search, Plus, Edit2, Trash2, FileText, Download,
  Loader2, X, BookOpen, Calendar,
  Briefcase, Phone, Mail,
  ChevronRight, User, Users, Star, Info,
  AlertTriangle, CheckCircle2, Filter, AlertCircle,
} from 'lucide-react'
import { supabase } from '../supabase'
import './HojaVida.css'

const POR_PAGINA = 12

const overlayV = { hidden: { opacity: 0 }, visible: { opacity: 1 }, exit: { opacity: 0 } }
const modalV = {
  hidden:  { opacity: 0, scale: 0.95, y: 12 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 400, damping: 30 } },
  exit:    { opacity: 0, scale: 0.95, y: 8, transition: { duration: 0.15 } },
}

const TABS = [
  { id: 'info_personal',  label: 'Personal',       Icon: User },
  { id: 'info_laboral',   label: 'Laboral',         Icon: Briefcase },
  { id: 'capacitaciones', label: 'Capacitaciones',  Icon: BookOpen },
  { id: 'evaluaciones',   label: 'Evaluaciones',    Icon: Star },
  { id: 'ausencias',      label: 'Permisos y Lic.', Icon: Calendar },
  { id: 'anotaciones',    label: 'Anotaciones',     Icon: AlertCircle },
]

const TIPO_HISTORIAL = {
  ingreso: 'Ingreso', ascenso: 'Ascenso', cambio_cargo: 'Cambio de cargo',
  cambio_contrato: 'Cambio de contrato', cambio_departamento: 'Cambio de depto.',
  renovacion: 'Renovación', reincorporacion: 'Reincorporación', termino: 'Término', otro: 'Otro',
}

const CALIFICACION_MAP = {
  sobresaliente: { label: 'Sobresaliente', color: '#16a34a', bg: '#f0fdf4' },
  muy_bien:      { label: 'Muy bien',      color: '#0891b2', bg: '#ecfeff' },
  bien:          { label: 'Bien',          color: '#d97706', bg: '#fffbeb' },
  deficiente:    { label: 'Deficiente',    color: '#dc2626', bg: '#fef2f2' },
  otro:          { label: 'Otro',          color: '#6b7280', bg: '#f9fafb' },
}

const ESTADO_LABORAL_MAP = {
  activo:   { label: 'Activo',   color: '#16a34a', bg: '#f0fdf4' },
  inactivo: { label: 'Inactivo', color: '#6b7280', bg: '#f9fafb' },
  licencia: { label: 'Licencia', color: '#d97706', bg: '#fffbeb' },
  comision: { label: 'Comisión', color: '#0891b2', bg: '#ecfeff' },
  otro:     { label: 'Otro',     color: '#6b7280', bg: '#f9fafb' },
}

const ESTADO_CONTRATO_MAP = {
  vigente:     { label: 'Vigente',      color: '#16a34a', bg: '#f0fdf4' },
  por_vencer:  { label: 'Por vencer',   color: '#d97706', bg: '#fffbeb' },
  finalizado:  { label: 'Finalizado',   color: '#64748b', bg: '#f8fafc' },
  no_renovado: { label: 'No renovado',  color: '#dc2626', bg: '#fef2f2' },
  suspendido:  { label: 'Suspendido',   color: '#9333ea', bg: '#faf5ff' },
  vencido:     { label: 'Vencido',      color: '#dc2626', bg: '#fef2f2' },
}


const ESTAMENTO_MAP = {
  docente: 'Docente', asistente: 'Asistente de la Educación',
  administrativo: 'Administrativo', directivo: 'Directivo', otro: 'Otro',
}

const CONTRATO_MAP = {
  titular: 'Titular', contrata: 'Contrata', honorarios: 'Honorarios',
  reemplazo: 'Reemplazo', planta: 'Planta', otro: 'Otro',
}

const TIPOS_ANOTACION = [
  { value: 'atraso',                  label: 'Atraso',                   cls: 'neg' },
  { value: 'inasistencia',            label: 'Inasistencia',             cls: 'neg' },
  { value: 'ausencia_injustificada',  label: 'Ausencia injustificada',   cls: 'neg' },
  { value: 'licencia_medica',         label: 'Licencia médica',          cls: 'neu' },
  { value: 'felicitacion',            label: 'Felicitación',             cls: 'pos' },
  { value: 'reconocimiento',          label: 'Reconocimiento',           cls: 'pos' },
  { value: 'llamado_atencion',        label: 'Llamado de atención',      cls: 'neg' },
  { value: 'amonestacion',            label: 'Amonestación',             cls: 'neg' },
  { value: 'observacion_jefatura',    label: 'Observación de jefatura',  cls: 'neu' },
  { value: 'participacion_destacada', label: 'Participación destacada',  cls: 'pos' },
  { value: 'reunion_direccion',       label: 'Reunión con dirección',    cls: 'info' },
  { value: 'otro',                    label: 'Otro',                     cls: 'info' },
]
const TIPO_ANOT_MAP = Object.fromEntries(TIPOS_ANOTACION.map(t => [t.value, t]))

const ESTADO_ANOT_MAP = {
  activo:    { label: 'Activo',    color: '#d97706', bg: '#fffbeb' },
  resuelto:  { label: 'Resuelto',  color: '#16a34a', bg: '#f0fdf4' },
  archivado: { label: 'Archivado', color: '#64748b', bg: '#f8fafc' },
}

const TIPO_AUSENCIA_MAP = {
  licencia_medica: 'Licencia médica', permiso_administrativo: 'Permiso administrativo',
  vacaciones: 'Vacaciones', cometido: 'Cometido funcionario', justificativo: 'Justificativo',
  feriado_legal: 'Feriado legal', otro: 'Otro',
}

const ESTADO_AUSENCIA_MAP = {
  aprobada:   { label: 'Aprobada',   color: '#16a34a', bg: '#f0fdf4' },
  pendiente:  { label: 'Pendiente',  color: '#d97706', bg: '#fffbeb' },
  rechazada:  { label: 'Rechazada',  color: '#dc2626', bg: '#fef2f2' },
}

// ── Utilidades ───────────────────────────────────────────────────────────────
function normRut(rut) {
  if (!rut) return ''
  return rut.replace(/[^0-9kK]/g, '').toUpperCase()
}
function formatRut(rut) {
  if (!rut) return ''
  const clean = normRut(rut)
  if (clean.length < 2) return clean
  const cuerpo = clean.slice(0, -1)
  const dv = clean.slice(-1)
  return cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + dv
}
function formatFecha(fecha) {
  if (!fecha) return '—'
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}
function calcDias(a) {
  if (!a.fecha_inicio || !a.fecha_fin) return '—'
  if (a.jornada === 'medio_dia') return '½ día'
  const s = new Date(a.fecha_inicio + 'T12:00:00')
  const e = new Date(a.fecha_fin + 'T12:00:00')
  if (isNaN(s) || isNaN(e) || e < s) return '—'
  const d = Math.round((e - s) / 86400000) + 1
  const usaCal = a.tipo === 'licencia_medica' || a.tipo === 'cometido'
  return d === 1 ? '1 día' : `${d} días${usaCal ? '' : ' háb.'}`
}
function calcularEdad(fechaNac) {
  if (!fechaNac) return null
  const hoy = new Date(), nac = new Date(fechaNac + 'T12:00:00')
  let edad = hoy.getFullYear() - nac.getFullYear()
  const m = hoy.getMonth() - nac.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--
  return edad
}
function calcularAntiguedad(fecha) {
  if (!fecha) return null
  const hoy = new Date(), ini = new Date(fecha + 'T12:00:00')
  let años = hoy.getFullYear() - ini.getFullYear()
  let meses = hoy.getMonth() - ini.getMonth()
  if (meses < 0) { años--; meses += 12 }
  if (años === 0 && meses === 0) return 'Menos de 1 mes'
  const p = []
  if (años > 0) p.push(`${años} año${años > 1 ? 's' : ''}`)
  if (meses > 0) p.push(`${meses} mes${meses > 1 ? 'es' : ''}`)
  return p.join(' y ')
}
function calcularEstadoContrato(fechaTermino) {
  if (!fechaTermino) return 'vigente'
  const dias = Math.ceil((new Date(fechaTermino + 'T12:00:00') - new Date()) / 86400000)
  if (dias < 0) return 'vencido'
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

// Genera los formatos de RUT que podrían existir en la BD
function rutFormatos(rutNorm) {
  if (!rutNorm || rutNorm.length < 2) return []
  const cuerpo = rutNorm.slice(0, -1)
  const dv = rutNorm.slice(-1)
  return [rutNorm, rutNorm.toLowerCase(), `${cuerpo}-${dv}`, `${cuerpo}-${dv}`.toLowerCase(), formatRut(rutNorm)]
}

function EstadoBadge({ estado, mapa = ESTADO_CONTRATO_MAP }) {
  const s = mapa[estado] ?? { label: estado, color: '#6b7280', bg: '#f9fafb' }
  return <span className="hv-badge" style={{ color: s.color, background: s.bg }}>{s.label}</span>
}

// ── Modal confirm ────────────────────────────────────────────────────────────
function ConfirmModal({ mensaje, onConfirmar, onCancelar, cargando }) {
  return (
    <motion.div className="hv-overlay" variants={overlayV} initial="hidden" animate="visible" exit="exit" onClick={onCancelar}>
      <motion.div className="hv-modal hv-modal--sm" variants={modalV} onClick={e => e.stopPropagation()}>
        <div className="hv-modal-header">
          <h3>Confirmar eliminación</h3>
          <button className="hv-modal-close" onClick={onCancelar}><X size={16} /></button>
        </div>
        <div style={{ padding: '0 0 4px' }}>
          <p style={{ margin: 0, color: '#374151', fontSize: 13.5 }}>{mensaje}</p>
        </div>
        <div className="hv-modal-footer">
          <button className="hv-btn hv-btn--secondary" onClick={onCancelar} disabled={cargando}>Cancelar</button>
          <button className="hv-btn hv-btn--danger" onClick={onConfirmar} disabled={cargando}>
            {cargando ? <Loader2 size={14} className="hv-spin" /> : <Trash2 size={14} />}
            {cargando ? 'Eliminando…' : 'Eliminar'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Modal Info Personal ──────────────────────────────────────────────────────
function ModalInfoPersonal({ datos, onGuardar, onCerrar, guardando }) {
  const [form, setForm] = useState({
    fecha_nacimiento: datos?.fecha_nacimiento ?? '', direccion: datos?.direccion ?? '',
    estado_civil: datos?.estado_civil ?? '', correo_personal: datos?.correo_personal ?? '',
    contacto_emergencia_nombre: datos?.contacto_emergencia_nombre ?? '',
    contacto_emergencia_telefono: datos?.contacto_emergencia_telefono ?? '',
    contacto_emergencia_relacion: datos?.contacto_emergencia_relacion ?? '',
    observaciones_personales: datos?.observaciones_personales ?? '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  return (
    <motion.div className="hv-overlay" variants={overlayV} initial="hidden" animate="visible" exit="exit" onClick={onCerrar}>
      <motion.div className="hv-modal" variants={modalV} onClick={e => e.stopPropagation()}>
        <div className="hv-modal-header"><h3>Información Personal</h3><button className="hv-modal-close" onClick={onCerrar}><X size={16} /></button></div>
        <form onSubmit={e => { e.preventDefault(); onGuardar(form) }} className="hv-modal-body">
          <div className="hv-form-grid">
            <div className="hv-form-group"><label>Fecha de nacimiento</label><input type="date" value={form.fecha_nacimiento} onChange={e => set('fecha_nacimiento', e.target.value)} /></div>
            <div className="hv-form-group"><label>Estado civil</label>
              <select value={form.estado_civil} onChange={e => set('estado_civil', e.target.value)}>
                <option value="">Sin especificar</option><option value="soltero">Soltero/a</option><option value="casado">Casado/a</option>
                <option value="conviviente">Conviviente</option><option value="divorciado">Divorciado/a</option><option value="viudo">Viudo/a</option><option value="otro">Otro</option>
              </select>
            </div>
            <div className="hv-form-group hv-form-group--full"><label>Dirección</label><input value={form.direccion} onChange={e => set('direccion', e.target.value)} placeholder="Calle, número, ciudad" /></div>
            <div className="hv-form-group hv-form-group--full"><label>Correo personal</label><input type="email" value={form.correo_personal} onChange={e => set('correo_personal', e.target.value)} placeholder="correo@personal.cl" /></div>
          </div>
          <p className="hv-form-section-title"><Phone size={13} /> Contacto de emergencia</p>
          <div className="hv-form-grid">
            <div className="hv-form-group"><label>Nombre</label><input value={form.contacto_emergencia_nombre} onChange={e => set('contacto_emergencia_nombre', e.target.value)} /></div>
            <div className="hv-form-group"><label>Teléfono</label><input value={form.contacto_emergencia_telefono} onChange={e => set('contacto_emergencia_telefono', e.target.value)} placeholder="+56 9 1234 5678" /></div>
            <div className="hv-form-group"><label>Relación</label><input value={form.contacto_emergencia_relacion} onChange={e => set('contacto_emergencia_relacion', e.target.value)} placeholder="Cónyuge, Padre/Madre" /></div>
          </div>
          <div className="hv-form-group hv-form-group--full" style={{ marginTop: 8 }}>
            <label>Observaciones</label><textarea rows={3} value={form.observaciones_personales} onChange={e => set('observaciones_personales', e.target.value)} placeholder="Notas adicionales…" />
          </div>
          <div className="hv-modal-footer">
            <button type="button" className="hv-btn hv-btn--secondary" onClick={onCerrar}>Cancelar</button>
            <button type="submit" className="hv-btn hv-btn--primary" disabled={guardando}>{guardando ? <><Loader2 size={14} className="hv-spin" /> Guardando…</> : 'Guardar cambios'}</button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

// ── Modal Info Laboral ───────────────────────────────────────────────────────
function ModalInfoLaboral({ datos, onGuardar, onCerrar, guardando }) {
  const [form, setForm] = useState({
    departamento: datos?.departamento ?? '', jornada: datos?.jornada ?? '',
    fecha_ingreso: datos?.fecha_ingreso ?? '', jefatura_directa: datos?.jefatura_directa ?? '',
    estado_laboral: datos?.estado_laboral ?? 'activo',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  return (
    <motion.div className="hv-overlay" variants={overlayV} initial="hidden" animate="visible" exit="exit" onClick={onCerrar}>
      <motion.div className="hv-modal" variants={modalV} onClick={e => e.stopPropagation()}>
        <div className="hv-modal-header"><h3>Información Laboral</h3><button className="hv-modal-close" onClick={onCerrar}><X size={16} /></button></div>
        <form onSubmit={e => { e.preventDefault(); onGuardar(form) }} className="hv-modal-body">
          <div className="hv-form-grid">
            <div className="hv-form-group"><label>Departamento</label><input value={form.departamento} onChange={e => set('departamento', e.target.value)} /></div>
            <div className="hv-form-group"><label>Jornada</label>
              <select value={form.jornada} onChange={e => set('jornada', e.target.value)}>
                <option value="">Sin especificar</option><option value="completa">Completa</option><option value="media">Media jornada</option><option value="parcial">Parcial</option><option value="otro">Otro</option>
              </select>
            </div>
            <div className="hv-form-group"><label>Fecha de ingreso</label><input type="date" value={form.fecha_ingreso} onChange={e => set('fecha_ingreso', e.target.value)} /></div>
            <div className="hv-form-group"><label>Estado laboral</label>
              <select value={form.estado_laboral} onChange={e => set('estado_laboral', e.target.value)}>
                <option value="activo">Activo</option><option value="inactivo">Inactivo</option><option value="licencia">En licencia</option><option value="comision">En comisión</option><option value="otro">Otro</option>
              </select>
            </div>
            <div className="hv-form-group hv-form-group--full"><label>Jefatura directa</label><input value={form.jefatura_directa} onChange={e => set('jefatura_directa', e.target.value)} /></div>
          </div>
          <div className="hv-modal-footer">
            <button type="button" className="hv-btn hv-btn--secondary" onClick={onCerrar}>Cancelar</button>
            <button type="submit" className="hv-btn hv-btn--primary" disabled={guardando}>{guardando ? <><Loader2 size={14} className="hv-spin" /> Guardando…</> : 'Guardar cambios'}</button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}


// ── Modal Capacitación ───────────────────────────────────────────────────────
function ModalCapacitacion({ datos, onGuardar, onCerrar, guardando }) {
  const [form, setForm] = useState(datos ?? { nombre_curso: '', institucion: '', horas: '', fecha_inicio: '', fecha_termino: '', observaciones: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  return (
    <motion.div className="hv-overlay" variants={overlayV} initial="hidden" animate="visible" exit="exit" onClick={onCerrar}>
      <motion.div className="hv-modal" variants={modalV} onClick={e => e.stopPropagation()}>
        <div className="hv-modal-header"><h3>{datos?.id ? 'Editar capacitación' : 'Registrar capacitación'}</h3><button className="hv-modal-close" onClick={onCerrar}><X size={16} /></button></div>
        <form onSubmit={e => { e.preventDefault(); onGuardar(form) }} className="hv-modal-body">
          <div className="hv-form-grid">
            <div className="hv-form-group hv-form-group--full"><label>Curso / capacitación *</label><input value={form.nombre_curso} onChange={e => set('nombre_curso', e.target.value)} required /></div>
            <div className="hv-form-group"><label>Institución</label><input value={form.institucion} onChange={e => set('institucion', e.target.value)} /></div>
            <div className="hv-form-group"><label>Horas</label><input type="number" min="1" value={form.horas} onChange={e => set('horas', e.target.value)} /></div>
            <div className="hv-form-group"><label>Fecha inicio</label><input type="date" value={form.fecha_inicio} onChange={e => set('fecha_inicio', e.target.value)} /></div>
            <div className="hv-form-group"><label>Fecha término</label><input type="date" value={form.fecha_termino} onChange={e => set('fecha_termino', e.target.value)} /></div>
            <div className="hv-form-group hv-form-group--full"><label>Observaciones</label><textarea rows={2} value={form.observaciones} onChange={e => set('observaciones', e.target.value)} /></div>
          </div>
          <div className="hv-modal-footer">
            <button type="button" className="hv-btn hv-btn--secondary" onClick={onCerrar}>Cancelar</button>
            <button type="submit" className="hv-btn hv-btn--primary" disabled={guardando}>{guardando ? <><Loader2 size={14} className="hv-spin" /> Guardando…</> : datos?.id ? 'Guardar' : 'Registrar'}</button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

// ── Modal Evaluación ─────────────────────────────────────────────────────────
function ModalEvaluacion({ datos, onGuardar, onCerrar, guardando }) {
  const [form, setForm] = useState(datos ?? { evaluador: '', fecha_evaluacion: '', puntaje: '', calificacion: '', observaciones: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  return (
    <motion.div className="hv-overlay" variants={overlayV} initial="hidden" animate="visible" exit="exit" onClick={onCerrar}>
      <motion.div className="hv-modal" variants={modalV} onClick={e => e.stopPropagation()}>
        <div className="hv-modal-header"><h3>{datos?.id ? 'Editar evaluación' : 'Registrar evaluación'}</h3><button className="hv-modal-close" onClick={onCerrar}><X size={16} /></button></div>
        <form onSubmit={e => { e.preventDefault(); onGuardar(form) }} className="hv-modal-body">
          <div className="hv-form-grid">
            <div className="hv-form-group"><label>Evaluador</label><input value={form.evaluador} onChange={e => set('evaluador', e.target.value)} /></div>
            <div className="hv-form-group"><label>Fecha *</label><input type="date" value={form.fecha_evaluacion} onChange={e => set('fecha_evaluacion', e.target.value)} required /></div>
            <div className="hv-form-group"><label>Puntaje</label><input type="number" step="0.01" min="0" max="100" value={form.puntaje} onChange={e => set('puntaje', e.target.value)} /></div>
            <div className="hv-form-group"><label>Calificación</label>
              <select value={form.calificacion} onChange={e => set('calificacion', e.target.value)}><option value="">—</option>{Object.entries(CALIFICACION_MAP).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}</select>
            </div>
            <div className="hv-form-group hv-form-group--full"><label>Observaciones</label><textarea rows={3} value={form.observaciones} onChange={e => set('observaciones', e.target.value)} /></div>
          </div>
          <div className="hv-modal-footer">
            <button type="button" className="hv-btn hv-btn--secondary" onClick={onCerrar}>Cancelar</button>
            <button type="submit" className="hv-btn hv-btn--primary" disabled={guardando}>{guardando ? <><Loader2 size={14} className="hv-spin" /> Guardando…</> : datos?.id ? 'Guardar' : 'Registrar'}</button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}


// ── Modal Anotación ──────────────────────────────────────────────────────────
function ModalAnotacion({ datos, onGuardar, onCerrar, guardando }) {
  const [form, setForm] = useState(datos ?? { tipo: 'otro', fecha: new Date().toISOString().slice(0, 10), hora: '', descripcion: '', estado: 'activo' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  return (
    <motion.div className="hv-overlay" variants={overlayV} initial="hidden" animate="visible" exit="exit" onClick={onCerrar}>
      <motion.div className="hv-modal" variants={modalV} onClick={e => e.stopPropagation()}>
        <div className="hv-modal-header"><h3>{datos?.id ? 'Editar anotación' : 'Registrar anotación'}</h3><button className="hv-modal-close" onClick={onCerrar}><X size={16} /></button></div>
        <form onSubmit={e => { e.preventDefault(); onGuardar(form) }} className="hv-modal-body">
          <div className="hv-form-grid">
            <div className="hv-form-group"><label>Tipo de anotación *</label>
              <select value={form.tipo} onChange={e => set('tipo', e.target.value)} required>
                {TIPOS_ANOTACION.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="hv-form-group"><label>Fecha *</label><input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} required /></div>
            <div className="hv-form-group"><label>Hora (opcional)</label><input type="time" value={form.hora} onChange={e => set('hora', e.target.value)} /></div>
            <div className="hv-form-group"><label>Estado</label>
              <select value={form.estado} onChange={e => set('estado', e.target.value)}>
                <option value="activo">Activo</option><option value="resuelto">Resuelto</option><option value="archivado">Archivado</option>
              </select>
            </div>
            <div className="hv-form-group hv-form-group--full"><label>Descripción detallada *</label><textarea rows={4} value={form.descripcion} onChange={e => set('descripcion', e.target.value)} required placeholder="Describa el hecho o incidencia…" /></div>
          </div>
          <div className="hv-modal-footer">
            <button type="button" className="hv-btn hv-btn--secondary" onClick={onCerrar}>Cancelar</button>
            <button type="submit" className="hv-btn hv-btn--primary" disabled={guardando || !form.descripcion.trim()}>{guardando ? <><Loader2 size={14} className="hv-spin" /> Guardando…</> : datos?.id ? 'Guardar' : 'Registrar'}</button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL — Expediente único del funcionario
// ══════════════════════════════════════════════════════════════════════════════
export default function HojaVida({ usuario, permisos }) {
  const [vista, setVista] = useState('lista')
  const [seleccionado, setSeleccionado] = useState(null)

  // Lista
  const [contrataciones, setContrataciones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busq, setBusq] = useState('')
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  const [filtros, setFiltros] = useState({ estamento: '', estado: '', tipo_contrato: '', cargo: '' })
  const [pagina, setPagina] = useState(1)

  // Detalle — datos del expediente único (todos de tablas existentes)
  const [hvPersona, setHvPersona] = useState(null)
  const [contratos, setContratos] = useState([])
  const [historial, setHistorial] = useState([])
  const [capacitaciones, setCapacitaciones] = useState([])
  const [evaluaciones, setEvaluaciones] = useState([])
  const [ausencias, setAusencias] = useState([])
  const [compensatorios, setCompensatorios] = useState([])
  const [anotaciones, setAnotaciones] = useState([])
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [tabActiva, setTabActiva] = useState('info_personal')

  // Anotaciones filtros
  const [anotFiltroTipo, setAnotFiltroTipo] = useState('')
  const [anotFiltroEstado, setAnotFiltroEstado] = useState('')

  // Ausencias filtros
  const [ausFiltroTipo, setAusFiltroTipo] = useState('')
  const [ausFiltroEstado, setAusFiltroEstado] = useState('')

  // Modal
  const [modal, setModal] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [toast, setToast] = useState(null)
  const toastRef = useRef(null)

  // ── Carga lista: TODAS las personas (contrataciones + usuarios), unificadas por RUT
  useEffect(() => { cargarLista() }, [])

  async function cargarLista() {
    setCargando(true)
    // usuarios es la fuente de verdad — solo activos (is_deleted=false)
    const [{ data: usrData }, { data: contData }] = await Promise.all([
      supabase.from('usuarios')
        .select('id, nombre, rut, email, rol, created_at')
        .eq('is_deleted', false)
        .order('nombre', { ascending: true }),
      supabase.from('contrataciones')
        .select('id, nombre_completo, rut, cargo, estamento, tipo_contrato, fecha_inicio, fecha_termino, horas, correo, telefono, creado_en')
        .order('nombre_completo', { ascending: true }),
    ])

    // índice de contrataciones por RUT normalizado (más reciente gana)
    const contPorRut = new Map()
    for (const c of (contData ?? [])) {
      const rn = normRut(c.rut)
      if (!rn) continue
      const prev = contPorRut.get(rn)
      if (!prev || (c.creado_en > prev.creado_en)) {
        contPorRut.set(rn, { ...c, _allContractIds: [...(prev?._allContractIds ?? []), c.id], _source: 'contratacion' })
      } else {
        prev._allContractIds.push(c.id)
      }
    }

    // lista final: un registro por usuario activo, enriquecido con contrataciones si existe
    const lista = (usrData ?? []).map(u => {
      const rn = normRut(u.rut)
      const cont = rn ? contPorRut.get(rn) : null
      if (cont) {
        return {
          ...cont,
          correo: cont.correo || u.email,
          nombre_completo: cont.nombre_completo || u.nombre,
          _allContractIds: cont._allContractIds ?? [],
          _source: 'contratacion',
        }
      }
      return {
        id: u.id, nombre_completo: u.nombre, rut: u.rut,
        cargo: u.rol ?? '', estamento: '', tipo_contrato: '',
        fecha_inicio: null, fecha_termino: null, horas: null,
        correo: u.email, telefono: '', creado_en: u.created_at,
        _allContractIds: [], _source: 'usuario',
      }
    })

    setContrataciones(lista)
    setCargando(false)
  }

  // ── Valores únicos para filtros ────────────────────────────────────────
  const cargosUnicos = useMemo(() => [...new Set(contrataciones.map(c => c.cargo).filter(Boolean))].sort(), [contrataciones])

  // ── Filtrado y paginación ──────────────────────────────────────────────
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
      if (filtros.estamento && c.estamento !== filtros.estamento) return false
      if (filtros.tipo_contrato && c.tipo_contrato !== filtros.tipo_contrato) return false
      if (filtros.cargo && c.cargo !== filtros.cargo) return false
      if (filtros.estado && (c.estado ?? 'vigente') !== filtros.estado) return false
      return true
    })
  }, [contrataciones, busq, filtros])

  const totalPaginas = Math.max(1, Math.ceil(personasFiltradas.length / POR_PAGINA))
  const pag = Math.min(pagina, totalPaginas)
  const personasPagina = personasFiltradas.slice((pag - 1) * POR_PAGINA, pag * POR_PAGINA)
  const hayFiltrosActivos = Object.values(filtros).some(Boolean)

  useEffect(() => { setPagina(1) }, [busq, filtros])

  const setFiltro = (k, v) => setFiltros(f => ({ ...f, [k]: v }))
  const limpiarFiltros = () => setFiltros({ estamento: '', estado: '', tipo_contrato: '', cargo: '' })

  // ── Abrir detalle (expediente único) ───────────────────────────────────
  async function abrirDetalle(persona) {
    setSeleccionado(persona)
    setVista('detalle')
    setTabActiva('info_personal')
    cargarDetalle(persona)
  }

  async function cargarDetalle(persona) {
    if (!persona) return
    setCargandoDetalle(true)
    const rn = normRut(persona.rut)
    const fmts = rutFormatos(rn)
    const contractIds = (persona._allContractIds ?? []).length ? persona._allContractIds : (persona._source === 'usuario' ? [] : [persona.id])

    // Upsert hv_personas para asegurar que exista la fila
    await supabase.from('hv_personas').upsert({ rut: rn }, { onConflict: 'rut', ignoreDuplicates: true }).select()
    const { data: hvData } = await supabase.from('hv_personas').select('*').eq('rut', rn).maybeSingle()
    setHvPersona(hvData)

    // Buscar usuario_id vinculado por RUT para consultar ausencias y compensatorios
    const { data: usrData } = await supabase.from('usuarios').select('id, rut').in('rut', fmts)
    const userIds = (usrData ?? []).map(u => u.id)

    // Consultas paralelas
    const queries = [
      // Todos los contratos de este RUT
      contractIds.length
        ? supabase.from('contrataciones').select('*').in('id', contractIds).order('creado_en', { ascending: false })
        : Promise.resolve({ data: [] }),
      // Historial laboral (usado en PDF)
      supabase.from('hv_historial_laboral').select('*').eq('rut', rn).order('fecha_evento', { ascending: false }),
      // Capacitaciones
      supabase.from('hv_capacitaciones').select('*').eq('rut', rn).order('fecha_inicio', { ascending: false }),
      // Evaluaciones
      supabase.from('hv_evaluaciones').select('*').eq('rut', rn).order('fecha_evaluacion', { ascending: false }),
      // Anotaciones
      supabase.from('hv_anotaciones').select('*').eq('rut', rn).order('fecha', { ascending: false }),
    ]

    // Ausencias: consultar por usuario_id (columnas externo_rut/snapshot_rut no existen en tabla)
    const selAus = '*, usuario:usuario_id(id, nombre, email, rol, rut)'
    const ausQ = userIds.length
      ? [supabase.from('ausencias').select(selAus)
          .eq('is_deleted', false).in('usuario_id', userIds).order('fecha_inicio', { ascending: false }).limit(200)]
      : []

    // Compensatorios por usuario_id
    const compQ = userIds.length
      ? supabase.from('dias_compensatorios').select('*').in('usuario_id', userIds).order('fecha_ganado', { ascending: false })
      : Promise.resolve({ data: [] })

    const [contrRes, histRes, capsRes, evalsRes, anotRes, ...ausRes] = await Promise.all([...queries, ...ausQ])
    const compRes = await compQ

    setContratos(contrRes.data ?? [])
    setHistorial(histRes.data ?? [])
    setCapacitaciones(capsRes.data ?? [])
    setEvaluaciones(evalsRes.data ?? [])
    setAnotaciones(anotRes.data ?? [])
    setCompensatorios(compRes.data ?? [])

    // Dedup ausencias by id
    const ausMap = new Map()
    for (const r of ausRes) {
      for (const a of (r.data ?? [])) { if (!ausMap.has(a.id)) ausMap.set(a.id, a) }
    }
    setAusencias([...ausMap.values()].sort((a, b) => (b.fecha_inicio ?? '').localeCompare(a.fecha_inicio ?? '')))

    setCargandoDetalle(false)
  }

  // ── Toast ──────────────────────────────────────────────────────────────
  function mostrarToast(tipo, msg) {
    clearTimeout(toastRef.current)
    setToast({ tipo, msg })
    toastRef.current = setTimeout(() => setToast(null), 3500)
  }

  // ── Auditoría (RPC existente) ──────────────────────────────────────────
  async function logAudit(accion, detalle) {
    const nombre = seleccionado?.nombre_completo ?? ''
    const prefijo = detalle ? `${nombre} — ${detalle}` : nombre
    await supabase.rpc('log_auditoria', {
      p_accion: accion, p_modulo: 'hoja_vida',
      p_bien_nombre: prefijo, p_bien_id: hvPersona?.id ?? null, p_cambios: [],
    }).catch(() => {})
  }

  // ── CRUD helpers ───────────────────────────────────────────────────────
  const getRut = () => normRut(seleccionado?.rut)
  const autorInfo = () => ({ creado_por_id: usuario.id, creado_por_nombre: usuario.nombre })

  async function guardarHvPersona(tabla, form, accion) {
    setGuardando(true)
    const esEd = !!form.id
    const rut = getRut()
    const payload = { ...form, rut, ...autorInfo() }

    if (tabla === 'hv_personas') {
      payload.actualizado_por_id = usuario.id
      payload.actualizado_por_nombre = usuario.nombre
      delete payload.rut; delete payload.creado_por_id; delete payload.creado_por_nombre
      const { error } = await supabase.from('hv_personas').update(payload).eq('rut', rut)
      setGuardando(false)
      if (error) { mostrarToast('error', 'Error al guardar'); return }
    } else {
      if (tabla === 'hv_capacitaciones') { payload.horas = form.horas ? Number(form.horas) : null; payload.fecha_inicio = form.fecha_inicio || null; payload.fecha_termino = form.fecha_termino || null }
      if (tabla === 'hv_evaluaciones') { payload.puntaje = form.puntaje !== '' && form.puntaje != null ? Number(form.puntaje) : null; payload.calificacion = form.calificacion || null }
      if (tabla === 'hv_anotaciones') { payload.hora = form.hora || null }
      const op = esEd ? supabase.from(tabla).update(payload).eq('id', form.id) : supabase.from(tabla).insert(payload)
      const { error } = await op
      setGuardando(false)
      if (error) { mostrarToast('error', 'Error al guardar'); return }
    }
    setModal(null)
    const accionAudit = esEd || tabla === 'hv_personas' ? 'editar' : 'crear'
    const tablaLabel = { hv_personas: 'Información personal', hv_capacitaciones: 'Capacitación', hv_evaluaciones: 'Evaluación', hv_observaciones: 'Observación', hv_anotaciones: 'Anotación' }[tabla] ?? tabla
    mostrarToast('ok', accionAudit === 'crear' ? 'Registrado correctamente' : 'Actualizado correctamente')
    await logAudit(accionAudit, `${tablaLabel} ${accionAudit === 'crear' ? 'agregada' : 'modificada'}`)
    cargarDetalle(seleccionado)
  }

  async function eliminarRegistro(tabla, id) {
    const { error } = await supabase.from(tabla).delete().eq('id', id)
    if (error) { mostrarToast('error', 'Error al eliminar'); return }
    setModal(null)
    const tablaLabel = { hv_capacitaciones: 'Capacitación', hv_evaluaciones: 'Evaluación', hv_observaciones: 'Observación', hv_anotaciones: 'Anotación' }[tabla] ?? tabla
    mostrarToast('ok', 'Eliminado correctamente')
    await logAudit('eliminar', `${tablaLabel} eliminada`)
    cargarDetalle(seleccionado)
  }

  // ── PDF export ─────────────────────────────────────────────────────────
  async function exportarPDF() {
    if (!seleccionado) return
    try {
      const { jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const doc = new jsPDF()
      const nombre = seleccionado.nombre_completo ?? 'Funcionario'
      doc.setFontSize(18); doc.setTextColor(26, 35, 126); doc.text('Hoja de Vida del Personal', 14, 20)
      doc.setFontSize(13); doc.setTextColor(0); doc.text(nombre, 14, 30)
      doc.setFontSize(10); doc.setTextColor(100)
      doc.text(`RUT: ${formatRut(seleccionado.rut)} · Cargo: ${seleccionado.cargo ?? '—'}`, 14, 38)
      doc.text(`Generado el ${new Date().toLocaleDateString('es-CL')}`, 14, 44)
      let y = 54
      const section = (t) => { if (y > 230) { doc.addPage(); y = 20 }; doc.setFontSize(11); doc.setTextColor(26, 35, 126); doc.text(t, 14, y); y += 6; doc.setDrawColor(180, 190, 220); doc.line(14, y, 196, y); y += 4; doc.setTextColor(0); doc.setFontSize(10) }
      const tbl = (opts) => { autoTable(doc, opts); y = doc.lastAutoTable.finalY + 8 }

      if (hvPersona) {
        section('Información Laboral')
        tbl({ startY: y, head: [], body: [['Departamento', hvPersona.departamento ?? '—'], ['Jornada', hvPersona.jornada ?? '—'], ['Fecha ingreso', hvPersona.fecha_ingreso ? formatFecha(hvPersona.fecha_ingreso) : '—'], ['Estado', ESTADO_LABORAL_MAP[hvPersona.estado_laboral]?.label ?? '—']], margin: { left: 14 }, styles: { fontSize: 9 }, columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 } } })
      }
      if (historial.length) { section('Historial Laboral'); tbl({ startY: y, head: [['Fecha', 'Tipo', 'Descripción']], body: historial.map(h => [formatFecha(h.fecha_evento), TIPO_HISTORIAL[h.tipo] ?? h.tipo, h.descripcion ?? '—']), margin: { left: 14 }, styles: { fontSize: 8 } }) }
      if (capacitaciones.length) { section('Capacitaciones'); tbl({ startY: y, head: [['Curso', 'Institución', 'Horas', 'Fecha']], body: capacitaciones.map(c => [c.nombre_curso, c.institucion ?? '—', c.horas ?? '—', formatFecha(c.fecha_termino)]), margin: { left: 14 }, styles: { fontSize: 8 } }) }
      if (evaluaciones.length) { section('Evaluaciones'); tbl({ startY: y, head: [['Fecha', 'Evaluador', 'Puntaje', 'Calificación']], body: evaluaciones.map(e => [formatFecha(e.fecha_evaluacion), e.evaluador ?? '—', e.puntaje ?? '—', CALIFICACION_MAP[e.calificacion]?.label ?? '—']), margin: { left: 14 }, styles: { fontSize: 8 } }) }
      if (ausencias.length) { section('Permisos y Licencias'); tbl({ startY: y, head: [['Tipo', 'Inicio', 'Fin', 'Días', 'Estado']], body: ausencias.map(a => [TIPO_AUSENCIA_MAP[a.tipo] ?? a.tipo, formatFecha(a.fecha_inicio), formatFecha(a.fecha_fin), a.dias ?? '—', a.estado ?? '—']), margin: { left: 14 }, styles: { fontSize: 8 } }) }
      if (anotaciones.length) { section('Anotaciones'); autoTable(doc, { startY: y, head: [['Fecha', 'Tipo', 'Descripción', 'Estado']], body: anotaciones.map(a => [formatFecha(a.fecha), TIPO_ANOT_MAP[a.tipo]?.label ?? a.tipo, a.descripcion, ESTADO_ANOT_MAP[a.estado]?.label ?? a.estado]), margin: { left: 14 }, styles: { fontSize: 8 } }) }

      doc.save(`hoja_vida_${nombre.replace(/\s+/g, '_')}.pdf`)
      mostrarToast('ok', 'PDF exportado correctamente')
    } catch { mostrarToast('error', 'Error al exportar PDF'); return }
    try { await logAudit('exportar', 'Exportación de expediente') } catch {}
  }

  // ── Anotaciones filtradas ──────────────────────────────────────────────
  const anotacionesFiltradas = useMemo(() => {
    return anotaciones.filter(a => {
      if (anotFiltroTipo && a.tipo !== anotFiltroTipo) return false
      if (anotFiltroEstado && a.estado !== anotFiltroEstado) return false
      return true
    })
  }, [anotaciones, anotFiltroTipo, anotFiltroEstado])

  const ausenciasFiltradas = useMemo(() => {
    return ausencias.filter(a => {
      if (ausFiltroTipo && a.tipo !== ausFiltroTipo) return false
      if (ausFiltroEstado && a.estado !== ausFiltroEstado) return false
      return true
    })
  }, [ausencias, ausFiltroTipo, ausFiltroEstado])

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="hv-page">
      <AnimatePresence>
        {toast && (
          <motion.div className={`hv-toast hv-toast--${toast.tipo}`} initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
            {toast.tipo === 'ok' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {/* ── VISTA LISTA ──────────────────────────────────────────────── */}
        {vista === 'lista' && (
          <motion.div key="lista" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="hv-page-header">
              <div className="hv-page-header-left">
                <h1 className="hv-page-title">Expedientes del Personal</h1>
                <p className="hv-page-desc">Expediente digital único de cada funcionario del establecimiento</p>
              </div>
            </div>

            <div className="hv-toolbar">
              <div className="hv-search">
                <Search size={15} className="hv-search-icon" />
                <input placeholder="Buscar por nombre, RUT, cargo o correo…" value={busq} onChange={e => setBusq(e.target.value)} />
                {busq && <button className="hv-search-clear" onClick={() => setBusq('')}><X size={14} /></button>}
              </div>
              <button className={`hv-btn hv-btn--ghost ${mostrarFiltros ? 'active' : ''}`} onClick={() => setMostrarFiltros(f => !f)}>
                <Filter size={14} /> Filtros
                {hayFiltrosActivos && <span className="hv-filter-dot" />}
              </button>
            </div>

            <AnimatePresence>
              {mostrarFiltros && (
                <motion.div className="hv-filters" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                  <div className="hv-filters-inner">
                    <div className="hv-filter-group">
                      <label>Estamento</label>
                      <select value={filtros.estamento} onChange={e => setFiltro('estamento', e.target.value)}>
                        <option value="">Todos</option>
                        {Object.entries(ESTAMENTO_MAP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                    <div className="hv-filter-group">
                      <label>Tipo contrato</label>
                      <select value={filtros.tipo_contrato} onChange={e => setFiltro('tipo_contrato', e.target.value)}>
                        <option value="">Todos</option>
                        {Object.entries(CONTRATO_MAP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                    <div className="hv-filter-group">
                      <label>Estado contrato</label>
                      <select value={filtros.estado} onChange={e => setFiltro('estado', e.target.value)}>
                        <option value="">Todos</option>
                        {Object.entries(ESTADO_CONTRATO_MAP).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="hv-filter-group">
                      <label>Cargo</label>
                      <select value={filtros.cargo} onChange={e => setFiltro('cargo', e.target.value)}>
                        <option value="">Todos</option>
                        {cargosUnicos.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    {hayFiltrosActivos && (
                      <button className="hv-btn hv-btn--ghost hv-btn--sm" onClick={limpiarFiltros} style={{ alignSelf: 'flex-end' }}>
                        <X size={13} /> Limpiar
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {!cargando && (
              <p className="hv-count">
                {personasFiltradas.length} funcionario{personasFiltradas.length !== 1 ? 's' : ''}
                {(busq || hayFiltrosActivos) && ` (filtrado de ${contrataciones.length})`}
              </p>
            )}

            {cargando ? (
              <div className="hv-loading"><Loader2 size={28} className="hv-spin" /><span>Cargando personal…</span></div>
            ) : personasFiltradas.length === 0 ? (
              <div className="hv-empty">
                <div className="hv-empty-icon"><Users size={28} /></div>
                <p>{busq || hayFiltrosActivos ? 'Sin resultados para los filtros aplicados' : 'No hay personal registrado'}</p>
                {(busq || hayFiltrosActivos) && <button className="hv-btn hv-btn--ghost hv-btn--sm" onClick={() => { setBusq(''); limpiarFiltros() }}>Limpiar filtros</button>}
              </div>
            ) : (
              <div className="hv-table-wrap">
                <table className="hv-table">
                  <thead><tr>
                    <th>Funcionario</th><th>RUT</th><th>Cargo / Estamento</th><th>Contrato</th><th>Estado</th><th>Antigüedad</th><th></th>
                  </tr></thead>
                  <tbody>
                    {personasPagina.map(c => (
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
                        <td><EstadoBadge estado={(c.estado ?? 'vigente')} /></td>
                        <td><span style={{ fontSize: 12.5, color: '#64748b' }}>{calcularAntiguedad(c.fecha_inicio ?? c.creado_en?.slice(0, 10)) ?? '—'}</span></td>
                        <td>
                          <button className="hv-btn hv-btn--primary hv-btn--sm" onClick={e => { e.stopPropagation(); abrirDetalle(c) }}>
                            Ver HV <ChevronRight size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {totalPaginas > 1 && (
                  <div className="hv-pagination">
                    <span className="hv-pagination-info">Página {pag} de {totalPaginas}</span>
                    <div className="hv-pagination-btns">
                      <button className="hv-pagination-btn" disabled={pag === 1} onClick={() => setPagina(p => p - 1)}>Anterior</button>
                      <button className="hv-pagination-btn" disabled={pag === totalPaginas} onClick={() => setPagina(p => p + 1)}>Siguiente</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* ── VISTA DETALLE (Expediente) ───────────────────────────────── */}
        {vista === 'detalle' && seleccionado && (
          <motion.div key="detalle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="hv-detail-topbar">
              <button className="hv-btn hv-btn--ghost" onClick={() => { setVista('lista'); setSeleccionado(null) }}><ArrowLeft size={15} /> Volver al listado</button>
              {permisos.exportar && <button className="hv-btn hv-btn--ghost" onClick={exportarPDF}><Download size={14} /> Exportar PDF</button>}
            </div>

            {cargandoDetalle ? (
              <div className="hv-loading"><Loader2 size={28} className="hv-spin" /><span>Cargando expediente…</span></div>
            ) : (
              <>
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
                    {[
                      { val: capacitaciones.length, label: 'Capacitaciones' },
                      { val: ausencias.length, label: 'Ausencias' },
                      { val: anotaciones.length, label: 'Anotaciones' },
                    ].map(k => (
                      <div key={k.label} className="hv-kpi-mini">
                        <span className="hv-kpi-mini-val">{k.val}</span>
                        <span className="hv-kpi-mini-label">{k.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="hv-detail-badges">
                  <EstadoBadge estado={hvPersona?.estado_laboral ?? 'activo'} mapa={ESTADO_LABORAL_MAP} />
                  <EstadoBadge estado={(seleccionado.estado ?? 'vigente')} />
                  {(hvPersona?.fecha_ingreso || seleccionado.fecha_inicio) && (
                    <span className="hv-badge" style={{ color: 'rgb(var(--primary-rgb, 26,35,126))', background: 'rgba(var(--primary-rgb, 26,35,126), 0.06)' }}>
                      {calcularAntiguedad(hvPersona?.fecha_ingreso ?? seleccionado.fecha_inicio ?? seleccionado.creado_en?.slice(0, 10))} de antigüedad
                    </span>
                  )}
                </div>

                <div className="hv-tabs-wrap">
                  <div className="hv-tabs">
                    {TABS.filter(t => {
                      if (t.id === 'capacitaciones') return permisos.verCapacitaciones
                      if (t.id === 'evaluaciones')   return permisos.verEvaluaciones
                      if (t.id === 'ausencias')      return permisos.verAusencias
                      return true
                    }).map(t => (
                      <button key={t.id} className={`hv-tab ${tabActiva === t.id ? 'hv-tab--active' : ''}`} onClick={() => setTabActiva(t.id)}>
                        <t.Icon size={13} />{t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="hv-tab-content">
                  {/* Info Personal */}
                  {tabActiva === 'info_personal' && (
                    <div className="hv-card">
                      <div className="hv-card-header"><h3>Información Personal</h3>{permisos.editar && <button className="hv-btn hv-btn--ghost hv-btn--sm" onClick={() => setModal({ tipo: 'info_personal' })}><Edit2 size={13} /> Editar</button>}</div>
                      <div className="hv-info-grid">
                        <F label="RUT" value={formatRut(seleccionado.rut)} />
                        <F label="Nombre completo" value={seleccionado.nombre_completo} />
                        <F label="Fecha de nacimiento" value={formatFecha(hvPersona?.fecha_nacimiento)} />
                        <F label="Edad" value={hvPersona?.fecha_nacimiento ? `${calcularEdad(hvPersona.fecha_nacimiento)} años` : null} />
                        <F label="Estado civil" value={hvPersona?.estado_civil ? ({ soltero: 'Soltero/a', casado: 'Casado/a', conviviente: 'Conviviente', divorciado: 'Divorciado/a', viudo: 'Viudo/a', otro: 'Otro' })[hvPersona.estado_civil] : null} />
                        <F label="Dirección" value={hvPersona?.direccion} />
                        <F label="Correo institucional" value={seleccionado.correo} />
                        <F label="Correo personal" value={hvPersona?.correo_personal} />
                        <F label="Teléfono" value={seleccionado.telefono} />
                      </div>
                      {hvPersona?.contacto_emergencia_nombre && (
                        <div style={{ marginTop: 20 }}>
                          <p className="hv-section-label"><Phone size={12} /> Contacto de emergencia</p>
                          <div className="hv-info-grid">
                            <F label="Nombre" value={hvPersona.contacto_emergencia_nombre} />
                            <F label="Teléfono" value={hvPersona.contacto_emergencia_telefono} />
                            <F label="Relación" value={hvPersona.contacto_emergencia_relacion} />
                          </div>
                        </div>
                      )}
                      {hvPersona?.observaciones_personales && <div className="hv-obs-block"><p className="hv-section-label"><Info size={12} /> Observaciones</p><p className="hv-obs-text">{hvPersona.observaciones_personales}</p></div>}
                      {!hvPersona?.fecha_nacimiento && !hvPersona?.direccion && <EmptyState msg="Información personal pendiente de completar" accion={permisos.editar ? () => setModal({ tipo: 'info_personal' }) : null} btnLabel="Completar ahora" />}
                    </div>
                  )}

                  {/* Info Laboral */}
                  {tabActiva === 'info_laboral' && (
                    <div className="hv-card">
                      <div className="hv-card-header"><h3>Información Laboral</h3>{permisos.editar && <button className="hv-btn hv-btn--ghost hv-btn--sm" onClick={() => setModal({ tipo: 'info_laboral' })}><Edit2 size={13} /> Editar</button>}</div>
                      <div className="hv-info-grid">
                        <F label="Cargo" value={seleccionado.cargo} />
                        <F label="Estamento" value={ESTAMENTO_MAP[seleccionado.estamento] ?? seleccionado.estamento} />
                        <F label="Departamento" value={hvPersona?.departamento} />
                        <F label="Jornada" value={hvPersona?.jornada ? ({ completa: 'Completa', media: 'Media jornada', parcial: 'Parcial', otro: 'Otro' })[hvPersona.jornada] : null} />
                        <F label="Horas contratadas" value={seleccionado.horas != null ? `${seleccionado.horas} hrs` : null} />
                        <F label="Tipo de contrato" value={CONTRATO_MAP[seleccionado.tipo_contrato] ?? seleccionado.tipo_contrato} />
                        <F label="Fecha de ingreso" value={formatFecha(hvPersona?.fecha_ingreso ?? seleccionado.fecha_inicio)} />
                        <F label="Fecha de término" value={formatFecha(seleccionado.fecha_termino)} />
                        <F label="Antigüedad" value={calcularAntiguedad(hvPersona?.fecha_ingreso ?? seleccionado.fecha_inicio ?? seleccionado.creado_en?.slice(0, 10))} />
                        <F label="Estado laboral" value={ESTADO_LABORAL_MAP[hvPersona?.estado_laboral ?? 'activo']?.label} />
                        <F label="Jefatura directa" value={hvPersona?.jefatura_directa} />
                      </div>
                      {contratos.length > 1 && (
                        <div style={{ marginTop: 20 }}>
                          <p className="hv-section-label"><Briefcase size={12} /> Contratos registrados ({contratos.length})</p>
                          <div className="hv-table-wrap" style={{ border: 'none', boxShadow: 'none' }}>
                            <table className="hv-table">
                              <thead><tr><th>Tipo</th><th>Inicio</th><th>Término</th><th>Horas</th><th>Estado</th></tr></thead>
                              <tbody>
                                {contratos.map(ct => (
                                  <tr key={ct.id}>
                                    <td>{CONTRATO_MAP[ct.tipo_contrato] ?? ct.tipo_contrato}</td>
                                    <td>{formatFecha(ct.fecha_inicio)}</td>
                                    <td>{formatFecha(ct.fecha_termino)}</td>
                                    <td>{ct.horas ?? '—'}</td>
                                    <td><EstadoBadge estado={ct.estado ?? 'vigente'} /></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Capacitaciones */}
                  {tabActiva === 'capacitaciones' && (
                    <div className="hv-card">
                      <div className="hv-card-header"><h3>Capacitaciones</h3>{permisos.crear && <button className="hv-btn hv-btn--primary hv-btn--sm" onClick={() => setModal({ tipo: 'capacitacion' })}><Plus size={13} /> Agregar</button>}</div>
                      {capacitaciones.length === 0 ? <EmptyState msg="Sin capacitaciones registradas" accion={permisos.crear ? () => setModal({ tipo: 'capacitacion' }) : null} btnLabel="Registrar primera" /> : (
                        <div className="hv-items-list">
                          {capacitaciones.map(c => (
                            <div key={c.id} className="hv-item">
                              <div className="hv-item-icon"><BookOpen size={16} /></div>
                              <div className="hv-item-body">
                                <div className="hv-item-top">
                                  <p className="hv-item-title">{c.nombre_curso}</p>
                                  <CrudBtns permisos={permisos} onEdit={() => setModal({ tipo: 'capacitacion', datos: c })} onDel={() => setModal({ tipo: 'confirm', tabla: 'hv_capacitaciones', id: c.id, msg: '¿Eliminar esta capacitación?' })} />
                                </div>
                                <p className="hv-item-sub">
                                  {c.institucion && <span>{c.institucion}</span>}
                                  {c.horas && <span>{c.horas} hrs</span>}
                                  {c.fecha_termino && <span>{formatFecha(c.fecha_termino)}</span>}
                                </p>
                                {c.observaciones && <p className="hv-item-obs">{c.observaciones}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Evaluaciones */}
                  {tabActiva === 'evaluaciones' && (
                    <div className="hv-card">
                      <div className="hv-card-header"><h3>Evaluaciones</h3>{permisos.crear && <button className="hv-btn hv-btn--primary hv-btn--sm" onClick={() => setModal({ tipo: 'evaluacion' })}><Plus size={13} /> Agregar</button>}</div>
                      {evaluaciones.length === 0 ? <EmptyState msg="Sin evaluaciones registradas" accion={permisos.crear ? () => setModal({ tipo: 'evaluacion' }) : null} btnLabel="Registrar primera" /> : (
                        <div className="hv-items-list">
                          {evaluaciones.map(e => (
                            <div key={e.id} className="hv-item">
                              <div className="hv-item-icon"><Star size={16} /></div>
                              <div className="hv-item-body">
                                <div className="hv-item-top">
                                  <div>
                                    <p className="hv-item-title">{formatFecha(e.fecha_evaluacion)}</p>
                                    {e.evaluador && <p className="hv-item-sub-sm">Evaluador: {e.evaluador}</p>}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    {e.calificacion && <span className="hv-badge" style={{ color: CALIFICACION_MAP[e.calificacion]?.color, background: CALIFICACION_MAP[e.calificacion]?.bg }}>{CALIFICACION_MAP[e.calificacion]?.label}</span>}
                                    {e.puntaje != null && <span className="hv-puntaje">{Number(e.puntaje).toFixed(1)}</span>}
                                    <CrudBtns permisos={permisos} onEdit={() => setModal({ tipo: 'evaluacion', datos: e })} onDel={() => setModal({ tipo: 'confirm', tabla: 'hv_evaluaciones', id: e.id, msg: '¿Eliminar esta evaluación?' })} />
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

                  {/* Permisos y Licencias (desde ausencias + compensatorios) */}
                  {tabActiva === 'ausencias' && (
                    <div className="hv-card">
                      <div className="hv-card-header">
                        <div>
                          <h3>Permisos, Licencias y Ausencias</h3>
                          <p className="hv-card-sub">Sincronizado desde Gestión de Ausencias y Compensatorios</p>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {Object.entries(TIPO_AUSENCIA_MAP).map(([k, v]) => {
                            const cnt = ausencias.filter(a => a.tipo === k).length
                            if (!cnt) return null
                            return <span key={k} className="hv-badge" style={{ cursor: 'pointer', background: ausFiltroTipo === k ? '#1a237e' : '#f1f5f9', color: ausFiltroTipo === k ? '#fff' : '#334155' }} onClick={() => setAusFiltroTipo(p => p === k ? '' : k)}>{v} ({cnt})</span>
                          })}
                          {compensatorios.length > 0 && <span className="hv-badge" style={{ background: '#f0fdf4', color: '#16a34a' }}>Compensatorios ({compensatorios.length})</span>}
                        </div>
                      </div>

                      {ausencias.length === 0 && compensatorios.length === 0 ? <EmptyState msg="Sin permisos, licencias ni ausencias registradas" /> : (
                        <>
                          {ausencias.length > 0 && (
                            <>
                              <div className="hv-anot-filters" style={{ marginBottom: 8 }}>
                                <select className="hv-filter-select" value={ausFiltroTipo} onChange={e => setAusFiltroTipo(e.target.value)}>
                                  <option value="">Todos los tipos</option>
                                  {Object.entries(TIPO_AUSENCIA_MAP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                </select>
                                {ausFiltroTipo && <button className="hv-btn hv-btn--ghost hv-btn--sm" onClick={() => setAusFiltroTipo('')}><X size={13} /> Limpiar</button>}
                              </div>
                              {ausenciasFiltradas.length === 0
                                ? <EmptyState msg="Sin resultados para los filtros aplicados" />
                                : (
                                  <div className="hv-table-wrap" style={{ border: 'none', boxShadow: 'none' }}>
                                    <table className="hv-table">
                                      <thead><tr><th>Tipo</th><th>Inicio</th><th>Fin</th><th>Días</th><th>Jornada</th><th>Observaciones</th></tr></thead>
                                      <tbody>
                                        {ausenciasFiltradas.map(a => (
                                          <tr key={a.id}>
                                            <td><span style={{ fontWeight: 500 }}>{TIPO_AUSENCIA_MAP[a.tipo] ?? a.tipo ?? '—'}</span></td>
                                            <td>{formatFecha(a.fecha_inicio)}</td>
                                            <td>{formatFecha(a.fecha_fin)}</td>
                                            <td>{calcDias(a)}</td>
                                            <td style={{ fontSize: 12 }}>{a.jornada === 'dia_completo' || a.jornada === 'completa' ? 'Día completo' : a.jornada === 'medio_dia' || a.jornada === 'media' ? `Medio día${a.periodo ? ` (${a.periodo.toUpperCase()})` : ''}` : a.jornada === 'personalizado' ? `${a.hora_inicio ?? ''}–${a.hora_fin ?? ''}` : a.jornada === 'reposo' ? 'Reposo' : a.jornada ?? '—'}</td>
                                            <td style={{ fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.notas ?? '—'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )
                              }
                            </>
                          )}
                          {compensatorios.length > 0 && (
                            <div style={{ marginTop: 16 }}>
                              <p className="hv-section-label"><Calendar size={12} /> Días compensatorios ({compensatorios.length})</p>
                              <div className="hv-table-wrap" style={{ border: 'none', boxShadow: 'none' }}>
                                <table className="hv-table">
                                  <thead><tr><th>Tipo</th><th>Cantidad</th><th>Saldo</th><th>Fecha ganado</th><th>Vence</th><th>Estado</th><th>Motivo</th></tr></thead>
                                  <tbody>
                                    {compensatorios.map(c => (
                                      <tr key={c.id}>
                                        <td>{c.tipo ?? '—'}</td>
                                        <td>{c.cantidad}</td>
                                        <td>{c.saldo_restante}</td>
                                        <td>{formatFecha(c.fecha_ganado)}</td>
                                        <td>{formatFecha(c.vence_en)}</td>
                                        <td><span className="hv-badge" style={{ color: c.estado === 'disponible' ? '#16a34a' : c.estado === 'usado' ? '#6b7280' : '#d97706', background: c.estado === 'disponible' ? '#f0fdf4' : c.estado === 'usado' ? '#f9fafb' : '#fffbeb' }}>{c.estado}</span></td>
                                        <td style={{ fontSize: 12 }}>{c.motivo ?? '—'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* ANOTACIONES */}
                  {tabActiva === 'anotaciones' && (
                    <div className="hv-card">
                      <div className="hv-card-header"><h3>Anotaciones e Incidencias</h3>{permisos.crearAnotacion && <button className="hv-btn hv-btn--primary hv-btn--sm" onClick={() => setModal({ tipo: 'anotacion' })}><Plus size={13} /> Registrar</button>}</div>
                      <div className="hv-anot-filters">
                        <select className="hv-filter-select" value={anotFiltroTipo} onChange={e => setAnotFiltroTipo(e.target.value)}>
                          <option value="">Todos los tipos</option>
                          {TIPOS_ANOTACION.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                        <select className="hv-filter-select" value={anotFiltroEstado} onChange={e => setAnotFiltroEstado(e.target.value)}>
                          <option value="">Todos los estados</option>
                          {Object.entries(ESTADO_ANOT_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                        {(anotFiltroTipo || anotFiltroEstado) && <button className="hv-btn hv-btn--ghost hv-btn--sm" onClick={() => { setAnotFiltroTipo(''); setAnotFiltroEstado('') }}><X size={13} /> Limpiar</button>}
                      </div>
                      {anotacionesFiltradas.length === 0 ? <EmptyState msg={anotaciones.length === 0 ? 'Sin anotaciones registradas' : 'Sin resultados para los filtros aplicados'} accion={permisos.crearAnotacion && anotaciones.length === 0 ? () => setModal({ tipo: 'anotacion' }) : null} btnLabel="Registrar primera anotación" /> : (
                        <div className="hv-items-list">
                          {anotacionesFiltradas.map(a => {
                            const tipo = TIPO_ANOT_MAP[a.tipo]
                            const estAnot = ESTADO_ANOT_MAP[a.estado]
                            return (
                              <div key={a.id} className="hv-item">
                                <div className="hv-item-icon" style={{ background: tipo?.cls === 'neg' ? '#fef2f2' : tipo?.cls === 'pos' ? '#f0fdf4' : tipo?.cls === 'neu' ? '#fffbeb' : '#ecfeff' }}>
                                  <AlertCircle size={16} style={{ color: tipo?.cls === 'neg' ? '#dc2626' : tipo?.cls === 'pos' ? '#16a34a' : tipo?.cls === 'neu' ? '#d97706' : '#0891b2' }} />
                                </div>
                                <div className="hv-item-body">
                                  <div className="hv-item-top">
                                    <div>
                                      <p className="hv-item-title">{tipo?.label ?? a.tipo}</p>
                                      <p className="hv-item-sub">
                                        <span>{formatFecha(a.fecha)}{a.hora ? ` · ${a.hora}` : ''}</span>
                                        {estAnot && <span><span className="hv-badge" style={{ color: estAnot.color, background: estAnot.bg }}>{estAnot.label}</span></span>}
                                      </p>
                                    </div>
                                    <CrudBtns permisos={{ editar: permisos.editarAnotacion, eliminar: permisos.eliminarAnotacion }} onEdit={() => setModal({ tipo: 'anotacion', datos: a })} onDel={() => setModal({ tipo: 'confirm', tabla: 'hv_anotaciones', id: a.id, msg: '¿Eliminar esta anotación?' })} />
                                  </div>
                                  <p className="hv-item-obs" style={{ whiteSpace: 'pre-wrap' }}>{a.descripcion}</p>
                                  {a.creado_por_nombre && <p className="hv-timeline-meta">Registrado por {a.creado_por_nombre}</p>}
                                </div>
                              </div>
                            )
                          })}
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

      {/* ── Modales ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {modal?.tipo === 'info_personal' && <ModalInfoPersonal datos={hvPersona} onGuardar={f => guardarHvPersona('hv_personas', f)} onCerrar={() => setModal(null)} guardando={guardando} />}
        {modal?.tipo === 'info_laboral' && <ModalInfoLaboral datos={hvPersona} onGuardar={f => guardarHvPersona('hv_personas', f)} onCerrar={() => setModal(null)} guardando={guardando} />}
        {modal?.tipo === 'capacitacion' && <ModalCapacitacion datos={modal.datos} onGuardar={f => guardarHvPersona('hv_capacitaciones', f)} onCerrar={() => setModal(null)} guardando={guardando} />}
        {modal?.tipo === 'evaluacion' && <ModalEvaluacion datos={modal.datos} onGuardar={f => guardarHvPersona('hv_evaluaciones', f)} onCerrar={() => setModal(null)} guardando={guardando} />}
        {modal?.tipo === 'anotacion' && <ModalAnotacion datos={modal.datos} onGuardar={f => guardarHvPersona('hv_anotaciones', f)} onCerrar={() => setModal(null)} guardando={guardando} />}
        {modal?.tipo === 'confirm' && (
          <ConfirmModal mensaje={modal.msg} onCancelar={() => setModal(null)} cargando={guardando}
            onConfirmar={async () => { setGuardando(true); await eliminarRegistro(modal.tabla, modal.id); setGuardando(false) }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function F({ label, value }) {
  return (
    <div className="hv-info-field">
      <span className="hv-info-label">{label}</span>
      <span className="hv-info-value">{value ?? <span className="hv-info-empty">—</span>}</span>
    </div>
  )
}

function EmptyState({ msg, accion, btnLabel }) {
  return (
    <div className="hv-empty-state">
      <div className="hv-empty-state-icon"><Info size={28} /></div>
      <p>{msg}</p>
      {accion && <button className="hv-btn hv-btn--ghost hv-btn--sm" onClick={accion}><Plus size={13} /> {btnLabel}</button>}
    </div>
  )
}

function CrudBtns({ permisos, onEdit, onDel }) {
  if (!permisos.editar && !permisos.eliminar) return null
  return (
    <div className="hv-row-actions">
      {permisos.editar && <button className="hv-icon-btn" onClick={onEdit}><Edit2 size={13} /></button>}
      {permisos.eliminar && <button className="hv-icon-btn hv-icon-btn--danger" onClick={onDel}><Trash2 size={13} /></button>}
    </div>
  )
}
