import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Package2, Users, ClipboardList,
  Ticket, Settings2, Layers, FileSpreadsheet,
  HardDrive, FileText, ChevronRight, X, LogOut,
  Menu, Loader2, ShoppingCart, ShieldCheck,
} from 'lucide-react'
import './Layout.css'
import { supabase } from '../supabase'

const COLS_BACKUP = [
  'nombre','categoria','codigo','cantidad','estado','ubicacion','responsable','obs',
  'isbn','autor','genero',
  'tipo','marca','modelo','numero_serie','pantalla','cpu','ram','ram_tipo','ram_slots',
  'memoria','tipo_almacenamiento','sistema_operativo',
  'licencia_windows','win_version','win_proveedor','win_factura','win_fecha_factura','win_orden',
  'licencia_office','off_version','off_proveedor','off_factura','off_fecha_factura','off_orden',
  'fecha_adquisicion','proveedor','numero_factura','numero_orden','fondo','garantia',
]

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
  nombreSistema = 'Inventario', nombreInstitucion = 'Liceo Polivalente de Excelencia Juvenal Hernández Jaque',
  puedeVerAuditoriaReq = false, puedeVerAuditoriaPermisos = false, puedeVerAuditoriaCompensatorios = false,
  puedeVerAuditoriaInventario = false,
  puedeVerInventario = false, puedeVerTickets = true, puedeGestionarTickets = false,
  puedeVerAuditoriaTickets = false,
  puedeVerAusencias = false, puedeVerRequerimientos = false,
  puedeVerCompensatorios = false,
  puedeGestionarAusencias = false,
  puedeAccederAusencias = false,
  puedeAccederUsuarios = false,
  puedeGestionarAjustes = false,
  puedeGestionarCampos = false,
  esSoporte = false,
}) {
  const esAdmin   = usuario.rol === 'admin'
  const esVisorReq    = usuario.rol === 'visor_requerimientos'
  const muestraInventario = puedeVerInventario
  const muestraRequerimientos = esVisorReq || puedeVerRequerimientos

  const [sidebarOpen,   setSidebarOpen]   = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [exportando,    setExportando]    = useState(false)
  const [ticketsAbiertos, setTicketsAbiertos] = useState(0)

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

  // ── Backup / Export ───────────────────────────────────
  const fetchBackupData = async () => {
    const [{ data: bienes }, { data: cats }] = await Promise.all([
      supabase.from('bienes').select('*').order('categoria').order('nombre'),
      supabase.from('categorias').select('*'),
    ])
    return { bienes: bienes ?? [], cats: cats ?? [] }
  }

  const exportarBackupExcel = async () => {
    setExportando(true)
    const { bienes, cats } = await fetchBackupData()
    if (!bienes.length) { setExportando(false); return }
    const fecha = new Date().toISOString().slice(0, 10)

    const cargar = () => {
      const XLSX = window.XLSX
      const wb = XLSX.utils.book_new()
      const grupos = {}
      bienes.forEach(b => {
        const cat = cats.find(c => c.id === b.categoria)
        const key = b.categoria || 'sin_categoria'
        if (!grupos[key]) grupos[key] = { label: cat?.label ?? b.categoria ?? 'Sin categoría', icon: cat?.icon ?? '📦', items: [] }
        grupos[key].items.push(b)
      })
      const COLS_LISTA = ['categoria_nombre','codigo','nombre','estado','cantidad','ubicacion','responsable','tipo','marca','modelo','numero_serie','obs']
      const HDRS_LISTA = ['Categoría','Código','Nombre','Estado','Cantidad','Ubicación','Responsable','Tipo','Marca','Modelo','N° Serie','Observaciones']
      const resumenRows = [
        ['Categoría','Ícono','Total bienes'],
        ...Object.values(grupos).map(g => [g.label, g.icon, g.items.length]),
        [], ['TOTAL','',bienes.length], [],
        ['Datos completos (' + bienes.length + ' bienes)'],
        HDRS_LISTA,
        ...bienes.map(b => {
          const cat = cats.find(c => c.id === b.categoria)
          return COLS_LISTA.map(c => c === 'categoria_nombre' ? (cat?.label ?? b.categoria ?? '') : (b[c] ?? ''))
        }),
      ]
      const wsRes = XLSX.utils.aoa_to_sheet(resumenRows)
      wsRes['!cols'] = HDRS_LISTA.map((h, i) => ({ wch: Math.max(h.length + 2, i === 0 ? 20 : i === 2 ? 28 : 14) }))
      XLSX.utils.book_append_sheet(wb, wsRes, 'Resumen')
      Object.values(grupos).forEach(({ label, items }) => {
        if (!items.length) return
        const cols = COLS_BACKUP.filter(c => items.some(b => b[c] != null && b[c] !== ''))
        const rows = [cols, ...items.map(b => cols.map(c => b[c] ?? ''))]
        const ws = XLSX.utils.aoa_to_sheet(rows)
        ws['!cols'] = cols.map(h => ({ wch: Math.max(h.length + 4, 14) }))
        ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s:{r:0,c:0}, e:{r:0,c:cols.length-1} }) }
        ws['!tables'] = [{
          name: label.replace(/\s+/g,'_').replace(/[^A-Za-z0-9_]/g,'').slice(0,255) || 'Tabla',
          ref: XLSX.utils.encode_range({ s:{r:0,c:0}, e:{r:rows.length-1,c:cols.length-1} }),
          headerRow: true, totalsRow: false,
          style: { theme: 'TableStyleMedium2', showRowStripes: true },
          columns: cols.map(h => ({ name: h })),
        }]
        XLSX.utils.book_append_sheet(wb, ws, label.slice(0, 31))
      })
      XLSX.writeFile(wb, `backup_inventario_${fecha}.xlsx`)
      setExportando(false)
    }
    if (window.XLSX) { cargar(); return }
    const s = document.getElementById('sheetjs-script') || document.createElement('script')
    s.id = 'sheetjs-script'
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
    s.onload = cargar; s.onerror = () => setExportando(false)
    document.head.appendChild(s)
  }

  const exportarBackupJSON = async () => {
    setExportando(true)
    const { bienes, cats } = await fetchBackupData()
    if (!bienes.length) { setExportando(false); return }
    const backup = {
      version: 1,
      fecha_exportacion: new Date().toISOString(),
      total: bienes.length,
      categorias: cats.map(c => ({ id: c.id, label: c.label, icon: c.icon })),
      bienes,
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `backup_inventario_${new Date().toISOString().slice(0,10)}.json`
    a.click(); URL.revokeObjectURL(url)
    setExportando(false)
  }

  const exportarInformePDF = async () => {
    setExportando(true)
    const { bienes, cats } = await fetchBackupData()
    if (!bienes.length) { setExportando(false); return }
    const cargarPDF = () => {
      const { jsPDF } = window.jspdf
      const fecha = new Date()
      const fechaStr = fecha.toLocaleDateString('es-CL', { day:'2-digit', month:'long', year:'numeric' })
      const fechaArchivo = fecha.toISOString().slice(0, 10)
      const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' })
      const W = doc.internal.pageSize.getWidth()
      const AZUL = [26,35,126]; const DORADO = [212,160,23]; const GRIS = [107,114,128]
      const addHeader = (pageNum) => {
        doc.setFillColor(...AZUL); doc.rect(0,0,W,22,'F')
        doc.setFillColor(...DORADO); doc.rect(0,22,W,1.5,'F')
        doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(13)
        doc.text('Liceo Polivalente de Excelencia Juvenal Hernández Jaque', W/2, 9, { align:'center' })
        doc.setFont('helvetica','normal'); doc.setFontSize(8.5)
        doc.text('Inventario de Bienes — Informe Oficial', W/2, 15.5, { align:'center' })
        doc.setTextColor(...GRIS); doc.setFontSize(7.5)
        doc.text(fechaStr, W-12, 28, { align:'right' })
        if (pageNum > 1) doc.text(`Página ${pageNum}`, 12, 28)
      }
      const addFooter = () => {
        const pageCount = doc.internal.getNumberOfPages()
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i)
          doc.setFillColor(245,245,250); doc.rect(0,284,W,13,'F')
          doc.setDrawColor(220,220,235); doc.setLineWidth(0.3); doc.line(0,284,W,284)
          doc.setTextColor(...GRIS); doc.setFontSize(7.5)
          doc.text('Liceo Polivalente de Excelencia Juvenal Hernández Jaque — Sistema de Inventario', W/2, 290, { align:'center' })
          doc.text(`${i} / ${pageCount}`, W-12, 290, { align:'right' })
        }
      }
      addHeader(1)
      doc.setTextColor(...AZUL); doc.setFont('helvetica','bold'); doc.setFontSize(18)
      doc.text('Informe de Inventario', W/2, 45, { align:'center' })
      doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(...GRIS)
      doc.text(`Generado el ${fechaStr}`, W/2, 53, { align:'center' })
      doc.setDrawColor(...DORADO); doc.setLineWidth(0.8); doc.line(14,58,W-14,58)
      const estados = { bueno:0, regular:0, malo:0, dado_de_baja:0 }
      bienes.forEach(b => { if (b.estado && estados[b.estado] !== undefined) estados[b.estado]++ })
      const kpis = [
        { label:'Total Bienes', value:bienes.length, color:AZUL },
        { label:'En Buen Estado', value:estados.bueno, color:[22,163,74] },
        { label:'Estado Regular', value:estados.regular, color:[217,119,6] },
        { label:'Mal Estado', value:estados.malo, color:[220,38,38] },
        { label:'Categorías', value:cats.length, color:[109,40,217] },
      ]
      const boxW = (W-28-8*4)/5
      kpis.forEach((k,i) => {
        const x = 14+i*(boxW+8)
        doc.setFillColor(248,249,255); doc.setDrawColor(...k.color); doc.setLineWidth(0.4)
        doc.roundedRect(x,63,boxW,22,3,3,'FD')
        doc.setTextColor(...k.color); doc.setFont('helvetica','bold'); doc.setFontSize(16)
        doc.text(String(k.value), x+boxW/2, 75, { align:'center' })
        doc.setFontSize(6.5); doc.setFont('helvetica','normal'); doc.setTextColor(...GRIS)
        doc.text(k.label, x+boxW/2, 80.5, { align:'center' })
      })
      doc.setTextColor(...AZUL); doc.setFont('helvetica','bold'); doc.setFontSize(11)
      doc.text('Resumen por Categoría', 14, 95)
      const grupos = {}
      bienes.forEach(b => {
        const cat = cats.find(c => c.id === b.categoria)
        const key = b.categoria || 'sin_categoria'
        if (!grupos[key]) grupos[key] = { label: cat?.label ?? 'Sin categoría', icon: cat?.icon ?? '📦', items:[] }
        grupos[key].items.push(b)
      })
      const resumenBody = Object.values(grupos).map(g => {
        const bs = g.items.filter(b => b.estado === 'bueno').length
        const rs = g.items.filter(b => b.estado === 'regular').length
        const ms = g.items.filter(b => b.estado === 'malo').length
        return [g.label, g.items.length, bs, rs, ms]
      })
      resumenBody.push(['TOTAL', bienes.length, estados.bueno, estados.regular, estados.malo])
      doc.autoTable({
        startY:99,
        head:[['Categoría','Total','Bueno','Regular','Malo']],
        body:resumenBody,
        styles:{ fontSize:9, cellPadding:3.5 },
        headStyles:{ fillColor:AZUL, textColor:255, fontStyle:'bold', halign:'center' },
        columnStyles:{
          0:{ halign:'left', cellWidth:80 }, 1:{ halign:'center', fontStyle:'bold' },
          2:{ halign:'center', textColor:[22,163,74] }, 3:{ halign:'center', textColor:[217,119,6] },
          4:{ halign:'center', textColor:[220,38,38] },
        },
        alternateRowStyles:{ fillColor:[248,249,255] },
        footStyles:{ fillColor:[230,232,245], fontStyle:'bold', textColor:AZUL },
        didParseCell:(data) => {
          if (data.row.index === resumenBody.length-1) {
            data.cell.styles.fontStyle = 'bold'; data.cell.styles.fillColor = [230,232,245]
          }
        },
        margin:{ left:14, right:14 },
      })
      let pageNum = 2
      Object.values(grupos).forEach(({ label, items }) => {
        if (!items.length) return
        doc.addPage(); addHeader(pageNum++)
        doc.setTextColor(...AZUL); doc.setFont('helvetica','bold'); doc.setFontSize(12)
        doc.text(label, 14, 35)
        doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(...GRIS)
        doc.text(`${items.length} bien${items.length !== 1 ? 'es' : ''}`, 14, 41)
        const extras = ['tipo','marca','modelo','numero_serie','isbn','autor'].filter(c =>
          items.some(b => b[c] != null && b[c] !== ''))
        const cols = ['nombre','codigo','estado','cantidad','ubicacion',...extras]
        const hdrs = {
          nombre:'Nombre', codigo:'Código', estado:'Estado', cantidad:'Cant.',
          ubicacion:'Ubicación', responsable:'Responsable', tipo:'Tipo',
          marca:'Marca', modelo:'Modelo', numero_serie:'N° Serie', isbn:'ISBN', autor:'Autor',
        }
        const ESTADO_COLOR = { bueno:[22,163,74], regular:[217,119,6], malo:[220,38,38], dado_de_baja:[107,114,128] }
        doc.autoTable({
          startY:45,
          head:[cols.map(c => hdrs[c] ?? c)],
          body:items.map(b => cols.map(c => b[c] ?? '')),
          styles:{ fontSize:8, cellPadding:2.8, overflow:'ellipsize' },
          headStyles:{ fillColor:AZUL, textColor:255, fontStyle:'bold' },
          alternateRowStyles:{ fillColor:[248,249,255] },
          didParseCell:(data) => {
            if (data.section === 'body') {
              const estadoIdx = cols.indexOf('estado')
              if (data.column.index === estadoIdx) {
                const color = ESTADO_COLOR[data.cell.raw]
                if (color) data.cell.styles.textColor = color
                data.cell.styles.fontStyle = 'bold'
              }
            }
          },
          margin:{ left:14, right:14 },
        })
      })
      addFooter()
      doc.save(`informe_inventario_${fechaArchivo}.pdf`)
      setExportando(false)
    }
    const loadScript = (src, id) => new Promise((resolve, reject) => {
      if (document.getElementById(id)) { resolve(); return }
      const s = document.createElement('script')
      s.id = id; s.src = src; s.onload = resolve; s.onerror = reject
      document.head.appendChild(s)
    })
    try {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', 'jspdf-script')
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js', 'jspdf-autotable-script')
      cargarPDF()
    } catch { setExportando(false) }
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

  const ajustesActivo = paginaActual === 'ajustes' || paginaActual === 'usuarios'
  const [ajustesAbierto, setAjustesAbierto] = useState(ajustesActivo)
  const [herramientasAbierto, setHerramientasAbierto] = useState(false)

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
    auditoria_tickets: 'Auditoría de Tickets',
    ajustes:    'Personalizar',
    campos:     'Campos por categoría',
  }

  const handleNav = (id) => { setPagina(id); setSidebarOpen(false) }

  useEffect(() => {
    if (!sidebarOpen) return
    const onKey = (e) => { if (e.key === 'Escape') setSidebarOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sidebarOpen])

  const toolButtons = [
    { Icon: FileSpreadsheet, label: 'Backup Excel', fn: exportarBackupExcel },
    { Icon: HardDrive,       label: 'Backup JSON',  fn: exportarBackupJSON  },
    { Icon: FileText,        label: 'Informe PDF',   fn: exportarInformePDF  },
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

          {/* Ajustes con submenú */}
          {(esAdmin || puedeAccederUsuarios || puedeGestionarAjustes) && (
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
                  {toolButtons.map(({ Icon, label, fn }) => (
                    <button key={label} className="tool-btn" onClick={fn} disabled={exportando}>
                      <span className="tool-btn-icon">
                        {exportando ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
                      </span>
                      {exportando ? 'Generando…' : label}
                    </button>
                  ))}
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
