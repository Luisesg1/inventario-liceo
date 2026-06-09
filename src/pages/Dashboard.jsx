import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  Package2, FolderOpen, TrendingUp, Archive,
  PlusCircle, Pencil, Wrench,
  Ticket, Activity, Clock,
  ArrowRight, ClipboardList, CheckCircle2, CircleDot, XCircle,
  UserX, Bell, ChevronRight, ChevronDown,
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

/* ── BarChart ────────────────────────────────────────────── */
function getTicketChartData(tickets, periodo) {
  const now = new Date()
  if (periodo === 'semana') {
    const days = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      const label = d.toLocaleDateString('es-CL', { weekday: 'short' }).replace('.', '')
      days.push({ label, key, count: 0 })
    }
    tickets?.forEach(t => {
      const key = (t.creado_en ?? '').slice(0, 10)
      const found = days.find(d => d.key === key)
      if (found) found.count++
    })
    return days
  }
  if (periodo === 'mes') {
    const year = now.getFullYear(), month = now.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const weeks = []
    for (let start = 1; start <= daysInMonth; start += 7) {
      const end = Math.min(start + 6, daysInMonth)
      weeks.push({ label: `${start}-${end}`, start, end, count: 0 })
    }
    tickets?.forEach(t => {
      const d = new Date(t.creado_en)
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate()
        const w = weeks.find(w => day >= w.start && day <= w.end)
        if (w) w.count++
      }
    })
    return weeks
  }
  const year = now.getFullYear()
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
    .map((label, i) => ({ label, count: 0, idx: i }))
  tickets?.forEach(t => {
    const d = new Date(t.creado_en)
    if (d.getFullYear() === year) meses[d.getMonth()].count++
  })
  return meses
}

function BarChart({ datos, color = '#1a237e' }) {
  const max = Math.max(...datos.map(d => d.count), 1)
  const H = 72
  return (
    <div style={{ width: '100%', paddingBottom: 4 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: H + 30 }}>
        {datos.map((d, i) => {
          const barH = d.count > 0 ? Math.max(Math.round((d.count / max) * H), 6) : 0
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color, opacity: d.count > 0 ? 0.9 : 0, lineHeight: 1, height: 12 }}>{d.count || ''}</span>
              {/* Pista de fondo + barra */}
              <div style={{
                width: 16, height: H, borderRadius: 6,
                background: '#f1f5f9',
                display: 'flex', alignItems: 'flex-end',
                overflow: 'hidden', flexShrink: 0,
              }}>
                <div style={{
                  width: '100%', height: barH,
                  background: color,
                  borderRadius: 6,
                  opacity: 0.9,
                  transition: 'height 0.4s ease',
                }} />
              </div>
              <span style={{ fontSize: 9, color: '#94a3b8', textAlign: 'center', lineHeight: 1.2 }}>{d.label}</span>
            </div>
          )
        })}
      </div>
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
const TIPO_AUSENCIA_LABEL = {
  licencia_medica:        'Licencia médica',
  permiso_administrativo: 'Permiso administrativo',
  justificativo:          'Ausencia sin justificar',
  dias_compensatorios:    'Días compensatorios',
}

const JORNADA_LABEL = {
  dia_completo:  'Día completo',
  medio_dia:     'Medio día',
  personalizado: 'Personalizado',
  reposo:        'Desde / Hasta',
}

function fmtFecha(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export default function Dashboard({ usuario, onIrATickets, onIrARequerimientos, onIrAInventario, onIrAAusencias, puedeVerAlertasTickets = false, puedeVerInventario = false, puedeVerRequerimientos = false, puedeVerAusencias = false, puedeGestionarTickets = false }) {
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
  const [ausentesHoy,          setAusentesHoy]          = useState(null)
  const [ausentesPorTipo,      setAusentesPorTipo]      = useState({})
  const [ausentesDetalle,      setAusentesDetalle]      = useState([])
  const [ausentesExpandido,    setAusentesExpandido]    = useState(false)
  const [ticketPeriodo,        setTicketPeriodo]        = useState('semana')
  const [reqAño,               setReqAño]               = useState(new Date().getFullYear())

  useEffect(() => {
    const cargar = async () => {
      if (!puedeVerInventario) { setCargando(false); return }
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
      if (!esGestor && !puedeGestionarTickets && usuario?.id) qT = qT.eq('creado_por', usuario.id)
      const [{ data: tData }, { data: rData }] = await Promise.all([
        qT,
        supabase.from('requerimientos').select('estado, monto_solicitado, monto_real, fondo, fecha'),
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

  // Personas ausentes hoy (solo permiso_administrativo + justificativo vigentes hoy)
  useEffect(() => {
    const cargarAusentes = async () => {
      if (!puedeVerAusencias) { setAusentesHoy(null); return }
      const hoy = new Date().toISOString().slice(0, 10)
      const normRut = r => (r ?? '').replace(/[.\-\s]/g, '').toLowerCase()
      const [{ data: us }, { data }] = await Promise.all([
        supabase.from('usuarios').select('id, rut, nombre'),
        supabase.from('ausencias')
          .select('usuario_id, externo_rut, externo_nombre, snapshot_rut, snapshot_nombre, tipo, jornada, periodo, hora_inicio, hora_fin, fecha_inicio, fecha_fin, notas, usuario:usuario_id(id, rut, nombre)')
          .in('tipo', ['permiso_administrativo', 'justificativo'])
          .lte('fecha_inicio', hoy).gte('fecha_fin', hoy),
      ])
      const usuariosList = us ?? []
      const tipoPorKey    = new Map()  // key → tipo
      const detallePorKey = new Map()  // key → registro de detalle
      ;(data ?? []).forEach(p => {
        let key    = null
        let nombre = null
        let rut    = null
        if (p.usuario) {
          rut    = p.usuario.rut ?? null
          nombre = p.usuario.nombre ?? null
          key    = rut ? normRut(rut) : p.usuario.id
        } else if (p.externo_nombre) {
          nombre = p.externo_nombre
          rut    = p.externo_rut ?? null
          key    = rut ? normRut(rut) : 'ext:' + p.externo_nombre
        } else if (p.snapshot_rut) {
          rut    = p.snapshot_rut
          nombre = p.snapshot_nombre ?? null
          const found = usuariosList.find(u => normRut(u.rut ?? '') === normRut(p.snapshot_rut))
          if (found) {
            key    = found.rut ? normRut(found.rut) : found.id
            nombre = nombre ?? found.nombre ?? null
          }
        }
        if (key && !tipoPorKey.has(key)) {
          tipoPorKey.set(key, p.tipo)
          detallePorKey.set(key, { nombre, rut, tipo: p.tipo, jornada: p.jornada, periodo: p.periodo, hora_inicio: p.hora_inicio, hora_fin: p.hora_fin, fecha_inicio: p.fecha_inicio, fecha_fin: p.fecha_fin, notas: p.notas })
        }
      })
      const porTipo = {}
      tipoPorKey.forEach(tipo => {
        const t = tipo || 'otro'
        porTipo[t] = (porTipo[t] ?? 0) + 1
      })
      setAusentesHoy(tipoPorKey.size)
      setAusentesPorTipo(porTipo)
      setAusentesDetalle([...detallePorKey.values()])
    }
    cargarAusentes()
    if (!puedeVerAusencias) return
    const ch = supabase.channel('dash-ausencias-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ausencias' }, cargarAusentes)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [puedeVerAusencias])

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
    { label: categoriaFiltro ? `Total en ${catActiva?.label}` : 'Total de bienes', valor: total,          Icon: Package2,   color: '#1a237e', bg: '#eef0ff', iconBg: '#e8eaf6', onClick: onIrAInventario },
    { label: 'Categorías',                                                          valor: catGrid.length, Icon: FolderOpen, color: '#92700a', bg: '#fef9e7', iconBg: '#fef3c7' },
    { label: 'En buen estado',                                                      valor: `${pctBueno}%`, Icon: TrendingUp, color: '#16a34a', bg: '#f0fdf4', iconBg: '#dcfce7' },
    { label: 'Dados de baja',                                                       valor: enBaja,         Icon: Archive,    color: '#dc2626', bg: '#fef2f2', iconBg: '#fee2e2' },
  ]

  /* ── Stats tickets (filtrados por período seleccionado) ─ */
  const ahoraT = new Date()
  const ticketsPeriodo = (statsTickets ?? []).filter(t => {
    const d = new Date(t.creado_en)
    if (isNaN(d)) return false
    if (ticketPeriodo === 'semana') {
      const desde = new Date(ahoraT); desde.setHours(0, 0, 0, 0); desde.setDate(desde.getDate() - 6)
      return d >= desde
    }
    if (ticketPeriodo === 'mes') {
      return d.getFullYear() === ahoraT.getFullYear() && d.getMonth() === ahoraT.getMonth()
    }
    return d.getFullYear() === ahoraT.getFullYear()
  })
  const tTotal     = ticketsPeriodo.length
  const tAbiertos  = ticketsPeriodo.filter(t => t.estado === 'Abierto').length
  const tEnProceso = ticketsPeriodo.filter(t => t.estado === 'En proceso').length
  const tResueltos = ticketsPeriodo.filter(t => t.estado === 'Resuelto').length
  const tRecientes = statsTickets
    ?.filter(t => t.estado === 'Abierto')
    .slice(0, 3) ?? []
  const periodoLabel = { semana: 'esta semana', mes: 'este mes', año: 'este año' }[ticketPeriodo]

  const tTotalGlobal    = statsTickets?.length ?? 0
  const tAbiertosTotal  = statsTickets?.filter(t => t.estado === 'Abierto').length ?? 0
  const tEnProcesoTotal = statsTickets?.filter(t => t.estado === 'En proceso').length ?? 0
  const tResueltosTotal = statsTickets?.filter(t => t.estado === 'Resuelto').length ?? 0

  /* ── Stats requerimientos (filtrados por año) ────────── */
  const statsReqsAño = statsReqs?.filter(r => {
    if (!r.fecha) return true
    return new Date(r.fecha + 'T00:00:00').getFullYear() === reqAño
  }) ?? []

  const rTotal     = statsReqsAño.length
  const rEnProceso = statsReqsAño.filter(r =>
    ['En proceso','Revisión DAEM','En adquisiciones','Enviado al DAEM','Reenviado'].includes(r.estado)
  ).length
  const rComprados = statsReqsAño.filter(r =>
    ['Comprado','Contratado','En ejecución'].includes(r.estado)
  ).length
  const rRechazados = statsReqsAño.filter(r =>
    (r.estado ?? '').startsWith('Rechazado') || r.estado === 'Devuelto'
  ).length
  const rMontoSol  = statsReqsAño.reduce((acc, r) => acc + (Number(r.monto_solicitado) || 0), 0)
  const rMontoReal = statsReqsAño.reduce((acc, r) => acc + (Number(r.monto_real)       || 0), 0)

  /* ── Render ──────────────────────────────────────────── */
  return (
    <motion.div
      className="dash-wrap"
      initial={rm ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
    >

      {/* ── SECCIÓN 1: Resumen General ── */}
      <section className="dash-section-block">
        <SectionTitle icon={Activity} label="Resumen General" />
        <motion.div
          className="dash-welcome"
          initial={rm ? false : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h2>
            Bienvenido, <span className="dash-welcome-accent">{usuario?.nombre}</span>
          </h2>
          {categoriaFiltro && <p>{catActiva?.label}</p>}
        </motion.div>
      </section>

      {/* ── SECCIÓN 1b: Alerta de tickets pendientes ── */}
      {puedeVerAlertasTickets && tAbiertosTotal > 0 && (
      <motion.section
        className="dash-section-block"
        initial={rm ? false : { opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
      >
        <div style={{
          background: esSoporte ? '#e0f2fe' : '#eff6ff',
          border: `1.5px solid ${esSoporte ? '#7dd3fc' : '#bfdbfe'}`,
          borderRadius: 14, padding: '14px 16px',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>

          {/* Cabecera */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                background: esSoporte ? '#0369a1' : '#1d4ed8',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Bell size={16} style={{ color: '#fff' }} strokeWidth={2.5} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: '#0f172a', lineHeight: 1.3 }}>
                  {esGestor
                    ? `${tAbiertosTotal} ${tAbiertosTotal === 1 ? 'ticket abierto' : 'tickets abiertos'} en el sistema`
                    : `Tienes ${tAbiertosTotal} ${tAbiertosTotal === 1 ? 'ticket abierto' : 'tickets abiertos'}`}
                </p>
                {tEnProcesoTotal > 0 && (
                  <p style={{ margin: 0, fontSize: 11.5, color: '#475569', marginTop: 2 }}>
                    + {tEnProcesoTotal} {tEnProcesoTotal === 1 ? 'ticket en revisión' : 'tickets en revisión'}
                  </p>
                )}
              </div>
            </div>
            {onIrATickets && (
              <button
                onClick={() => onIrATickets('Abierto')}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: esSoporte ? '#0369a1' : '#1d4ed8',
                  color: '#fff', border: 'none', borderRadius: 9,
                  padding: '7px 14px', fontSize: 12.5, fontWeight: 700,
                  cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                  transition: 'opacity 0.15s',
                }}
                onMouseOver={e => { e.currentTarget.style.opacity = '0.87' }}
                onMouseOut={e => { e.currentTarget.style.opacity = '1' }}
              >
                Ver tickets <ArrowRight size={12} />
              </button>
            )}
          </div>

          {/* Lista de tickets recientes (recuperado) */}
          {tRecientes.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {tRecientes.map((t, i) => (
                <motion.div
                  key={i}
                  onClick={() => onIrATickets?.('Abierto')}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                    padding: '7px 10px', borderRadius: 9,
                    background: 'rgba(255,255,255,0.72)',
                    border: '1px solid rgba(59,130,246,0.14)',
                    cursor: onIrATickets ? 'pointer' : 'default',
                  }}
                  whileHover={onIrATickets && !rm ? { backgroundColor: 'rgba(255,255,255,0.96)' } : {}}
                  transition={{ duration: 0.12 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <CircleDot size={13} style={{ color: '#1d4ed8', flexShrink: 0 }} strokeWidth={2.5} />
                    <span style={{
                      fontSize: 12.5, fontWeight: 600, color: '#1e293b',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {t.titulo}
                    </span>
                    {t.area_reporte && (
                      <span style={{ fontSize: 11, color: '#64748b', flexShrink: 0, whiteSpace: 'nowrap' }}>
                        — {t.area_reporte}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                    {t.prioridad && (
                      <span style={{
                        fontSize: 10.5, fontWeight: 700, borderRadius: 20, padding: '2px 8px',
                        background: PRIORIDAD_BG[t.prioridad] ?? '#f3f4f6',
                        color: PRIORIDAD_COLOR[t.prioridad] ?? '#374151',
                        textTransform: 'capitalize',
                      }}>
                        {t.prioridad}
                      </span>
                    )}
                    <ChevronRight size={13} style={{ color: '#94a3b8' }} strokeWidth={2} />
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.section>
      )}

      {/* ── SECCIÓN 2: Ausencias ── */}
      {ausentesHoy !== null && (
      <section className="dash-section-block">
        <SectionTitle icon={UserX} label="Ausencias" iconBg="#fee2e2" iconColor="#dc2626" />
        <motion.div
          initial={rm ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{
            background: ausentesHoy === 0 ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${ausentesHoy === 0 ? '#bbf7d0' : '#fecaca'}`,
            borderRadius: 10,
            color: ausentesHoy === 0 ? '#15803d' : '#b91c1c',
            alignSelf: 'flex-start',
            maxWidth: '100%',
            overflow: 'hidden',
          }}
        >
          {/* Fila principal (siempre visible) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', flexWrap: 'wrap' }}>
            {ausentesHoy === 0
              ? <CheckCircle2 size={16} strokeWidth={2.2} style={{ flexShrink: 0 }} />
              : <UserX size={16} strokeWidth={2.2} style={{ flexShrink: 0 }} />}
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap' }}>
              {ausentesHoy === 0
                ? 'Hoy no hay personal ausente'
                : `Hoy hay ${ausentesHoy} ${ausentesHoy === 1 ? 'persona ausente' : 'personas ausentes'}`}
            </p>
            {ausentesHoy > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {Object.entries(ausentesPorTipo).map(([tipo, n]) => (
                  <span key={tipo} style={{
                    fontSize: 11.5, fontWeight: 600, color: '#b91c1c',
                    background: '#fff', border: '1px solid #fecaca',
                    borderRadius: 20, padding: '1px 9px', whiteSpace: 'nowrap',
                  }}>
                    {n} {TIPO_AUSENCIA_LABEL[tipo] ?? 'Otro'}
                  </span>
                ))}
              </span>
            )}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
              {onIrAAusencias && (
                <button
                  onClick={onIrAAusencias}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    fontSize: 12, fontWeight: 700, color: ausentesHoy === 0 ? '#15803d' : '#b91c1c',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Ver todos <ArrowRight size={12} />
                </button>
              )}
              {ausentesHoy > 0 && (
                <button
                  onClick={() => setAusentesExpandido(v => !v)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    fontSize: 12, fontWeight: 700, color: '#b91c1c',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {ausentesExpandido ? 'Ocultar detalle' : 'Ver detalle'}
                  <ChevronDown size={13} style={{ transition: 'transform 0.2s', transform: ausentesExpandido ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                </button>
              )}
            </span>
          </div>

          {/* Detalle expandible */}
          <AnimatePresence initial={false}>
            {ausentesExpandido && ausentesHoy > 0 && (
              <motion.div
                key="detalle"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{
                  borderTop: '1px solid #fecaca',
                  padding: '8px 12px 10px',
                  display: 'flex', flexDirection: 'column', gap: 6,
                }}>
                  {ausentesDetalle.length === 0 ? (
                    <p style={{ margin: 0, fontSize: 13, color: '#b91c1c', opacity: 0.7 }}>No hay personas ausentes hoy.</p>
                  ) : ausentesDetalle.map((a, i) => {
                    const mismaFecha = a.fecha_inicio === a.fecha_fin
                    const fechaStr = mismaFecha
                      ? fmtFecha(a.fecha_inicio)
                      : `${fmtFecha(a.fecha_inicio)} al ${fmtFecha(a.fecha_fin)}`
                    let jornadaStr = JORNADA_LABEL[a.jornada] ?? a.jornada ?? ''
                    if (a.jornada === 'medio_dia' && a.periodo) jornadaStr += ` (${a.periodo.toUpperCase()})`
                    if (a.jornada === 'personalizado' && a.hora_inicio && a.hora_fin) jornadaStr += ` ${a.hora_inicio}–${a.hora_fin}`
                    return (
                      <div key={i} style={{
                        background: '#fff',
                        border: '1px solid #fecaca',
                        borderRadius: 8,
                        padding: '7px 10px',
                        fontSize: 12.5,
                      }}>
                        <div style={{ fontWeight: 700, color: '#7f1d1d', marginBottom: 2 }}>
                          {a.nombre ?? '(sin nombre)'}
                          {a.rut && <span style={{ fontWeight: 400, color: '#b91c1c', marginLeft: 6 }}>{a.rut}</span>}
                        </div>
                        <div style={{ color: '#b91c1c', display: 'flex', flexWrap: 'wrap', gap: '2px 8px' }}>
                          <span>{TIPO_AUSENCIA_LABEL[a.tipo] ?? a.tipo}</span>
                          <span style={{ opacity: 0.5 }}>·</span>
                          <span>{jornadaStr}</span>
                          <span style={{ opacity: 0.5 }}>·</span>
                          <span>{fechaStr}</span>
                        </div>
                        {a.notas && (
                          <div style={{ marginTop: 3, color: '#7f1d1d', opacity: 0.75, fontSize: 12, fontStyle: 'italic' }}>
                            {a.notas}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </section>
      )}

      {/* ── SECCIÓN SOPORTE/ADMIN: métricas de tickets ── */}
      {(esGestor || puedeGestionarTickets) && (
      <section className="dash-section-block">
        <SectionTitle icon={Ticket} label="Estado actual de tickets" iconBg="#e0f2fe" iconColor="#0369a1" />
        <div className="dash-kpis">
          {[
            { label: 'Abiertos',   valor: tAbiertosTotal,  color: '#1d4ed8', bg: '#dbeafe', iconBg: '#eff6ff', Icon: CircleDot,    onClick: () => onIrATickets?.('Abierto') },
            { label: 'En revisión',valor: tEnProcesoTotal, color: '#854d0e', bg: '#fef9c3', iconBg: '#fef3c7', Icon: Activity,     onClick: () => onIrATickets?.('En proceso') },
            { label: 'Resueltos',  valor: tResueltosTotal, color: '#166534', bg: '#dcfce7', iconBg: '#f0fdf4', Icon: CheckCircle2, onClick: () => onIrATickets?.('Resuelto') },
            { label: 'Total',      valor: tTotalGlobal,    color: '#1a237e', bg: '#eef0ff', iconBg: '#e8eaf6', Icon: Ticket,       onClick: onIrATickets },
          ].map((kpi, i) => (
            <motion.div
              key={i}
              className="dash-kpi-card"
              style={{ '--kpi-color': kpi.color, cursor: kpi.onClick ? 'pointer' : 'default' }}
              onClick={kpi.onClick}
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
                {kpi.onClick && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 6, fontSize: 12, fontWeight: 700, color: kpi.color }}>
                    Ver <ArrowRight size={12} />
                  </span>
                )}
              </div>
              <div className="kpi-icon-chip" style={{ background: kpi.iconBg }}>
                <kpi.Icon size={20} style={{ color: kpi.color }} strokeWidth={2} />
              </div>
            </motion.div>
          ))}
        </div>
      </section>
      )}

      {/* ── SECCIÓN 3: Inventario ── */}
      {puedeVerInventario && <section className="dash-section-block">
        <SectionTitle icon={Package2} label="Inventario" iconBg="#e8eaf6" iconColor="#1a237e" />
        <div className="dash-kpis">
        {KPI_CONFIG.map((kpi, i) => (
          <motion.div
            key={i}
            className="dash-kpi-card"
            style={{ '--kpi-color': kpi.color, cursor: kpi.onClick ? 'pointer' : 'default' }}
            onClick={kpi.onClick}
            title={kpi.onClick ? 'Ver inventario' : undefined}
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
              {kpi.onClick && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 6, fontSize: 12, fontWeight: 700, color: kpi.color }}>
                  Ver todos <ArrowRight size={12} />
                </span>
              )}
            </div>
            <div className="kpi-icon-chip" style={{ background: kpi.iconBg }}>
              <kpi.Icon size={20} style={{ color: kpi.color }} strokeWidth={2} />
            </div>
          </motion.div>
        ))}
        </div>
      </section>}

      {/* ── Fila inferior: Tickets + Requerimientos ── */}
      {(onIrATickets || puedeVerRequerimientos) && <div className="dash-bottom-grid" style={(!puedeVerRequerimientos || !onIrATickets) ? { gridTemplateColumns: '1fr' } : undefined}>

        {/* Tickets */}
        {onIrATickets && <motion.div
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

          {/* Selector de período */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {['semana', 'mes', 'año'].map(p => (
              <button
                key={p}
                onClick={() => setTicketPeriodo(p)}
                style={{
                  padding: '4px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, textTransform: 'capitalize',
                  background: ticketPeriodo === p ? '#1a237e' : '#f1f5f9',
                  color: ticketPeriodo === p ? '#fff' : '#64748b',
                  transition: 'all 0.18s',
                }}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>

          {/* Gráfico de barras */}
          <BarChart datos={getTicketChartData(statsTickets, ticketPeriodo)} color="#1a237e" />

          {/* Resumen de estados del período seleccionado */}
          <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap', alignItems: 'baseline' }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              {tTotal} {tTotal === 1 ? 'ticket' : 'tickets'} {periodoLabel}
            </span>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              Abiertos: <strong style={{ color: '#1d4ed8' }}>{tAbiertos}</strong>
            </span>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              En proceso: <strong style={{ color: '#854d0e' }}>{tEnProceso}</strong>
            </span>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              Resueltos: <strong style={{ color: '#166534' }}>{tResueltos}</strong>
            </span>
          </div>
        </motion.div>}

        {/* Requerimientos — solo si tiene permiso */}
        {puedeVerRequerimientos && <motion.div
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

          {/* Selector de año */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <button
              onClick={() => setReqAño(y => y - 1)}
              style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', padding: '1px 8px', fontSize: 14, color: '#64748b', lineHeight: 1.6 }}
            >‹</button>
            <span style={{ fontSize: 11.5, color: '#475569', fontWeight: 600, textAlign: 'center', flex: 1 }}>
              Estadística del 1 de Enero al 31 de Diciembre de {reqAño}
            </span>
            <button
              onClick={() => setReqAño(y => y + 1)}
              style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', padding: '1px 8px', fontSize: 14, color: '#64748b', lineHeight: 1.6 }}
            >›</button>
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
              <span className="dash-monto-sub">{statsReqsAño.filter(r => Number(r.monto_solicitado) > 0).length} req. con monto</span>
            </div>
            <div className="dash-monto-box dash-monto-box--real">
              <span className="dash-monto-label">Monto real</span>
              <span className="dash-monto-valor">{fmtMonto(rMontoReal)}</span>
              <span className="dash-monto-sub">{statsReqsAño.filter(r => Number(r.monto_real) > 0).length} req. con monto real</span>
            </div>
          </div>
        </motion.div>}

      </div>}
    </motion.div>
  )
}
