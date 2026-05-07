import { useState } from 'react'
import { supabase } from '../supabase'
import './Login.css'

export default function Login({ onLogin }) {
  const [email,    setEmail]    = useState('')
  const [pass,     setPass]     = useState('')
  const [error,    setError]    = useState('')
  const [cargando, setCargando] = useState(false)
  const [showPass, setShowPass] = useState(false)

  // Estado para "Olvidé mi contraseña"
  const [vistaOlvide, setVistaOlvide] = useState(false)
  const [emailReset,  setEmailReset]  = useState('')
  const [enviado,     setEnviado]     = useState(false)

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

  async function handleOlvide(e) {
    e.preventDefault()
    setError('')
    setCargando(true)
    const { error: err } = await supabase.auth.resetPasswordForEmail(emailReset, {
      redirectTo: window.location.origin,
    })
    setCargando(false)
    if (err) {
      setError(err.status === 429
        ? 'Límite alcanzado, espera unos minutos e intenta de nuevo'
        : 'Error: ' + err.message)
    } else {
      setEnviado(true)
    }
  }

  function volverAlLogin() {
    setVistaOlvide(false)
    setEnviado(false)
    setEmailReset('')
    setError('')
  }

  const ladoIzq = (
    <div className="login-side">
      <img src="/logo-liceo.png" alt="Logo Liceo" className="login-side-logo" />
      <h1 className="login-side-title">Liceo Bicentenario<br/>Polivalente Juvenal Hernández Jaque</h1>
      <p className="login-side-sub">El Carmen · Sistema de Inventario</p>
    </div>
  )

  if (vistaOlvide) {
    return (
      <div className="login-bg">
        <div className="login-panel">
          {ladoIzq}
          <div className="login-form-wrap">
            <div className="login-form-inner">
              <div className="login-form-header">
                <div className="login-form-icon">🔑</div>
                <h2>Recuperar contraseña</h2>
                <p>{enviado ? 'Revisa tu correo electrónico' : 'Ingresa tu correo para recibir un link de acceso'}</p>
              </div>

              {enviado ? (
                <>
                  <p className="login-ok">
                    Se envió un link a <strong>{emailReset}</strong>. Ábrelo desde este mismo dispositivo para cambiar tu contraseña.
                  </p>
                  <button className="login-btn" onClick={volverAlLogin} style={{ marginTop: 24 }}>
                    Volver al inicio de sesión
                  </button>
                </>
              ) : (
                <form onSubmit={handleOlvide}>
                  <div className="login-field">
                    <label>Correo electrónico</label>
                    <input
                      type="email"
                      value={emailReset}
                      onChange={e => setEmailReset(e.target.value)}
                      placeholder="correo@liceo.cl"
                      autoFocus
                      required
                    />
                  </div>

                  {error && <p className="login-error">⚠️ {error}</p>}

                  <button type="submit" className="login-btn" disabled={cargando}>
                    {cargando ? <span className="login-spinner" /> : null}
                    {cargando ? 'Enviando...' : 'Enviar link'}
                  </button>

                  <button type="button" className="login-link" onClick={volverAlLogin}>
                    Volver al inicio de sesión
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="login-bg">
      <div className="login-panel">
        {ladoIzq}

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

            <button className="login-link" onClick={() => { setVistaOlvide(true); setError('') }}>
              ¿Olvidaste tu contraseña?
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
