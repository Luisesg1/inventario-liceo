import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import './Inventario.css'
import ImportarCSV from './ImportarCSV'
import './ImportarCSV.css'

const ESTADO_BADGE = { Bueno: 'badge-bueno', Regular: 'badge-regular', Malo: 'badge-malo', Baja: 'badge-baja' }
const ICONOS = ['📦','🪑','📚','📖','🖨️','💻','🖥️','🖱️','📷','📱','🔧','🗂️','🗃️','🖼️','🏫','⚗️','🎨','🎒','🔬','🪞','⚽','🏀','🏐','🏈','🎾','🏓','🏸','🥊','🏋️','🎽','🏊','🤸','🎭','🎵','🔭','🧪','🖊️','📐','📏','🗑️']

const formVacio = {
  nombre: '', categoria: '', codigo: '', cantidad: 1,
  estado: 'Bueno', ubicacion: '', responsable: '', obs: '',
}

const formVacioComp = {
  nombre: '', categoria: 'computadores', codigo: '', cantidad: 1,
  estado: 'Bueno', ubicacion: '', responsable: '', obs: '',
  tipo: 'Desktop', marca: '', numero_serie: '', modelo: '', pantalla: '', ram_tipo: '', ram_slots: '',
  cpu: '', cpu_marca: '', cpu_modelo: '', cpu_generacion: '',
  ram: '', memoria: '', tipo_almacenamiento: 'SSD', sistema_operativo: 'Windows 11 Pro',
  licencia_windows: '', win_version: '', win_proveedor: '', win_factura: '', win_fecha_factura: '', win_orden: '', win_tipo_licencia: 'key',
  licencia_office: '', off_version: '', off_proveedor: '', off_factura: '', off_fecha_factura: '', off_orden: '', off_tipo_licencia: 'key',
  fecha_adquisicion: '', proveedor: '', numero_factura: '', numero_orden: '', fondo: '', garantia: '',
}

const formVacioTecno = {
  nombre: '', categoria: '', codigo: '', cantidad: 1,
  estado: 'Bueno', ubicacion: '', responsable: '', obs: '',
  tipo: '', tecnologia: '', marca: '', modelo: '', numero_serie: '',
  consumible: '', proveedor: '', numero_factura: '', numero_orden: '',
  fecha_adquisicion: '', fondo: '',
}

export default function Inventario({ usuario }) {
  const esAdmin  = usuario?.rol === 'admin'

  // ── Permisos granulares ───────────────────────────────────────────────────
  // Admin: permisos completos siempre. Otros: se cargan desde permisos_usuario.
  const [permisos, setPermisos] = useState(() =>
    usuario?.rol === 'admin'
      ? { ver_inventario: true, agregar_bien: true, editar_bien: true,
          eliminar_bien: true, eliminar_lote: true, gestionar_categorias: true,
          importar_csv: true, gestionar_usuarios: true, exportar: true }
      : { ver_inventario: true, agregar_bien: false, editar_bien: false,
          eliminar_bien: false, eliminar_lote: false, gestionar_categorias: false,
          importar_csv: false, gestionar_usuarios: false, exportar: false }
  )
  // ['todos'] = acceso a todas las categorías; si no, lista de keys permitidas
  const [categoriasPermitidas, setCategoriasPermitidas] = useState(['todos'])

  // Variables derivadas (reemplazan las de rol)
  const puedeEditar        = permisos.editar_bien   || permisos.agregar_bien
  const puedeAgregar       = permisos.agregar_bien
  const puedeEliminar      = permisos.eliminar_bien
  const puedeEliminarLote  = permisos.eliminar_lote
  const puedeExportar      = permisos.exportar
  const puedeImportar      = permisos.importar_csv
  const puedeGestionarCats = permisos.gestionar_categorias

  const [bienes, setBienes]           = useState([])
  const [categorias, setCategorias]   = useState([])
  const [cargando, setCargando]       = useState(true)
  const [catActual, setCatActual]     = useState('todos')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm]               = useState(formVacio)
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
  const [seleccion, setSeleccion]     = useState(new Set()) // ids seleccionados
  const [filtros, setFiltros]         = useState({}) // filtros dinámicos { campo: valor }
  const [menuExportar, setMenuExportar] = useState(false)
  const [catsVisible, setCatsVisible] = useState(true)
  const [filtrosOpen, setFiltrosOpen] = useState(false)
  // Drag & drop + pin
  const [catOrder, setCatOrder]     = useState([]) // orden de ids
  const [pinnedCats, setPinnedCats] = useState(() => {
    try { return JSON.parse(localStorage.getItem('inv_pinned') || '[]') } catch { return [] }
  })
  const [dragOver, setDragOver]     = useState(null) // id sobre el que se arrastra
  const [dragging, setDragging]     = useState(null) // id que se arrastra

  useEffect(() => { cargarDatos() }, [])

  const cargarDatos = async () => {
    setCargando(true)

    // Defaults por rol (fallback si no hay fila en BD)
    const defaultsPorRol = {
      admin: {
        ver_inventario: true, agregar_bien: true, editar_bien: true,
        eliminar_bien: true, eliminar_lote: true, gestionar_categorias: true,
        importar_csv: true, gestionar_usuarios: true, exportar: true,
      },
      editor: {
        ver_inventario: true, agregar_bien: true, editar_bien: true,
        eliminar_bien: false, eliminar_lote: false, gestionar_categorias: false,
        importar_csv: false, gestionar_usuarios: false, exportar: true,
      },
      encargado: {
        ver_inventario: true, agregar_bien: false, editar_bien: false,
        eliminar_bien: false, eliminar_lote: false, gestionar_categorias: false,
        importar_csv: false, gestionar_usuarios: false, exportar: true,
      },
    }

    // Cargar todo en paralelo
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
    const catsFinales = pd?.categorias ?? ['todos']

    // Inicializar orden desde localStorage o por defecto
    const saved = (() => { try { return JSON.parse(localStorage.getItem('inv_cat_order') || 'null') } catch { return null } })()
    const ids = cats.map(c => c.id)

    // Setear todo junto para que el render ocurra con datos completos
    setCategorias(cats)
    setBienes(bs)
    setCatOrder(saved ? [...new Set([...saved.filter(id => ids.includes(id)), ...ids])] : ids)
    setPermisos(permisosFinales)
    setCategoriasPermitidas(catsFinales)
    setCargando(false)  // render final con todo listo
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
  const filtradosBase = catActual === 'todos' ? bienesPermitidos : bienesPermitidos.filter(b => b.categoria === catActual)
  const filtrados = filtradosBase.filter(b => {
    const q = busqueda.toLowerCase()
    const matchBusqueda = !q || [b.nombre, b.codigo, b.marca, b.modelo, b.numero_serie, b.ubicacion, b.responsable, b.cpu, b.sistema_operativo]
      .some(v => v && String(v).toLowerCase().includes(q))
    const matchEstado = !filtroEstado || b.estado === filtroEstado
    const matchFiltros = Object.entries(filtros).every(([campo, val]) => !val || String(b[campo] ?? '').toLowerCase() === val.toLowerCase())
    return matchBusqueda && matchEstado && matchFiltros
  })

  // Valores únicos para dropdowns dinámicos
  const unicos = (campo) => [...new Set(filtradosBase.map(b => b[campo]).filter(Boolean))].sort()
  const hayFiltrosActivos = busqueda || filtroEstado || Object.values(filtros).some(Boolean)
  const getCatLabel = (id) => categorias.find(c => c.id === id)?.label ?? id
  const catInfo     = [{ id: 'todos', label: 'Todos', icon: '◉' }, ...categorias].find(c => c.id === catActual)
  const esComp   = (cat) => cat === 'computadores'
  const esTecno  = (cat) => {
    if (!cat) return false
    const obj = categorias.find(c => c.id === cat)
    const label = (obj?.label ?? cat).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    return label.includes('tecnol')
  }

  const seleccionarCat = (id) => { setCatActual(id); cancelarForm(); setVerDetalle(null); setBusqueda(''); setFiltroEstado(''); setSeleccion(new Set()); setFiltros({}) }

  const pedirConfirmacion = (mensaje, onOk) => setConfirmar({ mensaje, onOk })


  // ── Datos y columnas para exportar ───────────────────────────────────────
  const getDatosExportar = () => catActual === 'todos' ? bienes : bienes.filter(b => b.categoria === catActual)
  const COLUMNAS_EXPORT = [
    'nombre','categoria','codigo','cantidad','estado','ubicacion','responsable','obs',
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

  // ── Categorías ────────────────────────────────────────
  const abrirModalCat = () => { setNuevaCat({ label: '', icon: '📦' }); setErrorCat(false); setModalCat(true) }

  const guardarCategoria = async () => {
    const label = nuevaCat.label.trim()
    if (!label) { setErrorCat(true); return }
    const id = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') + '_' + Date.now()
    const { error } = await supabase.from('categorias').insert({ id, label, icon: nuevaCat.icon, fija: false })
    if (error) { setAviso('Error al crear categoría: ' + error.message); return }
    setCategorias(prev => [...prev, { id, label, icon: nuevaCat.icon, fija: false }])
    setModalCat(false)
    setCatActual(id)
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
        if (catActual === id) setCatActual('todos')
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
    setErrores({})
    setMostrarForm(true)
    setModalEditar(true)
    setVerDetalle(null)
  }

  const cancelarForm = () => { setMostrarForm(false); setEditandoId(null); setErrores({}); setModalEditar(false) }

  const handleChange = (e) => {
    const { name, value } = e.target
    if (name === 'categoria') {
      const cambiaAComp  = esComp(value)
      const cambiaDeComp = esComp(form.categoria)
      const cambiaATecno = esTecno(value)
      const camiaDeTecno = esTecno(form.categoria)
      const comun = { nombre: form.nombre, codigo: form.codigo, cantidad: form.cantidad, estado: form.estado, ubicacion: form.ubicacion, responsable: form.responsable, obs: form.obs, categoria: value }
      if (cambiaAComp && !cambiaDeComp)                                         setForm({ ...formVacioComp, ...comun })
      else if (cambiaATecno && !camiaDeTecno)                                   setForm({ ...formVacioTecno, ...comun })
      else if (!cambiaAComp && !cambiaATecno && (cambiaDeComp || camiaDeTecno)) setForm({ ...formVacio, ...comun })
      else                                                                       setForm(prev => ({ ...prev, categoria: value }))
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
    if (Object.keys(errs).length) { setErrores(errs); return }

    setGuardando(true)
    // Para computadores, el nombre se genera automáticamente desde marca + modelo
    const nombreFinal = (esComp(form.categoria)
      ? ([form.marca, form.modelo].filter(Boolean).join(' ') || 'Computador')
      : esTecno(form.categoria)
        ? ([form.tipo, form.marca, form.modelo].filter(Boolean).join(' ') || 'Artículo tecnológico')
        : (form.nombre?.trim() || '')) || 'Sin nombre'
    const payload = { ...form, nombre: nombreFinal, cantidad: parseInt(form.cantidad) || 1 }
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


    if (editandoId !== null) {
      const { error } = await supabase.from('bienes').update(payload).eq('id', editandoId)
      if (error) { setAviso('Error al guardar: ' + error.message); setGuardando(false); return }
      setBienes(prev => prev.map(b => b.id === editandoId ? { ...b, ...payload } : b))
    } else {
      const { data, error } = await supabase.from('bienes').insert(payload).select().single()
      if (error) { setAviso('Error al guardar: ' + error.message); setGuardando(false); return }
      setBienes(prev => [data, ...prev])
      setCatActual(payload.categoria)
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
        for (const id of ids) {
          await supabase.from('bienes').delete().eq('id', id)
        }
        setBienes(prev => prev.filter(b => !seleccion.has(b.id)))
        setSeleccion(new Set())
      }
    )
  }

  const descargarPDF = () => {
    const el = document.getElementById('detalle-pdf-content')
    if (!el || !verDetalle) return
    // Ocultar botones durante la captura
    const btns = el.querySelectorAll('button')
    btns.forEach(b => { b.style.visibility = 'hidden' })
    const opt = {
      margin:      [10, 10, 10, 10],
      filename:    `${verDetalle.codigo}_${verDetalle.nombre.replace(/\s+/g, '_')}.pdf`,
      image:       { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' },
    }
    window.html2pdf().set(opt).from(el).save().then(() => {
      btns.forEach(b => { b.style.visibility = '' })
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
            <span className="cat-count">{bienes.length} bien{bienes.length !== 1 ? 'es' : ''}</span>
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
        <span className="section-title section-title-desktop">{catInfo ? `${catInfo.icon} ${catInfo.label}` : 'Todos'} ({filtrados.length})</span>
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
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: '180px', overflow: 'hidden',
                }}>
                  <p style={{ margin: 0, padding: '8px 14px 6px', fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                    Formato de exportación
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
          { campo: 'marca', label: 'Marca' }, { campo: 'tipo', label: 'Tipo' },
          { campo: 'ram', label: 'RAM' }, { campo: 'sistema_operativo', label: 'S.O.' },
          { campo: 'ubicacion', label: 'Ubicación' },
        ]
        const camposOtros  = [{ campo: 'ubicacion', label: 'Ubicación' }, { campo: 'responsable', label: 'Responsable' }]
        const camposTodos  = [{ campo: 'ubicacion', label: 'Ubicación' }, { campo: 'responsable', label: 'Responsable' }, { campo: 'marca', label: 'Marca' }]
        const campos = esComp(catActual) ? camposComp : catActual === 'todos' ? camposTodos : camposOtros
        const filtrosActivos = Object.values(filtros).filter(Boolean).length + (filtroEstado ? 1 : 0)

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
                  style={{ width: '100%', paddingLeft: '32px', paddingRight: busqueda ? '32px' : '10px', height: '36px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.88rem', boxSizing: 'border-box', outline: 'none' }}
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
                  <button onClick={() => { setBusqueda(''); setFiltroEstado(''); setFiltros({}) }}
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
                <label>Nombre *</label>
                <input name="nombre" value={form.nombre} onChange={handleChange} placeholder="ej: Escritorio madera" maxLength={100} className={errores.nombre ? 'input-error' : ''} autoFocus />
              </div>
            )}
            <div className="field">
              <label>Categoría</label>
              <select name="categoria" value={form.categoria} onChange={handleChange}>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
              </select>
            </div>
            {esComp(form.categoria) && (
              <div className="field">
                <label>Número de serie</label>
                <input name="numero_serie" value={form.numero_serie} onChange={handleChange} placeholder="ej: SN-ABC123456" maxLength={60} />
              </div>
            )}
          </div>
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
          <div className="form-row">
            <div className="field">
              <label>Ubicación</label>
              <input name="ubicacion" value={form.ubicacion} onChange={handleChange} placeholder="ej: Sala 3" maxLength={80} />
            </div>
            <div className="field">
              <label>Responsable</label>
              <input name="responsable" value={form.responsable} onChange={handleChange} placeholder="ej: Juan Pérez" maxLength={80} />
            </div>
          </div>

          {esComp(form.categoria) && (
            <>
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
            </>
          )}

          {esTecno(form.categoria) && (
            <>
              <div className="seccion-comp"><span className="seccion-label">🖨️ Datos del equipo</span></div>
              <div className="form-row triple">
                <div className="field">
                  <label>Tipo</label>
                  <input list="tecno-tipos" name="tipo" value={form.tipo ?? ''} onChange={handleChange} placeholder="ej: Impresora" maxLength={60} />
                  <datalist id="tecno-tipos">
                    <option value="Impresora" />
                    <option value="Escáner" />
                    <option value="Multifuncional" />
                    <option value="Fotocopiadora" />
                    <option value="Impresora/Escáner" />
                    <option value="Proyector" />
                    <option value="Tablet" />
                    <option value="Smart TV" />
                    <option value="Cámara" />
                    <option value="Equipo de Audio" />
                    <option value="Router" />
                    <option value="Switch" />
                  </datalist>
                </div>
                <div className="field">
                  <label>Tecnología</label>
                  <input name="tecnologia" value={form.tecnologia ?? ''} onChange={handleChange} placeholder="ej: Láser, Inkjet, LED" maxLength={60} />
                </div>
                <div className="field">
                  <label>Marca</label>
                  <input name="marca" value={form.marca ?? ''} onChange={handleChange} placeholder="ej: HP, Epson, Canon" maxLength={50} />
                </div>
              </div>
              <div className="form-row triple">
                <div className="field">
                  <label>Modelo</label>
                  <input name="modelo" value={form.modelo ?? ''} onChange={handleChange} placeholder="ej: LaserJet Pro M15w" maxLength={80} />
                </div>
                <div className="field">
                  <label>N° de serie</label>
                  <input name="numero_serie" value={form.numero_serie ?? ''} onChange={handleChange} placeholder="ej: SN-ABC123" maxLength={60} />
                </div>
                <div className="field">
                  <label>Consumible</label>
                  <input name="consumible" value={form.consumible ?? ''} onChange={handleChange} placeholder="ej: Tóner HP 26A" maxLength={100} />
                </div>
              </div>

              <div className="seccion-comp"><span className="seccion-label">🛒 Adquisición</span></div>
              <div className="form-row triple">
                <div className="field">
                  <label>Proveedor</label>
                  <input name="proveedor" value={form.proveedor ?? ''} onChange={handleChange} placeholder="ej: TechStore Ltda." maxLength={100} />
                </div>
                <div className="field">
                  <label>Nº Factura</label>
                  <input name="numero_factura" value={form.numero_factura ?? ''} onChange={handleChange} placeholder="ej: FAC-00123" maxLength={30} />
                </div>
                <div className="field">
                  <label>Fecha Factura</label>
                  <input name="fecha_adquisicion" type="date" value={form.fecha_adquisicion ?? ''} onChange={handleChange} />
                </div>
              </div>
              <div className="form-row triple">
                <div className="field">
                  <label>Orden de Compra</label>
                  <input name="numero_orden" value={form.numero_orden ?? ''} onChange={handleChange} placeholder="ej: OC-2024-001" maxLength={30} />
                </div>
                <div className="field">
                  <label>Fondo</label>
                  <input name="fondo" value={form.fondo ?? ''} onChange={handleChange} placeholder="ej: SEP, PIE, Municipal" maxLength={60} />
                </div>
              </div>
            </>
          )}

          <div className="form-row single">
            <div className="field">
              <label>Observaciones</label>
              <textarea name="obs" value={form.obs} onChange={handleChange} placeholder="Descripción adicional..." maxLength={500} />
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
                <label>Nombre *</label>
                <input name="nombre" value={form.nombre} onChange={handleChange} placeholder="ej: Escritorio madera" maxLength={100} className={errores.nombre ? 'input-error' : ''} autoFocus />
              </div>
            )}
            <div className="field">
              <label>Categoría</label>
              <select name="categoria" value={form.categoria} onChange={handleChange}>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
              </select>
            </div>
            {esComp(form.categoria) && (
              <div className="field">
                <label>Número de serie</label>
                <input name="numero_serie" value={form.numero_serie} onChange={handleChange} placeholder="ej: SN-ABC123456" maxLength={60} />
              </div>
            )}
          </div>
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
          <div className="form-row">
            <div className="field">
              <label>Ubicación</label>
              <input name="ubicacion" value={form.ubicacion} onChange={handleChange} placeholder="ej: Sala 3" maxLength={80} />
            </div>
            <div className="field">
              <label>Responsable</label>
              <input name="responsable" value={form.responsable} onChange={handleChange} placeholder="ej: Juan Pérez" maxLength={80} />
            </div>
          </div>

          {esComp(form.categoria) && (
            <>
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
            </>
          )}

          {esTecno(form.categoria) && (
            <>
              <div className="seccion-comp"><span className="seccion-label">🖨️ Datos del equipo</span></div>
              <div className="form-row triple">
                <div className="field">
                  <label>Tipo</label>
                  <input list="tecno-tipos" name="tipo" value={form.tipo ?? ''} onChange={handleChange} placeholder="ej: Impresora" maxLength={60} />
                  <datalist id="tecno-tipos">
                    <option value="Impresora" />
                    <option value="Escáner" />
                    <option value="Multifuncional" />
                    <option value="Fotocopiadora" />
                    <option value="Impresora/Escáner" />
                    <option value="Proyector" />
                    <option value="Tablet" />
                    <option value="Smart TV" />
                    <option value="Cámara" />
                    <option value="Equipo de Audio" />
                    <option value="Router" />
                    <option value="Switch" />
                  </datalist>
                </div>
                <div className="field">
                  <label>Tecnología</label>
                  <input name="tecnologia" value={form.tecnologia ?? ''} onChange={handleChange} placeholder="ej: Láser, Inkjet, LED" maxLength={60} />
                </div>
                <div className="field">
                  <label>Marca</label>
                  <input name="marca" value={form.marca ?? ''} onChange={handleChange} placeholder="ej: HP, Epson, Canon" maxLength={50} />
                </div>
              </div>
              <div className="form-row triple">
                <div className="field">
                  <label>Modelo</label>
                  <input name="modelo" value={form.modelo ?? ''} onChange={handleChange} placeholder="ej: LaserJet Pro M15w" maxLength={80} />
                </div>
                <div className="field">
                  <label>N° de serie</label>
                  <input name="numero_serie" value={form.numero_serie ?? ''} onChange={handleChange} placeholder="ej: SN-ABC123" maxLength={60} />
                </div>
                <div className="field">
                  <label>Consumible</label>
                  <input name="consumible" value={form.consumible ?? ''} onChange={handleChange} placeholder="ej: Tóner HP 26A" maxLength={100} />
                </div>
              </div>

              <div className="seccion-comp"><span className="seccion-label">🛒 Adquisición</span></div>
              <div className="form-row triple">
                <div className="field">
                  <label>Proveedor</label>
                  <input name="proveedor" value={form.proveedor ?? ''} onChange={handleChange} placeholder="ej: TechStore Ltda." maxLength={100} />
                </div>
                <div className="field">
                  <label>Nº Factura</label>
                  <input name="numero_factura" value={form.numero_factura ?? ''} onChange={handleChange} placeholder="ej: FAC-00123" maxLength={30} />
                </div>
                <div className="field">
                  <label>Fecha Factura</label>
                  <input name="fecha_adquisicion" type="date" value={form.fecha_adquisicion ?? ''} onChange={handleChange} />
                </div>
              </div>
              <div className="form-row triple">
                <div className="field">
                  <label>Orden de Compra</label>
                  <input name="numero_orden" value={form.numero_orden ?? ''} onChange={handleChange} placeholder="ej: OC-2024-001" maxLength={30} />
                </div>
                <div className="field">
                  <label>Fondo</label>
                  <input name="fondo" value={form.fondo ?? ''} onChange={handleChange} placeholder="ej: SEP, PIE, Municipal" maxLength={60} />
                </div>
              </div>
            </>
          )}

          <div className="form-row single">
            <div className="field">
              <label>Observaciones</label>
              <textarea name="obs" value={form.obs} onChange={handleChange} placeholder="Descripción adicional..." maxLength={500} />
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
                {puedeEliminarLote && (
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
              {filtrados.map(b => (
                <tr key={b.id} className={`${editandoId === b.id ? 'fila-editando' : ''} ${seleccion.has(b.id) ? 'fila-seleccionada' : ''}`}>
                  {puedeEliminarLote && (
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
                      <button className="btn-ver" onClick={() => setVerDetalle(verDetalle?.id === b.id ? null : b)} title="Ver detalle">👁</button>
                      {(permisos.editar_bien) && <button className="btn-edit" onClick={() => abrirFormEditar(b)} title="Editar">✏️</button>}
                      {puedeEliminar && <button className="btn-del"  onClick={() => eliminarBien(b.id)} title="Eliminar">✕</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Ficha de detalle — modal */}
      {verDetalle && (
        <div className="modal-overlay" onClick={() => setVerDetalle(null)}>
          <div className="modal modal-detalle" onClick={e => e.stopPropagation()}>

            <div id="detalle-pdf-content" style={{ background: '#ffffff' }}>

            {/* Header */}
            <div className="detalle-header-modal">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>{categorias.find(c => c.id === verDetalle.categoria)?.icon}</span>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '1.05rem', color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{verDetalle.nombre}</p>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#6b7280' }}>{verDetalle.codigo} · {getCatLabel(verDetalle.categoria)}</p>
                </div>
              </div>
              <div className="detalle-header-actions">
                <span className={`badge ${ESTADO_BADGE[verDetalle.estado]}`}>{verDetalle.estado}</span>
                <button className="btn-descargar-pdf" onClick={descargarPDF}>⬇ <span className="pdf-label">Descargar </span>PDF</button>
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

            {verDetalle.obs && (
              <div className="detalle-obs">
                <p className="detalle-titulo">Observaciones</p>
                <p className="detalle-obs-texto">{verDetalle.obs}</p>
              </div>
            )}
            </div>{/* fin detalle-pdf-content */}
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
    </div>
  )
}