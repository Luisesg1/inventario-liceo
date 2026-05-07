import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import './Dashboard.css'

const ESTADO_COLOR = { Bueno: '#16a34a', Regular: '#d97706', Malo: '#dc2626', Baja: '#9ca3af' }
const ESTADO_BG    = { Bueno: '#dcfce7', Regular: '#fef3c7', Malo: '#fee2e2', Baja: '#f3f4f6' }

const ACCION_META = {
  crear:         { color: '#16a34a', bg: '#dcfce7', icono: '➕', label: 'Creación',      verbo: 'agregó' },
  actualizar:    { color: '#2563eb', bg: '#dbeafe', icono: '✏️', label: 'Actualización',  verbo: 'actualizó' },
  baja:          { color: '#dc2626', bg: '#fee2e2', icono: '🗑️', label: 'Baja',           verbo: 'dio de baja' },
  eliminar:      { color: '#dc2626', bg: '#fee2e2', icono: '🗑️', label: 'Eliminación',    verbo: 'eliminó' },
  mantenimiento: { color: '#d97706', bg: '#fef3c7', icono: '🔧', label: 'Mantenimiento',  verbo: 'registró mantenimiento en' },
}

const secTitle = {
  fontSize: 11, fontWeight: 700, color: '#d4a017',
  textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 14px',
}

function tiempoRelativo(fecha) {
  const min = Math.floor((Date.now() - new Date(fecha)) / 60000)
  if (min < 1)  return 'ahora mismo'
  if (min < 60) return `hace ${min} min`
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return `hace ${hrs} h`
  const dias = Math.floor(hrs / 24)
  return `hace ${dias} día${dias > 1 ? 's' : ''}`
}

function ActividadReciente({ actividades }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => { const t = setTimeout(() => setVisible(true), 80); return () => clearTimeout(t) }, [])

  return (
    <div className="dash-card dash-actividad">
      <p style={secTitle}>🧾 Actividad reciente</p>

      {actividades === null ? (
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
            const meta = ACCION_META[a.accion] ?? ACCION_META.actualizar
            return (
              <div key={a.id} className="dash-act-item" style={{
                borderLeft: `3px solid ${meta.color}`,
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(8px)',
                transition: `opacity 0.35s ease ${i * 0.04}s, transform 0.35s ease ${i * 0.04}s`,
              }}>
                <div className="dash-act-badge" style={{ background: meta.bg, color: meta.color }}>
                  {meta.icono}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="dash-act-desc">
                    <strong>{a.usuario_nombre}</strong>
                    {' '}<span style={{ color: '#6b7280' }}>{meta.verbo}</span>{' '}
                    <span style={{ color: '#111827', fontWeight: 600 }}>{a.bien_nombre}</span>
                  </p>
                  <p className="dash-act-time">{tiempoRelativo(a.created_at)}</p>
                </div>
                <span className="dash-act-pill" style={{ background: meta.bg, color: meta.color }}>
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

function InventarioPorUbicacion({ bienes }) {
  const [animado, setAnimado] = useState(false)
  useEffect(() => { const t = setTimeout(() => setAnimado(true), 150); return () => clearTimeout(t) }, [bienes.length])

  const datos = Object.entries(
    bienes.filter(b => b.ubicacion?.trim())
      .reduce((acc, b) => { const k = b.ubicacion.trim(); acc[k] = (acc[k] || 0) + 1; return acc }, {})
  )
    .map(([nombre, count]) => ({ nombre, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  if (datos.length === 0) return null

  const total    = datos.reduce((s, d) => s + d.count, 0)
  const maxCount = datos[0].count

  return (
    <div className="dash-card dash-ubicacion">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <p style={{ ...secTitle, margin: 0 }}>📍 Inventario por ubicación</p>
        <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Top 5 · {total} bienes</span>
      </div>
      <div className="dash-ubic-list">
        {datos.map((d, i) => (
          <div key={d.nombre} className="dash-ubic-row">
            <span className="dash-ubic-label" title={d.nombre}>{d.nombre}</span>
            <div className="dash-ubic-bar-wrap">
              <div className="dash-ubic-bar" style={{
                width: animado ? `${(d.count / maxCount) * 100}%` : '0%',
                transitionDelay: `${i * 0.06}s`,
              }} />
            </div>
            <span className="dash-ubic-count">{d.count}</span>
            <span className="dash-ubic-pct">{Math.round((d.count / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function DonutChart({ datos, total, estadoActivo, onEstadoClick }) {
  const r    = 54
  const circ = 2 * Math.PI * r
  const [animado, setAnimado] = useState(false)
  useEffect(() => { const t = setTimeout(() => setAnimado(true), 60); return () => clearTimeout(t) }, [])

  if (total === 0) return (
    <svg width="144" height="144">
      <circle cx={72} cy={72} r={r} fill="none" stroke="#e5e7eb" strokeWidth="20" />
      <text x={72} y={77} textAnchor="middle" fontSize="13" fill="#9ca3af">Sin datos</text>
    </svg>
  )

  let acum = 0
  const segmentos = datos.filter(d => d.count > 0).map(d => {
    const dash = (d.count / total) * circ
    const seg  = { ...d, dash, acumAntes: acum }
    acum += dash
    return seg
  })

  return (
    <svg width="160" height="160" viewBox="0 0 160 160" style={{ cursor: 'pointer', flexShrink: 0 }}>
      {segmentos.map((seg, i) => {
        const activo = !estadoActivo || seg.estado === estadoActivo
        const r2     = estadoActivo === seg.estado ? 56 : r
        const scale  = r2 / r
        return (
          <circle key={i}
            cx={80} cy={80} r={r2} fill="none"
            stroke={ESTADO_COLOR[seg.estado]}
            strokeWidth={estadoActivo === seg.estado ? 24 : 20}
            strokeDasharray={animado
              ? `${seg.dash * scale} ${circ * scale - seg.dash * scale}`
              : `0 ${circ}`}
            strokeDashoffset={(circ * scale) / 4 - seg.acumAntes * scale}
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

// Traduce claves de permisos a IDs reales de la tabla categorias (misma lógica que Inventario)
function traducirClaves(claves, allCats) {
  if (!claves || claves.includes('todos')) return ['todos']
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')
  return claves.map(clave => {
    if (allCats.some(c => c.id === clave)) return clave
    const claveNorm = norm(clave.replace(/_/g, ' '))
    return allCats.find(c => norm(c.label) === claveNorm)?.id ?? null
  }).filter(Boolean)
}

export default function Dashboard({ usuario }) {
  const esAdmin = usuario?.rol === 'admin'

  const [bienes,               setBienes]               = useState([])
  const [categorias,           setCategorias]           = useState([])
  const [categoriasPermitidas, setCategoriasPermitidas] = useState(['todos'])
  const [actividades,          setActividades]          = useState(null)
  const [cargando,             setCargando]             = useState(true)
  const [categoriaFiltro,      setCategoriaFiltro]      = useState(null)
  const [estadoFiltro,         setEstadoFiltro]         = useState(null)

  useEffect(() => {
    const cargar = async () => {
      const queries = [
        supabase.from('bienes').select('categoria, estado, ubicacion'),
        supabase.from('categorias').select('id, label, icon'),
      ]
      if (!esAdmin && usuario?.id) {
        queries.push(
          supabase.from('permisos_usuario').select('categorias')
            .eq('usuario_id', usuario.id).maybeSingle()
        )
      }
      const results = await Promise.all(queries)
      const bData = results[0].data ?? []
      const cData = results[1].data ?? []
      const pd    = results[2]?.data ?? null

      setBienes(bData)
      setCategorias(cData)
      if (!esAdmin && pd?.categorias) {
        setCategoriasPermitidas(traducirClaves(pd.categorias, cData))
      }
      setCargando(false)
    }
    cargar()
  }, [])

  useEffect(() => {
    supabase.from('actividades').select('*').order('created_at', { ascending: false }).limit(3)
      .then(({ data }) => setActividades(data || []))

    const channel = supabase
      .channel('actividades-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'actividades' }, ({ new: row }) => {
        setActividades(prev => [row, ...(prev ?? [])].slice(0, 3))
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  if (cargando) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'rgba(255,255,255,0.55)', fontSize: 14 }}>
      <div style={{ textAlign: 'center' }}>
        <div className="dash-main-spin" />
        Cargando estadísticas...
      </div>
    </div>
  )

  // Filtrar bienes a categorías que el usuario puede ver
  const tieneAccesoCat = (catId) =>
    esAdmin || categoriasPermitidas.includes('todos') || categoriasPermitidas.includes(catId)

  const bienesPermitidos   = bienes.filter(b => tieneAccesoCat(b.categoria))
  const bienesPorCategoria = categoriaFiltro
    ? bienesPermitidos.filter(b => b.categoria === categoriaFiltro)
    : bienesPermitidos
  const bienesFiltrados    = estadoFiltro
    ? bienesPorCategoria.filter(b => b.estado === estadoFiltro)
    : bienesPorCategoria

  const total    = bienesFiltrados.length
  const enBueno  = bienesFiltrados.filter(b => b.estado === 'Bueno').length
  const enBaja   = bienesFiltrados.filter(b => b.estado === 'Baja').length
  const pctBueno = total > 0 ? Math.round((enBueno / total) * 100) : 0

  const estadoDatos = ['Bueno', 'Regular', 'Malo', 'Baja'].map(e => ({
    estado: e,
    count: bienesPorCategoria.filter(b => b.estado === e).length,
  }))

  // Solo mostrar categorías a las que el usuario tiene acceso
  const catGrid   = categorias
    .filter(c => tieneAccesoCat(c.id))
    .map(c => ({ ...c, count: bienesPermitidos.filter(b => b.categoria === c.id).length }))
    .sort((a, b) => b.count - a.count)
  const catActiva = categorias.find(c => c.id === categoriaFiltro)

  const toggleEstado    = e  => setEstadoFiltro(prev => prev === e ? null : e)
  const toggleCategoria = id => { setCategoriaFiltro(prev => prev === id ? null : id); setEstadoFiltro(null) }

  const KPI_CONFIG = [
    { label: categoriaFiltro ? `Total en ${catActiva?.label}` : 'Total de bienes', valor: total,          icono: '📦', color: '#1a237e', bg: '#e8eaf6' },
    { label: 'Categorías',                                                          valor: catGrid.length,    icono: '📂', color: '#92700a', bg: '#fef9e7' },
    { label: 'En buen estado',                                                      valor: `${pctBueno}%`, icono: '✅', color: '#16a34a', bg: '#f0fdf4' },
    { label: 'Dados de baja',                                                       valor: enBaja,         icono: '🗑️', color: '#dc2626', bg: '#fef2f2' },
  ]

  return (
    <div className="dash-wrap">

      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: 21, fontWeight: 700, color: '#ffffff', margin: 0, letterSpacing: '-0.01em' }}>
          Bienvenido, <span style={{ color: '#f0d060' }}>{usuario?.nombre}</span> 👋
        </h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: '5px 0 0' }}>
          Resumen general del inventario del liceo
        </p>
      </div>

      <div className="dash-kpis">
        {KPI_CONFIG.map((kpi, i) => (
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

      <div className="dash-charts">
        <div className="dash-card">
          <p style={secTitle}>Distribución por estado</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <DonutChart datos={estadoDatos} total={bienesFiltrados.length} estadoActivo={estadoFiltro} onEstadoClick={toggleEstado} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {estadoDatos.map(d => {
                const pct = bienesPorCategoria.length > 0 ? Math.round((d.count / bienesPorCategoria.length) * 100) : 0
                return (
                  <div key={d.estado} onClick={() => toggleEstado(d.estado)} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    cursor: 'pointer', borderRadius: 8, padding: '5px 10px',
                    background: estadoFiltro === d.estado ? ESTADO_BG[d.estado] : 'transparent',
                    border: `1px solid ${estadoFiltro === d.estado ? ESTADO_COLOR[d.estado] + '40' : 'transparent'}`,
                    opacity: (!estadoFiltro || estadoFiltro === d.estado) ? 1 : 0.35,
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

        <ActividadReciente actividades={actividades} />
      </div>

      <InventarioPorUbicacion bienes={bienesPermitidos} />

      <div className="dash-card">
        <p style={secTitle}>Todas las categorías</p>
        <div className="dash-cat-grid">
          {catGrid.map(c => {
            const activa = categoriaFiltro === c.id
            return (
              <div key={c.id} onClick={() => toggleCategoria(c.id)} style={{
                background: activa ? '#1a237e' : (c.count > 0 ? '#f0f2ff' : '#f9fafb'),
                border: `2px solid ${activa ? '#d4a017' : (c.count > 0 ? 'rgba(212,160,23,0.25)' : '#e5e7eb')}`,
                borderRadius: 12, padding: '0.9rem', textAlign: 'center', cursor: 'pointer',
                transition: 'all 0.2s',
                transform: activa ? 'translateY(-2px)' : 'none',
                boxShadow: activa ? '0 6px 20px rgba(26,35,126,0.3)' : 'none',
              }}>
                <div style={{ fontSize: 26, marginBottom: 6 }}>{c.icon}</div>
                <div style={{ fontSize: 12, color: activa ? '#f0d060' : '#374151', fontWeight: 600, marginBottom: 4, lineHeight: 1.3 }}>{c.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: activa ? '#ffffff' : (c.count > 0 ? '#1a237e' : '#d1d5db') }}>{c.count}</div>
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
