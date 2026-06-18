import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Package2, Users, ClipboardList,
  Ticket, Settings2, Layers, FileSpreadsheet,
  HardDrive, ChevronRight, X, LogOut,
  Menu, Loader2, ShoppingCart, ShieldCheck, History, Trash2,
  CloudUpload, Download, RefreshCw,
  AlertTriangle, RotateCcw, CheckCircle2, XCircle,
  UserCog,
} from 'lucide-react'
import './Layout.css'
import { supabase } from '../supabase'

const TABLAS_BACKUP = [
  'bienes', 'categorias', 'usuarios', 'permisos_rol', 'permisos_usuario',
  'prestamos', 'tickets', 'requerimientos', 'ausencias', 'dias_compensatorios',
  'audit_logs', 'actividades', 'configuracion', 'incidencias', 'dias_inhabilitados',
]

const NOMBRE_HOJA = {
  bienes:              'Bienes',
  categorias:          'Categorías',
  usuarios:            'Usuarios',
  permisos_rol:        'Permisos por Rol',
  permisos_usuario:    'Permisos Usuario',
  prestamos:           'Préstamos',
  tickets:             'Tickets',
  requerimientos:      'Requerimientos',
  ausencias:           'Ausencias',
  dias_compensatorios: 'Compensatorios',
  audit_logs:          'Auditoría',
  actividades:         'Actividades',
  configuracion:       'Configuración',
  incidencias:         'Incidencias',
  dias_inhabilitados:  'Días Inhabilitados',
}

const ROL_LABEL = {
  admin:                 'Administrador',
  directivo:             'Directivo',
  coordinador:           'Coordinador',
  docente:               'Docente',
  asistente:             'Asistente de la educación',
  administrativo:        'Administrativo',
  soporte:               'Soporte técnico',
  editor:                'Editor',
  encargado:             'Encargado',
  encargado_inventario:  'Encargado inventario',
  encargado_soporte:     'Encargado Soporte',
  encargado_permisos:    'Encargado Permisos',
  visor_requerimientos:  'Visor requerimientos',
}

const ROL_BADGE = {
  soporte: { bg: '#e0f2fe', color: '#0369a1', label: 'Soporte técnico' },
}

const sidebarVariants = {
  open:   { x: 0,    transition: { type: 'spring', stiffness: 380, damping: 40, mass: 0.85 } },
  closed: { x: -280, transition: { type: 'spring', stiffness: 380, damping: 40, mass: 0.85 } },
}

const submenuVariants = {
  open:   { height: 'auto', opacity: 1, transition: { duration: 0.22, ease: [0.4,0,0.2,1] } },
  closed: { height: 0,      opacity: 0, transition: { duration: 0.18, ease: [0.4,0,0.2,1] } },
}

export default function Layout({
  usuario, onLogout, children, paginaActual, setPagina,
  onRefreshTicketBadge, logoUrl,
  nombreSistema = 'Sistema de Gestión Liceo JHJ', nombreInstitucion = 'Liceo Polivalente de Excelencia Juvenal Hernández Jaque',
  puedeVerAuditoriaReq = false, puedeVerAuditoriaPermisos = false, puedeVerAuditoriaCompensatorios = false,
  puedeVerAuditoriaInventario = false,
  puedeVerInventario = false, puedeVerTickets = true, puedeGestionarTickets = false,
  puedeVerAuditoriaTickets = false,
  puedeVerAuditoriaGeneral = false,
  puedeVerPapelera = false,
  puedeVerAusencias = false, puedeVerRequerimientos = false,
  puedeVerCompensatorios = false,
  puedeGestionarAusencias = false,
  puedeAccederAusencias = false,
  puedeAccederUsuarios = false,
  puedeGestionarAjustes = false,
  puedeGestionarCampos = false,
  puedeGestionarRoles = false,
  puedeVerPersonal = false,
  esSoporte = false,
}) {
  const esAdmin   = usuario.rol === 'admin'
  const esVisorReq    = usuario.rol === 'visor_requerimientos'
  const muestraInventario = puedeVerInventario
  const muestraRequerimientos = esVisorReq || puedeVerRequerimientos

  const [sidebarOpen,      setSidebarOpen]      = useState(false)
  const [confirmLogout,    setConfirmLogout]    = useState(false)
  const [exportando,       setExportando]       = useState(false)
  const [ticketsAbiertos,  setTicketsAbiertos]  = useState(0)
  const [backupsGuardados, setBackupsGuardados] = useState([])
  const [cargandoBackups,  setCargandoBackups]  = useState(false)
  const [guardando,        setGuardando]        = useState(false)
  const [msgBackup,        setMsgBackup]        = useState(null)   // { tipo:'ok'|'error', texto }
  const [modalRestaurar,   setModalRestaurar]   = useState(null)   // null | { nombre, fase:1|2|3|4, ok?, mensaje? }
  const [textoConfirm,     setTextoConfirm]     = useState('')
  const [progresoRest,     setProgresoRest]     = useState([])     // [{ texto, estado:'pending'|'active'|'done'|'error' }]
  const [confirmEliminar,  setConfirmEliminar]  = useState(null)   // nombre del backup a eliminar
  const [verTodosBackups,  setVerTodosBackups]  = useState(false)

  useEffect(() => {
    if (!puedeGestionarTickets) return
    const cargar = async () => {
      const { count } = await supabase
        .from('tickets').select('*', { count: 'exact', head: true }).eq('estado', 'Abierto')
      setTicketsAbiertos(count ?? 0)
    }
    cargar()
    if (onRefreshTicketBadge) onRefreshTicketBadge(cargar)
    const sub = supabase.channel('tickets-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, cargar)
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [puedeGestionarTickets])

  // ── Backups guardados en Storage ─────────────────────────
  const cargarBackupsGuardados = async () => {
    setCargandoBackups(true)
    const { data } = await supabase.storage.from('backups').list('', {
      limit: 50, offset: 0,
      sortBy: { column: 'created_at', order: 'desc' },
    })
    setBackupsGuardados(data ?? [])
    setCargandoBackups(false)
  }

  // Auto-trigger mensual: si no existe backup en el mes actual, generarlo silenciosamente
  useEffect(() => {
    if (!esAdmin) return
    const verificarBackupMensual = async () => {
      const ahora = new Date()
      const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString()
      const { data } = await supabase.storage.from('backups').list('', { limit: 50 })
      const tieneEesteMes = (data ?? []).some(f => {
        const match = f.name.match(/backup_auto_(\d{4}-\d{2}-\d{2})/)
        if (!match) return false
        return match[1] >= inicioMes.slice(0, 10).slice(0, 7)
      })
      if (!tieneEesteMes) {
        // Lanzar backup automático en background (sin bloquear UI)
        supabase.functions.invoke('backup-mensual').catch(() => {})
      }
    }
    verificarBackupMensual()
  }, [esAdmin])

  const guardarBackupEnServidor = async () => {
    setGuardando(true)
    setMsgBackup(null)
    const { data, error } = await supabase.functions.invoke('backup-mensual')
    if (error || !data?.ok) {
      setMsgBackup({ tipo: 'error', texto: 'Error al guardar el backup en el servidor.' })
    } else {
      setMsgBackup({ tipo: 'ok', texto: `Backup guardado: ${data.archivo}` })
      cargarBackupsGuardados()
    }
    setGuardando(false)
  }

  const descargarBackupGuardado = async (nombre) => {
    const { data, error } = await supabase.storage.from('backups').download(nombre)
    if (error || !data) return
    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url; a.download = nombre; a.click()
    URL.revokeObjectURL(url)
  }

  const eliminarBackupGuardado = async (nombre) => {
    const { error } = await supabase.storage.from('backups').remove([nombre])
    if (!error) {
      setConfirmEliminar(null)
      cargarBackupsGuardados()
    }
  }

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '?'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const metaDeArchivo = (nombre) => {
    const esAuto      = nombre.includes('_auto_')
    const esSeguridad = nombre.includes('_seguridad_')
    const fechaMatch  = nombre.match(/(\d{4}-\d{2}-\d{2})/)
    const fechaStr    = fechaMatch
      ? new Date(fechaMatch[0] + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : nombre
    const tipo   = esSeguridad ? 'Seguridad pre-restauración' : esAuto ? 'Automático mensual' : 'Manual'
    const found  = backupsGuardados.find(f => f.name === nombre)
    const tamano = formatBytes(found?.metadata?.size)
    return { fechaStr, tipo, tamano }
  }

  const ETAPAS_REST = [
    'Validando backup...',
    'Creando backup de seguridad...',
    'Preparando restauración...',
    'Restaurando inventario...',
    'Restaurando requerimientos...',
    'Restaurando ausencias...',
    'Restaurando actividades...',
    'Finalizando...',
  ]

  const abrirRestaurar = (nombre) => {
    setTextoConfirm('')
    setProgresoRest([])
    setConfirmEliminar(null)
    setModalRestaurar({ nombre, fase: 1 })
  }

  const ejecutarRestauracion = async () => {
    const nombre = modalRestaurar.nombre
    setProgresoRest(ETAPAS_REST.map(texto => ({ texto, estado: 'pending' })))
    setModalRestaurar(prev => ({ ...prev, fase: 3 }))

    let etapaFinal = 0
    const avanzar = (i) => {
      etapaFinal = i
      setProgresoRest(prev => prev.map((e, j) => ({
        ...e,
        estado: j < i ? 'done' : j === i ? 'active' : 'pending',
      })))
    }

    avanzar(0)
    const timers = [900, 2400, 3400, 4400, 5300, 6200, 7000].map((d, i) =>
      setTimeout(() => avanzar(i + 1), d)
    )

    try {
      const { data, error } = await supabase.functions.invoke('restaurar-backup', {
        body: { archivo: nombre },
      })
      timers.forEach(clearTimeout)

      if (error || !data?.ok) {
        setProgresoRest(prev => prev.map((e, j) => ({
          ...e,
          estado: j < etapaFinal ? 'done' : j === etapaFinal ? 'error' : 'pending',
        })))
        setModalRestaurar(prev => ({
          ...prev, fase: 4, ok: false,
          mensaje: data?.error || error?.message || 'Error desconocido.',
        }))
      } else {
        setProgresoRest(prev => prev.map(e => ({ ...e, estado: 'done' })))
        setModalRestaurar(prev => ({ ...prev, fase: 4, ok: true }))
        cargarBackupsGuardados()
      }
    } catch (err) {
      timers.forEach(clearTimeout)
      setProgresoRest(prev => prev.map((e, j) => ({
        ...e,
        estado: j < etapaFinal ? 'done' : j === etapaFinal ? 'error' : 'pending',
      })))
      setModalRestaurar(prev => ({ ...prev, fase: 4, ok: false, mensaje: String(err) }))
    }
  }

  // ── Backup completo (descarga directa) ───────────────────
  const fetchFullBackupData = async () => {
    const resultados = await Promise.allSettled(
      TABLAS_BACKUP.map(t => supabase.from(t).select('*'))
    )
    const data = {}
    TABLAS_BACKUP.forEach((tabla, i) => {
      const r = resultados[i]
      data[tabla] = r.status === 'fulfilled' ? (r.value.data ?? []) : []
    })
    return data
  }

  const registrarAuditoriaBackup = async (tipo) => {
    try {
      await supabase.from('audit_logs').insert({
        bien_nombre: `Backup ${tipo} del sistema`,
        accion: 'crear',
        cambios: { tipo_backup: tipo, tablas: TABLAS_BACKUP },
        usuario_id: usuario.id,
        usuario_nombre: usuario.nombre,
        usuario_rol: usuario.rol,
        modulo: 'backup',
        creado_en: new Date().toISOString(),
      })
    } catch { /* silenciar si el constraint rechaza el valor */ }
  }

  const exportarBackupJSON = async () => {
    setExportando(true)
    try {
      const tablesData = await fetchFullBackupData()
      const ahora = new Date().toISOString()
      const backup = {
        version: '1.0',
        schema_version: '2026.06',
        generated_at: ahora,
        generated_by: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol },
        app: 'Sistema de Gestión Liceo JHJ',
        warning: 'Este archivo contiene información sensible del sistema. Guárdelo en un lugar seguro.',
        tables: tablesData,
      }
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `backup_sistema_${ahora.slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      await registrarAuditoriaBackup('JSON')
    } finally {
      setExportando(false)
    }
  }

  const exportarBackupExcel = async () => {
    setExportando(true)
    try {
      const tablesData = await fetchFullBackupData()
      const fecha = new Date().toISOString().slice(0, 10)

      const generar = () => {
        const XLSX = window.XLSX
        const wb = XLSX.utils.book_new()

        // Hoja de metadatos
        const totalRegistros = Object.values(tablesData).reduce((acc, r) => acc + r.length, 0)
        const metaRows = [
          ['Campo', 'Valor'],
          ['Sistema', 'Sistema de Gestión Liceo JHJ'],
          ['Fecha de backup', new Date().toISOString()],
          ['Generado por', `${usuario.nombre} (${usuario.rol})`],
          ['Versión', '1.0'],
          ['Total registros', totalRegistros],
          ['Advertencia', 'Este archivo contiene información sensible del sistema. Guárdelo en un lugar seguro.'],
          [],
          ['Tabla', 'Registros'],
          ...TABLAS_BACKUP.map(t => [NOMBRE_HOJA[t] ?? t, tablesData[t]?.length ?? 0]),
        ]
        const wsMeta = XLSX.utils.aoa_to_sheet(metaRows)
        wsMeta['!cols'] = [{ wch: 22 }, { wch: 70 }]
        XLSX.utils.book_append_sheet(wb, wsMeta, 'Metadata')

        // Una hoja por tabla
        for (const tabla of TABLAS_BACKUP) {
          const rows = tablesData[tabla] ?? []
          const nombreHoja = (NOMBRE_HOJA[tabla] ?? tabla).slice(0, 31)
          if (!rows.length) {
            const wsVacia = XLSX.utils.aoa_to_sheet([['Sin registros en esta tabla']])
            XLSX.utils.book_append_sheet(wb, wsVacia, nombreHoja)
            continue
          }
          const ws = XLSX.utils.json_to_sheet(rows)
          const cols = Object.keys(rows[0])
          ws['!cols'] = cols.map(c => ({ wch: Math.max(c.length + 4, 14) }))
          ws['!autofilter'] = {
            ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: cols.length - 1 } }),
          }
          XLSX.utils.book_append_sheet(wb, ws, nombreHoja)
        }

        XLSX.writeFile(wb, `backup_sistema_${fecha}.xlsx`)
        registrarAuditoriaBackup('Excel').catch(() => {})
        setExportando(false)
      }

      if (window.XLSX) { generar(); return }
      const s = document.getElementById('sheetjs-script') || document.createElement('script')
      s.id = 'sheetjs-script'
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
      s.onload = generar
      s.onerror = () => setExportando(false)
      document.head.appendChild(s)
    } catch {
      setExportando(false)
    }
  }

  // ── Nav items ─────────────────────────────────────────
  const navItems = []

  const inventarioActivo     = paginaActual === 'inventario' || paginaActual === 'auditoria' || paginaActual === 'campos'
  const requerimientosActivo = paginaActual === 'requerimientos' || paginaActual === 'auditoria_requerimientos'
  const ticketsActivo        = paginaActual === 'tickets' || paginaActual === 'auditoria_tickets'
  const permisosActivo       = paginaActual === 'permisos' || paginaActual === 'mis_ausencias' || paginaActual === 'auditoria_permisos' || paginaActual === 'compensatorios'
  const [inventarioAbierto,      setInventarioAbierto]      = useState(inventarioActivo)
  const [requerimientosAbierto,  setRequerimientosAbierto]  = useState(requerimientosActivo)
  const [ticketsAbierto,         setTicketsAbierto]         = useState(ticketsActivo)
  const [permisosAbierto,        setPermisosAbierto]        = useState(permisosActivo)

  const personalActivo = ['personal','personal_contrataciones','personal_reemplazos','personal_documentos','personal_auditoria'].includes(paginaActual)
  const [personalAbierto, setPersonalAbierto] = useState(personalActivo)

  const ajustesActivo = paginaActual === 'ajustes' || paginaActual === 'usuarios' || paginaActual === 'mantenedor_roles'
  const [ajustesAbierto, setAjustesAbierto] = useState(ajustesActivo)
  const [herramientasAbierto, setHerramientasAbierto] = useState(false)

  useEffect(() => {
    if (herramientasAbierto && esAdmin) cargarBackupsGuardados()
  }, [herramientasAbierto])

  const titulos = {
    dashboard:  'Inicio',
    inventario: 'Inventario de Bienes',
    usuarios:   'Gestión de Usuarios',
    auditoria:  'Auditoría de Cambios Inventario',
    auditoria_requerimientos: 'Auditoría de Requerimientos',
    mis_ausencias:            'Mis ausencias',
    permisos:                 'Gestión de ausencias',
    auditoria_permisos:       'Auditoría de Ausencias',
    compensatorios:           'Días Compensatorios',
    requerimientos:    'Requerimientos',
    tickets:           'Tickets',
    auditoria_tickets:  'Auditoría de Tickets',
    auditoria_general:  'Auditoría General',
    papelera:           'Papelera',
    ajustes:    'Personalizar',
    campos:     'Campos por categoría',
    personal:                  'Personal',
    personal_contrataciones:   'Contrataciones',
    personal_reemplazos:       'Reemplazos',
    personal_documentos:       'Documentos',
    personal_auditoria:        'Auditoría Personal',
  }

  const handleNav = (id) => { setPagina(id); setSidebarOpen(false) }

  useEffect(() => {
    if (!sidebarOpen) return
    const onKey = (e) => { if (e.key === 'Escape') setSidebarOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sidebarOpen])

  const toolButtons = [
    {
      Icon: FileSpreadsheet,
      label: 'Backup Excel',
      desc: 'Descarga un respaldo revisable en hojas de cálculo.',
      fn: exportarBackupExcel,
    },
    {
      Icon: HardDrive,
      label: 'Backup JSON',
      desc: 'Descarga un respaldo completo para restauración de base de datos.',
      fn: exportarBackupJSON,
    },
  ]

  return (
    <div className="layout">

      {/* ── Overlay ── */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            className="sidebar-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar ── */}
      <motion.aside
        id="app-sidebar"
        className="sidebar"
        initial={false}
        animate={sidebarOpen ? 'open' : 'closed'}
        variants={sidebarVariants}
      >
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-brand" onClick={() => handleNav('dashboard')}>
            <img
              src={logoUrl || '/logo-liceo.png'}
              alt="Logo"
              className="sidebar-logo-img"
              onError={e => { e.target.src = '/logo-liceo.png' }}
            />
            <div style={{ minWidth: 0 }}>
              <p className="sidebar-title">{nombreSistema}</p>
              <p className="sidebar-sub">{nombreInstitucion}</p>
            </div>
          </div>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Cerrar menú">
            <X size={14} />
          </button>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          <p className="nav-section">Principal</p>

          {/* Inicio — siempre visible */}
          <motion.div
            className={`nav-item ${paginaActual === 'dashboard' ? 'active' : ''}`}
            onClick={() => handleNav('dashboard')}
            whileHover={{ x: 2 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            <span className="nav-icon">
              <LayoutDashboard size={15} strokeWidth={paginaActual === 'dashboard' ? 2.5 : 2} />
            </span>
            Inicio
          </motion.div>

          {/* Inventario con submenú (solo si no es soloTickets) */}
          {muestraInventario && (
            <>
              <motion.div
                className={`nav-item nav-item--parent ${inventarioActivo ? 'active' : ''}`}
                onClick={() => setInventarioAbierto(o => !o)}
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              >
                <span className="nav-icon">
                  <Package2 size={15} strokeWidth={2} />
                </span>
                Inventario
                <span className={`nav-chevron ${inventarioAbierto ? 'nav-chevron--open' : ''}`}>
                  <ChevronRight size={13} strokeWidth={2.5} />
                </span>
              </motion.div>

              <AnimatePresence initial={false}>
                {inventarioAbierto && (
                  <motion.div
                    className="nav-submenu"
                    variants={submenuVariants}
                    initial="closed"
                    animate="open"
                    exit="closed"
                    style={{ overflow: 'hidden' }}
                  >
                    <div
                      className={`nav-subitem ${paginaActual === 'inventario' ? 'active' : ''}`}
                      onClick={() => handleNav('inventario')}
                    >
                      <span className="nav-subitem-dot" />
                      Ver inventario
                    </div>
                    {puedeGestionarCampos && (
                      <div
                        className={`nav-subitem ${paginaActual === 'campos' ? 'active' : ''}`}
                        onClick={() => handleNav('campos')}
                      >
                        <span className="nav-subitem-dot" />
                        Campos inventario
                      </div>
                    )}
                    {puedeVerAuditoriaInventario && (
                      <div
                        className={`nav-subitem ${paginaActual === 'auditoria' ? 'active' : ''}`}
                        onClick={() => handleNav('auditoria')}
                      >
                        <span className="nav-subitem-dot" />
                        Auditoría
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}

          {/* Requerimientos con submenú */}
          {muestraRequerimientos && (
            <>
              <motion.div
                className={`nav-item nav-item--parent ${requerimientosActivo ? 'active' : ''}`}
                onClick={() => setRequerimientosAbierto(o => !o)}
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              >
                <span className="nav-icon">
                  <ShoppingCart size={15} strokeWidth={2} />
                </span>
                Requerimientos
                <span className={`nav-chevron ${requerimientosAbierto ? 'nav-chevron--open' : ''}`}>
                  <ChevronRight size={13} strokeWidth={2.5} />
                </span>
              </motion.div>
              <AnimatePresence initial={false}>
                {requerimientosAbierto && (
                  <motion.div
                    className="nav-submenu"
                    variants={submenuVariants}
                    initial="closed"
                    animate="open"
                    exit="closed"
                    style={{ overflow: 'hidden' }}
                  >
                    <div
                      className={`nav-subitem ${paginaActual === 'requerimientos' ? 'active' : ''}`}
                      onClick={() => handleNav('requerimientos')}
                    >
                      <span className="nav-subitem-dot" />
                      Ver requerimientos
                    </div>
                    {puedeVerAuditoriaReq && (
                      <div
                        className={`nav-subitem ${paginaActual === 'auditoria_requerimientos' ? 'active' : ''}`}
                        onClick={() => handleNav('auditoria_requerimientos')}
                      >
                        <span className="nav-subitem-dot" />
                        Auditoría
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}

          {/* Tickets con submenú */}
          {puedeVerTickets && <>
            <motion.div
              className={`nav-item nav-item--parent ${ticketsActivo ? 'active' : ''}`}
              onClick={() => setTicketsAbierto(o => !o)}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            >
              <span className="nav-icon">
                <Ticket size={15} strokeWidth={2} />
              </span>
              Tickets
              {puedeGestionarTickets && (
                <AnimatePresence>
                  {ticketsAbiertos > 0 && (
                    <motion.span
                      className="nav-ticket-badge"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                    >
                      {ticketsAbiertos}
                    </motion.span>
                  )}
                </AnimatePresence>
              )}
              <span className={`nav-chevron ${ticketsAbierto ? 'nav-chevron--open' : ''}`}>
                <ChevronRight size={13} strokeWidth={2.5} />
              </span>
            </motion.div>
            <AnimatePresence initial={false}>
              {ticketsAbierto && (
                <motion.div
                  className="nav-submenu"
                  variants={submenuVariants}
                  initial="closed"
                  animate="open"
                  exit="closed"
                  style={{ overflow: 'hidden' }}
                >
                  <div
                    className={`nav-subitem ${paginaActual === 'tickets' ? 'active' : ''}`}
                    onClick={() => handleNav('tickets')}
                  >
                    <span className="nav-subitem-dot" />
                    Ver tickets
                  </div>
                  {puedeVerAuditoriaTickets && (
                    <div
                      className={`nav-subitem ${paginaActual === 'auditoria_tickets' ? 'active' : ''}`}
                      onClick={() => handleNav('auditoria_tickets')}
                    >
                      <span className="nav-subitem-dot" />
                      Auditoría
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </>}

          {/* Items adicionales (para extensión futura) */}
          {navItems.map(({ id, Icon, label }) => (
            <motion.div
              key={id}
              className={`nav-item ${paginaActual === id ? 'active' : ''}`}
              onClick={() => handleNav(id)}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            >
              <span className="nav-icon">
                <Icon size={15} strokeWidth={paginaActual === id ? 2.5 : 2} />
              </span>
              {label}
            </motion.div>
          ))}

          {/* Ausencias con submenú */}
          {puedeAccederAusencias && <>
            <motion.div
              className={`nav-item nav-item--parent ${permisosActivo ? 'active' : ''}`}
              onClick={() => setPermisosAbierto(o => !o)}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            >
              <span className="nav-icon">
                <ShieldCheck size={15} strokeWidth={2} />
              </span>
              Ausencias
              <span className={`nav-chevron ${permisosAbierto ? 'nav-chevron--open' : ''}`}>
                <ChevronRight size={13} strokeWidth={2.5} />
              </span>
            </motion.div>
            <AnimatePresence initial={false}>
              {permisosAbierto && (
                <motion.div
                  className="nav-submenu"
                  variants={submenuVariants}
                  initial="closed"
                  animate="open"
                  exit="closed"
                  style={{ overflow: 'hidden' }}
                >
                  {/* Mis ausencias: siempre visible para cualquier usuario */}
                  <div
                    className={`nav-subitem ${paginaActual === 'mis_ausencias' ? 'active' : ''}`}
                    onClick={() => handleNav('mis_ausencias')}
                  >
                    <span className="nav-subitem-dot" />
                    Mis ausencias
                  </div>
                  {/* Gestión de ausencias: solo para gestores/admin */}
                  {puedeGestionarAusencias && (
                    <div
                      className={`nav-subitem ${paginaActual === 'permisos' ? 'active' : ''}`}
                      onClick={() => handleNav('permisos')}
                    >
                      <span className="nav-subitem-dot" />
                      Gestión de ausencias
                    </div>
                  )}
                  {/* Compensatorios: solo para gestores/admin */}
                  {puedeGestionarAusencias && (esAdmin || puedeVerCompensatorios) && (
                    <div
                      className={`nav-subitem ${paginaActual === 'compensatorios' ? 'active' : ''}`}
                      onClick={() => handleNav('compensatorios')}
                    >
                      <span className="nav-subitem-dot" />
                      Compensatorios
                    </div>
                  )}
                  {/* Auditoría: visible si tiene permiso de ausencias o compensatorios */}
                  {(puedeVerAuditoriaPermisos || puedeVerAuditoriaCompensatorios) && (
                    <div
                      className={`nav-subitem ${paginaActual === 'auditoria_permisos' ? 'active' : ''}`}
                      onClick={() => handleNav('auditoria_permisos')}
                    >
                      <span className="nav-subitem-dot" />
                      Auditoría
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </>}

          {/* Personal con submenú */}
          {puedeVerPersonal && <>
            <motion.div
              className={`nav-item nav-item--parent ${personalActivo ? 'active' : ''}`}
              onClick={() => setPersonalAbierto(o => !o)}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            >
              <span className="nav-icon">
                <UserCog size={15} strokeWidth={2} />
              </span>
              Personal
              <span className={`nav-chevron ${personalAbierto ? 'nav-chevron--open' : ''}`}>
                <ChevronRight size={13} strokeWidth={2.5} />
              </span>
            </motion.div>
            <AnimatePresence initial={false}>
              {personalAbierto && (
                <motion.div
                  className="nav-submenu"
                  variants={submenuVariants}
                  initial="closed"
                  animate="open"
                  exit="closed"
                  style={{ overflow: 'hidden' }}
                >
                  <div
                    className={`nav-subitem ${paginaActual === 'personal' ? 'active' : ''}`}
                    onClick={() => handleNav('personal')}
                  >
                    <span className="nav-subitem-dot" />
                    Inicio
                  </div>
                  <div
                    className={`nav-subitem ${paginaActual === 'personal_contrataciones' ? 'active' : ''}`}
                    onClick={() => handleNav('personal_contrataciones')}
                  >
                    <span className="nav-subitem-dot" />
                    Contrataciones
                  </div>
                  <div
                    className={`nav-subitem ${paginaActual === 'personal_reemplazos' ? 'active' : ''}`}
                    onClick={() => handleNav('personal_reemplazos')}
                  >
                    <span className="nav-subitem-dot" />
                    Reemplazos
                  </div>
                  <div
                    className={`nav-subitem ${paginaActual === 'personal_documentos' ? 'active' : ''}`}
                    onClick={() => handleNav('personal_documentos')}
                  >
                    <span className="nav-subitem-dot" />
                    Documentos
                  </div>
                  <div
                    className={`nav-subitem ${paginaActual === 'personal_auditoria' ? 'active' : ''}`}
                    onClick={() => handleNav('personal_auditoria')}
                  >
                    <span className="nav-subitem-dot" />
                    Auditoría
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>}

          {/* Auditoría General */}
          {puedeVerAuditoriaGeneral && (
            <motion.div
              className={`nav-item ${paginaActual === 'auditoria_general' ? 'active' : ''}`}
              onClick={() => handleNav('auditoria_general')}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            >
              <span className="nav-icon">
                <History size={15} strokeWidth={2} />
              </span>
              Auditoría General
            </motion.div>
          )}

          {/* Papelera */}
          {puedeVerPapelera && (
            <motion.div
              className={`nav-item ${paginaActual === 'papelera' ? 'active' : ''}`}
              onClick={() => handleNav('papelera')}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            >
              <span className="nav-icon">
                <Trash2 size={15} strokeWidth={paginaActual === 'papelera' ? 2.5 : 2} />
              </span>
              Papelera
            </motion.div>
          )}

          {/* Ajustes con submenú */}
          {(esAdmin || puedeAccederUsuarios || puedeGestionarAjustes || puedeGestionarRoles) && (
            <>
              <motion.div
                className={`nav-item nav-item--parent ${ajustesActivo ? 'active' : ''}`}
                onClick={() => setAjustesAbierto(o => !o)}
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              >
                <span className="nav-icon">
                  <Settings2 size={15} strokeWidth={2} />
                </span>
                Ajustes
                <span className={`nav-chevron ${ajustesAbierto ? 'nav-chevron--open' : ''}`}>
                  <ChevronRight size={13} strokeWidth={2.5} />
                </span>
              </motion.div>

              <AnimatePresence initial={false}>
                {ajustesAbierto && (
                  <motion.div
                    className="nav-submenu"
                    variants={submenuVariants}
                    initial="closed"
                    animate="open"
                    exit="closed"
                    style={{ overflow: 'hidden' }}
                  >
                    {(esAdmin || puedeGestionarAjustes) && (
                      <div
                        className={`nav-subitem ${paginaActual === 'ajustes' ? 'active' : ''}`}
                        onClick={() => handleNav('ajustes')}
                      >
                        <span className="nav-subitem-dot" />
                        Personalizar
                      </div>
                    )}
                    {puedeAccederUsuarios && (
                      <div
                        className={`nav-subitem ${paginaActual === 'usuarios' ? 'active' : ''}`}
                        onClick={() => handleNav('usuarios')}
                      >
                        <span className="nav-subitem-dot" />
                        Usuarios
                      </div>
                    )}
                    {puedeGestionarRoles && (
                      <div
                        className={`nav-subitem ${paginaActual === 'mantenedor_roles' ? 'active' : ''}`}
                        onClick={() => handleNav('mantenedor_roles')}
                      >
                        <span className="nav-subitem-dot" />
                        Mantenedor de Roles
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </nav>

        {/* Herramientas */}
        {esAdmin && (
          <div className="tools-section">
            <div
              className="nav-section"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => setHerramientasAbierto(o => !o)}
            >
              Herramientas
              <span className={`nav-chevron ${herramientasAbierto ? 'nav-chevron--open' : ''}`} style={{ position: 'static', marginLeft: 4 }}>
                <ChevronRight size={13} strokeWidth={2.5} />
              </span>
            </div>
            <AnimatePresence initial={false}>
              {herramientasAbierto && (
                <motion.div
                  variants={submenuVariants}
                  initial="closed"
                  animate="open"
                  exit="closed"
                  style={{ overflow: 'hidden' }}
                >
                  {/* ── Descarga directa ── */}
                  {toolButtons.map(({ Icon, label, desc, fn }) => (
                    <button key={label} className="tool-btn" onClick={fn} disabled={exportando || guardando}>
                      <span className="tool-btn-icon">
                        {exportando ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
                      </span>
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span>{exportando ? 'Generando…' : label}</span>
                        {!exportando && (
                          <span style={{ fontSize: 10, opacity: 0.6, fontWeight: 400, lineHeight: 1.3 }}>
                            {desc}
                          </span>
                        )}
                      </span>
                    </button>
                  ))}

                  {/* ── Divider ── */}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', margin: '8px 20px 4px' }} />

                  {/* ── Guardar en servidor ── */}
                  <button
                    className="tool-btn"
                    onClick={() => { guardarBackupEnServidor(); cargarBackupsGuardados() }}
                    disabled={exportando || guardando}
                  >
                    <span className="tool-btn-icon">
                      {guardando ? <Loader2 size={14} className="animate-spin" /> : <CloudUpload size={14} />}
                    </span>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span>{guardando ? 'Guardando…' : 'Guardar en servidor'}</span>
                      {!guardando && (
                        <span style={{ fontSize: 10, opacity: 0.6, fontWeight: 400, lineHeight: 1.3 }}>
                          Almacena un backup JSON en la nube.
                        </span>
                      )}
                    </span>
                  </button>

                  {/* Mensaje resultado */}
                  {msgBackup && (
                    <p style={{
                      margin: '4px 20px 2px',
                      fontSize: 10.5,
                      color: msgBackup.tipo === 'ok' ? '#86efac' : '#fca5a5',
                      lineHeight: 1.4,
                    }}>
                      {msgBackup.texto}
                    </p>
                  )}

                  {/* ── Lista de backups guardados ── */}
                  <div style={{ margin: '8px 20px 2px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 10, opacity: 0.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Backups en servidor
                    </span>
                    <button
                      onClick={cargarBackupsGuardados}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.5, padding: 2 }}
                      title="Actualizar lista"
                    >
                      <RefreshCw size={11} />
                    </button>
                  </div>

                  {cargandoBackups ? (
                    <p style={{ margin: '4px 20px', fontSize: 10.5, opacity: 0.45 }}>Cargando…</p>
                  ) : backupsGuardados.length === 0 ? (
                    <p style={{ margin: '4px 20px 6px', fontSize: 10.5, opacity: 0.4, lineHeight: 1.4 }}>
                      Sin backups guardados aún. El sistema genera uno automáticamente cada mes.
                    </p>
                  ) : (() => {
                    const lista = verTodosBackups ? backupsGuardados : backupsGuardados.slice(0, 1)
                    const iconStyle = { background: 'none', border: 'none', cursor: 'pointer', padding: '3px 5px', borderRadius: 5, display: 'flex', alignItems: 'center' }
                    return (
                      <div style={{ margin: '2px 0 4px' }}>
                        {lista.map(f => {
                          const esAuto      = f.name.includes('_auto_')
                          const esSeguridad = f.name.includes('_seguridad_')
                          const fecha       = f.name.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? ''
                          const etiqueta    = esSeguridad ? '🛡️ Seguridad' : esAuto ? '🤖 Auto' : '👤 Manual'
                          const confirmando = confirmEliminar === f.name
                          return (
                            <div key={f.name} style={{ display: 'flex', alignItems: 'center', padding: '4px 16px 4px 14px', gap: 1 }}>
                              {/* Info */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.78)', fontWeight: 500, lineHeight: 1.2 }}>{fecha}</p>
                                <p style={{ margin: 0, fontSize: 9.5, color: 'rgba(255,255,255,0.38)', fontWeight: 400, lineHeight: 1.2 }}>{etiqueta}</p>
                              </div>

                              {confirmando ? (
                                <div style={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap', marginRight: 1 }}>¿Eliminar?</span>
                                  <button onClick={() => eliminarBackupGuardado(f.name)} style={{ ...iconStyle, color: '#f87171' }} title="Confirmar">
                                    <CheckCircle2 size={12} />
                                  </button>
                                  <button onClick={() => setConfirmEliminar(null)} style={{ ...iconStyle, color: 'rgba(255,255,255,0.35)' }} title="Cancelar">
                                    <X size={11} />
                                  </button>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                  <button onClick={() => descargarBackupGuardado(f.name)} style={{ ...iconStyle, color: 'rgba(255,255,255,0.45)' }} title="Descargar">
                                    <Download size={12} />
                                  </button>
                                  <button
                                    onClick={() => abrirRestaurar(f.name)}
                                    disabled={modalRestaurar?.fase === 3}
                                    style={{ ...iconStyle, color: 'rgba(255,255,255,0.45)', opacity: modalRestaurar?.fase === 3 ? 0.3 : 1 }}
                                    title="Restaurar"
                                  >
                                    <RotateCcw size={12} />
                                  </button>
                                  <button onClick={() => setConfirmEliminar(f.name)} style={{ ...iconStyle, color: 'rgba(255,255,255,0.28)' }} title="Eliminar">
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              )}
                            </div>
                          )
                        })}

                        {/* Toggle ver todos / ver menos */}
                        {backupsGuardados.length > 1 && (
                          <button
                            onClick={() => setVerTodosBackups(v => !v)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.38)', fontSize: 10, padding: '3px 14px 6px', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}
                          >
                            <ChevronRight size={10} style={{ transform: verTodosBackups ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                            {verTodosBackups ? 'Ver menos' : `Ver todos (${backupsGuardados.length})`}
                          </button>
                        )}
                      </div>
                    )
                  })()}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Usuario */}
        <div className="sidebar-user">
          <div className="avatar">{usuario.nombre[0]}</div>
          <div className="user-info">
            <p>{usuario.nombre}</p>
            {ROL_BADGE[usuario.rol] ? (
              <span style={{
                display: 'inline-block',
                background: ROL_BADGE[usuario.rol].bg,
                color: ROL_BADGE[usuario.rol].color,
                fontSize: 10.5, fontWeight: 700,
                borderRadius: 20, padding: '2px 9px',
                letterSpacing: '0.02em',
              }}>
                {ROL_BADGE[usuario.rol].label}
              </span>
            ) : (
              <span>{ROL_LABEL[usuario.rol] ?? usuario.rol}</span>
            )}
          </div>
        </div>
      </motion.aside>

      {/* ── Main ── */}
      <div className="main">
        <header className="topbar">
          <button
            type="button"
            className={`btn-hamburger ${sidebarOpen ? 'btn-hamburger--open' : ''}`}
            onClick={() => setSidebarOpen(o => !o)}
            aria-expanded={sidebarOpen}
            aria-controls="app-sidebar"
            aria-label={sidebarOpen ? 'Cerrar menú' : 'Abrir menú'}
          >
            <span /><span /><span />
          </button>

          <div className="topbar-title-wrap">
            <AnimatePresence mode="wait">
              <motion.h1
                key={paginaActual}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
              >
                {titulos[paginaActual]}
              </motion.h1>
            </AnimatePresence>
          </div>

          <button className="btn-logout" onClick={() => setConfirmLogout(true)}>
            <LogOut size={13} />
            <span>Cerrar sesión</span>
          </button>
        </header>

        <div className="content">
          {children}
        </div>
      </div>

      {/* ── Modal restaurar backup ── */}
      <AnimatePresence>
        {modalRestaurar && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(5,12,55,0.82)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 600, padding: '20px',
            }}
            onClick={modalRestaurar.fase !== 3 ? () => setModalRestaurar(null) : undefined}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.93, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.93, y: 8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: '#fff', borderRadius: 22,
                padding: '28px 26px 24px',
                maxWidth: 460, width: '100%',
                boxShadow: '0 28px 90px rgba(0,0,0,0.42)',
              }}
            >

              {/* ── Fase 1: Advertencia inicial ── */}
              {modalRestaurar.fase === 1 && (() => {
                const { fechaStr, tipo, tamano } = metaDeArchivo(modalRestaurar.nombre)
                return (
                  <>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
                      <div style={{ width: 46, height: 46, borderRadius: 13, flexShrink: 0, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <AlertTriangle size={22} style={{ color: '#d97706' }} />
                      </div>
                      <div>
                        <h3 style={{ margin: '2px 0 4px', fontSize: 16.5, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em' }}>
                          ¿Restaurar desde este backup?
                        </h3>
                        <p style={{ margin: 0, fontSize: 13, color: '#64748b', lineHeight: 1.4 }}>
                          El sistema volverá al estado guardado en este respaldo.
                        </p>
                      </div>
                    </div>

                    <div style={{ background: '#f8fafc', borderRadius: 11, padding: '12px 14px', marginBottom: 14, border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px 12px' }}>
                      {[['Fecha', fechaStr], ['Tipo', tipo], ['Tamaño', tamano]].map(([k, v]) => (
                        <div key={k}>
                          <p style={{ margin: 0, color: '#94a3b8', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k}</p>
                          <p style={{ margin: '2px 0 0', color: '#1e293b', fontWeight: 600, fontSize: 12.5 }}>{v}</p>
                        </div>
                      ))}
                    </div>

                    <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '11px 14px', marginBottom: 20, fontSize: 12.5, color: '#92400e', lineHeight: 1.55 }}>
                      ⚠️ Esta acción <strong>reemplazará todos los datos actuales</strong> de inventario, tickets, ausencias, requerimientos y actividades. Se generará un backup de seguridad automático antes de proceder.
                    </div>

                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={() => setModalRestaurar(null)} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Cancelar
                      </button>
                      <button onClick={() => setModalRestaurar(prev => ({ ...prev, fase: 2 }))} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(217,119,6,0.35)' }}>
                        Continuar →
                      </button>
                    </div>
                  </>
                )
              })()}

              {/* ── Fase 2: Confirmación con "RESTAURAR" ── */}
              {modalRestaurar.fase === 2 && (() => {
                const { fechaStr, tipo, tamano } = metaDeArchivo(modalRestaurar.nombre)
                const valido = textoConfirm === 'RESTAURAR'
                const nombreCorto = modalRestaurar.nombre.length > 30
                  ? modalRestaurar.nombre.slice(0, 28) + '…'
                  : modalRestaurar.nombre
                return (
                  <>
                    <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em' }}>
                      Confirmación final
                    </h3>
                    <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>
                      Verifica los detalles y escribe <strong style={{ color: '#dc2626' }}>RESTAURAR</strong> para confirmar.
                    </p>

                    <div style={{ background: '#f8fafc', borderRadius: 11, padding: '14px 16px', marginBottom: 12, border: '1px solid #e2e8f0' }}>
                      <p style={{ margin: '0 0 10px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Backup seleccionado</p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
                        {[['Fecha', fechaStr], ['Tipo', tipo], ['Tamaño', tamano], ['Archivo', nombreCorto]].map(([k, v]) => (
                          <div key={k}>
                            <p style={{ margin: 0, color: '#94a3b8', fontSize: 10.5, fontWeight: 600 }}>{k}</p>
                            <p style={{ margin: '2px 0 0', color: '#1e293b', fontWeight: 600, fontSize: 12.5, wordBreak: 'break-all' }}>{v}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12.5, color: '#166534', lineHeight: 1.5 }}>
                      ✅ <strong>Datos protegidos (sin cambios):</strong> Usuarios, roles, permisos y registro de auditoría se conservarán intactos.
                    </div>

                    <div style={{ marginBottom: 18 }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 7 }}>
                        Escribe exactamente{' '}
                        <span style={{ color: '#dc2626', fontFamily: 'monospace', letterSpacing: '0.05em' }}>RESTAURAR</span>{' '}
                        para habilitar el botón:
                      </label>
                      <input
                        value={textoConfirm}
                        onChange={e => setTextoConfirm(e.target.value)}
                        placeholder="RESTAURAR"
                        autoFocus
                        style={{
                          width: '100%', padding: '9px 12px', boxSizing: 'border-box',
                          border: `1.5px solid ${valido ? '#22c55e' : '#e2e8f0'}`,
                          borderRadius: 9, fontSize: 14, fontWeight: 600, color: '#0f172a',
                          background: '#fff', outline: 'none', fontFamily: 'monospace',
                          transition: 'border-color 0.15s', letterSpacing: '0.05em',
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={() => setModalRestaurar(null)} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Cancelar
                      </button>
                      <button
                        onClick={ejecutarRestauracion}
                        disabled={!valido}
                        style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', background: valido ? 'linear-gradient(135deg, #dc2626, #b91c1c)' : '#e2e8f0', color: valido ? '#fff' : '#94a3b8', fontSize: 13, fontWeight: 700, cursor: valido ? 'pointer' : 'not-allowed', fontFamily: 'inherit', boxShadow: valido ? '0 4px 14px rgba(220,38,38,0.35)' : 'none', transition: 'all 0.2s' }}
                      >
                        Confirmar restauración
                      </button>
                    </div>
                  </>
                )
              })()}

              {/* ── Fase 3: Progreso en curso ── */}
              {modalRestaurar.fase === 3 && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
                    <Loader2 size={22} className="animate-spin" style={{ color: '#1a237e', flexShrink: 0 }} />
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Restaurando sistema...</h3>
                      <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#64748b' }}>No cierres ni recargues esta ventana.</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {progresoRest.map(({ texto, estado }, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < progresoRest.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                        <div style={{ width: 22, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                          {estado === 'done'    && <CheckCircle2 size={17} style={{ color: '#22c55e' }} />}
                          {estado === 'active'  && <Loader2 size={16} className="animate-spin" style={{ color: '#1a237e' }} />}
                          {estado === 'error'   && <XCircle size={17} style={{ color: '#dc2626' }} />}
                          {estado === 'pending' && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#e2e8f0', margin: '0 auto' }} />}
                        </div>
                        <span style={{ fontSize: 13, fontWeight: estado === 'active' ? 600 : 400, color: estado === 'done' ? '#16a34a' : estado === 'active' ? '#1a237e' : estado === 'error' ? '#dc2626' : '#94a3b8' }}>
                          {texto}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* ── Fase 4: Resultado final ── */}
              {modalRestaurar.fase === 4 && (
                <div style={{ textAlign: 'center' }}>
                  {modalRestaurar.ok ? (
                    <>
                      <CheckCircle2 size={54} style={{ color: '#22c55e', marginBottom: 16 }} />
                      <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Restauración completada</h3>
                      <p style={{ margin: '0 0 24px', fontSize: 14, color: '#64748b', lineHeight: 1.55 }}>
                        Los datos del sistema han sido restaurados exitosamente desde el backup seleccionado.
                      </p>
                    </>
                  ) : (
                    <>
                      <XCircle size={54} style={{ color: '#dc2626', marginBottom: 16 }} />
                      <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#0f172a' }}>No se completó la restauración</h3>
                      <p style={{ margin: '0 0 12px', fontSize: 13.5, color: '#64748b', lineHeight: 1.55 }}>
                        El sistema conserva el estado anterior gracias al backup de seguridad generado automáticamente.
                      </p>
                      {modalRestaurar.mensaje && (
                        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 9, padding: '9px 13px', marginBottom: 16, fontSize: 12, color: '#b91c1c', textAlign: 'left', lineHeight: 1.5, wordBreak: 'break-word' }}>
                          {modalRestaurar.mensaje}
                        </div>
                      )}
                    </>
                  )}
                  <button
                    onClick={() => setModalRestaurar(null)}
                    style={{ width: '100%', padding: '11px 0', borderRadius: 11, border: 'none', background: 'linear-gradient(135deg, rgb(var(--primary-rgb)), #2563eb)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 18px rgba(26,35,126,0.32)' }}
                  >
                    Cerrar
                  </button>
                </div>
              )}

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal logout ── */}
      <AnimatePresence>
        {confirmLogout && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(5,12,55,0.72)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 500,
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              style={{
                background: '#fff', borderRadius: 20,
                padding: '32px 32px 28px', maxWidth: 340, width: '90%',
                textAlign: 'center',
                boxShadow: '0 24px 80px rgba(0,0,0,0.32), 0 0 0 1px rgba(212,160,23,0.12)',
              }}
            >
              <div style={{
                width: 52, height: 52, borderRadius: 16, margin: '0 auto 18px',
                background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <LogOut size={22} style={{ color: '#1a237e' }} />
              </div>
              <h3 style={{ margin: '0 0 8px', color: '#0f172a', fontWeight: 700, fontSize: 18, letterSpacing: '-0.025em' }}>
                ¿Cerrar sesión?
              </h3>
              <p style={{ margin: '0 0 26px', color: '#64748b', fontSize: 14, lineHeight: 1.6 }}>
                Se cerrará tu sesión y volverás al inicio de sesión.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setConfirmLogout(false)}
                  style={{
                    flex: 1, padding: '11px 0', borderRadius: 11,
                    border: '1.5px solid #e2e8f0', background: '#f8fafc',
                    color: '#475569', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    fontFamily: 'inherit', transition: 'all 0.15s ease',
                  }}
                  onMouseOver={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.borderColor = '#cbd5e1' }}
                  onMouseOut={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={onLogout}
                  style={{
                    flex: 1, padding: '11px 0', borderRadius: 11,
                    border: 'none',
                    background: 'linear-gradient(135deg, rgb(var(--primary-rgb)), #2563eb)',
                    color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    fontFamily: 'inherit',
                    boxShadow: '0 4px 18px rgba(26,35,126,0.38)',
                    transition: 'opacity 0.15s, transform 0.15s',
                  }}
                  onMouseOver={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                  onMouseOut={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)' }}
                >
                  Sí, cerrar sesión
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
