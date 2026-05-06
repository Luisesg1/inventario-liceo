import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import './Dashboard.css'

const ESTADO_COLOR  = { Bueno: '#16a34a', Regular: '#d97706', Malo: '#dc2626', Baja: '#9ca3af' }
const ESTADO_BG     = { Bueno: '#dcfce7', Regular: '#fef3c7', Malo: '#fee2e2', Baja: '#f3f4f6' }
const ESTADO_ICONO  = { Bueno: '✅', Regular: '⚠️', Malo: '❌', Baja: '🗑️' }

function DonutChart({ datos, total }) {
  const r = 54
  const cx = 72
  const cy = 72
  const circ = 2 * Math.PI * r
  const filtrados = datos.filter(d => d.count > 0)

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
          strokeDasharray={`${seg.dash} ${circ - seg.dash}`}
          strokeDashoffset={seg.offset}
          style={{ transition: 'stroke-dasharray 0.4s ease' }}
        />
      ))}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="22" fontWeight="700" fill="#111827">{total}</text>
      <text x={cx} y={cy + 13} textAnchor="middle" fontSize="11" fill="#6b7280">bienes</text>
    </svg>
  )
}

export default function Dashboard({ usuario }) {
  const [bienes,     setBienes]     = useState([])
  const [categorias, setCategorias] = useState([])
  const [cargando,   setCargando]   = useState(true)

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
        <div style={{ width: 32, height: 32, border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#60a5fa', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 12px' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        Cargando estadísticas...
      </div>
    </div>
  )

  const total      = bienes.length
  const totalCats  = categorias.length
  const enBaja     = bienes.filter(b => b.estado === 'Baja').length
  const enBueno    = bienes.filter(b => b.estado === 'Bueno').length
  const pctBueno   = total > 0 ? Math.round((enBueno / total) * 100) : 0

  const estadoDatos = ['Bueno', 'Regular', 'Malo', 'Baja'].map(e => ({
    estado: e,
    count: bienes.filter(b => b.estado === e).length,
  }))

  const catDatos = categorias.map(c => ({
    ...c,
    count: bienes.filter(b => b.categoria === c.id).length,
  })).filter(c => c.count > 0).sort((a, b) => b.count - a.count)

  const maxCount   = Math.max(...catDatos.map(c => c.count), 1)
  const atencion   = bienes.filter(b => b.estado === 'Malo' || b.estado === 'Baja')
  const catGrid    = categorias.map(c => ({ ...c, count: bienes.filter(b => b.categoria === c.id).length }))
    .sort((a, b) => b.count - a.count)

  const esComp = (cat) => cat === 'computadores'
  const nombreBien = (b) => esComp(b.categoria)
    ? ([b.marca, b.modelo].filter(Boolean).join(' ') || 'Computador')
    : b.nombre

  return (
    <div className="dash-wrap">

      {/* Saludo */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#ffffff', margin: 0 }}>
          Bienvenido, {usuario?.nombre} 👋
        </h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: '4px 0 0' }}>
          Resumen general del inventario del liceo
        </p>
      </div>

      {/* KPIs */}
      <div className="dash-kpis">
        {[
          { label: 'Total de bienes',    valor: total,     icono: '📦', color: '#2563eb', bg: '#eff6ff' },
          { label: 'Categorías',         valor: totalCats, icono: '📂', color: '#7c3aed', bg: '#f5f3ff' },
          { label: 'En buen estado',     valor: `${pctBueno}%`, icono: '✅', color: '#16a34a', bg: '#f0fdf4' },
          { label: 'Dados de baja',      valor: enBaja,    icono: '🗑️', color: '#6b7280', bg: '#f9fafb' },
        ].map((kpi, i) => (
          <div key={i} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1.2rem 1.4rem', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: kpi.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
              {kpi.icono}
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, color: kpi.color, lineHeight: 1 }}>{kpi.valor}</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>{kpi.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Dona + Barras */}
      <div className="dash-charts">

        {/* Dona de estados */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1.4rem' }}>
          <p style={s.secTitle}>Distribución por estado</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <DonutChart datos={estadoDatos} total={total} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {estadoDatos.map(d => (
                <div key={d.estado} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: ESTADO_COLOR[d.estado], flexShrink: 0 }} />
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
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1.4rem', overflowY: 'auto', maxHeight: 280 }}>
          <p style={s.secTitle}>Bienes por categoría</p>
          {catDatos.length === 0
            ? <p style={{ fontSize: 13, color: '#9ca3af' }}>Sin bienes registrados</p>
            : catDatos.map(c => (
              <div key={c.id} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: '#374151' }}>{c.icon} {c.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{c.count}</span>
                </div>
                <div style={{ background: '#f3f4f6', borderRadius: 4, height: 8 }}>
                  <div style={{ background: '#3b82f6', width: `${(c.count / maxCount) * 100}%`, height: '100%', borderRadius: 4, transition: 'width 0.4s ease' }} />
                </div>
              </div>
            ))
          }
        </div>
      </div>

      {/* Requieren atención */}
      {atencion.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #fca5a5', borderRadius: 12, padding: '1.4rem', marginBottom: '1.5rem' }}>
          <p style={{ ...s.secTitle, color: '#dc2626' }}>⚠️ Requieren atención ({atencion.length})</p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  {['Bien', 'Categoría', 'Estado', 'Ubicación', 'Responsable'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: '#6b7280', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {atencion.map(b => {
                  const cat = categorias.find(c => c.id === b.categoria)
                  return (
                    <tr key={b.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px 10px', color: '#111827', fontWeight: 500 }}>{nombreBien(b)}</td>
                      <td style={{ padding: '8px 10px', color: '#6b7280' }}>{cat?.icon} {cat?.label ?? b.categoria}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{ background: ESTADO_BG[b.estado], color: ESTADO_COLOR[b.estado], borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>
                          {ESTADO_ICONO[b.estado]} {b.estado}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', color: '#6b7280' }}>{b.ubicacion || '—'}</td>
                      <td style={{ padding: '8px 10px', color: '#6b7280' }}>{b.responsable || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Grilla de categorías */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1.4rem' }}>
        <p style={s.secTitle}>Todas las categorías</p>
        <div className="dash-cat-grid">
          {catGrid.map(c => (
            <div key={c.id} style={{ background: c.count > 0 ? '#f8faff' : '#f9fafb', border: `1px solid ${c.count > 0 ? '#bfdbfe' : '#e5e7eb'}`, borderRadius: 10, padding: '0.9rem', textAlign: 'center' }}>
              <div style={{ fontSize: 26, marginBottom: 6 }}>{c.icon}</div>
              <div style={{ fontSize: 12, color: '#374151', fontWeight: 600, marginBottom: 4, lineHeight: 1.3 }}>{c.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: c.count > 0 ? '#2563eb' : '#d1d5db' }}>{c.count}</div>
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
  secTitle: { fontSize: 13, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 14px' },
}
