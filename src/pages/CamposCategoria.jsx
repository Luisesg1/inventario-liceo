import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const TIPOS = [
  { value: 'texto',    label: 'Texto'         },
  { value: 'numero',   label: 'Número'        },
  { value: 'fecha',    label: 'Fecha'         },
  { value: 'booleano', label: 'Sí / No'       },
  { value: 'select',   label: 'Lista opciones'},
]

const CAMPOS_SISTEMA = [
  'nombre','codigo','cantidad','estado','ubicacion','responsable','obs',
  'isbn','autor','genero','tipo','marca','modelo','numero_serie',
  'pantalla','cpu','ram','ram_tipo','ram_slots','memoria',
  'tipo_almacenamiento','sistema_operativo','fecha_adquisicion',
  'proveedor','numero_factura','numero_orden','fondo','garantia',
]

const ICONOS = ['📦','🪑','📚','📖','🖨️','💻','🖥️','🖱️','📷','📱','🔧','🗂️','🗃️','🖼️','🏫','⚗️','🎨','🎒','🔬','🪞','⚽','🏀','🏐','🏈','🎾','🏓','🏸','🥊','🏋️','🎽','🎵','🎭','🔭','🧪','🖊️','📐','🗑️','🎸','🎹']

export default function CamposCategoria({ usuario }) {
  const esAdmin = usuario?.rol === 'admin'

  const [categorias,   setCategorias]   = useState([])
  const [catActiva,    setCatActiva]    = useState(null)
  const [campos,       setCampos]       = useState([])
  const [cargando,     setCargando]     = useState(true)
  const [guardando,    setGuardando]    = useState(false)
  const [exito,        setExito]        = useState(false)
  const [error,        setError]        = useState('')

  // Formulario campo (nuevo o edición)
  const [nuevoNombre,  setNuevoNombre]  = useState('')
  const [nuevoTipo,    setNuevoTipo]    = useState('texto')
  const [nuevoReq,     setNuevoReq]     = useState(false)
  const [nuevoOpts,    setNuevoOpts]    = useState('')
  const [editandoCampoId, setEditandoCampoId] = useState(null) // id del campo que se edita

  // Modal nueva categoría
  const [modalCat,     setModalCat]     = useState(false)
  const [nuevaCatLabel, setNuevaCatLabel] = useState('')
  const [nuevaCatIcon,  setNuevaCatIcon]  = useState('📦')
  const [guardandoCat,  setGuardandoCat]  = useState(false)
  const [errorCat,      setErrorCat]      = useState('')

  // Confirmación borrar categoría
  const [confirmBorrarCat, setConfirmBorrarCat] = useState(null) // { id, label }
  const [borrandoCat,      setBorrandoCat]      = useState(false)

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
    setCatActiva(cat.id)
    setCampos(cat.campos_personalizados || [])
    setError(''); setExito(false)
    resetForm()
  }

  function resetForm() {
    setNuevoNombre(''); setNuevoTipo('texto'); setNuevoReq(false); setNuevoOpts('')
    setEditandoCampoId(null)
  }

  // ── Campos personalizados ──────────────────────────────────

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
    if (CAMPOS_SISTEMA.includes(nombre)) { setError(`"${nombre}" es un campo del sistema y no puede usarse`); return }

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
      if (campos.some(c => c.id === nombre)) { setError('Ya existe un campo con ese nombre en esta categoría'); return }
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
      .update({ campos_personalizados: campos })
      .eq('id', catActiva)
    if (err) {
      setError('Error al guardar: ' + err.message)
    } else {
      setCategorias(prev => prev.map(c => c.id === catActiva ? { ...c, campos_personalizados: campos } : c))
      setExito(true)
      setTimeout(() => setExito(false), 3000)
    }
    setGuardando(false)
  }

  // ── Categorías ────────────────────────────────────────────

  async function crearCategoria() {
    const label = nuevaCatLabel.trim()
    if (!label) { setErrorCat('El nombre es obligatorio'); return }
    const id = label.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'')
    if (!id) { setErrorCat('Nombre inválido'); return }
    if (categorias.some(c => c.id === id)) { setErrorCat('Ya existe una categoría con ese nombre'); return }
    setGuardandoCat(true); setErrorCat('')
    const { data, error: err } = await supabase.from('categorias')
      .insert({ id, label, icon: nuevaCatIcon, fija: false, campos_personalizados: [] })
      .select().single()
    setGuardandoCat(false)
    if (err) { setErrorCat('Error: ' + err.message); return }
    setCategorias(prev => [...prev, data].sort((a, b) => a.label.localeCompare(b.label)))
    setModalCat(false)
    setNuevaCatLabel(''); setNuevaCatIcon('📦')
    setCatActiva(data.id); setCampos([])
  }

  async function borrarCategoria() {
    if (!confirmBorrarCat) return
    setBorrandoCat(true)
    const { error: err } = await supabase.from('categorias').delete().eq('id', confirmBorrarCat.id)
    setBorrandoCat(false)
    if (err) {
      setError('No se puede eliminar: ' + (err.message.includes('foreign') ? 'hay bienes registrados en esta categoría' : err.message))
      setConfirmBorrarCat(null)
      return
    }
    const restantes = categorias.filter(c => c.id !== confirmBorrarCat.id)
    setCategorias(restantes)
    setConfirmBorrarCat(null)
    if (catActiva === confirmBorrarCat.id) {
      const sig = restantes[0]
      if (sig) { setCatActiva(sig.id); setCampos(sig.campos_personalizados || []) }
      else { setCatActiva(null); setCampos([]) }
    }
  }

  const catObj = categorias.find(c => c.id === catActiva)
  const card = { background: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #f1f1f3', overflow: 'hidden' }
  const inputStyle = { width: '100%', padding: '9px 11px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#111827' }

  if (cargando) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.5)', flexDirection: 'column', gap: 12 }}>
      <div style={{ width: 28, height: 28, border: '3px solid rgba(255,255,255,0.15)', borderTopColor: '#d4a017', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>
      Cargando categorías…
    </div>
  )

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Descripción */}
      <div style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '14px 18px' }}>
        <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>
          Define campos adicionales para cada categoría. Aparecerán en el formulario de bienes cuando se seleccione esa categoría.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* ── Lista de categorías ────────────────────────── */}
        <div style={{ ...card, width: 210, flexShrink: 0 }}>
          <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Categorías</p>
            {esAdmin && (
              <button onClick={() => { setModalCat(true); setErrorCat(''); setNuevaCatLabel(''); setNuevaCatIcon('📦') }}
                style={{ background: '#6366f1', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 700, padding: '3px 10px', borderRadius: 6, lineHeight: 1.6 }}
                title="Nueva categoría">
                + Nueva
              </button>
            )}
          </div>
          <div style={{ padding: '6px 0' }}>
            {categorias.map(cat => {
              const nCampos = (cat.campos_personalizados || []).length
              const activa = cat.id === catActiva
              return (
                <div key={cat.id} onClick={() => seleccionarCat(cat)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', cursor: 'pointer', background: activa ? 'rgba(99,102,241,0.08)' : 'transparent', borderLeft: `3px solid ${activa ? '#6366f1' : 'transparent'}`, transition: 'all 0.15s' }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{cat.icon || '📦'}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: activa ? 600 : 400, color: activa ? '#1e2d6e' : '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.label}</span>
                  {nCampos > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 700, background: '#6366f1', color: '#fff', borderRadius: 10, padding: '1px 6px', flexShrink: 0 }}>{nCampos}</span>
                  )}
                  {esAdmin && !cat.fija && (
                    <button onClick={e => { e.stopPropagation(); setConfirmBorrarCat({ id: cat.id, label: cat.label }) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', fontSize: 12, padding: '2px 4px', borderRadius: 4, lineHeight: 1, flexShrink: 0 }}
                      onMouseOver={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = '#fef2f2' }}
                      onMouseOut={e => { e.currentTarget.style.color = '#d1d5db'; e.currentTarget.style.background = 'none' }}
                      title="Eliminar categoría">
                      🗑
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Panel de campos ─────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {catObj && <>
            {/* Header categoría */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 24 }}>{catObj.icon || '📦'}</span>
              <div>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#fff' }}>{catObj.label}</p>
                <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                  {campos.length === 0 ? 'Sin campos personalizados' : `${campos.length} campo${campos.length !== 1 ? 's' : ''} personalizado${campos.length !== 1 ? 's' : ''}`}
                </p>
              </div>
            </div>

            {/* Campos existentes */}
            {campos.length > 0 && (
              <div style={card}>
                <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid #f3f4f6' }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Campos actuales</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {campos.map((campo, idx) => (
                    <div key={campo.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', borderBottom: idx < campos.length - 1 ? '1px solid #f3f4f6' : 'none', background: editandoCampoId === campo.id ? '#fffbeb' : 'transparent' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: editandoCampoId === campo.id ? '#fef9c3' : '#f0f4ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                        {{ texto: '📝', numero: '🔢', fecha: '📅', booleano: '☑️', select: '📋' }[campo.tipo] || '📝'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#111827' }}>{campo.nombre}</p>
                        <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>
                          {TIPOS.find(t => t.value === campo.tipo)?.label || campo.tipo}
                          {campo.requerido && <span style={{ marginLeft: 6, color: '#ef4444', fontWeight: 700 }}>· Requerido</span>}
                          {campo.opciones?.length > 0 && <span style={{ marginLeft: 6 }}>· {campo.opciones.join(', ')}</span>}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                        <button onClick={() => iniciarEditarCampo(campo)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: editandoCampoId === campo.id ? '#d97706' : '#9ca3af', fontSize: 13, padding: '4px 6px', borderRadius: 6, lineHeight: 1 }}
                          onMouseOver={e => { e.currentTarget.style.color = '#d97706'; e.currentTarget.style.background = '#fef9c3' }}
                          onMouseOut={e => { e.currentTarget.style.color = editandoCampoId === campo.id ? '#d97706' : '#9ca3af'; e.currentTarget.style.background = 'none' }}
                          title="Editar campo">✏️</button>
                        <button onClick={() => eliminarCampo(campo.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', fontSize: 14, padding: '4px 6px', borderRadius: 6, lineHeight: 1 }}
                          onMouseOver={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = '#fef2f2' }}
                          onMouseOut={e => { e.currentTarget.style.color = '#d1d5db'; e.currentTarget.style.background = 'none' }}
                          title="Eliminar campo">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Formulario agregar / editar campo */}
            <div style={{ ...card, border: `1.5px solid ${editandoCampoId ? '#fcd34d' : '#f1f1f3'}`, background: editandoCampoId ? '#fffbeb' : '#fff' }}>
              <div style={{ padding: '12px 16px 10px', borderBottom: `1px solid ${editandoCampoId ? '#fde68a' : '#f3f4f6'}` }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: editandoCampoId ? '#d97706' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {editandoCampoId ? '✏️ Editando campo' : 'Agregar campo'}
                </p>
              </div>
              <div style={{ padding: '16px' }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                  <div style={{ flex: '2 1 160px' }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Nombre del campo</label>
                    <input value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)}
                      placeholder="Ej: Color, Número de serie..."
                      onKeyDown={e => e.key === 'Enter' && agregarOActualizarCampo()}
                      style={inputStyle}
                      onFocus={e => e.target.style.borderColor = '#6366f1'}
                      onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                    />
                  </div>
                  <div style={{ flex: '1 1 120px' }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Tipo</label>
                    <select value={nuevoTipo} onChange={e => setNuevoTipo(e.target.value)}
                      style={{ ...inputStyle, background: '#fff' }}>
                      {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                </div>

                {nuevoTipo === 'select' && (
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Opciones (separadas por coma)</label>
                    <input value={nuevoOpts} onChange={e => setNuevoOpts(e.target.value)}
                      placeholder="Ej: Rojo, Verde, Azul"
                      style={inputStyle}
                      onFocus={e => e.target.style.borderColor = '#6366f1'}
                      onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                    />
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#374151' }}>
                    <input type="checkbox" checked={nuevoReq} onChange={e => setNuevoReq(e.target.checked)}
                      style={{ width: 15, height: 15, accentColor: '#6366f1' }} />
                    Campo requerido
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {editandoCampoId && (
                      <button onClick={resetForm}
                        style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #d1d5db', background: '#fff', color: '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        Cancelar
                      </button>
                    )}
                    <button onClick={agregarOActualizarCampo}
                      style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: editandoCampoId ? '#d97706' : '#6366f1', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      {editandoCampoId ? 'Actualizar' : '+ Agregar'}
                    </button>
                  </div>
                </div>

                {error && <p style={{ margin: '10px 0 0', fontSize: 12, color: '#dc2626', background: '#fef2f2', padding: '8px 12px', borderRadius: 7, border: '1px solid #fecaca' }}>⚠️ {error}</p>}
              </div>
            </div>

            {/* Guardar */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center' }}>
              {exito && <p style={{ margin: 0, fontSize: 12, color: '#059669', fontWeight: 600 }}>✓ Guardado correctamente</p>}
              <button onClick={guardar} disabled={guardando}
                style={{ padding: '10px 24px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#1a237e,#2563eb)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: guardando ? 'wait' : 'pointer', opacity: guardando ? 0.75 : 1, boxShadow: '0 4px 14px rgba(26,35,126,0.35)' }}>
                {guardando ? '⏳ Guardando…' : '💾 Guardar cambios'}
              </button>
            </div>
          </>}
        </div>
      </div>

      {/* ── Modal nueva categoría ─────────────────────────── */}
      {modalCat && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,12,55,0.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 900 }}
          onClick={() => setModalCat(false)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '24px 28px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', maxWidth: 420, width: '92%' }}
            onClick={e => e.stopPropagation()}>
            <p style={{ margin: '0 0 18px', fontWeight: 800, fontSize: 16, color: '#111827' }}>Nueva categoría</p>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Nombre</label>
              <input value={nuevaCatLabel} onChange={e => setNuevaCatLabel(e.target.value)}
                placeholder="Ej: Mobiliario escolar" maxLength={50} autoFocus
                onKeyDown={e => e.key === 'Enter' && crearCategoria()}
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#6366f1'}
                onBlur={e => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Ícono</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {ICONOS.map(ic => (
                  <button key={ic} onClick={() => setNuevaCatIcon(ic)}
                    style={{ fontSize: 20, padding: '5px 7px', borderRadius: 8, border: `2px solid ${nuevaCatIcon === ic ? '#6366f1' : '#e5e7eb'}`, background: nuevaCatIcon === ic ? '#eef2ff' : '#fff', cursor: 'pointer', lineHeight: 1 }}>
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            {errorCat && <p style={{ margin: '0 0 12px', fontSize: 12, color: '#dc2626', background: '#fef2f2', padding: '8px 12px', borderRadius: 7, border: '1px solid #fecaca' }}>⚠️ {errorCat}</p>}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModalCat(false)}
                style={{ padding: '9px 18px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={crearCategoria} disabled={guardandoCat}
                style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontSize: 13, fontWeight: 700, cursor: guardandoCat ? 'wait' : 'pointer', opacity: guardandoCat ? 0.75 : 1 }}>
                {guardandoCat ? 'Creando…' : 'Crear categoría'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal confirmar borrar categoría ─────────────── */}
      {confirmBorrarCat && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,12,55,0.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 900 }}
          onClick={() => setConfirmBorrarCat(null)}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '24px 28px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', maxWidth: 380, width: '90%', display: 'flex', flexDirection: 'column', gap: 16 }}
            onClick={e => e.stopPropagation()}>
            <div>
              <p style={{ margin: '0 0 6px', fontWeight: 800, fontSize: 15, color: '#111827' }}>¿Eliminar categoría?</p>
              <p style={{ margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
                Se eliminará <strong>"{confirmBorrarCat.label}"</strong> permanentemente. Si hay bienes registrados en esta categoría, la operación fallará.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmBorrarCat(null)}
                style={{ padding: '8px 18px', borderRadius: 8, border: '1.5px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={borrarCategoria} disabled={borrandoCat}
                style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontSize: 13, fontWeight: 700, cursor: borrandoCat ? 'wait' : 'pointer', opacity: borrandoCat ? 0.75 : 1 }}>
                {borrandoCat ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
