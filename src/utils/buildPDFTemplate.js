/**
 * InventoryPDFTemplate
 * Genera el HTML completo del PDF de ficha de inventario.
 * Layout 100% con estilos inline y tablas de ancho fijo.
 * No depende del viewport ni de media queries.
 * Seguro para cualquier dispositivo (móvil, tablet, PC).
 */

const ESTADO_COLORS = {
  Bueno:   { bg: '#dcfce7', color: '#166534' },
  Regular: { bg: '#fef9c3', color: '#854d0e' },
  Malo:    { bg: '#fee2e2', color: '#991b1b' },
  Baja:    { bg: '#f3f4f6', color: '#6b7280' },
}

// ── Estilos base ────────────────────────────────────────────────────────────
const S = {
  root: [
    'width:710px',
    'box-sizing:border-box',
    'font-family:Arial,Helvetica,sans-serif',
    'font-size:11px',
    'color:#1a1a2e',
    'padding:20px 24px',
    'background:#ffffff',
    'overflow:visible',
  ].join(';'),

  sec: [
    'background:#f8fafc',
    'border:1px solid #e2e8f0',
    'border-radius:8px',
    'padding:12px 14px',
    'margin-bottom:10px',
    'break-inside:avoid',
    'page-break-inside:avoid',
    'overflow:hidden',
    'box-sizing:border-box',
    'width:100%',
    'max-width:100%',
  ].join(';'),

  secTitle: [
    'font-size:9px',
    'font-weight:800',
    'color:#475569',
    'text-transform:uppercase',
    'letter-spacing:.08em',
    'margin:0 0 8px 0',
    'padding:0',
  ].join(';'),

  label: [
    'font-size:9px',
    'font-weight:700',
    'color:#94a3b8',
    'text-transform:uppercase',
    'letter-spacing:.06em',
    'word-break:normal',
    'overflow-wrap:normal',
    'white-space:nowrap',
  ].join(';'),

  value: [
    'font-size:12px',
    'font-weight:600',
    'color:#0f172a',
    'word-break:normal',
    'overflow-wrap:break-word',
    'max-width:100%',
  ].join(';'),

  valueSmall: [
    'font-size:11px',
    'font-weight:600',
    'color:#0f172a',
    'word-break:normal',
    'overflow-wrap:break-word',
    'max-width:100%',
  ].join(';'),

  valueKey: [
    'font-size:10px',
    'font-weight:600',
    'color:#0f172a',
    'word-break:break-all',
    'overflow-wrap:anywhere',
    'font-family:monospace',
    'max-width:100%',
  ].join(';'),
}

// ── Helpers de escape y construcción ────────────────────────────────────────

function esc(v) {
  if (v == null) return ''
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function secTitle(text) {
  return `<p style="${S.secTitle}">${text}</p>`
}

/**
 * Fila horizontal label → valor (dentro de una tabla de 1 col).
 */
function fila(label, val, isKey = false) {
  const vStyle = isKey ? S.valueKey : S.value
  return `
    <tr>
      <td style="${S.label};width:38%;vertical-align:top;padding:3px 8px 3px 0;border-bottom:1px solid #f1f5f9;">${esc(label)}</td>
      <td style="${vStyle};vertical-align:top;padding:3px 0;border-bottom:1px solid #f1f5f9;text-align:right;">${esc(val) || '—'}</td>
    </tr>`
}

function filaTable(rowsHtml) {
  return `<table style="width:100%;table-layout:fixed;border-collapse:collapse;">${rowsHtml}</table>`
}

/**
 * Celda de campo en grid de 3 columnas.
 */
function campo3(label, val, isKey = false) {
  const vStyle = isKey ? S.valueKey : S.valueSmall
  return `
    <td style="width:33.33%;vertical-align:top;padding:4px 10px 4px 0;box-sizing:border-box;overflow:hidden;max-width:0;">
      <div style="${S.label};margin-bottom:2px;">${esc(label)}</div>
      <div style="${vStyle}">${esc(val) || '—'}</div>
    </td>`
}

/**
 * Tabla de 3 columnas a partir de pares [label, val].
 * Agrupa de a 3 por fila.
 */
function grid3(pairs) {
  if (!pairs.length) return ''
  let rows = ''
  for (let i = 0; i < pairs.length; i += 3) {
    const group = pairs.slice(i, i + 3)
    while (group.length < 3) group.push(['', ''])
    rows += `<tr>${group.map(([l, v, isKey]) => campo3(l, v, isKey)).join('')}</tr>`
  }
  return `<table style="width:100%;table-layout:fixed;border-collapse:collapse;">${rows}</table>`
}

function grid3f(pairs) {
  return grid3(pairs.filter(([, v]) => v))
}

/**
 * Dos secciones HTML lado a lado en tabla 50/50.
 * Usa padding lateral en celdas para crear la separación visual.
 */
function twoCols(leftHtml, rightHtml) {
  return `
  <table style="width:100%;table-layout:fixed;border-collapse:collapse;margin-bottom:10px;">
    <tr>
      <td style="width:50%;vertical-align:top;padding-right:5px;">${leftHtml}</td>
      <td style="width:50%;vertical-align:top;padding-left:5px;">${rightHtml}</td>
    </tr>
  </table>`
}

// ── Secciones ────────────────────────────────────────────────────────────────

function secFilas(title, rowsHtml) {
  return `<div style="${S.sec}">${secTitle(title)}${filaTable(rowsHtml)}</div>`
}

function secGrid3(title, pairs, filter = false) {
  const data = filter ? pairs.filter(([, v]) => v) : pairs
  if (!data.length) return ''
  return `<div style="${S.sec}">${secTitle(title)}${grid3(data)}</div>`
}

// ── Función principal ─────────────────────────────────────────────────────────

export function buildPDFHTML(bien, categorias) {
  const cat    = bien.categoria
  const catObj = categorias.find(c => c.id === cat)
  const catLabel = catObj?.label ?? cat
  const catIcon  = catObj?.icon  ?? '📦'

  const _norm = s => (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const isComp      = cat === 'computadores'
  const isTecno     = !isComp && _norm(catObj?.label ?? cat).includes('tecnol')
  const isBiblioteca = _norm(catObj?.label ?? cat).includes('biblio') || _norm(catObj?.label ?? cat).includes('libro')

  const ec = ESTADO_COLORS[bien.estado] || { bg: '#e0e7ff', color: '#3730a3' }

  // Campos adicionales
  const camposCat = catObj?.campos_personalizados ?? []
  const extra     = bien.campos_extra || {}
  const _ord      = catObj?.campos_orden ?? []
  const _sorted   = _ord.length
    ? [...camposCat].sort((a, b) => {
        const ia = _ord.indexOf(a.id), ib = _ord.indexOf(b.id)
        if (ia === -1 && ib === -1) return 0
        if (ia === -1) return 1; if (ib === -1) return -1
        return ia - ib
      })
    : camposCat
  const conValor = _sorted.filter(c => extra[c.id] !== undefined && extra[c.id] !== '')

  const adqFields = [
    ['Fecha adquisición', bien.fecha_adquisicion],
    ['Proveedor',         bien.proveedor],
    ['N° Factura',        bien.numero_factura],
    ['N° Orden',          bien.numero_orden],
    ['Fondo',             bien.fondo],
    ['Garantía',          bien.garantia],
  ]

  // ── Construcción ──────────────────────────────────────────────────────────

  let html = `<div style="${S.root}">`

  // DEV: descomenta la siguiente línea para ver el contorno del PDF
  // html = `<div style="${S.root};border:2px solid red;">`

  // ── Franja institucional ──────────────────────────────────────────────────
  html += `
  <div style="background:#1e3a8a;color:#fff;padding:8px 16px;border-radius:8px 8px 0 0;box-sizing:border-box;width:100%;">
    <span style="font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;opacity:.9;">
      Liceo JHJ — Inventario Institucional
    </span>
  </div>`

  // ── Header del bien ───────────────────────────────────────────────────────
  html += `
  <table style="width:100%;table-layout:fixed;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;margin-bottom:14px;">
    <tr>
      <td style="width:36px;padding:10px 8px 10px 14px;vertical-align:middle;font-size:1.4rem;">${catIcon}</td>
      <td style="padding:10px 8px;vertical-align:middle;overflow:hidden;">
        <div style="font-weight:700;font-size:14px;color:#0f172a;word-break:normal;overflow-wrap:break-word;">${esc(bien.nombre)}</div>
        <div style="font-size:10px;color:#64748b;margin-top:2px;">${esc(bien.codigo)} · ${esc(catLabel)}</div>
      </td>
      <td style="width:96px;padding:10px 14px 10px 0;text-align:right;vertical-align:middle;">
        <span style="display:inline-block;background:${ec.bg};color:${ec.color};padding:4px 10px;border-radius:20px;font-size:10px;font-weight:700;white-space:nowrap;">${esc(bien.estado)}</span>
      </td>
    </tr>
  </table>`

  // ── Identificación + Asignación ───────────────────────────────────────────
  let identRows = [
    fila('Código Interno', bien.codigo_interno || 'N/A'),
    fila('Código', bien.codigo),
    fila('Categoría', catLabel),
    ...(!isComp ? [fila('Cantidad', bien.cantidad)] : []),
  ].join('')

  let asignRows = ''
  if (isComp || isTecno) asignRows += fila('Área', bien.area || '—')
  asignRows += fila('Ubicación', bien.ubicacion || 'N/A') + fila('Responsable', bien.responsable || 'N/A')

  html += twoCols(
    `<div style="${S.sec};margin-bottom:0;">${secTitle('Identificación')}${filaTable(identRows)}</div>`,
    `<div style="${S.sec};margin-bottom:0;">${secTitle('Asignación')}${filaTable(asignRows)}</div>`,
  )

  // ── Descripción ───────────────────────────────────────────────────────────
  if (bien.descripcion)
    html += `<div style="${S.sec}">
      ${secTitle('Descripción')}
      <p style="margin:4px 0 0;font-size:11px;color:#334155;word-break:normal;overflow-wrap:break-word;">${esc(bien.descripcion)}</p>
    </div>`

  // ── Observaciones ─────────────────────────────────────────────────────────
  if (bien.obs)
    html += `<div style="${S.sec}">
      ${secTitle('Observaciones')}
      <p style="margin:4px 0 0;font-size:11px;color:#334155;word-break:normal;overflow-wrap:break-word;">${esc(bien.obs)}</p>
    </div>`

  // ── Campos adicionales ────────────────────────────────────────────────────
  if (conValor.length)
    html += `<div style="${S.sec}">
      ${secTitle('✨ Campos adicionales')}
      ${grid3(conValor.map(c => [
        c.nombre,
        c.tipo === 'booleano' ? (extra[c.id] === 'si' ? 'Sí' : 'No') : extra[c.id],
      ]))}
    </div>`

  // ── Secciones por tipo ────────────────────────────────────────────────────
  if (isComp) {
    html += secGrid3('Hardware', [
      ['Tipo', bien.tipo], ['Marca', bien.marca], ['Modelo', bien.modelo],
      ['Pantalla', bien.pantalla], ['N° Serie', bien.numero_serie], ['CPU', bien.cpu],
      ['RAM', [bien.ram, bien.ram_tipo, bien.ram_slots ? bien.ram_slots + ' slot(s)' : ''].filter(Boolean).join(' · ')],
      ['Almacenamiento', bien.tipo_almacenamiento
        ? (bien.tipo_almacenamiento + ' ' + (bien.memoria || '')).trim()
        : bien.memoria],
      ['Sistema operativo', bien.sistema_operativo],
    ], true)

    const winRows = [
      fila('Clave', bien.licencia_windows, true),
      fila('Versión', bien.win_version),
      fila('Proveedor', bien.win_proveedor),
      fila('N° Factura', bien.win_factura),
      fila('Fecha factura', bien.win_fecha_factura),
      fila('N° Orden', bien.win_orden),
    ].join('')
    const offRows = [
      fila('Clave', bien.licencia_office, true),
      fila('Versión', bien.off_version),
      fila('Proveedor', bien.off_proveedor),
      fila('N° Factura', bien.off_factura),
      fila('Fecha factura', bien.off_fecha_factura),
      fila('N° Orden', bien.off_orden),
    ].join('')
    html += twoCols(
      `<div style="${S.sec};margin-bottom:0;">${secTitle('🪟 Licencia Windows')}${filaTable(winRows)}</div>`,
      `<div style="${S.sec};margin-bottom:0;">${secTitle('📊 Licencia Office')}${filaTable(offRows)}</div>`,
    )

    html += secGrid3('Adquisición', adqFields)

  } else if (isTecno) {
    html += secGrid3('🖨️ Equipo', [
      ['Tipo', bien.tipo], ['Marca', bien.marca], ['Modelo', bien.modelo],
      ['N° Serie', bien.numero_serie], ['Tecnología', bien.tecnologia], ['Consumible', bien.consumible],
    ], true)
    html += secGrid3('🛒 Adquisición', adqFields)

  } else if (isBiblioteca) {
    html += secGrid3('📚 Datos bibliográficos', [
      ['ISBN', bien.isbn], ['Autor', bien.autor], ['Género', bien.genero],
    ])
    html += secGrid3('🛒 Adquisición', adqFields)

  } else {
    html += secGrid3('🧾 Detalle del bien', [
      ['Nombre', bien.nombre], ['Código', bien.codigo],
      ['Cantidad', bien.cantidad], ['Estado', bien.estado],
    ])
    html += secGrid3('🛒 Adquisición', adqFields)
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  const today = new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' })
  html += `
  <p style="margin:14px 0 0;font-size:9px;color:#94a3b8;text-align:right;border-top:1px solid #e2e8f0;padding-top:8px;">
    Generado el ${today}
  </p>`

  html += `</div>`
  return html
}
