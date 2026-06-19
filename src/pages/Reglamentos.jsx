// src/pages/Reglamentos.jsx
import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen, FileText, FolderOpen, Plus, Search, X, Eye, Download,
  Pencil, Trash2, Upload, ChevronLeft, ChevronRight,
  AlertTriangle, CheckCircle2, Loader2, History, CalendarDays,
} from 'lucide-react'
import { supabase } from '../supabase'

// ── Constantes ────────────────────────────────────────────────────────────
const CATEGORIAS = ['Reglamentos', 'Protocolos', 'Manuales', 'Formularios', 'Circulares', 'Otros']
const ESTADOS    = ['Vigente', 'En revisión', 'Obsoleto']
const BUCKET     = 'reglamentos'
const POR_PAGINA = 15

const CAT_COLOR = {
  Reglamentos: { color: '#1a237e', bg: '#e8eaf6' },
  Protocolos:  { color: '#b71c1c', bg: '#ffebee' },
  Manuales:    { color: '#1b5e20', bg: '#e8f5e9' },
  Formularios: { color: '#e65100', bg: '#fff3e0' },
  Circulares:  { color: '#4a148c', bg: '#f3e5f5' },
  Otros:       { color: '#37474f', bg: '#eceff1' },
}

const EST_COLOR = {
  'Vigente':      { color: '#14532d', bg: '#dcfce7', border: '#86efac' },
  'En revisión':  { color: '#92400e', bg: '#fef3c7', border: '#fcd34d' },
  'Obsoleto':     { color: '#6b7280', bg: '#f3f4f6', border: '#d1d5db' },
}

const overlayV = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1 },
  exit:    { opacity: 0 },
}
const modalV = {
  hidden:  { opacity: 0, scale: 0.96, y: 12 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 400, damping: 30 } },
  exit:    { opacity: 0, scale: 0.96, y: 8, transition: { duration: 0.15 } },
}

// ── Helpers ───────────────────────────────────────────────────────────────
function fmtFecha(d) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtFechaHora(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function fmtBytes(n) {
  if (!n) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1048576).toFixed(1)} MB`
}
function slugCat(cat) {
  return cat.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[áéíóúüñ]/g, c => ({ á:'a',é:'e',í:'i',ó:'o',ú:'u',ü:'u',ñ:'n' }[c] ?? c))
}
function esPDF(nombre) {
  return (nombre ?? '').toLowerCase().endsWith('.pdf')
}

const labelSt = { display: 'block', fontSize: 12.5, fontWeight: 600, color: '#374151', marginBottom: 5 }
const inputSt  = {
  width: '100%', boxSizing: 'border-box', padding: '9px 12px',
  borderRadius: 9, border: '1.5px solid #e2e8f0', fontSize: 13.5,
  color: '#0f172a', background: '#fff', outline: 'none', fontFamily: 'inherit',
}
function btnSm(bg, col) {
  return { width: 30, height: 30, borderRadius: 8, border: 'none', background: bg, color: col, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
}
function btnPag(dis) {
  return { display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 9, fontSize: 13, fontWeight: 500, border: '1.5px solid #e2e8f0', background: dis ? '#f8fafc' : '#fff', color: dis ? '#cbd5e1' : '#374151', cursor: dis ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }
}

// ── Componente principal ──────────────────────────────────────────────────
export default function Reglamentos({ usuario, permisos = {} }) {
  const esAdmin       = usuario?.rol === 'admin'
  const puedVer       = esAdmin || !!permisos.ver
  const puedCrear     = esAdmin || !!permisos.crear
  const puedEditar    = esAdmin || !!permisos.editar
  const puedEliminar  = esAdmin || !!permisos.eliminar
  const puedDescargar = esAdmin || !!permisos.descargar
  const puedVersiones = esAdmin || !!permisos.versiones

  // ── Estado ─────────────────────────────────────────────────────────────
  const [docs,     setDocs]     = useState([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [subiendoArchivo, setSubiendoArchivo] = useState(false)

  // ── Filtros ─────────────────────────────────────────────────────────────
  const [busqueda,         setBusqueda]         = useState('')
  const [filtroCategoria,  setFiltroCategoria]  = useState('')
  const [filtroEstado,     setFiltroEstado]     = useState('')
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('')
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('')
  const [pagina,           setPagina]           = useState(1)

  // ── Modales ─────────────────────────────────────────────────────────────
  const [modalForm,    setModalForm]    = useState(false)
  const [docEditar,    setDocEditar]    = useState(null)
  const [docVer,       setDocVer]       = useState(null)
  const [docEliminar,  setDocEliminar]  = useState(null)
  const [modalVersion, setModalVersion] = useState(null)

  // ── Form crear/editar ───────────────────────────────────────────────────
  const [fNombre,      setFNombre]      = useState('')
  const [fDescripcion, setFDescripcion] = useState('')
  const [fCategoria,   setFCategoria]   = useState('Reglamentos')
  const [fEstado,      setFEstado]      = useState('Vigente')
  const [fFechaPubl,   setFFechaPubl]   = useState('')
  const [fEtiquetas,   setFEtiquetas]   = useState('')
  const [fArchivo,     setFArchivo]     = useState(null)

  // ── Form nueva versión ──────────────────────────────────────────────────
  const [vArchivo, setVArchivo] = useState(null)
  const [vNotas,   setVNotas]   = useState('')

  // ── Versiones del doc en vista ──────────────────────────────────────────
  const [versiones,          setVersiones]          = useState([])
  const [cargandoVersiones,  setCargandoVersiones]  = useState(false)

  // ── Toast ───────────────────────────────────────────────────────────────
  const [aviso, setAviso] = useState(null)
  const mostrarAviso = (tipo, msg) => { setAviso({ tipo, msg }); setTimeout(() => setAviso(null), 5000) }

  // ── Cargar docs ─────────────────────────────────────────────────────────
  const cargarDocs = useCallback(async () => {
    setCargando(true)
    const { data, error } = await supabase
      .from('reglamentos').select('*').eq('is_deleted', false)
      .order('creado_en', { ascending: false })
    if (error) { mostrarAviso('error', 'Error al cargar documentos'); setCargando(false); return }
    setDocs(data ?? [])
    setCargando(false)
  }, [])

  useEffect(() => { cargarDocs() }, [cargarDocs])

  // ── Stats ───────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const ini = new Date(); ini.setDate(1); ini.setHours(0, 0, 0, 0)
    const masVis = docs.reduce((a, b) => (b.visitas ?? 0) > (a?.visitas ?? 0) ? b : a, null)
    return {
      total:     docs.length,
      cats:      new Set(docs.map(d => d.categoria)).size,
      esteMes:   docs.filter(d => new Date(d.creado_en) >= ini).length,
      masVisto:  masVis?.nombre ?? '—',
    }
  }, [docs])

  // ── Filtrado y paginación ───────────────────────────────────────────────
  const docsFiltrados = useMemo(() => {
    const q = busqueda.toLowerCase()
    return docs.filter(d => {
      if (q && !d.nombre.toLowerCase().includes(q) &&
          !(d.descripcion ?? '').toLowerCase().includes(q) &&
          !d.categoria.toLowerCase().includes(q)) return false
      if (filtroCategoria && d.categoria !== filtroCategoria) return false
      if (filtroEstado && d.estado !== filtroEstado) return false
      if (filtroFechaDesde && d.fecha_publicacion && d.fecha_publicacion < filtroFechaDesde) return false
      if (filtroFechaHasta && d.fecha_publicacion && d.fecha_publicacion > filtroFechaHasta) return false
      return true
    })
  }, [docs, busqueda, filtroCategoria, filtroEstado, filtroFechaDesde, filtroFechaHasta])

  const totalPaginas  = Math.ceil(docsFiltrados.length / POR_PAGINA)
  const docsPaginados = docsFiltrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)

  useEffect(() => { setPagina(1) }, [busqueda, filtroCategoria, filtroEstado, filtroFechaDesde, filtroFechaHasta])

  // ── Auditoría ───────────────────────────────────────────────────────────
  async function auditoria(accion, doc, cambios = []) {
    try {
      await supabase.from('audit_logs').insert({
        bien_nombre: doc.nombre ?? String(doc.id ?? '?'),
        accion,
        cambios,
        usuario_id:    usuario.id,
        usuario_nombre: usuario.nombre,
        usuario_rol:   usuario.rol,
        modulo:        'reglamentos',
        creado_en:     new Date().toISOString(),
      })
    } catch { /* silencioso */ }
  }

  // ── Subir archivo a Storage ─────────────────────────────────────────────
  async function subirArchivo(archivo, categoria) {
    const slug = slugCat(categoria)
    const safeName = archivo.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${slug}/${Date.now()}_${safeName}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, archivo, { upsert: false })
    if (error) throw new Error('Error al subir archivo: ' + error.message)
    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)
    return { path, url: publicUrl, nombre: archivo.name, bytes: archivo.size }
  }

  // ── Abrir formulario crear ───────────────────────────────────────────────
  function abrirCrear() {
    setDocEditar(null)
    setFNombre(''); setFDescripcion(''); setFCategoria('Reglamentos')
    setFEstado('Vigente'); setFFechaPubl(''); setFEtiquetas(''); setFArchivo(null)
    setModalForm(true)
  }

  function abrirEditar(doc) {
    setDocEditar(doc)
    setFNombre(doc.nombre ?? ''); setFDescripcion(doc.descripcion ?? '')
    setFCategoria(doc.categoria ?? 'Reglamentos'); setFEstado(doc.estado ?? 'Vigente')
    setFFechaPubl(doc.fecha_publicacion ?? ''); setFEtiquetas((doc.etiquetas ?? []).join(', '))
    setFArchivo(null)
    setModalForm(true)
  }

  // ── Guardar (crear/editar) ───────────────────────────────────────────────
  async function handleGuardar() {
    if (!fNombre.trim()) return mostrarAviso('error', 'El nombre es obligatorio')
    if (!docEditar && !fArchivo) return mostrarAviso('error', 'Selecciona un archivo para el documento')

    setGuardando(true)
    try {
      const etiquetas = fEtiquetas.split(',').map(t => t.trim()).filter(Boolean)

      if (docEditar) {
        const updates = {
          nombre: fNombre.trim(), descripcion: fDescripcion.trim() || null,
          categoria: fCategoria, estado: fEstado,
          fecha_publicacion: fFechaPubl || null, etiquetas,
          actualizado_en: new Date().toISOString(),
        }
        if (fArchivo) {
          setSubiendoArchivo(true)
          // Guardar versión actual en historial si tiene archivo
          if (docEditar.storage_path) {
            await supabase.from('reglamentos_versiones').insert({
              reglamento_id: docEditar.id, version: docEditar.version_actual,
              storage_path: docEditar.storage_path, url: docEditar.url,
              nombre_archivo: docEditar.nombre_archivo, tamano_bytes: docEditar.tamano_bytes,
              creado_por: usuario.id, creado_por_nombre: usuario.nombre,
              creado_en: docEditar.actualizado_en ?? docEditar.creado_en,
            })
          }
          const { path, url, nombre, bytes } = await subirArchivo(fArchivo, fCategoria)
          const [may, men] = (docEditar.version_actual ?? '1.0').split('.').map(Number)
          const nuevaV = (men + 1 >= 10) ? `${may + 1}.0` : `${may}.${men + 1}`
          updates.storage_path   = path; updates.url = url
          updates.nombre_archivo = nombre; updates.tamano_bytes = bytes
          updates.version_actual = nuevaV
          setSubiendoArchivo(false)
        }
        const { error } = await supabase.from('reglamentos').update(updates).eq('id', docEditar.id)
        if (error) throw error
        const cambios = []
        if (fNombre.trim() !== docEditar.nombre) cambios.push({ campo: 'nombre', anterior: docEditar.nombre, nuevo: fNombre.trim() })
        if (fDescripcion.trim() !== (docEditar.descripcion ?? '')) cambios.push({ campo: 'descripcion', anterior: docEditar.descripcion ?? '', nuevo: fDescripcion.trim() })
        if (fCategoria !== docEditar.categoria) cambios.push({ campo: 'categoria', anterior: docEditar.categoria, nuevo: fCategoria })
        if (fEstado !== docEditar.estado) cambios.push({ campo: 'estado', anterior: docEditar.estado, nuevo: fEstado })
        if (fArchivo) cambios.push({ campo: 'archivo', anterior: docEditar.nombre_archivo, nuevo: fArchivo.name })
        await auditoria('editar', docEditar, cambios)
        mostrarAviso('ok', 'Documento actualizado correctamente')
      } else {
        setSubiendoArchivo(true)
        const { path, url, nombre, bytes } = await subirArchivo(fArchivo, fCategoria)
        setSubiendoArchivo(false)
        const { data: ins, error } = await supabase.from('reglamentos').insert({
          nombre: fNombre.trim(), descripcion: fDescripcion.trim() || null,
          categoria: fCategoria, estado: fEstado,
          fecha_publicacion: fFechaPubl || null, etiquetas,
          storage_path: path, url, nombre_archivo: nombre, tamano_bytes: bytes,
          version_actual: '1.0', creado_por: usuario.id, creado_por_nombre: usuario.nombre,
        }).select().single()
        if (error) throw error
        if (ins) await auditoria('crear', ins)
        mostrarAviso('ok', 'Documento creado correctamente')
      }
      setModalForm(false)
      await cargarDocs()
    } catch (e) {
      setSubiendoArchivo(false)
      mostrarAviso('error', e.message ?? 'Error al guardar el documento')
    } finally {
      setGuardando(false)
    }
  }

  // ── Eliminar (soft delete) ───────────────────────────────────────────────
  async function handleEliminar() {
    if (!docEliminar) return
    const { error } = await supabase.from('reglamentos').update({
      is_deleted: true, deleted_at: new Date().toISOString(),
      deleted_by: usuario.id, deleted_by_nombre: usuario.nombre,
    }).eq('id', docEliminar.id)
    if (error) { mostrarAviso('error', 'Error al eliminar'); return }
    await auditoria('enviado_a_papelera', docEliminar)
    setDocEliminar(null)
    mostrarAviso('ok', 'Documento enviado a la papelera')
    await cargarDocs()
  }

  // ── Ver documento ────────────────────────────────────────────────────────
  async function handleVerDoc(doc) {
    setDocVer(doc)
    await supabase.from('reglamentos').update({ visitas: (doc.visitas ?? 0) + 1 }).eq('id', doc.id)
    setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, visitas: (d.visitas ?? 0) + 1 } : d))
    await auditoria('ver', doc)
    setCargandoVersiones(true)
    const { data } = await supabase.from('reglamentos_versiones')
      .select('*').eq('reglamento_id', doc.id).order('creado_en', { ascending: false })
    setVersiones(data ?? [])
    setCargandoVersiones(false)
  }

  // ── Descargar ────────────────────────────────────────────────────────────
  async function handleDescargar(doc) {
    if (!doc.url) return mostrarAviso('error', 'No hay archivo disponible')
    await supabase.from('reglamentos').update({ descargas: (doc.descargas ?? 0) + 1 }).eq('id', doc.id)
    setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, descargas: (d.descargas ?? 0) + 1 } : d))
    await auditoria('descargar', doc)
    const a = document.createElement('a')
    a.href = doc.url; a.download = doc.nombre_archivo ?? doc.nombre; a.target = '_blank'
    a.click()
  }

  // ── Subir nueva versión ──────────────────────────────────────────────────
  async function handleSubirVersion() {
    if (!vArchivo || !modalVersion) return
    setGuardando(true)
    try {
      const doc = modalVersion
      if (doc.storage_path) {
        await supabase.from('reglamentos_versiones').insert({
          reglamento_id: doc.id, version: doc.version_actual,
          storage_path: doc.storage_path, url: doc.url,
          nombre_archivo: doc.nombre_archivo, tamano_bytes: doc.tamano_bytes,
          notas: vNotas.trim() || null,
          creado_por: doc.creado_por, creado_por_nombre: doc.creado_por_nombre,
          creado_en: doc.actualizado_en ?? doc.creado_en,
        })
      }
      const { path, url, nombre, bytes } = await subirArchivo(vArchivo, doc.categoria)
      const [may, men] = (doc.version_actual ?? '1.0').split('.').map(Number)
      const nuevaV = (men + 1 >= 10) ? `${may + 1}.0` : `${may}.${men + 1}`
      const { error } = await supabase.from('reglamentos').update({
        storage_path: path, url, nombre_archivo: nombre, tamano_bytes: bytes,
        version_actual: nuevaV, actualizado_en: new Date().toISOString(),
      }).eq('id', doc.id)
      if (error) throw error
      await auditoria('nueva_version', doc, [{ campo: 'version', anterior: doc.version_actual, nuevo: nuevaV }])
      mostrarAviso('ok', `Versión ${nuevaV} subida correctamente`)
      setModalVersion(null); setVArchivo(null); setVNotas('')
      await cargarDocs()
    } catch (e) {
      mostrarAviso('error', e.message ?? 'Error al subir versión')
    } finally {
      setGuardando(false)
    }
  }

  const cardBase = {
    background: '#fff', borderRadius: 16, padding: '20px 22px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.07)', border: '1px solid #f1f5f9',
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '28px 28px 40px', maxWidth: 1280, margin: '0 auto' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: 'linear-gradient(135deg, rgb(var(--primary-rgb)), #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <BookOpen size={20} color="#fff" />
            </div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em' }}>
              Reglamentos
            </h1>
          </div>
          <p style={{ margin: 0, fontSize: 14, color: '#64748b' }}>
            Consulta y administra documentos institucionales del establecimiento.
          </p>
        </div>
        {puedCrear && (
          <button onClick={abrirCrear} style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px',
            borderRadius: 11, border: 'none',
            background: 'linear-gradient(135deg, rgb(var(--primary-rgb)), #2563eb)',
            color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(26,35,126,0.28)', whiteSpace: 'nowrap',
            fontFamily: 'inherit',
          }}>
            <Plus size={16} /> Nuevo documento
          </button>
        )}
      </div>

      {/* ── Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total documentos',   value: stats.total,    Icon: FileText,    col: '#1a237e', bg: '#e8eaf6' },
          { label: 'Categorías',         value: stats.cats,     Icon: FolderOpen,  col: '#047857', bg: '#ecfdf5' },
          { label: 'Agregados este mes', value: stats.esteMes,  Icon: CalendarDays,col: '#b45309', bg: '#fffbeb' },
          { label: 'Más consultado',     value: stats.masVisto, Icon: Eye,         col: '#6d28d9', bg: '#f5f3ff', sm: true },
        ].map(({ label, value, Icon, col, bg, sm }) => (
          <div key={label} style={{ ...cardBase, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={22} color={col} />
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 10.5, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
              <p style={{ margin: '3px 0 0', fontSize: sm ? 13 : 22, fontWeight: 700, color: '#0f172a', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filtros ── */}
      <div style={{ ...cardBase, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
            <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar documentos..."
              style={{ ...inputSt, paddingLeft: 34 }} />
          </div>
          <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}
            style={{ flex: '0 0 160px', padding: '9px 10px', borderRadius: 9, border: '1.5px solid #e2e8f0', fontSize: 13, color: '#374151', background: '#f8fafc', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }}>
            <option value="">Todas las categorías</option>
            {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
            style={{ flex: '0 0 140px', padding: '9px 10px', borderRadius: 9, border: '1.5px solid #e2e8f0', fontSize: 13, color: '#374151', background: '#f8fafc', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }}>
            <option value="">Todos los estados</option>
            {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <input type="date" value={filtroFechaDesde} onChange={e => setFiltroFechaDesde(e.target.value)}
            title="Desde (fecha publicación)"
            style={{ flex: '0 0 140px', padding: '9px 10px', borderRadius: 9, border: '1.5px solid #e2e8f0', fontSize: 13, color: '#374151', background: '#f8fafc', outline: 'none', fontFamily: 'inherit' }} />
          <input type="date" value={filtroFechaHasta} onChange={e => setFiltroFechaHasta(e.target.value)}
            title="Hasta (fecha publicación)"
            style={{ flex: '0 0 140px', padding: '9px 10px', borderRadius: 9, border: '1.5px solid #e2e8f0', fontSize: 13, color: '#374151', background: '#f8fafc', outline: 'none', fontFamily: 'inherit' }} />
          {(busqueda || filtroCategoria || filtroEstado || filtroFechaDesde || filtroFechaHasta) && (
            <button onClick={() => { setBusqueda(''); setFiltroCategoria(''); setFiltroEstado(''); setFiltroFechaDesde(''); setFiltroFechaHasta('') }}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '9px 12px', borderRadius: 9, border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              <X size={13} /> Limpiar
            </button>
          )}
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 12.5, color: '#94a3b8' }}>
          {docsFiltrados.length === docs.length
            ? `${docs.length} documento${docs.length !== 1 ? 's' : ''}`
            : `${docsFiltrados.length} de ${docs.length} documentos`}
        </p>
      </div>

      {/* ── Tabla ── */}
      <div style={cardBase}>
        {cargando ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 10, color: '#94a3b8' }}>
            <Loader2 size={20} style={{ animation: 'spin 0.7s linear infinite' }} />
            Cargando documentos...
          </div>
        ) : docsFiltrados.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
            <BookOpen size={40} style={{ marginBottom: 14, opacity: 0.3 }} />
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#64748b' }}>
              {docs.length === 0 ? 'No hay documentos registrados' : 'No se encontraron documentos'}
            </p>
            <p style={{ margin: '6px 0 0', fontSize: 13 }}>
              {docs.length === 0
                ? (puedCrear ? 'Comienza cargando el primer documento institucional.' : 'Aún no se han cargado documentos.')
                : 'Prueba ajustando los filtros.'}
            </p>
            {docs.length === 0 && puedCrear && (
              <button onClick={abrirCrear} style={{ marginTop: 16, padding: '9px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, rgb(var(--primary-rgb)), #2563eb)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                + Nuevo documento
              </button>
            )}
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid #f1f5f9' }}>
                    {['Nombre', 'Categoría', 'Fecha publicación', 'Última actualización', 'Tamaño', 'Visitas', 'Estado', 'Acciones'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Acciones' ? 'right' : 'left', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {docsPaginados.map((doc, i) => {
                    const cc = CAT_COLOR[doc.categoria] ?? CAT_COLOR.Otros
                    const ec = EST_COLOR[doc.estado]    ?? EST_COLOR.Vigente
                    return (
                      <tr key={doc.id} style={{ borderBottom: i < docsPaginados.length - 1 ? '1px solid #f8fafc' : 'none' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#fafbfc'}
                        onMouseLeave={e => e.currentTarget.style.background = ''}
                      >
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 34, height: 34, borderRadius: 9, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <FileText size={16} color="#64748b" />
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>{doc.nombre}</p>
                              <p style={{ margin: '1px 0 0', fontSize: 11, color: '#94a3b8' }}>v{doc.version_actual ?? '1.0'}</p>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, color: cc.color, background: cc.bg }}>{doc.categoria}</span>
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: 13, color: '#475569', whiteSpace: 'nowrap' }}>{fmtFecha(doc.fecha_publicacion)}</td>
                        <td style={{ padding: '12px 14px', fontSize: 13, color: '#475569', whiteSpace: 'nowrap' }}>{fmtFechaHora(doc.actualizado_en ?? doc.creado_en)}</td>
                        <td style={{ padding: '12px 14px', fontSize: 13, color: '#475569', whiteSpace: 'nowrap' }}>{fmtBytes(doc.tamano_bytes)}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#475569' }}>
                            <Eye size={13} color="#94a3b8" /> {doc.visitas ?? 0}
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, color: ec.color, background: ec.bg, border: `1px solid ${ec.border}` }}>{doc.estado}</span>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
                            <button onClick={() => handleVerDoc(doc)} title="Ver" style={btnSm('#f1f5f9', '#475569')}><Eye size={14} /></button>
                            {puedDescargar && doc.url && (
                              <button onClick={() => handleDescargar(doc)} title="Descargar" style={btnSm('#eff6ff', '#1d4ed8')}><Download size={14} /></button>
                            )}
                            {puedEditar && (
                              <button onClick={() => abrirEditar(doc)} title="Editar" style={btnSm('#f0fdf4', '#15803d')}><Pencil size={14} /></button>
                            )}
                            {puedVersiones && (
                              <button onClick={() => { setModalVersion(doc); setVArchivo(null); setVNotas('') }} title="Subir nueva versión" style={btnSm('#faf5ff', '#7e22ce')}><Upload size={14} /></button>
                            )}
                            {puedEliminar && (
                              <button onClick={() => setDocEliminar(doc)} title="Eliminar" style={btnSm('#fef2f2', '#dc2626')}><Trash2 size={14} /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {totalPaginas > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 16, borderTop: '1px solid #f1f5f9', flexWrap: 'wrap', gap: 10 }}>
                <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
                  Página {pagina} de {totalPaginas} · {docsFiltrados.length} documentos
                </p>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1} style={btnPag(pagina === 1)}>
                    <ChevronLeft size={14} /> Anterior
                  </button>
                  <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas} style={btnPag(pagina === totalPaginas)}>
                    Siguiente <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Toast ── */}
      <AnimatePresence>
        {aviso && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            style={{
              position: 'fixed', bottom: 28, right: 28, zIndex: 800,
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 18px', borderRadius: 12,
              background: aviso.tipo === 'ok' ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${aviso.tipo === 'ok' ? '#86efac' : '#fca5a5'}`,
              boxShadow: '0 8px 30px rgba(0,0,0,0.14)',
              color: aviso.tipo === 'ok' ? '#166534' : '#b91c1c',
              fontSize: 14, fontWeight: 500, maxWidth: 380,
            }}
          >
            {aviso.tipo === 'ok' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            {aviso.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════════ MODALES ════════════════ */}

      {/* ── Modal Crear/Editar ── */}
      <AnimatePresence>
        {modalForm && (
          <motion.div variants={overlayV} initial="hidden" animate="visible" exit="exit"
            style={{ position: 'fixed', inset: 0, background: 'rgba(5,12,55,0.68)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 20 }}
            onClick={() => !guardando && setModalForm(false)}
          >
            <motion.div variants={modalV} initial="hidden" animate="visible" exit="exit"
              onClick={e => e.stopPropagation()}
              style={{ background: '#fff', borderRadius: 20, padding: '28px 28px 24px', width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 28px 90px rgba(0,0,0,0.38)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
                  {docEditar ? 'Editar documento' : 'Nuevo documento'}
                </h2>
                <button onClick={() => !guardando && setModalForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, display: 'flex' }}>
                  <X size={20} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                <div>
                  <label style={labelSt}>Nombre del documento *</label>
                  <input value={fNombre} onChange={e => setFNombre(e.target.value)} placeholder="Ej: Reglamento Interno 2026" style={inputSt} />
                </div>
                <div>
                  <label style={labelSt}>Descripción</label>
                  <textarea value={fDescripcion} onChange={e => setFDescripcion(e.target.value)} rows={3} placeholder="Descripción breve..." style={{ ...inputSt, resize: 'vertical', minHeight: 70 }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelSt}>Categoría *</label>
                    <select value={fCategoria} onChange={e => setFCategoria(e.target.value)} style={{ ...inputSt, cursor: 'pointer' }}>
                      {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelSt}>Estado *</label>
                    <select value={fEstado} onChange={e => setFEstado(e.target.value)} style={{ ...inputSt, cursor: 'pointer' }}>
                      {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={labelSt}>Fecha de publicación</label>
                  <input type="date" value={fFechaPubl} onChange={e => setFFechaPubl(e.target.value)} style={inputSt} />
                </div>
                <div>
                  <label style={labelSt}>Etiquetas (separadas por coma)</label>
                  <input value={fEtiquetas} onChange={e => setFEtiquetas(e.target.value)} placeholder="Ej: DAEM, urgente, 2026" style={inputSt} />
                </div>
                <div>
                  <label style={labelSt}>
                    Archivo {docEditar ? '(vacío = conservar actual)' : '*'}
                  </label>
                  {docEditar?.nombre_archivo && !fArchivo && (
                    <p style={{ margin: '0 0 6px', fontSize: 12.5, color: '#64748b', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <FileText size={13} />
                      Actual: <strong>{docEditar.nombre_archivo}</strong> ({fmtBytes(docEditar.tamano_bytes)})
                    </p>
                  )}
                  <input type="file" accept=".pdf,.docx,.xlsx,.doc,.xls"
                    onChange={e => setFArchivo(e.target.files?.[0] ?? null)}
                    style={{ width: '100%', fontSize: 13, color: '#374151' }} />
                  <p style={{ margin: '4px 0 0', fontSize: 11.5, color: '#94a3b8' }}>
                    PDF, DOCX, XLSX · Máx. 50 MB
                  </p>
                </div>
                {subiendoArchivo && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#1d4ed8', fontSize: 13 }}>
                    <Loader2 size={15} style={{ animation: 'spin 0.7s linear infinite' }} />
                    Subiendo archivo...
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
                <button onClick={() => !guardando && setModalForm(false)} disabled={guardando}
                  style={{ flex: 1, padding: '11px 0', borderRadius: 11, border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#475569', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Cancelar
                </button>
                <button onClick={handleGuardar} disabled={guardando || subiendoArchivo}
                  style={{ flex: 1, padding: '11px 0', borderRadius: 11, border: 'none', background: (guardando || subiendoArchivo) ? '#e2e8f0' : 'linear-gradient(135deg, rgb(var(--primary-rgb)), #2563eb)', color: (guardando || subiendoArchivo) ? '#94a3b8' : '#fff', fontSize: 14, fontWeight: 700, cursor: (guardando || subiendoArchivo) ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: (guardando || subiendoArchivo) ? 'none' : '0 4px 14px rgba(26,35,126,0.26)' }}>
                  {guardando ? 'Guardando...' : docEditar ? 'Guardar cambios' : 'Crear documento'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal Ver documento ── */}
      <AnimatePresence>
        {docVer && (
          <motion.div variants={overlayV} initial="hidden" animate="visible" exit="exit"
            style={{ position: 'fixed', inset: 0, background: 'rgba(5,12,55,0.78)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: '20px' }}
            onClick={() => setDocVer(null)}
          >
            <motion.div variants={modalV} initial="hidden" animate="visible" exit="exit"
              onClick={e => e.stopPropagation()}
              style={{ display: 'flex', width: '100%', maxWidth: 1100, height: 'calc(100vh - 40px)', maxHeight: 780, background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 30px 100px rgba(0,0,0,0.45)' }}
            >
              {/* Panel info */}
              <div style={{ width: 290, flexShrink: 0, background: '#f8fafc', borderRight: '1px solid #e2e8f0', padding: '24px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0 }}>
                <div style={{ marginBottom: 18 }}>
                  <div style={{ width: 46, height: 46, borderRadius: 13, background: 'linear-gradient(135deg, rgb(var(--primary-rgb)), #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                    <FileText size={22} color="#fff" />
                  </div>
                  <h2 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: '#0f172a', lineHeight: 1.35 }}>{docVer.nombre}</h2>
                  {docVer.descripcion && <p style={{ margin: 0, fontSize: 12.5, color: '#64748b', lineHeight: 1.5 }}>{docVer.descripcion}</p>}
                </div>

                {[
                  { label: 'Categoría',   val: docVer.categoria,         badge: 'cat' },
                  { label: 'Estado',      val: docVer.estado,            badge: 'est' },
                  { label: 'Versión',     val: `v${docVer.version_actual ?? '1.0'}` },
                  { label: 'Publicación', val: fmtFecha(docVer.fecha_publicacion) },
                  { label: 'Subido por',  val: docVer.creado_por_nombre ?? '—' },
                  { label: 'Visitas',     val: docVer.visitas ?? 0 },
                  { label: 'Descargas',   val: docVer.descargas ?? 0 },
                  { label: 'Tamaño',      val: fmtBytes(docVer.tamano_bytes) },
                  { label: 'Archivo',     val: docVer.nombre_archivo ?? '—', sm: true },
                ].map(({ label, val, badge, sm }) => (
                  <div key={label} style={{ marginBottom: 12 }}>
                    <p style={{ margin: '0 0 3px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
                    {badge === 'cat' ? (
                      <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 999, fontSize: 12, fontWeight: 600, color: (CAT_COLOR[val] ?? CAT_COLOR.Otros).color, background: (CAT_COLOR[val] ?? CAT_COLOR.Otros).bg }}>{val}</span>
                    ) : badge === 'est' ? (
                      <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 999, fontSize: 12, fontWeight: 600, color: (EST_COLOR[val] ?? EST_COLOR.Vigente).color, background: (EST_COLOR[val] ?? EST_COLOR.Vigente).bg, border: `1px solid ${(EST_COLOR[val] ?? EST_COLOR.Vigente).border}` }}>{val}</span>
                    ) : (
                      <p style={{ margin: 0, fontSize: sm ? 11.5 : 13.5, fontWeight: 600, color: '#0f172a', wordBreak: 'break-word' }}>{val}</p>
                    )}
                  </div>
                ))}

                {(docVer.etiquetas ?? []).length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <p style={{ margin: '0 0 5px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Etiquetas</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {docVer.etiquetas.map(t => (
                        <span key={t} style={{ padding: '2px 8px', borderRadius: 999, background: '#f1f5f9', color: '#475569', fontSize: 11.5, fontWeight: 500 }}>{t}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Historial versiones */}
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 14, marginTop: 4 }}>
                  <p style={{ margin: '0 0 10px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <History size={12} /> Historial versiones
                  </p>
                  <div style={{ padding: '7px 10px', borderRadius: 8, background: '#e8eaf6', marginBottom: 5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#1a237e' }}>v{docVer.version_actual ?? '1.0'} (actual)</span>
                      {puedDescargar && docVer.url && (
                        <button onClick={() => handleDescargar(docVer)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1a237e', padding: 3, display: 'flex' }}><Download size={13} /></button>
                      )}
                    </div>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b' }}>{fmtFechaHora(docVer.actualizado_en ?? docVer.creado_en)}</p>
                  </div>
                  {cargandoVersiones ? (
                    <p style={{ fontSize: 12, color: '#94a3b8', margin: '6px 0' }}>Cargando...</p>
                  ) : versiones.length === 0 ? (
                    <p style={{ fontSize: 12, color: '#94a3b8', margin: '6px 0' }}>Primera versión.</p>
                  ) : versiones.map(v => (
                    <div key={v.id} style={{ padding: '7px 10px', borderRadius: 8, background: '#fff', border: '1px solid #e2e8f0', marginBottom: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>v{v.version}</span>
                        {puedDescargar && v.url && (
                          <a href={v.url} download={v.nombre_archivo ?? `v${v.version}`} target="_blank" rel="noreferrer" style={{ color: '#1d4ed8', display: 'flex' }}><Download size={13} /></a>
                        )}
                      </div>
                      <p style={{ margin: '2px 0 0', fontSize: 10.5, color: '#94a3b8' }}>{fmtFechaHora(v.creado_en)}</p>
                      {v.notas && <p style={{ margin: '3px 0 0', fontSize: 11, color: '#64748b' }}>{v.notas}</p>}
                    </div>
                  ))}
                </div>

                {/* Botones acción */}
                <div style={{ marginTop: 'auto', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {puedDescargar && docVer.url && (
                    <button onClick={() => handleDescargar(docVer)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 0', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, rgb(var(--primary-rgb)), #2563eb)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>
                      <Download size={15} /> Descargar
                    </button>
                  )}
                  {puedEditar && (
                    <button onClick={() => { setDocVer(null); abrirEditar(docVer) }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 0', borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>
                      <Pencil size={15} /> Editar
                    </button>
                  )}
                </div>
              </div>

              {/* Panel visualizador */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <FileText size={16} color="#64748b" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {docVer.nombre_archivo ?? docVer.nombre}
                    </span>
                  </div>
                  <button onClick={() => setDocVer(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, display: 'flex', flexShrink: 0 }}>
                    <X size={18} />
                  </button>
                </div>
                <div style={{ flex: 1, overflow: 'hidden', background: '#f1f5f9' }}>
                  {docVer.url && esPDF(docVer.nombre_archivo) ? (
                    <iframe src={`${docVer.url}#toolbar=1&navpanes=0`} title={docVer.nombre}
                      style={{ width: '100%', height: '100%', border: 'none' }} />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 14, color: '#94a3b8', padding: 20 }}>
                      <FileText size={52} style={{ opacity: 0.25 }} />
                      <p style={{ margin: 0, fontSize: 14.5, fontWeight: 600, color: '#64748b', textAlign: 'center' }}>
                        {docVer.nombre_archivo
                          ? 'Vista previa no disponible para este tipo de archivo'
                          : 'No hay archivo asociado a este documento'}
                      </p>
                      <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', textAlign: 'center' }}>
                        {docVer.nombre_archivo && 'Solo se puede previsualizar archivos PDF.'}
                      </p>
                      {puedDescargar && docVer.url && (
                        <button onClick={() => handleDescargar(docVer)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 22px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, rgb(var(--primary-rgb)), #2563eb)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                          <Download size={15} /> Descargar documento
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal Nueva versión ── */}
      <AnimatePresence>
        {modalVersion && (
          <motion.div variants={overlayV} initial="hidden" animate="visible" exit="exit"
            style={{ position: 'fixed', inset: 0, background: 'rgba(5,12,55,0.68)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 20 }}
            onClick={() => !guardando && setModalVersion(null)}
          >
            <motion.div variants={modalV} initial="hidden" animate="visible" exit="exit"
              onClick={e => e.stopPropagation()}
              style={{ background: '#fff', borderRadius: 20, padding: '28px 28px 24px', width: '100%', maxWidth: 460, boxShadow: '0 28px 90px rgba(0,0,0,0.38)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: '#faf5ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Upload size={22} color="#7e22ce" />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Subir nueva versión</h2>
                  <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>{modalVersion.nombre}</p>
                </div>
              </div>

              <div style={{ background: '#f8fafc', borderRadius: 10, padding: '11px 14px', marginBottom: 16, fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
                Versión actual: <strong>v{modalVersion.version_actual ?? '1.0'}</strong>
                {modalVersion.nombre_archivo && <> · <strong>{modalVersion.nombre_archivo}</strong></>}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={labelSt}>Nuevo archivo *</label>
                  <input type="file" accept=".pdf,.docx,.xlsx,.doc,.xls"
                    onChange={e => setVArchivo(e.target.files?.[0] ?? null)}
                    style={{ width: '100%', fontSize: 13, color: '#374151' }} />
                </div>
                <div>
                  <label style={labelSt}>Notas de esta versión</label>
                  <textarea value={vNotas} onChange={e => setVNotas(e.target.value)} rows={2}
                    placeholder="¿Qué cambió en esta versión?"
                    style={{ ...inputSt, resize: 'vertical' }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
                <button onClick={() => !guardando && setModalVersion(null)} disabled={guardando}
                  style={{ flex: 1, padding: '11px 0', borderRadius: 11, border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Cancelar
                </button>
                <button onClick={handleSubirVersion} disabled={!vArchivo || guardando}
                  style={{ flex: 1, padding: '11px 0', borderRadius: 11, border: 'none', background: (!vArchivo || guardando) ? '#e2e8f0' : 'linear-gradient(135deg, #7e22ce, #6d28d9)', color: (!vArchivo || guardando) ? '#94a3b8' : '#fff', fontSize: 13, fontWeight: 700, cursor: (!vArchivo || guardando) ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: (!vArchivo || guardando) ? 'none' : '0 4px 14px rgba(109,40,217,0.32)' }}>
                  {guardando ? 'Subiendo...' : 'Subir versión'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal Confirmar eliminar ── */}
      <AnimatePresence>
        {docEliminar && (
          <motion.div variants={overlayV} initial="hidden" animate="visible" exit="exit"
            style={{ position: 'fixed', inset: 0, background: 'rgba(5,12,55,0.68)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 20 }}
            onClick={() => setDocEliminar(null)}
          >
            <motion.div variants={modalV} initial="hidden" animate="visible" exit="exit"
              onClick={e => e.stopPropagation()}
              style={{ background: '#fff', borderRadius: 20, padding: '28px 28px 24px', width: '100%', maxWidth: 420, boxShadow: '0 28px 90px rgba(0,0,0,0.38)' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
                <div style={{ width: 46, height: 46, borderRadius: 13, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Trash2 size={22} color="#dc2626" />
                </div>
                <div>
                  <h3 style={{ margin: '2px 0 5px', fontSize: 16, fontWeight: 700, color: '#0f172a' }}>¿Eliminar documento?</h3>
                  <p style={{ margin: 0, fontSize: 13.5, color: '#64748b', lineHeight: 1.5 }}>
                    <strong>{docEliminar.nombre}</strong> será enviado a la papelera. Podrás restaurarlo durante 30 días.
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setDocEliminar(null)} style={{ flex: 1, padding: '11px 0', borderRadius: 11, border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Cancelar
                </button>
                <button onClick={handleEliminar} style={{ flex: 1, padding: '11px 0', borderRadius: 11, border: 'none', background: 'linear-gradient(135deg, #dc2626, #b91c1c)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(220,38,38,0.32)' }}>
                  Eliminar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
