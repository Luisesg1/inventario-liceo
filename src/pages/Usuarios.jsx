// src/pages/Usuarios.jsx
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import './Usuarios.css'

// ── Requisitos de contraseña ───────────────────────────────────────────────
const REQUISITOS_PASS = [
  { id: 'length', label: 'Mínimo 8 caracteres',   test: (p) => p.length >= 8 },
  { id: 'upper',  label: 'Al menos 1 mayúscula',   test: (p) => /[A-Z]/.test(p) },
  { id: 'lower',  label: 'Al menos 1 minúscula',   test: (p) => /[a-z]/.test(p) },
  { id: 'number', label: 'Al menos 1 número',      test: (p) => /[0-9]/.test(p) },
  { id: 'symbol', label: 'Al menos 1 símbolo',     test: (p) => /[^A-Za-z0-9]/.test(p) },
]
const STRENGTH_INFO = [null,
  { label: 'Muy débil',  color: '#dc2626' },
  { label: 'Débil',      color: '#f97316' },
  { label: 'Regular',    color: '#f97316' },
  { label: 'Fuerte',     color: '#16a34a' },
  { label: 'Muy fuerte', color: '#15803d' },
]

// ── Constantes ─────────────────────────────────────────────────────────────
const ACCIONES = [
  { key: 'ver_inventario',       label: 'Ver inventario',        labelCorto: 'Ver inv.' },
  { key: 'agregar_bien',         label: 'Agregar bien',           labelCorto: 'Agregar' },
  { key: 'editar_bien',          label: 'Editar bien',            labelCorto: 'Editar' },
  { key: 'eliminar_bien',        label: 'Eliminar bien',          labelCorto: 'Eliminar' },
  { key: 'eliminar_lote',        label: 'Eliminar en lote',       labelCorto: 'Lote' },
  { key: 'gestionar_categorias', label: 'Gestionar categorías',   labelCorto: 'Categ.' },
  { key: 'importar_csv',         label: 'Importar CSV',           labelCorto: 'CSV' },
  { key: 'gestionar_usuarios',   label: 'Gestionar usuarios',     labelCorto: 'Usuarios' },
  { key: 'exportar',             label: 'Exportar',               labelCorto: 'Exportar' },
  { key: 'registrar_prestamo',   label: 'Registrar préstamo',     labelCorto: 'Préstamo' },
  { key: 'registrar_incidencia', label: 'Registrar incidencia',   labelCorto: 'Incidencia' },
  // Tickets
  { key: 'ver_tickets',          label: 'Ver tickets (propios)',  labelCorto: 'Ver tick.' },
  { key: 'gestionar_tickets',    label: 'Gestionar todos los tickets', labelCorto: 'Gest. tick.' },
]

// Acciones que aplican por categoría (las demás son globales)
const ACCIONES_POR_CATEGORIA = [
  'ver_inventario', 'agregar_bien', 'editar_bien',
  'eliminar_bien', 'eliminar_lote', 'importar_csv', 'exportar',
]
// Acciones globales (no dependen de categoría)
const ACCIONES_GLOBALES = [
  'gestionar_categorias', 'gestionar_usuarios',
  'registrar_prestamo', 'registrar_incidencia',
  'ver_tickets', 'gestionar_tickets',
]

const PERMISOS_VACIO = Object.fromEntries(ACCIONES.map((a) => [a.key, false]))

const PERMISOS_POR_ROL = {
  admin: {
    permisos:   Object.fromEntries(ACCIONES.map((a) => [a.key, true])),
    categorias: ['todos'],
  },
  editor: {
    permisos: {
      ver_inventario: true, agregar_bien: true, editar_bien: true,
      eliminar_bien: false, eliminar_lote: false, gestionar_categorias: false,
      importar_csv: false, gestionar_usuarios: false, exportar: true,
      registrar_prestamo: true, registrar_incidencia: true,
      ver_tickets: true, gestionar_tickets: false,
    },
    categorias: ['todos'],
  },
  encargado: {
    permisos: {
      ver_inventario: true, agregar_bien: false, editar_bien: false,
      eliminar_bien: false, eliminar_lote: false, gestionar_categorias: false,
      importar_csv: false, gestionar_usuarios: false, exportar: false,
      registrar_prestamo: false, registrar_incidencia: false,
      ver_tickets: true, gestionar_tickets: false,
    },
    categorias: ['todos'],
  },
  soporte: {
    permisos: {
      ...PERMISOS_VACIO,
      ver_tickets: true, gestionar_tickets: true,
    },
    categorias: ['todos'],
  },
  docente: {
    permisos: {
      ...PERMISOS_VACIO,
      ver_tickets: true, gestionar_tickets: false,
    },
    categorias: ['todos'],
  },
}

const ROL_COLORES = {
  admin:     { bg: '#e8eaf6', color: '#1a237e' },
  editor:    { bg: '#dcfce7', color: '#15803d' },
  encargado: { bg: '#f3f4f6', color: '#374151' },
  docente:   { bg: '#fef3c7', color: '#92400e' },
  soporte:   { bg: '#e0f2fe', color: '#0369a1' },
}

// ══════════════════════════════════════════════════════════════════════════
// Tabla cruzada: filas = categorías, columnas = acciones
// La fila "Todos" muestra ✓/✕ que activan el permiso globalmente.
// Las demás filas muestran si esa categoría está permitida (col Acceso)
// y los checks de acción solo se activan si la categoría tiene acceso.
// ══════════════════════════════════════════════════════════════════════════
function TablaPermisos({ draft, onChange }) {
  const [catsBD, setCatsBD] = useState([])

  useEffect(() => {
    supabase.from('categorias').select('id, label').order('label')
      .then(({ data }) => setCatsBD(data ?? []))
  }, [])

  if (!draft) return <p style={{ color: '#6b7280', fontSize: 13 }}>Cargando…</p>

  const accCat    = ACCIONES.filter((a) => ACCIONES_POR_CATEGORIA.includes(a.key))
  const accGlobal = ACCIONES.filter((a) => ACCIONES_GLOBALES.includes(a.key))

  // Categorías específicas desde la BD
  const catsSinTodos = catsBD.map((c) => ({ key: c.id, label: c.label }))

  // ¿Tiene acceso a una categoría específica?
  const tieneAccesoCat = (catKey) =>
    draft.categorias?.includes('todos') || draft.categorias?.includes(catKey)

  // Toggle acceso a una categoría específica (excluye 'todos')
  function toggleCat(catKey) {
    const cats = draft.categorias ?? []
    let nuevas
    if (cats.includes(catKey)) {
      nuevas = cats.filter((c) => c !== catKey && c !== 'todos')
    } else {
      const sinTodos    = cats.filter((c) => c !== 'todos')
      nuevas            = [...sinTodos, catKey]
      if (catsSinTodos.every((c) => nuevas.includes(c.key))) nuevas = ['todos']
    }
    onChange({ ...draft, categorias: nuevas })
  }

  // Toggle "Todos" — activa/desactiva acceso a TODAS las categorías
  function toggleTodas() {
    const tieneTodasActivas = draft.categorias?.includes('todos')
    onChange({
      ...draft,
      categorias: tieneTodasActivas ? [] : ['todos'],
    })
  }

  // Toggle permiso de acción
  function toggleAccion(key) {
    onChange({ ...draft, permisos: { ...draft.permisos, [key]: !draft.permisos[key] } })
  }

  // ¿Todas las categorías tienen acceso?
  const todasActivas = draft.categorias?.includes('todos')

  return (
    <div>
      {/* ── Tabla principal ── */}
      <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #dbeafe', marginBottom: 16 }}>
        <table style={tb.table}>
          <thead>
            <tr>
              <th style={tb.thCat}>Categoría</th>
              {/* Columna Acceso */}
              <th style={{ ...tb.thAccion, color: '#cbd5e1' }} title="Acceso a esta categoría">
                Acceso
              </th>
              {/* Columnas de acciones */}
              {accCat.map((a) => (
                <th key={a.key} style={tb.thAccion} title={a.label}>
                  {a.labelCorto}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>

            {/* ── Fila especial "Todos" — check/cross por columna ── */}
            <tr style={{ background: '#1a237e' }}>
              <td style={{ ...tb.tdCheck, background: '#1a237e' }}>
                <span style={{ color: '#f0d060', fontSize: 16, fontWeight: 700, lineHeight: 1 }}>✓</span>
              </td>
              {/* Check de acceso global */}
              <td style={{ ...tb.tdCheck, background: '#1a237e' }}>
                <CheckBtn activo={todasActivas} onClick={toggleTodas} />
              </td>
              {/* Check de acción global */}
              {accCat.map((a) => {
                const activo = draft.permisos?.[a.key] ?? false
                return (
                  <td key={a.key} style={{ ...tb.tdCheck, background: '#1a237e' }}>
                    <CheckBtn activo={activo} onClick={() => toggleAccion(a.key)} />
                  </td>
                )
              })}
            </tr>

            {/* ── Separador ── */}
            <tr>
              <td colSpan={2 + accCat.length} style={{
                padding: '3px 14px', fontSize: 10, fontWeight: 700,
                color: '#9ca3af', letterSpacing: '0.08em',
                textTransform: 'uppercase', background: '#f1f5f9',
                borderBottom: '1px solid #e5e7eb',
              }}>
                Por categoría
              </td>
            </tr>

            {/* ── Filas de categorías específicas ── */}
            {catsSinTodos.map((cat, idx) => {
              const tieneAcceso = tieneAccesoCat(cat.key)
              return (
                <tr key={cat.key} style={{ background: idx % 2 === 0 ? '#fff' : '#f8faff' }}>
                  <td style={tb.tdCat}>{cat.label}</td>
                  {/* Toggle acceso a esta categoría */}
                  <td style={tb.tdCheck}>
                    <CheckBtn activo={tieneAcceso} onClick={() => toggleCat(cat.key)} />
                  </td>
                  {/* Acciones — solo check si tiene acceso, si no → guión */}
                  {accCat.map((a) => {
                    const activo = draft.permisos?.[a.key] ?? false
                    return (
                      <td key={a.key} style={tb.tdCheck}>
                        {tieneAcceso
                          ? <CheckBtn activo={activo} onClick={() => toggleAccion(a.key)} />
                          : <span style={tb.dashDisabled}>—</span>
                        }
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Acciones globales ── */}
      <p style={tb.secLabel}>Acciones globales</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {accGlobal.map((a) => {
          const activo = draft.permisos?.[a.key] ?? false
          return (
            <button
              key={a.key}
              onClick={() => toggleAccion(a.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 16px', borderRadius: 8, border: '1.5px solid',
                fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.14s',
                backgroundColor: activo ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.06)',
                borderColor:     activo ? '#22c55e' : '#fca5a5',
                color:           activo ? '#15803d' : '#ef4444',
              }}
            >
              <span style={{
                width: 20, height: 20, borderRadius: 5, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                background: activo ? '#22c55e' : '#fca5a5',
                color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0,
              }}>
                {activo ? '✓' : '✕'}
              </span>
              {a.label}
            </button>
          )
        })}
      </div>

      {/* Leyenda */}
      <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
        <span style={tb.leyenda}><span style={{ ...tb.leyendaDot, background: '#22c55e' }} />Con permiso</span>
        <span style={tb.leyenda}><span style={{ ...tb.leyendaDot, background: '#fca5a5' }} />Sin permiso</span>
        <span style={tb.leyenda}><span style={{ ...tb.leyendaDot, background: '#d1d5db' }} />Sin acceso a esa categoría</span>
      </div>
    </div>
  )
}

// Botón check/cross reutilizable
function CheckBtn({ activo, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 30, height: 30, borderRadius: 7,
        border: `1.5px solid ${activo ? '#22c55e' : '#fca5a5'}`,
        background: activo ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.08)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.14s', outline: 'none',
        opacity: disabled ? 0.4 : 1,
      }}
      title={activo ? 'Quitar permiso' : 'Dar permiso'}
    >
      {activo
        ? <span style={{ color: '#16a34a', fontSize: 14, fontWeight: 700, lineHeight: 1 }}>✓</span>
        : <span style={{ color: '#ef4444', fontSize: 12, fontWeight: 700, lineHeight: 1 }}>✕</span>
      }
    </button>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// Panel de permisos inline (para usuario existente)
// ══════════════════════════════════════════════════════════════════════════
function PanelPermisos({ usuario: u, onCerrar }) {
  const [cargando, setCargando]   = useState(true)
  const [draft, setDraft]         = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje]     = useState({ tipo: '', texto: '' })
  const [confirmar, setConfirmar] = useState(false)

  useEffect(() => { cargar() }, [u.id]) // eslint-disable-line

  async function cargar() {
    setCargando(true)
    const { data } = await supabase
      .from('permisos_usuario')
      .select('permisos, categorias')
      .eq('usuario_id', u.id)
      .maybeSingle()
    const def = PERMISOS_POR_ROL[u.rol] ?? PERMISOS_POR_ROL.encargado
    setDraft(data
      ? { permisos: { ...data.permisos }, categorias: [...(data.categorias ?? def.categorias)] }
      : { permisos: { ...def.permisos }, categorias: [...def.categorias] }
    )
    setCargando(false)
  }

  async function guardar() {
    setGuardando(true)
    setMensaje({ tipo: '', texto: '' })
    const { error } = await supabase
      .from('permisos_usuario')
      .upsert(
        { usuario_id: u.id, permisos: draft.permisos, categorias: draft.categorias },
        { onConflict: 'usuario_id' }
      )
    setGuardando(false)
    setConfirmar(false)
    if (error) {
      setMensaje({ tipo: 'error', texto: 'Error: ' + error.message })
    } else {
      setMensaje({ tipo: 'exito', texto: '¡Permisos guardados!' })
      setTimeout(() => { setMensaje({ tipo: '', texto: '' }); onCerrar() }, 1400)
    }
  }

  return (
    <div style={{ ...ps.panel, borderTopColor: 'rgba(212,160,23,0.4)', background: '#f9fafb' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#1a237e' }}>
          🔐 Permisos de {u.nombre}
        </p>
        <span style={ps.rolTag}>base: {u.rol}</span>
      </div>

      {cargando
        ? <p style={{ color: '#6b7280', fontSize: 13 }}>Cargando permisos…</p>
        : <TablaPermisos draft={draft} onChange={setDraft} />
      }

      {mensaje.texto && (
        <div className={`form-mensaje ${mensaje.tipo}`} style={{ marginTop: 12 }}>
          {mensaje.texto}
        </div>
      )}

      {!cargando && (
        <div className="form-acciones" style={{ marginTop: 16 }}>
          <button className="btn-secundario" onClick={onCerrar}>Cancelar</button>
          <button className="btn-primario" onClick={() => setConfirmar(true)} disabled={guardando}>
            Guardar permisos
          </button>
        </div>
      )}

      {confirmar && (
        <div style={ps.modalOverlay} onClick={() => setConfirmar(false)}>
          <div style={ps.modal} onClick={(e) => e.stopPropagation()}>
            <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 15, color: '#111827' }}>
              ¿Confirmar cambios?
            </p>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7280' }}>
              Se actualizarán los permisos de <strong>{u.nombre}</strong> de inmediato.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn-secundario" onClick={() => setConfirmar(false)}>Cancelar</button>
              <button className="btn-primario" onClick={guardar} disabled={guardando} style={{ minWidth: 100 }}>
                {guardando ? 'Guardando…' : 'Sí, guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// Modal: Crear usuario + asignar permisos en el mismo flujo
// ══════════════════════════════════════════════════════════════════════════
function ModalCrearUsuario({ onCerrar, onCreado }) {
  const [paso, setPaso]           = useState(1) // 1 = datos, 2 = permisos
  const [nombre, setNombre]       = useState('')
  const [email, setEmail]         = useState('')
  const [rol, setRol]             = useState('encargado')
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje]     = useState({ tipo: '', texto: '' })
  const [usuarioCreado, setUsuarioCreado] = useState(null) // { id, nombre, rol }
  const [passwordTemporal, setPasswordTemporal] = useState(null) // null = email OK, string = email falló
  const [emailErrorDetalle, setEmailErrorDetalle] = useState(null)

  // Draft de permisos: se inicializa según el rol seleccionado
  const [draft, setDraft] = useState(() => {
    const def = PERMISOS_POR_ROL.encargado
    return { permisos: { ...def.permisos }, categorias: [...def.categorias] }
  })

  // Actualizar draft cuando cambia el rol (solo en paso 1)
  function cambiarRol(nuevoRol) {
    setRol(nuevoRol)
    const def = PERMISOS_POR_ROL[nuevoRol] ?? PERMISOS_POR_ROL.encargado
    setDraft({ permisos: { ...def.permisos }, categorias: [...def.categorias] })
  }

  // Paso 1: crear usuario y pasar a permisos
  async function handleCrear() {
    if (!nombre.trim() || !email.trim()) {
      setMensaje({ tipo: 'error', texto: 'Nombre y email son requeridos.' }); return
    }
    setGuardando(true)
    setMensaje({ tipo: '', texto: '' })
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crear-usuario`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ nombre: nombre.trim(), email: email.trim(), rol }),
        }
      )
      const json = await res.json()
      if (!res.ok) {
        setMensaje({ tipo: 'error', texto: json.error ?? 'Error desconocido.' })
      } else {
        setUsuarioCreado(json.usuario)
        // Si el email falló, guardamos la contraseña temporal para mostrarla al admin
        if (!json.emailEnviado && json.passwordTemporal) {
          setPasswordTemporal(json.passwordTemporal)
          setEmailErrorDetalle(json.emailError ?? null)
        }
        setPaso(2)
        setMensaje({ tipo: '', texto: '' })
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo conectar.' })
    }
    setGuardando(false)
  }

  // Paso 2: guardar permisos
  async function handleGuardarPermisos() {
    if (!usuarioCreado) return
    setGuardando(true)
    const { error } = await supabase
      .from('permisos_usuario')
      .upsert(
        { usuario_id: usuarioCreado.id, permisos: draft.permisos, categorias: draft.categorias },
        { onConflict: 'usuario_id' }
      )
    setGuardando(false)
    if (error) {
      setMensaje({ tipo: 'error', texto: 'Error al guardar permisos: ' + error.message })
    } else {
      setMensaje({ tipo: 'exito', texto: `✓ Usuario creado. Se envió el acceso por email a ${email}` })
      setTimeout(() => { onCreado(); onCerrar() }, 1600)
    }
  }

  return (
    <div style={ps.modalOverlay} onClick={onCerrar}>
      <div
        style={{
          ...ps.modal,
          maxWidth: paso === 2 ? 780 : 440,
          width: '95%',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Indicador de pasos */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          {[
            { n: 1, label: 'Datos del usuario' },
            { n: 2, label: 'Permisos' },
          ].map((p, i) => (
            <div key={p.n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700,
                background: paso >= p.n ? '#1a237e' : '#e5e7eb',
                color: paso >= p.n ? '#fff' : '#9ca3af',
                transition: 'all 0.2s',
              }}>
                {paso > p.n ? '✓' : p.n}
              </div>
              <span style={{ fontSize: 13, fontWeight: 500, color: paso >= p.n ? '#111827' : '#9ca3af' }}>
                {p.label}
              </span>
              {i < 1 && <span style={{ color: '#d1d5db', fontSize: 18 }}>›</span>}
            </div>
          ))}
        </div>

        {/* ── Paso 1: Datos ── */}
        {paso === 1 && (
          <>
            <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 16, color: '#111827' }}>
              Crear nuevo usuario
            </p>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7280' }}>
              El usuario recibirá una contraseña temporal que deberá cambiar al primer ingreso.
            </p>
            <div className="form-grid">
              <label className="form-label">
                Nombre
                <input className="form-input" placeholder="Nombre completo"
                  value={nombre} onChange={(e) => setNombre(e.target.value)} />
              </label>
              <label className="form-label">
                Email
                <input className="form-input" type="email" placeholder="correo@ejemplo.com"
                  value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label className="form-label">
                Rol
                <select className="form-select" value={rol} onChange={(e) => cambiarRol(e.target.value)}>
                  <option value="encargado">Encargado</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Administrador</option>
                  <option value="soporte">Soporte</option>
                </select>
              </label>
            </div>
            {mensaje.texto && (
              <div className={`form-mensaje ${mensaje.tipo}`} style={{ marginTop: 12 }}>
                {mensaje.texto}
              </div>
            )}
            <div className="form-acciones" style={{ marginTop: 20 }}>
              <button className="btn-secundario" onClick={onCerrar}>Cancelar</button>
              <button className="btn-primario" onClick={handleCrear} disabled={guardando}>
                {guardando ? 'Creando usuario…' : 'Crear y asignar permisos →'}
              </button>
            </div>
          </>
        )}

        {/* ── Paso 2: Permisos ── */}
        {paso === 2 && (
          <>
            <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 16, color: '#111827' }}>
              Permisos de {usuarioCreado?.nombre}
            </p>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280' }}>
              Ajusta los permisos según necesites. Los valores iniciales corresponden al rol <strong>{rol}</strong>.
            </p>

            {/* Aviso de contraseña temporal cuando el email no llegó */}
            {passwordTemporal && (
              <div style={{
                background: '#fffbeb', border: '1px solid #fbbf24', borderRadius: 10,
                padding: '14px 16px', marginBottom: 16,
              }}>
                <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 13, color: '#92400e' }}>
                  ⚠️ El email no pudo enviarse — comparte esta contraseña temporal manualmente:
                </p>
                <div style={{
                  fontFamily: 'monospace', fontSize: 20, fontWeight: 800,
                  background: '#fff', border: '1.5px dashed #f59e0b',
                  borderRadius: 6, padding: '8px 14px', display: 'inline-block',
                  letterSpacing: '0.05em', color: '#111827', userSelect: 'all',
                }}>
                  {passwordTemporal}
                </div>
                <p style={{ margin: '6px 0 0', fontSize: 12, color: '#92400e' }}>
                  Email: <strong>{email}</strong> — el usuario deberá cambiarla al primer ingreso.
                </p>
                {emailErrorDetalle && (
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ fontSize: 11, color: '#92400e', cursor: 'pointer', fontWeight: 600 }}>
                      Ver error de Brevo ▾
                    </summary>
                    <pre style={{ fontSize: 10, background: '#fef3c7', padding: 8, borderRadius: 6, marginTop: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#78350f' }}>
                      {emailErrorDetalle}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <TablaPermisos draft={draft} onChange={setDraft} />

            {mensaje.texto && (
              <div className={`form-mensaje ${mensaje.tipo}`} style={{ marginTop: 12 }}>
                {mensaje.texto}
              </div>
            )}
            <div className="form-acciones" style={{ marginTop: 20 }}>
              <button className="btn-secundario" onClick={onCerrar}>
                Omitir y cerrar
              </button>
              <button className="btn-primario" onClick={handleGuardarPermisos} disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar permisos y finalizar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// Componente principal
// ══════════════════════════════════════════════════════════════════════════
export default function Usuarios({ usuario }) {
  const [usuarios, setUsuarios] = useState([])
  const [estado, setEstado]     = useState('cargando')
  const [errorMsg, setErrorMsg] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtroRol, setFiltroRol] = useState('todos')
  const [modalCrear, setModalCrear] = useState(false)

  // Eliminación
  const [confirmandoId, setConfirmandoId] = useState(null)
  const [eliminandoId, setEliminandoId]   = useState(null)

  // Confirmación de cambio de rol
  const [confirmCambioRol, setConfirmCambioRol] = useState(null) // { userId, nombreUsuario, rolActual, nuevoRol }
  const [aplicandoRol,     setAplicandoRol]     = useState(false)

  // Panel activo: null | { id, modo: 'editar'|'permisos' }
  const [panelActivo, setPanelActivo] = useState(null)

  // Edición
  const [editNombre, setEditNombre]       = useState('')
  const [editEmail, setEditEmail]         = useState('')
  const [editRol, setEditRol]             = useState('encargado')
  const [editPassword, setEditPassword]       = useState('')
  const [editConfirmPass, setEditConfirmPass] = useState('')
  const [editShowPass, setEditShowPass]       = useState(false)
  const [editShowConfirm, setEditShowConfirm] = useState(false)
  const [confirmarPassId, setConfirmarPassId] = useState(null) // id del usuario a confirmar
  const [guardandoEdit, setGuardandoEdit]     = useState(false)
  const [mensajeEdit, setMensajeEdit]         = useState({ tipo: '', texto: '' })

  const esAdmin = usuario?.rol === 'admin'

  // Código de invitación
  const [codigoActual,    setCodigoActual]    = useState('')
  const [editandoCodigo,  setEditandoCodigo]  = useState(false)
  const [nuevoCodigo,     setNuevoCodigo]     = useState('')
  const [guardandoCodigo, setGuardandoCodigo] = useState(false)
  const [mensajeCodigo,   setMensajeCodigo]   = useState('')
  const [verCodigo,       setVerCodigo]       = useState(false)
  const [confirmarCodigo, setConfirmarCodigo] = useState(false)

  const generarCodigoAleatorio = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  }

  const cargarCodigo = useCallback(async () => {
    const { data } = await supabase.from('configuracion').select('valor').eq('clave', 'codigo_invitacion').single()
    if (data) setCodigoActual(data.valor)
  }, [])

  const guardarCodigo = async () => {
    setConfirmarCodigo(false)
    if (!nuevoCodigo.trim()) return
    setGuardandoCodigo(true)
    const { error } = await supabase.from('configuracion').update({ valor: nuevoCodigo.trim() }).eq('clave', 'codigo_invitacion')
    setGuardandoCodigo(false)
    if (error) { setMensajeCodigo('Error al guardar'); return }
    setCodigoActual(nuevoCodigo.trim())
    setEditandoCodigo(false)
    setNuevoCodigo('')
    setMensajeCodigo('Código actualizado ✓')
    setTimeout(() => setMensajeCodigo(''), 3000)
  }

  const cargarUsuarios = useCallback(async () => {
    setEstado('cargando')
    const { data, error } = await supabase
      .from('usuarios').select('*').order('nombre')
    if (error) { setEstado('error'); setErrorMsg(error.message) }
    else { setUsuarios(data || []); setEstado('ok') }
  }, [])

  useEffect(() => { cargarUsuarios(); if (esAdmin) cargarCodigo() }, [cargarUsuarios, cargarCodigo, esAdmin])

  const usuariosFiltrados = usuarios
    .filter((u) =>
      u.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
      u.email?.toLowerCase().includes(busqueda.toLowerCase())
    )
    .filter((u) => (filtroRol === 'todos' ? true : u.rol === filtroRol))
    .sort((a, b) => {
      const aEsYo = a.id === usuario?.id
      const bEsYo = b.id === usuario?.id
      if (aEsYo && !bEsYo) return -1
      if (!aEsYo && bEsYo) return 1
      return (a.nombre ?? '').localeCompare((b.nombre ?? ''), 'es', { sensitivity: 'base' })
    })

  function togglePanel(userId, modo) {
    if (panelActivo?.id === userId && panelActivo?.modo === modo) {
      setPanelActivo(null); return
    }
    const u = usuarios.find((u) => u.id === userId)
    setPanelActivo({ id: userId, modo })
    if (modo === 'editar') {
      setEditNombre(u.nombre); setEditEmail(u.email); setEditRol(u.rol)
      setEditPassword(''); setEditConfirmPass('')
      setEditShowPass(false); setEditShowConfirm(false)
      setMensajeEdit({ tipo: '', texto: '' })
    }
  }

  async function confirmarCambioRol() {
    if (!confirmCambioRol) return
    const { userId, nuevoRol } = confirmCambioRol
    setAplicandoRol(true)
    const perfilNuevo = PERMISOS_POR_ROL[nuevoRol] ?? { permisos: { ...PERMISOS_VACIO }, categorias: ['todos'] }
    const [{ error: errRol }, { error: errPermisos }] = await Promise.all([
      supabase.from('usuarios').update({ rol: nuevoRol }).eq('id', userId),
      supabase.from('permisos_usuario').upsert(
        { usuario_id: userId, permisos: perfilNuevo.permisos, categorias: perfilNuevo.categorias },
        { onConflict: 'usuario_id' }
      ),
    ])
    if (errRol)      console.error('[cambioRol] error actualizando rol:', errRol)
    if (errPermisos) console.error('[cambioRol] error actualizando permisos:', errPermisos)
    setUsuarios((prev) => prev.map((u) => u.id === userId ? { ...u, rol: nuevoRol } : u))
    setConfirmCambioRol(null)
    setAplicandoRol(false)
  }

  async function eliminarUsuario(userId) {
    setEliminandoId(userId)

    // 1. Eliminar de Supabase Auth via Edge Function (también borra en cascada de la tabla)
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/eliminar-usuario`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ userId }),
        }
      )
      const json = await res.json()
      if (!res.ok) {
        alert('Error al eliminar: ' + (json.error ?? 'Error desconocido'))
        setEliminandoId(null)
        return
      }
    } catch {
      alert('No se pudo conectar con el servidor.')
      setEliminandoId(null)
      return
    }

    // 2. Actualizar lista local
    setUsuarios((prev) => prev.filter((u) => u.id !== userId))
    setConfirmandoId(null)
    if (panelActivo?.id === userId) setPanelActivo(null)
    setEliminandoId(null)
  }

  function iniciarGuardarEdicion(userId) {
    if (editPassword.length > 0) {
      const allOk = REQUISITOS_PASS.every(r => r.test(editPassword))
      if (!allOk) {
        setMensajeEdit({ tipo: 'error', texto: 'La contraseña no cumple todos los requisitos de seguridad.' })
        return
      }
      if (editPassword !== editConfirmPass) {
        setMensajeEdit({ tipo: 'error', texto: 'Las contraseñas no coinciden.' })
        return
      }
      setConfirmarPassId(userId)
      return
    }
    guardarEdicion(userId)
  }

  async function guardarEdicion(userId) {
    setConfirmarPassId(null)
    setGuardandoEdit(true)
    setMensajeEdit({ tipo: '', texto: '' })

    const uOriginal = usuarios.find((u) => u.id === userId)

    // 1. Actualizar tabla usuarios
    const { error } = await supabase
      .from('usuarios')
      .update({ nombre: editNombre.trim(), email: editEmail.trim().toLowerCase(), rol: editRol })
      .eq('id', userId)

    if (error) {
      setMensajeEdit({ tipo: 'error', texto: error.message })
      setGuardandoEdit(false)
      return
    }

    // 2. Si cambió email o hay nueva contraseña, actualizar en Supabase Auth
    const emailCambio    = editEmail.trim().toLowerCase() !== uOriginal?.email?.toLowerCase()
    const passwordCambio = editPassword.trim().length > 0

    if (emailCambio || passwordCambio) {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const body = { userId, ...(emailCambio && { email: editEmail.trim() }), ...(passwordCambio && { password: editPassword.trim() }) }

      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/editar-usuario`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(body),
          }
        )
        const json = await res.json()
        if (!res.ok) {
          setMensajeEdit({ tipo: 'error', texto: json.error ?? 'Error al actualizar credenciales.' })
          setGuardandoEdit(false)
          return
        }
      } catch {
        setMensajeEdit({ tipo: 'error', texto: 'No se pudo conectar con el servidor.' })
        setGuardandoEdit(false)
        return
      }
    }

    setMensajeEdit({ tipo: 'exito', texto: 'Cambios guardados.' })
    setEditPassword(''); setEditConfirmPass('')
    await cargarUsuarios()
    setTimeout(() => { setPanelActivo(null); setMensajeEdit({ tipo: '', texto: '' }) }, 1200)
    setGuardandoEdit(false)
  }

  if (estado === 'cargando') return <div className="usuarios-estado">Cargando usuarios…</div>
  if (estado === 'error')    return <div className="usuarios-estado error">{errorMsg}</div>

  return (
    <div className="usuarios-page">

      {/* Header */}
      <div className="usuarios-header">
        <h2 className="usuarios-titulo">Usuarios</h2>
        {esAdmin && (
          <button className="btn-nuevo-usuario" onClick={() => setModalCrear(true)}>
            + Invitar usuario
          </button>
        )}
      </div>

      {/* Código de invitación */}
      {esAdmin && (
        <div style={{ background: '#f0f4ff', border: '1.5px solid #c7d2fe', borderRadius: 12, padding: '16px 20px', marginBottom: 18 }}>
          <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'center' }}>
            🔑 Código de invitación para docentes
          </p>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: '#6b7280', textAlign: 'center' }}>
            Comparte este código para que los profesores puedan crear su cuenta
          </p>

          {!editandoCodigo ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <span style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 800, color: '#1a237e', letterSpacing: '0.12em', background: '#fff', border: '1.5px solid #c7d2fe', borderRadius: 8, padding: '7px 16px', userSelect: 'all' }}>
                {verCodigo ? codigoActual : '••••••••'}
              </span>
              <button onClick={() => setVerCodigo(!verCodigo)} title={verCodigo ? 'Ocultar' : 'Mostrar'}
                style={{ background: '#fff', border: '1.5px solid #e0e7ff', borderRadius: 8, cursor: 'pointer', fontSize: 15, padding: '7px 10px', lineHeight: 1 }}>
                {verCodigo ? '🙈' : '👁️'}
              </button>
              <button onClick={() => navigator.clipboard.writeText(codigoActual).then(() => { setMensajeCodigo('¡Copiado!'); setTimeout(() => setMensajeCodigo(''), 2000) })}
                title="Copiar al portapapeles"
                style={{ background: '#fff', border: '1.5px solid #e0e7ff', borderRadius: 8, cursor: 'pointer', fontSize: 15, padding: '7px 10px', lineHeight: 1 }}>
                📋
              </button>
              <button onClick={() => { setEditandoCodigo(true); setNuevoCodigo(codigoActual) }}
                style={{ padding: '7px 16px', borderRadius: 8, border: '1.5px solid #6366f1', background: '#fff', color: '#6366f1', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginLeft: 4 }}>
                Cambiar
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <input value={nuevoCodigo} onChange={e => setNuevoCodigo(e.target.value.toUpperCase())}
                style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 700, padding: '7px 12px', borderRadius: 8, border: '1.5px solid #6366f1', outline: 'none', width: 170, letterSpacing: '0.08em' }}
                autoFocus onKeyDown={e => e.key === 'Enter' && nuevoCodigo.trim() && setConfirmarCodigo(true)} />
              <button onClick={() => setNuevoCodigo(generarCodigoAleatorio())} title="Generar aleatorio"
                style={{ padding: '7px 11px', borderRadius: 8, border: '1.5px solid #6366f1', background: '#f0f4ff', color: '#6366f1', fontSize: 15, cursor: 'pointer', lineHeight: 1 }}>
                🎲
              </button>
              <button onClick={() => nuevoCodigo.trim() && setConfirmarCodigo(true)} disabled={guardandoCodigo || !nuevoCodigo.trim()}
                style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {guardandoCodigo ? '…' : 'Guardar'}
              </button>
              <button onClick={() => { setEditandoCodigo(false); setNuevoCodigo(''); setConfirmarCodigo(false) }}
                style={{ padding: '7px 14px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 13, cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          )}

          {mensajeCodigo && (
            <p style={{ margin: '10px 0 0', fontSize: 12, fontWeight: 600, color: mensajeCodigo.includes('Error') ? '#dc2626' : '#16a34a' }}>
              {mensajeCodigo}
            </p>
          )}

          {/* Modal confirmación cambio de código */}
          {confirmarCodigo && (
            <div style={ps.modalOverlay} onClick={() => setConfirmarCodigo(false)}>
              <div style={ps.modal} onClick={e => e.stopPropagation()}>
                <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 15, color: '#111827' }}>
                  ¿Cambiar código de invitación?
                </p>
                <p style={{ margin: '0 0 8px', fontSize: 13, color: '#6b7280' }}>
                  El código actual dejará de funcionar inmediatamente.
                </p>
                <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7280' }}>
                  Nuevo código: <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#1a237e', letterSpacing: '0.08em' }}>{nuevoCodigo}</span>
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className="btn-secundario" onClick={() => setConfirmarCodigo(false)}>Cancelar</button>
                  <button className="btn-primario" onClick={guardarCodigo} style={{ minWidth: 100 }}>
                    Sí, cambiar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Buscador + filtro por rol */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 170px', gap: 10, marginBottom: 16 }}>
        <div style={{ position: 'relative' }}>
          <span style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            fontSize: 15, color: '#9ca3af', pointerEvents: 'none',
          }}>🔍</span>
          <input
            type="text"
            placeholder="Buscar por nombre o email…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '9px 36px 9px 36px',
              border: '1px solid #d1d5db', borderRadius: 8,
              fontSize: 14, color: '#111827', background: '#fff',
              outline: 'none',
            }}
            onFocus={(e) => { e.target.style.borderColor = '#1a237e'; e.target.style.boxShadow = '0 0 0 3px rgba(26,35,126,0.12)' }}
            onBlur={(e)  => { e.target.style.borderColor = '#d1d5db'; e.target.style.boxShadow = 'none' }}
          />
          {busqueda && (
            <button onClick={() => setBusqueda('')} style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', color: '#9ca3af',
              cursor: 'pointer', fontSize: 16, lineHeight: 1,
            }}>✕</button>
          )}
        </div>
        <select
          value={filtroRol}
          onChange={(e) => setFiltroRol(e.target.value)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '9px 10px',
            border: '1px solid #d1d5db',
            borderRadius: 8,
            fontSize: 13,
            color: '#111827',
            background: '#fff',
            outline: 'none',
          }}
          title="Filtrar por rol"
        >
          <option value="todos">Todos los roles</option>
          <option value="admin">Admin</option>
          <option value="editor">Editor</option>
          <option value="encargado">Encargado</option>
          <option value="docente">Docente</option>
          <option value="soporte">Soporte</option>
        </select>
      </div>
      {busqueda && (
        <p style={{ fontSize: 12, color: '#6b7280', margin: '-8px 0 12px' }}>
          {usuariosFiltrados.length === 0 ? 'Sin resultados'
            : `${usuariosFiltrados.length} resultado${usuariosFiltrados.length !== 1 ? 's' : ''}`}
        </p>
      )}

      {/* Lista */}
      <div className="usuarios-lista">
        {usuariosFiltrados.map((u) => {
          const esYo        = u.id === usuario?.id
          const colores     = ROL_COLORES[u.rol] ?? ROL_COLORES.encargado
          const eliminando  = eliminandoId === u.id
          const confirmando = confirmandoId === u.id
          const editando    = panelActivo?.id === u.id && panelActivo?.modo === 'editar'
          const permisosOpen= panelActivo?.id === u.id && panelActivo?.modo === 'permisos'

          return (
            <div key={u.id} style={{
              borderRadius: 10, overflow: 'hidden',
              border: `1px solid ${(permisosOpen || editando) ? 'rgba(212,160,23,0.5)' : '#e5e7eb'}`,
              background: '#fff',
              boxShadow: (editando || permisosOpen) ? '0 4px 16px rgba(212,160,23,0.1)' : undefined,
              transition: 'border-color 0.2s',
            }}>

              {/* Fila principal */}
              <div className={`usuario-card${eliminando ? ' eliminando' : ''}`}
                style={{ border: 'none', borderRadius: 0 }}>

                <div className="usuario-avatar" style={{ background: colores.bg, color: colores.color }}>
                  {u.nombre?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="usuario-info">
                  <div className="usuario-nombre">
                    {u.nombre}
                    {esYo && <span className="badge-yo">Tú</span>}
                  </div>
                  <div className="usuario-email">{u.email}</div>
                </div>

                {esAdmin && !esYo ? (
                  <select className="rol-select"
                    style={{ backgroundColor: colores.bg, color: colores.color }}
                    value={u.rol}
                    onChange={(e) => {
                      if (e.target.value !== u.rol)
                        setConfirmCambioRol({ userId: u.id, nombreUsuario: u.nombre, rolActual: u.rol, nuevoRol: e.target.value })
                    }}
                    disabled={eliminando}>
                    <option value="encargado">Encargado</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                    <option value="docente">Docente</option>
                    <option value="soporte">Soporte</option>
                  </select>
                ) : (
                  <span className="rol-select"
                    style={{ background: colores.bg, color: colores.color, cursor: 'default' }}>
                    {u.rol.charAt(0).toUpperCase() + u.rol.slice(1)}
                  </span>
                )}

                {esAdmin && !confirmando && (
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
                    <button title="Editar" onClick={() => togglePanel(u.id, 'editar')} style={{
                      background: editando ? '#e8eaf6' : 'none',
                      border: `1px solid ${editando ? 'rgba(26,35,126,0.4)' : '#e5e7eb'}`,
                      color: editando ? '#1a237e' : '#9ca3af',
                      borderRadius: 6, padding: '5px 9px',
                      fontSize: 14, cursor: 'pointer', lineHeight: 1, transition: 'all 0.15s',
                    }}>✏️</button>
                    {!esYo && (
                      <>
                        <button title="Permisos" onClick={() => togglePanel(u.id, 'permisos')} style={{
                          background: permisosOpen ? '#fffbeb' : 'none',
                          border: `1px solid ${permisosOpen ? 'rgba(212,160,23,0.5)' : '#e5e7eb'}`,
                          color: permisosOpen ? '#92700a' : '#9ca3af',
                          borderRadius: 6, padding: '5px 9px',
                          fontSize: 14, cursor: 'pointer', lineHeight: 1, transition: 'all 0.15s',
                        }}>🔐</button>
                        <button className="btn-eliminar-icono" title="Eliminar"
                          onClick={() => setConfirmandoId(u.id)} disabled={eliminando}>🗑</button>
                      </>
                    )}
                  </div>
                )}

                {esAdmin && !esYo && confirmando && (
                  <div className="confirm-eliminar">
                    <button className="btn-confirmar-eliminar"
                      onClick={() => eliminarUsuario(u.id)} disabled={eliminando}>
                      {eliminando ? 'Eliminando…' : 'Sí, eliminar'}
                    </button>
                    <button className="btn-cancelar-eliminar"
                      onClick={() => setConfirmandoId(null)} disabled={eliminando}>
                      Cancelar
                    </button>
                  </div>
                )}
              </div>

              {/* Panel editar */}
              {editando && (
                <div style={ps.panel}>
                  <p style={ps.panelTitulo}>Editar usuario</p>
                  <div className="form-grid">
                    <label className="form-label">Nombre
                      <input className="form-input" value={editNombre}
                        onChange={(e) => setEditNombre(e.target.value)} />
                    </label>
                    <div className="form-row-2">
                      <label className="form-label">Email
                        <input className="form-input" type="email" value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)} />
                      </label>
                      <label className="form-label">Rol
                        <select className="form-select" value={editRol}
                          onChange={(e) => setEditRol(e.target.value)}>
                          <option value="encargado">Encargado</option>
                          <option value="editor">Editor</option>
                          <option value="admin">Administrador</option>
                          <option value="docente">Docente</option>
                          <option value="soporte">Soporte</option>
                        </select>
                      </label>
                    </div>
                    {/* ── Sección cambio de contraseña ── */}
                    <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 14 }}>
                      <p style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>
                        Cambiar contraseña
                        <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 11, marginLeft: 6 }}>
                          — dejar en blanco para mantener la actual
                        </span>
                      </p>

                      {/* Campo nueva contraseña */}
                      <label className="form-label" style={{ marginBottom: 8 }}>
                        Nueva contraseña
                        <div style={{ position: 'relative' }}>
                          <input
                            className="form-input"
                            type={editShowPass ? 'text' : 'password'}
                            value={editPassword}
                            onChange={(e) => { setEditPassword(e.target.value); setEditConfirmPass(''); setMensajeEdit({ tipo: '', texto: '' }) }}
                            placeholder="Nueva contraseña"
                            autoComplete="new-password"
                            style={{ paddingRight: 38 }}
                          />
                          <button type="button" onClick={() => setEditShowPass(!editShowPass)} style={{
                            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                            background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, padding: 0, lineHeight: 1, color: '#9ca3af',
                          }}>
                            {editShowPass ? '🙈' : '👁️'}
                          </button>
                        </div>
                      </label>

                      {/* Fortaleza + requisitos — solo si hay input */}
                      {editPassword.length > 0 && (() => {
                        const checks   = REQUISITOS_PASS.map(r => ({ ...r, ok: r.test(editPassword) }))
                        const strength = checks.filter(c => c.ok).length
                        const si       = STRENGTH_INFO[strength]
                        return (
                          <div style={{ marginBottom: 10 }}>
                            {/* Barra */}
                            <div style={{ display: 'flex', gap: 3, height: 4, borderRadius: 3, marginBottom: 4 }}>
                              {[1,2,3,4,5].map(i => (
                                <div key={i} style={{ flex: 1, borderRadius: 3, transition: 'background 0.2s',
                                  backgroundColor: i <= strength ? si?.color : '#e5e7eb' }} />
                              ))}
                            </div>
                            {si && <p style={{ fontSize: 11, color: si.color, margin: '0 0 6px', fontWeight: 600 }}>{si.label}</p>}
                            {/* Requisitos */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
                              {checks.map(c => (
                                <span key={c.id} style={{ fontSize: 11, color: c.ok ? '#16a34a' : '#9ca3af', display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span style={{ fontWeight: 700 }}>{c.ok ? '✓' : '○'}</span> {c.label}
                                </span>
                              ))}
                            </div>
                          </div>
                        )
                      })()}

                      {/* Confirmar — solo aparece si hay nueva contraseña */}
                      {editPassword.length > 0 && (
                        <label className="form-label">
                          Confirmar contraseña
                          <div style={{ position: 'relative' }}>
                            <input
                              className="form-input"
                              type={editShowConfirm ? 'text' : 'password'}
                              value={editConfirmPass}
                              onChange={(e) => { setEditConfirmPass(e.target.value); setMensajeEdit({ tipo: '', texto: '' }) }}
                              placeholder="Repetir contraseña"
                              autoComplete="new-password"
                              style={{
                                paddingRight: 38,
                                borderColor: editConfirmPass.length > 0
                                  ? (editPassword === editConfirmPass ? '#16a34a' : '#dc2626') : undefined,
                              }}
                            />
                            <button type="button" onClick={() => setEditShowConfirm(!editShowConfirm)} style={{
                              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                              background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, padding: 0, lineHeight: 1, color: '#9ca3af',
                            }}>
                              {editShowConfirm ? '🙈' : '👁️'}
                            </button>
                          </div>
                          {editConfirmPass.length > 0 && (
                            <span style={{ fontSize: 11, marginTop: 3, display: 'block', fontWeight: 500,
                              color: editPassword === editConfirmPass ? '#16a34a' : '#dc2626' }}>
                              {editPassword === editConfirmPass ? 'Coinciden ✓' : 'No coinciden'}
                            </span>
                          )}
                        </label>
                      )}
                    </div>
                  </div>
                  {mensajeEdit.texto && (
                    <div className={`form-mensaje ${mensajeEdit.tipo}`}>{mensajeEdit.texto}</div>
                  )}
                  <div className="form-acciones">
                    <button className="btn-secundario" onClick={() => setPanelActivo(null)}>Cancelar</button>
                    <button className="btn-primario" onClick={() => iniciarGuardarEdicion(u.id)} disabled={guardandoEdit}>
                      {guardandoEdit ? 'Guardando…' : 'Guardar cambios'}
                    </button>
                  </div>

                  {/* Modal confirmación cambio de contraseña */}
                  {confirmarPassId === u.id && (
                    <div style={ps.modalOverlay} onClick={() => setConfirmarPassId(null)}>
                      <div style={ps.modal} onClick={(e) => e.stopPropagation()}>
                        <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 15, color: '#111827' }}>
                          ¿Cambiar contraseña?
                        </p>
                        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7280' }}>
                          Se cambiará la contraseña de <strong>{u.nombre}</strong> y se cerrarán todas sus sesiones activas.
                        </p>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <button className="btn-secundario" onClick={() => setConfirmarPassId(null)}>Cancelar</button>
                          <button className="btn-primario" onClick={() => guardarEdicion(u.id)} disabled={guardandoEdit}
                            style={{ minWidth: 120 }}>
                            {guardandoEdit ? 'Guardando…' : 'Sí, cambiar'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Panel permisos */}
              {permisosOpen && (
                <PanelPermisos usuario={u} onCerrar={() => setPanelActivo(null)} />
              )}
            </div>
          )
        })}

        {usuariosFiltrados.length === 0 && (
          <div className="usuarios-estado">
            {busqueda ? 'Sin resultados para esa búsqueda.' : 'No hay usuarios registrados.'}
          </div>
        )}
      </div>

      {/* Modal crear usuario */}
      {modalCrear && (
        <ModalCrearUsuario
          onCerrar={() => setModalCrear(false)}
          onCreado={cargarUsuarios}
        />
      )}

      {/* ── Modal confirmación cambio de rol ── */}
      {confirmCambioRol && (() => {
        const ROL_LABEL  = { admin: 'Administrador', editor: 'Editor', encargado: 'Encargado', docente: 'Docente', soporte: 'Soporte' }
        const colActual  = ROL_COLORES[confirmCambioRol.rolActual] ?? { bg: '#f3f4f6', color: '#374151' }
        const colNuevo   = ROL_COLORES[confirmCambioRol.nuevoRol]  ?? { bg: '#f3f4f6', color: '#374151' }
        const perfilNuevo = PERMISOS_POR_ROL[confirmCambioRol.nuevoRol] ?? { permisos: { ...PERMISOS_VACIO } }
        const tieneAlguno = Object.values(perfilNuevo.permisos).some(Boolean)
        return (
          <div style={ps.modalOverlay} onClick={() => !aplicandoRol && setConfirmCambioRol(null)}>
            <div style={{ ...ps.modal, maxWidth: 460, width: '95%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>

              {/* Encabezado */}
              <p style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Cambiar rol de usuario</p>
              <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 18px' }}>{confirmCambioRol.nombreUsuario}</p>

              {/* Flecha de cambio */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <span style={{ background: colActual.bg, color: colActual.color, borderRadius: 8, padding: '5px 14px', fontWeight: 700, fontSize: 13 }}>
                  {ROL_LABEL[confirmCambioRol.rolActual] ?? confirmCambioRol.rolActual}
                </span>
                <span style={{ color: '#9ca3af', fontSize: 18 }}>→</span>
                <span style={{ background: colNuevo.bg, color: colNuevo.color, borderRadius: 8, padding: '5px 14px', fontWeight: 700, fontSize: 13 }}>
                  {ROL_LABEL[confirmCambioRol.nuevoRol] ?? confirmCambioRol.nuevoRol}
                </span>
              </div>

              {/* Permisos del nuevo rol */}
              <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>
                Permisos que tendrá este rol
              </p>
              {tieneAlguno ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 12px', marginBottom: 18 }}>
                  {ACCIONES.map(a => {
                    const activo = !!perfilNuevo.permisos[a.key]
                    return (
                      <div key={a.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5,
                        color: activo ? '#166534' : '#9ca3af' }}>
                        <span style={{ fontSize: 13, flexShrink: 0 }}>{activo ? '✅' : '⬜'}</span>
                        {a.label}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: 13, color: '#9ca3af', textAlign: 'center' }}>
                  Sin permisos de inventario — solo accede a Tickets
                </div>
              )}

              {/* Aviso */}
              <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 8, padding: '9px 13px', marginBottom: 20, fontSize: 12.5, color: '#713f12' }}>
                ⚠️ Los permisos actuales del usuario serán reemplazados por los del rol <strong>{ROL_LABEL[confirmCambioRol.nuevoRol]}</strong>.
              </div>

              {/* Botones */}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setConfirmCambioRol(null)} disabled={aplicandoRol}
                  style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button onClick={confirmarCambioRol} disabled={aplicandoRol}
                  style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#1a237e', color: '#fff', fontSize: 13, fontWeight: 700, cursor: aplicandoRol ? 'default' : 'pointer', opacity: aplicandoRol ? 0.6 : 1 }}>
                  {aplicandoRol ? 'Aplicando…' : 'Confirmar cambio'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ── Estilos tabla ───────────────────────────────────────────────────────────
const tb = {
  table: {
    width: '100%', borderCollapse: 'collapse', fontSize: 12,
  },
  thCat: {
    padding: '9px 14px', textAlign: 'left',
    background: '#1a237e', color: 'rgba(255,255,255,0.9)',
    fontWeight: 700, fontSize: 11,
    borderBottom: '2px solid rgba(212,160,23,0.3)',
    minWidth: 130, whiteSpace: 'nowrap',
  },
  thAccion: {
    padding: '9px 8px', textAlign: 'center',
    background: '#1a237e', color: 'rgba(255,255,255,0.65)',
    fontWeight: 600, fontSize: 10,
    borderBottom: '2px solid rgba(212,160,23,0.3)',
    minWidth: 60, whiteSpace: 'nowrap',
    letterSpacing: '0.02em',
  },
  tdCat: {
    padding: '9px 14px', color: '#374151',
    fontWeight: 500, fontSize: 13,
    borderBottom: '1px solid #e5e7eb',
    whiteSpace: 'nowrap',
  },
  tdCheck: {
    padding: '6px 8px', textAlign: 'center',
    borderBottom: '1px solid #e5e7eb',
  },
  dashDisabled: {
    display: 'inline-block', color: '#d1d5db',
    fontSize: 14, userSelect: 'none',
  },
  secLabel: {
    fontSize: 10, fontWeight: 800, color: '#9ca3af',
    textTransform: 'uppercase', letterSpacing: '0.1em',
    margin: '0 0 8px',
  },
  leyenda: {
    display: 'flex', alignItems: 'center', gap: 5,
    fontSize: 11, color: '#6b7280',
  },
  leyendaDot: {
    width: 10, height: 10, borderRadius: 3, display: 'inline-block',
  },
}

// ── Estilos panel inline ────────────────────────────────────────────────────
const ps = {
  panel: {
    borderTop: '1px solid #e5e7eb',
    background: '#f9fafb',
    padding: '18px 20px 20px',
    animation: 'slideDown 0.18s ease',
  },
  panelTitulo: {
    margin: '0 0 14px', fontWeight: 700, fontSize: 14, color: '#1a237e',
  },
  rolTag: {
    fontSize: 11, color: '#6b7280',
    background: '#e5e7eb', borderRadius: 20, padding: '2px 10px',
  },
  modalOverlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(5,12,55,0.65)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, animation: 'fadeIn 0.15s ease',
  },
  modal: {
    background: '#fff', borderRadius: 14,
    padding: '28px 28px 24px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
    border: '1px solid #e5e7eb',
    animation: 'slideUp 0.18s ease',
  },
}