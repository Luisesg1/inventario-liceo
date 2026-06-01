import { useState, useEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { supabase } from '../supabase'
import './Tickets.css'

const PRIORIDAD = {
  alta:  { bg: 'rgba(185,28,28,0.09)',  color: '#b91c1c', label: '🔴 Alta' },
  media: { bg: 'rgba(180,83,9,0.09)',   color: '#b45309', label: '🟡 Media' },
  baja:  { bg: 'rgba(21,128,61,0.09)',  color: '#15803d', label: '🟢 Baja' },
}
const ESTADO = {
  'Abierto':    { bg: 'rgba(29,78,216,0.09)',  color: '#1d4ed8', icon: '🔵' },
  'En proceso': { bg: 'rgba(180,83,9,0.09)',   color: '#b45309', icon: '🟡' },
  'Resuelto':   { bg: 'rgba(21,128,61,0.09)',  color: '#15803d', icon: '🟢' },
}
const KPI_BORDER = { 'Abierto': '#2563eb', 'En proceso': '#d97706', 'Resuelto': '#16a34a' }

const KPI_ICONS = {
  'Abierto': (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
  'En proceso': (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  'Resuelto': (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  ),
  semana: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 1 18"/><polyline points="15 7 22 7 22 14"/>
    </svg>
  ),
}

const pageVariants = {
  hidden:  { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.26, ease: 'easeOut' } },
}

function SkeletonTickets() {
  return (
    <div className="tk-skeleton-wrap">
      <div className="tickets-kpis">
        {[0,1,2,3].map(i => (
          <div key={i} className="tickets-kpi" style={{ cursor: 'default', pointerEvents: 'none' }}>
            <div className="tk-skeleton-line" style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="tk-skeleton-line" style={{ width: '45%', height: 22 }} />
              <div className="tk-skeleton-line" style={{ width: '70%', height: 10 }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[1,2,3,4,5].map(i => (
          <div key={i} className="tk-skeleton-card">
            <div className="tk-skeleton-line" style={{ width: '55%', height: 16 }} />
            <div className="tk-skeleton-line" style={{ width: '35%', height: 12 }} />
            <div className="tk-skeleton-line" style={{ width: '80%', height: 12 }} />
          </div>
        ))}
      </div>
    </div>
  )
}

const AREAS = ['Proyector', 'Conector HDMI Muro', 'Conector HDMI Proyector', 'Notebook',
  'Computador de escritorio', 'Impresora', 'Red de Internet', 'Teclado', 'Mouse', 'Otro']
const ROLES = ['Administrador', 'Directivo', 'Coordinador', 'Docente', 'Asistente de la educación', 'Administrativo']

const MAX_PALABRAS = 100
const contarPalabras = (str) => str.trim() ? str.trim().split(/\s+/).length : 0

const FORM_VACIO = {
  nombre: '', apellidos: '', rol_solicitante: '', correo_contacto: '',
  area_reporte: '', area_otro: '', marca_modelo_falla: '',
  lugar_falla: '', descripcion: '',
}

export default function Tickets({ usuario, onTicketActualizado, filtroInicial = '', permisos = {} }) {
  const esAdmin   = usuario.rol === 'admin'
  const esSoporte = usuario.rol === 'soporte'
  // Permisos: usa prop si viene de App, sino fallback a lógica de roles
  const esGestor    = permisos.gestionar ?? (esAdmin || esSoporte)
  const puedeCrear  = permisos.crear     ?? true   // cualquiera puede crear por defecto
  const puedeElim   = permisos.eliminar  ?? (esAdmin || esSoporte)
  const shouldReduce = useReducedMotion()
  const kpiAnim = (i) => ({
    initial: shouldReduce ? false : { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: shouldReduce ? 0 : 0.04 + i * 0.07, duration: 0.24, ease: 'easeOut' },
    whileHover: shouldReduce ? {} : { y: -3, transition: { duration: 0.18 } },
  })

  const [tickets,         setTickets]         = useState([])
  const [cargando,        setCargando]        = useState(true)
  const [filtroEstado,    setFiltroEstado]    = useState(filtroInicial)
  const [filtroPrioridad, setFiltroPrioridad] = useState('')
  const [filtroArea,      setFiltroArea]      = useState('')
  const [filtroRol,       setFiltroRol]       = useState('')
  const [modalNuevo,      setModalNuevo]      = useState(false)
  const [form,            setForm]            = useState(FORM_VACIO)
  const [guardando,       setGuardando]       = useState(false)
  const [ticketDetalle,   setTicketDetalle]   = useState(null)
  const [editEstado,      setEditEstado]      = useState('')
  const [editPrioridad,   setEditPrioridad]   = useState(null)
  const [editNotas,       setEditNotas]       = useState('')
  const [guardandoEdit,   setGuardandoEdit]   = useState(false)
  const [confirmarEliminar, setConfirmarEliminar] = useState(false)
  const [seleccionados,   setSeleccionados]   = useState(new Set())
  const [confirmandoBulk, setConfirmandoBulk] = useState(false)
  const [busqueda,        setBusqueda]        = useState('')
  const [exito,           setExito]           = useState(false)
  const [paginaT,         setPaginaT]         = useState(1)
  const [menuExportar,    setMenuExportar]    = useState(false)
  const [exportando,      setExportando]      = useState(false)
  const [avisoExport,     setAvisoExport]     = useState('')

  useEffect(() => { cargar() }, [])
  useEffect(() => { setPaginaT(1) }, [filtroEstado, filtroPrioridad, filtroArea, filtroRol, busqueda])

  const cargar = async () => {
    setCargando(true)
    let q = supabase.from('tickets').select('*').order('creado_en', { ascending: false })
    if (!esGestor) q = q.eq('creado_por', usuario.id)
    const { data } = await q
    setTickets(data ?? [])
    setCargando(false)
  }

  const filtrados = tickets.filter(t => {
    if (filtroEstado    && t.estado          !== filtroEstado)    return false
    if (filtroPrioridad && t.prioridad       !== filtroPrioridad) return false
    if (filtroArea      && t.area_reporte    !== filtroArea)      return false
    if (filtroRol       && t.rol_solicitante !== filtroRol)       return false
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      const hay = (s) => (s ?? '').toLowerCase().includes(q)
      const label = (t.area_reporte === 'Otro' && t.area_otro) ? t.area_otro : (t.area_reporte ?? '')
      if (!hay(label) && !hay(t.area_reporte) && !hay(t.descripcion) &&
          !hay(t.creado_por_nombre) && !hay(t.apellidos) && !hay(t.rol_solicitante) &&
          !hay(t.lugar_falla) && !hay(t.marca_modelo_falla))
        return false
    }
    return true
  })

  const POR_PAG_T   = 15
  const totalPagsT  = Math.ceil(filtrados.length / POR_PAG_T)
  const filtradosPagT = filtrados.slice((paginaT - 1) * POR_PAG_T, paginaT * POR_PAG_T)

  // Estadísticas: ventana rodante de 7 días (no la semana de calendario)
  const hace7Dias = new Date()
  hace7Dias.setDate(hace7Dias.getDate() - 7)
  hace7Dias.setHours(0, 0, 0, 0)
  const semanaResueltos = tickets.filter(t => t.estado === 'Resuelto' && new Date(t.creado_en) >= hace7Dias).length

  const hoy = new Date()
  const sparkData = Array.from({ length: 7 }, (_, idx) => {
    const d = new Date(hoy)
    d.setDate(hoy.getDate() - (6 - idx))
    const dStr = d.toISOString().slice(0, 10)
    return tickets.filter(t => t.estado === 'Resuelto' && t.creado_en?.slice(0, 10) === dStr).length
  })
  const sparkMax = Math.max(...sparkData, 1)

  const abrirNuevo = () => {
    const [nombre = '', ...rest] = (usuario.nombre || '').split(' ')
    setForm({ ...FORM_VACIO, nombre, apellidos: rest.join(' '), correo_contacto: usuario.email || '' })
    setModalNuevo(true)
  }
  const cerrarNuevo = () => { setModalNuevo(false); setExito(false) }
  const setF = (campo, val) => setForm(f => ({ ...f, [campo]: val }))

  const areaLabel = (t) => t.area_reporte === 'Otro' && t.area_otro ? `Otro — ${t.area_otro}` : (t.area_reporte || t.titulo || '—')

  const formValido = form.nombre.trim() && form.apellidos.trim() && form.rol_solicitante && form.correo_contacto.trim() && form.area_reporte && form.lugar_falla.trim() && form.descripcion.trim()

  const crearTicket = async () => {
    if (!formValido || !puedeCrear) return
    setGuardando(true)
    const titulo = form.area_reporte === 'Otro' && form.area_otro
      ? `Otro — ${form.area_otro}`
      : form.area_reporte
    const creado_por_nombre = `${form.nombre.trim()} ${form.apellidos.trim()}`.trim() || usuario.nombre
    const { error } = await supabase.from('tickets').insert({
      titulo,
      descripcion:        form.descripcion.trim(),
      area_reporte:       form.area_reporte,
      area_otro:          form.area_otro.trim() || null,
      marca_modelo_falla: form.marca_modelo_falla.trim() || null,
      lugar_falla:        form.lugar_falla.trim(),
      apellidos:          form.apellidos.trim() || null,
      rol_solicitante:    form.rol_solicitante || null,
      correo_contacto:    form.correo_contacto.trim() || null,
      prioridad:          null,
      creado_por:         usuario.id,
      creado_por_nombre,
    })
    if (!error) {
      supabase.functions.invoke('notify-new-ticket', {
        body: {
          titulo,
          descripcion:        form.descripcion.trim(),
          lugar_falla:        form.lugar_falla.trim(),
          creado_por_nombre,
          correo_solicitante: form.correo_contacto.trim() || null,
        },
      }).catch(e => console.error('[notify-new-ticket]', e))
      await cargar()
      setExito(true)
      setTimeout(() => cerrarNuevo(), 5000)
    }
    setGuardando(false)
  }

  const abrirDetalle = (t) => { setTicketDetalle(t); setEditEstado(t.estado); setEditPrioridad(t.prioridad ?? null); setEditNotas(t.notas ?? '') }
  const cerrarDetalle = () => { setTicketDetalle(null); setConfirmarEliminar(false) }

  const guardarCambios = async () => {
    if (!ticketDetalle || !esGestor) return
    setGuardandoEdit(true)
    const notasVal = editNotas.trim() || null

    // Historial: agregar entrada si la nota cambió respecto a la última guardada
    const historialActual = ticketDetalle.notas_historial ?? []
    const ultimaNota = historialActual.length > 0
      ? historialActual[historialActual.length - 1]?.texto
      : ticketDetalle.notas
    const nuevoHistorial = notasVal && notasVal !== ultimaNota
      ? [...historialActual, { texto: notasVal, fecha: new Date().toISOString() }]
      : historialActual

    const { error } = await supabase.from('tickets').update({
      estado: editEstado, prioridad: editPrioridad, notas: notasVal, notas_historial: nuevoHistorial,
    }).eq('id', ticketDetalle.id)
    if (!error) {
      setTickets(prev => prev.map(t => t.id === ticketDetalle.id
        ? { ...t, estado: editEstado, prioridad: editPrioridad, notas: notasVal, notas_historial: nuevoHistorial } : t))
      onTicketActualizado?.()
      if (ticketDetalle.correo_contacto) {
        console.log('[notify-ticket-status] invocando para', ticketDetalle.correo_contacto, editEstado)
        supabase.functions.invoke('notify-ticket-status', {
          body: {
            correo: ticketDetalle.correo_contacto,
            nombre: ticketDetalle.creado_por_nombre,
            area:   areaLabel(ticketDetalle),
            estado: editEstado,
            notas:  notasVal,   // solo la última nota va al correo
          },
        }).then(({ data, error }) => {
          if (error) console.error('[notify-ticket-status] error:', JSON.stringify(error))
          else console.log('[notify-ticket-status] OK', data)
        })
      }
      cerrarDetalle()
    }
    setGuardandoEdit(false)
  }

  const eliminarTicket = async (id) => {
    if (!puedeElim) return
    const { error } = await supabase.from('tickets').delete().eq('id', id)
    if (error) { console.error('Error al eliminar ticket:', error); return }
    setTickets(prev => prev.filter(t => t.id !== id))
    setConfirmarEliminar(false)
    cerrarDetalle()
  }

  const toggleSeleccion = (id) => setSeleccionados(prev => {
    const s = new Set(prev)
    s.has(id) ? s.delete(id) : s.add(id)
    return s
  })
  const toggleTodos = () => setSeleccionados(
    seleccionados.size === filtrados.length ? new Set() : new Set(filtrados.map(t => t.id))
  )
  const salirSeleccion = () => { setSeleccionados(new Set()); setConfirmandoBulk(false) }
  const eliminarSeleccionados = async () => {
    if (!puedeElim) return
    const { error } = await supabase.from('tickets').delete().in('id', [...seleccionados])
    if (error) { console.error('Error al eliminar tickets:', error); return }
    setTickets(prev => prev.filter(t => !seleccionados.has(t.id)))
    salirSeleccion()
  }

  const fmt = (iso) => new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
  const fmtCorta = (iso) => iso ? new Date(iso).toLocaleDateString('es-CL') : ''

  const nombreArchivo = (ext) => {
    const fecha = new Date().toISOString().slice(0, 10)
    return `${esGestor ? 'tickets' : 'mis-tickets'}_${fecha}.${ext}`
  }

  const getResumen = (datos) => {
    const resueltos = datos.filter(t => t.estado === 'Resuelto' && t.actualizado_en && t.creado_en)
    const promedio = resueltos.length
      ? (resueltos.reduce((s, t) => s + (new Date(t.actualizado_en) - new Date(t.creado_en)), 0) / resueltos.length / 86400000).toFixed(1)
      : null
    return {
      total:     datos.length,
      abiertos:  datos.filter(t => t.estado === 'Abierto').length,
      enProceso: datos.filter(t => t.estado === 'En proceso').length,
      resueltos: datos.filter(t => t.estado === 'Resuelto').length,
      urgentes:  datos.filter(t => t.prioridad === 'alta').length,
      promedio,
    }
  }

  const mostrarAviso = (msg) => { setAvisoExport(msg); setTimeout(() => setAvisoExport(''), 3500) }

  const exportarCSVTickets = () => {
    if (!filtrados.length) { mostrarAviso('No hay tickets para exportar.'); return }
    const COLS   = ['id','titulo','descripcion','area_reporte','lugar_falla','marca_modelo_falla','prioridad','estado','creado_en','actualizado_en','creado_por_nombre','rol_solicitante','correo_contacto','notas']
    const LABELS = ['N° Ticket','Título / Área','Descripción','Área','Lugar','Marca/Modelo','Prioridad','Estado','Fecha Creación','Última Actualización','Solicitante','Rol','Correo','Notas / Resolución']
    const esc = (v) => { if (v == null) return ''; const s = String(v); return (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g,'""')}"` : s }
    const filas = [LABELS.join(','), ...filtrados.map(t => COLS.map(c => {
      if (c === 'titulo')        return esc(areaLabel(t))
      if (c === 'creado_en' || c === 'actualizado_en') return esc(fmtCorta(t[c]))
      return esc(t[c])
    }).join(','))]
    const blob = new Blob(['﻿' + filas.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = nombreArchivo('csv'); a.click(); URL.revokeObjectURL(url)
    setMenuExportar(false)
    mostrarAviso('✅ CSV generado correctamente.')
  }

  const exportarExcelTickets = () => {
    if (!filtrados.length) { mostrarAviso('No hay tickets para exportar.'); return }
    setExportando(true); setMenuExportar(false)
    const cargar = () => {
      const res = getResumen(filtrados)
      const wb  = window.XLSX.utils.book_new()
      const wsResData = [
        ['Resumen de Tickets de Soporte'],
        ['Generado el', new Date().toLocaleDateString('es-CL')],
        [],
        ['Total de tickets', res.total],
        ['Abiertos',         res.abiertos],
        ['En proceso',       res.enProceso],
        ['Resueltos',        res.resueltos],
        ['Urgentes (Alta)',  res.urgentes],
        ['Prom. resolución (días)', res.promedio ?? 'N/A'],
      ]
      const wsRes = window.XLSX.utils.aoa_to_sheet(wsResData)
      wsRes['!cols'] = [{ wch: 30 }, { wch: 14 }]
      window.XLSX.utils.book_append_sheet(wb, wsRes, 'Resumen')
      const LABELS = ['N° Ticket','Título / Área','Descripción','Área','Lugar','Marca/Modelo','Prioridad','Estado','Fecha Creación','Última Actualización','Solicitante','Rol','Correo','Notas / Resolución']
      const filas  = [LABELS, ...filtrados.map(t => [
        t.id, areaLabel(t), t.descripcion ?? '', t.area_reporte ?? '', t.lugar_falla ?? '', t.marca_modelo_falla ?? '',
        t.prioridad ?? 'Sin asignar', t.estado,
        fmtCorta(t.creado_en), fmtCorta(t.actualizado_en),
        t.creado_por_nombre ?? '', t.rol_solicitante ?? '', t.correo_contacto ?? '', t.notas ?? '',
      ])]
      const ws = window.XLSX.utils.aoa_to_sheet(filas)
      ws['!cols'] = [8,24,38,18,18,18,13,13,15,17,22,18,26,38].map(w => ({ wch: w }))
      window.XLSX.utils.book_append_sheet(wb, ws, 'Tickets')
      window.XLSX.writeFile(wb, nombreArchivo('xlsx'))
      setExportando(false); mostrarAviso('✅ Excel generado correctamente.')
    }
    if (window.XLSX) { cargar(); return }
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
    s.onload  = cargar
    s.onerror = () => { setExportando(false); mostrarAviso('❌ No se pudo cargar la librería de Excel.') }
    document.head.appendChild(s)
  }

  const exportarPDFTickets = () => {
    if (!filtrados.length) { mostrarAviso('No hay tickets para exportar.'); return }
    setExportando(true); setMenuExportar(false)
    const res   = getResumen(filtrados)
    const fecha = new Date().toLocaleDateString('es-CL')
    const pBg = (p) => p === 'alta' ? '#fee2e2' : p === 'media' ? '#fef3c7' : p === 'baja' ? '#dcfce7' : '#f1f5f9'
    const eBg = (e) => e === 'Abierto' ? '#dbeafe' : e === 'En proceso' ? '#fef3c7' : e === 'Resuelto' ? '#dcfce7' : '#f1f5f9'
    const htmlContent = `<html><head><meta charset="utf-8"><style>
      body{font-family:Arial,sans-serif;font-size:10px;color:#111;margin:0;padding:20px}
      .hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;border-bottom:2px solid #1e3a8a;padding-bottom:10px}
      h1{font-size:15px;margin:0 0 3px;color:#1e3a8a} .sub{font-size:10px;color:#6b7280;margin:0}
      .kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-bottom:14px}
      .kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:7px 8px;text-align:center}
      .kv{font-size:18px;font-weight:800;line-height:1;margin:0} .kl{font-size:8px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin:3px 0 0}
      table{width:100%;border-collapse:collapse}
      th{background:#1e3a8a;color:white;padding:5px 6px;text-align:left;font-size:8px;text-transform:uppercase;letter-spacing:.04em}
      td{padding:4px 6px;border-bottom:1px solid #e5e7eb;font-size:9px;vertical-align:top}
      tr:nth-child(even) td{background:#f9fafb}
      .badge{display:inline-block;padding:2px 6px;border-radius:20px;font-size:8px;font-weight:700}
    </style></head><body>
      <div class="hdr"><div><h1>🎫 Tickets de Soporte</h1><p class="sub">Generado el ${fecha} · ${filtrados.length} ticket${filtrados.length !== 1 ? 's' : ''}</p></div></div>
      <div class="kpis">
        <div class="kpi"><p class="kv">${res.total}</p><p class="kl">Total</p></div>
        <div class="kpi"><p class="kv" style="color:#1d4ed8">${res.abiertos}</p><p class="kl">Abiertos</p></div>
        <div class="kpi"><p class="kv" style="color:#b45309">${res.enProceso}</p><p class="kl">En proceso</p></div>
        <div class="kpi"><p class="kv" style="color:#15803d">${res.resueltos}</p><p class="kl">Resueltos</p></div>
        <div class="kpi"><p class="kv" style="color:#b91c1c">${res.urgentes}</p><p class="kl">Urgentes</p></div>
        <div class="kpi"><p class="kv">${res.promedio !== null ? res.promedio + 'd' : '—'}</p><p class="kl">Prom. resolución</p></div>
      </div>
      <table><thead><tr><th>#</th><th>Título / Área</th><th>Descripción</th><th>Lugar</th><th>Prioridad</th><th>Estado</th><th>Creado</th><th>Actualizado</th><th>Solicitante</th><th>Notas</th></tr></thead>
      <tbody>${filtrados.map(t => `<tr>
        <td>${t.id}</td>
        <td>${areaLabel(t)}</td>
        <td>${(t.descripcion ?? '—').replace(/</g,'&lt;')}</td>
        <td>${(t.lugar_falla ?? '—').replace(/</g,'&lt;')}</td>
        <td><span class="badge" style="background:${pBg(t.prioridad)};color:#374151">${t.prioridad ?? '—'}</span></td>
        <td><span class="badge" style="background:${eBg(t.estado)};color:#374151">${t.estado}</span></td>
        <td>${fmtCorta(t.creado_en)}</td>
        <td>${fmtCorta(t.actualizado_en)}</td>
        <td>${(t.creado_por_nombre ?? '—').replace(/</g,'&lt;')}${t.rol_solicitante ? `<br/><span style="color:#6b7280;font-size:8px">${t.rol_solicitante}</span>` : ''}</td>
        <td>${(t.notas ?? '—').replace(/</g,'&lt;')}</td>
      </tr>`).join('')}</tbody></table>
    </body></html>`
    const cargar = () => {
      const opt = { margin:[10,8,10,8], filename: nombreArchivo('pdf'), image:{ type:'jpeg', quality:0.97 }, html2canvas:{ scale:2, backgroundColor:'#ffffff' }, jsPDF:{ unit:'mm', format:'a4', orientation:'landscape' } }
      const el = document.createElement('div'); el.innerHTML = htmlContent; document.body.appendChild(el)
      window.html2pdf().set(opt).from(el).save().then(() => { document.body.removeChild(el); setExportando(false); mostrarAviso('✅ PDF generado correctamente.') })
        .catch(() => { document.body.removeChild(el); setExportando(false); mostrarAviso('❌ Error al generar el PDF.') })
    }
    if (window.html2pdf) { cargar(); return }
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
    s.onload  = cargar
    s.onerror = () => { setExportando(false); mostrarAviso('❌ No se pudo cargar la librería de PDF.') }
    document.head.appendChild(s)
  }

  if (cargando) return (
    <div className="tickets-wrap">
      <SkeletonTickets />
    </div>
  )

  return (
    <motion.div
      className="tickets-wrap"
      variants={pageVariants}
      initial={shouldReduce ? false : 'hidden'}
      animate="visible"
    >

      <div className="tickets-page-header">
        <div className="tickets-page-header-left">
          <p className="tickets-page-title">Tickets de soporte</p>
          <p className="tickets-page-sub">{esGestor ? 'Gestiona y resuelve los reportes del equipo' : 'Reporta fallas o incidencias del establecimiento'}</p>
        </div>
      </div>

      {/* KPIs — gestores (admin y soporte) */}
      {esGestor && (
        <div className="tickets-kpis">
          {['Abierto', 'En proceso', 'Resuelto'].map((e, i) => {
            const n = tickets.filter(t => t.estado === e).length
            const total = tickets.length || 1
            const pct = Math.round((n / total) * 100)
            return (
              <motion.div
                key={e}
                className={`tickets-kpi${filtroEstado === e ? ' activo' : ''}`}
                style={{ '--kpi-border': KPI_BORDER[e] }}
                {...kpiAnim(i)}
                onClick={() => setFiltroEstado(filtroEstado === e ? '' : e)}
              >
                <div className="tickets-kpi-icon-wrap" style={{ color: KPI_BORDER[e] }}>
                  {KPI_ICONS[e]}
                </div>
                <div className="tickets-kpi-content">
                  <p className="tickets-kpi-val">{n}</p>
                  <p className="tickets-kpi-lbl">{e}</p>
                  <div className="tickets-kpi-bar">
                    <div className="tickets-kpi-bar-fill" style={{ width: `${pct}%`, background: KPI_BORDER[e] }} />
                  </div>
                </div>
              </motion.div>
            )
          })}
          {/* Esta semana */}
          <motion.div className="tickets-kpi tickets-kpi--semana" {...kpiAnim(3)}>
            <div className="tickets-kpi-icon-wrap" style={{ color: '#6366f1' }}>
              {KPI_ICONS.semana}
            </div>
            <div className="tickets-kpi-content">
              <p className="tickets-kpi-val">{semanaResueltos}</p>
              <p className="tickets-kpi-lbl">Últ. 7 días</p>
              <div className="tickets-kpi-spark">
                <svg width="64" height="20" viewBox="0 0 64 20" className="tk-spark-svg">
                  {sparkData.map((v, idx) => {
                    const h = Math.max(Math.round((v / sparkMax) * 16), 2)
                    return (
                      <rect key={idx} x={idx * 10} y={20 - h} width="8" height={h} rx="2"
                        fill={idx === 6 ? '#6366f1' : 'rgba(99,102,241,0.25)'} />
                    )
                  })}
                </svg>
                <span className="tickets-kpi-spark-lbl">últ. 7 días</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Fila buscador + botones */}
      <div className="tickets-toolbar-row" style={{ display: 'flex', gap: 10, marginBottom: '0.9rem', alignItems: 'center' }}>
        <div className="tickets-search-wrap" style={{ flex: 1, marginBottom: 0 }}>
          <span className="tickets-search-icon">🔍</span>
          <input
            className="tickets-search-input"
            type="text"
            placeholder="Buscar por área, descripción, nombre…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
          {busqueda && (
            <button className="tickets-search-clear" onClick={() => setBusqueda('')}>✕</button>
          )}
        </div>

        {/* Botón Exportar */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button className="btn-exportar-tickets" onClick={() => setMenuExportar(v => !v)} disabled={exportando}>
            {exportando ? <span className="tk-export-spinner" /> : '⬇'}
            {exportando ? ' Generando…' : ' Exportar ▾'}
          </button>
          {menuExportar && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setMenuExportar(false)} />
              <div className="tk-export-menu">
                <p className="tk-export-menu-title">
                  {filtroEstado || filtroPrioridad || filtroArea || filtroRol || busqueda.trim()
                    ? `Exportar ${filtrados.length} filtrado${filtrados.length !== 1 ? 's' : ''}`
                    : 'Exportar vista actual'}
                </p>
                {[
                  { icon: '📄', label: 'CSV',   desc: 'Texto separado por comas',  fn: exportarCSVTickets },
                  { icon: '📊', label: 'Excel', desc: 'Hoja de cálculo .xlsx',     fn: exportarExcelTickets },
                  { icon: '📕', label: 'PDF',   desc: 'Tabla en PDF A4 (apaisado)', fn: exportarPDFTickets },
                ].map(({ icon, label, desc, fn }) => (
                  <button key={label} className="tk-export-menu-item" onClick={fn}>
                    <span style={{ fontSize: '1.1rem' }}>{icon}</span>
                    <div>
                      <p className="tk-export-menu-label">{label}</p>
                      <p className="tk-export-menu-desc">{desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {puedeCrear && <button className="btn-nuevo-ticket" onClick={abrirNuevo}>+ Nuevo ticket</button>}
      </div>

      {/* Filtros */}
      {esGestor && (
        <div className="tickets-filtros" style={{ marginBottom: '1.1rem' }}>
          <select className={filtroEstado ? 'activo' : ''} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="Abierto">🔵 Abierto</option>
            <option value="En proceso">🟡 En proceso</option>
            <option value="Resuelto">🟢 Resuelto</option>
          </select>
          <select className={filtroPrioridad ? 'activo' : ''} value={filtroPrioridad} onChange={e => setFiltroPrioridad(e.target.value)}>
            <option value="">Todas las prioridades</option>
            <option value="alta">🔴 Alta</option>
            <option value="media">🟡 Media</option>
            <option value="baja">🟢 Baja</option>
          </select>
          <select className={filtroArea ? 'activo' : ''} value={filtroArea} onChange={e => setFiltroArea(e.target.value)}>
            <option value="">Todas las áreas</option>
            {AREAS.filter(a => a !== 'Otro').map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
            <option value="Otro">Otro</option>
          </select>
          <select className={filtroRol ? 'activo' : ''} value={filtroRol} onChange={e => setFiltroRol(e.target.value)}>
            <option value="">Todos los roles</option>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          {(filtroEstado || filtroPrioridad || filtroArea || filtroRol) && (
            <button className="btn-limpiar-filtros" onClick={() => { setFiltroEstado(''); setFiltroPrioridad(''); setFiltroArea(''); setFiltroRol('') }}>✕ Limpiar</button>
          )}
        </div>
      )}

      {/* Barra selección — solo visible cuando hay algo seleccionado */}
      {esGestor && seleccionados.size > 0 && filtrados.length > 0 && (
        <div className={`tickets-sel-bar ${seleccionados.size > 0 ? 'tickets-sel-bar--activa' : ''}`}>
          <label className="tickets-sel-label">
            <label className="tk-check-wrap">
              <input
                type="checkbox"
                className="tk-check-input"
                checked={seleccionados.size === filtrados.length && filtrados.length > 0}
                ref={el => { if (el) el.indeterminate = seleccionados.size > 0 && seleccionados.size < filtrados.length }}
                onChange={toggleTodos}
              />
              <span className="tk-check-box" />
            </label>
            {seleccionados.size > 0
              ? <><span className="tickets-sel-count">{seleccionados.size}</span> Seleccionado{seleccionados.size !== 1 ? 's' : ''}</>
              : <>Seleccionar todos <span className="tickets-sel-total">({filtrados.length})</span></>
            }
          </label>

          {puedeElim && seleccionados.size > 0 && (
            <button className="tickets-sel-btn-del" onClick={() => setConfirmandoBulk(true)}>
              🗑 Eliminar {seleccionados.size} ticket{seleccionados.size !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      )}

      {/* Modal confirmación bulk */}
      {confirmandoBulk && (
        <div className="modal-tickets-overlay" onClick={() => setConfirmandoBulk(false)}>
          <div className="modal-tickets" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-tickets-header">
              <h2 className="modal-tickets-title">🗑 Eliminar tickets</h2>
              <button className="modal-tickets-close" onClick={() => setConfirmandoBulk(false)}>✕</button>
            </div>
            <p style={{ margin: '0 0 20px', fontSize: '0.9rem', color: '#374151' }}>
              ¿Eliminar <strong>{seleccionados.size} ticket{seleccionados.size !== 1 ? 's' : ''}</strong> seleccionado{seleccionados.size !== 1 ? 's' : ''}? Esta acción no se puede deshacer.
            </p>
            <div className="modal-actions">
              <button className="btn-modal-cancel" onClick={() => setConfirmandoBulk(false)}>Cancelar</button>
              <button className="btn-modal-del" onClick={eliminarSeleccionados}>Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Lista */}
      {filtrados.length === 0 ? (
        <div className="tickets-empty">
          <div className="tickets-empty-icon">🎫</div>
          <p>{tickets.length === 0 ? 'Aún no hay tickets registrados' : 'No hay tickets con estos filtros'}</p>
        </div>
      ) : (
        <div className="tickets-lista">
          {filtradosPagT.map(t => {
            const e = ESTADO[t.estado]
            const p = t.prioridad ? PRIORIDAD[t.prioridad] : null
            const prioClass = t.prioridad ? ` ticket-card--${t.prioridad}` : ''
            const selClass  = seleccionados.has(t.id) ? ' ticket-card-sel' : ''
            return (
              <motion.div
                key={t.id}
                className={`ticket-card${prioClass}${selClass}`}
                onClick={() => abrirDetalle(t)}
                whileHover={shouldReduce ? {} : { y: -2, transition: { duration: 0.16 } }}
              >
                <div className="ticket-card-body">
                  {esGestor && (
                    <label className="tk-check-wrap" onClick={ev => ev.stopPropagation()}>
                      <input type="checkbox" className="tk-check-input"
                        checked={seleccionados.has(t.id)}
                        onChange={() => toggleSeleccion(t.id)} />
                      <span className="tk-check-box" />
                    </label>
                  )}
                  <div className="ticket-card-info">
                    <p className="ticket-titulo">{areaLabel(t)}</p>
                    <p className="ticket-bien">📍 {t.lugar_falla || '—'}</p>
                    {t.descripcion && <p className="ticket-desc">{t.descripcion}</p>}
                    <p className="ticket-meta">Por {t.creado_por_nombre}{t.rol_solicitante ? ` · ${t.rol_solicitante}` : ''} · {fmt(t.creado_en)}</p>
                  </div>
                  <div className="ticket-badges">
                    <span className="badge-estado" style={{ background: e.bg, color: e.color }}>{t.estado}</span>
                    {p && <span className="badge-prio" style={{ background: p.bg, color: p.color }}>{p.label}</span>}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Paginación tickets */}
      {totalPagsT > 1 && (
        <div className="tk-pag-wrap">
          <button className="tk-pag-btn" onClick={() => setPaginaT(1)} disabled={paginaT === 1}>«</button>
          <button className="tk-pag-btn" onClick={() => setPaginaT(p => p - 1)} disabled={paginaT === 1}>‹ Ant.</button>
          <span className="tk-pag-info">Pág. {paginaT} / {totalPagsT} · {filtrados.length} tickets</span>
          <button className="tk-pag-btn" onClick={() => setPaginaT(p => p + 1)} disabled={paginaT >= totalPagsT}>Sig. ›</button>
          <button className="tk-pag-btn" onClick={() => setPaginaT(totalPagsT)} disabled={paginaT >= totalPagsT}>»</button>
        </div>
      )}

      {/* ── Modal: Nuevo ticket ── */}
      {modalNuevo && (
        <div className="modal-tickets-overlay" onClick={!exito ? cerrarNuevo : undefined}>
          <div className="modal-tickets" onClick={e => e.stopPropagation()}>
            <div className="modal-tickets-header">
              <h2 className="modal-tickets-title">🎫 Nuevo ticket</h2>
              {!exito && <button className="modal-tickets-close" onClick={cerrarNuevo}>✕</button>}
            </div>

            {/* ── Pantalla de éxito ── */}
            {exito && (
              <div className="ticket-exito">
                <button className="ticket-exito-cerrar" onClick={cerrarNuevo} aria-label="Cerrar">✕</button>
                <div className="ticket-exito-icono">✅</div>
                <p className="ticket-exito-titulo">¡Ticket creado con éxito!</p>
                <p className="ticket-exito-sub">Tu solicitud fue registrada correctamente.</p>
                <div className="ticket-exito-barra">
                  <div className="ticket-exito-barra-fill" />
                </div>
              </div>
            )}

            {/* ── Formulario (oculto durante éxito) ── */}
            {!exito && <><p className="modal-seccion-label">Información de contacto</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="modal-field">
                  <label className="modal-label">Nombre *</label>
                  <input className="modal-input" value={form.nombre} onChange={e => setF('nombre', e.target.value)} placeholder="Nombre" />
                </div>
                <div className="modal-field">
                  <label className="modal-label">Apellidos *</label>
                  <input className="modal-input" value={form.apellidos} onChange={e => setF('apellidos', e.target.value)} placeholder="Apellidos" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="modal-field">
                  <label className="modal-label">Rol *</label>
                  <select className="modal-select" value={form.rol_solicitante} onChange={e => setF('rol_solicitante', e.target.value)}>
                    <option value="">Seleccionar…</option>
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="modal-field">
                  <label className="modal-label">Correo electrónico *</label>
                  <input className="modal-input" type="email" value={form.correo_contacto} onChange={e => setF('correo_contacto', e.target.value)} placeholder="correo@liceo.cl" />
                </div>
              </div>
            </div>

            {/* ── Sección 2: Reporte ── */}
            <p className="modal-seccion-label" style={{ marginTop: 18 }}>Reporte de falla o incidencia</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="modal-field">
                <label className="modal-label">Área del reporte *</label>
                <select className="modal-select" value={form.area_reporte} onChange={e => setF('area_reporte', e.target.value)}>
                  <option value="">Seleccionar…</option>
                  {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              {form.area_reporte === 'Otro' && (
                <div className="modal-field">
                  <label className="modal-label">¿Cuál?</label>
                  <input className="modal-input" value={form.area_otro} onChange={e => setF('area_otro', e.target.value)} placeholder="Especifica el área…" />
                </div>
              )}
              <div className="modal-field">
                <label className="modal-label">Marca y modelo del dispositivo con falla <span style={{ color: '#9ca3af', fontWeight: 400 }}>(si corresponde)</span></label>
                <input className="modal-input" value={form.marca_modelo_falla} onChange={e => setF('marca_modelo_falla', e.target.value)} placeholder="Ej: HP ProBook 440 G7" />
              </div>
              <div className="modal-field">
                <label className="modal-label">Lugar donde se detecta la falla *</label>
                <input className="modal-input" value={form.lugar_falla} onChange={e => setF('lugar_falla', e.target.value)} placeholder="Nº de sala, curso, oficina, etc." />
              </div>
              <div className="modal-field">
                <label className="modal-label">Describe la falla o incidencia *</label>
                <textarea className="modal-textarea" value={form.descripcion} onChange={e => setF('descripcion', e.target.value)} placeholder="Detalla el problema…" />
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn-modal-cancel" onClick={cerrarNuevo}>Cancelar</button>
              <button className="btn-modal-save" onClick={crearTicket} disabled={guardando || !formValido}>
                {guardando ? 'Guardando…' : 'Crear ticket'}
              </button>
            </div>
            </>}
          </div>
        </div>
      )}

      {/* ── Modal: Ver / Actualizar ticket ── */}
      {ticketDetalle && (
        <div className="modal-tickets-overlay" onClick={cerrarDetalle}>
          <div className="modal-tickets" onClick={e => e.stopPropagation()}>
            <div className="modal-tickets-header">
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem', color: '#111827' }}>{areaLabel(ticketDetalle)}</p>
                <p style={{ margin: '2px 0 0', fontSize: '0.73rem', color: '#9ca3af' }}>{fmt(ticketDetalle.creado_en)}</p>
              </div>
              <button className="modal-tickets-close" onClick={cerrarDetalle}>✕</button>
            </div>

            {/* Datos del solicitante */}
            <div className="ticket-detalle-bien" style={{ marginBottom: 10 }}>
              <p className="modal-seccion-label" style={{ margin: '0 0 8px' }}>Solicitante</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 16px', fontSize: '0.82rem' }}>
                <span>👤 {ticketDetalle.creado_por_nombre}</span>
                {ticketDetalle.rol_solicitante && <span>🏷️ {ticketDetalle.rol_solicitante}</span>}
                {ticketDetalle.correo_contacto && <span style={{ gridColumn: '1/-1' }}>✉️ {ticketDetalle.correo_contacto}</span>}
              </div>
            </div>

            {/* Datos del reporte */}
            <div className="ticket-detalle-bien" style={{ marginBottom: 10 }}>
              <p className="modal-seccion-label" style={{ margin: '0 0 8px' }}>Reporte</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 16px', fontSize: '0.82rem' }}>
                <span style={{ gridColumn: '1/-1' }}>🖥️ Área: {areaLabel(ticketDetalle)}</span>
                {ticketDetalle.lugar_falla && <span style={{ gridColumn: '1/-1' }}>📍 {ticketDetalle.lugar_falla}</span>}
                {ticketDetalle.marca_modelo_falla && <span style={{ gridColumn: '1/-1' }}>🔧 {ticketDetalle.marca_modelo_falla}</span>}
              </div>
            </div>

            {ticketDetalle.descripcion && (
              <div className="ticket-detalle-desc">{ticketDetalle.descripcion}</div>
            )}
            {!esGestor && ticketDetalle.notas && (
              <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '9px 12px', fontSize: '0.83rem', color: '#166534', marginBottom: 14 }}>
                📝 <strong>Notas:</strong> {ticketDetalle.notas}
              </div>
            )}

            {esGestor ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="modal-field">
                      <label className="modal-label">Estado</label>
                      <select className="modal-select" value={editEstado} onChange={e => setEditEstado(e.target.value)}>
                        <option value="Abierto">🔵 Abierto</option>
                        <option value="En proceso">🟡 En proceso</option>
                        <option value="Resuelto">🟢 Resuelto</option>
                      </select>
                    </div>
                    <div className="modal-field">
                      <label className="modal-label">Prioridad</label>
                      <select className="modal-select" value={editPrioridad ?? ''} onChange={e => setEditPrioridad(e.target.value || null)}>
                        <option value="">Sin asignar</option>
                        <option value="alta">🔴 Alta</option>
                        <option value="media">🟡 Media</option>
                        <option value="baja">🟢 Baja</option>
                      </select>
                    </div>
                  </div>
                  <div className="modal-field">
                    <label className="modal-label">Notas / Resolución <span style={{ color: '#d4a017', fontWeight: 400 }}>(se enviará por correo al solicitante)</span></label>
                    {(ticketDetalle.notas_historial ?? []).length > 0 && (
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', maxHeight: 160, overflowY: 'auto', marginBottom: 8 }}>
                        <p style={{ margin: '0 0 8px', fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📋 Historial</p>
                        {[...(ticketDetalle.notas_historial ?? [])].reverse().map((entry, i, arr) => (
                          <div key={i} style={{ borderTop: i > 0 ? '1px solid #e5e7eb' : 'none', paddingTop: i > 0 ? 6 : 0, marginTop: i > 0 ? 6 : 0 }}>
                            <p style={{ margin: '0 0 2px', fontSize: '0.7rem', color: '#9ca3af' }}>
                              {new Date(entry.fecha).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}{' '}
                              {new Date(entry.fecha).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                              {i === 0 && <span style={{ marginLeft: 6, background: '#dbeafe', color: '#1d4ed8', borderRadius: 4, padding: '1px 6px', fontSize: '0.65rem', fontWeight: 700 }}>última</span>}
                            </p>
                            <p style={{ margin: 0, fontSize: '0.82rem', color: '#374151' }}>{entry.texto}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    <textarea className="modal-textarea" value={editNotas} onChange={e => { if (contarPalabras(e.target.value) <= MAX_PALABRAS) setEditNotas(e.target.value) }} placeholder="Agrega observaciones o cómo se resolvió…" />
                    <p style={{ margin: '3px 0 0', fontSize: '0.73rem', textAlign: 'right', color: contarPalabras(editNotas) >= MAX_PALABRAS ? '#dc2626' : '#9ca3af' }}>
                      {contarPalabras(editNotas)}/{MAX_PALABRAS} palabras
                    </p>
                  </div>
                </div>
                {confirmarEliminar ? (
                  <div style={{ marginTop: '1.5rem', background: '#fff1f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '14px 16px' }}>
                    <p style={{ margin: '0 0 12px', fontSize: '0.88rem', fontWeight: 600, color: '#b91c1c' }}>¿Eliminar este ticket? Esta acción no se puede deshacer.</p>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button className="btn-modal-cancel" onClick={() => setConfirmarEliminar(false)}>Cancelar</button>
                      <button className="btn-modal-del" onClick={() => eliminarTicket(ticketDetalle.id)}>Sí, eliminar</button>
                    </div>
                  </div>
                ) : (
                  <div className="modal-actions-split">
                    {puedeElim && <button className="btn-modal-del" onClick={() => setConfirmarEliminar(true)}>Eliminar</button>}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn-modal-cancel" onClick={cerrarDetalle}>Cancelar</button>
                      <button className="btn-modal-save" onClick={guardarCambios} disabled={guardandoEdit}>
                        {guardandoEdit ? 'Guardando…' : 'Guardar cambios'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: ESTADO[ticketDetalle.estado].bg, color: ESTADO[ticketDetalle.estado].color, borderRadius: 8, padding: '6px 14px', fontWeight: 700, fontSize: '0.85rem' }}>
                    {ESTADO[ticketDetalle.estado].icon} {ticketDetalle.estado}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <button className="btn-modal-cancel" onClick={cerrarDetalle}>Cerrar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Toast exportación */}
      {avisoExport && (
        <div className={`tk-aviso-export ${avisoExport.startsWith('❌') ? 'tk-aviso-export--error' : ''}`}>
          {avisoExport}
        </div>
      )}
    </motion.div>
  )
}
