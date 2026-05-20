import { useState, useEffect, useRef } from 'react'
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
import { aplicarTema } from './utils/tema'

export default function App() {
  const [usuario,            setUsuario]            = useState(null)
  const [permisosUsuario,    setPermisosUsuario]    = useState({})
  const [cargando,           setCargando]           = useState(true)
  const [logoUrl,            setLogoUrl]            = useState(null)
  const [nombreSistema,      setNombreSistema]      = useState('Inventario')
  const [nombreInstitucion,  setNombreInstitucion]  = useState('Liceo Polivalente de Excelencia Juvenal Hernández Jaque')
  const [mostrarSetPassword, setMostrarSetPassword] = useState(false)
  const [pagina,             setPagina]             = useState(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('bien')) return 'inventario'
    return localStorage.getItem('app_pagina') || 'dashboard'
  })
  const [abrirBienId,        setAbrirBienId]        = useState(() => {
    const params = new URLSearchParams(window.location.search)
    const id = params.get('bien')
    if (id) window.history.replaceState(null, '', window.location.pathname)
    return id ? Number(id) : null
  })
  const [abrirCatId,           setAbrirCatId]           = useState(null)
  const [filtroInicialTickets, setFiltroInicialTickets] = useState('')
  const [filtroInicialReqs,    setFiltroInicialReqs]    = useState(null)
  const refreshTicketBadge = useRef(null)

  const cambiarPagina    = (p) => { setPagina(p); localStorage.setItem('app_pagina', p) }
  const irATickets       = (filtro = '') => { setFiltroInicialTickets(filtro); cambiarPagina('tickets') }
  const irAReqs          = (filtro = null) => { setFiltroInicialReqs(filtro); cambiarPagina('requerimientos') }
  const procesandoCambio = useRef(false)
  const modoRecovery     = useRef(esRecuperacion)

  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('error=access_denied') || hash.includes('type=invite') || hash.includes('type=recovery')) {
      window.history.replaceState(null, '', window.location.pathname)
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (procesandoCambio.current) return

      if (event === 'SIGNED_OUT' || !session) {
        if (event === 'INITIAL_SESSION' && modoRecovery.current) return
        setUsuario(null)
        setMostrarSetPassword(false)
        setCargando(false)
        return
      }

      // No recargar el perfil en cada refresh de token
      if (event === 'TOKEN_REFRESHED') return

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

  useEffect(() => {
    async function cargarConfig() {
      const { data } = await supabase.from('configuracion').select('clave, valor')
      if (!data) return
      const cfg = Object.fromEntries(data.map(r => [r.clave, r.valor]))
      if (cfg.logo_url)          setLogoUrl(cfg.logo_url)
      if (cfg.nombre_sistema)    setNombreSistema(cfg.nombre_sistema)
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

  useEffect(() => {
    if (!usuario) return
    const check = async () => {
      if (!navigator.onLine) return
      try {
        const { error } = await supabase.auth.getUser()
        // Solo cerrar sesión ante un 401 real del servidor (token revocado/expirado)
        // Cualquier otro error (red, timeout, reconexión) se ignora
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

    setUsuario(data)
    // Cargar permisos granulares
    if (data.rol !== 'admin') {
      supabase.from('permisos_usuario').select('permisos').eq('usuario_id', data.id).maybeSingle()
        .then(({ data: pd }) => { if (pd?.permisos) setPermisosUsuario(pd.permisos) })
    } else {
      setPermisosUsuario({ ver_auditoria_requerimientos: true, ver_auditoria_permisos: true })
    }
    if (data.rol === 'docente') {
      setPagina('tickets')
      localStorage.setItem('app_pagina', 'tickets')
    } else if (data.rol === 'visor_requerimientos') {
      setPagina('requerimientos')
      localStorage.setItem('app_pagina', 'requerimientos')
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

  const esVisorReq    = usuario.rol === 'visor_requerimientos'
  const puedeVerInventario     = usuario.rol === 'admin' || !!permisosUsuario?.ver_inventario
  const puedeGestionarTickets  = usuario.rol === 'admin' || !!permisosUsuario?.gestionar_tickets
  const paginasVisorReq = ['requerimientos', 'tickets']
  const puedeVerAuditoriaReq  = usuario?.rol === 'admin' || !!permisosUsuario?.ver_auditoria_requerimientos
  const puedeVerAuditoriaPermisos = usuario?.rol === 'admin' || !!permisosUsuario?.ver_auditoria_permisos
  const soloAdmin  = pagina === 'usuarios' || pagina === 'auditoria' || pagina === 'ajustes' || pagina === 'campos' || pagina === 'permisos'
    || (pagina === 'auditoria_requerimientos' && !puedeVerAuditoriaReq)
    || (pagina === 'auditoria_permisos' && !puedeVerAuditoriaPermisos)
  const soloStaff  = pagina === 'inventario' || pagina === 'dashboard' || pagina === 'requerimientos'
  const paginaSegura = (!puedeVerInventario && soloStaff) ? 'tickets'
    : (esVisorReq && !paginasVisorReq.includes(pagina)) ? 'requerimientos'
    : usuario.rol !== 'admin' && soloAdmin ? 'dashboard'
    : pagina

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
    >
      {paginaSegura === 'inventario' && <Inventario usuario={usuario} abrirBienId={abrirBienId} onAbrirBienDone={() => setAbrirBienId(null)} abrirCatId={abrirCatId} onAbrirCatDone={() => setAbrirCatId(null)} />}
      {paginaSegura === 'usuarios'   && <Usuarios   usuario={usuario} />}
      {paginaSegura === 'auditoria'  && <Auditoria  usuario={usuario} modulo="inventario" onVerBien={(id) => { setAbrirBienId(id); cambiarPagina('inventario') }} onVerCategoria={(catId) => { setAbrirCatId(catId); cambiarPagina('inventario') }} />}
      {paginaSegura === 'auditoria_requerimientos' && <Auditoria usuario={usuario} modulo="requerimientos" />}
      {paginaSegura === 'auditoria_permisos'       && <Auditoria usuario={usuario} modulo="permisos" />}
      {(paginaSegura === 'dashboard' || !paginaSegura) && <Dashboard usuario={usuario} onIrATickets={irATickets} onIrARequerimientos={irAReqs} />}
      {paginaSegura === 'requerimientos' && <Requerimientos usuario={usuario} filtroInicial={filtroInicialReqs} />}
      {paginaSegura === 'tickets'    && <Tickets    usuario={usuario} filtroInicial={filtroInicialTickets} onTicketActualizado={() => refreshTicketBadge.current?.()} />}
      {paginaSegura === 'ajustes'    && <Ajustes    onLogoChange={url => setLogoUrl(url)} onNombreChange={(s, i) => { setNombreSistema(s); setNombreInstitucion(i) }} />}
      {paginaSegura === 'campos'     && <CamposCategoria usuario={usuario} />}
      {paginaSegura === 'permisos'   && <Permisos        usuario={usuario} />}
    </Layout>
  )
}