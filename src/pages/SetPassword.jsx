// src/pages/SetPassword.jsx
import { useState } from 'react'
import { supabase } from '../supabase'
import { Eye, EyeOff, Lock } from 'lucide-react'
import './SetPassword.css'

const REQUISITOS = [
  { id: 'length', label: 'Mínimo 8 caracteres',        test: (p) => p.length >= 8 },
  { id: 'upper',  label: 'Al menos 1 mayúscula',        test: (p) => /[A-Z]/.test(p) },
  { id: 'lower',  label: 'Al menos 1 minúscula',        test: (p) => /[a-z]/.test(p) },
  { id: 'number', label: 'Al menos 1 número',           test: (p) => /[0-9]/.test(p) },
  { id: 'symbol', label: 'Al menos 1 símbolo especial', test: (p) => /[^A-Za-z0-9]/.test(p) },
]

const STRENGTH_INFO = [
  null,
  { label: 'Muy débil',  color: '#dc2626' },
  { label: 'Débil',      color: '#ef4444' },
  { label: 'Regular',    color: '#f97316' },
  { label: 'Fuerte',     color: '#22c55e' },
  { label: 'Muy fuerte', color: '#16a34a' },
]

export default function SetPassword({ onComplete, usuario }) {
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [exito,    setExito]    = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [showConf, setShowConf] = useState(false)

  const checks   = REQUISITOS.map((r) => ({ ...r, ok: r.test(password) }))
  const allOk    = checks.every((c) => c.ok)
  const match    = password === confirm && confirm.length > 0
  const strength = checks.filter((c) => c.ok).length
  const si       = STRENGTH_INFO[strength]

  async function handleSubmit(e) {
    e.preventDefault()
    if (!allOk || !match) return
    setLoading(true)
    setError('')

    const { data: updateData, error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      const mensajesES = {
        'New password should be different from the old password.': 'La nueva contraseña debe ser diferente a la contraseña actual.',
        'Password should be at least 6 characters.': 'La contraseña debe tener al menos 6 caracteres.',
        'Auth session missing!': 'Sesión expirada. Por favor, solicita un nuevo enlace.',
        'User not found': 'Usuario no encontrado.',
        'Invalid login credentials': 'Credenciales inválidas.',
      }
      setError('Error al guardar: ' + (mensajesES[updateError.message] ?? updateError.message))
      setLoading(false)
      return
    }

    if (!updateData?.user) {
      setError('No se pudo confirmar el cambio. Intenta de nuevo.')
      setLoading(false)
      return
    }

    setExito(true)
    setTimeout(() => { if (onComplete) onComplete() }, 1800)
  }

  /* ── Éxito ── */
  if (exito) {
    return (
      <div className="sp-page">
        <div className="sp-card sp-success">
          <div className="sp-success-circle">✓</div>
          <h2 className="sp-heading">¡Contraseña establecida!</h2>
          <p className="sp-subtext">Ingresando al sistema…</p>
        </div>
      </div>
    )
  }

  /* ── Formulario ── */
  return (
    <div className="sp-page">
      <div className="sp-card">

        <div className="sp-header">
          <div className="sp-icon-wrap">
            <Lock size={26} color="var(--acento-bright)" strokeWidth={2} />
          </div>
          <h1 className="sp-heading">Establece tu contraseña</h1>
          <p className="sp-subtext">
            {usuario?.nombre ? `Hola ${usuario.nombre}, crea` : 'Crea'} una contraseña segura para acceder al sistema.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="sp-field">

          {/* Nueva contraseña */}
          <div>
            <label className="sp-label">Nueva contraseña</label>
            <div className="sp-input-wrap">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Escribe tu contraseña"
                className="sp-input"
                autoComplete="new-password"
              />
              <button type="button" className="sp-eye" onClick={() => setShowPass(!showPass)}>
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {password.length > 0 && (
              <div>
                <div className="sp-strength-bars">
                  {[1,2,3,4,5].map((i) => (
                    <div key={i} className="sp-strength-bar"
                      style={{ backgroundColor: i <= strength ? si?.color : 'rgba(255,255,255,0.14)' }} />
                  ))}
                </div>
                {si && <p className="sp-strength-label" style={{ color: si.color }}>{si.label}</p>}
              </div>
            )}
          </div>

          {/* Requisitos */}
          <div className="sp-requisitos">
            <p className="sp-req-title">Requisitos de seguridad</p>
            {checks.map((c) => (
              <div key={c.id} className="sp-req-row">
                <span className={`sp-req-icon ${c.ok ? 'sp-req-icon--ok' : 'sp-req-icon--no'}`}>
                  {c.ok ? '✓' : '○'}
                </span>
                <span className={c.ok ? 'sp-req-text--ok' : 'sp-req-text--no'}>{c.label}</span>
              </div>
            ))}
          </div>

          {/* Confirmar */}
          <div>
            <label className="sp-label">Confirmar contraseña</label>
            <div className="sp-input-wrap">
              <input
                type={showConf ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repite tu contraseña"
                autoComplete="new-password"
                className={`sp-input ${confirm.length > 0 ? (match ? 'sp-input--ok' : 'sp-input--error') : ''}`}
              />
              <button type="button" className="sp-eye" onClick={() => setShowConf(!showConf)}>
                {showConf ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {confirm.length > 0 && (
              <p className={`sp-match-msg ${match ? 'sp-match-msg--ok' : 'sp-match-msg--error'}`}>
                {match ? 'Las contraseñas coinciden ✓' : 'Las contraseñas no coinciden'}
              </p>
            )}
          </div>

          {/* Error */}
          {error && <div className="sp-error">⚠️ {error}</div>}

          {/* Submit */}
          <button type="submit" className="sp-btn" disabled={!allOk || !match || loading}>
            {loading ? 'Guardando…' : 'Establecer contraseña'}
          </button>

        </form>
      </div>
    </div>
  )
}
