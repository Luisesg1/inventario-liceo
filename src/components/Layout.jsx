import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Package2,
  Ticket, Settings2,
  HardDrive, ChevronRight, X, LogOut,
  ShoppingCart, ShieldCheck, History, Trash2,
  UserCog, BookOpen,
} from 'lucide-react'
import './Layout.css'
import { supabase } from '../supabase'
import { labelDeRol } from '../config/roles'

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
  puedeVerReglamentos = false,
  puedeVerAuditoriaReglamentos = false,
  puedeVerAuditoriaPapelera = false,
  puedeVerBackups = false,
  esSoporte = false,
}) {
  const esAdmin   = usuario.rol === 'admin'
  const esVisorReq    = usuario.rol === 'visor_requerimientos'
  const muestraInventario = puedeVerInventario
  const muestraRequerimientos = esVisorReq || puedeVerRequerimientos

  const [sidebarOpen,      setSidebarOpen]      = useState(false)
  const [confirmLogout,    setConfirmLogout]    = useState(false)
  const [ticketsAbiertos,  setTicketsAbiertos]  = useState(0)

  useEffect(() => {
    if (!puedeGestionarTickets) return
    const cargar = async () => {
      const { count } = await supabase
        .from('tickets').select('*', { count: 'exact', head: true }).eq('estado', 'Abierto').eq('is_deleted', false)
      setTicketsAbiertos(count ?? 0)
    }
    cargar()
    if (onRefreshTicketBadge) onRefreshTicketBadge(cargar)
    const sub = supabase.channel('tickets-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, cargar)
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [puedeGestionarTickets])

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

  const reglamentosActivo = paginaActual === 'reglamentos' || paginaActual === 'reglamentos_auditoria'
  const [reglamentosAbierto, setReglamentosAbierto] = useState(reglamentosActivo)

  const papeleraActivo = paginaActual === 'papelera' || paginaActual === 'papelera_auditoria'
  const [papeleraAbierto, setPapeleraAbierto] = useState(papeleraActivo)

  const ajustesActivo = paginaActual === 'ajustes' || paginaActual === 'usuarios' || paginaActual === 'mantenedor_roles'
  const [ajustesAbierto, setAjustesAbierto] = useState(ajustesActivo)

  const backupsActivo = paginaActual === 'backups' || paginaActual === 'backups_actividad'
  const [backupsAbierto, setBackupsAbierto] = useState(backupsActivo)

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
    reglamentos:               'Reglamentos',
    reglamentos_auditoria:     'Auditoría de Reglamentos',
    papelera_auditoria:        'Auditoría de Papelera',
    backups:                   'Backups',
    backups_actividad:         'Actividad de Backups',
  }

  const handleNav = (id) => { setPagina(id); setSidebarOpen(false) }

  useEffect(() => {
    if (!sidebarOpen) return
    const onKey = (e) => { if (e.key === 'Escape') setSidebarOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sidebarOpen])

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

          {/* Reglamentos con submenú */}
          {puedeVerReglamentos && <>
            <motion.div
              className={`nav-item nav-item--parent ${reglamentosActivo ? 'active' : ''}`}
              onClick={() => setReglamentosAbierto(o => !o)}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            >
              <span className="nav-icon">
                <BookOpen size={15} strokeWidth={2} />
              </span>
              Reglamentos
              <span className={`nav-chevron ${reglamentosAbierto ? 'nav-chevron--open' : ''}`}>
                <ChevronRight size={13} strokeWidth={2.5} />
              </span>
            </motion.div>
            <AnimatePresence initial={false}>
              {reglamentosAbierto && (
                <motion.div
                  className="nav-submenu"
                  variants={submenuVariants}
                  initial="closed"
                  animate="open"
                  exit="closed"
                  style={{ overflow: 'hidden' }}
                >
                  <div
                    className={`nav-subitem ${paginaActual === 'reglamentos' ? 'active' : ''}`}
                    onClick={() => handleNav('reglamentos')}
                  >
                    <span className="nav-subitem-dot" />
                    Documentos
                  </div>
                  {puedeVerAuditoriaReglamentos && (
                    <div
                      className={`nav-subitem ${paginaActual === 'reglamentos_auditoria' ? 'active' : ''}`}
                      onClick={() => handleNav('reglamentos_auditoria')}
                    >
                      <span className="nav-subitem-dot" />
                      Auditoría
                    </div>
                  )}
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

          {/* Papelera con submenú */}
          {puedeVerPapelera && <>
            <motion.div
              className={`nav-item nav-item--parent ${papeleraActivo ? 'active' : ''}`}
              onClick={() => setPapeleraAbierto(o => !o)}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            >
              <span className="nav-icon">
                <Trash2 size={15} strokeWidth={2} />
              </span>
              Papelera
              <span className={`nav-chevron ${papeleraAbierto ? 'nav-chevron--open' : ''}`}>
                <ChevronRight size={13} strokeWidth={2.5} />
              </span>
            </motion.div>
            <AnimatePresence initial={false}>
              {papeleraAbierto && (
                <motion.div
                  className="nav-submenu"
                  variants={submenuVariants}
                  initial="closed"
                  animate="open"
                  exit="closed"
                  style={{ overflow: 'hidden' }}
                >
                  <div
                    className={`nav-subitem ${paginaActual === 'papelera' ? 'active' : ''}`}
                    onClick={() => handleNav('papelera')}
                  >
                    <span className="nav-subitem-dot" />
                    Elementos eliminados
                  </div>
                  {puedeVerAuditoriaPapelera && (
                    <div
                      className={`nav-subitem ${paginaActual === 'papelera_auditoria' ? 'active' : ''}`}
                      onClick={() => handleNav('papelera_auditoria')}
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

          {/* Backups — visible según permiso (admin lo recibe completo) */}
          {puedeVerBackups && <>
            <motion.div
              className={`nav-item nav-item--parent ${backupsActivo ? 'active' : ''}`}
              onClick={() => setBackupsAbierto(o => !o)}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            >
              <span className="nav-icon">
                <HardDrive size={15} strokeWidth={2} />
              </span>
              Backups
              <span className={`nav-chevron ${backupsAbierto ? 'nav-chevron--open' : ''}`}>
                <ChevronRight size={13} strokeWidth={2.5} />
              </span>
            </motion.div>
            <AnimatePresence initial={false}>
              {backupsAbierto && (
                <motion.div
                  className="nav-submenu"
                  variants={submenuVariants}
                  initial="closed"
                  animate="open"
                  exit="closed"
                  style={{ overflow: 'hidden' }}
                >
                  <div
                    className={`nav-subitem ${paginaActual === 'backups' ? 'active' : ''}`}
                    onClick={() => handleNav('backups')}
                  >
                    <span className="nav-subitem-dot" />
                    Respaldos
                  </div>
                  <div
                    className={`nav-subitem ${paginaActual === 'backups_actividad' ? 'active' : ''}`}
                    onClick={() => handleNav('backups_actividad')}
                  >
                    <span className="nav-subitem-dot" />
                    Actividad
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>}
        </nav>

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
              <span>{labelDeRol(usuario.rol)}</span>
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
