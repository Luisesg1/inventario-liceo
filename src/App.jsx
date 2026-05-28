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
import { aplicarTema } from './utils/tema'

const RUTA_A_PAGINA = {
  '/':                         'dashboard',
  '/dashboard':                'dashboard',
  '/inventario':               'inventario',
  '/inventario/auditoria':     'auditoria',
  '/requerimientos':           'requerimientos',
  '/requerimientos/auditoria': 'auditoria_requerimientos',
  '/tickets':                  'tickets',
  '/ausencias/mis-ausencias':  'mis_ausencias',
  '/ausencias/gestion':        'permisos',
  '/ausencias/compensatorios': 'compensatorios',
  '/ausencias/auditoria':      'auditoria_permisos',
  '/usuarios':                 'usuarios',
  '/ajustes':                  'ajustes',
  '/ajustes/campos':           'campos',
}

const PAGINA_A_RUTA = {
  dashboard:                '/',
  inventario:               '/inventario',
  auditoria:                '/inventario/auditoria',
  requerimientos:           '/requerimientos',
  auditoria_requerimientos: '/requerimientos/auditoria',
  tickets:                  '/tickets',
  mis_ausencias:            '/ausencias/mis-ausencias',
  permisos:                 '/ausencias/gestion',
  compensatorios:           '/ausencias/compensatorios',
  auditoria_permisos:       '/ausencias/auditoria',
  usuarios:                 '/usuarios',
  ajustes:                  '/ajustes',
  campos:                   '/ajustes/campos',
}

export default function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const pagina   = RUTA_A_PAGINA[location.pathname] || 'dashboard'

  const [usuario,            setUsuario]            = useState(null)
  const [permisosUsuario,    setPermisosUsuario]    = useState({})
  const [cargando,           setCargando]           = useState(true)
  const [logoUrl,            setLogoUrl]            = useState(null)
  const [nombreSistema,      setNombreSistema]      = useState('Inventario')
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

  // ── Permisos computados (null-safe para cuando usuario aún no cargó) ──
  const esAdmin    = usuario?.rol === 'admin'
  const esVisorReq = usuario?.rol === 'visor_requerimientos'
  const esSoporte  = usuario?.rol === 'soporte'
  const p          = permisosUsuario ?? {}

  const puedeVerInventario          = esAdmin || !!p.ver_inventario
  const puedeGestionarTickets       = esAdmin || !!p.gestionar_tickets
  const puedeVerAlertasTickets      = esAdmin || esSoporte || !!p.ver_alertas_tickets
  const puedeVerAuditoriaReq        = esAdmin || !!p.ver_auditoria_requerimientos
  const puedeVerAuditoriaPermisos   = esAdmin || !!p.ver_auditoria_permisos
  const permisosTickets = {
    verPropios: esAdmin || !!p.ver_tickets,
    crear:      esAdmin || p.crear_ticket !== false,
    gestionar:  esAdmin || !!p.gestionar_tickets,
    eliminar:   esAdmin || !!p.eliminar_ticket,
  }
  const permisosReqs = {
    ver:          esAdmin || !!p.ver_requerimientos,
    crear:        esAdmin || !!p.crear_requerimiento,
    editar:       esAdmin || !!p.editar_requerimiento,
    eliminar:     esAdmin || !!p.eliminar_requerimiento,
    importar:     esAdmin || !!p.importar_requerimientos,
    exportar:     esAdmin || !!p.exportar_requerimientos,
    verAuditoria: esAdmin || !!p.ver_auditoria_requerimientos,
  }
  const permisosAusencia = {
    ver:             esAdmin || !!p.ver_ausencias,
    gestionar:       esAdmin || !!p.gestionar_ausencias,
    crear:           esAdmin || !!p.gestionar_ausencias || !!p.crear_ausencias,
    editar:          esAdmin || !!p.gestionar_ausencias || !!p.editar_ausencias,
    eliminar:        esAdmin || !!p.eliminar_ausencias,
    aprobar:         esAdmin || !!p.aprobar_ausencias,
    exportar:        esAdmin || !!p.exportar_ausencias,
    verAuditoria:    esAdmin || !!p.ver_auditoria_permisos,
    invitarUsuario:  esAdmin || !!p.invitar_usuario,
    editarUsuario:   esAdmin || !!p.editar_usuario,
    eliminarUsuario: esAdmin || !!p.eliminar_usuario,
  }
  const permisosComp = {
    ver:     esAdmin || !!p.ver_compensatorios,
    gestionar:esAdmin || !!p.gestionar_compensatorios,
    crear:   esAdmin || !!p.gestionar_compensatorios || !!p.crear_compensatorios,
    editar:  esAdmin || !!p.gestionar_compensatorios || !!p.editar_compensatorios,
    eliminar:esAdmin || !!p.eliminar_compensatorios,
  }
  const puedeVerCompensatorios  = permisosComp.ver
  const puedeGestionarAusencias = esAdmin || !!p.gestionar_ausencias || !!p.crear_ausencias || !!p.editar_ausencias
  const paginasVisorReq         = ['dashboard', 'requerimientos', 'tickets']
  const puedeAccederUsuarios    = esAdmin || !!p.invitar_usuario || !!p.editar_usuario || !!p.eliminar_usuario

  const soloAdmin = (pagina === 'usuarios' && !puedeAccederUsuarios) || pagina === 'auditoria' || pagina === 'ajustes' || pagina === 'campos'
    || (pagina === 'permisos'         && !puedeGestionarAusencias)
    || (pagina === 'compensatorios'   && !puedeVerCompensatorios)
    || (pagina === 'auditoria_requerimientos' && !puedeVerAuditoriaReq)
    || (pagina === 'auditoria_permisos'       && !puedeVerAuditoriaPermisos)
  const soloStaff = pagina === 'inventario'
    || (pagina === 'requerimientos' && !permisosReqs.ver)

  const PAGINAS_AUSENCIAS = new Set(['permisos', 'compensatorios', 'auditoria_permisos'])
  const paginaSegura = !usuario ? pagina
    : (!puedeVerInventario && soloStaff) ? 'tickets'
    : (esVisorReq && !paginasVisorReq.includes(pagina)) ? 'requerimientos'
    : usuario.rol !== 'admin' && soloAdmin
      ? (PAGINAS_AUSENCIAS.has(pagina) ? 'mis_ausencias' : 'dashboard')
    : pagina

  // ── Navegación ───────────────────────────────────────────────────
  const cambiarPagina = (p) => navigate(PAGINA_A_RUTA[p] || '/')
  const irATickets    = (filtro = '') => { setFiltroInicialTickets(filtro); cambiarPagina('tickets') }
  const irAReqs       = (filtro = null) => { setFiltroInicialReqs(filtro); cambiarPagina('requerimientos') }
  const irAInventario = () => cambiarPagina('inventario')

  // ── Redirigir si la URL no corresponde a la página permitida ─────
  useEffect(() => {
    if (!usuario || cargando) return
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
        setUsuario(null)
        setMostrarSetPassword(false)
        setCargando(false)
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
      supabase.from('permisos_usuario').select('permisos').eq('usuario_id', data.id).maybeSingle()
        .then(({ data: pd }) => { if (pd?.permisos) setPermisosUsuario(pd.permisos) })
    } else {
      setPermisosUsuario({ ver_auditoria_requerimientos: true, ver_auditoria_permisos: true })
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
      puedeVerInventario={puedeVerInventario}
      puedeGestionarTickets={puedeGestionarTickets}
      esSoporte={esSoporte}
      puedeVerAusencias={permisosAusencia.ver}
      puedeVerRequerimientos={permisosReqs.ver}
      puedeVerCompensatorios={puedeVerCompensatorios}
      puedeGestionarAusencias={puedeGestionarAusencias}
    >
      {paginaSegura === 'inventario' && <Inventario usuario={usuario} abrirBienId={abrirBienId} onAbrirBienDone={() => setAbrirBienId(null)} abrirCatId={abrirCatId} onAbrirCatDone={() => setAbrirCatId(null)} />}
      {paginaSegura === 'usuarios'   && <Usuarios   usuario={usuario} permisosAdmin={permisosAusencia} />}
      {paginaSegura === 'auditoria'  && <Auditoria  usuario={usuario} modulo="inventario" onVerBien={(id) => { setAbrirBienId(id); cambiarPagina('inventario') }} onVerCategoria={(catId) => { setAbrirCatId(catId); cambiarPagina('inventario') }} />}
      {paginaSegura === 'auditoria_requerimientos' && <Auditoria usuario={usuario} modulo="requerimientos" />}
      {paginaSegura === 'auditoria_permisos'       && <Auditoria usuario={usuario} modulo="ausencias" />}
      {(paginaSegura === 'dashboard' || !paginaSegura) && <Dashboard usuario={usuario} onIrATickets={irATickets} onIrARequerimientos={irAReqs} onIrAInventario={puedeVerInventario ? irAInventario : undefined} onIrAAusencias={() => cambiarPagina(puedeGestionarAusencias ? 'permisos' : 'mis_ausencias')} puedeVerAlertasTickets={puedeVerAlertasTickets} puedeVerInventario={puedeVerInventario} puedeVerRequerimientos={permisosReqs.ver} />}
      {paginaSegura === 'requerimientos' && <Requerimientos usuario={usuario} filtroInicial={filtroInicialReqs} permisos={permisosReqs} />}
      {paginaSegura === 'tickets'    && <Tickets    usuario={usuario} filtroInicial={filtroInicialTickets} onTicketActualizado={() => refreshTicketBadge.current?.()} permisos={permisosTickets} />}
      {paginaSegura === 'ajustes'    && <Ajustes    onLogoChange={url => setLogoUrl(url)} onNombreChange={(s, i) => { setNombreSistema(s); setNombreInstitucion(i) }} />}
      {paginaSegura === 'campos'     && <CamposCategoria usuario={usuario} />}
      {paginaSegura === 'mis_ausencias'   && <Permisos usuario={usuario} permisos={permisosAusencia} modoMisAusencias={true} />}
      {paginaSegura === 'permisos'        && <Permisos        usuario={usuario} permisos={permisosAusencia} />}
      {paginaSegura === 'compensatorios'  && <Compensatorios  usuario={usuario} permisos={permisosComp} />}
    </Layout>
  )
}
