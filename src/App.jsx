import { useState, useEffect, useRef } from 'react'
import { supabase, esRecuperacion, recoveryTokens } from './supabase'
import Layout from './components/Layout'
import Login from './pages/Login'
import Inventario from './pages/Inventario'
import Dashboard from './pages/Dashboard'
import Usuarios from './pages/Usuarios'
import SetPassword from './pages/SetPassword'

export default function App() {
  const [usuario,          setUsuario]          = useState(null)
  const [cargando,         setCargando]         = useState(true)
  const [mostrarSetPassword, setMostrarSetPassword] = useState(false)
  const [pagina,           setPagina]           = useState(() => localStorage.getItem('app_pagina') || 'dashboard')

  const cambiarPagina   = (p) => { setPagina(p); localStorage.setItem('app_pagina', p) }
  const procesandoCambio = useRef(false)
  // Se activa en cuanto llega PASSWORD_RECOVERY; cargarPerfil lo consulta al escribir estado.
  const modoRecovery     = useRef(esRecuperacion)

  useEffect(() => {
    // Limpiar hash de la URL (ya capturamos los tokens en supabase.js antes de esto)
    const hash = window.location.hash
    if (hash.includes('error=access_denied') || hash.includes('type=invite') || hash.includes('type=recovery')) {
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

      // PASSWORD_RECOVERY: cuando Supabase procesa el hash correctamente
      // SIGNED_IN con modoRecovery: cuando usamos setSession manual con token de recovery
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && modoRecovery.current)) {
        modoRecovery.current = true
        cargarPerfil(session.user.id, true)
        return
      }

      cargarPerfil(session.user.id)
    })

    if (recoveryTokens) {
      // Bypassear el procesamiento automático del hash — establecer sesión manualmente
      supabase.auth.setSession(recoveryTokens).then(({ error }) => {
        if (error) {
          console.error('Error al establecer sesión de recuperación:', error)
          setCargando(false)
        }
        // Si no hay error, onAuthStateChange dispara SIGNED_IN y cargarPerfil se encarga
      })
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) setCargando(false)
      })
    }

    return () => subscription.unsubscribe()
  }, [])

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
    // Consultar modoRecovery.current aquí (no antes) garantiza que si PASSWORD_RECOVERY
    // llegó mientras esta query estaba en vuelo, igual mostramos SetPassword.
    setMostrarSetPassword(modoRecovery.current || forceSetPassword || data.debe_cambiar_password === true)
    setCargando(false)
  }

  async function handlePasswordSet() {
    procesandoCambio.current = true
    modoRecovery.current     = false

    await supabase.from('usuarios').update({ debe_cambiar_password: false }).eq('id', usuario.id)

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

  return (
    <Layout usuario={usuario} onLogout={() => supabase.auth.signOut()} paginaActual={paginaSegura} setPagina={cambiarPagina}>
      {paginaSegura === 'inventario' && <Inventario usuario={usuario} />}
      {paginaSegura === 'usuarios'   && <Usuarios   usuario={usuario} />}
      {(paginaSegura === 'dashboard' || !paginaSegura) && <Dashboard usuario={usuario} />}
    </Layout>
  )
}
