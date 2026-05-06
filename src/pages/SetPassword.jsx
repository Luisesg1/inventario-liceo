// src/pages/SetPassword.jsx
// Se muestra cuando el usuario llega desde el enlace de invitación de Supabase.
// Permite establecer una contraseña con validación en tiempo real de requisitos de seguridad.

import { useState } from 'react'
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
    { label: 'Débil',      color: '#f97316' },
    { label: 'Regular',    color: '#eab308' },
    { label: 'Fuerte',     color: '#16a34a' },
    { label: 'Muy fuerte', color: '#15803d' },
  ]
  const si = strengthInfo[strength]

  async function handleSubmit(e) {
    e.preventDefault()
    if (!allOk || !match) return
    setLoading(true)
    setError('')

    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(updateError.message)
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
      <div style={s.card}>

        {/* Logo / título */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={s.logoIcon}>🏫</div>
          <h1 style={s.heading}>Establece tu contraseña</h1>
          <p style={s.subtext}>
            Crea una contraseña segura para acceder al sistema de inventario escolar.
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
                        backgroundColor: i <= strength ? si?.color : '#e5e7eb',
                        transition: 'background-color 0.25s',
                      }}
                    />
                  ))}
                </div>
                {si && (
                  <p style={{ fontSize: 12, color: si.color, margin: '4px 0 0', fontWeight: 600 }}>
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
                  backgroundColor: c.ok ? '#dcfce7' : '#f3f4f6',
                  color: c.ok ? '#15803d' : '#9ca3af',
                }}>
                  {c.ok ? '✓' : '○'}
                </span>
                <span style={{ fontSize: 13, color: c.ok ? '#111827' : '#6b7280' }}>
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
                  borderColor: confirm.length > 0 ? (match ? '#16a34a' : '#dc2626') : '#d1d5db',
                  boxShadow: confirm.length > 0 ? (match ? '0 0 0 3px rgba(22,163,74,0.12)' : '0 0 0 3px rgba(220,38,38,0.12)') : undefined,
                }}
                autoComplete="new-password"
              />
              <button type="button" onClick={() => setShowConf(!showConf)} style={s.eyeBtn}>
                {showConf ? '🙈' : '👁️'}
              </button>
            </div>
            {confirm.length > 0 && (
              <p style={{ fontSize: 12, margin: '4px 0 0', color: match ? '#16a34a' : '#dc2626', fontWeight: 500 }}>
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

// ── Estilos (modo claro, coherente con Usuarios.css) ──────────────────────
const s = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#f9fafb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
    fontFamily: '"Segoe UI", system-ui, sans-serif',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: '36px 32px',
    width: '100%',
    maxWidth: 420,
    border: '1px solid #e5e7eb',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
  },
  logoIcon: {
    fontSize: 40,
    marginBottom: 12,
    lineHeight: 1,
  },
  heading: {
    fontSize: 20,
    fontWeight: 700,
    color: '#111827',
    margin: '0 0 6px',
  },
  subtext: {
    fontSize: 13,
    color: '#6b7280',
    margin: 0,
    lineHeight: 1.5,
  },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 500,
    color: '#374151',
    marginBottom: 6,
  },
  inputWrap: {
    position: 'relative',
  },
  input: {
    width: '100%',
    padding: '9px 38px 9px 11px',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    fontSize: 14,
    color: '#111827',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    background: '#fff',
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
    color: '#9ca3af',
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
    backgroundColor: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 7,
  },
  requisitosTitle: {
    fontSize: 10,
    fontWeight: 800,
    color: '#9ca3af',
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
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 13,
    color: '#dc2626',
  },
  submitBtn: {
    width: '100%',
    padding: '10px',
    backgroundColor: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    transition: 'opacity 0.15s, background 0.15s',
  },
  successCircle: {
    width: 60,
    height: 60,
    backgroundColor: '#dcfce7',
    border: '2px solid #16a34a',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 26,
    color: '#16a34a',
    margin: '0 auto 20px',
  },
}