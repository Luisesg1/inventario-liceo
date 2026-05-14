import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const TIPOS = [
  { value: 'texto',   label: 'Texto'        },
  { value: 'numero',  label: 'Número'       },
  { value: 'fecha',   label: 'Fecha'        },
  { value: 'booleano',label: 'Sí / No'      },
  { value: 'select',  label: 'Lista opciones'},
]

const CAMPOS_SISTEMA = [
  'nombre','codigo','cantidad','estado','ubicacion','responsable','obs',
  'isbn','autor','genero','tipo','marca','modelo','numero_serie',
  'pantalla','cpu','ram','ram_tipo','ram_slots','memoria',
  'tipo_almacenamiento','sistema_operativo','fecha_adquisicion',
  'proveedor','numero_factura','numero_orden','fondo','garantia',
]

export default function CamposCategoria() {
  const [categorias,   setCategorias]   = useState([])
  const [catActiva,    setCatActiva]    = useState(null)
  const [campos,       setCampos]       = useState([])   // campos personalizados de la cat activa
  const [cargando,     setCargando]     = useState(true)
  const [guardando,    setGuardando]    = useState(false)
  const [exito,        setExito]        = useState(false)
  const [error,        setError]        = useState('')

  // Formulario nuevo campo
  const [nuevoNombre,  setNuevoNombre]  = useState('')
  const [nuevoTipo,    setNuevoTipo]    = useState('texto')
  const [nuevoReq,     setNuevoReq]     = useState(false)
  const [nuevoOpts,    setNuevoOpts]    = useState('')   // opciones separadas por coma (solo select)

  useEffect(() => { cargarCategorias() }, [])

  async function cargarCategorias() {
    setCargando(true)
    const { data } = await supabase.from('categorias').select('id, label, icon, campos_personalizados').order('label')
    if (data) {
      setCategorias(data)
      if (data.length > 0 && !catActiva) {
        const primera = data[0]
        setCatActiva(primera.id)
        setCampos(primera.campos_personalizados || [])
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
  }

  function agregarCampo() {
    const nombre = nuevoNombre.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    if (!nombre) { setError('El nombre del campo es obligatorio'); return }
    if (CAMPOS_SISTEMA.includes(nombre)) { setError(`"${nombre}" es un campo del sistema y no puede usarse`); return }
    if (campos.some(c => c.id === nombre)) { setError('Ya existe un campo con ese nombre en esta categoría'); return }
    const nuevo = {
      id:       nombre,
      nombre:   nuevoNombre.trim(),
      tipo:     nuevoTipo,
      requerido: nuevoReq,
      ...(nuevoTipo === 'select' && nuevoOpts.trim()
        ? { opciones: nuevoOpts.split(',').map(o => o.trim()).filter(Boolean) }
        : {}),
    }
    setCampos(prev => [...prev, nuevo])
    resetForm(); setError('')
  }

  function eliminarCampo(id) {
    setCampos(prev => prev.filter(c => c.id !== id))
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

  const catObj = categorias.find(c => c.id === catActiva)

  const card = { background: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #f1f1f3', overflow: 'hidden' }

  if (cargando) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.5)', flexDirection: 'column', gap: 12 }}>
      <div style={{ width: 28, height: 28, border: '3px solid rgba(255,255,255,0.15)', borderTopColor: '#d4a017', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>
      Cargando categorías…
    </div>
  )

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Descripción */}
      <div style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '14px 18px' }}>
        <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>
          Define campos adicionales para cada categoría. Aparecerán en el formulario de bienes cuando se seleccione esa categoría y se guardarán junto al bien.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* ── Lista de categorías ──────────────────────── */}
        <div style={{ ...card, width: 200, flexShrink: 0 }}>
          <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #f3f4f6' }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Categorías</p>
          </div>
          <div style={{ padding: '6px 0' }}>
            {categorias.map(cat => {
              const nCampos = (cat.campos_personalizados || []).length
              const activa = cat.id === catActiva
              return (
                <div key={cat.id} onClick={() => seleccionarCat(cat)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', cursor: 'pointer', background: activa ? 'rgba(99,102,241,0.08)' : 'transparent', borderLeft: `3px solid ${activa ? '#6366f1' : 'transparent'}`, transition: 'all 0.15s' }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{cat.icon || '📦'}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: activa ? 600 : 400, color: activa ? '#1e2d6e' : '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.label}</span>
                  {nCampos > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 700, background: '#6366f1', color: '#fff', borderRadius: 10, padding: '1px 6px', flexShrink: 0 }}>{nCampos}</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Panel de campos ─────────────────────────── */}
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
                <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #f3f4f6' }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Campos actuales</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {campos.map((campo, idx) => (
                    <div key={campo.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', borderBottom: idx < campos.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f0f4ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
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
                      <button onClick={() => eliminarCampo(campo.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', fontSize: 14, padding: '4px 6px', borderRadius: 6, transition: 'all 0.15s', lineHeight: 1 }}
                        onMouseOver={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = '#fef2f2' }}
                        onMouseOut={e => { e.currentTarget.style.color = '#d1d5db'; e.currentTarget.style.background = 'none' }}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Agregar campo */}
            <div style={card}>
              <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #f3f4f6' }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Agregar campo</p>
              </div>
              <div style={{ padding: '16px' }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                  <div style={{ flex: '2 1 160px' }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Nombre del campo</label>
                    <input value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)}
                      placeholder="Ej: Color, Número de serie..."
                      onKeyDown={e => e.key === 'Enter' && agregarCampo()}
                      style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#111827' }}
                      onFocus={e => e.target.style.borderColor = '#6366f1'}
                      onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                    />
                  </div>
                  <div style={{ flex: '1 1 120px' }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Tipo</label>
                    <select value={nuevoTipo} onChange={e => setNuevoTipo(e.target.value)}
                      style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, outline: 'none', background: '#fff', color: '#111827', boxSizing: 'border-box' }}>
                      {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                </div>

                {nuevoTipo === 'select' && (
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Opciones (separadas por coma)</label>
                    <input value={nuevoOpts} onChange={e => setNuevoOpts(e.target.value)}
                      placeholder="Ej: Rojo, Verde, Azul"
                      style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#111827' }}
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
                  <button onClick={agregarCampo}
                    style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    + Agregar
                  </button>
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
    </div>
  )
}
