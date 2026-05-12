import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import './Tickets.css'

const PRIORIDAD = {
  alta:  { bg: '#fee2e2', color: '#b91c1c', label: '🔴 Alta' },
  media: { bg: '#fef9c3', color: '#854d0e', label: '🟡 Media' },
  baja:  { bg: '#dcfce7', color: '#166534', label: '🟢 Baja' },
}
const ESTADO = {
  'Abierto':    { bg: '#dbeafe', color: '#1d4ed8', icon: '🔵' },
  'En proceso': { bg: '#fef9c3', color: '#854d0e', icon: '🟡' },
  'Resuelto':   { bg: '#dcfce7', color: '#166534', icon: '🟢' },
}
const KPI_BORDER = { 'Abierto': '#2563eb', 'En proceso': '#d97706', 'Resuelto': '#16a34a' }

const FORM_VACIO = { titulo: '', descripcion: '', bien_id: '', prioridad: 'media' }

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

  const abrirNuevo  = () => { setForm(FORM_VACIO); setBienQuery(''); setModalNuevo(true) }
  const cerrarNuevo = () => setModalNuevo(false)

  const bienSel         = bienes.find(b => String(b.id) === String(form.bien_id))
  const bienesFiltrados = bienQuery
    ? bienes.filter(b => `${b.nombre} ${b.codigo}`.toLowerCase().includes(bienQuery.toLowerCase())).slice(0, 8)
    : []

  const crearTicket = async () => {
    if (!form.titulo.trim()) return
    setGuardando(true)
    const { error } = await supabase.from('tickets').insert({
      titulo:            form.titulo.trim(),
      descripcion:       form.descripcion.trim() || null,
      bien_id:           form.bien_id || null,
      bien_nombre:       bienSel ? `${bienSel.nombre} (${bienSel.codigo})` : null,
      prioridad:         form.prioridad,
      creado_por:        usuario.id,
      creado_por_nombre: usuario.nombre,
    })
    if (!error) { await cargar(); cerrarNuevo() }
    setGuardando(false)
  }

  const abrirDetalle = (t) => { setTicketDetalle(t); setEditEstado(t.estado); setEditNotas(t.notas ?? '') }
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
        ? { ...t, estado: editEstado, notas: editNotas.trim() || null } : t))
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

  if (cargando) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 12 }}>
      <div style={{ width: 36, height: 36, border: '3px solid #e5e7eb', borderTopColor: '#1a237e', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>Cargando tickets…</p>
    </div>
  )

  return (
    <div className="tickets-wrap">

      {/* KPIs */}
      <div className="tickets-kpis">
        {['Abierto', 'En proceso', 'Resuelto'].map(e => {
          const n = tickets.filter(t => t.estado === e).length
          const est = ESTADO[e]
          return (
            <div key={e} className="tickets-kpi" style={{ borderLeftColor: KPI_BORDER[e] }}
              onClick={() => setFiltroEstado(filtroEstado === e ? '' : e)} title={`Filtrar por ${e}`}>
              <span className="tickets-kpi-icon">{est.icon}</span>
              <div>
                <p className="tickets-kpi-val">{n}</p>
                <p className="tickets-kpi-lbl">{e}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Toolbar */}
      <div className="tickets-toolbar">
        <div className="tickets-filtros">
          <select className={filtroEstado ? 'activo' : ''} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="Abierto">🔵 Abierto</option>
            <option value="En proceso">🟡 En proceso</option>
            <option value="Resuelto">🟢 Resuelto</option>
          </select>
          <select className={filtroPrioridad ? 'activo' : ''} value={filtroPrioridad} onChange={e => setFiltroPrioridad(e.target.value)}>
            <option value="">Todas las prioridades</option>
            <option value="alta">🔴 Alta</option>
            <option value="media">🟡 Media</option>
            <option value="baja">🟢 Baja</option>
          </select>
          {(filtroEstado || filtroPrioridad) && (
            <button className="btn-limpiar-filtros" onClick={() => { setFiltroEstado(''); setFiltroPrioridad('') }}>✕ Limpiar</button>
          )}
        </div>
        <button className="btn-nuevo-ticket" onClick={abrirNuevo}>+ Nuevo ticket</button>
      </div>

      {/* Lista */}
      {filtrados.length === 0 ? (
        <div className="tickets-empty">
          <div className="tickets-empty-icon">🎫</div>
          <p>{tickets.length === 0 ? 'Aún no hay tickets registrados' : 'No hay tickets con estos filtros'}</p>
        </div>
      ) : (
        <div className="tickets-lista">
          {filtrados.map(t => {
            const p = PRIORIDAD[t.prioridad]
            const e = ESTADO[t.estado]
            return (
              <div key={t.id} className="ticket-card" onClick={() => abrirDetalle(t)}>
                <div className="ticket-card-body">
                  <div className="ticket-card-info">
                    <p className="ticket-titulo">{t.titulo}</p>
                    {t.bien_nombre && <p className="ticket-bien">📦 {t.bien_nombre}</p>}
                    {t.descripcion && <p className="ticket-desc">{t.descripcion}</p>}
                    <p className="ticket-meta">Por {t.creado_por_nombre} · {fmt(t.creado_en)}</p>
                  </div>
                  <div className="ticket-badges">
                    <span className="badge-estado" style={{ background: e.bg, color: e.color }}>{t.estado}</span>
                    <span className="badge-prio"   style={{ background: p.bg, color: p.color }}>{p.label}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal — Nuevo ticket */}
      {modalNuevo && (
        <div className="modal-tickets-overlay" onClick={cerrarNuevo}>
          <div className="modal-tickets" onClick={e => e.stopPropagation()}>
            <div className="modal-tickets-header">
              <h2 className="modal-tickets-title">🎫 Nuevo ticket</h2>
              <button className="modal-tickets-close" onClick={cerrarNuevo}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="modal-field">
                <label className="modal-label">Título *</label>
                <input className="modal-input" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ej: Proyector de sala 3 no enciende" />
              </div>
              <div className="modal-field">
                <label className="modal-label">Descripción</label>
                <textarea className="modal-textarea" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Detalla el problema…" />
              </div>
              <div className="modal-field">
                <label className="modal-label">Bien afectado (opcional)</label>
                <div style={{ position: 'relative' }}>
                  <input className="modal-input"
                    value={bienQuery || (bienSel ? `${bienSel.nombre} (${bienSel.codigo})` : '')}
                    onChange={e => { setBienQuery(e.target.value); setForm(f => ({ ...f, bien_id: '' })) }}
                    placeholder="Buscar por nombre o código…" />
                  {bienesFiltrados.length > 0 && !form.bien_id && (
                    <div className="bien-dropdown">
                      {bienesFiltrados.map(b => (
                        <div key={b.id} className="bien-dropdown-item"
                          onClick={() => { setForm(f => ({ ...f, bien_id: b.id })); setBienQuery('') }}>
                          {b.nombre} <span style={{ color: '#9ca3af' }}>· {b.codigo}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {form.bien_id && (
                  <button onClick={() => { setForm(f => ({ ...f, bien_id: '' })); setBienQuery('') }}
                    style={{ alignSelf: 'flex-start', marginTop: 4, fontSize: '0.75rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    ✕ Quitar bien
                  </button>
                )}
              </div>
              <div className="modal-field">
                <label className="modal-label">Prioridad</label>
                <select className="modal-select" value={form.prioridad} onChange={e => setForm(f => ({ ...f, prioridad: e.target.value }))}>
                  <option value="alta">🔴 Alta</option>
                  <option value="media">🟡 Media</option>
                  <option value="baja">🟢 Baja</option>
                </select>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn-modal-cancel" onClick={cerrarNuevo}>Cancelar</button>
              <button className="btn-modal-save" onClick={crearTicket} disabled={guardando || !form.titulo.trim()}>
                {guardando ? 'Guardando…' : 'Crear ticket'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — Ver / Actualizar ticket */}
      {ticketDetalle && (
        <div className="modal-tickets-overlay" onClick={cerrarDetalle}>
          <div className="modal-tickets" onClick={e => e.stopPropagation()}>
            <div className="modal-tickets-header">
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem', color: '#111827', overflowWrap: 'break-word' }}>{ticketDetalle.titulo}</p>
                <p style={{ margin: '2px 0 0', fontSize: '0.73rem', color: '#9ca3af' }}>Por {ticketDetalle.creado_por_nombre} · {fmt(ticketDetalle.creado_en)}</p>
              </div>
              <button className="modal-tickets-close" onClick={cerrarDetalle}>✕</button>
            </div>

            {ticketDetalle.bien_nombre && (
              <div className="ticket-detalle-bien">📦 {ticketDetalle.bien_nombre}</div>
            )}
            {ticketDetalle.descripcion && (
              <div className="ticket-detalle-desc">{ticketDetalle.descripcion}</div>
            )}

            <div className="ticket-detalle-badges">
              <span className="badge-prio" style={{ background: PRIORIDAD[ticketDetalle.prioridad].bg, color: PRIORIDAD[ticketDetalle.prioridad].color }}>
                {PRIORIDAD[ticketDetalle.prioridad].label}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="modal-field">
                <label className="modal-label">Estado</label>
                <select className="modal-select" value={editEstado} onChange={e => setEditEstado(e.target.value)}>
                  <option value="Abierto">🔵 Abierto</option>
                  <option value="En proceso">🟡 En proceso</option>
                  <option value="Resuelto">🟢 Resuelto</option>
                </select>
              </div>
              <div className="modal-field">
                <label className="modal-label">Notas / Resolución</label>
                <textarea className="modal-textarea" value={editNotas} onChange={e => setEditNotas(e.target.value)} placeholder="Agrega observaciones o cómo se resolvió…" />
              </div>
            </div>

            <div className="modal-actions-split">
              <button className="btn-modal-del" onClick={() => eliminarTicket(ticketDetalle.id)}>Eliminar</button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-modal-cancel" onClick={cerrarDetalle}>Cancelar</button>
                <button className="btn-modal-save" onClick={guardarCambios} disabled={guardandoEdit}>
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
