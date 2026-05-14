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

  // Modales categoría
  const [modalCat,        setModalCat]        = useState(null) // null | 'nueva' | cat_obj (edición)
  const [confirmBorrar,   setConfirmBorrar]   = useState(null) // cat obj
  const [borrandoCat,     setBorrandoCat]     = useState(false)

  useEffect(() => { cargarCategorias() }, []) // eslint-disable-line

  async function cargarCategorias() {
    setCargando(true)
    const { data } = await supabase.from('categorias').select('id, label, icon, campos_personalizados, fija').order('label')
    if (data) {
      setCategorias(data)
      if (data.length > 0 && !catActiva) {
        setCatActiva(data[0].id)
        setCampos(data[0].campos_personalizados || [])
      }
    }
    setCargando(false)
  }

  function seleccionarCat(cat) {
    setCatActiva(cat.id); setCampos(cat.campos_personalizados || [])
    setError(''); setExito(false); resetForm()
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
    const { error: err } = await supabase.from('categorias').update({ campos_personalizados: campos }).eq('id', catActiva)
    if (err) { setError('Error al guardar: ' + err.message) }
    else {
      setCategorias(prev => prev.map(c => c.id === catActiva ? { ...c, campos_personalizados: campos } : c))
      setExito(true); setTimeout(() => setExito(false), 3000)
    }
    setGuardando(false)
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

  if (cargando) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', color: 'rgba(255,255,255,0.5)', flexDirection: 'column', gap: 14 }}>
      <div style={{ width: 32, height: 32, border: '3px solid rgba(255,255,255,0.15)', borderTopColor: '#d4a017', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>
      <span style={{ fontSize: 13 }}>Cargando categorías…</span>
    </div>
  )

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

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
          <div style={{ flex: 1, minWidth: 300, display: 'flex', flexDirection: 'column', gap: 14 }}>

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

            {/* Campos existentes */}
            {campos.length > 0 && (
              <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #f1f1f3', overflow: 'hidden' }}>
                <div style={{ padding: '13px 18px 11px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1' }} />
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Campos configurados</p>
                  <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, background: '#f0f4ff', color: '#6366f1', borderRadius: 8, padding: '2px 8px' }}>{campos.length}</span>
                </div>
                <div>
                  {campos.map((campo, idx) => {
                    const tc = TIPO_COLOR[campo.tipo] || '#6b7280'
                    const ti = TIPOS.find(t => t.value === campo.tipo)
                    const editando = editandoCampoId === campo.id
                    return (
                      <div key={campo.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px',
                          borderBottom: idx < campos.length - 1 ? '1px solid #f3f4f6' : 'none',
                          background: editando ? '#fffbeb' : 'transparent',
                          transition: 'background 0.15s' }}>
                        <div style={{ width: 34, height: 34, borderRadius: 10, background: `${tc}18`, border: `1.5px solid ${tc}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>
                          {ti?.icon || '📝'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#111827' }}>{campo.nombre}</p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 6, background: `${tc}18`, color: tc }}>{ti?.label}</span>
                            {campo.requerido && <span style={{ fontSize: 10, fontWeight: 600, color: '#ef4444', background: '#fef2f2', padding: '1px 6px', borderRadius: 6 }}>Requerido</span>}
                            {campo.opciones?.length > 0 && <span style={{ fontSize: 10, color: '#9ca3af' }}>{campo.opciones.slice(0,3).join(' · ')}{campo.opciones.length > 3 ? ' …' : ''}</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <button onClick={() => iniciarEditarCampo(campo)}
                            title="Editar campo"
                            style={{ background: editando ? '#fef9c3' : 'none', border: editando ? '1px solid #fcd34d' : 'none', cursor: 'pointer', color: editando ? '#d97706' : '#9ca3af', fontSize: 13, padding: '5px 7px', borderRadius: 7, lineHeight: 1 }}
                            onMouseOver={e => { if (!editando) { e.currentTarget.style.color = '#d97706'; e.currentTarget.style.background = '#fef9c3' } }}
                            onMouseOut={e => { if (!editando) { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.background = 'none' } }}>
                            ✏️
                          </button>
                          <button onClick={() => eliminarCampo(campo.id)}
                            title="Eliminar campo"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', fontSize: 14, padding: '5px 7px', borderRadius: 7, lineHeight: 1 }}
                            onMouseOver={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = '#fef2f2' }}
                            onMouseOut={e => { e.currentTarget.style.color = '#d1d5db'; e.currentTarget.style.background = 'none' }}>
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
