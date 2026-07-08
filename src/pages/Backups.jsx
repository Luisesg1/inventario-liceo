// src/pages/Backups.jsx
// ═══════════════════════════════════════════════════════════════════════════
// MÓDULO BACKUPS — Gestión completa de respaldos del sistema (solo admin)
// ---------------------------------------------------------------------------
// Se apoya en la infraestructura existente:
//   · Bucket privado `backups` en Supabase Storage (fuente de verdad de los
//     archivos, tamaño y fecha de creación).
//   · Edge functions `backup-mensual` (crear) y `restaurar-backup` (restaurar).
//   · Tabla `backups_meta` (nombre personalizado, descripción, tipo, estado).
//   · audit_logs (modulo='backup') para la pestaña de Actividad.
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  HardDrive, Plus, Search, X, Download, RotateCcw, Copy, Trash2,
  Pencil, FileText, MoreVertical, Eye, ShieldAlert, Loader2, CheckCircle2,
  XCircle, AlertTriangle, Database, Files, Package, Clock, HardDriveDownload,
  CalendarClock, RefreshCw, Activity, ListChecks, CalendarDays,
  Info, Zap,
} from 'lucide-react'
import { supabase } from '../supabase'
import './Backups.css'

const BUCKET = 'backups'

// ── Catálogo de tipos y estados ─────────────────────────────────────────────
const TIPOS = {
  completo:    { label: 'Completo',        Icon: Package,  color: '#4f46e5', bg: '#eef2ff' },
  base_datos:  { label: 'Base de datos',   Icon: Database, color: '#0e7490', bg: '#ecfeff' },
  archivos:    { label: 'Archivos',        Icon: Files,    color: '#b45309', bg: '#fffbeb' },
}
const ESTADOS = {
  correcto:  { label: 'Correcto',   color: '#15803d', bg: '#dcfce7', border: '#86efac' },
  en_proceso:{ label: 'En proceso', color: '#92400e', bg: '#fef3c7', border: '#fcd34d' },
  error:     { label: 'Error',      color: '#b91c1c', bg: '#fee2e2', border: '#fca5a5' },
}
const ORIGENES = {
  manual:    { label: 'Manual',    emoji: '👤' },
  auto:      { label: 'Automático', emoji: '🤖' },
  seguridad: { label: 'Seguridad',  emoji: '🛡️' },
}
const FRECUENCIAS = [
  { key: 'desactivado', label: 'Desactivado' },
  { key: 'diario',      label: 'Diario' },
  { key: 'semanal',     label: 'Semanal' },
  { key: 'mensual',     label: 'Mensual' },
]

// Etiquetas de acciones para la pestaña Actividad
const ACT_META = {
  crear:      { label: 'Backup creado',        color: '#15803d', bg: '#dcfce7', Icon: Plus },
  descargar:  { label: 'Backup descargado',    color: '#7c3aed', bg: '#ede9fe', Icon: Download },
  renombrar:  { label: 'Backup renombrado',    color: '#2563eb', bg: '#dbeafe', Icon: Pencil },
  editar:     { label: 'Descripción editada',  color: '#0891b2', bg: '#ecfeff', Icon: FileText },
  duplicar:   { label: 'Backup duplicado',     color: '#c026d3', bg: '#fae8ff', Icon: Copy },
  eliminar:   { label: 'Backup eliminado',     color: '#dc2626', bg: '#fee2e2', Icon: Trash2 },
  restaurado: { label: 'Restauración',         color: '#b45309', bg: '#ffedd5', Icon: RotateCcw },
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function fmtBytes(n) {
  if (!n || n <= 0) return '—'
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(n) / Math.log(k))
  return `${parseFloat((n / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}
function fmtFechaHora(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function fmtFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}
function origenDeArchivo(nombre) {
  if (nombre.includes('_seguridad_')) return 'seguridad'
  if (nombre.includes('_auto_')) return 'auto'
  return 'manual'
}
function fechaDeArchivo(f) {
  if (f.created_at) return f.created_at
  const m = f.name.match(/(\d{4}-\d{2}-\d{2})/)
  return m ? `${m[1]}T12:00:00Z` : new Date().toISOString()
}
function nombrePorDefecto(nombre) {
  const origen = ORIGENES[origenDeArchivo(nombre)]
  const m = nombre.match(/(\d{4}-\d{2}-\d{2})/)
  return `Respaldo ${m ? m[1] : ''} · ${origen.label}`.trim()
}
function proximoAuto(frecuencia) {
  const hoy = new Date()
  if (frecuencia === 'diario')  { const d = new Date(hoy); d.setDate(d.getDate() + 1); return fmtFecha(d.toISOString()) }
  if (frecuencia === 'semanal') { const d = new Date(hoy); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); return fmtFecha(d.toISOString()) }
  if (frecuencia === 'mensual') { const d = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1); return fmtFecha(d.toISOString()) }
  return 'Desactivado'
}

const ETAPAS_CREAR = [
  'Recopilando datos del sistema…',
  'Serializando tablas…',
  'Comprimiendo respaldo…',
  'Subiendo al almacenamiento…',
  'Registrando en auditoría…',
]
const ETAPAS_REST = [
  'Validando backup…',
  'Creando backup de seguridad…',
  'Preparando restauración…',
  'Restaurando datos…',
  'Finalizando…',
]

export default function Backups({ usuario, permisos = {}, vista = 'respaldos', onIrAVista }) {
  const esAdmin = usuario?.rol === 'admin'
  // Permisos efectivos (admin recibe todo por bypass). El backend (RLS + edge
  // functions) sigue exigiendo rol='admin' para las operaciones reales.
  const p = {
    ver:               esAdmin || !!permisos.ver,
    crear:             esAdmin || !!permisos.crear,
    descargar:         esAdmin || !!permisos.descargar,
    renombrar:         esAdmin || !!permisos.renombrar,
    editarDescripcion: esAdmin || !!permisos.editarDescripcion,
    duplicar:          esAdmin || !!permisos.duplicar,
    restaurar:         esAdmin || !!permisos.restaurar,
    eliminar:          esAdmin || !!permisos.eliminar,
    automatizar:       esAdmin || !!permisos.automatizar,
    verActividad:      esAdmin || !!permisos.verActividad,
  }

  // ── Estado principal ──────────────────────────────────────────────────────
  const [archivos, setArchivos] = useState([])
  const [metaMap,  setMetaMap]  = useState({})
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)
  const [autoFrecuencia, setAutoFrecuencia] = useState('mensual')

  // Filtros
  const [q,        setQ]        = useState('')
  const [fUsuario, setFUsuario] = useState('')
  const [fTipo,    setFTipo]    = useState('')
  const [fEstado,  setFEstado]  = useState('')
  const [fOrigen,  setFOrigen]  = useState('')
  const [fDesde,   setFDesde]   = useState('')
  const [fHasta,   setFHasta]   = useState('')
  const [orden,    setOrden]    = useState({ campo: 'fecha', dir: 'desc' })

  // Modales / menús
  const [menuAbierto,    setMenuAbierto]    = useState(null)   // archivo con menú ⋮ abierto
  const [modalNuevo,     setModalNuevo]     = useState(false)
  const [modalRenombrar, setModalRenombrar] = useState(null)   // item
  const [modalDescrip,   setModalDescrip]   = useState(null)   // item
  const [modalDetalle,   setModalDetalle]   = useState(null)   // item
  const [modalRestaurar, setModalRestaurar] = useState(null)   // { item, fase, ... }
  const [modalEliminar,  setModalEliminar]  = useState(null)   // item
  const [modalDuplicar,  setModalDuplicar]  = useState(null)   // item
  const [modalAuto,      setModalAuto]      = useState(false)

  // Toasts
  const [toasts, setToasts] = useState([])
  const toastId = useRef(0)
  const toast = useCallback((tipo, texto) => {
    const id = ++toastId.current
    setToasts(t => [...t, { id, tipo, texto }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3800)
  }, [])

  // ── Carga de datos ────────────────────────────────────────────────────────
  const cargar = useCallback(async (silencioso = false) => {
    if (!p.ver) { setCargando(false); return }
    if (silencioso) setRefrescando(true); else setCargando(true)
    const [{ data: files }, { data: metas }, { data: cfg }] = await Promise.all([
      supabase.storage.from(BUCKET).list('', { limit: 200, sortBy: { column: 'created_at', order: 'desc' } }),
      supabase.from('backups_meta').select('*'),
      supabase.from('configuracion').select('valor').eq('clave', 'backup_auto_frecuencia').maybeSingle(),
    ])
    const soloJson = (files ?? []).filter(f => f.name.toLowerCase().endsWith('.json'))
    setArchivos(soloJson)
    setMetaMap(Object.fromEntries((metas ?? []).map(m => [m.archivo, m])))
    if (cfg?.valor) setAutoFrecuencia(cfg.valor)
    setCargando(false)
    setRefrescando(false)
  }, [p.ver])

  useEffect(() => { cargar() }, [cargar])

  // Cerrar menú ⋮ al hacer click fuera
  useEffect(() => {
    if (!menuAbierto) return
    const h = () => setMenuAbierto(null)
    window.addEventListener('click', h)
    return () => window.removeEventListener('click', h)
  }, [menuAbierto])

  // ── Auditoría (cliente) ───────────────────────────────────────────────────
  const registrarAuditoria = useCallback(async (accion, item, extra = {}) => {
    try {
      await supabase.from('audit_logs').insert({
        bien_nombre: `${item?.nombre ?? item?.archivo ?? 'Backup'}`,
        accion,
        cambios: { operacion: accion, archivo: item?.archivo, tipo: item?.tipo, ...extra },
        usuario_id: usuario.id,
        usuario_nombre: usuario.nombre,
        usuario_rol: usuario.rol,
        modulo: 'backup',
        creado_en: new Date().toISOString(),
      })
    } catch { /* el constraint puede rechazar la acción si la migración no está aplicada */ }
  }, [usuario])

  // ── Items derivados (storage + meta) ──────────────────────────────────────
  const items = useMemo(() => archivos.map(f => {
    const meta = metaMap[f.name] ?? {}
    const origen = origenDeArchivo(f.name)
    return {
      archivo:      f.name,
      size:         f.metadata?.size ?? 0,
      createdAt:    meta.created_at ?? fechaDeArchivo(f),
      origen,
      nombre:       meta.nombre_personalizado || nombrePorDefecto(f.name),
      descripcion:  meta.descripcion || '',
      observaciones: meta.observaciones || '',
      tipo:         meta.tipo   || 'completo',
      estado:       meta.estado || (origen === 'seguridad' ? 'correcto' : 'correcto'),
      usuario:      meta.created_by_nombre || (origen === 'manual' ? '—' : 'Sistema'),
    }
  }), [archivos, metaMap])

  const usuariosUnicos = useMemo(
    () => [...new Set(items.map(i => i.usuario).filter(u => u && u !== '—'))],
    [items]
  )

  // ── Filtro + orden ────────────────────────────────────────────────────────
  const itemsFiltrados = useMemo(() => {
    let arr = items.filter(i => {
      if (q && !(`${i.nombre} ${i.archivo} ${i.descripcion}`.toLowerCase().includes(q.toLowerCase()))) return false
      if (fUsuario && i.usuario !== fUsuario) return false
      if (fTipo && i.tipo !== fTipo) return false
      if (fEstado && i.estado !== fEstado) return false
      if (fOrigen && i.origen !== fOrigen) return false
      const fecha = (i.createdAt || '').slice(0, 10)
      if (fDesde && fecha < fDesde) return false
      if (fHasta && fecha > fHasta) return false
      return true
    })
    const dir = orden.dir === 'asc' ? 1 : -1
    arr = arr.sort((a, b) => {
      let va, vb
      if (orden.campo === 'nombre')  { va = a.nombre.toLowerCase(); vb = b.nombre.toLowerCase() }
      else if (orden.campo === 'tamano') { va = a.size; vb = b.size }
      else if (orden.campo === 'usuario') { va = a.usuario.toLowerCase(); vb = b.usuario.toLowerCase() }
      else { va = a.createdAt; vb = b.createdAt }
      return va < vb ? -dir : va > vb ? dir : 0
    })
    return arr
  }, [items, q, fUsuario, fTipo, fEstado, fOrigen, fDesde, fHasta, orden])

  const hayFiltros = q || fUsuario || fTipo || fEstado || fOrigen || fDesde || fHasta
  const limpiarFiltros = () => { setQ(''); setFUsuario(''); setFTipo(''); setFEstado(''); setFOrigen(''); setFDesde(''); setFHasta('') }

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = items.length
    const espacio = items.reduce((a, i) => a + (i.size || 0), 0)
    const ordenados = [...items].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    const ultimo = ordenados[0]
    const ultimoExito = ordenados.find(i => i.estado === 'correcto')
    return {
      total, espacio,
      ultimo: ultimo ? fmtFecha(ultimo.createdAt) : '—',
      ultimoExito: ultimoExito ? fmtFechaHora(ultimoExito.createdAt) : '—',
      proximo: proximoAuto(autoFrecuencia),
    }
  }, [items, autoFrecuencia])

  // ── upsert meta ───────────────────────────────────────────────────────────
  const upsertMeta = useCallback(async (archivo, campos, item) => {
    await supabase.from('backups_meta').upsert({
      archivo,
      created_by:        item?.origen === 'manual' ? usuario.id : (metaMap[archivo]?.created_by ?? null),
      created_by_nombre: metaMap[archivo]?.created_by_nombre ?? (item?.usuario !== '—' ? item?.usuario : null),
      updated_at:        new Date().toISOString(),
      ...campos,
    }, { onConflict: 'archivo' })
  }, [usuario, metaMap])

  // ── Acciones ──────────────────────────────────────────────────────────────
  const handleDescargar = async (item) => {
    setMenuAbierto(null)
    const { data, error } = await supabase.storage.from(BUCKET).download(item.archivo)
    if (error || !data) { toast('error', 'No se pudo descargar el respaldo.'); return }
    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url; a.download = item.archivo; a.click()
    URL.revokeObjectURL(url)
    registrarAuditoria('descargar', item)
    toast('ok', 'Descarga iniciada.')
  }

  const handleGuardarNombre = async (item, nuevoNombre) => {
    await upsertMeta(item.archivo, { nombre_personalizado: nuevoNombre }, item)
    registrarAuditoria('renombrar', item, { nombre_anterior: item.nombre, nombre_nuevo: nuevoNombre })
    setModalRenombrar(null)
    toast('ok', 'Respaldo renombrado.')
    cargar(true)
  }

  const handleGuardarDescripcion = async (item, descripcion) => {
    await upsertMeta(item.archivo, { descripcion }, item)
    registrarAuditoria('editar', item, { descripcion })
    setModalDescrip(null)
    toast('ok', 'Descripción actualizada.')
    cargar(true)
  }

  const handleDuplicar = async (item) => {
    const nuevo = `${item.archivo.replace(/\.json$/i, '')}_copia_${Date.now()}.json`
    const { data, error } = await supabase.storage.from(BUCKET).download(item.archivo)
    if (error || !data) { toast('error', 'No se pudo leer el respaldo original.'); return }
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(nuevo, data, {
      contentType: 'application/json', upsert: false,
    })
    if (upErr) { toast('error', 'No se pudo duplicar el respaldo.'); return }
    await upsertMeta(nuevo, {
      nombre_personalizado: `${item.nombre} (copia)`,
      descripcion: item.descripcion,
      tipo: item.tipo,
      estado: 'correcto',
      created_by: usuario.id,
      created_by_nombre: usuario.nombre,
    }, { ...item, origen: 'manual', usuario: usuario.nombre })
    registrarAuditoria('duplicar', item, { archivo_copia: nuevo })
    setModalDuplicar(null)
    toast('ok', 'Respaldo duplicado.')
    cargar(true)
  }

  const handleEliminar = async (item) => {
    const { error } = await supabase.storage.from(BUCKET).remove([item.archivo])
    if (error) { toast('error', 'No se pudo eliminar el respaldo.'); return }
    await supabase.from('backups_meta').delete().eq('archivo', item.archivo)
    registrarAuditoria('eliminar', item)
    setModalEliminar(null)
    toast('ok', 'Respaldo eliminado.')
    cargar(true)
  }

  const guardarAutoFrecuencia = async (frecuencia) => {
    setAutoFrecuencia(frecuencia)
    const { data } = await supabase.from('configuracion').update({ valor: frecuencia }).eq('clave', 'backup_auto_frecuencia').select()
    if (!data || data.length === 0) await supabase.from('configuracion').insert({ clave: 'backup_auto_frecuencia', valor: frecuencia })
    setModalAuto(false)
    toast('ok', 'Preferencia de respaldo automático guardada.')
  }

  // ── Acceso denegado ───────────────────────────────────────────────────────
  if (!p.ver) {
    return (
      <div className="bk-denied">
        <div className="bk-denied-card">
          <div className="bk-denied-icon"><ShieldAlert size={30} /></div>
          <h2>Acceso restringido</h2>
          <p>No tienes permiso para acceder al módulo de <strong>Backups</strong>. Solicita el permiso a un administrador.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bk">
      {/* ── Encabezado ── */}
      <div className="bk-head">
        <div className="bk-head-title">
          <div className="bk-head-icon"><HardDrive size={22} /></div>
          <div>
            <h1>Backups</h1>
            <p>Gestiona, restaura y audita los respaldos del sistema.</p>
          </div>
        </div>
        <div className="bk-head-actions">
          {p.automatizar && (
            <button className="bk-btn-ghost" onClick={() => setModalAuto(true)}>
              <CalendarClock size={15} /> Automatización
            </button>
          )}
          <button className="bk-btn-ghost" onClick={() => cargar(true)} disabled={refrescando}>
            <RefreshCw size={15} className={refrescando ? 'bk-spin' : ''} /> Actualizar
          </button>
          {p.crear && (
            <button className="bk-btn-primary" onClick={() => setModalNuevo(true)}>
              <Plus size={16} /> Nuevo Backup
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="bk-tabs">
        <button className={`bk-tab ${vista === 'respaldos' ? 'active' : ''}`} onClick={() => onIrAVista?.('respaldos')}>
          <ListChecks size={15} /> Respaldos
        </button>
        {p.verActividad && (
          <button className={`bk-tab ${vista === 'actividad' ? 'active' : ''}`} onClick={() => onIrAVista?.('actividad')}>
            <Activity size={15} /> Actividad
          </button>
        )}
      </div>

      {vista === 'actividad' && p.verActividad
        ? <Actividad />
        : (
        <>
          {/* ── KPIs ── */}
          <div className="bk-kpis">
            <KpiCard Icon={HardDrive}          color="#4f46e5" bg="#eef2ff" label="Total de backups"  valor={kpis.total} cargando={cargando} />
            <KpiCard Icon={Clock}              color="#0891b2" bg="#ecfeff" label="Último respaldo"    valor={kpis.ultimo} cargando={cargando} />
            <KpiCard Icon={HardDriveDownload}  color="#b45309" bg="#fffbeb" label="Espacio utilizado"  valor={fmtBytes(kpis.espacio)} cargando={cargando} />
            <KpiCard Icon={CheckCircle2}       color="#15803d" bg="#dcfce7" label="Último exitoso"     valor={kpis.ultimoExito} cargando={cargando} chico />
            <KpiCard Icon={CalendarClock}      color="#7c3aed" bg="#ede9fe" label="Próximo automático" valor={kpis.proximo} cargando={cargando} />
          </div>

          {/* ── Filtros ── */}
          <div className="bk-filtros">
            <div className="bk-search">
              <Search size={15} />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nombre o descripción…" />
              {q && <button onClick={() => setQ('')}><X size={14} /></button>}
            </div>
            <select value={fUsuario} onChange={e => setFUsuario(e.target.value)}>
              <option value="">Todos los usuarios</option>
              {usuariosUnicos.map(u => <option key={u} value={u}>{u}</option>)}
              {items.some(i => i.usuario === 'Sistema') && <option value="Sistema">Sistema</option>}
            </select>
            <select value={fTipo} onChange={e => setFTipo(e.target.value)}>
              <option value="">Todos los tipos</option>
              {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select value={fEstado} onChange={e => setFEstado(e.target.value)}>
              <option value="">Todos los estados</option>
              {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select value={fOrigen} onChange={e => setFOrigen(e.target.value)}>
              <option value="">Todos los orígenes</option>
              {Object.entries(ORIGENES).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
            </select>
            <div className="bk-fecha-range">
              <CalendarDays size={14} />
              <input type="date" value={fDesde} onChange={e => setFDesde(e.target.value)} title="Desde" />
              <span>–</span>
              <input type="date" value={fHasta} onChange={e => setFHasta(e.target.value)} title="Hasta" />
            </div>
            <select value={`${orden.campo}:${orden.dir}`} onChange={e => { const [campo, dir] = e.target.value.split(':'); setOrden({ campo, dir }) }} title="Ordenar">
              <option value="fecha:desc">Fecha ↓</option>
              <option value="fecha:asc">Fecha ↑</option>
              <option value="nombre:asc">Nombre A-Z</option>
              <option value="nombre:desc">Nombre Z-A</option>
              <option value="tamano:desc">Tamaño ↓</option>
              <option value="tamano:asc">Tamaño ↑</option>
              <option value="usuario:asc">Usuario A-Z</option>
            </select>
            {hayFiltros && (
              <button className="bk-limpiar" onClick={limpiarFiltros}><X size={14} /> Limpiar</button>
            )}
          </div>

          {/* ── Tabla / tarjetas ── */}
          {cargando ? (
            <div className="bk-list">{Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}</div>
          ) : itemsFiltrados.length === 0 ? (
            <EmptyState hayFiltros={hayFiltros} onNuevo={() => setModalNuevo(true)} onLimpiar={limpiarFiltros} />
          ) : (
            <div className="bk-list">
              <AnimatePresence initial={false}>
                {itemsFiltrados.map(item => (
                  <BackupCard
                    key={item.archivo}
                    item={item}
                    permisos={p}
                    menuAbierto={menuAbierto === item.archivo}
                    onMenu={(e) => { e.stopPropagation(); setMenuAbierto(m => m === item.archivo ? null : item.archivo) }}
                    onDetalle={() => { setMenuAbierto(null); setModalDetalle(item) }}
                    onRenombrar={() => { setMenuAbierto(null); setModalRenombrar(item) }}
                    onDescripcion={() => { setMenuAbierto(null); setModalDescrip(item) }}
                    onDescargar={() => handleDescargar(item)}
                    onRestaurar={() => { setMenuAbierto(null); setModalRestaurar({ item, fase: 1, texto: '' }) }}
                    onDuplicar={() => { setMenuAbierto(null); setModalDuplicar(item) }}
                    onEliminar={() => { setMenuAbierto(null); setModalEliminar(item) }}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </>
      )}

      {/* ══════════════ MODALES ══════════════ */}
      <AnimatePresence>
        {modalNuevo && (
          <ModalNuevo
            key="nuevo"
            onClose={() => setModalNuevo(false)}
            onCreado={() => { setModalNuevo(false); cargar(true) }}
            usuario={usuario}
            upsertMeta={upsertMeta}
            toast={toast}
          />
        )}
        {modalRenombrar && (
          <ModalTexto
            key="renombrar"
            titulo="Renombrar respaldo"
            descripcion="Asigna un nombre descriptivo para reconocerlo fácilmente."
            label="Nombre del respaldo"
            valorInicial={modalRenombrar.nombre}
            placeholder="Ej: Antes de actualización de permisos"
            Icon={Pencil}
            onClose={() => setModalRenombrar(null)}
            onGuardar={(v) => handleGuardarNombre(modalRenombrar, v)}
          />
        )}
        {modalDescrip && (
          <ModalTexto
            key="descrip"
            titulo="Descripción del respaldo"
            descripcion="Anota el contexto de este respaldo (motivo, hito, etc.)."
            label="Descripción"
            valorInicial={modalDescrip.descripcion}
            placeholder="Ej: Respaldo previo a la migración de dominio"
            Icon={FileText}
            textarea
            onClose={() => setModalDescrip(null)}
            onGuardar={(v) => handleGuardarDescripcion(modalDescrip, v)}
          />
        )}
        {modalDetalle && (
          <ModalDetalle key="detalle" item={modalDetalle} onClose={() => setModalDetalle(null)} />
        )}
        {modalDuplicar && (
          <ModalConfirm
            key="dup"
            titulo="Duplicar respaldo"
            Icon={Copy} tono="info"
            mensaje={<>Se creará una copia independiente de <strong>{modalDuplicar.nombre}</strong>. Útil para conservar una versión antes de restaurar.</>}
            confirmLabel="Duplicar"
            onClose={() => setModalDuplicar(null)}
            onConfirm={() => handleDuplicar(modalDuplicar)}
          />
        )}
        {modalEliminar && (
          <ModalConfirm
            key="del"
            titulo="Eliminar respaldo"
            Icon={Trash2} tono="peligro"
            mensaje={<>¿Eliminar <strong>{modalEliminar.nombre}</strong>? Esta acción es permanente y el archivo no se podrá recuperar.</>}
            confirmLabel="Eliminar"
            onClose={() => setModalEliminar(null)}
            onConfirm={() => handleEliminar(modalEliminar)}
          />
        )}
        {modalRestaurar && (
          <ModalRestaurar
            key="rest"
            estado={modalRestaurar}
            setEstado={setModalRestaurar}
            onClose={() => setModalRestaurar(null)}
            onDone={() => cargar(true)}
            registrarAuditoria={registrarAuditoria}
          />
        )}
        {modalAuto && (
          <ModalAuto
            key="auto"
            actual={autoFrecuencia}
            onClose={() => setModalAuto(false)}
            onGuardar={guardarAutoFrecuencia}
          />
        )}
      </AnimatePresence>

      {/* ── Toasts ── */}
      <div className="bk-toasts">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              className={`bk-toast bk-toast--${t.tipo}`}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            >
              {t.tipo === 'ok' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
              <span>{t.texto}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// SUBCOMPONENTES
// ═══════════════════════════════════════════════════════════════════════════

function KpiCard({ Icon, color, bg, label, valor, cargando, chico }) {
  return (
    <motion.div className="bk-kpi" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <div className="bk-kpi-icon" style={{ color, background: bg }}><Icon size={18} /></div>
      <div className="bk-kpi-body">
        <p className="bk-kpi-label">{label}</p>
        {cargando ? <div className="bk-skel bk-skel-line" style={{ width: 70, height: 18 }} />
          : <p className="bk-kpi-valor" style={{ fontSize: chico ? 13 : undefined }}>{valor}</p>}
      </div>
    </motion.div>
  )
}

function SkeletonRow() {
  return (
    <div className="bk-card bk-card--skel">
      <div className="bk-skel bk-skel-icon" />
      <div style={{ flex: 1 }}>
        <div className="bk-skel bk-skel-line" style={{ width: '40%', height: 15 }} />
        <div className="bk-skel bk-skel-line" style={{ width: '25%', height: 11, marginTop: 8 }} />
      </div>
      <div className="bk-skel bk-skel-line" style={{ width: 80, height: 24 }} />
    </div>
  )
}

function EmptyState({ hayFiltros, onNuevo, onLimpiar }) {
  return (
    <motion.div className="bk-empty" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
      <div className="bk-empty-illu">
        <HardDrive size={40} />
        <div className="bk-empty-badge">{hayFiltros ? <Search size={16} /> : <Plus size={16} />}</div>
      </div>
      {hayFiltros ? (
        <>
          <h3>Sin resultados</h3>
          <p>Ningún respaldo coincide con los filtros actuales.</p>
          <button className="bk-btn-ghost" onClick={onLimpiar}><X size={14} /> Limpiar filtros</button>
        </>
      ) : (
        <>
          <h3>Aún no hay respaldos</h3>
          <p>Crea tu primer respaldo para proteger la información del sistema.</p>
          <button className="bk-btn-primary" onClick={onNuevo}><Plus size={16} /> Nuevo Backup</button>
        </>
      )}
    </motion.div>
  )
}

function BackupCard({ item, permisos = {}, menuAbierto, onMenu, onDetalle, onRenombrar, onDescripcion, onDescargar, onRestaurar, onDuplicar, onEliminar }) {
  const tipo = TIPOS[item.tipo] ?? TIPOS.completo
  const est  = ESTADOS[item.estado] ?? ESTADOS.correcto
  const origen = ORIGENES[item.origen]
  const TipoIcon = tipo.Icon
  return (
    <motion.div
      className={`bk-card ${menuAbierto ? 'bk-card--menu-open' : ''}`}
      layout
      style={{ zIndex: menuAbierto ? 50 : undefined }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0, transition: { duration: 0.18 } }}
      whileHover={{ y: -1 }}
    >
      <div className="bk-card-icon" style={{ color: tipo.color, background: tipo.bg }}>
        <TipoIcon size={20} />
      </div>

      <div className="bk-card-main">
        <div className="bk-card-title-row">
          <h3 title={item.archivo}>{item.nombre}</h3>
          <span className="bk-origen" title={`Origen: ${origen.label}`}>{origen.emoji} {origen.label}</span>
        </div>
        {item.descripcion && <p className="bk-card-desc">{item.descripcion}</p>}
        <div className="bk-card-meta">
          <span><CalendarDays size={12} /> {fmtFechaHora(item.createdAt)}</span>
          <span><Info size={12} /> {item.usuario}</span>
          <span><HardDriveDownload size={12} /> {fmtBytes(item.size)}</span>
        </div>
      </div>

      <div className="bk-card-badges">
        <span className="bk-badge" style={{ color: tipo.color, background: tipo.bg }}>{tipo.label}</span>
        <span className="bk-badge" style={{ color: est.color, background: est.bg, border: `1px solid ${est.border}` }}>{est.label}</span>
      </div>

      <div className="bk-card-actions">
        {permisos.descargar && <button className="bk-icon-btn" title="Descargar" onClick={onDescargar}><Download size={15} /></button>}
        {permisos.restaurar && <button className="bk-icon-btn bk-icon-btn--warn" title="Restaurar" onClick={onRestaurar}><RotateCcw size={15} /></button>}
        <div className="bk-menu-wrap">
          <button className={`bk-icon-btn ${menuAbierto ? 'active' : ''}`} title="Más acciones" onClick={onMenu}><MoreVertical size={15} /></button>
          <AnimatePresence>
            {menuAbierto && (
              <motion.div
                className="bk-menu"
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ duration: 0.14 }}
                onClick={e => e.stopPropagation()}
              >
                <button onClick={onDetalle}><Eye size={14} /> Ver detalles</button>
                {permisos.renombrar && <button onClick={onRenombrar}><Pencil size={14} /> Renombrar</button>}
                {permisos.editarDescripcion && <button onClick={onDescripcion}><FileText size={14} /> Agregar descripción</button>}
                {permisos.descargar && <button onClick={onDescargar}><Download size={14} /> Descargar</button>}
                {permisos.duplicar && <button onClick={onDuplicar}><Copy size={14} /> Duplicar</button>}
                {(permisos.restaurar || permisos.eliminar) && <div className="bk-menu-sep" />}
                {permisos.restaurar && <button onClick={onRestaurar} className="bk-menu-warn"><RotateCcw size={14} /> Restaurar</button>}
                {permisos.eliminar && <button onClick={onEliminar} className="bk-menu-danger"><Trash2 size={14} /> Eliminar</button>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}

// ── Overlay reutilizable ────────────────────────────────────────────────────
function Overlay({ children, onClose, ancho = 460 }) {
  return (
    <motion.div className="bk-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }} onClick={onClose}>
      <motion.div className="bk-modal" style={{ maxWidth: ancho }}
        initial={{ opacity: 0, scale: 0.94, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 8 }} transition={{ type: 'spring', stiffness: 400, damping: 32 }}
        onClick={e => e.stopPropagation()}>
        {children}
      </motion.div>
    </motion.div>
  )
}

// ── Modal Nuevo Backup ──────────────────────────────────────────────────────
function ModalNuevo({ onClose, onCreado, usuario, upsertMeta, toast }) {
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState('completo')
  const [descripcion, setDescripcion] = useState('')
  const [fase, setFase] = useState('form') // form | progreso | error
  const [progreso, setProgreso] = useState([])
  const [errorMsg, setErrorMsg] = useState('')

  const crear = async () => {
    setFase('progreso')
    setProgreso(ETAPAS_CREAR.map(t => ({ t, e: 'pending' })))
    const avanzar = (i) => setProgreso(p => p.map((x, j) => ({ ...x, e: j < i ? 'done' : j === i ? 'active' : 'pending' })))
    avanzar(0)
    const timers = [700, 1500, 2400, 3200].map((d, i) => setTimeout(() => avanzar(i + 1), d))
    try {
      const { data, error } = await supabase.functions.invoke('backup-mensual')
      timers.forEach(clearTimeout)
      if (error || !data?.ok) {
        setErrorMsg(data?.error || error?.message || 'No se pudo generar el respaldo.')
        setFase('error')
        return
      }
      setProgreso(p => p.map(x => ({ ...x, e: 'done' })))
      // Guardar metadatos personalizados sobre el archivo recién creado
      await upsertMeta(data.archivo, {
        nombre_personalizado: nombre.trim() || null,
        descripcion: descripcion.trim() || null,
        tipo,
        estado: 'correcto',
        created_by: usuario.id,
        created_by_nombre: usuario.nombre,
      }, { origen: 'manual', usuario: usuario.nombre })
      toast('ok', 'Respaldo creado correctamente.')
      setTimeout(onCreado, 550)
    } catch (err) {
      timers.forEach(clearTimeout)
      setErrorMsg(String(err))
      setFase('error')
    }
  }

  return (
    <Overlay onClose={fase === 'progreso' ? undefined : onClose} ancho={480}>
      {fase === 'form' && (
        <>
          <div className="bk-modal-head">
            <div className="bk-modal-icon" style={{ color: '#4f46e5', background: '#eef2ff' }}><Plus size={20} /></div>
            <div>
              <h3>Nuevo Backup</h3>
              <p>Genera un respaldo del sistema al instante.</p>
            </div>
          </div>

          <label className="bk-field-label">Nombre personalizado <span>(opcional)</span></label>
          <input className="bk-input" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Respaldo previo migración dominio" autoFocus />

          <label className="bk-field-label">Tipo de respaldo</label>
          <div className="bk-tipo-grid">
            {Object.entries(TIPOS).map(([k, v]) => {
              const I = v.Icon
              return (
                <button key={k} className={`bk-tipo-opt ${tipo === k ? 'active' : ''}`} onClick={() => setTipo(k)}
                  style={tipo === k ? { borderColor: v.color, background: v.bg } : undefined}>
                  <I size={18} style={{ color: v.color }} />
                  <span>{v.label}</span>
                </button>
              )
            })}
          </div>

          <label className="bk-field-label">Descripción <span>(opcional)</span></label>
          <textarea className="bk-input bk-textarea" value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Motivo o contexto de este respaldo…" rows={2} />

          <div className="bk-note"><Info size={13} /> El respaldo incluye todos los datos del sistema. El tipo seleccionado se guarda como clasificación del respaldo.</div>

          <div className="bk-modal-actions">
            <button className="bk-btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="bk-btn-primary" onClick={crear}><Zap size={15} /> Crear respaldo</button>
          </div>
        </>
      )}

      {fase === 'progreso' && (
        <>
          <div className="bk-modal-head">
            <Loader2 size={22} className="bk-spin" style={{ color: '#4f46e5' }} />
            <div>
              <h3>Generando respaldo…</h3>
              <p>No cierres esta ventana.</p>
            </div>
          </div>
          <Progreso pasos={progreso} />
        </>
      )}

      {fase === 'error' && (
        <div className="bk-result">
          <XCircle size={48} style={{ color: '#dc2626' }} />
          <h3>No se pudo crear el respaldo</h3>
          <div className="bk-error-box">{errorMsg}</div>
          <button className="bk-btn-primary" onClick={onClose}>Cerrar</button>
        </div>
      )}
    </Overlay>
  )
}

// ── Modal de texto (renombrar / descripción) ────────────────────────────────
function ModalTexto({ titulo, descripcion, label, valorInicial, placeholder, Icon, textarea, onClose, onGuardar }) {
  const [valor, setValor] = useState(valorInicial ?? '')
  const [guardando, setGuardando] = useState(false)
  const submit = async () => { setGuardando(true); await onGuardar(valor.trim()) }
  return (
    <Overlay onClose={onClose}>
      <div className="bk-modal-head">
        <div className="bk-modal-icon" style={{ color: '#2563eb', background: '#dbeafe' }}><Icon size={20} /></div>
        <div><h3>{titulo}</h3><p>{descripcion}</p></div>
      </div>
      <label className="bk-field-label">{label}</label>
      {textarea
        ? <textarea className="bk-input bk-textarea" value={valor} onChange={e => setValor(e.target.value)} placeholder={placeholder} rows={3} autoFocus />
        : <input className="bk-input" value={valor} onChange={e => setValor(e.target.value)} placeholder={placeholder} autoFocus onKeyDown={e => e.key === 'Enter' && submit()} />}
      <div className="bk-modal-actions">
        <button className="bk-btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="bk-btn-primary" onClick={submit} disabled={guardando}>
          {guardando ? <Loader2 size={15} className="bk-spin" /> : <CheckCircle2 size={15} />} Guardar
        </button>
      </div>
    </Overlay>
  )
}

// ── Modal detalle ───────────────────────────────────────────────────────────
const NOMBRE_TABLA = {
  bienes: 'Bienes', categorias: 'Categorías', usuarios: 'Usuarios',
  permisos_rol: 'Permisos por rol', permisos_usuario: 'Permisos de usuario',
  prestamos: 'Préstamos', tickets: 'Tickets', requerimientos: 'Requerimientos',
  ausencias: 'Ausencias', dias_compensatorios: 'Compensatorios', audit_logs: 'Auditoría',
  actividades: 'Actividades', configuracion: 'Configuración', incidencias: 'Incidencias',
  dias_inhabilitados: 'Días inhabilitados',
}

function ModalDetalle({ item, onClose }) {
  const tipo = TIPOS[item.tipo] ?? TIPOS.completo
  const est  = ESTADOS[item.estado] ?? ESTADOS.correcto
  const origen = ORIGENES[item.origen]
  const filas = [
    ['Nombre', item.nombre],
    ['Archivo', item.archivo],
    ['Tipo', tipo.label],
    ['Estado', est.label],
    ['Origen', `${origen.emoji} ${origen.label}`],
    ['Fecha y hora', fmtFechaHora(item.createdAt)],
    ['Creado por', item.usuario],
    ['Tamaño', fmtBytes(item.size)],
    ['Descripción', item.descripcion || '—'],
  ]

  // Contenido real del respaldo (registros por tabla), leyendo el JSON.
  const [estadoCont, setEstadoCont] = useState('cargando') // cargando | ok | error
  const [contenido, setContenido]   = useState(null)       // { total, tablas: [[nombre, n]] }

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const { data, error } = await supabase.storage.from(BUCKET).download(item.archivo)
      if (!vivo) return
      if (error || !data) { setEstadoCont('error'); return }
      try {
        const json = JSON.parse(await data.text())
        const tables = json.tables || {}
        const tablas = Object.entries(tables)
          .map(([n, rows]) => [n, Array.isArray(rows) ? rows.length : 0])
          .sort((a, b) => b[1] - a[1])
        const total = json.total_registros ?? tablas.reduce((a, [, n]) => a + n, 0)
        if (vivo) { setContenido({ total, tablas }); setEstadoCont('ok') }
      } catch {
        if (vivo) setEstadoCont('error')
      }
    })()
    return () => { vivo = false }
  }, [item.archivo])

  return (
    <Overlay onClose={onClose} ancho={480}>
      <div className="bk-modal-head">
        <div className="bk-modal-icon" style={{ color: tipo.color, background: tipo.bg }}><Eye size={20} /></div>
        <div><h3>Detalles del respaldo</h3><p>Información completa del archivo.</p></div>
      </div>
      <div className="bk-detalle">
        {filas.map(([k, v]) => (
          <div className="bk-detalle-row" key={k}>
            <span className="bk-detalle-k">{k}</span>
            <span className="bk-detalle-v">{v}</span>
          </div>
        ))}
      </div>

      {/* ── Contenido del respaldo ── */}
      <div className="bk-det-contenido">
        <div className="bk-det-contenido-head">
          <span><Database size={13} /> Contenido</span>
          {estadoCont === 'ok' && <span className="bk-det-total">{contenido.total.toLocaleString('es-CL')} registros</span>}
        </div>
        {estadoCont === 'cargando' && (
          <p className="bk-det-msg"><Loader2 size={13} className="bk-spin" /> Analizando contenido…</p>
        )}
        {estadoCont === 'error' && (
          <p className="bk-det-msg">No se pudo leer el contenido del archivo.</p>
        )}
        {estadoCont === 'ok' && (
          contenido.tablas.length === 0
            ? <p className="bk-det-msg">El respaldo no contiene tablas.</p>
            : <div className="bk-det-tablas">
                {contenido.tablas.map(([n, c]) => (
                  <div className="bk-det-tabla" key={n}>
                    <span>{NOMBRE_TABLA[n] ?? n}</span>
                    <span className="bk-det-tabla-n">{c.toLocaleString('es-CL')}</span>
                  </div>
                ))}
              </div>
        )}
      </div>

      <div className="bk-modal-actions"><button className="bk-btn-primary" onClick={onClose} style={{ width: '100%' }}>Cerrar</button></div>
    </Overlay>
  )
}

// ── Modal confirmación genérico ─────────────────────────────────────────────
function ModalConfirm({ titulo, mensaje, Icon, tono, confirmLabel, onClose, onConfirm }) {
  const [cargando, setCargando] = useState(false)
  const colores = tono === 'peligro'
    ? { c: '#dc2626', bg: '#fee2e2', grad: 'linear-gradient(135deg, #dc2626, #b91c1c)' }
    : { c: '#4f46e5', bg: '#eef2ff', grad: 'linear-gradient(135deg, #6366f1, #4f46e5)' }
  return (
    <Overlay onClose={onClose} ancho={420}>
      <div className="bk-modal-head">
        <div className="bk-modal-icon" style={{ color: colores.c, background: colores.bg }}><Icon size={20} /></div>
        <div><h3>{titulo}</h3></div>
      </div>
      <p className="bk-confirm-msg">{mensaje}</p>
      <div className="bk-modal-actions">
        <button className="bk-btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="bk-btn-solid" style={{ background: colores.grad }} disabled={cargando}
          onClick={async () => { setCargando(true); await onConfirm() }}>
          {cargando ? <Loader2 size={15} className="bk-spin" /> : <Icon size={15} />} {confirmLabel}
        </button>
      </div>
    </Overlay>
  )
}

// ── Modal restaurar (multifase con CONFIRMAR) ───────────────────────────────
function ModalRestaurar({ estado, setEstado, onClose, onDone, registrarAuditoria }) {
  const { item, fase, texto } = estado
  const tipo = TIPOS[item.tipo] ?? TIPOS.completo
  const [progreso, setProgreso] = useState([])
  const valido = (texto ?? '') === 'CONFIRMAR'

  const ejecutar = async () => {
    setProgreso(ETAPAS_REST.map(t => ({ t, e: 'pending' })))
    setEstado(s => ({ ...s, fase: 3 }))
    const avanzar = (i) => setProgreso(p => p.map((x, j) => ({ ...x, e: j < i ? 'done' : j === i ? 'active' : 'pending' })))
    avanzar(0)
    const timers = [800, 1800, 2800, 3800].map((d, i) => setTimeout(() => avanzar(i + 1), d))
    try {
      const { data, error } = await supabase.functions.invoke('restaurar-backup', { body: { archivo: item.archivo } })
      timers.forEach(clearTimeout)
      if (error || !data?.ok) {
        setProgreso(p => p.map(x => x.e === 'active' ? { ...x, e: 'error' } : x))
        setEstado(s => ({ ...s, fase: 4, ok: false, mensaje: data?.error || error?.message || 'Error desconocido.' }))
      } else {
        setProgreso(p => p.map(x => ({ ...x, e: 'done' })))
        registrarAuditoria('restaurado', item, { backup_seguridad: data.backup_seguridad })
        setEstado(s => ({ ...s, fase: 4, ok: true }))
        onDone()
      }
    } catch (err) {
      timers.forEach(clearTimeout)
      setEstado(s => ({ ...s, fase: 4, ok: false, mensaje: String(err) }))
    }
  }

  return (
    <Overlay onClose={fase === 3 ? undefined : onClose} ancho={480}>
      {fase === 1 && (
        <>
          <div className="bk-modal-head">
            <div className="bk-modal-icon" style={{ color: '#d97706', background: '#fef3c7' }}><AlertTriangle size={20} /></div>
            <div><h3>Restaurar respaldo</h3><p>Lee con atención antes de continuar.</p></div>
          </div>
          <div className="bk-rest-warn">
            <p><strong>El sistema volverá exactamente al estado de este respaldo.</strong></p>
            <p>Toda la información creada o modificada después de <strong>{fmtFechaHora(item.createdAt)}</strong> podría perderse.</p>
          </div>
          <div className="bk-detalle" style={{ marginTop: 4 }}>
            <div className="bk-detalle-row"><span className="bk-detalle-k">Respaldo</span><span className="bk-detalle-v">{item.nombre}</span></div>
            <div className="bk-detalle-row"><span className="bk-detalle-k">Tipo</span><span className="bk-detalle-v">{tipo.label}</span></div>
            <div className="bk-detalle-row"><span className="bk-detalle-k">Tamaño</span><span className="bk-detalle-v">{fmtBytes(item.size)}</span></div>
          </div>
          <div className="bk-note" style={{ background: '#f0fdf4', color: '#166534' }}>
            <CheckCircle2 size={13} /> Se generará un respaldo de seguridad automático antes de restaurar. Usuarios, roles y auditoría se conservan.
          </div>
          <div className="bk-modal-actions">
            <button className="bk-btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="bk-btn-solid" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
              onClick={() => setEstado(s => ({ ...s, fase: 2 }))}>Continuar →</button>
          </div>
        </>
      )}

      {fase === 2 && (
        <>
          <div className="bk-modal-head">
            <div className="bk-modal-icon" style={{ color: '#dc2626', background: '#fee2e2' }}><ShieldAlert size={20} /></div>
            <div><h3>Confirmación final</h3><p>Esta acción no se puede deshacer.</p></div>
          </div>
          <label className="bk-field-label">
            Para confirmar, escribe <code className="bk-code">CONFIRMAR</code>
          </label>
          <input className="bk-input bk-input--mono" value={texto} autoFocus placeholder="CONFIRMAR"
            onChange={e => setEstado(s => ({ ...s, texto: e.target.value }))}
            style={{ borderColor: valido ? '#22c55e' : undefined }} />
          <div className="bk-modal-actions">
            <button className="bk-btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="bk-btn-solid" disabled={!valido}
              style={{ background: valido ? 'linear-gradient(135deg, #dc2626, #b91c1c)' : '#e2e8f0', color: valido ? '#fff' : '#94a3b8' }}
              onClick={ejecutar}><RotateCcw size={15} /> Restaurar ahora</button>
          </div>
        </>
      )}

      {fase === 3 && (
        <>
          <div className="bk-modal-head">
            <Loader2 size={22} className="bk-spin" style={{ color: '#d97706' }} />
            <div><h3>Restaurando sistema…</h3><p>No cierres ni recargues esta ventana.</p></div>
          </div>
          <Progreso pasos={progreso} />
        </>
      )}

      {fase === 4 && (
        <div className="bk-result">
          {estado.ok ? <CheckCircle2 size={48} style={{ color: '#22c55e' }} /> : <XCircle size={48} style={{ color: '#dc2626' }} />}
          <h3>{estado.ok ? 'Restauración completada' : 'No se completó la restauración'}</h3>
          <p className="bk-result-msg">
            {estado.ok
              ? 'Los datos del sistema se restauraron correctamente desde el respaldo seleccionado.'
              : 'El sistema conserva el estado anterior gracias al respaldo de seguridad automático.'}
          </p>
          {!estado.ok && estado.mensaje && <div className="bk-error-box">{estado.mensaje}</div>}
          <button className="bk-btn-primary" onClick={onClose} style={{ width: '100%' }}>Cerrar</button>
        </div>
      )}
    </Overlay>
  )
}

// ── Modal automatización ────────────────────────────────────────────────────
function ModalAuto({ actual, onClose, onGuardar }) {
  const [sel, setSel] = useState(actual)
  return (
    <Overlay onClose={onClose} ancho={440}>
      <div className="bk-modal-head">
        <div className="bk-modal-icon" style={{ color: '#7c3aed', background: '#ede9fe' }}><CalendarClock size={20} /></div>
        <div><h3>Respaldos automáticos</h3><p>Define con qué frecuencia se generan solos.</p></div>
      </div>
      <div className="bk-auto-opts">
        {FRECUENCIAS.map(f => (
          <button key={f.key} className={`bk-auto-opt ${sel === f.key ? 'active' : ''}`} onClick={() => setSel(f.key)}>
            <span className="bk-radio">{sel === f.key && <span />}</span>
            {f.label}
          </button>
        ))}
      </div>
      <div className="bk-note"><Info size={13} /> Actualmente el sistema genera un respaldo automático mensual. Las demás frecuencias quedan preparadas en la interfaz.</div>
      <div className="bk-modal-actions">
        <button className="bk-btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="bk-btn-primary" onClick={() => onGuardar(sel)}><CheckCircle2 size={15} /> Guardar</button>
      </div>
    </Overlay>
  )
}

// ── Lista de progreso reutilizable ──────────────────────────────────────────
function Progreso({ pasos }) {
  return (
    <div className="bk-progreso">
      {pasos.map(({ t, e }, i) => (
        <div className="bk-progreso-row" key={i}>
          <span className="bk-progreso-ico">
            {e === 'done'    && <CheckCircle2 size={16} style={{ color: '#22c55e' }} />}
            {e === 'active'  && <Loader2 size={15} className="bk-spin" style={{ color: '#4f46e5' }} />}
            {e === 'error'   && <XCircle size={16} style={{ color: '#dc2626' }} />}
            {e === 'pending' && <span className="bk-dot" />}
          </span>
          <span className={`bk-progreso-txt bk-progreso-txt--${e}`}>{t}</span>
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// PESTAÑA ACTIVIDAD (línea de tiempo de auditoría)
// ═══════════════════════════════════════════════════════════════════════════
function Actividad() {
  const [logs, setLogs] = useState([])
  const [cargando, setCargando] = useState(true)
  const [q, setQ] = useState('')
  const [fAccion, setFAccion] = useState('')
  const [fResultado, setFResultado] = useState('')
  const [fDesde, setFDesde] = useState('')
  const [fHasta, setFHasta] = useState('')

  useEffect(() => {
    let vivo = true
    ;(async () => {
      setCargando(true)
      const { data } = await supabase.from('audit_logs').select('*').eq('modulo', 'backup').order('creado_en', { ascending: false }).limit(500)
      if (vivo) { setLogs(data ?? []); setCargando(false) }
    })()
    return () => { vivo = false }
  }, [])

  const accionDe = (log) => log.cambios?.operacion || log.accion
  const resultadoDe = (log) => (log.cambios?.error || log.accion === 'error') ? 'error' : 'exito'

  const filtrados = useMemo(() => logs.filter(l => {
    const acc = accionDe(l)
    if (q && !(`${l.bien_nombre} ${l.usuario_nombre} ${l.cambios?.archivo ?? ''}`.toLowerCase().includes(q.toLowerCase()))) return false
    if (fAccion && acc !== fAccion) return false
    if (fResultado && resultadoDe(l) !== fResultado) return false
    const fecha = (l.creado_en || '').slice(0, 10)
    if (fDesde && fecha < fDesde) return false
    if (fHasta && fecha > fHasta) return false
    return true
  }), [logs, q, fAccion, fResultado, fDesde, fHasta])

  const hayFiltros = q || fAccion || fResultado || fDesde || fHasta

  const exportarCSV = () => {
    const filas = [['Fecha', 'Hora', 'Acción', 'Respaldo', 'Usuario', 'Rol', 'Resultado', 'Detalle']]
    filtrados.forEach(l => {
      const d = new Date(l.creado_en)
      filas.push([
        d.toLocaleDateString('es-CL'), d.toLocaleTimeString('es-CL'),
        (ACT_META[accionDe(l)]?.label ?? accionDe(l)),
        l.cambios?.archivo ?? l.bien_nombre ?? '',
        l.usuario_nombre ?? '', l.usuario_rol ?? '',
        resultadoDe(l) === 'error' ? 'Error' : 'Éxito',
        l.cambios?.error ?? l.cambios?.nombre_nuevo ?? '',
      ])
    })
    const csv = filas.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `actividad_backups_${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="bk-actividad">
      <div className="bk-filtros">
        <div className="bk-search">
          <Search size={15} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por usuario o respaldo…" />
          {q && <button onClick={() => setQ('')}><X size={14} /></button>}
        </div>
        <select value={fAccion} onChange={e => setFAccion(e.target.value)}>
          <option value="">Todas las acciones</option>
          {Object.entries(ACT_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={fResultado} onChange={e => setFResultado(e.target.value)}>
          <option value="">Todos los resultados</option>
          <option value="exito">Éxito</option>
          <option value="error">Error</option>
        </select>
        <div className="bk-fecha-range">
          <CalendarDays size={14} />
          <input type="date" value={fDesde} onChange={e => setFDesde(e.target.value)} />
          <span>–</span>
          <input type="date" value={fHasta} onChange={e => setFHasta(e.target.value)} />
        </div>
        {hayFiltros && <button className="bk-limpiar" onClick={() => { setQ(''); setFAccion(''); setFResultado(''); setFDesde(''); setFHasta('') }}><X size={14} /> Limpiar</button>}
        <button className="bk-btn-ghost" onClick={exportarCSV} disabled={!filtrados.length} style={{ marginLeft: 'auto' }}>
          <Download size={15} /> Exportar CSV
        </button>
      </div>

      {cargando ? (
        <div className="bk-list">{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}</div>
      ) : filtrados.length === 0 ? (
        <div className="bk-empty">
          <div className="bk-empty-illu"><Activity size={40} /><div className="bk-empty-badge"><Search size={16} /></div></div>
          <h3>Sin actividad</h3>
          <p>{hayFiltros ? 'Ningún evento coincide con los filtros.' : 'Aún no se han registrado acciones sobre respaldos.'}</p>
        </div>
      ) : (
        <div className="bk-timeline">
          {filtrados.map((l, i) => {
            const acc = accionDe(l)
            const meta = ACT_META[acc] ?? { label: acc, color: '#64748b', bg: '#f1f5f9', Icon: Info }
            const M = meta.Icon
            const esError = resultadoDe(l) === 'error'
            return (
              <motion.div className="bk-tl-item" key={l.id ?? i}
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.02, 0.3) }}>
                <div className="bk-tl-dot" style={{ color: meta.color, background: meta.bg }}><M size={15} /></div>
                <div className="bk-tl-body">
                  <div className="bk-tl-top">
                    <span className="bk-tl-accion">{meta.label}</span>
                    <span className={`bk-tl-res bk-tl-res--${esError ? 'error' : 'ok'}`}>{esError ? 'Error' : 'Éxito'}</span>
                  </div>
                  <p className="bk-tl-nombre">{l.cambios?.archivo || l.bien_nombre}</p>
                  <div className="bk-tl-meta">
                    <span><Info size={11} /> {l.usuario_nombre} · {l.usuario_rol}</span>
                    <span><CalendarDays size={11} /> {fmtFechaHora(l.creado_en)}</span>
                  </div>
                  {(l.cambios?.error || l.cambios?.nombre_nuevo) && (
                    <p className="bk-tl-detalle">{l.cambios?.error || `→ ${l.cambios?.nombre_nuevo}`}</p>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
