import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { supabase } from '../supabase'
import './Requerimientos.css'

// ── Skeleton table ─────────────────────────────────────────────────────────
function SkeletonReqs() {
  return (
    <div className="req-skeleton-wrap">
      <div className="req-skeleton-toolbar">
        {[1,2,3].map(i => <div key={i} className="req-skeleton-block" style={{ height: 34, flex: i === 2 ? 2 : 1 }} />)}
      </div>
      <div className="req-table-wrap">
        <table className="req-table">
          <thead><tr>{['N°','Fecha','Contenido','Solicitante','Fondo','Acción','Monto','Estado',''].map((h,i) => <th key={i}>{h}</th>)}</tr></thead>
          <tbody>
            {[1,2,3,4,5,6].map(i => (
              <tr key={i} className="req-row">
                {[80,70,180,120,90,150,80,90,60].map((w,j) => (
                  <td key={j}><div className="req-skeleton-cell" style={{ width: w }} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Animation variants ─────────────────────────────────────────────────────
const pageVariants = {
  hidden:  { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.26, ease: 'easeOut' } },
}

const FONDOS = ['S.E.P.', 'P.I.E.', 'Sub. General', 'Mantenimiento', 'F.A.E.P.', 'Complementario TP', 'Aporte Municipal', 'Otro']
const DIMENSIONES = ['Gestión Pedagógica', 'Liderazgo', 'Convivencia Escolar', 'Recursos']
const SUB_DIMENSIONES = [
  'Enseñanza y aprendizaje en el aula',
  'Planificación y gestión de resultados',
  'Convivencia',
  'Participación y vida democrática',
  'Gestión del recurso educativo',
  'Gestión curricular',
]
const ACCIONES = [
  'Acompañamiento al aula PDP',
  'Mejoramiento de las prácticas docentes',
  'Talleres y planes de departamento',
  'Plan de fortalecimiento educativo',
  'Plan de trayectoria educativa',
  'Instrumentos de evaluación y medición',
  'Fortalecimiento del liderazgo directivo',
  'Plan de inclusión',
  'Plan de convivencia, bienestar y salud mental',
  'Actividades de formación ciudadana',
  'Trabajo en comunidad y participación',
  'Innovación y CRA',
  'Enseñanza Técnico Profesional',
]
const ESTADOS = [
  'En proceso', 'Enviado al DAEM', 'Revisión DAEM', 'En adquisiciones',
  'Comprado', 'Contratado', 'En ejecución', 'Reenviado',
  'Rechazado por DAEM', 'Rechazado por Liceo', 'Devuelto',
  'No comprado', 'No contratado', 'A la espera de presupuesto',
]
const EVIDENCIAS = ['No necesita', 'Entregada', 'Pendiente']

function ComboField({ value, onChange, opciones = [], placeholder, disabled }) {
  const [abierto, setAbierto] = useState(false)

  const filtradas = opciones
    .filter(o => o && o.toLowerCase().includes((value || '').toLowerCase()))
    .slice(0, 20)

  return (
    <div className="combo-wrap">
      <input
        type="text"
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        onFocus={() => !disabled && setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 160)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
      />
      {opciones.length > 0 && !disabled && (
        <span
          className="combo-chevron"
          onMouseDown={e => { e.preventDefault(); setAbierto(a => !a) }}
        >
          ▼
        </span>
      )}
      {abierto && !disabled && filtradas.length > 0 && (
        <div className="combo-dropdown">
          {filtradas.map(o => (
            <div
              key={o}
              className="combo-option"
              onMouseDown={e => { e.preventDefault(); onChange(o); setAbierto(false) }}
            >
              {o}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const COLUMNAS_EXPORT = [
  { key: 'numero_req',       label: 'N° Manual' },
  { key: 'id',               label: 'N° Req.' },
  { key: 'fecha',            label: 'Fecha' },
  { key: 'contenido',        label: 'Contenido' },
  { key: 'solicitante',      label: 'Solicitante' },
  { key: 'fondo',            label: 'Fondo' },
  { key: 'dimension',        label: 'Dimensión' },
  { key: 'sub_dimension',    label: 'Sub-Dimensión' },
  { key: 'accion',           label: 'Acción' },
  { key: 'monto_solicitado', label: 'Monto Solicitado' },
  { key: 'monto_real',       label: 'Monto Real' },
  { key: 'estado',           label: 'Estado' },
  { key: 'fecha_recepcion',  label: 'Fecha Recepción' },
  { key: 'orden_compra',     label: 'Orden de Compra' },
  { key: 'rut_proveedor',    label: 'RUT Proveedor' },
  { key: 'numero_factura',   label: 'N° Factura' },
  { key: 'evidencia',        label: 'Evidencia' },
  { key: 'observacion',      label: 'Observación' },
]

// Columnas BD válidas para importación
const COLUMNAS_BD = new Set([
  'numero_req',
  'fecha', 'contenido', 'solicitante', 'fondo', 'dimension', 'sub_dimension', 'accion',
  'monto_solicitado', 'monto_real', 'estado', 'fecha_recepcion', 'orden_compra',
  'rut_proveedor', 'numero_factura', 'evidencia', 'observacion',
])
const ALIAS_IMPORT = {
  'n°_req.':         null,
  'n°_req':          null,
  'id':              null,
  'n°_manual':       'numero_req',
  'numero_manual':   'numero_req',
  'num_req':         'numero_req',
  'monto_solicitado': 'monto_solicitado',
  'monto_real':       'monto_real',
  'monto sol.':       'monto_solicitado',
  'monto real':       'monto_real',
  'sub-dimensión':    'sub_dimension',
  'sub-dimension':    'sub_dimension',
  'sub_dimensión':    'sub_dimension',
  'dimensión':        'dimension',
  'acción':           'accion',
  'observación':      'observacion',
  'fecha recepción':  'fecha_recepcion',
  'fecha recepcion':  'fecha_recepcion',
  'orden de compra':  'orden_compra',
  'rut proveedor':    'rut_proveedor',
  'n° factura':       'numero_factura',
  'n°_factura':       'numero_factura',
  'nro_factura':      'numero_factura',
}

const ESTADO_STYLE = {
  'Comprado':                   { bg: 'rgba(22,163,74,0.15)',   color: '#4ade80' },
  'Contratado':                 { bg: 'rgba(22,163,74,0.15)',   color: '#4ade80' },
  'En ejecución':               { bg: 'rgba(22,163,74,0.15)',   color: '#4ade80' },
  'Enviado al DAEM':            { bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa' },
  'Reenviado':                  { bg: 'rgba(139,92,246,0.15)',  color: '#a78bfa' },
  'En proceso':                 { bg: 'rgba(217,119,6,0.15)',   color: '#fbbf24' },
  'Revisión DAEM':              { bg: 'rgba(217,119,6,0.15)',   color: '#fbbf24' },
  'En adquisiciones':           { bg: 'rgba(217,119,6,0.15)',   color: '#fbbf24' },
  'A la espera de presupuesto': { bg: 'rgba(148,163,184,0.1)',  color: '#94a3b8' },
  'No comprado':                { bg: 'rgba(239,68,68,0.15)',   color: '#f87171' },
  'No contratado':              { bg: 'rgba(239,68,68,0.15)',   color: '#f87171' },
  'Rechazado por DAEM':         { bg: 'rgba(239,68,68,0.15)',   color: '#f87171' },
  'Rechazado por Liceo':        { bg: 'rgba(239,68,68,0.15)',   color: '#f87171' },
  'Devuelto':                   { bg: 'rgba(234,88,12,0.15)',   color: '#fb923c' },
}

const FORM_VACIO = {
  numero_req: '',
  fecha: '', contenido: '', solicitante: '', fondo: '',
  dimension: '', sub_dimension: '', accion: '',
  monto_solicitado: '', monto_real: '', estado: 'En proceso',
  fecha_recepcion: '', orden_compra: '', rut_proveedor: '',
  numero_factura: '', evidencia: 'Pendiente', observacion: '',
}

const BUCKET_REQ_IMGS = 'requerimientos'
const MAX_OBS_IMAGENES = 6
const MAX_OBS_IMG_BYTES = 5 * 1024 * 1024

function parseObsImagenes(val) {
  if (!val) return []
  if (Array.isArray(val)) return val.filter(u => typeof u === 'string' && u)
  return []
}

function pathDesdeUrlPublica(url) {
  try {
    const u = new URL(url)
    const mark = '/object/public/requerimientos/'
    const i = u.pathname.indexOf(mark)
    if (i >= 0) return decodeURIComponent(u.pathname.slice(i + mark.length).split('?')[0])
  } catch { /* ignore */ }
  return null
}

async function subirImagenRequerimiento(reqId, file) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `${reqId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET_REQ_IMGS).upload(path, file, {
    contentType: file.type || 'image/jpeg',
    upsert: false,
  })
  if (error) throw error
  const { data: { publicUrl } } = supabase.storage.from(BUCKET_REQ_IMGS).getPublicUrl(path)
  return publicUrl
}

async function borrarImagenesStorage(urls) {
  const paths = urls.map(pathDesdeUrlPublica).filter(Boolean)
  if (!paths.length) return
  await supabase.storage.from(BUCKET_REQ_IMGS).remove(paths)
}

function cargarHtml2pdf() {
  return new Promise((resolve, reject) => {
    if (window.html2pdf) { resolve(); return }
    const prev = document.getElementById('html2pdf-script')
    if (prev) {
      prev.addEventListener('load', () => resolve(), { once: true })
      prev.addEventListener('error', reject, { once: true })
      return
    }
    const script = document.createElement('script')
    script.id = 'html2pdf-script'
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
    script.onload = () => resolve()
    script.onerror = reject
    document.head.appendChild(script)
  })
}

function DetalleReqContenido({ r }) {
  const imgs = parseObsImagenes(r.observacion_imagenes)
  const st = ESTADO_STYLE[r.estado] || { bg: 'rgba(148,163,184,0.1)', color: '#94a3b8' }
  return (
    <>
      <div className="req-detalle-grid-2">
        <div className="req-detalle-seccion">
          <p className="req-detalle-titulo">General</p>
          {r.numero_req && <div className="req-detalle-fila"><span>N° Manual</span><strong>{r.numero_req}</strong></div>}
          <div className="req-detalle-fila"><span>Fecha</span><strong>{formatFecha(r.fecha)}</strong></div>
          <div className="req-detalle-fila"><span>Solicitante</span><strong>{r.solicitante || '—'}</strong></div>
          <div className="req-detalle-fila"><span>Estado</span>
            <span className="req-badge" style={{ background: st.bg, color: st.color }}>{r.estado || '—'}</span>
          </div>
          <div className="req-detalle-fila"><span>Evidencia</span><strong>{r.evidencia || '—'}</strong></div>
        </div>
        <div className="req-detalle-seccion">
          <p className="req-detalle-titulo">Clasificación</p>
          <div className="req-detalle-fila"><span>Fondo</span><strong>{r.fondo || '—'}</strong></div>
          <div className="req-detalle-fila"><span>Dimensión</span><strong>{r.dimension || '—'}</strong></div>
          <div className="req-detalle-fila"><span>Sub-Dimensión</span><strong>{r.sub_dimension || '—'}</strong></div>
          <div className="req-detalle-fila"><span>Acción</span><strong>{r.accion || '—'}</strong></div>
        </div>
      </div>
      <div className="req-detalle-seccion req-detalle-full">
        <p className="req-detalle-titulo">Contenido</p>
        <p className="req-detalle-texto">{r.contenido || '—'}</p>
      </div>
      <div className="req-detalle-grid-2">
        <div className="req-detalle-seccion">
          <p className="req-detalle-titulo">Montos</p>
          <div className="req-detalle-fila"><span>Monto solicitado</span><strong>{formatMonto(r.monto_solicitado)}</strong></div>
          <div className="req-detalle-fila"><span>Monto real</span><strong>{formatMonto(r.monto_real)}</strong></div>
        </div>
        <div className="req-detalle-seccion">
          <p className="req-detalle-titulo">Adquisición</p>
          <div className="req-detalle-fila"><span>Fecha recepción</span><strong>{formatFecha(r.fecha_recepcion)}</strong></div>
          <div className="req-detalle-fila"><span>Orden de compra</span><strong>{r.orden_compra || '—'}</strong></div>
          <div className="req-detalle-fila"><span>RUT proveedor</span><strong>{r.rut_proveedor || '—'}</strong></div>
          <div className="req-detalle-fila"><span>N° factura</span><strong>{r.numero_factura || '—'}</strong></div>
        </div>
      </div>
      {(r.observacion || imgs.length > 0) && (
        <div className="req-detalle-seccion req-detalle-full">
          <p className="req-detalle-titulo">Observación</p>
          {r.observacion && <p className="req-detalle-texto">{r.observacion}</p>}
          {imgs.length > 0 && (
            <div className="req-detalle-imgs">
              {imgs.map(url => (
                <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="req-detalle-img-link">
                  <img src={url} alt="Adjunto" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}

function formatMonto(v) {
  if (v === null || v === undefined || v === '') return '—'
  return '$' + Number(v).toLocaleString('es-CL')
}

function formatMontoKpi(v) {
  if (v === null || v === undefined || v === '' || Number(v) === 0) return '$0'
  return '$' + Number(v).toLocaleString('es-CL')
}

function formatFecha(d) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('es-CL')
}

// ── Cargar ExcelJS ────────────────────────────────────────────────────────
const cargarExcelJS = () => new Promise((resolve, reject) => {
  if (window.ExcelJS) { resolve(); return }
  const s = document.getElementById('exceljs-script') || document.createElement('script')
  s.id  = 'exceljs-script'
  s.src = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js'
  s.onload = resolve; s.onerror = reject
  document.head.appendChild(s)
})

// ── Cargar SheetJS para importar ──────────────────────────────────────────
const cargarSheetJS = () => new Promise((resolve, reject) => {
  if (window.XLSX) { resolve(); return }
  const s = document.getElementById('sheetjs-script') || document.createElement('script')
  s.id  = 'sheetjs-script'
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
  s.onload = resolve; s.onerror = reject
  document.head.appendChild(s)
})

// ── Exportar a CSV ────────────────────────────────────────────────────────
function exportarCSVReq(items) {
  const escapar = (v) => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }
  const filas = [
    COLUMNAS_EXPORT.map(c => c.label).join(','),
    ...items.map(r => COLUMNAS_EXPORT.map(c => escapar(r[c.key])).join(',')),
  ]
  const blob = new Blob([filas.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `requerimientos_${new Date().toISOString().slice(0, 10)}.csv`
  a.click(); URL.revokeObjectURL(url)
}

// ── Exportar a PDF ────────────────────────────────────────────────────────
function exportarPDFReq(items) {
  const fecha = new Date().toLocaleDateString('es-CL')
  const cols = [
    { key: 'numero_req', label: 'N° Manual' },
    { key: 'id',         label: 'N° Req.' },
    { key: 'fecha',      label: 'Fecha' },
    { key: 'contenido',  label: 'Contenido' },
    { key: 'solicitante',label: 'Solicitante' },
    { key: 'fondo',      label: 'Fondo' },
    { key: 'accion',     label: 'Acción' },
    { key: 'monto_solicitado', label: 'Monto Sol.' },
    { key: 'monto_real', label: 'Monto Real' },
    { key: 'estado',     label: 'Estado' },
    { key: 'evidencia',  label: 'Evidencia' },
  ]
  const filaColor = (estado) => {
    if (['Comprado','Contratado','En ejecución'].includes(estado)) return '#dcfce7'
    if (['En proceso','Revisión DAEM','En adquisiciones','Enviado al DAEM','Reenviado'].includes(estado)) return '#fef9c3'
    if ((estado ?? '').startsWith('Rechazado') || estado === 'Devuelto') return '#fee2e2'
    return '#ffffff'
  }
  const htmlContent = `<html><head><meta charset="utf-8"><style>
    body { font-family: Arial, sans-serif; font-size: 10px; color: #111; margin: 0; padding: 16px; }
    h1 { font-size: 15px; margin: 0 0 4px; color: #1e3a8a; }
    .sub { font-size: 10px; color: #6b7280; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #1e3a8a; color: white; padding: 5px 6px; text-align: left; font-size: 9px; }
    td { padding: 4px 6px; border-bottom: 1px solid #e5e7eb; font-size: 9px; }
    tr:nth-child(even) td { background: #f9fafb; }
  </style></head><body>
    <h1>Requerimientos</h1>
    <p class="sub">Generado el ${fecha} · ${items.length} registro${items.length !== 1 ? 's' : ''}</p>
    <table>
      <thead><tr>${cols.map(c => `<th>${c.label}</th>`).join('')}</tr></thead>
      <tbody>${items.map(r => {
        const bg = filaColor(r.estado)
        return `<tr style="background:${bg}">${cols.map(c => {
          let v = r[c.key] ?? '—'
          if (c.key === 'monto_solicitado' || c.key === 'monto_real') v = v !== '—' ? '$' + Number(v).toLocaleString('es-CL') : '—'
          if (c.key === 'fecha' && v !== '—') v = new Date(v + 'T00:00:00').toLocaleDateString('es-CL')
          if (c.key === 'id') v = '#' + v
          return `<td>${v}</td>`
        }).join('')}</tr>`
      }).join('')}</tbody>
    </table>
  </body></html>`

  const cargarYExportar = () => {
    const opt = {
      margin: [8, 6, 8, 6],
      filename: `requerimientos_${new Date().toISOString().slice(0, 10)}.pdf`,
      image: { type: 'jpeg', quality: 0.97 },
      html2canvas: { scale: 2, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
    }
    const el = document.createElement('div')
    el.innerHTML = htmlContent
    document.body.appendChild(el)
    window.html2pdf().set(opt).from(el).save().then(() => document.body.removeChild(el))
  }
  if (window.html2pdf) { cargarYExportar(); return }
  const script = document.createElement('script')
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
  script.onload = cargarYExportar
  document.head.appendChild(script)
}

// ── Exportar a Word ───────────────────────────────────────────────────────
function exportarWordReq(items) {
  const fecha = new Date().toLocaleDateString('es-CL')
  const cols = [
    { key: 'numero_req', label: 'N° Manual' },
    { key: 'id',         label: 'N° Req.' },
    { key: 'fecha',      label: 'Fecha' },
    { key: 'contenido',  label: 'Contenido' },
    { key: 'solicitante',label: 'Solicitante' },
    { key: 'fondo',      label: 'Fondo' },
    { key: 'accion',     label: 'Acción' },
    { key: 'monto_solicitado', label: 'Monto Sol.' },
    { key: 'monto_real', label: 'Monto Real' },
    { key: 'estado',     label: 'Estado' },
    { key: 'evidencia',  label: 'Evidencia' },
  ]
  const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
    <head><meta charset="utf-8"><style>
      body { font-family: Calibri, sans-serif; font-size: 9pt; }
      h1 { font-size: 14pt; color: #1e3a8a; }
      table { border-collapse: collapse; width: 100%; }
      th { background: #1e3a8a; color: white; padding: 4px 6px; font-size: 8pt; border: 1px solid #ccc; }
      td { padding: 3px 6px; font-size: 8pt; border: 1px solid #ddd; }
      tr:nth-child(even) td { background: #f0f4ff; }
    </style></head><body>
      <h1>Requerimientos</h1>
      <p style="color:#6b7280;font-size:8pt">Generado el ${fecha} · ${items.length} registros</p>
      <table>
        <thead><tr>${cols.map(c => `<th>${c.label}</th>`).join('')}</tr></thead>
        <tbody>${items.map(r => `<tr>${cols.map(c => {
          let v = r[c.key] ?? '—'
          if (c.key === 'id') v = '#' + v
          return `<td>${v}</td>`
        }).join('')}</tr>`).join('')}</tbody>
      </table>
    </body></html>`
  const blob = new Blob(['﻿', html], { type: 'application/msword' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `requerimientos_${new Date().toISOString().slice(0, 10)}.doc`
  a.click(); URL.revokeObjectURL(url)
}

// ── Exportar a Imagen ─────────────────────────────────────────────────────
function exportarImagenReq(items) {
  const fecha = new Date().toLocaleDateString('es-CL')
  const cols = ['numero_req','id','fecha','contenido','solicitante','fondo','estado','monto_solicitado']
  const headers = ['N° Manual','N° Req.','Fecha','Contenido','Solicitante','Fondo','Estado','Monto Sol.']
  const FILA_H = 28, HEAD_H = 70, PAD = 20
  const colW = [80, 65, 75, 200, 120, 90, 100, 90]
  const totalW = colW.reduce((a, b) => a + b, 0) + PAD * 2
  const totalH = HEAD_H + 34 + FILA_H * items.length + PAD * 2

  const canvas = document.createElement('canvas')
  canvas.width = totalW; canvas.height = totalH
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, totalW, totalH)
  ctx.fillStyle = '#1e3a8a'; ctx.fillRect(0, 0, totalW, 56)
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 16px Arial'
  ctx.fillText('Requerimientos', PAD, 32)
  ctx.font = '11px Arial'; ctx.fillStyle = '#bfdbfe'
  ctx.fillText(`${fecha}  ·  ${items.length} registros`, PAD, 48)

  let x = PAD, y = HEAD_H
  ctx.fillStyle = '#1e40af'; ctx.fillRect(0, y, totalW, 34)
  headers.forEach((h, i) => {
    ctx.fillStyle = '#e0e7ff'; ctx.font = 'bold 10px Arial'
    ctx.fillText(h, x + 5, y + 21); x += colW[i]
  })

  items.forEach((r, ri) => {
    y = HEAD_H + 34 + ri * FILA_H
    ctx.fillStyle = ri % 2 === 0 ? '#ffffff' : '#f0f4ff'
    ctx.fillRect(0, y, totalW, FILA_H)
    x = PAD
    cols.forEach((c, i) => {
      let v = String(r[c] ?? '—').slice(0, 20)
      if (c === 'id') v = '#' + v
      if (c === 'monto_solicitado' && r[c]) v = '$' + Number(r[c]).toLocaleString('es-CL')
      ctx.fillStyle = '#111827'; ctx.font = '10px Arial'
      ctx.fillText(v, x + 5, y + 17); x += colW[i]
    })
    ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 0.5
    ctx.beginPath(); ctx.moveTo(0, y + FILA_H); ctx.lineTo(totalW, y + FILA_H); ctx.stroke()
  })

  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `requerimientos_${new Date().toISOString().slice(0, 10)}.png`
    a.click(); URL.revokeObjectURL(url)
  })
}

// ── Exportar a Excel ──────────────────────────────────────────────────────
async function exportarExcel(items) {
  await cargarExcelJS()
  const wb = new window.ExcelJS.Workbook()
  const ws = wb.addWorksheet('Requerimientos')

  ws.columns = COLUMNAS_EXPORT.map(c => ({
    width: Math.max(c.label.length + 4, 16),
  }))

  const headerRow = ws.addRow(COLUMNAS_EXPORT.map(c => c.label))
  headerRow.height = 20
  headerRow.eachCell(cell => {
    cell.font      = { bold: true, color: { argb: 'FF1A237E' }, size: 11 }
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EAF6' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border    = {
      top:    { style: 'medium', color: { argb: 'FF9FA8DA' } },
      bottom: { style: 'medium', color: { argb: 'FF9FA8DA' } },
      left:   { style: 'thin',   color: { argb: 'FFC5CAE9' } },
      right:  { style: 'thin',   color: { argb: 'FFC5CAE9' } },
    }
  })

  items.forEach(r => {
    const row = ws.addRow(COLUMNAS_EXPORT.map(c => r[c.key] ?? ''))
    row.eachCell({ includeEmpty: true }, cell => {
      cell.border = {
        top:    { style: 'thin', color: { argb: 'FFC5CAE9' } },
        bottom: { style: 'thin', color: { argb: 'FFC5CAE9' } },
        left:   { style: 'thin', color: { argb: 'FFC5CAE9' } },
        right:  { style: 'thin', color: { argb: 'FFC5CAE9' } },
      }
      cell.alignment = { vertical: 'middle', wrapText: false }
    })
  })

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNAS_EXPORT.length } }
  ws.views = [{ state: 'frozen', ySplit: 1 }]

  const buffer = await wb.xlsx.writeBuffer()
  const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url    = URL.createObjectURL(blob)
  const a      = document.createElement('a'); a.href = url
  a.download   = `requerimientos_${new Date().toISOString().slice(0, 10)}.xlsx`
  a.click(); URL.revokeObjectURL(url)
}

// ── Leer XLSX importado ───────────────────────────────────────────────────
const leerXLSX = (file) => new Promise((resolve, reject) => {
  const cargar = () => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const wb   = window.XLSX.read(data, { type: 'array' })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const raw  = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
        if (raw.length < 2) { resolve([]); return }
        const headers = raw[0].map(h => String(h).toLowerCase().trim().replace(/\s+/g, '_'))
        const rows = raw.slice(1)
          .filter(r => r.some(c => c !== '' && c !== null))
          .map(r => {
            const obj = {}
            headers.forEach((h, i) => { obj[h] = r[i] ?? '' })
            return obj
          })
        resolve(rows)
      } catch (err) { reject(err) }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  }
  if (window.XLSX) { cargar(); return }
  cargarSheetJS().then(cargar).catch(reject)
})

const parseCSV = (text) => {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase().replace(/\s+/g, '_'))
  return lines.slice(1).map(line => {
    const cols = []; let cur = '', inQ = false
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ }
      else if (ch === ',' && !inQ) { cols.push(cur); cur = '' }
      else cur += ch
    }
    cols.push(cur)
    const obj = {}
    headers.forEach((h, i) => { obj[h] = cols[i]?.replace(/^"|"$/g, '').trim() ?? '' })
    return obj
  })
}

const excelSerialAFecha = (n) => {
  const d = new Date(Date.UTC(1899, 11, 30) + Number(n) * 86400000)
  return isNaN(d) ? null : d.toISOString().slice(0, 10)
}

const normalizarFecha = (v) => {
  if (v === null || v === undefined || v === '') return null
  const s = String(v).trim()
  if (!s) return null
  if (/^\d{4,5}$/.test(s)) return excelSerialAFecha(Number(s))
  return s
}

const CAMPOS_FECHA = new Set(['fecha', 'fecha_recepcion'])

const mapearFila = (row) => {
  const payload = {}
  for (const [k, v] of Object.entries(row)) {
    const kNorm = k.toLowerCase().trim().replace(/\s+/g, '_')
    const col = ALIAS_IMPORT[kNorm] !== undefined ? ALIAS_IMPORT[kNorm] : (COLUMNAS_BD.has(kNorm) ? kNorm : null)
    if (!col || v === '' || v === null) continue
    payload[col] = CAMPOS_FECHA.has(col) ? normalizarFecha(v) : String(v).trim()
  }
  if (payload.monto_solicitado) payload.monto_solicitado = Number(payload.monto_solicitado) || null
  if (payload.monto_real)       payload.monto_real       = Number(payload.monto_real)       || null
  return payload
}

// ── Componente ImportarReq ────────────────────────────────────────────────
function ImportarReq({ onImportado, onCerrar }) {
  const [fase,     setFase]     = useState('idle')
  const [filas,    setFilas]    = useState([])
  const [errParse, setErrParse] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const [resultado,setResultado]= useState(null)
  const inputRef = useRef()

  const procesarArchivo = async (file) => {
    setErrParse(null); setFileName(file.name)
    try {
      let rows
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        rows = await leerXLSX(file)
      } else {
        rows = parseCSV(await file.text())
      }
      if (!rows.length) { setErrParse('El archivo está vacío o sin filas de datos.'); return }
      setFilas(rows.map(mapearFila))
      setFase('preview')
    } catch (err) { setErrParse('Error al leer el archivo: ' + err.message) }
  }

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false)
    if (e.dataTransfer.files[0]) procesarArchivo(e.dataTransfer.files[0])
  }, [])

  const importar = async () => {
    setFase('importando')
    let importados = 0, errores = []
    for (const payload of filas) {
      if (!payload.contenido) { errores.push('Fila sin contenido — omitida'); continue }
      const { error } = await supabase.from('requerimientos').insert(payload)
      if (error) errores.push(error.message)
      else importados++
    }
    setResultado({ importados, errores, total: filas.length })
    setFase('resultado')
    if (importados > 0) onImportado()
  }

  const resetear = () => { setFase('idle'); setFilas([]); setErrParse(null); setFileName(''); setResultado(null) }

  return (
    <div className="req-modal-overlay" onClick={e => e.target === e.currentTarget && onCerrar()}>
      <div className="req-modal req-modal--import">
        <div className="req-modal-header">
          <h2>Importar requerimientos</h2>
          <button className="req-modal-close" onClick={onCerrar}>✕</button>
        </div>
        <div className="req-modal-body">

          {fase === 'idle' && (
            <>
              <div
                className={`req-drop-zone ${dragging ? 'dragging' : ''}`}
                onDrop={onDrop}
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onClick={() => inputRef.current?.click()}
              >
                <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }}
                  onChange={e => { if (e.target.files[0]) procesarArchivo(e.target.files[0]) }} />
                <div className="req-drop-icon">📂</div>
                <p className="req-drop-title">Arrastra tu archivo aquí</p>
                <p className="req-drop-sub">o haz clic para seleccionar</p>
                <p className="req-drop-formats">.csv · .xlsx · .xls</p>
                {errParse && <p className="req-drop-error">⚠️ {errParse}</p>}
              </div>
              <div className="req-import-cols">
                <p className="req-import-cols-title">Columnas reconocidas</p>
                <div className="req-import-cols-list">
                  {[...COLUMNAS_BD].map(c => (
                    <span key={c} className="req-import-col-chip">{c}</span>
                  ))}
                </div>
              </div>
            </>
          )}

          {fase === 'preview' && (
            <>
              <p className="req-preview-info">
                📋 <strong>{fileName}</strong> — {filas.length} fila{filas.length !== 1 ? 's' : ''} detectadas
              </p>
              <div className="req-table-wrap" style={{ maxHeight: 260 }}>
                <table className="req-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Contenido</th>
                      <th>Solicitante</th>
                      <th>Fondo</th>
                      <th>Estado</th>
                      <th>Monto Sol.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.slice(0, 8).map((r, i) => (
                      <tr key={i}>
                        <td className="req-num">{i + 1}</td>
                        <td className="req-contenido">{r.contenido || <em style={{ color: '#dc2626' }}>sin contenido</em>}</td>
                        <td>{r.solicitante || '—'}</td>
                        <td>{r.fondo || '—'}</td>
                        <td>{r.estado || '—'}</td>
                        <td>{r.monto_solicitado ? formatMonto(r.monto_solicitado) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filas.length > 8 && <p className="req-preview-mas">… y {filas.length - 8} fila{filas.length - 8 !== 1 ? 's' : ''} más</p>}
              </div>
              <div className="req-modal-footer" style={{ border: 'none', padding: '12px 0 0' }}>
                <button className="req-btn-cancel" onClick={resetear}>← Atrás</button>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                  <button className="req-btn-guardar" onClick={importar}>
                    Importar {filas.length} registro{filas.length !== 1 ? 's' : ''}
                  </button>
                </div>
              </div>
            </>
          )}

          {fase === 'importando' && (
            <div className="req-importando">
              <div className="req-spinner" />
              <p>Importando registros…</p>
            </div>
          )}

          {fase === 'resultado' && resultado && (
            <div className="req-resultado">
              <div className="req-resultado-icon">{resultado.errores.length === 0 ? '🎉' : '⚠️'}</div>
              <p className="req-resultado-title">Importación completada</p>
              <div className="req-resultado-stats">
                <div className="req-stat req-stat--ok">
                  <span>{resultado.importados}</span>
                  <small>importados</small>
                </div>
                <div className="req-stat req-stat--err">
                  <span>{resultado.errores.length}</span>
                  <small>errores</small>
                </div>
              </div>
              {resultado.errores.length > 0 && (
                <div className="req-errores-lista">
                  {resultado.errores.slice(0, 5).map((e, i) => <p key={i}>• {e}</p>)}
                </div>
              )}
              <button className="req-btn-guardar" style={{ marginTop: 16 }} onClick={resetear}>
                Importar otro archivo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── FiltroSelect ─────────────────────────────────────────────────────────
function FiltroSelect({ value, onChange, opciones, placeholder }) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef()

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="fsel-wrap" ref={ref}>
      <button
        type="button"
        className={`fsel-trigger req-filter ${value ? 'fsel-trigger--active' : ''}`}
        onClick={() => setAbierto(a => !a)}
      >
        <span className="fsel-label">{value || placeholder}</span>
        <span className="fsel-chevron">▼</span>
      </button>
      {abierto && (
        <div className="fsel-dropdown">
          <div
            className={`fsel-option ${!value ? 'fsel-option--sel' : ''}`}
            onMouseDown={() => { onChange(''); setAbierto(false) }}
          >
            {placeholder}
          </div>
          {opciones.map(o => (
            <div
              key={o}
              className={`fsel-option ${value === o ? 'fsel-option--sel' : ''}`}
              onMouseDown={() => { onChange(o); setAbierto(false) }}
            >
              {o}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── DateRangePicker compacto ──────────────────────────────────────────────
function DateRangePicker({ desde, hasta, onDesde, onHasta, onLimpiar }) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef()

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const formatLabel = (d) => {
    if (!d) return null
    const [y, m, day] = d.split('-')
    return `${day}/${m}/${y}`
  }

  const tieneRango = desde || hasta
  const label = tieneRango
    ? `${formatLabel(desde) || '…'} → ${formatLabel(hasta) || '…'}`
    : '📅 Filtrar por fecha'

  return (
    <div className="drp-wrap" ref={ref}>
      <button
        type="button"
        className={`drp-trigger req-filter ${tieneRango ? 'drp-trigger--active' : ''}`}
        onClick={() => setAbierto(a => !a)}
      >
        {tieneRango ? `📅 ${label}` : label}
        {tieneRango && (
          <span
            className="drp-clear"
            onMouseDown={e => { e.stopPropagation(); onLimpiar() }}
            title="Limpiar"
          >✕</span>
        )}
      </button>
      {abierto && (
        <div className="drp-panel">
          <div className="drp-row">
            <div className="drp-col">
              <span className="drp-col-label">Desde</span>
              <input
                type="date"
                className="drp-date-input"
                value={desde}
                max={hasta || undefined}
                onChange={e => onDesde(e.target.value)}
              />
            </div>
            <div className="drp-sep">→</div>
            <div className="drp-col">
              <span className="drp-col-label">Hasta</span>
              <input
                type="date"
                className="drp-date-input"
                value={hasta}
                min={desde || undefined}
                onChange={e => onHasta(e.target.value)}
              />
            </div>
          </div>
          {tieneRango && (
            <button type="button" className="drp-btn-limpiar" onClick={() => { onLimpiar(); setAbierto(false) }}>
              Limpiar fechas
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
export default function Requerimientos({ usuario, filtroInicial = null, permisos = {} }) {
  const esAdmin     = usuario.rol === 'admin'
  const esVisorReq  = usuario.rol === 'visor_requerimientos'
  const _legacyEdit = !esVisorReq && (esAdmin || usuario.rol === 'editor' || usuario.rol === 'encargado')
  // Permisos granulares: usa prop si viene de App, sino fallback a roles
  const puedeCrear    = permisos.crear    !== undefined ? permisos.crear    : _legacyEdit
  const puedeEditar   = permisos.editar   !== undefined ? permisos.editar   : _legacyEdit
  const puedeEliminar = permisos.eliminar !== undefined ? permisos.eliminar : esAdmin
  const puedeImportar = permisos.importar !== undefined ? permisos.importar : esAdmin
  const puedeExportar = permisos.exportar !== undefined ? permisos.exportar : _legacyEdit

  const [items,             setItems]             = useState([])
  const shouldReduce = useReducedMotion()
  const [cargando,          setCargando]          = useState(true)
  const [modal,             setModal]             = useState(false)
  const [verDetalle,        setVerDetalle]        = useState(null)
  const [form,              setForm]              = useState(FORM_VACIO)
  const [guardando,         setGuardando]         = useState(false)
  const [exportando,        setExportando]        = useState(false)
  const [menuExportar,      setMenuExportar]      = useState(false)
  const [modalImportar,     setModalImportar]     = useState(false)
  const [busqueda,          setBusqueda]          = useState('')
  const [filtroEstado,      setFiltroEstado]      = useState('')
  const [filtroFondo,       setFiltroFondo]       = useState('')
  const [filtroKpi,         setFiltroKpi]         = useState(filtroInicial)
  const [filtroFechaDesde,  setFiltroFechaDesde]  = useState('')
  const [filtroFechaHasta,  setFiltroFechaHasta]  = useState('')
  const [filtroNumero,      setFiltroNumero]      = useState('')
  const [confirmarEliminar, setConfirmarEliminar] = useState(false)
  const [confirmDelId,      setConfirmDelId]      = useState(null)
  const [paginaR, setPaginaR] = useState(1)
  const [imagenesExistentes, setImagenesExistentes] = useState([])
  const [imagenesNuevas,     setImagenesNuevas]     = useState([])
  const [errorGuardar,       setErrorGuardar]       = useState('')

  useEffect(() => { cargar() }, [])

  const revocarPreviewsNuevas = () => {
    setImagenesNuevas(prev => {
      prev.forEach(i => URL.revokeObjectURL(i.preview))
      return []
    })
  }

  const limpiarImagenesPendientes = () => {
    revocarPreviewsNuevas()
    setImagenesExistentes([])
  }

  const resetImagenes = (urls = []) => {
    revocarPreviewsNuevas()
    setImagenesExistentes(urls)
  }

  const cargar = async () => {
    setCargando(true)
    const { data } = await supabase.from('requerimientos').select('*').order('id', { ascending: false })
    setItems(data ?? [])
    setCargando(false)
  }

  const filtrados = useMemo(() => items.filter(r => {
    if (filtroEstado && r.estado !== filtroEstado) return false
    if (filtroFondo  && r.fondo  !== filtroFondo)  return false
    if (filtroFechaDesde && r.fecha && r.fecha < filtroFechaDesde) return false
    if (filtroFechaHasta && r.fecha && r.fecha > filtroFechaHasta) return false
    if (filtroKpi === 'proceso')   {
      if (!['En proceso','Revisión DAEM','En adquisiciones','Enviado al DAEM','Reenviado'].includes(r.estado)) return false
    }
    if (filtroKpi === 'comprados') {
      if (!['Comprado','Contratado','En ejecución'].includes(r.estado)) return false
    }
    if (filtroKpi === 'rechazados') {
      if (!(r.estado ?? '').startsWith('Rechazado') && r.estado !== 'Devuelto') return false
    }
    if (busqueda.trim()) {
      const q   = busqueda.toLowerCase()
      const hay = s => (s ?? '').toLowerCase().includes(q)
      if (!hay(r.contenido) && !hay(r.solicitante) && !hay(r.accion) && !hay(r.orden_compra) && !hay(r.numero_factura)) return false
    }
    return true
  }), [items, filtroEstado, filtroFondo, filtroKpi, filtroFechaDesde, filtroFechaHasta, busqueda, filtroNumero])

  useEffect(() => { setPaginaR(1) }, [filtroEstado, filtroFondo, filtroKpi, filtroFechaDesde, filtroFechaHasta, busqueda, filtroNumero])

  const POR_PAG_R    = 20
  const totalPagsR   = Math.ceil(filtrados.length / POR_PAG_R)
  const filtradosPagR = filtrados.slice((paginaR - 1) * POR_PAG_R, paginaR * POR_PAG_R)
  const pBtnR = (dis) => ({ padding: '5px 11px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: dis ? '#f9fafb' : '#ffffff', color: dis ? '#d1d5db' : '#374151', cursor: dis ? 'default' : 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', transition: 'background 0.15s', boxShadow: dis ? 'none' : '0 1px 2px rgba(0,0,0,0.04)' })

  const toggleKpi = (key) => setFiltroKpi(prev => prev === key ? null : key)

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const abrirNuevo = () => {
    setVerDetalle(null)
    resetImagenes()
    setErrorGuardar('')
    setForm(FORM_VACIO)
    setModal('nuevo')
  }
  const abrirVer = (item) => {
    setVerDetalle(item)
    setModal(false)
    setConfirmarEliminar(false)
  }

  const abrirEditar = (item) => {
    setVerDetalle(null)
    resetImagenes(parseObsImagenes(item.observacion_imagenes))
    setErrorGuardar('')
    setForm({ ...item })
    setModal(item)
  }
  const cerrar = () => {
    limpiarImagenesPendientes()
    setModal(false)
    setConfirmarEliminar(false)
    setErrorGuardar('')
  }

  const totalImagenes = imagenesExistentes.length + imagenesNuevas.length

  const onSeleccionarImagenes = (e) => {
    const files = [...(e.target.files || [])]
    e.target.value = ''
    if (!files.length) return
    const espacio = MAX_OBS_IMAGENES - totalImagenes
    if (espacio <= 0) {
      setErrorGuardar(`Máximo ${MAX_OBS_IMAGENES} imágenes por observación.`)
      return
    }
    const validas = []
    for (const f of files.slice(0, espacio)) {
      if (!f.type.startsWith('image/')) continue
      if (f.size > MAX_OBS_IMG_BYTES) {
        setErrorGuardar('Cada imagen debe pesar menos de 5 MB.')
        continue
      }
      validas.push({ file: f, preview: URL.createObjectURL(f) })
    }
    if (validas.length) {
      setImagenesNuevas(prev => [...prev, ...validas])
      setErrorGuardar('')
    }
  }

  const quitarImagenExistente = (url) => setImagenesExistentes(prev => prev.filter(u => u !== url))
  const quitarImagenNueva = (idx) => {
    setImagenesNuevas(prev => {
      const next = [...prev]
      const [removed] = next.splice(idx, 1)
      if (removed) URL.revokeObjectURL(removed.preview)
      return next
    })
  }

  const guardar = async () => {
    if (!form.contenido?.trim()) return
    setGuardando(true)
    setErrorGuardar('')
    const payload = {
      numero_req:       form.numero_req?.trim() || null,
      fecha:            form.fecha            || null,
      contenido:        form.contenido.trim(),
      solicitante:      form.solicitante,
      fondo:            form.fondo,
      dimension:        form.dimension,
      sub_dimension:    form.sub_dimension,
      accion:           form.accion,
      monto_solicitado: form.monto_solicitado !== '' ? Number(form.monto_solicitado) : null,
      monto_real:       form.monto_real       !== '' ? Number(form.monto_real)       : null,
      estado:           form.estado,
      fecha_recepcion:  form.fecha_recepcion  || null,
      orden_compra:     form.orden_compra,
      rut_proveedor:    form.rut_proveedor,
      numero_factura:   form.numero_factura,
      evidencia:        form.evidencia,
      observacion:      form.observacion,
    }
    try {
      let reqId = modal === 'nuevo' ? null : modal.id
      const prevUrls = modal !== 'nuevo' ? parseObsImagenes(modal.observacion_imagenes) : []
      const urlsEliminadas = prevUrls.filter(u => !imagenesExistentes.includes(u))

      if (modal === 'nuevo') {
        const { data, error } = await supabase.from('requerimientos')
          .insert({ ...payload, observacion_imagenes: [] })
          .select('id')
          .single()
        if (error) throw error
        reqId = data.id
      }

      const nuevasUrls = []
      for (const img of imagenesNuevas) {
        nuevasUrls.push(await subirImagenRequerimiento(reqId, img.file))
      }
      const todasUrls = [...imagenesExistentes, ...nuevasUrls]

      if (modal === 'nuevo') {
        const { error } = await supabase.from('requerimientos')
          .update({ observacion_imagenes: todasUrls })
          .eq('id', reqId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('requerimientos')
          .update({ ...payload, observacion_imagenes: todasUrls, actualizado_en: new Date().toISOString() })
          .eq('id', reqId)
        if (error) throw error
        if (urlsEliminadas.length) await borrarImagenesStorage(urlsEliminadas)
      }

      limpiarImagenesPendientes()
      setGuardando(false)
      cerrar()
      cargar()
    } catch (err) {
      setErrorGuardar(err?.message || 'No se pudo guardar. Revisa que ejecutaste el SQL en Supabase.')
      setGuardando(false)
    }
  }

  const eliminarRegistro = async (r) => {
    const urls = parseObsImagenes(r.observacion_imagenes)
    await borrarImagenesStorage(urls)
    const { error } = await supabase.from('requerimientos').delete().eq('id', r.id)
    if (error) throw error
    if (verDetalle?.id === r.id) setVerDetalle(null)
    if (modal?.id === r.id) cerrar()
    cargar()
  }

  const eliminar = async () => {
    if (!modal?.id) return
    try {
      await eliminarRegistro(modal)
    } catch (err) {
      setErrorGuardar(err?.message || 'No se pudo eliminar.')
    }
  }

  const eliminarDesdeTabla = (r) => {
    setConfirmDelId(null)
    eliminarRegistro(r).catch(err => {
      window.alert(err?.message || 'No se pudo eliminar.')
    })
  }

  const descargarPDFDetalle = async () => {
    const el = document.getElementById('req-detalle-pdf-content')
    if (!el || !verDetalle) return
    try {
      await cargarHtml2pdf()
    } catch {
      setErrorGuardar('No se pudo cargar la librería de PDF.')
      return
    }
    const btns = el.querySelectorAll('button')
    btns.forEach(b => { b.style.visibility = 'hidden' })
    const opt = {
      margin: [10, 10, 10, 10],
      filename: `requerimiento_${verDetalle.id}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    }
    window.html2pdf().set(opt).from(el).save().then(() => {
      btns.forEach(b => { b.style.visibility = '' })
    })
  }

  const handleExportar = async () => {
    setExportando(true)
    try { await exportarExcel(filtrados.length ? filtrados : items) }
    finally { setExportando(false) }
  }

  const kpis = useMemo(() => {
    const conMonto     = items.filter(r => Number(r.monto_solicitado) > 0)
    const conMontoReal = items.filter(r => Number(r.monto_real) > 0)
    return {
      total:         items.length,
      enProceso:     items.filter(r => ['En proceso','Revisión DAEM','En adquisiciones','Enviado al DAEM','Reenviado'].includes(r.estado)).length,
      comprados:     items.filter(r => ['Comprado','Contratado','En ejecución'].includes(r.estado)).length,
      rechazados:    items.filter(r => (r.estado ?? '').startsWith('Rechazado') || r.estado === 'Devuelto').length,
      montoTotal:    conMonto.reduce((acc, r) => acc + Number(r.monto_solicitado), 0),
      conMonto:      conMonto.length,
      montoRealTotal: conMontoReal.reduce((acc, r) => acc + Number(r.monto_real), 0),
      conMontoReal:  conMontoReal.length,
    }
  }, [items])

  const kpiFiltrados = useMemo(() => {
    const hayFiltro = filtroEstado || filtroFondo || filtroKpi || filtroFechaDesde || filtroFechaHasta || busqueda.trim() || filtroNumero.trim()
    if (!hayFiltro) return null
    const conMonto     = filtrados.filter(r => Number(r.monto_solicitado) > 0)
    const conMontoReal = filtrados.filter(r => Number(r.monto_real) > 0)
    return {
      total:          filtrados.length,
      montoTotal:     conMonto.reduce((acc, r) => acc + Number(r.monto_solicitado), 0),
      montoRealTotal: conMontoReal.reduce((acc, r) => acc + Number(r.monto_real), 0),
      conMonto:       conMonto.length,
      conMontoReal:   conMontoReal.length,
    }
  }, [filtrados, filtroEstado, filtroFondo, filtroKpi, filtroFechaDesde, filtroFechaHasta, busqueda, filtroNumero])

  const kpiAnim = (i) => ({
    initial: shouldReduce ? false : { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: shouldReduce ? 0 : i * 0.07, duration: 0.24, ease: 'easeOut' },
    whileHover: shouldReduce ? {} : { y: -3, transition: { duration: 0.18 } },
  })

  return (
    <motion.div
      className="req-page"
      variants={pageVariants}
      initial={shouldReduce ? false : 'hidden'}
      animate="visible"
    >

      {/* KPIs */}
      <div className="req-kpis">
        <motion.div
          className={`req-kpi req-kpi--clickable ${filtroKpi === null ? 'req-kpi--active' : ''}`}
          onClick={() => setFiltroKpi(null)}
          {...kpiAnim(0)}
        >
          <span className="req-kpi-num">{kpis.total}</span>
          {kpiFiltrados && <span className="req-kpi-sub">{kpiFiltrados.total} filtrados</span>}
          <span className="req-kpi-label">Total</span>
        </motion.div>
        <motion.div
          className={`req-kpi req-kpi--proceso req-kpi--clickable ${filtroKpi === 'proceso' ? 'req-kpi--active' : ''}`}
          onClick={() => toggleKpi('proceso')}
          {...kpiAnim(1)}
        >
          <span className="req-kpi-num">{kpis.enProceso}</span>
          {kpiFiltrados && <span className="req-kpi-sub">{filtrados.filter(r => ['En proceso','Revisión DAEM','En adquisiciones','Enviado al DAEM','Reenviado'].includes(r.estado)).length} filtrados</span>}
          <span className="req-kpi-label">En proceso</span>
        </motion.div>
        <motion.div
          className={`req-kpi req-kpi--ok req-kpi--clickable ${filtroKpi === 'comprados' ? 'req-kpi--active' : ''}`}
          onClick={() => toggleKpi('comprados')}
          {...kpiAnim(2)}
        >
          <span className="req-kpi-num">{kpis.comprados}</span>
          {kpiFiltrados && <span className="req-kpi-sub">{filtrados.filter(r => ['Comprado','Contratado','En ejecución'].includes(r.estado)).length} filtrados</span>}
          <span className="req-kpi-label">Comprados</span>
        </motion.div>
        <motion.div
          className={`req-kpi req-kpi--mal req-kpi--clickable ${filtroKpi === 'rechazados' ? 'req-kpi--active' : ''}`}
          onClick={() => toggleKpi('rechazados')}
          {...kpiAnim(3)}
        >
          <span className="req-kpi-num">{kpis.rechazados}</span>
          {kpiFiltrados && <span className="req-kpi-sub">{filtrados.filter(r => (r.estado ?? '').startsWith('Rechazado') || r.estado === 'Devuelto').length} filtrados</span>}
          <span className="req-kpi-label">Rechazados</span>
        </motion.div>
        <motion.div
          className="req-kpi req-kpi--monto req-kpi--resumen"
          title="Suma de todos los montos solicitados registrados (no filtra la tabla)"
          {...kpiAnim(4)}
        >
          <span className="req-kpi-num req-kpi-num--monto">{formatMontoKpi(kpis.montoTotal)}</span>
          {kpiFiltrados && <span className="req-kpi-sub req-kpi-sub--monto">{formatMontoKpi(kpiFiltrados.montoTotal)} filtrado</span>}
          <span className="req-kpi-label">Monto solicitado (total)</span>
        </motion.div>
        <motion.div
          className="req-kpi req-kpi--monto-real req-kpi--resumen"
          title="Suma de todos los montos reales registrados (no filtra la tabla)"
          {...kpiAnim(5)}
        >
          <span className="req-kpi-num req-kpi-num--monto">{formatMontoKpi(kpis.montoRealTotal)}</span>
          {kpiFiltrados && <span className="req-kpi-sub req-kpi-sub--monto">{formatMontoKpi(kpiFiltrados.montoRealTotal)} filtrado</span>}
          <span className="req-kpi-label">Monto real (total)</span>
        </motion.div>
      </div>

      {/* Botón limpiar filtros */}
      {kpiFiltrados && (
        <div className="req-filtro-banner">
          <span className="req-filtro-banner__label">🔍 Filtro activo — mostrando {kpiFiltrados.total} de {kpis.total} requerimientos</span>
          <button
            className="req-filtro-banner__limpiar"
            onClick={() => {
              setBusqueda(''); setFiltroEstado(''); setFiltroFondo('');
              setFiltroKpi(null); setFiltroFechaDesde(''); setFiltroFechaHasta(''); setFiltroNumero('')
            }}
          >✕ Limpiar filtros</button>
        </div>
      )}

      {/* Toolbar */}
      <div className="req-toolbar">
        <input
          style={{ width: 110, flexShrink: 0 }}
          className="req-search"
          placeholder="N° req..."
          value={filtroNumero}
          onChange={e => setFiltroNumero(e.target.value)}
        />
        <input
          className="req-search"
          placeholder="Buscar por contenido, solicitante, acción..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
        <FiltroSelect
          value={filtroEstado}
          onChange={setFiltroEstado}
          opciones={ESTADOS}
          placeholder="Todos los estados"
        />
        <FiltroSelect
          value={filtroFondo}
          onChange={setFiltroFondo}
          opciones={FONDOS}
          placeholder="Todos los fondos"
        />
        <DateRangePicker
          desde={filtroFechaDesde}
          hasta={filtroFechaHasta}
          onDesde={setFiltroFechaDesde}
          onHasta={setFiltroFechaHasta}
          onLimpiar={() => { setFiltroFechaDesde(''); setFiltroFechaHasta('') }}
        />
        {puedeImportar && (
          <button className="req-btn-tool" onClick={() => setModalImportar(true)}>
            ⬆ Importar
          </button>
        )}
        {puedeExportar && <div style={{ position: 'relative' }}>
          <button className="req-btn-tool" onClick={() => setMenuExportar(v => !v)}>
            ⬇ Exportar ▾
          </button>
          {menuExportar && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setMenuExportar(false)} />
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 100,
                background: '#0d1628', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.45)', minWidth: '200px', overflow: 'hidden',
              }}>
                <p style={{ margin: 0, padding: '8px 14px 6px', fontSize: '0.7rem', color: 'rgba(148,163,184,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                  Exportar vista actual
                </p>
                {[
                  { icon: '📄', label: 'CSV',    desc: 'Texto separado por comas',  fn: () => { exportarCSVReq(filtrados.length ? filtrados : items); setMenuExportar(false) } },
                  { icon: '📊', label: 'Excel',  desc: 'Hoja de cálculo .xlsx',     fn: async () => { setExportando(true); setMenuExportar(false); try { await exportarExcel(filtrados.length ? filtrados : items) } finally { setExportando(false) } } },
                  { icon: '📕', label: 'PDF',    desc: 'Tabla en PDF A4',           fn: () => { exportarPDFReq(filtrados.length ? filtrados : items); setMenuExportar(false) } },
                  { icon: '📝', label: 'Word',   desc: 'Documento .doc',            fn: () => { exportarWordReq(filtrados.length ? filtrados : items); setMenuExportar(false) } },
                  { icon: '🖼️', label: 'Imagen', desc: 'Captura PNG',              fn: () => { exportarImagenReq(filtrados.length ? filtrados : items); setMenuExportar(false) } },
                ].map(({ icon, label, desc, fn }) => (
                  <button key={label} onClick={fn} style={{
                    display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                    padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer',
                    textAlign: 'left', transition: 'background 0.15s', fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(27,43,69,0.6)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <span style={{ fontSize: '1.1rem' }}>{icon}</span>
                    <div>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem', color: '#e5e7eb' }}>{label}</p>
                      <p style={{ margin: 0, fontSize: '0.72rem', color: '#94a3b8' }}>{desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>}
        {puedeCrear && (
          <button className="req-btn-nuevo" onClick={abrirNuevo}>+ Nuevo</button>
        )}
      </div>

      {/* Tabla */}
      {cargando ? (
        <SkeletonReqs />
      ) : filtrados.length === 0 ? (
        <div className="req-empty">No hay requerimientos registrados.</div>
      ) : (
        <div className="req-table-wrap">
          <table className="req-table">
            <thead>
              <tr>
                <th>N°</th>
                <th>Fecha</th>
                <th>Contenido</th>
                <th>Solicitante</th>
                <th>Fondo</th>
                <th>Acción</th>
                <th>Monto Sol.</th>
                <th>Monto Real</th>
                <th>Estado</th>
                <th>Evidencia</th>
                <th className="req-th-acciones">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtradosPagR.map(r => {
                const st = ESTADO_STYLE[r.estado] || { bg: 'rgba(148,163,184,0.1)', color: '#94a3b8' }
                return (
                  <tr key={r.id} className="req-row">
                    <td className="req-num">
                      {r.numero_req && <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#60a5fa' }}>{r.numero_req}</span>}
                      <span style={{ color: r.numero_req ? 'rgba(148,163,184,0.5)' : undefined }}>#{r.id}</span>
                    </td>
                    <td className="req-nowrap">{formatFecha(r.fecha)}</td>
                    <td className="req-contenido">{r.contenido}</td>
                    <td>{r.solicitante || '—'}</td>
                    <td className="req-nowrap">{r.fondo || '—'}</td>
                    <td className="req-accion">{r.accion || '—'}</td>
                    <td className="req-nowrap">{formatMonto(r.monto_solicitado)}</td>
                    <td className="req-nowrap">{formatMonto(r.monto_real)}</td>
                    <td>
                      <span className="req-badge" style={{ background: st.bg, color: st.color }}>
                        {r.estado}
                      </span>
                    </td>
                    <td>{r.evidencia || '—'}</td>
                    <td className="req-td-acciones">
                      <div className="req-acciones">
                        <button type="button" className="btn-ver" onClick={() => abrirVer(r)} title="Ver detalle">👁</button>
                        {puedeEditar && (
                          <button type="button" className="btn-edit" onClick={() => abrirEditar(r)} title="Editar">✏️</button>
                        )}
                        {(puedeEliminar || esAdmin) && (
                          confirmDelId === r.id ? (
                            <span className="req-confirm-inline">
                              <button
                                type="button"
                                className="req-confirm-si"
                                title="Confirmar eliminación"
                                onClick={() => eliminarDesdeTabla(r)}
                              >✓</button>
                              <button
                                type="button"
                                className="req-confirm-no"
                                title="Cancelar"
                                onClick={() => setConfirmDelId(null)}
                              >✕</button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="btn-del"
                              onClick={() => setConfirmDelId(r.id)}
                              title="Eliminar"
                            >✕</button>
                          )
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

      {/* Paginación requerimientos */}
      {totalPagsR > 1 && (
        <div className="req-paginacion">
          <button className="req-pag-btn" onClick={() => setPaginaR(1)} disabled={paginaR === 1}>«</button>
          <button className="req-pag-btn" onClick={() => setPaginaR(p => p - 1)} disabled={paginaR === 1}>‹ Ant.</button>
          <span className="req-pag-info">Pág. {paginaR} / {totalPagsR} · {filtrados.length} req.</span>
          <button className="req-pag-btn" onClick={() => setPaginaR(p => p + 1)} disabled={paginaR >= totalPagsR}>Sig. ›</button>
          <button className="req-pag-btn" onClick={() => setPaginaR(totalPagsR)} disabled={paginaR >= totalPagsR}>»</button>
        </div>
      )}

      {/* Modal ver detalle */}
      {verDetalle && (
        <div className="req-modal-overlay" onClick={e => e.target === e.currentTarget && setVerDetalle(null)}>
          <div className="req-modal req-modal-detalle" onClick={e => e.stopPropagation()}>
            <div id="req-detalle-pdf-content" style={{ background: '#ffffff' }}>
              <div className="req-detalle-header">
                <div className="req-detalle-header-titulo">
                  <h2>Requerimiento #{verDetalle.id}</h2>
                  <p>{formatFecha(verDetalle.fecha)} · {verDetalle.solicitante || 'Sin solicitante'}</p>
                </div>
                <div className="req-detalle-header-actions">
                  <button type="button" className="req-btn-pdf" onClick={descargarPDFDetalle}>
                    ⬇ Descargar PDF
                  </button>
                  {puedeEditar && (
                    <button type="button" className="req-btn-editar-detalle" onClick={() => abrirEditar(verDetalle)}>
                      ✏️ Editar
                    </button>
                  )}
                  <button type="button" className="req-modal-close" onClick={() => setVerDetalle(null)}>✕</button>
                </div>
              </div>
              <div className="req-detalle-body">
                <DetalleReqContenido r={verDetalle} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal edición/nuevo */}
      {modal && (
        <div className="req-modal-overlay" onClick={e => e.target === e.currentTarget && cerrar()}>
          <div className="req-modal">
            <div className="req-modal-header">
              <h2>{modal === 'nuevo' ? 'Nuevo requerimiento' : `Editar requerimiento #${modal.id}`}</h2>
              <button className="req-modal-close" onClick={cerrar}>✕</button>
            </div>
            <div className="req-modal-body">
              <div className="req-grid-3">
                <label>
                  <span>N° Manual</span>
                  <input type="text" value={form.numero_req || ''} onChange={e => setF('numero_req', e.target.value)} placeholder="Ej: 2024-001" disabled={!puedeEditar} />
                </label>
                <label>
                  <span>Fecha</span>
                  <input type="date" value={form.fecha || ''} onChange={e => setF('fecha', e.target.value)} disabled={!puedeEditar} />
                </label>
                <label>
                  <span>Solicitante</span>
                  <input type="text" value={form.solicitante || ''} onChange={e => setF('solicitante', e.target.value)} placeholder="Dirección / UTP..." disabled={!puedeEditar} />
                </label>
              </div>
              <label className="req-full">
                <span>Contenido</span>
                <textarea rows={3} value={form.contenido || ''} onChange={e => setF('contenido', e.target.value)} placeholder="Descripción de lo solicitado..." disabled={!puedeEditar} />
              </label>
              <div className="req-grid-3">
                <label>
                  <span>Fondo</span>
                  <ComboField
                    value={form.fondo || ''}
                    onChange={v => setF('fondo', v)}
                    opciones={FONDOS}
                    placeholder="Seleccionar..."
                    disabled={!puedeEditar}
                  />
                </label>
                <label>
                  <span>Dimensión</span>
                  <ComboField
                    value={form.dimension || ''}
                    onChange={v => setF('dimension', v)}
                    opciones={DIMENSIONES}
                    placeholder="Seleccionar..."
                    disabled={!puedeEditar}
                  />
                </label>
                <label>
                  <span>Sub-Dimensión</span>
                  <ComboField
                    value={form.sub_dimension || ''}
                    onChange={v => setF('sub_dimension', v)}
                    opciones={SUB_DIMENSIONES}
                    placeholder="Seleccionar..."
                    disabled={!puedeEditar}
                  />
                </label>
              </div>
              <label className="req-full">
                <span>Acción</span>
                <ComboField
                  value={form.accion || ''}
                  onChange={v => setF('accion', v)}
                  opciones={ACCIONES}
                  placeholder="Seleccionar..."
                  disabled={!puedeEditar}
                />
              </label>
              <div className="req-grid-2">
                <label>
                  <span>Monto Solicitado ($)</span>
                  <input type="number" value={form.monto_solicitado || ''} onChange={e => setF('monto_solicitado', e.target.value)} placeholder="0" disabled={!puedeEditar} />
                </label>
                <label>
                  <span>Monto Real ($)</span>
                  <input type="number" value={form.monto_real || ''} onChange={e => setF('monto_real', e.target.value)} placeholder="0" disabled={!puedeEditar} />
                </label>
              </div>
              <div className="req-grid-2">
                <label>
                  <span>Estado</span>
                  <select value={form.estado || ''} onChange={e => setF('estado', e.target.value)} disabled={!puedeEditar}>
                    {ESTADOS.map(e => <option key={e}>{e}</option>)}
                  </select>
                </label>
                <label>
                  <span>Evidencia</span>
                  <select value={form.evidencia || ''} onChange={e => setF('evidencia', e.target.value)} disabled={!puedeEditar}>
                    <option value="">Seleccionar...</option>
                    {EVIDENCIAS.map(ev => <option key={ev}>{ev}</option>)}
                  </select>
                </label>
              </div>
              <div className="req-grid-2">
                <label>
                  <span>Fecha recepción</span>
                  <input type="date" value={form.fecha_recepcion || ''} onChange={e => setF('fecha_recepcion', e.target.value)} disabled={!puedeEditar} />
                </label>
                <label>
                  <span>Orden de Compra</span>
                  <input type="text" value={form.orden_compra || ''} onChange={e => setF('orden_compra', e.target.value)} disabled={!puedeEditar} />
                </label>
              </div>
              <div className="req-grid-2">
                <label>
                  <span>RUT Proveedor</span>
                  <input type="text" value={form.rut_proveedor || ''} onChange={e => setF('rut_proveedor', e.target.value)} placeholder="12.345.678-9" disabled={!puedeEditar} />
                </label>
                <label>
                  <span>N° Factura</span>
                  <input type="text" value={form.numero_factura || ''} onChange={e => setF('numero_factura', e.target.value)} disabled={!puedeEditar} />
                </label>
              </div>
              <label className="req-full">
                <span>Observación</span>
                <textarea rows={2} value={form.observacion || ''} onChange={e => setF('observacion', e.target.value)} disabled={!puedeEditar} />
                {(totalImagenes > 0 || puedeEditar) && (
                  <div className="req-obs-imgs">
                    {totalImagenes > 0 && (
                      <div className="req-imgs-grid">
                        {imagenesExistentes.map(url => (
                          <div key={url} className="req-img-thumb">
                            <a href={url} target="_blank" rel="noopener noreferrer">
                              <img src={url} alt="Adjunto" />
                            </a>
                            {puedeEditar && (
                              <button type="button" className="req-img-quitar" onClick={() => quitarImagenExistente(url)} aria-label="Quitar imagen">×</button>
                            )}
                          </div>
                        ))}
                        {imagenesNuevas.map((img, i) => (
                          <div key={img.preview} className="req-img-thumb req-img-thumb--nueva">
                            <img src={img.preview} alt="Nueva" />
                            {puedeEditar && (
                              <button type="button" className="req-img-quitar" onClick={() => quitarImagenNueva(i)} aria-label="Quitar imagen">×</button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {puedeEditar && totalImagenes < MAX_OBS_IMAGENES && (
                      <label className="req-img-add">
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          hidden
                          onChange={onSeleccionarImagenes}
                          disabled={guardando}
                        />
                        📷 Adjuntar imágenes ({totalImagenes}/{MAX_OBS_IMAGENES})
                      </label>
                    )}
                  </div>
                )}
              </label>
              {errorGuardar && <p className="req-error-guardar">{errorGuardar}</p>}
            </div>
            <div className="req-modal-footer">
              {puedeEliminar && modal !== 'nuevo' && (
                confirmarEliminar ? (
                  <div className="req-confirm-del">
                    <span>¿Eliminar este requerimiento?</span>
                    <button className="req-btn-del" onClick={eliminar}>Sí, eliminar</button>
                    <button className="req-btn-cancel" onClick={() => setConfirmarEliminar(false)}>Cancelar</button>
                  </div>
                ) : (
                  <button className="req-btn-del-ghost" onClick={() => setConfirmarEliminar(true)}>Eliminar</button>
                )
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button className="req-btn-cancel" onClick={cerrar}>Cancelar</button>
                {puedeEditar && (
                  <button className="req-btn-guardar" onClick={guardar} disabled={guardando || !form.contenido?.trim()}>
                    {guardando ? 'Guardando…' : 'Guardar'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal importar */}
      {modalImportar && (
        <ImportarReq
          onImportado={() => { cargar() }}
          onCerrar={() => setModalImportar(false)}
        />
      )}
    </motion.div>
  )
}