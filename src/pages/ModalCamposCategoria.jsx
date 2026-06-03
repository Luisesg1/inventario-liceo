import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
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

const TIPO_COLOR = { texto: '#6366f1', numero: '#0ea5e9', fecha: '#8b5cf6', booleano: '#10b981', select: '#f59e0b' }

const CAMPOS_PREDET = {
  computadores: [
    { id: 'numero_serie',        nombre: 'Número de serie',           tipo: 'texto',  _global: true },
    { id: 'codigo',              nombre: 'Código / N° inventario',    tipo: 'texto',  _global: true },
    { id: 'estado',              nombre: 'Estado',                    tipo: 'select', _global: true },
    { id: 'ubicacion',           nombre: 'Ubicación',                 tipo: 'texto',  _global: true },
    { id: 'area',                nombre: 'Área',                      tipo: 'texto',  _global: true },
    { id: 'responsable',         nombre: 'Responsable',               tipo: 'texto',  _global: true },
    { id: 'tipo',                nombre: 'Tipo de equipo',            tipo: 'select' },
    { id: 'marca',               nombre: 'Marca',                     tipo: 'texto'  },
    { id: 'modelo',              nombre: 'Modelo',                    tipo: 'texto'  },
    { id: 'pantalla',            nombre: 'Pantalla',                  tipo: 'texto'  },
    { id: 'cpu_marca',           nombre: 'Marca CPU',                 tipo: 'select' },
    { id: 'cpu_modelo',          nombre: 'Modelo CPU',                tipo: 'texto'  },
    { id: 'cpu_generacion',      nombre: 'Versión / generación CPU',  tipo: 'texto'  },
    { id: 'ram',                 nombre: 'RAM (capacidad)',            tipo: 'texto'  },
    { id: 'ram_tipo',            nombre: 'Tipo RAM',                  tipo: 'select' },
    { id: 'ram_slots',           nombre: 'Slots RAM',                 tipo: 'texto'  },
    { id: 'memoria',             nombre: 'Almacenamiento',            tipo: 'texto'  },
    { id: 'tipo_almacenamiento', nombre: 'Tecnología almacenamiento', tipo: 'select' },
    { id: 'sistema_operativo',   nombre: 'Sistema operativo',         tipo: 'texto'  },
    { id: 'fecha_adquisicion',   nombre: 'Fecha adquisición',         tipo: 'fecha'  },
    { id: 'proveedor',           nombre: 'Proveedor',                 tipo: 'texto'  },
    { id: 'numero_factura',      nombre: 'N° factura',                tipo: 'texto'  },
    { id: 'garantia',            nombre: 'Garantía',                  tipo: 'texto'  },
    { id: 'obs',                 nombre: 'Observaciones',             tipo: 'texto',  _global: true },
  ],
  tecno: [
    { id: 'codigo',             nombre: 'Código / N° inventario',    tipo: 'texto',  _global: true },
    { id: 'cantidad',           nombre: 'Cantidad',                   tipo: 'numero', _global: true },
    { id: 'estado',             nombre: 'Estado',                     tipo: 'select', _global: true },
    { id: 'ubicacion',          nombre: 'Ubicación',                  tipo: 'texto',  _global: true },
    { id: 'area',               nombre: 'Área',                       tipo: 'texto',  _global: true },
    { id: 'responsable',        nombre: 'Responsable',                tipo: 'texto',  _global: true },
    { id: 'tipo',               nombre: 'Tipo',                       tipo: 'texto' },
    { id: 'tecnologia',         nombre: 'Tecnología',                 tipo: 'texto' },
    { id: 'marca',              nombre: 'Marca',                      tipo: 'texto' },
    { id: 'modelo',             nombre: 'Modelo',                     tipo: 'texto' },
    { id: 'numero_serie',       nombre: 'N° de serie',                tipo: 'texto' },
    { id: 'consumible',         nombre: 'Consumible',                 tipo: 'texto' },
    { id: 'fecha_adquisicion',  nombre: 'Fecha adquisición',          tipo: 'fecha' },
    { id: 'proveedor',          nombre: 'Proveedor',                  tipo: 'texto' },
    { id: 'numero_factura',     nombre: 'N° factura',                 tipo: 'texto' },
    { id: 'numero_orden',       nombre: 'N° orden compra',            tipo: 'texto' },
    { id: 'fondo',              nombre: 'Fondo',                      tipo: 'texto' },
    { id: 'garantia',           nombre: 'Garantía',                   tipo: 'texto' },
    { id: 'obs',                nombre: 'Observaciones',              tipo: 'texto',  _global: true },
  ],
  biblio: [
    { id: 'codigo',            nombre: 'Código / N° inventario', tipo: 'texto',  _global: true },
    { id: 'cantidad',          nombre: 'Cantidad',                tipo: 'numero', _global: true },
    { id: 'estado',            nombre: 'Estado',                  tipo: 'select', _global: true },
    { id: 'ubicacion',         nombre: 'Ubicación',               tipo: 'texto',  _global: true },
    { id: 'responsable',       nombre: 'Responsable',             tipo: 'texto',  _global: true },
    { id: 'isbn',              nombre: 'ISBN',                    tipo: 'texto' },
    { id: 'autor',             nombre: 'Autor',                   tipo: 'texto' },
    { id: 'genero',            nombre: 'Género',                  tipo: 'texto' },
    { id: 'fecha_adquisicion', nombre: 'Fecha adquisición',       tipo: 'fecha' },
    { id: 'proveedor',         nombre: 'Proveedor',               tipo: 'texto' },
    { id: 'fondo',             nombre: 'Fondo',                   tipo: 'texto' },
    { id: 'obs',               nombre: 'Observaciones',           tipo: 'texto',  _global: true },
  ],
  generico: [
    { id: 'codigo',            nombre: 'Código / N° inventario', tipo: 'texto',  _global: true },
    { id: 'cantidad',          nombre: 'Cantidad',                tipo: 'numero', _global: true },
    { id: 'estado',            nombre: 'Estado',                  tipo: 'select', _global: true },
    { id: 'ubicacion',         nombre: 'Ubicación',               tipo: 'texto',  _global: true },
    { id: 'responsable',       nombre: 'Responsable',             tipo: 'texto',  _global: true },
    { id: 'fecha_adquisicion', nombre: 'Fecha adquisición',       tipo: 'fecha' },
    { id: 'proveedor',         nombre: 'Proveedor',               tipo: 'texto' },
    { id: 'numero_factura',    nombre: 'N° factura',              tipo: 'texto' },
    { id: 'numero_orden',      nombre: 'N° orden',                tipo: 'texto' },
    { id: 'fondo',             nombre: 'Fondo',                   tipo: 'texto' },
    { id: 'garantia',          nombre: 'Garantía',                tipo: 'texto' },
    { id: 'obs',               nombre: 'Observaciones',           tipo: 'texto',  _global: true },
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

function getCatType(cat) {
  if (!cat) return 'generico'
  if (cat.id === 'computadores') return 'comp'
  const lbl = (cat.label || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (lbl.includes('tecnol')) return 'tecno'
  if (lbl.includes('biblio') || lbl.includes('libreri')) return 'biblio'
  return 'generico'
}

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

const PREVIEW_SECTIONS = {
  tecno: [
    { label: null, ids: ['codigo', 'cantidad', 'estado', 'ubicacion', 'area', 'responsable'], _header: true },
    { label: '🖨️ Datos del equipo', ids: ['tipo', 'tecnologia', 'marca', 'modelo', 'numero_serie', 'consumible'] },
    { label: '🛒 Adquisición',      ids: ['proveedor', 'numero_factura', 'fecha_adquisicion', 'numero_orden', 'fondo', 'garantia'] },
    { label: null, ids: ['obs'], _footer: true },
  ],
  comp: [
    { label: null, ids: ['numero_serie', 'codigo', 'estado', 'ubicacion', 'area', 'responsable'], _header: true },
    { label: '💻 Especificaciones',  ids: ['tipo', 'marca', 'modelo', 'pantalla', 'cpu_marca', 'cpu_modelo', 'cpu_generacion', 'ram', 'ram_tipo', 'ram_slots', 'memoria', 'tipo_almacenamiento', 'sistema_operativo'] },
    { label: '🛒 Adquisición',       ids: ['fecha_adquisicion', 'proveedor', 'fondo', 'numero_factura', 'numero_orden', 'garantia'] },
    { label: null, ids: ['obs'], _footer: true },
  ],
  biblio: [
    { label: null, ids: ['codigo', 'cantidad', 'estado', 'ubicacion', 'responsable'], _header: true },
    { label: '📚 Datos del libro',   ids: ['isbn', 'autor', 'genero'] },
    { label: '🛒 Adquisición',       ids: ['fecha_adquisicion', 'proveedor', 'fondo'] },
    { label: null, ids: ['obs'], _footer: true },
  ],
  generico: [
    { label: null, ids: ['codigo', 'cantidad', 'estado', 'ubicacion', 'responsable'], _header: true },
    { label: '🛒 Adquisición',       ids: ['fecha_adquisicion', 'proveedor', 'numero_factura', 'numero_orden', 'fondo', 'garantia'] },
    { label: null, ids: ['obs'], _footer: true },
  ],
}

function MockField({ nombre, tipo, requerido, opciones, custom }) {
  const tc   = custom ? '#6366f1' : '#64748b'
  const base = { width: '100%', padding: '5px 8px', borderRadius: 6, border: `1.5px solid ${custom ? '#c7d2fe' : '#e5e7eb'}`, fontSize: 10, background: custom ? '#f8f9ff' : '#fff', color: '#374151', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 8, fontWeight: 700, color: tc, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {nombre}{requerido && <span style={{ color: '#ef4444' }}>*</span>}
        {custom && <span style={{ fontSize: 7, background: '#eef2ff', color: '#6366f1', borderRadius: 3, padding: '0 3px', fontWeight: 800 }}>C</span>}
      </label>
      {tipo === 'fecha'     ? <input type="date" readOnly style={base} />
      : tipo === 'booleano' ? <select disabled style={base}><option>Sí</option><option>No</option></select>
      : tipo === 'select'   ? <select disabled style={base}>{(opciones?.length ? opciones : ['Seleccionar…']).map(o => <option key={o}>{o}</option>)}</select>
      : <input readOnly type={tipo === 'numero' ? 'number' : 'text'} placeholder={`${nombre}…`} style={{ ...base, color: '#9ca3af' }} />}
    </div>
  )
}

function PreviewFormulario({ catObj, unifiedVisibleFields, camposNombres }) {
  const catType  = getCatType(catObj)
  const sections = PREVIEW_SECTIONS[catType] || PREVIEW_SECTIONS.generico
  const sectionOf = {}
  sections.forEach((sec, i) => sec.ids.forEach(id => { sectionOf[id] = i }))
  const sectionFields = sections.map(() => [])
  let curSection = 0
  for (const f of unifiedVisibleFields) {
    if (sectionOf[f.id] !== undefined) {
      curSection = sectionOf[f.id]
      sectionFields[curSection].push(f)
    } else if (f._tipo === 'custom') {
      sectionFields[curSection].push(f)
    }
  }
  const total = unifiedVisibleFields.length
  return (
    <div style={{ background: '#f8fafc', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0', fontSize: 11 }}>
      <div style={{ padding: '11px 14px', background: 'linear-gradient(135deg,#1a237e 0%,#2563eb 100%)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -14, right: -14, width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{catObj.icon || '📦'}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {catType === 'comp' ? 'Nuevo computador' : catType === 'tecno' ? 'Nuevo art. tecnológico' : `Nuevo bien · ${catObj.label}`}
            </p>
            <p style={{ margin: 0, fontSize: 8, color: 'rgba(255,255,255,0.55)' }}>Vista previa · {total} campos</p>
          </div>
        </div>
      </div>
      <div style={{ padding: '10px 12px 14px', display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 440, overflowY: 'auto' }}>
        {sections.map((sec, si) => {
          const fields = sectionFields[si]
          if (!fields.length) return null
          if (sec._header) {
            const extraH = fields.filter(f => !['codigo','cantidad','estado','ubicacion','responsable'].includes(f.id))
            return (
              <div key={si}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5 }}>
                  {fields.filter(f => ['codigo','cantidad','estado'].includes(f.id)).map(f => (
                    <MockField key={f.id} nombre={camposNombres[f.id] || f.nombre} tipo={f.tipo} requerido={f.id === 'codigo'} custom={f._tipo === 'custom'} />
                  ))}
                  {extraH.map(f => <MockField key={f.id} nombre={f.nombre} tipo={f.tipo} requerido={f.requerido} custom />)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginTop: 5 }}>
                  {fields.filter(f => ['ubicacion','responsable'].includes(f.id)).map(f => (
                    <MockField key={f.id} nombre={camposNombres[f.id] || f.nombre} tipo={f.tipo} custom={f._tipo === 'custom'} />
                  ))}
                </div>
              </div>
            )
          }
          if (sec._footer) {
            return (
              <div key={si} style={{ marginTop: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 8, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Observaciones</span>
                  <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                </div>
                <div style={{ width: '100%', height: 36, borderRadius: 6, border: '1.5px solid #e5e7eb', background: '#fff', padding: '4px 8px', boxSizing: 'border-box', fontSize: 9, color: '#9ca3af' }}>Observación adicional…</div>
                {fields.filter(f => f._tipo === 'custom').map(f => (
                  <MockField key={f.id} nombre={f.nombre} tipo={f.tipo} requerido={f.requerido} custom />
                ))}
              </div>
            )
          }
          return (
            <div key={si}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '6px 0 5px' }}>
                <span style={{ fontSize: 8, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>{sec.label}</span>
                <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                {fields.map(f => {
                  const nombre = f._tipo === 'sistema' ? (camposNombres[f.id] || f.nombre) : f.nombre
                  return <MockField key={f.id} nombre={nombre} tipo={f.tipo} opciones={f.opciones} requerido={f.requerido} custom={f._tipo === 'custom'} />
                })}
              </div>
            </div>
          )
        })}
        {catType === 'comp' && (
          <div style={{ marginTop: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 8, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Observaciones</span>
              <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
            </div>
            <div style={{ width: '100%', height: 36, borderRadius: 6, border: '1.5px solid #e5e7eb', background: '#fff', padding: '4px 8px', boxSizing: 'border-box', fontSize: 9, color: '#9ca3af' }}>Observación adicional…</div>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
          <div style={{ padding: '6px 14px', borderRadius: 7, background: 'linear-gradient(135deg,#1a237e,#2563eb)', color: '#fff', fontSize: 9, fontWeight: 700 }}>Guardar bien</div>
        </div>
      </div>
    </div>
  )
}

export default function ModalCamposCategoria({ catObj, usuario, onClose, onCatUpdated }) {
  const [campos,       setCampos]       = useState([])
  const [camposOcultos, setCamposOcultos] = useState([])
  const [camposNombres, setCamposNombres] = useState({})
  const [camposOrden,  setCamposOrden]  = useState([])
  const [cargando,     setCargando]     = useState(true)
  const [guardando,    setGuardando]    = useState(false)
  const [exito,        setExito]        = useState(false)
  const [error,        setError]        = useState('')

  const [nuevoNombre,   setNuevoNombre]   = useState('')
  const [nuevoTipo,     setNuevoTipo]     = useState('texto')
  const [nuevoReq,      setNuevoReq]      = useState(false)
  const [nuevoOpts,     setNuevoOpts]     = useState('')
  const [editandoCampoId,       setEditandoCampoId]       = useState(null)
  const [confirmBorrarCampo,   setConfirmBorrarCampo]   = useState(null)
  const [confirmActualizarCampo, setConfirmActualizarCampo] = useState(false)
  const [editandoSistema, setEditandoSistema] = useState(null)
  const [dragInfo,   setDragInfo]   = useState(null)
  const [dragOverId, setDragOverId] = useState(null)

  useEffect(() => {
    console.log('[ModalCamposCategoria] montado/actualizado — catObj:', catObj)
    cargarCategoria()
  }, [catObj?.id]) // eslint-disable-line

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  async function cargarCategoria() {
    console.log('[cargarCategoria] consultando Supabase para catObj.id:', catObj.id)
    setCargando(true)
    const { data, error } = await supabase
      .from('categorias')
      .select('campos_personalizados, campos_ocultos, campos_nombres, campos_orden')
      .eq('id', catObj.id)
      .single()
    console.log('[cargarCategoria] respuesta — data:', data, '| error:', error)
    setCampos(data?.campos_personalizados || [])
    setCamposOcultos(data?.campos_ocultos  || [])
    setCamposNombres(data?.campos_nombres  || {})
    setCamposOrden(data?.campos_orden      || [])
    setCargando(false)
  }

  function resetForm() {
    setNuevoNombre(''); setNuevoTipo('texto'); setNuevoReq(false); setNuevoOpts('')
    setEditandoCampoId(null)
  }

  async function registrarAuditoria(accion, campoNombre, cambios = []) {
    try {
      await supabase.from('audit_logs').insert({
        bien_nombre: campoNombre || null,
        categoria: catObj.label,
        accion,
        cambios,
        usuario_id: usuario?.id || null,
        usuario_nombre: usuario?.nombre || 'Sistema',
        usuario_rol: usuario?.rol || 'desconocido',
        dispositivo: navigator.userAgent.slice(0, 300),
        modulo: 'campos',
      })
    } catch { /* audit is non-critical */ }
  }

  function iniciarEditarCampo(campo) {
    setEditandoCampoId(campo.id)
    setNuevoNombre(campo.nombre)
    setNuevoTipo(campo.tipo)
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
      const anterior = campos.find(c => c.id === editandoCampoId)
      setCampos(prev => prev.map(c => c.id === editandoCampoId ? nuevoCampo : c))
      registrarAuditoria('campo editado', nuevoCampo.nombre, [
        { campo: 'nombre', anterior: anterior?.nombre, nuevo: nuevoCampo.nombre },
        { campo: 'tipo',   anterior: anterior?.tipo,   nuevo: nuevoCampo.tipo },
      ])
    } else {
      if (campos.some(c => c.id === nombre)) { setError('Ya existe un campo con ese nombre'); return }
      setCampos(prev => [...prev, nuevoCampo])
      registrarAuditoria('campo creado', nuevoCampo.nombre, [{ campo: 'tipo', anterior: null, nuevo: nuevoCampo.tipo }])
    }
    resetForm(); setError('')
  }

  function eliminarCampo(id) {
    const campo = campos.find(c => c.id === id)
    setCampos(prev => prev.filter(c => c.id !== id))
    if (editandoCampoId === id) resetForm()
    registrarAuditoria('campo eliminado', campo?.nombre)
  }

  async function guardar() {
    setGuardando(true); setError(''); setExito(false)
    const { error: err } = await supabase.from('categorias')
      .update({ campos_personalizados: campos, campos_ocultos: camposOcultos, campos_nombres: camposNombres, campos_orden: camposOrden })
      .eq('id', catObj.id)
    if (err) {
      setError('Error al guardar: ' + err.message)
    } else {
      const { data: fresh } = await supabase.from('categorias')
        .select('campos_personalizados, campos_ocultos, campos_nombres, campos_orden')
        .eq('id', catObj.id).single()
      setCampos(fresh?.campos_personalizados || [])
      setCamposOcultos(fresh?.campos_ocultos  || [])
      setCamposNombres(fresh?.campos_nombres  || {})
      setCamposOrden(fresh?.campos_orden      || [])
      setExito(true)
      setTimeout(() => setExito(false), 3000)
      onCatUpdated?.()
    }
    setGuardando(false)
  }

  async function guardarNombres(newNombres) {
    await supabase.from('categorias').update({ campos_nombres: newNombres }).eq('id', catObj.id)
    onCatUpdated?.()
  }

  async function guardarOrden(newOrden) {
    const { error: err } = await supabase.from('categorias').update({ campos_orden: newOrden }).eq('id', catObj.id)
    if (err) { setError('No se pudo guardar el orden: ' + err.message); return false }
    onCatUpdated?.()
    return true
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

  async function handleDropUnified(targetId) {
    if (!dragInfo || dragInfo.id === targetId) return
    const newOrder = moverItem([..._fullOrder], dragInfo.id, targetId)
    setCamposOrden(newOrder)
    const ok = await guardarOrden(newOrder)
    if (!ok) await cargarCategoria()
    else registrarAuditoria('campo reordenado', dragInfo.id)
  }

  const _base      = getCamposSistema(catObj)
  const _allFields = [
    ..._base.map(c => ({ ...c, _tipo: 'sistema' })),
    ...campos.map(c => ({ ...c, _tipo: 'custom' })),
  ]
  const _allIds    = _allFields.map(f => f.id)
  const _fullOrder = camposOrden.length
    ? smartMergeOrder(camposOrden.filter(id => _allIds.includes(id)), _allIds)
    : _allIds
  const unifiedSortedFields  = [..._allFields].sort((a, b) => _fullOrder.indexOf(a.id) - _fullOrder.indexOf(b.id))
  const unifiedVisibleFields = unifiedSortedFields.filter(c => c._tipo !== 'sistema' || c._global || !camposOcultos.includes(c.id))
  const tipoObj = TIPOS.find(t => t.value === nuevoTipo)
  const nOcultos = camposOcultos.filter(id => _base.some(c => c.id === id && !c._global)).length

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(5,12,55,0.60)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#f8fafc', borderRadius: 20, width: '100%', maxWidth: 1060, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.30)', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <div style={{ background: 'linear-gradient(135deg,#1a237e 0%,#2563eb 100%)', padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 14, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
          <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
            {catObj.icon || '📦'}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#fff' }}>Configurar campos · {catObj.label}</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Define qué información se registra en cada bien de esta categoría</p>
          </div>
          <button
            onClick={onClose}
            style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.22)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
            title="Cerrar (Esc)"
          >✕</button>
        </div>

        {/* ── Body ───────────────────────────────────────────── */}
        {cargando ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 14, flexDirection: 'column' }}>
            <div style={{ width: 28, height: 28, border: '3px solid #e5e7eb', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'cc-spin 0.7s linear infinite' }} />
            <style>{`@keyframes cc-spin { to { transform:rotate(360deg) } }`}</style>
            <span style={{ fontSize: 13, color: '#64748b' }}>Cargando campos…</span>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 0, flex: 1, overflow: 'hidden' }}>

            {/* ── Columna principal ──────────────────────────── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>

              {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span>⚠️</span>
                  <p style={{ margin: 0, fontSize: 13, color: '#dc2626', flex: 1 }}>{error}</p>
                  <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}>✕</button>
                </div>
              )}

              {/* ── Lista unificada de campos ─────────────────── */}
              <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #f1f1f3', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Campos</p>
                  <span style={{ fontSize: 9, color: '#a5b4fc' }}>· arrastra ⠿ para reordenar</span>
                  {nOcultos > 0 && (
                    <span style={{ background: '#fef3c7', color: '#d97706', borderRadius: 5, padding: '1px 6px', fontSize: 9, fontWeight: 700 }}>
                      {nOcultos} oculto{nOcultos !== 1 ? 's' : ''}
                    </span>
                  )}
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
                    {campos.length > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 700, background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', borderRadius: 10, padding: '2px 7px' }}>
                        {campos.length} custom
                      </span>
                    )}
                    <span style={{ fontSize: 10, color: '#94a3b8' }}>{_allFields.length} total</span>
                  </div>
                </div>

                <div>
                  {unifiedSortedFields.map((campo, idx) => {
                    const isSistema      = campo._tipo === 'sistema'
                    const oculto         = isSistema && !campo._global && camposOcultos.includes(campo.id)
                    const tc             = TIPO_COLOR[campo.tipo] || '#6b7280'
                    const ti             = TIPOS.find(t => t.value === campo.tipo)
                    const nombreMostrado = isSistema ? (camposNombres[campo.id] || campo.nombre) : campo.nombre
                    const estaEditandoS  = isSistema && editandoSistema?.id === campo.id
                    const estaEditandoC  = !isSistema && editandoCampoId === campo.id
                    const isDragOver     = dragOverId === campo.id

                    function confirmarRenombre(val) {
                      setCamposNombres(prev => {
                        const next = { ...prev }
                        if (val && val !== campo.nombre) next[campo.id] = val
                        else delete next[campo.id]
                        guardarNombres(next)
                        if (val && val !== campo.nombre)
                          registrarAuditoria('campo renombrado', campo.nombre, [{ campo: 'nombre', anterior: campo.nombre, nuevo: val }])
                        return next
                      })
                      setEditandoSistema(null)
                    }

                    return (
                      <div key={campo.id}
                        onDragOver={e => { e.preventDefault(); try { e.dataTransfer.dropEffect = 'move' } catch { /* noop */ }; setDragOverId(campo.id) }}
                        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverId(null) }}
                        onDrop={e => { e.preventDefault(); void handleDropUnified(campo.id); setDragOverId(null) }}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px 9px 0',
                          borderTop: isDragOver ? '2px solid #6366f1' : idx === 0 ? 'none' : '1px solid #f3f4f6',
                          borderLeft: `3px solid ${oculto ? '#e2e8f0' : isSistema ? tc : '#6366f1'}`,
                          background: dragInfo?.id === campo.id ? '#f0f4ff' : oculto ? '#fafafa' : estaEditandoC ? '#fffbeb' : '#fff',
                          transition: 'all 0.15s' }}>

                        {/* Drag handle */}
                        <div
                          draggable
                          onDragStart={e => {
                            try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', campo.id) } catch { /* noop */ }
                            setDragInfo({ id: campo.id, tipo: campo._tipo })
                          }}
                          onDragEnd={() => { setDragInfo(null); setDragOverId(null) }}
                          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 2px', cursor: 'grab', padding: '2px 8px 2px 10px', flexShrink: 0 }}>
                          {[0,1,2,3,4,5].map(i => <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: oculto ? '#e2e8f0' : '#d1d5db' }} />)}
                        </div>

                        {/* Tipo ícono */}
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: oculto ? '#f1f5f9' : `${isSistema ? tc : '#6366f1'}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>
                          {ti?.icon || '📝'}
                        </div>

                        {/* Nombre + meta */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {estaEditandoS ? (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <input autoFocus defaultValue={nombreMostrado}
                                onKeyDown={e => { if (e.key === 'Enter') confirmarRenombre(e.target.value.trim()); if (e.key === 'Escape') setEditandoSistema(null) }}
                                onBlur={e => confirmarRenombre(e.target.value.trim())}
                                style={{ flex: 1, padding: '4px 8px', borderRadius: 7, border: '1.5px solid #6366f1', fontSize: 12, outline: 'none', color: '#111827', background: '#f8f9ff', boxSizing: 'border-box' }} />
                              <button onClick={() => setEditandoSistema(null)}
                                style={{ padding: '4px 8px', borderRadius: 7, border: '1px solid #e5e7eb', background: '#fff', fontSize: 11, color: '#6b7280', cursor: 'pointer', flexShrink: 0 }}>✕</button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 13, fontWeight: isSistema ? 500 : 600, color: oculto ? '#94a3b8' : '#1e293b', textDecoration: oculto ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                                {nombreMostrado}
                              </span>
                              {isSistema && camposNombres[campo.id] && (
                                <span style={{ fontSize: 9, color: '#cbd5e1', fontStyle: 'italic' }}>{campo.nombre}</span>
                              )}
                              <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 5, background: oculto ? '#f1f5f9' : `${isSistema ? tc : '#6366f1'}15`, color: oculto ? '#94a3b8' : isSistema ? tc : '#6366f1', letterSpacing: '0.02em', flexShrink: 0 }}>
                                {ti?.label}
                              </span>
                              {!isSistema && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 5, background: '#f0f9ff', color: '#0ea5e9', flexShrink: 0 }}>Custom</span>}
                              {!isSistema && campo.requerido && <span style={{ fontSize: 9, fontWeight: 700, color: '#ef4444', background: '#fef2f2', padding: '1px 5px', borderRadius: 5, flexShrink: 0 }}>Req.</span>}
                            </div>
                          )}
                        </div>

                        {/* Acciones */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: isSistema ? 6 : 4, flexShrink: 0 }}>
                          {campo._global ? (
                            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 5, background: '#f1f5f9', color: '#94a3b8', border: '1px solid #e2e8f0' }}>🔒 base</span>
                          ) : isSistema ? (
                            <>
                              {!oculto && !estaEditandoS && (
                                <button onClick={e => { e.stopPropagation(); setEditandoSistema({ id: campo.id }) }} title="Renombrar"
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', fontSize: 12, padding: '4px', borderRadius: 6, lineHeight: 1 }}
                                  onMouseOver={e => { e.currentTarget.style.color = '#6366f1'; e.currentTarget.style.background = '#eef2ff' }}
                                  onMouseOut={e => { e.currentTarget.style.color = '#cbd5e1'; e.currentTarget.style.background = 'none' }}>✏️</button>
                              )}
                              <div
                                onClick={e => {
                                  e.stopPropagation()
                                  const nuevoOculto = oculto ? camposOcultos.filter(id => id !== campo.id) : [...camposOcultos, campo.id]
                                  setCamposOcultos(nuevoOculto)
                                  registrarAuditoria(oculto ? 'campo activado' : 'campo desactivado', campo.nombre)
                                }}
                                title={oculto ? 'Activar campo' : 'Desactivar campo'}
                                style={{ width: 40, height: 22, borderRadius: 11, background: oculto ? '#e2e8f0' : '#bbf7d0', border: `1.5px solid ${oculto ? '#cbd5e1' : '#86efac'}`, cursor: 'pointer', transition: 'all 0.2s', position: 'relative', flexShrink: 0 }}>
                                <div style={{ position: 'absolute', top: 2, left: oculto ? 2 : 18, width: 14, height: 14, borderRadius: '50%', background: oculto ? '#94a3b8' : '#16a34a', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }} />
                              </div>
                            </>
                          ) : (
                            <>
                              <button onClick={e => { e.stopPropagation(); iniciarEditarCampo(campo) }} title="Editar campo"
                                style={{ background: estaEditandoC ? '#fef9c3' : 'none', border: estaEditandoC ? '1px solid #fcd34d' : 'none', cursor: 'pointer', color: estaEditandoC ? '#d97706' : '#cbd5e1', fontSize: 13, padding: '5px 7px', borderRadius: 7, lineHeight: 1 }}
                                onMouseOver={e => { if (!estaEditandoC) { e.currentTarget.style.color = '#d97706'; e.currentTarget.style.background = '#fef9c3' } }}
                                onMouseOut={e => { if (!estaEditandoC) { e.currentTarget.style.color = '#cbd5e1'; e.currentTarget.style.background = 'none' } }}>✏️</button>
                              <button onClick={e => { e.stopPropagation(); setConfirmBorrarCampo(campo) }} title="Eliminar campo"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e2e8f0', fontSize: 13, padding: '5px 7px', borderRadius: 7, lineHeight: 1 }}
                                onMouseOver={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = '#fef2f2' }}
                                onMouseOut={e => { e.currentTarget.style.color = '#e2e8f0'; e.currentTarget.style.background = 'none' }}>✕</button>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* ── Formulario agregar / editar campo ──────────── */}
              <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: `1.5px solid ${editandoCampoId ? '#fcd34d' : '#f1f1f3'}`, overflow: 'hidden', transition: 'border-color 0.2s' }}>
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
                        style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #e5e7eb', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#111827' }}
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
                      <button onClick={() => editandoCampoId ? setConfirmActualizarCampo(true) : agregarOActualizarCampo()}
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

              {/* ── Guardar ──────────────────────────────────────── */}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 4 }}>
                {exito && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#059669', fontWeight: 600, background: '#f0fdf4', padding: '7px 12px', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                    ✓ Cambios guardados
                  </div>
                )}
                <button onClick={guardar} disabled={guardando}
                  style={{ padding: '10px 26px', borderRadius: 10, border: 'none',
                    background: 'linear-gradient(135deg,#1a237e,#2563eb)', color: '#fff',
                    fontSize: 13, fontWeight: 700, cursor: guardando ? 'wait' : 'pointer',
                    opacity: guardando ? 0.75 : 1, boxShadow: '0 4px 14px rgba(26,35,126,0.35)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {guardando ? '⏳ Guardando…' : '💾 Guardar cambios'}
                </button>
              </div>
            </div>

            {/* ── Columna preview ────────────────────────────── */}
            <div style={{ width: 252, flexShrink: 0, borderLeft: '1px solid #e5e7eb', overflowY: 'auto', padding: '18px 16px', background: '#f1f5f9' }}>
              <p style={{ margin: '0 0 10px', fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Vista previa</p>
              <PreviewFormulario
                catObj={catObj}
                unifiedVisibleFields={unifiedVisibleFields}
                camposNombres={camposNombres}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Modal confirmar borrar campo ─────────────────── */}
      {confirmBorrarCampo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,12,55,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setConfirmBorrarCampo(null)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '26px 28px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', maxWidth: 360, width: '90%', display: 'flex', flexDirection: 'column', gap: 16 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🗑️</div>
              <div>
                <p style={{ margin: '0 0 6px', fontWeight: 800, fontSize: 15, color: '#111827' }}>¿Eliminar "{confirmBorrarCampo.nombre}"?</p>
                <p style={{ margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>Esta acción no puede deshacerse. Los bienes existentes no perderán sus datos, pero el campo dejará de aparecer en el formulario.</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmBorrarCampo(null)}
                style={{ padding: '9px 18px', borderRadius: 9, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={() => { eliminarCampo(confirmBorrarCampo.id); setConfirmBorrarCampo(null) }}
                style={{ padding: '9px 20px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#ef4444,#dc2626)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(239,68,68,0.35)' }}>
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal confirmar actualizar campo ─────────────── */}
      {confirmActualizarCampo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,12,55,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setConfirmActualizarCampo(false)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '26px 28px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', maxWidth: 360, width: '90%', display: 'flex', flexDirection: 'column', gap: 16 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: '#fef9c3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>✏️</div>
              <div>
                <p style={{ margin: '0 0 6px', fontWeight: 800, fontSize: 15, color: '#111827' }}>¿Guardar cambios en el campo?</p>
                <p style={{ margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>Se actualizará la configuración para todos los bienes de esta categoría.</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmActualizarCampo(false)}
                style={{ padding: '9px 18px', borderRadius: 9, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={() => { agregarOActualizarCampo(); setConfirmActualizarCampo(false) }}
                style={{ padding: '9px 20px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#d97706,#b45309)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(217,119,6,0.35)' }}>
                Sí, actualizar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}
