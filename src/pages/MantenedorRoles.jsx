// src/pages/MantenedorRoles.jsx
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'
// Catálogo centralizado de permisos (fuente única de verdad, compartido con Usuarios.jsx)
import { ACCIONES, GRUPOS_ROLES as GRUPOS, PERMISOS_VACIO, PERMISOS_OBLIGATORIOS, OBLIGATORIOS_TRUE } from '../config/permisos'
import { ROLES_BASE, ROL_LABEL, ROL_COLORES } from '../config/roles'
import { useEsMovil } from '../hooks/useEsMovil'

// Claves de los módulos obligatorios (Mis Ausencias, Tickets, Reglamentos):
// se fuerzan en true y se bloquean en la UI para que ningún rol quede sin ellos.
const OBLIGATORIOS_SET = new Set(PERMISOS_OBLIGATORIOS)
const esObligatorio = (key) => OBLIGATORIOS_SET.has(key)

// ── Toggle premium ─────────────────────────────────────────────────────────
function Toggle({ activo, onChange, disabled }) {
  const w = 44, h = 24, d = 18
  return (
    <div
      role="switch"
      aria-checked={activo}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      onClick={disabled ? undefined : onChange}
      onKeyDown={disabled ? undefined : e => {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onChange() }
      }}
      style={{
        width: w, height: h, borderRadius: h / 2,
        background: activo ? 'rgb(var(--primary-rgb))' : '#cbd5e1',
        position: 'relative', flexShrink: 0,
        transition: 'background 0.22s cubic-bezier(0.4,0,0.2,1)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        boxShadow: activo ? '0 0 0 3px rgba(var(--primary-rgb),0.18)' : 'none',
      }}
    >
      <span style={{
        position: 'absolute',
        top: (h - d) / 2,
        left: activo ? w - d - (h - d) / 2 : (h - d) / 2,
        width: d, height: d, borderRadius: '50%',
        background: '#fff',
        transition: 'left 0.22s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.22)',
      }} />
    </div>
  )
}

// ── Avatar de rol ──────────────────────────────────────────────────────────
function RolAvatar({ rol, size = 34 }) {
  const c = ROL_COLORES[rol] ?? { bg: '#f1f5f9', color: '#64748b' }
  const label = ROL_LABEL[rol] ?? rol
  return (
    <div style={{
      width: size, height: size, borderRadius: 9,
      background: c.bg, color: c.color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 800, flexShrink: 0,
      letterSpacing: '-0.5px',
    }}>
      {label.charAt(0).toUpperCase()}
    </div>
  )
}

export default function MantenedorRoles() {
  const esMovil = useEsMovil()
  const [roles,          setRoles]          = useState([])
  const [conteos,        setConteos]        = useState({})
  const [rolSeleccionado, setRolSeleccionado] = useState(null)
  const [draft,          setDraft]          = useState(null)
  const [savedDraft,     setSavedDraft]     = useState(null)
  const [guardando,      setGuardando]      = useState(false)
  const [mensaje,        setMensaje]        = useState({ tipo: '', texto: '' })
  const [confirmar,      setConfirmar]      = useState(false)
  const [modalNuevoRol,  setModalNuevoRol]  = useState(false)
  const [modalEliminar,  setModalEliminar]  = useState(false)
  const [gruposAbiertos, setGruposAbiertos] = useState(() =>
    Object.fromEntries(GRUPOS.map(g => [g.key, true]))
  )
  const [cargando, setCargando] = useState(true)
  const [hoverRol, setHoverRol] = useState(null)

  const hayaCambios = useMemo(() => {
    if (!draft || !savedDraft) return false
    return JSON.stringify(draft) !== JSON.stringify(savedDraft)
  }, [draft, savedDraft])

  useEffect(() => { cargarTodo() }, [])

  async function cargarTodo() {
    setCargando(true)
    const [{ data: rData }, { data: uData }] = await Promise.all([
      supabase.from('permisos_rol').select('*'),
      supabase.from('usuarios').select('rol'),
    ])

    const dbRoles = rData ?? []
    const dbRoleKeys = new Set(dbRoles.map(r => r.rol))

    const baseOrdenados = ROLES_BASE.map(r =>
      dbRoles.find(d => d.rol === r) ?? { rol: r, permisos: { ...PERMISOS_VACIO }, descripcion: '' }
    )
    const customRoles = dbRoles.filter(r => !ROLES_BASE.includes(r.rol))

    const listaRoles = [...baseOrdenados, ...customRoles]
    setRoles(listaRoles)

    const cnt = {}
    ;(uData ?? []).forEach(u => { cnt[u.rol] = (cnt[u.rol] ?? 0) + 1 })
    setConteos(cnt)

    if (listaRoles.length > 0 && !rolSeleccionado) {
      seleccionarRol(listaRoles[0])
    }
    setCargando(false)
  }

  function seleccionarRol(rol) {
    setRolSeleccionado(rol)
    // Los módulos obligatorios siempre se muestran activos.
    const d = { permisos: { ...PERMISOS_VACIO, ...(rol.permisos ?? {}), ...OBLIGATORIOS_TRUE }, descripcion: rol.descripcion ?? '' }
    setDraft(d)
    setSavedDraft(d)
    setMensaje({ tipo: '', texto: '' })
    setConfirmar(false)
  }

  function togglePermiso(key) {
    if (esObligatorio(key)) return // módulo obligatorio: no se puede desactivar
    setDraft(prev => ({
      ...prev,
      permisos: { ...prev.permisos, [key]: !prev.permisos[key] },
    }))
  }

  function toggleGrupo(grupoKey) {
    setGruposAbiertos(prev => ({ ...prev, [grupoKey]: !prev[grupoKey] }))
  }

  function activarTodosGrupo(grupoKey, valor) {
    const grupo = GRUPOS.find(g => g.key === grupoKey)
    if (!grupo) return
    // Los obligatorios permanecen en true aunque se "desactive todo" el grupo.
    const updates = Object.fromEntries(grupo.permisos.map(k => [k, esObligatorio(k) ? true : valor]))
    setDraft(prev => ({ ...prev, permisos: { ...prev.permisos, ...updates } }))
  }

  async function guardar() {
    setGuardando(true)
    setMensaje({ tipo: '', texto: '' })

    const { error } = await supabase
      .from('permisos_rol')
      .upsert({
        rol: rolSeleccionado.rol,
        permisos: { ...draft.permisos, ...OBLIGATORIOS_TRUE }, // garantiza obligatorios en BD
        descripcion: draft.descripcion,
      }, { onConflict: 'rol' })

    setGuardando(false)
    setConfirmar(false)

    if (error) {
      setMensaje({ tipo: 'error', texto: 'Error al guardar: ' + error.message })
    } else {
      const actualizado = { ...rolSeleccionado, permisos: { ...draft.permisos, ...OBLIGATORIOS_TRUE }, descripcion: draft.descripcion }
      setSavedDraft(draft)
      setRoles(prev => prev.map(r => r.rol === rolSeleccionado.rol ? actualizado : r))
      setRolSeleccionado(actualizado)
      setMensaje({ tipo: 'exito', texto: '¡Permisos del rol guardados! Los usuarios heredarán estos permisos.' })
      setTimeout(() => setMensaje({ tipo: '', texto: '' }), 3500)
    }
  }

  async function restaurarDefecto() {
    // "Todo desactivado" conserva los módulos obligatorios activos.
    const defecto = { ...PERMISOS_VACIO, ...OBLIGATORIOS_TRUE }
    setDraft(prev => ({ ...prev, permisos: defecto }))
    setMensaje({ tipo: 'info', texto: 'Permisos restablecidos. Haz clic en «Guardar» para aplicar.' })
    setTimeout(() => setMensaje({ tipo: '', texto: '' }), 3000)
  }

  async function duplicarRol() {
    if (!rolSeleccionado) return
    const nuevoRol = rolSeleccionado.rol + '_copia'
    const { error } = await supabase.from('permisos_rol').insert({
      rol: nuevoRol,
      permisos: { ...draft.permisos, ...OBLIGATORIOS_TRUE },
      descripcion: `Copia de ${rolSeleccionado.descripcion || rolSeleccionado.rol}`,
    })
    if (error) {
      setMensaje({ tipo: 'error', texto: 'Error: ' + error.message })
    } else {
      setMensaje({ tipo: 'exito', texto: `Rol duplicado como «${nuevoRol}». Puedes renombrarlo.` })
      setTimeout(() => setMensaje({ tipo: '', texto: '' }), 3000)
      await cargarTodo()
    }
  }

  async function eliminarRol() {
    if (!rolSeleccionado) return
    const cant = conteos[rolSeleccionado.rol] ?? 0
    if (cant > 0) return
    const { error } = await supabase.from('permisos_rol').delete().eq('rol', rolSeleccionado.rol)
    setModalEliminar(false)
    if (error) {
      setMensaje({ tipo: 'error', texto: 'Error: ' + error.message })
    } else {
      const nuevos = roles.filter(r => r.rol !== rolSeleccionado.rol)
      setRoles(nuevos)
      if (nuevos.length > 0) seleccionarRol(nuevos[0])
      else { setRolSeleccionado(null); setDraft(null); setSavedDraft(null) }
    }
  }

  const puedeEliminar = rolSeleccionado && !ROLES_BASE.includes(rolSeleccionado.rol) && (conteos[rolSeleccionado.rol] ?? 0) === 0

  function contarActivos(grupoKey) {
    const grupo = GRUPOS.find(g => g.key === grupoKey)
    if (!grupo || !draft) return { activos: 0, total: grupo?.permisos?.length ?? 0 }
    const activos = grupo.permisos.filter(k => draft.permisos[k]).length
    return { activos, total: grupo.permisos.length }
  }

  // ── Spinner de carga ──────────────────────────────────────────────────────
  if (cargando) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#f1f5f9' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 32, height: 32,
          border: '3px solid #e2e8f0',
          borderTopColor: 'rgb(var(--primary-rgb))',
          borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
          margin: '0 auto 12px',
        }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>Cargando roles…</p>
      </div>
    </div>
  )

  // En móvil funciona como maestro-detalle: se ve la lista de roles y, al elegir
  // uno, el panel de detalle a pantalla completa (con botón para volver).
  const mostrarLista   = !esMovil || !rolSeleccionado
  const mostrarDetalle = !esMovil || !!rolSeleccionado

  return (
    <div style={{ display: 'flex', gap: 0, height: '100%', background: '#f1f5f9', minHeight: 0, overflow: 'hidden' }}>

      {/* ─────────────────────── Panel izquierdo ─────────────────────────── */}
      <div style={{
        width: esMovil ? '100%' : 268, flexShrink: 0,
        display: mostrarLista ? 'flex' : 'none',
        background: '#fff',
        borderRight: esMovil ? 'none' : '1px solid #e2e8f0',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header del panel */}
        <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 7,
              background: 'rgba(var(--primary-rgb),0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14,
            }}>
              🔑
            </div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.2px' }}>
              Roles del sistema
            </p>
          </div>
          <p style={{ margin: '4px 0 0 36px', fontSize: 11.5, color: '#94a3b8', fontWeight: 500 }}>
            {roles.length} roles configurados
          </p>
        </div>

        {/* Lista de roles */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
          {roles.map(r => {
            const sel = rolSeleccionado?.rol === r.rol
            const cant = conteos[r.rol] ?? 0
            const hover = hoverRol === r.rol && !sel
            return (
              <div
                key={r.rol}
                onMouseEnter={() => setHoverRol(r.rol)}
                onMouseLeave={() => setHoverRol(null)}
                onClick={() => { if (!sel) seleccionarRol(r) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 9, marginBottom: 2,
                  cursor: sel ? 'default' : 'pointer',
                  userSelect: 'none',
                  background: sel
                    ? 'rgba(var(--primary-rgb),0.08)'
                    : hover ? '#f8fafc' : 'transparent',
                  border: sel
                    ? '1px solid rgba(var(--primary-rgb),0.15)'
                    : '1px solid transparent',
                  transition: 'all 0.14s',
                  position: 'relative',
                }}
              >
                {/* Barra lateral seleccionado */}
                {sel && (
                  <div style={{
                    position: 'absolute', left: 0, top: '20%', bottom: '20%',
                    width: 3, borderRadius: '0 2px 2px 0',
                    background: 'rgb(var(--primary-rgb))',
                  }} />
                )}

                <RolAvatar rol={r.rol} size={32} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    margin: 0, fontSize: 12.5, fontWeight: sel ? 700 : 600,
                    color: sel ? 'rgb(var(--primary-rgb))' : '#1e293b',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {ROL_LABEL[r.rol] ?? r.rol}
                  </p>
                </div>

                {/* Badge de usuarios */}
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  padding: '2px 7px', borderRadius: 99,
                  background: sel ? 'rgba(var(--primary-rgb),0.12)' : '#f1f5f9',
                  color: sel ? 'rgb(var(--primary-rgb))' : '#64748b',
                  flexShrink: 0,
                  minWidth: 22, textAlign: 'center',
                }}>
                  {cant}
                </span>
              </div>
            )
          })}
        </div>

        {/* Botón crear rol */}
        <div style={{ padding: '8px 8px 12px' }}>
          <button
            onClick={() => setModalNuevoRol(true)}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(var(--primary-rgb),0.06)'
              e.currentTarget.style.borderColor = 'rgba(var(--primary-rgb),0.4)'
              e.currentTarget.style.color = 'rgb(var(--primary-rgb))'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#fafafa'
              e.currentTarget.style.borderColor = '#e2e8f0'
              e.currentTarget.style.color = '#64748b'
            }}
            style={{
              width: '100%', padding: '9px 12px',
              border: '1.5px dashed #e2e8f0', borderRadius: 9,
              background: '#fafafa', cursor: 'pointer',
              color: '#64748b', fontSize: 12.5, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: 15, lineHeight: 1 }}>+</span>
            Crear nuevo rol
          </button>
        </div>
      </div>

      {/* ─────────────────────── Panel derecho ───────────────────────────── */}
      <div style={{ flex: 1, display: mostrarDetalle ? 'flex' : 'none', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {!rolSeleccionado ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🔑</div>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: 14, fontWeight: 500 }}>
                Selecciona un rol para configurarlo
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* ── Cabecera del rol ── */}
            <div style={{
              padding: esMovil ? '12px 16px' : '16px 24px',
              background: '#fff',
              borderBottom: '1px solid #e2e8f0',
            }}>
              {/* Volver a la lista (solo móvil) */}
              {esMovil && (
                <button
                  onClick={() => { setRolSeleccionado(null); setDraft(null); setSavedDraft(null) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12,
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    color: 'rgb(var(--primary-rgb))', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                  }}
                >
                  ← Roles
                </button>
              )}
              {/* Fila superior: info + acciones */}
              <div style={{ display: 'flex', alignItems: esMovil ? 'flex-start' : 'center', gap: esMovil ? 10 : 16, marginBottom: 12, flexWrap: esMovil ? 'wrap' : 'nowrap' }}>
                {/* Info del rol */}
                <RolAvatar rol={rolSeleccionado.rol} size={40} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <h2 style={{
                      margin: 0, fontSize: 16, fontWeight: 800,
                      color: '#0f172a', letterSpacing: '-0.3px',
                    }}>
                      {ROL_LABEL[rolSeleccionado.rol] ?? rolSeleccionado.rol}
                    </h2>

                    {/* Pill tipo de rol */}
                    {ROLES_BASE.includes(rolSeleccionado.rol) ? (
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 99,
                        background: '#f1f5f9', color: '#64748b',
                        border: '1px solid #e2e8f0',
                      }}>
                        Base del sistema
                      </span>
                    ) : (
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 99,
                        background: '#fef3c7', color: '#92400e',
                        border: '1px solid #fde68a',
                      }}>
                        Rol personalizado
                      </span>
                    )}

                    {/* Pill usuarios */}
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 99,
                      background: ROL_COLORES[rolSeleccionado.rol]?.bg ?? '#f1f5f9',
                      color: ROL_COLORES[rolSeleccionado.rol]?.color ?? '#64748b',
                      border: `1px solid ${ROL_COLORES[rolSeleccionado.rol]?.bg ?? '#e2e8f0'}`,
                    }}>
                      {conteos[rolSeleccionado.rol] ?? 0} {(conteos[rolSeleccionado.rol] ?? 0) === 1 ? 'usuario' : 'usuarios'}
                    </span>
                  </div>
                </div>

                {/* Botones de acción */}
                <div style={{ display: 'flex', gap: 7, flexShrink: 0, alignItems: 'center', flexWrap: 'wrap', ...(esMovil ? { width: '100%' } : null) }}>
                  {/* Restaurar */}
                  <ActionButton
                    onClick={restaurarDefecto}
                    icon="↺"
                    label="Restaurar"
                    variant="ghost"
                  />

                  {/* Duplicar */}
                  <ActionButton
                    onClick={duplicarRol}
                    icon="⎘"
                    label="Duplicar"
                    variant="ghost"
                  />

                  {/* Eliminar */}
                  {puedeEliminar && (
                    <ActionButton
                      onClick={() => setModalEliminar(true)}
                      icon="✕"
                      label="Eliminar"
                      variant="danger"
                    />
                  )}

                  {/* Guardar */}
                  <button
                    onClick={() => setConfirmar(true)}
                    disabled={!hayaCambios || guardando}
                    style={{
                      height: 34, padding: '0 16px',
                      borderRadius: 8, fontSize: 12.5, fontWeight: 700,
                      cursor: hayaCambios && !guardando ? 'pointer' : 'default',
                      border: 'none',
                      background: hayaCambios ? 'rgb(var(--primary-rgb))' : '#e2e8f0',
                      color: hayaCambios ? '#fff' : '#94a3b8',
                      boxShadow: hayaCambios ? '0 1px 3px rgba(var(--primary-rgb),0.3), 0 0 0 3px rgba(var(--primary-rgb),0.12)' : 'none',
                      transition: 'all 0.15s',
                      display: 'flex', alignItems: 'center', gap: 6,
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={e => {
                      if (hayaCambios) e.currentTarget.style.boxShadow = '0 2px 6px rgba(var(--primary-rgb),0.35), 0 0 0 3px rgba(var(--primary-rgb),0.18)'
                    }}
                    onMouseLeave={e => {
                      if (hayaCambios) e.currentTarget.style.boxShadow = '0 1px 3px rgba(var(--primary-rgb),0.3), 0 0 0 3px rgba(var(--primary-rgb),0.12)'
                    }}
                  >
                    {guardando ? (
                      <>
                        <span style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                        Guardando…
                      </>
                    ) : hayaCambios ? (
                      <><span>✓</span> Guardar cambios</>
                    ) : (
                      <><span style={{ fontSize: 11 }}>—</span> Sin cambios</>
                    )}
                  </button>
                </div>
              </div>

              {/* Campo descripción */}
              <input
                value={draft?.descripcion ?? ''}
                onChange={e => setDraft(prev => ({ ...prev, descripcion: e.target.value }))}
                placeholder="Descripción del rol (opcional)…"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  border: '1.5px solid #e2e8f0', borderRadius: 8,
                  padding: '7px 12px', fontSize: 12.5, color: '#374151',
                  outline: 'none', background: '#f8fafc',
                  maxWidth: 520, transition: 'border-color 0.15s',
                  fontFamily: 'inherit',
                }}
                onFocus={e => {
                  e.target.style.borderColor = 'rgba(var(--primary-rgb),0.5)'
                  e.target.style.background = '#fff'
                }}
                onBlur={e => {
                  e.target.style.borderColor = '#e2e8f0'
                  e.target.style.background = '#f8fafc'
                }}
              />
            </div>

            {/* ── Banners de feedback ── */}
            {mensaje.texto && (
              <div style={{
                margin: '12px 24px 0',
                padding: '10px 14px', borderRadius: 9, fontSize: 12.5, fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: 8,
                ...(mensaje.tipo === 'exito'
                  ? { background: '#f0fdf4', border: '1px solid #86efac', color: '#15803d' }
                  : mensaje.tipo === 'error'
                  ? { background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626' }
                  : { background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8' }),
              }}>
                <span>{mensaje.tipo === 'exito' ? '✓' : mensaje.tipo === 'error' ? '✕' : 'ℹ'}</span>
                {mensaje.texto}
              </div>
            )}

            {hayaCambios && (
              <div style={{
                margin: '10px 24px 0', padding: '9px 14px', borderRadius: 9,
                background: '#fffbeb', border: '1px solid #fde68a',
                fontSize: 12, color: '#92400e', fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: 7,
              }}>
                <span>⚠️</span>
                Los cambios afectarán automáticamente a todos los usuarios con este rol al guardar.
              </div>
            )}

            {/* ── Matriz de permisos ── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: esMovil ? '14px 14px 24px' : '16px 24px 24px' }}>
              <style>{`
                .permiso-row:hover { background: rgba(var(--primary-rgb),0.03) !important; }
                .grupo-toggle-btn:hover { opacity: 0.85; }
                ::-webkit-scrollbar { width: 5px; height: 5px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 99px; }
                ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
              `}</style>

              {GRUPOS.map(grupo => {
                const { activos, total } = contarActivos(grupo.key)
                const abierto = gruposAbiertos[grupo.key]
                const todosActivos = activos === total
                const algunoActivo = activos > 0

                return (
                  <div key={grupo.key} style={{
                    background: '#fff',
                    borderRadius: 12,
                    border: '1px solid #e2e8f0',
                    marginBottom: 10,
                    overflow: 'hidden',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  }}>
                    {/* Cabecera del grupo */}
                    <div
                      onClick={() => toggleGrupo(grupo.key)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '11px 16px',
                        cursor: 'pointer', userSelect: 'none',
                        background: abierto ? '#fff' : '#fafafa',
                        borderBottom: abierto ? '1px solid #f1f5f9' : 'none',
                        transition: 'background 0.15s',
                      }}
                    >
                      {/* Icono del módulo */}
                      <div style={{
                        width: 30, height: 30, borderRadius: 7, flexShrink: 0,
                        background: algunoActivo ? 'rgba(var(--primary-rgb),0.1)' : '#f1f5f9',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 15,
                        transition: 'background 0.2s',
                      }}>
                        {grupo.icon}
                      </div>

                      {/* Nombre del módulo */}
                      <span style={{
                        fontSize: 13.5, fontWeight: 700,
                        color: '#0f172a', flex: 1,
                        letterSpacing: '-0.2px',
                      }}>
                        {grupo.label}
                      </span>

                      {/* Badge contador */}
                      <span style={{
                        fontSize: 11, fontWeight: 700,
                        padding: '2px 9px', borderRadius: 99,
                        background: algunoActivo ? 'rgba(var(--primary-rgb),0.1)' : '#f1f5f9',
                        color: algunoActivo ? 'rgb(var(--primary-rgb))' : '#94a3b8',
                        marginRight: 6,
                        transition: 'all 0.2s',
                      }}>
                        {activos}/{total}
                      </span>

                      {/* Botón activar todos */}
                      <button
                        className="grupo-toggle-btn"
                        onClick={e => { e.stopPropagation(); activarTodosGrupo(grupo.key, !todosActivos) }}
                        style={{
                          fontSize: 11, fontWeight: 600,
                          padding: '4px 10px', borderRadius: 6,
                          border: '1.5px solid',
                          marginRight: 8, cursor: 'pointer',
                          transition: 'all 0.15s',
                          borderColor: todosActivos ? 'rgba(var(--primary-rgb),0.3)' : '#e2e8f0',
                          background: todosActivos ? 'rgba(var(--primary-rgb),0.08)' : '#fff',
                          color: todosActivos ? 'rgb(var(--primary-rgb))' : '#64748b',
                        }}
                      >
                        {todosActivos ? '✓ Todos' : 'Todos'}
                      </button>

                      {/* Chevron */}
                      <span style={{
                        fontSize: 11, color: '#94a3b8',
                        transform: abierto ? 'rotate(90deg)' : 'none',
                        transition: 'transform 0.2s cubic-bezier(0.4,0,0.2,1)',
                        display: 'inline-block',
                      }}>
                        ▶
                      </span>
                    </div>

                    {/* Filas de permisos */}
                    {abierto && (
                      <div>
                        {ACCIONES.filter(a => grupo.permisos.includes(a.key)).map((a, idx) => {
                          const obligatorio = esObligatorio(a.key)
                          const activo = obligatorio || (draft?.permisos?.[a.key] ?? false)
                          const permsEnGrupo = ACCIONES.filter(x => grupo.permisos.includes(x.key))
                          const esUltimo = idx === permsEnGrupo.length - 1
                          return (
                            <div
                              key={a.key}
                              className="permiso-row"
                              style={{
                                display: 'flex', alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '11px 16px',
                                cursor: 'default', userSelect: 'none',
                                background: activo ? 'rgba(var(--primary-rgb),0.025)' : '#fff',
                                borderBottom: esUltimo ? 'none' : '1px solid #f8fafc',
                                transition: 'background 0.12s',
                                gap: 12,
                              }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{
                                  margin: 0, fontSize: 13, fontWeight: 600,
                                  color: activo ? '#0f172a' : '#334155',
                                  lineHeight: 1.3,
                                  display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap',
                                }}>
                                  {a.label}
                                  {obligatorio && (
                                    <span style={{
                                      fontSize: 9.5, fontWeight: 700, letterSpacing: '0.4px',
                                      textTransform: 'uppercase', color: 'rgb(var(--primary-rgb))',
                                      background: 'rgba(var(--primary-rgb),0.1)',
                                      borderRadius: 5, padding: '2px 6px', lineHeight: 1.2,
                                    }}>
                                      🔒 Obligatorio
                                    </span>
                                  )}
                                </p>
                                {a.desc && (
                                  <p style={{
                                    margin: '2px 0 0', fontSize: 11.5,
                                    color: '#94a3b8', lineHeight: 1.4,
                                    fontWeight: 400,
                                  }}>
                                    {a.desc}
                                  </p>
                                )}
                              </div>
                              <Toggle activo={activo} disabled={obligatorio} onChange={() => togglePermiso(a.key)} />
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Modal confirmación guardar ── */}
      {confirmar && (
        <Modal onClose={() => setConfirmar(false)}>
          <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 9,
              background: 'rgba(var(--primary-rgb),0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, flexShrink: 0,
            }}>
              ✓
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 15, color: '#0f172a' }}>
                ¿Confirmar cambios?
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>
                {ROL_LABEL[rolSeleccionado?.rol] ?? rolSeleccionado?.rol}
              </p>
            </div>
          </div>

          <p style={{ margin: '14px 0 10px', fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
            Los cambios afectarán automáticamente a todos los usuarios que utilizan este rol.
          </p>

          <div style={{
            background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8,
            padding: '9px 13px', marginBottom: 20, fontSize: 12.5, color: '#92400e',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span>⚠️</span>
            <span><strong>{conteos[rolSeleccionado?.rol] ?? 0}</strong> usuario(s) serán afectados al guardar.</span>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={() => setConfirmar(false)}
              style={modalBtnSecondary}
            >
              Cancelar
            </button>
            <button
              onClick={guardar}
              disabled={guardando}
              style={modalBtnPrimary}
            >
              {guardando ? 'Guardando…' : 'Confirmar y guardar'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Modal eliminar rol ── */}
      {modalEliminar && (
        <Modal onClose={() => setModalEliminar(false)}>
          <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 9,
              background: '#fef2f2',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, flexShrink: 0,
            }}>
              🗑
            </div>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 15, color: '#0f172a' }}>
              Eliminar rol
            </p>
          </div>

          <p style={{ margin: '14px 0 20px', fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
            ¿Estás seguro de que deseas eliminar el rol{' '}
            <strong style={{ color: '#0f172a' }}>{ROL_LABEL[rolSeleccionado?.rol] ?? rolSeleccionado?.rol}</strong>?
            Esta acción no se puede deshacer.
          </p>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setModalEliminar(false)} style={modalBtnSecondary}>
              Cancelar
            </button>
            <button
              onClick={eliminarRol}
              style={{ ...modalBtnPrimary, background: '#dc2626', boxShadow: 'none' }}
            >
              Sí, eliminar
            </button>
          </div>
        </Modal>
      )}

      {/* ── Modal crear nuevo rol ── */}
      {modalNuevoRol && (
        <ModalNuevoRol
          onCerrar={() => setModalNuevoRol(false)}
          onCreado={async () => { setModalNuevoRol(false); await cargarTodo() }}
          rolesExistentes={roles.map(r => r.rol)}
        />
      )}
    </div>
  )
}

// ── Botón de acción reutilizable ───────────────────────────────────────────
function ActionButton({ onClick, icon, label, variant = 'ghost' }) {
  const [hover, setHover] = useState(false)
  const isDanger = variant === 'danger'
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: 34, padding: '0 13px',
        borderRadius: 8, fontSize: 12.5, fontWeight: 600,
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 5,
        transition: 'all 0.14s',
        border: isDanger
          ? `1.5px solid ${hover ? '#fca5a5' : '#fee2e2'}`
          : `1.5px solid ${hover ? '#cbd5e1' : '#e2e8f0'}`,
        background: isDanger
          ? hover ? '#fef2f2' : '#fff7f7'
          : hover ? '#f8fafc' : '#fff',
        color: isDanger
          ? '#dc2626'
          : hover ? '#374151' : '#64748b',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontSize: 14, lineHeight: 1 }}>{icon}</span>
      {label}
    </button>
  )
}

// ── Wrapper de modal ───────────────────────────────────────────────────────
function Modal({ onClose, children }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(15,23,42,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, backdropFilter: 'blur(2px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff', borderRadius: 14,
          padding: '22px 24px', maxWidth: 440, width: '90%',
          boxShadow: '0 24px 60px rgba(0,0,0,0.18)',
          border: '1px solid #e2e8f0',
        }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

const modalBtnSecondary = {
  padding: '8px 18px', height: 36, borderRadius: 8,
  fontSize: 13, fontWeight: 600, cursor: 'pointer',
  border: '1.5px solid #e2e8f0', background: '#fff', color: '#374151',
}

const modalBtnPrimary = {
  padding: '8px 20px', height: 36, borderRadius: 8,
  fontSize: 13, fontWeight: 700, cursor: 'pointer',
  border: 'none', background: 'rgb(var(--primary-rgb))', color: '#fff',
  boxShadow: '0 1px 3px rgba(var(--primary-rgb),0.3)',
}

// ── Modal crear nuevo rol ──────────────────────────────────────────────────
function ModalNuevoRol({ onCerrar, onCreado, rolesExistentes }) {
  const [nombre,      setNombre]      = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [baseRol,     setBaseRol]     = useState('')
  const [guardando,   setGuardando]   = useState(false)
  const [error,       setError]       = useState('')

  const claveRol = nombre.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
  const yaExiste = rolesExistentes.includes(claveRol)

  async function crear() {
    if (!nombre.trim()) { setError('El nombre del rol es obligatorio.'); return }
    if (yaExiste) { setError('Ya existe un rol con esa clave.'); return }
    setGuardando(true)
    setError('')

    let permisos = { ...PERMISOS_VACIO }
    if (baseRol) {
      const { data } = await supabase.from('permisos_rol').select('permisos').eq('rol', baseRol).maybeSingle()
      if (data?.permisos) permisos = { ...PERMISOS_VACIO, ...data.permisos }
    }
    // Los módulos obligatorios se agregan automáticamente a todo rol nuevo.
    permisos = { ...permisos, ...OBLIGATORIOS_TRUE }

    const { error: err } = await supabase.from('permisos_rol').insert({
      rol: claveRol,
      permisos,
      descripcion: descripcion.trim(),
    })

    setGuardando(false)
    if (err) {
      setError('Error: ' + err.message)
    } else {
      onCreado()
    }
  }

  const inp = {
    width: '100%', boxSizing: 'border-box',
    border: '1.5px solid #e2e8f0', borderRadius: 8,
    padding: '8px 12px', fontSize: 13, outline: 'none',
    color: '#111827', fontFamily: 'inherit',
    transition: 'border-color 0.15s, background 0.15s',
    background: '#f8fafc',
  }

  return (
    <Modal onClose={onCerrar}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 9,
          background: 'rgba(var(--primary-rgb),0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 17, flexShrink: 0,
        }}>
          🔑
        </div>
        <p style={{ margin: 0, fontWeight: 800, fontSize: 15, color: '#0f172a' }}>
          Crear nuevo rol
        </p>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          Nombre del rol *
        </label>
        <input
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          placeholder="Ej: Encargado biblioteca"
          style={inp}
          onFocus={e => { e.target.style.borderColor = 'rgba(var(--primary-rgb),0.5)'; e.target.style.background = '#fff' }}
          onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc' }}
          autoFocus
        />
        {nombre && (
          <p style={{ margin: '4px 0 0', fontSize: 11.5, color: yaExiste ? '#dc2626' : '#94a3b8' }}>
            Clave: <code style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>{claveRol}</code>
            {yaExiste && ' — ya existe'}
          </p>
        )}
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          Descripción <span style={{ fontWeight: 400, color: '#94a3b8', textTransform: 'none' }}>(opcional)</span>
        </label>
        <input
          value={descripcion}
          onChange={e => setDescripcion(e.target.value)}
          placeholder="Describe brevemente este rol…"
          style={inp}
          onFocus={e => { e.target.style.borderColor = 'rgba(var(--primary-rgb),0.5)'; e.target.style.background = '#fff' }}
          onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc' }}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          Basado en <span style={{ fontWeight: 400, color: '#94a3b8', textTransform: 'none' }}>(opcional)</span>
        </label>
        <select
          value={baseRol}
          onChange={e => setBaseRol(e.target.value)}
          style={{ ...inp, background: '#f8fafc', cursor: 'pointer' }}
          onFocus={e => { e.target.style.borderColor = 'rgba(var(--primary-rgb),0.5)'; e.target.style.background = '#fff' }}
          onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc' }}
        >
          <option value="">— Sin base (todo desactivado) —</option>
          {rolesExistentes.map(r => (
            <option key={r} value={r}>{ROL_LABEL[r] ?? r}</option>
          ))}
        </select>
      </div>

      {error && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fca5a5',
          borderRadius: 8, padding: '9px 12px', marginBottom: 14,
          fontSize: 12.5, color: '#dc2626',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span>✕</span> {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCerrar} style={modalBtnSecondary}>
          Cancelar
        </button>
        <button
          onClick={crear}
          disabled={guardando || !nombre.trim() || yaExiste}
          style={{
            ...modalBtnPrimary,
            opacity: (!nombre.trim() || yaExiste) ? 0.5 : 1,
            cursor: (!nombre.trim() || yaExiste) ? 'default' : 'pointer',
          }}
        >
          {guardando ? 'Creando…' : 'Crear rol'}
        </button>
      </div>
    </Modal>
  )
}
