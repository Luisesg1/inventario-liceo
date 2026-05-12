import { useState } from 'react'
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

export default function Layout({ usuario, onLogout, children, paginaActual, setPagina }) {
  const esAdmin = usuario.rol === 'admin'
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [exportando, setExportando] = useState(false)

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

      // Columnas visibles en el listado completo del resumen
      const COLS_LISTA = ['categoria_nombre', 'codigo', 'nombre', 'estado', 'cantidad', 'ubicacion', 'responsable', 'tipo', 'marca', 'modelo', 'numero_serie', 'obs']
      const HDRS_LISTA = ['Categoría',        'Código', 'Nombre', 'Estado', 'Cantidad', 'Ubicación', 'Responsable', 'Tipo', 'Marca', 'Modelo', 'N° Serie',    'Observaciones']

      // Bloque de resumen por categoría
      const resumenRows = [
        ['Categoría', 'Ícono', 'Total bienes'],
        ...Object.values(grupos).map(g => [g.label, g.icon, g.items.length]),
        [],
        ['TOTAL', '', bienes.length],
        [],
        ['Datos completos (' + bienes.length + ' bienes)'],
        HDRS_LISTA,
        ...bienes.map(b => {
          const cat = cats.find(c => c.id === b.categoria)
          return COLS_LISTA.map(c => c === 'categoria_nombre' ? (cat?.label ?? b.categoria ?? '') : (b[c] ?? ''))
        }),
      ]
      const wsRes = XLSX.utils.aoa_to_sheet(resumenRows)
      wsRes['!cols'] = HDRS_LISTA.map((h, i) => ({
        wch: Math.max(h.length + 2, i === 0 ? 20 : i === 2 ? 28 : 14),
      }))
      XLSX.utils.book_append_sheet(wb, wsRes, 'Resumen')

      Object.values(grupos).forEach(({ label, items }) => {
        if (!items.length) return
        const cols = COLS_BACKUP.filter(c => items.some(b => b[c] != null && b[c] !== ''))
        const rows = [cols, ...items.map(b => cols.map(c => b[c] ?? ''))]
        const ws = XLSX.utils.aoa_to_sheet(rows)
        ws['!cols'] = cols.map(h => ({ wch: Math.max(h.length + 4, 14) }))
        ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: cols.length - 1 } }) }
        ws['!tables'] = [{
          name: label.replace(/\s+/g, '_').replace(/[^A-Za-z0-9_]/g, '').slice(0, 255) || 'Tabla',
          ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: cols.length - 1 } }),
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
    s.onload = cargar
    s.onerror = () => setExportando(false)
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
    a.href = url
    a.download = `backup_inventario_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setExportando(false)
  }

  const exportarInformePDF = async () => {
    setExportando(true)
    const { bienes, cats } = await fetchBackupData()
    if (!bienes.length) { setExportando(false); return }

    const cargarPDF = () => {
      const { jsPDF } = window.jspdf
      const fecha = new Date()
      const fechaStr = fecha.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
      const fechaArchivo = fecha.toISOString().slice(0, 10)

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const W = doc.internal.pageSize.getWidth()
      const AZUL = [26, 35, 126]
      const DORADO = [212, 160, 23]
      const GRIS = [107, 114, 128]

      const addHeader = (pageNum) => {
        // Franja azul superior
        doc.setFillColor(...AZUL)
        doc.rect(0, 0, W, 22, 'F')
        // Línea dorada
        doc.setFillColor(...DORADO)
        doc.rect(0, 22, W, 1.5, 'F')

        doc.setTextColor(255, 255, 255)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(13)
        doc.text('Liceo Bicentenario Juvenal Hernández Jaque', W / 2, 9, { align: 'center' })
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8.5)
        doc.text('Inventario de Bienes — Informe Oficial', W / 2, 15.5, { align: 'center' })

        // Fecha y N° página en esquina
        doc.setTextColor(...GRIS)
        doc.setFontSize(7.5)
        doc.text(fechaStr, W - 12, 28, { align: 'right' })
        if (pageNum > 1) {
          doc.text(`Página ${pageNum}`, 12, 28)
        }
      }

      const addFooter = () => {
        const pageCount = doc.internal.getNumberOfPages()
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i)
          doc.setFillColor(245, 245, 250)
          doc.rect(0, 284, W, 13, 'F')
          doc.setDrawColor(220, 220, 235)
          doc.setLineWidth(0.3)
          doc.line(0, 284, W, 284)
          doc.setTextColor(...GRIS)
          doc.setFontSize(7.5)
          doc.text('Liceo Bicentenario Juvenal Hernández Jaque — Sistema de Inventario', W / 2, 290, { align: 'center' })
          doc.text(`${i} / ${pageCount}`, W - 12, 290, { align: 'right' })
        }
      }

      // ── Página 1: portada + resumen ────────────────────────
      addHeader(1)

      // Título principal
      doc.setTextColor(...AZUL)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(18)
      doc.text('Informe de Inventario', W / 2, 45, { align: 'center' })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(...GRIS)
      doc.text(`Generado el ${fechaStr}`, W / 2, 53, { align: 'center' })

      // Línea separadora
      doc.setDrawColor(...DORADO)
      doc.setLineWidth(0.8)
      doc.line(14, 58, W - 14, 58)

      // KPIs en cajas
      const estados = { bueno: 0, regular: 0, malo: 0, dado_de_baja: 0 }
      bienes.forEach(b => { if (b.estado && estados[b.estado] !== undefined) estados[b.estado]++ })
      const kpis = [
        { label: 'Total Bienes', value: bienes.length, color: AZUL },
        { label: 'En Buen Estado', value: estados.bueno, color: [22, 163, 74] },
        { label: 'Estado Regular', value: estados.regular, color: [217, 119, 6] },
        { label: 'Mal Estado', value: estados.malo, color: [220, 38, 38] },
        { label: 'Categorías', value: cats.length, color: [109, 40, 217] },
      ]
      const boxW = (W - 28 - 8 * 4) / 5
      kpis.forEach((k, i) => {
        const x = 14 + i * (boxW + 8)
        doc.setFillColor(248, 249, 255)
        doc.setDrawColor(...k.color)
        doc.setLineWidth(0.4)
        doc.roundedRect(x, 63, boxW, 22, 3, 3, 'FD')
        doc.setTextColor(...k.color)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(16)
        doc.text(String(k.value), x + boxW / 2, 75, { align: 'center' })
        doc.setFontSize(6.5)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...GRIS)
        doc.text(k.label, x + boxW / 2, 80.5, { align: 'center' })
      })

      // Tabla resumen por categoría
      doc.setTextColor(...AZUL)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text('Resumen por Categoría', 14, 95)

      const grupos = {}
      bienes.forEach(b => {
        const cat = cats.find(c => c.id === b.categoria)
        const key = b.categoria || 'sin_categoria'
        if (!grupos[key]) grupos[key] = { label: cat?.label ?? 'Sin categoría', icon: cat?.icon ?? '📦', items: [] }
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
        startY: 99,
        head: [['Categoría', 'Total', 'Bueno', 'Regular', 'Malo']],
        body: resumenBody,
        styles: { fontSize: 9, cellPadding: 3.5 },
        headStyles: { fillColor: AZUL, textColor: 255, fontStyle: 'bold', halign: 'center' },
        columnStyles: {
          0: { halign: 'left', cellWidth: 80 },
          1: { halign: 'center', fontStyle: 'bold' },
          2: { halign: 'center', textColor: [22, 163, 74] },
          3: { halign: 'center', textColor: [217, 119, 6] },
          4: { halign: 'center', textColor: [220, 38, 38] },
        },
        alternateRowStyles: { fillColor: [248, 249, 255] },
        footStyles: { fillColor: [230, 232, 245], fontStyle: 'bold', textColor: AZUL },
        didParseCell: (data) => {
          if (data.row.index === resumenBody.length - 1) {
            data.cell.styles.fontStyle = 'bold'
            data.cell.styles.fillColor = [230, 232, 245]
          }
        },
        margin: { left: 14, right: 14 },
      })

      // ── Páginas siguientes: detalle por categoría ──────────
      let pageNum = 2
      Object.values(grupos).forEach(({ label, items }) => {
        if (!items.length) return
        doc.addPage()
        addHeader(pageNum++)

        doc.setTextColor(...AZUL)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12)
        doc.text(label, 14, 35)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8.5)
        doc.setTextColor(...GRIS)
        doc.text(`${items.length} bien${items.length !== 1 ? 'es' : ''}`, 14, 41)

        // Columnas dinámicas: siempre nombre/codigo/estado/cantidad/ubicacion/responsable + específicas no vacías
        const extras = ['tipo','marca','modelo','numero_serie','isbn','autor'].filter(c =>
          items.some(b => b[c] != null && b[c] !== '')
        )
        const cols = ['nombre', 'codigo', 'estado', 'cantidad', 'ubicacion', ...extras]
        const hdrs = {
          nombre: 'Nombre', codigo: 'Código', estado: 'Estado', cantidad: 'Cant.',
          ubicacion: 'Ubicación', responsable: 'Responsable',
          tipo: 'Tipo', marca: 'Marca', modelo: 'Modelo', numero_serie: 'N° Serie',
          isbn: 'ISBN', autor: 'Autor',
        }

        const ESTADO_COLOR = {
          bueno: [22, 163, 74], regular: [217, 119, 6], malo: [220, 38, 38], dado_de_baja: [107, 114, 128]
        }

        doc.autoTable({
          startY: 45,
          head: [cols.map(c => hdrs[c] ?? c)],
          body: items.map(b => cols.map(c => b[c] ?? '')),
          styles: { fontSize: 8, cellPadding: 2.8, overflow: 'ellipsize' },
          headStyles: { fillColor: AZUL, textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [248, 249, 255] },
          didParseCell: (data) => {
            if (data.section === 'body') {
              const estadoIdx = cols.indexOf('estado')
              if (data.column.index === estadoIdx) {
                const v = data.cell.raw
                const color = ESTADO_COLOR[v]
                if (color) data.cell.styles.textColor = color
                data.cell.styles.fontStyle = 'bold'
              }
            }
          },
          margin: { left: 14, right: 14 },
        })
      })

      addFooter()
      doc.save(`informe_inventario_${fechaArchivo}.pdf`)
      setExportando(false)
    }

    const loadScript = (src, id) => new Promise((resolve, reject) => {
      if (document.getElementById(id)) { resolve(); return }
      const s = document.createElement('script')
      s.id = id; s.src = src
      s.onload = resolve; s.onerror = reject
      document.head.appendChild(s)
    })

    try {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', 'jspdf-script')
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js', 'jspdf-autotable-script')
      cargarPDF()
    } catch {
      setExportando(false)
    }
  }

  const navItems = [
    { id: 'dashboard',  icon: '◉', label: 'Inicio' },
    { id: 'inventario', icon: '▤', label: 'Inventario' },
    ...(esAdmin ? [{ id: 'usuarios',  icon: '◎', label: 'Usuarios'  }] : []),
    ...(esAdmin ? [{ id: 'auditoria', icon: '🔍', label: 'Auditoría' }] : []),
    { id: 'tickets', icon: '🎫', label: 'Tickets' },
  ]

  const titulos = {
    dashboard:  'Inicio',
    inventario: 'Inventario de Bienes',
    usuarios:   'Gestión de Usuarios',
    auditoria:  'Auditoría de Cambios',
    tickets:    'Tickets',
  }

  const handleNav = (id) => { setPagina(id); setSidebarOpen(false) }

  return (
    <div className="layout">

      <div className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`} onClick={() => setSidebarOpen(false)} />

      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-logo">
          <img src="/logo-liceo.png" alt="Logo" className="sidebar-logo-img" />
          <div style={{ minWidth: 0 }}>
            <p className="sidebar-title">Inventario</p>
            <p className="sidebar-sub">Liceo JHJ</p>
          </div>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)}>✕</button>
        </div>

        <nav className="sidebar-nav">
          <p className="nav-section">Principal</p>
          {navItems.map(item => (
            <div key={item.id} className={`nav-item ${paginaActual === item.id ? 'active' : ''}`} onClick={() => handleNav(item.id)}>
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </div>
          ))}
        </nav>

        {esAdmin && <div style={{ borderTop: '1px solid rgba(212,160,23,0.12)', paddingBottom: 4 }}>
          <p className="nav-section">Herramientas</p>
          {[
            { icon: '🗂️', label: 'Backup Excel',   fn: exportarBackupExcel },
            { icon: '💾', label: 'Backup JSON',    fn: exportarBackupJSON  },
            { icon: '📄', label: 'Informe PDF',    fn: exportarInformePDF  },
          ].map(({ icon, label, fn }) => (
            <button key={label} onClick={fn} disabled={exportando} style={{
              display: 'flex', alignItems: 'center', gap: 11, width: '100%',
              padding: '11px 18px', background: 'none', border: 'none',
              cursor: exportando ? 'wait' : 'pointer',
              color: exportando ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.5)',
              fontSize: 13.5, fontWeight: 500, textAlign: 'left',
              borderLeft: '3px solid transparent', transition: 'all .18s',
            }}
            onMouseEnter={e => { if (!exportando) { e.currentTarget.style.color = 'rgba(255,255,255,.88)'; e.currentTarget.style.background = 'rgba(255,255,255,.05)' } }}
            onMouseLeave={e => { e.currentTarget.style.color = exportando ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.5)'; e.currentTarget.style.background = 'none' }}
            >
              <span style={{ width: 20, textAlign: 'center', fontSize: 16, flexShrink: 0 }}>
                {exportando ? '⏳' : icon}
              </span>
              {exportando ? 'Generando…' : label}
            </button>
          ))}
        </div>}

        <div className="sidebar-user">
          <div className="avatar">{usuario.nombre[0]}</div>
          <div className="user-info">
            <p>{usuario.nombre}</p>
            <span>{esAdmin ? 'Administrador' : 'Encargado'}</span>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="btn-hamburger" onClick={() => setSidebarOpen(true)}>
            <span /><span /><span />
          </button>
          <h1>{titulos[paginaActual]}</h1>
          <button className="btn-logout" onClick={() => setConfirmLogout(true)}>Cerrar sesión</button>
        </header>
        <div className="content">
          {children}
        </div>
      </div>

      {confirmLogout && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(5,12,55,0.7)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 500, animation: 'fadeInOverlay 0.15s ease',
        }}>
          <style>{`@keyframes fadeInOverlay { from { opacity: 0 } to { opacity: 1 } }
            @keyframes slideUpModal { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: translateY(0) } }`}
          </style>
          <div style={{
            background: '#fff', borderRadius: 18,
            padding: '32px 32px 28px', maxWidth: 340, width: '90%',
            textAlign: 'center',
            boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
            border: '1px solid rgba(212,160,23,0.15)',
            animation: 'slideUpModal 0.18s ease',
          }}>
            <div style={{ fontSize: 44, marginBottom: 14 }}>👋</div>
            <h3 style={{ margin: '0 0 8px', color: '#1a237e', fontWeight: 700, fontSize: 18 }}>
              ¿Cerrar sesión?
            </h3>
            <p style={{ margin: '0 0 24px', color: '#6b7280', fontSize: 14, lineHeight: 1.5 }}>
              Se cerrará tu sesión y volverás al inicio de sesión.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={() => setConfirmLogout(false)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10,
                  border: '1.5px solid #e5e7eb', background: '#f9fafb',
                  color: '#374151', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseOver={e => e.target.style.background = '#f3f4f6'}
                onMouseOut={e => e.target.style.background = '#f9fafb'}
              >
                Cancelar
              </button>
              <button
                onClick={onLogout}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10,
                  border: 'none',
                  background: 'linear-gradient(135deg, #1a237e, #2563eb)',
                  color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(26,35,126,0.35)',
                  transition: 'opacity 0.15s',
                }}
                onMouseOver={e => e.target.style.opacity = '0.88'}
                onMouseOut={e => e.target.style.opacity = '1'}
              >
                Sí, cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}