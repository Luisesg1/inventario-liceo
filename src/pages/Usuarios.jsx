// src/pages/Usuarios.jsx
import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { supabase } from '../supabase'
import './Usuarios.css'
import ModalImportarUsuarios from './ModalImportarUsuarios'
import HistorialUsuario from './HistorialUsuario'
// Catálogo centralizado de permisos (fuente única de verdad)
import {
  ACCIONES,
  GRUPOS_USUARIOS as GRUPOS_PERMISOS,
  STEPS_MODULOS,
  ULTIMO_PASO,
  PERMISOS_VACIO,
  PRESETS_ROL as PERMISOS_POR_ROL,
} from '../config/permisos'
import { labelDeRol } from '../config/roles'
import { useRoles } from '../hooks/useRoles'

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
// El catálogo ACCIONES y los GRUPOS_PERMISOS ahora provienen de src/config/permisos.js
// (importados arriba). Aquí solo quedan las listas de compatibilidad puntuales.

// Backward-compat — algunos lugares aún usan estas listas
const ACCIONES_POR_CATEGORIA = ['ver_inventario', 'agregar_bien', 'editar_bien',
  'eliminar_bien', 'eliminar_lote', 'importar_csv', 'exportar']
const ACCIONES_GLOBALES = ['gestionar_categorias', 'gestionar_usuarios',
  'registrar_prestamo', 'registrar_incidencia',
  'ver_tickets', 'gestionar_tickets', 'ver_alertas_tickets',
  'ver_auditoria_requerimientos', 'ver_auditoria_permisos', 'ver_auditoria_compensatorios']

// PERMISOS_VACIO se importa desde el catálogo central (deriva de ACCIONES).
// PERMISOS_POR_ROL es ahora PRESETS_ROL importado del catálogo (fuente única):
// una sola definición compartida con App.jsx y reflejada en el seed permisos_rol.

const ROL_COLORES = {
  admin:          { bg: '#e8eaf6', color: '#1a237e' },
  directivo:      { bg: '#fce7f3', color: '#9d174d' },
  coordinador:    { bg: '#ede9fe', color: '#5b21b6' },
  docente:        { bg: '#fef3c7', color: '#92400e' },
  asistente:      { bg: '#f3f4f6', color: '#374151' },
  administrativo: { bg: '#dcfce7', color: '#15803d' },
  // Legacy
  encargado_inventario:{ bg: '#dcfce7', color: '#15803d' },
  encargado_soporte:   { bg: '#e0f2fe', color: '#0369a1' },
  encargado_permisos:  { bg: '#f3e8ff', color: '#6b21a8' },
  editor:              { bg: '#dcfce7', color: '#15803d' },
  encargado:           { bg: '#f3f4f6', color: '#374151' },
  soporte:             { bg: '#e0f2fe', color: '#0369a1' },
  visor_requerimientos:{ bg: '#f3e8ff', color: '#6b21a8' },
}

// ROL_LABEL, ROLES_SISTEMA (metadatos de roles) y sus helpers viven ahora en
// src/config/roles.js (fuente única). Aquí se consumen vía useRoles()/labelDeRol.

// ══════════════════════════════════════════════════════════════════════════
// Configuración de permisos — Diseño por fases (Stepper)
// ══════════════════════════════════════════════════════════════════════════

const NIVELES_ACCESO = [
  {
    key: 'lectura',
    label: 'Solo lectura',
    desc: 'Solo puede ver el inventario',
    icon: '👁️',
    permisosCat: {
      ver_inventario: true, agregar_bien: false, editar_bien: false,
      eliminar_bien: false, eliminar_lote: false, importar_csv: false, exportar: false,
    },
  },
  {
    key: 'editor',
    label: 'Editor',
    desc: 'Ver, agregar, editar y exportar bienes',
    icon: '✏️',
    permisosCat: {
      ver_inventario: true, agregar_bien: true, editar_bien: true,
      eliminar_bien: false, eliminar_lote: false, importar_csv: false, exportar: true,
    },
  },
  {
    key: 'admin',
    label: 'Administrador',
    desc: 'Acceso completo: ver, crear, editar, eliminar e importar',
    icon: '⚙️',
    permisosCat: {
      ver_inventario: true, agregar_bien: true, editar_bien: true,
      eliminar_bien: true, eliminar_lote: true, importar_csv: true, exportar: true,
    },
  },
  {
    key: 'personalizado',
    label: 'Personalizado',
    desc: 'Define exactamente qué puede hacer este usuario',
    icon: '🎛️',
    permisosCat: null,
  },
]

function getIconForCat(label) {
  const l = (label ?? '').toLowerCase()
  if (l.includes('biblioteca') || l.includes('libro')) return '📚'
  if (l.includes('computador') || l.includes('comput') || l.includes(' pc')) return '💻'
  if (l.includes('deport')) return '⚽'
  if (l.includes('music') || l.includes('instrument')) return '🎵'
  if (l.includes('librería') || l.includes('libreria') || l.includes('papelería')) return '📋'
  if (l.includes('mueble') || l.includes('silla') || l.includes('mesa')) return '🪑'
  if (l.includes('tecnolog') || l.includes('electr')) return '🖥️'
  if (l.includes('laborator')) return '🧪'
  if (l.includes('arte') || l.includes('artístico') || l.includes('artistico')) return '🎨'
  if (l.includes('proyect')) return '📽️'
  if (l.includes('otro') || l.includes('general')) return '📦'
  return '🗂️'
}

function detectarNivelActual(permisos) {
  if (!permisos) return 'lectura'
  // Primero verificar contra plantillas de rol del sistema (en orden de precedencia)
  for (const rolKey of ['admin', 'directivo', 'coordinador', 'docente', 'asistente', 'administrativo', 'soporte']) {
    const rolData = PERMISOS_POR_ROL[rolKey]
    if (!rolData) continue
    const coincide = ACCIONES.every(a => !!permisos[a.key] === !!rolData.permisos[a.key])
    if (coincide) return 'rol:' + rolKey
  }
  // Luego verificar niveles de acceso simples (inventario)
  for (const n of NIVELES_ACCESO.slice(0, 3)) {
    const keys = Object.keys(n.permisosCat)
    if (keys.every(k => !!permisos[k] === !!n.permisosCat[k])) return n.key
  }
  return 'personalizado'
}

function ToggleSwitch({ activo, size = 'md' }) {
  const w = size === 'sm' ? 36 : 44
  const h = size === 'sm' ? 20 : 24
  const d = size === 'sm' ? 14 : 18
  return (
    <div style={{
      width: w, height: h, borderRadius: h / 2,
      background: activo ? 'rgb(var(--primary-rgb))' : '#d1d5db',
      position: 'relative', flexShrink: 0,
      transition: 'background 0.2s',
      pointerEvents: 'none',
    }}>
      <span style={{
        position: 'absolute',
        top: (h - d) / 2,
        left: activo ? w - d - (h - d) / 2 : (h - d) / 2,
        width: d, height: d, borderRadius: '50%',
        background: '#fff', transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.25)', display: 'block',
      }} />
    </div>
  )
}

function TablaPermisos({ draft, onChange, onFinalizado, onRolChange }) {
  const [catsBD, setCatsBD]               = useState([])
  const [paso, setPaso]                   = useState(1)
  const [nivel, setNivel]                 = useState(() => detectarNivelActual(draft?.permisos ?? {}))
  const [rolBase, setRolBase]             = useState(() => {
    const n = detectarNivelActual(draft?.permisos ?? {})
    return n.startsWith('rol:') ? n.slice(4) : null
  })
  // Lista viva de roles (base + personalizados de la BD) y sus permisos reales.
  const { rolesDisponibles, permisosDe } = useRoles()

  // Devuelve el paso anterior
  function pasoAnterior(p) {
    return p - 1
  }
  // Devuelve el paso siguiente
  function pasoSiguiente(p) {
    return p + 1
  }
  // Último paso del wizard (derivado del catálogo central: 2 pasos fijos + un paso por módulo)

  useEffect(() => {
    supabase.from('categorias').select('id, label').order('label')
      .then(({ data }) => setCatsBD(data ?? []))
  }, [])

  if (!draft) return <p style={{ color: '#6b7280', fontSize: 13 }}>Cargando…</p>

  const todasActivas = draft.categorias?.includes('todos')

  function toggleCat(catKey) {
    const cats = draft.categorias ?? []
    let nuevas
    if (cats.includes(catKey)) {
      nuevas = cats.filter(c => c !== catKey && c !== 'todos')
    } else {
      const sinTodos = cats.filter(c => c !== 'todos')
      nuevas = [...sinTodos, catKey]
      if (catsBD.every(c => nuevas.includes(c.id))) nuevas = ['todos']
    }
    onChange({ ...draft, categorias: nuevas })
  }

  function toggleTodas() {
    onChange({ ...draft, categorias: todasActivas ? [] : ['todos'] })
  }

  function toggleAccion(key) {
    // Cualquier edición manual rompe el preset → personalizado (pero conserva rolBase para mostrar "basado en X")
    if (nivel !== 'personalizado') setNivel('personalizado')
    onChange({ ...draft, permisos: { ...draft.permisos, [key]: !draft.permisos[key] } })
  }

  function aplicarNivel(nivelKey) {
    setNivel(nivelKey)
    setRolBase(null)
    if (nivelKey !== 'personalizado') {
      const n = NIVELES_ACCESO.find(n => n.key === nivelKey)
      onChange({ ...draft, permisos: { ...draft.permisos, ...n.permisosCat } })
    }
  }

  function aplicarRol(rolKey) {
    // Los permisos salen de la fuente viva (permisos_rol vía useRoles); así un
    // rol personalizado aplica exactamente los permisos con que fue creado.
    const rolData = permisosDe(rolKey)
    setNivel('rol:' + rolKey)
    setRolBase(rolKey)
    // Resetear TODOS los permisos a la plantilla del rol (incluyendo categorías/módulos)
    onChange({ ...draft, permisos: { ...PERMISOS_VACIO, ...rolData.permisos }, categorias: [...rolData.categorias] })
    onRolChange?.(rolKey)
  }

  const pasoEfectivo = paso
  // Pasos fijos (1 y 2) + un paso por cada módulo del catálogo central.
  const stepsBase = [
    { n: 1, label: 'Nivel de acceso' },
    { n: 2, label: 'Módulos' },
    ...STEPS_MODULOS,
  ]

  const btn  = { padding: '9px 20px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer' }
  const prim = { ...btn, border: 'none', background: 'rgb(var(--primary-rgb))', color: '#fff' }
  const sec  = { ...btn, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151' }

  return (
    <div>
      {/* ── Stepper ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 26, overflowX: 'auto', paddingBottom: 8 }}>
        {stepsBase.flatMap((s, i) => {
          const esActivo     = pasoEfectivo === s.n
          const esCompletado = pasoEfectivo > s.n
          const displayN     = i + 1
          const items = [
            <div
              key={`s${s.n}`}
              onClick={() => !esActivo && setPaso(s.n)}
              style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '0 6px', cursor: esActivo ? 'default' : 'pointer' }}
            >
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, transition: 'all 0.25s',
                background: esActivo
                  ? 'rgb(var(--primary-rgb))'
                  : esCompletado ? 'rgba(var(--acento-rgb), 0.15)' : '#f3f4f6',
                color: esActivo ? '#fff' : esCompletado ? 'rgb(var(--acento-rgb))' : '#9ca3af',
                border: `2px solid ${esActivo
                  ? 'rgb(var(--primary-rgb))'
                  : esCompletado ? 'rgba(var(--acento-rgb), 0.4)' : '#e5e7eb'}`,
                boxShadow: esActivo ? '0 0 0 3px rgba(var(--primary-rgb), 0.15)' : 'none',
              }}>
                {esCompletado ? '✓' : displayN}
              </div>
              <span style={{
                fontSize: 10.5, fontWeight: esActivo ? 700 : 500, whiteSpace: 'nowrap',
                color: esActivo ? 'rgb(var(--primary-rgb))' : '#6b7280',
              }}>
                {s.label}
              </span>
            </div>,
          ]
          if (i < stepsBase.length - 1) {
            items.push(
              <div
                key={`l${s.n}`}
                style={{
                  flex: 1, minWidth: 14, height: 2, marginTop: 15,
                  background: esCompletado ? 'rgb(var(--acento-rgb))' : '#e5e7eb',
                  transition: 'background 0.3s',
                }}
              />
            )
          }
          return items
        })}
      </div>

      {/* ── Paso 2: Módulos ── */}
      {pasoEfectivo === 2 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, gap: 12 }}>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: '#111827' }}>Módulos de inventario</p>
              <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#6b7280' }}>
                Selecciona a qué categorías tendrá acceso este usuario.
              </p>
            </div>
            <button
              onClick={toggleTodas}
              style={{
                ...btn, padding: '7px 14px', fontSize: 12, flexShrink: 0,
                border: `1.5px solid ${todasActivas ? 'rgba(var(--primary-rgb),0.3)' : '#e5e7eb'}`,
                background: todasActivas ? 'rgba(var(--primary-rgb),0.06)' : '#fff',
                color: todasActivas ? 'rgb(var(--primary-rgb))' : '#6b7280',
              }}
            >
              {todasActivas ? '✓ Todos seleccionados' : 'Seleccionar todos'}
            </button>
          </div>

          {catsBD.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
              Cargando categorías…
            </p>
          ) : (
            <div className="modulos-grid">
              {catsBD.map(cat => {
                const tieneAcceso = todasActivas || (draft.categorias?.includes(cat.id))
                return (
                  <div
                    key={cat.id}
                    onClick={() => toggleCat(cat.id)}
                    style={{
                      padding: '16px 14px 14px', borderRadius: 12, userSelect: 'none',
                      border: `2px solid ${tieneAcceso ? 'rgba(var(--primary-rgb),0.25)' : '#e5e7eb'}`,
                      background: tieneAcceso ? 'rgba(var(--primary-rgb),0.04)' : '#fff',
                      cursor: 'pointer', transition: 'all 0.18s',
                      boxShadow: tieneAcceso
                        ? '0 2px 8px rgba(var(--primary-rgb),0.08)'
                        : '0 1px 2px rgba(0,0,0,0.04)',
                      display: 'flex', flexDirection: 'column', gap: 10,
                    }}
                  >
                    <div style={{ fontSize: 26, lineHeight: 1 }}>{getIconForCat(cat.label)}</div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: '#111827', lineHeight: 1.3 }}>
                        {cat.label}
                      </p>
                      <p style={{
                        margin: '3px 0 0', fontSize: 11, fontWeight: tieneAcceso ? 600 : 400,
                        color: tieneAcceso ? 'rgb(var(--primary-rgb))' : '#9ca3af',
                      }}>
                        {tieneAcceso ? 'Con acceso' : 'Sin acceso'}
                      </p>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <ToggleSwitch activo={tieneAcceso} size="sm" />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 22 }}>
            <button onClick={() => setPaso(1)} style={sec}>← Atrás</button>
            <button onClick={() => setPaso(pasoSiguiente(2))} style={prim}>Siguiente →</button>
          </div>
        </div>
      )}

      {/* ── Paso 1: Nivel de acceso ── */}
      {pasoEfectivo === 1 && (
        <div>
          <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 15, color: '#111827' }}>Nivel de acceso</p>
          <p style={{ margin: '0 0 18px', fontSize: 12.5, color: '#6b7280' }}>
            Elige un rol del sistema para aplicar sus permisos automáticamente.
          </p>

          {/* ── Sección: Roles del sistema ── */}
          <p style={{ margin: '0 0 10px', fontWeight: 600, fontSize: 12.5, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Roles del sistema
          </p>
          <div className="roles-grid">
            {rolesDisponibles.map(r => {
              const sel = nivel === 'rol:' + r.key
              return (
                <div
                  key={r.key}
                  onClick={() => aplicarRol(r.key)}
                  style={{
                    padding: '14px 13px', borderRadius: 12, position: 'relative',
                    border: `2px solid ${sel ? 'rgb(var(--primary-rgb))' : '#e5e7eb'}`,
                    background: sel ? 'rgba(var(--primary-rgb),0.05)' : '#fff',
                    cursor: 'pointer', transition: 'all 0.18s', userSelect: 'none',
                    boxShadow: sel
                      ? '0 4px 16px rgba(var(--primary-rgb),0.12)'
                      : '0 1px 2px rgba(0,0,0,0.04)',
                  }}
                >
                  {sel && (
                    <div style={{
                      position: 'absolute', top: 8, right: 8,
                      width: 18, height: 18, borderRadius: '50%',
                      background: 'rgb(var(--primary-rgb))', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700,
                    }}>✓</div>
                  )}
                  <div style={{ fontSize: 22, marginBottom: 8 }}>{r.icon}</div>
                  <p style={{ margin: '0 0 3px', fontWeight: 700, fontSize: 13, color: sel ? 'rgb(var(--primary-rgb))' : '#111827' }}>
                    {r.label}
                  </p>
                  <p style={{ margin: 0, fontSize: 11.5, color: '#6b7280', lineHeight: 1.4 }}>
                    {r.desc}
                  </p>
                </div>
              )
            })}
            {/* ── Personalizado (dentro de Roles del sistema) ── */}
            {(() => {
              const sel = nivel === 'personalizado'
              const n = NIVELES_ACCESO.find(x => x.key === 'personalizado')
              const baseLabel = rolBase ? labelDeRol(rolBase) : null
              return (
                <div
                  onClick={() => aplicarNivel('personalizado')}
                  style={{
                    padding: '14px 13px', borderRadius: 12, position: 'relative',
                    border: `2px solid ${sel ? 'rgb(var(--primary-rgb))' : '#e5e7eb'}`,
                    background: sel ? 'rgba(var(--primary-rgb),0.05)' : '#fff',
                    cursor: 'pointer', transition: 'all 0.18s', userSelect: 'none',
                    boxShadow: sel
                      ? '0 4px 16px rgba(var(--primary-rgb),0.12)'
                      : '0 1px 2px rgba(0,0,0,0.04)',
                  }}
                >
                  {sel && (
                    <div style={{
                      position: 'absolute', top: 8, right: 8,
                      width: 18, height: 18, borderRadius: '50%',
                      background: 'rgb(var(--primary-rgb))', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700,
                    }}>✓</div>
                  )}
                  <div style={{ fontSize: 22, marginBottom: 8 }}>{n.icon}</div>
                  <p style={{ margin: '0 0 3px', fontWeight: 700, fontSize: 13, color: sel ? 'rgb(var(--primary-rgb))' : '#111827' }}>
                    {n.label}
                  </p>
                  <p style={{ margin: 0, fontSize: 11.5, color: '#6b7280', lineHeight: 1.4 }}>
                    {sel && baseLabel
                      ? `Basado en ${baseLabel} con modificaciones`
                      : n.desc}
                  </p>
                </div>
              )
            })()}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 22 }}>
            <button onClick={() => setPaso(2)} style={prim}>Siguiente →</button>
          </div>
        </div>
      )}

      {/* ── Pasos 3-6: Personalizar por módulo ── */}
      {GRUPOS_PERMISOS.filter(g => !g.soloPersonalizado || nivel === 'personalizado').map(grupo => (
        pasoEfectivo === grupo.paso && (
          <div key={grupo.key}>
            <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 15, color: '#111827' }}>
              Personalizar permisos — {grupo.label}
            </p>
            <p style={{ margin: '0 0 18px', fontSize: 12.5, color: '#6b7280' }}>
              {grupo.descripcion}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ACCIONES.filter(a => grupo.permisos.includes(a.key)).map(a => {
                const activo = draft.permisos?.[a.key] ?? false
                return (
                  <div
                    key={a.key}
                    onClick={() => toggleAccion(a.key)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', borderRadius: 10, cursor: 'pointer', userSelect: 'none',
                      border: `1.5px solid ${activo ? 'rgba(var(--primary-rgb),0.2)' : '#e5e7eb'}`,
                      background: activo ? 'rgba(var(--primary-rgb),0.03)' : '#fff',
                      transition: 'all 0.15s',
                      gap: 12,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#111827' }}>{a.label}</p>
                      {a.desc && <p style={{ margin: '3px 0 0', fontSize: 11.5, color: '#6b7280', fontWeight: 400, lineHeight: 1.4 }}>{a.desc}</p>}
                    </div>
                    <ToggleSwitch activo={activo} size="sm" />
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 22 }}>
              <button onClick={() => setPaso(pasoAnterior(grupo.paso))} style={sec}>← Atrás</button>
              {grupo.paso < ULTIMO_PASO
                ? <button onClick={() => setPaso(pasoSiguiente(grupo.paso))} style={prim}>Siguiente →</button>
                : <button onClick={() => onFinalizado?.()} style={prim}>Finalizar ✓</button>
              }
            </div>
          </div>
        )
      ))}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// Panel de permisos inline (para usuario existente)
// ══════════════════════════════════════════════════════════════════════════
function PanelPermisos({ usuario: u, onCerrar, onRolCambiado }) {
  const [cargando, setCargando]                     = useState(true)
  const [draft, setDraft]                           = useState(null)
  const [savedDraft, setSavedDraft]                 = useState(null)
  const [guardando, setGuardando]                   = useState(false)
  const [mensaje, setMensaje]                       = useState({ tipo: '', texto: '' })
  const [confirmar, setConfirmar]                   = useState(false)
  const [rolTemplateSeleccionado, setRolTemplate]   = useState(null)
  const { permisosDe } = useRoles()

  const rolCambiado = rolTemplateSeleccionado && rolTemplateSeleccionado !== u.rol

  const hayaCambios = useMemo(() => {
    if (!draft || !savedDraft) return false
    return JSON.stringify(draft) !== JSON.stringify(savedDraft) || !!(rolTemplateSeleccionado && rolTemplateSeleccionado !== u.rol)
  }, [draft, savedDraft, rolTemplateSeleccionado, u.rol])

  useEffect(() => { cargar() }, [u.id]) // eslint-disable-line

  async function cargar() {
    setCargando(true)
    const { data } = await supabase
      .from('permisos_usuario')
      .select('permisos, categorias')
      .eq('usuario_id', u.id)
      .maybeSingle()
    const def = permisosDe(u.rol) // permisos base del rol desde la fuente viva
    const loaded = data
      ? { permisos: { ...data.permisos }, categorias: [...(data.categorias ?? def.categorias)] }
      : { permisos: { ...def.permisos }, categorias: [...def.categorias] }
    setDraft(loaded)
    setSavedDraft(loaded)
    setCargando(false)
  }

  async function guardar() {
    setGuardando(true)
    setMensaje({ tipo: '', texto: '' })

    const ops = [
      supabase
        .from('permisos_usuario')
        .upsert(
          { usuario_id: u.id, permisos: draft.permisos, categorias: draft.categorias },
          { onConflict: 'usuario_id' }
        ),
    ]
    if (rolCambiado) {
      ops.push(supabase.from('usuarios').update({ rol: rolTemplateSeleccionado }).eq('id', u.id))
    }

    const results = await Promise.all(ops)
    const error   = results.find(r => r.error)?.error ?? null

    setGuardando(false)
    setConfirmar(false)
    if (error) {
      setMensaje({ tipo: 'error', texto: 'Error: ' + error.message })
    } else {
      setSavedDraft(draft)
      if (rolCambiado) onRolCambiado?.(rolTemplateSeleccionado)
      setRolTemplate(null)
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

      {!cargando && rolCambiado && (
        <div style={{
          background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8,
          padding: '8px 13px', marginBottom: 8, fontSize: 12.5, color: '#1e40af',
          display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500,
        }}>
          ℹ️ Se cambiará el rol a <strong>{labelDeRol(rolTemplateSeleccionado)}</strong> al guardar.
        </div>
      )}

      {!cargando && hayaCambios && !rolCambiado && (
        <div style={{
          background: '#fffbeb', border: '1px solid #fbbf24', borderRadius: 8,
          padding: '8px 13px', marginBottom: 12, fontSize: 12.5, color: '#92400e',
          display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500,
        }}>
          ⚠️ Tienes cambios sin guardar — haz clic en «Guardar permisos» para aplicarlos.
        </div>
      )}

      {cargando
        ? <p style={{ color: '#6b7280', fontSize: 13 }}>Cargando permisos…</p>
        : <TablaPermisos draft={draft} onChange={setDraft} onRolChange={setRolTemplate} />
      }

      {mensaje.texto && (
        <div className={`form-mensaje ${mensaje.tipo}`} style={{ marginTop: 12 }}>
          {mensaje.texto}
        </div>
      )}

      {!cargando && (
        <div className="form-acciones" style={{ marginTop: 16 }}>
          <button className="btn-secundario" onClick={onCerrar}>Cancelar</button>
          <button
            className="btn-primario"
            onClick={() => setConfirmar(true)}
            disabled={guardando || !hayaCambios}
            style={hayaCambios ? { boxShadow: '0 0 0 3px rgba(var(--primary-rgb),0.25)' } : { opacity: 0.5 }}
          >
            {guardando ? 'Guardando…' : hayaCambios ? 'Guardar permisos ✓' : 'Sin cambios'}
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

function ModalCrearUsuario({ onCerrar, onCreado }) {
  const [paso, setPaso]           = useState(1) // 1 = datos, 2 = permisos
  const [nombres, setNombres]     = useState('')
  const [apellidos, setApellidos] = useState('')
  const [rut, setRut]             = useState('')
  const [email, setEmail]         = useState('')
  const [rol, setRol]             = useState('docente')
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje]     = useState({ tipo: '', texto: '' })
  const [fieldErrors, setFieldErrors] = useState({})
  const [usuarioCreado, setUsuarioCreado] = useState(null)
  const [rutVinculado, setRutVinculado]   = useState([]) // cuentas existentes con ese RUT
  const [permisosListos, setPermisosListos] = useState(false)
  const { rolesDisponibles, permisosDe } = useRoles()

  async function checkRutVinculado(rutVal) {
    if (!rutVal.trim() || !validarRut(rutVal)) { setRutVinculado([]); return }
    const { data } = await supabase
      .from('usuarios').select('nombre, email').eq('rut', rutVal.trim())
    setRutVinculado(data ?? [])
  }

  function setFE(field, msg) { setFieldErrors(p => ({ ...p, [field]: msg })) }
  function clearFE(field)    { setFieldErrors(p => ({ ...p, [field]: '' })) } // { id, nombre, rol }
  const [passwordTemporal, setPasswordTemporal] = useState(null) // null = email OK, string = email falló
  const [emailErrorDetalle, setEmailErrorDetalle] = useState(null)

  // Draft de permisos: se inicializa según el rol seleccionado
  const [draft, setDraft] = useState(() => {
    const def = PERMISOS_POR_ROL.docente
    return { permisos: { ...def.permisos }, categorias: [...def.categorias] }
  })

  // Actualizar draft cuando cambia el rol (solo en paso 1). Los permisos salen
  // de la fuente viva (permisos_rol), por lo que un rol personalizado precarga
  // exactamente los permisos con que fue creado.
  function cambiarRol(nuevoRol) {
    setRol(nuevoRol)
    const def = permisosDe(nuevoRol)
    setDraft({ permisos: { ...def.permisos }, categorias: [...def.categorias] })
  }

  // Paso 1: crear usuario y pasar a permisos
  async function handleCrear() {
    const nombre = `${nombres.trim()} ${apellidos.trim()}`.trim()
    setFieldErrors({})
    let ok = true
    if (!nombres.trim()) { setFE('nombres', 'Ingresa al menos 1 nombre'); ok = false }
    if (apellidos.trim().split(/\s+/).length < 2) { setFE('apellidos', 'Ingresa al menos 2 apellidos'); ok = false }
    if (!rut.trim()) { setFE('rut', 'El RUT es requerido'); ok = false }
    else if (!validarRut(rut)) { setFE('rut', 'RUT no válido'); ok = false }
    if (!email.trim()) { setFE('email', 'El email es requerido'); ok = false }
    if (!ok) return
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
          body: JSON.stringify({ nombre: `${nombres.trim()} ${apellidos.trim()}`.trim(), rut: rut.trim(), email: email.trim(), rol }),
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

  // Paso 2: guardar permisos (y rol si cambió respecto al creado)
  async function handleGuardarPermisos() {
    if (!usuarioCreado) return
    setGuardando(true)
    const ops = [
      supabase
        .from('permisos_usuario')
        .upsert(
          { usuario_id: usuarioCreado.id, permisos: draft.permisos, categorias: draft.categorias },
          { onConflict: 'usuario_id' }
        ),
    ]
    if (rol !== usuarioCreado.rol) {
      ops.push(supabase.from('usuarios').update({ rol }).eq('id', usuarioCreado.id))
    }
    const results = await Promise.all(ops)
    const error = results.find(r => r.error)?.error ?? null
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
                Nombres
                <input className="form-input" placeholder="Nombres"
                  style={fieldErrors.nombres ? { borderColor: '#dc2626' } : {}}
                  value={nombres} onChange={(e) => { setNombres(e.target.value); clearFE('nombres') }} />
                {fieldErrors.nombres && <span style={{ fontSize: 11.5, color: '#dc2626', marginTop: 3, display: 'block' }}>{fieldErrors.nombres}</span>}
              </label>
              <label className="form-label">
                Apellidos
                <input className="form-input" placeholder="Apellidos"
                  style={fieldErrors.apellidos ? { borderColor: '#dc2626' } : {}}
                  value={apellidos} onChange={(e) => { setApellidos(e.target.value); clearFE('apellidos') }} />
                {fieldErrors.apellidos && <span style={{ fontSize: 11.5, color: '#dc2626', marginTop: 3, display: 'block' }}>{fieldErrors.apellidos}</span>}
              </label>
              <label className="form-label">
                RUT
                <input className="form-input" placeholder="12.345.678-9"
                  style={fieldErrors.rut ? { borderColor: '#dc2626' } : {}}
                  value={rut}
                  onChange={(e) => { setRut(formatRut(e.target.value)); clearFE('rut'); setRutVinculado([]) }}
                  onBlur={() => checkRutVinculado(rut)} />
                {fieldErrors.rut && <span style={{ fontSize: 11.5, color: '#dc2626', marginTop: 3, display: 'block' }}>{fieldErrors.rut}</span>}
                {rutVinculado.length > 0 && (
                  <div style={{ marginTop: 6, background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 7, padding: '9px 12px', fontSize: 12.5, color: '#92400e' }}>
                    <strong>⚠️ Este RUT ya tiene {rutVinculado.length === 1 ? 'una cuenta' : `${rutVinculado.length} cuentas`} registrada{rutVinculado.length > 1 ? 's' : ''}:</strong>
                    {rutVinculado.map((u, i) => (
                      <div key={i} style={{ marginTop: 3 }}>• {u.nombre} — <span style={{ color: '#78350f' }}>{u.email}</span></div>
                    ))}
                    <div style={{ marginTop: 5, color: '#78350f', fontWeight: 500 }}>Se creará una cuenta adicional independiente.</div>
                  </div>
                )}
              </label>
              <label className="form-label">
                Email
                <input className="form-input" type="email" placeholder="correo@ejemplo.com"
                  style={fieldErrors.email ? { borderColor: '#dc2626' } : {}}
                  value={email} onChange={(e) => { setEmail(e.target.value); clearFE('email') }} />
                {fieldErrors.email && <span style={{ fontSize: 11.5, color: '#dc2626', marginTop: 3, display: 'block' }}>{fieldErrors.email}</span>}
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
              Elige el rol del usuario y ajusta los permisos según necesites.
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

            <TablaPermisos draft={draft} onChange={setDraft} onFinalizado={() => setPermisosListos(true)} onRolChange={cambiarRol} />

            {mensaje.texto && (
              <div className={`form-mensaje ${mensaje.tipo}`} style={{ marginTop: 12 }}>
                {mensaje.texto}
              </div>
            )}
            <div className="form-acciones" style={{ marginTop: 20 }}>
              <button className="btn-secundario" onClick={onCerrar}>
                Omitir y cerrar
              </button>
              <button
                className="btn-primario"
                onClick={handleGuardarPermisos}
                disabled={guardando || !permisosListos}
                title={!permisosListos ? 'Completa todos los pasos primero' : undefined}
              >
                {guardando ? 'Guardando…' : 'Guardar permisos y finalizar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Skeleton card ──────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton-avatar" />
      <div className="skeleton-info">
        <div className="skeleton-line" style={{ width: '55%', height: 13 }} />
        <div className="skeleton-line" style={{ width: '35%', height: 10, marginTop: 6 }} />
        <div className="skeleton-line" style={{ width: '65%', height: 10, marginTop: 4 }} />
      </div>
      <div className="skeleton-badge" />
    </div>
  )
}

// ── Variants ───────────────────────────────────────────────────────────────
const pageVariants = {
  hidden:  { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' } },
}
const cardVariants = {
  hidden:  { opacity: 0, y: 7 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: 'easeOut' } },
  exit:    { opacity: 0, scale: 0.98, transition: { duration: 0.15 } },
}

// ══════════════════════════════════════════════════════════════════════════
// Componente principal
// ══════════════════════════════════════════════════════════════════════════
export default function Usuarios({ usuario, permisosAdmin = {} }) {
  const shouldReduce      = useReducedMotion()
  const esAdminReal       = usuario.rol === 'admin'
  const puedeInvitar      = esAdminReal || !!permisosAdmin.invitarUsuario
  const puedeEditar       = esAdminReal || !!permisosAdmin.editarUsuario
  const puedeEliminar     = esAdminReal || !!permisosAdmin.eliminarUsuario
  const puedeVerHistorial = esAdminReal || !!permisosAdmin.verHistorialUsuarios

  // Lista viva de roles (base + personalizados de la BD) para selectores y para
  // resolver los permisos base al cambiar el rol de un usuario.
  const { rolesDisponibles, permisosDe } = useRoles()

  // Opciones para un <select> de asignación de rol, garantizando que el rol
  // actual del usuario (aunque sea legacy o custom aún no listado) esté presente
  // para no dejar el select en un valor "fantasma".
  const opcionesRol = (rolActual) =>
    rolActual && !rolesDisponibles.some(r => r.key === rolActual)
      ? [{ key: rolActual, label: labelDeRol(rolActual) }, ...rolesDisponibles]
      : rolesDisponibles

  const [usuarios, setUsuarios] = useState([])
  const [estado, setEstado]     = useState('cargando')
  const [errorMsg, setErrorMsg] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtroRol, setFiltroRol] = useState('todos')
  const [paginaU, setPaginaU] = useState(1)
  const [modalCrear, setModalCrear] = useState(false)
  const [modalImportar, setModalImportar] = useState(false)

  // Eliminación
  const [confirmandoId, setConfirmandoId] = useState(null)
  const [eliminandoId, setEliminandoId]   = useState(null)

  // Confirmación de cambio de rol
  const [confirmCambioRol, setConfirmCambioRol] = useState(null) // { userId, nombreUsuario, rolActual, nuevoRol }
  const [aplicandoRol,     setAplicandoRol]     = useState(false)
  const [mensajeRol,       setMensajeRol]       = useState({ tipo: '', texto: '' })

  // Panel activo: null | { id, modo: 'editar'|'permisos' }
  const [panelActivo, setPanelActivo] = useState(null)

  // Edición
  const [editNombre, setEditNombre]       = useState('')
  const [editEmail, setEditEmail]         = useState('')
  const [editRut,   setEditRut]           = useState('')
  const [editRol, setEditRol]             = useState('docente')
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
      .from('usuarios').select('*').eq('is_deleted', false).order('nombre')
    if (error) { setEstado('error'); setErrorMsg(error.message) }
    else { setUsuarios(data || []); setEstado('ok') }
  }, [])

  useEffect(() => { cargarUsuarios(); if (esAdmin) cargarCodigo() }, [cargarUsuarios, cargarCodigo, esAdmin])
  useEffect(() => { setPaginaU(1) }, [busqueda, filtroRol])

  // RUTs que aparecen en más de una cuenta
  const rutsDuplicados = (() => {
    const counts = {}
    usuarios.forEach(u => { if (u.rut) counts[u.rut] = (counts[u.rut] ?? 0) + 1 })
    return new Set(Object.entries(counts).filter(([, n]) => n > 1).map(([r]) => r))
  })()

  const rutBusqueda = busqueda.replace(/[^0-9kK]/gi, '')
  const usuariosFiltrados = usuarios
    .filter((u) => {
      if (!busqueda) return true
      const q = busqueda.toLowerCase()
      return (
        u.nombre?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        (rutBusqueda && u.rut && u.rut.replace(/[^0-9kK]/gi, '').includes(rutBusqueda))
      )
    })
    .filter((u) => (filtroRol === 'todos' ? true : u.rol === filtroRol))
    .sort((a, b) => {
      const aEsYo = a.id === usuario?.id
      const bEsYo = b.id === usuario?.id
      if (aEsYo && !bEsYo) return -1
      if (!aEsYo && bEsYo) return 1
      return (a.nombre ?? '').localeCompare((b.nombre ?? ''), 'es', { sensitivity: 'base' })
    })

  const POR_PAG_U    = 15
  const totalPagsU   = Math.ceil(usuariosFiltrados.length / POR_PAG_U)
  const usuariosPagU = usuariosFiltrados.slice((paginaU - 1) * POR_PAG_U, paginaU * POR_PAG_U)
  const pBtnU = (dis) => ({ padding: '5px 11px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: dis ? '#f9fafb' : '#fff', color: dis ? '#d1d5db' : '#374151', cursor: dis ? 'default' : 'pointer', fontSize: 13, fontWeight: 600 })

  function togglePanel(userId, modo) {
    if (panelActivo?.id === userId && panelActivo?.modo === modo) {
      setPanelActivo(null); return
    }
    const u = usuarios.find((u) => u.id === userId)
    setPanelActivo({ id: userId, modo })
    if (modo === 'editar') {
      setEditNombre(u.nombre); setEditEmail(u.email); setEditRut(u.rut ?? ''); setEditRol(u.rol)
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
    if (panelActivo?.id === userId) setPanelActivo(null)
    setConfirmCambioRol(null)
    setAplicandoRol(false)
    if (!errRol && !errPermisos) {
      setMensajeRol({ tipo: 'exito', texto: 'Rol y permisos actualizados correctamente.' })
      setTimeout(() => setMensajeRol({ tipo: '', texto: '' }), 3500)
    } else {
      setMensajeRol({ tipo: 'error', texto: 'Hubo un error al actualizar. Revisa la consola.' })
      setTimeout(() => setMensajeRol({ tipo: '', texto: '' }), 4000)
    }
  }

  async function eliminarUsuario(userId) {
    setEliminandoId(userId)
    try {
      const { error } = await supabase.rpc('soft_delete_usuario', {
        p_id: userId,
        p_usuario_id: usuario.id,
        p_usuario_nombre: usuario.nombre,
        p_usuario_rol: usuario.rol,
      })
      if (error) throw error
      setUsuarios(prev => prev.filter(u => u.id !== userId))
      setConfirmandoId(null)
      if (panelActivo?.id === userId) setPanelActivo(null)
    } catch (e) {
      alert('Error al mover a la Papelera: ' + (e.message ?? 'Error desconocido'))
    } finally {
      setEliminandoId(null)
    }
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
    let { error } = await supabase
      .from('usuarios')
      .update({ nombre: editNombre.trim(), email: editEmail.trim().toLowerCase(), rol: editRol, rut: editRut.trim() || null })
      .eq('id', userId)

    // Si la columna rut aún no existe en la BD, reintentar sin ella
    if (error && (error.message?.includes('rut') || error.code === '42703')) {
      ;({ error } = await supabase
        .from('usuarios')
        .update({ nombre: editNombre.trim(), email: editEmail.trim().toLowerCase(), rol: editRol })
        .eq('id', userId))
    }

    if (error) {
      setMensajeEdit({ tipo: 'error', texto: error.message })
      setGuardandoEdit(false)
      return
    }

    // 2. Si cambió el rol, reemplazar permisos del usuario por los del nuevo rol
    const rolCambio = editRol !== uOriginal?.rol
    if (rolCambio) {
      const perfilNuevo = permisosDe(editRol) // permisos base del nuevo rol desde la fuente viva
      const { error: errPermisos } = await supabase
        .from('permisos_usuario')
        .upsert(
          { usuario_id: userId, permisos: perfilNuevo.permisos, categorias: perfilNuevo.categorias },
          { onConflict: 'usuario_id' }
        )
      if (errPermisos) {
        setMensajeEdit({ tipo: 'error', texto: 'Error al actualizar permisos: ' + errPermisos.message })
        setGuardandoEdit(false)
        return
      }
    }

    // 3. Si cambió email o hay nueva contraseña, actualizar en Supabase Auth
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

    setMensajeEdit({ tipo: 'exito', texto: rolCambio ? 'Rol y permisos actualizados correctamente.' : 'Cambios guardados.' })
    setEditPassword(''); setEditConfirmPass('')
    await cargarUsuarios()
    setTimeout(() => { setPanelActivo(null); setMensajeEdit({ tipo: '', texto: '' }) }, 1200)
    setGuardandoEdit(false)
  }

  if (estado === 'cargando') return (
    <div className="usuarios-page">
      <div className="usuarios-header">
        <h2 className="usuarios-titulo">Usuarios</h2>
      </div>
      <div className="usuarios-lista">
        {[1,2,3,4].map(i => <SkeletonCard key={i} />)}
      </div>
    </div>
  )
  if (estado === 'error') return <div className="usuarios-estado error">{errorMsg}</div>

  return (
    <motion.div
      className="usuarios-page"
      variants={pageVariants}
      initial={shouldReduce ? false : 'hidden'}
      animate="visible"
    >

      {/* Header */}
      <div className="usuarios-header">
        <h2 className="usuarios-titulo">Usuarios</h2>
        {puedeInvitar && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button className="btn-importar-usuarios" onClick={() => setModalImportar(true)}>
              📥 Importar usuarios
            </button>
            <button className="btn-nuevo-usuario" onClick={() => setModalCrear(true)}>
              + Invitar usuario
            </button>
          </div>
        )}
      </div>

      {/* Código de invitación */}
      {puedeInvitar && (
        <div className="invitacion-card">
          <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'center' }}>
            🔑 Código de invitación para docentes
          </p>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: '#6b7280', textAlign: 'center' }}>
            Comparte este código para que los profesores puedan crear su cuenta
          </p>

          {!editandoCodigo ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              {/* Campo estilo login */}
              <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                <span style={{
                  fontFamily: 'monospace', fontSize: 16, fontWeight: 800,
                  color: '#1a237e', letterSpacing: verCodigo ? '0.12em' : '0.2em',
                  background: '#fff', border: '1.5px solid #c7d2fe', borderRadius: 10,
                  padding: '9px 44px 9px 16px', userSelect: 'all', display: 'block',
                  minWidth: 160, textAlign: 'center',
                }}>
                  {verCodigo ? codigoActual : '••••••••'}
                </span>
                <button onClick={() => setVerCodigo(!verCodigo)} title={verCodigo ? 'Ocultar' : 'Mostrar'}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, lineHeight: 1, display: 'flex', alignItems: 'center' }}>
                  {verCodigo
                    ? <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
              {/* Copiar */}
              <motion.button
                className="btn-inv"
                onClick={() => navigator.clipboard.writeText(codigoActual).then(() => { setMensajeCodigo('¡Copiado!'); setTimeout(() => setMensajeCodigo(''), 2000) })}
                title="Copiar al portapapeles"
                whileHover={shouldReduce ? {} : { scale: 1.05 }}
                whileTap={shouldReduce ? {} : { scale: 0.9 }}
                animate={mensajeCodigo === '¡Copiado!' ? { background: '#dcfce7', borderColor: '#86efac', color: '#16a34a' } : { background: '#fff', borderColor: '#c7d2fe', color: '#6366f1' }}
                transition={{ duration: 0.18 }}
                style={{ padding: '9px 12px', lineHeight: 1 }}>
                {mensajeCodigo === '¡Copiado!'
                  ? <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  : <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                }
              </motion.button>
              {/* Cambiar */}
              <motion.button
                className="btn-inv"
                onClick={() => { setEditandoCodigo(true); setNuevoCodigo(codigoActual) }}
                whileHover={shouldReduce ? {} : { scale: 1.04 }}
                whileTap={shouldReduce ? {} : { scale: 0.93 }}
                style={{ padding: '9px 16px', color: '#6366f1', fontSize: 13, fontWeight: 700, borderColor: '#6366f1' }}>
                Cambiar
              </motion.button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              {/* Input estilo login */}
              <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                <input value={nuevoCodigo} onChange={e => setNuevoCodigo(e.target.value.toUpperCase())}
                  style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 700, padding: '9px 44px 9px 16px', borderRadius: 10, border: '1.5px solid #6366f1', outline: 'none', width: 170, letterSpacing: '0.08em', background: '#fff' }}
                  autoFocus onKeyDown={e => e.key === 'Enter' && nuevoCodigo.trim() && setConfirmarCodigo(true)} />
                <button onClick={() => setNuevoCodigo(generarCodigoAleatorio())} title="Generar aleatorio"
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, lineHeight: 1, display: 'flex', alignItems: 'center' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/></svg>
                </button>
              </div>
              <button onClick={() => nuevoCodigo.trim() && setConfirmarCodigo(true)} disabled={guardandoCodigo || !nuevoCodigo.trim()}
                style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: '#6366f1', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {guardandoCodigo ? '…' : 'Guardar'}
              </button>
              <button onClick={() => { setEditandoCodigo(false); setNuevoCodigo(''); setConfirmarCodigo(false) }}
                style={{ padding: '9px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 13, cursor: 'pointer' }}>
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
            className="usuarios-search-input"
            placeholder="Buscar por nombre, RUT o email…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
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
          className="usuarios-filter-select"
          value={filtroRol}
          onChange={(e) => setFiltroRol(e.target.value)}
          title="Filtrar por rol"
        >
          <option value="todos">Todos los roles</option>
          {rolesDisponibles.map(r => (
            <option key={r.key} value={r.key}>{r.label}</option>
          ))}
        </select>
      </div>
      {busqueda && (
        <p style={{ fontSize: 12, color: '#6b7280', margin: '-8px 0 12px' }}>
          {usuariosFiltrados.length === 0 ? 'Sin resultados'
            : `${usuariosFiltrados.length} resultado${usuariosFiltrados.length !== 1 ? 's' : ''}`}
        </p>
      )}

      {/* Toast cambio de rol */}
      <AnimatePresence>
        {mensajeRol.texto && (
          <motion.div
            key="toast-rol"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
            className={`form-mensaje ${mensajeRol.tipo}`}
            style={{ marginBottom: 12 }}
          >
            {mensajeRol.texto}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lista */}
      <div className="usuarios-lista">
        {usuariosPagU.map((u, _idx) => {
          const esYo        = u.id === usuario?.id
          const colores     = ROL_COLORES[u.rol] ?? ROL_COLORES.encargado
          const eliminando  = eliminandoId === u.id
          const confirmando = confirmandoId === u.id
          const editando      = panelActivo?.id === u.id && panelActivo?.modo === 'editar'
          const permisosOpen  = panelActivo?.id === u.id && panelActivo?.modo === 'permisos'
          const historialOpen = panelActivo?.id === u.id && panelActivo?.modo === 'historial'

          return (
            <motion.div
              key={u.id}
              variants={cardVariants}
              initial={shouldReduce ? false : 'hidden'}
              animate="visible"
              transition={{ delay: shouldReduce ? 0 : _idx * 0.04 }}
              style={{
                borderRadius: 10, overflow: 'hidden',
                border: `1px solid ${(permisosOpen || editando) ? 'rgba(212,160,23,0.5)' : historialOpen ? 'rgba(99,102,241,0.4)' : '#e5e7eb'}`,
                background: '#fff',
                boxShadow: (editando || permisosOpen) ? '0 4px 16px rgba(212,160,23,0.1)' : historialOpen ? '0 4px 16px rgba(99,102,241,0.1)' : undefined,
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
            >

              {/* Fila principal */}
              <div className={`usuario-card${eliminando ? ' eliminando' : ''}`}
                style={{ border: 'none', borderRadius: 0 }}>

                <motion.div
                  className="usuario-avatar"
                  style={{ background: colores.bg, color: colores.color }}
                  whileHover={shouldReduce ? {} : { scale: 1.07 }}
                  transition={{ duration: 0.15 }}
                >
                  {u.nombre?.[0]?.toUpperCase() ?? '?'}
                </motion.div>
                <div className="usuario-info">
                  <div className="usuario-nombre">
                    {u.nombre}
                    {esYo && <span className="badge-yo">Tú</span>}
                  </div>
                  {u.rut && (
                    <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5 }}>
                      {u.rut}
                      {rutsDuplicados.has(u.rut) && (
                        <span title="Este RUT tiene más de una cuenta registrada"
                          style={{ background: '#fef9c3', color: '#854d0e', borderRadius: 4, padding: '1px 5px', fontSize: 10, fontWeight: 700, cursor: 'default' }}>
                          🔗 vinculado
                        </span>
                      )}
                    </div>
                  )}
                  <div className="usuario-email">{u.email}</div>
                  {u.created_at && (
                    <div style={{ fontSize: 10.5, color: '#9ca3af', marginTop: 1 }}>
                      Registrado el {new Date(u.created_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  )}
                </div>

                {puedeEditar && !esYo ? (
                  <select className="rol-select"
                    style={{ backgroundColor: colores.bg, color: colores.color }}
                    value={u.rol}
                    onChange={(e) => {
                      if (e.target.value !== u.rol)
                        setConfirmCambioRol({ userId: u.id, nombreUsuario: u.nombre, rolActual: u.rol, nuevoRol: e.target.value })
                    }}
                    disabled={eliminando}>
                    {opcionesRol(u.rol).map(r => (
                      <option key={r.key} value={r.key}>{r.label}</option>
                    ))}
                  </select>
                ) : (
                  <span className="rol-select"
                    style={{ background: colores.bg, color: colores.color, cursor: 'default' }}>
                    {labelDeRol(u.rol)}
                  </span>
                )}

                {(puedeEditar || puedeEliminar) && !confirmando && (
                  <div className="acciones-usuario" style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
                    {puedeEditar && (
                      <motion.button title="Editar" onClick={() => togglePanel(u.id, 'editar')}
                        whileHover={shouldReduce ? {} : { scale: 1.1 }}
                        whileTap={shouldReduce ? {} : { scale: 0.88 }}
                        style={{
                          background: editando ? '#e8eaf6' : 'none',
                          border: `1px solid ${editando ? 'rgba(26,35,126,0.4)' : '#e5e7eb'}`,
                          color: editando ? '#1a237e' : '#9ca3af',
                          borderRadius: 6, padding: '5px 9px',
                          fontSize: 14, cursor: 'pointer', lineHeight: 1, transition: 'background 0.15s, border-color 0.15s, color 0.15s',
                        }}>✏️</motion.button>
                    )}
                    {!esYo && (
                      <>
                        {puedeVerHistorial && (
                          <motion.button title="Historial de usuario" onClick={() => togglePanel(u.id, 'historial')}
                            whileHover={shouldReduce ? {} : { scale: 1.1 }}
                            whileTap={shouldReduce ? {} : { scale: 0.88 }}
                            style={{
                              background: historialOpen ? '#eff6ff' : 'none',
                              border: `1px solid ${historialOpen ? 'rgba(99,102,241,0.5)' : '#e5e7eb'}`,
                              color: historialOpen ? '#4338ca' : '#9ca3af',
                              borderRadius: 6, padding: '5px 9px',
                              fontSize: 14, cursor: 'pointer', lineHeight: 1, transition: 'background 0.15s, border-color 0.15s, color 0.15s',
                            }}>📋</motion.button>
                        )}
                        {esAdminReal && (
                          <motion.button title="Permisos" onClick={() => togglePanel(u.id, 'permisos')}
                            whileHover={shouldReduce ? {} : { scale: 1.1 }}
                            whileTap={shouldReduce ? {} : { scale: 0.88 }}
                            style={{
                              background: permisosOpen ? '#fffbeb' : 'none',
                              border: `1px solid ${permisosOpen ? 'rgba(212,160,23,0.5)' : '#e5e7eb'}`,
                              color: permisosOpen ? '#92700a' : '#9ca3af',
                              borderRadius: 6, padding: '5px 9px',
                              fontSize: 14, cursor: 'pointer', lineHeight: 1, transition: 'background 0.15s, border-color 0.15s, color 0.15s',
                            }}>🔐</motion.button>
                        )}
                        {puedeEliminar && (
                          <motion.button className="btn-eliminar-icono" title="Eliminar"
                            whileHover={shouldReduce ? {} : { scale: 1.1 }}
                            whileTap={shouldReduce ? {} : { scale: 0.88 }}
                            onClick={() => setConfirmandoId(u.id)} disabled={eliminando}>🗑</motion.button>
                        )}
                      </>
                    )}
                  </div>
                )}

                {puedeEliminar && !esYo && confirmando && (
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

              {/* Panel historial */}
              {historialOpen && (
                <HistorialUsuario
                  usuario={u}
                  onCerrar={() => setPanelActivo(null)}
                />
              )}

              {/* Panel editar */}
              {editando && (
                <div style={ps.panel}>
                  <p style={ps.panelTitulo}>Editar usuario</p>
                  <div className="form-grid">
                    <label className="form-label">Nombre
                      <input className="form-input" value={editNombre}
                        onChange={(e) => setEditNombre(e.target.value)} />
                    </label>
                    <label className="form-label">RUT
                      <input className="form-input" placeholder="ej: 12.345.678-9" value={editRut}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9kK]/g, '').toUpperCase()
                          if (raw.length < 2) { setEditRut(raw); return }
                          const v = raw.slice(-1), b = raw.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
                          setEditRut(`${b}-${v}`)
                        }} />
                    </label>
                    <div className="form-row-2">
                      <label className="form-label">Email
                        <input className="form-input" type="email" value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)} />
                      </label>
                      <label className="form-label">Rol
                        <select className="form-select" value={editRol}
                          onChange={(e) => setEditRol(e.target.value)}>
                          {opcionesRol(editRol).map(r => (
                            <option key={r.key} value={r.key}>{r.label}</option>
                          ))}
                        </select>
                        {editRol !== u.rol && (
                          <span style={{ fontSize: 11.5, color: '#92400e', marginTop: 5, display: 'block', fontWeight: 500 }}>
                            ⚠️ Los permisos serán reemplazados por los del rol <strong>{labelDeRol(editRol)}</strong> al guardar.
                          </span>
                        )}
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
                            background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 1, color: '#94a3b8',
                            display: 'flex', alignItems: 'center', transition: 'color 0.15s',
                          }}>
                            {editShowPass
                              ? <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                              : <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            }
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
                              background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 1, color: '#94a3b8',
                              display: 'flex', alignItems: 'center', transition: 'color 0.15s',
                            }}>
                              {editShowConfirm
                                ? <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                                : <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                              }
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
                <PanelPermisos
                  usuario={u}
                  onCerrar={() => setPanelActivo(null)}
                  onRolCambiado={(nuevoRol) => setUsuarios(prev => prev.map(x => x.id === u.id ? { ...x, rol: nuevoRol } : x))}
                />
              )}
            </motion.div>
          )
        })}

        {usuariosFiltrados.length === 0 && (
          <div className="usuarios-estado">
            {busqueda ? 'Sin resultados para esa búsqueda.' : 'No hay usuarios registrados.'}
          </div>
        )}
      </div>

      {/* Paginación usuarios */}
      {totalPagsU > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '14px 0', flexWrap: 'wrap' }}>
          <button onClick={() => setPaginaU(1)} disabled={paginaU === 1} style={pBtnU(paginaU === 1)}>«</button>
          <button onClick={() => setPaginaU(p => p - 1)} disabled={paginaU === 1} style={pBtnU(paginaU === 1)}>‹ Ant.</button>
          <span style={{ fontSize: 13, color: '#6b7280', padding: '0 6px' }}>Pág. {paginaU} / {totalPagsU} · {usuariosFiltrados.length} usuarios</span>
          <button onClick={() => setPaginaU(p => p + 1)} disabled={paginaU >= totalPagsU} style={pBtnU(paginaU >= totalPagsU)}>Sig. ›</button>
          <button onClick={() => setPaginaU(totalPagsU)} disabled={paginaU >= totalPagsU} style={pBtnU(paginaU >= totalPagsU)}>»</button>
        </div>
      )}

      {/* Modal crear usuario */}
      {modalCrear && (
        <ModalCrearUsuario
          onCerrar={() => setModalCrear(false)}
          onCreado={cargarUsuarios}
        />
      )}

      {/* Modal importar usuarios */}
      {modalImportar && (
        <ModalImportarUsuarios
          onCerrar={() => setModalImportar(false)}
          onImportado={cargarUsuarios}
        />
      )}

      {/* ── Modal confirmación cambio de rol ── */}
      {confirmCambioRol && (() => {
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
                  {labelDeRol(confirmCambioRol.rolActual)}
                </span>
                <span style={{ color: '#9ca3af', fontSize: 18 }}>→</span>
                <span style={{ background: colNuevo.bg, color: colNuevo.color, borderRadius: 8, padding: '5px 14px', fontWeight: 700, fontSize: 13 }}>
                  {labelDeRol(confirmCambioRol.nuevoRol)}
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
                ⚠️ Los permisos actuales del usuario serán reemplazados por los del rol <strong>{labelDeRol(confirmCambioRol.nuevoRol)}</strong>.
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
    </motion.div>
  )
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