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
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password: pass })
    if (authError) {
      setError('Correo o contraseña incorrectos')
      setCargando(false)
    }
  }

  return (
    <div className="login-bg">
      <div className="login-panel">

        {/* Banda izquierda decorativa */}
        <div className="login-side">
          <img src="/logo-liceo.png" alt="Logo Liceo" className="login-side-logo" />
          <h1 className="login-side-title">Liceo Bicentenario<br/>Juvenal Hernández Jaque</h1>
          <p className="login-side-sub">El Carmen · Sistema de Inventario</p>
        </div>

        {/* Formulario derecho */}
        <div className="login-form-wrap">
          <div className="login-form-inner">
            <div className="login-form-header">
              <div className="login-form-icon">📋</div>
              <h2>Bienvenido</h2>
              <p>Ingresa tus credenciales para continuar</p>
            </div>

            <form onSubmit={handleLogin}>
              <div className="login-field">
                <label>Correo electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="correo@liceo.cl"
                  autoFocus
                  required
                />
              </div>

              <div className="login-field">
                <label>Contraseña</label>
                <div className="login-pass-wrap">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={pass}
                    onChange={e => setPass(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                  <button type="button" className="login-eye" onClick={() => setShowPass(!showPass)} tabIndex={-1}>
                    {showPass ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              {error && <p className="login-error">⚠️ {error}</p>}

              <button type="submit" className="login-btn" disabled={cargando}>
                {cargando ? <span className="login-spinner" /> : null}
                {cargando ? 'Ingresando...' : 'Ingresar'}
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  )
}
