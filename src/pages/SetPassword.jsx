// src/pages/SetPassword.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const REQUISITOS = [
  { id: 'length', label: 'Mínimo 8 caracteres',        test: (p) => p.length >= 8 },
  { id: 'upper',  label: 'Al menos 1 mayúscula',        test: (p) => /[A-Z]/.test(p) },
  { id: 'lower',  label: 'Al menos 1 minúscula',        test: (p) => /[a-z]/.test(p) },
  { id: 'number', label: 'Al menos 1 número',           test: (p) => /[0-9]/.test(p) },
  { id: 'symbol', label: 'Al menos 1 símbolo especial', test: (p) => /[^A-Za-z0-9]/.test(p) },
]

export default function SetPassword({ onComplete, usuario }) {
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [exito, setExito]         = useState(false)
  const [showPass, setShowPass]   = useState(false)
  const [showConf, setShowConf]   = useState(false)

  const checks   = REQUISITOS.map((r) => ({ ...r, ok: r.test(password) }))
  const allOk    = checks.every((c) => c.ok)
  const match    = password === confirm && confirm.length > 0
  const strength = checks.filter((c) => c.ok).length

  const strengthInfo = [
    null,
    { label: 'Muy débil',  color: '#dc2626' },
    { label: 'Débil',      color: '#ef4444' },
    { label: 'Regular',    color: '#f97316' },
    { label: 'Fuerte',     color: '#22c55e' },
    { label: 'Muy fuerte', color: '#16a34a' },
  ]
  const si = strengthInfo[strength]

  async function handleSubmit(e) {
    e.preventDefault()
    if (!allOk || !match) return
    setLoading(true)
    setError('')

    const { data: updateData, error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError('Error al guardar: ' + updateError.message)
      setLoading(false)
      return
    }

    if (!updateData?.user) {
      setError('No se pudo confirmar el cambio. Intenta de nuevo.')
      setLoading(false)
      return
    }

    setExito(true)
    setTimeout(() => {
      if (onComplete) onComplete()
    }, 1800)
  }

  // ── Éxito ────────────────────────────────────────────────────────────────
  if (exito) {
    return (
      <div style={s.page}>
        <div style={{ ...s.card, textAlign: 'center' }}>
          <div style={s.successCircle}>✓</div>
          <h2 style={s.heading}>¡Contraseña establecida!</h2>
          <p style={s.subtext}>Ingresando al sistema…</p>
        </div>
      </div>
    )
  }

  // ── Formulario ───────────────────────────────────────────────────────────
  return (
    <div style={s.page}>

      {/* Decoración fondo */}
      <div style={s.bgCircle1} />
      <div style={s.bgCircle2} />

      <div style={s.card}>

        {/* Logo / título */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={s.logoIcon}>🏫</div>
          <h1 style={s.heading}>Establece tu contraseña</h1>
          <p style={s.subtext}>
            {usuario?.nombre ? `Hola ${usuario.nombre}, crea` : 'Crea'} una contraseña segura para acceder al sistema de inventario escolar.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* ── Campo contraseña ── */}
          <div>
            <label style={s.label}>Nueva contraseña</label>
            <div style={s.inputWrap}>
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Escribe tu contraseña"
                style={s.input}
                autoComplete="new-password"
              />
              <button type="button" onClick={() => setShowPass(!showPass)} style={s.eyeBtn}>
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>

            {/* Barra de fortaleza */}
            {password.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={s.strengthBar}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      style={{
                        ...s.strengthSegment,
                        backgroundColor: i <= strength ? si?.color : 'rgba(255,255,255,0.15)',
                        transition: 'background-color 0.25s',
                      }}
                    />
                  ))}
                </div>
                {si && (
                  <p style={{ fontSize: 12, color: si.color, margin: '4px 0 0', fontWeight: 700 }}>
                    {si.label}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── Requisitos ── */}
          <div style={s.requisitosBox}>
            <p style={s.requisitosTitle}>Requisitos de seguridad</p>
            {checks.map((c) => (
              <div key={c.id} style={s.requisitoRow}>
                <span style={{
                  ...s.checkIcon,
                  backgroundColor: c.ok ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.08)',
                  color: c.ok ? '#4ade80' : 'rgba(255,255,255,0.35)',
                }}>
                  {c.ok ? '✓' : '○'}
                </span>
                <span style={{ fontSize: 13, color: c.ok ? '#f0f9ff' : 'rgba(255,255,255,0.5)' }}>
                  {c.label}
                </span>
              </div>
            ))}
          </div>

          {/* ── Confirmar contraseña ── */}
          <div>
            <label style={s.label}>Confirmar contraseña</label>
            <div style={s.inputWrap}>
              <input
                type={showConf ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repite tu contraseña"
                style={{
                  ...s.input,
                  borderColor: confirm.length > 0
                    ? (match ? '#22c55e' : '#ef4444')
                    : 'rgba(255,255,255,0.2)',
                  boxShadow: confirm.length > 0
                    ? (match ? '0 0 0 3px rgba(34,197,94,0.2)' : '0 0 0 3px rgba(239,68,68,0.2)')
                    : undefined,
                }}
                autoComplete="new-password"
              />
              <button type="button" onClick={() => setShowConf(!showConf)} style={s.eyeBtn}>
                {showConf ? '🙈' : '👁️'}
              </button>
            </div>
            {confirm.length > 0 && (
              <p style={{ fontSize: 12, margin: '4px 0 0', color: match ? '#4ade80' : '#ef4444', fontWeight: 600 }}>
                {match ? 'Las contraseñas coinciden ✓' : 'Las contraseñas no coinciden'}
              </p>
            )}
          </div>

          {/* ── Error ── */}
          {error && (
            <div style={s.errorBox}>⚠️ {error}</div>
          )}

          {/* ── Botón submit ── */}
          <button
            type="submit"
            disabled={!allOk || !match || loading}
            style={{
              ...s.submitBtn,
              opacity: !allOk || !match || loading ? 0.5 : 1,
              cursor: !allOk || !match || loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Guardando…' : 'Establecer contraseña'}
          </button>

        </form>
      </div>
    </div>
  )
}

// ── Estilos ───────────────────────────────────────────────────────────────
const s = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0d1b5e 0%, #1a3a8f 50%, #2563eb 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
    fontFamily: '"Segoe UI", system-ui, sans-serif',
    position: 'relative',
    overflow: 'hidden',
  },
  bgCircle1: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: '50%',
    background: 'rgba(212,160,23,0.07)',
    top: -100,
    right: -100,
    pointerEvents: 'none',
  },
  bgCircle2: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.04)',
    bottom: -80,
    left: -80,
    pointerEvents: 'none',
  },
  card: {
    backgroundColor: 'rgba(13, 27, 94, 0.55)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderRadius: 20,
    padding: '36px 32px',
    width: '100%',
    maxWidth: 420,
    border: '1.5px solid rgba(255,255,255,0.18)',
    boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
    position: 'relative',
    zIndex: 1,
  },
  logoIcon: {
    fontSize: 44,
    marginBottom: 12,
    lineHeight: 1,
  },
  heading: {
    fontSize: 20,
    fontWeight: 700,
    color: '#ffffff',
    margin: '0 0 6px',
  },
  subtext: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    margin: 0,
    lineHeight: 1.5,
  },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 6,
  },
  inputWrap: {
    position: 'relative',
  },
  input: {
    width: '100%',
    padding: '9px 38px 9px 11px',
    border: '1.5px solid rgba(255,255,255,0.2)',
    borderRadius: 9,
    fontSize: 13,
    color: '#ffffff',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    background: 'rgba(255,255,255,0.1)',
    fontFamily: 'inherit',
  },
  eyeBtn: {
    position: 'absolute',
    right: 10,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 15,
    padding: 0,
    lineHeight: 1,
    color: 'rgba(255,255,255,0.5)',
  },
  strengthBar: {
    display: 'flex',
    gap: 4,
    height: 5,
    borderRadius: 3,
  },
  strengthSegment: {
    flex: 1,
    height: '100%',
    borderRadius: 3,
  },
  requisitosBox: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 7,
  },
  requisitosTitle: {
    fontSize: 10,
    fontWeight: 800,
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    margin: '0 0 2px',
  },
  requisitoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  checkIcon: {
    width: 20,
    height: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    fontSize: 11,
    fontWeight: 700,
    flexShrink: 0,
    transition: 'all 0.2s',
  },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    border: '1px solid rgba(239,68,68,0.4)',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 13,
    color: '#fca5a5',
  },
  submitBtn: {
    width: '100%',
    padding: '10px',
    background: 'linear-gradient(135deg, #c49012, #e6b820)',
    color: '#0d1b5e',
    border: 'none',
    borderRadius: 9,
    fontSize: 14,
    fontWeight: 700,
    transition: 'opacity 0.15s, box-shadow 0.15s',
    boxShadow: '0 3px 12px rgba(212,160,23,0.35)',
    fontFamily: 'inherit',
  },
  successCircle: {
    width: 60,
    height: 60,
    backgroundColor: 'rgba(212,160,23,0.2)',
    border: '2px solid #d4a017',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 26,
    color: '#f0c830',
    margin: '0 auto 20px',
  },
}