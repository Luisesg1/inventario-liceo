import { useState } from 'react'
import { supabase } from '../supabase'
import './Login.css'

const REQUISITOS_PASS = [
  { id: 'length', label: 'Mínimo 8 caracteres',  test: (p) => p.length >= 8 },
  { id: 'upper',  label: 'Una mayúscula',         test: (p) => /[A-Z]/.test(p) },
  { id: 'lower',  label: 'Una minúscula',         test: (p) => /[a-z]/.test(p) },
  { id: 'number', label: 'Un número',             test: (p) => /[0-9]/.test(p) },
  { id: 'symbol', label: 'Un símbolo (!@#...)',   test: (p) => /[^A-Za-z0-9]/.test(p) },
]
const STRENGTH_COLORS = [null, '#dc2626', '#ef4444', '#f97316', '#22c55e', '#16a34a']

export default function Login({ onLogin, logoUrl }) {
  const [email,    setEmail]    = useState('')
  const [pass,     setPass]     = useState('')
  const [error,    setError]    = useState('')
  const [cargando, setCargando] = useState(false)
  const [showPass, setShowPass] = useState(false)

  // Olvidé contraseña
  const [vistaOlvide, setVistaOlvide] = useState(false)
  const [emailReset,  setEmailReset]  = useState('')
  const [enviado,     setEnviado]     = useState(false)

  // Registro
  const [vistaRegistro,  setVistaRegistro]  = useState(false)
  const [regNombre,      setRegNombre]      = useState('')
  const [regEmail,       setRegEmail]       = useState('')
  const [regPass,        setRegPass]        = useState('')
  const [regPassConf,    setRegPassConf]    = useState('')
  const [regCodigo,      setRegCodigo]      = useState('')
  const [regShowPass,    setRegShowPass]    = useState(false)
  const [regShowCodigo,  setRegShowCodigo]  = useState(false)
  const [regExito,       setRegExito]       = useState(false)

  async function handleRegistro(e) {
    e.preventDefault()
    setError('')
    if (regPass !== regPassConf) { setError('Las contraseñas no coinciden'); return }
    if (!REQUISITOS_PASS.every(r => r.test(regPass))) { setError('La contraseña no cumple todos los requisitos de seguridad'); return }
    setCargando(true)

    // Paso 1: validar código de invitación
    const { data: fnData, error: fnError } = await supabase.functions.invoke('register-user', {
      body: { codigo: regCodigo },
    })
    if (fnError || fnData?.error) {
      setError(fnData?.error || 'Error al validar el código')
      setCargando(false)
      return
    }

    // Paso 2: crear cuenta
    const { error: signUpError } = await supabase.auth.signUp({
      email: regEmail,
      password: regPass,
      options: { data: { nombre: regNombre, via_invitacion: 'true' } },
    })
    setCargando(false)
    if (signUpError) {
      setError(signUpError.message === 'User already registered'
        ? 'Ya existe una cuenta con ese correo'
        : 'Error al crear la cuenta: ' + signUpError.message)
      return
    }

    // Auto-login
    const { error: loginError } = await supabase.auth.signInWithPassword({ email: regEmail, password: regPass })
    if (loginError) { setRegExito(true) }
  }

  function volverAlLogin() {
    setVistaOlvide(false); setVistaRegistro(false)
    setEnviado(false); setRegExito(false)
    setEmailReset(''); setRegNombre(''); setRegEmail('')
    setRegPass(''); setRegPassConf(''); setRegCodigo('')
    setError('')
  }

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


  const ladoIzq = (
    <div className="login-side">
      <img src={logoUrl || '/logo-liceo.png'} alt="Logo Liceo" className="login-side-logo" onError={e => { e.target.src = '/logo-liceo.png' }} />
      <h1 className="login-side-title">Liceo Bicentenario<br/>Polivalente Juvenal Hernández Jaque</h1>
      <p className="login-side-sub">El Carmen · Sistema de Inventario</p>
    </div>
  )

  if (vistaRegistro) {
    return (
      <div className="login-bg">
        <div className="login-panel">
          {ladoIzq}
          <div className="login-form-wrap login-form-wrap--recovery">
            <div className="login-form-inner">
              <div className="login-form-header login-form-header--recovery">
                <div className="login-form-icon">🎫</div>
                <h2>Crear cuenta</h2>
                <p>{regExito ? 'Cuenta creada con éxito' : 'Ingresa el código que te compartieron'}</p>
              </div>

              {regExito ? (
                <>
                  <p className="login-ok login-ok--recovery">
                    Tu cuenta fue creada. Ahora puedes iniciar sesión con tu correo y contraseña.
                  </p>
                  <button className="login-btn login-btn--recovery" onClick={volverAlLogin} style={{ marginTop: 24 }}>
                    Ir al inicio de sesión
                  </button>
                </>
              ) : (
                <form onSubmit={handleRegistro}>
                  <div className="login-field login-field--recovery">
                    <label>Nombre completo</label>
                    <input type="text" value={regNombre} onChange={e => setRegNombre(e.target.value)}
                      placeholder="Nombre Apellido" autoFocus required />
                  </div>
                  <div className="login-field login-field--recovery">
                    <label>Correo electrónico</label>
                    <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)}
                      placeholder="correo@ejemplo.com" required />
                  </div>
                  <div className="login-field login-field--recovery">
                    <label>Contraseña</label>
                    <div className="login-pass-wrap">
                      <input type={regShowPass ? 'text' : 'password'} value={regPass}
                        onChange={e => setRegPass(e.target.value)} placeholder="Mínimo 8 caracteres" required />
                      <button type="button" className="login-eye" onClick={() => setRegShowPass(!regShowPass)} tabIndex={-1}>
                        {regShowPass ? '🙈' : '👁️'}
                      </button>
                    </div>
                    {regPass.length > 0 && (() => {
                      const checks   = REQUISITOS_PASS.map(r => ({ ...r, ok: r.test(regPass) }))
                      const strength = checks.filter(c => c.ok).length
                      const color    = STRENGTH_COLORS[strength]
                      return (
                        <div style={{ marginTop: 6 }}>
                          <div style={{ display: 'flex', gap: 3, height: 4, borderRadius: 3, marginBottom: 5 }}>
                            {[1,2,3,4,5].map(i => (
                              <div key={i} style={{ flex: 1, borderRadius: 3, transition: 'background 0.2s',
                                backgroundColor: i <= strength ? color : '#e5e7eb' }} />
                            ))}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 10px' }}>
                            {checks.map(c => (
                              <span key={c.id} style={{ fontSize: 11, color: c.ok ? '#16a34a' : '#9ca3af', display: 'flex', alignItems: 'center', gap: 3 }}>
                                <span style={{ fontWeight: 700 }}>{c.ok ? '✓' : '○'}</span> {c.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                  <div className="login-field login-field--recovery">
                    <label>Confirmar contraseña</label>
                    <div className="login-pass-wrap">
                      <input type={regShowPass ? 'text' : 'password'} value={regPassConf}
                        onChange={e => setRegPassConf(e.target.value)} placeholder="Repite la contraseña" required />
                    </div>
                  </div>
                  <div className="login-field login-field--recovery">
                    <label>Código de invitación</label>
                    <div className="login-pass-wrap">
                      <input type={regShowCodigo ? 'text' : 'password'} value={regCodigo}
                        onChange={e => setRegCodigo(e.target.value)} placeholder="Código proporcionado por el encargado" required />
                      <button type="button" className="login-eye" onClick={() => setRegShowCodigo(!regShowCodigo)} tabIndex={-1}>
                        {regShowCodigo ? '🙈' : '🔑'}
                      </button>
                    </div>
                  </div>

                  {error && <p className="login-error login-error--recovery">⚠️ {error}</p>}

                  <button type="submit" className="login-btn login-btn--recovery" disabled={cargando}>
                    {cargando ? <span className="login-spinner" /> : null}
                    {cargando ? 'Creando cuenta...' : 'Crear cuenta'}
                  </button>

                  <button type="button" className="login-link login-link--recovery" onClick={volverAlLogin}>
                    Ya tengo cuenta — Iniciar sesión
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (vistaOlvide) {
    return (
      <div className="login-bg">
        <div className="login-panel">
          {ladoIzq}
          <div className="login-form-wrap login-form-wrap--recovery">
            <div className="login-form-inner">
              <div className="login-form-header login-form-header--recovery">
                <div className="login-form-icon">🔑</div>
                <h2>Recuperar contraseña</h2>
                <p>{enviado ? 'Revisa tu correo electrónico' : 'Ingresa tu correo para recibir un link de acceso'}</p>
              </div>

              {enviado ? (
                <>
                  <p className="login-ok login-ok--recovery">
                    Se envió un link a <strong>{emailReset}</strong>. Ábrelo desde este mismo dispositivo para cambiar tu contraseña.
                  </p>
                  <button className="login-btn login-btn--recovery" onClick={volverAlLogin} style={{ marginTop: 24 }}>
                    Volver al inicio de sesión
                  </button>
                </>
              ) : (
                <form onSubmit={handleOlvide}>
                  <div className="login-field login-field--recovery">
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

                  {error && <p className="login-error login-error--recovery">⚠️ {error}</p>}

                  <button type="submit" className="login-btn login-btn--recovery" disabled={cargando}>
                    {cargando ? <span className="login-spinner" /> : null}
                    {cargando ? 'Enviando...' : 'Enviar link'}
                  </button>

                  <button type="button" className="login-link login-link--recovery" onClick={volverAlLogin}>
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
            <button className="login-link" onClick={() => { setVistaRegistro(true); setError('') }}>
              ¿No tienes cuenta? Crear cuenta
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}