import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  Package2, FolderOpen, TrendingUp, Archive,
  PlusCircle, Pencil, Wrench,
  Ticket, Activity, Clock,
  ArrowRight, ClipboardList, CheckCircle2, CircleDot, XCircle,
} from 'lucide-react'
import { supabase } from '../supabase'
import './Dashboard.css'

/* ── Paletas ────────────────────────────────────────────── */
const ESTADO_COLOR = { Bueno: '#16a34a', Regular: '#d97706', Malo: '#dc2626', Baja: '#9ca3af' }
const ESTADO_BG    = { Bueno: '#dcfce7', Regular: '#fef3c7', Malo: '#fee2e2', Baja: '#f3f4f6' }

const PRIORIDAD_COLOR = { alta: '#dc2626', media: '#d97706', baja: '#16a34a' }
const PRIORIDAD_BG    = { alta: '#fee2e2', media: '#fef3c7', baja: '#dcfce7' }

const ACCION_META = {
  crear:         { color: '#16a34a', bg: '#dcfce7', Icon: PlusCircle, label: 'Creación',      verbo: 'agregó'                   },
  actualizar:    { color: '#2563eb', bg: '#dbeafe', Icon: Pencil,     label: 'Actualización',  verbo: 'actualizó'                },
  baja:          { color: '#dc2626', bg: '#fee2e2', Icon: Archive,    label: 'Baja',            verbo: 'dio de baja'              },
  eliminar:      { color: '#dc2626', bg: '#fee2e2', Icon: Archive,    label: 'Eliminación',     verbo: 'eliminó'                  },
  mantenimiento: { color: '#d97706', bg: '#fef3c7', Icon: Wrench,     label: 'Mantenimiento',   verbo: 'registró mantenimiento en'},
}

const TICKET_ESTADO = {
  'Abierto':    { color: '#1d4ed8', bg: '#dbeafe', Icon: CircleDot    },
  'En proceso': { color: '#854d0e', bg: '#fef9c3', Icon: Activity     },
  'Resuelto':   { color: '#166534', bg: '#dcfce7', Icon: CheckCircle2 },
}

/* ── Utilidades ─────────────────────────────────────────── */
function tiempoRelativo(fecha) {
  const min = Math.floor((Date.now() - new Date(fecha)) / 60000)
  if (min < 1)  return 'ahora mismo'
  if (min < 60) return `hace ${min} min`
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return `hace ${hrs} h`
  const dias = Math.floor(hrs / 24)
  return `hace ${dias} día${dias > 1 ? 's' : ''}`
}

function fmtMonto(v) {
  const n = Number(v)
  if (!n) return '$0'
  if (n >= 1000000) return '$' + (n / 1000000).toLocaleString('es-CL', { maximumFractionDigits: 1 }) + 'M'
  if (n >= 1000)    return '$' + Math.round(n / 1000).toLocaleString('es-CL') + 'k'
  return '$' + n.toLocaleString('es-CL')
}

function traducirClaves(claves, allCats) {
  if (!claves || claves.includes('todos')) return ['todos']
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]/g,'')
  return claves.map(clave => {
    if (allCats.some(c => c.id === clave)) return clave
    const claveNorm = norm(clave.replace(/_/g,' '))
    return allCats.find(c => norm(c.label) === claveNorm)?.id ?? null
  }).filter(Boolean)
}

/* ── KpiNumber — conteo animado ─────────────────────────── */
function KpiNumber({ value, rm }) {
  const pctSuffix = typeof value === 'string' && value.endsWith('%')
  const target    = pctSuffix ? parseInt(value) : (typeof value === 'number' ? value : null)
  const [count, setCount] = useState(0)
  const rafRef = useRef(null)

  useEffect(() => {
    if (target === null) return
    if (rm) { setCount(target); return }
    setCount(0)
    const start = performance.now()
    const tick = (now) => {
      const p = Math.min((now - start) / 650, 1)
      setCount(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [target, rm])

  if (target === null) return value
  return pctSuffix ? `${count}%` : count
}

/* ── DashboardSkeleton ───────────────────────────────────── */
function DashboardSkeleton() {
  return (
    <div className="dash-wrap">
      <div className="dash-skel dash-skel-welcome" />
      <div className="dash-kpis">
        {[0,1,2,3].map(i => <div key={i} className="dash-skel dash-skel-kpi" />)}
      </div>
      <div className="dash-charts">
        <div className="dash-skel dash-skel-chartcard" />
        <div className="dash-skel dash-skel-chartcard" />
      </div>
      <div className="dash-bottom-grid" style={{ marginTop: 14 }}>
        <div className="dash-skel dash-skel-bottomcard" />
        <div className="dash-skel dash-skel-bottomcard" />
      </div>
    </div>
  )
}

/* ── SectionTitle ───────────────────────────────────────── */
function SectionTitle({ icon: Icon, label, iconBg = '#eef0ff', iconColor = '#1a237e', extra }) {
  return (
    <div className="dash-section-title">
      <div className="dash-section-title-icon" style={{ background: iconBg }}>
        <Icon size={13} style={{ color: iconColor }} strokeWidth={2.5} />
      </div>
      <span className="dash-section-title-text">{label}</span>
      {extra}
    </div>
  )
}

/* ── DonutChart ─────────────────────────────────────────── */
function DonutChart({ datos, total, estadoActivo, onEstadoClick }) {
  const r = 54; const circ = 2 * Math.PI * r
  const [animado, setAnimado] = useState(false)
  useEffect(() => { const t = setTimeout(() => setAnimado(true), 60); return () => clearTimeout(t) }, [])

  if (total === 0) return (
    <svg width="160" height="160" viewBox="0 0 160 160" style={{ maxWidth: '100%' }}>
      <circle cx={80} cy={80} r={r} fill="none" stroke="#e5e7eb" strokeWidth="20" />
      <text x={80} y={85} textAnchor="middle" fontSize="13" fill="#9ca3af">Sin datos</text>
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
    <svg width="160" height="160" viewBox="0 0 160 160" style={{ cursor: 'pointer', flexShrink: 0, maxWidth: '100%' }}>
      {segmentos.map((seg, i) => {
        const activo = !estadoActivo || seg.estado === estadoActivo
        const r2 = estadoActivo === seg.estado ? 56 : r
        const scale = r2 / r
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
              transition: `stroke-dasharray 0.65s cubic-bezier(0.4,0,0.2,1) ${i * 0.08}s, opacity 0.25s, stroke-width 0.25s`,
            }}
            onClick={() => onEstadoClick(seg.estado)}
          />
        )
      })}
      <text x={80} y={74} textAnchor="middle" fontSize="22" fontWeight="800" fill="#1a237e" fontFamily="Inter, system-ui">{total}</text>
      <text x={80} y={90} textAnchor="middle" fontSize="11" fill="#94a3b8" fontFamily="Inter, system-ui">bienes</text>
    </svg>
  )
}

/* ── ActividadReciente ──────────────────────────────────── */
function ActividadReciente({ actividades, rm }) {
  return (
    <div className="dash-card dash-actividad">
      <SectionTitle icon={Activity} label="Actividad reciente" />
      {actividades === null ? (
        <div style={{ display:'flex', alignItems:'center', gap:10, color:'#94a3b8', fontSize:13 }}>
          <div className="dash-mini-spin" />
          Cargando actividad...
        </div>
      ) : actividades.length === 0 ? (
        <div style={{ textAlign:'center', padding:'2rem 0', color:'#94a3b8' }}>
          <Clock size={28} style={{ margin:'0 auto 8px', display:'block', opacity:.4 }} />
          <p style={{ fontSize:13, margin:0 }}>Sin actividad registrada aún</p>
        </div>
      ) : (
        <div className="dash-act-list">
          <AnimatePresence initial={false}>
            {actividades.map((a, i) => {
              const meta = ACCION_META[a.accion] ?? ACCION_META.actualizar
              return (
                <motion.div
                  key={a.id}
                  className="dash-act-item"
                  style={{ borderLeftColor: meta.color }}
                  initial={rm ? false : { opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={rm ? {} : { opacity: 0, x: -10, transition: { duration: 0.18 } }}
                  transition={{ delay: i * 0.06, duration: 0.28, ease: 'easeOut' }}
                >
                  <div className="dash-act-badge" style={{ background: meta.bg, color: meta.color }}>
                    <meta.Icon size={14} strokeWidth={2.5} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="dash-act-desc">
                      <strong>{a.usuario_nombre}</strong>
                      {' '}<span style={{ color:'#94a3b8' }}>{meta.verbo}</span>{' '}
                      <span style={{ color:'#111827', fontWeight:600 }}>{a.bien_nombre}</span>
                    </p>
                    <p className="dash-act-time">{tiempoRelativo(a.created_at)}</p>
                  </div>
                  <span className="dash-act-pill" style={{ background: meta.bg, color: meta.color }}>
                    {meta.label}
                  </span>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   DASHBOARD PRINCIPAL
   ══════════════════════════════════════════════════════════ */
export default function Dashboard({ usuario, onIrATickets, onIrARequerimientos }) {
  const rm = useReducedMotion()

  const esAdmin   = usuario?.rol === 'admin'
  const esSoporte = usuario?.rol === 'soporte'
  const esGestor  = esAdmin || esSoporte

  const [bienes,               setBienes]               = useState([])
  const [categorias,           setCategorias]           = useState([])
  const [categoriasPermitidas, setCategoriasPermitidas] = useState(['todos'])
  const [actividades,          setActividades]          = useState(null)
  const [cargando,             setCargando]             = useState(true)
  const [categoriaFiltro,      setCategoriaFiltro]      = useState(null)
  const [estadoFiltro,         setEstadoFiltro]         = useState(null)
  const [statsTickets,         setStatsTickets]         = useState(null)
  const [statsReqs,            setStatsReqs]            = useState(null)

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
      setBienes(bData); setCategorias(cData)
      if (!esAdmin && pd?.categorias) setCategoriasPermitidas(traducirClaves(pd.categorias, cData))
      setCargando(false)
    }
    cargar()
  }, [])

  useEffect(() => {
    const cargarStats = async () => {
      let qT = supabase.from('tickets').select('estado, prioridad, titulo, creado_por_nombre, area_reporte, lugar_falla, creado_en')
      if (!esGestor && usuario?.id) qT = qT.eq('creado_por', usuario.id)
      const [{ data: tData }, { data: rData }] = await Promise.all([
        qT,
        supabase.from('requerimientos').select('estado, monto_solicitado, monto_real, fondo'),
      ])
      setStatsTickets(tData ?? [])
      setStatsReqs(rData ?? [])
    }
    cargarStats()

    const chT = supabase.channel('dash-tickets-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, cargarStats)
      .subscribe()
    const chR = supabase.channel('dash-reqs-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requerimientos' }, cargarStats)
      .subscribe()
    return () => { supabase.removeChannel(chT); supabase.removeChannel(chR) }
  }, [])

  useEffect(() => {
    supabase.from('actividades').select('*').order('created_at', { ascending: false }).limit(3)
      .then(({ data }) => setActividades(data || []))
    const ch = supabase.channel('actividades-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'actividades' }, ({ new: row }) => {
        setActividades(prev => [row, ...(prev ?? [])].slice(0, 3))
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  if (cargando) return <DashboardSkeleton />

  /* ── Filtros inventario ──────────────────────────────── */
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

  const estadoDatos = ['Bueno','Regular','Malo','Baja'].map(e => ({
    estado: e, count: bienesPorCategoria.filter(b => b.estado === e).length,
  }))

  const catGrid   = categorias
    .filter(c => tieneAccesoCat(c.id))
    .map(c => ({ ...c, count: bienesPermitidos.filter(b => b.categoria === c.id).length }))
    .sort((a, b) => b.count - a.count)
  const catActiva = categorias.find(c => c.id === categoriaFiltro)

  const toggleEstado = e => setEstadoFiltro(prev => prev === e ? null : e)

  const KPI_CONFIG = [
    { label: categoriaFiltro ? `Total en ${catActiva?.label}` : 'Total de bienes', valor: total,          Icon: Package2,   color: '#1a237e', bg: '#eef0ff', iconBg: '#e8eaf6' },
    { label: 'Categorías',                                                          valor: catGrid.length, Icon: FolderOpen, color: '#92700a', bg: '#fef9e7', iconBg: '#fef3c7' },
    { label: 'En buen estado',                                                      valor: `${pctBueno}%`, Icon: TrendingUp, color: '#16a34a', bg: '#f0fdf4', iconBg: '#dcfce7' },
    { label: 'Dados de baja',                                                       valor: enBaja,         Icon: Archive,    color: '#dc2626', bg: '#fef2f2', iconBg: '#fee2e2' },
  ]

  /* ── Stats tickets ───────────────────────────────────── */
  const tTotal     = statsTickets?.length ?? 0
  const tAbiertos  = statsTickets?.filter(t => t.estado === 'Abierto').length ?? 0
  const tEnProceso = statsTickets?.filter(t => t.estado === 'En proceso').length ?? 0
  const tResueltos = statsTickets?.filter(t => t.estado === 'Resuelto').length ?? 0
  const tRecientes = statsTickets
    ?.filter(t => t.estado === 'Abierto')
    .slice(0, 3) ?? []

  /* ── Stats requerimientos ────────────────────────────── */
  const rTotal     = statsReqs?.length ?? 0
  const rEnProceso = statsReqs?.filter(r =>
    ['En proceso','Revisión DAEM','En adquisiciones','Enviado al DAEM','Reenviado'].includes(r.estado)
  ).length ?? 0
  const rComprados = statsReqs?.filter(r =>
    ['Comprado','Contratado','En ejecución'].includes(r.estado)
  ).length ?? 0
  const rRechazados = statsReqs?.filter(r =>
    (r.estado ?? '').startsWith('Rechazado') || r.estado === 'Devuelto'
  ).length ?? 0
  const rMontoSol  = statsReqs?.reduce((acc, r) => acc + (Number(r.monto_solicitado) || 0), 0) ?? 0
  const rMontoReal = statsReqs?.reduce((acc, r) => acc + (Number(r.monto_real)       || 0), 0) ?? 0

  /* ── Render ──────────────────────────────────────────── */
  return (
    <motion.div
      className="dash-wrap"
      initial={rm ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
    >

      {/* Welcome */}
      <motion.div
        className="dash-welcome"
        initial={rm ? false : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h2>
          Bienvenido, <span className="dash-welcome-accent">{usuario?.nombre}</span>
        </h2>
        <p>Resumen general del inventario{categoriaFiltro ? ` — ${catActiva?.label}` : ''}</p>
      </motion.div>

      {/* KPI Cards inventario */}
      <div className="dash-kpis">
        {KPI_CONFIG.map((kpi, i) => (
          <motion.div
            key={i}
            className="dash-kpi-card"
            style={{ '--kpi-color': kpi.color }}
            initial={rm ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07, duration: 0.32, ease: 'easeOut' }}
            whileHover={rm ? {} : { y: -4, transition: { duration: 0.2, ease: 'easeOut' } }}
          >
            <div className="kpi-body">
              <div className="kpi-valor" style={{ color: kpi.color }}>
                <KpiNumber value={kpi.valor} rm={rm} />
              </div>
              <div className="kpi-label">{kpi.label}</div>
            </div>
            <div className="kpi-icon-chip" style={{ background: kpi.iconBg }}>
              <kpi.Icon size={20} style={{ color: kpi.color }} strokeWidth={2} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts: Donut + Actividad */}
      <div className="dash-charts">
        <motion.div
          className="dash-card"
          initial={rm ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.3 }}
        >
          <SectionTitle icon={Activity} label="Distribución por estado" />
          <div className="dash-donut-wrap">
            <DonutChart
              datos={estadoDatos} total={bienesFiltrados.length}
              estadoActivo={estadoFiltro} onEstadoClick={toggleEstado}
            />
            <div className="dash-donut-leyenda">
              {estadoDatos.map(d => {
                const pct = bienesPorCategoria.length > 0
                  ? Math.round((d.count / bienesPorCategoria.length) * 100) : 0
                return (
                  <div
                    key={d.estado}
                    onClick={() => toggleEstado(d.estado)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      cursor: 'pointer', borderRadius: 9, padding: '5px 10px',
                      background: estadoFiltro === d.estado ? ESTADO_BG[d.estado] : 'transparent',
                      border: `1px solid ${estadoFiltro === d.estado ? ESTADO_COLOR[d.estado] + '40' : 'transparent'}`,
                      opacity: (!estadoFiltro || estadoFiltro === d.estado) ? 1 : 0.35,
                      transition: 'all 0.18s ease',
                    }}
                  >
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: ESTADO_COLOR[d.estado], flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: '#374151', minWidth: 54 }}>{d.estado}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{d.count}</span>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>{pct}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={rm ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.36, duration: 0.3 }}
        >
          <ActividadReciente actividades={actividades} rm={rm} />
        </motion.div>
      </div>

      {/* ── Fila inferior: Tickets + Requerimientos ── */}
      <div className="dash-bottom-grid">

        {/* Tickets */}
        <motion.div
          className="dash-card"
          initial={rm ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.42, duration: 0.3 }}
        >
          <div className="dash-resumen-header">
            <SectionTitle icon={Ticket} label="Tickets de soporte" iconBg="#fee2e2" iconColor="#dc2626" />
            {onIrATickets && (
              <button className="dash-resumen-link" onClick={onIrATickets}>
                Ver todos <ArrowRight size={12} />
              </button>
            )}
          </div>

          {/* KPI pills */}
          <div className="dash-stat-pills">
            <div
              className="dash-stat-pill dash-stat-pill--total dash-stat-pill--link"
              onClick={() => onIrATickets?.('')}
              title="Ver todos los tickets"
            >
              <span className="dsp-num">{tTotal}</span>
              <span className="dsp-label">Total</span>
            </div>
            {['Abierto','En proceso','Resuelto'].map(estado => {
              const cfg = TICKET_ESTADO[estado]
              const count = estado === 'Abierto' ? tAbiertos : estado === 'En proceso' ? tEnProceso : tResueltos
              return (
                <div
                  key={estado}
                  className="dash-stat-pill dash-stat-pill--link"
                  style={{ background: cfg.bg }}
                  onClick={() => onIrATickets?.(estado)}
                  title={`Ver tickets ${estado.toLowerCase()}`}
                >
                  <cfg.Icon size={14} style={{ color: cfg.color, flexShrink: 0 }} strokeWidth={2.5} />
                  <span className="dsp-num" style={{ color: cfg.color }}>{count}</span>
                  <span className="dsp-label">{estado}</span>
                </div>
              )
            })}
          </div>

          {/* Mini lista tickets abiertos recientes */}
          {tRecientes.length > 0 ? (
            <div className="dash-mini-list">
              <p className="dash-mini-list-title">Abiertos recientes</p>
              {tRecientes.map((t, i) => (
                <motion.div
                  key={t.id ?? i}
                  className="dash-mini-item"
                  initial={rm ? false : { opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.45 + i * 0.05 }}
                >
                  <div className="dash-mini-dot" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
                    <Ticket size={12} strokeWidth={2} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="dash-mini-titulo">{t.titulo || t.area_reporte || '—'}</p>
                    <p className="dash-mini-sub">
                      {t.creado_por_nombre}
                      {t.lugar_falla ? ` · ${t.lugar_falla}` : ''}
                      {' · '}{tiempoRelativo(t.creado_en)}
                    </p>
                  </div>
                  {t.prioridad && (
                    <span className="dash-mini-badge" style={{
                      background: PRIORIDAD_BG[t.prioridad],
                      color: PRIORIDAD_COLOR[t.prioridad],
                    }}>
                      {t.prioridad}
                    </span>
                  )}
                </motion.div>
              ))}
            </div>
          ) : statsTickets !== null && tAbiertos === 0 ? (
            <p className="dash-resumen-empty">
              <CheckCircle2 size={16} style={{ color: '#16a34a' }} /> Sin tickets abiertos
            </p>
          ) : null}
        </motion.div>

        {/* Requerimientos */}
        <motion.div
          className="dash-card"
          initial={rm ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.48, duration: 0.3 }}
        >
          <div className="dash-resumen-header">
            <SectionTitle icon={ClipboardList} label="Requerimientos" iconBg="#ecfdf5" iconColor="#059669" />
            {onIrARequerimientos && (
              <button className="dash-resumen-link" onClick={onIrARequerimientos}>
                Ver todos <ArrowRight size={12} />
              </button>
            )}
          </div>

          {/* KPI pills */}
          <div className="dash-stat-pills">
            <div
              className="dash-stat-pill dash-stat-pill--total dash-stat-pill--link"
              onClick={() => onIrARequerimientos?.(null)}
              title="Ver todos los requerimientos"
            >
              <span className="dsp-num">{rTotal}</span>
              <span className="dsp-label">Total</span>
            </div>
            <div
              className="dash-stat-pill dash-stat-pill--link"
              style={{ background: '#fef9c3' }}
              onClick={() => onIrARequerimientos?.('proceso')}
              title="Ver requerimientos en proceso"
            >
              <CircleDot size={14} style={{ color: '#854d0e', flexShrink: 0 }} strokeWidth={2.5} />
              <span className="dsp-num" style={{ color: '#854d0e' }}>{rEnProceso}</span>
              <span className="dsp-label">En proceso</span>
            </div>
            <div
              className="dash-stat-pill dash-stat-pill--link"
              style={{ background: '#dcfce7' }}
              onClick={() => onIrARequerimientos?.('comprados')}
              title="Ver requerimientos comprados"
            >
              <CheckCircle2 size={14} style={{ color: '#16a34a', flexShrink: 0 }} strokeWidth={2.5} />
              <span className="dsp-num" style={{ color: '#16a34a' }}>{rComprados}</span>
              <span className="dsp-label">Comprados</span>
            </div>
            <div
              className="dash-stat-pill dash-stat-pill--link"
              style={{ background: '#fee2e2' }}
              onClick={() => onIrARequerimientos?.('rechazados')}
              title="Ver requerimientos rechazados"
            >
              <XCircle size={14} style={{ color: '#dc2626', flexShrink: 0 }} strokeWidth={2.5} />
              <span className="dsp-num" style={{ color: '#dc2626' }}>{rRechazados}</span>
              <span className="dsp-label">Rechazados</span>
            </div>
          </div>

          {/* Montos destacados */}
          <div className="dash-montos-row">
            <div className="dash-monto-box dash-monto-box--sol">
              <span className="dash-monto-label">Monto solicitado</span>
              <span className="dash-monto-valor">{fmtMonto(rMontoSol)}</span>
              <span className="dash-monto-sub">{statsReqs?.filter(r => Number(r.monto_solicitado) > 0).length ?? 0} req. con monto</span>
            </div>
            <div className="dash-monto-box dash-monto-box--real">
              <span className="dash-monto-label">Monto real</span>
              <span className="dash-monto-valor">{fmtMonto(rMontoReal)}</span>
              <span className="dash-monto-sub">{statsReqs?.filter(r => Number(r.monto_real) > 0).length ?? 0} req. con monto real</span>
            </div>
          </div>
        </motion.div>

      </div>
    </motion.div>
  )
}
