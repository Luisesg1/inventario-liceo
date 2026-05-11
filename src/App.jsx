import { useState, useEffect, useRef } from 'react'
import { supabase, esRecuperacion, recoveryTokens } from './supabase'
import Layout from './components/Layout'
import Login from './pages/Login'
import Inventario from './pages/Inventario'
import Dashboard from './pages/Dashboard'
import Usuarios from './pages/Usuarios'
import SetPassword from './pages/SetPassword'

export default function App() {
  const [usuario,            setUsuario]            = useState(null)
  const [cargando,           setCargando]           = useState(true)
  const [mostrarSetPassword, setMostrarSetPassword] = useState(false)
  const [pagina,             setPagina]             = useState(() => localStorage.getItem('app_pagina') || 'dashboard')

  const cambiarPagina    = (p) => { setPagina(p); localStorage.setItem('app_pagina', p) }
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
    if (!usuario) return
    const check = async () => {
      try {
        const { error } = await supabase.auth.getUser()
        // Solo cerrar sesión si el token es inválido/expirado, no por errores de red
        if (error && !error.message?.toLowerCase().includes('fetch') && error.status !== 0) {
          await supabase.auth.signOut()
        }
      } catch {
        // Error de red — ignorar, no cerrar sesión
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