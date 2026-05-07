import { useState } from 'react'
import './Layout.css'

export default function Layout({ usuario, onLogout, children, paginaActual, setPagina }) {
  const esAdmin = usuario.rol === 'admin'
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)

  const navItems = [
    { id: 'dashboard',  icon: '◉', label: 'Inicio' },
    { id: 'inventario', icon: '▤', label: 'Inventario' },
    ...(esAdmin ? [{ id: 'usuarios', icon: '◎', label: 'Usuarios' }] : [])
  ]

  const titulos = {
    dashboard:  'Inicio',
    inventario: 'Inventario de Bienes',
    usuarios:   'Gestión de Usuarios',
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