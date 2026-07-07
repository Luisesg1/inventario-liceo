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
import Backups         from './pages/Backups'
import { aplicarTema } from './utils/tema'
import { construirPermisos } from './utils/permisos'
import { PRESETS_ROL } from './config/permisos'

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
  '/backups':                        'backups',
  '/backups/actividad':              'backups_actividad',
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
  backups:                        '/backups',
  backups_actividad:              '/backups/actividad',
}

// El fallback de permisos por rol (cuando la BD aún no devolvió datos) usa ahora
// PRESETS_ROL desde el catálogo central (fuente única). Ver cargarPerfil().

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

  // ── Motor de permisos (fuente única de la capa de consumo) ────────────────
  // Toda la lógica antes desplegada a mano aquí (bypass admin, restricciones de
  // rol, defaults backward-compat y guardas de ruta) vive ahora en
  // construirPermisos(). App.jsx solo destructura lo que necesita.
  const perm = construirPermisos(usuario, permisosUsuario)
  const {
    esSoporte,
    puedeVerInventario, puedeVerAuditoriaInventario,
    puedeVerTickets, puedeGestionarTickets, puedeVerAlertasTickets, puedeVerAuditoriaTickets, permisosTickets,
    permisosReqs, puedeVerAuditoriaReq,
    puedeAccederAusencias, permisosAusencia, puedeVerAuditoriaPermisos, puedeGestionarAusencias,
    permisosComp, puedeVerCompensatorios, puedeVerAuditoriaCompensatorios,
    puedeAccederUsuarios, puedeGestionarAjustes, puedeGestionarRoles,
    puedeGestionarCampos, permisosCampos,
    puedeVerAuditoriaGeneral,
    puedeVerBackups,
    permisosPersonal, puedeVerPersonal,
    puedeVerPapelera, puedeVerAuditoriaPapelera, permisosPapelera,
    permisosReglamentos, puedeVerReglamentos,
  } = perm

  const PAGINAS_PERSONAL = new Set(['personal','personal_contrataciones','personal_reemplazos','personal_documentos'])
  const paginaSegura = perm.paginaSegura(pagina)

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
      setPermisosUsuario(tienePermisos ? merged : (PRESETS_ROL[data.rol]?.permisos ?? {}))
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
      puedeVerBackups={puedeVerBackups}
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
      {(paginaSegura === 'backups' || paginaSegura === 'backups_actividad') && puedeVerBackups &&
        <Backups usuario={usuario} vista={paginaSegura === 'backups_actividad' ? 'actividad' : 'respaldos'}
          onIrAVista={(v) => cambiarPagina(v === 'actividad' ? 'backups_actividad' : 'backups')} />}
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
