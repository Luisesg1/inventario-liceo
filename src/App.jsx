import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Layout from './components/Layout'
import Login from './pages/Login'
import Inventario from './pages/Inventario'
import Dashboard from './pages/Dashboard'
import Usuarios from './pages/Usuarios'

export default function App() {
  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [pagina, setPagina] = useState('dashboard')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        supabase.from('usuarios').select('*').eq('id', session.user.id).single()
          .then(({ data }) => { setUsuario(data); setCargando(false) })
      } else {
        setCargando(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) { setUsuario(null); return }
      supabase.from('usuarios').select('*').eq('id', session.user.id).single()
        .then(({ data }) => setUsuario(data))
    })

    return () => subscription.unsubscribe()
  }, [])

  if (cargando) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f9fafb' }}>
      <div style={{ textAlign: 'center', color: '#9ca3af' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 12px' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        Cargando...
      </div>
    </div>
  )

  if (!usuario) return <Login onLogin={setUsuario} />

  // Redirigir encargado si intenta acceder a página de admin
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