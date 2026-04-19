import { useState } from 'react'
import './Login.css'

// Usuarios de prueba hasta conectar Supabase
const USUARIOS = [
  { id: 1, nombre: 'Administrador', usuario: 'admin', pass: '1234', rol: 'admin' },
  { id: 2, nombre: 'Juan Encargado', usuario: 'encargado', pass: '1234', rol: 'encargado' }
]

export default function Login({ onLogin }) {
  const [usuario, setUsuario] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')

  function handleLogin(e) {
    e.preventDefault()
    const found = USUARIOS.find(u => u.usuario === usuario && u.pass === pass)
    if (found) {
      onLogin(found)
    } else {
      setError('Usuario o contraseña incorrectos')
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">📋</div>
        <h2>Inventario Liceo</h2>
        <p>Ingresa con tus credenciales</p>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Usuario</label>
            <input
              type="text"
              value={usuario}
              onChange={e => setUsuario(e.target.value)}
              placeholder="usuario"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Contraseña</label>
            <input
              type="password"
              value={pass}
              onChange={e => setPass(e.target.value)}
              placeholder="••••••"
            />
          </div>

          {error && <p className="error">{error}</p>}

          <button type="submit" className="btn-login">Ingresar</button>
        </form>

        <p className="hint">admin / 1234 &nbsp;·&nbsp; encargado / 1234</p>
      </div>
    </div>
  )
}