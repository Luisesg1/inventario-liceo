import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { supabase } from '../supabase'
import './Requerimientos.css'

const FONDOS = ['S.E.P.', 'P.I.E.', 'Sub. General', 'Mantenimiento', 'F.A.E.P.', 'Otro', 'Complementario TP', 'Aporte Municipal']
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
  'fecha', 'contenido', 'solicitante', 'fondo', 'dimension', 'sub_dimension', 'accion',
  'monto_solicitado', 'monto_real', 'estado', 'fecha_recepcion', 'orden_compra',
  'rut_proveedor', 'numero_factura', 'evidencia', 'observacion',
])
const ALIAS_IMPORT = {
  'n°_req.':         null,
  'n°_req':          null,
  'id':              null,
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
  'Comprado':                   { bg: '#dcfce7', color: '#16a34a' },
  'Contratado':                 { bg: '#dcfce7', color: '#16a34a' },
  'En ejecución':               { bg: '#dcfce7', color: '#16a34a' },
  'Enviado al DAEM':            { bg: '#dbeafe', color: '#1d4ed8' },
  'Reenviado':                  { bg: '#ede9fe', color: '#6d28d9' },
  'En proceso':                 { bg: '#fef9c3', color: '#854d0e' },
  'Revisión DAEM':              { bg: '#fef9c3', color: '#854d0e' },
  'En adquisiciones':           { bg: '#fef9c3', color: '#854d0e' },
  'A la espera de presupuesto': { bg: '#f3f4f6', color: '#6b7280' },
  'No comprado':                { bg: '#fee2e2', color: '#b91c1c' },
  'No contratado':              { bg: '#fee2e2', color: '#b91c1c' },
  'Rechazado por DAEM':         { bg: '#fee2e2', color: '#b91c1c' },
  'Rechazado por Liceo':        { bg: '#fee2e2', color: '#b91c1c' },
  'Devuelto':                   { bg: '#ffedd5', color: '#c2410c' },
}

const FORM_VACIO = {
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
  const st = ESTADO_STYLE[r.estado] || { bg: '#f3f4f6', color: '#6b7280' }
  return (
    <>
      <div className="req-detalle-grid-2">
        <div className="req-detalle-seccion">
          <p className="req-detalle-titulo">General</p>
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

// ════════════════════════════════════════════════════════════════════════════
export default function Requerimientos({ usuario }) {
  const esAdmin     = usuario.rol === 'admin'
  const puedeEditar = esAdmin || usuario.rol === 'editor' || usuario.rol === 'encargado'

  const [items,             setItems]             = useState([])
  const [cargando,          setCargando]          = useState(true)
  const [modal,             setModal]             = useState(false)
  const [verDetalle,        setVerDetalle]        = useState(null)
  const [form,              setForm]              = useState(FORM_VACIO)
  const [guardando,         setGuardando]         = useState(false)
  const [exportando,        setExportando]        = useState(false)
  const [modalImportar,     setModalImportar]     = useState(false)
  const [busqueda,          setBusqueda]          = useState('')
  const [filtroEstado,      setFiltroEstado]      = useState('')
  const [filtroFondo,       setFiltroFondo]       = useState('')
  const [filtroKpi,         setFiltroKpi]         = useState(null)
  const [confirmarEliminar, setConfirmarEliminar] = useState(false)
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
  }), [items, filtroEstado, filtroFondo, filtroKpi, busqueda])

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
    if (!window.confirm(`¿Eliminar el requerimiento #${r.id}?`)) return
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
    const conMonto = items.filter(r => Number(r.monto_solicitado) > 0)
    return {
      total:      items.length,
      enProceso:  items.filter(r => ['En proceso','Revisión DAEM','En adquisiciones','Enviado al DAEM','Reenviado'].includes(r.estado)).length,
      comprados:  items.filter(r => ['Comprado','Contratado','En ejecución'].includes(r.estado)).length,
      rechazados: items.filter(r => (r.estado ?? '').startsWith('Rechazado') || r.estado === 'Devuelto').length,
      montoTotal: conMonto.reduce((acc, r) => acc + Number(r.monto_solicitado), 0),
      conMonto:   conMonto.length,
    }
  }, [items])

  return (
    <div className="req-page">

      {/* KPIs */}
      <div className="req-kpis">
        <div
          className={`req-kpi req-kpi--clickable ${filtroKpi === null ? 'req-kpi--active' : ''}`}
          onClick={() => setFiltroKpi(null)}
        >
          <span className="req-kpi-num">{kpis.total}</span>
          <span className="req-kpi-label">Total</span>
        </div>
        <div
          className={`req-kpi req-kpi--proceso req-kpi--clickable ${filtroKpi === 'proceso' ? 'req-kpi--active' : ''}`}
          onClick={() => toggleKpi('proceso')}
        >
          <span className="req-kpi-num">{kpis.enProceso}</span>
          <span className="req-kpi-label">En proceso</span>
        </div>
        <div
          className={`req-kpi req-kpi--ok req-kpi--clickable ${filtroKpi === 'comprados' ? 'req-kpi--active' : ''}`}
          onClick={() => toggleKpi('comprados')}
        >
          <span className="req-kpi-num">{kpis.comprados}</span>
          <span className="req-kpi-label">Comprados</span>
        </div>
        <div
          className={`req-kpi req-kpi--mal req-kpi--clickable ${filtroKpi === 'rechazados' ? 'req-kpi--active' : ''}`}
          onClick={() => toggleKpi('rechazados')}
        >
          <span className="req-kpi-num">{kpis.rechazados}</span>
          <span className="req-kpi-label">Rechazados</span>
        </div>
        <div
          className="req-kpi req-kpi--monto req-kpi--resumen"
          title="Suma de todos los montos solicitados registrados (no filtra la tabla)"
        >
          <span className="req-kpi-num req-kpi-num--monto">{formatMontoKpi(kpis.montoTotal)}</span>
          <span className="req-kpi-label">Monto solicitado (total)</span>
          <span className="req-kpi-hint">{kpis.conMonto} con monto · {kpis.total - kpis.conMonto} sin monto</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="req-toolbar">
        <input
          className="req-search"
          placeholder="Buscar por contenido, solicitante, acción..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
        <select className="req-filter" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {ESTADOS.map(e => <option key={e}>{e}</option>)}
        </select>
        <select className="req-filter" value={filtroFondo} onChange={e => setFiltroFondo(e.target.value)}>
          <option value="">Todos los fondos</option>
          {FONDOS.map(f => <option key={f}>{f}</option>)}
        </select>
        {puedeEditar && (
          <button className="req-btn-tool" onClick={() => setModalImportar(true)}>
            ⬆ Importar
          </button>
        )}
        <button className="req-btn-tool" onClick={handleExportar} disabled={exportando}>
          {exportando ? 'Exportando…' : '⬇ Exportar'}
        </button>
        {puedeEditar && (
          <button className="req-btn-nuevo" onClick={abrirNuevo}>+ Nuevo</button>
        )}
      </div>

      {/* Tabla */}
      {cargando ? (
        <div className="req-empty">Cargando...</div>
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
              {filtrados.map(r => {
                const st = ESTADO_STYLE[r.estado] || { bg: '#f3f4f6', color: '#6b7280' }
                return (
                  <tr key={r.id} className="req-row">
                    <td className="req-num">#{r.id}</td>
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
                        {esAdmin && (
                          <button type="button" className="btn-del" onClick={() => eliminarDesdeTabla(r)} title="Eliminar">✕</button>
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
              <div className="req-grid-2">
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
              {puedeEditar && modal !== 'nuevo' && esAdmin && (
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
    </div>
  )
}
