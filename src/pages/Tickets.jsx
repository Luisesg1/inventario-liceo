import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const PRIORIDAD_COLOR = {
  alta:  { bg: '#fee2e2', color: '#b91c1c', label: '🔴 Alta' },
  media: { bg: '#fef9c3', color: '#854d0e', label: '🟡 Media' },
  baja:  { bg: '#dcfce7', color: '#166534', label: '🟢 Baja' },
}
const ESTADO_COLOR = {
  'Abierto':    { bg: '#dbeafe', color: '#1d4ed8' },
  'En proceso': { bg: '#fef9c3', color: '#854d0e' },
  'Resuelto':   { bg: '#dcfce7', color: '#166534' },
}

const FORM_VACIO = { titulo: '', descripcion: '', bien_id: '', bien_nombre: '', prioridad: 'media' }

export default function Tickets({ usuario }) {
  const [tickets,         setTickets]         = useState([])
  const [bienes,          setBienes]          = useState([])
  const [cargando,        setCargando]        = useState(true)
  const [filtroEstado,    setFiltroEstado]    = useState('')
  const [filtroPrioridad, setFiltroPrioridad] = useState('')
  const [modalNuevo,      setModalNuevo]      = useState(false)
  const [form,            setForm]            = useState(FORM_VACIO)
  const [guardando,       setGuardando]       = useState(false)
  const [ticketDetalle,   setTicketDetalle]   = useState(null)
  const [editEstado,      setEditEstado]      = useState('')
  const [editNotas,       setEditNotas]       = useState('')
  const [guardandoEdit,   setGuardandoEdit]   = useState(false)
  const [bienQuery,       setBienQuery]       = useState('')

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    setCargando(true)
    const [{ data: t }, { data: b }] = await Promise.all([
      supabase.from('tickets').select('*').order('creado_en', { ascending: false }),
      supabase.from('bienes').select('id, nombre, codigo').order('nombre'),
    ])
    setTickets(t ?? [])
    setBienes(b ?? [])
    setCargando(false)
  }

  const filtrados = tickets.filter(t =>
    (!filtroEstado    || t.estado    === filtroEstado) &&
    (!filtroPrioridad || t.prioridad === filtroPrioridad)
  )

  const abrirNuevo = () => { setForm(FORM_VACIO); setBienQuery(''); setModalNuevo(true) }
  const cerrarNuevo = () => setModalNuevo(false)

  const bienSeleccionado = bienes.find(b => String(b.id) === String(form.bien_id))
  const bienesFiltrados  = bienQuery
    ? bienes.filter(b => `${b.nombre} ${b.codigo}`.toLowerCase().includes(bienQuery.toLowerCase())).slice(0, 8)
    : []

  const crearTicket = async () => {
    if (!form.titulo.trim()) return
    setGuardando(true)
    const { error } = await supabase.from('tickets').insert({
      titulo:            form.titulo.trim(),
      descripcion:       form.descripcion.trim() || null,
      bien_id:           form.bien_id || null,
      bien_nombre:       bienSeleccionado ? `${bienSeleccionado.nombre} (${bienSeleccionado.codigo})` : null,
      prioridad:         form.prioridad,
      creado_por:        usuario.id,
      creado_por_nombre: usuario.nombre,
    })
    if (!error) { await cargar(); cerrarNuevo() }
    setGuardando(false)
  }

  const abrirDetalle = (t) => {
    setTicketDetalle(t)
    setEditEstado(t.estado)
    setEditNotas(t.notas ?? '')
  }
  const cerrarDetalle = () => setTicketDetalle(null)

  const guardarCambios = async () => {
    if (!ticketDetalle) return
    setGuardandoEdit(true)
    const { error } = await supabase.from('tickets').update({
      estado: editEstado,
      notas:  editNotas.trim() || null,
    }).eq('id', ticketDetalle.id)
    if (!error) {
      setTickets(prev => prev.map(t => t.id === ticketDetalle.id
        ? { ...t, estado: editEstado, notas: editNotas.trim() || null }
        : t
      ))
      cerrarDetalle()
    }
    setGuardandoEdit(false)
  }

  const eliminarTicket = async (id) => {
    if (!confirm('¿Eliminar este ticket?')) return
    await supabase.from('tickets').delete().eq('id', id)
    setTickets(prev => prev.filter(t => t.id !== id))
    if (ticketDetalle?.id === id) cerrarDetalle()
  }

  const fmt = (iso) => new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })

  const overlayStyle = {
    position: 'fixed', inset: 0, background: 'rgba(5,12,55,0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: '16px',
  }
  const modalStyle = {
    background: '#fff', borderRadius: '18px', padding: '1.75rem',
    width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto',
    boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
  }
  const inputStyle = {
    width: '100%', padding: '8px 12px', borderRadius: '8px',
    border: '1.5px solid #e5e7eb', fontSize: '0.88rem', boxSizing: 'border-box',
  }
  const labelStyle = { display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#374151', marginBottom: '4px' }

  if (cargando) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 12 }}>
      <div style={{ width: 36, height: 36, border: '3px solid #e5e7eb', borderTopColor: '#1a237e', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>Cargando tickets…</p>
    </div>
  )

  return (
    <div style={{ padding: '0' }}>

      {/* Barra superior */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
            style={{ padding: '7px 12px', borderRadius: '8px', border: '1.5px solid #e5e7eb', fontSize: '0.82rem', cursor: 'pointer', background: filtroEstado ? '#eff6ff' : '#fff' }}>
            <option value="">Todos los estados</option>
            <option value="Abierto">🔵 Abierto</option>
            <option value="En proceso">🟡 En proceso</option>
            <option value="Resuelto">🟢 Resuelto</option>
          </select>
          <select value={filtroPrioridad} onChange={e => setFiltroPrioridad(e.target.value)}
            style={{ padding: '7px 12px', borderRadius: '8px', border: '1.5px solid #e5e7eb', fontSize: '0.82rem', cursor: 'pointer', background: filtroPrioridad ? '#eff6ff' : '#fff' }}>
            <option value="">Todas las prioridades</option>
            <option value="alta">🔴 Alta</option>
            <option value="media">🟡 Media</option>
            <option value="baja">🟢 Baja</option>
          </select>
          {(filtroEstado || filtroPrioridad) && (
            <button onClick={() => { setFiltroEstado(''); setFiltroPrioridad('') }}
              style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid #fca5a5', background: '#fff1f2', color: '#ef4444', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
              ✕ Limpiar
            </button>
          )}
        </div>
        <button onClick={abrirNuevo}
          style={{ padding: '8px 18px', background: 'linear-gradient(135deg,#1a237e,#2563eb)', color: '#fff', border: 'none', borderRadius: '9px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(37,99,235,0.3)', whiteSpace: 'nowrap' }}>
          + Nuevo ticket
        </button>
      </div>

      {/* Contadores */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {['Abierto', 'En proceso', 'Resuelto'].map(e => {
          const c = ESTADO_COLOR[e]
          const n = tickets.filter(t => t.estado === e).length
          return (
            <div key={e} style={{ background: c.bg, color: c.color, borderRadius: '10px', padding: '8px 16px', fontSize: '0.82rem', fontWeight: 700 }}>
              {e}: {n}
            </div>
          )
        })}
      </div>

      {/* Lista */}
      {filtrados.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
          <p style={{ fontSize: '2rem', marginBottom: '8px' }}>🎫</p>
          <p style={{ fontWeight: 600 }}>No hay tickets</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtrados.map(t => {
            const p = PRIORIDAD_COLOR[t.prioridad]
            const e = ESTADO_COLOR[t.estado]
            return (
              <div key={t.id} onClick={() => abrirDetalle(t)}
                style={{ background: '#fff', border: '1.5px solid #e8edf8', borderRadius: '14px', padding: '14px 16px', cursor: 'pointer', transition: 'box-shadow 0.15s', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
                onMouseEnter={ev => ev.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)'}
                onMouseLeave={ev => ev.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem', color: '#111827', overflowWrap: 'break-word' }}>{t.titulo}</p>
                    {t.bien_nombre && <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#6b7280' }}>📦 {t.bien_nombre}</p>}
                    {t.descripcion && <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#4b5563', overflowWrap: 'break-word' }}>{t.descripcion}</p>}
                    <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>Por {t.creado_por_nombre} · {fmt(t.creado_en)}</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                    <span style={{ background: e.bg, color: e.color, borderRadius: '6px', padding: '2px 10px', fontSize: '0.75rem', fontWeight: 700 }}>{t.estado}</span>
                    <span style={{ background: p.bg, color: p.color, borderRadius: '6px', padding: '2px 10px', fontSize: '0.75rem', fontWeight: 700 }}>{p.label}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal — Nuevo ticket */}
      {modalNuevo && (
        <div style={overlayStyle} onClick={cerrarNuevo}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#1a237e' }}>Nuevo ticket</h2>
              <button onClick={cerrarNuevo} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#6b7280' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Título *</label>
                <input style={inputStyle} value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ej: Proyector no enciende" />
              </div>
              <div>
                <label style={labelStyle}>Descripción</label>
                <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Detalle del problema…" />
              </div>
              <div>
                <label style={labelStyle}>Bien afectado (opcional)</label>
                <input style={inputStyle} value={bienQuery || (bienSeleccionado ? `${bienSeleccionado.nombre} (${bienSeleccionado.codigo})` : '')}
                  onChange={e => { setBienQuery(e.target.value); setForm(f => ({ ...f, bien_id: '' })) }}
                  placeholder="Buscar bien por nombre o código…" />
                {bienesFiltrados.length > 0 && !form.bien_id && (
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', marginTop: '4px', maxHeight: '160px', overflowY: 'auto' }}>
                    {bienesFiltrados.map(b => (
                      <div key={b.id} onClick={() => { setForm(f => ({ ...f, bien_id: b.id })); setBienQuery('') }}
                        style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.82rem', borderBottom: '1px solid #f3f4f6' }}
                        onMouseEnter={ev => ev.currentTarget.style.background = '#f0f4ff'}
                        onMouseLeave={ev => ev.currentTarget.style.background = ''}>
                        {b.nombre} <span style={{ color: '#9ca3af' }}>· {b.codigo}</span>
                      </div>
                    ))}
                  </div>
                )}
                {form.bien_id && (
                  <button onClick={() => { setForm(f => ({ ...f, bien_id: '' })); setBienQuery('') }}
                    style={{ marginTop: '4px', fontSize: '0.75rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>
                    ✕ Quitar bien
                  </button>
                )}
              </div>
              <div>
                <label style={labelStyle}>Prioridad</label>
                <select style={inputStyle} value={form.prioridad} onChange={e => setForm(f => ({ ...f, prioridad: e.target.value }))}>
                  <option value="alta">🔴 Alta</option>
                  <option value="media">🟡 Media</option>
                  <option value="baja">🟢 Baja</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
              <button onClick={cerrarNuevo} style={{ padding: '8px 20px', borderRadius: '8px', border: '1.5px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', fontSize: '0.85rem' }}>Cancelar</button>
              <button onClick={crearTicket} disabled={guardando || !form.titulo.trim()}
                style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg,#1a237e,#2563eb)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', opacity: (guardando || !form.titulo.trim()) ? 0.6 : 1 }}>
                {guardando ? 'Guardando…' : 'Crear ticket'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — Ver/Editar ticket */}
      {ticketDetalle && (
        <div style={overlayStyle} onClick={cerrarDetalle}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', gap: '10px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem', color: '#111827', overflowWrap: 'break-word' }}>{ticketDetalle.titulo}</p>
                <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>Por {ticketDetalle.creado_por_nombre} · {fmt(ticketDetalle.creado_en)}</p>
              </div>
              <button onClick={cerrarDetalle} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#6b7280', flexShrink: 0 }}>✕</button>
            </div>

            {ticketDetalle.bien_nombre && (
              <div style={{ background: '#f0f4ff', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px', fontSize: '0.82rem', color: '#1a237e' }}>
                📦 {ticketDetalle.bien_nombre}
              </div>
            )}

            {ticketDetalle.descripcion && (
              <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px', fontSize: '0.85rem', color: '#374151', overflowWrap: 'break-word' }}>
                {ticketDetalle.descripcion}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <span style={{ background: PRIORIDAD_COLOR[ticketDetalle.prioridad].bg, color: PRIORIDAD_COLOR[ticketDetalle.prioridad].color, borderRadius: '6px', padding: '3px 12px', fontSize: '0.78rem', fontWeight: 700 }}>
                {PRIORIDAD_COLOR[ticketDetalle.prioridad].label}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Estado</label>
                <select style={inputStyle} value={editEstado} onChange={e => setEditEstado(e.target.value)}>
                  <option value="Abierto">🔵 Abierto</option>
                  <option value="En proceso">🟡 En proceso</option>
                  <option value="Resuelto">🟢 Resuelto</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Notas / Resolución</label>
                <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} value={editNotas} onChange={e => setEditNotas(e.target.value)} placeholder="Agrega observaciones o cómo se resolvió…" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem', justifyContent: 'space-between' }}>
              <button onClick={() => eliminarTicket(ticketDetalle.id)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #fca5a5', background: '#fff1f2', color: '#ef4444', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
                Eliminar
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={cerrarDetalle} style={{ padding: '8px 18px', borderRadius: '8px', border: '1.5px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', fontSize: '0.85rem' }}>Cancelar</button>
                <button onClick={guardarCambios} disabled={guardandoEdit}
                  style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg,#1a237e,#2563eb)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', opacity: guardandoEdit ? 0.6 : 1 }}>
                  {guardandoEdit ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
