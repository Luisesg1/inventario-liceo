/**
 * InventoryPDFTemplate
 *
 * Genera el HTML de la ficha de inventario para PDF.
 * Layout 100% vertical — sin columnas laterales entre secciones.
 * Cada sección ocupa el 100% del ancho (794px).
 * Las filas internas usan grid 180px|1fr para label/valor.
 *
 * Diseñado para renderizarse con html2canvas + jsPDF (via html2pdf.js)
 * en un contenedor de 794px de ancho — independiente del viewport del dispositivo.
 */

const ESTADO_COLORS = {
  Bueno:   { bg: '#dcfce7', color: '#166534' },
  Regular: { bg: '#fef9c3', color: '#854d0e' },
  Malo:    { bg: '#fee2e2', color: '#991b1b' },
  Baja:    { bg: '#f3f4f6', color: '#6b7280' },
}

// ── Escapar HTML ──────────────────────────────────────────────────────────────
function esc(v) {
  if (v == null) return ''
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// ── Bloques de UI ──────────────────────────────────────────────────────────────

const CSS = {
  container: [
    'width:794px',
    'min-width:794px',
    'max-width:794px',
    'box-sizing:border-box',
    'overflow:visible',
    'padding:32px',
    'background:#ffffff',
    'font-family:Arial,Helvetica,sans-serif',
    'font-size:11px',
    'color:#1a1a2e',
  ].join(';'),

  section: [
    'width:100%',
    'max-width:100%',
    'box-sizing:border-box',
    'page-break-inside:avoid',
    'break-inside:avoid',
    'overflow:visible',
    'background:#f8fafc',
    'border:1px solid #e2e8f0',
    'border-radius:8px',
    'padding:14px 16px',
    'margin-bottom:12px',
  ].join(';'),

  // Fila label/valor dentro de una sección
  row: [
    'display:grid',
    'grid-template-columns:180px 1fr',
    'gap:12px',
    'width:100%',
    'max-width:100%',
    'box-sizing:border-box',
    'padding:4px 0',
    'border-bottom:1px solid #f1f5f9',
    'align-items:flex-start',
  ].join(';'),

  label: [
    'font-size:9px',
    'font-weight:700',
    'color:#94a3b8',
    'text-transform:uppercase',
    'letter-spacing:.06em',
    'padding-top:2px',
    'word-break:normal',
    'overflow-wrap:normal',
  ].join(';'),

  value: [
    'min-width:0',
    'max-width:100%',
    'white-space:normal',
    'word-break:break-word',
    'overflow-wrap:anywhere',
    'font-size:11px',
    'font-weight:600',
    'color:#0f172a',
  ].join(';'),

  valueKey: [
    'min-width:0',
    'max-width:100%',
    'white-space:normal',
    'word-break:break-all',
    'overflow-wrap:anywhere',
    'font-family:monospace',
    'font-size:10px',
    'font-weight:600',
    'color:#0f172a',
  ].join(';'),

  sectionTitle: [
    'font-size:9px',
    'font-weight:800',
    'color:#475569',
    'text-transform:uppercase',
    'letter-spacing:.08em',
    'margin:0 0 8px 0',
    'padding:0',
  ].join(';'),
}

function secTitle(text) {
  return `<p style="${CSS.sectionTitle}">${text}</p>`
}

/** Fila label → valor; isKey = true para claves/seriales/licencias */
function row(label, val, isKey = false) {
  return `
    <div style="${CSS.row}">
      <div style="${CSS.label}">${esc(label)}</div>
      <div style="${isKey ? CSS.valueKey : CSS.value}">${esc(val) || '—'}</div>
    </div>`
}

/** Sección completa: título + filas HTML */
function sec(title, rowsHtml) {
  return `<div style="${CSS.section}">${secTitle(title)}${rowsHtml}</div>`
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

  // Campos adicionales ordenados
  const camposCat = catObj?.campos_personalizados ?? []
  const extra     = bien.campos_extra || {}
  const _ord      = catObj?.campos_orden ?? []
  const _sorted   = _ord.length
    ? [...camposCat].sort((a, b) => {
        const ia = _ord.indexOf(a.id), ib = _ord.indexOf(b.id)
        if (ia === -1 && ib === -1) return 0
        if (ia === -1) return 1
        if (ib === -1) return -1
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

  // ── BUILD ─────────────────────────────────────────────────────────────────

  let html = `<div style="${CSS.container}">`

  // DEV — descomenta para ver el contorno del PDF mientras validas:
  // html = `<div style="${CSS.container};border:2px solid red;">`

  // Franja institucional
  html += `
  <div style="width:100%;box-sizing:border-box;background:#1e3a8a;color:#fff;padding:10px 18px;border-radius:8px 8px 0 0;">
    <span style="font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;opacity:.9;">
      Liceo JHJ — Inventario Institucional
    </span>
  </div>`

  // Header del bien — tabla fija para alinear icono/nombre/badge sin flex
  html += `
  <div style="width:100%;box-sizing:border-box;background:#fff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;padding:14px 18px;margin-bottom:16px;">
    <table style="width:100%;table-layout:fixed;border-collapse:collapse;">
      <tr>
        <td style="width:38px;padding:0 10px 0 0;vertical-align:middle;font-size:1.5rem;overflow:visible;">${catIcon}</td>
        <td style="vertical-align:middle;overflow:hidden;word-break:break-word;overflow-wrap:anywhere;">
          <div style="font-weight:700;font-size:15px;color:#0f172a;word-break:break-word;overflow-wrap:anywhere;">${esc(bien.nombre)}</div>
          <div style="font-size:10px;color:#64748b;margin-top:3px;">${esc(bien.codigo)} · ${esc(catLabel)}</div>
        </td>
        <td style="width:100px;text-align:right;vertical-align:middle;white-space:nowrap;">
          <span style="display:inline-block;background:${ec.bg};color:${ec.color};padding:4px 12px;border-radius:20px;font-size:10px;font-weight:700;">${esc(bien.estado)}</span>
        </td>
      </tr>
    </table>
  </div>`

  // ── Sección: Identificación ───────────────────────────────────────────────
  html += sec('Identificación', [
    row('Código Interno', bien.codigo_interno || 'N/A'),
    row('Código', bien.codigo),
    row('Categoría', catLabel),
    row('Estado', bien.estado),
    ...(!isComp ? [row('Cantidad', bien.cantidad)] : []),
  ].join(''))

  // ── Sección: Asignación ───────────────────────────────────────────────────
  {
    let rows = ''
    if (isComp || isTecno) rows += row('Área', bien.area || '—')
    rows += row('Ubicación', bien.ubicacion || 'N/A')
    rows += row('Responsable', bien.responsable || 'N/A')
    html += sec('Asignación', rows)
  }

  // ── Descripción ───────────────────────────────────────────────────────────
  if (bien.descripcion)
    html += sec('Descripción',
      `<p style="margin:0;font-size:11px;color:#334155;word-break:break-word;overflow-wrap:break-word;">${esc(bien.descripcion)}</p>`)

  // ── Observaciones ─────────────────────────────────────────────────────────
  if (bien.obs)
    html += sec('Observaciones',
      `<p style="margin:0;font-size:11px;color:#334155;word-break:break-word;overflow-wrap:break-word;">${esc(bien.obs)}</p>`)

  // ── Campos adicionales ────────────────────────────────────────────────────
  if (conValor.length)
    html += sec('✨ Campos adicionales',
      conValor.map(c => row(
        c.nombre,
        c.tipo === 'booleano' ? (extra[c.id] === 'si' ? 'Sí' : 'No') : extra[c.id],
      )).join(''))

  // ── Secciones por tipo ────────────────────────────────────────────────────

  if (isComp) {
    // Hardware
    const hwRows = [
      ['Tipo',              bien.tipo],
      ['Marca',             bien.marca],
      ['Modelo',            bien.modelo],
      ['Pantalla',          bien.pantalla],
      ['N° Serie',          bien.numero_serie],
      ['CPU',               bien.cpu],
      ['RAM',               [bien.ram, bien.ram_tipo, bien.ram_slots ? bien.ram_slots + ' slot(s)' : ''].filter(Boolean).join(' · ')],
      ['Almacenamiento',    bien.tipo_almacenamiento ? (bien.tipo_almacenamiento + ' ' + (bien.memoria || '')).trim() : bien.memoria],
      ['Sistema operativo', bien.sistema_operativo],
    ].filter(([, v]) => v)
    if (hwRows.length)
      html += sec('Hardware', hwRows.map(([l, v]) => row(l, v)).join(''))

    // Licencia Windows
    html += sec('🪟 Licencia Windows', [
      row('Clave',         bien.licencia_windows, true),
      row('Versión',       bien.win_version),
      row('Proveedor',     bien.win_proveedor),
      row('N° Factura',    bien.win_factura),
      row('Fecha factura', bien.win_fecha_factura),
      row('N° Orden',      bien.win_orden),
    ].join(''))

    // Licencia Office
    html += sec('📊 Licencia Office', [
      row('Clave',         bien.licencia_office, true),
      row('Versión',       bien.off_version),
      row('Proveedor',     bien.off_proveedor),
      row('N° Factura',    bien.off_factura),
      row('Fecha factura', bien.off_fecha_factura),
      row('N° Orden',      bien.off_orden),
    ].join(''))

  } else if (isTecno) {
    const eqRows = [
      ['Tipo',       bien.tipo],
      ['Marca',      bien.marca],
      ['Modelo',     bien.modelo],
      ['N° Serie',   bien.numero_serie],
      ['Tecnología', bien.tecnologia],
      ['Consumible', bien.consumible],
    ].filter(([, v]) => v)
    if (eqRows.length)
      html += sec('🖨️ Equipo', eqRows.map(([l, v]) => row(l, v)).join(''))

  } else if (isBiblioteca) {
    html += sec('📚 Datos bibliográficos', [
      row('ISBN',   bien.isbn),
      row('Autor',  bien.autor),
      row('Género', bien.genero),
    ].join(''))

  } else {
    html += sec('🧾 Detalle del bien', [
      row('Nombre',   bien.nombre),
      row('Código',   bien.codigo),
      row('Cantidad', bien.cantidad),
    ].join(''))
  }

  // ── Adquisición (todos los tipos) ─────────────────────────────────────────
  html += sec('🛒 Adquisición',
    adqFields.map(([l, v]) => row(l, v)).join(''))

  // ── Footer ────────────────────────────────────────────────────────────────
  const today = new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' })
  html += `
  <div style="margin-top:16px;padding-top:8px;border-top:1px solid #e2e8f0;text-align:right;font-size:9px;color:#94a3b8;width:100%;box-sizing:border-box;">
    Generado el ${today}
  </div>`

  html += `</div>`
  return html
}
