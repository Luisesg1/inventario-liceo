import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../supabase'
import './Auditoria.css'

const ACCION_META = {
  crear:    { color: '#16a34a', bg: '#dcfce7', label: 'Creado',    icono: '➕' },
  editar:   { color: '#2563eb', bg: '#dbeafe', label: 'Editado',   icono: '✏️' },
  eliminar: { color: '#dc2626', bg: '#fee2e2', label: 'Eliminado', icono: '🗑️' },
  ver:                         { color: '#0891b2', bg: '#ecfeff',   label: 'Visualizado',         icono: '👁️' },
  descargar:                   { color: '#7c3aed', bg: '#ede9fe',   label: 'Descargado',          icono: '⬇️' },
  nueva_version:               { color: '#0369a1', bg: '#e0f2fe',   label: 'Nueva versión',       icono: '🔄' },
  enviado_a_papelera:          { color: '#9a3412', bg: '#ffedd5',   label: 'Enviado a papelera',  icono: '🗑️' },
  restaurado:                  { color: '#15803d', bg: '#dcfce7',   label: 'Restaurado',          icono: '↩️' },
  eliminado_permanente_manual: { color: '#dc2626', bg: '#fee2e2',   label: 'Eliminado permanente',icono: '💀' },
  eliminado_permanente_auto:   { color: '#9ca3af', bg: '#f3f4f6',   label: 'Eliminado (auto)',    icono: '🤖' },
  eliminacion_multiple:        { color: '#dc2626', bg: '#fee2e2',   label: 'Eliminación masiva',  icono: '🗑️' },
  restauracion_masiva:         { color: '#15803d', bg: '#dcfce7',   label: 'Restauración masiva', icono: '↩️' },
  vaciado_papelera:            { color: '#7f1d1d', bg: '#fef2f2',   label: 'Papelera vaciada',    icono: '🗑️' },
}

const CAMPO_LABEL = {
  nombre: 'Nombre', estado: 'Estado', ubicacion: 'Ubicación', responsable: 'Responsable',
  categoria: 'Categoría', codigo: 'Código', cantidad: 'Cantidad', obs: 'Observaciones',
  tipo: 'Tipo', marca: 'Marca', modelo: 'Modelo', numero_serie: 'N° Serie',
  cpu: 'CPU', ram: 'RAM', ram_tipo: 'Tipo RAM', memoria: 'Almacenamiento',
  sistema_operativo: 'S.O.', pantalla: 'Pantalla', isbn: 'ISBN', autor: 'Autor', genero: 'Género',
  fecha_adquisicion: 'Fecha adquisición', proveedor: 'Proveedor',
  numero_factura: 'N° Factura', numero_orden: 'N° Orden', fondo: 'Fondo', garantia: 'Garantía',
}

const CAMPO_LABEL_REQ = {
  numero_req: 'N° Manual', fecha: 'Fecha', contenido: 'Contenido',
  solicitante: 'Solicitante', fondo: 'Fondo', dimension: 'Dimensión',
  sub_dimension: 'Sub-Dimensión', accion: 'Acción',
  monto_solicitado: 'Monto Solicitado', monto_real: 'Monto Real',
  estado: 'Estado', fecha_recepcion: 'Fecha Recepción',
  orden_compra: 'Orden de Compra', rut_proveedor: 'RUT Proveedor',
  numero_factura: 'N° Factura', evidencia: 'Evidencia', observacion: 'Observación',
}

const CAMPO_LABEL_PERMISOS = {
  ver_inventario: 'Ver inventario', agregar_bien: 'Agregar bien',
  editar_bien: 'Editar bien', eliminar_bien: 'Eliminar bien',
  eliminar_lote: 'Eliminar en lote', gestionar_categorias: 'Gestionar categorías',
  importar_csv: 'Importar CSV', gestionar_usuarios: 'Gestionar usuarios',
  exportar: 'Exportar', registrar_prestamo: 'Registrar préstamo',
  registrar_incidencia: 'Registrar incidencia',
  ver_tickets: 'Ver tickets (propios)', crear_ticket: 'Crear nuevo ticket',
  gestionar_tickets: 'Gestionar todos los tickets', eliminar_ticket: 'Eliminar tickets',
  ver_requerimientos: 'Ver requerimientos', crear_requerimiento: 'Crear requerimiento',
  editar_requerimiento: 'Editar requerimiento', eliminar_requerimiento: 'Eliminar requerimiento',
  importar_requerimientos: 'Importar requerimientos', exportar_requerimientos: 'Exportar requerimientos',
  ver_auditoria_requerimientos: 'Ver auditoría de requerimientos',
  ver_ausencias: 'Ver ausencias del personal', gestionar_ausencias: 'Registrar/editar ausencias',
  ver_auditoria_permisos: 'Ver auditoría de ausencias',
  notificar_ausencia_correo: 'Notificar ausencia por correo',
  ver_compensatorios: 'Ver días compensatorios',
  invitar_usuario: 'Invitar usuarios', editar_usuario: 'Editar usuarios',
  eliminar_usuario: 'Eliminar usuarios',
}

const CAMPO_LABEL_AUSENCIAS = {
  tipo: 'Tipo', periodo: 'Período', fecha_inicio: 'Desde', fecha_fin: 'Hasta',
  jornada: 'Jornada', hora_inicio: 'Hora inicio', hora_fin: 'Hora fin', notas: 'Motivo',
}

const CAMPO_LABEL_TICKETS = {
  titulo:              'Título',
  descripcion:         'Descripción',
  area_reporte:        'Área',
  lugar_falla:         'Lugar',
  marca_modelo_falla:  'Marca/Modelo',
  prioridad:           'Prioridad',
  estado:              'Estado',
  notas:               'Notas / Resolución',
}

const POR_PAGINA = 15

const MODULO_LABEL = {
  inventario:     'Inventario',
  requerimientos: 'Requerimientos',
  permisos:       'Permisos',
  ausencias:      'Ausencias',
  tickets:        'Tickets',
  compensatorios: 'Compensatorios',
  reglamentos:    'Reglamentos',
  papelera:       'Papelera',
  personal:       'Personal',
}

const MODULO_TITLE = {
  inventario:     'Auditoría de Inventario',
  requerimientos: 'Auditoría de Requerimientos',
  ausencias:      'Auditoría de Ausencias',
  compensatorios: 'Auditoría de Compensatorios',
  permisos:       'Auditoría de Permisos',
  tickets:        'Auditoría de Tickets',
  reglamentos:    'Auditoría de Reglamentos',
  papelera:       'Auditoría de Papelera',
  personal:       'Auditoría de Personal',
}

const MODULO_DESC = {
  inventario:     'Consulta y revisa todas las acciones realizadas sobre los bienes.',
  requerimientos: 'Consulta y revisa todas las acciones realizadas sobre los requerimientos.',
  ausencias:      'Consulta y revisa todas las acciones realizadas sobre las ausencias.',
  compensatorios: 'Consulta y revisa todas las acciones realizadas sobre los días compensatorios.',
  permisos:       'Consulta y revisa los cambios de permisos del personal.',
  tickets:        'Consulta y revisa todas las acciones realizadas sobre los tickets.',
  reglamentos:    'Consulta y revisa todas las acciones realizadas sobre los documentos reglamentarios.',
  papelera:       'Consulta y revisa todas las acciones de la papelera del sistema.',
  personal:       'Consulta y revisa todas las acciones realizadas sobre el personal del establecimiento.',
}

const RESUMEN_META = [
  { accion: 'crear',    icono: '➕', label: 'Creados',    color: '#16a34a', bg: '#dcfce7' },
  { accion: 'editar',   icono: '✏️', label: 'Editados',   color: '#2563eb', bg: '#dbeafe' },
  { accion: 'eliminar', icono: '🗑️', label: 'Eliminados', color: '#dc2626', bg: '#fee2e2' },
]

const CAMPO_LABEL_COMPENSATORIOS = {
  tipo:           'Tipo',
  cantidad:       'Días ganados',
  saldo_restante: 'Saldo restante',
  fecha_ganado:   'Fecha ganado',
  vence_en:       'Vencimiento',
  motivo:         'Motivo',
  observaciones:  'Observaciones',
  estado:         'Estado',
}

const CAMPO_LABEL_REGLAMENTOS = {
  nombre:            'Nombre',
  descripcion:       'Descripción',
  categoria:         'Categoría',
  estado:            'Estado',
  fecha_publicacion: 'Fecha publicación',
  archivo:           'Archivo',
  version:           'Versión',
}

const CAMPO_LABEL_PERSONAL = {
  nombre_completo: 'Nombre completo',
  cargo:           'Cargo',
  estamento:       'Estamento',
  tipo_contrato:   'Tipo contrato',
  fecha_inicio:    'Fecha inicio',
  fecha_termino:   'Fecha término',
  estado:          'Estado',
  horas:           'Horas',
  correo:          'Correo',
  rut:             'RUT',
  telefono:        'Teléfono',
  nombre:          'Nombre',
}

const EXPORT_HEADERS = [
  'Fecha y hora', 'Módulo', 'Acción', 'Registro afectado',
  'Usuario', 'RUT', 'Correo', 'Rol', 'Detalle del cambio', 'Dispositivo',
]

function tiempoRelativo(fecha) {
  const min = Math.floor((Date.now() - new Date(fecha)) / 60000)
  if (min < 1)  return 'ahora mismo'
  if (min < 60) return `hace ${min} min`
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return `hace ${hrs} h`
  const dias = Math.floor(hrs / 24)
  return `hace ${dias} día${dias > 1 ? 's' : ''}`
}

function formatFecha(ts) {
  const d = new Date(ts)
  return d.toLocaleDateString('es-CL') + ' · ' + d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

function labelDia(ts) {
  const d    = new Date(ts)
  const hoy  = new Date()
  const ayer = new Date(); ayer.setDate(hoy.getDate() - 1)
  if (d.toDateString() === hoy.toDateString())  return 'Hoy'
  if (d.toDateString() === ayer.toDateString()) return 'Ayer'
  return d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function agruparPorDia(logs) {
  const items = []
  let diaActual = null
  logs.forEach(log => {
    const dia = new Date(log.creado_en).toDateString()
    if (dia !== diaActual) {
      diaActual = dia
      items.push({ esHeader: true, fecha: log.creado_en })
    }
    items.push({ esHeader: false, log })
  })
  return items
}

function cambiosTexto(cambios) {
  if (!Array.isArray(cambios)) return ''
  return cambios
    .filter(c => (c.anterior ?? '') !== '' || (c.nuevo ?? '') !== '')
    .map(c => `${c.campo}: ${c.anterior ?? '—'} → ${c.nuevo ?? '—'}`)
    .join('; ')
}

export default function Auditoria({ usuario, onVerBien, onVerCategoria, modulo = 'inventario', modulos, modoGeneral = false }) {
  const listaModulos  = modulos?.length ? modulos : [modulo]
  const [activeModulo, setActiveModulo] = useState(listaModulos[0])
  const [filtroModulo, setFiltroModulo] = useState('')   // solo en modoGeneral

  const [logs, setLogs]               = useState([])
  const [total, setTotal]             = useState(0)
  const [cargando, setCargando]       = useState(true)
  const [expandido, setExpandido]     = useState(null)
  const [restaurando, setRestaurando] = useState(null)
  const [aviso, setAviso]             = useState('')
  const [pagina, setPagina]           = useState(0)
  const [errorTabla, setErrorTabla]   = useState(false)
  const [categorias, setCategorias]   = useState([])
  const [resumen, setResumen]         = useState({})

  const [buscar,       setBuscar]       = useState('')
  const [buscadorVal,  setBuscadorVal]  = useState('')
  const [filtroAccion,  setFiltroAccion]  = useState('')
  const [filtroRol,     setFiltroRol]     = useState('')
  const [filtroCat,     setFiltroCat]     = useState('')
  const [filtroDesde,   setFiltroDesde]   = useState('')
  const [filtroHasta,   setFiltroHasta]   = useState('')
  const [filtroUsuario, setFiltroUsuario] = useState('')
  const [listaUsuarios, setListaUsuarios] = useState([])
  const [filtroEstadoTicket, setFiltroEstadoTicket] = useState('')

  const [exportando,   setExportando]   = useState(false)
  const [menuExportar, setMenuExportar] = useState(false)
  const [avisoExport,  setAvisoExport]  = useState('')

  const menuRef = useRef(null)

  // Resetear filtros al cambiar de módulo
  useEffect(() => {
    setBuscadorVal(''); setBuscar('')
    setFiltroAccion(''); setFiltroRol(''); setFiltroCat('')
    setFiltroDesde(''); setFiltroHasta('')
    setFiltroUsuario(''); setFiltroEstadoTicket('')
    if (!modoGeneral) setPagina(0)
  }, [activeModulo])

  useEffect(() => {
    if (modoGeneral) {
      setBuscadorVal(''); setBuscar('')
      setFiltroAccion(''); setFiltroRol(''); setFiltroCat('')
      setFiltroDesde(''); setFiltroHasta('')
      setFiltroUsuario(''); setFiltroEstadoTicket('')
      setFiltroModulo('')
      setPagina(0)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoGeneral])

  // Cerrar menú exportar al hacer clic fuera
  useEffect(() => {
    if (!menuExportar) return
    const handle = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuExportar(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [menuExportar])

  useEffect(() => {
    supabase.from('categorias').select('id,label,icon').order('label')
      .then(({ data }) => { if (data) setCategorias(data) })
  }, [])

  useEffect(() => {
    supabase.from('usuarios').select('id,nombre,rol').order('nombre')
      .then(({ data }) => { if (data) setListaUsuarios(data) })
  }, [])

  const cargarResumen = useCallback(async () => {
    setResumen({})
    const counts = {}
    const moduloFiltrado = modoGeneral ? (filtroModulo || null) : activeModulo
    await Promise.all(['crear', 'editar', 'eliminar'].map(async accion => {
      let q = supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('accion', accion)
      if (moduloFiltrado) q = q.eq('modulo', moduloFiltrado)
      else if (modoGeneral) q = q.in('modulo', listaModulos)
      else q = q.eq('modulo', activeModulo)
      const { count } = await q
      counts[accion] = count ?? 0
    }))
    setResumen(counts)
  }, [activeModulo, modoGeneral, filtroModulo])

  useEffect(() => { cargarResumen() }, [cargarResumen])

  const campoLabel = (campo, moduloLog) => {
    const m = moduloLog ?? activeModulo
    if (m === 'requerimientos') return CAMPO_LABEL_REQ[campo] ?? campo
    if (m === 'permisos')       return CAMPO_LABEL_PERMISOS[campo] ?? campo
    if (m === 'ausencias')      return CAMPO_LABEL_AUSENCIAS[campo] ?? campo
    if (m === 'tickets')        return CAMPO_LABEL_TICKETS[campo] ?? campo
    if (m === 'compensatorios') return CAMPO_LABEL_COMPENSATORIOS[campo] ?? campo
    if (m === 'reglamentos')    return CAMPO_LABEL_REGLAMENTOS[campo] ?? campo
    if (m === 'personal')       return CAMPO_LABEL_PERSONAL[campo] ?? campo
    return CAMPO_LABEL[campo] ?? campo
  }

  // Resuelve los IDs de usuarios que coinciden con el término de búsqueda
  const resolverUserIds = async (termino) => {
    if (!termino) return null
    const { data } = await supabase
      .from('usuarios')
      .select('id')
      .or(`nombre.ilike.%${termino}%,rut.ilike.%${termino}%,email.ilike.%${termino}%,rol.ilike.%${termino}%`)
    return (data ?? []).map(u => u.id)
  }

  // Devuelve los IDs de tickets que tienen el estado indicado (solo para modulo=tickets)
  const resolverTicketIdsPorEstado = async (estado) => {
    const moduloActivo = modoGeneral ? (filtroModulo || null) : activeModulo
    if (!estado || moduloActivo !== 'tickets') return null
    const { data } = await supabase.from('tickets').select('id').eq('estado', estado)
    return (data ?? []).map(t => String(t.id))
  }

  // Aplica los filtros comunes a una query de audit_logs
  const aplicarFiltros = (q, userIds, ticketIds) => {
    if (filtroAccion)  q = q.eq('accion', filtroAccion)
    if (filtroRol)     q = q.eq('usuario_rol', filtroRol)
    if (filtroUsuario) q = q.eq('usuario_id', filtroUsuario)
    const moduloActivo = modoGeneral ? (filtroModulo || null) : activeModulo
    if (moduloActivo === 'inventario' && filtroCat) q = q.eq('categoria', filtroCat)
    if (filtroDesde)   q = q.gte('creado_en', filtroDesde + 'T00:00:00')
    if (filtroHasta)   q = q.lte('creado_en', filtroHasta + 'T23:59:59')
    if (ticketIds !== null) {
      if (ticketIds.length) q = q.in('bien_id', ticketIds)
      else q = q.eq('bien_id', '00000000-0000-0000-0000-000000000000') // sin coincidencias
    }
    if (buscar) {
      const clauses = [`bien_nombre.ilike.%${buscar}%`, `usuario_nombre.ilike.%${buscar}%`]
      if (userIds?.length) clauses.push(`usuario_id.in.(${userIds.join(',')})`)
      q = q.or(clauses.join(','))
    }
    return q
  }

  const cargar = useCallback(async () => {
    setCargando(true)
    const userIds   = await resolverUserIds(buscar)
    const ticketIds = await resolverTicketIdsPorEstado(filtroEstadoTicket)
    let q = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('creado_en', { ascending: false })
      .range(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA - 1)
    if (modoGeneral) {
      if (filtroModulo) q = q.eq('modulo', filtroModulo)
      else              q = q.in('modulo', listaModulos)
    } else {
      q = q.eq('modulo', activeModulo)
    }
    q = aplicarFiltros(q, userIds, ticketIds)
    const { data, count, error } = await q
    if (error) { setErrorTabla(true); setCargando(false); return }
    setErrorTabla(false)
    setLogs(data ?? [])
    setTotal(count ?? 0)
    setCargando(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina, filtroAccion, filtroRol, filtroUsuario, filtroCat, filtroDesde, filtroHasta, buscar, activeModulo, filtroEstadoTicket, modoGeneral, filtroModulo])

  useEffect(() => { cargar() }, [cargar])

  // Búsqueda en tiempo real con debounce de 300 ms
  useEffect(() => {
    const t = setTimeout(() => { setBuscar(buscadorVal); setPagina(0) }, 300)
    return () => clearTimeout(t)
  }, [buscadorVal])

  const aplicarBusqueda = () => { setBuscar(buscadorVal); setPagina(0) }

  const limpiarFiltros = () => {
    setBuscadorVal(''); setBuscar('')
    setFiltroAccion(''); setFiltroRol(''); setFiltroCat('')
    setFiltroDesde(''); setFiltroHasta('')
    setFiltroUsuario('')
    setFiltroEstadoTicket('')
    setFiltroModulo('')
    setPagina(0)
  }

  const restaurarCampo = async (logId, campo) => {
    const key = logId + campo
    setRestaurando(key)
    const { error } = await supabase.rpc('restaurar_campo_auditoria', { p_audit_id: logId, p_campo: campo })
    if (error) setAviso('Error al restaurar: ' + error.message)
    else { setAviso('✓ Campo restaurado correctamente'); cargar() }
    setRestaurando(null)
  }

  const detectarDispositivo = (ua) => {
    if (!ua) return null
    if (/Mobile|Android|iPhone/.test(ua)) return '📱'
    if (/iPad|Tablet/.test(ua)) return '📱'
    return '💻'
  }

  const catLabel = (id) => {
    const c = categorias.find(c => c.id === id)
    return c ? `${c.icon ?? ''} ${c.label}`.trim() : id
  }

  // ── Exportación ───────────────────────────────────────────

  const mostrarAvisoExport = (msg) => {
    setAvisoExport(msg)
    setTimeout(() => setAvisoExport(''), 3500)
  }

  const nombreArchivo = (ext) => {
    const fecha = new Date().toISOString().slice(0, 10)
    const sufijo = modoGeneral ? (filtroModulo || 'general') : activeModulo
    return `auditoria_${sufijo}_${fecha}.${ext}`
  }

  // Obtiene TODOS los registros filtrados (sin paginación) y los enriquece con RUT/correo
  const fetchParaExportar = async () => {
    const userIds   = await resolverUserIds(buscar)
    const ticketIds = await resolverTicketIdsPorEstado(filtroEstadoTicket)
    let q = supabase
      .from('audit_logs')
      .select('*')
      .order('creado_en', { ascending: false })
      .limit(5000)
    if (modoGeneral) {
      if (filtroModulo) q = q.eq('modulo', filtroModulo)
      else              q = q.in('modulo', listaModulos)
    } else {
      q = q.eq('modulo', activeModulo)
    }
    q = aplicarFiltros(q, userIds, ticketIds)
    const { data: todos, error } = await q
    if (error || !todos) return []

    // Obtener RUT y correo de los usuarios involucrados
    const uids = [...new Set(todos.map(r => r.usuario_id).filter(Boolean))]
    let usuariosMap = {}
    if (uids.length) {
      const { data: uda } = await supabase
        .from('usuarios')
        .select('id,nombre,email,rut,rol')
        .in('id', uids)
      if (uda) usuariosMap = Object.fromEntries(uda.map(u => [u.id, u]))
    }

    return todos.map(r => ({
      ...r,
      usuario_rut:    usuariosMap[r.usuario_id]?.rut   ?? '',
      usuario_correo: usuariosMap[r.usuario_id]?.email ?? '',
    }))
  }

  const rowToArray = (r) => [
    new Date(r.creado_en).toLocaleString('es-CL'),
    MODULO_LABEL[r.modulo] ?? r.modulo ?? '',
    ACCION_META[r.accion]?.label ?? r.accion ?? '',
    r.bien_nombre ?? '',
    r.usuario_nombre ?? '',
    r.usuario_rut ?? '',
    r.usuario_correo ?? '',
    r.usuario_rol ?? '',
    cambiosTexto(r.cambios),
    r.dispositivo ?? '',
  ]

  const exportarCSV = async () => {
    setExportando(true); setMenuExportar(false)
    const todos = await fetchParaExportar()
    if (!todos.length) { setExportando(false); mostrarAvisoExport('No hay registros para exportar.'); return }
    const esc = (v) => {
      const s = String(v ?? '')
      return (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const filas = [EXPORT_HEADERS.join(','), ...todos.map(r => rowToArray(r).map(esc).join(','))]
    const blob = new Blob(['﻿' + filas.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = nombreArchivo('csv'); a.click()
    URL.revokeObjectURL(url)
    setExportando(false)
    mostrarAvisoExport('✅ CSV generado correctamente.')
  }

  const exportarExcel = async () => {
    setExportando(true); setMenuExportar(false)
    const todos = await fetchParaExportar()
    if (!todos.length) { setExportando(false); mostrarAvisoExport('No hay registros para exportar.'); return }
    const cargarXLSX = () => {
      const XLSX = window.XLSX
      const wb = XLSX.utils.book_new()
      const colWidths = [18, 14, 10, 30, 22, 12, 30, 12, 55, 28]
      const filas = [EXPORT_HEADERS, ...todos.map(rowToArray)]
      const ws = XLSX.utils.aoa_to_sheet(filas)
      ws['!cols'] = colWidths.map(w => ({ wch: w }))
      // Congelar primera fila
      ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' }
      // Filtros automáticos
      ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: EXPORT_HEADERS.length - 1 } }) }
      // Estilo encabezados
      const headerStyle = {
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 },
        fill: { fgColor: { rgb: '1A237E' }, patternType: 'solid' },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: { bottom: { style: 'thin', color: { rgb: 'FFFFFF' } } },
      }
      const dataStyle = {
        alignment: { wrapText: true, vertical: 'top' },
        font: { sz: 9 },
      }
      const range = XLSX.utils.decode_range(ws['!ref'])
      for (let C = range.s.c; C <= range.e.c; C++) {
        const hCell = XLSX.utils.encode_cell({ r: 0, c: C })
        if (ws[hCell]) ws[hCell].s = headerStyle
      }
      for (let R = 1; R <= range.e.r; R++) {
        for (let C = range.s.c; C <= range.e.c; C++) {
          const cell = XLSX.utils.encode_cell({ r: R, c: C })
          if (ws[cell]) ws[cell].s = { ...dataStyle, fill: { fgColor: { rgb: R % 2 === 0 ? 'F9FAFB' : 'FFFFFF' }, patternType: 'solid' } }
        }
      }
      ws['!rows'] = [{ hpt: 22 }]
      XLSX.utils.book_append_sheet(wb, ws, 'Auditoría')
      XLSX.writeFile(wb, nombreArchivo('xlsx'), { bookType: 'xlsx', cellStyles: true })
      setExportando(false)
      mostrarAvisoExport('✅ Excel generado correctamente.')
    }
    if (window.XLSX) { cargarXLSX(); return }
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
    s.onload  = cargarXLSX
    s.onerror = () => { setExportando(false); mostrarAvisoExport('❌ No se pudo cargar la librería Excel.') }
    document.head.appendChild(s)
  }

  const exportarPDF = async () => {
    setExportando(true); setMenuExportar(false)
    const todos = await fetchParaExportar()
    if (!todos.length) { setExportando(false); mostrarAvisoExport('No hay registros para exportar.'); return }
    const fecha    = new Date().toLocaleDateString('es-CL')
    const modLabel = MODULO_LABEL[activeModulo] ?? activeModulo
    // Columnas y anchos (%) para layout A4 horizontal fijo
    const colDefs = [
      { label: 'Fecha y hora',       pct: 10 },
      { label: 'Módulo',             pct:  7 },
      { label: 'Acción',             pct:  6 },
      { label: 'Registro afectado',  pct: 12 },
      { label: 'Usuario',            pct:  9 },
      { label: 'RUT',                pct:  7 },
      { label: 'Correo',             pct: 12 },
      { label: 'Rol',                pct:  6 },
      { label: 'Detalle del cambio', pct: 20 },
      { label: 'Dispositivo',        pct: 11 },
    ]
    const truncar = (s, max) => { const t = String(s ?? ''); return t.length > max ? t.slice(0, max) + '…' : t }
    const htmlContent = `<html><head><meta charset="utf-8"><style>
      body{font-family:Arial,sans-serif;font-size:8px;color:#111;margin:0;padding:14px}
      .hdr{border-bottom:2px solid #1a237e;padding-bottom:6px;margin-bottom:8px}
      h1{font-size:13px;margin:0 0 2px;color:#1a237e}
      .sub{font-size:8px;color:#6b7280;margin:0}
      table{width:100%;border-collapse:collapse;table-layout:fixed}
      col.narrow{} col.wide{}
      th{background:#1a237e;color:white;padding:4px 4px;text-align:left;font-size:7px;text-transform:uppercase;letter-spacing:.02em;word-break:break-word;overflow-wrap:break-word}
      td{padding:3px 4px;border-bottom:1px solid #e5e7eb;font-size:7.5px;vertical-align:top;word-break:break-word;overflow-wrap:break-word;overflow:hidden}
      tr:nth-child(even) td{background:#f9fafb}
      .crear{display:inline-block;padding:1px 4px;border-radius:10px;background:#dcfce7;color:#16a34a;font-weight:700;font-size:7px}
      .editar{display:inline-block;padding:1px 4px;border-radius:10px;background:#dbeafe;color:#2563eb;font-weight:700;font-size:7px}
      .eliminar{display:inline-block;padding:1px 4px;border-radius:10px;background:#fee2e2;color:#dc2626;font-weight:700;font-size:7px}
    </style></head><body>
      <div class="hdr">
        <h1>Auditoría — ${modLabel}</h1>
        <p class="sub">Generado el ${fecha} · ${todos.length} registro${todos.length !== 1 ? 's' : ''}</p>
      </div>
      <table>
        <colgroup>${colDefs.map(c => `<col style="width:${c.pct}%">`).join('')}</colgroup>
        <thead><tr>${colDefs.map(c => `<th>${c.label}</th>`).join('')}</tr></thead>
        <tbody>${todos.map(r => {
          const row = rowToArray(r)
          const cls = r.accion === 'crear' ? 'crear' : r.accion === 'editar' ? 'editar' : 'eliminar'
          const esc = (s, max = 999) => truncar(String(s ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;'), max)
          return `<tr>
            <td>${esc(row[0])}</td>
            <td>${esc(row[1])}</td>
            <td><span class="${cls}">${esc(row[2])}</span></td>
            <td>${esc(row[3], 60)}</td>
            <td>${esc(row[4], 40)}</td>
            <td>${esc(row[5])}</td>
            <td style="font-size:7px">${esc(row[6], 50)}</td>
            <td>${esc(row[7])}</td>
            <td style="font-size:7px">${esc(row[8], 180)}</td>
            <td style="font-size:7px">${esc(row[9], 60)}</td>
          </tr>`
        }).join('')}</tbody>
      </table>
    </body></html>`
    const cargarPDF = () => {
      const opt = {
        margin: [8, 6, 8, 6],
        filename: nombreArchivo('pdf'),
        image: { type: 'jpeg', quality: 0.97 },
        html2canvas: { scale: 2, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
      }
      const el = document.createElement('div')
      el.innerHTML = htmlContent
      document.body.appendChild(el)
      window.html2pdf().set(opt).from(el).save()
        .then(() => { document.body.removeChild(el); setExportando(false); mostrarAvisoExport('✅ PDF generado correctamente.') })
        .catch(() => { document.body.removeChild(el); setExportando(false); mostrarAvisoExport('❌ Error al generar el PDF.') })
    }
    if (window.html2pdf) { cargarPDF(); return }
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
    s.onload  = cargarPDF
    s.onerror = () => { setExportando(false); mostrarAvisoExport('❌ No se pudo cargar la librería PDF.') }
    document.head.appendChild(s)
  }

  // ── Paginación / UI helpers ───────────────────────────────

  const totalPaginas = Math.ceil(total / POR_PAGINA)
  const hayFiltros   = buscar || filtroAccion || filtroRol || filtroUsuario || filtroCat || filtroDesde || filtroHasta || filtroEstadoTicket || filtroModulo
  const agrupados    = agruparPorDia(logs)

  const bienesEliminados = useMemo(
    () => new Set(logs.filter(l => l.accion === 'eliminar' && l.bien_id).map(l => l.bien_id)),
    [logs]
  )

  const searchPlaceholder =
    activeModulo === 'requerimientos'  ? 'Buscar por requerimiento, usuario, RUT o correo…' :
    activeModulo === 'permisos'        ? 'Buscar por usuario, RUT o correo…' :
    activeModulo === 'ausencias'       ? 'Buscar por funcionario, RUT o correo…' :
    activeModulo === 'compensatorios'  ? 'Buscar por funcionario, RUT o correo…' :
    activeModulo === 'tickets'         ? 'Buscar por ticket, usuario, RUT o correo…' :
    'Buscar por bien, usuario, RUT o correo…'

  return (
    <div className="audit-wrap">

      {/* ── Selector de módulo (tabs) — solo en modo normal con más de un módulo ── */}
      {!modoGeneral && listaModulos.length > 1 && (
        <div className="audit-tabs">
          {listaModulos.map(m => (
            <button
              key={m}
              onClick={() => setActiveModulo(m)}
              className={`audit-tab-btn ${activeModulo === m ? 'audit-tab-active' : ''}`}
            >
              {MODULO_LABEL[m] ?? m}
            </button>
          ))}
        </div>
      )}

      {/* ── Cabecera moderna ── */}
      <div className="audit-header">
        <div className="audit-header-accent" />
        <div className="audit-header-content">
          <h1 className="audit-header-title">
            {modoGeneral
              ? 'Auditoría General'
              : (MODULO_TITLE[activeModulo] ?? `Auditoría — ${MODULO_LABEL[activeModulo] ?? activeModulo}`)}
          </h1>
          <p className="audit-header-desc">
            {modoGeneral
              ? 'Consulta y revisa todas las acciones de todos los módulos del sistema.'
              : (MODULO_DESC[activeModulo] ?? 'Consulta y revisa todas las acciones del sistema.')}
          </p>
        </div>
      </div>

      {/* ── Tarjetas de resumen ── */}
      <div className="audit-resumen">
        {RESUMEN_META.map(({ accion, icono, label, color, bg }) => (
          <div key={accion} className="audit-resumen-card" style={{ borderTop: `3px solid ${color}` }}>
            <div className="audit-resumen-icon" style={{ background: bg, color }}>
              {icono}
            </div>
            <div className="audit-resumen-count" style={{ color }}>
              {resumen[accion] != null ? resumen[accion].toLocaleString('es-CL') : '—'}
            </div>
            <div className="audit-resumen-label">{label}</div>
          </div>
        ))}
      </div>

      {/* ── Error: tabla no configurada ── */}
      {errorTabla && (
        <div className="audit-error-card">
          <p className="audit-error-title">⚠️ La tabla de auditoría no está configurada</p>
          <p className="audit-error-body">
            Ejecuta el archivo <strong>{activeModulo === 'inventario' ? 'supabase_auditoria.sql' : 'supabase_auditoria_modulos.sql'}</strong> en el SQL Editor de Supabase para activar el sistema de auditoría.
          </p>
        </div>
      )}

      {/* ── Filtros ── */}
      <div className="audit-card audit-filtros-card">

        {/* Fila de búsqueda */}
        <div className="audit-search-row">
          <div className="audit-search-wrapper">
            <span className="audit-search-icon">🔍</span>
            <input
              className="audit-search-input"
              placeholder={searchPlaceholder}
              value={buscadorVal}
              onChange={e => setBuscadorVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && aplicarBusqueda()}
            />
          </div>
          <button className="audit-btn-primary" onClick={aplicarBusqueda}>Buscar</button>

          {/* Botón Exportar */}
          <div className="audit-export-wrap" ref={menuRef}>
            <button
              className="audit-btn-export"
              onClick={() => setMenuExportar(v => !v)}
              disabled={exportando}
              title="Exportar registros filtrados"
            >
              {exportando ? '⏳' : '↓'} Exportar
            </button>
            {menuExportar && (
              <div className="audit-export-menu">
                <button className="audit-export-item" onClick={exportarExcel}>
                  <span className="audit-export-icon">📊</span> Excel (.xlsx)
                </button>
                <button className="audit-export-item" onClick={exportarPDF}>
                  <span className="audit-export-icon">📄</span> PDF
                </button>
                <button className="audit-export-item" onClick={exportarCSV}>
                  <span className="audit-export-icon">📋</span> CSV
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Fila de filtros */}
        <div className="audit-filtros-grid">

          {/* Filtro de módulo — solo en modo general */}
          {modoGeneral && (
            <select
              className={`audit-select ${filtroModulo ? 'audit-select-active' : ''}`}
              value={filtroModulo}
              onChange={e => { setFiltroModulo(e.target.value); setPagina(0) }}
            >
              <option value="">🗂️ Todos los módulos</option>
              {listaModulos.map(m => (
                <option key={m} value={m}>{MODULO_LABEL[m] ?? m}</option>
              ))}
            </select>
          )}

          {listaUsuarios.length > 0 && (
            <select
              className={`audit-select ${filtroUsuario ? 'audit-select-active' : ''}`}
              value={filtroUsuario}
              onChange={e => { setFiltroUsuario(e.target.value); setPagina(0) }}
            >
              <option value="">👤 Todos los usuarios</option>
              {listaUsuarios.map(u => (
                <option key={u.id} value={u.id}>{u.nombre}</option>
              ))}
            </select>
          )}

          <select className="audit-select" value={filtroAccion}
            onChange={e => { setFiltroAccion(e.target.value); setPagina(0) }}>
            <option value="">Todas las acciones</option>
            <option value="crear">Creados</option>
            <option value="editar">Editados</option>
            <option value="eliminar">Eliminados</option>
          </select>

          <select className="audit-select" value={filtroRol}
            onChange={e => { setFiltroRol(e.target.value); setPagina(0) }}>
            <option value="">Todos los roles</option>
            <option value="admin">Administrador</option>
            <option value="editor">Editor</option>
            <option value="encargado">Encargado</option>
          </select>

          {activeModulo === 'inventario' && (
            <select className="audit-select" value={filtroCat}
              onChange={e => { setFiltroCat(e.target.value); setPagina(0) }}>
              <option value="">Todas las categorías</option>
              {categorias.map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
              ))}
            </select>
          )}

          {activeModulo === 'tickets' && (
            <select
              className={`audit-select ${filtroEstadoTicket ? 'audit-select-active' : ''}`}
              value={filtroEstadoTicket}
              onChange={e => { setFiltroEstadoTicket(e.target.value); setPagina(0) }}
            >
              <option value="">Todos los estados</option>
              <option value="Abierto">Abierto</option>
              <option value="En proceso">En proceso</option>
              <option value="Resuelto">Resuelto</option>
            </select>
          )}

          <div className="audit-fecha-row">
            <input type="date" className="audit-select audit-date"
              value={filtroDesde}
              onChange={e => { setFiltroDesde(e.target.value); setPagina(0) }} />
            <span className="audit-dash">—</span>
            <input type="date" className="audit-select audit-date"
              value={filtroHasta}
              onChange={e => { setFiltroHasta(e.target.value); setPagina(0) }} />
          </div>

          {hayFiltros && (
            <button className="audit-btn-ghost" onClick={limpiarFiltros}>✕ Limpiar</button>
          )}
        </div>

        {!cargando && (
          <p className="audit-total-label">
            {total.toLocaleString('es-CL')} registro{total !== 1 ? 's' : ''}
            {hayFiltros ? ' con los filtros aplicados' : ' en total'}
          </p>
        )}
      </div>

      {/* ── Timeline / Lista ── */}
      {cargando ? (
        <div className="audit-loading-state">
          <div className="audit-spinner" />
          <span>Cargando registros…</span>
        </div>
      ) : !logs.length ? (
        <div className="audit-empty-state">
          <div className="audit-empty-icon">📭</div>
          <p className="audit-empty-title">
            {hayFiltros ? 'Sin resultados' : 'Sin registros aún'}
          </p>
          <p className="audit-empty-desc">
            {hayFiltros
              ? 'No hay registros con los filtros aplicados.'
              : 'Aún no hay registros de auditoría.'}
          </p>
          {!hayFiltros && activeModulo === 'tickets' && (
            <p className="audit-empty-hint">
              Para activar el registro automático, ejecuta{' '}
              <strong>supabase_auditoria_tickets.sql</strong> en el SQL Editor de Supabase.
            </p>
          )}
        </div>
      ) : (
        <div className="audit-timeline">
          {agrupados.map((item) => {
            if (item.esHeader) {
              return (
                <div key={'h-' + item.fecha} className="audit-tl-day-row">
                  <div className="audit-tl-marker">
                    <div className="audit-tl-day-dot" />
                  </div>
                  <span className="audit-tl-day-label">{labelDia(item.fecha)}</span>
                </div>
              )
            }

            const { log } = item
            const meta    = ACCION_META[log.accion] ?? { color: '#6b7280', bg: '#f3f4f6', label: log.accion, icono: '•' }
            const abierto = expandido === log.id
            const cambios = (Array.isArray(log.cambios) ? log.cambios : [])
              .filter(c => (c.anterior ?? '') !== '' || (c.nuevo ?? '') !== '')
            const disp    = detectarDispositivo(log.dispositivo)
            const esHoy   = new Date(log.creado_en).toDateString() === new Date().toDateString()

            return (
              <div key={log.id} className="audit-tl-item-row">
                <div className="audit-tl-marker">
                  <div className="audit-tl-item-dot" style={{ background: meta.color }} />
                </div>

                <div className={`audit-tl-card ${abierto ? 'audit-tl-card-open' : ''}`}>
                  <div
                    className="audit-item-header"
                    style={{ cursor: cambios.length ? 'pointer' : 'default' }}
                    onClick={() => cambios.length && setExpandido(abierto ? null : log.id)}
                  >
                    <div className="audit-badge-icon" style={{ background: meta.bg, color: meta.color }}>
                      {meta.icono}
                    </div>

                    <div className="audit-item-content">
                      <p className="audit-item-nombre">{log.bien_nombre}</p>
                      <div className="audit-item-meta">
                        <strong className="audit-meta-user">{log.usuario_nombre}</strong>
                        {log.usuario_rol && (
                          <span className={`audit-rol-badge audit-rol-${
                            log.usuario_rol === 'admin'  ? 'admin'  :
                            log.usuario_rol === 'editor' ? 'editor' : 'enc'
                          }`}>
                            {log.usuario_rol === 'admin'  ? 'Admin'     :
                             log.usuario_rol === 'editor' ? 'Editor'    : 'Encargado'}
                          </span>
                        )}
                        {modoGeneral && log.modulo && (
                          <span className="audit-modulo-badge">
                            {MODULO_LABEL[log.modulo] ?? log.modulo}
                          </span>
                        )}
                        {log.categoria && (
                          <span
                            className={`audit-cat-tag ${onVerCategoria ? 'audit-cat-tag-link' : ''}`}
                            title={onVerCategoria ? 'Ver categoría en inventario' : undefined}
                            onClick={onVerCategoria ? e => { e.stopPropagation(); onVerCategoria(log.categoria) } : undefined}
                          >
                            {catLabel(log.categoria)}
                          </span>
                        )}
                        <span className="audit-meta-time" title={formatFecha(log.creado_en)}>
                          {esHoy ? tiempoRelativo(log.creado_en) : formatFecha(log.creado_en)}
                        </span>
                        {disp && <span className="audit-meta-device">{disp}</span>}
                      </div>
                      {cambios.length > 0 && !abierto && (
                        <div className="audit-item-chips">
                          {cambios.slice(0, 5).map(c => (
                            <span key={c.campo} className="audit-field-chip">{campoLabel(c.campo, log.modulo)}</span>
                          ))}
                          {cambios.length > 5 && (
                            <span className="audit-field-chip audit-field-chip-more">
                              +{cambios.length - 5}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="audit-item-actions">
                      {activeModulo === 'inventario' && log.bien_id && log.accion !== 'eliminar' && onVerBien && (
                        bienesEliminados.has(log.bien_id)
                          ? <span className="audit-bien-noexiste" title="Este bien fue eliminado del inventario">Ya no existe</span>
                          : <button
                              className="audit-btn-ver"
                              onClick={e => { e.stopPropagation(); onVerBien(log.bien_id) }}
                              title="Ir al bien en el inventario"
                            >
                              Ver bien →
                            </button>
                      )}
                      <span className="audit-pill" style={{ background: meta.bg, color: meta.color }}>
                        {meta.label}
                      </span>
                      {cambios.length > 0 && (
                        <span className={`audit-chevron ${abierto ? 'audit-chevron-open' : ''}`}>▼</span>
                      )}
                    </div>
                  </div>

                  {abierto && cambios.length > 0 && (
                    <div className="audit-cambios">
                      <p className="audit-cambios-title">
                        {(log.modulo === 'ausencias' || log.modulo === 'compensatorios' || activeModulo === 'ausencias' || activeModulo === 'compensatorios') && log.accion === 'crear'
                          ? 'Detalle'
                          : 'Campos modificados'}
                      </p>
                      {cambios.map((c, i) => (
                        <div key={i} className="audit-cambio-row">
                          <span className="audit-campo-label">{campoLabel(c.campo, log.modulo)}</span>
                          <span className="audit-valor audit-valor-old" title={c.anterior ?? '—'}>
                            {c.anterior === true || c.anterior === 'true' ? 'Sí'
                              : c.anterior === false || c.anterior === 'false' ? 'No'
                              : c.anterior ?? '—'}
                          </span>
                          <span className="audit-arrow">→</span>
                          <span className="audit-valor audit-valor-new" title={c.nuevo ?? '—'}>
                            {c.nuevo === true || c.nuevo === 'true' ? 'Sí'
                              : c.nuevo === false || c.nuevo === 'false' ? 'No'
                              : c.nuevo ?? '—'}
                          </span>
                          {(log.modulo === 'inventario' || activeModulo === 'inventario') && usuario.rol === 'admin' && c.anterior != null && log.bien_id && (
                            <button
                              className="audit-btn-restore"
                              onClick={e => { e.stopPropagation(); restaurarCampo(log.id, c.campo) }}
                              disabled={!!restaurando}
                            >
                              {restaurando === log.id + c.campo ? '…' : '↩ Restaurar'}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Paginación ── */}
      {totalPaginas > 1 && (() => {
        const ventana = 2
        let inicio = Math.max(0, pagina - ventana)
        let fin    = Math.min(totalPaginas - 1, pagina + ventana)
        if (fin - inicio < 4) {
          if (inicio === 0) fin = Math.min(totalPaginas - 1, 4)
          else              inicio = Math.max(0, fin - 4)
        }
        const paginas = []
        for (let i = inicio; i <= fin; i++) paginas.push(i)
        const desde = pagina * POR_PAGINA + 1
        const hasta = Math.min((pagina + 1) * POR_PAGINA, total)

        return (
          <div className="audit-paginacion">
            <button className="audit-page-btn" onClick={() => setPagina(0)} disabled={pagina === 0} title="Primera página">«</button>
            <button className="audit-page-btn" onClick={() => setPagina(p => Math.max(0, p - 1))} disabled={pagina === 0}>‹</button>

            {inicio > 0 && (
              <>
                <button className="audit-page-btn" onClick={() => setPagina(0)}>1</button>
                {inicio > 1 && <span className="audit-page-dots">…</span>}
              </>
            )}

            {paginas.map(p => (
              <button
                key={p}
                className={`audit-page-btn ${p === pagina ? 'audit-page-btn-active' : ''}`}
                onClick={() => setPagina(p)}
              >
                {p + 1}
              </button>
            ))}

            {fin < totalPaginas - 1 && (
              <>
                {fin < totalPaginas - 2 && <span className="audit-page-dots">…</span>}
                <button className="audit-page-btn" onClick={() => setPagina(totalPaginas - 1)}>{totalPaginas}</button>
              </>
            )}

            <button className="audit-page-btn" onClick={() => setPagina(p => Math.min(totalPaginas - 1, p + 1))} disabled={pagina >= totalPaginas - 1}>›</button>
            <button className="audit-page-btn" onClick={() => setPagina(totalPaginas - 1)} disabled={pagina >= totalPaginas - 1} title="Última página">»</button>

            <span className="audit-page-label">{desde}–{hasta} de {total.toLocaleString('es-CL')}</span>
          </div>
        )
      })()}

      {/* ── Aviso restauración ── */}
      {aviso && (
        <div className="audit-aviso">
          {aviso}
          <button onClick={() => setAviso('')} className="audit-aviso-close">✕</button>
        </div>
      )}

      {/* ── Aviso exportación ── */}
      {avisoExport && (
        <div className="audit-aviso audit-aviso-export">
          {avisoExport}
          <button onClick={() => setAvisoExport('')} className="audit-aviso-close">✕</button>
        </div>
      )}
    </div>
  )
}
