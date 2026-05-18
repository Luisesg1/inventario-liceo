// src/pages/Permisos.jsx
import { useState, useEffect } from 'react'
import { CalendarCheck, Plus, Loader2 } from 'lucide-react'
import { supabase } from '../supabase'
import ModalAusencia from '../components/ModalAusencia'
import './Permisos.css'

const ROL_LABEL = {
  admin:                'Administrador',
  editor:               'Editor',
  encargado:            'Encargado',
  docente:              'Docente',
  soporte:              'Soporte',
  visor_requerimientos: 'Visor requerimientos',
}

const TIPO_LABEL = {
  vacaciones:             'Vacaciones',
  licencia_medica:        'Licencia médica',
  permiso_administrativo: 'Permiso administrativo',
  permiso_personal:       'Permiso personal',
  otro:                   'Otro',
}

const JORNADA_LABEL = {
  medio_dia:    'Medio día',
  dia_completo: 'Día completo',
  personalizado: 'Personalizado',
}

const AVATAR_COLORS = [
  '#1a237e','#283593','#1565c0','#0277bd',
  '#00695c','#2e7d32','#558b2f','#6a1b9a',
  '#ad1457','#c62828','#4527a0','#00838f',
]

function getAvatarColor(name = '') {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function getInitials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join('')
}

function formatFecha(fecha) {
  if (!fecha) return '—'
  const [y, m, d] = fecha.split('-')
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  return `${parseInt(d)} ${meses[parseInt(m) - 1]} ${y}`
}

export default function Permisos({ usuario }) {
  const [usuarios,      setUsuarios]      = useState([])
  const [permisos,      setPermisos]      = useState([])
  const [cargando,      setCargando]      = useState(true)
  const [modalAbierto,  setModalAbierto]  = useState(false)

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    setCargando(true)
    const [{ data: us }, { data: ps }] = await Promise.all([
      supabase.from('usuarios').select('id, nombre, email, rol, rut').order('nombre'),
      supabase.from('ausencias')
        .select('*, usuario:usuario_id(id, nombre, email, rol, rut)')
        .order('fecha_inicio', { ascending: false }),
    ])
    setUsuarios(us ?? [])
    setPermisos(ps ?? [])
    setCargando(false)
  }

  async function handleGetPermisosUsados(userId) {
    const { count } = await supabase
      .from('ausencias')
      .select('*', { count: 'exact', head: true })
      .eq('usuario_id', userId)
    return count ?? 0
  }

  async function handleCrearUsuario({ rut, nombres, apellidos }) {
    const nombre = `${nombres} ${apellidos}`.trim()
    const email  = `${rut.replace(/\./g, '').replace('-', '')}@sin-email.local`
    const { data, error } = await supabase
      .from('usuarios')
      .insert({ nombre, email, rol: 'docente', rut })
      .select()
      .single()
    if (error) throw error
    setUsuarios(prev => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    return data
  }

  async function handleGuardar(datos) {
    const { error } = await supabase.from('ausencias').insert({
      usuario_id:   datos.usuario.id,
      fecha_inicio: datos.fechaInicio,
      fecha_fin:    datos.fechaFin,
      jornada:      datos.jornada,
      periodo:      datos.periodo,
      hora_inicio:  datos.horaInicio,
      hora_fin:     datos.horaFin,
      tipo:         datos.tipoPermiso,
      notas:        datos.motivoOtro || datos.notas || null,
      recordatorio: datos.recordatorio,
    })
    if (error) throw error
    await cargarDatos()
  }

  return (
    <div className="permisos-page">

      {/* ── Header ───────────────────────────────────────── */}
      <div className="permisos-header">
        <div className="permisos-header-text">
          <h1 className="permisos-title">Permisos</h1>
          <p className="permisos-subtitle">Gestiona los permisos administrativos del sistema.</p>
        </div>
      </div>

      {/* ── Tarjeta permisos ─────────────────────────────── */}
      <div className="permisos-card">
        <div className="permisos-card-header">
          <div className="permisos-card-header-left">
            <div className="permisos-card-icon">
              <CalendarCheck size={16} strokeWidth={2} />
            </div>
            <div>
              <p className="permisos-card-title">Permisos registrados</p>
              <p className="permisos-card-desc">Períodos de permiso autorizados para los usuarios.</p>
            </div>
          </div>
          <button className="permisos-btn-primary" onClick={() => setModalAbierto(true)}>
            <Plus size={14} strokeWidth={2.5} />
            Registrar permiso
          </button>
        </div>

        <div className="permisos-table-wrap">
          {cargando ? (
            <div className="permisos-loading">
              <Loader2 size={18} className="animate-spin" style={{ margin: '0 auto 8px', display: 'block' }} />
              Cargando…
            </div>
          ) : permisos.length === 0 ? (
            <div className="permisos-empty">
              <div className="permisos-empty-icon">
                <CalendarCheck size={20} strokeWidth={1.5} />
              </div>
              No hay permisos registrados aún.
            </div>
          ) : (
            <table className="permisos-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Tipo</th>
                  <th>Inicio</th>
                  <th>Fin</th>
                  <th>Jornada</th>
                </tr>
              </thead>
              <tbody>
                {permisos.map(p => {
                  const u = p.usuario ?? {}
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="permisos-user-cell">
                          <div className="permisos-avatar" style={{ background: getAvatarColor(u.nombre ?? '') }}>
                            {getInitials(u.nombre ?? '')}
                          </div>
                          <div>
                            <div className="permisos-user-name">{u.nombre ?? '—'}</div>
                            <div className="permisos-user-email">{u.rut ?? ROL_LABEL[u.rol] ?? u.rol}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="permisos-badge permisos-badge--tipo">
                          {TIPO_LABEL[p.tipo] ?? p.tipo}
                        </span>
                      </td>
                      <td style={{ color: '#475569' }}>{formatFecha(p.fecha_inicio)}</td>
                      <td style={{ color: '#475569' }}>{formatFecha(p.fecha_fin)}</td>
                      <td>
                        <span className="permisos-badge permisos-badge--jornada">
                          {JORNADA_LABEL[p.jornada] ?? p.jornada}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Modal ─────────────────────────────────────────── */}
      {modalAbierto && (
        <ModalAusencia
          usuarios={usuarios}
          onClose={() => setModalAbierto(false)}
          onGuardar={handleGuardar}
          onGetPermisosUsados={handleGetPermisosUsados}
          onCrearUsuario={handleCrearUsuario}
        />
      )}

    </div>
  )
}
