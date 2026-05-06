import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import Layout from './components/Layout'
import Login from './pages/Login'
import Inventario from './pages/Inventario'
import Dashboard from './pages/Dashboard'
import Usuarios from './pages/Usuarios'
import SetPassword from './pages/SetPassword'

export default function App() {
  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [pagina, setPagina] = useState('dashboard')
  const [mostrarSetPassword, setMostrarSetPassword] = useState(false)

  // Bloquea el listener de auth mientras se procesa el cambio de contraseña
  const procesandoCambio = useRef(false)

  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('error=access_denied') || hash.includes('type=invite')) {
      window.history.replaceState(null, '', window.location.pathname)
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (procesandoCambio.current) return

      if (event === 'SIGNED_OUT' || !session) {
        setUsuario(null)
        setMostrarSetPassword(false)
        setCargando(false)
        return
      }

      cargarPerfil(session.user.id)
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) setCargando(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function cargarPerfil(userId) {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.error('[App] Error cargando perfil:', error.message)
      setCargando(false)
      return
    }

    if (!data) {
      console.warn('[App] Usuario sin perfil en tabla usuarios:', userId)
      setCargando(false)
      return
    }

    setUsuario(data)
    setMostrarSetPassword(data.debe_cambiar_password === true)
    setCargando(false)
  }

  async function handlePasswordSet() {
    procesandoCambio.current = true

    const { error } = await supabase
      .from('usuarios')
      .update({ debe_cambiar_password: false })
      .eq('id', usuario.id)

    if (error) {
      console.error('[App] Error actualizando debe_cambiar_password:', error.message)
    }

    // Resetear UI antes del signOut para evitar parpadeos
    setMostrarSetPassword(false)
    setUsuario(null)
    setCargando(false)

    await supabase.auth.signOut()
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
  if (!usuario) return <Login onLogin={setUsuario} />

  const paginaSegura = usuario.rol !== 'admin' && pagina === 'usuarios' ? 'dashboard' : pagina

  const renderPagina = () => {
    switch (paginaSegura) {
      case 'inventario': return <Inventario usuario={usuario} />
      case 'usuarios':   return <Usuarios usuario={usuario} />
      case 'dashboard':  return <Dashboard usuario={usuario} />
      default:           return <Dashboard usuario={usuario} />
    }
  }

  return (
    <Layout
      usuario={usuario}
      onLogout={() => supabase.auth.signOut()}
      paginaActual={paginaSegura}
      setPagina={setPagina}
    >
      {renderPagina()}
    </Layout>
  )
}
