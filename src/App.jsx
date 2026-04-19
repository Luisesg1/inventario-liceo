import { useState } from 'react'
import Login from './pages/Login'
import Layout from './components/Layout'

function App() {
  const [usuario, setUsuario] = useState(null)
  const [pagina, setPagina] = useState('dashboard')

  if (!usuario) return <Login onLogin={setUsuario} />

  return (
    <Layout
      usuario={usuario}
      onLogout={() => setUsuario(null)}
      paginaActual={pagina}
      setPagina={setPagina}
    >
      <p>Página: {pagina}</p>
    </Layout>
  )
}

export default App