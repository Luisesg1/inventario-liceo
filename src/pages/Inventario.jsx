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
  licencia_windows: '', win_version: '', win_proveedor: '', win_factura: '', win_fecha_factura: '', win_orden: '',
  licencia_office: '', off_version: '', off_proveedor: '', off_factura: '', off_fecha_factura: '', off_orden: '',
  fecha_adquisicion: '', proveedor: '', numero_factura: '', numero_orden: '', fondo: '', garantia: '',
}

export default function Inventario() {
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

  useEffect(() => { cargarDatos() }, [])

  const cargarDatos = async () => {
    setCargando(true)
    const [{ data: cats }, { data: bs }] = await Promise.all([
      supabase.from('categorias').select('*').order('creado_en'),
      supabase.from('bienes').select('*').order('creado_en', { ascending: false }),
    ])
    setCategorias(cats ?? [])
    setBienes(bs ?? [])
    setCargando(false)
  }

  const bienCount   = (id) => id === 'todos' ? bienes.length : bienes.filter(b => b.categoria === id).length
  const filtradosBase = catActual === 'todos' ? bienes : bienes.filter(b => b.categoria === catActual)
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
  const esComp      = (cat) => cat === 'computadores'

  const seleccionarCat = (id) => { setCatActual(id); cancelarForm(); setVerDetalle(null); setBusqueda(''); setFiltroEstado(''); setSeleccion(new Set()); setFiltros({}) }

  const pedirConfirmacion = (mensaje, onOk) => setConfirmar({ mensaje, onOk })

  const exportarCSV = () => {
    const datos = catActual === 'todos' ? bienes : bienes.filter(b => b.categoria === catActual)
    if (!datos.length) { setAviso('No hay bienes para exportar en esta categoría.'); return }

    const columnas = [
      'nombre','categoria','codigo','cantidad','estado','ubicacion','responsable','obs',
      'tipo','marca','modelo','numero_serie','pantalla','cpu','ram','ram_tipo','ram_slots',
      'memoria','tipo_almacenamiento','sistema_operativo',
      'licencia_windows','win_version','win_proveedor','win_factura','win_fecha_factura','win_orden',
      'licencia_office','off_version','off_proveedor','off_factura','off_fecha_factura','off_orden',
      'fecha_adquisicion','proveedor','numero_factura','numero_orden','fondo','garantia',
    ]

    const escapar = (v) => {
      if (v === null || v === undefined) return ''
      const s = String(v)
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
    }

    const filas = [
      columnas.join(','),
      ...datos.map(b => columnas.map(c => escapar(b[c])).join(',')),
    ]

    const blob = new Blob([filas.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const catLabel = catActual === 'todos' ? 'todos' : (categorias.find(c => c.id === catActual)?.label ?? catActual)
    a.href = url
    a.download = `inventario_${catLabel.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
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
    const base = esComp(cat) ? { ...formVacioComp } : { ...formVacio }
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
    const base = esComp(bien.categoria) ? { ...formVacioComp, ...bien } : { ...formVacio, ...bien }
    // Normalizar nulos a string vacío
    Object.keys(base).forEach(k => { if (base[k] === null) base[k] = '' })
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
      const comun = { nombre: form.nombre, codigo: form.codigo, cantidad: form.cantidad, estado: form.estado, ubicacion: form.ubicacion, responsable: form.responsable, obs: form.obs, categoria: value }
      if (cambiaAComp && !cambiaDeComp)       setForm({ ...formVacioComp, ...comun })
      else if (!cambiaAComp && cambiaDeComp)  setForm({ ...formVacio, ...comun })
      else                                     setForm(prev => ({ ...prev, categoria: value }))
    } else {
      setForm(prev => {
        const updated = { ...prev, [name]: value }
        if (name === 'cpu_marca' || name === 'cpu_modelo' || name === 'cpu_generacion') {
          const marca = name === 'cpu_marca' ? value : (prev.cpu_marca ?? '')
          const modelo = name === 'cpu_modelo' ? value : (prev.cpu_modelo ?? '')
          const gen = name === 'cpu_generacion' ? value : (prev.cpu_generacion ?? '')
          updated.cpu = [marca, modelo, gen].filter(Boolean).join(' ') || ''
        }
        return updated
      })
    }
    if (errores[name]) setErrores(prev => ({ ...prev, [name]: false }))
  }

  

  const guardarBien = async () => {
    const errs = {}
    if (!esComp(form.categoria) && !form.nombre.trim()) errs.nombre = true
    if (!form.codigo.trim()) errs.codigo = true
    if (Object.keys(errs).length) { setErrores(errs); return }

    setGuardando(true)
    // Para computadores, el nombre se genera automáticamente desde marca + modelo
    const nombreFinal = esComp(form.categoria)
      ? ([form.marca, form.modelo].filter(Boolean).join(' ') || 'Computador')
      : form.nombre
    const payload = { ...form, nombre: nombreFinal, cantidad: parseInt(form.cantidad) || 1 }
    if (!payload.fecha_adquisicion) payload.fecha_adquisicion = null

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

  if (cargando) return (
    <div className="cargando">
      <div className="spinner"></div>
      <p>Cargando inventario...</p>
    </div>
  )

  return (
    <div className="inv">

      {/* Grilla categorías */}
      <div className="cats-grid">
        <div className={`cat-card ${catActual === 'todos' ? 'active' : ''}`} onClick={() => seleccionarCat('todos')}>
          <span className="cat-icon">◉</span>
          <span className="cat-name">Todos</span>
          <span className="cat-count">{bienes.length} bien{bienes.length !== 1 ? 'es' : ''}</span>
        </div>
        {categorias.map(cat => (
          <div key={cat.id} className={`cat-card ${catActual === cat.id ? 'active' : ''}`} onClick={() => seleccionarCat(cat.id)}>
            <div className="cat-actions">
              <button className="btn-edit-cat" title="Editar" onClick={e => abrirEditCat(cat, e)}>✏️</button>
              <button className="btn-del-cat"  title="Eliminar" onClick={e => { e.stopPropagation(); eliminarCategoria(cat.id) }}>✕</button>
            </div>
            <span className="cat-icon">{cat.icon}</span>
            <span className="cat-name">{cat.label}</span>
            <span className="cat-count">{bienCount(cat.id)} bien{bienCount(cat.id) !== 1 ? 'es' : ''}</span>
          </div>
        ))}
        <div className="cat-card cat-nueva" onClick={abrirModalCat}>
          <span className="cat-icon add-icon">＋</span>
          <span className="cat-name">Nueva categoría</span>
        </div>
      </div>

      {/* Cabecera */}
      <div className="section-header">
        <span className="section-title">{catInfo ? `${catInfo.icon} ${catInfo.label}` : 'Todos'} ({filtrados.length})</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-import" onClick={exportarCSV}>📤 Exportar CSV</button>
          <button className="btn-import" onClick={() => setModalImportar(true)}>📥 Importar CSV</button>
          <button className="btn-import" onClick={mostrarForm && !editandoId ? cancelarForm : abrirFormNuevo}>
            {mostrarForm && !editandoId ? '✕ Cancelar' : '+ Agregar bien'}
          </button>
        </div>
      </div>

      {/* Barra de búsqueda y filtros */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1rem' }}>
        {/* Fila 1: solo buscador */}
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: '0.9rem' }}>🔍</span>
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, código, marca, serie, ubicación..."
            style={{ width: '100%', paddingLeft: '32px', paddingRight: '10px', height: '36px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.88rem', boxSizing: 'border-box', outline: 'none' }}
          />
          {busqueda && (
            <button onClick={() => setBusqueda('')} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '1rem' }}>✕</button>
          )}
        </div>

        {/* Fila 2: filtros dinámicos según categoría */}
        {esComp(catActual) && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
              style={{ height: '32px', borderRadius: '8px', border: filtroEstado ? '1.5px solid #6366f1' : '1px solid #e5e7eb', fontSize: '0.82rem', padding: '0 8px', background: filtroEstado ? '#eef2ff' : 'white', color: filtroEstado ? '#4338ca' : '#9ca3af', minWidth: '150px' }}>
              <option value="">Todos los estados</option>
              <option value="Bueno">✅ Bueno</option>
              <option value="Regular">⚠️ Regular</option>
              <option value="Malo">❌ Malo</option>
              <option value="Baja">🗑 Baja</option>
            </select>
            {[
              { campo: 'marca',            label: 'Marca' },
              { campo: 'tipo',             label: 'Tipo' },
              { campo: 'ram',              label: 'RAM' },
              { campo: 'sistema_operativo',label: 'Sistema operativo' },
              { campo: 'ubicacion',        label: 'Ubicación' },
            ].map(({ campo, label }) => {
              const opciones = unicos(campo)
              if (opciones.length < 2) return null
              return (
                <select key={campo} value={filtros[campo] || ''}
                  onChange={e => setFiltros(prev => ({ ...prev, [campo]: e.target.value }))}
                  style={{ height: '32px', borderRadius: '8px', border: filtros[campo] ? '1.5px solid #6366f1' : '1px solid #e5e7eb', fontSize: '0.82rem', padding: '0 8px', background: filtros[campo] ? '#eef2ff' : 'white', color: filtros[campo] ? '#4338ca' : '#9ca3af', minWidth: '130px' }}>
                  <option value="">{label}</option>
                  {opciones.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              )
            })}
            {hayFiltrosActivos && (
              <button onClick={() => { setBusqueda(''); setFiltroEstado(''); setFiltros({}) }}
                style={{ height: '32px', padding: '0 12px', borderRadius: '8px', border: '1px solid #fca5a5', background: '#fff1f2', cursor: 'pointer', fontSize: '0.82rem', color: '#ef4444', whiteSpace: 'nowrap', fontWeight: 600 }}>
                ✕ Limpiar
              </button>
            )}
          </div>
        )}

        {!esComp(catActual) && catActual !== 'todos' && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
              style={{ height: '32px', borderRadius: '8px', border: filtroEstado ? '1.5px solid #6366f1' : '1px solid #e5e7eb', fontSize: '0.82rem', padding: '0 8px', background: filtroEstado ? '#eef2ff' : 'white', color: filtroEstado ? '#4338ca' : '#9ca3af', minWidth: '150px' }}>
              <option value="">Todos los estados</option>
              <option value="Bueno">✅ Bueno</option>
              <option value="Regular">⚠️ Regular</option>
              <option value="Malo">❌ Malo</option>
              <option value="Baja">🗑 Baja</option>
            </select>
            {[
              { campo: 'ubicacion',  label: 'Ubicación' },
              { campo: 'responsable',label: 'Responsable' },
            ].map(({ campo, label }) => {
              const opciones = unicos(campo)
              if (opciones.length < 2) return null
              return (
                <select key={campo} value={filtros[campo] || ''}
                  onChange={e => setFiltros(prev => ({ ...prev, [campo]: e.target.value }))}
                  style={{ height: '32px', borderRadius: '8px', border: filtros[campo] ? '1.5px solid #6366f1' : '1px solid #e5e7eb', fontSize: '0.82rem', padding: '0 8px', background: filtros[campo] ? '#eef2ff' : 'white', color: filtros[campo] ? '#4338ca' : '#9ca3af', minWidth: '130px' }}>
                  <option value="">{label}</option>
                  {opciones.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              )
            })}
            {hayFiltrosActivos && (
              <button onClick={() => { setBusqueda(''); setFiltroEstado(''); setFiltros({}) }}
                style={{ height: '32px', padding: '0 12px', borderRadius: '8px', border: '1px solid #fca5a5', background: '#fff1f2', cursor: 'pointer', fontSize: '0.82rem', color: '#ef4444', whiteSpace: 'nowrap', fontWeight: 600 }}>
                ✕ Limpiar
              </button>
            )}
          </div>
        )}

        {catActual === 'todos' && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
              style={{ height: '32px', borderRadius: '8px', border: filtroEstado ? '1.5px solid #6366f1' : '1px solid #e5e7eb', fontSize: '0.82rem', padding: '0 8px', background: filtroEstado ? '#eef2ff' : 'white', color: filtroEstado ? '#4338ca' : '#9ca3af', minWidth: '150px' }}>
              <option value="">Todos los estados</option>
              <option value="Bueno">✅ Bueno</option>
              <option value="Regular">⚠️ Regular</option>
              <option value="Malo">❌ Malo</option>
              <option value="Baja">🗑 Baja</option>
            </select>
            {[
              { campo: 'ubicacion',  label: 'Ubicación' },
              { campo: 'responsable',label: 'Responsable' },
              { campo: 'marca',      label: 'Marca' },
            ].map(({ campo, label }) => {
              const opciones = unicos(campo)
              if (opciones.length < 2) return null
              return (
                <select key={campo} value={filtros[campo] || ''}
                  onChange={e => setFiltros(prev => ({ ...prev, [campo]: e.target.value }))}
                  style={{ height: '32px', borderRadius: '8px', border: filtros[campo] ? '1.5px solid #6366f1' : '1px solid #e5e7eb', fontSize: '0.82rem', padding: '0 8px', background: filtros[campo] ? '#eef2ff' : 'white', color: filtros[campo] ? '#4338ca' : '#9ca3af', minWidth: '130px' }}>
                  <option value="">{label}</option>
                  {opciones.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              )
            })}
            {hayFiltrosActivos && (
              <button onClick={() => { setBusqueda(''); setFiltroEstado(''); setFiltros({}) }}
                style={{ height: '32px', padding: '0 12px', borderRadius: '8px', border: '1px solid #fca5a5', background: '#fff1f2', cursor: 'pointer', fontSize: '0.82rem', color: '#ef4444', whiteSpace: 'nowrap', fontWeight: 600 }}>
                ✕ Limpiar
              </button>
            )}
          </div>
        )}
      </div>
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

          <p className="form-title">{editandoId ? (esComp(form.categoria) ? '✏️ Editar computador' : '✏️ Editar bien') : (esComp(form.categoria) ? 'Nuevo computador' : 'Nuevo bien')}</p>

          <div className="form-row">
            {!esComp(form.categoria) && (
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
              <div className="form-row triple">
                <div className="field">
                  <label>Clave Windows</label>
                  <input name="licencia_windows" value={form.licencia_windows} onChange={handleChange} placeholder="ej: XXXXX-XXXXX-XXXXX-XXXXX-XXXXX o De fabricante" maxLength={29} className="input-mono" />
                </div>
                <div className="field">
                  <label>Versión</label>
                  <input name="win_version" value={form.win_version} onChange={handleChange} placeholder="ej: Windows 10 Home" maxLength={60} />
                </div>
                <div className="field">
                  <label>Proveedor</label>
                  <input name="win_proveedor" value={form.win_proveedor} onChange={handleChange} placeholder="ej: Microsoft Store" maxLength={100} />
                </div>
              </div>
              <div className="form-row triple">
                <div className="field">
                  <label>N° Factura</label>
                  <input name="win_factura" value={form.win_factura} onChange={handleChange} placeholder="ej: FAC-00123" maxLength={30} />
                </div>
                <div className="field">
                  <label>Fecha factura</label>
                  <input name="win_fecha_factura" type="date" value={form.win_fecha_factura} onChange={handleChange} />
                </div>
                <div className="field">
                  <label>N° Orden de compra</label>
                  <input name="win_orden" value={form.win_orden} onChange={handleChange} placeholder="ej: OC-2024-001" maxLength={30} />
                </div>
              </div>

              {/* Office */}
              <div className="seccion-lic-sub">📊 Office</div>
              <div className="form-row triple">
                <div className="field">
                  <label>Clave Office</label>
                  <input name="licencia_office" value={form.licencia_office} onChange={handleChange} placeholder="ej: XXXXX-XXXXX-XXXXX-XXXXX-XXXXX" maxLength={29} className="input-mono" />
                </div>
                <div className="field">
                  <label>Versión</label>
                  <input name="off_version" value={form.off_version} onChange={handleChange} placeholder="ej: Office 2019, Microsoft 365" maxLength={60} />
                </div>
                <div className="field">
                  <label>Proveedor</label>
                  <input name="off_proveedor" value={form.off_proveedor} onChange={handleChange} placeholder="ej: Microsoft Store" maxLength={100} />
                </div>
              </div>
              <div className="form-row triple">
                <div className="field">
                  <label>N° Factura</label>
                  <input name="off_factura" value={form.off_factura} onChange={handleChange} placeholder="ej: FAC-00124" maxLength={30} />
                </div>
                <div className="field">
                  <label>Fecha factura</label>
                  <input name="off_fecha_factura" type="date" value={form.off_fecha_factura} onChange={handleChange} />
                </div>
                <div className="field">
                  <label>N° Orden de compra</label>
                  <input name="off_orden" value={form.off_orden} onChange={handleChange} placeholder="ej: OC-2024-002" maxLength={30} />
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

          <p className="form-title">{editandoId ? (esComp(form.categoria) ? '✏️ Editar computador' : '✏️ Editar bien') : (esComp(form.categoria) ? 'Nuevo computador' : 'Nuevo bien')}</p>

          <div className="form-row">
            {!esComp(form.categoria) && (
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
              <div className="form-row triple">
                <div className="field">
                  <label>Clave Windows</label>
                  <input name="licencia_windows" value={form.licencia_windows} onChange={handleChange} placeholder="ej: XXXXX-XXXXX-XXXXX-XXXXX-XXXXX o De fabricante" maxLength={29} className="input-mono" />
                </div>
                <div className="field">
                  <label>Versión</label>
                  <input name="win_version" value={form.win_version} onChange={handleChange} placeholder="ej: Windows 10 Home" maxLength={60} />
                </div>
                <div className="field">
                  <label>Proveedor</label>
                  <input name="win_proveedor" value={form.win_proveedor} onChange={handleChange} placeholder="ej: Microsoft Store" maxLength={100} />
                </div>
              </div>
              <div className="form-row triple">
                <div className="field">
                  <label>N° Factura</label>
                  <input name="win_factura" value={form.win_factura} onChange={handleChange} placeholder="ej: FAC-00123" maxLength={30} />
                </div>
                <div className="field">
                  <label>Fecha factura</label>
                  <input name="win_fecha_factura" type="date" value={form.win_fecha_factura} onChange={handleChange} />
                </div>
                <div className="field">
                  <label>N° Orden de compra</label>
                  <input name="win_orden" value={form.win_orden} onChange={handleChange} placeholder="ej: OC-2024-001" maxLength={30} />
                </div>
              </div>

              {/* Office */}
              <div className="seccion-lic-sub">📊 Office</div>
              <div className="form-row triple">
                <div className="field">
                  <label>Clave Office</label>
                  <input name="licencia_office" value={form.licencia_office} onChange={handleChange} placeholder="ej: XXXXX-XXXXX-XXXXX-XXXXX-XXXXX" maxLength={29} className="input-mono" />
                </div>
                <div className="field">
                  <label>Versión</label>
                  <input name="off_version" value={form.off_version} onChange={handleChange} placeholder="ej: Office 2019, Microsoft 365" maxLength={60} />
                </div>
                <div className="field">
                  <label>Proveedor</label>
                  <input name="off_proveedor" value={form.off_proveedor} onChange={handleChange} placeholder="ej: Microsoft Store" maxLength={100} />
                </div>
              </div>
              <div className="form-row triple">
                <div className="field">
                  <label>N° Factura</label>
                  <input name="off_factura" value={form.off_factura} onChange={handleChange} placeholder="ej: FAC-00124" maxLength={30} />
                </div>
                <div className="field">
                  <label>Fecha factura</label>
                  <input name="off_fecha_factura" type="date" value={form.off_fecha_factura} onChange={handleChange} />
                </div>
                <div className="field">
                  <label>N° Orden de compra</label>
                  <input name="off_orden" value={form.off_orden} onChange={handleChange} placeholder="ej: OC-2024-002" maxLength={30} />
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
      {seleccion.size > 0 && (
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
          {!hayFiltrosActivos && <button className="btn-add" style={{ marginTop: '1rem' }} onClick={abrirFormNuevo}>+ Agregar el primer bien</button>}
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: '36px' }}>
                  <input
                    type="checkbox"
                    checked={seleccion.size === filtrados.length && filtrados.length > 0}
                    ref={el => { if (el) el.indeterminate = seleccion.size > 0 && seleccion.size < filtrados.length }}
                    onChange={toggleTodos}
                    style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                  />
                </th>
                <th>Código</th>
                <th>Nombre</th>
                {catActual === 'todos'        && <th>Categoría</th>}
                {catActual === 'computadores' && <><th>Tipo</th><th>Marca / Modelo</th><th>CPU</th><th>RAM</th><th>SO</th></>}
                {catActual !== 'computadores' && <th>Cant.</th>}
                <th>Estado</th>
                <th>Ubicación</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(b => (
                <tr key={b.id} className={`${editandoId === b.id ? 'fila-editando' : ''} ${seleccion.has(b.id) ? 'fila-seleccionada' : ''}`}>
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={seleccion.has(b.id)}
                      onChange={() => toggleSeleccion(b.id)}
                      style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                    />
                  </td>
                  <td className="td-code">{b.codigo}</td>
                  <td className="td-name">
                    {b.nombre}
                    {b.numero_serie && <div className="td-sub">S/N: {b.numero_serie}</div>}
                  </td>
                  {catActual === 'todos'        && <td className="td-muted">{getCatLabel(b.categoria)}</td>}
                  {catActual === 'computadores' && (
                    <>
                      <td className="td-muted">{b.tipo ?? '—'}</td>
                      <td>
                        <span style={{ fontWeight: 600, fontSize: '13px' }}>{b.marca ?? '—'}</span>
                        {b.modelo && <div className="td-sub">{b.modelo}</div>}
                      </td>
                      <td className="td-muted td-trunc">{b.cpu ?? '—'}</td>
                      <td className="td-muted">{b.ram ?? '—'}</td>
                      <td className="td-muted">{b.sistema_operativo ?? '—'}</td>
                    </>
                  )}
                  {catActual !== 'computadores' && <td>{b.cantidad}</td>}
                  <td><span className={`badge ${ESTADO_BADGE[b.estado] ?? ''}`}>{b.estado}</span></td>
                  <td className="td-muted">{b.ubicacion}</td>
                  <td>
                    <div className="acciones">
                      <button className="btn-ver" onClick={() => setVerDetalle(verDetalle?.id === b.id ? null : b)} title="Ver detalle">👁</button>
                      <button className="btn-edit" onClick={() => abrirFormEditar(b)} title="Editar">✏️</button>
                      <button className="btn-del"  onClick={() => eliminarBien(b.id)} title="Eliminar">✕</button>
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
          <div className="modal modal-importar" style={{ maxWidth: '900px', width: '95vw', maxHeight: '90vh', overflowY: 'auto', padding: '2rem' }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '2px solid #e5e7eb', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.4rem' }}>{categorias.find(c => c.id === verDetalle.categoria)?.icon}</span>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '1.1rem', color: '#111827' }}>{verDetalle.nombre}</p>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#6b7280' }}>{verDetalle.codigo} · {getCatLabel(verDetalle.categoria)}</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className={`badge ${ESTADO_BADGE[verDetalle.estado]}`}>{verDetalle.estado}</span>
                <button className="btn-cerrar-detalle" onClick={() => setVerDetalle(null)}>✕</button>
              </div>
            </div>

            {/* Fila 1: Identificación + Asignación */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div className="detalle-seccion" style={{ margin: 0 }}>
                <p className="detalle-titulo">Identificación</p>
                <div className="detalle-fila"><span>Código</span><strong>{verDetalle.codigo}</strong></div>
                <div className="detalle-fila"><span>Categoría</span><strong>{getCatLabel(verDetalle.categoria)}</strong></div>
                {!esComp(verDetalle.categoria) && <div className="detalle-fila"><span>Cantidad</span><strong>{verDetalle.cantidad}</strong></div>}
              </div>
              <div className="detalle-seccion" style={{ margin: 0 }}>
                <p className="detalle-titulo">Asignación</p>
                <div className="detalle-fila"><span>Ubicación</span><strong>{verDetalle.ubicacion || 'N/A'}</strong></div>
                <div className="detalle-fila"><span>Responsable</span><strong>{verDetalle.responsable || 'N/A'}</strong></div>
              </div>
            </div>

            {esComp(verDetalle.categoria) && (<>

              {/* Fila 2: Hardware */}
              <div className="detalle-seccion" style={{ marginBottom: '1rem' }}>
                <p className="detalle-titulo">Hardware</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem 1.5rem' }}>
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
                    <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
                      <strong style={{ fontSize: '0.88rem', color: '#111827' }}>{val || 'N/A'}</strong>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fila 3: Licencias Windows + Office lado a lado */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="detalle-seccion" style={{ margin: 0 }}>
                  <p className="detalle-titulo">🪟 Licencia Windows</p>
                  <div className="detalle-fila"><span>Clave</span><strong className="mono-small">{verDetalle.licencia_windows || 'N/A'}</strong></div>
                  <div className="detalle-fila"><span>Versión</span><strong>{verDetalle.win_version || 'N/A'}</strong></div>
                  <div className="detalle-fila"><span>Proveedor</span><strong>{verDetalle.win_proveedor || 'N/A'}</strong></div>
                  <div className="detalle-fila"><span>N° Factura</span><strong>{verDetalle.win_factura || 'N/A'}</strong></div>
                  <div className="detalle-fila"><span>Fecha factura</span><strong>{verDetalle.win_fecha_factura || 'N/A'}</strong></div>
                  <div className="detalle-fila"><span>N° Orden</span><strong>{verDetalle.win_orden || 'N/A'}</strong></div>
                </div>
                <div className="detalle-seccion" style={{ margin: 0 }}>
                  <p className="detalle-titulo">📊 Licencia Office</p>
                  <div className="detalle-fila"><span>Clave</span><strong className="mono-small">{verDetalle.licencia_office || 'N/A'}</strong></div>
                  <div className="detalle-fila"><span>Versión</span><strong>{verDetalle.off_version || 'N/A'}</strong></div>
                  <div className="detalle-fila"><span>Proveedor</span><strong>{verDetalle.off_proveedor || 'N/A'}</strong></div>
                  <div className="detalle-fila"><span>N° Factura</span><strong>{verDetalle.off_factura || 'N/A'}</strong></div>
                  <div className="detalle-fila"><span>Fecha factura</span><strong>{verDetalle.off_fecha_factura || 'N/A'}</strong></div>
                  <div className="detalle-fila"><span>N° Orden</span><strong>{verDetalle.off_orden || 'N/A'}</strong></div>
                </div>
              </div>

              {/* Fila 4: Adquisición */}
              <div className="detalle-seccion" style={{ marginBottom: '1rem' }}>
                <p className="detalle-titulo">Adquisición</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem 1.5rem' }}>
                  {[
                    ['Fecha', verDetalle.fecha_adquisicion],
                    ['Proveedor', verDetalle.proveedor],
                    ['N° Factura', verDetalle.numero_factura],
                    ['N° Orden', verDetalle.numero_orden],
                    ['Fondo', verDetalle.fondo],
                    ['Garantía', verDetalle.garantia],
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
                      <strong style={{ fontSize: '0.88rem', color: '#111827' }}>{val || 'N/A'}</strong>
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