import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import './Dashboard.css'

const ESTADO_COLOR = { Bueno: '#16a34a', Regular: '#d97706', Malo: '#dc2626', Baja: '#9ca3af' }
const ESTADO_BG    = { Bueno: '#dcfce7', Regular: '#fef3c7', Malo: '#fee2e2', Baja: '#f3f4f6' }

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

export default function Dashboard({ usuario }) {
  const [bienes,         setBienes]         = useState([])
  const [categorias,     setCategorias]     = useState([])
  const [cargando,       setCargando]       = useState(true)
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

  if (cargando) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'rgba(255,255,255,0.55)', fontSize: 14 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid rgba(255,255,255,0.15)', borderTopColor: '#d4a017', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 12px' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        Cargando estadísticas...
      </div>
    </div>
  )

  // Bienes filtrados por categoría (para el donut — siempre muestra distribución completa)
  const bienesPorCategoria = categoriaFiltro
    ? bienes.filter(b => b.categoria === categoriaFiltro)
    : bienes

  // Bienes filtrados por categoría + estado (para KPIs)
  const bienesFiltrados = estadoFiltro
    ? bienesPorCategoria.filter(b => b.estado === estadoFiltro)
    : bienesPorCategoria

  const total     = bienesFiltrados.length
  const totalCats = categorias.length
  const enBaja    = bienesFiltrados.filter(b => b.estado === 'Baja').length
  const enBueno   = bienesFiltrados.filter(b => b.estado === 'Bueno').length
  const pctBueno  = total > 0 ? Math.round((enBueno / total) * 100) : 0

  // El donut muestra distribución de la categoría (sin filtro de estado, para que sea útil)
  const estadoDatos = ['Bueno', 'Regular', 'Malo', 'Baja'].map(e => ({
    estado: e,
    count: bienesPorCategoria.filter(b => b.estado === e).length,
  }))

  const catGrid  = categorias
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

      {/* Dona + Barras */}
      <div className="dash-charts">

        {/* Dona de estados */}
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

      </div>

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
