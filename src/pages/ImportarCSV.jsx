import { useState, useRef, useCallback } from 'react'
import { supabase } from '../supabase'

// ── Columnas que existen en la tabla bienes ──────────────────────────────
const COLUMNAS_BD = new Set([
  'nombre', 'categoria', 'codigo', 'cantidad', 'estado',
  'ubicacion', 'responsable', 'obs',
  'tipo', 'marca', 'numero_serie', 'modelo', 'pantalla',
  'cpu', 'ram', 'ram_tipo', 'ram_slots',
  'memoria', 'tipo_almacenamiento', 'sistema_operativo',
  'licencia_windows', 'win_version', 'win_proveedor', 'win_factura', 'win_fecha_factura', 'win_orden',
  'licencia_office', 'off_version', 'off_proveedor', 'off_factura', 'off_fecha_factura', 'off_orden',
  'fecha_adquisicion', 'proveedor', 'numero_factura', 'numero_orden', 'fondo', 'garantia',
  'tecnologia', 'consumible',
])

// Alias: columna del archivo → columna BD
const ALIAS = {
  ubicación: 'ubicacion',
  'ubicacion': 'ubicacion',
  'n_serie': 'numero_serie',
  'nro_serie': 'numero_serie',
  'serial': 'numero_serie',
  'n°_de_serie': 'numero_serie',
  'n°_serie': 'numero_serie',
  'n_de_serie': 'numero_serie',
  'so': 'sistema_operativo',
  'os': 'sistema_operativo',
  'almacenamiento': 'memoria',
  'storage': 'memoria',
  'hdd': 'memoria',
  'ssd': 'memoria',
  'procesador': 'cpu',
  'processor': 'cpu',
  'observacion': 'obs',
  'observaciones': 'obs',
  'notas': 'obs',
  // Artículos tecnológicos
  'tecnología': 'tecnologia',
  'nº_factura': 'numero_factura',
  'n°_factura': 'numero_factura',
  'nro_factura': 'numero_factura',
  'factura': 'numero_factura',
  'fecha_factura': 'fecha_adquisicion',
  'orden_de_compra': 'numero_orden',
  'orden_compra': 'numero_orden',
  'nro_orden': 'numero_orden',
  // Personas / responsable
  'usuario': 'responsable',
  'user': 'responsable',
  'encargado': 'responsable',
  'asignado_a': 'responsable',
}

const CATEGORIAS_COMP = new Set(['computadores', 'computador', 'computadoras', 'all in one', 'all-in-one', 'aio', 'laptop', 'desktop', 'notebook', 'pc'])

const esComp = (cat) => cat === 'computadores'

// ── Normalizar un valor de celda ──────────────────────────────────────────
const normalizar = (val) => {
  if (val === null || val === undefined) return ''
  const s = String(val).trim()
  if (s === 'NaN' || s === 'nan' || s === 'undefined') return ''
  // Normalizar variantes de N/A a un formato uniforme
  if (['n/a', 'n / a', 'n/ a', 'n /a'].includes(s.toLowerCase())) return 'N/A'
  return s
}

// ── Convertir número serial de Excel a fecha ISO (YYYY-MM-DD) ───────────
const excelSerialAFecha = (val) => {
  if (!val && val !== 0) return null
  const n = typeof val === 'number' ? val : Number(val)
  if (isNaN(n) || n <= 0) return null
  // Excel epoch: 1 enero 1900, pero tiene el bug del año bisiesto 1900
  const fecha = new Date(Date.UTC(1899, 11, 30) + n * 86400000)
  if (isNaN(fecha.getTime())) return null
  return fecha.toISOString().slice(0, 10) // YYYY-MM-DD
}

const normalizarFecha = (val) => {
  if (!val && val !== 0) return null
  const s = String(val).trim()
  if (!s || s === '' || s === 'NaN') return null
  // Valores que significan "sin dato" → null
  const sinDato = ['n/a', 'n / a', 'na', '-', '—', 's/i', 'sin dato', 'no aplica', 'none', 'null']
  if (sinDato.includes(s.toLowerCase())) return null
  // Si es número puro → serial de Excel
  if (/^\d+(\.\d+)?$/.test(s)) return excelSerialAFecha(Number(s))
  // Si ya tiene formato fecha reconocible, devolverlo tal cual
  return s
}

// ── Parsear CSV puro (sin dependencias) ──────────────────────────────────
const parseCSV = (text) => {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase())
  return lines.slice(1).map(line => {
    // Manejo básico de campos con comillas
    const cols = []
    let cur = '', inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
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

// ── Mapear fila cruda al schema de bienes ────────────────────────────────
const mapearFila = (fila, categoriasFijas) => {
  const mapped = {}
  for (const [key, val] of Object.entries(fila)) {
    const colNorm = key.toLowerCase().trim().replace(/\s+/g, '_')
    const colBD = ALIAS[colNorm] ?? (COLUMNAS_BD.has(colNorm) ? colNorm : null)
    if (colBD) mapped[colBD] = normalizar(val)
  }

  // Categoría: normalizar a id válido
  let cat = normalizar(mapped.categoria || fila.categoria || '').toLowerCase().trim()
  if (!cat || cat === 'nan') cat = 'otros'

  // Verificar si la categoría existe en las fijas o es alias de computadores
  const catFija = categoriasFijas.find(c => c.id === cat || c.label?.toLowerCase() === cat)
  if (catFija) {
    mapped.categoria = catFija.id
  } else if (CATEGORIAS_COMP.has(cat)) {
    mapped.categoria = 'computadores'
    if (!mapped.tipo) mapped.tipo = cat !== 'computadores' ? cat : 'Desktop'
  } else {
    mapped._catDesconocida = cat // para mostrar aviso
    mapped.categoria = cat
  }

  // Nombre: generar automáticamente según tipo de categoría
  const _catLabel = (categoriasFijas.find(c => c.id === mapped.categoria)?.label ?? mapped.categoria ?? '')
    .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const _esTecno = _catLabel.includes('tecnol')

  if (esComp(mapped.categoria)) {
    if (!mapped.nombre || mapped.nombre === 'nan') {
      mapped.nombre = [mapped.marca, mapped.modelo].filter(Boolean).join(' ') || 'Computador'
    }
  } else if (_esTecno) {
    if (!mapped.nombre || mapped.nombre === 'nan') {
      mapped.nombre = [mapped.tipo, mapped.marca, mapped.modelo].filter(Boolean).join(' ') || 'Artículo tecnológico'
    }
  }

  // Limpiar campos no válidos para BD
  delete mapped._catDesconocida
  return { data: mapped, catDesconocida: fila._catDesconocida }
}

// ── Leer XLSX con SheetJS (si está disponible) via script dinámico ───────
const leerXLSX = (file) => new Promise((resolve, reject) => {
  const existingScript = document.getElementById('sheetjs-script')
  const cargar = () => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const wb = window.XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const json = window.XLSX.utils.sheet_to_json(ws, { defval: '' })
        // Normalizar headers a lowercase
        const normalizado = json.map(row => {
          const n = {}
          for (const [k, v] of Object.entries(row)) n[k.toLowerCase().trim().replace(/\s+/g, '_')] = v
          return n
        })
        resolve(normalizado)
      } catch (err) { reject(err) }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  }

  if (window.XLSX) { cargar(); return }
  if (existingScript) { existingScript.addEventListener('load', cargar); return }

  const script = document.createElement('script')
  script.id = 'sheetjs-script'
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
  script.onload = cargar
  script.onerror = () => reject(new Error('No se pudo cargar SheetJS'))
  document.head.appendChild(script)
})

// ════════════════════════════════════════════════════════════════════════════
export default function ImportarCSV({ categorias, bienesExistentes, onImportado }) {
  const [fase, setFase]             = useState('idle') // idle | preview | importando | resultado
  const [filas, setFilas]           = useState([])
  const [errParse, setErrParse]     = useState(null)
  const [dragging, setDragging]     = useState(false)
  const [fileName, setFileName]     = useState('')
  const [resultado, setResultado]   = useState(null)
  const [catsPendientes, setCatsPendientes] = useState([]) // categorías nuevas detectadas
  const [mapCats, setMapCats]       = useState({})        // { catDesconocida: 'computadores' | 'crear' | 'otros' }
  const [duplicados, setDuplicados] = useState('omitir')  // 'omitir' | 'sobreescribir'
  const [catGlobal, setCatGlobal]   = useState('')        // categoría por defecto cuando no hay columna categoria
  const [tieneCatCol, setTieneCatCol] = useState(false)   // si el Excel tenía columna "categoria"
  const inputRef = useRef()

  const resetear = () => {
    setFase('idle'); setFilas([]); setErrParse(null)
    setFileName(''); setResultado(null); setCatsPendientes([]); setMapCats({})
    setCatGlobal(''); setTieneCatCol(false)
  }

  // ── Procesar archivo ───────────────────────────────────────────────────
  const procesarArchivo = async (file) => {
    setErrParse(null)
    setFileName(file.name)
    try {
      let rows
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        rows = await leerXLSX(file)
      } else {
        const text = await file.text()
        rows = parseCSV(text)
      }

      if (!rows.length) { setErrParse('El archivo está vacío o no tiene filas de datos.'); return }

      // Detectar si el archivo tiene columna "categoria"
      const primeraFila = rows[0] ? Object.keys(rows[0]).map(k => k.toLowerCase().trim()) : []
      const hayColCat = primeraFila.some(k => k === 'categoria' || k === 'categoría' || k === 'category')
      setTieneCatCol(hayColCat)

      // Mapear filas y detectar categorías desconocidas
      const catSet = new Set()
      const filasMapeadas = rows.map(row => {
        // Normalizar keys
        const normRow = {}
        for (const [k, v] of Object.entries(row)) normRow[k.toLowerCase().trim().replace(/\s+/g, '_')] = v

        let cat = hayColCat ? normalizar(normRow.categoria || '').toLowerCase().trim() : ''
        if (!cat || cat === 'nan') cat = ''

        const catFija = cat ? categorias.find(c => c.id === cat || c.label?.toLowerCase() === cat) : null
        const esCompAlias = cat ? CATEGORIAS_COMP.has(cat) : false

        if (cat && !catFija && !esCompAlias) catSet.add(cat)
        normRow._catOriginal = cat
        return normRow
      })

      // Preguntar por categorías desconocidas
      const pendientes = [...catSet]
      setCatsPendientes(pendientes)
      const mapInicial = {}
      pendientes.forEach(c => { mapInicial[c] = categorias[0]?.id || 'otros' })
      setMapCats(mapInicial)
      // Categoría global por defecto: primera categoría disponible
      setCatGlobal(categorias[0]?.id || 'otros')
      setFilas(filasMapeadas)
      setFase('preview')
    } catch (err) {
      setErrParse('Error al leer el archivo: ' + err.message)
    }
  }

  // ── Drag & Drop ────────────────────────────────────────────────────────
  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) procesarArchivo(file)
  }, [categorias])

  const onDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const onDragLeave = () => setDragging(false)

  // ── Resolver categoría de una fila ────────────────────────────────────
  const resolverCategoria = (catOriginal) => {
    if (!catOriginal) return catGlobal || categorias[0]?.id || 'otros'
    const catFija = categorias.find(c => c.id === catOriginal || c.label?.toLowerCase() === catOriginal)
    if (catFija) return catFija.id
    if (CATEGORIAS_COMP.has(catOriginal)) return 'computadores'
    return mapCats[catOriginal] || catGlobal || 'otros'
  }

  // ── Construir payload final ────────────────────────────────────────────
  const construirPayload = (row, codigosUsados) => {
    const cat = resolverCategoria(row._catOriginal)
    const payload = {}

    for (const [key, val] of Object.entries(row)) {
      if (key.startsWith('_')) continue
      const colNorm = key.toLowerCase().trim().replace(/\s+/g, '_')
      const colBD = ALIAS[colNorm] ?? (COLUMNAS_BD.has(colNorm) ? colNorm : null)
      if (colBD) payload[colBD] = colBD === 'nombre' ? normalizar(val) : (normalizar(val) || null)
    }

    payload.categoria = cat

    const _catLabel2 = (categorias.find(c => c.id === cat)?.label ?? cat ?? '')
      .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    const _esTecno2 = _catLabel2.includes('tecnol')

    if (esComp(cat)) {
      if (!payload.nombre || payload.nombre === 'nan') {
        payload.nombre = [payload.marca, payload.modelo].filter(Boolean).join(' ') || 'Computador'
      }
      if (!payload.tipo) payload.tipo = 'Desktop'
    } else if (_esTecno2) {
      if (!payload.nombre || payload.nombre === 'nan') {
        payload.nombre = [payload.tipo, payload.marca, payload.modelo].filter(Boolean).join(' ') || 'Artículo tecnológico'
      }
    }

    // nombre nunca puede ser null — fallback para cualquier categoría
    if (!payload.nombre) payload.nombre = 'Sin nombre'

    // Limpiar nulls innecesarios y convertir tipos
    if (payload.cantidad) payload.cantidad = parseInt(payload.cantidad) || 1
    // win_version y licencia_windows vienen invertidas en el Excel — corregir
    if (payload.win_version !== undefined || payload.licencia_windows !== undefined) {
      const tmp = payload.win_version
      payload.win_version = payload.licencia_windows
      payload.licencia_windows = tmp
    }
    // Si win_version sigue vacío, usar sistema_operativo
    const sinDatoVal = (v) => !v || ['n/a','n / a','na','-','—'].includes(String(v).trim().toLowerCase())
    if (sinDatoVal(payload.win_version) && payload.sistema_operativo) {
      payload.win_version = payload.sistema_operativo
    }
    // Normalizar abreviaciones de Windows a nombre completo
    const normWin = (v) => {
      if (!v) return v
      return v
        .replace(/^Win\.\s*10\s*Home$/i, 'Windows 10 Home')
        .replace(/^Win\.\s*10\s*Pro$/i, 'Windows 10 Pro')
        .replace(/^Win\.\s*11\s*Home$/i, 'Windows 11 Home')
        .replace(/^Win\.\s*11\s*Pro$/i, 'Windows 11 Pro')
    }
    if (payload.win_version) payload.win_version = normWin(payload.win_version)
    if (payload.sistema_operativo) payload.sistema_operativo = normWin(payload.sistema_operativo)

    payload.fecha_adquisicion = normalizarFecha(payload.fecha_adquisicion)
    payload.win_fecha_factura = normalizarFecha(payload.win_fecha_factura)
    payload.off_fecha_factura = normalizarFecha(payload.off_fecha_factura)

    // Generar código único si falta, usando el set compartido entre filas
    if (!payload.codigo) {
      let num = codigosUsados.size + 1
      let codigo = `INV-${String(num).padStart(4, '0')}`
      while (codigosUsados.has(codigo)) { num++; codigo = `INV-${String(num).padStart(4, '0')}` }
      payload.codigo = codigo
    }

    // Registrar el código para que las siguientes filas no lo repitan
    codigosUsados.add(payload.codigo)

    return payload
  }

  // ── Ejecutar importación ───────────────────────────────────────────────
  const importar = async () => {
    setFase('importando')
    // codigosEnBD: códigos que YA existen en Supabase (para detectar duplicados reales)
    const codigosEnBD = new Set(bienesExistentes.map(b => b.codigo))
    // codigosUsados: todos los códigos (BD + generados en esta sesión) para evitar repetir al auto-generar
    const codigosUsados = new Set(codigosEnBD)
    let importados = 0, omitidos = 0, errores = []
    const nuevos = []

    for (const row of filas) {
      const payload = construirPayload(row, codigosUsados)

      if (codigosEnBD.has(payload.codigo)) {
        if (duplicados === 'omitir') { omitidos++; continue }
        // sobreescribir
        const { error } = await supabase.from('bienes').update(payload).eq('codigo', payload.codigo)
        if (error) { errores.push(`${payload.codigo}: ${error.message}`) }
        else { importados++; codigosEnBD.add(payload.codigo) }
      } else {
        const { data, error } = await supabase.from('bienes').insert(payload).select().single()
        if (error) { errores.push(`${payload.codigo}: ${error.message}`) }
        else { importados++; codigosEnBD.add(payload.codigo); nuevos.push(data) }
      }
    }

    setResultado({ importados, omitidos, errores, total: filas.length })
    setFase('resultado')
    if (importados > 0) onImportado()
  }

  // ── Vista previa filas ─────────────────────────────────────────────────
  const filasPreview = filas.slice(0, 8)
  const codigosExistentes = new Set(bienesExistentes.map(b => b.codigo))

  // ════════════════════════════════════════════════════════════════════════
  return (
    <div className="importar-wrap">

      {/* ── IDLE: zona de carga ── */}
      {fase === 'idle' && (
        <div
          className={`drop-zone ${dragging ? 'dragging' : ''}`}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            style={{ display: 'none' }}
            onChange={e => { if (e.target.files[0]) procesarArchivo(e.target.files[0]) }}
          />
          <div className="drop-icon">📂</div>
          <p className="drop-title">Arrastra tu archivo aquí</p>
          <p className="drop-sub">o haz clic para seleccionar</p>
          <p className="drop-formats">Formatos aceptados: .csv · .xlsx · .xls</p>
          {errParse && <p className="drop-error">⚠️ {errParse}</p>}
        </div>
      )}

      {/* ── PREVIEW ── */}
      {fase === 'preview' && (
        <div className="preview-panel">
          <div className="preview-header">
            <span className="preview-title">📋 Vista previa — <strong>{fileName}</strong></span>
            <span className="preview-count">{filas.length} fila{filas.length !== 1 ? 's' : ''} detectadas</span>
          </div>

          {/* Categorías desconocidas */}
          {catsPendientes.length > 0 && (
            <div className="cats-aviso">
              <p className="cats-aviso-title">⚠️ Categorías no reconocidas — ¿cómo importarlas?</p>
              {catsPendientes.map(cat => (
                <div key={cat} className="cat-map-row">
                  <span className="cat-map-orig">«{cat}»</span>
                  <span className="cat-map-arrow">→</span>
                  <select
                    value={mapCats[cat] || 'computadores'}
                    onChange={e => setMapCats(p => ({ ...p, [cat]: e.target.value }))}
                    className="cat-map-select"
                  >
                    {categorias.map(c => (
                      <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}

          {/* Selector de categoría global (cuando el archivo no tiene columna categoria) */}
          {!tieneCatCol && (
            <div className="cat-global-row">
              <span className="dup-label">📂 Categoría de destino:</span>
              <select
                value={catGlobal}
                onChange={e => setCatGlobal(e.target.value)}
                className="cat-map-select"
                style={{ fontWeight: 600 }}
              >
                {categorias.map(c => (
                  <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Opciones duplicados */}
          <div className="dup-row">
            <span className="dup-label">Si el código ya existe:</span>
            <label className={`dup-opt ${duplicados === 'omitir' ? 'active' : ''}`}>
              <input type="radio" name="dup" value="omitir" checked={duplicados === 'omitir'} onChange={() => setDuplicados('omitir')} />
              Omitir fila
            </label>
            <label className={`dup-opt ${duplicados === 'sobreescribir' ? 'active' : ''}`}>
              <input type="radio" name="dup" value="sobreescribir" checked={duplicados === 'sobreescribir'} onChange={() => setDuplicados('sobreescribir')} />
              Sobreescribir
            </label>
          </div>

          {/* Tabla preview */}
          <div className="preview-table-wrap">
            <table className="preview-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Código</th>
                  <th>Categoría (resultado)</th>
                  <th>Marca / Modelo</th>
                  <th>N° Serie</th>
                  <th>Estado</th>
                  <th>Duplicado</th>
                </tr>
              </thead>
              <tbody>
                {filasPreview.map((row, i) => {
                  const cat = resolverCategoria(row._catOriginal)
                  const catLabel = categorias.find(c => c.id === cat)?.label ?? cat
                  const codigo = normalizar(row.codigo) || `INV-auto`
                  const esDup = codigosExistentes.has(codigo)
                  return (
                    <tr key={i} className={esDup ? 'fila-dup' : ''}>
                      <td className="td-num">{i + 1}</td>
                      <td className="td-code">{codigo || <em className="td-muted">auto</em>}</td>
                      <td>{catLabel}</td>
                      <td>{[normalizar(row.marca), normalizar(row.modelo)].filter(Boolean).join(' ') || normalizar(row.nombre) || '—'}</td>
                      <td className="td-muted">{normalizar(row.numero_serie) || '—'}</td>
                      <td>{normalizar(row.estado) || 'Bueno'}</td>
                      <td>{esDup ? <span className="badge-dup">{duplicados === 'omitir' ? 'se omitirá' : 'sobreescribirá'}</span> : <span className="badge-nuevo">nuevo</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filas.length > 8 && (
              <p className="preview-mas">… y {filas.length - 8} fila{filas.length - 8 !== 1 ? 's' : ''} más</p>
            )}
          </div>

          <div className="preview-actions">
            <button className="btn-cancel" onClick={resetear}>← Cancelar</button>
            <button className="btn-primary" onClick={importar}>
              ✅ Importar {filas.length} registro{filas.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}

      {/* ── IMPORTANDO ── */}
      {fase === 'importando' && (
        <div className="importando-panel">
          <div className="spinner"></div>
          <p>Importando registros a Supabase…</p>
        </div>
      )}

      {/* ── RESULTADO ── */}
      {fase === 'resultado' && resultado && (
        <div className="resultado-panel">
          <div className="resultado-icon">{resultado.errores.length === 0 ? '🎉' : '⚠️'}</div>
          <p className="resultado-title">Importación completada</p>
          <div className="resultado-stats">
            <div className="stat-item stat-ok">
              <span className="stat-num">{resultado.importados}</span>
              <span className="stat-lbl">importados</span>
            </div>
            <div className="stat-item stat-skip">
              <span className="stat-num">{resultado.omitidos}</span>
              <span className="stat-lbl">omitidos</span>
            </div>
            <div className="stat-item stat-err">
              <span className="stat-num">{resultado.errores.length}</span>
              <span className="stat-lbl">errores</span>
            </div>
          </div>
          {resultado.errores.length > 0 && (
            <div className="errores-lista">
              <p className="errores-titulo">Errores:</p>
              {resultado.errores.map((e, i) => <p key={i} className="error-item">• {e}</p>)}
            </div>
          )}
          <button className="btn-primary" style={{ marginTop: '1.5rem' }} onClick={resetear}>
            Importar otro archivo
          </button>
        </div>
      )}
    </div>
  )
}