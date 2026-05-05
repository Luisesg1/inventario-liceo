import { useState } from 'react'
import './Layout.css'

export default function Layout({ usuario, onLogout, children, paginaActual, setPagina }) {
  const esAdmin = usuario.rol === 'admin'
  const [sidebarOpen, setSidebarOpen] = useState(false)

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
          <span>📋</span>
          <div>
            <p className="sidebar-title">Inventario</p>
            <p className="sidebar-sub">Liceo</p>
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
          <button className="btn-logout" onClick={onLogout}>Cerrar sesión</button>
        </header>
        <div className="content">
          {children}
        </div>
      </div>
    </div>
  )
}