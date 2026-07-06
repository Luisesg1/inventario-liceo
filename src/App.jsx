import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase, esRecuperacion, recoveryTokens } from './supabase'
import Layout from './components/Layout'
import Login from './pages/Login'
import Inventario from './pages/Inventario'
import Dashboard from './pages/Dashboard'
import Usuarios from './pages/Usuarios'
import SetPassword from './pages/SetPassword'
import Auditoria from './pages/Auditoria'
import Tickets   from './pages/Tickets'
import Ajustes          from './pages/Ajustes'
import CamposCategoria  from './pages/CamposCategoria'
import Requerimientos   from './pages/Requerimientos'
import Permisos         from './pages/Permisos'
import Compensatorios   from './pages/Compensatorios'
import MantenedorRoles  from './pages/MantenedorRoles'
import Papelera         from './pages/Papelera'
import Personal        from './pages/Personal'
import Reglamentos     from './pages/Reglamentos'
import { aplicarTema } from './utils/tema'

const RUTA_A_PAGINA = {
  '/':                         'dashboard',
  '/dashboard':                'dashboard',
  '/inventario':               'inventario',
  '/inventario/auditoria':     'auditoria',
  '/requerimientos':           'requerimientos',
  '/requerimientos/auditoria': 'auditoria_requerimientos',
  '/tickets':                  'tickets',
  '/tickets/auditoria':        'auditoria_tickets',
  '/ausencias/mis-ausencias':  'mis_ausencias',
  '/ausencias/gestion':        'permisos',
  '/ausencias/compensatorios': 'compensatorios',
  '/ausencias/auditoria':      'auditoria_permisos',
  '/auditoria-general':        'auditoria_general',
  '/papelera':                 'papelera',
  '/usuarios':                 'usuarios',
  '/ajustes':                  'ajustes',
  '/ajustes/campos':           'campos',
  '/ajustes/roles':            'mantenedor_roles',
  '/personal':                      'personal',
  '/personal/contrataciones':        'personal_contrataciones',
  '/personal/reemplazos':            'personal_reemplazos',
  '/personal/documentos':            'personal_documentos',
  '/personal/auditoria':             'personal_auditoria',

  '/reglamentos':                    'reglamentos',
  '/reglamentos/auditoria':          'reglamentos_auditoria',
  '/papelera/auditoria':             'papelera_auditoria',
}

const PAGINA_A_RUTA = {
  dashboard:                '/',
  inventario:               '/inventario',
  auditoria:                '/inventario/auditoria',
  requerimientos:           '/requerimientos',
  auditoria_requerimientos: '/requerimientos/auditoria',
  tickets:                  '/tickets',
  auditoria_tickets:        '/tickets/auditoria',
  mis_ausencias:            '/ausencias/mis-ausencias',
  permisos:                 '/ausencias/gestion',
  compensatorios:           '/ausencias/compensatorios',
  auditoria_permisos:       '/ausencias/auditoria',
  auditoria_general:        '/auditoria-general',
  papelera:                 '/papelera',
  usuarios:                 '/usuarios',
  ajustes:                  '/ajustes',
  campos:                   '/ajustes/campos',
  mantenedor_roles:         '/ajustes/roles',
  personal:                      '/personal',
  personal_contrataciones:        '/personal/contrataciones',
  personal_reemplazos:            '/personal/reemplazos',
  personal_documentos:            '/personal/documentos',
  personal_auditoria:             '/personal/auditoria',

  reglamentos:                    '/reglamentos',
  reglamentos_auditoria:          '/reglamentos/auditoria',
  papelera_auditoria:             '/papelera/auditoria',
}

// Permisos mínimos por rol — usado como fallback cuando la BD no devuelve datos
// (usuario recién registrado antes de que el trigger/función persistan los permisos)
const PERMISOS_DEFAULT_ROL = {
  docente: {
    ver_tickets: true, crear_ticket: true, editar_ticket: true, exportar_tickets: true,
    ver_propias_ausencias: true, exportar_ausencias: true,
  },
  coordinador: {
    ver_tickets: true, crear_ticket: true, editar_ticket: true, exportar_tickets: true,
    ver_propias_ausencias: true, exportar_ausencias: true,
  },
  asistente: {
    ver_tickets: true, crear_ticket: true, editar_ticket: true, exportar_tickets: true,
    ver_propias_ausencias: true, exportar_ausencias: true,
  },
  administrativo: {
    ver_tickets: true, crear_ticket: true, editar_ticket: true, exportar_tickets: true,
    ver_propias_ausencias: true, exportar_ausencias: true,
  },
  soporte: {
    ver_tickets: true, crear_ticket: true, editar_ticket: true,
    gestionar_tickets: true, eliminar_ticket: true, ver_alertas_tickets: true, exportar_tickets: true,
    ver_propias_ausencias: true, exportar_ausencias: true,
    gestionar_ajustes: true, ver_ajustes: true, guardar_cambios_ajustes: true,
  },
  directivo: {
    ver_inventario: true, agregar_bien: true, editar_bien: true,
    importar_csv: true, exportar: true, registrar_prestamo: true, registrar_incidencia: true,
    ver_auditoria_inventario: true,
  },
  visor_requerimientos: { ver_tickets: true },
}

export default function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const pagina   = RUTA_A_PAGINA[location.pathname] || 'dashboard'

  const [usuario,            setUsuario]            = useState(null)
  const [permisosUsuario,    setPermisosUsuario]    = useState({})
  const [cargando,           setCargando]           = useState(true)
  const [logoUrl,            setLogoUrl]            = useState(null)
  const [nombreSistema,      setNombreSistema]      = useState('Sistema de Gestión Liceo JHJ')
  const [nombreInstitucion,  setNombreInstitucion]  = useState('Liceo Polivalente de Excelencia Juvenal Hernández Jaque')
  const [mostrarSetPassword, setMostrarSetPassword] = useState(false)
  const [abrirBienId,        setAbrirBienId]        = useState(null)
  const [abrirCatId,           setAbrirCatId]           = useState(null)
  const [filtroInicialTickets, setFiltroInicialTickets] = useState('')
  const [filtroInicialReqs,    setFiltroInicialReqs]    = useState(null)
  const refreshTicketBadge = useRef(null)
  const procesandoCambio   = useRef(false)
  const modoRecovery       = useRef(esRecuperacion)
  const sesionCargada      = useRef(false)
  const forzarHome         = useRef(false)

  // ── Permisos computados (null-safe para cuando usuario aún no cargó) ──
  const esAdmin      = usuario?.rol === 'admin'
  const esVisorReq   = usuario?.rol === 'visor_requerimientos'
  const esSoporte    = usuario?.rol === 'soporte'
  const esDirectivo  = usuario?.rol === 'directivo'
  const p            = permisosUsuario ?? {}

  // Restricciones duras por rol que prevalecen sobre el JSONB almacenado
  // Garantizan cumplimiento de la matriz incluso para usuarios con permisos legacy
  const rolPermiteTickets     = !esDirectivo
  const rolPermiteReqs        = !esDirectivo && !esSoporte
  const rolPermiteAusencias   = !esDirectivo
  const rolPermiteAjustesMenu = !esDirectivo

  const puedeVerInventario          = esAdmin || !!p.ver_inventario
  const puedeVerAuditoriaInventario = esAdmin || !!p.ver_auditoria_inventario
  const puedeVerTickets             = rolPermiteTickets  && (esAdmin || !!p.ver_tickets || !!p.gestionar_tickets)
  const puedeGestionarTickets       = rolPermiteTickets  && (esAdmin || !!p.gestionar_tickets)
  const puedeVerAlertasTickets      = rolPermiteTickets  && (esAdmin || esSoporte || !!p.ver_alertas_tickets)
  const puedeVerAuditoriaReq        = rolPermiteReqs     && (esAdmin || !!p.ver_auditoria_requerimientos)
  const puedeVerAuditoriaPermisos   = rolPermiteAusencias && (esAdmin || !!p.ver_auditoria_permisos)
  const puedeVerAuditoriaTickets    = rolPermiteTickets  && (esAdmin || !!p.gestionar_tickets)
  // "Mis ausencias" visible para todos los roles excepto directivo y visor_requerimientos
  // No depende del JSONB para que usuarios con permisos legacy también lo vean
  const puedeAccederAusencias       = rolPermiteAusencias && !esVisorReq
  const permisosTickets = {
    verPropios: rolPermiteTickets && (esAdmin || !!p.ver_tickets),
    crear:      rolPermiteTickets && (esAdmin || p.crear_ticket !== false),
    editar:     rolPermiteTickets && (esAdmin || !!p.editar_ticket),
    gestionar:  rolPermiteTickets && (esAdmin || !!p.gestionar_tickets),
    eliminar:   rolPermiteTickets && (esAdmin || !!p.eliminar_ticket),
    exportar:   rolPermiteTickets && (esAdmin || p.exportar_tickets !== false),
  }
  const permisosReqs = {
    ver:          rolPermiteReqs && (esAdmin || !!p.ver_requerimientos),
    crear:        rolPermiteReqs && (esAdmin || !!p.crear_requerimiento),
    editar:       rolPermiteReqs && (esAdmin || !!p.editar_requerimiento),
    eliminar:     rolPermiteReqs && (esAdmin || !!p.eliminar_requerimiento),
    importar:     rolPermiteReqs && (esAdmin || !!p.importar_requerimientos),
    exportar:     rolPermiteReqs && (esAdmin || !!p.exportar_requerimientos),
    verAuditoria: rolPermiteReqs && (esAdmin || !!p.ver_auditoria_requerimientos),
  }
  const permisosAusencia = {
    ver:             rolPermiteAusencias && (esAdmin || !!p.ver_ausencias),
    crear:           rolPermiteAusencias && (esAdmin || !!p.crear_ausencias),
    editar:          rolPermiteAusencias && (esAdmin || !!p.editar_ausencias),
    eliminar:        rolPermiteAusencias && (esAdmin || !!p.eliminar_ausencias),
    aprobar:         rolPermiteAusencias && (esAdmin || !!p.aprobar_ausencias),
    exportar:        rolPermiteAusencias && (esAdmin || !!p.exportar_ausencias),
    verAuditoria:    rolPermiteAusencias && (esAdmin || !!p.ver_auditoria_permisos),
    invitarUsuario:      esAdmin || !!p.invitar_usuario,
    editarUsuario:       esAdmin || !!p.editar_usuario,
    eliminarUsuario:     esAdmin || !!p.eliminar_usuario,
    verHistorialUsuarios: esAdmin || !!p.ver_historial_usuarios,
  }
  const permisosComp = {
    ver:          esAdmin || !!p.ver_compensatorios,
    crear:        esAdmin || !!p.crear_compensatorios,
    editar:       esAdmin || !!p.editar_compensatorios,
    eliminar:     esAdmin || !!p.eliminar_compensatorios,
    exportar:     esAdmin || !!p.exportar_compensatorios,
    verAuditoria: esAdmin || !!p.ver_auditoria_compensatorios,
  }
  const puedeVerCompensatorios          = permisosComp.ver
  const puedeVerAuditoriaCompensatorios = permisosComp.verAuditoria
  const puedeGestionarAusencias = esAdmin || !!p.crear_ausencias || !!p.editar_ausencias
  const paginasVisorReq         = ['dashboard', 'requerimientos', 'tickets']
  const puedeAccederUsuarios    = esAdmin || !!p.invitar_usuario || !!p.editar_usuario || !!p.eliminar_usuario || !!p.gestionar_usuarios || !!p.editar_roles_permisos
  const puedeGestionarAjustes   = rolPermiteAjustesMenu && (esAdmin || !!p.gestionar_ajustes || !!p.ver_ajustes || !!p.guardar_cambios_ajustes)
  const puedeGestionarRoles     = esAdmin || !!p.gestionar_roles
  const puedeGestionarCampos    = esAdmin || !!p.gestionar_campos || !!p.ver_campos
  const permisosCampos = {
    ver:           esAdmin || !!p.ver_campos || !!p.gestionar_campos,
    agregar:       esAdmin || !!p.agregar_campo || !!p.gestionar_campos,
    editar:        esAdmin || !!p.editar_campo || !!p.gestionar_campos,
    ocultar:       esAdmin || !!p.ocultar_campo || !!p.gestionar_campos,
    eliminar:      esAdmin || !!p.eliminar_campo || !!p.gestionar_campos,
    reordenar:     esAdmin || !!p.reordenar_campos || !!p.gestionar_campos,
    gestionarBase: esAdmin || !!p.gestionar_campos_base || !!p.gestionar_campos,
  }

  const puedeVerAuditoriaGeneral = esAdmin

  // ── Permisos Personal ────────────────────────────────────────
  const PAGINAS_PERSONAL = new Set(['personal','personal_contrataciones','personal_reemplazos','personal_documentos'])
  const permisosPersonal = {
    ver_contrataciones:      esAdmin || !!p.ver_contrataciones,
    crear_contrataciones:    esAdmin || !!p.crear_contrataciones,
    editar_contrataciones:   esAdmin || !!p.editar_contrataciones,
    eliminar_contrataciones: esAdmin || !!p.eliminar_contrataciones,
    ver_reemplazos:          esAdmin || !!p.ver_reemplazos,
    crear_reemplazos:        esAdmin || !!p.crear_reemplazos,
    editar_reemplazos:       esAdmin || !!p.editar_reemplazos,
    eliminar_reemplazos:     esAdmin || !!p.eliminar_reemplazos,
    ver_documentos_personal:    esAdmin || !!p.ver_documentos_personal,
    subir_documentos_personal:  esAdmin || !!p.subir_documentos_personal,
    eliminar_documentos_personal: esAdmin || !!p.eliminar_documentos_personal,
    ver_auditoria_personal:     esAdmin || !!p.ver_auditoria_personal,
  }
  const puedeVerPersonal = esAdmin
    || permisosPersonal.ver_contrataciones
    || permisosPersonal.ver_reemplazos
    || permisosPersonal.ver_documentos_personal

  const puedeVerPapelera          = esAdmin || !!p.ver_papelera
  const puedeVerAuditoriaPapelera = esAdmin || !!p.ver_auditoria_papelera
  const permisosPapelera = {
    restaurar:         esAdmin || !!p.restaurar_registros,
    eliminarPermanente: esAdmin || !!p.eliminar_permanentemente,
    verAuditoria:      esAdmin || !!p.ver_auditoria_papelera,
  }

  // ── Permisos Reglamentos ─────────────────────────────────────────────
  const puedeAdministrarReglamentos = esAdmin || !!p.administrar_reglamentos
  const permisosReglamentos = {
    ver:       esAdmin || !!p.ver_reglamentos,
    crear:     esAdmin || !!p.crear_reglamentos,
    editar:    esAdmin || !!p.editar_reglamentos,
    eliminar:  esAdmin || !!p.eliminar_reglamentos,
    descargar: esAdmin || !!p.descargar_reglamentos,
    // La gestión de versiones es una acción avanzada: la habilita su permiso
    // específico o el permiso paraguas de administración del módulo.
    versiones: esAdmin || !!p.gestionar_versiones_reglamentos || puedeAdministrarReglamentos,
    administrar:  puedeAdministrarReglamentos,
    verAuditoria: esAdmin || !!p.ver_auditoria_reglamentos,
  }
  const puedeVerReglamentos = esAdmin || !!p.ver_reglamentos

  const soloAdmin = (pagina === 'reglamentos'       && !puedeVerReglamentos)
    || (pagina === 'usuarios'         && !puedeAccederUsuarios)
    || (pagina === 'mantenedor_roles'             && !puedeGestionarRoles)
    || (pagina === 'auditoria'                   && !puedeVerAuditoriaInventario)
    || (pagina === 'ajustes'                     && !puedeGestionarAjustes)
    || (pagina === 'campos'                      && !puedeGestionarCampos)
    || (pagina === 'permisos'                    && !puedeGestionarAusencias)
    || (pagina === 'compensatorios'              && !puedeVerCompensatorios)
    || (pagina === 'auditoria_requerimientos'    && !puedeVerAuditoriaReq)
    || (pagina === 'auditoria_permisos'          && !puedeVerAuditoriaPermisos && !puedeVerAuditoriaCompensatorios)
    || (pagina === 'auditoria_tickets'           && !puedeVerAuditoriaTickets)
    || (pagina === 'auditoria_general'           && !puedeVerAuditoriaGeneral)
    || (pagina === 'papelera'                    && !puedeVerPapelera)
    || (pagina === 'reglamentos_auditoria'       && !permisosReglamentos.verAuditoria)
    || (pagina === 'papelera_auditoria'          && !puedeVerAuditoriaPapelera)
    || (pagina === 'tickets'                     && !puedeVerTickets)
    || (pagina === 'requerimientos'              && !permisosReqs.ver)
    || (pagina === 'mis_ausencias'               && !puedeAccederAusencias)
    || (PAGINAS_PERSONAL.has(pagina)             && !puedeVerPersonal)
  const soloStaff = pagina === 'inventario'
    || (pagina === 'requerimientos' && !permisosReqs.ver)

  const PAGINAS_AUSENCIAS = new Set(['permisos', 'compensatorios', 'auditoria_permisos'])
  const paginaSegura = !usuario ? pagina
    : (!puedeVerInventario && soloStaff) ? 'tickets'
    : (esVisorReq && !paginasVisorReq.includes(pagina)) ? 'requerimientos'
    : usuario.rol !== 'admin' && soloAdmin
      ? (PAGINAS_AUSENCIAS.has(pagina) ? (puedeAccederAusencias ? 'mis_ausencias' : 'dashboard') : 'dashboard')
    : pagina

  // ── Navegación ───────────────────────────────────────────────────
  const cambiarPagina = (p) => navigate(PAGINA_A_RUTA[p] || '/')
  const irATickets    = (filtro = '') => { setFiltroInicialTickets(filtro); cambiarPagina('tickets') }
  const irAReqs       = (filtro = null) => { setFiltroInicialReqs(filtro); cambiarPagina('requerimientos') }
  const irAInventario = () => cambiarPagina('inventario')

  // ── Redirigir al Home al iniciar sesión (login o F5) y luego mantener permisos ──
  useEffect(() => {
    if (!usuario || cargando) return
    if (forzarHome.current) {
      forzarHome.current = false
      navigate('/', { replace: true })
      return
    }
    const rutaEsperada = PAGINA_A_RUTA[paginaSegura] || '/'
    if (location.pathname !== rutaEsperada) {
      navigate(rutaEsperada, { replace: true })
    }
  }, [paginaSegura, usuario, cargando])

  // ── Manejar ?bien= al cargar ─────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const id = params.get('bien')
    if (id) {
      forzarHome.current = false
      setAbrirBienId(Number(id))
      navigate('/inventario', { replace: true })
    }
  }, [])

  // ── Auth ─────────────────────────────────────────────────────────
  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('error=access_denied') || hash.includes('type=invite') || hash.includes('type=recovery')) {
      window.history.replaceState(null, '', window.location.pathname)
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (procesandoCambio.current) return

      if (event === 'SIGNED_OUT' || !session) {
        if (event === 'INITIAL_SESSION' && modoRecovery.current) return
        sesionCargada.current = false
        forzarHome.current = true
        setUsuario(null)
        setMostrarSetPassword(false)
        setCargando(false)
        if (event === 'SIGNED_OUT') navigate('/', { replace: true })
        return
      }

      if (event === 'TOKEN_REFRESHED') return
      if (sesionCargada.current) return

      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && modoRecovery.current)) {
        modoRecovery.current = true
        cargarPerfil(session.user.id, true)
        return
      }

      cargarPerfil(session.user.id)
    })

    if (recoveryTokens) {
      supabase.auth.setSession(recoveryTokens).then(({ error }) => {
        if (error) {
          console.error('Error al establecer sesión de recuperación:', error)
          setCargando(false)
        }
      })
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) setCargando(false)
      })
    }

    return () => subscription.unsubscribe()
  }, [])

  // ── Configuración visual ─────────────────────────────────────────
  useEffect(() => {
    async function cargarConfig() {
      const { data } = await supabase.from('configuracion').select('clave, valor')
      if (!data) return
      const cfg = Object.fromEntries(data.map(r => [r.clave, r.valor]))
      if (cfg.logo_url)           setLogoUrl(cfg.logo_url)
      if (cfg.nombre_sistema)     setNombreSistema(cfg.nombre_sistema)
      if (cfg.nombre_institucion) setNombreInstitucion(cfg.nombre_institucion)
      aplicarTema({
        colorPrimario: cfg.color_primario || '#1a237e',
        colorAcento:   cfg.color_acento   || '#d4a017',
        colorBoton:    cfg.color_boton    || '#6366f1',
        pageBg:        (!cfg.page_bg    || cfg.page_bg    === '#0b1220') ? '#f1f5f9' : cfg.page_bg,
        sidebarBg:     (!cfg.sidebar_bg || cfg.sidebar_bg === '#0a1325') ? '#1a237e' : cfg.sidebar_bg,
      })
    }
    cargarConfig()
  }, [])

  // ── Realtime: permisos del usuario logueado ──────────────────────
  useEffect(() => {
    if (!usuario || usuario.rol === 'admin') return

    // Función compartida para recargar la fusión rol+personal
    async function recargarPermisos() {
      const [{ data: rp }, { data: pd }] = await Promise.all([
        supabase.from('permisos_rol').select('permisos').eq('rol', usuario.rol).maybeSingle(),
        supabase.from('permisos_usuario').select('permisos').eq('usuario_id', usuario.id).maybeSingle(),
      ])
      setPermisosUsuario({ ...(rp?.permisos ?? {}), ...(pd?.permisos ?? {}) })
    }

    const canal = supabase
      .channel('permisos-propios')
      // Cambios en permisos individuales del usuario
      .on('postgres_changes', {
        event: '*', schema: 'public',
        table: 'permisos_usuario',
        filter: `usuario_id=eq.${usuario.id}`,
      }, recargarPermisos)
      // Cambios en permisos del rol del usuario
      .on('postgres_changes', {
        event: '*', schema: 'public',
        table: 'permisos_rol',
        filter: `rol=eq.${usuario.rol}`,
      }, recargarPermisos)
      .subscribe()

    return () => { supabase.removeChannel(canal) }
  }, [usuario?.id, usuario?.rol])

  // ── Verificación de sesión periódica ─────────────────────────────
  useEffect(() => {
    if (!usuario) return
    const check = async () => {
      if (!navigator.onLine) return
      try {
        const { error } = await supabase.auth.getUser()
        if (error?.status === 401) {
          await supabase.auth.signOut()
        }
      } catch {
        // Error de red — ignorar
      }
    }
    const interval = setInterval(check, 30000)
    window.addEventListener('focus', check)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', check)
    }
  }, [usuario?.id])

  async function cargarPerfil(userId, forceSetPassword = false) {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error || !data) {
      setCargando(false)
      return
    }

    sesionCargada.current = true
    setUsuario(data)
    if (data.rol !== 'admin') {
      const [{ data: rp }, { data: pd }] = await Promise.all([
        supabase.from('permisos_rol').select('permisos').eq('rol', data.rol).maybeSingle(),
        supabase.from('permisos_usuario').select('permisos').eq('usuario_id', data.id).maybeSingle(),
      ])
      // Herencia: permisos del rol como base, permisos individuales del usuario como override
      const permisosBase      = rp?.permisos ?? {}
      const permisosPersonales = pd?.permisos ?? {}
      const merged = { ...permisosBase, ...permisosPersonales }
      // Fallback: si la BD no devolvió ningún permiso (usuario recién creado o migración pendiente),
      // usar los defaults del rol para que el menú sea funcional de inmediato
      const tienePermisos = Object.keys(merged).length > 0
      setPermisosUsuario(tienePermisos ? merged : (PERMISOS_DEFAULT_ROL[data.rol] ?? {}))
    } else {
      setPermisosUsuario({ ver_auditoria_requerimientos: true, ver_auditoria_permisos: true, gestionar_tickets: true })
    }
    setMostrarSetPassword(modoRecovery.current || forceSetPassword || data.debe_cambiar_password === true)
    setCargando(false)
  }

  async function handlePasswordSet() {
    procesandoCambio.current = true
    modoRecovery.current     = false
    await supabase.from('usuarios').update({ debe_cambiar_password: false }).eq('id', usuario.id)
    setMostrarSetPassword(false)
    procesandoCambio.current = false
  }

  if (cargando) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f9fafb' }}>
      <div style={{ textAlign: 'center', color: '#9ca3af' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 12px' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        Cargando...
      </div>
    </div>
  )

  if (mostrarSetPassword) return <SetPassword onComplete={handlePasswordSet} usuario={usuario} />
  if (!usuario) return <Login onLogin={setUsuario} logoUrl={logoUrl} nombreInstitucion={nombreInstitucion} nombreSistema={nombreSistema} />

  return (
    <Layout
      usuario={usuario}
      onLogout={() => supabase.auth.signOut()}
      paginaActual={paginaSegura}
      setPagina={cambiarPagina}
      onRefreshTicketBadge={fn => { refreshTicketBadge.current = fn }}
      logoUrl={logoUrl}
      nombreSistema={nombreSistema}
      nombreInstitucion={nombreInstitucion}
      puedeVerAuditoriaReq={puedeVerAuditoriaReq}
      puedeVerAuditoriaPermisos={puedeVerAuditoriaPermisos}
      puedeVerAuditoriaCompensatorios={puedeVerAuditoriaCompensatorios}
      puedeVerAuditoriaTickets={puedeVerAuditoriaTickets}
      puedeVerAuditoriaInventario={puedeVerAuditoriaInventario}
      puedeVerAuditoriaGeneral={puedeVerAuditoriaGeneral}
      puedeVerPapelera={puedeVerPapelera}
      puedeVerInventario={puedeVerInventario}
      puedeVerTickets={puedeVerTickets}
      puedeGestionarTickets={puedeGestionarTickets}
      esSoporte={esSoporte}
      puedeVerAusencias={permisosAusencia.ver}
      puedeVerRequerimientos={permisosReqs.ver}
      puedeVerCompensatorios={puedeVerCompensatorios}
      puedeGestionarAusencias={puedeGestionarAusencias}
      puedeAccederAusencias={puedeAccederAusencias}
      puedeAccederUsuarios={puedeAccederUsuarios}
      puedeGestionarAjustes={puedeGestionarAjustes}
      puedeGestionarCampos={puedeGestionarCampos}
      puedeGestionarRoles={puedeGestionarRoles}
      puedeVerPersonal={puedeVerPersonal}
      puedeVerReglamentos={puedeVerReglamentos}
      puedeVerAuditoriaReglamentos={permisosReglamentos.verAuditoria}
      puedeVerAuditoriaPapelera={puedeVerAuditoriaPapelera}
    >
      {paginaSegura === 'inventario' && <Inventario usuario={usuario} abrirBienId={abrirBienId} onAbrirBienDone={() => setAbrirBienId(null)} abrirCatId={abrirCatId} onAbrirCatDone={() => setAbrirCatId(null)} />}
      {paginaSegura === 'usuarios'   && <Usuarios   usuario={usuario} permisosAdmin={permisosAusencia} />}
      {paginaSegura === 'auditoria'  && <Auditoria  usuario={usuario} modulo="inventario" onVerBien={(id) => { setAbrirBienId(id); cambiarPagina('inventario') }} onVerCategoria={(catId) => { setAbrirCatId(catId); cambiarPagina('inventario') }} />}
      {paginaSegura === 'auditoria_requerimientos' && <Auditoria usuario={usuario} modulo="requerimientos" />}
      {paginaSegura === 'auditoria_permisos'       && <Auditoria usuario={usuario} modulos={[
          ...(puedeVerAuditoriaPermisos        ? ['ausencias']      : []),
          ...(puedeVerAuditoriaCompensatorios  ? ['compensatorios'] : []),
        ]} />}
      {paginaSegura === 'auditoria_tickets'        && <Auditoria usuario={usuario} modulo="tickets" />}
      {paginaSegura === 'auditoria_general'        && <Auditoria usuario={usuario} modoGeneral modulos={['inventario','requerimientos','tickets','ausencias','compensatorios','reglamentos','papelera','personal']} onVerBien={(id) => { setAbrirBienId(id); cambiarPagina('inventario') }} onVerCategoria={(catId) => { setAbrirCatId(catId); cambiarPagina('inventario') }} />}
      {(paginaSegura === 'dashboard' || !paginaSegura) && <Dashboard usuario={usuario} onIrATickets={puedeVerTickets ? irATickets : undefined} onIrARequerimientos={permisosReqs.ver ? irAReqs : undefined} onIrAInventario={puedeVerInventario ? irAInventario : undefined} onIrAAusencias={puedeAccederAusencias ? () => cambiarPagina(puedeGestionarAusencias ? 'permisos' : 'mis_ausencias') : undefined} puedeVerAlertasTickets={puedeVerAlertasTickets} puedeVerInventario={puedeVerInventario} puedeVerRequerimientos={permisosReqs.ver} puedeVerAusencias={permisosAusencia.ver} puedeGestionarTickets={puedeGestionarTickets} />}
      {paginaSegura === 'requerimientos' && <Requerimientos usuario={usuario} filtroInicial={filtroInicialReqs} permisos={permisosReqs} />}
      {paginaSegura === 'tickets'    && <Tickets    usuario={usuario} filtroInicial={filtroInicialTickets} onTicketActualizado={() => refreshTicketBadge.current?.()} permisos={permisosTickets} />}
      {paginaSegura === 'ajustes'    && <Ajustes    onLogoChange={url => setLogoUrl(url)} onNombreChange={(s, i) => { setNombreSistema(s); setNombreInstitucion(i) }} />}
      {paginaSegura === 'campos'          && <CamposCategoria usuario={usuario} permisos={permisosCampos} />}
      {paginaSegura === 'mantenedor_roles' && <MantenedorRoles />}
      {paginaSegura === 'papelera'         && <Papelera usuario={usuario} permisos={permisosPapelera} />}
      {paginaSegura === 'mis_ausencias'   && <Permisos usuario={usuario} permisos={permisosAusencia} modoMisAusencias={true} />}
      {paginaSegura === 'permisos'        && <Permisos        usuario={usuario} permisos={permisosAusencia} />}
      {paginaSegura === 'compensatorios'  && <Compensatorios  usuario={usuario} permisos={permisosComp} />}
      {paginaSegura === 'reglamentos'          && <Reglamentos usuario={usuario} permisos={permisosReglamentos} />}
      {paginaSegura === 'reglamentos_auditoria' && <Auditoria usuario={usuario} modulo="reglamentos" />}
      {paginaSegura === 'papelera_auditoria'    && <Auditoria usuario={usuario} modulo="papelera" />}
      {paginaSegura === 'personal_auditoria'    && <Auditoria usuario={usuario} modulo="personal" />}
      {PAGINAS_PERSONAL.has(paginaSegura) && <Personal
        usuario={usuario}
        permisos={permisosPersonal}
        vista={paginaSegura === 'personal' ? 'dashboard'
          : paginaSegura === 'personal_contrataciones' ? 'contrataciones'
          : paginaSegura === 'personal_reemplazos'     ? 'reemplazos'
          : paginaSegura === 'personal_documentos'     ? 'documentos'
          : 'dashboard'}
        onIrAVista={(v) => cambiarPagina(
          v === 'dashboard'      ? 'personal'
          : v === 'contrataciones' ? 'personal_contrataciones'
          : v === 'reemplazos'     ? 'personal_reemplazos'
          : v === 'documentos'     ? 'personal_documentos'
          : 'personal'
        )}
      />}
    </Layout>
  )
}
