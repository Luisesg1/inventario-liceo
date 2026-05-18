// src/pages/Permisos.jsx
import { useState, useEffect } from 'react'
import { ShieldCheck, Plus, CalendarOff, Loader2 } from 'lucide-react'
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
  vacaciones:       'Vacaciones',
  licencia_medica:  'Licencia médica',
  permiso_personal: 'Permiso personal',
  capacitacion:     'Capacitación',
  otro:             'Otro',
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
  const [usuarios,        setUsuarios]        = useState([])
  const [ausencias,       setAusencias]       = useState([])
  const [cargando,        setCargando]        = useState(true)
  const [modalAusencia,   setModalAusencia]   = useState(false)

  useEffect(() => {
    async function cargar() {
      setCargando(true)
      const [{ data: us }, { data: au }] = await Promise.all([
        supabase.from('usuarios').select('id, nombre, email, rol').order('nombre'),
        supabase.from('ausencias').select('*, usuario:usuario_id(id, nombre, email, rol)').order('fecha_inicio', { ascending: false }),
      ])
      setUsuarios(us ?? [])
      setAusencias(au ?? [])
      setCargando(false)
    }
    cargar()
  }, [])

  async function handleGuardarAusencia(datos) {
    const { error } = await supabase.from('ausencias').insert({
      usuario_id:   datos.usuario.id,
      fecha_inicio: datos.fechaInicio,
      fecha_fin:    datos.fechaFin,
      jornada:      datos.jornada,
      periodo:      datos.periodo,
      hora_inicio:  datos.horaInicio,
      hora_fin:     datos.horaFin,
      tipo:         datos.tipoAusencia,
      notas:        datos.notas,
      recordatorio: datos.recordatorio,
    })
    if (error) throw error

    // Recargar lista
    const { data: au } = await supabase
      .from('ausencias')
      .select('*, usuario:usuario_id(id, nombre, email, rol)')
      .order('fecha_inicio', { ascending: false })
    setAusencias(au ?? [])
  }

  return (
    <div className="permisos-page">

      {/* ── Header ───────────────────────────────────────── */}
      <div className="permisos-header">
        <div className="permisos-header-text">
          <h1 className="permisos-title">Permisos</h1>
          <p className="permisos-subtitle">Gestiona las ausencias y permisos administrativos del sistema.</p>
        </div>
      </div>

      {/* ── Tarjeta ausencias ─────────────────────────────── */}
      <div className="permisos-card">
        <div className="permisos-card-header">
          <div className="permisos-card-header-left">
            <div className="permisos-card-icon">
              <CalendarOff size={16} strokeWidth={2} />
            </div>
            <div>
              <p className="permisos-card-title">Ausencias registradas</p>
              <p className="permisos-card-desc">Períodos en los que un usuario estará ausente del sistema.</p>
            </div>
          </div>
          <button
            className="permisos-btn-primary"
            onClick={() => setModalAusencia(true)}
          >
            <Plus size={14} strokeWidth={2.5} />
            Registrar ausencia
          </button>
        </div>

        <div className="permisos-table-wrap">
          {cargando ? (
            <div className="permisos-loading">
              <Loader2 size={18} className="animate-spin" style={{ margin: '0 auto 8px', display: 'block' }} />
              Cargando…
            </div>
          ) : ausencias.length === 0 ? (
            <div className="permisos-empty">
              <div className="permisos-empty-icon">
                <CalendarOff size={20} strokeWidth={1.5} />
              </div>
              No hay ausencias registradas aún.
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
                {ausencias.map(a => {
                  const u = a.usuario ?? {}
                  return (
                    <tr key={a.id}>
                      <td>
                        <div className="permisos-user-cell">
                          <div
                            className="permisos-avatar"
                            style={{ background: getAvatarColor(u.nombre ?? '') }}
                          >
                            {getInitials(u.nombre ?? '')}
                          </div>
                          <div>
                            <div className="permisos-user-name">{u.nombre ?? '—'}</div>
                            <div className="permisos-user-email">{ROL_LABEL[u.rol] ?? u.rol}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="permisos-badge permisos-badge--tipo">
                          {TIPO_LABEL[a.tipo] ?? a.tipo}
                        </span>
                      </td>
                      <td style={{ color: '#475569' }}>{formatFecha(a.fecha_inicio)}</td>
                      <td style={{ color: '#475569' }}>{formatFecha(a.fecha_fin)}</td>
                      <td>
                        <span className="permisos-badge permisos-badge--jornada">
                          {JORNADA_LABEL[a.jornada] ?? a.jornada}
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

      {/* ── Modal ausencia ────────────────────────────────── */}
      {modalAusencia && (
        <ModalAusencia
          usuarios={usuarios}
          onClose={() => setModalAusencia(false)}
          onGuardar={handleGuardarAusencia}
        />
      )}

    </div>
  )
}
