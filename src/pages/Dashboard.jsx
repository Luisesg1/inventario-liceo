import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import './Dashboard.css'

const ESTADO_COLOR = { Bueno: '#16a34a', Regular: '#d97706', Malo: '#dc2626', Baja: '#9ca3af' }
const ESTADO_BG    = { Bueno: '#dcfce7', Regular: '#fef3c7', Malo: '#fee2e2', Baja: '#f3f4f6' }

const ACCION_META = {
  crear:      { color: '#16a34a', bg: '#dcfce7', icono: '➕', label: 'Creación' },
  actualizar: { color: '#2563eb', bg: '#dbeafe', icono: '✏️', label: 'Actualización' },
  baja:       { color: '#dc2626', bg: '#fee2e2', icono: '🗑️', label: 'Baja' },
  eliminar:   { color: '#dc2626', bg: '#fee2e2', icono: '🗑️', label: 'Eliminación' },
  mantenimiento: { color: '#d97706', bg: '#fef3c7', icono: '🔧', label: 'Mantenimiento' },
}

function tiempoRelativo(fecha) {
  const diff = Date.now() - new Date(fecha).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'ahora mismo'
  if (min < 60) return `hace ${min} min`
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return `hace ${hrs} h`
  const dias = Math.floor(hrs / 24)
  return `hace ${dias} día${dias > 1 ? 's' : ''}`
}

// ── Componente: Actividad Reciente ─────────────────────────────────────────
function ActividadReciente({ actividades, cargandoAct }) {
  const [entrada, setEntrada] = useState(false)
  useEffect(() => { const t = setTimeout(() => setEntrada(true), 80); return () => clearTimeout(t) }, [])

  return (
    <div className="dash-card dash-actividad">
      <p style={s.secTitle}>🧾 Actividad reciente</p>

      {cargandoAct ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#9ca3af', fontSize: 13 }}>
          <div className="dash-mini-spin" />
          Cargando actividad...
        </div>
      ) : actividades.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem 0', color: '#9ca3af' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
          <p style={{ fontSize: 13, margin: 0 }}>Sin actividad registrada aún</p>
        </div>
      ) : (
        <div className="dash-act-list">
          {actividades.map((a, i) => {
            const meta = ACCION_META[a.accion] || ACCION_META.actualizar
            return (
              <div
                key={a.id}
                className="dash-act-item"
                style={{
                  opacity: entrada ? 1 : 0,
                  transform: entrada ? 'translateY(0)' : 'translateY(8px)',
                  transition: `opacity 0.35s ease ${i * 0.04}s, transform 0.35s ease ${i * 0.04}s`,
                  borderLeft: `3px solid ${meta.color}`,
                }}
              >
                <div
                  className="dash-act-badge"
                  style={{ background: meta.bg, color: meta.color }}
                >
                  {meta.icono}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="dash-act-desc">
                    <strong>{a.usuario_nombre}</strong>
                    {' '}
                    <span style={{ color: '#6b7280' }}>
                      {a.accion === 'crear' && 'agregó'}
                      {a.accion === 'actualizar' && 'actualizó'}
                      {a.accion === 'baja' && 'dio de baja'}
                      {a.accion === 'eliminar' && 'eliminó'}
                      {a.accion === 'mantenimiento' && 'registró mantenimiento en'}
                    </span>
                    {' '}
                    <span style={{ color: '#111827', fontWeight: 600 }}>{a.bien_nombre}</span>
                  </p>
                  <p className="dash-act-time">{tiempoRelativo(a.created_at)}</p>
                </div>
                <span
                  className="dash-act-pill"
                  style={{ background: meta.bg, color: meta.color }}
                >
                  {meta.label}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Componente: Inventario por Ubicación ───────────────────────────────────
function InventarioPorUbicacion({ bienes }) {
  const [animado, setAnimado] = useState(false)
  const [tooltip, setTooltip] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => setAnimado(true), 150)
    return () => clearTimeout(t)
  }, [bienes.length])

  const datos = Object.entries(
    bienes
      .filter(b => b.ubicacion?.trim())
      .reduce((acc, b) => {
        const ub = b.ubicacion.trim()
        acc[ub] = (acc[ub] || 0) + 1
        return acc
      }, {})
  )
    .map(([nombre, count]) => ({ nombre, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const total = bienes.filter(b => b.ubicacion?.trim()).length
  const maxCount = datos[0]?.count || 1

  if (datos.length === 0) return null

  return (
    <div className="dash-card dash-ubicacion">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <p style={{ ...s.secTitle, margin: 0 }}>📍 Inventario por ubicación</p>
        <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>
          Top 5 · {total} bienes
        </span>
      </div>

      <div className="dash-ubic-list">
        {datos.map((d, i) => {
          const pct = Math.round((d.count / total) * 100)
          const barW = (d.count / maxCount) * 100
          return (
            <div
              key={d.nombre}
              className="dash-ubic-row"
              onMouseEnter={e => setTooltip({ nombre: d.nombre, count: d.count, pct, idx: i, y: e.currentTarget.getBoundingClientRect().top })}
              onMouseLeave={() => setTooltip(null)}
            >
              <span className="dash-ubic-label" title={d.nombre}>{d.nombre}</span>
              <div className="dash-ubic-bar-wrap">
                <div
                  className="dash-ubic-bar"
                  style={{
                    width: animado ? `${barW}%` : '0%',
                    transitionDelay: `${i * 0.06}s`,
                  }}
                />
              </div>
              <span className="dash-ubic-count">{d.count}</span>
              <span className="dash-ubic-pct">{pct}%</span>
            </div>
          )
        })}
      </div>

      {tooltip && (
        <div className="dash-tooltip">
          <strong>{tooltip.nombre}</strong>
          <br />
          {tooltip.count} bienes · {tooltip.pct}% del total
        </div>
      )}
    </div>
  )
}

// ── Componente: DonutChart ─────────────────────────────────────────────────
function DonutChart({ datos, total, estadoActivo, onEstadoClick }) {
  const r = 54, cx = 72, cy = 72
  const circ = 2 * Math.PI * r
  const filtrados = datos.filter(d => d.count > 0)
  const [animado, setAnimado] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setAnimado(true), 60)
    return () => clearTimeout(t)
  }, [])

  if (total === 0) return (
    <svg width="144" height="144">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth="20" />
      <text x={cx} y={cy + 5} textAnchor="middle" fontSize="13" fill="#9ca3af">Sin datos</text>
    </svg>
  )

  let acum = 0
  const segmentos = filtrados.map(d => {
    const dash = (d.count / total) * circ
    const seg = { ...d, dash, offset: circ / 4 - acum }
    acum += dash
    return seg
  })

  return (
    <svg width="160" height="160" viewBox="0 0 160 160" style={{ cursor: 'pointer', flexShrink: 0 }}>
      {segmentos.map((seg, i) => {
        const activo = !estadoActivo || seg.estado === estadoActivo
        const r2 = estadoActivo === seg.estado ? 56 : 54
        return (
          <circle key={i}
            cx={80} cy={80} r={r2}
            fill="none"
            stroke={ESTADO_COLOR[seg.estado]}
            strokeWidth={estadoActivo === seg.estado ? 24 : 20}
            strokeDasharray={animado ? `${seg.dash * (r2 / r)} ${circ * (r2 / r) - seg.dash * (r2 / r)}` : `0 ${circ}`}
            strokeDashoffset={(circ * (r2 / r)) / 4 - (segmentos.slice(0, i).reduce((a, s) => a + s.dash * (r2 / r), 0))}
            style={{
              opacity: activo ? 1 : 0.18,
              transition: `stroke-dasharray 0.6s cubic-bezier(0.4,0,0.2,1) ${i * 0.08}s, opacity 0.25s, stroke-width 0.25s`,
            }}
            onClick={() => onEstadoClick(seg.estado)}
          />
        )
      })}
      <text x={80} y={74} textAnchor="middle" fontSize="22" fontWeight="700" fill="#1a237e">{total}</text>
      <text x={80} y={90} textAnchor="middle" fontSize="11" fill="#6b7280">bienes</text>
    </svg>
  )
}

// ── Dashboard principal ────────────────────────────────────────────────────
export default function Dashboard({ usuario }) {
  const [bienes,         setBienes]         = useState([])
  const [categorias,     setCategorias]     = useState([])
  const [actividades,    setActividades]    = useState([])
  const [cargando,       setCargando]       = useState(true)
  const [cargandoAct,    setCargandoAct]    = useState(true)
  const [categoriaFiltro, setCategoriaFiltro] = useState(null)
  const [estadoFiltro,    setEstadoFiltro]    = useState(null)

  useEffect(() => {
    async function cargar() {
      const [{ data: b }, { data: c }] = await Promise.all([
        supabase.from('bienes').select('*'),
        supabase.from('categorias').select('id, label, icon'),
      ])
      setBienes(b || [])
      setCategorias(c || [])
      setCargando(false)
    }
    cargar()
  }, [])

  useEffect(() => {
    async function cargarActividades() {
      const { data } = await supabase
        .from('actividades')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3)
      setActividades(data || [])
      setCargandoAct(false)
    }
    cargarActividades()

    const channel = supabase
      .channel('actividades-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'actividades' }, payload => {
        setActividades(prev => [payload.new, ...prev].slice(0, 3))
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  if (cargando) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'rgba(255,255,255,0.55)', fontSize: 14 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid rgba(255,255,255,0.15)', borderTopColor: '#d4a017', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 12px' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        Cargando estadísticas...
      </div>
    </div>
  )

  const bienesPorCategoria = categoriaFiltro
    ? bienes.filter(b => b.categoria === categoriaFiltro)
    : bienes

  const bienesFiltrados = estadoFiltro
    ? bienesPorCategoria.filter(b => b.estado === estadoFiltro)
    : bienesPorCategoria

  const total     = bienesFiltrados.length
  const totalCats = categorias.length
  const enBaja    = bienesFiltrados.filter(b => b.estado === 'Baja').length
  const enBueno   = bienesFiltrados.filter(b => b.estado === 'Bueno').length
  const pctBueno  = total > 0 ? Math.round((enBueno / total) * 100) : 0

  const estadoDatos = ['Bueno', 'Regular', 'Malo', 'Baja'].map(e => ({
    estado: e,
    count: bienesPorCategoria.filter(b => b.estado === e).length,
  }))

  const catGrid = categorias
    .map(c => ({ ...c, count: bienes.filter(b => b.categoria === c.id).length }))
    .sort((a, b) => b.count - a.count)

  const catActiva = categorias.find(c => c.id === categoriaFiltro)

  function toggleEstado(estado) {
    setEstadoFiltro(prev => prev === estado ? null : estado)
  }
  function toggleCategoria(id) {
    setCategoriaFiltro(prev => prev === id ? null : id)
    setEstadoFiltro(null)
  }

  return (
    <div className="dash-wrap">

      {/* Saludo */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: 21, fontWeight: 700, color: '#ffffff', margin: 0, letterSpacing: '-0.01em' }}>
          Bienvenido, <span style={{ color: '#f0d060' }}>{usuario?.nombre}</span> 👋
        </h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: '5px 0 0' }}>
          Resumen general del inventario del liceo
        </p>
      </div>

      {/* KPIs */}
      <div className="dash-kpis">
        {[
          { label: categoriaFiltro ? `Total en ${catActiva?.label}` : 'Total de bienes', valor: total,          icono: '📦', color: '#1a237e', bg: '#e8eaf6' },
          { label: 'Categorías',                                                          valor: totalCats,      icono: '📂', color: '#92700a', bg: '#fef9e7' },
          { label: 'En buen estado',                                                      valor: `${pctBueno}%`, icono: '✅', color: '#16a34a', bg: '#f0fdf4' },
          { label: 'Dados de baja',                                                       valor: enBaja,         icono: '🗑️', color: '#dc2626', bg: '#fef2f2' },
        ].map((kpi, i) => (
          <div key={i} className="dash-kpi-card">
            <div style={{ width: 44, height: 44, borderRadius: 12, background: kpi.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              {kpi.icono}
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, color: kpi.color, lineHeight: 1 }}>{kpi.valor}</div>
              <div style={{ fontSize: 11.5, color: '#6b7280', marginTop: 3, fontWeight: 500 }}>{kpi.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Donut + Actividad Reciente */}
      <div className="dash-charts">

        {/* Donut */}
        <div className="dash-card">
          <p style={s.secTitle}>Distribución por estado</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <DonutChart
              datos={estadoDatos}
              total={bienesFiltrados.length}
              estadoActivo={estadoFiltro}
              onEstadoClick={toggleEstado}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {estadoDatos.map(d => {
                const activo = !estadoFiltro || estadoFiltro === d.estado
                const pct = bienesPorCategoria.length > 0
                  ? Math.round((d.count / bienesPorCategoria.length) * 100)
                  : 0
                return (
                  <div key={d.estado}
                    onClick={() => toggleEstado(d.estado)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      cursor: 'pointer', borderRadius: 8, padding: '5px 10px',
                      background: estadoFiltro === d.estado ? ESTADO_BG[d.estado] : 'transparent',
                      border: estadoFiltro === d.estado ? `1px solid ${ESTADO_COLOR[d.estado]}40` : '1px solid transparent',
                      opacity: activo ? 1 : 0.35,
                      transition: 'all 0.2s',
                    }}>
                    <div style={{ width: 11, height: 11, borderRadius: 3, background: ESTADO_COLOR[d.estado], flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: '#374151', minWidth: 56 }}>{d.estado}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{d.count}</span>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>{pct}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Actividad Reciente */}
        <ActividadReciente actividades={actividades} cargandoAct={cargandoAct} />

      </div>

      {/* Inventario por Ubicación */}
      <InventarioPorUbicacion bienes={bienes} />

      {/* Grilla de categorías */}
      <div className="dash-card">
        <p style={s.secTitle}>Todas las categorías</p>
        <div className="dash-cat-grid">
          {catGrid.map(c => {
            const esActiva = categoriaFiltro === c.id
            return (
              <div key={c.id}
                onClick={() => toggleCategoria(c.id)}
                style={{
                  background: esActiva ? '#1a237e' : (c.count > 0 ? '#f0f2ff' : '#f9fafb'),
                  border: `2px solid ${esActiva ? '#d4a017' : (c.count > 0 ? 'rgba(212,160,23,0.25)' : '#e5e7eb')}`,
                  borderRadius: 12, padding: '0.9rem', textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  transform: esActiva ? 'translateY(-2px)' : 'none',
                  boxShadow: esActiva ? '0 6px 20px rgba(26,35,126,0.3)' : 'none',
                }}>
                <div style={{ fontSize: 26, marginBottom: 6 }}>{c.icon}</div>
                <div style={{ fontSize: 12, color: esActiva ? '#f0d060' : '#374151', fontWeight: 600, marginBottom: 4, lineHeight: 1.3 }}>{c.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: esActiva ? '#ffffff' : (c.count > 0 ? '#1a237e' : '#d1d5db') }}>{c.count}</div>
              </div>
            )
          })}
          {catGrid.length === 0 && (
            <p style={{ fontSize: 13, color: '#9ca3af', gridColumn: '1/-1' }}>No hay categorías creadas.</p>
          )}
        </div>
      </div>

    </div>
  )
}

const s = {
  secTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: '#d4a017',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    margin: '0 0 14px',
  },
}
