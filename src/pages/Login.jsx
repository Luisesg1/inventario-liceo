import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LogIn, KeyRound, UserPlus, Eye, EyeOff,
  AlertCircle, CheckCircle2, Package2, MailCheck,
  ArrowLeft, Check,
} from 'lucide-react'
import { supabase } from '../supabase'
import './Login.css'

const REQUISITOS_PASS = [
  { id: 'length', label: 'Mínimo 8 caracteres',  test: p => p.length >= 8 },
  { id: 'upper',  label: 'Una mayúscula',         test: p => /[A-Z]/.test(p) },
  { id: 'lower',  label: 'Una minúscula',         test: p => /[a-z]/.test(p) },
  { id: 'number', label: 'Un número',             test: p => /[0-9]/.test(p) },
  { id: 'symbol', label: 'Un símbolo (!@#...)',   test: p => /[^A-Za-z0-9]/.test(p) },
]
const STRENGTH_COLORS = [null, '#ef4444', '#f97316', '#eab308', '#22c55e', '#16a34a']

/* ── Transición de vista ─────────────────────────────── */
const viewVariants = {
  enter:  { opacity: 0, y: 14,  transition: { duration: 0.22, ease: 'easeOut' } },
  visible:{ opacity: 1, y: 0,   transition: { duration: 0.22, ease: 'easeOut' } },
  exit:   { opacity: 0, y: -10, transition: { duration: 0.18, ease: 'easeIn' } },
}

/* ── PasswordStrength ────────────────────────────────── */
function PasswordStrength({ password }) {
  if (!password) return null
  const checks   = REQUISITOS_PASS.map(r => ({ ...r, ok: r.test(password) }))
  const strength = checks.filter(c => c.ok).length
  const color    = STRENGTH_COLORS[strength]
  return (
    <div style={{ marginTop: 8 }}>
      <div className="pass-strength-bars">
        {[1,2,3,4,5].map(i => (
          <div
            key={i}
            className="pass-strength-bar"
            style={{ backgroundColor: i <= strength ? color : '#e2e8f0' }}
          />
        ))}
      </div>
      <div className="pass-req-list">
        {checks.map(c => (
          <span
            key={c.id}
            className="pass-req-item"
            style={{ color: c.ok ? '#16a34a' : '#94a3b8' }}
          >
            {c.ok
              ? <Check size={10} strokeWidth={3} />
              : <span style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid currentColor', display: 'flex', flexShrink: 0 }} />
            }
            {c.label}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ── RUT formatter ───────────────────────────────────── */
function formatRut(value) {
  const clean = value.replace(/[^0-9kK]/g, '').toUpperCase()
  if (clean.length === 0) return ''
  const body = clean.slice(0, -1)
  const dv   = clean.slice(-1)
  const withDots = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return body.length > 0 ? `${withDots}-${dv}` : dv
}

function validarRut(rut) {
  const clean = rut.replace(/\./g, '').replace('-', '').toUpperCase()
  if (clean.length < 2) return false
  const cuerpo = clean.slice(0, -1)
  const dv = clean.slice(-1)
  let suma = 0, multiplo = 2
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i]) * multiplo
    multiplo = multiplo < 7 ? multiplo + 1 : 2
  }
  const esperado = 11 - (suma % 11)
  const dvEsperado = esperado === 11 ? '0' : esperado === 10 ? 'K' : esperado.toString()
  return dv === dvEsperado
}

/* ── ErrorMsg ────────────────────────────────────────── */
function ErrorMsg({ msg }) {
  if (!msg) return null
  return (
    <motion.div
      className="login-error"
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
      {msg}
    </motion.div>
  )
}

/* ══════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ══════════════════════════════════════════════════════ */
export default function Login({
  onLogin,
  logoUrl,
  nombreInstitucion = 'Liceo Polivalente de Excelencia Juvenal Hernández Jaque',
  nombreSistema     = 'Sistema de Inventario',
}) {
  /* ── Estado login ── */
  const [email,    setEmail]    = useState('')
  const [pass,     setPass]     = useState('')
  const [error,    setError]    = useState('')
  const [cargando, setCargando] = useState(false)
  const [showPass, setShowPass] = useState(false)

  /* ── Estado olvide ── */
  const [vistaOlvide, setVistaOlvide] = useState(false)
  const [emailReset,  setEmailReset]  = useState('')
  const [enviado,     setEnviado]     = useState(false)

  /* ── Estado registro ── */
  const [vistaRegistro, setVistaRegistro] = useState(false)
  const [regNombres,    setRegNombres]    = useState('')
  const [regApellidos,  setRegApellidos]  = useState('')
  const [regRut,        setRegRut]        = useState('')
  const [regEmail,      setRegEmail]      = useState('')
  const [regPass,       setRegPass]       = useState('')
  const [regPassConf,   setRegPassConf]   = useState('')
  const [regCodigo,     setRegCodigo]     = useState('')
  const [regShowPass,   setRegShowPass]   = useState(false)
  const [regShowCodigo, setRegShowCodigo] = useState(false)
  const [regExito,      setRegExito]      = useState(false)
  const [regErrors,     setRegErrors]     = useState({})

  function setFieldError(field, msg) {
    setRegErrors(prev => ({ ...prev, [field]: msg }))
  }
  function clearField(field) {
    setRegErrors(prev => ({ ...prev, [field]: '' }))
  }

  /* ── Handlers ─────────────────────────────────────── */
  async function handleLogin(e) {
    e.preventDefault(); setError(''); setCargando(true)
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password: pass })
    if (authError) { setError('Correo o contraseña incorrectos'); setCargando(false) }
  }

  async function handleOlvide(e) {
    e.preventDefault(); setError(''); setCargando(true)
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

  async function handleRegistro(e) {
    e.preventDefault(); setError(''); setRegErrors({})
    let ok = true
    if (!regNombres.trim()) { setFieldError('nombres', 'Ingresa al menos 1 nombre'); ok = false }
    if (regApellidos.trim().split(/\s+/).length < 2) { setFieldError('apellidos', 'Ingresa al menos 2 apellidos'); ok = false }
    if (!regRut.trim()) { setFieldError('rut', 'El RUT es requerido'); ok = false }
    else if (!validarRut(regRut)) { setFieldError('rut', 'RUT no válido'); ok = false }
    if (regPass !== regPassConf) { setFieldError('passConf', 'Las contraseñas no coinciden'); ok = false }
    if (!REQUISITOS_PASS.every(r => r.test(regPass))) { setFieldError('pass', 'No cumple los requisitos de seguridad'); ok = false }
    if (!ok) return
    setCargando(true)
    const { data: fnData, error: fnError } = await supabase.functions.invoke('register-user', {
      body: { codigo: regCodigo },
    })
    if (fnError || fnData?.error) {
      setError(fnData?.error || 'Error al validar el código'); setCargando(false); return
    }
    const { error: signUpError } = await supabase.auth.signUp({
      email: regEmail, password: regPass,
      options: { data: { nombre: `${regNombres.trim()} ${regApellidos.trim()}`.trim(), rut: regRut.trim(), via_invitacion: 'true' } },
    })
    setCargando(false)
    if (signUpError) {
      const m = signUpError.message ?? ''
      setError(
        m === 'User already registered' || m.includes('already been registered') || m.includes('already registered')
          ? 'Ya existe una cuenta con ese correo electrónico.'
          : 'Error al crear la cuenta: ' + m
      )
      return
    }
    const { error: loginError } = await supabase.auth.signInWithPassword({ email: regEmail, password: regPass })
    if (loginError) setRegExito(true)
  }

  function volverAlLogin() {
    setVistaOlvide(false); setVistaRegistro(false)
    setEnviado(false); setRegExito(false)
    setEmailReset(''); setRegNombre(''); setRegEmail('')
    setRegPass(''); setRegPassConf(''); setRegCodigo('')
    setError('')
  }

  /* ── Panel izquierdo (siempre igual) ─────────────────── */
  const PanelIzq = (
    <div className="login-side">
      <div className="login-side-orb" />
      <img
        src={logoUrl || '/logo-liceo.png'}
        alt="Logo"
        className="login-side-logo"
        onError={e => { e.target.src = '/logo-liceo.png' }}
      />
      <div className="login-side-badge">
        <Package2 size={11} />
        {nombreSistema}
      </div>
      <h1 className="login-side-title">{nombreInstitucion}</h1>
      <div className="login-side-sep" />
      <p className="login-side-sub">El Carmen · Región de Ñuble</p>
    </div>
  )

  /* ── Vista activa ────────────────────────────────────── */
  const vista = vistaRegistro ? 'registro' : vistaOlvide ? 'olvide' : 'login'

  return (
    <motion.div
      className="login-bg"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      <motion.div
        className="login-panel"
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 36, delay: 0.06 }}
      >
        {PanelIzq}

        <div className="login-form-wrap">
          <div className="login-form-inner">
            <AnimatePresence mode="wait">

              {/* ── VISTA LOGIN ─────────────────────────── */}
              {vista === 'login' && (
                <motion.div key="login" variants={viewVariants} initial="enter" animate="visible" exit="exit">
                  <div className="login-form-header">
                    <div className="login-form-icon-wrap" style={{ background: '#eef0ff' }}>
                      <LogIn size={22} style={{ color: '#1a237e' }} strokeWidth={2} />
                    </div>
                    <h2>Bienvenido</h2>
                    <p>Ingresa tus credenciales para continuar</p>
                  </div>

                  <form onSubmit={handleLogin}>
                    <div className="login-field">
                      <label>Correo electrónico</label>
                      <input
                        type="email" value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="correo@liceo.cl"
                        autoFocus required
                      />
                    </div>
                    <div className="login-field">
                      <label>Contraseña</label>
                      <div className="login-pass-wrap">
                        <input
                          type={showPass ? 'text' : 'password'} value={pass}
                          onChange={e => setPass(e.target.value)}
                          placeholder="••••••••" required
                        />
                        <button type="button" className="login-eye" onClick={() => setShowPass(v => !v)} tabIndex={-1}>
                          {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    <AnimatePresence><ErrorMsg msg={error} /></AnimatePresence>

                    <motion.button
                      type="submit"
                      className="login-btn"
                      disabled={cargando}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      {cargando ? <span className="login-spinner" /> : <LogIn size={15} />}
                      {cargando ? 'Ingresando...' : 'Ingresar'}
                    </motion.button>
                  </form>

                  <div className="login-links">
                    <button className="login-link" onClick={() => { setVistaOlvide(true); setError('') }}>
                      ¿Olvidaste tu contraseña?
                    </button>
                    <button className="login-link" onClick={() => { setVistaRegistro(true); setError('') }}>
                      ¿No tienes cuenta? <strong>Crear cuenta</strong>
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ── VISTA OLVIDÉ ────────────────────────── */}
              {vista === 'olvide' && (
                <motion.div key="olvide" variants={viewVariants} initial="enter" animate="visible" exit="exit">
                  <div className="login-form-header">
                    <div className="login-form-icon-wrap" style={{ background: '#fef3c7' }}>
                      <KeyRound size={22} style={{ color: '#d97706' }} strokeWidth={2} />
                    </div>
                    <h2>Recuperar contraseña</h2>
                    <p>{enviado ? 'Revisa tu correo electrónico' : 'Te enviaremos un link de acceso'}</p>
                  </div>

                  {enviado ? (
                    <>
                      <motion.div
                        className="login-ok"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}
                      >
                        <MailCheck size={18} style={{ color: '#16a34a', flexShrink: 0, marginTop: 2 }} />
                        <span>
                          Se envió un link a <strong>{emailReset}</strong>.
                          Ábrelo desde este mismo dispositivo para cambiar tu contraseña.
                        </span>
                      </motion.div>
                      <button className="login-btn" onClick={volverAlLogin} style={{ marginTop: 20 }}>
                        <ArrowLeft size={15} />
                        Volver al inicio de sesión
                      </button>
                    </>
                  ) : (
                    <form onSubmit={handleOlvide}>
                      <div className="login-field">
                        <label>Correo electrónico</label>
                        <input
                          type="email" value={emailReset}
                          onChange={e => setEmailReset(e.target.value)}
                          placeholder="correo@liceo.cl"
                          autoFocus required
                        />
                      </div>
                      <AnimatePresence><ErrorMsg msg={error} /></AnimatePresence>
                      <button type="submit" className="login-btn" disabled={cargando}>
                        {cargando ? <span className="login-spinner" /> : <KeyRound size={15} />}
                        {cargando ? 'Enviando...' : 'Enviar link de acceso'}
                      </button>
                    </form>
                  )}

                  {!enviado && (
                    <div className="login-links">
                      <button className="login-link" onClick={volverAlLogin}>
                        <ArrowLeft size={12} style={{ display:'inline', marginRight: 4 }} />
                        Volver al inicio de sesión
                      </button>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── VISTA REGISTRO ──────────────────────── */}
              {vista === 'registro' && (
                <motion.div key="registro" variants={viewVariants} initial="enter" animate="visible" exit="exit">
                  <div className="login-form-header">
                    <div className="login-form-icon-wrap" style={{ background: '#ede9fe' }}>
                      <UserPlus size={22} style={{ color: '#7c3aed' }} strokeWidth={2} />
                    </div>
                    <h2>Crear cuenta</h2>
                    <p>{regExito ? 'Cuenta creada exitosamente' : 'Ingresa el código que te compartieron'}</p>
                  </div>

                  {regExito ? (
                    <>
                      <motion.div
                        className="login-ok"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}
                      >
                        <CheckCircle2 size={18} style={{ color: '#16a34a', flexShrink: 0, marginTop: 2 }} />
                        <span>Tu cuenta fue creada. Ahora puedes iniciar sesión con tu correo y contraseña.</span>
                      </motion.div>
                      <button className="login-btn" onClick={volverAlLogin} style={{ marginTop: 20 }}>
                        <LogIn size={15} />
                        Ir al inicio de sesión
                      </button>
                    </>
                  ) : (
                    <form onSubmit={handleRegistro}>
                      <div className="login-field">
                        <label>Nombres</label>
                        <input type="text" value={regNombres}
                          onChange={e => { setRegNombres(e.target.value); clearField('nombres') }}
                          placeholder="Nombres" autoFocus required
                          style={regErrors.nombres ? { borderColor: '#dc2626' } : {}} />
                        {regErrors.nombres && <span className="login-field-hint login-field-hint--error">{regErrors.nombres}</span>}
                      </div>
                      <div className="login-field">
                        <label>Apellidos</label>
                        <input type="text" value={regApellidos}
                          onChange={e => { setRegApellidos(e.target.value); clearField('apellidos') }}
                          placeholder="Apellidos" required
                          style={regErrors.apellidos ? { borderColor: '#dc2626' } : {}} />
                        {regErrors.apellidos && <span className="login-field-hint login-field-hint--error">{regErrors.apellidos}</span>}
                      </div>
                      <div className="login-field">
                        <label>RUT</label>
                        <input type="text" value={regRut}
                          onChange={e => { setRegRut(formatRut(e.target.value)); clearField('rut') }}
                          placeholder="12.345.678-9" required
                          style={regErrors.rut ? { borderColor: '#dc2626' } : {}} />
                        {regErrors.rut && <span className="login-field-hint login-field-hint--error">{regErrors.rut}</span>}
                      </div>
                      <div className="login-field">
                        <label>Correo electrónico</label>
                        <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)}
                          placeholder="correo@ejemplo.com" required />
                      </div>
                      <div className="login-field">
                        <label>Contraseña</label>
                        <div className="login-pass-wrap">
                          <input type={regShowPass ? 'text' : 'password'} value={regPass}
                            onChange={e => { setRegPass(e.target.value); clearField('pass') }}
                            placeholder="Mínimo 8 caracteres" required
                            style={regErrors.pass ? { borderColor: '#dc2626' } : {}} />
                          <button type="button" className="login-eye" onClick={() => setRegShowPass(v => !v)} tabIndex={-1}>
                            {regShowPass ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                        <PasswordStrength password={regPass} />
                        {regErrors.pass && <span className="login-field-hint login-field-hint--error">{regErrors.pass}</span>}
                      </div>
                      <div className="login-field">
                        <label>Confirmar contraseña</label>
                        <div className="login-pass-wrap">
                          <input type={regShowPass ? 'text' : 'password'} value={regPassConf}
                            onChange={e => { setRegPassConf(e.target.value); clearField('passConf') }}
                            placeholder="Repite la contraseña" required
                            style={regErrors.passConf ? { borderColor: '#dc2626' } : {}} />
                        </div>
                        {regErrors.passConf && <span className="login-field-hint login-field-hint--error">{regErrors.passConf}</span>}
                      </div>
                      <div className="login-field">
                        <label>Código de invitación</label>
                        <div className="login-pass-wrap">
                          <input type={regShowCodigo ? 'text' : 'password'} value={regCodigo}
                            onChange={e => setRegCodigo(e.target.value)}
                            placeholder="Código del encargado" required />
                          <button type="button" className="login-eye" onClick={() => setRegShowCodigo(v => !v)} tabIndex={-1}>
                            {regShowCodigo ? <EyeOff size={16} /> : <KeyRound size={16} />}
                          </button>
                        </div>
                      </div>

                      <AnimatePresence><ErrorMsg msg={error} /></AnimatePresence>

                      <button type="submit" className="login-btn" disabled={cargando}>
                        {cargando ? <span className="login-spinner" /> : <UserPlus size={15} />}
                        {cargando ? 'Creando cuenta...' : 'Crear cuenta'}
                      </button>
                    </form>
                  )}

                  {!regExito && (
                    <div className="login-links">
                      <button className="login-link" onClick={volverAlLogin}>
                        Ya tengo cuenta — <strong>Iniciar sesión</strong>
                      </button>
                    </div>
                  )}
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
