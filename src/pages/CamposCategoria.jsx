import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import './CamposCategoria.css'

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
    { id: 'ram',                 nombre: 'RAM (capacidad)',           tipo: 'texto'  },
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
    { id: 'codigo',              nombre: 'Código / N° inventario',   tipo: 'texto',  _global: true },
    { id: 'cantidad',            nombre: 'Cantidad',                  tipo: 'numero', _global: true },
    { id: 'estado',              nombre: 'Estado',                    tipo: 'select', _global: true },
    { id: 'ubicacion',           nombre: 'Ubicación',                 tipo: 'texto',  _global: true },
    { id: 'area',                nombre: 'Área',                      tipo: 'texto',  _global: true },
    { id: 'responsable',         nombre: 'Responsable',               tipo: 'texto',  _global: true },
    { id: 'tipo',                nombre: 'Tipo',                      tipo: 'texto'  },
    { id: 'tecnologia',          nombre: 'Tecnología',                tipo: 'texto'  },
    { id: 'marca',               nombre: 'Marca',                     tipo: 'texto'  },
    { id: 'modelo',              nombre: 'Modelo',                    tipo: 'texto'  },
    { id: 'numero_serie',        nombre: 'N° de serie',               tipo: 'texto'  },
    { id: 'consumible',          nombre: 'Consumible',                tipo: 'texto'  },
    { id: 'fecha_adquisicion',   nombre: 'Fecha adquisición',         tipo: 'fecha'  },
    { id: 'proveedor',           nombre: 'Proveedor',                 tipo: 'texto'  },
    { id: 'numero_factura',      nombre: 'N° factura',                tipo: 'texto'  },
    { id: 'numero_orden',        nombre: 'N° orden compra',           tipo: 'texto'  },
    { id: 'fondo',               nombre: 'Fondo',                     tipo: 'texto'  },
    { id: 'garantia',            nombre: 'Garantía',                  tipo: 'texto'  },
    { id: 'obs',                 nombre: 'Observaciones',             tipo: 'texto',  _global: true },
  ],
  biblio: [
    { id: 'codigo',              nombre: 'Código / N° inventario',   tipo: 'texto',  _global: true },
    { id: 'cantidad',            nombre: 'Cantidad',                  tipo: 'numero', _global: true },
    { id: 'estado',              nombre: 'Estado',                    tipo: 'select', _global: true },
    { id: 'ubicacion',           nombre: 'Ubicación',                 tipo: 'texto',  _global: true },
    { id: 'responsable',         nombre: 'Responsable',               tipo: 'texto',  _global: true },
    { id: 'isbn',                nombre: 'ISBN',                      tipo: 'texto'  },
    { id: 'autor',               nombre: 'Autor',                     tipo: 'texto'  },
    { id: 'genero',              nombre: 'Género',                    tipo: 'texto'  },
    { id: 'fecha_adquisicion',   nombre: 'Fecha adquisición',         tipo: 'fecha'  },
    { id: 'proveedor',           nombre: 'Proveedor',                 tipo: 'texto'  },
    { id: 'fondo',               nombre: 'Fondo',                     tipo: 'texto'  },
    { id: 'obs',                 nombre: 'Observaciones',             tipo: 'texto',  _global: true },
  ],
  generico: [
    { id: 'codigo',              nombre: 'Código / N° inventario',   tipo: 'texto',  _global: true },
    { id: 'cantidad',            nombre: 'Cantidad',                  tipo: 'numero', _global: true },
    { id: 'estado',              nombre: 'Estado',                    tipo: 'select', _global: true },
    { id: 'ubicacion',           nombre: 'Ubicación',                 tipo: 'texto',  _global: true },
    { id: 'responsable',         nombre: 'Responsable',               tipo: 'texto',  _global: true },
    { id: 'fecha_adquisicion',   nombre: 'Fecha adquisición',         tipo: 'fecha'  },
    { id: 'proveedor',           nombre: 'Proveedor',                 tipo: 'texto'  },
    { id: 'numero_factura',      nombre: 'N° factura',                tipo: 'texto'  },
    { id: 'numero_orden',        nombre: 'N° orden',                  tipo: 'texto'  },
    { id: 'fondo',               nombre: 'Fondo',                     tipo: 'texto'  },
    { id: 'garantia',            nombre: 'Garantía',                  tipo: 'texto'  },
    { id: 'obs',                 nombre: 'Observaciones',             tipo: 'texto',  _global: true },
  ],
}

// Sections matching the real Agregar bien form layout
const FORM_SECTIONS = {
  comp: [
    { label: null,                  ids: ['numero_serie','codigo','estado','ubicacion','area','responsable'], _header: true },
    { label: '💻 Especificaciones', ids: ['tipo','marca','modelo','pantalla','cpu_marca','cpu_modelo','cpu_generacion','ram','ram_tipo','ram_slots','memoria','tipo_almacenamiento','sistema_operativo'] },
    { label: '🛒 Adquisición',      ids: ['fecha_adquisicion','proveedor','fondo','numero_factura','numero_orden','garantia'] },
    { label: null,                  ids: ['obs'], _footer: true },
  ],
  tecno: [
    { label: null,                  ids: ['codigo','cantidad','estado','ubicacion','area','responsable'], _header: true },
    { label: '🖨️ Datos del equipo', ids: ['tipo','tecnologia','marca','modelo','numero_serie','consumible'] },
    { label: '🛒 Adquisición',      ids: ['proveedor','numero_factura','fecha_adquisicion','numero_orden','fondo','garantia'] },
    { label: null,                  ids: ['obs'], _footer: true },
  ],
  biblio: [
    { label: null,                  ids: ['codigo','cantidad','estado','ubicacion','responsable'], _header: true },
    { label: '📚 Datos del libro',  ids: ['isbn','autor','genero'] },
    { label: '🛒 Adquisición',      ids: ['fecha_adquisicion','proveedor','fondo'] },
    { label: null,                  ids: ['obs'], _footer: true },
  ],
  generico: [
    { label: null,                  ids: ['codigo','cantidad','estado','ubicacion','responsable'], _header: true },
    { label: '🛒 Adquisición',      ids: ['fecha_adquisicion','proveedor','numero_factura','numero_orden','fondo','garantia'] },
    { label: null,                  ids: ['obs'], _footer: true },
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

// ── Sub-components ─────────────────────────────────────────────────────────

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
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 9, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={guardar} disabled={guardando}
            style={{ padding: '9px 22px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: guardando ? 'wait' : 'pointer', opacity: guardando ? 0.75 : 1, boxShadow: '0 4px 12px rgba(99,102,241,0.4)' }}>
            {guardando ? '⏳ Guardando…' : esEdicion ? 'Guardar cambios' : 'Crear categoría'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Preview form input — looks active but is not interactive
function FieldInputMock({ tipo, nombre, oculto, isCustom }) {
  const s = {
    width: '100%', padding: '8px 11px', borderRadius: 8,
    border: `1.5px solid ${oculto ? '#e2e8f0' : isCustom ? '#c7d2fe' : '#d1d5db'}`,
    fontSize: 13, fontFamily: 'inherit',
    background: oculto ? '#f8fafc' : isCustom ? '#f5f3ff' : '#fff',
    color: oculto ? '#b0b8c8' : '#64748b',
    outline: 'none', boxSizing: 'border-box',
    cursor: 'default', pointerEvents: 'none',
  }
  if (tipo === 'fecha')    return <input type="date" disabled style={s} />
  if (tipo === 'booleano') return <select disabled style={s}><option>Sí</option><option>No</option></select>
  if (tipo === 'select')   return <select disabled style={s}><option>— seleccionar —</option></select>
  if (tipo === 'numero')   return <input type="number" disabled placeholder="0" style={s} />
  return <input type="text" disabled placeholder={`${nombre}…`} style={{ ...s, textOverflow: 'ellipsis' }} />
}

// Single field in the form editor with hover controls
function FieldConfigCard({
  campo, isSistema, oculto, nombreMostrado,
  editandoSistema, setEditandoSistema, onConfirmarRenombre,
  onToggleHide, onEditCustom, onDeleteCustom,
  dragInfo, setDragInfo, dragOverId, setDragOverId, onDrop,
  pEditar, pOcultar, pEliminar, pReordenar,
}) {
  const [hover, setHover] = useState(false)
  const isLocked   = !!campo._global
  const estaEditS  = isSistema && editandoSistema?.id === campo.id
  const isDragOver = dragOverId === campo.id
  const isDragging = dragInfo?.id === campo.id
  const isCustom   = !isSistema

  // Card visual state
  let cardBg      = isCustom ? '#faf9ff' : '#fff'
  let cardBorder  = isCustom ? '1.5px solid #e0d9ff' : '1.5px solid #e5e8ee'
  let cardShadow  = 'none'
  if (oculto)     { cardBg = '#f8fafc'; cardBorder = '1.5px solid #e2e8f0' }
  if (isDragging) { cardBg = '#eef2ff'; cardBorder = '1.5px solid #818cf8' }
  if (isDragOver) { cardBg = '#ede9fe'; cardBorder = '2px dashed #7c3aed'; cardShadow = '0 0 0 3px rgba(124,58,237,0.1)' }
  if (hover && !oculto && !isDragOver) {
    cardBg     = isCustom ? '#f0eeff' : '#f0f6ff'
    cardBorder = isCustom ? '1.5px solid #7c3aed' : '1.5px solid #3b82f6'
    cardShadow = isCustom ? '0 2px 8px rgba(124,58,237,0.12)' : '0 2px 8px rgba(59,130,246,0.1)'
  }

  const labelColor = oculto ? '#94a3b8' : isCustom ? '#5b21b6' : '#1e293b'

  const ctrlBtn = (title, emoji, onClick, hoverColor, hoverBg) => (
    <button title={title} onClick={e => { e.stopPropagation(); onClick() }}
      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: '3px 6px', borderRadius: 6, color: '#94a3b8', lineHeight: 1, transition: 'all 0.12s' }}
      onMouseOver={e => { e.currentTarget.style.color = hoverColor; e.currentTarget.style.background = hoverBg }}
      onMouseOut={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'none' }}>
      {emoji}
    </button>
  )

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      draggable={!isLocked && pReordenar}
      onDragStart={e => {
        if (!pReordenar) return
        try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', campo.id) } catch { /* noop */ }
        setDragInfo({ id: campo.id, tipo: campo._tipo })
      }}
      onDragEnd={() => { setDragInfo(null); setDragOverId(null) }}
      onDragOver={e => {
        if (!pReordenar) return
        e.preventDefault()
        try { e.dataTransfer.dropEffect = 'move' } catch { /* noop */ }
        setDragOverId(campo.id)
      }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverId(null) }}
      onDrop={e => { e.preventDefault(); if (pReordenar) onDrop(campo.id); setDragOverId(null) }}
      style={{
        borderRadius: 10, padding: '8px 10px 10px',
        opacity: oculto ? 0.55 : 1, transition: 'all 0.18s',
        background: cardBg, border: cardBorder, boxShadow: cardShadow,
        cursor: isLocked || !pReordenar ? 'default' : 'grab',
      }}
    >
      {/* Label + controls row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, minHeight: 22, gap: 4 }}>
        {estaEditS ? (
          <input autoFocus defaultValue={nombreMostrado}
            onKeyDown={e => {
              if (e.key === 'Enter') onConfirmarRenombre(e.target.value.trim())
              if (e.key === 'Escape') setEditandoSistema(null)
            }}
            onBlur={e => onConfirmarRenombre(e.target.value.trim())}
            style={{ flex: 1, padding: '3px 8px', borderRadius: 6, border: '1.5px solid #6366f1', fontSize: 12, outline: 'none', fontFamily: 'inherit', background: '#f8f9ff', color: '#111827', boxShadow: '0 0 0 3px rgba(99,102,241,0.15)' }}
          />
        ) : (
          <label style={{
            flex: 1, fontSize: 11, fontWeight: 700, userSelect: 'none', cursor: 'inherit',
            color: labelColor, letterSpacing: '0.03em',
            textDecoration: oculto ? 'line-through' : 'none',
            textTransform: 'uppercase',
            display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', minWidth: 0,
          }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombreMostrado}</span>
            {campo.requerido && <span style={{ color: '#ef4444', fontWeight: 900, flexShrink: 0, textTransform: 'none' }}>*</span>}
            {isCustom && (
              <span style={{ fontSize: 9, background: '#ede9fe', color: '#7c3aed', borderRadius: 4, padding: '1px 5px', fontWeight: 800, flexShrink: 0, lineHeight: 1.6, letterSpacing: 0, textTransform: 'none' }}>CUSTOM</span>
            )}
            {isLocked && <span title="Campo base protegido" style={{ fontSize: 10, color: '#c4cdd9', cursor: 'help', flexShrink: 0, textTransform: 'none' }}>🔒</span>}
          </label>
        )}

        {/* Controls — low opacity at rest, full on hover */}
        {!isLocked && !estaEditS && (pEditar || pOcultar || pEliminar) && (
          <div style={{ display: 'flex', gap: 1, flexShrink: 0, opacity: hover ? 1 : 0.25, transition: 'opacity 0.18s', pointerEvents: hover ? 'auto' : 'none' }}>
            {isSistema ? (
              <>
                {pEditar && ctrlBtn('Renombrar campo', '✏️', () => setEditandoSistema({ id: campo.id }), '#4f46e5', '#eef2ff')}
                {pOcultar && (
                  <button
                    title={oculto ? 'Mostrar en formulario' : 'Ocultar del formulario'}
                    onClick={e => { e.stopPropagation(); onToggleHide() }}
                    style={{ background: oculto ? '#dcfce7' : 'none', color: oculto ? '#16a34a' : '#94a3b8', border: 'none', cursor: 'pointer', fontSize: 13, padding: '3px 6px', borderRadius: 6, lineHeight: 1, transition: 'all 0.12s' }}
                    onMouseOver={e => { if (!oculto) { e.currentTarget.style.color = '#d97706'; e.currentTarget.style.background = '#fef9c3' } }}
                    onMouseOut={e => { if (!oculto) { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'none' } }}>
                    {oculto ? '👁' : '🙈'}
                  </button>
                )}
              </>
            ) : (
              <>
                {pEditar && ctrlBtn('Editar campo', '✏️', onEditCustom, '#b45309', '#fef9c3')}
                {pEliminar && ctrlBtn('Eliminar campo', '🗑️', onDeleteCustom, '#dc2626', '#fef2f2')}
              </>
            )}
          </div>
        )}
      </div>

      <FieldInputMock tipo={campo.tipo} nombre={nombreMostrado} oculto={oculto} isCustom={isCustom} />

      {/* Drag hint — only when hovered, not locked and has reorder permission */}
      {!isLocked && pReordenar && hover && (
        <div style={{ textAlign: 'center', marginTop: 4, fontSize: 9, color: '#b0b8c8', letterSpacing: '0.08em' }}>
          ⠿ arrastrar para reordenar
        </div>
      )}
    </div>
  )
}

// Inline form for adding a new custom field inside a section
function AddFieldInline({ sectionLabel, onAdd, onCancel, existingIds }) {
  const [nombre,   setNombre]   = useState('')
  const [tipo,     setTipo]     = useState('texto')
  const [requerido, setReq]     = useState(false)
  const [opts,     setOpts]     = useState('')
  const [err,      setErr]      = useState('')

  function submit() {
    const n = nombre.trim()
    if (!n) { setErr('El nombre es obligatorio'); return }
    const id = n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    if (!id) { setErr('Nombre inválido — usa solo letras y espacios'); return }
    if (CAMPOS_SISTEMA.includes(id)) { setErr(`"${id}" es un nombre reservado del sistema`); return }
    if (existingIds.includes(id)) { setErr('Ya existe un campo con ese nombre'); return }
    onAdd({ id, nombre: n, tipo, requerido, opts })
  }

  const colBorder = '#c7d2fe'
  return (
    <div style={{ background: 'linear-gradient(135deg,#f5f7ff,#fafafe)', border: `1.5px dashed ${colBorder}`, borderRadius: 10, padding: '14px 16px', marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#6366f1' }}>+ Nuevo campo</span>
        {sectionLabel && <span style={{ fontSize: 11, color: '#94a3b8' }}>en {sectionLabel}</span>}
        <button onClick={onCancel} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16, lineHeight: 1, padding: '2px 4px' }}>✕</button>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: '2 1 160px' }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Nombre del campo</label>
          <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Color, N° serie…" autoFocus
            onKeyDown={e => e.key === 'Enter' && submit()}
            style={{ width: '100%', padding: '8px 11px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#111827' }}
            onFocus={e => e.target.style.borderColor = '#6366f1'}
            onBlur={e => e.target.style.borderColor = '#e5e7eb'}
          />
        </div>
        <div style={{ flex: '1 1 130px' }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Tipo</label>
          <select value={tipo} onChange={e => setTipo(e.target.value)}
            style={{ width: '100%', padding: '8px 11px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, outline: 'none', background: '#fff', color: '#111827', boxSizing: 'border-box' }}>
            {TIPOS.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
          </select>
        </div>
      </div>

      {tipo === 'select' && (
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Opciones (separadas por coma)</label>
          <input value={opts} onChange={e => setOpts(e.target.value)} placeholder="Ej: Rojo, Verde, Azul"
            style={{ width: '100%', padding: '8px 11px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#111827' }}
            onFocus={e => e.target.style.borderColor = '#6366f1'}
            onBlur={e => e.target.style.borderColor = '#e5e7eb'}
          />
        </div>
      )}

      {err && <p style={{ margin: 0, fontSize: 12, color: '#dc2626', background: '#fef2f2', padding: '7px 10px', borderRadius: 7, border: '1px solid #fecaca' }}>⚠️ {err}</p>}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13, color: '#374151' }}>
          <input type="checkbox" checked={requerido} onChange={e => setReq(e.target.checked)} style={{ width: 14, height: 14, accentColor: '#6366f1' }} />
          Campo requerido
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onCancel} style={{ padding: '7px 14px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={submit} style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: '0 3px 10px rgba(99,102,241,0.3)' }}>+ Agregar</button>
        </div>
      </div>
    </div>
  )
}

// Modal to edit an existing custom field
function EditFieldModal({ campo, onSave, onClose }) {
  const [nombre,   setNombre]   = useState(campo.nombre)
  const [tipo,     setTipo]     = useState(campo.tipo)
  const [requerido, setReq]     = useState(campo.requerido || false)
  const [opts,     setOpts]     = useState((campo.opciones || []).join(', '))
  const [err,      setErr]      = useState('')

  function submit() {
    const n = nombre.trim()
    if (!n) { setErr('El nombre es obligatorio'); return }
    const saved = {
      ...campo,
      nombre: n,
      tipo,
      requerido,
    }
    if (tipo === 'select' && opts.trim()) {
      saved.opciones = opts.split(',').map(o => o.trim()).filter(Boolean)
    } else {
      delete saved.opciones
    }
    onSave(saved)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,12,55,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 900 }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 18, padding: '24px 26px', boxShadow: '0 24px 64px rgba(0,0,0,0.22)', maxWidth: 440, width: '90%', display: 'flex', flexDirection: 'column', gap: 16 }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#fef9c3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>✏️</div>
          <div>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 15, color: '#111827' }}>Editar campo personalizado</p>
            <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>ID: {campo.id}</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: '2 1 160px' }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Nombre</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} autoFocus
              onKeyDown={e => e.key === 'Enter' && submit()}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #e5e7eb', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#111827' }}
              onFocus={e => e.target.style.borderColor = '#6366f1'}
              onBlur={e => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>
          <div style={{ flex: '1 1 120px' }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Tipo</label>
            <select value={tipo} onChange={e => setTipo(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #e5e7eb', fontSize: 13, outline: 'none', background: '#fff', color: '#111827', boxSizing: 'border-box' }}>
              {TIPOS.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
            </select>
          </div>
        </div>

        {tipo === 'select' && (
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Opciones (separadas por coma)</label>
            <input value={opts} onChange={e => setOpts(e.target.value)} placeholder="Ej: Rojo, Verde, Azul"
              style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #e5e7eb', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#111827' }}
              onFocus={e => e.target.style.borderColor = '#6366f1'}
              onBlur={e => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>
        )}

        {err && <p style={{ margin: 0, fontSize: 12, color: '#dc2626', background: '#fef2f2', padding: '8px 12px', borderRadius: 8, border: '1px solid #fecaca' }}>⚠️ {err}</p>}

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#374151' }}>
          <input type="checkbox" checked={requerido} onChange={e => setReq(e.target.checked)} style={{ width: 14, height: 14, accentColor: '#6366f1' }} />
          Campo requerido
        </label>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 9, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={submit} style={{ padding: '9px 22px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#d97706,#b45309)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(217,119,6,0.35)' }}>Guardar cambios</button>
        </div>
      </div>
    </div>
  )
}

// ── Main form-editor component ──────────────────────────────────────────────
function FormularioConfigurable({
  catObj, catType, sections, unifiedSortedFields, _fullOrder,
  camposOcultos, camposNombres,
  editandoSistema, setEditandoSistema, onConfirmarRenombre,
  setCamposOcultos, setConfirmBorrarCampo, onEditCustomField,
  dragInfo, setDragInfo, dragOverId, setDragOverId, onDrop,
  addingSectionIdx, setAddingSectionIdx, onAddField, camposIds,
  pAgregar, pEditar, pOcultar, pEliminar, pReordenar,
}) {
  // Assign fields to sections based on their order position
  const sectionOf = {}
  sections.forEach((sec, i) => sec.ids.forEach(id => { sectionOf[id] = i }))

  const sectionFields = sections.map(() => [])
  let curSection = 0
  for (const f of unifiedSortedFields) {
    if (sectionOf[f.id] !== undefined) curSection = sectionOf[f.id]
    sectionFields[curSection].push(f)
  }

  // Position after which to insert when user adds to a section
  function getInsertAfterPos(si) {
    const fields = sectionFields[si]
    if (fields.length > 0) return _fullOrder.indexOf(fields[fields.length - 1].id)
    for (let i = si + 1; i < sections.length; i++) {
      const ff = sectionFields[i][0]
      if (ff) {
        const p = _fullOrder.indexOf(ff.id)
        return p > 0 ? p - 1 : -1
      }
    }
    return _fullOrder.length - 1
  }

  const renderField = campo => {
    const isSistema     = campo._tipo === 'sistema'
    const oculto        = isSistema && !campo._global && camposOcultos.includes(campo.id)
    const nombreMostrado = isSistema ? (camposNombres[campo.id] || campo.nombre) : campo.nombre
    return (
      <FieldConfigCard
        key={campo.id}
        campo={campo}
        isSistema={isSistema}
        oculto={oculto}
        nombreMostrado={nombreMostrado}
        editandoSistema={editandoSistema}
        setEditandoSistema={setEditandoSistema}
        onConfirmarRenombre={val => onConfirmarRenombre(campo.id, val)}
        onToggleHide={() => setCamposOcultos(prev => oculto ? prev.filter(id => id !== campo.id) : [...prev, campo.id])}
        onEditCustom={() => onEditCustomField(campo)}
        onDeleteCustom={() => setConfirmBorrarCampo(campo)}
        dragInfo={dragInfo}
        setDragInfo={setDragInfo}
        dragOverId={dragOverId}
        setDragOverId={setDragOverId}
        onDrop={onDrop}
        pEditar={pEditar}
        pOcultar={pOcultar}
        pEliminar={pEliminar}
        pReordenar={pReordenar}
      />
    )
  }

  const totalOcultos = camposOcultos.filter(id => {
    const f = unifiedSortedFields.find(x => x.id === id)
    return f && f._tipo === 'sistema' && !f._global
  }).length

  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e8eaee', boxShadow: '0 2px 16px rgba(0,0,0,0.07)', overflow: 'hidden' }}>

      {/* Form header — identical gradient to the real form */}
      <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg,#1a237e 0%,#2563eb 100%)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -24, right: -24, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'absolute', bottom: -30, right: 80, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative' }}>
          <div style={{ width: 46, height: 46, borderRadius: 13, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
            {catObj.icon || '📦'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#fff' }}>
              {catType === 'comp' ? 'Nuevo computador' : catType === 'tecno' ? 'Nuevo artículo tecnológico' : `Nuevo bien · ${catObj.label}`}
            </p>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.58)' }}>
              Vista de edición de campos · pasa el cursor sobre un campo para editarlo · arrastra para reordenar
            </p>
          </div>
          {totalOcultos > 0 && (
            <div style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, background: 'rgba(251,191,36,0.22)', color: '#fcd34d', borderRadius: 8, padding: '4px 10px', border: '1px solid rgba(251,191,36,0.3)' }}>
              {totalOcultos} oculto{totalOcultos !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div style={{ padding: '10px 24px', background: '#f0f4ff', borderBottom: '1px solid #dde3f5', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 4 }}>Leyenda:</span>
        {[
          { bg: '#fff', border: '#d1d5db', text: 'Sistema', color: '#374151' },
          { bg: '#ede9fe', border: '#c4b5fd', text: 'Personalizado', color: '#5b21b6' },
        ].map(({ bg, border, text, color }) => (
          <span key={text} style={{ display: 'flex', alignItems: 'center', gap: 5, background: bg, border: `1px solid ${border}`, borderRadius: 6, padding: '2px 8px' }}>
            <span style={{ fontSize: 10, fontWeight: 600, color }}>{text}</span>
          </span>
        ))}
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '2px 8px' }}>
          <span style={{ fontSize: 10, color: '#6b7280' }}>🔒 Base = protegido</span>
        </span>
        <span style={{ fontSize: 10, color: '#6b7280', marginLeft: 'auto' }}>Pasa el cursor para editar · Arrastra para reordenar</span>
      </div>

      {/* Form body */}
      <div style={{ padding: '22px 24px 28px', display: 'flex', flexDirection: 'column', gap: 2 }}>

        {sections.map((sec, si) => {
          const fields   = sectionFields[si]
          const isFooter = !!sec._footer
          const isHeader = !!sec._header

          return (
            <div key={si}>
              {/* Section divider */}
              {!isHeader && !isFooter && sec.label && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0 12px', padding: '11px 16px', borderRadius: 12, background: 'linear-gradient(135deg,#1e3a8a 0%,#1d4ed8 100%)', boxShadow: '0 2px 8px rgba(29,78,216,0.25)' }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>{sec.label}</span>
                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.2)' }} />
                </div>
              )}

              {/* Observaciones footer */}
              {isFooter ? (
                <div style={{ marginTop: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Observaciones</span>
                    <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                    <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 5, padding: '1px 7px' }}>🔒 base</span>
                  </div>
                  <div style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #d1d5db', background: '#f9fafb', fontSize: 13, color: '#94a3b8', minHeight: 66, boxSizing: 'border-box' }}>
                    Observación adicional…
                  </div>
                  {/* Custom fields that ended up in the footer section */}
                  {fields.filter(f => f._tipo === 'custom').length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 8 }}>
                      {fields.filter(f => f._tipo === 'custom').map(renderField)}
                    </div>
                  )}
                </div>
              ) : (
                /* Header & regular sections — 3-column grid */
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {fields.map(renderField)}
                </div>
              )}

              {/* + Agregar campo (not in footer, only with permission) */}
              {!isFooter && pAgregar && (
                addingSectionIdx === si ? (
                  <AddFieldInline
                    sectionLabel={sec.label}
                    existingIds={camposIds}
                    onAdd={({ id, nombre, tipo, requerido, opts }) =>
                      onAddField({ id, nombre, tipo, requerido, opts }, si, getInsertAfterPos(si))
                    }
                    onCancel={() => setAddingSectionIdx(null)}
                  />
                ) : (
                  <button
                    onClick={() => setAddingSectionIdx(si)}
                    style={{
                      width: '100%', padding: '9px 14px', marginTop: 10,
                      border: 'none', borderRadius: 10,
                      background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
                      cursor: 'pointer',
                      fontSize: 12, fontWeight: 700, color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                      transition: 'all 0.18s',
                      boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
                      opacity: 0.82,
                    }}
                    onMouseOver={e => {
                      e.currentTarget.style.opacity = '1'
                      e.currentTarget.style.boxShadow = '0 4px 14px rgba(99,102,241,0.45)'
                      e.currentTarget.style.transform = 'translateY(-1px)'
                    }}
                    onMouseOut={e => {
                      e.currentTarget.style.opacity = '0.82'
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(99,102,241,0.3)'
                      e.currentTarget.style.transform = 'translateY(0)'
                    }}
                  >
                    <span style={{ fontSize: 15, lineHeight: 1 }}>+</span>
                    Agregar campo personalizado
                    {sec.label && (
                      <span style={{ fontSize: 10, opacity: 0.75, fontWeight: 400 }}>
                        · {sec.label.replace(/^[^\w\s]+\s*/, '')}
                      </span>
                    )}
                  </button>
                )
              )}
            </div>
          )
        })}

        {/* Decorative save button — like the real form */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 22, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
          <div style={{ padding: '10px 26px', borderRadius: 10, background: 'linear-gradient(135deg,#1a237e,#2563eb)', color: '#fff', fontSize: 14, fontWeight: 700, opacity: 0.5, cursor: 'default', userSelect: 'none', letterSpacing: '0.01em' }}>
            Guardar bien
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export default function CamposCategoria({ usuario, permisos = {} }) {
  const esAdmin       = usuario?.rol === 'admin'
  const pAgregar      = esAdmin || !!permisos.agregar
  const pEditar       = esAdmin || !!permisos.editar
  const pOcultar      = esAdmin || !!permisos.ocultar
  const pEliminar     = esAdmin || !!permisos.eliminar
  const pReordenar    = esAdmin || !!permisos.reordenar
  const soloLectura   = !pAgregar && !pEditar && !pOcultar && !pEliminar && !pReordenar

  const [categorias,         setCategorias]         = useState([])
  const [catActiva,          setCatActiva]          = useState(null)
  const [campos,             setCampos]             = useState([])
  const [cargando,           setCargando]           = useState(true)
  const [guardando,          setGuardando]          = useState(false)
  const [exito,              setExito]              = useState(false)
  const [error,              setError]              = useState('')

  const [camposOcultos,      setCamposOcultos]      = useState([])
  const [camposNombres,      setCamposNombres]      = useState({})
  const [camposOrden,        setCamposOrden]        = useState([])

  const [editandoSistema,    setEditandoSistema]    = useState(null)

  // Saved baseline for change detection
  const [savedCampos,        setSavedCampos]        = useState([])
  const [savedCamposOcultos, setSavedCamposOcultos] = useState([])

  // Confirmation modals
  const [confirmGuardar,     setConfirmGuardar]     = useState(false)
  const [confirmSalirCat,    setConfirmSalirCat]    = useState(null)

  // Drag & drop
  const [dragInfo,           setDragInfo]           = useState(null)
  const [dragOverId,         setDragOverId]         = useState(null)

  // Category modals
  const [modalCat,           setModalCat]           = useState(null)
  const [confirmBorrar,      setConfirmBorrar]      = useState(null)
  const [borrandoCat,        setBorrandoCat]        = useState(false)

  // Field actions
  const [confirmBorrarCampo, setConfirmBorrarCampo] = useState(null)
  const [addingSectionIdx,   setAddingSectionIdx]   = useState(null)
  const [editingCustomField, setEditingCustomField] = useState(null)

  useEffect(() => { cargarCategorias() }, []) // eslint-disable-line

  async function cargarCategorias() {
    setCargando(true)
    const { data } = await supabase
      .from('categorias')
      .select('id, label, icon, campos_personalizados, campos_ocultos, campos_nombres, campos_orden, fija')
      .order('label')
    if (data) {
      setCategorias(data)
      if (data.length > 0) {
        const target = (catActiva && data.find(c => c.id === catActiva)) || data[0]
        setCatActiva(target.id)
        setCampos(target.campos_personalizados || [])
        setCamposOcultos(target.campos_ocultos  || [])
        setCamposNombres(target.campos_nombres  || {})
        setCamposOrden(target.campos_orden      || [])
        setSavedCampos(target.campos_personalizados || [])
        setSavedCamposOcultos(target.campos_ocultos || [])
      }
    }
    setCargando(false)
  }

  async function seleccionarCat(cat) {
    setCatActiva(cat.id)
    setError('')
    setAddingSectionIdx(null)
    setEditingCustomField(null)
    setEditandoSistema(null)
    const { data } = await supabase
      .from('categorias')
      .select('campos_personalizados, campos_ocultos, campos_nombres, campos_orden')
      .eq('id', cat.id)
      .single()
    setCampos(data?.campos_personalizados || [])
    setCamposOcultos(data?.campos_ocultos  || [])
    setCamposNombres(data?.campos_nombres  || {})
    setCamposOrden(data?.campos_orden      || [])
    setSavedCampos(data?.campos_personalizados || [])
    setSavedCamposOcultos(data?.campos_ocultos || [])
  }

  // ── Persist functions ───────────────────────────────────────────────────

  async function guardar() {
    if (!catActiva) return
    setGuardando(true); setError('')
    const { error: err } = await supabase.from('categorias')
      .update({ campos_personalizados: campos, campos_ocultos: camposOcultos, campos_nombres: camposNombres, campos_orden: camposOrden })
      .eq('id', catActiva)
    if (err) {
      setError('Error al guardar: ' + err.message)
    } else {
      const { data: fresh } = await supabase.from('categorias')
        .select('campos_personalizados, campos_ocultos, campos_nombres, campos_orden')
        .eq('id', catActiva).single()
      const cp = fresh?.campos_personalizados || []
      const co = fresh?.campos_ocultos        || []
      const cn = fresh?.campos_nombres        || {}
      const or = fresh?.campos_orden          || []
      setCampos(cp); setCamposOcultos(co); setCamposNombres(cn); setCamposOrden(or)
      setSavedCampos(cp); setSavedCamposOcultos(co)
      setCategorias(prev => prev.map(c => c.id === catActiva
        ? { ...c, campos_personalizados: cp, campos_ocultos: co, campos_nombres: cn, campos_orden: or }
        : c))
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
    const { error: err } = await supabase.from('categorias').update({ campos_orden: newOrden }).eq('id', catActiva)
    if (err) { setError('No se pudo guardar el orden: ' + err.message); return false }
    setCategorias(prev => prev.map(c => c.id === catActiva ? { ...c, campos_orden: newOrden } : c))
    return true
  }

  // ── Field handlers ──────────────────────────────────────────────────────

  function onConfirmarRenombre(fieldId, val) {
    setCamposNombres(prev => {
      const next = { ...prev }
      const originalNombre = (_base.find(c => c.id === fieldId) || {}).nombre
      if (val && val !== originalNombre) next[fieldId] = val
      else delete next[fieldId]
      guardarNombres(next)
      return next
    })
    setEditandoSistema(null)
  }

  function handleAddField({ id, nombre, tipo, requerido, opts }, _si, insertAfterPos) {
    const nuevoCampo = {
      id,
      nombre,
      tipo,
      requerido,
      ...(tipo === 'select' && opts.trim()
        ? { opciones: opts.split(',').map(o => o.trim()).filter(Boolean) }
        : {}),
    }
    setCampos(prev => [...prev, nuevoCampo])
    const newOrder = [..._fullOrder]
    newOrder.splice(insertAfterPos + 1, 0, id)
    setCamposOrden(newOrder)
    setAddingSectionIdx(null)
  }

  function handleEditCustomField(updated) {
    setCampos(prev => prev.map(c => c.id === updated.id ? updated : c))
    setEditingCustomField(null)
  }

  function eliminarCampo(id) {
    setCampos(prev => prev.filter(c => c.id !== id))
  }

  async function handleDropUnified(targetId) {
    if (!dragInfo || dragInfo.id === targetId) return
    const newOrder = moverItem(_fullOrder, dragInfo.id, targetId)
    if (JSON.stringify(newOrder) === JSON.stringify(_fullOrder)) return
    setCamposOrden(newOrder)
    const ok = await guardarOrden(newOrder)
    if (!ok && catObj) await seleccionarCat(catObj)
  }

  function moverItem(arr, fromId, toId) {
    const from = arr.indexOf(fromId)
    const to   = arr.indexOf(toId)
    if (from === -1 || to === -1 || from === to) return arr
    const next = [...arr]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    return next
  }

  // ── Category handlers ───────────────────────────────────────────────────

  async function handleGuardarCat({ label, icon }) {
    if (modalCat === 'nueva') {
      const id = label.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
      if (!id || categorias.some(c => c.id === id)) return
      const { data, error: err } = await supabase.from('categorias')
        .insert({ id, label, icon, fija: false, campos_personalizados: [] }).select().single()
      if (err) throw new Error(err.message)
      const nuevas = [...categorias, data].sort((a, b) => a.label.localeCompare(b.label))
      setCategorias(nuevas); setModalCat(null)
      setCatActiva(data.id); setCampos([])
    } else {
      const { error: err } = await supabase.from('categorias').update({ label, icon }).eq('id', modalCat.id)
      if (err) throw new Error(err.message)
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

  // ── Computed values ─────────────────────────────────────────────────────

  const catObj  = categorias.find(c => c.id === catActiva)
  const catType = getCatType(catObj)
  const _base   = catObj ? getCamposSistema(catObj) : []

  const _allFields = catObj ? [
    ..._base.map(c => ({ ...c, _tipo: 'sistema' })),
    ...campos.map(c => ({ ...c, _tipo: 'custom' })),
  ] : []
  const _allIds    = _allFields.map(f => f.id)
  const _fullOrder = camposOrden.length
    ? smartMergeOrder(camposOrden.filter(id => _allIds.includes(id)), _allIds)
    : _allIds
  const unifiedSortedFields = [..._allFields].sort((a, b) => _fullOrder.indexOf(a.id) - _fullOrder.indexOf(b.id))

  const hayambios = JSON.stringify(campos) !== JSON.stringify(savedCampos) ||
    JSON.stringify([...camposOcultos].sort()) !== JSON.stringify([...savedCamposOcultos].sort())

  // ── Render ──────────────────────────────────────────────────────────────

  if (cargando) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', color: 'rgba(255,255,255,0.5)', flexDirection: 'column', gap: 14 }}>
      <div style={{ width: 32, height: 32, border: '3px solid rgba(255,255,255,0.15)', borderTopColor: '#d4a017', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>
      <span style={{ fontSize: 13 }}>Cargando categorías…</span>
    </div>
  )

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Page header */}
      <div style={{ background: 'linear-gradient(135deg,#1a237e 0%,#2563eb 100%)', borderRadius: 16, padding: '20px 24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -20, right: -20, width: 110, height: 110, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ position: 'absolute', bottom: -30, right: 60, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative' }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🗂️</div>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#fff' }}>Campos por categoría</h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Edita los campos directamente sobre el formulario real de cada categoría</p>
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

        {/* ── Category list sidebar ──────────────────────────── */}
        <div style={{ width: 'min(220px, 100%)', flexShrink: 0, background: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #f1f1f3', overflow: 'hidden', alignSelf: 'flex-start', position: 'sticky', top: 16 }}>
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
                <div key={cat.id} onClick={() => hayambios && cat.id !== catActiva ? setConfirmSalirCat(cat) : seleccionarCat(cat)} className="ajustes-cat-item"
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

        {/* ── Form editor + save button ──────────────────────── */}
        {catObj && (
          <div style={{ flex: 1, minWidth: 300, display: 'flex', flexDirection: 'column', gap: 14 }}>

            {soloLectura && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fefce8', border: '1.5px solid #fde047', borderRadius: 10, padding: '10px 14px' }}>
                <span style={{ fontSize: 16 }}>👁️</span>
                <p style={{ margin: 0, fontSize: 13, color: '#854d0e', fontWeight: 500 }}>
                  Modo solo lectura — no tienes permisos para modificar campos en esta sección.
                </p>
              </div>
            )}

            <FormularioConfigurable
              catObj={catObj}
              catType={catType}
              sections={FORM_SECTIONS[catType] || FORM_SECTIONS.generico}
              unifiedSortedFields={unifiedSortedFields}
              _fullOrder={_fullOrder}
              camposOcultos={camposOcultos}
              camposNombres={camposNombres}
              editandoSistema={editandoSistema}
              setEditandoSistema={setEditandoSistema}
              onConfirmarRenombre={onConfirmarRenombre}
              setCamposOcultos={setCamposOcultos}
              setConfirmBorrarCampo={setConfirmBorrarCampo}
              onEditCustomField={campo => setEditingCustomField(campo)}
              dragInfo={dragInfo}
              setDragInfo={setDragInfo}
              dragOverId={dragOverId}
              setDragOverId={setDragOverId}
              onDrop={handleDropUnified}
              addingSectionIdx={addingSectionIdx}
              setAddingSectionIdx={setAddingSectionIdx}
              onAddField={handleAddField}
              camposIds={campos.map(c => c.id)}
              pAgregar={pAgregar}
              pEditar={pEditar}
              pOcultar={pOcultar}
              pEliminar={pEliminar}
              pReordenar={pReordenar}
            />

            {/* Save button — hidden when read-only */}
            {!soloLectura && (
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 8 }}>
                {exito && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#059669', fontWeight: 600, background: '#f0fdf4', padding: '7px 12px', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                    ✓ Cambios guardados
                  </div>
                )}
                {!hayambios && !exito && (
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>No hay cambios para guardar</span>
                )}
                <button onClick={() => hayambios && setConfirmGuardar(true)} disabled={guardando || !hayambios}
                  style={{ padding: '10px 26px', borderRadius: 10, border: 'none',
                    background: 'linear-gradient(135deg,#1a237e,#2563eb)', color: '#fff',
                    fontSize: 13, fontWeight: 700,
                    cursor: guardando ? 'wait' : !hayambios ? 'default' : 'pointer',
                    opacity: guardando || !hayambios ? 0.45 : 1, boxShadow: '0 4px 14px rgba(26,35,126,0.35)',
                    display: 'flex', alignItems: 'center', gap: 8 }}>
                  {guardando ? '⏳ Guardando…' : '💾 Guardar cambios'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* CSS hover for category list */}
      <style>{`
        .ajustes-cat-item:hover .ajustes-cat-actions { opacity: 1 !important; }
        .ajustes-cat-item:hover { background: rgba(99,102,241,0.04) !important; }
      `}</style>

      {/* ── Modals ─────────────────────────────────────────── */}

      {modalCat && (
        <ModalCategoria
          cat={modalCat === 'nueva' ? null : modalCat}
          onClose={() => setModalCat(null)}
          onSave={handleGuardarCat}
        />
      )}

      {editingCustomField && (
        <EditFieldModal
          campo={editingCustomField}
          onSave={handleEditCustomField}
          onClose={() => setEditingCustomField(null)}
        />
      )}

      {confirmBorrarCampo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,12,55,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 900 }}
          onClick={() => setConfirmBorrarCampo(null)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '26px 28px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', maxWidth: 360, width: '90%', display: 'flex', flexDirection: 'column', gap: 16 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🗑️</div>
              <div>
                <p style={{ margin: '0 0 6px', fontWeight: 800, fontSize: 15, color: '#111827' }}>¿Eliminar campo "{confirmBorrarCampo.nombre}"?</p>
                <p style={{ margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
                  Esta acción no puede deshacerse. Los bienes existentes no perderán sus datos, pero el campo dejará de aparecer en el formulario.
                </p>
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

      {confirmGuardar && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,12,55,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 900 }}
          onClick={() => setConfirmGuardar(false)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '26px 28px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', maxWidth: 400, width: '90%', display: 'flex', flexDirection: 'column', gap: 16 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>💾</div>
              <div>
                <p style={{ margin: '0 0 8px', fontWeight: 800, fontSize: 15, color: '#111827' }}>¿Guardar cambios en los campos?</p>
                <p style={{ margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
                  Se actualizará la configuración de campos de la categoría seleccionada.<br />
                  Los cambios afectarán el formulario de creación y edición de bienes de esta categoría.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmGuardar(false)}
                style={{ padding: '9px 18px', borderRadius: 9, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={() => { setConfirmGuardar(false); guardar() }}
                style={{ padding: '9px 22px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#1a237e,#2563eb)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(26,35,126,0.35)' }}>
                💾 Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmSalirCat && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,12,55,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 900 }}
          onClick={() => setConfirmSalirCat(null)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '26px 28px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', maxWidth: 380, width: '90%', display: 'flex', flexDirection: 'column', gap: 16 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: '#fefce8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>⚠️</div>
              <div>
                <p style={{ margin: '0 0 8px', fontWeight: 800, fontSize: 15, color: '#111827' }}>Hay cambios sin guardar</p>
                <p style={{ margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
                  ¿Deseas salir igualmente? Los cambios pendientes se perderán.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmSalirCat(null)}
                style={{ padding: '9px 18px', borderRadius: 9, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Permanecer
              </button>
              <button onClick={() => { const cat = confirmSalirCat; setConfirmSalirCat(null); seleccionarCat(cat) }}
                style={{ padding: '9px 20px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#d97706,#b45309)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(217,119,6,0.35)' }}>
                Salir sin guardar
              </button>
            </div>
          </div>
        </div>
      )}

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
