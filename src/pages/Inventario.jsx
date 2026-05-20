import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '../supabase'
import './Inventario.css'
import ImportarCSV from './ImportarCSV'
import './ImportarCSV.css'
import {
  cachearBienes, cachearCategorias, cachearPermisos,
  obtenerCacheBienes, obtenerCacheCategorias, obtenerCachePermisos,
  obtenerPendientes, agregarPendiente, eliminarPendiente,
} from '../offline'

// Inserta campos faltantes en su posición natural, no al final
function smartMergeOrder(savedOrder, naturalOrder) {
  const result = [...savedOrder]
  const missing = naturalOrder.filter(id => !savedOrder.includes(id))
  for (const id of missing) {
    const natIdx = naturalOrder.indexOf(id)
    let insertAfter = -1
    for (let i = natIdx - 1; i >= 0; i--) {
      const predIdx = result.indexOf(naturalOrder[i])
      if (predIdx !== -1) { insertAfter = predIdx; break }
    }
    if (insertAfter >= 0) {
      result.splice(insertAfter + 1, 0, id)
    } else {
      let insertBefore = result.length
      for (let i = natIdx + 1; i < naturalOrder.length; i++) {
        const succIdx = result.indexOf(naturalOrder[i])
        if (succIdx !== -1) { insertBefore = succIdx; break }
      }
      result.splice(insertBefore, 0, id)
    }
  }
  return result
}

function logActividad(usuario, accion, bienNombre, bienId = null) {
  supabase.from('actividades').insert({
    usuario_nombre: usuario?.nombre || 'Sistema',
    accion,
    bien_nombre: bienNombre,
    bien_id: bienId || null,
  }).then().catch(() => {})
}

const ESTADO_BADGE = { Bueno: 'badge-bueno', Regular: 'badge-regular', Malo: 'badge-malo', Baja: 'badge-baja' }
const ICONOS = ['📦','🪑','📚','📖','🖨️','💻','🖥️','🖱️','📷','📱','🔧','🗂️','🗃️','🖼️','🏫','⚗️','🎨','🎒','🔬','🪞','⚽','🏀','🏐','🏈','🎾','🏓','🏸','🥊','🏋️','🎽','🏊','🤸','🎭','🎵','🔭','🧪','🖊️','📐','📏','🗑️']

const formVacio = {
  nombre: '', categoria: '', codigo: '', cantidad: 1,
  estado: 'Bueno', ubicacion: '', area: '', responsable: '', obs: '',
  isbn: '', autor: '', genero: '',
  descripcion: '',
  fecha_adquisicion: '', proveedor: '', numero_factura: '', numero_orden: '', fondo: '', garantia: '',
}

const formVacioComp = {
  nombre: '', categoria: 'computadores', codigo: '', cantidad: 1,
  estado: 'Bueno', ubicacion: '', area: '', responsable: '', obs: '',
  tipo: 'Desktop', marca: '', numero_serie: '', modelo: '', pantalla: '', ram_tipo: '', ram_slots: '',
  cpu: '', cpu_marca: '', cpu_modelo: '', cpu_generacion: '',
  ram: '', memoria: '', tipo_almacenamiento: 'SSD', sistema_operativo: 'Windows 11 Pro',
  licencia_windows: '', win_version: '', win_proveedor: '', win_factura: '', win_fecha_factura: '', win_orden: '', win_tipo_licencia: 'key',
  licencia_office: '', off_version: '', off_proveedor: '', off_factura: '', off_fecha_factura: '', off_orden: '', off_tipo_licencia: 'key',
  fecha_adquisicion: '', proveedor: '', numero_factura: '', numero_orden: '', fondo: '', garantia: '',
}

const formVacioTecno = {
  nombre: '', categoria: '', codigo: '', cantidad: 1,
  estado: 'Bueno', ubicacion: '', area: '', responsable: '', obs: '',
  tipo: '', tecnologia: '', marca: '', modelo: '', numero_serie: '',
  consumible: '', proveedor: '', numero_factura: '', numero_orden: '',
  fecha_adquisicion: '', fondo: '', garantia: '',
}

// ── ComboField: input con sugerencias desde la BD ─────────────────────────
function ComboField({ name, value, onChange, placeholder, opciones = [], maxLength, className }) {
  const [abierto, setAbierto] = useState(false)
  const refDiv = useRef()

  const filtradas = opciones
    .filter(o => o && o.toLowerCase().includes((value || '').toLowerCase()))
    .slice(0, 14)

  return (
    <div ref={refDiv} className="combo-wrap" style={{ position: 'relative' }}>
      <input
        name={name}
        value={value ?? ''}
        onChange={onChange}
        onFocus={() => setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 160)}
        placeholder={placeholder}
        maxLength={maxLength}
        className={className}
        autoComplete="off"
        style={{ paddingRight: opciones.length > 0 ? '26px' : undefined }}
      />
      {opciones.length > 0 && (
        <span className="combo-chevron" onMouseDown={e => { e.preventDefault(); setAbierto(a => !a) }}>▼</span>
      )}
      {abierto && filtradas.length > 0 && (
        <div className="combo-dropdown">
          {filtradas.map((o, i) => (
            <div
              key={i}
              className="combo-option"
              onMouseDown={e => { e.preventDefault(); onChange({ target: { name, value: o } }); setAbierto(false) }}
            >
              {o}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Inventario({ usuario, abrirBienId, onAbrirBienDone, abrirCatId, onAbrirCatDone }) {
  const esAdmin  = usuario?.rol === 'admin'

  // ── Estado de conexión ────────────────────────────────────────────────────
  const [online,        setOnline]        = useState(navigator.onLine)
  const [sincronizando, setSincronizando] = useState(false)

  // ── Permisos granulares ───────────────────────────────────────────────────
  // Admin: permisos completos siempre. Otros: se cargan desde permisos_usuario.
  const [permisos, setPermisos] = useState(() =>
    usuario?.rol === 'admin'
      ? { ver_inventario: true, agregar_bien: true, editar_bien: true,
          eliminar_bien: true, eliminar_lote: true, gestionar_categorias: true,
          importar_csv: true, gestionar_usuarios: true, exportar: true,
          registrar_prestamo: true, registrar_incidencia: true }
      : { ver_inventario: true, agregar_bien: false, editar_bien: false,
          eliminar_bien: false, eliminar_lote: false, gestionar_categorias: false,
          importar_csv: false, gestionar_usuarios: false, exportar: false,
          registrar_prestamo: false, registrar_incidencia: false }
  )
  // ['todos'] = acceso a todas las categorías; si no, lista de keys permitidas
  const [categoriasPermitidas, setCategoriasPermitidas] = useState(['todos'])

  // Variables derivadas (reemplazan las de rol)
  const puedeAgregar        = permisos.agregar_bien
  const puedeEliminar       = permisos.eliminar_bien
  const puedeEliminarLote   = permisos.eliminar_lote
  const puedeExportar       = permisos.exportar
  const puedeImportar       = permisos.importar_csv
  const puedeGestionarCats  = permisos.gestionar_categorias
  const puedePrestamo       = permisos.registrar_prestamo
  const puedeIncidencias    = permisos.registrar_incidencia

  const [bienes, setBienes]           = useState([])
  const [categorias, setCategorias]   = useState([])
  const [cargando, setCargando]       = useState(true)
  const [catActual, setCatActual]     = useState(() => localStorage.getItem('inv_catActual') || 'todos')
  const [verTodosTodos, setVerTodosTodos] = useState(false)
  const [paginaInv, setPaginaInv] = useState(1)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm]               = useState(formVacio)
  const [camposExtra, setCamposExtra] = useState({})
  const [errores, setErrores]         = useState({})
  const [editandoId, setEditandoId]   = useState(null)
  const [guardando, setGuardando]     = useState(false)
  const [modalCat, setModalCat]       = useState(false)
  const [nuevaCat, setNuevaCat]       = useState({ label: '', icon: '📦' })
  const [errorCat, setErrorCat]       = useState(false)
  const [verDetalle, setVerDetalle]   = useState(null)
  const [editCat, setEditCat]         = useState(null)
  const [errorEditCat, setErrorEditCat] = useState(false)
  const [confirmar, setConfirmar]     = useState(null) // {mensaje, onOk}
  const [aviso, setAviso]             = useState(null) // {mensaje}
  const [modalImportar, setModalImportar] = useState(false)
  const [modalEditar, setModalEditar] = useState(false)
  const [busqueda, setBusqueda]       = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroPrestado, setFiltroPrestado] = useState('')  // '' | 'prestado' | 'disponible'
  const [seleccion, setSeleccion]     = useState(new Set()) // ids seleccionados
  const [filtros, setFiltros]         = useState({}) // filtros dinámicos { campo: valor }
  const [menuExportar, setMenuExportar] = useState(false)
  const [modoQR, setModoQR]           = useState(false)
  const [seleccionQR, setSeleccionQR] = useState(new Set())
  const [prestamoBien, setPrestamoBien]       = useState(null)  // préstamo activo del bien en detalle
  const [cargandoPrestamo, setCargandoPrestamo] = useState(false)
  const [modalPrestamo, setModalPrestamo]     = useState(null) // bien para el modal de registro
  const [formPrestamo, setFormPrestamo]       = useState({ prestado_a: '', cargo: '', fecha_devolucion_esperada: '', notas: '' })
  const [guardandoPrestamo, setGuardandoPrestamo] = useState(false)
  const [bienesConPrestamo, setBienesConPrestamo] = useState(new Map()) // Map<id, fecha_devolucion_esperada>
  const [catsVisible, setCatsVisible] = useState(true)
  const [filtrosOpen, setFiltrosOpen] = useState(false)
  const [modalIncidencias, setModalIncidencias] = useState(null) // bien object
  // Drag & drop + pin
  const [catOrder, setCatOrder]     = useState([]) // orden de ids
  const [pinnedCats, setPinnedCats] = useState(() => {
    try { return JSON.parse(localStorage.getItem('inv_pinned') || '[]') } catch { return [] }
  })
  const [dragOver, setDragOver]     = useState(null) // id sobre el que se arrastra
  const [dragging, setDragging]     = useState(null) // id que se arrastra

  // ── Sincronizar pendientes con Supabase ───────────────────────────────────
  async function sincronizarPendientes() {
    const pendientes = obtenerPendientes()
    if (pendientes.length === 0) return
    setSincronizando(true)
    let ok = 0
    for (const item of pendientes) {
      // eslint-disable-next-line no-unused-vars
      const { id, _pendiente, creado_en, actualizado_en, ...payload } = item
      const { data, error } = await supabase.from('bienes').insert(payload).select().single()
      if (!error && data) {
        eliminarPendiente(id)
        setBienes(prev => prev.map(b => b.id === id ? data : b))
        ok++
      }
    }
    setSincronizando(false)
    if (ok > 0) setAviso(`✓ ${ok} bien${ok !== 1 ? 'es' : ''} sincronizado${ok !== 1 ? 's' : ''} correctamente`)
  }

  // ── Detectar cambios de conexión ──────────────────────────────────────────
  useEffect(() => {
    const goOnline = async () => { setOnline(true); await sincronizarPendientes() }
    const goOffline = () => setOnline(false)
    window.addEventListener('online',  goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online',  goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, []) // eslint-disable-line

  useEffect(() => { cargarDatos() }, [])

  const cargarDatos = async () => {
    setCargando(true)

    // Defaults por rol (fallback si no hay fila en BD)
    const defaultsPorRol = {
      admin: {
        ver_inventario: true, agregar_bien: true, editar_bien: true,
        eliminar_bien: true, eliminar_lote: true, gestionar_categorias: true,
        importar_csv: true, gestionar_usuarios: true, exportar: true,
        registrar_prestamo: true, registrar_incidencia: true,
      },
      editor: {
        ver_inventario: true, agregar_bien: true, editar_bien: true,
        eliminar_bien: false, eliminar_lote: false, gestionar_categorias: false,
        importar_csv: false, gestionar_usuarios: false, exportar: true,
        registrar_prestamo: true, registrar_incidencia: true,
      },
      encargado: {
        ver_inventario: true, agregar_bien: false, editar_bien: false,
        eliminar_bien: false, eliminar_lote: false, gestionar_categorias: false,
        importar_csv: false, gestionar_usuarios: false, exportar: true,
        registrar_prestamo: false, registrar_incidencia: false,
      },
    }

    // ── Modo offline: usar caché ──────────────────────────────────────────
    if (!navigator.onLine) {
      const cats       = obtenerCacheCategorias()
      const bs         = obtenerCacheBienes()
      const cached     = obtenerCachePermisos()
      const pendientes = obtenerPendientes()
      if (!cats) {
        setAviso('Sin conexión y sin datos guardados. Conéctate al menos una vez para cargar el inventario.')
        setCargando(false)
        return
      }
      const saved = (() => { try { return JSON.parse(localStorage.getItem('inv_cat_order') || 'null') } catch { return null } })()
      const ids = cats.map(c => c.id)
      const rol = usuario?.rol ?? 'encargado'
      const permisosOffline = esAdmin
        ? defaultsPorRol.admin
        : (cached?.permisos ?? defaultsPorRol[rol] ?? defaultsPorRol.encargado)
      const catsOffline = esAdmin ? ['todos'] : (cached?.categorias ?? ['todos'])
      setCategorias(cats)
      setBienes([...(bs ?? []), ...pendientes])
      setCatOrder(saved ? [...new Set([...saved.filter(id => ids.includes(id)), ...ids])] : ids)
      setPermisos(permisosOffline)
      setCategoriasPermitidas(catsOffline)
      setCargando(false)
      return
    }

    // ── Modo online: cargar desde Supabase ────────────────────────────────
    const queries = [
      supabase.from('categorias').select('*').order('creado_en'),
      supabase.from('bienes').select('*').order('creado_en', { ascending: false }),
    ]
    if (!esAdmin && usuario?.id) {
      queries.push(
        supabase.from('permisos_usuario').select('permisos, categorias')
          .eq('usuario_id', usuario.id).maybeSingle()
      )
    }

    const results = await Promise.all(queries)
    if (results[0].error || results[1].error) {
      setAviso('Error al cargar el inventario. Recarga la página.')
      setCargando(false)
      return
    }
    const cats = results[0].data ?? []
    const bs   = results[1].data ?? []
    const pd   = results[2]?.data ?? null

    // Resolver permisos finales
    const rol = usuario?.rol ?? 'encargado'
    const permisosFinales = esAdmin
      ? defaultsPorRol.admin
      : pd?.permisos
        ? { ...(defaultsPorRol[rol] ?? defaultsPorRol.encargado), ...pd.permisos }
        : (defaultsPorRol[rol] ?? defaultsPorRol.encargado)
    const traducirClaves = (claves, allCats) => {
      if (!claves || claves.includes('todos')) return ['todos']
      const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')
      return claves.map(clave => {
        if (allCats.some(c => c.id === clave)) return clave
        const claveNorm = norm(clave.replace(/_/g, ' '))
        return allCats.find(c => norm(c.label) === claveNorm)?.id ?? null
      }).filter(Boolean)
    }
    const catsFinales = pd?.categorias ? traducirClaves(pd.categorias, cats) : ['todos']

    // Guardar en caché para uso offline
    cachearCategorias(cats)
    cachearBienes(bs)
    cachearPermisos({ permisos: permisosFinales, categorias: catsFinales })

    // Inicializar orden desde localStorage o por defecto
    const saved = (() => { try { return JSON.parse(localStorage.getItem('inv_cat_order') || 'null') } catch { return null } })()
    const ids = cats.map(c => c.id)

    setCategorias(cats)
    setBienes(bs)
    setCatOrder(saved ? [...new Set([...saved.filter(id => ids.includes(id)), ...ids])] : ids)
    setPermisos(permisosFinales)
    setCategoriasPermitidas(catsFinales)
    setCargando(false)

    // Sincronizar pendientes que quedaron de sesiones anteriores
    setTimeout(() => sincronizarPendientes(), 800)
  }

  // Orden final: pinned primero, luego el resto según catOrder
  const categoriasOrdenadas = () => {
    const pinned = catOrder.filter(id => pinnedCats.includes(id))
    const rest   = catOrder.filter(id => !pinnedCats.includes(id))
    const ordered = [...pinned, ...rest]
    return ordered.map(id => categorias.find(c => c.id === id)).filter(Boolean)
  }

  const togglePin = (id, e) => {
    e.stopPropagation()
    setPinnedCats(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      localStorage.setItem('inv_pinned', JSON.stringify(next))
      return next
    })
  }

  const onDragStart = (e, id) => {
    setDragging(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }
  const onDragOver = (e, id) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (id !== dragging) setDragOver(id)
  }
  const onDrop = (e, targetId) => {
    e.preventDefault()
    const srcId = e.dataTransfer.getData('text/plain') || dragging
    if (!srcId || srcId === targetId) { setDragging(null); setDragOver(null); return }
    setCatOrder(prev => {
      const next = [...prev]
      const from = next.indexOf(srcId)
      const to   = next.indexOf(targetId)
      if (from === -1 || to === -1) return prev
      next.splice(from, 1)
      next.splice(to, 0, srcId)
      localStorage.setItem('inv_cat_order', JSON.stringify(next))
      return next
    })
    setDragging(null)
    setDragOver(null)
  }
  const onDragEnd = () => { setDragging(null); setDragOver(null) }

  // Bienes permitidos por categoría según permisos del usuario
  const tieneAccesoCat = (catId) => {
    if (esAdmin) return true
    if (categoriasPermitidas.includes('todos')) return true
    return categoriasPermitidas.includes(catId)
  }
  const bienesPermitidos = bienes.filter(b => tieneAccesoCat(b.categoria))
  const bienCount   = (id) => id === 'todos' ? bienesPermitidos.length : bienesPermitidos.filter(b => b.categoria === id).length

  // En "Todos" sin filtros activos: mostrar solo los 25 más recientes (por código desc)
  const hayFiltrosActivos = busqueda || filtroEstado || filtroPrestado || Object.values(filtros).some(Boolean)
  const filtradosBase = (() => {
    if (catActual !== 'todos') return bienesPermitidos.filter(b => b.categoria === catActual)
    const todos = [...bienesPermitidos].sort((a, b) => {
      const numA = parseInt((a.codigo || '').replace(/\D/g, '')) || 0
      const numB = parseInt((b.codigo || '').replace(/\D/g, '')) || 0
      return numB - numA
    })
    return (hayFiltrosActivos || verTodosTodos) ? todos : todos.slice(0, 25)
  })()

  const filtrados = filtradosBase.filter(b => {
    const q = busqueda.toLowerCase()
    const matchBusqueda = !q || [b.nombre, b.codigo, b.marca, b.modelo, b.numero_serie, b.ubicacion, b.area, b.responsable, b.cpu, b.sistema_operativo]
      .some(v => v && String(v).toLowerCase().includes(q))
    const matchEstado = !filtroEstado || b.estado === filtroEstado
    const matchPrestado = !filtroPrestado
      || (filtroPrestado === 'prestado' && bienesConPrestamo.has(b.id))
      || (filtroPrestado === 'vencido'   && esVencido(b.id))
      || (filtroPrestado === 'disponible' && !bienesConPrestamo.has(b.id))
    const matchFiltros = Object.entries(filtros).every(([campo, val]) => !val || String(b[campo] ?? '').toLowerCase() === val.toLowerCase())
    return matchBusqueda && matchEstado && matchPrestado && matchFiltros
  })

  const hoy = new Date().toISOString().slice(0, 10)
  const esVencido = (id) => { const f = bienesConPrestamo.get(id); return !!f && f < hoy }

  const POR_PAG_INV    = 25
  const totalPagsInv   = Math.ceil(filtrados.length / POR_PAG_INV)
  const filtradosPagInv = filtrados.slice((paginaInv - 1) * POR_PAG_INV, paginaInv * POR_PAG_INV)
  const pBtnInv = (dis) => ({ padding: '5px 11px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: dis ? '#f9fafb' : '#fff', color: dis ? '#d1d5db' : '#374151', cursor: dis ? 'default' : 'pointer', fontSize: 12, fontWeight: 600 })

  // Valores únicos para dropdowns dinámicos
  const unicos = (campo) => [...new Set(filtradosBase.map(b => b[campo]).filter(Boolean))].sort()
  const getCatLabel = (id) => categorias.find(c => c.id === id)?.label ?? id
  const catInfo     = [{ id: 'todos', label: 'Todos', icon: '◉' }, ...categorias].find(c => c.id === catActual)
  const esComp   = (cat) => cat === 'computadores'
  const esTecno  = (cat) => {
    if (!cat) return false
    const obj = categorias.find(c => c.id === cat)
    const label = (obj?.label ?? cat).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    return label.includes('tecnol')
  }
  const esBiblioteca = (cat) => {
    if (!cat) return false
    const obj = categorias.find(c => c.id === cat)
    const label = (obj?.label ?? cat).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    return label.includes('biblio')
  }

  // Categorías que muestran el campo "Descripción" en el formulario
  const tieneDescripcion = (cat) => {
    if (!cat) return false
    if (esComp(cat) || esTecno(cat)) return false
    const obj = categorias.find(c => c.id === cat)
    const label = (obj?.label ?? cat).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    return (
      label.includes('mueble') ||
      label.includes('libreria') ||
      label.includes('libro') ||
      label.includes('otro') ||
      label.includes('deport') ||
      label.includes('musical')
    )
  }
  // ── Valores únicos de la BD para autocomplete de formularios ──────────────
  const opsBD = useMemo(() => {
    const uniq = (field) => [...new Set(bienes.map(b => b[field]).filter(Boolean))].sort()
    const uniqTecno = (field) => [...new Set(bienes.filter(b => esTecno(b.categoria)).map(b => b[field]).filter(Boolean))].sort()
    const TIPOS_FIJOS = ['Impresora','Escáner','Multifuncional','Fotocopiadora','Impresora/Escáner','Proyector','Tablet','Smart TV','Cámara','Equipo de Audio','Router','Switch','Dron']
    const TECNO_FIJOS = ['Inyección','Láser','Inkjet','LED','Matricial','Térmica','Láser Color']
    return {
      tipo:        [...new Set([...TIPOS_FIJOS, ...uniqTecno('tipo')])],
      tecnologia:  [...new Set([...TECNO_FIJOS, ...uniqTecno('tecnologia')])],
      marca:       uniqTecno('marca'),
      consumible:  uniqTecno('consumible'),
      area:        uniq('area'),
      ubicacion:   uniq('ubicacion'),
      responsable: uniq('responsable'),
      proveedor:   uniq('proveedor'),
      fondo:       uniq('fondo'),
      numero_orden: uniq('numero_orden'),
    }
  }, [bienes, categorias])

  const seleccionarCat = (id) => { setCatActual(id); localStorage.setItem('inv_catActual', id); cancelarForm(); setVerDetalle(null); setBusqueda(''); setFiltroEstado(''); setSeleccion(new Set()); setFiltros({}); setPaginaInv(1) }

  const pedirConfirmacion = (mensaje, onOk) => setConfirmar({ mensaje, onOk })


  // ── Abrir categoría desde Auditoría ─────────────────────────────────────
  useEffect(() => {
    if (!abrirCatId) return
    seleccionarCat(abrirCatId)
    onAbrirCatDone?.()
  }, [abrirCatId])

  // ── Abrir bien desde Auditoría ───────────────────────────────────────────
  useEffect(() => {
    if (!abrirBienId) return
    supabase.from('bienes').select('*').eq('id', abrirBienId).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setCatActual(data.categoria || 'todos')
          setVerDetalle(data)
        } else {
          setAviso({ mensaje: '⚠️ Este bien ya no existe en el inventario.' })
        }
        onAbrirBienDone?.()
      })
  }, [abrirBienId])


  // ── Cargar IDs de bienes con préstamo activo (para badge en tabla) ────────
  const cargarBienesConPrestamo = async () => {
    const { data } = await supabase.from('prestamos').select('bien_id, fecha_devolucion_esperada').is('fecha_devolucion_real', null)
    setBienesConPrestamo(new Map((data ?? []).map(p => [p.bien_id, p.fecha_devolucion_esperada])))
  }
  useEffect(() => { cargarBienesConPrestamo() }, [])

  // ── Cargar préstamo activo cuando se abre el modal de préstamo ───────────
  useEffect(() => {
    if (!modalPrestamo?.id) { setPrestamoBien(null); return }
    setCargandoPrestamo(true)
    supabase.from('prestamos').select('*')
      .eq('bien_id', modalPrestamo.id).is('fecha_devolucion_real', null)
      .maybeSingle()
      .then(({ data }) => { setPrestamoBien(data ?? null); setCargandoPrestamo(false) })
  }, [modalPrestamo?.id])

  // ── Datos y columnas para exportar ───────────────────────────────────────
  const getDatosExportar = () => catActual === 'todos' ? bienes : bienes.filter(b => b.categoria === catActual)
  const COLUMNAS_EXPORT = [
    'nombre','categoria','codigo','cantidad','estado','ubicacion','responsable','obs',
    'isbn','autor','descripcion',
    'tipo','marca','modelo','numero_serie','pantalla','cpu','ram','ram_tipo','ram_slots',
    'memoria','tipo_almacenamiento','sistema_operativo',
    'licencia_windows','win_version','win_proveedor','win_factura','win_fecha_factura','win_orden',
    'licencia_office','off_version','off_proveedor','off_factura','off_fecha_factura','off_orden',
    'fecha_adquisicion','proveedor','numero_factura','numero_orden','fondo','garantia',
  ]
  const getCatLabel2 = () => catActual === 'todos' ? 'todos' : (categorias.find(c => c.id === catActual)?.label ?? catActual)
  const nombreArchivo = (ext) => `inventario_${getCatLabel2().replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.${ext}`

  const exportarCSV = () => {
    const datos = getDatosExportar()
    if (!datos.length) { setAviso('No hay bienes para exportar.'); return }
    const escapar = (v) => { if (v === null || v === undefined) return ''; const s = String(v); return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s }
    const filas = [COLUMNAS_EXPORT.join(','), ...datos.map(b => COLUMNAS_EXPORT.map(c => escapar(b[c])).join(','))]
    const blob = new Blob([filas.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = nombreArchivo('csv'); a.click(); URL.revokeObjectURL(url)
    setMenuExportar(false)
  }

  const exportarExcel = () => {
    const datos = getDatosExportar()
    if (!datos.length) { setAviso('No hay bienes para exportar.'); return }
    const cargarYExportar = () => {
      const wb = window.XLSX.utils.book_new()
      const filas = [COLUMNAS_EXPORT, ...datos.map(b => COLUMNAS_EXPORT.map(c => b[c] ?? ''))]
      const ws = window.XLSX.utils.aoa_to_sheet(filas)
      // Estilo encabezado (ancho de columnas)
      ws['!cols'] = COLUMNAS_EXPORT.map(() => ({ wch: 18 }))
      window.XLSX.utils.book_append_sheet(wb, ws, 'Inventario')
      window.XLSX.writeFile(wb, nombreArchivo('xlsx'))
      setMenuExportar(false)
    }
    if (window.XLSX) { cargarYExportar(); return }
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
    script.onload = cargarYExportar
    script.onerror = () => setAviso('No se pudo cargar la librería de Excel.')
    document.head.appendChild(script)
  }

  const exportarPDF = () => {
    const datos = getDatosExportar()
    if (!datos.length) { setAviso('No hay bienes para exportar.'); return }
    const catLabel = getCatLabel2()
    const fecha = new Date().toLocaleDateString('es-CL')
    const cols = ['codigo','nombre','estado','ubicacion','responsable','marca','modelo','cpu','ram','sistema_operativo']
    const headers = ['Código','Nombre','Estado','Ubicación','Responsable','Marca','Modelo','CPU','RAM','S.O.']

    const filaColor = (estado) => {
      if (estado === 'Bueno')   return '#dcfce7'
      if (estado === 'Regular') return '#fef9c3'
      if (estado === 'Malo')    return '#fee2e2'
      if (estado === 'Baja')    return '#f3f4f6'
      return '#ffffff'
    }

    const htmlContent = `
      <html><head><meta charset="utf-8"><style>
        body { font-family: Arial, sans-serif; font-size: 11px; color: #111; margin: 0; padding: 20px; }
        h1 { font-size: 16px; margin: 0 0 4px 0; color: #1e3a8a; }
        .sub { font-size: 11px; color: #6b7280; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #1e3a8a; color: white; padding: 6px 8px; text-align: left; font-size: 10px; }
        td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; font-size: 10px; }
        tr:nth-child(even) td { background: #f9fafb; }
        .badge { display:inline-block; padding: 2px 7px; border-radius: 20px; font-size: 9px; font-weight: 700; }
      </style></head><body>
        <h1>📦 Inventario de Bienes — ${catLabel}</h1>
        <p class="sub">Generado el ${fecha} · ${datos.length} registro${datos.length !== 1 ? 's' : ''}</p>
        <table>
          <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
          <tbody>
            ${datos.map(b => `<tr>${cols.map((c,i) => {
              const val = b[c] ?? '—'
              if (c === 'estado') return `<td><span class="badge" style="background:${filaColor(val)};color:#374151">${val}</span></td>`
              return `<td>${val}</td>`
            }).join('')}</tr>`).join('')}
          </tbody>
        </table>
      </body></html>`

    const cargarYExportar = () => {
      const opt = {
        margin: [10,8,10,8],
        filename: nombreArchivo('pdf'),
        image: { type: 'jpeg', quality: 0.97 },
        html2canvas: { scale: 2, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
      }
      const el = document.createElement('div')
      el.innerHTML = htmlContent
      document.body.appendChild(el)
      window.html2pdf().set(opt).from(el).save().then(() => { document.body.removeChild(el) })
      setMenuExportar(false)
    }
    if (window.html2pdf) { cargarYExportar(); return }
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
    script.onload = cargarYExportar
    script.onerror = () => setAviso('No se pudo cargar la librería de PDF.')
    document.head.appendChild(script)
  }

  const exportarWord = () => {
    const datos = getDatosExportar()
    if (!datos.length) { setAviso('No hay bienes para exportar.'); return }
    const catLabel = getCatLabel2()
    const fecha = new Date().toLocaleDateString('es-CL')
    const cols = ['codigo','nombre','estado','ubicacion','responsable','marca','modelo','cpu','ram','sistema_operativo']
    const headers = ['Código','Nombre','Estado','Ubicación','Responsable','Marca','Modelo','CPU','RAM','S.O.']
    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
      <head><meta charset="utf-8"><style>
        body { font-family: Calibri, sans-serif; font-size: 10pt; }
        h1 { font-size: 14pt; color: #1e3a8a; }
        table { border-collapse: collapse; width: 100%; }
        th { background: #1e3a8a; color: white; padding: 5px 8px; font-size: 9pt; border: 1px solid #ccc; }
        td { padding: 4px 8px; font-size: 9pt; border: 1px solid #ddd; }
        tr:nth-child(even) td { background: #f0f4ff; }
      </style></head><body>
        <h1>Inventario de Bienes — ${catLabel}</h1>
        <p style="color:#6b7280;font-size:9pt">Generado el ${fecha} · ${datos.length} registros</p>
        <table>
          <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
          <tbody>${datos.map(b => `<tr>${cols.map(c => `<td>${b[c] ?? '—'}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </body></html>`
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = nombreArchivo('doc'); a.click(); URL.revokeObjectURL(url)
    setMenuExportar(false)
  }

  const exportarImagen = () => {
    const datos = getDatosExportar()
    if (!datos.length) { setAviso('No hay bienes para exportar.'); return }
    const catLabel = getCatLabel2()
    const fecha = new Date().toLocaleDateString('es-CL')
    const cols = ['codigo','nombre','estado','ubicacion','marca','modelo','cpu','ram']
    const headers = ['Código','Nombre','Estado','Ubicación','Marca','Modelo','CPU','RAM']
    const FILA_H = 32, HEAD_H = 80, PAD = 24
    const colW = [90,160,70,120,90,110,130,70]
    const totalW = colW.reduce((a,b)=>a+b,0) + PAD*2
    const totalH = HEAD_H + 36 + FILA_H * datos.length + PAD*2

    const canvas = document.createElement('canvas')
    canvas.width = totalW; canvas.height = totalH
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = '#f8fafc'; ctx.fillRect(0,0,totalW,totalH)
    ctx.fillStyle = '#1e3a8a'; ctx.fillRect(0,0,totalW,60)
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 18px Arial'
    ctx.fillText(`Inventario — ${catLabel}`, PAD, 36)
    ctx.font = '12px Arial'; ctx.fillStyle = '#bfdbfe'
    ctx.fillText(`${fecha}  ·  ${datos.length} registros`, PAD, 52)

    let x = PAD, y = HEAD_H
    ctx.fillStyle = '#1e40af'
    ctx.fillRect(0, y, totalW, 36)
    headers.forEach((h, i) => {
      ctx.fillStyle = '#e0e7ff'; ctx.font = 'bold 11px Arial'
      ctx.fillText(h, x+6, y+22); x += colW[i]
    })

    datos.forEach((b, ri) => {
      y = HEAD_H + 36 + ri * FILA_H
      ctx.fillStyle = ri % 2 === 0 ? '#ffffff' : '#f0f4ff'
      ctx.fillRect(0, y, totalW, FILA_H)
      x = PAD
      const vals = cols.map(c => String(b[c] ?? '—').slice(0,18))
      vals.forEach((v, i) => {
        ctx.fillStyle = '#111827'; ctx.font = '10px Arial'
        ctx.fillText(v, x+6, y+19); x += colW[i]
      })
      ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 0.5
      ctx.beginPath(); ctx.moveTo(0, y+FILA_H); ctx.lineTo(totalW, y+FILA_H); ctx.stroke()
    })

    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = nombreArchivo('png'); a.click(); URL.revokeObjectURL(url)
    })
    setMenuExportar(false)
  }

  const exportarExcelPorCategorias = () => {
    if (!bienes.length) { setAviso('No hay bienes para exportar.'); return }
    const fecha = new Date().toISOString().slice(0, 10)
    const cargarYExportar = () => {
      const XLSX = window.XLSX
      const wb = XLSX.utils.book_new()

      // Hoja resumen
      const resumenRows = [['Categoría', 'Ícono', 'Total bienes']]
      const grupos = {}
      bienes.forEach(b => {
        if (b._pendiente) return
        const cat = categorias.find(c => c.id === b.categoria)
        const key = b.categoria || 'sin_categoria'
        const label = cat?.label ?? b.categoria ?? 'Sin categoría'
        const icon = cat?.icon ?? '📦'
        if (!grupos[key]) grupos[key] = { label, icon, items: [] }
        grupos[key].items.push(b)
      })
      Object.values(grupos).forEach(g => resumenRows.push([g.label, g.icon, g.items.length]))
      resumenRows.push(['', '', ''])
      resumenRows.push(['TOTAL', '', bienes.filter(b => !b._pendiente).length])
      const wsResumen = XLSX.utils.aoa_to_sheet(resumenRows)
      wsResumen['!cols'] = [{ wch: 28 }, { wch: 8 }, { wch: 14 }]
      XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')

      // Una hoja por categoría
      Object.values(grupos).forEach(({ label, items }) => {
        if (!items.length) return
        // Columnas relevantes para esta categoría (omitir columnas completamente vacías)
        const cols = COLUMNAS_EXPORT.filter(col => items.some(b => b[col] != null && b[col] !== ''))
        const rows = [cols, ...items.map(b => cols.map(c => b[c] ?? ''))]
        const ws = XLSX.utils.aoa_to_sheet(rows)
        ws['!cols'] = cols.map(h => ({ wch: Math.max(h.length + 4, 14) }))
        ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: cols.length - 1 } }) }
        ws['!tables'] = [{
          name: label.replace(/\s+/g, '_').replace(/[^A-Za-z0-9_]/g, '').slice(0, 255) || 'Tabla',
          ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: cols.length - 1 } }),
          headerRow: true, totalsRow: false,
          style: { theme: 'TableStyleMedium2', showRowStripes: true },
          columns: cols.map(h => ({ name: h })),
        }]
        XLSX.utils.book_append_sheet(wb, ws, label.slice(0, 31))
      })

      XLSX.writeFile(wb, `backup_inventario_${fecha}.xlsx`)
      setMenuExportar(false)
    }
    if (window.XLSX) { cargarYExportar(); return }
    const script = document.getElementById('sheetjs-script') || document.createElement('script')
    script.id = 'sheetjs-script'
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
    script.onload = cargarYExportar
    script.onerror = () => setAviso('No se pudo cargar la librería de Excel.')
    document.head.appendChild(script)
  }

  const exportarJSON = () => {
    if (!bienes.length) { setAviso('No hay bienes para exportar.'); return }
    const fecha = new Date().toISOString()
    const datos = bienes
      .filter(b => !b._pendiente)
      .map(({ _pendiente, ...b }) => b)
    const backup = {
      version: 1,
      fecha_exportacion: fecha,
      total: datos.length,
      categorias: categorias.map(c => ({ id: c.id, label: c.label, icon: c.icon })),
      bienes: datos,
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `backup_inventario_${fecha.slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setMenuExportar(false)
  }

  // ── Categorías ────────────────────────────────────────
  const abrirModalCat = () => { setNuevaCat({ label: '', icon: '📦' }); setErrorCat(false); setModalCat(true) }

  const guardarCategoria = async () => {
    const label = nuevaCat.label.trim()
    if (!label) { setErrorCat(true); return }
    const id = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') + '_' + Date.now()
    const { error } = await supabase.from('categorias').insert({ id, label, icon: nuevaCat.icon, fija: false })
    if (error) { setAviso('Error al crear categoría: ' + error.message); return }
    setCategorias(prev => [...prev, { id, label, icon: nuevaCat.icon, fija: false }])
    setCatOrder(prev => [...prev, id])
    setModalCat(false)
    setCatActual(id); localStorage.setItem('inv_catActual', id)
  }

  const eliminarCategoria = async (id) => {
    if (bienes.some(b => b.categoria === id)) {
      setAviso('No puedes eliminar una categoría que tiene bienes asignados.')
      return
    }
    const cat = categorias.find(c => c.id === id)
    pedirConfirmacion(
      `¿Eliminar la categoría "${cat?.label}"?`,
      async () => {
        const { error } = await supabase.from('categorias').delete().eq('id', id)
        if (error) { setAviso('Error al eliminar: ' + error.message); return }
        setCategorias(prev => prev.filter(c => c.id !== id))
        if (catActual === id) { setCatActual('todos'); localStorage.setItem('inv_catActual', 'todos') }
      }
    )
  }

  const abrirEditCat = (cat, e) => {
    e.stopPropagation()
    setEditCat({ id: cat.id, label: cat.label, icon: cat.icon })
    setErrorEditCat(false)
  }

  const guardarEditCat = async () => {
    const label = editCat.label.trim()
    if (!label) { setErrorEditCat(true); return }
    const { error } = await supabase.from('categorias').update({ label, icon: editCat.icon }).eq('id', editCat.id)
    if (error) { setAviso('Error al editar: ' + error.message); return }
    setCategorias(prev => prev.map(c => c.id === editCat.id ? { ...c, label, icon: editCat.icon } : c))
    setEditCat(null)
  }

  // ── Formulario bien ───────────────────────────────────
  const abrirFormNuevo = () => {
    setEditandoId(null)
    const cat = catActual !== 'todos' ? catActual : (categorias[0]?.id ?? 'otros')
    const base = esComp(cat) ? { ...formVacioComp } : esTecno(cat) ? { ...formVacioTecno } : { ...formVacio }
    base.categoria = cat
    // Generar código único que no exista en bienes
    const codigos = new Set(bienes.map(b => b.codigo))
    let num = bienes.length + 1
    let codigo = `INV-${String(num).padStart(4, '0')}`
    while (codigos.has(codigo)) { num++; codigo = `INV-${String(num).padStart(4, '0')}` }
    base.codigo = codigo
    setForm(base)
    setCamposExtra({})
    setErrores({})
    setMostrarForm(true)
  }

  const abrirFormEditar = (bien) => {
    setEditandoId(bien.id)
    const base = esComp(bien.categoria) ? { ...formVacioComp, ...bien } : esTecno(bien.categoria) ? { ...formVacioTecno, ...bien } : { ...formVacio, ...bien }
    // Normalizar nulos a string vacío
    Object.keys(base).forEach(k => { if (base[k] === null) base[k] = '' })
    if (!base.win_tipo_licencia) base.win_tipo_licencia = 'key'
    if (!base.off_tipo_licencia) base.off_tipo_licencia = 'key'
    // Descomponer cpu en sub-campos si existe
    if (esComp(bien.categoria) && bien.cpu) {
      const partes = bien.cpu.split(' ')
      const marcasCpu = ['Intel', 'AMD', 'Apple', 'Qualcomm', 'ARM']
      if (marcasCpu.includes(partes[0])) {
        base.cpu_marca = partes[0]
        base.cpu_modelo = partes.slice(1, -1).join(' ')
        base.cpu_generacion = partes[partes.length - 1] !== partes[0] ? partes[partes.length - 1] : ''
      } else {
        base.cpu_marca = ''
        base.cpu_modelo = bien.cpu
        base.cpu_generacion = ''
      }
    }
    setForm(base)
    setCamposExtra(bien.campos_extra || {})
    setErrores({})
    setMostrarForm(true)
    setModalEditar(true)
    setVerDetalle(null)
  }

  const cancelarForm = () => { setMostrarForm(false); setEditandoId(null); setErrores({}); setModalEditar(false); setCamposExtra({}) }

  const handleChange = (e) => {
    const { name, value } = e.target
    if (name === 'categoria') {
      const cambiaAComp  = esComp(value)
      const cambiaDeComp = esComp(form.categoria)
      const cambiaATecno = esTecno(value)
      const camiaDeTecno = esTecno(form.categoria)
      const comun = { nombre: form.nombre, codigo: form.codigo, cantidad: form.cantidad, estado: form.estado, ubicacion: form.ubicacion, area: form.area, responsable: form.responsable, obs: form.obs, categoria: value }
      if (cambiaAComp && !cambiaDeComp)                                         setForm({ ...formVacioComp, ...comun })
      else if (cambiaATecno && !camiaDeTecno)                                   setForm({ ...formVacioTecno, ...comun })
      else if (!cambiaAComp && !cambiaATecno && (cambiaDeComp || camiaDeTecno)) setForm({ ...formVacio, ...comun })
      else                                                                       setForm(prev => ({ ...prev, categoria: value }))
      setCamposExtra({})
    } else {
      setForm(prev => {
        const updated = { ...prev, [name]: value }
        if (name === 'cpu_marca' || name === 'cpu_modelo' || name === 'cpu_generacion') {
          const marca = name === 'cpu_marca' ? value : (prev.cpu_marca ?? '')
          const modelo = name === 'cpu_modelo' ? value : (prev.cpu_modelo ?? '')
          const gen = name === 'cpu_generacion' ? value : (prev.cpu_generacion ?? '')
          updated.cpu = [marca, modelo, gen].filter(Boolean).join(' ') || ''
        }
        if (name === 'win_tipo_licencia') {
          if (value === 'fabricante') {
            updated.win_proveedor = 'N/A'
            updated.win_factura = 'N/A'
            updated.win_fecha_factura = ''
            updated.win_orden = 'N/A'
          } else {
            if (prev.win_proveedor === 'N/A') updated.win_proveedor = ''
            if (prev.win_factura === 'N/A') updated.win_factura = ''
            if (prev.win_orden === 'N/A') updated.win_orden = ''
          }
        }
        if (name === 'off_tipo_licencia') {
          if (value === 'alternativa') {
            updated.off_proveedor = 'N/A'
            updated.off_factura = 'N/A'
            updated.off_fecha_factura = ''
            updated.off_orden = 'N/A'
          } else {
            if (prev.off_proveedor === 'N/A') updated.off_proveedor = ''
            if (prev.off_factura === 'N/A') updated.off_factura = ''
            if (prev.off_orden === 'N/A') updated.off_orden = ''
          }
        }
        return updated
      })
    }
    if (errores[name]) setErrores(prev => ({ ...prev, [name]: false }))
  }

  

  const guardarBien = async () => {
    const errs = {}
    if (!esComp(form.categoria) && !esTecno(form.categoria) && !form.nombre?.trim()) errs.nombre = true
    if (!form.codigo.trim()) errs.codigo = true
    const camposCatVal = categorias.find(c => c.id === form.categoria)?.campos_personalizados ?? []
    camposCatVal.filter(c => c.requerido).forEach(c => { if (!camposExtra[c.id]) errs[`extra_${c.id}`] = true })
    if (Object.keys(errs).length) { setErrores(errs); return }

    setGuardando(true)
    // Para computadores, el nombre se genera automáticamente desde marca + modelo
    const nombreFinal = (esComp(form.categoria)
      ? ([form.marca, form.modelo].filter(Boolean).join(' ') || 'Computador')
      : esTecno(form.categoria)
        ? ([form.tipo, form.marca, form.modelo].filter(Boolean).join(' ') || 'Artículo tecnológico')
        : (form.nombre?.trim() || '')) || 'Sin nombre'
    const payload = { ...form, nombre: nombreFinal, cantidad: parseInt(form.cantidad) || 1, campos_extra: camposExtra }
    if (!payload.fecha_adquisicion) payload.fecha_adquisicion = null
    if (!payload.win_fecha_factura) payload.win_fecha_factura = null
    if (!payload.off_fecha_factura) payload.off_fecha_factura = null

    // Quitar campos que no existen en la tabla
    delete payload.id
    delete payload.creado_en
    delete payload.actualizado_en
    delete payload.cpu_marca
    delete payload.cpu_modelo
    delete payload.cpu_generacion


    // Helper: detectar error de red (sin conexión real aunque navigator.onLine diga true)
    const esErrorRed = (e) => e instanceof TypeError && e.message.toLowerCase().includes('fetch')

    if (editandoId !== null) {
      if (!online) {
        setAviso('Sin conexión — no se pueden editar bienes existentes offline.')
        setGuardando(false)
        return
      }
      try {
        const { error } = await supabase.from('bienes').update(payload).eq('id', editandoId)
        if (error) { setAviso('Error al guardar: ' + error.message); setGuardando(false); return }
        supabase.rpc('set_audit_dispositivo', { p_bien_id: editandoId, p_dispositivo: navigator.userAgent.slice(0, 300) }).then().catch(() => {})
      } catch (e) {
        setAviso(esErrorRed(e) ? 'Sin conexión — no se pueden editar bienes sin internet.' : 'Error al guardar: ' + e.message)
        if (esErrorRed(e)) setOnline(false)
        setGuardando(false)
        return
      }
      setBienes(prev => prev.map(b => b.id === editandoId ? { ...b, ...payload } : b))
      logActividad(usuario, payload.estado === 'Baja' ? 'baja' : 'actualizar', nombreFinal, editandoId)
    } else {
      // Sin internet: guardar en cola local
      const guardarOffline = () => {
        const id = agregarPendiente({ ...payload, nombre: nombreFinal })
        setBienes(prev => [{ ...payload, id, nombre: nombreFinal, _pendiente: true, creado_en: new Date().toISOString() }, ...prev])
        setCatActual(payload.categoria)
        setOnline(false)
        setGuardando(false)
        cancelarForm()
      }
      if (!online || !navigator.onLine) { guardarOffline(); return }
      try {
        const { data, error } = await supabase.from('bienes').insert(payload).select().single()
        if (error) { setAviso('Error al guardar: ' + error.message); setGuardando(false); return }
        supabase.rpc('set_audit_dispositivo', { p_bien_id: data.id, p_dispositivo: navigator.userAgent.slice(0, 300) }).then().catch(() => {})
        setBienes(prev => [data, ...prev])
        setCatActual(payload.categoria)
        logActividad(usuario, 'crear', nombreFinal, data.id)
      } catch (e) {
        if (esErrorRed(e)) { guardarOffline(); return }
        setAviso('Error al guardar: ' + e.message)
        setGuardando(false)
        return
      }
    }
    setGuardando(false)
    cancelarForm()
  }

  const eliminarBien = (id) => {
    const bien = bienes.find(b => b.id === id)
    const nombreMostrar = esComp(bien?.categoria)
      ? [bien?.marca, bien?.modelo].filter(Boolean).join(' ') || 'Computador'
      : esTecno(bien?.categoria)
        ? [bien?.tipo, bien?.marca, bien?.modelo].filter(Boolean).join(' ') || 'Artículo tecnológico'
        : bien?.nombre
    pedirConfirmacion(
      `¿Eliminar "${nombreMostrar}" del inventario?`,
      async () => {
        const { error } = await supabase.from('bienes').delete().eq('id', id)
        if (error) { setAviso('Error al eliminar: ' + error.message); return }
        setBienes(prev => prev.filter(b => b.id !== id))
        if (verDetalle?.id === id) setVerDetalle(null)
        logActividad(usuario, 'eliminar', nombreMostrar, id)
      }
    )
  }

  const toggleSeleccion = (id) => setSeleccion(prev => {
    const s = new Set(prev)
    s.has(id) ? s.delete(id) : s.add(id)
    return s
  })

  const toggleTodos = () => {
    if (seleccion.size === filtrados.length && filtrados.length > 0) {
      setSeleccion(new Set())
    } else {
      setSeleccion(new Set(filtrados.map(b => b.id)))
    }
  }

  const eliminarSeleccionados = () => {
    if (seleccion.size === 0) return
    pedirConfirmacion(
      `¿Eliminar ${seleccion.size} bien${seleccion.size !== 1 ? 'es' : ''} seleccionado${seleccion.size !== 1 ? 's' : ''}?`,
      async () => {
        const ids = [...seleccion]
        const n = ids.length
        const fallidos = []
        for (const id of ids) {
          const { error } = await supabase.from('bienes').delete().eq('id', id)
          if (error) fallidos.push(id)
        }
        const eliminados = ids.filter(id => !fallidos.includes(id))
        if (eliminados.length > 0) {
          setBienes(prev => prev.filter(b => !eliminados.includes(b.id)))
          setSeleccion(new Set(fallidos))
          logActividad(usuario, 'eliminar', `${eliminados.length} bien${eliminados.length !== 1 ? 'es' : ''} (lote)`, null)
        }
        if (fallidos.length > 0) {
          setAviso(`No se pudieron eliminar ${fallidos.length} bien${fallidos.length !== 1 ? 'es' : ''}. Intenta de nuevo.`)
        }
      }
    )
  }

  const abrirQR = (bien) => {
    const url     = `${window.location.origin}/?bien=${bien.id}`
    const qrSize  = Math.min(300, Math.round(window.screen.width * 0.82))
    const qr      = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=${encodeURIComponent(url)}`
    const cat     = categorias.find(c => c.id === bien.categoria)
    const win     = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html lang="es"><head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>QR — ${bien.nombre}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', system-ui, sans-serif; background: #f3f4f6; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 16px; }
        .card { border: 2px solid #1a237e; border-radius: 16px; padding: 28px 20px; width: 100%; max-width: 420px; text-align: center; background: #fff; }
        .logo-row { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 18px; }
        .logo-row span { font-size: 13px; font-weight: 700; color: #1a237e; text-transform: uppercase; letter-spacing: 0.05em; }
        img.qr { width: ${qrSize}px; height: ${qrSize}px; border: 1px solid #e5e7eb; border-radius: 8px; }
        .nombre { font-size: 18px; font-weight: 700; color: #111827; margin: 16px 0 4px; }
        .codigo { font-size: 13px; color: #6b7280; margin-bottom: 4px; }
        .cat    { font-size: 12px; color: #9ca3af; margin-bottom: 20px; }
        .hint   { font-size: 11px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 14px; }
        @media print { body { margin: 0; } .no-print { display: none; } }
        .btn { margin-top: 20px; padding: 10px 24px; background: #1a237e; color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
      </style>
    </head><body>
      <div class="card">
        <div class="logo-row">
          <span>Liceo Polivalente de Excelencia Juvenal Hernández Jaque — Inventario</span>
        </div>
        <img class="qr" src="${qr}" alt="QR" />
        <p class="nombre">${bien.nombre}</p>
        <p class="codigo">Código: ${bien.codigo || 'S/C'}</p>
        <p class="cat">${cat ? cat.icon + ' ' + cat.label : bien.categoria || ''}</p>
        <p class="hint">Escanea para ver el detalle en el sistema</p>
        <button class="btn no-print" onclick="window.print()">🖨 Imprimir</button>
      </div>
    </body></html>`)
    win.document.close()
  }

  const toggleQRItem = (id) => setSeleccionQR(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const abrirQRMultiple = (bienesSel) => {
    const origin = window.location.origin
    const cards = bienesSel.map(b => {
      const url = `${origin}/?bien=${b.id}`
      const qr  = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&margin=6&data=${encodeURIComponent(url)}`
      const cat = categorias.find(c => c.id === b.categoria)
      return `
        <div class="card">
          <img class="qr" src="${qr}" alt="QR" />
          <p class="nombre">${b.nombre}</p>
          <p class="codigo">${b.codigo || 'S/C'}</p>
          <p class="cat">${cat ? cat.icon + ' ' + cat.label : b.categoria || ''}</p>
        </div>`
    }).join('')

    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html lang="es"><head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>QR — ${bienesSel.length} bienes</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', system-ui, sans-serif; background: #f3f4f6; padding: 12px; }
        .header { text-align: center; margin-bottom: 16px; }
        .header h1 { font-size: 15px; color: #1a237e; font-weight: 700; }
        .header p  { font-size: 11px; color: #6b7280; margin-top: 3px; }
        .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
        .card { background: #fff; border: 1px solid #1a237e; border-radius: 8px; padding: 10px 8px; text-align: center; break-inside: avoid; }
        .qr  { width: 110px; height: 110px; border: 1px solid #e5e7eb; border-radius: 4px; }
        .nombre { font-size: 10px; font-weight: 700; color: #111827; margin: 6px 0 2px; line-height: 1.3; }
        .codigo { font-size: 9px; color: #6b7280; margin-bottom: 1px; }
        .cat    { font-size: 9px; color: #9ca3af; }
        .no-print { text-align: center; margin-bottom: 16px; }
        .btn { padding: 9px 26px; background: #1a237e; color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
        @media print {
          body { background: #fff; padding: 6mm; }
          .no-print { display: none; }
          .grid { grid-template-columns: repeat(4, 1fr); gap: 6px; }
          .card { border-color: #888; page-break-inside: avoid; }
        }
        @media (max-width: 600px) {
          .grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
          .qr { width: 100px; height: 100px; }
        }
      </style>
    </head><body>
      <div class="no-print">
        <div class="header">
          <h1>Liceo Polivalente de Excelencia Juvenal Hernández Jaque — Inventario</h1>
          <p>${bienesSel.length} código${bienesSel.length !== 1 ? 's' : ''} QR</p>
        </div>
        <button class="btn" onclick="window.print()">🖨 Imprimir todos</button>
      </div>
      <div class="grid">${cards}</div>
    </body></html>`)
    win.document.close()
  }

  const cerrarModalPrestamo = () => {
    setModalPrestamo(null)
    setFormPrestamo({ prestado_a: '', cargo: '', fecha_devolucion_esperada: '', notas: '' })
  }

  const registrarPrestamo = async () => {
    if (!formPrestamo.prestado_a.trim() || !formPrestamo.fecha_devolucion_esperada) return
    setGuardandoPrestamo(true)
    const bien = modalPrestamo
    const { data, error } = await supabase.from('prestamos').insert({
      bien_id: bien.id,
      prestado_a: formPrestamo.prestado_a.trim(),
      cargo: formPrestamo.cargo.trim() || null,
      fecha_devolucion_esperada: formPrestamo.fecha_devolucion_esperada,
      notas: formPrestamo.notas.trim() || null,
      registrado_por: usuario.id,
      registrado_por_nombre: usuario.nombre,
    }).select().single()
    if (!error && data) {
      setBienesConPrestamo(prev => new Map([...prev, [bien.id, formPrestamo.fecha_devolucion_esperada]]))
      if (verDetalle?.id === bien.id) setPrestamoBien(data)
      cerrarModalPrestamo()
    }
    setGuardandoPrestamo(false)
  }

  const marcarDevuelto = async () => {
    if (!prestamoBien) return
    const { error } = await supabase.rpc('devolver_prestamo', {
      p_prestamo_id: prestamoBien.id,
      p_devuelto_por: usuario.nombre,
    })
    if (!error) {
      setPrestamoBien(null)
      const bienId = modalPrestamo?.id ?? verDetalle?.id
      setBienesConPrestamo(prev => { const m = new Map(prev); m.delete(bienId); return m })
    }
  }

  const descargarPDF = () => {
    const el = document.getElementById('detalle-pdf-content')
    if (!el || !verDetalle) return
    // Ocultar botones y forzar layout de escritorio para captura correcta
    const btns = el.querySelectorAll('button')
    btns.forEach(b => { b.style.visibility = 'hidden' })
    const header = el.querySelector('.detalle-header-modal')
    const headerOrig = header ? header.style.cssText : ''
    if (header) {
      header.style.flexDirection = 'row'
      header.style.alignItems = 'center'
    }
    const titleDiv = header ? header.querySelector('div') : null
    const titleOrig = titleDiv ? titleDiv.style.cssText : ''
    if (titleDiv) titleDiv.style.width = 'auto'
    const opt = {
      margin:      [10, 10, 10, 10],
      filename:    `${verDetalle.codigo}_${verDetalle.nombre.replace(/\s+/g, '_')}.pdf`,
      image:       { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' },
    }
    window.html2pdf().set(opt).from(el).save().then(() => {
      btns.forEach(b => { b.style.visibility = '' })
      if (header) header.style.cssText = headerOrig
      if (titleDiv) titleDiv.style.cssText = titleOrig
    })
  }

  if (cargando) return (
    <div className="cargando">
      <div className="spinner"></div>
      <p>Cargando inventario...</p>
    </div>
  )

  return (
    <div className="inv">

      {/* Banner sin conexión */}
      {!online && (
        <div style={{
          background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8,
          padding: '10px 16px', marginBottom: 12,
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 18 }}>📡</span>
          <span style={{ fontSize: 13, color: '#92400e', fontWeight: 500 }}>
            Sin conexión — los bienes nuevos se guardarán localmente y se sincronizarán al volver a conectarse.
          </span>
          {obtenerPendientes().length > 0 && (
            <span style={{
              marginLeft: 'auto', fontSize: 12, fontWeight: 700,
              background: '#f59e0b', color: '#fff', borderRadius: 20, padding: '2px 10px',
            }}>
              {obtenerPendientes().length} pendiente{obtenerPendientes().length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* Banner sincronizando */}
      {sincronizando && (
        <div style={{
          background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8,
          padding: '10px 16px', marginBottom: 12,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ display: 'inline-block', animation: 'spin 0.7s linear infinite', fontSize: 16 }}>⟳</span>
          <span style={{ fontSize: 13, color: '#1d4ed8', fontWeight: 500 }}>Sincronizando bienes pendientes…</span>
        </div>
      )}

      {/* Grilla categorías con toggle */}
      <div className="cats-section">
        <button className="cats-toggle" onClick={() => setCatsVisible(v => !v)}>
          <span className="cats-toggle-label">
            {catInfo ? `${catInfo.icon} ${catInfo.label}` : '◉ Todos'}
            <span className="cats-toggle-count">({filtrados.length})</span>
          </span>
          <span className="cats-toggle-arrow">{catsVisible ? '▲' : '▼'} Categorías</span>
        </button>

        {catsVisible && (
        <div className="cats-grid">
          {/* Tarjeta "Todos" — fija siempre al inicio */}
          <div
            className={`cat-card ${catActual === 'todos' ? 'active' : ''} cat-pinned-fixed`}
            onClick={() => { seleccionarCat('todos'); if (window.innerWidth < 768) setCatsVisible(false) }}
          >
            <span className="cat-icon">◉</span>
            <span className="cat-name">Todos</span>
            <span className="cat-count">{bienesPermitidos.length} bien{bienesPermitidos.length !== 1 ? 'es' : ''}</span>
          </div>

          {categoriasOrdenadas().filter(cat => tieneAccesoCat(cat.id)).map(cat => {
            const isPinned   = pinnedCats.includes(cat.id)
            const isDragging = dragging === cat.id
            const isOver     = dragOver === cat.id
            return (
              <div
                key={cat.id}
                data-catid={cat.id}
                className={`cat-card ${catActual === cat.id ? 'active' : ''} ${isPinned ? 'cat-pinned' : ''} ${isDragging ? 'cat-dragging' : ''} ${isOver ? 'cat-dragover' : ''}`}
                draggable
                onDragStart={e => onDragStart(e, cat.id)}
                onDragOver={e => onDragOver(e, cat.id)}
                onDrop={e => onDrop(e, cat.id)}
                onDragEnd={onDragEnd}
                onClick={() => { if (!dragging) { seleccionarCat(cat.id); if (window.innerWidth < 768) setCatsVisible(false) } }}
              >
                <div className="cat-actions">
                  <button className="btn-pin-cat" title={isPinned ? 'Desfijar' : 'Fijar al inicio'} onClick={e => togglePin(cat.id, e)}>
                    {isPinned ? '📌' : '📍'}
                  </button>
                  {puedeGestionarCats && <button className="btn-edit-cat" title="Editar" onClick={e => abrirEditCat(cat, e)}>✏️</button>}
                  {puedeGestionarCats && <button className="btn-del-cat" title="Eliminar" onClick={e => { e.stopPropagation(); eliminarCategoria(cat.id) }}>✕</button>}
                </div>
                <span className="cat-drag-handle" title="Arrastrar para reordenar">⠿</span>
                <span className="cat-icon">{cat.icon}</span>
                <span className="cat-name">{cat.label}</span>
                <span className="cat-count">{bienCount(cat.id)} bien{bienCount(cat.id) !== 1 ? 'es' : ''}</span>
              </div>
            )
          })}

          {puedeGestionarCats && (
            <div className="cat-card cat-nueva" onClick={abrirModalCat}>
              <span className="cat-icon add-icon">＋</span>
              <span className="cat-name">Nueva categoría</span>
            </div>
          )}
        </div>
        )}
      </div>

      {/* Cabecera */}
      <div className="section-header">
        <span className="section-title section-title-desktop">
          {catInfo ? `${catInfo.icon} ${catInfo.label}` : 'Todos'} ({filtrados.length})
          {totalPagsInv > 1 && (
            <span style={{ fontSize: '0.72rem', fontWeight: 400, color: '#9ca3af', marginLeft: 8 }}>
              pág. {paginaInv}/{totalPagsInv}
            </span>
          )}
        </span>
        <div className="section-actions">

          {/* Botón exportar con dropdown */}
          {puedeExportar && <div style={{ position: 'relative' }}>
            <button className="btn-import" onClick={() => setMenuExportar(v => !v)}>
              📤 Exportar ▾
            </button>
            {menuExportar && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setMenuExportar(false)} />
                <div style={{
                  position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 100,
                  background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: '180px', maxWidth: 'calc(100vw - 16px)', overflow: 'hidden',
                }}>
                  <p style={{ margin: 0, padding: '8px 14px 6px', fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                    Exportar vista actual
                  </p>
                  {[
                    { icon: '📄', label: 'CSV',    desc: 'Texto separado por comas', fn: exportarCSV },
                    { icon: '📊', label: 'Excel',  desc: 'Hoja de cálculo .xlsx',    fn: exportarExcel },
                    { icon: '📕', label: 'PDF',    desc: 'Tabla en PDF A4',          fn: exportarPDF },
                    { icon: '📝', label: 'Word',   desc: 'Documento .doc',           fn: exportarWord },
                    { icon: '🖼️', label: 'Imagen', desc: 'Captura PNG',             fn: exportarImagen },
                  ].map(({ icon, label, desc, fn }) => (
                    <button key={label} onClick={fn} style={{
                      display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                      padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer',
                      textAlign: 'left', transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f0f4ff'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <span style={{ fontSize: '1.1rem' }}>{icon}</span>
                      <div>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem', color: '#111827' }}>{label}</p>
                        <p style={{ margin: 0, fontSize: '0.72rem', color: '#9ca3af' }}>{desc}</p>
                      </div>
                    </button>
                  ))}
                  <div style={{ height: 1, background: '#f3f4f6', margin: '4px 0' }} />
                  <p style={{ margin: 0, padding: '6px 14px 4px', fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                    Backup completo
                  </p>
                  {[
                    { icon: '🗂️', label: 'Excel por categorías', desc: 'Una hoja por categoría + resumen', fn: exportarExcelPorCategorias },
                    { icon: '💾', label: 'JSON',                  desc: 'Backup reimportable a BD',         fn: exportarJSON },
                  ].map(({ icon, label, desc, fn }) => (
                    <button key={label} onClick={fn} style={{
                      display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                      padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer',
                      textAlign: 'left', transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f0f4ff'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <span style={{ fontSize: '1.1rem' }}>{icon}</span>
                      <div>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem', color: '#111827' }}>{label}</p>
                        <p style={{ margin: 0, fontSize: '0.72rem', color: '#9ca3af' }}>{desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>}

          {puedeImportar && (
            <button className="btn-import" onClick={() => setModalImportar(true)}>
              <span className="btn-label-full">📥 Importar CSV</span>
              <span className="btn-label-short">📥</span>
            </button>
          )}
          <button
            className="btn-import"
            onClick={() => { setModoQR(v => !v); setSeleccionQR(new Set()) }}
            style={modoQR ? { background: '#1a237e', color: '#fff', borderColor: '#1a237e' } : {}}
            title="Seleccionar bienes para imprimir QR"
          >
            <span className="btn-label-full">▦ {modoQR ? 'Cancelar QR' : 'Generar QR'}</span>
            <span className="btn-label-short">▦</span>
          </button>
          {puedeAgregar && (
            <button className="btn-import btn-agregar" onClick={mostrarForm && !editandoId ? cancelarForm : abrirFormNuevo}>
              {mostrarForm && !editandoId ? '✕' : <><span className="btn-label-full">+ Agregar bien</span><span className="btn-label-short">＋</span></>}
            </button>
          )}
        </div>
      </div>

      {/* Barra de búsqueda y filtros */}
      {(() => {
        const camposComp   = [
          { campo: 'area', label: 'Área' }, { campo: 'marca', label: 'Marca' }, { campo: 'tipo', label: 'Tipo' },
          { campo: 'ram', label: 'RAM' }, { campo: 'sistema_operativo', label: 'S.O.' },
          { campo: 'ubicacion', label: 'Ubicación' },
        ]
        const camposTecno  = [{ campo: 'area', label: 'Área' }, { campo: 'tipo', label: 'Tipo' }, { campo: 'marca', label: 'Marca' }, { campo: 'ubicacion', label: 'Ubicación' }]
        const camposOtros  = [{ campo: 'ubicacion', label: 'Ubicación' }, { campo: 'responsable', label: 'Responsable' }]
        const camposTodos  = [{ campo: 'ubicacion', label: 'Ubicación' }, { campo: 'responsable', label: 'Responsable' }, { campo: 'marca', label: 'Marca' }]
        const campos = esComp(catActual) ? camposComp : esTecno(catActual) ? camposTecno : catActual === 'todos' ? camposTodos : camposOtros
        const filtrosActivos = Object.values(filtros).filter(Boolean).length + (filtroEstado ? 1 : 0) + (filtroPrestado ? 1 : 0)

        const selectStyle = (activo) => ({
          height: '34px', borderRadius: '8px',
          border: activo ? '1.5px solid #6366f1' : '1px solid #e5e7eb',
          fontSize: '0.82rem', padding: '0 8px',
          background: activo ? '#eef2ff' : 'white',
          color: activo ? '#4338ca' : '#6b7280',
          minWidth: '130px', flex: '1',
        })

        return (
          <div className="filtros-zona">
            {/* Fila buscador + botón filtros */}
            <div className="filtros-top">
              <div style={{ position: 'relative', flex: 1 }}>
                <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: '0.9rem' }}>🔍</span>
                <input
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre, código, marca, serie, ubicación..."
                  style={{ width: '100%', paddingLeft: '32px', paddingRight: busqueda ? '32px' : '10px', height: '36px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.88rem', boxSizing: 'border-box', outline: 'none', background: '#fff', color: '#111827' }}
                />
                {busqueda && (
                  <button onClick={() => setBusqueda('')} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '1rem' }}>✕</button>
                )}
              </div>

              {/* Botón filtros — siempre visible, en móvil abre panel */}
              <button
                className={`btn-filtros ${filtrosOpen ? 'active' : ''}`}
                onClick={() => setFiltrosOpen(v => !v)}
              >
                <span>⚙</span>
                <span className="btn-filtros-label">Filtros</span>
                {filtrosActivos > 0 && <span className="filtros-badge">{filtrosActivos}</span>}
                <span style={{ fontSize: '10px', marginLeft: '2px' }}>{filtrosOpen ? '▲' : '▼'}</span>
              </button>
            </div>

            {/* Panel de filtros: inline en desktop, dropdown en móvil */}
            {filtrosOpen && (
              <div className="filtros-panel">
                <div className="filtros-panel-grid">
                  <div className="filtros-field">
                    <label>Estado</label>
                    <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} style={selectStyle(!!filtroEstado)}>
                      <option value="">Todos</option>
                      <option value="Bueno">✅ Bueno</option>
                      <option value="Regular">⚠️ Regular</option>
                      <option value="Malo">❌ Malo</option>
                      <option value="Baja">🗑 Baja</option>
                    </select>
                  </div>
                  <div className="filtros-field">
                    <label>Préstamo</label>
                    <select value={filtroPrestado} onChange={e => setFiltroPrestado(e.target.value)} style={selectStyle(!!filtroPrestado)}>
                      <option value="">Todos</option>
                      <option value="prestado">📤 Prestado</option>
                      <option value="vencido">⚠️ Vencido</option>
                      <option value="disponible">✅ Disponible</option>
                    </select>
                  </div>
                  {campos.map(({ campo, label }) => {
                    const opciones = unicos(campo)
                    if (opciones.length < 2) return null
                    return (
                      <div key={campo} className="filtros-field">
                        <label>{label}</label>
                        <select value={filtros[campo] || ''} onChange={e => setFiltros(prev => ({ ...prev, [campo]: e.target.value }))} style={selectStyle(!!filtros[campo])}>
                          <option value="">Todos</option>
                          {opciones.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </div>
                    )
                  })}
                </div>
                {hayFiltrosActivos && (
                  <button onClick={() => { setBusqueda(''); setFiltroEstado(''); setFiltroPrestado(''); setFiltros({}); setPaginaInv(1) }}
                    style={{ marginTop: '8px', height: '32px', padding: '0 14px', borderRadius: '8px', border: '1px solid #fca5a5', background: '#fff1f2', cursor: 'pointer', fontSize: '0.82rem', color: '#ef4444', fontWeight: 600 }}>
                    ✕ Limpiar filtros
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })()}
{/* Modal importar CSV */}
{modalImportar && (
  <div className="modal-overlay" onClick={() => setModalImportar(false)}>
    <div className="modal modal-importar" onClick={e => e.stopPropagation()}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <p className="modal-title" style={{ margin: 0 }}>📥 Importar desde archivo</p>
        <button
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: '#6b7280' }}
          onClick={() => setModalImportar(false)}
        >✕</button>
      </div>
      <ImportarCSV
        categorias={categorias}
        bienesExistentes={bienes}
        catInicial={catActual !== 'todos' ? catActual : undefined}
        onImportado={() => { cargarDatos(); setModalImportar(false) }}
      />
    </div>
  </div>
)}

      {/* Formulario — modal si edita, inline si es nuevo */}
      {mostrarForm && (
        <>
          {editandoId ? (
            <div className="modal-overlay" onClick={cancelarForm}>
              <div className="modal modal-importar" style={{ maxWidth: '780px', maxHeight: '88vh', overflowY: 'auto', padding: '1.5rem' }} onClick={e => e.stopPropagation()}>
                <div className="form-panel" style={{ boxShadow: 'none', border: 'none', padding: 0, marginBottom: 0 }}>

          <p className="form-title">{editandoId ? (esComp(form.categoria) ? '✏️ Editar computador' : esTecno(form.categoria) ? '✏️ Editar artículo tecnológico' : '✏️ Editar bien') : (esComp(form.categoria) ? 'Nuevo computador' : esTecno(form.categoria) ? 'Nuevo artículo tecnológico' : 'Nuevo bien')}</p>

          <div className="form-row">
            {!esComp(form.categoria) && !esTecno(form.categoria) && (
              <div className="field">
                <label>{esBiblioteca(form.categoria) ? 'Título *' : 'Nombre *'}</label>
                <input name="nombre" value={form.nombre} onChange={handleChange} placeholder={esBiblioteca(form.categoria) ? 'ej: Cien años de soledad' : 'ej: Escritorio madera'} maxLength={100} className={errores.nombre ? 'input-error' : ''} autoFocus />
              </div>
            )}
            {esBiblioteca(form.categoria) && (
              <div className="field">
                <label>ISBN</label>
                <input name="isbn" value={form.isbn ?? ''} onChange={handleChange} placeholder="ej: 978-956-12-3456-7" maxLength={20} />
              </div>
            )}

            {esComp(form.categoria) && (
              <div className="field">
                <label>Número de serie</label>
                <input name="numero_serie" value={form.numero_serie} onChange={handleChange} placeholder="ej: SN-ABC123456" maxLength={60} />
              </div>
            )}
          </div>

          {esBiblioteca(form.categoria) && (
            <div className="form-row">
              <div className="field">
                <label>Autor</label>
                <input name="autor" value={form.autor ?? ''} onChange={handleChange} placeholder="ej: García Márquez" maxLength={100} />
              </div>
              <div className="field">
                <label>Género</label>
                <input name="genero" value={form.genero ?? ''} onChange={handleChange} placeholder="ej: Novela, Ciencias, Historia" maxLength={60} />
              </div>
            </div>
          )}
          {esComp(form.categoria) ? (
            <div className="form-row">
              <div className="field">
                <label>Código / N° inventario (automático)</label>
                <input value={form.codigo} readOnly className="input-readonly" />
              </div>
              <div className="field">
                <label>Estado</label>
                <select name="estado" value={form.estado} onChange={handleChange}>
                  <option>Bueno</option><option>Regular</option><option>Malo</option><option>Baja</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="form-row triple">
              <div className="field">
                <label>Código / N° inventario *</label>
                <input name="codigo" value={form.codigo} onChange={handleChange} placeholder="ej: INV-0001" maxLength={20} className={errores.codigo ? 'input-error' : ''} />
              </div>
              <div className="field">
                <label>Cantidad</label>
                <input name="cantidad" type="number" min="1" value={form.cantidad} onChange={handleChange} />
              </div>
              <div className="field">
                <label>Estado</label>
                <select name="estado" value={form.estado} onChange={handleChange}>
                  <option>Bueno</option><option>Regular</option><option>Malo</option><option>Baja</option>
                </select>
              </div>
            </div>
          )}
          {(esComp(form.categoria) || esTecno(form.categoria)) ? (
            <div className="form-row triple">
              <div className="field">
                <label>Área</label>
                <ComboField name="area" value={form.area ?? ''} onChange={handleChange} placeholder="ej: Ciencias" maxLength={80} opciones={opsBD.area} />
              </div>
              <div className="field">
                <label>Ubicación</label>
                <ComboField name="ubicacion" value={form.ubicacion} onChange={handleChange} placeholder="ej: Sala 3" maxLength={80} opciones={opsBD.ubicacion} />
              </div>
              <div className="field">
                <label>Responsable</label>
                <ComboField name="responsable" value={form.responsable} onChange={handleChange} placeholder="ej: Juan Pérez" maxLength={80} opciones={opsBD.responsable} />
              </div>
            </div>
          ) : (
            <div className="form-row">
              <div className="field">
                <label>Ubicación</label>
                <ComboField name="ubicacion" value={form.ubicacion} onChange={handleChange} placeholder="ej: Sala 3" maxLength={80} opciones={opsBD.ubicacion} />
              </div>
              <div className="field">
                <label>Responsable</label>
                <ComboField name="responsable" value={form.responsable} onChange={handleChange} placeholder="ej: Juan Pérez" maxLength={80} opciones={opsBD.responsable} />
              </div>
            </div>
          )}

{tieneDescripcion(form.categoria) && (
            <div className="form-row single">
              <div className="field">
                <label>Descripción</label>
                <textarea
                  name="descripcion"
                  value={form.descripcion ?? ''}
                  onChange={handleChange}
                  placeholder="Descripción del bien..."
                  maxLength={500}
                  rows={3}
                />
                <span style={{ fontSize: '11px', color: (form.descripcion?.length ?? 0) > 450 ? '#ef4444' : '#9ca3af', textAlign: 'right', display: 'block', marginTop: '3px' }}>
                  {form.descripcion?.length ?? 0}/500
                </span>
              </div>
            </div>
          )}



          {esComp(form.categoria) && (() => {
            const _catData  = categorias.find(c => c.id === form.categoria)
            const camposCat = _catData?.campos_personalizados ?? []
            const _orden    = _catData?.campos_orden ?? []
            const HEADER_IDS = ['numero_serie','codigo','estado','ubicacion','responsable']
            const SPEC_IDS   = ['tipo','marca','modelo','pantalla','cpu_marca','cpu_modelo','cpu_generacion','ram','ram_tipo','ram_slots','memoria','tipo_almacenamiento','sistema_operativo']
            const ADQUI_IDS  = ['fecha_adquisicion','proveedor','numero_factura','garantia']
            const allIds     = [...HEADER_IDS, ...SPEC_IDS, ...ADQUI_IDS, ...camposCat.map(c => c.id)]
            const fullOrder  = _orden.length ? smartMergeOrder(_orden.filter(id => allIds.includes(id)), allIds) : allIds
            const posOf      = id => { const p = fullOrder.indexOf(id); return p === -1 ? 9999 : p }
            const firstSpecPos  = Math.min(...SPEC_IDS.map(posOf))
            const firstAdquiPos = Math.min(...ADQUI_IDS.map(posOf))
            const headerCF = camposCat.filter(c => posOf(c.id) < firstSpecPos).sort((a,b) => posOf(a.id)-posOf(b.id))
            const specCF   = camposCat.filter(c => posOf(c.id) >= firstSpecPos && posOf(c.id) < firstAdquiPos).sort((a,b) => posOf(a.id)-posOf(b.id))
            const adquiCF  = camposCat.filter(c => posOf(c.id) >= firstAdquiPos).sort((a,b) => posOf(a.id)-posOf(b.id))
            const renderCC = campo => (
              <div key={campo.id} className="field">
                <label>{campo.nombre}{campo.requerido && <span style={{ color: '#ef4444', marginLeft: 3 }}>*</span>}</label>
                {campo.tipo === 'texto'    && <input value={camposExtra[campo.id] ?? ''} onChange={e => setCamposExtra(p => ({ ...p, [campo.id]: e.target.value }))} placeholder={campo.nombre} maxLength={200} className={errores[`extra_${campo.id}`] ? 'input-error' : ''} />}
                {campo.tipo === 'numero'   && <input type="number" value={camposExtra[campo.id] ?? ''} onChange={e => setCamposExtra(p => ({ ...p, [campo.id]: e.target.value }))} className={errores[`extra_${campo.id}`] ? 'input-error' : ''} />}
                {campo.tipo === 'fecha'    && <input type="date" value={camposExtra[campo.id] ?? ''} onChange={e => setCamposExtra(p => ({ ...p, [campo.id]: e.target.value }))} className={errores[`extra_${campo.id}`] ? 'input-error' : ''} />}
                {campo.tipo === 'booleano' && <select value={camposExtra[campo.id] ?? ''} onChange={e => setCamposExtra(p => ({ ...p, [campo.id]: e.target.value }))} className={errores[`extra_${campo.id}`] ? 'input-error' : ''}><option value="">— seleccionar —</option><option value="si">Sí</option><option value="no">No</option></select>}
                {campo.tipo === 'select'   && <select value={camposExtra[campo.id] ?? ''} onChange={e => setCamposExtra(p => ({ ...p, [campo.id]: e.target.value }))} className={errores[`extra_${campo.id}`] ? 'input-error' : ''}><option value="">— seleccionar —</option>{(campo.opciones || []).map(op => <option key={op} value={op}>{op}</option>)}</select>}
              </div>
            )
            const rows3c = arr => { const r = []; for (let i = 0; i < arr.length; i += 3) r.push(arr.slice(i, i+3)); return r }
            return (
              <>
                {headerCF.length > 0 && rows3c(headerCF).map((row, i) => (
                  <div key={`hdr-${i}`} className="form-row triple">{row.map(renderCC)}</div>
                ))}
                <div className="seccion-comp"><span className="seccion-label">💻 Especificaciones del equipo</span></div>
                <div className="form-row triple">
                  <div className="field">
                    <label>Tipo</label>
                    <select name="tipo" value={form.tipo} onChange={handleChange}>
                      <option>Desktop</option><option>Laptop</option><option>All-in-One</option><option>Servidor</option><option>Tablet</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Marca</label>
                    <input name="marca" value={form.marca} onChange={handleChange} placeholder="ej: HP, Dell, Lenovo" maxLength={50} />
                  </div>
                  <div className="field">
                    <label>Modelo</label>
                    <input name="modelo" value={form.modelo} onChange={handleChange} placeholder="ej: ProBook 440 G9" maxLength={80} />
                  </div>
                </div>
                <div className="form-row triple">
                  <div className="field">
                    <label>Pantalla</label>
                    <input name="pantalla" value={form.pantalla ?? ''} onChange={handleChange} placeholder='ej: 15.6" FHD IPS' maxLength={60} />
                  </div>
                  <div className="field">
                    <label>Marca CPU</label>
                    <select name="cpu_marca" value={form.cpu_marca ?? ''} onChange={handleChange}>
                      <option value="">— Seleccionar —</option>
                      <option>Intel</option>
                      <option>AMD</option>
                      <option>Apple</option>
                      <option>Qualcomm</option>
                      <option>ARM</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Modelo CPU</label>
                    <input name="cpu_modelo" value={form.cpu_modelo ?? ''} onChange={handleChange} placeholder="ej: Core i5, Ryzen 5" maxLength={40} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="field">
                    <label>Generación / Versión CPU</label>
                    <input name="cpu_generacion" value={form.cpu_generacion ?? ''} onChange={handleChange} placeholder="ej: 1235U, 5600X, M2" maxLength={40} />
                  </div>
                  <div className="field">
                    <label>Procesador completo (generado)</label>
                    <input value={[form.cpu_marca, form.cpu_modelo, form.cpu_generacion].filter(Boolean).join(' ') || form.cpu || '—'} readOnly className="input-readonly" />
                  </div>
                </div>
                <div className="form-row triple">
                  <div className="field">
                    <label>RAM (capacidad)</label>
                    <input name="ram" value={form.ram} onChange={handleChange} placeholder="ej: 8 GB, 16 GB" maxLength={20} />
                  </div>
                  <div className="field">
                    <label>Tipo RAM</label>
                    <select name="ram_tipo" value={form.ram_tipo ?? ''} onChange={handleChange}>
                      <option value="">— Seleccionar —</option>
                      <option>DDR3</option>
                      <option>DDR4</option>
                      <option>DDR5</option>
                      <option>LPDDR4</option>
                      <option>LPDDR5</option>
                      <option>SO-DIMM DDR4</option>
                      <option>SO-DIMM DDR5</option>
                      <option>Unificada (Apple)</option>
                      <option>Otro</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Slots disponibles</label>
                    <input name="ram_slots" value={form.ram_slots ?? ''} onChange={handleChange} placeholder="ej: 0, 1, 2" maxLength={10} />
                  </div>
                </div>
                <div className="form-row triple">
                  <div className="field">
                    <label>Almacenamiento (capacidad)</label>
                    <select name="memoria" value={form.memoria} onChange={handleChange}>
                      <option value="">— Seleccionar —</option>
                      <option>32 GB</option>
                      <option>64 GB</option>
                      <option>128 GB</option>
                      <option>256 GB</option>
                      <option>512 GB</option>
                      <option>1 TB</option>
                      <option>2 TB</option>
                      <option>4 TB</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Tipo tecnología</label>
                    <select name="tipo_almacenamiento" value={form.tipo_almacenamiento} onChange={handleChange}>
                      <option value="">— Seleccionar —</option>
                      <option>SSD</option>
                      <option>HDD</option>
                      <option>SSD + HDD</option>
                      <option>NVMe</option>
                      <option>eMMC</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Sistema operativo</label>
                    <select name="sistema_operativo" value={form.sistema_operativo} onChange={handleChange}>
                      <option>Windows 11 Pro</option><option>Windows 11 Home</option>
                      <option>Windows 10 Pro</option><option>Windows 10 Home</option>
                      <option>Ubuntu</option><option>macOS</option>
                      <option>Sin sistema</option><option>Otro</option>
                    </select>
                  </div>
                </div>
                {specCF.length > 0 && rows3c(specCF).map((row, i) => (
                  <div key={`spc-${i}`} className="form-row triple">{row.map(renderCC)}</div>
                ))}

                <div className="seccion-comp"><span className="seccion-label">🔑 Licencias</span></div>

                {/* Windows */}
                <div className="seccion-lic-sub">🪟 Windows</div>
                <div className="form-row">
                  <div className="field">
                    <label>Tipo de licencia Windows</label>
                    <div style={{ display: 'flex', gap: 20, marginTop: 6 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                        <input type="radio" name="win_tipo_licencia" value="key" checked={form.win_tipo_licencia === 'key'} onChange={handleChange} /> Key
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                        <input type="radio" name="win_tipo_licencia" value="fabricante" checked={form.win_tipo_licencia === 'fabricante'} onChange={handleChange} /> De fabricante
                      </label>
                    </div>
                  </div>
                </div>
                <div className="form-row triple">
                  <div className="field">
                    <label>Clave Windows</label>
                    {form.win_tipo_licencia === 'fabricante'
                      ? <input value="De fabricante" readOnly className="input-readonly" />
                      : <input name="licencia_windows" value={form.licencia_windows} onChange={handleChange} placeholder="ej: XXXXX-XXXXX-XXXXX-XXXXX-XXXXX" maxLength={29} className="input-mono" />
                    }
                  </div>
                  <div className="field">
                    <label>Versión</label>
                    <input name="win_version" value={form.win_version} onChange={handleChange} placeholder="ej: Windows 10 Home" maxLength={60} />
                  </div>
                  <div className="field">
                    <label>Proveedor</label>
                    <input name="win_proveedor" value={form.win_proveedor} onChange={handleChange} placeholder="ej: Microsoft Store" maxLength={100} readOnly={form.win_tipo_licencia === 'fabricante'} className={form.win_tipo_licencia === 'fabricante' ? 'input-readonly' : ''} />
                  </div>
                </div>
                <div className="form-row triple">
                  <div className="field">
                    <label>N° Factura</label>
                    <input name="win_factura" value={form.win_factura} onChange={handleChange} placeholder="ej: FAC-00123" maxLength={30} readOnly={form.win_tipo_licencia === 'fabricante'} className={form.win_tipo_licencia === 'fabricante' ? 'input-readonly' : ''} />
                  </div>
                  <div className="field">
                    <label>Fecha factura</label>
                    {form.win_tipo_licencia === 'fabricante'
                      ? <input value="N/A" readOnly className="input-readonly" />
                      : <input name="win_fecha_factura" type="date" value={form.win_fecha_factura} onChange={handleChange} />
                    }
                  </div>
                  <div className="field">
                    <label>N° Orden de compra</label>
                    <input name="win_orden" value={form.win_orden} onChange={handleChange} placeholder="ej: OC-2024-001" maxLength={30} readOnly={form.win_tipo_licencia === 'fabricante'} className={form.win_tipo_licencia === 'fabricante' ? 'input-readonly' : ''} />
                  </div>
                </div>

                {/* Office */}
                <div className="seccion-lic-sub">📊 Office</div>
                <div className="form-row">
                  <div className="field">
                    <label>Tipo de licencia Office</label>
                    <div style={{ display: 'flex', gap: 20, marginTop: 6 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                        <input type="radio" name="off_tipo_licencia" value="key" checked={form.off_tipo_licencia === 'key'} onChange={handleChange} /> Key
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                        <input type="radio" name="off_tipo_licencia" value="alternativa" checked={form.off_tipo_licencia === 'alternativa'} onChange={handleChange} /> Alternativa
                      </label>
                    </div>
                  </div>
                </div>
                <div className="form-row triple">
                  <div className="field">
                    <label>Clave Office</label>
                    {form.off_tipo_licencia === 'alternativa'
                      ? <input value="Alternativa" readOnly className="input-readonly" />
                      : <input name="licencia_office" value={form.licencia_office} onChange={handleChange} placeholder="ej: XXXXX-XXXXX-XXXXX-XXXXX-XXXXX" maxLength={29} className="input-mono" />
                    }
                  </div>
                  <div className="field">
                    <label>Versión</label>
                    <input name="off_version" value={form.off_version} onChange={handleChange} placeholder="ej: Office 2019, Microsoft 365" maxLength={60} />
                  </div>
                  <div className="field">
                    <label>Proveedor</label>
                    <input name="off_proveedor" value={form.off_proveedor} onChange={handleChange} placeholder="ej: Microsoft Store" maxLength={100} readOnly={form.off_tipo_licencia === 'alternativa'} className={form.off_tipo_licencia === 'alternativa' ? 'input-readonly' : ''} />
                  </div>
                </div>
                <div className="form-row triple">
                  <div className="field">
                    <label>N° Factura</label>
                    <input name="off_factura" value={form.off_factura} onChange={handleChange} placeholder="ej: FAC-00124" maxLength={30} readOnly={form.off_tipo_licencia === 'alternativa'} className={form.off_tipo_licencia === 'alternativa' ? 'input-readonly' : ''} />
                  </div>
                  <div className="field">
                    <label>Fecha factura</label>
                    {form.off_tipo_licencia === 'alternativa'
                      ? <input value="N/A" readOnly className="input-readonly" />
                      : <input name="off_fecha_factura" type="date" value={form.off_fecha_factura} onChange={handleChange} />
                    }
                  </div>
                  <div className="field">
                    <label>N° Orden de compra</label>
                    <input name="off_orden" value={form.off_orden} onChange={handleChange} placeholder="ej: OC-2024-002" maxLength={30} readOnly={form.off_tipo_licencia === 'alternativa'} className={form.off_tipo_licencia === 'alternativa' ? 'input-readonly' : ''} />
                  </div>
                </div>

                <div className="seccion-comp"><span className="seccion-label">🛒 Adquisición del computador</span></div>
                <div className="form-row triple">
                  <div className="field">
                    <label>Fecha de adquisición</label>
                    <input name="fecha_adquisicion" type="date" value={form.fecha_adquisicion} onChange={handleChange} />
                  </div>
                  <div className="field">
                    <label>Proveedor</label>
                    <input name="proveedor" value={form.proveedor} onChange={handleChange} placeholder="ej: TechStore Ltda." maxLength={100} />
                  </div>
                  <div className="field">
                    <label>Fondo</label>
                    <input name="fondo" value={form.fondo} onChange={handleChange} placeholder="ej: SEP, PIE, Municipal" maxLength={60} />
                  </div>
                </div>
                <div className="form-row triple">
                  <div className="field">
                    <label>N° de factura</label>
                    <input name="numero_factura" value={form.numero_factura} onChange={handleChange} placeholder="ej: FAC-00123" maxLength={30} />
                  </div>
                  <div className="field">
                    <label>N° de orden de compra</label>
                    <input name="numero_orden" value={form.numero_orden} onChange={handleChange} placeholder="ej: OC-2024-001" maxLength={30} />
                  </div>
                  <div className="field">
                    <label>Garantía</label>
                    <input name="garantia" value={form.garantia} onChange={handleChange} placeholder="ej: 1 año, hasta dic 2026" maxLength={60} />
                  </div>
                </div>
                {adquiCF.length > 0 && rows3c(adquiCF).map((row, i) => (
                  <div key={`adq-${i}`} className="form-row triple">{row.map(renderCC)}</div>
                ))}
              </>
            )
          })()}

          {esTecno(form.categoria) && (() => {
            const _catData  = categorias.find(c => c.id === form.categoria)
            const camposCat = _catData?.campos_personalizados ?? []
            const _orden    = _catData?.campos_orden ?? []
            const HEADER_IDS = ['codigo', 'cantidad', 'estado', 'ubicacion', 'responsable']
            const OBS_IDS    = ['obs']
            const EQUIPO_IDS = ['tipo', 'tecnologia', 'marca', 'modelo', 'numero_serie', 'consumible']
            const ADQUI_IDS  = ['proveedor', 'numero_factura', 'fecha_adquisicion', 'numero_orden', 'fondo', 'garantia']
            const allIds     = [...HEADER_IDS, ...EQUIPO_IDS, ...ADQUI_IDS, ...OBS_IDS, ...camposCat.map(c => c.id)]
            const fullOrder  = _orden.length
              ? smartMergeOrder(_orden.filter(id => allIds.includes(id)), allIds)
              : allIds
            const posOf = id => { const p = fullOrder.indexOf(id); return p === -1 ? 9999 : p }
            const firstEquipoPos = Math.min(...EQUIPO_IDS.map(posOf))
            const firstAdquiPos  = Math.min(...ADQUI_IDS.map(posOf))
            const headerCustomFields = camposCat.filter(c => posOf(c.id) < firstEquipoPos).sort((a, b) => posOf(a.id) - posOf(b.id))
            const equipoFields = [
              ...EQUIPO_IDS.map(id => ({ id, _sis: true })),
              ...camposCat.filter(c => posOf(c.id) >= firstEquipoPos && posOf(c.id) < firstAdquiPos).map(c => ({ ...c, _sis: false })),
            ].sort((a, b) => posOf(a.id) - posOf(b.id))
            const adquiFields = [
              ...ADQUI_IDS.map(id => ({ id, _sis: true })),
              ...camposCat.filter(c => posOf(c.id) >= firstAdquiPos).map(c => ({ ...c, _sis: false })),
            ].sort((a, b) => posOf(a.id) - posOf(b.id))
            const renderSis1 = id => {
              if (id === 'tipo')             return <div key="tipo"             className="field"><label>Tipo</label><ComboField name="tipo" value={form.tipo ?? ''} onChange={handleChange} placeholder="ej: Impresora" maxLength={60} opciones={opsBD.tipo} /></div>
              if (id === 'tecnologia')       return <div key="tecnologia"       className="field"><label>Tecnología</label><ComboField name="tecnologia" value={form.tecnologia ?? ''} onChange={handleChange} placeholder="ej: Láser, Inkjet" maxLength={60} opciones={opsBD.tecnologia} /></div>
              if (id === 'marca')            return <div key="marca"            className="field"><label>Marca</label><ComboField name="marca" value={form.marca ?? ''} onChange={handleChange} placeholder="ej: HP, Epson, Canon" maxLength={50} opciones={opsBD.marca} /></div>
              if (id === 'modelo')           return <div key="modelo"           className="field"><label>Modelo</label><input name="modelo" value={form.modelo ?? ''} onChange={handleChange} placeholder="ej: LaserJet Pro M15w" maxLength={80} /></div>
              if (id === 'numero_serie')     return <div key="numero_serie"     className="field"><label>N° de serie</label><input name="numero_serie" value={form.numero_serie ?? ''} onChange={handleChange} placeholder="ej: SN-ABC123" maxLength={60} /></div>
              if (id === 'consumible')       return <div key="consumible"       className="field"><label>Consumible</label><ComboField name="consumible" value={form.consumible ?? ''} onChange={handleChange} placeholder="ej: Tóner HP 26A" maxLength={100} opciones={opsBD.consumible} /></div>
              if (id === 'proveedor')        return <div key="proveedor"        className="field"><label>Proveedor</label><ComboField name="proveedor" value={form.proveedor ?? ''} onChange={handleChange} placeholder="ej: TechStore Ltda." maxLength={100} opciones={opsBD.proveedor} /></div>
              if (id === 'numero_factura')   return <div key="numero_factura"   className="field"><label>Nº Factura</label><input name="numero_factura" value={form.numero_factura ?? ''} onChange={handleChange} placeholder="ej: FAC-00123" maxLength={30} /></div>
              if (id === 'fecha_adquisicion')return <div key="fecha_adquisicion"className="field"><label>Fecha Factura</label><input name="fecha_adquisicion" type="date" value={form.fecha_adquisicion ?? ''} onChange={handleChange} /></div>
              if (id === 'numero_orden')     return <div key="numero_orden"     className="field"><label>Orden de Compra</label><ComboField name="numero_orden" value={form.numero_orden ?? ''} onChange={handleChange} placeholder="ej: OC-2024-001" maxLength={30} opciones={opsBD.numero_orden} /></div>
              if (id === 'fondo')            return <div key="fondo"            className="field"><label>Fondo</label><ComboField name="fondo" value={form.fondo ?? ''} onChange={handleChange} placeholder="ej: SEP, PIE, Municipal" maxLength={60} opciones={opsBD.fondo} /></div>
              if (id === 'garantia')         return <div key="garantia"         className="field"><label>Garantía</label><input name="garantia" value={form.garantia ?? ''} onChange={handleChange} placeholder="ej: 1 año, hasta dic 2026" maxLength={60} /></div>
              return null
            }
            const renderCampo1 = campo => (
              <div key={campo.id} className="field">
                <label>{campo.nombre}{campo.requerido && <span style={{ color: '#ef4444', marginLeft: 3 }}>*</span>}</label>
                {campo.tipo === 'texto'    && <input value={camposExtra[campo.id] ?? ''} onChange={e => setCamposExtra(p => ({ ...p, [campo.id]: e.target.value }))} placeholder={campo.nombre} maxLength={200} className={errores[`extra_${campo.id}`] ? 'input-error' : ''} />}
                {campo.tipo === 'numero'   && <input type="number" value={camposExtra[campo.id] ?? ''} onChange={e => setCamposExtra(p => ({ ...p, [campo.id]: e.target.value }))} className={errores[`extra_${campo.id}`] ? 'input-error' : ''} />}
                {campo.tipo === 'fecha'    && <input type="date" value={camposExtra[campo.id] ?? ''} onChange={e => setCamposExtra(p => ({ ...p, [campo.id]: e.target.value }))} className={errores[`extra_${campo.id}`] ? 'input-error' : ''} />}
                {campo.tipo === 'booleano' && <select value={camposExtra[campo.id] ?? ''} onChange={e => setCamposExtra(p => ({ ...p, [campo.id]: e.target.value }))} className={errores[`extra_${campo.id}`] ? 'input-error' : ''}><option value="">— seleccionar —</option><option value="si">Sí</option><option value="no">No</option></select>}
                {campo.tipo === 'select'   && <select value={camposExtra[campo.id] ?? ''} onChange={e => setCamposExtra(p => ({ ...p, [campo.id]: e.target.value }))} className={errores[`extra_${campo.id}`] ? 'input-error' : ''}><option value="">— seleccionar —</option>{(campo.opciones || []).map(op => <option key={op} value={op}>{op}</option>)}</select>}
              </div>
            )
            const rows3_1 = arr => { const r = []; for (let i = 0; i < arr.length; i += 3) r.push(arr.slice(i, i+3)); return r }
            return (
              <>
                {headerCustomFields.length > 0 && rows3_1(headerCustomFields).map((row, i) => (
                  <div key={`hdr-${i}`} className="form-row triple">
                    {row.map(f => renderCampo1(f))}
                  </div>
                ))}
                <div className="seccion-comp"><span className="seccion-label">🖨️ Datos del equipo</span></div>
                {rows3_1(equipoFields).map((row, i) => (
                  <div key={i} className="form-row triple">
                    {row.map(f => f._sis ? renderSis1(f.id) : renderCampo1(f))}
                  </div>
                ))}
                <div className="seccion-comp"><span className="seccion-label">🛒 Adquisición</span></div>
                {rows3_1(adquiFields).map((row, i) => (
                  <div key={i} className="form-row triple">
                    {row.map(f => f._sis ? renderSis1(f.id) : renderCampo1(f))}
                  </div>
                ))}
              </>
            )
          })()}

          {!esComp(form.categoria) && !esTecno(form.categoria) && (() => {
            const _catData  = categorias.find(c => c.id === form.categoria)
            const camposCat = _catData?.campos_personalizados ?? []
            const _orden    = _catData?.campos_orden ?? []
            const HEADER_IDS = ['codigo', 'cantidad', 'estado', 'ubicacion', 'responsable']
            const OBS_IDS    = ['obs']
            const ADQUI_IDS  = ['fecha_adquisicion', 'proveedor', 'fondo', 'numero_factura', 'numero_orden', 'garantia']
            const allIds    = [...HEADER_IDS, ...ADQUI_IDS, ...OBS_IDS, ...camposCat.map(c => c.id)]
            const fullOrder = _orden.length
              ? smartMergeOrder(_orden.filter(id => allIds.includes(id)), allIds)
              : allIds
            const posOf1 = id => { const p = fullOrder.indexOf(id); return p === -1 ? 9999 : p }
            const firstAdquiPos1 = Math.min(...ADQUI_IDS.map(posOf1))
            const headerCustomFields1 = camposCat.filter(c => posOf1(c.id) < firstAdquiPos1).sort((a, b) => posOf1(a.id) - posOf1(b.id))
            const adquiFields1 = [
              ...ADQUI_IDS.map(id => ({ id, _sis: true })),
              ...camposCat.filter(c => posOf1(c.id) >= firstAdquiPos1).map(c => ({ ...c, _sis: false })),
            ].sort((a, b) => posOf1(a.id) - posOf1(b.id))
            const renderSisG1 = id => {
              if (id === 'fecha_adquisicion') return <div key="fecha_adquisicion" className="field"><label>Fecha de adquisición</label><input name="fecha_adquisicion" type="date" value={form.fecha_adquisicion ?? ''} onChange={handleChange} /></div>
              if (id === 'proveedor')         return <div key="proveedor"         className="field"><label>Proveedor</label><ComboField name="proveedor" value={form.proveedor ?? ''} onChange={handleChange} placeholder="ej: TechStore Ltda." maxLength={100} opciones={opsBD.proveedor} /></div>
              if (id === 'fondo')             return <div key="fondo"             className="field"><label>Fondo</label><ComboField name="fondo" value={form.fondo ?? ''} onChange={handleChange} placeholder="ej: SEP, PIE, Municipal" maxLength={60} opciones={opsBD.fondo} /></div>
              if (id === 'numero_factura')    return <div key="numero_factura"    className="field"><label>N° de factura</label><input name="numero_factura" value={form.numero_factura ?? ''} onChange={handleChange} placeholder="ej: FAC-00123" maxLength={30} /></div>
              if (id === 'numero_orden')      return <div key="numero_orden"      className="field"><label>N° de orden de compra</label><ComboField name="numero_orden" value={form.numero_orden ?? ''} onChange={handleChange} placeholder="ej: OC-2024-001" maxLength={30} opciones={opsBD.numero_orden} /></div>
              if (id === 'garantia')          return <div key="garantia"          className="field"><label>Garantía</label><input name="garantia" value={form.garantia ?? ''} onChange={handleChange} placeholder="ej: 1 año, hasta dic 2026" maxLength={60} /></div>
              return null
            }
            const renderCampoG1 = campo => (
              <div key={campo.id} className="field">
                <label>{campo.nombre}{campo.requerido && <span style={{ color: '#ef4444', marginLeft: 3 }}>*</span>}</label>
                {campo.tipo === 'texto'    && <input value={camposExtra[campo.id] ?? ''} onChange={e => setCamposExtra(p => ({ ...p, [campo.id]: e.target.value }))} placeholder={campo.nombre} maxLength={200} className={errores[`extra_${campo.id}`] ? 'input-error' : ''} />}
                {campo.tipo === 'numero'   && <input type="number" value={camposExtra[campo.id] ?? ''} onChange={e => setCamposExtra(p => ({ ...p, [campo.id]: e.target.value }))} className={errores[`extra_${campo.id}`] ? 'input-error' : ''} />}
                {campo.tipo === 'fecha'    && <input type="date" value={camposExtra[campo.id] ?? ''} onChange={e => setCamposExtra(p => ({ ...p, [campo.id]: e.target.value }))} className={errores[`extra_${campo.id}`] ? 'input-error' : ''} />}
                {campo.tipo === 'booleano' && <select value={camposExtra[campo.id] ?? ''} onChange={e => setCamposExtra(p => ({ ...p, [campo.id]: e.target.value }))} className={errores[`extra_${campo.id}`] ? 'input-error' : ''}><option value="">— seleccionar —</option><option value="si">Sí</option><option value="no">No</option></select>}
                {campo.tipo === 'select'   && <select value={camposExtra[campo.id] ?? ''} onChange={e => setCamposExtra(p => ({ ...p, [campo.id]: e.target.value }))} className={errores[`extra_${campo.id}`] ? 'input-error' : ''}><option value="">— seleccionar —</option>{(campo.opciones || []).map(op => <option key={op} value={op}>{op}</option>)}</select>}
              </div>
            )
            const rows3G1 = arr => { const r = []; for (let i = 0; i < arr.length; i += 3) r.push(arr.slice(i, i+3)); return r }
            return (
              <>
                {headerCustomFields1.length > 0 && rows3G1(headerCustomFields1).map((row, i) => (
                  <div key={`hdr1-${i}`} className="form-row triple">
                    {row.map(f => renderCampoG1(f))}
                  </div>
                ))}
                <div className="seccion-comp"><span className="seccion-label">🛒 Adquisición</span></div>
                {rows3G1(adquiFields1).map((row, i) => (
                  <div key={i} className="form-row triple">
                    {row.map(f => f._sis ? renderSisG1(f.id) : renderCampoG1(f))}
                  </div>
                ))}
              </>
            )
          })()}

          <div className="form-row single">
            <div className="field">
              <label>Observaciones</label>
              <textarea name="obs" value={form.obs} onChange={handleChange} placeholder="Observación adicional..." maxLength={500} />
                  <span style={{ fontSize: "11px", color: form.obs.length > 450 ? "#ef4444" : "#9ca3af", textAlign: "right", display: "block", marginTop: "3px" }}>{form.obs.length}/500</span>
            </div>
          </div>

          <div className="form-actions">
            <button className="btn-cancel" onClick={cancelarForm} disabled={guardando}>Cancelar</button>
            <button className="btn-primary" onClick={guardarBien} disabled={guardando}>
              {guardando ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Guardar bien'}
            </button>
          </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="form-panel">

          <p className="form-title">{editandoId ? (esComp(form.categoria) ? '✏️ Editar computador' : esTecno(form.categoria) ? '✏️ Editar artículo tecnológico' : '✏️ Editar bien') : (esComp(form.categoria) ? 'Nuevo computador' : esTecno(form.categoria) ? 'Nuevo artículo tecnológico' : 'Nuevo bien')}</p>

          <div className="form-row">
            {!esComp(form.categoria) && !esTecno(form.categoria) && (
              <div className="field">
                <label>{esBiblioteca(form.categoria) ? 'Título *' : 'Nombre *'}</label>
                <input name="nombre" value={form.nombre} onChange={handleChange} placeholder={esBiblioteca(form.categoria) ? 'ej: Cien años de soledad' : 'ej: Escritorio madera'} maxLength={100} className={errores.nombre ? 'input-error' : ''} autoFocus />
              </div>
            )}
            {esBiblioteca(form.categoria) && (
              <div className="field">
                <label>ISBN</label>
                <input name="isbn" value={form.isbn ?? ''} onChange={handleChange} placeholder="ej: 978-956-12-3456-7" maxLength={20} />
              </div>
            )}

            {esComp(form.categoria) && (
              <div className="field">
                <label>Número de serie</label>
                <input name="numero_serie" value={form.numero_serie} onChange={handleChange} placeholder="ej: SN-ABC123456" maxLength={60} />
              </div>
            )}
          </div>

          {esBiblioteca(form.categoria) && (
            <div className="form-row">
              <div className="field">
                <label>Autor</label>
                <input name="autor" value={form.autor ?? ''} onChange={handleChange} placeholder="ej: García Márquez" maxLength={100} />
              </div>
              <div className="field">
                <label>Género</label>
                <input name="genero" value={form.genero ?? ''} onChange={handleChange} placeholder="ej: Novela, Ciencias, Historia" maxLength={60} />
              </div>
            </div>
          )}
          {esComp(form.categoria) ? (
            <div className="form-row">
              <div className="field">
                <label>Código / N° inventario (automático)</label>
                <input value={form.codigo} readOnly className="input-readonly" />
              </div>
              <div className="field">
                <label>Estado</label>
                <select name="estado" value={form.estado} onChange={handleChange}>
                  <option>Bueno</option><option>Regular</option><option>Malo</option><option>Baja</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="form-row triple">
              <div className="field">
                <label>Código / N° inventario *</label>
                <input name="codigo" value={form.codigo} onChange={handleChange} placeholder="ej: INV-0001" maxLength={20} className={errores.codigo ? 'input-error' : ''} />
              </div>
              <div className="field">
                <label>Cantidad</label>
                <input name="cantidad" type="number" min="1" value={form.cantidad} onChange={handleChange} />
              </div>
              <div className="field">
                <label>Estado</label>
                <select name="estado" value={form.estado} onChange={handleChange}>
                  <option>Bueno</option><option>Regular</option><option>Malo</option><option>Baja</option>
                </select>
              </div>
            </div>
          )}
          {(esComp(form.categoria) || esTecno(form.categoria)) ? (
            <div className="form-row triple">
              <div className="field">
                <label>Área</label>
                <ComboField name="area" value={form.area ?? ''} onChange={handleChange} placeholder="ej: Ciencias" maxLength={80} opciones={opsBD.area} />
              </div>
              <div className="field">
                <label>Ubicación</label>
                <ComboField name="ubicacion" value={form.ubicacion} onChange={handleChange} placeholder="ej: Sala 3" maxLength={80} opciones={opsBD.ubicacion} />
              </div>
              <div className="field">
                <label>Responsable</label>
                <ComboField name="responsable" value={form.responsable} onChange={handleChange} placeholder="ej: Juan Pérez" maxLength={80} opciones={opsBD.responsable} />
              </div>
            </div>
          ) : (
            <div className="form-row">
              <div className="field">
                <label>Ubicación</label>
                <ComboField name="ubicacion" value={form.ubicacion} onChange={handleChange} placeholder="ej: Sala 3" maxLength={80} opciones={opsBD.ubicacion} />
              </div>
              <div className="field">
                <label>Responsable</label>
                <ComboField name="responsable" value={form.responsable} onChange={handleChange} placeholder="ej: Juan Pérez" maxLength={80} opciones={opsBD.responsable} />
              </div>
            </div>
          )}

          {tieneDescripcion(form.categoria) && (
            <div className="form-row single">
              <div className="field">
                <label>Descripción</label>
                <textarea
                  name="descripcion"
                  value={form.descripcion ?? ''}
                  onChange={handleChange}
                  placeholder="Descripción del bien..."
                  maxLength={500}
                  rows={3}
                />
                <span style={{ fontSize: '11px', color: (form.descripcion?.length ?? 0) > 450 ? '#ef4444' : '#9ca3af', textAlign: 'right', display: 'block', marginTop: '3px' }}>
                  {form.descripcion?.length ?? 0}/500
                </span>
              </div>
            </div>
          )}


          {esComp(form.categoria) && (() => {
            const _catData  = categorias.find(c => c.id === form.categoria)
            const camposCat = _catData?.campos_personalizados ?? []
            const _orden    = _catData?.campos_orden ?? []
            const HEADER_IDS = ['numero_serie','codigo','estado','ubicacion','responsable']
            const SPEC_IDS   = ['tipo','marca','modelo','pantalla','cpu_marca','cpu_modelo','cpu_generacion','ram','ram_tipo','ram_slots','memoria','tipo_almacenamiento','sistema_operativo']
            const ADQUI_IDS  = ['fecha_adquisicion','proveedor','numero_factura','garantia']
            const allIds     = [...HEADER_IDS, ...SPEC_IDS, ...ADQUI_IDS, ...camposCat.map(c => c.id)]
            const fullOrder  = _orden.length ? smartMergeOrder(_orden.filter(id => allIds.includes(id)), allIds) : allIds
            const posOf      = id => { const p = fullOrder.indexOf(id); return p === -1 ? 9999 : p }
            const firstSpecPos  = Math.min(...SPEC_IDS.map(posOf))
            const firstAdquiPos = Math.min(...ADQUI_IDS.map(posOf))
            const headerCF = camposCat.filter(c => posOf(c.id) < firstSpecPos).sort((a,b) => posOf(a.id)-posOf(b.id))
            const specCF   = camposCat.filter(c => posOf(c.id) >= firstSpecPos && posOf(c.id) < firstAdquiPos).sort((a,b) => posOf(a.id)-posOf(b.id))
            const adquiCF  = camposCat.filter(c => posOf(c.id) >= firstAdquiPos).sort((a,b) => posOf(a.id)-posOf(b.id))
            const renderCC = campo => (
              <div key={campo.id} className="field">
                <label>{campo.nombre}{campo.requerido && <span style={{ color: '#ef4444', marginLeft: 3 }}>*</span>}</label>
                {campo.tipo === 'texto'    && <input value={camposExtra[campo.id] ?? ''} onChange={e => setCamposExtra(p => ({ ...p, [campo.id]: e.target.value }))} placeholder={campo.nombre} maxLength={200} className={errores[`extra_${campo.id}`] ? 'input-error' : ''} />}
                {campo.tipo === 'numero'   && <input type="number" value={camposExtra[campo.id] ?? ''} onChange={e => setCamposExtra(p => ({ ...p, [campo.id]: e.target.value }))} className={errores[`extra_${campo.id}`] ? 'input-error' : ''} />}
                {campo.tipo === 'fecha'    && <input type="date" value={camposExtra[campo.id] ?? ''} onChange={e => setCamposExtra(p => ({ ...p, [campo.id]: e.target.value }))} className={errores[`extra_${campo.id}`] ? 'input-error' : ''} />}
                {campo.tipo === 'booleano' && <select value={camposExtra[campo.id] ?? ''} onChange={e => setCamposExtra(p => ({ ...p, [campo.id]: e.target.value }))} className={errores[`extra_${campo.id}`] ? 'input-error' : ''}><option value="">— seleccionar —</option><option value="si">Sí</option><option value="no">No</option></select>}
                {campo.tipo === 'select'   && <select value={camposExtra[campo.id] ?? ''} onChange={e => setCamposExtra(p => ({ ...p, [campo.id]: e.target.value }))} className={errores[`extra_${campo.id}`] ? 'input-error' : ''}><option value="">— seleccionar —</option>{(campo.opciones || []).map(op => <option key={op} value={op}>{op}</option>)}</select>}
              </div>
            )
            const rows3c = arr => { const r = []; for (let i = 0; i < arr.length; i += 3) r.push(arr.slice(i, i+3)); return r }
            return (
              <>
                {headerCF.length > 0 && rows3c(headerCF).map((row, i) => (
                  <div key={`hdr-${i}`} className="form-row triple">{row.map(renderCC)}</div>
                ))}
                <div className="seccion-comp"><span className="seccion-label">💻 Especificaciones del equipo</span></div>
                <div className="form-row triple">
                  <div className="field">
                    <label>Tipo</label>
                    <select name="tipo" value={form.tipo} onChange={handleChange}>
                      <option>Desktop</option><option>Laptop</option><option>All-in-One</option><option>Servidor</option><option>Tablet</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Marca</label>
                    <input name="marca" value={form.marca} onChange={handleChange} placeholder="ej: HP, Dell, Lenovo" maxLength={50} />
                  </div>
                  <div className="field">
                    <label>Modelo</label>
                    <input name="modelo" value={form.modelo} onChange={handleChange} placeholder="ej: ProBook 440 G9" maxLength={80} />
                  </div>
                </div>
                <div className="form-row triple">
                  <div className="field">
                    <label>Pantalla</label>
                    <input name="pantalla" value={form.pantalla ?? ''} onChange={handleChange} placeholder='ej: 15.6" FHD IPS' maxLength={60} />
                  </div>
                  <div className="field">
                    <label>Marca CPU</label>
                    <select name="cpu_marca" value={form.cpu_marca ?? ''} onChange={handleChange}>
                      <option value="">— Seleccionar —</option>
                      <option>Intel</option>
                      <option>AMD</option>
                      <option>Apple</option>
                      <option>Qualcomm</option>
                      <option>ARM</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Modelo CPU</label>
                    <input name="cpu_modelo" value={form.cpu_modelo ?? ''} onChange={handleChange} placeholder="ej: Core i5, Ryzen 5" maxLength={40} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="field">
                    <label>Generación / Versión CPU</label>
                    <input name="cpu_generacion" value={form.cpu_generacion ?? ''} onChange={handleChange} placeholder="ej: 1235U, 5600X, M2" maxLength={40} />
                  </div>
                  <div className="field">
                    <label>Procesador completo (generado)</label>
                    <input value={[form.cpu_marca, form.cpu_modelo, form.cpu_generacion].filter(Boolean).join(' ') || form.cpu || '—'} readOnly className="input-readonly" />
                  </div>
                </div>
                <div className="form-row triple">
                  <div className="field">
                    <label>RAM (capacidad)</label>
                    <input name="ram" value={form.ram} onChange={handleChange} placeholder="ej: 8 GB, 16 GB" maxLength={20} />
                  </div>
                  <div className="field">
                    <label>Tipo RAM</label>
                    <select name="ram_tipo" value={form.ram_tipo ?? ''} onChange={handleChange}>
                      <option value="">— Seleccionar —</option>
                      <option>DDR3</option>
                      <option>DDR4</option>
                      <option>DDR5</option>
                      <option>LPDDR4</option>
                      <option>LPDDR5</option>
                      <option>SO-DIMM DDR4</option>
                      <option>SO-DIMM DDR5</option>
                      <option>Unificada (Apple)</option>
                      <option>Otro</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Slots disponibles</label>
                    <input name="ram_slots" value={form.ram_slots ?? ''} onChange={handleChange} placeholder="ej: 0, 1, 2" maxLength={10} />
                  </div>
                </div>
                <div className="form-row triple">
                  <div className="field">
                    <label>Almacenamiento (capacidad)</label>
                    <select name="memoria" value={form.memoria} onChange={handleChange}>
                      <option value="">— Seleccionar —</option>
                      <option>32 GB</option>
                      <option>64 GB</option>
                      <option>128 GB</option>
                      <option>256 GB</option>
                      <option>512 GB</option>
                      <option>1 TB</option>
                      <option>2 TB</option>
                      <option>4 TB</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Tipo tecnología</label>
                    <select name="tipo_almacenamiento" value={form.tipo_almacenamiento} onChange={handleChange}>
                      <option value="">— Seleccionar —</option>
                      <option>SSD</option>
                      <option>HDD</option>
                      <option>SSD + HDD</option>
                      <option>NVMe</option>
                      <option>eMMC</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Sistema operativo</label>
                    <select name="sistema_operativo" value={form.sistema_operativo} onChange={handleChange}>
                      <option>Windows 11 Pro</option><option>Windows 11 Home</option>
                      <option>Windows 10 Pro</option><option>Windows 10 Home</option>
                      <option>Ubuntu</option><option>macOS</option>
                      <option>Sin sistema</option><option>Otro</option>
                    </select>
                  </div>
                </div>
                {specCF.length > 0 && rows3c(specCF).map((row, i) => (
                  <div key={`spc-${i}`} className="form-row triple">{row.map(renderCC)}</div>
                ))}

                <div className="seccion-comp"><span className="seccion-label">🔑 Licencias</span></div>

                {/* Windows */}
                <div className="seccion-lic-sub">🪟 Windows</div>
                <div className="form-row">
                  <div className="field">
                    <label>Tipo de licencia Windows</label>
                    <div style={{ display: 'flex', gap: 20, marginTop: 6 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                        <input type="radio" name="win_tipo_licencia" value="key" checked={form.win_tipo_licencia === 'key'} onChange={handleChange} /> Key
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                        <input type="radio" name="win_tipo_licencia" value="fabricante" checked={form.win_tipo_licencia === 'fabricante'} onChange={handleChange} /> De fabricante
                      </label>
                    </div>
                  </div>
                </div>
                <div className="form-row triple">
                  <div className="field">
                    <label>Clave Windows</label>
                    {form.win_tipo_licencia === 'fabricante'
                      ? <input value="De fabricante" readOnly className="input-readonly" />
                      : <input name="licencia_windows" value={form.licencia_windows} onChange={handleChange} placeholder="ej: XXXXX-XXXXX-XXXXX-XXXXX-XXXXX" maxLength={29} className="input-mono" />
                    }
                  </div>
                  <div className="field">
                    <label>Versión</label>
                    <input name="win_version" value={form.win_version} onChange={handleChange} placeholder="ej: Windows 10 Home" maxLength={60} />
                  </div>
                  <div className="field">
                    <label>Proveedor</label>
                    <input name="win_proveedor" value={form.win_proveedor} onChange={handleChange} placeholder="ej: Microsoft Store" maxLength={100} readOnly={form.win_tipo_licencia === 'fabricante'} className={form.win_tipo_licencia === 'fabricante' ? 'input-readonly' : ''} />
                  </div>
                </div>
                <div className="form-row triple">
                  <div className="field">
                    <label>N° Factura</label>
                    <input name="win_factura" value={form.win_factura} onChange={handleChange} placeholder="ej: FAC-00123" maxLength={30} readOnly={form.win_tipo_licencia === 'fabricante'} className={form.win_tipo_licencia === 'fabricante' ? 'input-readonly' : ''} />
                  </div>
                  <div className="field">
                    <label>Fecha factura</label>
                    {form.win_tipo_licencia === 'fabricante'
                      ? <input value="N/A" readOnly className="input-readonly" />
                      : <input name="win_fecha_factura" type="date" value={form.win_fecha_factura} onChange={handleChange} />
                    }
                  </div>
                  <div className="field">
                    <label>N° Orden de compra</label>
                    <input name="win_orden" value={form.win_orden} onChange={handleChange} placeholder="ej: OC-2024-001" maxLength={30} readOnly={form.win_tipo_licencia === 'fabricante'} className={form.win_tipo_licencia === 'fabricante' ? 'input-readonly' : ''} />
                  </div>
                </div>

                {/* Office */}
                <div className="seccion-lic-sub">📊 Office</div>
                <div className="form-row">
                  <div className="field">
                    <label>Tipo de licencia Office</label>
                    <div style={{ display: 'flex', gap: 20, marginTop: 6 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                        <input type="radio" name="off_tipo_licencia" value="key" checked={form.off_tipo_licencia === 'key'} onChange={handleChange} /> Key
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                        <input type="radio" name="off_tipo_licencia" value="alternativa" checked={form.off_tipo_licencia === 'alternativa'} onChange={handleChange} /> Alternativa
                      </label>
                    </div>
                  </div>
                </div>
                <div className="form-row triple">
                  <div className="field">
                    <label>Clave Office</label>
                    {form.off_tipo_licencia === 'alternativa'
                      ? <input value="Alternativa" readOnly className="input-readonly" />
                      : <input name="licencia_office" value={form.licencia_office} onChange={handleChange} placeholder="ej: XXXXX-XXXXX-XXXXX-XXXXX-XXXXX" maxLength={29} className="input-mono" />
                    }
                  </div>
                  <div className="field">
                    <label>Versión</label>
                    <input name="off_version" value={form.off_version} onChange={handleChange} placeholder="ej: Office 2019, Microsoft 365" maxLength={60} />
                  </div>
                  <div className="field">
                    <label>Proveedor</label>
                    <input name="off_proveedor" value={form.off_proveedor} onChange={handleChange} placeholder="ej: Microsoft Store" maxLength={100} readOnly={form.off_tipo_licencia === 'alternativa'} className={form.off_tipo_licencia === 'alternativa' ? 'input-readonly' : ''} />
                  </div>
                </div>
                <div className="form-row triple">
                  <div className="field">
                    <label>N° Factura</label>
                    <input name="off_factura" value={form.off_factura} onChange={handleChange} placeholder="ej: FAC-00124" maxLength={30} readOnly={form.off_tipo_licencia === 'alternativa'} className={form.off_tipo_licencia === 'alternativa' ? 'input-readonly' : ''} />
                  </div>
                  <div className="field">
                    <label>Fecha factura</label>
                    {form.off_tipo_licencia === 'alternativa'
                      ? <input value="N/A" readOnly className="input-readonly" />
                      : <input name="off_fecha_factura" type="date" value={form.off_fecha_factura} onChange={handleChange} />
                    }
                  </div>
                  <div className="field">
                    <label>N° Orden de compra</label>
                    <input name="off_orden" value={form.off_orden} onChange={handleChange} placeholder="ej: OC-2024-002" maxLength={30} readOnly={form.off_tipo_licencia === 'alternativa'} className={form.off_tipo_licencia === 'alternativa' ? 'input-readonly' : ''} />
                  </div>
                </div>

                <div className="seccion-comp"><span className="seccion-label">🛒 Adquisición del computador</span></div>
                <div className="form-row triple">
                  <div className="field">
                    <label>Fecha de adquisición</label>
                    <input name="fecha_adquisicion" type="date" value={form.fecha_adquisicion} onChange={handleChange} />
                  </div>
                  <div className="field">
                    <label>Proveedor</label>
                    <input name="proveedor" value={form.proveedor} onChange={handleChange} placeholder="ej: TechStore Ltda." maxLength={100} />
                  </div>
                  <div className="field">
                    <label>Fondo</label>
                    <input name="fondo" value={form.fondo} onChange={handleChange} placeholder="ej: SEP, PIE, Municipal" maxLength={60} />
                  </div>
                </div>
                <div className="form-row triple">
                  <div className="field">
                    <label>N° de factura</label>
                    <input name="numero_factura" value={form.numero_factura} onChange={handleChange} placeholder="ej: FAC-00123" maxLength={30} />
                  </div>
                  <div className="field">
                    <label>N° de orden de compra</label>
                    <input name="numero_orden" value={form.numero_orden} onChange={handleChange} placeholder="ej: OC-2024-001" maxLength={30} />
                  </div>
                  <div className="field">
                    <label>Garantía</label>
                    <input name="garantia" value={form.garantia} onChange={handleChange} placeholder="ej: 1 año, hasta dic 2026" maxLength={60} />
                  </div>
                </div>
                {adquiCF.length > 0 && rows3c(adquiCF).map((row, i) => (
                  <div key={`adq-${i}`} className="form-row triple">{row.map(renderCC)}</div>
                ))}
              </>
            )
          })()}

          {esTecno(form.categoria) && (() => {
            const _catData  = categorias.find(c => c.id === form.categoria)
            const camposCat = _catData?.campos_personalizados ?? []
            const _orden    = _catData?.campos_orden ?? []
            const HEADER_IDS = ['codigo', 'cantidad', 'estado', 'ubicacion', 'responsable']
            const OBS_IDS    = ['obs']
            const EQUIPO_IDS = ['tipo', 'tecnologia', 'marca', 'modelo', 'numero_serie', 'consumible']
            const ADQUI_IDS  = ['proveedor', 'numero_factura', 'fecha_adquisicion', 'numero_orden', 'fondo', 'garantia']
            const allIds     = [...HEADER_IDS, ...EQUIPO_IDS, ...ADQUI_IDS, ...OBS_IDS, ...camposCat.map(c => c.id)]
            const fullOrder  = _orden.length
              ? smartMergeOrder(_orden.filter(id => allIds.includes(id)), allIds)
              : allIds
            const posOf = id => { const p = fullOrder.indexOf(id); return p === -1 ? 9999 : p }
            const firstEquipoPos = Math.min(...EQUIPO_IDS.map(posOf))
            const firstAdquiPos  = Math.min(...ADQUI_IDS.map(posOf))
            const headerCustomFields = camposCat.filter(c => posOf(c.id) < firstEquipoPos).sort((a, b) => posOf(a.id) - posOf(b.id))
            const equipoFields = [
              ...EQUIPO_IDS.map(id => ({ id, _sis: true })),
              ...camposCat.filter(c => posOf(c.id) >= firstEquipoPos && posOf(c.id) < firstAdquiPos).map(c => ({ ...c, _sis: false })),
            ].sort((a, b) => posOf(a.id) - posOf(b.id))
            const adquiFields = [
              ...ADQUI_IDS.map(id => ({ id, _sis: true })),
              ...camposCat.filter(c => posOf(c.id) >= firstAdquiPos).map(c => ({ ...c, _sis: false })),
            ].sort((a, b) => posOf(a.id) - posOf(b.id))
            const renderSis = id => {
              if (id === 'tipo')             return <div key="tipo"             className="field"><label>Tipo</label><ComboField name="tipo" value={form.tipo ?? ''} onChange={handleChange} placeholder="ej: Impresora" maxLength={60} opciones={opsBD.tipo} /></div>
              if (id === 'tecnologia')       return <div key="tecnologia"       className="field"><label>Tecnología</label><ComboField name="tecnologia" value={form.tecnologia ?? ''} onChange={handleChange} placeholder="ej: Láser, Inkjet" maxLength={60} opciones={opsBD.tecnologia} /></div>
              if (id === 'marca')            return <div key="marca"            className="field"><label>Marca</label><ComboField name="marca" value={form.marca ?? ''} onChange={handleChange} placeholder="ej: HP, Epson, Canon" maxLength={50} opciones={opsBD.marca} /></div>
              if (id === 'modelo')           return <div key="modelo"           className="field"><label>Modelo</label><input name="modelo" value={form.modelo ?? ''} onChange={handleChange} placeholder="ej: LaserJet Pro M15w" maxLength={80} /></div>
              if (id === 'numero_serie')     return <div key="numero_serie"     className="field"><label>N° de serie</label><input name="numero_serie" value={form.numero_serie ?? ''} onChange={handleChange} placeholder="ej: SN-ABC123" maxLength={60} /></div>
              if (id === 'consumible')       return <div key="consumible"       className="field"><label>Consumible</label><ComboField name="consumible" value={form.consumible ?? ''} onChange={handleChange} placeholder="ej: Tóner HP 26A" maxLength={100} opciones={opsBD.consumible} /></div>
              if (id === 'proveedor')        return <div key="proveedor"        className="field"><label>Proveedor</label><ComboField name="proveedor" value={form.proveedor ?? ''} onChange={handleChange} placeholder="ej: TechStore Ltda." maxLength={100} opciones={opsBD.proveedor} /></div>
              if (id === 'numero_factura')   return <div key="numero_factura"   className="field"><label>Nº Factura</label><input name="numero_factura" value={form.numero_factura ?? ''} onChange={handleChange} placeholder="ej: FAC-00123" maxLength={30} /></div>
              if (id === 'fecha_adquisicion')return <div key="fecha_adquisicion"className="field"><label>Fecha Factura</label><input name="fecha_adquisicion" type="date" value={form.fecha_adquisicion ?? ''} onChange={handleChange} /></div>
              if (id === 'numero_orden')     return <div key="numero_orden"     className="field"><label>Orden de Compra</label><ComboField name="numero_orden" value={form.numero_orden ?? ''} onChange={handleChange} placeholder="ej: OC-2024-001" maxLength={30} opciones={opsBD.numero_orden} /></div>
              if (id === 'fondo')            return <div key="fondo"            className="field"><label>Fondo</label><ComboField name="fondo" value={form.fondo ?? ''} onChange={handleChange} placeholder="ej: SEP, PIE, Municipal" maxLength={60} opciones={opsBD.fondo} /></div>
              if (id === 'garantia')         return <div key="garantia"         className="field"><label>Garantía</label><input name="garantia" value={form.garantia ?? ''} onChange={handleChange} placeholder="ej: 1 año, hasta dic 2026" maxLength={60} /></div>
              return null
            }
            const renderCampo = campo => (
              <div key={campo.id} className="field">
                <label>{campo.nombre}{campo.requerido && <span style={{ color: '#ef4444', marginLeft: 3 }}>*</span>}</label>
                {campo.tipo === 'texto'    && <input value={camposExtra[campo.id] ?? ''} onChange={e => setCamposExtra(p => ({ ...p, [campo.id]: e.target.value }))} placeholder={campo.nombre} maxLength={200} className={errores[`extra_${campo.id}`] ? 'input-error' : ''} />}
                {campo.tipo === 'numero'   && <input type="number" value={camposExtra[campo.id] ?? ''} onChange={e => setCamposExtra(p => ({ ...p, [campo.id]: e.target.value }))} className={errores[`extra_${campo.id}`] ? 'input-error' : ''} />}
                {campo.tipo === 'fecha'    && <input type="date" value={camposExtra[campo.id] ?? ''} onChange={e => setCamposExtra(p => ({ ...p, [campo.id]: e.target.value }))} className={errores[`extra_${campo.id}`] ? 'input-error' : ''} />}
                {campo.tipo === 'booleano' && <select value={camposExtra[campo.id] ?? ''} onChange={e => setCamposExtra(p => ({ ...p, [campo.id]: e.target.value }))} className={errores[`extra_${campo.id}`] ? 'input-error' : ''}><option value="">— seleccionar —</option><option value="si">Sí</option><option value="no">No</option></select>}
                {campo.tipo === 'select'   && <select value={camposExtra[campo.id] ?? ''} onChange={e => setCamposExtra(p => ({ ...p, [campo.id]: e.target.value }))} className={errores[`extra_${campo.id}`] ? 'input-error' : ''}><option value="">— seleccionar —</option>{(campo.opciones || []).map(op => <option key={op} value={op}>{op}</option>)}</select>}
              </div>
            )
            const rows3 = arr => { const r = []; for (let i = 0; i < arr.length; i += 3) r.push(arr.slice(i, i+3)); return r }
            return (
              <>
                {headerCustomFields.length > 0 && rows3(headerCustomFields).map((row, i) => (
                  <div key={`hdr-${i}`} className="form-row triple">
                    {row.map(f => renderCampo(f))}
                  </div>
                ))}
                <div className="seccion-comp"><span className="seccion-label">🖨️ Datos del equipo</span></div>
                {rows3(equipoFields).map((row, i) => (
                  <div key={i} className="form-row triple">
                    {row.map(f => f._sis ? renderSis(f.id) : renderCampo(f))}
                  </div>
                ))}
                <div className="seccion-comp"><span className="seccion-label">🛒 Adquisición</span></div>
                {rows3(adquiFields).map((row, i) => (
                  <div key={i} className="form-row triple">
                    {row.map(f => f._sis ? renderSis(f.id) : renderCampo(f))}
                  </div>
                ))}
              </>
            )
          })()}

          {!esComp(form.categoria) && !esTecno(form.categoria) && (() => {
            const _catData  = categorias.find(c => c.id === form.categoria)
            const camposCat = _catData?.campos_personalizados ?? []
            const _orden    = _catData?.campos_orden ?? []
            const HEADER_IDS = ['codigo', 'cantidad', 'estado', 'ubicacion', 'responsable']
            const OBS_IDS    = ['obs']
            const ADQUI_IDS  = ['fecha_adquisicion', 'proveedor', 'fondo', 'numero_factura', 'numero_orden', 'garantia']
            const allIds    = [...HEADER_IDS, ...ADQUI_IDS, ...OBS_IDS, ...camposCat.map(c => c.id)]
            const fullOrder = _orden.length
              ? smartMergeOrder(_orden.filter(id => allIds.includes(id)), allIds)
              : allIds
            const posOf = id => { const p = fullOrder.indexOf(id); return p === -1 ? 9999 : p }
            const firstAdquiPos = Math.min(...ADQUI_IDS.map(posOf))
            const headerCustomFields = camposCat.filter(c => posOf(c.id) < firstAdquiPos).sort((a, b) => posOf(a.id) - posOf(b.id))
            const adquiFields = [
              ...ADQUI_IDS.map(id => ({ id, _sis: true })),
              ...camposCat.filter(c => posOf(c.id) >= firstAdquiPos).map(c => ({ ...c, _sis: false })),
            ].sort((a, b) => posOf(a.id) - posOf(b.id))
            const renderSisG = id => {
              if (id === 'fecha_adquisicion') return <div key="fecha_adquisicion" className="field"><label>Fecha de adquisición</label><input name="fecha_adquisicion" type="date" value={form.fecha_adquisicion ?? ''} onChange={handleChange} /></div>
              if (id === 'proveedor')         return <div key="proveedor"         className="field"><label>Proveedor</label><ComboField name="proveedor" value={form.proveedor ?? ''} onChange={handleChange} placeholder="ej: TechStore Ltda." maxLength={100} opciones={opsBD.proveedor} /></div>
              if (id === 'fondo')             return <div key="fondo"             className="field"><label>Fondo</label><ComboField name="fondo" value={form.fondo ?? ''} onChange={handleChange} placeholder="ej: SEP, PIE, Municipal" maxLength={60} opciones={opsBD.fondo} /></div>
              if (id === 'numero_factura')    return <div key="numero_factura"    className="field"><label>N° de factura</label><input name="numero_factura" value={form.numero_factura ?? ''} onChange={handleChange} placeholder="ej: FAC-00123" maxLength={30} /></div>
              if (id === 'numero_orden')      return <div key="numero_orden"      className="field"><label>N° de orden de compra</label><ComboField name="numero_orden" value={form.numero_orden ?? ''} onChange={handleChange} placeholder="ej: OC-2024-001" maxLength={30} opciones={opsBD.numero_orden} /></div>
              if (id === 'garantia')          return <div key="garantia"          className="field"><label>Garantía</label><input name="garantia" value={form.garantia ?? ''} onChange={handleChange} placeholder="ej: 1 año, hasta dic 2026" maxLength={60} /></div>
              return null
            }
            const renderCampoG = campo => (
              <div key={campo.id} className="field">
                <label>{campo.nombre}{campo.requerido && <span style={{ color: '#ef4444', marginLeft: 3 }}>*</span>}</label>
                {campo.tipo === 'texto'    && <input value={camposExtra[campo.id] ?? ''} onChange={e => setCamposExtra(p => ({ ...p, [campo.id]: e.target.value }))} placeholder={campo.nombre} maxLength={200} className={errores[`extra_${campo.id}`] ? 'input-error' : ''} />}
                {campo.tipo === 'numero'   && <input type="number" value={camposExtra[campo.id] ?? ''} onChange={e => setCamposExtra(p => ({ ...p, [campo.id]: e.target.value }))} className={errores[`extra_${campo.id}`] ? 'input-error' : ''} />}
                {campo.tipo === 'fecha'    && <input type="date" value={camposExtra[campo.id] ?? ''} onChange={e => setCamposExtra(p => ({ ...p, [campo.id]: e.target.value }))} className={errores[`extra_${campo.id}`] ? 'input-error' : ''} />}
                {campo.tipo === 'booleano' && <select value={camposExtra[campo.id] ?? ''} onChange={e => setCamposExtra(p => ({ ...p, [campo.id]: e.target.value }))} className={errores[`extra_${campo.id}`] ? 'input-error' : ''}><option value="">— seleccionar —</option><option value="si">Sí</option><option value="no">No</option></select>}
                {campo.tipo === 'select'   && <select value={camposExtra[campo.id] ?? ''} onChange={e => setCamposExtra(p => ({ ...p, [campo.id]: e.target.value }))} className={errores[`extra_${campo.id}`] ? 'input-error' : ''}><option value="">— seleccionar —</option>{(campo.opciones || []).map(op => <option key={op} value={op}>{op}</option>)}</select>}
              </div>
            )
            const rows3G = arr => { const r = []; for (let i = 0; i < arr.length; i += 3) r.push(arr.slice(i, i+3)); return r }
            return (
              <>
                {headerCustomFields.length > 0 && rows3G(headerCustomFields).map((row, i) => (
                  <div key={`hdrg-${i}`} className="form-row triple">
                    {row.map(f => renderCampoG(f))}
                  </div>
                ))}
                <div className="seccion-comp"><span className="seccion-label">🛒 Adquisición</span></div>
                {rows3G(adquiFields).map((row, i) => (
                  <div key={i} className="form-row triple">
                    {row.map(f => f._sis ? renderSisG(f.id) : renderCampoG(f))}
                  </div>
                ))}
              </>
            )
          })()}

          <div className="form-row single">
            <div className="field">
              <label>Observaciones</label>
              <textarea name="obs" value={form.obs} onChange={handleChange} placeholder="Observación adicional..." maxLength={500} />
                  <span style={{ fontSize: "11px", color: form.obs.length > 450 ? "#ef4444" : "#9ca3af", textAlign: "right", display: "block", marginTop: "3px" }}>{form.obs.length}/500</span>
            </div>
          </div>

          <div className="form-actions">
            <button className="btn-cancel" onClick={cancelarForm} disabled={guardando}>Cancelar</button>
            <button className="btn-primary" onClick={guardarBien} disabled={guardando}>
              {guardando ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Guardar bien'}
            </button>
          </div>
            </div>
          )}
        </>
      )}

      {/* Barra selección QR */}
      {modoQR && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: '8px', padding: '8px 14px', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '0.88rem', color: '#1a237e', fontWeight: 600 }}>
            {seleccionQR.size === 0 ? 'Selecciona bienes para imprimir sus QR' : `${seleccionQR.size} seleccionado${seleccionQR.size !== 1 ? 's' : ''}`}
          </span>
          <button
            onClick={() => setSeleccionQR(new Set(filtrados.map(b => b.id)))}
            style={{ padding: '5px 12px', background: '#fff', border: '1px solid #c7d2fe', borderRadius: '6px', cursor: 'pointer', fontSize: '0.82rem', color: '#1a237e', fontWeight: 500 }}
          >Seleccionar todos</button>
          {seleccionQR.size > 0 && <>
            <button
              onClick={() => abrirQRMultiple(filtrados.filter(b => seleccionQR.has(b.id)))}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 14px', background: '#1a237e', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}
            >🖨 Imprimir {seleccionQR.size} QR</button>
            <button
              onClick={() => setSeleccionQR(new Set())}
              style={{ padding: '5px 10px', background: '#fff', border: '1px solid #c7d2fe', borderRadius: '6px', cursor: 'pointer', fontSize: '0.82rem', color: '#6b7280' }}
            >Limpiar</button>
          </>}
        </div>
      )}

      {/* Barra selección múltiple */}
      {puedeEliminarLote && seleccion.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '8px 14px', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '0.88rem', color: '#1d4ed8', fontWeight: 600 }}>
            {seleccion.size} seleccionado{seleccion.size !== 1 ? 's' : ''}
          </span>
          <button onClick={eliminarSeleccionados} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
            🗑 Eliminar seleccionados
          </button>
          <button onClick={() => setSeleccion(new Set())} style={{ padding: '5px 10px', background: 'white', border: '1px solid #bfdbfe', borderRadius: '6px', cursor: 'pointer', fontSize: '0.82rem', color: '#6b7280' }}>
            Cancelar
          </button>
        </div>
      )}

      {/* Tabla */}
      {filtrados.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📭</div>
          <p>{hayFiltrosActivos ? 'No hay resultados para estos filtros' : 'No hay bienes registrados en esta categoría'}</p>
          {!hayFiltrosActivos && puedeAgregar && <button className="btn-add" style={{ marginTop: '1rem' }} onClick={abrirFormNuevo}>+ Agregar el primer bien</button>}
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {modoQR && (
                  <th style={{ width: '36px' }}>
                    <input
                      type="checkbox"
                      checked={seleccionQR.size === filtrados.length && filtrados.length > 0}
                      ref={el => { if (el) el.indeterminate = seleccionQR.size > 0 && seleccionQR.size < filtrados.length }}
                      onChange={() => setSeleccionQR(seleccionQR.size === filtrados.length ? new Set() : new Set(filtrados.map(b => b.id)))}
                      style={{ cursor: 'pointer', width: '15px', height: '15px', accentColor: '#1a237e' }}
                    />
                  </th>
                )}
                {puedeEliminarLote && !modoQR && (
                  <th style={{ width: '36px' }}>
                    <input
                      type="checkbox"
                      checked={seleccion.size === filtrados.length && filtrados.length > 0}
                      ref={el => { if (el) el.indeterminate = seleccion.size > 0 && seleccion.size < filtrados.length }}
                      onChange={toggleTodos}
                      style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                    />
                  </th>
                )}
                <th>Código</th>
                <th>Nombre</th>
                {catActual === 'todos'        && <th className="th-hide-mobile">Categoría</th>}
                {catActual === 'computadores' && <><th className="th-hide-mobile">Tipo</th><th className="th-hide-mobile">Marca / Modelo</th><th className="th-hide-mobile">CPU</th><th className="th-hide-mobile">RAM</th><th className="th-hide-mobile">SO</th></>}
                {catActual !== 'computadores' && <th className="th-hide-mobile">Cant.</th>}
                <th>Estado</th>
                <th className="th-hide-mobile">Ubicación</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtradosPagInv.map(b => (
                <tr key={b.id} className={`${editandoId === b.id ? 'fila-editando' : ''} ${seleccion.has(b.id) ? 'fila-seleccionada' : ''} ${seleccionQR.has(b.id) ? 'fila-seleccionada' : ''}`} style={esVencido(b.id) ? { background: '#fff1f2', borderLeft: '3px solid #ef4444' } : bienesConPrestamo.has(b.id) ? { background: '#fff7ed', borderLeft: '3px solid #f97316' } : {}}>
                  {modoQR && (
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={seleccionQR.has(b.id)}
                        onChange={() => toggleQRItem(b.id)}
                        style={{ cursor: 'pointer', width: '15px', height: '15px', accentColor: '#1a237e' }}
                      />
                    </td>
                  )}
                  {puedeEliminarLote && !modoQR && (
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={seleccion.has(b.id)}
                        onChange={() => toggleSeleccion(b.id)}
                        style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                      />
                    </td>
                  )}
                  <td className="td-code">{b.codigo}</td>
                  <td className="td-name">
                    {b.nombre}
                    {esVencido(b.id) && (
                      <span title="Préstamo vencido" style={{
                        fontSize: 10, background: '#fee2e2', color: '#b91c1c',
                        borderRadius: 4, padding: '1px 6px', marginLeft: 6,
                        fontWeight: 700, verticalAlign: 'middle',
                      }}>⚠️ Vencido</span>
                    )}
                    {bienesConPrestamo.has(b.id) && !esVencido(b.id) && (
                      <span title="Bien prestado" style={{
                        fontSize: 10, background: '#fef9c3', color: '#854d0e',
                        borderRadius: 4, padding: '1px 6px', marginLeft: 6,
                        fontWeight: 700, verticalAlign: 'middle',
                      }}>📤 Prestado</span>
                    )}
                    {b._pendiente && (
                      <span style={{
                        fontSize: 10, background: '#fef3c7', color: '#92400e',
                        borderRadius: 4, padding: '1px 6px', marginLeft: 6,
                        fontWeight: 700, verticalAlign: 'middle',
                      }}>⏳ Pendiente</span>
                    )}
                    {b.numero_serie && <div className="td-sub">S/N: {b.numero_serie}</div>}
                    {/* Info extra visible solo en móvil */}
                    <div className="td-mobile-extra">
                      {b.ubicacion && <span>{b.ubicacion}</span>}
                      {catActual === 'todos' && b.categoria && <span>{getCatLabel(b.categoria)}</span>}
                      {catActual === 'computadores' && b.marca && <span>{b.marca}{b.modelo ? ` ${b.modelo}` : ''}</span>}
                    </div>
                  </td>
                  {catActual === 'todos'        && <td className="td-muted td-hide-mobile">{getCatLabel(b.categoria)}</td>}
                  {catActual === 'computadores' && (
                    <>
                      <td className="td-muted td-hide-mobile">{b.tipo ?? '—'}</td>
                      <td className="td-hide-mobile">
                        <span style={{ fontWeight: 600, fontSize: '13px' }}>{b.marca ?? '—'}</span>
                        {b.modelo && <div className="td-sub">{b.modelo}</div>}
                      </td>
                      <td className="td-muted td-trunc td-hide-mobile">{b.cpu ?? '—'}</td>
                      <td className="td-muted td-hide-mobile">{b.ram ?? '—'}</td>
                      <td className="td-muted td-hide-mobile">{b.sistema_operativo ?? '—'}</td>
                    </>
                  )}
                  {catActual !== 'computadores' && <td className="td-hide-mobile">{b.cantidad}</td>}
                  <td><span className={`badge ${ESTADO_BADGE[b.estado] ?? ''}`}>{b.estado}</span></td>
                  <td className="td-muted td-hide-mobile">{b.ubicacion}</td>
                  <td>
                    <div className="acciones">
                      {!b._pendiente && <button className="btn-ver" onClick={() => setVerDetalle(verDetalle?.id === b.id ? null : b)} title="Ver detalle">👁</button>}
                      {(permisos.editar_bien) && !b._pendiente && <button className="btn-edit" onClick={() => abrirFormEditar(b)} title="Editar">✏️</button>}
                      {puedeIncidencias && !b._pendiente && (esComp(b.categoria) || esTecno(b.categoria)) && (
                        <button className="btn-ver" title="Incidencias" style={{ fontSize: 14 }}
                          onClick={() => setModalIncidencias(b)}>🔧</button>
                      )}
                      {puedePrestamo && !b._pendiente && (
                        <button
                          className="btn-ver"
                          title={bienesConPrestamo.has(b.id) ? 'Ver préstamo activo' : 'Registrar préstamo'}
                          style={{ fontSize: 14, opacity: bienesConPrestamo.has(b.id) ? 1 : 0.55 }}
                          onClick={() => setModalPrestamo(b)}
                        >📤</button>
                      )}
                      {puedeEliminar && !b._pendiente && <button className="btn-del" onClick={() => eliminarBien(b.id)} title="Eliminar">✕</button>}
                      {b._pendiente && (
                        <button className="btn-del" title="Cancelar (quitar pendiente)"
                          onClick={() => { eliminarPendiente(b.id); setBienes(prev => prev.filter(x => x.id !== b.id)) }}>
                          ✕
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginación inventario */}
      {totalPagsInv > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 0', flexWrap: 'wrap' }}>
          <button onClick={() => setPaginaInv(1)} disabled={paginaInv === 1} style={pBtnInv(paginaInv === 1)}>«</button>
          <button onClick={() => setPaginaInv(p => p - 1)} disabled={paginaInv === 1} style={pBtnInv(paginaInv === 1)}>‹ Ant.</button>
          <span style={{ fontSize: 12, color: '#6b7280', padding: '0 6px' }}>Pág. {paginaInv} / {totalPagsInv} · {filtrados.length} bienes</span>
          <button onClick={() => setPaginaInv(p => p + 1)} disabled={paginaInv >= totalPagsInv} style={pBtnInv(paginaInv >= totalPagsInv)}>Sig. ›</button>
          <button onClick={() => setPaginaInv(totalPagsInv)} disabled={paginaInv >= totalPagsInv} style={pBtnInv(paginaInv >= totalPagsInv)}>»</button>
        </div>
      )}

      {/* Ficha de detalle — modal */}
      {verDetalle && (
        <div className="modal-overlay" onClick={() => setVerDetalle(null)}>
          <div className="modal modal-detalle" onClick={e => e.stopPropagation()}>

            <div id="detalle-pdf-content" style={{ background: '#ffffff' }}>

            {/* Header */}
            <div className="detalle-header-modal">
              <div className="detalle-titulo-wrap">
                <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>{categorias.find(c => c.id === verDetalle.categoria)?.icon}</span>
                <div className="detalle-titulo-text">
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '1.05rem', color: '#111827', overflowWrap: 'break-word', wordBreak: 'break-word' }}>{verDetalle.nombre}</p>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#6b7280' }}>{verDetalle.codigo} · {getCatLabel(verDetalle.categoria)}</p>
                </div>
              </div>
              <div className="detalle-header-actions">
                <span className={`badge ${ESTADO_BADGE[verDetalle.estado]}`}>{verDetalle.estado}</span>
<button className="btn-descargar-pdf" onClick={() => abrirQR(verDetalle)} title="Generar QR">▦ QR</button>
<button className="btn-descargar-pdf" onClick={descargarPDF}>⬇ <span className="pdf-label">Descargar </span>PDF</button>
                {puedeIncidencias && (esComp(verDetalle.categoria) || esTecno(verDetalle.categoria)) && (
                  <button className="btn-descargar-pdf" onClick={() => { setVerDetalle(null); setModalIncidencias(verDetalle) }} title="Incidencias">🔧 Incidencias</button>
                )}
                <button className="btn-cerrar-detalle" onClick={() => setVerDetalle(null)}>✕</button>
              </div>
            </div>

            {/* Fila 1: Identificación + Asignación */}
            <div className="detalle-grid-2">
              <div className="detalle-seccion">
                <p className="detalle-titulo">Identificación</p>
                <div className="detalle-fila"><span>Código</span><strong>{verDetalle.codigo}</strong></div>
                <div className="detalle-fila"><span>Categoría</span><strong>{getCatLabel(verDetalle.categoria)}</strong></div>
                {!esComp(verDetalle.categoria) && <div className="detalle-fila"><span>Cantidad</span><strong>{verDetalle.cantidad}</strong></div>}
              </div>
              <div className="detalle-seccion">
                <p className="detalle-titulo">Asignación</p>
                <div className="detalle-fila"><span>Ubicación</span><strong>{verDetalle.ubicacion || 'N/A'}</strong></div>
                <div className="detalle-fila"><span>Responsable</span><strong>{verDetalle.responsable || 'N/A'}</strong></div>
              </div>
            </div>

            {/* Igual que en el formulario: mostrar texto libre antes de adquisición */}
            {verDetalle.descripcion && (
              <div className="detalle-obs">
                <p className="detalle-titulo">Descripción</p>
                <p className="detalle-obs-texto">{verDetalle.descripcion}</p>
              </div>
            )}
            {verDetalle.obs && (
              <div className="detalle-obs">
                <p className="detalle-titulo">Observaciones</p>
                <p className="detalle-obs-texto">{verDetalle.obs}</p>
              </div>
            )}

            {(() => {
              const _catData  = categorias.find(c => c.id === verDetalle.categoria)
              const camposCat = _catData?.campos_personalizados ?? []
              const extra     = verDetalle.campos_extra || {}
              const _orden    = _catData?.campos_orden ?? []
              const ordenados = _orden.length
                ? [...camposCat].sort((a, b) => {
                    const ia = _orden.indexOf(a.id), ib = _orden.indexOf(b.id)
                    if (ia === -1 && ib === -1) return 0
                    if (ia === -1) return 1; if (ib === -1) return -1
                    return ia - ib
                  })
                : camposCat
              const conValor = ordenados.filter(c => extra[c.id] !== undefined && extra[c.id] !== '')
              if (!conValor.length) return null
              return (
                <div className="detalle-seccion">
                  <p className="detalle-titulo">✨ Campos adicionales</p>
                  <div className="detalle-grid-3">
                    {conValor.map(campo => (
                      <div key={campo.id} className="detalle-campo">
                        <span>{campo.nombre}</span>
                        <strong>{campo.tipo === 'booleano' ? (extra[campo.id] === 'si' ? 'Sí' : 'No') : extra[campo.id]}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {esTecno(verDetalle.categoria) && (
              <>
                <div className="detalle-seccion">
                  <p className="detalle-titulo">🖨️ Equipo</p>
                  <div className="detalle-grid-3">
                    {[
                      ['Tipo', verDetalle.tipo],
                      ['Marca', verDetalle.marca],
                      ['Modelo', verDetalle.modelo],
                      ['N° Serie', verDetalle.numero_serie],
                      ['Tecnología', verDetalle.tecnologia],
                      ['Consumible', verDetalle.consumible],
                    ].map(([label, val]) => val ? (
                      <div key={label} className="detalle-campo">
                        <span>{label}</span>
                        <strong>{val}</strong>
                      </div>
                    ) : null)}
                  </div>
                </div>
                <div className="detalle-seccion">
                  <p className="detalle-titulo">🛒 Adquisición</p>
                  <div className="detalle-grid-3">
                    {[
                      ['Fecha', verDetalle.fecha_adquisicion],
                      ['Proveedor', verDetalle.proveedor],
                      ['N° Factura', verDetalle.numero_factura],
                      ['N° Orden', verDetalle.numero_orden],
                      ['Fondo', verDetalle.fondo],
                      ['Garantía', verDetalle.garantia],
                    ].map(([label, val]) => (
                      <div key={label} className="detalle-campo">
                        <span>{label}</span>
                        <strong>{val || '—'}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {esBiblioteca(verDetalle.categoria) && (
              <>
                <div className="detalle-seccion">
                  <p className="detalle-titulo">📚 Datos bibliográficos</p>
                  <div className="detalle-grid-3">
                    {[
                      ['ISBN', verDetalle.isbn],
                      ['Autor', verDetalle.autor],
                      ['Género', verDetalle.genero],
                    ].map(([label, val]) => (
                      <div key={label} className="detalle-campo">
                        <span>{label}</span>
                        <strong>{val || 'N/A'}</strong>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="detalle-seccion">
                  <p className="detalle-titulo">🛒 Adquisición</p>
                  <div className="detalle-grid-3">
                    {[
                      ['Fecha', verDetalle.fecha_adquisicion],
                      ['Proveedor', verDetalle.proveedor],
                      ['N° Factura', verDetalle.numero_factura],
                      ['N° Orden', verDetalle.numero_orden],
                      ['Fondo', verDetalle.fondo],
                      ['Garantía', verDetalle.garantia],
                    ].map(([label, val]) => (
                      <div key={label} className="detalle-campo">
                        <span>{label}</span>
                        <strong>{val || 'N/A'}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {!esComp(verDetalle.categoria) && !esTecno(verDetalle.categoria) && !esBiblioteca(verDetalle.categoria) && (
              <>
                <div className="detalle-seccion">
                  <p className="detalle-titulo">🧾 Detalle del bien</p>
                  <div className="detalle-grid-3">
                    {[
                      ['Nombre', verDetalle.nombre],
                      ['Código', verDetalle.codigo],
                      ['Cantidad', verDetalle.cantidad],
                      ['Estado', verDetalle.estado],
                    ].map(([label, val]) => (
                      <div key={label} className="detalle-campo">
                        <span>{label}</span>
                        <strong>{val || 'N/A'}</strong>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="detalle-seccion">
                  <p className="detalle-titulo">🛒 Adquisición</p>
                  <div className="detalle-grid-3">
                    {[
                      ['Fecha', verDetalle.fecha_adquisicion],
                      ['Proveedor', verDetalle.proveedor],
                      ['N° Factura', verDetalle.numero_factura],
                      ['N° Orden', verDetalle.numero_orden],
                      ['Fondo', verDetalle.fondo],
                      ['Garantía', verDetalle.garantia],
                    ].map(([label, val]) => (
                      <div key={label} className="detalle-campo">
                        <span>{label}</span>
                        <strong>{val || 'N/A'}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {esComp(verDetalle.categoria) && (<>

              {/* Hardware */}
              <div className="detalle-seccion">
                <p className="detalle-titulo">Hardware</p>
                <div className="detalle-grid-3">
                  {[
                    ['Tipo', verDetalle.tipo],
                    ['Marca', verDetalle.marca],
                    ['Modelo', verDetalle.modelo],
                    ['Pantalla', verDetalle.pantalla],
                    ['N° Serie', verDetalle.numero_serie],
                    ['CPU', verDetalle.cpu],
                    ['RAM', [verDetalle.ram, verDetalle.ram_tipo, verDetalle.ram_slots ? verDetalle.ram_slots + ' slot(s)' : ''].filter(Boolean).join(' · ')],
                    ['Almacenamiento', verDetalle.tipo_almacenamiento ? (verDetalle.tipo_almacenamiento + ' ' + (verDetalle.memoria || '')).trim() : verDetalle.memoria],
                    ['Sistema operativo', verDetalle.sistema_operativo],
                  ].map(([label, val]) => (
                    <div key={label} className="detalle-campo">
                      <span>{label}</span>
                      <strong>{val || 'N/A'}</strong>
                    </div>
                  ))}
                </div>
              </div>

              {/* Licencias */}
              <div className="detalle-grid-2">
                <div className="detalle-seccion">
                  <p className="detalle-titulo">🪟 Licencia Windows</p>
                  <div className="detalle-fila"><span>Clave</span><strong className="mono-small">{verDetalle.licencia_windows || 'N/A'}</strong></div>
                  <div className="detalle-fila"><span>Versión</span><strong>{verDetalle.win_version || 'N/A'}</strong></div>
                  <div className="detalle-fila"><span>Proveedor</span><strong>{verDetalle.win_proveedor || 'N/A'}</strong></div>
                  <div className="detalle-fila"><span>N° Factura</span><strong>{verDetalle.win_factura || 'N/A'}</strong></div>
                  <div className="detalle-fila"><span>Fecha factura</span><strong>{verDetalle.win_fecha_factura || 'N/A'}</strong></div>
                  <div className="detalle-fila"><span>N° Orden</span><strong>{verDetalle.win_orden || 'N/A'}</strong></div>
                </div>
                <div className="detalle-seccion">
                  <p className="detalle-titulo">📊 Licencia Office</p>
                  <div className="detalle-fila"><span>Clave</span><strong className="mono-small">{verDetalle.licencia_office || 'N/A'}</strong></div>
                  <div className="detalle-fila"><span>Versión</span><strong>{verDetalle.off_version || 'N/A'}</strong></div>
                  <div className="detalle-fila"><span>Proveedor</span><strong>{verDetalle.off_proveedor || 'N/A'}</strong></div>
                  <div className="detalle-fila"><span>N° Factura</span><strong>{verDetalle.off_factura || 'N/A'}</strong></div>
                  <div className="detalle-fila"><span>Fecha factura</span><strong>{verDetalle.off_fecha_factura || 'N/A'}</strong></div>
                  <div className="detalle-fila"><span>N° Orden</span><strong>{verDetalle.off_orden || 'N/A'}</strong></div>
                </div>
              </div>

              {/* Adquisición */}
              <div className="detalle-seccion">
                <p className="detalle-titulo">Adquisición</p>
                <div className="detalle-grid-3">
                  {[
                    ['Fecha', verDetalle.fecha_adquisicion],
                    ['Proveedor', verDetalle.proveedor],
                    ['N° Factura', verDetalle.numero_factura],
                    ['N° Orden', verDetalle.numero_orden],
                    ['Fondo', verDetalle.fondo],
                    ['Garantía', verDetalle.garantia],
                  ].map(([label, val]) => (
                    <div key={label} className="detalle-campo">
                      <span>{label}</span>
                      <strong>{val || 'N/A'}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </>)}


            </div>{/* fin detalle-pdf-content */}

          </div>
        </div>
      )}

      {/* Modal préstamo */}
      {modalPrestamo && (
        <div className="modal-overlay" onClick={cerrarModalPrestamo}>
          <div className="modal" style={{ maxWidth: 460, width: '94%' }} onClick={e => e.stopPropagation()}>
            <div style={{ marginBottom: 18 }}>
              <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 16, color: '#1a237e' }}>
                📤 {prestamoBien ? 'Préstamo activo' : 'Registrar préstamo'}
              </p>
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{modalPrestamo.nombre} · {modalPrestamo.codigo}</p>
            </div>

            {cargandoPrestamo && <p style={{ fontSize: 13, color: '#9ca3af' }}>Cargando…</p>}

            {!cargandoPrestamo && prestamoBien && (
              <>
                <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 10, padding: '14px 16px', marginBottom: 18 }}>
                  <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 15, color: '#92400e' }}>
                    {prestamoBien.prestado_a}
                    {prestamoBien.cargo && <span style={{ fontWeight: 400, fontSize: 12, color: '#a16207', marginLeft: 8 }}>· {prestamoBien.cargo}</span>}
                  </p>
                  <p style={{ margin: '0 0 4px', fontSize: 13, color: '#78350f' }}>
                    Devolución: <strong>{new Date(prestamoBien.fecha_devolucion_esperada + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
                    {(() => {
                      const dias = Math.round((new Date(prestamoBien.fecha_devolucion_esperada + 'T12:00:00') - new Date()) / 86400000)
                      return dias < 0
                        ? <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: '#dc2626', background: '#fee2e2', padding: '1px 7px', borderRadius: 20 }}>Vencido hace {Math.abs(dias)} día{Math.abs(dias) !== 1 ? 's' : ''}</span>
                        : dias === 0
                        ? <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: '#d97706', background: '#fef3c7', padding: '1px 7px', borderRadius: 20 }}>Vence hoy</span>
                        : <span style={{ marginLeft: 8, fontSize: 11, color: '#78350f' }}>({dias} día{dias !== 1 ? 's' : ''})</span>
                    })()}
                  </p>
                  {prestamoBien.notas && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#a16207' }}>📝 {prestamoBien.notas}</p>}
                  <p style={{ margin: '6px 0 0', fontSize: 11, color: '#b45309' }}>Registrado por {prestamoBien.registrado_por_nombre}</p>
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button onClick={cerrarModalPrestamo} style={{ padding: '8px 18px', background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#6b7280' }}>Cerrar</button>
                  <button onClick={async () => { await marcarDevuelto(); cerrarModalPrestamo() }} style={{ padding: '8px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>✓ Marcar devuelto</button>
                </div>
              </>
            )}

            {!cargandoPrestamo && !prestamoBien && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 14px' }}>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Prestado a *</label>
                    <input autoFocus value={formPrestamo.prestado_a} onChange={e => setFormPrestamo(p => ({ ...p, prestado_a: e.target.value }))} placeholder="ej: Prof. García" style={{ width: '100%', padding: '8px 11px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Cargo</label>
                    <input value={formPrestamo.cargo} onChange={e => setFormPrestamo(p => ({ ...p, cargo: e.target.value }))} placeholder="ej: Profesor de Matemáticas" style={{ width: '100%', padding: '8px 11px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Fecha devolución *</label>
                    <input type="date" value={formPrestamo.fecha_devolucion_esperada} min={new Date().toISOString().slice(0, 10)} onChange={e => setFormPrestamo(p => ({ ...p, fecha_devolucion_esperada: e.target.value }))} style={{ width: '100%', padding: '8px 11px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }} />
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Notas</label>
                    <input value={formPrestamo.notas} onChange={e => setFormPrestamo(p => ({ ...p, notas: e.target.value }))} placeholder="ej: Usar en sala 3B hasta el viernes" style={{ width: '100%', padding: '8px 11px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
                  <button onClick={cerrarModalPrestamo} style={{ padding: '8px 18px', background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#6b7280' }}>Cancelar</button>
                  <button onClick={registrarPrestamo} disabled={guardandoPrestamo || !formPrestamo.prestado_a.trim() || !formPrestamo.fecha_devolucion_esperada} style={{ padding: '8px 20px', background: '#1a237e', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, opacity: guardandoPrestamo ? 0.6 : 1 }}>
                    {guardandoPrestamo ? 'Guardando…' : 'Guardar préstamo'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal aviso */}
      {aviso && (
        <div className="modal-overlay" onClick={() => setAviso(null)}>
          <div className="modal modal-confirm" onClick={e => e.stopPropagation()}>
            <div className="confirm-icon">⚠️</div>
            <p className="modal-title">{aviso}</p>
            <div className="form-actions" style={{ justifyContent: 'center', marginTop: '1.5rem' }}>
              <button className="btn-primary" onClick={() => setAviso(null)}>Entendido</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmación */}
      {confirmar && (
        <div className="modal-overlay" onClick={() => setConfirmar(null)}>
          <div className="modal modal-confirm" onClick={e => e.stopPropagation()}>
            <div className="confirm-icon">🗑️</div>
            <p className="modal-title">{confirmar.mensaje}</p>
            <p className="confirm-sub">Esta acción no se puede deshacer.</p>
            <div className="form-actions" style={{ justifyContent: 'center', gap: '12px', marginTop: '1.5rem' }}>
              <button className="btn-cancel btn-confirm-cancel" onClick={() => setConfirmar(null)}>Cancelar</button>
              <button className="btn-danger" onClick={() => { confirmar.onOk(); setConfirmar(null) }}>Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar categoría */}
      {editCat && (
        <div className="modal-overlay" onClick={() => setEditCat(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <p className="modal-title">Editar categoría</p>
            <div className="field" style={{ marginBottom: '12px' }}>
              <label>Nombre *</label>
              <input
                value={editCat.label}
                onChange={e => { setEditCat(p => ({ ...p, label: e.target.value })); setErrorEditCat(false) }} maxLength={40}
                className={errorEditCat ? 'input-error' : ''}
                autoFocus
              />
              {errorEditCat && <span className="error-msg">El nombre es obligatorio</span>}
            </div>
            <div className="field" style={{ marginBottom: '16px' }}>
              <label>Icono</label>
              <div className="iconos-grid">
                {ICONOS.map(ic => (
                  <button key={ic} className={`btn-icono ${editCat.icon === ic ? 'selected' : ''}`} onClick={() => setEditCat(p => ({ ...p, icon: ic }))}>{ic}</button>
                ))}
              </div>
            </div>
            <div className="form-actions">
              <button className="btn-cancel" onClick={() => setEditCat(null)}>Cancelar</button>
              <button className="btn-primary" onClick={guardarEditCat}>Guardar cambios</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nueva categoría */}
      {modalCat && (
        <div className="modal-overlay" onClick={() => setModalCat(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <p className="modal-title">Nueva categoría</p>
            <div className="field" style={{ marginBottom: '12px' }}>
              <label>Nombre *</label>
              <input value={nuevaCat.label} onChange={e => { setNuevaCat(p => ({ ...p, label: e.target.value })); setErrorCat(false) }} placeholder="ej: Laboratorio" maxLength={40} className={errorCat ? 'input-error' : ''} autoFocus />
              {errorCat && <span className="error-msg">El nombre es obligatorio</span>}
            </div>
            <div className="field" style={{ marginBottom: '16px' }}>
              <label>Icono</label>
              <div className="iconos-grid">
                {ICONOS.map(ic => (
                  <button key={ic} className={`btn-icono ${nuevaCat.icon === ic ? 'selected' : ''}`} onClick={() => setNuevaCat(p => ({ ...p, icon: ic }))}>{ic}</button>
                ))}
              </div>
            </div>
            <div className="form-actions">
              <button className="btn-cancel" onClick={() => setModalCat(false)}>Cancelar</button>
              <button className="btn-primary" onClick={guardarCategoria}>Crear categoría</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Incidencias */}
      {modalIncidencias && (
        <ModalIncidencias
          bien={modalIncidencias}
          usuario={usuario}
          onCerrar={() => setModalIncidencias(null)}
        />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// Modal de Incidencias
// ══════════════════════════════════════════════════════════════════════════
function ModalIncidencias({ bien, usuario, onCerrar }) {
  const [incidencias,    setIncidencias]    = useState([])
  const [cargando,       setCargando]       = useState(true)
  const [titulo,         setTitulo]         = useState('')
  const [descripcion,    setDescripcion]    = useState('')
  const [fecha,          setFecha]          = useState(() => new Date().toISOString().slice(0, 10))
  const [guardando,      setGuardando]      = useState(false)
  const [error,          setError]          = useState('')
  const [eliminandoId,   setEliminandoId]   = useState(null)
  const [confirmDelete,  setConfirmDelete]  = useState(null) // { id, titulo }
  const [editandoId,     setEditandoId]     = useState(null)

  const esAdmin = usuario?.rol === 'admin' || usuario?.rol === 'editor'

  useEffect(() => { cargar() }, [bien.id]) // eslint-disable-line

  async function cargar() {
    setCargando(true)
    const { data } = await supabase
      .from('incidencias')
      .select('*, usuarios(nombre)')
      .eq('bien_id', bien.id)
      .order('fecha', { ascending: false })
      .order('creado_en', { ascending: false })
    setIncidencias(data || [])
    setCargando(false)
  }

  async function guardar(e) {
    e.preventDefault()
    if (!titulo.trim()) { setError('El título es obligatorio'); return }
    setGuardando(true); setError('')
    if (editandoId) {
      const { error: err } = await supabase.from('incidencias').update({
        titulo:      titulo.trim(),
        descripcion: descripcion.trim() || null,
        fecha,
      }).eq('id', editandoId)
      setGuardando(false)
      if (err) { setError('Error al actualizar: ' + err.message); return }
    } else {
      const { error: err } = await supabase.from('incidencias').insert({
        bien_id:     bien.id,
        titulo:      titulo.trim(),
        descripcion: descripcion.trim() || null,
        fecha,
        creado_por:  usuario?.id,
      })
      setGuardando(false)
      if (err) { setError('Error al guardar: ' + err.message); return }
    }
    cancelarEdicion()
    cargar()
  }

  function iniciarEdicion(inc) {
    setEditandoId(inc.id)
    setTitulo(inc.titulo)
    setDescripcion(inc.descripcion || '')
    setFecha(inc.fecha)
    setError('')
  }

  function cancelarEdicion() {
    setEditandoId(null)
    setTitulo(''); setDescripcion(''); setFecha(new Date().toISOString().slice(0, 10))
    setError('')
  }

  async function confirmarEliminar() {
    const id = confirmDelete.id
    setConfirmDelete(null)
    if (editandoId === id) cancelarEdicion()
    setEliminandoId(id)
    const { error: err } = await supabase.from('incidencias').delete().eq('id', id)
    if (!err) {
      setIncidencias(prev => prev.filter(i => i.id !== id))
    } else {
      setError('Error al eliminar la incidencia')
      cargar()
    }
    setEliminandoId(null)
  }

  const ovl = { position: 'fixed', inset: 0, background: 'rgba(5,12,55,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }
  const mod = { background: '#fff', borderRadius: 14, padding: '24px 26px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }

  return (
    <div style={ovl} onClick={onCerrar}>
      <div style={mod} onClick={e => e.stopPropagation()}>

        {/* Cabecera */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <p style={{ margin: '0 0 2px', fontWeight: 800, fontSize: 15, color: '#111827' }}>🔧 Incidencias</p>
            <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{bien.nombre} · {bien.codigo}</p>
          </div>
          <button onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#6b7280', lineHeight: 1, flexShrink: 0 }}>✕</button>
        </div>

        {/* Formulario nueva / editar incidencia */}
        <form onSubmit={guardar} style={{ background: editandoId ? '#fffbeb' : '#f0f4ff', border: `1.5px solid ${editandoId ? '#fcd34d' : '#c7d2fe'}`, borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: editandoId ? '#d97706' : '#6366f1', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            {editandoId ? '✏️ Editando incidencia' : 'Nueva incidencia'}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Título de la incidencia *"
              style={{ flex: '1 1 200px', padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${editandoId ? '#fcd34d' : '#c7d2fe'}`, fontSize: 13, outline: 'none', minWidth: 0 }} />
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
              style={{ padding: '8px 10px', borderRadius: 8, border: `1.5px solid ${editandoId ? '#fcd34d' : '#c7d2fe'}`, fontSize: 13, outline: 'none' }} />
          </div>
          <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Descripción opcional (qué se hizo, qué se encontró...)" rows={2}
            style={{ padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${editandoId ? '#fcd34d' : '#c7d2fe'}`, fontSize: 13, resize: 'vertical', outline: 'none', fontFamily: 'inherit' }} />
          {error && <p style={{ margin: 0, fontSize: 12, color: '#dc2626' }}>⚠️ {error}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            {editandoId && (
              <button type="button" onClick={cancelarEdicion}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1.5px solid #d1d5db', background: '#fff', color: '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancelar
              </button>
            )}
            <button type="submit" disabled={guardando}
              style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: editandoId ? '#d97706' : '#6366f1', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {guardando ? 'Guardando…' : editandoId ? 'Actualizar' : '+ Registrar'}
            </button>
          </div>
        </form>

        {/* Lista de incidencias */}
        <div>
          <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Historial ({incidencias.length})
          </p>
          {cargando ? (
            <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Cargando…</p>
          ) : incidencias.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Sin incidencias registradas</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {incidencias.map(inc => (
                <div key={inc.id} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: 13, color: '#111827', wordBreak: 'break-word' }}>{inc.titulo}</p>
                      <p style={{ margin: '0 0 4px', fontSize: 11, color: '#9ca3af' }}>
                        {new Date(inc.fecha + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}
                        {inc.usuarios?.nombre && <span> · {inc.usuarios.nombre}</span>}
                      </p>
                      {inc.descripcion && <p style={{ margin: 0, fontSize: 12, color: '#4b5563', lineHeight: 1.5 }}>{inc.descripcion}</p>}
                    </div>
                    {esAdmin && (
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button onClick={() => iniciarEdicion(inc)} disabled={!!editandoId}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a3a3a3', fontSize: 13, lineHeight: 1, padding: 4 }}
                          title="Editar incidencia">✏️</button>
                        <button onClick={() => setConfirmDelete({ id: inc.id, titulo: inc.titulo })} disabled={eliminandoId === inc.id || editandoId === inc.id}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fca5a5', fontSize: 14, lineHeight: 1, padding: 4 }}
                          title="Eliminar incidencia">
                          {eliminandoId === inc.id ? '…' : '✕'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal confirmación borrar */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,12,55,0.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}
          onClick={() => setConfirmDelete(null)}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '24px 28px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', maxWidth: 380, width: '90%', display: 'flex', flexDirection: 'column', gap: 16 }}
            onClick={e => e.stopPropagation()}>
            <div>
              <p style={{ margin: '0 0 6px', fontWeight: 800, fontSize: 15, color: '#111827' }}>¿Eliminar incidencia?</p>
              <p style={{ margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
                Se eliminará "<strong>{confirmDelete.titulo}</strong>" de forma permanente. Esta acción no se puede deshacer.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDelete(null)}
                style={{ padding: '8px 18px', borderRadius: 8, border: '1.5px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={confirmarEliminar}
                style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}