import { useState } from 'react'
import { supabase } from '../supabase'
import './Login.css'

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [showPass, setShowPass] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setCargando(true)

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password: pass
    })

    if (authError) {
      setError('Correo o contraseña incorrectos')
      setCargando(false)
    }
    // Si el login es exitoso, onAuthStateChange en App.jsx
    // captura la sesión y setea el usuario automáticamente.
    // No hace falta llamar onLogin() aquí.
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">📋</div>
        <h2>Inventario Liceo</h2>
        <p>Ingresa con tus credenciales</p>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Correo</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="correo@liceo.cl"
              autoFocus
              required
            />
          </div>
          <div className="form-group">
            <label>Contraseña</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showPass ? 'text' : 'password'}
                value={pass}
                onChange={e => setPass(e.target.value)}
                placeholder="••••••"
                required
                style={{ width: '100%', paddingRight: 38, boxSizing: 'border-box' }}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                tabIndex={-1}
                style={{
                  position: 'absolute',
                  right: 10,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 15,
                  padding: 0,
                  lineHeight: 1,
                  color: '#9ca3af',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {error && <p className="error">{error}</p>}

          <button type="submit" className="btn-login" disabled={cargando}>
            {cargando ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}