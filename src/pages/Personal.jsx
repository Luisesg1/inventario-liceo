// src/pages/Personal.jsx
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, FileText, UserCheck, UserX, Clock, AlertTriangle,
  Plus, Search, X, Pencil, Trash2, Eye, Download, Upload,
  ChevronDown, ChevronUp, Loader2, CheckCircle2, Building2, Briefcase,
  Phone, Mail, Hash, Calendar, RefreshCw, Shield, FileCheck,
  Activity, ClipboardList, CalendarRange, UserCog, Info,
  CalendarCheck, AlertCircle, FilePlus, Filter, FileDown,
  Square, CheckSquare,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase } from '../supabase'
import './Personal.css'

// ─── Constants ────────────────────────────────────────────────
const ESTAMENTOS = [
  { value: 'docente',        label: 'Docente' },
  { value: 'asistente',      label: 'Asistente de la educación' },
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'directivo',      label: 'Directivo' },
  { value: 'otro',           label: 'Otro' },
]

const TIPOS_CONTRATO = [
  { value: 'titular',    label: 'Titular' },
  { value: 'contrata',   label: 'Contrata' },
  { value: 'honorarios', label: 'Honorarios' },
  { value: 'reemplazo',  label: 'Reemplazo' },
  { value: 'otro',       label: 'Otro' },
]

const MOTIVOS_REEMPLAZO = [
  { value: 'licencia_medica',        label: 'Licencia médica' },
  { value: 'permiso_administrativo', label: 'Permiso administrativo' },
  { value: 'cometido',               label: 'Cometido' },
  { value: 'renuncia',               label: 'Renuncia' },
  { value: 'vacante',                label: 'Vacante' },
  { value: 'otro',                   label: 'Otro' },
]

const ESTADOS_REEMPLAZO = [
  { value: 'pendiente',   label: 'Pendiente',   color: '#dc2626', bg: '#fef2f2' },
  { value: 'en_busqueda', label: 'En búsqueda', color: '#d97706', bg: '#fffbeb' },
  { value: 'activo',      label: 'Activo',       color: '#16a34a', bg: '#f0fdf4' },
  { value: 'finalizado',  label: 'Finalizado',  color: '#64748b', bg: '#f8fafc' },
]

const TIPOS_DOC = [
  { value: 'contrato',   label: 'Contrato' },
  { value: 'anexo',      label: 'Anexo' },
  { value: 'decreto',    label: 'Decreto' },
  { value: 'licencia',   label: 'Licencia' },
  { value: 'resolucion', label: 'Resolución' },
  { value: 'otro',       label: 'Otro' },
]

const ESTAMENTO_MAP  = Object.fromEntries(ESTAMENTOS.map(e => [e.value, e.label]))
const CONTRATO_MAP   = Object.fromEntries(TIPOS_CONTRATO.map(t => [t.value, t.label]))
const MOTIVO_MAP     = Object.fromEntries(MOTIVOS_REEMPLAZO.map(m => [m.value, m.label]))
const ESTADO_REEMPL  = Object.fromEntries(ESTADOS_REEMPLAZO.map(s => [s.value, s]))
const TIPOS_DOC_MAP  = Object.fromEntries(TIPOS_DOC.map(t => [t.value, t.label]))

const POR_PAGINA = 10

const overlayV = { hidden: { opacity: 0 }, visible: { opacity: 1 }, exit: { opacity: 0 } }
const modalV   = {
  hidden:  { opacity: 0, scale: 0.95, y: 12 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 400, damping: 30 } },
  exit:    { opacity: 0, scale: 0.95, y: 8, transition: { duration: 0.15 } },
}

// ─── Helpers ──────────────────────────────────────────────────
function formatFecha(d) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function formatRut(rut) {
  if (!rut) return ''
  const clean = rut.replace(/[^0-9kK]/g, '')
  if (clean.length < 2) return clean
  const body = clean.slice(0, -1)
  const dv   = clean.slice(-1).toUpperCase()
  return body.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + dv
}

function validarRut(rut) {
  if (!rut) return false
  const clean = rut.replace(/[^0-9kK]/g, '')
  if (clean.length < 8 || clean.length > 9) return false
  const body = clean.slice(0, -1)
  const dv   = clean.slice(-1).toUpperCase()
  let sum = 0, mul = 2
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * mul
    mul = mul === 7 ? 2 : mul + 1
  }
  const expected = 11 - (sum % 11)
  const expDv = expected === 11 ? '0' : expected === 10 ? 'K' : String(expected)
  return dv === expDv
}

function calcularEstado(c) {
  if (!c.fecha_termino) return 'vigente'
  const today = new Date()
  const term  = new Date(c.fecha_termino + 'T12:00:00')
  if (term < today) return 'finalizado'
  const diff = Math.ceil((term - today) / 86400000)
  if (diff <= 30) return 'por_vencer'
  return 'vigente'
}

function diasHasta(fecha) {
  if (!fecha) return null
  return Math.ceil((new Date(fecha + 'T12:00:00') - new Date()) / 86400000)
}

function todayStr() { return new Date().toISOString().slice(0, 10) }

function formatBytes(n) {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1048576).toFixed(1)} MB`
}

function avatarColor(name = '') {
  const colors = ['#4f46e5','#7c3aed','#0284c7','#0891b2','#059669','#16a34a','#d97706','#dc2626']
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return colors[Math.abs(h) % colors.length]
}

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('')
}

async function auditLog({ accion, tabla, id, nombre, usuario, cambios = {} }) {
  try {
    await supabase.from('personal_audit_logs').insert({
      accion,
      tabla_afectada: tabla,
      registro_id:    id,
      registro_nombre: nombre,
      usuario_id:    usuario?.id,
      usuario_nombre: usuario?.nombre,
      usuario_rol:   usuario?.rol,
      cambios,
    })
  } catch { /* silenciar */ }
  try {
    const cambiosArr = Array.isArray(cambios)
      ? cambios
      : Object.entries(cambios).map(([campo, val]) =>
          val !== null && typeof val === 'object' && ('anterior' in val || 'nuevo' in val)
            ? { campo, anterior: val.anterior, nuevo: val.nuevo }
            : { campo, nuevo: String(val ?? '') }
        )
    await supabase.from('audit_logs').insert({
      bien_nombre:    nombre ?? `${tabla} #${id ?? '?'}`,
      accion,
      cambios:        cambiosArr,
      usuario_id:     usuario?.id,
      usuario_nombre: usuario?.nombre ?? 'Sistema',
      usuario_rol:    usuario?.rol,
      modulo:         'personal',
      creado_en:      new Date().toISOString(),
    })
  } catch { /* silenciar */ }
}

// ─── EstadoBadge ──────────────────────────────────────────────
function EstadoBadge({ estado }) {
  const map = {
    vigente:    { color: '#16a34a', bg: '#f0fdf4', dot: '#16a34a', label: 'Vigente' },
    por_vencer: { color: '#d97706', bg: '#fffbeb', dot: '#d97706', label: 'Por vencer' },
    finalizado: { color: '#64748b', bg: '#f8fafc', dot: '#94a3b8', label: 'Finalizado' },
    pendiente:  { color: '#dc2626', bg: '#fef2f2', dot: '#dc2626', label: 'Pendiente' },
    en_busqueda:{ color: '#d97706', bg: '#fffbeb', dot: '#d97706', label: 'En búsqueda' },
    activo:     { color: '#16a34a', bg: '#f0fdf4', dot: '#16a34a', label: 'Activo' },
  }
  const s = map[estado] ?? { color: '#64748b', bg: '#f8fafc', dot: '#94a3b8', label: estado }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11.5, fontWeight: 600, padding: '3px 9px',
      borderRadius: 20, color: s.color, background: s.bg,
      border: `1px solid ${s.color}30`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      {s.label}
    </span>
  )
}

// ─── Export column definitions ───────────────────────────────
const COLS_CONTRATOS = [
  { header: 'Nombre completo', key: 'nombre_completo' },
  { header: 'RUT', key: 'rut' },
  { header: 'Correo', key: 'correo' },
  { header: 'Teléfono', key: 'telefono' },
  { header: 'Cargo', key: 'cargo' },
  { header: 'Estamento', key: 'estamento' },
  { header: 'Tipo de contrato', key: 'tipo_contrato' },
  { header: 'Fecha inicio', key: 'fecha_inicio' },
  { header: 'Fecha término', key: 'fecha_termino' },
  { header: 'Horas', key: 'horas' },
  { header: 'Estado', key: 'estado' },
  { header: 'Observaciones', key: 'observaciones' },
]
const COLS_REEMPLAZOS = [
  { header: 'Funcionario', key: 'funcionario_nombre' },
  { header: 'Motivo', key: 'motivo' },
  { header: 'Reemplazante', key: 'reemplazante_nombre' },
  { header: 'Cargo', key: 'cargo' },
  { header: 'Asignatura', key: 'asignatura' },
  { header: 'Fecha inicio', key: 'fecha_inicio' },
  { header: 'Fecha término', key: 'fecha_termino' },
  { header: 'Horas', key: 'horas' },
  { header: 'Estado', key: 'estado' },
  { header: 'Observaciones', key: 'observaciones' },
]
const COLS_DOCS = [
  { header: 'Nombre', key: 'nombre' },
  { header: 'Tipo', key: 'tipo_doc' },
  { header: 'Tamaño', key: 'tamanio' },
  { header: 'Contratación', key: 'contratacion' },
  { header: 'Reemplazo', key: 'reemplazo' },
  { header: 'Fecha subida', key: 'subido_en' },
]

function prepContrato(c) {
  return {
    nombre_completo: c.nombre_completo ?? '',
    rut: formatRut(c.rut ?? ''),
    correo: c.correo ?? '',
    telefono: c.telefono ?? '',
    cargo: c.cargo ?? '',
    estamento: ESTAMENTO_MAP[c.estamento] ?? c.estamento ?? '',
    tipo_contrato: CONTRATO_MAP[c.tipo_contrato] ?? c.tipo_contrato ?? '',
    fecha_inicio: c.fecha_inicio ?? '',
    fecha_termino: c.fecha_termino ?? '',
    horas: c.horas != null ? String(c.horas) : '',
    estado: calcularEstado(c),
    observaciones: c.observaciones ?? '',
  }
}
function prepReemplazo(r) {
  return {
    funcionario_nombre: r.funcionario_nombre ?? '',
    motivo: MOTIVO_MAP[r.motivo] ?? r.motivo ?? '',
    reemplazante_nombre: r.reemplazante_nombre ?? '',
    cargo: r.cargo ?? '',
    asignatura: r.asignatura ?? '',
    fecha_inicio: r.fecha_inicio ?? '',
    fecha_termino: r.fecha_termino ?? '',
    horas: r.horas != null ? String(r.horas) : '',
    estado: ESTADO_REEMPL[r.estado]?.label ?? r.estado ?? '',
    observaciones: r.observaciones ?? '',
  }
}
function prepDoc(d, contratos, reemplazos) {
  const c = contratos?.find(x => x.id === d.contratacion_id)
  const r = reemplazos?.find(x => x.id === d.reemplazo_id)
  return {
    nombre: d.nombre ?? '',
    tipo_doc: TIPOS_DOC_MAP[d.tipo_doc] ?? d.tipo_doc ?? '',
    tamanio: formatBytes(d.tamanio),
    contratacion: c?.nombre_completo ?? '',
    reemplazo: r?.funcionario_nombre ?? '',
    subido_en: d.subido_en ? new Date(d.subido_en).toLocaleString('es-CL') : '',
  }
}

const COLS_AUDITORIA = [
  { header: 'Fecha y hora', key: 'creado_en' },
  { header: 'Acción', key: 'accion' },
  { header: 'Módulo', key: 'tabla_afectada' },
  { header: 'Registro', key: 'registro_nombre' },
  { header: 'Usuario', key: 'usuario_nombre' },
  { header: 'Rol', key: 'usuario_rol' },
]

function prepAuditoria(l) {
  const TABLA_LABEL = { contrataciones: 'Contrataciones', reemplazos: 'Reemplazos', personal_documentos: 'Documentos' }
  return {
    creado_en: l.creado_en ? new Date(l.creado_en).toLocaleString('es-CL') : '',
    accion: l.accion ?? '',
    tabla_afectada: TABLA_LABEL[l.tabla_afectada] ?? l.tabla_afectada ?? '',
    registro_nombre: l.registro_nombre ?? '',
    usuario_nombre: l.usuario_nombre ?? '',
    usuario_rol: l.usuario_rol ?? '',
  }
}

// ─── Export utilities ─────────────────────────────────────────
function doCSV(rows, cols, filename) {
  const header = cols.map(c => `"${c.header}"`).join(',')
  const lines = rows.map(r =>
    cols.map(c => {
      const v = String(r[c.key] ?? '')
      return `"${v.replace(/"/g, '""')}"`
    }).join(',')
  )
  const csv = '﻿' + [header, ...lines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename + '.csv'; a.click()
  URL.revokeObjectURL(url)
}

function doExcel(rows, cols, sheetName, filename) {
  const data = rows.map(r => Object.fromEntries(cols.map(c => [c.header, r[c.key] ?? ''])))
  const ws = XLSX.utils.json_to_sheet(data)
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
  for (let C = range.s.c; C <= range.e.c; C++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c: C })
    if (!ws[addr]) continue
    ws[addr].s = { font: { bold: true }, fill: { fgColor: { rgb: '1A237E' } }, fontColor: { rgb: 'FFFFFF' } }
  }
  ws['!cols'] = cols.map(() => ({ wch: 20 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31))
  XLSX.writeFile(wb, filename + '.xlsx')
}

async function fetchImageAsBase64(url) {
  return new Promise((resolve) => {
    const img = new Image(); img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight
        canvas.getContext('2d').drawImage(img, 0, 0)
        resolve(canvas.toDataURL('image/png'))
      } catch { resolve(null) }
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}

async function doPDF(rows, cols, titulo, descripcion, filename, usuarioNombre) {
  let logoDataUrl = null
  let instNombre = 'Liceo JHJ'
  try {
    const [{ data: logoD }, { data: instD }] = await Promise.all([
      supabase.from('configuracion').select('valor').eq('clave', 'logo_url').maybeSingle(),
      supabase.from('configuracion').select('valor').eq('clave', 'nombre_establecimiento').maybeSingle(),
    ])
    if (logoD?.valor) logoDataUrl = await fetchImageAsBase64(logoD.valor)
    if (instD?.valor) instNombre = instD.valor
  } catch { /* continúa sin logo */ }

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  let y = 14

  if (logoDataUrl) {
    try { doc.addImage(logoDataUrl, 'PNG', 12, y, 16, 16) } catch { logoDataUrl = null }
  }
  const textX = logoDataUrl ? 32 : 12

  doc.setFontSize(10).setTextColor(100, 100, 100).setFont('helvetica', 'normal')
  doc.text(instNombre, textX, y + 3)
  doc.setFontSize(16).setTextColor(26, 35, 126).setFont('helvetica', 'bold')
  doc.text(titulo, textX, y + 11)
  doc.setFontSize(8).setTextColor(100, 100, 100).setFont('helvetica', 'normal')
  const meta = [
    descripcion,
    `Exportado: ${new Date().toLocaleString('es-CL')}`,
    usuarioNombre ? `Usuario: ${usuarioNombre}` : '',
    `Total registros: ${rows.length}`,
  ].filter(Boolean).join('   |   ')
  doc.text(meta, textX, y + 17)
  y = Math.max(y + 22, 38)

  autoTable(doc, {
    startY: y,
    head: [cols.map(c => c.header)],
    body: rows.map(r => cols.map(c => String(r[c.key] ?? ''))),
    styles: { fontSize: 7.5, cellPadding: 2.5, overflow: 'linebreak' },
    headStyles: { fillColor: [26, 35, 126], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 12, right: 12 },
    columnStyles: Object.fromEntries(cols.map((_, i) => [i, { cellWidth: 'auto' }])),
  })

  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7).setTextColor(160).setFont('helvetica', 'normal')
    doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.getWidth() - 12, doc.internal.pageSize.getHeight() - 6, { align: 'right' })
  }
  doc.save(filename + '.pdf')
}

// ─── ExportMenu ───────────────────────────────────────────────
function ExportMenu({ todos, filtrados, seleccionados, colsDef, prepFn, nombreArchivo, titulo, usuarioNombre }) {
  const [abierto, setAbierto] = useState(false)
  const [exportando, setExportando] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setAbierto(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  async function exportar(scope, fmt) {
    setAbierto(false)
    setExportando(true)
    const data = scope === 'todo' ? todos : scope === 'filtrado' ? filtrados : seleccionados
    if (!data.length) { setExportando(false); return }
    const rows = data.map(r => prepFn(r))
    const fecha = new Date().toISOString().slice(0, 10)
    const fname = `${nombreArchivo}_${fecha}`
    const desc = scope === 'filtrado' ? `Filtrados: ${data.length}` : scope === 'sel' ? `Seleccionados: ${data.length}` : ''
    try {
      if (fmt === 'csv') doCSV(rows, colsDef, fname)
      else if (fmt === 'excel') doExcel(rows, colsDef, titulo, fname)
      else await doPDF(rows, colsDef, titulo, desc, fname, usuarioNombre)
    } catch (e) { console.error('Export error:', e) }
    setExportando(false)
  }

  const scopes = [
    { key: 'todo', label: 'Todo', n: todos.length },
    { key: 'filtrado', label: 'Filtrados', n: filtrados.length },
    { key: 'sel', label: 'Seleccionados', n: seleccionados.length, disabled: seleccionados.length === 0 },
  ]
  const fmts = [
    { key: 'excel', label: 'Excel (.xlsx)', ico: '📊' },
    { key: 'pdf',   label: 'PDF',           ico: '📄' },
    { key: 'csv',   label: 'CSV',           ico: '📋' },
  ]

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="btn-export" onClick={() => setAbierto(a => !a)} disabled={exportando}>
        {exportando ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />}
        Exportar <ChevronDown size={11} />
      </button>
      {abierto && (
        <div className="personal-export-dropdown">
          {scopes.map(s => (
            <div key={s.key}>
              <p className="personal-export-group-label">
                {s.label} <span className="personal-export-badge">{s.n}</span>
              </p>
              {fmts.map(f => (
                <button key={f.key} className="personal-export-item" disabled={s.disabled}
                  onClick={() => exportar(s.key, f.key)}>
                  {f.ico} {f.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── BulkBar ──────────────────────────────────────────────────
function BulkBar({ count, onExportar, onEliminar, onLimpiar, puedeEliminar }) {
  if (count === 0) return null
  return (
    <div className="personal-bulk-bar">
      <span className="personal-bulk-count">{count} seleccionado{count !== 1 ? 's' : ''}</span>
      <div style={{ display: 'flex', gap: 8 }}>
        {onExportar && <button className="personal-bulk-btn" onClick={onExportar}><FileDown size={13} /> Exportar</button>}
        {puedeEliminar && <button className="personal-bulk-btn danger" onClick={onEliminar}><Trash2 size={13} /> Eliminar</button>}
        <button className="personal-bulk-btn" onClick={onLimpiar}><X size={13} /> Limpiar selección</button>
      </div>
    </div>
  )
}

// ─── Advanced filter defaults ─────────────────────────────────
const DEFAULT_FILTROS_CONTRATOS = {
  busq: '', estado: '', estamento: '', tipo_contrato: '',
  fecha_inicio_desde: '', fecha_inicio_hasta: '',
  fecha_termino_desde: '', fecha_termino_hasta: '',
  vencer_dias: '', horas_min: '', horas_max: '',
}
const DEFAULT_FILTROS_REEMPLAZOS = {
  busq: '', estado: '', motivo: '', cargo: '', asignatura: '',
  fecha_inicio_desde: '', fecha_inicio_hasta: '',
  fecha_termino_desde: '', fecha_termino_hasta: '',
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD TAB
// ═══════════════════════════════════════════════════════════════
function DashboardTab({ usuario, onIrA }) {
  const [kpi, setKpi] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [recientes, setRecientes] = useState([])

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    const today = todayStr()
    const d7  = new Date(); d7.setDate(d7.getDate() + 7);   const s7  = d7.toISOString().slice(0,10)
    const d15 = new Date(); d15.setDate(d15.getDate() + 15); const s15 = d15.toISOString().slice(0,10)
    const d30 = new Date(); d30.setDate(d30.getDate() + 30); const s30 = d30.toISOString().slice(0,10)

    const [
      { data: contratos },
      { data: reemplazos },
      { data: ausencias },
    ] = await Promise.all([
      supabase.from('contrataciones').select('id, fecha_termino'),
      supabase.from('reemplazos').select('id, estado, ausencia_id'),
      supabase.from('ausencias').select('id, tipo'),
    ])

    const vigentes   = (contratos ?? []).filter(c => calcularEstado(c) === 'vigente').length
    const finalizados= (contratos ?? []).filter(c => calcularEstado(c) === 'finalizado').length
    const vencer7    = (contratos ?? []).filter(c => {
      const d = diasHasta(c.fecha_termino)
      return d !== null && d >= 0 && d <= 7
    }).length
    const vencer15   = (contratos ?? []).filter(c => {
      const d = diasHasta(c.fecha_termino)
      return d !== null && d >= 0 && d <= 15
    }).length
    const vencer30   = (contratos ?? []).filter(c => {
      const d = diasHasta(c.fecha_termino)
      return d !== null && d >= 0 && d <= 30
    }).length

    const reemplActivos   = (reemplazos ?? []).filter(r => r.estado === 'activo').length
    const reemplPendientes= (reemplazos ?? []).filter(r => r.estado === 'pendiente').length

    const reemplazoAusenciaIds = new Set((reemplazos ?? []).filter(r => r.ausencia_id).map(r => r.ausencia_id))
    const ausConReemplazo   = (ausencias ?? []).filter(a => reemplazoAusenciaIds.has(a.id)).length
    const ausSinReemplazo   = (ausencias ?? []).filter(a =>
      ['licencia_medica','cometido'].includes(a.tipo) && !reemplazoAusenciaIds.has(a.id)
    ).length

    setKpi({ vigentes, finalizados, vencer7, vencer15, vencer30, reemplActivos, reemplPendientes, ausConReemplazo, ausSinReemplazo, totalContratos: (contratos ?? []).length })

    const { data: rec } = await supabase.from('contrataciones')
      .select('id, nombre_completo, cargo, tipo_contrato, fecha_termino, creado_en')
      .order('creado_en', { ascending: false }).limit(5)
    setRecientes(rec ?? [])
    setCargando(false)
  }

  if (cargando) return (
    <div className="personal-loading">
      <Loader2 size={20} className="animate-spin" /> Cargando resumen...
    </div>
  )

  const cards = [
    {
      label: 'Contratos Vigentes', value: kpi.vigentes,
      icon: <FileCheck size={18} />, iconBg: '#eff6ff', iconColor: '#1d4ed8',
      sub: `${kpi.totalContratos} total`,
    },
    {
      label: 'Contratos por Vencer', special: true,
      icon: <Clock size={18} />, iconBg: '#fffbeb', iconColor: '#d97706',
    },
    {
      label: 'Reemplazos Activos', value: kpi.reemplActivos,
      icon: <UserCheck size={18} />, iconBg: '#f0fdf4', iconColor: '#16a34a',
      sub: `${kpi.reemplPendientes} pendiente${kpi.reemplPendientes !== 1 ? 's' : ''}`,
    },
    {
      label: 'Reemplazos Pendientes', value: kpi.reemplPendientes,
      icon: <UserX size={18} />, iconBg: '#fef2f2', iconColor: '#dc2626',
      sub: 'sin asignar',
    },
    {
      label: 'Licencias con Reemplazo', value: kpi.ausConReemplazo,
      icon: <CalendarCheck size={18} />, iconBg: '#f0fdf4', iconColor: '#16a34a',
      sub: 'cubiertos',
    },
    {
      label: 'Licencias sin Reemplazo', value: kpi.ausSinReemplazo,
      icon: <AlertCircle size={18} />, iconBg: '#fff7ed', iconColor: '#ea580c',
      sub: 'por cubrir',
    },
  ]

  return (
    <div>
      {/* Alerta contratos por vencer */}
      {kpi.vencer7 > 0 && (
        <div className="personal-alert-banner">
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />
          <span>
            <strong>{kpi.vencer7} contrato{kpi.vencer7 !== 1 ? 's' : ''}</strong> vence{kpi.vencer7 !== 1 ? 'n' : ''} en los próximos 7 días.
          </span>
          <button onClick={() => onIrA('contrataciones')}>Ver contratos</button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="personal-kpi-grid">
        {cards.map(c => (
          <div key={c.label} className="personal-kpi-card">
            <div className="personal-kpi-header">
              <p className="personal-kpi-label">{c.label}</p>
              <div className="personal-kpi-icon" style={{ background: c.iconBg, color: c.iconColor }}>
                {c.icon}
              </div>
            </div>
            {c.special ? (
              <div className="personal-kpi-vencer">
                {[['7 días', kpi.vencer7], ['15 días', kpi.vencer15], ['30 días', kpi.vencer30]].map(([lbl, val]) => (
                  <div key={lbl} className="personal-kpi-vencer-row">
                    <span className="personal-kpi-vencer-label">{lbl}</span>
                    <span className="personal-kpi-vencer-val" style={{ color: val > 0 ? '#d97706' : '#0f172a' }}>{val}</span>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <p className="personal-kpi-value">{c.value}</p>
                {c.sub && <p className="personal-kpi-sub">{c.sub}</p>}
              </>
            )}
          </div>
        ))}
      </div>

      {/* Recientes */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 14.5, color: '#0f172a' }}>Últimas contrataciones</p>
          <button onClick={() => onIrA('contrataciones')} style={{ background: 'none', border: 'none', color: 'rgb(var(--primary-rgb,26,35,126))', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Ver todas →
          </button>
        </div>
        {recientes.length === 0 ? (
          <div className="personal-empty" style={{ padding: '30px 20px' }}>
            <p>Sin contrataciones registradas</p>
          </div>
        ) : (
          <table className="personal-table">
            <thead>
              <tr>
                <th>Funcionario</th>
                <th>Tipo</th>
                <th>Vence</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {recientes.map(c => (
                <tr key={c.id}>
                  <td>
                    <p className="personal-table-name">{c.nombre_completo}</p>
                    <p className="personal-table-sub">{c.cargo}</p>
                  </td>
                  <td>{CONTRATO_MAP[c.tipo_contrato] ?? c.tipo_contrato}</td>
                  <td>{formatFecha(c.fecha_termino)}</td>
                  <td><EstadoBadge estado={calcularEstado(c)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// CONTRATACIONES TAB
// ═══════════════════════════════════════════════════════════════
function ContratacionesTab({ usuario, permisos }) {
  const [registros,       setRegistros]       = useState([])
  const [cargando,        setCargando]        = useState(true)
  const [errorCarga,      setErrorCarga]      = useState('')
  const [filtros,         setFiltros]         = useState(DEFAULT_FILTROS_CONTRATOS)
  const [mostrarFiltros,  setMostrarFiltros]  = useState(false)
  const [pagina,          setPagina]          = useState(1)
  const [modal,           setModal]           = useState(null)
  const [detalle,         setDetalle]         = useState(null)
  const [eliminar,        setEliminar]        = useState(null)
  const [eliminando,      setEliminando]      = useState(false)
  const [seleccionados,   setSeleccionados]   = useState(new Set())
  const [confirmarMasivo, setConfirmarMasivo] = useState(false)
  const [eliminandoMas,   setEliminandoMas]   = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true); setErrorCarga('')
    const { data, error } = await supabase.from('contrataciones').select('*').order('creado_en', { ascending: false })
    if (error) setErrorCarga('No se pudieron cargar las contrataciones: ' + error.message)
    setRegistros(data ?? [])
    setCargando(false)
  }

  async function handleGuardar(datos) {
    const esEdicion = !!datos.id
    const payload = {
      nombre_completo: datos.nombre_completo.trim(),
      rut:             datos.rut.replace(/[^0-9kK]/g, '').toUpperCase(),
      correo:          datos.correo?.trim() || null,
      telefono:        datos.telefono?.trim() || null,
      cargo:           datos.cargo.trim(),
      estamento:       datos.estamento,
      tipo_contrato:   datos.tipo_contrato,
      fecha_inicio:    datos.fecha_inicio,
      fecha_termino:   datos.fecha_termino || null,
      horas:           datos.horas ? parseInt(datos.horas) : null,
      observaciones:   datos.observaciones?.trim() || null,
      actualizado_en:  new Date().toISOString(),
    }
    if (esEdicion) {
      const { error } = await supabase.from('contrataciones').update(payload).eq('id', datos.id)
      if (error) return 'No se pudo guardar la contratación: ' + error.message
      await auditLog({ accion: 'editar', tabla: 'contrataciones', id: datos.id, nombre: datos.nombre_completo, usuario, cambios: payload })
    } else {
      payload.creado_por = usuario.id
      const { error } = await supabase.from('contrataciones').insert(payload)
      if (error) return 'No se pudo crear la contratación: ' + error.message
      await auditLog({ accion: 'crear', tabla: 'contrataciones', nombre: datos.nombre_completo, usuario, cambios: payload })
    }
    await cargar(); setModal(null); return null
  }

  async function handleEliminar() {
    setEliminando(true)
    const { error } = await supabase.from('contrataciones').delete().eq('id', eliminar.id)
    if (!error) {
      await auditLog({ accion: 'eliminar', tabla: 'contrataciones', id: eliminar.id, nombre: eliminar.nombre_completo, usuario })
      await cargar(); setEliminar(null)
    }
    setEliminando(false)
  }

  async function handleEliminarMasivo() {
    setEliminandoMas(true)
    const ids = [...seleccionados]
    const { error } = await supabase.from('contrataciones').delete().in('id', ids)
    if (!error) {
      await Promise.all(ids.map(id => {
        const r = registros.find(x => x.id === id)
        return auditLog({ accion: 'eliminar', tabla: 'contrataciones', id, nombre: r?.nombre_completo, usuario })
      }))
      setSeleccionados(new Set()); setConfirmarMasivo(false); await cargar()
    }
    setEliminandoMas(false)
  }

  const filtrados = useMemo(() => {
    const f = filtros
    return registros.filter(r => {
      const estado = calcularEstado(r)
      if (f.estado && estado !== f.estado) return false
      if (f.estamento && r.estamento !== f.estamento) return false
      if (f.tipo_contrato && r.tipo_contrato !== f.tipo_contrato) return false
      if (f.fecha_inicio_desde && (!r.fecha_inicio || r.fecha_inicio < f.fecha_inicio_desde)) return false
      if (f.fecha_inicio_hasta && (!r.fecha_inicio || r.fecha_inicio > f.fecha_inicio_hasta)) return false
      if (f.fecha_termino_desde && (!r.fecha_termino || r.fecha_termino < f.fecha_termino_desde)) return false
      if (f.fecha_termino_hasta && (!r.fecha_termino || r.fecha_termino > f.fecha_termino_hasta)) return false
      if (f.vencer_dias) {
        const d = diasHasta(r.fecha_termino)
        if (d === null || d < 0 || d > parseInt(f.vencer_dias)) return false
      }
      if (f.horas_min && (r.horas == null || r.horas < parseInt(f.horas_min))) return false
      if (f.horas_max && (r.horas == null || r.horas > parseInt(f.horas_max))) return false
      if (!f.busq) return true
      const q = f.busq.toLowerCase()
      return r.nombre_completo?.toLowerCase().includes(q)
        || r.rut?.includes(q)
        || r.correo?.toLowerCase().includes(q)
        || r.cargo?.toLowerCase().includes(q)
        || ESTAMENTO_MAP[r.estamento]?.toLowerCase().includes(q)
        || CONTRATO_MAP[r.tipo_contrato]?.toLowerCase().includes(q)
        || estado.includes(q)
    })
  }, [registros, filtros])

  const total   = filtrados.length
  const inicio  = (pagina - 1) * POR_PAGINA
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA))
  const vista   = filtrados.slice(inicio, inicio + POR_PAGINA)

  const todosIds = filtrados.map(r => r.id)
  const todosSelec = todosIds.length > 0 && todosIds.every(id => seleccionados.has(id))
  const algunoSelec = todosIds.some(id => seleccionados.has(id))

  function toggleTodo() {
    if (todosSelec) setSeleccionados(new Set())
    else setSeleccionados(new Set(todosIds))
  }
  function toggleUno(id) {
    setSeleccionados(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const selData = registros.filter(r => seleccionados.has(r.id))
  const filtrosActivos = Object.entries(filtros).filter(([k, v]) => k !== 'busq' && v !== '').length
  function setF(k, v) { setFiltros(f => ({ ...f, [k]: v })); setPagina(1) }
  function resetFiltros() { setFiltros(DEFAULT_FILTROS_CONTRATOS); setPagina(1) }

  return (
    <div>
      <BulkBar
        count={seleccionados.size}
        onExportar={null}
        onEliminar={() => setConfirmarMasivo(true)}
        onLimpiar={() => setSeleccionados(new Set())}
        puedeEliminar={permisos.eliminarContrat}
      />

      {/* Toolbar */}
      <div className="personal-toolbar">
        <div className="personal-search">
          <Search size={14} className="personal-search-icon" />
          <input value={filtros.busq} onChange={e => setF('busq', e.target.value)}
            placeholder="Buscar nombre, RUT, correo, cargo…" />
          {filtros.busq && <button onClick={() => setF('busq', '')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', padding: 0 }}><X size={13} /></button>}
        </div>
        <button className="btn-toggle-filtros" onClick={() => setMostrarFiltros(m => !m)}>
          <Filter size={13} />
          Filtros
          {filtrosActivos > 0 && <span className="personal-filter-badge">{filtrosActivos}</span>}
          {mostrarFiltros ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        <ExportMenu
          todos={registros} filtrados={filtrados} seleccionados={selData}
          colsDef={COLS_CONTRATOS} prepFn={prepContrato}
          nombreArchivo="contrataciones" titulo="Contrataciones" usuarioNombre={usuario?.nombre}
        />
        {permisos.crearContrat && (
          <button className="btn-primary" onClick={() => setModal('crear')}><Plus size={15} /> Nueva contratación</button>
        )}
      </div>

      {/* Panel filtros avanzados */}
      {mostrarFiltros && (
        <div className="personal-filtros-panel">
          <div className="personal-filtros-grid">
            <div className="personal-filtros-field">
              <label>Estado</label>
              <select value={filtros.estado} onChange={e => setF('estado', e.target.value)} className={filtros.estado ? 'activo' : ''}>
                <option value="">Todos</option>
                <option value="vigente">Vigente</option>
                <option value="por_vencer">Por vencer</option>
                <option value="finalizado">Finalizado</option>
              </select>
            </div>
            <div className="personal-filtros-field">
              <label>Estamento</label>
              <select value={filtros.estamento} onChange={e => setF('estamento', e.target.value)} className={filtros.estamento ? 'activo' : ''}>
                <option value="">Todos</option>
                {ESTAMENTOS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="personal-filtros-field">
              <label>Tipo contrato</label>
              <select value={filtros.tipo_contrato} onChange={e => setF('tipo_contrato', e.target.value)} className={filtros.tipo_contrato ? 'activo' : ''}>
                <option value="">Todos</option>
                {TIPOS_CONTRATO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="personal-filtros-field">
              <label>Vence en</label>
              <select value={filtros.vencer_dias} onChange={e => setF('vencer_dias', e.target.value)} className={filtros.vencer_dias ? 'activo' : ''}>
                <option value="">Sin filtro</option>
                <option value="7">7 días</option>
                <option value="15">15 días</option>
                <option value="30">30 días</option>
              </select>
            </div>
            <div className="personal-filtros-field">
              <label>Inicio desde</label>
              <input type="date" value={filtros.fecha_inicio_desde} onChange={e => setF('fecha_inicio_desde', e.target.value)} className={filtros.fecha_inicio_desde ? 'activo' : ''} />
            </div>
            <div className="personal-filtros-field">
              <label>Inicio hasta</label>
              <input type="date" value={filtros.fecha_inicio_hasta} onChange={e => setF('fecha_inicio_hasta', e.target.value)} className={filtros.fecha_inicio_hasta ? 'activo' : ''} />
            </div>
            <div className="personal-filtros-field">
              <label>Término desde</label>
              <input type="date" value={filtros.fecha_termino_desde} onChange={e => setF('fecha_termino_desde', e.target.value)} className={filtros.fecha_termino_desde ? 'activo' : ''} />
            </div>
            <div className="personal-filtros-field">
              <label>Término hasta</label>
              <input type="date" value={filtros.fecha_termino_hasta} onChange={e => setF('fecha_termino_hasta', e.target.value)} className={filtros.fecha_termino_hasta ? 'activo' : ''} />
            </div>
            <div className="personal-filtros-field">
              <label>Horas mín.</label>
              <input type="number" min="0" value={filtros.horas_min} onChange={e => setF('horas_min', e.target.value)} placeholder="0" className={filtros.horas_min ? 'activo' : ''} />
            </div>
            <div className="personal-filtros-field">
              <label>Horas máx.</label>
              <input type="number" min="0" value={filtros.horas_max} onChange={e => setF('horas_max', e.target.value)} placeholder="44" className={filtros.horas_max ? 'activo' : ''} />
            </div>
            {filtrosActivos > 0 && (
              <div className="personal-filtros-actions">
                <button className="btn-filtros-reset" onClick={resetFiltros}><X size={13} /> Limpiar</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {errorCarga && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#b91c1c', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertCircle size={16} />{errorCarga}
          <button onClick={cargar} style={{ marginLeft: 'auto', background: 'none', border: '1px solid #fca5a5', borderRadius: 6, padding: '3px 10px', color: '#b91c1c', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>Reintentar</button>
        </div>
      )}

      {/* Tabla */}
      {cargando ? (
        <div className="personal-loading"><Loader2 size={18} className="animate-spin" /> Cargando contrataciones…</div>
      ) : (
        <div className="personal-table-wrap">
          {filtrados.length === 0 ? (
            <div className="personal-empty">
              <div className="personal-empty-icon"><FileText size={24} /></div>
              <p>No hay contrataciones que mostrar</p>
              <span>{filtros.busq || filtrosActivos > 0 ? 'Ajusta los filtros de búsqueda' : 'Crea la primera contratación'}</span>
            </div>
          ) : (
            <>
              <table className="personal-table">
                <thead>
                  <tr>
                    <th className="col-check">
                      <button onClick={toggleTodo} style={{ background: 'none', border: 'none', cursor: 'pointer', color: algunoSelec ? 'rgb(var(--primary-rgb,26,35,126))' : '#94a3b8', display: 'flex', padding: 0 }}>
                        {todosSelec ? <CheckSquare size={16} /> : algunoSelec ? <CheckSquare size={16} style={{ opacity: 0.5 }} /> : <Square size={16} />}
                      </button>
                    </th>
                    <th>Nombre</th>
                    <th>RUT</th>
                    <th>Cargo / Estamento</th>
                    <th>Tipo contrato</th>
                    <th>Vigencia</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {vista.map(c => {
                    const estado = calcularEstado(c)
                    const dias   = diasHasta(c.fecha_termino)
                    const sel    = seleccionados.has(c.id)
                    return (
                      <tr key={c.id} className={sel ? 'selected' : ''} onClick={() => toggleUno(c.id)} style={{ cursor: 'pointer' }}>
                        <td className="col-check" onClick={e => e.stopPropagation()}>
                          <button onClick={() => toggleUno(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: sel ? 'rgb(var(--primary-rgb,26,35,126))' : '#94a3b8', display: 'flex', padding: 0 }}>
                            {sel ? <CheckSquare size={16} /> : <Square size={16} />}
                          </button>
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <p className="personal-table-name">{c.nombre_completo}</p>
                          <p className="personal-table-sub">{c.correo || '—'}</p>
                        </td>
                        <td onClick={e => e.stopPropagation()} style={{ fontFamily: 'monospace', fontSize: 13 }}>{formatRut(c.rut)}</td>
                        <td onClick={e => e.stopPropagation()}>
                          <p style={{ margin: 0, fontSize: 13.5 }}>{c.cargo}</p>
                          <p className="personal-table-sub">{ESTAMENTO_MAP[c.estamento] ?? c.estamento}</p>
                        </td>
                        <td onClick={e => e.stopPropagation()}>{CONTRATO_MAP[c.tipo_contrato] ?? c.tipo_contrato}</td>
                        <td onClick={e => e.stopPropagation()}>
                          <p style={{ margin: 0, fontSize: 13 }}>{formatFecha(c.fecha_inicio)}</p>
                          {c.fecha_termino && <p className="personal-table-sub">hasta {formatFecha(c.fecha_termino)}</p>}
                          {estado === 'por_vencer' && dias !== null && dias >= 0 && (
                            <span className="personal-vencer-alert"><AlertTriangle size={11} /> {dias}d</span>
                          )}
                        </td>
                        <td onClick={e => e.stopPropagation()}><EstadoBadge estado={estado} /></td>
                        <td onClick={e => e.stopPropagation()}>
                          <div className="personal-actions">
                            <button className="personal-action-btn" title="Ver detalle" onClick={() => setDetalle(c)}><Eye size={14} /></button>
                            {permisos.editarContrat && (
                              <button className="personal-action-btn" title="Editar" onClick={() => setModal(c)}><Pencil size={14} /></button>
                            )}
                            {permisos.eliminarContrat && (
                              <button className="personal-action-btn danger" title="Eliminar" onClick={() => setEliminar(c)}><Trash2 size={14} /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {total > POR_PAGINA && (
                <div className="personal-pagination">
                  <span className="personal-pagination-info">{inicio + 1}–{Math.min(inicio + POR_PAGINA, total)} de {total}</span>
                  <div className="personal-pagination-btns">
                    <button className="personal-pagination-btn" disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}>‹ Anterior</button>
                    {Array.from({ length: Math.min(5, paginas) }, (_, i) => {
                      const p = i + 1
                      return <button key={p} className={`personal-pagination-btn ${pagina === p ? 'active' : ''}`} onClick={() => setPagina(p)}>{p}</button>
                    })}
                    <button className="personal-pagination-btn" disabled={pagina === paginas} onClick={() => setPagina(p => p + 1)}>Siguiente ›</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <AnimatePresence>
        {modal && (
          <ModalContratacion datos={modal === 'crear' ? null : modal} onGuardar={handleGuardar} onClose={() => setModal(null)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {detalle && (
          <ModalDetalleContratacion datos={detalle} onClose={() => setDetalle(null)}
            onEditar={permisos.editarContrat ? (d) => { setDetalle(null); setModal(d) } : null} />
        )}
      </AnimatePresence>

      {/* Confirmar eliminar individual */}
      <AnimatePresence>
        {eliminar && (
          <motion.div className="personal-overlay" variants={overlayV} initial="hidden" animate="visible" exit="hidden"
            onClick={() => !eliminando && setEliminar(null)}>
            <motion.div className="personal-modal personal-confirm-modal" variants={modalV} initial="hidden" animate="visible" exit="hidden"
              onClick={e => e.stopPropagation()}>
              <div className="personal-confirm-icon" style={{ background: '#fef2f2' }}><Trash2 size={22} style={{ color: '#dc2626' }} /></div>
              <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: '#0f172a' }}>¿Eliminar contratación?</h3>
              <p style={{ margin: '0 0 6px', fontSize: 13.5, color: '#475569', lineHeight: 1.5 }}>
                Se eliminará el registro de <strong>{eliminar.nombre_completo}</strong> y todos sus documentos.
              </p>
              <p style={{ margin: '0 0 24px', fontSize: 12.5, color: '#94a3b8' }}>Esta acción no se puede deshacer.</p>
              <div className="personal-form-actions">
                <button className="btn-secondary" onClick={() => setEliminar(null)} disabled={eliminando}>Cancelar</button>
                <button className="btn-danger" onClick={handleEliminar} disabled={eliminando}>
                  {eliminando ? <><Loader2 size={14} className="animate-spin" /> Eliminando…</> : 'Sí, eliminar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmar eliminar masivo */}
      <AnimatePresence>
        {confirmarMasivo && (
          <motion.div className="personal-overlay" variants={overlayV} initial="hidden" animate="visible" exit="hidden"
            onClick={() => !eliminandoMas && setConfirmarMasivo(false)}>
            <motion.div className="personal-modal personal-confirm-modal" variants={modalV} initial="hidden" animate="visible" exit="hidden"
              onClick={e => e.stopPropagation()}>
              <div className="personal-confirm-icon" style={{ background: '#fef2f2' }}><Trash2 size={22} style={{ color: '#dc2626' }} /></div>
              <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: '#0f172a' }}>¿Eliminar {seleccionados.size} contratación{seleccionados.size !== 1 ? 'es' : ''}?</h3>
              <p style={{ margin: '0 0 24px', fontSize: 13.5, color: '#475569', lineHeight: 1.5 }}>
                Se eliminarán todos los registros seleccionados y sus documentos asociados. Esta acción no se puede deshacer.
              </p>
              <div className="personal-form-actions">
                <button className="btn-secondary" onClick={() => setConfirmarMasivo(false)} disabled={eliminandoMas}>Cancelar</button>
                <button className="btn-danger" onClick={handleEliminarMasivo} disabled={eliminandoMas}>
                  {eliminandoMas ? <><Loader2 size={14} className="animate-spin" /> Eliminando…</> : `Sí, eliminar ${seleccionados.size}`}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Modal Crear/Editar Contratación ──────────────────────────
function ModalContratacion({ datos, onGuardar, onClose }) {
  const esEdicion = !!datos
  const [form, setForm]     = useState({
    nombre_completo: datos?.nombre_completo ?? '',
    rut:             datos ? formatRut(datos.rut) : '',
    correo:          datos?.correo ?? '',
    telefono:        datos?.telefono ?? '',
    cargo:           datos?.cargo ?? '',
    estamento:       datos?.estamento ?? 'docente',
    tipo_contrato:   datos?.tipo_contrato ?? 'contrata',
    fecha_inicio:    datos?.fecha_inicio ?? '',
    fecha_termino:   datos?.fecha_termino ?? '',
    horas:           datos?.horas ?? '',
    observaciones:   datos?.observaciones ?? '',
  })
  const [errors,    setErrors]    = useState({})
  const [guardando, setGuardando] = useState(false)
  const [errGlobal, setErrGlobal] = useState('')

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })) }

  function validar() {
    const e = {}
    if (!form.nombre_completo.trim()) e.nombre_completo = 'Requerido'
    if (!form.rut.trim()) e.rut = 'Requerido'
    else if (!validarRut(form.rut)) e.rut = 'RUT inválido'
    if (!form.cargo.trim()) e.cargo = 'Requerido'
    if (!form.fecha_inicio) e.fecha_inicio = 'Requerida'
    if (form.fecha_termino && form.fecha_inicio && form.fecha_termino < form.fecha_inicio)
      e.fecha_termino = 'Debe ser posterior al inicio'
    if (form.horas && parseInt(form.horas) < 0) e.horas = 'Valor inválido'
    return e
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validar()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setGuardando(true)
    setErrGlobal('')
    const err = await onGuardar({ ...form, id: datos?.id })
    if (err) { setErrGlobal(err); setGuardando(false) }
  }

  return (
    <motion.div className="personal-overlay" variants={overlayV} initial="hidden" animate="visible" exit="hidden"
      onClick={() => !guardando && onClose()}
    >
      <motion.div className="personal-modal personal-modal-wide" variants={modalV} initial="hidden" animate="visible" exit="hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="personal-modal-header">
          <h2>{esEdicion ? 'Editar contratación' : 'Nueva contratación'}</h2>
          <button className="personal-modal-close" onClick={onClose} disabled={guardando}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Información personal */}
          <div className="personal-form-section">
            <p className="personal-form-section-title">Información personal</p>
            <div className="personal-form-grid">
              <div className="personal-form-field full">
                <label>Nombre completo *</label>
                <input value={form.nombre_completo} onChange={e => set('nombre_completo', e.target.value)}
                  placeholder="Nombre Apellido" className={errors.nombre_completo ? 'error' : ''} />
                {errors.nombre_completo && <span className="personal-form-error">{errors.nombre_completo}</span>}
              </div>
              <div className="personal-form-field">
                <label>RUT *</label>
                <input value={form.rut} onChange={e => set('rut', e.target.value)}
                  placeholder="12.345.678-9" className={errors.rut ? 'error' : ''} />
                {errors.rut && <span className="personal-form-error">{errors.rut}</span>}
              </div>
              <div className="personal-form-field">
                <label>Correo electrónico</label>
                <input type="email" value={form.correo} onChange={e => set('correo', e.target.value)}
                  placeholder="correo@ejemplo.cl" />
              </div>
              <div className="personal-form-field">
                <label>Teléfono</label>
                <input value={form.telefono} onChange={e => set('telefono', e.target.value)}
                  placeholder="+56 9 XXXX XXXX" />
              </div>
            </div>
          </div>

          {/* Información laboral */}
          <div className="personal-form-section">
            <p className="personal-form-section-title">Información laboral</p>
            <div className="personal-form-grid">
              <div className="personal-form-field full">
                <label>Cargo *</label>
                <input value={form.cargo} onChange={e => set('cargo', e.target.value)}
                  placeholder="Ej: Docente de Matemáticas" className={errors.cargo ? 'error' : ''} />
                {errors.cargo && <span className="personal-form-error">{errors.cargo}</span>}
              </div>
              <div className="personal-form-field">
                <label>Estamento</label>
                <select value={form.estamento} onChange={e => set('estamento', e.target.value)}>
                  {ESTAMENTOS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="personal-form-field">
                <label>Tipo de contrato</label>
                <select value={form.tipo_contrato} onChange={e => set('tipo_contrato', e.target.value)}>
                  {TIPOS_CONTRATO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Contrato */}
          <div className="personal-form-section">
            <p className="personal-form-section-title">Contrato</p>
            <div className="personal-form-grid three">
              <div className="personal-form-field">
                <label>Fecha inicio *</label>
                <input type="date" value={form.fecha_inicio} onChange={e => set('fecha_inicio', e.target.value)}
                  className={errors.fecha_inicio ? 'error' : ''} />
                {errors.fecha_inicio && <span className="personal-form-error">{errors.fecha_inicio}</span>}
              </div>
              <div className="personal-form-field">
                <label>Fecha término</label>
                <input type="date" value={form.fecha_termino} onChange={e => set('fecha_termino', e.target.value)}
                  className={errors.fecha_termino ? 'error' : ''} />
                {errors.fecha_termino && <span className="personal-form-error">{errors.fecha_termino}</span>}
              </div>
              <div className="personal-form-field">
                <label>Horas contratadas</label>
                <input type="number" min="0" value={form.horas} onChange={e => set('horas', e.target.value)}
                  placeholder="44" className={errors.horas ? 'error' : ''} />
                {errors.horas && <span className="personal-form-error">{errors.horas}</span>}
              </div>
            </div>
          </div>

          {/* Observaciones */}
          <div className="personal-form-section">
            <p className="personal-form-section-title">Observaciones</p>
            <div className="personal-form-grid full">
              <div className="personal-form-field full">
                <textarea value={form.observaciones} onChange={e => set('observaciones', e.target.value)}
                  placeholder="Notas adicionales sobre esta contratación…" rows={3} />
              </div>
            </div>
          </div>

          {errGlobal && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 9, padding: '10px 14px', fontSize: 13, color: '#b91c1c', marginBottom: 12 }}>
              {errGlobal}
            </div>
          )}

          <div className="personal-form-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={guardando}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={guardando} style={{ flex: 1 }}>
              {guardando ? <><Loader2 size={14} className="animate-spin" /> Guardando…</> : (esEdicion ? 'Guardar cambios' : 'Crear contratación')}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

// ─── Modal Detalle Contratación ───────────────────────────────
function ModalDetalleContratacion({ datos, onClose, onEditar }) {
  const [docs,    setDocs]    = useState([])
  const [historial, setHistorial] = useState([])

  useEffect(() => {
    supabase.from('personal_documentos').select('*').eq('contratacion_id', datos.id)
      .order('subido_en', { ascending: false })
      .then(({ data }) => setDocs(data ?? []))
    supabase.from('personal_audit_logs').select('*').eq('registro_id', datos.id)
      .order('creado_en', { ascending: false }).limit(10)
      .then(({ data }) => setHistorial(data ?? []))
  }, [datos.id])

  const estado = calcularEstado(datos)

  const items = [
    { label: 'Nombre completo', val: datos.nombre_completo },
    { label: 'RUT', val: formatRut(datos.rut) },
    { label: 'Correo', val: datos.correo || '—' },
    { label: 'Teléfono', val: datos.telefono || '—' },
    { label: 'Cargo', val: datos.cargo },
    { label: 'Estamento', val: ESTAMENTO_MAP[datos.estamento] ?? datos.estamento },
    { label: 'Tipo de contrato', val: CONTRATO_MAP[datos.tipo_contrato] ?? datos.tipo_contrato },
    { label: 'Fecha inicio', val: formatFecha(datos.fecha_inicio) },
    { label: 'Fecha término', val: formatFecha(datos.fecha_termino) },
    { label: 'Horas', val: datos.horas ? `${datos.horas} hrs.` : '—' },
  ]

  return (
    <motion.div className="personal-overlay" variants={overlayV} initial="hidden" animate="visible" exit="hidden"
      onClick={onClose}
    >
      <motion.div className="personal-modal personal-modal-wide" variants={modalV} initial="hidden" animate="visible" exit="hidden"
        onClick={e => e.stopPropagation()}
        style={{ maxHeight: '88vh', overflowY: 'auto' }}
      >
        <div className="personal-modal-header" style={{ position: 'sticky', top: 0, background: '#fff', paddingBottom: 16, zIndex: 1, borderBottom: '1px solid #f1f5f9', marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0 }}>{datos.nombre_completo}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
              <EstadoBadge estado={estado} />
              <span style={{ fontSize: 12.5, color: '#64748b' }}>{datos.cargo} · {ESTAMENTO_MAP[datos.estamento] ?? datos.estamento}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {onEditar && (
              <button onClick={() => onEditar(datos)} style={{ padding: '7px 14px', borderRadius: 9, border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Pencil size={13} /> Editar
              </button>
            )}
            <button className="personal-modal-close" style={{ position: 'static' }} onClick={onClose}><X size={18} /></button>
          </div>
        </div>

        {/* Info grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
          {items.map(it => (
            <div key={it.label} style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 14px' }}>
              <p style={{ margin: 0, fontSize: 10.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{it.label}</p>
              <p style={{ margin: '3px 0 0', fontSize: 13.5, fontWeight: 500, color: '#0f172a' }}>{it.val}</p>
            </div>
          ))}
          {datos.observaciones && (
            <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 14px', gridColumn: '1/-1' }}>
              <p style={{ margin: 0, fontSize: 10.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Observaciones</p>
              <p style={{ margin: '3px 0 0', fontSize: 13.5, color: '#475569', lineHeight: 1.5 }}>{datos.observaciones}</p>
            </div>
          )}
        </div>

        {/* Documentos */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: 13.5, color: '#374151' }}>Documentos ({docs.length})</p>
          {docs.length === 0 ? (
            <p style={{ fontSize: 13, color: '#94a3b8' }}>Sin documentos adjuntos.</p>
          ) : (
            <div className="personal-doc-list">
              {docs.map(d => (
                <div key={d.id} className="personal-doc-item">
                  <div className="personal-doc-icon"><FileText size={16} /></div>
                  <div className="personal-doc-info">
                    <p className="personal-doc-name">{d.nombre}</p>
                    <p className="personal-doc-meta">{TIPOS_DOC_MAP[d.tipo_doc] ?? d.tipo_doc} · {formatBytes(d.tamanio)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Historial */}
        <div>
          <p style={{ margin: '0 0 12px', fontWeight: 700, fontSize: 13.5, color: '#374151' }}>Historial</p>
          {historial.length === 0 ? (
            <p style={{ fontSize: 13, color: '#94a3b8' }}>Sin historial registrado.</p>
          ) : (
            <div className="personal-timeline">
              {historial.map((h, i) => (
                <div key={h.id} className="personal-timeline-item">
                  <div className={`personal-timeline-dot ${i === 0 ? 'active' : ''}`}>
                    <Activity size={11} style={{ color: i === 0 ? 'rgb(var(--primary-rgb,26,35,126))' : '#94a3b8' }} />
                  </div>
                  <div className="personal-timeline-content">
                    <p className="personal-timeline-title">
                      {h.accion === 'crear' ? 'Contrato creado' : h.accion === 'editar' ? 'Contrato modificado' : h.accion === 'eliminar' ? 'Contrato eliminado' : h.accion}
                      {h.usuario_nombre && <span style={{ fontWeight: 400, color: '#64748b' }}> por {h.usuario_nombre}</span>}
                    </p>
                    <p className="personal-timeline-date">{formatFecha(h.creado_en?.slice(0,10))}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════
// REEMPLAZOS TAB
// ═══════════════════════════════════════════════════════════════
function ReemplazosTab({ usuario, permisos }) {
  const [registros,       setRegistros]       = useState([])
  const [usuariosBD,      setUsuariosBD]      = useState([])
  const [ausencias,       setAusencias]       = useState([])
  const [contratos,       setContratos]       = useState([])
  const [cargando,        setCargando]        = useState(true)
  const [errorCarga,      setErrorCarga]      = useState('')
  const [filtros,         setFiltros]         = useState(DEFAULT_FILTROS_REEMPLAZOS)
  const [mostrarFiltros,  setMostrarFiltros]  = useState(false)
  const [modal,           setModal]           = useState(null)
  const [eliminar,        setEliminar]        = useState(null)
  const [eliminando,      setEliminando]      = useState(false)
  const [seleccionados,   setSeleccionados]   = useState(new Set())
  const [confirmarMasivo, setConfirmarMasivo] = useState(false)
  const [eliminandoMas,   setEliminandoMas]   = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true); setErrorCarga('')
    const [{ data: rs, error: e1 }, { data: us }, { data: aus }, { data: cnts }] = await Promise.all([
      supabase.from('reemplazos').select('*').order('creado_en', { ascending: false }),
      supabase.from('usuarios').select('id, nombre, rut, email, rol').order('nombre'),
      supabase.from('ausencias').select('id, tipo, usuario_id, usuario:usuario_id(id, nombre, rut, email), fecha_inicio, fecha_fin')
        .in('tipo', ['licencia_medica','cometido','permiso_administrativo'])
        .gte('fecha_fin', todayStr()).order('fecha_inicio', { ascending: false }).limit(50),
      supabase.from('contrataciones').select('rut, nombre_completo, cargo, correo, estamento'),
    ])
    if (e1) setErrorCarga('No se pudieron cargar los reemplazos: ' + e1.message)
    setRegistros(rs ?? []); setUsuariosBD(us ?? []); setAusencias(aus ?? []); setContratos(cnts ?? [])
    setCargando(false)
  }

  async function handleGuardar(datos) {
    const esEdicion = !!datos.id
    const payload = {
      funcionario_nombre:  datos.funcionario_nombre.trim(),
      funcionario_id:      datos.funcionario_id || null,
      motivo:              datos.motivo,
      reemplazante_nombre: datos.reemplazante_nombre?.trim() || null,
      reemplazante_id:     datos.reemplazante_id || null,
      cargo:               datos.cargo?.trim() || null,
      asignatura:          datos.asignatura?.trim() || null,
      fecha_inicio:        datos.fecha_inicio,
      fecha_termino:       datos.fecha_termino || null,
      horas:               datos.horas ? parseInt(datos.horas) : null,
      observaciones:       datos.observaciones?.trim() || null,
      estado:              datos.estado ?? 'pendiente',
      ausencia_id:         datos.ausencia_id || null,
      actualizado_en:      new Date().toISOString(),
    }
    if (esEdicion) {
      const { error } = await supabase.from('reemplazos').update(payload).eq('id', datos.id)
      if (error) return 'No se pudo actualizar el reemplazo: ' + error.message
      await auditLog({ accion: 'editar', tabla: 'reemplazos', id: datos.id, nombre: datos.funcionario_nombre, usuario, cambios: payload })
    } else {
      payload.creado_por = usuario.id
      const { error } = await supabase.from('reemplazos').insert(payload)
      if (error) return 'No se pudo crear el reemplazo: ' + error.message
      await auditLog({ accion: 'crear', tabla: 'reemplazos', nombre: datos.funcionario_nombre, usuario, cambios: payload })
    }
    await cargar(); setModal(null); return null
  }

  async function handleEliminar() {
    setEliminando(true)
    const { error } = await supabase.from('reemplazos').delete().eq('id', eliminar.id)
    if (!error) {
      await auditLog({ accion: 'eliminar', tabla: 'reemplazos', id: eliminar.id, nombre: eliminar.funcionario_nombre, usuario })
      await cargar(); setEliminar(null)
    }
    setEliminando(false)
  }

  async function handleEliminarMasivo() {
    setEliminandoMas(true)
    const ids = [...seleccionados]
    const { error } = await supabase.from('reemplazos').delete().in('id', ids)
    if (!error) {
      await Promise.all(ids.map(id => {
        const r = registros.find(x => x.id === id)
        return auditLog({ accion: 'eliminar', tabla: 'reemplazos', id, nombre: r?.funcionario_nombre, usuario })
      }))
      setSeleccionados(new Set()); setConfirmarMasivo(false); await cargar()
    }
    setEliminandoMas(false)
  }

  const filtrados = useMemo(() => {
    const f = filtros
    return registros.filter(r => {
      if (f.estado && r.estado !== f.estado) return false
      if (f.motivo && r.motivo !== f.motivo) return false
      if (f.cargo && !r.cargo?.toLowerCase().includes(f.cargo.toLowerCase())) return false
      if (f.asignatura && !r.asignatura?.toLowerCase().includes(f.asignatura.toLowerCase())) return false
      if (f.fecha_inicio_desde && r.fecha_inicio < f.fecha_inicio_desde) return false
      if (f.fecha_inicio_hasta && r.fecha_inicio > f.fecha_inicio_hasta) return false
      if (f.fecha_termino_desde && (!r.fecha_termino || r.fecha_termino < f.fecha_termino_desde)) return false
      if (f.fecha_termino_hasta && (!r.fecha_termino || r.fecha_termino > f.fecha_termino_hasta)) return false
      if (!f.busq) return true
      const q = f.busq.toLowerCase()
      return r.funcionario_nombre?.toLowerCase().includes(q)
        || r.reemplazante_nombre?.toLowerCase().includes(q)
        || r.cargo?.toLowerCase().includes(q)
        || r.asignatura?.toLowerCase().includes(q)
        || MOTIVO_MAP[r.motivo]?.toLowerCase().includes(q)
        || ESTADO_REEMPL[r.estado]?.label?.toLowerCase().includes(q)
    })
  }, [registros, filtros])

  const reemplazoAusIds = new Set(registros.filter(r => r.ausencia_id).map(r => r.ausencia_id))
  const ausSinReemplazo = ausencias.filter(a => !reemplazoAusIds.has(a.id))
  const todosIds = filtrados.map(r => r.id)
  const todosSelec = todosIds.length > 0 && todosIds.every(id => seleccionados.has(id))
  const algunoSelec = todosIds.some(id => seleccionados.has(id))

  function toggleUno(id) {
    setSeleccionados(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  const selData = registros.filter(r => seleccionados.has(r.id))
  const filtrosActivos = Object.entries(filtros).filter(([k, v]) => k !== 'busq' && v !== '').length
  function setF(k, v) { setFiltros(f => ({ ...f, [k]: v })) }
  function resetFiltros() { setFiltros(DEFAULT_FILTROS_REEMPLAZOS) }

  return (
    <div>
      <BulkBar
        count={seleccionados.size}
        onExportar={null}
        onEliminar={() => setConfirmarMasivo(true)}
        onLimpiar={() => setSeleccionados(new Set())}
        puedeEliminar={permisos.eliminarReempl}
      />

      {ausSinReemplazo.length > 0 && (
        <div className="personal-alert-banner">
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />
          <span><strong>{ausSinReemplazo.length} ausencia{ausSinReemplazo.length !== 1 ? 's' : ''}</strong> activa{ausSinReemplazo.length !== 1 ? 's' : ''} sin reemplazo asignado.</span>
          {permisos.crearReempl && <button onClick={() => setModal({ _ausencia: ausSinReemplazo[0] })}>Crear reemplazo</button>}
        </div>
      )}

      <div className="personal-toolbar">
        <div className="personal-search">
          <Search size={14} className="personal-search-icon" />
          <input value={filtros.busq} onChange={e => setF('busq', e.target.value)}
            placeholder="Buscar funcionario, reemplazante, cargo, asignatura…" />
          {filtros.busq && <button onClick={() => setF('busq', '')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', padding: 0 }}><X size={13} /></button>}
        </div>
        <button className="btn-toggle-filtros" onClick={() => setMostrarFiltros(m => !m)}>
          <Filter size={13} /> Filtros
          {filtrosActivos > 0 && <span className="personal-filter-badge">{filtrosActivos}</span>}
          {mostrarFiltros ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        <ExportMenu
          todos={registros} filtrados={filtrados} seleccionados={selData}
          colsDef={COLS_REEMPLAZOS} prepFn={prepReemplazo}
          nombreArchivo="reemplazos" titulo="Reemplazos" usuarioNombre={usuario?.nombre}
        />
        {permisos.crearReempl && (
          <button className="btn-primary" onClick={() => setModal('crear')}><Plus size={15} /> Nuevo reemplazo</button>
        )}
      </div>

      {mostrarFiltros && (
        <div className="personal-filtros-panel">
          <div className="personal-filtros-grid">
            <div className="personal-filtros-field">
              <label>Estado</label>
              <select value={filtros.estado} onChange={e => setF('estado', e.target.value)} className={filtros.estado ? 'activo' : ''}>
                <option value="">Todos</option>
                {ESTADOS_REEMPLAZO.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="personal-filtros-field">
              <label>Motivo</label>
              <select value={filtros.motivo} onChange={e => setF('motivo', e.target.value)} className={filtros.motivo ? 'activo' : ''}>
                <option value="">Todos</option>
                {MOTIVOS_REEMPLAZO.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className="personal-filtros-field">
              <label>Cargo</label>
              <input type="text" value={filtros.cargo} onChange={e => setF('cargo', e.target.value)} placeholder="Filtrar por cargo…" className={filtros.cargo ? 'activo' : ''} />
            </div>
            <div className="personal-filtros-field">
              <label>Asignatura</label>
              <input type="text" value={filtros.asignatura} onChange={e => setF('asignatura', e.target.value)} placeholder="Filtrar por asignatura…" className={filtros.asignatura ? 'activo' : ''} />
            </div>
            <div className="personal-filtros-field">
              <label>Inicio desde</label>
              <input type="date" value={filtros.fecha_inicio_desde} onChange={e => setF('fecha_inicio_desde', e.target.value)} className={filtros.fecha_inicio_desde ? 'activo' : ''} />
            </div>
            <div className="personal-filtros-field">
              <label>Inicio hasta</label>
              <input type="date" value={filtros.fecha_inicio_hasta} onChange={e => setF('fecha_inicio_hasta', e.target.value)} className={filtros.fecha_inicio_hasta ? 'activo' : ''} />
            </div>
            <div className="personal-filtros-field">
              <label>Término desde</label>
              <input type="date" value={filtros.fecha_termino_desde} onChange={e => setF('fecha_termino_desde', e.target.value)} className={filtros.fecha_termino_desde ? 'activo' : ''} />
            </div>
            <div className="personal-filtros-field">
              <label>Término hasta</label>
              <input type="date" value={filtros.fecha_termino_hasta} onChange={e => setF('fecha_termino_hasta', e.target.value)} className={filtros.fecha_termino_hasta ? 'activo' : ''} />
            </div>
            {filtrosActivos > 0 && (
              <div className="personal-filtros-actions">
                <button className="btn-filtros-reset" onClick={resetFiltros}><X size={13} /> Limpiar</button>
              </div>
            )}
          </div>
        </div>
      )}

      {errorCarga && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#b91c1c', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertCircle size={16} />{errorCarga}
          <button onClick={cargar} style={{ marginLeft: 'auto', background: 'none', border: '1px solid #fca5a5', borderRadius: 6, padding: '3px 10px', color: '#b91c1c', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>Reintentar</button>
        </div>
      )}

      {cargando ? (
        <div className="personal-loading"><Loader2 size={18} className="animate-spin" /> Cargando reemplazos…</div>
      ) : filtrados.length === 0 ? (
        <div className="personal-empty" style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0' }}>
          <div className="personal-empty-icon"><Users size={24} /></div>
          <p>No hay reemplazos que mostrar</p>
          <span>{filtros.busq || filtrosActivos > 0 ? 'Ajusta los filtros' : 'Registra el primer reemplazo'}</span>
        </div>
      ) : (
        <div className="personal-cards-grid">
          {filtrados.map(r => {
            const dias  = diasHasta(r.fecha_termino)
            const color = avatarColor(r.reemplazante_nombre ?? r.funcionario_nombre)
            const sel   = seleccionados.has(r.id)
            return (
              <div key={r.id} className={`personal-card ${sel ? 'selected' : ''}`}>
                <div className="personal-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={() => toggleUno(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: sel ? 'rgb(var(--primary-rgb,26,35,126))' : '#94a3b8', display: 'flex', padding: 0 }}>
                      {sel ? <CheckSquare size={15} /> : <Square size={15} />}
                    </button>
                    <span className="personal-card-motivo">{MOTIVO_MAP[r.motivo] ?? r.motivo}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {permisos.editarReempl && (
                      <button className="personal-action-btn" title="Editar" onClick={() => setModal(r)}><Pencil size={13} /></button>
                    )}
                    {permisos.eliminarReempl && (
                      <button className="personal-action-btn danger" title="Eliminar" onClick={() => setEliminar(r)}><Trash2 size={13} /></button>
                    )}
                  </div>
                </div>
                <div>
                  <p className="personal-card-name">{r.funcionario_nombre}</p>
                  <p className="personal-card-cargo">{r.cargo ?? '—'}{r.asignatura ? ` · ${r.asignatura}` : ''}</p>
                </div>
                <div className="personal-card-dates">
                  <div className="personal-card-date-item">
                    <span className="personal-card-date-label">Desde</span>
                    <span className="personal-card-date-val">{formatFecha(r.fecha_inicio)}</span>
                  </div>
                  <div className="personal-card-date-item">
                    <span className="personal-card-date-label">Hasta</span>
                    <span className="personal-card-date-val">{r.fecha_termino ? formatFecha(r.fecha_termino) : '—'}</span>
                  </div>
                </div>
                {r.reemplazante_nombre ? (
                  <div className="personal-card-reemplazante">
                    <div className="personal-card-avatar" style={{ background: color }}>{initials(r.reemplazante_nombre)}</div>
                    <div>
                      <p className="personal-card-reempl-label">Reemplazante</p>
                      <p className="personal-card-reempl-name">{r.reemplazante_nombre}</p>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '10px 12px', background: '#fef2f2', borderRadius: 10, fontSize: 12.5, color: '#dc2626', fontWeight: 500 }}>
                    Sin reemplazante asignado
                  </div>
                )}
                <div className="personal-card-footer">
                  <EstadoBadge estado={r.estado} />
                  {r.estado === 'activo' && dias !== null && dias >= 0 && dias <= 7 && (
                    <span className="personal-vencer-alert"><AlertTriangle size={11} /> Finaliza en {dias}d</span>
                  )}
                  {r.horas && <span style={{ fontSize: 12, color: '#64748b' }}>{r.horas} hrs.</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <AnimatePresence>
        {modal && (
          <ModalReemplazo
            datos={modal === 'crear' ? null : (modal._ausencia ? null : modal)}
            ausenciaInicial={modal._ausencia ?? null}
            usuarios={usuariosBD} ausencias={ausencias} contratos={contratos}
            onGuardar={handleGuardar} onClose={() => setModal(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {eliminar && (
          <motion.div className="personal-overlay" variants={overlayV} initial="hidden" animate="visible" exit="hidden"
            onClick={() => !eliminando && setEliminar(null)}>
            <motion.div className="personal-modal personal-confirm-modal" variants={modalV} initial="hidden" animate="visible" exit="hidden"
              onClick={e => e.stopPropagation()}>
              <div className="personal-confirm-icon" style={{ background: '#fef2f2' }}><Trash2 size={22} style={{ color: '#dc2626' }} /></div>
              <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700 }}>¿Eliminar reemplazo?</h3>
              <p style={{ margin: '0 0 24px', fontSize: 13.5, color: '#475569', lineHeight: 1.5 }}>
                Se eliminará el reemplazo de <strong>{eliminar.funcionario_nombre}</strong>.
              </p>
              <div className="personal-form-actions">
                <button className="btn-secondary" onClick={() => setEliminar(null)} disabled={eliminando}>Cancelar</button>
                <button className="btn-danger" onClick={handleEliminar} disabled={eliminando}>
                  {eliminando ? <><Loader2 size={14} className="animate-spin" /> Eliminando…</> : 'Sí, eliminar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmarMasivo && (
          <motion.div className="personal-overlay" variants={overlayV} initial="hidden" animate="visible" exit="hidden"
            onClick={() => !eliminandoMas && setConfirmarMasivo(false)}>
            <motion.div className="personal-modal personal-confirm-modal" variants={modalV} initial="hidden" animate="visible" exit="hidden"
              onClick={e => e.stopPropagation()}>
              <div className="personal-confirm-icon" style={{ background: '#fef2f2' }}><Trash2 size={22} style={{ color: '#dc2626' }} /></div>
              <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700 }}>¿Eliminar {seleccionados.size} reemplazo{seleccionados.size !== 1 ? 's' : ''}?</h3>
              <p style={{ margin: '0 0 24px', fontSize: 13.5, color: '#475569', lineHeight: 1.5 }}>Esta acción no se puede deshacer.</p>
              <div className="personal-form-actions">
                <button className="btn-secondary" onClick={() => setConfirmarMasivo(false)} disabled={eliminandoMas}>Cancelar</button>
                <button className="btn-danger" onClick={handleEliminarMasivo} disabled={eliminandoMas}>
                  {eliminandoMas ? <><Loader2 size={14} className="animate-spin" /> Eliminando…</> : `Sí, eliminar ${seleccionados.size}`}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Modal Crear/Editar Reemplazo ─────────────────────────────
function ModalReemplazo({ datos, ausenciaInicial, usuarios, ausencias, contratos, onGuardar, onClose }) {
  const esEdicion = !!datos

  function mapMotivo(tipo) {
    if (tipo === 'licencia_medica') return 'licencia_medica'
    if (tipo === 'cometido') return 'cometido'
    if (tipo === 'permiso_administrativo') return 'permiso_administrativo'
    return 'otro'
  }

  // Buscar contrato del funcionario ausente para mostrar cargo/estamento/correo
  const contratoFuncionario = useMemo(() => {
    if (!ausenciaInicial || !contratos?.length) return null
    const rutU = (ausenciaInicial.usuario?.rut ?? '').replace(/[^0-9kK]/gi, '').toUpperCase()
    if (rutU) {
      const porRut = contratos.find(c => (c.rut ?? '').replace(/[^0-9kK]/gi, '').toUpperCase() === rutU)
      if (porRut) return porRut
    }
    return contratos.find(c => c.nombre_completo === ausenciaInicial.usuario?.nombre) ?? null
  }, [ausenciaInicial, contratos])

  const [form, setForm] = useState({
    funcionario_id:      datos?.funcionario_id ?? ausenciaInicial?.usuario_id ?? '',
    funcionario_nombre:  datos?.funcionario_nombre ?? ausenciaInicial?.usuario?.nombre ?? '',
    motivo:              datos?.motivo ?? (ausenciaInicial ? mapMotivo(ausenciaInicial.tipo) : 'licencia_medica'),
    reemplazante_id:     datos?.reemplazante_id ?? '',
    reemplazante_nombre: datos?.reemplazante_nombre ?? '',
    cargo:               datos?.cargo ?? contratoFuncionario?.cargo ?? '',
    asignatura:          datos?.asignatura ?? '',
    fecha_inicio:        datos?.fecha_inicio ?? ausenciaInicial?.fecha_inicio ?? '',
    fecha_termino:       datos?.fecha_termino ?? ausenciaInicial?.fecha_fin ?? '',
    horas:               datos?.horas ?? '',
    observaciones:       datos?.observaciones ?? '',
    estado:              datos?.estado ?? 'pendiente',
    ausencia_id:         datos?.ausencia_id ?? ausenciaInicial?.id ?? '',
  })
  const [errors,    setErrors]    = useState({})
  const [guardando, setGuardando] = useState(false)
  const [errGlobal, setErrGlobal] = useState('')

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })) }

  function onFuncionarioChange(e) {
    const id = e.target.value
    const u  = usuarios.find(u => u.id === id)
    setForm(f => ({ ...f, funcionario_id: id, funcionario_nombre: u?.nombre ?? '' }))
  }

  function onAusenciaChange(e) {
    const id  = e.target.value
    const aus = ausencias.find(a => a.id === id)
    if (aus) {
      setForm(f => ({
        ...f,
        ausencia_id:         id,
        funcionario_id:      aus.usuario_id ?? '',
        funcionario_nombre:  aus.usuario?.nombre ?? '',
        motivo:              mapMotivo(aus.tipo),
        fecha_inicio:        aus.fecha_inicio ?? f.fecha_inicio,
        fecha_termino:       aus.fecha_fin ?? f.fecha_termino,
      }))
    } else {
      set('ausencia_id', '')
    }
  }

  function onReemplazanteChange(e) {
    const id = e.target.value
    if (id === '__manual__') {
      setForm(f => ({ ...f, reemplazante_id: '', reemplazante_nombre: '' }))
      return
    }
    const u = usuarios.find(u => u.id === id)
    setForm(f => ({ ...f, reemplazante_id: id, reemplazante_nombre: u?.nombre ?? '' }))
  }

  function validar() {
    const e = {}
    if (!form.funcionario_nombre.trim()) e.funcionario_nombre = 'Requerido'
    if (!form.fecha_inicio) e.fecha_inicio = 'Requerida'
    if (form.fecha_termino && form.fecha_inicio && form.fecha_termino < form.fecha_inicio)
      e.fecha_termino = 'Debe ser posterior al inicio'
    return e
  }

  async function handleSubmit(ev) {
    ev.preventDefault()
    const errs = validar()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setGuardando(true)
    setErrGlobal('')
    const err = await onGuardar({ ...form, id: datos?.id })
    if (err) { setErrGlobal(err); setGuardando(false) }
  }

  const bloqueadoPorAusencia = !!ausenciaInicial

  return (
    <motion.div className="personal-overlay" variants={overlayV} initial="hidden" animate="visible" exit="hidden"
      onClick={() => !guardando && onClose()}
    >
      <motion.div className="personal-modal personal-modal-wide" variants={modalV} initial="hidden" animate="visible" exit="hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="personal-modal-header">
          <h2>{esEdicion ? 'Editar reemplazo' : 'Nuevo reemplazo'}</h2>
          <button className="personal-modal-close" style={{ position: 'static' }} onClick={onClose} disabled={guardando}><X size={18} /></button>
        </div>

        {/* Tarjeta del funcionario ausente (bloqueada) */}
        {ausenciaInicial && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '14px 16px', marginBottom: 20, fontSize: 13 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#15803d', fontWeight: 600, marginBottom: 10 }}>
              <Info size={15} style={{ flexShrink: 0 }} />
              Funcionario reemplazado — datos cargados automáticamente
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px 16px', color: '#1e293b' }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nombre</p>
                <p style={{ margin: 0, fontWeight: 600 }}>{ausenciaInicial.usuario?.nombre ?? '—'}</p>
              </div>
              {ausenciaInicial.usuario?.rut && (
                <div>
                  <p style={{ margin: 0, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>RUT</p>
                  <p style={{ margin: 0, fontFamily: 'monospace' }}>{ausenciaInicial.usuario.rut}</p>
                </div>
              )}
              {ausenciaInicial.usuario?.email && (
                <div>
                  <p style={{ margin: 0, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Correo</p>
                  <p style={{ margin: 0 }}>{ausenciaInicial.usuario.email}</p>
                </div>
              )}
              {contratoFuncionario?.cargo && (
                <div>
                  <p style={{ margin: 0, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cargo</p>
                  <p style={{ margin: 0 }}>{contratoFuncionario.cargo}</p>
                </div>
              )}
              {contratoFuncionario?.estamento && (
                <div>
                  <p style={{ margin: 0, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Estamento</p>
                  <p style={{ margin: 0 }}>{ESTAMENTO_MAP[contratoFuncionario.estamento] ?? contratoFuncionario.estamento}</p>
                </div>
              )}
              <div>
                <p style={{ margin: 0, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tipo de ausencia</p>
                <p style={{ margin: 0 }}>{MOTIVO_MAP[ausenciaInicial.tipo] ?? ausenciaInicial.tipo}</p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Período ausencia</p>
                <p style={{ margin: 0 }}>{formatFecha(ausenciaInicial.fecha_inicio)}{ausenciaInicial.fecha_fin ? ` → ${formatFecha(ausenciaInicial.fecha_fin)}` : ''}</p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Funcionario reemplazado — solo visible si NO viene de ausencia */}
          {!bloqueadoPorAusencia && (
            <div className="personal-form-section">
              <p className="personal-form-section-title">Funcionario reemplazado</p>
              <div className="personal-form-grid">
                <div className="personal-form-field">
                  <label>Seleccionar del sistema</label>
                  <select value={form.funcionario_id} onChange={onFuncionarioChange}>
                    <option value="">— Ingresar manualmente —</option>
                    {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                  </select>
                </div>
                <div className="personal-form-field">
                  <label>Nombre *</label>
                  <input value={form.funcionario_nombre} onChange={e => set('funcionario_nombre', e.target.value)}
                    placeholder="Nombre del funcionario" className={errors.funcionario_nombre ? 'error' : ''} />
                  {errors.funcionario_nombre && <span className="personal-form-error">{errors.funcionario_nombre}</span>}
                </div>
                <div className="personal-form-field">
                  <label>Motivo</label>
                  <select value={form.motivo} onChange={e => set('motivo', e.target.value)}>
                    {MOTIVOS_REEMPLAZO.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                {ausencias.length > 0 && (
                  <div className="personal-form-field">
                    <label>Vincular ausencia</label>
                    <select value={form.ausencia_id} onChange={onAusenciaChange}>
                      <option value="">Sin ausencia vinculada</option>
                      {ausencias.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.usuario?.nombre} — {MOTIVO_MAP[a.tipo] ?? a.tipo} ({formatFecha(a.fecha_inicio)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Motivo — solo visible si viene de ausencia (como campo bloqueado informativo) */}
          {bloqueadoPorAusencia && (
            <div className="personal-form-section">
              <p className="personal-form-section-title">Motivo del reemplazo</p>
              <div className="personal-form-grid">
                <div className="personal-form-field">
                  <label>Motivo</label>
                  <select value={form.motivo} onChange={e => set('motivo', e.target.value)} disabled>
                    {MOTIVOS_REEMPLAZO.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Reemplazante */}
          <div className="personal-form-section">
            <p className="personal-form-section-title">Reemplazante</p>
            <div className="personal-form-grid">
              <div className="personal-form-field">
                <label>Seleccionar del sistema</label>
                <select value={form.reemplazante_id} onChange={onReemplazanteChange}>
                  <option value="">— Ingresar manualmente —</option>
                  {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                </select>
              </div>
              <div className="personal-form-field">
                <label>Nombre reemplazante</label>
                <input value={form.reemplazante_nombre} onChange={e => set('reemplazante_nombre', e.target.value)}
                  placeholder="Nombre del reemplazante" />
              </div>
              <div className="personal-form-field">
                <label>Cargo</label>
                <input value={form.cargo} onChange={e => set('cargo', e.target.value)}
                  placeholder="Cargo que desempeña" />
              </div>
              <div className="personal-form-field">
                <label>Asignatura</label>
                <input value={form.asignatura} onChange={e => set('asignatura', e.target.value)}
                  placeholder="Ej: Matemática" />
              </div>
            </div>
          </div>

          {/* Fechas y estado */}
          <div className="personal-form-section">
            <p className="personal-form-section-title">Período y estado</p>
            <div className="personal-form-grid three">
              <div className="personal-form-field">
                <label>Fecha inicio *</label>
                <input type="date" value={form.fecha_inicio} onChange={e => set('fecha_inicio', e.target.value)}
                  className={errors.fecha_inicio ? 'error' : ''} />
                {errors.fecha_inicio && <span className="personal-form-error">{errors.fecha_inicio}</span>}
              </div>
              <div className="personal-form-field">
                <label>Fecha término</label>
                <input type="date" value={form.fecha_termino} onChange={e => set('fecha_termino', e.target.value)}
                  className={errors.fecha_termino ? 'error' : ''} />
                {errors.fecha_termino && <span className="personal-form-error">{errors.fecha_termino}</span>}
              </div>
              <div className="personal-form-field">
                <label>Horas</label>
                <input type="number" min="0" value={form.horas} onChange={e => set('horas', e.target.value)} placeholder="44" />
              </div>
            </div>
            <div className="personal-form-grid" style={{ marginTop: 14 }}>
              <div className="personal-form-field">
                <label>Estado</label>
                <select value={form.estado} onChange={e => set('estado', e.target.value)}>
                  {ESTADOS_REEMPLAZO.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Observaciones */}
          <div className="personal-form-section">
            <p className="personal-form-section-title">Observaciones</p>
            <div className="personal-form-field full">
              <textarea value={form.observaciones} onChange={e => set('observaciones', e.target.value)}
                placeholder="Notas adicionales…" rows={3} />
            </div>
          </div>

          {errGlobal && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 9, padding: '10px 14px', fontSize: 13, color: '#b91c1c', marginBottom: 12 }}>
              {errGlobal}
            </div>
          )}

          <div className="personal-form-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={guardando}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={guardando} style={{ flex: 1 }}>
              {guardando ? <><Loader2 size={14} className="animate-spin" /> Guardando…</> : (esEdicion ? 'Guardar cambios' : 'Crear reemplazo')}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════
// DOCUMENTOS TAB
// ═══════════════════════════════════════════════════════════════
function DocumentosTab({ usuario, permisos }) {
  const [docs,         setDocs]         = useState([])
  const [contratos,    setContratos]    = useState([])
  const [reemplazos,   setReemplazos]   = useState([])
  const [cargando,     setCargando]     = useState(true)
  const [errorCarga,   setErrorCarga]   = useState('')
  const [busq,         setBusq]         = useState('')
  const [filtTipo,     setFiltTipo]     = useState('')
  const [subiendo,     setSubiendo]     = useState(false)
  const [modalSubir,   setModalSubir]   = useState(false)
  const [eliminar,     setEliminar]     = useState(null)
  const [eliminando,   setEliminando]   = useState(false)
  const [seleccionados, setSeleccionados] = useState(new Set())
  const [descargandoMas, setDescargandoMas] = useState(false)
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true); setErrorCarga('')
    const [{ data: ds, error: e1 }, { data: cs }, { data: rs }] = await Promise.all([
      supabase.from('personal_documentos').select('*').order('subido_en', { ascending: false }),
      supabase.from('contrataciones').select('id, nombre_completo').order('nombre_completo'),
      supabase.from('reemplazos').select('id, funcionario_nombre').order('funcionario_nombre'),
    ])
    if (e1) setErrorCarga('No se pudieron cargar los documentos: ' + e1.message)
    setDocs(ds ?? []); setContratos(cs ?? []); setReemplazos(rs ?? [])
    setCargando(false)
  }

  async function handleSubir({ archivo, nombre, tipo_doc, contratacion_id, reemplazo_id }) {
    setSubiendo(true)
    const ext  = archivo.name.split('.').pop()
    const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    const { error: upErr } = await supabase.storage.from('personal-docs').upload(path, archivo)
    if (upErr) { setSubiendo(false); return 'No se pudo subir el archivo: ' + upErr.message }
    const { data: urlData } = supabase.storage.from('personal-docs').getPublicUrl(path)
    const { error: dbErr } = await supabase.from('personal_documentos').insert({
      nombre, tipo_doc, url: urlData.publicUrl, storage_path: path,
      tamanio: archivo.size, mime_type: archivo.type,
      contratacion_id: contratacion_id || null,
      reemplazo_id:    reemplazo_id || null,
      subido_por:      usuario.id,
    })
    if (dbErr) { setSubiendo(false); return 'No se pudo registrar el documento: ' + dbErr.message }
    await auditLog({ accion: 'crear', tabla: 'personal_documentos', nombre, usuario })
    await cargar(); setSubiendo(false); setModalSubir(false); return null
  }

  async function handleEliminar() {
    setEliminando(true)
    if (eliminar.storage_path) await supabase.storage.from('personal-docs').remove([eliminar.storage_path])
    await supabase.from('personal_documentos').delete().eq('id', eliminar.id)
    await auditLog({ accion: 'eliminar', tabla: 'personal_documentos', nombre: eliminar.nombre, usuario })
    await cargar(); setEliminar(null); setEliminando(false)
  }

  async function handleDescargar(doc) {
    if (doc.storage_path) {
      const { data, error } = await supabase.storage.from('personal-docs').download(doc.storage_path)
      if (!error && data) {
        const url = URL.createObjectURL(data)
        const a = document.createElement('a'); a.href = url; a.download = doc.nombre; a.click()
        URL.revokeObjectURL(url); return
      }
    }
    window.open(doc.url, '_blank')
  }

  async function handleDescargarSeleccionados() {
    setDescargandoMas(true)
    const selDocs = docs.filter(d => seleccionados.has(d.id))
    for (const doc of selDocs) {
      await handleDescargar(doc)
      await new Promise(r => setTimeout(r, 300))
    }
    setDescargandoMas(false)
  }

  const filtrados = docs.filter(d => {
    if (filtTipo && d.tipo_doc !== filtTipo) return false
    if (!busq) return true
    const q = busq.toLowerCase()
    const c = contratos.find(x => x.id === d.contratacion_id)
    const r = reemplazos.find(x => x.id === d.reemplazo_id)
    return d.nombre?.toLowerCase().includes(q)
      || TIPOS_DOC_MAP[d.tipo_doc]?.toLowerCase().includes(q)
      || c?.nombre_completo?.toLowerCase().includes(q)
      || r?.funcionario_nombre?.toLowerCase().includes(q)
  })

  function toggleUno(id) {
    setSeleccionados(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  const selData = docs.filter(d => seleccionados.has(d.id))
  const prepDocBound = d => prepDoc(d, contratos, reemplazos)

  return (
    <div>
      {seleccionados.size > 0 && (
        <div className="personal-bulk-bar">
          <span className="personal-bulk-count">{seleccionados.size} seleccionado{seleccionados.size !== 1 ? 's' : ''}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="personal-bulk-btn" onClick={handleDescargarSeleccionados} disabled={descargandoMas}>
              {descargandoMas ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Descargar
            </button>
            <button className="personal-bulk-btn" onClick={() => setSeleccionados(new Set())}><X size={13} /> Limpiar</button>
          </div>
        </div>
      )}
      <div className="personal-toolbar">
        <div className="personal-search">
          <Search size={14} className="personal-search-icon" />
          <input value={busq} onChange={e => setBusq(e.target.value)} placeholder="Buscar documentos…" />
          {busq && <button onClick={() => setBusq('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', padding: 0 }}><X size={13} /></button>}
        </div>
        <button className="btn-toggle-filtros" onClick={() => setMostrarFiltros(m => !m)}>
          <Filter size={13} /> Filtros
          {filtTipo && <span className="personal-filter-badge">1</span>}
          {mostrarFiltros ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        <ExportMenu
          todos={docs} filtrados={filtrados} seleccionados={selData}
          colsDef={COLS_DOCS} prepFn={prepDocBound}
          nombreArchivo="documentos_personal" titulo="Documentos Personal" usuarioNombre={usuario?.nombre}
        />
        {permisos.subirDocs && (
          <button className="btn-primary" onClick={() => setModalSubir(true)}>
            <Upload size={15} /> Subir documento
          </button>
        )}
      </div>

      {mostrarFiltros && (
        <div className="personal-filtros-panel">
          <div className="personal-filtros-grid">
            <div className="personal-filtros-field">
              <label>Tipo de documento</label>
              <select value={filtTipo} onChange={e => setFiltTipo(e.target.value)} className={filtTipo ? 'activo' : ''}>
                <option value="">Todos</option>
                {TIPOS_DOC.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            {filtTipo && (
              <div className="personal-filtros-actions">
                <button className="btn-filtros-reset" onClick={() => setFiltTipo('')}><X size={13} /> Limpiar</button>
              </div>
            )}
          </div>
        </div>
      )}

      {cargando ? (
        <div className="personal-loading"><Loader2 size={18} className="animate-spin" /> Cargando...</div>
      ) : filtrados.length === 0 ? (
        <div className="personal-empty" style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0' }}>
          <div className="personal-empty-icon"><FileText size={24} /></div>
          <p>Sin documentos</p>
          <span>{busq || filtTipo ? 'Ajusta los filtros' : 'Sube el primer documento'}</span>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div className="personal-doc-list" style={{ padding: 16 }}>
            {filtrados.map(d => {
              const contrato  = contratos.find(c => c.id === d.contratacion_id)
              const reemplazo = reemplazos.find(r => r.id === d.reemplazo_id)
              const sel = seleccionados.has(d.id)
              return (
                <div key={d.id} className={`personal-doc-item ${sel ? 'selected' : ''}`}>
                  <button onClick={() => toggleUno(d.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: sel ? 'rgb(var(--primary-rgb,26,35,126))' : '#94a3b8', display: 'flex', padding: '0 6px 0 0', flexShrink: 0 }}>
                    {sel ? <CheckSquare size={15} /> : <Square size={15} />}
                  </button>
                  <div className="personal-doc-icon"><FileText size={16} /></div>
                  <div className="personal-doc-info">
                    <p className="personal-doc-name">{d.nombre}</p>
                    <p className="personal-doc-meta">
                      {TIPOS_DOC_MAP[d.tipo_doc] ?? d.tipo_doc}
                      {d.tamanio ? ` · ${formatBytes(d.tamanio)}` : ''}
                      {contrato ? ` · ${contrato.nombre_completo}` : ''}
                      {reemplazo ? ` · Reemplazo de ${reemplazo.funcionario_nombre}` : ''}
                    </p>
                  </div>
                  <div className="personal-doc-actions">
                    <button className="personal-action-btn" title="Descargar" onClick={() => handleDescargar(d)}><Download size={14} /></button>
                    {permisos.eliminarDocs && (
                      <button className="personal-action-btn danger" title="Eliminar" onClick={() => setEliminar(d)}><Trash2 size={14} /></button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modal subir */}
      <AnimatePresence>
        {modalSubir && (
          <ModalSubirDocumento
            contratos={contratos}
            reemplazos={reemplazos}
            subiendo={subiendo}
            onSubir={handleSubir}
            onClose={() => !subiendo && setModalSubir(false)}
          />
        )}
      </AnimatePresence>

      {/* Confirmar eliminar */}
      <AnimatePresence>
        {eliminar && (
          <motion.div className="personal-overlay" variants={overlayV} initial="hidden" animate="visible" exit="hidden"
            onClick={() => !eliminando && setEliminar(null)}
          >
            <motion.div className="personal-modal personal-confirm-modal" variants={modalV} initial="hidden" animate="visible" exit="hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="personal-confirm-icon" style={{ background: '#fef2f2' }}><Trash2 size={22} style={{ color: '#dc2626' }} /></div>
              <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700 }}>¿Eliminar documento?</h3>
              <p style={{ margin: '0 0 24px', fontSize: 13.5, color: '#475569', lineHeight: 1.5 }}>
                Se eliminará <strong>{eliminar.nombre}</strong> del sistema de forma permanente.
              </p>
              <div className="personal-form-actions">
                <button className="btn-secondary" onClick={() => setEliminar(null)} disabled={eliminando}>Cancelar</button>
                <button className="btn-danger" onClick={handleEliminar} disabled={eliminando}>
                  {eliminando ? <><Loader2 size={14} className="animate-spin" /> Eliminando…</> : 'Sí, eliminar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ModalSubirDocumento({ contratos, reemplazos, subiendo, onSubir, onClose }) {
  const [archivo,        setArchivo]        = useState(null)
  const [nombre,         setNombre]         = useState('')
  const [tipo_doc,       setTipoDoc]        = useState('contrato')
  const [contratacion_id, setContratId]     = useState('')
  const [reemplazo_id,   setReemplId]       = useState('')
  const [dragOver,       setDragOver]       = useState(false)
  const [errGlobal,      setErrGlobal]      = useState('')
  const [errors,         setErrors]         = useState({})
  const fileRef = useRef(null)

  const TIPOS_ADMITIDOS = ['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','image/jpeg','image/png','image/webp']

  function onFileChange(file) {
    if (!file) return
    if (!TIPOS_ADMITIDOS.includes(file.type)) {
      setErrors(e => ({ ...e, archivo: 'Tipo no permitido. Use PDF, DOCX, XLSX o imagen.' }))
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setErrors(e => ({ ...e, archivo: 'El archivo no puede superar 20 MB.' }))
      return
    }
    setArchivo(file)
    setErrors(e => ({ ...e, archivo: '' }))
    if (!nombre) setNombre(file.name.replace(/\.[^.]+$/, ''))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = {}
    if (!archivo) errs.archivo = 'Selecciona un archivo'
    if (!nombre.trim()) errs.nombre = 'Requerido'
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrGlobal('')
    const err = await onSubir({ archivo, nombre: nombre.trim(), tipo_doc, contratacion_id, reemplazo_id })
    if (err) setErrGlobal(err)
  }

  return (
    <motion.div className="personal-overlay" variants={overlayV} initial="hidden" animate="visible" exit="hidden"
      onClick={() => !subiendo && onClose()}
    >
      <motion.div className="personal-modal" variants={modalV} initial="hidden" animate="visible" exit="hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="personal-modal-header">
          <h2>Subir documento</h2>
          <button className="personal-modal-close" style={{ position: 'static' }} onClick={onClose} disabled={subiendo}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Zona de drop */}
          <div
            className={`personal-upload-zone ${dragOver ? 'drag-over' : ''}`}
            style={{ marginBottom: 18 }}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); onFileChange(e.dataTransfer.files[0]) }}
          >
            <div className="personal-upload-icon">
              {archivo ? <CheckCircle2 size={22} /> : <Upload size={22} />}
            </div>
            <p>{archivo ? archivo.name : 'Arrastra o haz clic para seleccionar'}</p>
            <span>PDF, DOCX, XLSX, imagen · máx. 20 MB</span>
            <input ref={fileRef} type="file" accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png,.webp" style={{ display: 'none' }}
              onChange={e => onFileChange(e.target.files[0])} />
          </div>
          {errors.archivo && <p className="personal-form-error" style={{ marginBottom: 12 }}>{errors.archivo}</p>}

          <div className="personal-form-grid">
            <div className="personal-form-field full">
              <label>Nombre del documento *</label>
              <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Contrato de trabajo…"
                className={errors.nombre ? 'error' : ''} />
              {errors.nombre && <span className="personal-form-error">{errors.nombre}</span>}
            </div>
            <div className="personal-form-field">
              <label>Tipo de documento</label>
              <select value={tipo_doc} onChange={e => setTipoDoc(e.target.value)}>
                {TIPOS_DOC.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div className="personal-form-grid" style={{ marginTop: 14 }}>
            <div className="personal-form-field">
              <label>Vincular a contratación</label>
              <select value={contratacion_id} onChange={e => setContratId(e.target.value)}>
                <option value="">Sin vincular</option>
                {contratos.map(c => <option key={c.id} value={c.id}>{c.nombre_completo}</option>)}
              </select>
            </div>
            <div className="personal-form-field">
              <label>Vincular a reemplazo</label>
              <select value={reemplazo_id} onChange={e => setReemplId(e.target.value)}>
                <option value="">Sin vincular</option>
                {reemplazos.map(r => <option key={r.id} value={r.id}>{r.funcionario_nombre}</option>)}
              </select>
            </div>
          </div>

          {errGlobal && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 9, padding: '10px 14px', fontSize: 13, color: '#b91c1c', marginTop: 12 }}>
              {errGlobal}
            </div>
          )}

          <div className="personal-form-actions" style={{ marginTop: 20 }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={subiendo}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={subiendo} style={{ flex: 1 }}>
              {subiendo ? <><Loader2 size={14} className="animate-spin" /> Subiendo…</> : <><Upload size={14} /> Subir documento</>}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}


// ═══════════════════════════════════════════════════════════════
// AUDITORÍA TAB
// ═══════════════════════════════════════════════════════════════
function AuditoriaTab({ usuario }) {
  const [logs,          setLogs]          = useState([])
  const [cargando,      setCargando]      = useState(true)
  const [busq,          setBusq]          = useState('')
  const [filtTabla,     setFiltTabla]     = useState('')
  const [filtAccion,    setFiltAccion]    = useState('')
  const [pagina,        setPagina]        = useState(1)
  const [mostrarFiltros, setMostrarFiltros] = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    const { data } = await supabase.from('personal_audit_logs')
      .select('*').order('creado_en', { ascending: false }).limit(500)
    setLogs(data ?? [])
    setCargando(false)
  }

  const ACCION_LABEL = { crear: 'Crear', editar: 'Editar', eliminar: 'Eliminar' }
  const TABLA_LABEL  = { contrataciones: 'Contrataciones', reemplazos: 'Reemplazos', personal_documentos: 'Documentos' }

  const filtrados = logs.filter(l => {
    if (filtTabla && l.tabla_afectada !== filtTabla) return false
    if (filtAccion && l.accion !== filtAccion) return false
    if (!busq) return true
    const q = busq.toLowerCase()
    return l.registro_nombre?.toLowerCase().includes(q) || l.usuario_nombre?.toLowerCase().includes(q)
  })

  const total   = filtrados.length
  const inicio  = (pagina - 1) * POR_PAGINA
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA))
  const vista   = filtrados.slice(inicio, inicio + POR_PAGINA)

  function formatTs(ts) {
    if (!ts) return '—'
    return new Date(ts).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div>
      <div className="personal-toolbar">
        <div className="personal-search">
          <Search size={14} className="personal-search-icon" />
          <input value={busq} onChange={e => { setBusq(e.target.value); setPagina(1) }} placeholder="Buscar registro, usuario…" />
          {busq && <button onClick={() => { setBusq(''); setPagina(1) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', padding: 0 }}><X size={13} /></button>}
        </div>
        <button className="btn-toggle-filtros" onClick={() => setMostrarFiltros(m => !m)}>
          <Filter size={13} /> Filtros
          {(filtTabla || filtAccion) && <span className="personal-filter-badge">{[filtTabla, filtAccion].filter(Boolean).length}</span>}
          {mostrarFiltros ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        <ExportMenu
          todos={logs} filtrados={filtrados} seleccionados={[]}
          colsDef={COLS_AUDITORIA} prepFn={prepAuditoria}
          nombreArchivo="auditoria_personal" titulo="Auditoría Personal" usuarioNombre={usuario?.nombre}
        />
        <button className="personal-action-btn" title="Actualizar" onClick={cargar} style={{ border: '1.5px solid #e2e8f0', borderRadius: 10, width: 38, height: 38 }}>
          <RefreshCw size={14} />
        </button>
      </div>

      {mostrarFiltros && (
        <div className="personal-filtros-panel">
          <div className="personal-filtros-grid">
            <div className="personal-filtros-field">
              <label>Módulo</label>
              <select value={filtTabla} onChange={e => { setFiltTabla(e.target.value); setPagina(1) }} className={filtTabla ? 'activo' : ''}>
                <option value="">Todos</option>
                <option value="contrataciones">Contrataciones</option>
                <option value="reemplazos">Reemplazos</option>
                <option value="personal_documentos">Documentos</option>
              </select>
            </div>
            <div className="personal-filtros-field">
              <label>Acción</label>
              <select value={filtAccion} onChange={e => { setFiltAccion(e.target.value); setPagina(1) }} className={filtAccion ? 'activo' : ''}>
                <option value="">Todas</option>
                <option value="crear">Crear</option>
                <option value="editar">Editar</option>
                <option value="eliminar">Eliminar</option>
              </select>
            </div>
            {(filtTabla || filtAccion) && (
              <div className="personal-filtros-actions">
                <button className="btn-filtros-reset" onClick={() => { setFiltTabla(''); setFiltAccion(''); setPagina(1) }}><X size={13} /> Limpiar</button>
              </div>
            )}
          </div>
        </div>
      )}

      {cargando ? (
        <div className="personal-loading"><Loader2 size={18} className="animate-spin" /> Cargando...</div>
      ) : (
        <div className="personal-table-wrap">
          {vista.length === 0 ? (
            <div className="personal-empty">
              <div className="personal-empty-icon"><Activity size={24} /></div>
              <p>Sin registros de auditoría</p>
            </div>
          ) : (
            <>
              <table className="personal-table">
                <thead>
                  <tr>
                    <th>Fecha y hora</th>
                    <th>Acción</th>
                    <th>Módulo</th>
                    <th>Registro</th>
                    <th>Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {vista.map(l => (
                    <tr key={l.id}>
                      <td style={{ fontSize: 12.5, color: '#64748b', whiteSpace: 'nowrap' }}>{formatTs(l.creado_en)}</td>
                      <td>
                        <span className={`personal-audit-badge ${l.accion}`}>
                          {ACCION_LABEL[l.accion] ?? l.accion}
                        </span>
                      </td>
                      <td style={{ fontSize: 13 }}>{TABLA_LABEL[l.tabla_afectada] ?? l.tabla_afectada}</td>
                      <td>
                        <p className="personal-table-name" style={{ fontSize: 13.5 }}>{l.registro_nombre ?? '—'}</p>
                      </td>
                      <td>
                        <p style={{ margin: 0, fontSize: 13 }}>{l.usuario_nombre ?? '—'}</p>
                        <p className="personal-table-sub">{l.usuario_rol ?? ''}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {total > POR_PAGINA && (
                <div className="personal-pagination">
                  <span className="personal-pagination-info">{inicio + 1}–{Math.min(inicio + POR_PAGINA, total)} de {total}</span>
                  <div className="personal-pagination-btns">
                    <button className="personal-pagination-btn" disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}>‹ Anterior</button>
                    <button className="personal-pagination-btn" disabled={pagina === paginas} onClick={() => setPagina(p => p + 1)}>Siguiente ›</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function Personal({ usuario, permisos = {}, vista = 'dashboard', onIrAVista }) {
  const esAdmin = usuario?.rol === 'admin'

  const p = {
    verContrat:    esAdmin || !!permisos.ver_contrataciones,
    crearContrat:  esAdmin || !!permisos.crear_contrataciones,
    editarContrat: esAdmin || !!permisos.editar_contrataciones,
    eliminarContrat: esAdmin || !!permisos.eliminar_contrataciones,
    verReempl:     esAdmin || !!permisos.ver_reemplazos,
    crearReempl:   esAdmin || !!permisos.crear_reemplazos,
    editarReempl:  esAdmin || !!permisos.editar_reemplazos,
    eliminarReempl:esAdmin || !!permisos.eliminar_reemplazos,
    verDocs:       esAdmin || !!permisos.ver_documentos_personal,
    subirDocs:     esAdmin || !!permisos.subir_documentos_personal,
    eliminarDocs:  esAdmin || !!permisos.eliminar_documentos_personal,
    verAuditoria:  esAdmin || !!permisos.ver_auditoria_personal,
  }

  const titulos = {
    dashboard:       'Panel Personal',
    contrataciones:  'Contrataciones',
    reemplazos:      'Reemplazos',
    documentos:      'Documentos',
    auditoria:       'Auditoría Personal',
  }

  return (
    <div className="personal-page">
      {/* Sub-header con tabs */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0',
        padding: '6px 6px', marginBottom: 20, overflowX: 'auto',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      }}>
        {[
          { key: 'dashboard', label: 'Inicio', show: true },
          { key: 'contrataciones', label: 'Contrataciones', show: p.verContrat },
          { key: 'reemplazos', label: 'Reemplazos', show: p.verReempl },
          { key: 'documentos', label: 'Documentos', show: p.verDocs },
        ].filter(t => t.show).map(t => (
          <button key={t.key}
            onClick={() => onIrAVista?.(t.key)}
            style={{
              padding: '7px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap',
              background: vista === t.key ? 'rgb(var(--primary-rgb,26,35,126))' : 'transparent',
              color: vista === t.key ? '#fff' : '#64748b',
              boxShadow: vista === t.key ? '0 2px 8px rgba(var(--primary-rgb,26,35,126),0.28)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={vista}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
        >
          {vista === 'dashboard'      && <DashboardTab usuario={usuario} onIrA={onIrAVista} />}
          {vista === 'contrataciones' && <ContratacionesTab usuario={usuario} permisos={p} />}
          {vista === 'reemplazos'     && <ReemplazosTab usuario={usuario} permisos={p} />}
          {vista === 'documentos'     && <DocumentosTab usuario={usuario} permisos={p} />}
          {vista === 'auditoria'      && <AuditoriaTab usuario={usuario} />}

        </motion.div>
      </AnimatePresence>
    </div>
  )
}
