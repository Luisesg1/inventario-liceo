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

  const navItems = [
    { id: 'dashboard',  icon: '◉', label: 'Inicio' },
    { id: 'inventario', icon: '▤', label: 'Inventario' },
    ...(esAdmin ? [{ id: 'usuarios',  icon: '◎', label: 'Usuarios'  }] : []),
    ...(esAdmin ? [{ id: 'auditoria', icon: '🔍', label: 'Auditoría' }] : []),
  ]

  const titulos = {
    dashboard:  'Inicio',
    inventario: 'Inventario de Bienes',
    usuarios:   'Gestión de Usuarios',
    auditoria:  'Auditoría de Cambios',
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
            { icon: '🗂️', label: 'Backup Excel', fn: exportarBackupExcel },
            { icon: '💾', label: 'Backup JSON',  fn: exportarBackupJSON  },
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