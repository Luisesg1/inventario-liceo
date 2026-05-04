import { useState } from 'react'
import Layout from './components/Layout'
import Login from './pages/Login'
import Inventario from './pages/Inventario'
import Dashboard from './pages/Dashboard'

export default function App() {
  const [usuario, setUsuario] = useState(null)
  const [pagina, setPagina] = useState('dashboard')

  if (!usuario) {
    return <Login onLogin={setUsuario} />
  }

  const renderPagina = () => {
    switch (pagina) {
      case 'inventario': return <Inventario />
      case 'dashboard':  return <Dashboard usuario={usuario} />
      // agrega más páginas aquí
      default:           return <Dashboard usuario={usuario} />
    }
  }

  return (
    <Layout
      usuario={usuario}
      onLogout={() => setUsuario(null)}
      paginaActual={pagina}
      setPagina={setPagina}
    >
      {renderPagina()}
    </Layout>
  )
}