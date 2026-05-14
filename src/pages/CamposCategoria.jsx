import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const TIPOS = [
  { value: 'texto',    label: 'Texto',          icon: '📝' },
  { value: 'numero',   label: 'Número',         icon: '🔢' },
  { value: 'fecha',    label: 'Fecha',          icon: '📅' },
  { value: 'booleano', label: 'Sí / No',        icon: '☑️' },
  { value: 'select',   label: 'Lista opciones', icon: '📋' },
]

const CAMPOS_SISTEMA = [
  'nombre','codigo','cantidad','estado','ubicacion','responsable','obs',
  'isbn','autor','genero','tipo','marca','modelo','numero_serie',
  'pantalla','cpu','ram','ram_tipo','ram_slots','memoria',
  'tipo_almacenamiento','sistema_operativo','fecha_adquisicion',
  'proveedor','numero_factura','numero_orden','fondo','garantia',
]

const ICONOS = ['📦','🪑','📚','📖','🖨️','💻','🖥️','🖱️','📷','📱','🔧','🗂️','🗃️','🖼️','🏫','⚗️','🎨','🎒','🔬','🪞','⚽','🏀','🏐','🏈','🎾','🏓','🏸','🥊','🏋️','🎽','🎵','🎭','🔭','🧪','🖊️','📐','🗑️','🎸','🎹','🎺','🎻','🎙️','🖋️','✂️','🔑','💡','🧲','🧰','🪣','🧹','🛒']

const TIPO_COLOR = { texto: '#6366f1', numero: '#0ea5e9', fecha: '#8b5cf6', booleano: '#10b981', select: '#f59e0b' }

// Campos predeterminados por tipo de categoría
const CAMPOS_PREDET = {
  computadores: [
    { id: 'numero_serie',       nombre: 'Número de serie',          tipo: 'texto'  },
    { id: 'tipo',               nombre: 'Tipo de equipo',           tipo: 'select' },
    { id: 'marca',              nombre: 'Marca',                    tipo: 'texto'  },
    { id: 'modelo',             nombre: 'Modelo',                   tipo: 'texto'  },
    { id: 'pantalla',           nombre: 'Pantalla',                 tipo: 'texto'  },
    { id: 'cpu_marca',          nombre: 'Marca CPU',                tipo: 'select' },
    { id: 'cpu_modelo',         nombre: 'Modelo CPU',               tipo: 'texto'  },
    { id: 'cpu_generacion',     nombre: 'Versión / generación CPU', tipo: 'texto'  },
    { id: 'ram',                nombre: 'RAM (capacidad)',          tipo: 'texto'  },
    { id: 'ram_tipo',           nombre: 'Tipo RAM',                 tipo: 'select' },
    { id: 'ram_slots',          nombre: 'Slots RAM',                tipo: 'texto'  },
    { id: 'memoria',            nombre: 'Almacenamiento',           tipo: 'texto'  },
    { id: 'tipo_almacenamiento',nombre: 'Tecnología almacenamiento',tipo: 'select' },
    { id: 'sistema_operativo',  nombre: 'Sistema operativo',        tipo: 'texto'  },
    { id: 'fecha_adquisicion',  nombre: 'Fecha adquisición',        tipo: 'fecha'  },
    { id: 'proveedor',          nombre: 'Proveedor',                tipo: 'texto'  },
    { id: 'numero_factura',     nombre: 'N° factura',               tipo: 'texto'  },
    { id: 'garantia',           nombre: 'Garantía',                 tipo: 'texto'  },
  ],
  tecno: [
    { id: 'tipo',              nombre: 'Tipo',              tipo: 'texto' },
    { id: 'marca',             nombre: 'Marca',             tipo: 'texto' },
    { id: 'modelo',            nombre: 'Modelo',            tipo: 'texto' },
    { id: 'numero_serie',      nombre: 'N° de serie',       tipo: 'texto' },
    { id: 'fecha_adquisicion', nombre: 'Fecha adquisición', tipo: 'fecha' },
    { id: 'proveedor',         nombre: 'Proveedor',         tipo: 'texto' },
    { id: 'numero_factura',    nombre: 'N° factura',        tipo: 'texto' },
    { id: 'garantia',          nombre: 'Garantía',          tipo: 'texto' },
  ],
  biblio: [
    { id: 'isbn',              nombre: 'ISBN',              tipo: 'texto' },
    { id: 'autor',             nombre: 'Autor',             tipo: 'texto' },
    { id: 'genero',            nombre: 'Género',            tipo: 'texto' },
    { id: 'fecha_adquisicion', nombre: 'Fecha adquisición', tipo: 'fecha' },
    { id: 'proveedor',         nombre: 'Proveedor',         tipo: 'texto' },
    { id: 'fondo',             nombre: 'Fondo',             tipo: 'texto' },
  ],
  generico: [
    { id: 'fecha_adquisicion', nombre: 'Fecha adquisición', tipo: 'fecha' },
    { id: 'proveedor',         nombre: 'Proveedor',         tipo: 'texto' },
    { id: 'numero_factura',    nombre: 'N° factura',        tipo: 'texto' },
    { id: 'numero_orden',      nombre: 'N° orden',          tipo: 'texto' },
    { id: 'fondo',             nombre: 'Fondo',             tipo: 'texto' },
    { id: 'garantia',          nombre: 'Garantía',          tipo: 'texto' },
  ],
}

function getCamposSistema(cat) {
  if (!cat) return []
  if (cat.id === 'computadores') return CAMPOS_PREDET.computadores
  const lbl = (cat.label || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (lbl.includes('tecnol')) return CAMPOS_PREDET.tecno
  if (lbl.includes('biblio') || lbl.includes('libreri')) return CAMPOS_PREDET.biblio
  return CAMPOS_PREDET.generico
}

function ModalCategoria({ cat, onClose, onSave }) {
  const esEdicion = !!cat
  const [label, setLabel] = useState(cat?.label || '')
  const [icon,  setIcon]  = useState(cat?.icon  || '📦')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    const lbl = label.trim()
    if (!lbl) { setError('El nombre es obligatorio'); return }
    setGuardando(true); setError('')
    await onSave({ label: lbl, icon })
    setGuardando(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,12,55,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 900 }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 18, padding: '26px 28px', boxShadow: '0 24px 64px rgba(0,0,0,0.25)', maxWidth: 440, width: '92%', display: 'flex', flexDirection: 'column', gap: 18 }}
        onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: '#f0f4ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{icon}</div>
          <div>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 16, color: '#111827' }}>{esEdicion ? 'Editar categoría' : 'Nueva categoría'}</p>
            <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>{esEdicion ? `Modificar "${cat.label}"` : 'Agregar al sistema de inventario'}</p>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nombre</label>
          <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Ej: Mobiliario escolar" maxLength={50} autoFocus
            onKeyDown={e => e.key === 'Enter' && guardar()}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1.5px solid #e5e7eb', fontSize: 14, color: '#111827', outline: 'none', boxSizing: 'border-box' }}
            onFocus={e => e.target.style.borderColor = '#6366f1'}
            onBlur={e => e.target.style.borderColor = '#e5e7eb'}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ícono</label>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', maxHeight: 120, overflowY: 'auto' }}>
            {ICONOS.map(ic => (
              <button key={ic} onClick={() => setIcon(ic)}
                style={{ fontSize: 18, padding: '5px 6px', borderRadius: 8, border: `2px solid ${icon === ic ? '#6366f1' : '#e5e7eb'}`, background: icon === ic ? '#eef2ff' : '#fff', cursor: 'pointer', lineHeight: 1, transition: 'all 0.12s' }}>
                {ic}
              </button>
            ))}
          </div>
        </div>

        {error && <p style={{ margin: 0, fontSize: 12, color: '#dc2626', background: '#fef2f2', padding: '8px 12px', borderRadius: 8, border: '1px solid #fecaca' }}>⚠️ {error}</p>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose}
            style={{ padding: '9px 18px', borderRadius: 9, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={guardar} disabled={guardando}
            style={{ padding: '9px 22px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: guardando ? 'wait' : 'pointer', opacity: guardando ? 0.75 : 1, boxShadow: '0 4px 12px rgba(99,102,241,0.4)' }}>
            {guardando ? '⏳ Guardando…' : esEdicion ? 'Guardar cambios' : 'Crear categoría'}
          </button>
        </div>
      </div>
    </div>
  )
}

const CAMPOS_FIJOS_PREVIEW = [
  { id: 'nombre',      nombre: 'Nombre / descripción', tipo: 'texto',  requerido: true },
  { id: 'cantidad',    nombre: 'Cantidad',             tipo: 'numero' },
  { id: 'estado',      nombre: 'Estado',               tipo: 'select', opciones: ['Bueno', 'Regular', 'Malo'] },
  { id: 'ubicacion',   nombre: 'Ubicación',            tipo: 'texto'  },
  { id: 'responsable', nombre: 'Responsable',          tipo: 'texto'  },
]

function MockField({ nombre, tipo, requerido, opciones, fijo }) {
  const tc   = TIPO_COLOR[tipo] || '#6b7280'
  const base = { width: '100%', padding: '6px 10px', borderRadius: 7, border: '1.5px solid #e5e7eb', fontSize: 11, background: '#fff', color: '#374151', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 700, color: fijo ? '#6b7280' : tc, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {nombre}
        {requerido && <span style={{ color: '#ef4444' }}>*</span>}
      </label>
      {tipo === 'fecha'     ? <input type="date" readOnly style={base} />
      : tipo === 'booleano' ? (
        <select disabled style={base}>
          <option>Sí</option><option>No</option>
        </select>
      ) : tipo === 'select' ? (
        <select disabled style={base}>
          {(opciones?.length ? opciones : ['Seleccionar…']).map(o => <option key={o}>{o}</option>)}
        </select>
      ) : (
        <input readOnly type={tipo === 'numero' ? 'number' : 'text'} placeholder={`${nombre}…`} style={{ ...base, color: '#9ca3af' }} />
      )}
    </div>
  )
}

function PreviewFormulario({ catObj, sistemaCamposVisibles, camposNombres, campos }) {
  const total = CAMPOS_FIJOS_PREVIEW.length + sistemaCamposVisibles.length + campos.length
  return (
    <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.06)', border: '1px solid #e5e7eb' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', background: 'linear-gradient(135deg,#1a237e 0%,#2563eb 100%)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -16, right: -16, width: 70, height: 70, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
            {catObj.icon || '📦'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{catObj.label}</p>
            <p style={{ margin: 0, fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>Vista previa · {total} campo{total !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      {/* Form mock */}
      <div style={{ padding: '14px 14px 16px', display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 530, overflowY: 'auto' }}>
        {/* Campos fijos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {CAMPOS_FIJOS_PREVIEW.map(c => <MockField key={c.id} {...c} fijo />)}
        </div>

        {/* Campos del sistema */}
        {sistemaCamposVisibles.length > 0 && (
          <div style={{ paddingTop: 8, marginTop: 2, borderTop: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,#c7d2fe,transparent)' }} />
              <span style={{ fontSize: 8, fontWeight: 800, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>Categoría</span>
              <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,transparent,#c7d2fe)' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sistemaCamposVisibles.map(c => (
                <MockField key={c.id} nombre={camposNombres[c.id] || c.nombre} tipo={c.tipo} opciones={c.opciones} />
              ))}
            </div>
          </div>
        )}

        {/* Campos personalizados */}
        {campos.length > 0 && (
          <div style={{ paddingTop: 8, marginTop: 2, borderTop: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,#bbf7d0,transparent)' }} />
              <span style={{ fontSize: 8, fontWeight: 800, color: '#6ee7b7', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>Personalizados</span>
              <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,transparent,#bbf7d0)' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {campos.map(c => (
                <MockField key={c.id} nombre={c.nombre} tipo={c.tipo} opciones={c.opciones} requerido={c.requerido} />
              ))}
            </div>
          </div>
        )}

        {sistemaCamposVisibles.length === 0 && campos.length === 0 && (
          <p style={{ margin: '4px 0 0', fontSize: 10, color: '#d1d5db', textAlign: 'center', fontStyle: 'italic' }}>Solo campos básicos</p>
        )}
      </div>
    </div>
  )
}

export default function CamposCategoria({ usuario }) {
  const esAdmin = usuario?.rol === 'admin'

  const [categorias,      setCategorias]      = useState([])
  const [catActiva,       setCatActiva]       = useState(null)
  const [campos,          setCampos]          = useState([])
  const [cargando,        setCargando]        = useState(true)
  const [guardando,       setGuardando]       = useState(false)
  const [exito,           setExito]           = useState(false)
  const [error,           setError]           = useState('')

  // Formulario campo
  const [nuevoNombre,     setNuevoNombre]     = useState('')
  const [nuevoTipo,       setNuevoTipo]       = useState('texto')
  const [nuevoReq,        setNuevoReq]        = useState(false)
  const [nuevoOpts,       setNuevoOpts]       = useState('')
  const [editandoCampoId, setEditandoCampoId] = useState(null)

  const [camposOcultos,        setCamposOcultos]        = useState([])
  const [sistemaCamposExpanded, setSistemaCamposExpanded] = useState(false)
  const [editandoSistema,       setEditandoSistema]       = useState(null)
  const [camposNombres,         setCamposNombres]         = useState({})
  const [camposOrden,           setCamposOrden]           = useState([])

  // Drag & drop
  const [dragInfo,   setDragInfo]   = useState(null) // { id, tipo: 'sistema'|'custom' }
  const [dragOverId, setDragOverId] = useState(null)

  // Modales categoría
  const [modalCat,        setModalCat]        = useState(null) // null | 'nueva' | cat_obj (edición)
  const [confirmBorrar,   setConfirmBorrar]   = useState(null) // cat obj
  const [borrandoCat,     setBorrandoCat]     = useState(false)

  useEffect(() => { cargarCategorias() }, []) // eslint-disable-line

  async function cargarCategorias() {
    setCargando(true)
    const { data } = await supabase.from('categorias').select('id, label, icon, campos_personalizados, campos_ocultos, campos_nombres, campos_orden, fija').order('label')
    if (data) {
      setCategorias(data)
      if (data.length > 0) {
        const target = (catActiva && data.find(c => c.id === catActiva)) || data[0]
        setCatActiva(target.id)
        setCampos(target.campos_personalizados || [])
        setCamposOcultos(target.campos_ocultos  || [])
        setCamposNombres(target.campos_nombres  || {})
        setCamposOrden(target.campos_orden      || [])
      }
    }
    setCargando(false)
  }

  async function seleccionarCat(cat) {
    setCatActiva(cat.id)
    setError(''); setExito(false); resetForm()
    const { data } = await supabase
      .from('categorias')
      .select('campos_personalizados, campos_ocultos, campos_nombres, campos_orden')
      .eq('id', cat.id)
      .single()
    setCampos(data?.campos_personalizados || [])
    setCamposOcultos(data?.campos_ocultos  || [])
    setCamposNombres(data?.campos_nombres  || {})
    setCamposOrden(data?.campos_orden      || [])
    setSistemaCamposExpanded(false)
    setEditandoSistema(null)
  }

  function resetForm() {
    setNuevoNombre(''); setNuevoTipo('texto'); setNuevoReq(false); setNuevoOpts('')
    setEditandoCampoId(null)
  }

  // ── Campos ────────────────────────────────────────────────

  function iniciarEditarCampo(campo) {
    setEditandoCampoId(campo.id)
    setNuevoNombre(campo.nombre); setNuevoTipo(campo.tipo)
    setNuevoReq(campo.requerido || false)
    setNuevoOpts((campo.opciones || []).join(', '))
    setError('')
  }

  function agregarOActualizarCampo() {
    const nombre = nuevoNombre.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    if (!nombre) { setError('El nombre del campo es obligatorio'); return }
    if (CAMPOS_SISTEMA.includes(nombre)) { setError(`"${nombre}" es un nombre reservado del sistema`); return }
    const nuevoCampo = {
      id:        editandoCampoId || nombre,
      nombre:    nuevoNombre.trim(),
      tipo:      nuevoTipo,
      requerido: nuevoReq,
      ...(nuevoTipo === 'select' && nuevoOpts.trim()
        ? { opciones: nuevoOpts.split(',').map(o => o.trim()).filter(Boolean) }
        : {}),
    }
    if (editandoCampoId) {
      setCampos(prev => prev.map(c => c.id === editandoCampoId ? nuevoCampo : c))
    } else {
      if (campos.some(c => c.id === nombre)) { setError('Ya existe un campo con ese nombre'); return }
      setCampos(prev => [...prev, nuevoCampo])
    }
    resetForm(); setError('')
  }

  function eliminarCampo(id) {
    setCampos(prev => prev.filter(c => c.id !== id))
    if (editandoCampoId === id) resetForm()
  }

  async function guardar() {
    if (!catActiva) return
    setGuardando(true); setError(''); setExito(false)
    const { error: err } = await supabase.from('categorias')
      .update({ campos_personalizados: campos, campos_ocultos: camposOcultos, campos_nombres: camposNombres, campos_orden: camposOrden })
      .eq('id', catActiva)
    if (err) { setError('Error al guardar: ' + err.message) }
    else {
      const { data: fresh } = await supabase.from('categorias').select('campos_personalizados, campos_ocultos, campos_nombres, campos_orden').eq('id', catActiva).single()
      const camposGuardados  = fresh?.campos_personalizados || []
      const ocultosGuardados = fresh?.campos_ocultos        || []
      const nombresGuardados = fresh?.campos_nombres        || {}
      const ordenGuardado    = fresh?.campos_orden          || []
      setCampos(camposGuardados)
      setCamposOcultos(ocultosGuardados)
      setCamposNombres(nombresGuardados)
      setCamposOrden(ordenGuardado)
      setCategorias(prev => prev.map(c => c.id === catActiva ? { ...c, campos_personalizados: camposGuardados, campos_ocultos: ocultosGuardados, campos_nombres: nombresGuardados, campos_orden: ordenGuardado } : c))
      setExito(true); setTimeout(() => setExito(false), 3000)
    }
    setGuardando(false)
  }

  async function guardarNombres(newNombres) {
    if (!catActiva) return
    await supabase.from('categorias').update({ campos_nombres: newNombres }).eq('id', catActiva)
  }

  async function guardarOrden(newOrden) {
    if (!catActiva) return
    await supabase.from('categorias').update({ campos_orden: newOrden }).eq('id', catActiva)
  }

  function moverItem(arr, fromId, toId) {
    const from = arr.findIndex(x => (typeof x === 'string' ? x : x.id) === fromId)
    const to   = arr.findIndex(x => (typeof x === 'string' ? x : x.id) === toId)
    if (from === -1 || to === -1 || from === to) return arr
    const next = [...arr]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    return next
  }

  function handleDropSistema(targetId) {
    if (!dragInfo || dragInfo.tipo !== 'sistema' || dragInfo.id === targetId) return
    const base     = getCamposSistema(catObj).map(c => c.id)
    const current  = camposOrden.length ? camposOrden : base
    const newOrden = moverItem(current.filter(id => base.includes(id)), dragInfo.id, targetId)
    setCamposOrden(newOrden)
    guardarOrden(newOrden)
  }

  function handleDropCustom(targetId) {
    if (!dragInfo || dragInfo.tipo !== 'custom' || dragInfo.id === targetId) return
    setCampos(prev => moverItem(prev, dragInfo.id, targetId))
  }

  // ── Categorías ────────────────────────────────────────────

  async function handleGuardarCat({ label, icon }) {
    if (modalCat === 'nueva') {
      const id = label.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'')
      if (!id) return
      if (categorias.some(c => c.id === id)) return
      const { data, error: err } = await supabase.from('categorias')
        .insert({ id, label, icon, fija: false, campos_personalizados: [] }).select().single()
      if (err) { throw new Error(err.message) }
      const nuevas = [...categorias, data].sort((a, b) => a.label.localeCompare(b.label))
      setCategorias(nuevas); setModalCat(null)
      setCatActiva(data.id); setCampos([])
    } else {
      const { error: err } = await supabase.from('categorias').update({ label, icon }).eq('id', modalCat.id)
      if (err) { throw new Error(err.message) }
      setCategorias(prev => prev.map(c => c.id === modalCat.id ? { ...c, label, icon } : c))
      setModalCat(null)
    }
  }

  async function borrarCategoria() {
    if (!confirmBorrar) return
    setBorrandoCat(true)
    const { error: err } = await supabase.from('categorias').delete().eq('id', confirmBorrar.id)
    setBorrandoCat(false)
    if (err) {
      setError('No se puede eliminar: ' + (err.message.includes('foreign') ? 'hay bienes registrados en esta categoría' : err.message))
      setConfirmBorrar(null); return
    }
    const restantes = categorias.filter(c => c.id !== confirmBorrar.id)
    setCategorias(restantes); setConfirmBorrar(null)
    if (catActiva === confirmBorrar.id) {
      const sig = restantes[0]
      if (sig) { setCatActiva(sig.id); setCampos(sig.campos_personalizados || []) }
      else { setCatActiva(null); setCampos([]) }
    }
  }

  const catObj  = categorias.find(c => c.id === catActiva)
  const tipoObj = TIPOS.find(t => t.value === nuevoTipo)

  const _base   = catObj ? getCamposSistema(catObj) : []
  const _sorted = camposOrden.length
    ? [..._base].sort((a, b) => { const ia = camposOrden.indexOf(a.id), ib = camposOrden.indexOf(b.id); if (ia === -1 && ib === -1) return 0; if (ia === -1) return 1; if (ib === -1) return -1; return ia - ib })
    : _base
  const sistemaCamposVisibles = _sorted.filter(c => !camposOcultos.includes(c.id))

  if (cargando) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', color: 'rgba(255,255,255,0.5)', flexDirection: 'column', gap: 14 }}>
      <div style={{ width: 32, height: 32, border: '3px solid rgba(255,255,255,0.15)', borderTopColor: '#d4a017', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>
      <span style={{ fontSize: 13 }}>Cargando categorías…</span>
    </div>
  )

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Cabecera */}
      <div style={{ background: 'linear-gradient(135deg,#1a237e 0%,#2563eb 100%)', borderRadius: 16, padding: '20px 24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -20, right: -20, width: 110, height: 110, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ position: 'absolute', bottom: -30, right: 60, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative' }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🗂️</div>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#fff' }}>Campos por categoría</h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Define qué información adicional se registra en cada tipo de bien</p>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <p style={{ margin: 0, fontSize: 13, color: '#dc2626' }}>{error}</p>
          <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 16, lineHeight: 1 }}>✕</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* ── Lista categorías ──────────────────────────── */}
        <div style={{ width: 220, flexShrink: 0, background: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #f1f1f3', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Categorías</p>
            {esAdmin && (
              <button onClick={() => setModalCat('nueva')}
                style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'linear-gradient(135deg,#6366f1,#4f46e5)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 7, lineHeight: 1.6 }}>
                + Nueva
              </button>
            )}
          </div>

          <div style={{ padding: '6px 0' }}>
            {categorias.map(cat => {
              const nCampos = (cat.campos_personalizados || []).length
              const activa  = cat.id === catActiva
              return (
                <div key={cat.id} onClick={() => seleccionarCat(cat)} className="ajustes-cat-item"
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px 9px 12px', cursor: 'pointer',
                    background: activa ? 'rgba(99,102,241,0.08)' : 'transparent',
                    borderLeft: `3px solid ${activa ? '#6366f1' : 'transparent'}`,
                    transition: 'all 0.14s' }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{cat.icon || '📦'}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: activa ? 700 : 400, color: activa ? '#4338ca' : '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.label}</span>
                  <div style={{ display: 'flex', gap: 1, flexShrink: 0, opacity: 0 }} className="ajustes-cat-actions">
                    {esAdmin && (
                      <>
                        <button onClick={e => { e.stopPropagation(); setModalCat(cat) }}
                          title="Editar categoría"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 12, padding: '2px 4px', borderRadius: 4, lineHeight: 1 }}
                          onMouseOver={e => { e.currentTarget.style.color = '#6366f1'; e.currentTarget.style.background = '#eef2ff' }}
                          onMouseOut={e => { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.background = 'none' }}>✏️</button>
                        <button onClick={e => { e.stopPropagation(); setConfirmBorrar(cat) }}
                          title="Eliminar categoría"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 12, padding: '2px 4px', borderRadius: 4, lineHeight: 1 }}
                          onMouseOver={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = '#fef2f2' }}
                          onMouseOut={e => { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.background = 'none' }}>🗑️</button>
                      </>
                    )}
                  </div>
                  {nCampos > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 700, background: '#6366f1', color: '#fff', borderRadius: 10, padding: '1px 6px', flexShrink: 0, lineHeight: 1.6 }}>{nCampos}</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Panel derecho ─────────────────────────────── */}
        {catObj && (
          <>
          <div style={{ flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Header categoría activa */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 46, height: 46, borderRadius: 14, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0, border: '1px solid rgba(255,255,255,0.15)' }}>
                {catObj.icon || '📦'}
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>{catObj.label}</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                  {campos.length === 0 ? 'Sin campos personalizados aún' : `${campos.length} campo${campos.length !== 1 ? 's' : ''} configurado${campos.length !== 1 ? 's' : ''}`}
                </p>
              </div>
            </div>

            {/* ── Campos del sistema ────────────────────── */}
            {(() => {
              const base = getCamposSistema(catObj)
              if (!base.length) return null
              const sistemaCampos = camposOrden.length
                ? [...base].sort((a, b) => {
                    const ia = camposOrden.indexOf(a.id), ib = camposOrden.indexOf(b.id)
                    if (ia === -1 && ib === -1) return 0
                    if (ia === -1) return 1; if (ib === -1) return -1
                    return ia - ib
                  })
                : base
              const nOcultos = camposOcultos.filter(id => base.some(c => c.id === id)).length
              return (
                <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #f1f1f3', overflow: 'hidden' }}>
                  {/* Header colapsable */}
                  <div
                    onClick={() => setSistemaCamposExpanded(p => !p)}
                    style={{ padding: '12px 16px 10px', borderBottom: sistemaCamposExpanded ? '1px solid #f3f4f6' : 'none', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ width: 18, height: 18, borderRadius: 6, background: 'linear-gradient(135deg,#64748b,#475569)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />
                    </div>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Campos del sistema</p>
                    {!sistemaCamposExpanded && (
                      <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 2 }}>
                        {base.length} campos
                        {nOcultos > 0 && <span style={{ marginLeft: 4, background: '#fef3c7', color: '#d97706', borderRadius: 5, padding: '0 5px', fontSize: 9, fontWeight: 700 }}>{nOcultos} oculto{nOcultos !== 1 ? 's' : ''}</span>}
                      </span>
                    )}
                    <span style={{ marginLeft: 'auto', fontSize: 13, color: '#94a3b8', display: 'inline-block', transform: sistemaCamposExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', lineHeight: 1 }}>▾</span>
                  </div>

                  {/* Lista (solo cuando expandido) */}
                  {sistemaCamposExpanded && (
                    <div>
                      {sistemaCampos.map((campo, idx) => {
                        const oculto         = camposOcultos.includes(campo.id)
                        const tc             = TIPO_COLOR[campo.tipo] || '#6b7280'
                        const ti             = TIPOS.find(t => t.value === campo.tipo)
                        const nombreMostrado = camposNombres[campo.id] || campo.nombre
                        const estaEditando   = editandoSistema?.id === campo.id
                        const isDragOver     = dragOverId === campo.id && dragInfo?.tipo === 'sistema'

                        function confirmarRenombre(val) {
                          setCamposNombres(prev => {
                            const next = { ...prev }
                            if (val && val !== campo.nombre) next[campo.id] = val
                            else delete next[campo.id]
                            guardarNombres(next)
                            return next
                          })
                          setEditandoSistema(null)
                        }

                        return (
                          <div key={campo.id}
                            onDragOver={e => { e.preventDefault(); setDragOverId(campo.id) }}
                            onDrop={e => { e.preventDefault(); handleDropSistema(campo.id); setDragOverId(null) }}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px 9px 0',
                              borderTop: isDragOver ? '2px solid #6366f1' : idx === 0 ? 'none' : '1px solid #f3f4f6',
                              borderLeft: `3px solid ${oculto ? '#e2e8f0' : tc}`,
                              background: dragInfo?.id === campo.id ? '#f0f4ff' : oculto ? '#fafafa' : '#fff',
                              transition: 'all 0.15s' }}>

                            {/* Drag handle */}
                            <div draggable
                              onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; setDragInfo({ id: campo.id, tipo: 'sistema' }) }}
                              onDragEnd={() => { setDragInfo(null); setDragOverId(null) }}
                              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 2px', cursor: 'grab', padding: '2px 8px 2px 10px', flexShrink: 0 }}>
                              {[0,1,2,3,4,5].map(i => <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: oculto ? '#e2e8f0' : '#d1d5db' }} />)}
                            </div>

                            {/* Ícono tipo */}
                            <div style={{ width: 28, height: 28, borderRadius: 8, background: oculto ? '#f1f5f9' : `${tc}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>
                              {ti?.icon || '📝'}
                            </div>

                            {/* Nombre + tipo */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {estaEditando ? (
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                  <input
                                    autoFocus
                                    defaultValue={nombreMostrado}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter')  confirmarRenombre(e.target.value.trim())
                                      if (e.key === 'Escape') setEditandoSistema(null)
                                    }}
                                    onBlur={e => confirmarRenombre(e.target.value.trim())}
                                    style={{ flex: 1, padding: '4px 8px', borderRadius: 7, border: '1.5px solid #6366f1', fontSize: 12, outline: 'none', color: '#111827', background: '#f8f9ff', boxSizing: 'border-box' }}
                                  />
                                  <button onClick={() => setEditandoSistema(null)}
                                    style={{ padding: '4px 8px', borderRadius: 7, border: '1px solid #e5e7eb', background: '#fff', fontSize: 11, color: '#6b7280', cursor: 'pointer', flexShrink: 0 }}>✕</button>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: 13, fontWeight: 500, color: oculto ? '#94a3b8' : '#1e293b', textDecoration: oculto ? 'line-through' : 'none' }}>
                                    {nombreMostrado}
                                  </span>
                                  {camposNombres[campo.id] && (
                                    <span style={{ fontSize: 9, color: '#cbd5e1', fontStyle: 'italic' }}>{campo.nombre}</span>
                                  )}
                                  <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 5, background: oculto ? '#f1f5f9' : `${tc}15`, color: oculto ? '#94a3b8' : tc, letterSpacing: '0.02em' }}>{ti?.label}</span>
                                </div>
                              )}
                            </div>

                            {/* Acciones */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                              {!oculto && !estaEditando && (
                                <button
                                  onClick={e => { e.stopPropagation(); setEditandoSistema({ id: campo.id }) }}
                                  title="Renombrar"
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', fontSize: 12, padding: '4px', borderRadius: 6, lineHeight: 1 }}
                                  onMouseOver={e => { e.currentTarget.style.color = '#6366f1'; e.currentTarget.style.background = '#eef2ff' }}
                                  onMouseOut={e => { e.currentTarget.style.color = '#cbd5e1'; e.currentTarget.style.background = 'none' }}>
                                  ✏️
                                </button>
                              )}
                              {/* Toggle switch */}
                              <div
                                onClick={e => { e.stopPropagation(); setCamposOcultos(prev => oculto ? prev.filter(id => id !== campo.id) : [...prev, campo.id]) }}
                                title={oculto ? 'Activar campo' : 'Desactivar campo'}
                                style={{ width: 40, height: 22, borderRadius: 11, background: oculto ? '#e2e8f0' : '#bbf7d0', border: `1.5px solid ${oculto ? '#cbd5e1' : '#86efac'}`, cursor: 'pointer', transition: 'all 0.2s', position: 'relative', flexShrink: 0 }}>
                                <div style={{ position: 'absolute', top: 2, left: oculto ? 2 : 18, width: 14, height: 14, borderRadius: '50%', background: oculto ? '#94a3b8' : '#16a34a', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }} />
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Campos personalizados existentes */}
            {campos.length > 0 && (
              <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #f1f1f3', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 18, height: 18, borderRadius: 6, background: 'linear-gradient(135deg,#6366f1,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />
                  </div>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: '#4338ca', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Campos personalizados</p>
                  <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', borderRadius: 10, padding: '2px 8px' }}>{campos.length}</span>
                </div>
                <div>
                  {campos.map((campo, idx) => {
                    const tc         = TIPO_COLOR[campo.tipo] || '#6b7280'
                    const ti         = TIPOS.find(t => t.value === campo.tipo)
                    const editando   = editandoCampoId === campo.id
                    const isDragOver = dragOverId === campo.id && dragInfo?.tipo === 'custom'
                    return (
                      <div key={campo.id}
                        onDragOver={e => { e.preventDefault(); setDragOverId(campo.id) }}
                        onDrop={e => { e.preventDefault(); handleDropCustom(campo.id); setDragOverId(null) }}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px 10px 0',
                          borderTop: isDragOver ? '2px solid #6366f1' : idx === 0 ? 'none' : '1px solid #f3f4f6',
                          borderLeft: `3px solid ${editando ? '#fcd34d' : tc}`,
                          background: dragInfo?.id === campo.id ? '#f0f4ff' : editando ? '#fffbeb' : '#fff',
                          transition: 'all 0.15s' }}>

                        {/* Drag handle */}
                        <div draggable
                          onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; setDragInfo({ id: campo.id, tipo: 'custom' }) }}
                          onDragEnd={() => { setDragInfo(null); setDragOverId(null) }}
                          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 2px', cursor: 'grab', padding: '2px 8px 2px 10px', flexShrink: 0 }}>
                          {[0,1,2,3,4,5].map(i => <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: '#d1d5db' }} />)}
                        </div>

                        {/* Ícono tipo */}
                        <div style={{ width: 32, height: 32, borderRadius: 9, background: `${tc}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>
                          {ti?.icon || '📝'}
                        </div>

                        {/* Nombre + meta */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{campo.nombre}</p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 5, background: `${tc}15`, color: tc, letterSpacing: '0.02em' }}>{ti?.label}</span>
                            {campo.requerido && <span style={{ fontSize: 9, fontWeight: 700, color: '#ef4444', background: '#fef2f2', padding: '1px 5px', borderRadius: 5 }}>Requerido</span>}
                            {campo.opciones?.length > 0 && <span style={{ fontSize: 9, color: '#94a3b8' }}>{campo.opciones.slice(0,3).join(' · ')}{campo.opciones.length > 3 ? ' …' : ''}</span>}
                          </div>
                        </div>

                        {/* Acciones */}
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <button onClick={e => { e.stopPropagation(); iniciarEditarCampo(campo) }}
                            title="Editar campo"
                            style={{ background: editando ? '#fef9c3' : 'none', border: editando ? '1px solid #fcd34d' : 'none', cursor: 'pointer', color: editando ? '#d97706' : '#cbd5e1', fontSize: 13, padding: '5px 7px', borderRadius: 7, lineHeight: 1 }}
                            onMouseOver={e => { if (!editando) { e.currentTarget.style.color = '#d97706'; e.currentTarget.style.background = '#fef9c3' } }}
                            onMouseOut={e => { if (!editando) { e.currentTarget.style.color = '#cbd5e1'; e.currentTarget.style.background = 'none' } }}>
                            ✏️
                          </button>
                          <button onClick={e => { e.stopPropagation(); eliminarCampo(campo.id) }}
                            title="Eliminar campo"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e2e8f0', fontSize: 13, padding: '5px 7px', borderRadius: 7, lineHeight: 1 }}
                            onMouseOver={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = '#fef2f2' }}
                            onMouseOut={e => { e.currentTarget.style.color = '#e2e8f0'; e.currentTarget.style.background = 'none' }}>
                            ✕
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Formulario agregar / editar campo */}
            <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', border: `1.5px solid ${editandoCampoId ? '#fcd34d' : '#f1f1f3'}`, overflow: 'hidden', transition: 'border-color 0.2s' }}>
              <div style={{ padding: '13px 18px 11px', borderBottom: `1px solid ${editandoCampoId ? '#fde68a' : '#f3f4f6'}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: editandoCampoId ? '#d97706' : '#10b981' }} />
                <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: editandoCampoId ? '#d97706' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {editandoCampoId ? '✏️ Editando campo' : '+ Agregar campo'}
                </p>
              </div>
              <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ flex: '2 1 160px' }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Nombre del campo</label>
                    <input value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)}
                      placeholder="Ej: Color, N° de serie..."
                      onKeyDown={e => e.key === 'Enter' && agregarOActualizarCampo()}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #e5e7eb', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#111827', transition: 'border-color 0.15s' }}
                      onFocus={e => e.target.style.borderColor = '#6366f1'}
                      onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                    />
                  </div>
                  <div style={{ flex: '1 1 130px' }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Tipo</label>
                    <select value={nuevoTipo} onChange={e => setNuevoTipo(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #e5e7eb', fontSize: 13, outline: 'none', background: '#fff', color: '#111827', boxSizing: 'border-box' }}>
                      {TIPOS.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                    </select>
                  </div>
                </div>

                {/* Info tipo seleccionado */}
                {tipoObj && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, background: `${TIPO_COLOR[nuevoTipo]}10`, border: `1px solid ${TIPO_COLOR[nuevoTipo]}25` }}>
                    <span style={{ fontSize: 14 }}>{tipoObj.icon}</span>
                    <span style={{ fontSize: 11, color: TIPO_COLOR[nuevoTipo], fontWeight: 600 }}>
                      {nuevoTipo === 'texto'    && 'Campo de texto libre'}
                      {nuevoTipo === 'numero'   && 'Solo acepta valores numéricos'}
                      {nuevoTipo === 'fecha'    && 'Selector de fecha con calendario'}
                      {nuevoTipo === 'booleano' && 'Menú Sí / No'}
                      {nuevoTipo === 'select'   && 'Lista desplegable con opciones fijas'}
                    </span>
                  </div>
                )}

                {nuevoTipo === 'select' && (
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Opciones (separadas por coma)</label>
                    <input value={nuevoOpts} onChange={e => setNuevoOpts(e.target.value)}
                      placeholder="Ej: Rojo, Verde, Azul"
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #e5e7eb', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#111827' }}
                      onFocus={e => e.target.style.borderColor = '#6366f1'}
                      onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                    />
                  </div>
                )}

                {error && <p style={{ margin: 0, fontSize: 12, color: '#dc2626', background: '#fef2f2', padding: '8px 12px', borderRadius: 8, border: '1px solid #fecaca' }}>⚠️ {error}</p>}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#374151' }}>
                    <input type="checkbox" checked={nuevoReq} onChange={e => setNuevoReq(e.target.checked)} style={{ width: 15, height: 15, accentColor: '#6366f1' }} />
                    Campo requerido
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {editandoCampoId && (
                      <button onClick={resetForm}
                        style={{ padding: '8px 16px', borderRadius: 9, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        Cancelar
                      </button>
                    )}
                    <button onClick={agregarOActualizarCampo}
                      style={{ padding: '9px 20px', borderRadius: 9, border: 'none',
                        background: editandoCampoId ? 'linear-gradient(135deg,#d97706,#b45309)' : 'linear-gradient(135deg,#6366f1,#4f46e5)',
                        color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                        boxShadow: editandoCampoId ? '0 4px 12px rgba(217,119,6,0.35)' : '0 4px 12px rgba(99,102,241,0.35)' }}>
                      {editandoCampoId ? '✓ Actualizar campo' : '+ Agregar campo'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Guardar */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 8 }}>
              {exito && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#059669', fontWeight: 600, background: '#f0fdf4', padding: '7px 12px', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                  ✓ Cambios guardados
                </div>
              )}
              <button onClick={guardar} disabled={guardando}
                style={{ padding: '10px 26px', borderRadius: 10, border: 'none',
                  background: 'linear-gradient(135deg,#1a237e,#2563eb)', color: '#fff',
                  fontSize: 13, fontWeight: 700, cursor: guardando ? 'wait' : 'pointer',
                  opacity: guardando ? 0.75 : 1, boxShadow: '0 4px 14px rgba(26,35,126,0.35)',
                  display: 'flex', alignItems: 'center', gap: 8 }}>
                {guardando ? '⏳ Guardando…' : '💾 Guardar cambios'}
              </button>
            </div>
          </div>

          {/* ── Vista previa ─────────────────────────────── */}
          <div style={{ width: 252, flexShrink: 0, alignSelf: 'flex-start', position: 'sticky', top: 16 }}>
            <PreviewFormulario
              catObj={catObj}
              sistemaCamposVisibles={sistemaCamposVisibles}
              camposNombres={camposNombres}
              campos={campos}
            />
          </div>
          </>
        )}
      </div>

      {/* CSS hover para botones de categoría */}
      <style>{`
        .ajustes-cat-item:hover .ajustes-cat-actions { opacity: 1 !important; }
        .ajustes-cat-item:hover { background: rgba(99,102,241,0.04) !important; }
      `}</style>

      {/* ── Modal crear / editar categoría ─────────────── */}
      {modalCat && (
        <ModalCategoria
          cat={modalCat === 'nueva' ? null : modalCat}
          onClose={() => setModalCat(null)}
          onSave={handleGuardarCat}
        />
      )}

      {/* ── Modal confirmar borrar categoría ─────────── */}
      {confirmBorrar && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,12,55,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 900 }}
          onClick={() => setConfirmBorrar(null)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '26px 28px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', maxWidth: 380, width: '90%', display: 'flex', flexDirection: 'column', gap: 16 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🗑️</div>
              <div>
                <p style={{ margin: '0 0 6px', fontWeight: 800, fontSize: 15, color: '#111827' }}>¿Eliminar "{confirmBorrar.label}"?</p>
                <p style={{ margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
                  Esta acción es permanente. Si hay bienes registrados en esta categoría, la operación no podrá completarse.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmBorrar(null)}
                style={{ padding: '9px 18px', borderRadius: 9, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={borrarCategoria} disabled={borrandoCat}
                style={{ padding: '9px 20px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#ef4444,#dc2626)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: borrandoCat ? 'wait' : 'pointer', opacity: borrandoCat ? 0.75 : 1, boxShadow: '0 4px 12px rgba(239,68,68,0.35)' }}>
                {borrandoCat ? 'Eliminando…' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
