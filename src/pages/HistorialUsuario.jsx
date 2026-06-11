// src/pages/HistorialUsuario.jsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../supabase'
import './HistorialUsuario.css'

const PAGE_SIZE = 20

const MODULOS_FILTRO = [
  { key: 'todo',           label: 'Todo',           icon: '🔍' },
  { key: 'inventario',     label: 'Inventario',     icon: '📦' },
  { key: 'tickets',        label: 'Tickets',        icon: '📋' },
  { key: 'ausencias',      label: 'Ausencias',      icon: '📅' },
  { key: 'compensatorios', label: 'Compensatorios', icon: '🗓' },
  { key: 'requerimientos', label: 'Requerimientos', icon: '🛒' },
  { key: 'permisos',       label: 'Usuarios',       icon: '👤' },
]

const ACCION_META = {
  crear:    { label: 'Creó',    color: '#16a34a', bg: '#f0fdf4' },
  editar:   { label: 'Editó',   color: '#2563eb', bg: '#eff6ff' },
  eliminar: { label: 'Eliminó', color: '#dc2626', bg: '#fef2f2' },
  aprobar:  { label: 'Aprobó',  color: '#059669', bg: '#ecfdf5' },
  rechazar: { label: 'Rechazó', color: '#b91c1c', bg: '#fff1f2' },
  cerrar:   { label: 'Cerró',   color: '#7c3aed', bg: '#faf5ff' },
}

const MODULO_LABEL = {
  inventario:     'Inventario',
  tickets:        'Tickets',
  ausencias:      'Ausencias',
  compensatorios: 'Compensatorios',
  requerimientos: 'Requerimientos',
  permisos:       'Usuarios',
  configuracion:  'Configuración',
}

const ROL_LABEL = {
  admin: 'Administrador', directivo: 'Directivo', coordinador: 'Coordinador',
  docente: 'Docente', asistente: 'Asistente', administrativo: 'Administrativo',
  soporte: 'Soporte técnico', visor_requerimientos: 'Visor requerimientos',
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function cambiosTexto(cambios) {
  if (!cambios || !Array.isArray(cambios) || cambios.length === 0) return ''
  return cambios.map(c => {
    if (c.campo && c.anterior !== undefined && c.nuevo !== undefined)
      return `${c.campo}: "${c.anterior}" → "${c.nuevo}"`
    return JSON.stringify(c)
  }).join('; ')
}

function textoAccion(r) {
  const accion = ACCION_META[r.accion]?.label ?? r.accion ?? 'Acción'
  const nombre = r.bien_nombre
  const mod    = r.modulo

  if (mod === 'tickets') {
    if (r.accion === 'crear')   return `Creó ticket${nombre ? ` "${nombre}"` : ''}`
    if (r.accion === 'editar')  return `Editó ticket${nombre ? ` "${nombre}"` : ''}`
    if (r.accion === 'eliminar') return `Eliminó ticket${nombre ? ` "${nombre}"` : ''}`
  }
  if (mod === 'inventario') {
    if (r.accion === 'crear')   return `Registró bien "${nombre ?? ''}"`
    if (r.accion === 'editar')  return `Editó bien "${nombre ?? ''}"`
    if (r.accion === 'eliminar') return `Eliminó bien "${nombre ?? ''}"`
  }
  if (mod === 'ausencias') {
    if (r.accion === 'crear')   return `Registró ausencia${nombre ? ` "${nombre}"` : ''}`
    if (r.accion === 'editar')  return `Editó ausencia${nombre ? ` "${nombre}"` : ''}`
    if (r.accion === 'eliminar') return `Eliminó ausencia${nombre ? ` "${nombre}"` : ''}`
    if (r.accion === 'aprobar') return `Aprobó ausencia${nombre ? ` de "${nombre}"` : ''}`
    if (r.accion === 'rechazar') return `Rechazó ausencia${nombre ? ` de "${nombre}"` : ''}`
  }
  if (mod === 'compensatorios') {
    if (r.accion === 'crear')  return `Registró compensatorio${nombre ? ` "${nombre}"` : ''}`
    if (r.accion === 'editar') return `Editó compensatorio${nombre ? ` "${nombre}"` : ''}`
  }
  if (mod === 'requerimientos') {
    if (r.accion === 'crear')  return `Creó requerimiento${nombre ? ` "${nombre}"` : ''}`
    if (r.accion === 'editar') return `Editó requerimiento${nombre ? ` "${nombre}"` : ''}`
  }
  if (mod === 'permisos') {
    return `${accion} permisos${nombre ? ` de "${nombre}"` : ''}`
  }
  return `${accion}${nombre ? ` "${nombre}"` : ''}`.trim()
}

// ── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ icon, label, valor, loading, color }) {
  return (
    <div className="hu-stat-card">
      <div className="hu-stat-icon" style={{ color }}>{icon}</div>
      <div className="hu-stat-valor" style={{ color: loading ? '#d1d5db' : '#0f172a' }}>
        {loading ? '—' : valor.toLocaleString('es-CL')}
      </div>
      <div className="hu-stat-label">{label}</div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Componente principal
// ══════════════════════════════════════════════════════════════════════════════
export default function HistorialUsuario({ usuario: u, onCerrar }) {
  const [cargandoStats,     setCargandoStats]     = useState(true)
  const [cargandoActividad, setCargandoActividad] = useState(true)
  const [stats, setStats] = useState({
    ticketsCreados: 0, ticketsResueltos: 0,
    ausencias: 0, bienesCreados: 0, bienesModificados: 0, accionesTotal: 0,
  })
  const [actividad,       setActividad]       = useState([])
  const [totalActividad,  setTotalActividad]  = useState(0)
  const [pagina,          setPagina]          = useState(1)
  const [filtroModulo,    setFiltroModulo]    = useState('todo')
  const [buscarTexto,     setBuscarTexto]     = useState('')
  const [fechaDesde,      setFechaDesde]      = useState('')
  const [fechaHasta,      setFechaHasta]      = useState('')
  const [exportando,      setExportando]      = useState(false)
  const [menuExportar,    setMenuExportar]    = useState(false)
  const menuRef = useRef(null)

  // ── Cargar estadísticas ────────────────────────────────────────────────────
  const cargarStats = useCallback(async () => {
    setCargandoStats(true)
    const uid = u.id
    const [
      { count: tc },
      { count: tr },
      { count: aus },
      { count: bc },
      { count: bm },
      { count: at },
    ] = await Promise.all([
      supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('creado_por', uid),
      supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('creado_por', uid).eq('estado', 'Resuelto'),
      supabase.from('ausencias').select('*', { count: 'exact', head: true }).eq('usuario_id', uid),
      supabase.from('audit_logs').select('*', { count: 'exact', head: true })
        .eq('usuario_id', uid).eq('modulo', 'inventario').eq('accion', 'crear'),
      supabase.from('audit_logs').select('*', { count: 'exact', head: true })
        .eq('usuario_id', uid).eq('modulo', 'inventario').eq('accion', 'editar'),
      supabase.from('audit_logs').select('*', { count: 'exact', head: true }).eq('usuario_id', uid),
    ])
    setStats({
      ticketsCreados:    tc  ?? 0,
      ticketsResueltos:  tr  ?? 0,
      ausencias:         aus ?? 0,
      bienesCreados:     bc  ?? 0,
      bienesModificados: bm  ?? 0,
      accionesTotal:     at  ?? 0,
    })
    setCargandoStats(false)
  }, [u.id])

  // ── Cargar actividad paginada ──────────────────────────────────────────────
  const cargarActividad = useCallback(async () => {
    setCargandoActividad(true)
    const from = (pagina - 1) * PAGE_SIZE
    const to   = from + PAGE_SIZE - 1

    let q = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .eq('usuario_id', u.id)
      .order('creado_en', { ascending: false })

    if (filtroModulo !== 'todo') q = q.eq('modulo', filtroModulo)
    if (buscarTexto) q = q.ilike('bien_nombre', `%${buscarTexto}%`)
    if (fechaDesde)  q = q.gte('creado_en', fechaDesde)
    if (fechaHasta)  q = q.lte('creado_en', fechaHasta + 'T23:59:59')

    q = q.range(from, to)

    const { data, count } = await q
    setActividad(data ?? [])
    setTotalActividad(count ?? 0)
    setCargandoActividad(false)
  }, [u.id, pagina, filtroModulo, buscarTexto, fechaDesde, fechaHasta])

  useEffect(() => { cargarStats() },    [cargarStats])
  useEffect(() => { cargarActividad() }, [cargarActividad])
  useEffect(() => { setPagina(1) },     [filtroModulo, buscarTexto, fechaDesde, fechaHasta])

  // Cerrar menú exportar al hacer clic fuera
  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuExportar(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // ── Exportación ───────────────────────────────────────────────────────────
  const fetchTodosParaExportar = async () => {
    let q = supabase
      .from('audit_logs')
      .select('*')
      .eq('usuario_id', u.id)
      .order('creado_en', { ascending: false })
      .limit(5000)
    if (filtroModulo !== 'todo') q = q.eq('modulo', filtroModulo)
    if (buscarTexto) q = q.ilike('bien_nombre', `%${buscarTexto}%`)
    if (fechaDesde)  q = q.gte('creado_en', fechaDesde)
    if (fechaHasta)  q = q.lte('creado_en', fechaHasta + 'T23:59:59')
    const { data } = await q
    return data ?? []
  }

  const exportarCSV = async () => {
    setExportando(true); setMenuExportar(false)
    const todos = await fetchTodosParaExportar()
    const cab   = ['Fecha/Hora', 'Módulo', 'Acción', 'Elemento', 'Detalle']
    const filas = todos.map(r => [
      new Date(r.creado_en).toLocaleString('es-CL'),
      MODULO_LABEL[r.modulo] ?? r.modulo ?? '',
      ACCION_META[r.accion]?.label ?? r.accion ?? '',
      r.bien_nombre ?? '',
      cambiosTexto(r.cambios),
    ])
    const csv = '﻿' + [cab, ...filas]
      .map(row => row.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `historial_${(u.nombre ?? 'usuario').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setExportando(false)
  }

  const exportarExcel = async () => {
    setExportando(true); setMenuExportar(false)
    const todos = await fetchTodosParaExportar()
    const filas = [
      ['Fecha/Hora', 'Módulo', 'Acción', 'Elemento', 'Detalle'],
      ...todos.map(r => [
        new Date(r.creado_en).toLocaleString('es-CL'),
        MODULO_LABEL[r.modulo] ?? r.modulo ?? '',
        ACCION_META[r.accion]?.label ?? r.accion ?? '',
        r.bien_nombre ?? '',
        cambiosTexto(r.cambios),
      ]),
    ]
    if (!window.XLSX) {
      await new Promise((res, rej) => {
        const s = document.createElement('script')
        s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js'
        s.onload = res; s.onerror = rej
        document.head.appendChild(s)
      })
    }
    const wb = window.XLSX.utils.book_new()
    const ws = window.XLSX.utils.aoa_to_sheet(filas)
    const cols = [20, 14, 10, 26, 50]
    ws['!cols'] = cols.map(w => ({ wch: w }))
    window.XLSX.utils.book_append_sheet(wb, ws, 'Historial')
    window.XLSX.writeFile(wb, `historial_${(u.nombre ?? 'usuario').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`)
    setExportando(false)
  }

  const exportarPDF = async () => {
    setExportando(true); setMenuExportar(false)
    const todos = await fetchTodosParaExportar()
    const filas = todos.map(r => {
      const det = cambiosTexto(r.cambios)
      return `<tr>
        <td>${new Date(r.creado_en).toLocaleString('es-CL')}</td>
        <td>${MODULO_LABEL[r.modulo] ?? r.modulo ?? ''}</td>
        <td style="color:${ACCION_META[r.accion]?.color ?? '#374151'};font-weight:600">${ACCION_META[r.accion]?.label ?? r.accion ?? ''}</td>
        <td>${r.bien_nombre ?? ''}</td>
        <td style="color:#6b7280">${det.length > 120 ? det.slice(0, 120) + '…' : det}</td>
      </tr>`
    }).join('')

    const resumenCards = `
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin:12px 0 18px">
        ${[
          ['📋', 'Tickets creados',  stats.ticketsCreados],
          ['✅', 'Tickets resueltos', stats.ticketsResueltos],
          ['📅', 'Ausencias',         stats.ausencias],
          ['📦', 'Bienes creados',    stats.bienesCreados],
          ['✏️', 'Bienes editados',   stats.bienesModificados],
          ['🛠', 'Acciones totales',  stats.accionesTotal],
        ].map(([ico, lbl, val]) => `
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 16px;text-align:center;min-width:100px">
            <div style="font-size:18px">${ico}</div>
            <div style="font-size:20px;font-weight:700;color:#0f172a">${val}</div>
            <div style="font-size:10px;color:#64748b">${lbl}</div>
          </div>
        `).join('')}
      </div>
    `

    const html = `<!DOCTYPE html>
<html><head>
  <meta charset="UTF-8">
  <title>Historial — ${u.nombre}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 11px; color: #1f2937; margin: 24px 32px; }
    h1   { color: #1a237e; font-size: 17px; margin: 0 0 4px; }
    .meta { color: #6b7280; font-size: 11px; margin-bottom: 14px; }
    table { width: 100%; border-collapse: collapse; }
    th    { background: #1a237e; color: #fff; padding: 7px 9px; text-align: left; font-size: 10px; }
    td    { padding: 5px 9px; border-bottom: 1px solid #e5e7eb; font-size: 10px; }
    tr:nth-child(even) td { background: #f9fafb; }
    @media print { @page { size: landscape; margin: 12mm 14mm; } }
  </style>
</head>
<body>
  <h1>👤 Historial de Usuario — ${u.nombre}</h1>
  <p class="meta">
    RUT: ${u.rut ?? '—'} | Correo: ${u.email ?? '—'} | Rol: ${ROL_LABEL[u.rol] ?? u.rol}<br>
    Exportado el ${new Date().toLocaleString('es-CL')} | ${todos.length} registros
  </p>
  ${resumenCards}
  <table>
    <thead><tr><th>Fecha/Hora</th><th>Módulo</th><th>Acción</th><th>Elemento</th><th>Detalle</th></tr></thead>
    <tbody>${filas}</tbody>
  </table>
</body></html>`

    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => { w.print() }, 400)
    setExportando(false)
  }

  // ── Datos de resumen ───────────────────────────────────────────────────────
  const totalPags       = Math.ceil(totalActividad / PAGE_SIZE)
  const ultimaActividad = actividad[0]

  // Agrupar accesos: primeras entradas únicas por día de las últimas 10 entradas
  const accesos = (() => {
    const vistos = new Set()
    return actividad.filter(r => {
      const dia = r.creado_en?.slice(0, 10)
      if (vistos.has(dia)) return false
      vistos.add(dia); return true
    }).slice(0, 3)
  })()

  return (
    <div className="hu-panel">

      {/* ── Header ── */}
      <div className="hu-header">
        <div>
          <h3 className="hu-titulo">👤 Historial de Usuario</h3>
          <p className="hu-subtitulo">{u.nombre}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="hu-export-wrapper" ref={menuRef}>
            <button className="hu-btn-exportar" onClick={() => setMenuExportar(v => !v)} disabled={exportando}>
              {exportando ? 'Exportando…' : '⬇ Exportar'}
            </button>
            <AnimatePresence>
              {menuExportar && (
                <motion.div
                  className="hu-export-menu"
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ duration: 0.14 }}
                >
                  <button onClick={exportarCSV}>📄 CSV</button>
                  <button onClick={exportarExcel}>📊 Excel</button>
                  <button onClick={exportarPDF}>📑 PDF</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button className="hu-btn-cerrar" onClick={onCerrar} title="Cerrar historial">✕</button>
        </div>
      </div>

      {/* ── Resumen general ── */}
      <div className="hu-resumen-grid">
        <div className="hu-resumen-item">
          <span className="hu-rl">Correo</span>
          <span className="hu-rv">{u.email ?? '—'}</span>
        </div>
        {u.rut && (
          <div className="hu-resumen-item">
            <span className="hu-rl">RUT</span>
            <span className="hu-rv">{u.rut}</span>
          </div>
        )}
        <div className="hu-resumen-item">
          <span className="hu-rl">Rol</span>
          <span className="hu-rv">{ROL_LABEL[u.rol] ?? u.rol}</span>
        </div>
        <div className="hu-resumen-item">
          <span className="hu-rl">Cuenta creada</span>
          <span className="hu-rv">
            {u.created_at
              ? new Date(u.created_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })
              : '—'}
          </span>
        </div>
        {ultimaActividad && (
          <div className="hu-resumen-item">
            <span className="hu-rl">Última actividad</span>
            <span className="hu-rv">{new Date(ultimaActividad.creado_en).toLocaleString('es-CL')}</span>
          </div>
        )}
      </div>

      {/* ── Cards estadísticas ── */}
      <div className="hu-stats-grid">
        <StatCard icon="📋" label="Tickets creados"   valor={stats.ticketsCreados}    loading={cargandoStats} color="#2563eb" />
        <StatCard icon="✅" label="Tickets resueltos" valor={stats.ticketsResueltos}  loading={cargandoStats} color="#16a34a" />
        <StatCard icon="📅" label="Ausencias"          valor={stats.ausencias}         loading={cargandoStats} color="#7c3aed" />
        <StatCard icon="📦" label="Bienes creados"    valor={stats.bienesCreados}     loading={cargandoStats} color="#0891b2" />
        <StatCard icon="✏️" label="Bienes editados"   valor={stats.bienesModificados} loading={cargandoStats} color="#d97706" />
        <StatCard icon="🛠" label="Acciones totales"  valor={stats.accionesTotal}     loading={cargandoStats} color="#6366f1" />
      </div>

      {/* ── Historial de accesos ── */}
      {accesos.length > 0 && (
        <div className="hu-accesos">
          <p className="hu-seccion-titulo">Historial de accesos recientes</p>
          <div className="hu-accesos-lista">
            {accesos.map((r, i) => (
              <div key={r.id} className="hu-acceso-item">
                <span className="hu-acceso-num">{i === 0 ? 'Último' : i === 1 ? 'Penúltimo' : `Acceso ${i + 1}`}</span>
                <span className="hu-acceso-fecha">{new Date(r.creado_en).toLocaleString('es-CL')}</span>
                {r.dispositivo && <span className="hu-acceso-disp">{r.dispositivo}</span>}
              </div>
            ))}
          </div>
          <p className="hu-accesos-nota">* Basado en registros de actividad — el sistema no registra sesiones directamente.</p>
        </div>
      )}

      {/* ── Filtros ── */}
      <div className="hu-filtros">
        <div className="hu-filtros-modulos">
          {MODULOS_FILTRO.map(m => (
            <button
              key={m.key}
              className={`hu-filtro-btn${filtroModulo === m.key ? ' activo' : ''}`}
              onClick={() => setFiltroModulo(m.key)}
            >
              <span>{m.icon}</span> {m.label}
            </button>
          ))}
        </div>
        <div className="hu-filtros-row">
          <input
            className="hu-input-buscar"
            placeholder="Buscar por elemento…"
            value={buscarTexto}
            onChange={e => setBuscarTexto(e.target.value)}
          />
          <input
            type="date" className="hu-input-fecha"
            value={fechaDesde} onChange={e => setFechaDesde(e.target.value)}
            title="Desde"
          />
          <input
            type="date" className="hu-input-fecha"
            value={fechaHasta} onChange={e => setFechaHasta(e.target.value)}
            title="Hasta"
          />
          {(buscarTexto || fechaDesde || fechaHasta) && (
            <button className="hu-btn-limpiar"
              onClick={() => { setBuscarTexto(''); setFechaDesde(''); setFechaHasta('') }}>
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── Timeline actividad ── */}
      <div className="hu-actividad">
        <div className="hu-actividad-header">
          <span className="hu-seccion-titulo" style={{ margin: 0 }}>Actividad reciente</span>
          {!cargandoActividad && (
            <span className="hu-total-badge">{totalActividad.toLocaleString('es-CL')} registros</span>
          )}
        </div>

        {cargandoActividad ? (
          <div className="hu-skeleton-lista">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="hu-skeleton-row">
                <div className="hu-sk-dot" />
                <div style={{ flex: 1 }}>
                  <div className="hu-sk-line" style={{ width: '55%', height: 11 }} />
                  <div className="hu-sk-line" style={{ width: '30%', height: 9, marginTop: 5 }} />
                </div>
              </div>
            ))}
          </div>
        ) : actividad.length === 0 ? (
          <div className="hu-vacio">
            Sin actividad registrada para los filtros seleccionados
          </div>
        ) : (
          <div className="hu-timeline">
            {actividad.map(r => {
              const meta   = ACCION_META[r.accion] ?? { label: r.accion ?? '—', color: '#6b7280', bg: '#f3f4f6' }
              const detalle = cambiosTexto(r.cambios)
              return (
                <div key={r.id} className="hu-tl-item">
                  <div className="hu-tl-dot" style={{ background: meta.color }} />
                  <div className="hu-tl-body">
                    <div className="hu-tl-row1">
                      <span className="hu-tl-badge" style={{ background: meta.bg, color: meta.color }}>
                        {meta.label}
                      </span>
                      <span className="hu-tl-modulo">{MODULO_LABEL[r.modulo] ?? r.modulo}</span>
                      <span className="hu-tl-fecha">{new Date(r.creado_en).toLocaleString('es-CL')}</span>
                    </div>
                    <div className="hu-tl-desc">{textoAccion(r)}</div>
                    {detalle && (
                      <div className="hu-tl-detalle">
                        {detalle.length > 200 ? detalle.slice(0, 200) + '…' : detalle}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Paginación */}
        {totalPags > 1 && !cargandoActividad && (
          <div className="hu-paginacion">
            <button disabled={pagina === 1}         onClick={() => setPagina(p => p - 1)}>← Anterior</button>
            <span>{pagina} / {totalPags}</span>
            <button disabled={pagina === totalPags} onClick={() => setPagina(p => p + 1)}>Siguiente →</button>
          </div>
        )}
      </div>

    </div>
  )
}
