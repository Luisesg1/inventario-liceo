import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import './Dashboard.css'

const ESTADO_COLOR = { Bueno: '#16a34a', Regular: '#d97706', Malo: '#dc2626', Baja: '#9ca3af' }

function DonutChart({ datos, total }) {
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
    <svg width="144" height="144" viewBox="0 0 144 144">
      {segmentos.map((seg, i) => (
        <circle key={i} cx={cx} cy={cy} r={r}
          fill="none"
          stroke={ESTADO_COLOR[seg.estado]}
          strokeWidth="20"
          strokeDasharray={animado ? `${seg.dash} ${circ - seg.dash}` : `0 ${circ}`}
          strokeDashoffset={seg.offset}
          style={{ transition: `stroke-dasharray 0.6s cubic-bezier(0.4,0,0.2,1) ${i * 0.08}s` }}
        />
      ))}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="22" fontWeight="700" fill="#1a237e">{total}</text>
      <text x={cx} y={cy + 13} textAnchor="middle" fontSize="11" fill="#6b7280">bienes</text>
    </svg>
  )
}

export default function Dashboard({ usuario }) {
  const [bienes,         setBienes]         = useState([])
  const [categorias,     setCategorias]     = useState([])
  const [cargando,       setCargando]       = useState(true)
  const [barrasAnimadas, setBarrasAnimadas] = useState(false)

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
    if (!cargando) {
      const t = setTimeout(() => setBarrasAnimadas(true), 120)
      return () => clearTimeout(t)
    }
  }, [cargando])

  if (cargando) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'rgba(255,255,255,0.55)', fontSize: 14 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid rgba(255,255,255,0.15)', borderTopColor: '#d4a017', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 12px' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        Cargando estadísticas...
      </div>
    </div>
  )

  const total     = bienes.length
  const totalCats = categorias.length
  const enBaja    = bienes.filter(b => b.estado === 'Baja').length
  const enBueno   = bienes.filter(b => b.estado === 'Bueno').length
  const pctBueno  = total > 0 ? Math.round((enBueno / total) * 100) : 0

  const estadoDatos = ['Bueno', 'Regular', 'Malo', 'Baja'].map(e => ({
    estado: e,
    count: bienes.filter(b => b.estado === e).length,
  }))

  const catDatos = categorias.map(c => ({
    ...c,
    count: bienes.filter(b => b.categoria === c.id).length,
  })).filter(c => c.count > 0).sort((a, b) => b.count - a.count)

  const maxCount = Math.max(...catDatos.map(c => c.count), 1)
  const catGrid  = categorias
    .map(c => ({ ...c, count: bienes.filter(b => b.categoria === c.id).length }))
    .sort((a, b) => b.count - a.count)


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
          { label: 'Total de bienes',   valor: total,          icono: '📦', color: '#1a237e', bg: '#e8eaf6' },
          { label: 'Categorías',        valor: totalCats,      icono: '📂', color: '#92700a', bg: '#fef9e7' },
          { label: 'En buen estado',    valor: `${pctBueno}%`, icono: '✅', color: '#16a34a', bg: '#f0fdf4' },
          { label: 'Dados de baja',     valor: enBaja,         icono: '🗑️', color: '#dc2626', bg: '#fef2f2' },
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <DonutChart datos={estadoDatos} total={total} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {estadoDatos.map(d => (
                <div key={d.estado} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 11, height: 11, borderRadius: 3, background: ESTADO_COLOR[d.estado], flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: '#374151', minWidth: 60 }}>{d.estado}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{d.count}</span>
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>
                    {total > 0 ? `${Math.round((d.count / total) * 100)}%` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Barras por categoría */}
        <div className="dash-card" style={{ overflowY: 'auto', maxHeight: 280 }}>
          <p style={s.secTitle}>Bienes por categoría</p>
          {catDatos.length === 0
            ? <p style={{ fontSize: 13, color: '#9ca3af' }}>Sin bienes registrados</p>
            : catDatos.map(c => (
              <div key={c.id} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 13, color: '#374151' }}>{c.icon} {c.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1a237e' }}>{c.count}</span>
                </div>
                <div style={{ background: '#f0f2ff', borderRadius: 4, height: 8 }}>
                  <div style={{ background: 'linear-gradient(90deg, #d4a017, #f0c830)', width: barrasAnimadas ? `${(c.count / maxCount) * 100}%` : '0%', height: '100%', borderRadius: 4, transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1)' }} />
                </div>
              </div>
            ))
          }
        </div>
      </div>

      {/* Grilla de categorías */}
      <div className="dash-card">
        <p style={s.secTitle}>Todas las categorías</p>
        <div className="dash-cat-grid">
          {catGrid.map(c => (
            <div key={c.id} style={{
              background: c.count > 0 ? '#f0f2ff' : '#f9fafb',
              border: `1.5px solid ${c.count > 0 ? 'rgba(212,160,23,0.35)' : '#e5e7eb'}`,
              borderRadius: 12, padding: '0.9rem', textAlign: 'center',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}>
              <div style={{ fontSize: 26, marginBottom: 6 }}>{c.icon}</div>
              <div style={{ fontSize: 12, color: '#374151', fontWeight: 600, marginBottom: 4, lineHeight: 1.3 }}>{c.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: c.count > 0 ? '#1a237e' : '#d1d5db' }}>{c.count}</div>
            </div>
          ))}
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
