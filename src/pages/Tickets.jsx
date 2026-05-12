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

const AREAS = ['Proyector', 'Conector HDMI Muro', 'Conector HDMI Proyector', 'Notebook',
  'Computador de escritorio', 'Impresora', 'Red de Internet', 'Teclado', 'Mouse', 'Otro']
const ROLES = ['Directivo', 'Docente', 'Asistente de la educación', 'Coordinador(a)']

const FORM_VACIO = {
  nombre: '', apellidos: '', rol_solicitante: '', correo_contacto: '',
  area_reporte: '', area_otro: '', marca_modelo_falla: '',
  lugar_falla: '', descripcion: '',
}

export default function Tickets({ usuario, onTicketActualizado }) {
  const esAdmin = usuario.rol === 'admin'
  const [tickets,         setTickets]         = useState([])
  const [cargando,        setCargando]        = useState(true)
  const [filtroEstado,    setFiltroEstado]    = useState('')
  const [filtroPrioridad, setFiltroPrioridad] = useState('')
  const [modalNuevo,      setModalNuevo]      = useState(false)
  const [form,            setForm]            = useState(FORM_VACIO)
  const [guardando,       setGuardando]       = useState(false)
  const [ticketDetalle,   setTicketDetalle]   = useState(null)
  const [editEstado,      setEditEstado]      = useState('')
  const [editPrioridad,   setEditPrioridad]   = useState('media')
  const [editNotas,       setEditNotas]       = useState('')
  const [guardandoEdit,   setGuardandoEdit]   = useState(false)
  const [confirmarEliminar, setConfirmarEliminar] = useState(false)
  const [modoSeleccion,   setModoSeleccion]   = useState(false)
  const [seleccionados,   setSeleccionados]   = useState(new Set())
  const [confirmandoBulk, setConfirmandoBulk] = useState(false)

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    setCargando(true)
    let q = supabase.from('tickets').select('*').order('creado_en', { ascending: false })
    if (!esAdmin) q = q.eq('creado_por', usuario.id)
    const { data } = await q
    setTickets(data ?? [])
    setCargando(false)
  }

  const filtrados = tickets.filter(t =>
    (!filtroEstado    || t.estado    === filtroEstado) &&
    (!filtroPrioridad || t.prioridad === filtroPrioridad)
  )

  const abrirNuevo = () => {
    const [nombre = '', ...rest] = (usuario.nombre || '').split(' ')
    setForm({ ...FORM_VACIO, nombre, apellidos: rest.join(' '), correo_contacto: usuario.email || '' })
    setModalNuevo(true)
  }
  const cerrarNuevo = () => setModalNuevo(false)
  const setF = (campo, val) => setForm(f => ({ ...f, [campo]: val }))

  const areaLabel = (t) => t.area_reporte === 'Otro' && t.area_otro ? `Otro — ${t.area_otro}` : (t.area_reporte || t.titulo || '—')

  const formValido = form.nombre.trim() && form.apellidos.trim() && form.rol_solicitante && form.correo_contacto.trim() && form.area_reporte && form.lugar_falla.trim() && form.descripcion.trim()

  const crearTicket = async () => {
    if (!formValido) return
    setGuardando(true)
    const titulo = form.area_reporte === 'Otro' && form.area_otro
      ? `Otro — ${form.area_otro}`
      : form.area_reporte
    const { error } = await supabase.from('tickets').insert({
      titulo,
      descripcion:        form.descripcion.trim(),
      area_reporte:       form.area_reporte,
      area_otro:          form.area_otro.trim() || null,
      marca_modelo_falla: form.marca_modelo_falla.trim() || null,
      lugar_falla:        form.lugar_falla.trim(),
      apellidos:          form.apellidos.trim() || null,
      rol_solicitante:    form.rol_solicitante || null,
      correo_contacto:    form.correo_contacto.trim() || null,
      prioridad:          null,
      creado_por:         usuario.id,
      creado_por_nombre:  `${form.nombre.trim()} ${form.apellidos.trim()}`.trim() || usuario.nombre,
    })
    if (!error) { await cargar(); cerrarNuevo() }
    setGuardando(false)
  }

  const abrirDetalle = (t) => { setTicketDetalle(t); setEditEstado(t.estado); setEditPrioridad(t.prioridad ?? 'media'); setEditNotas(t.notas ?? '') }
  const cerrarDetalle = () => { setTicketDetalle(null); setConfirmarEliminar(false) }

  const guardarCambios = async () => {
    if (!ticketDetalle) return
    setGuardandoEdit(true)
    const notasVal = editNotas.trim() || null
    const { error } = await supabase.from('tickets').update({
      estado: editEstado, prioridad: editPrioridad, notas: notasVal,
    }).eq('id', ticketDetalle.id)
    if (!error) {
      setTickets(prev => prev.map(t => t.id === ticketDetalle.id
        ? { ...t, estado: editEstado, prioridad: editPrioridad, notas: notasVal } : t))
      onTicketActualizado?.()
      if ((editEstado === 'En proceso' || editEstado === 'Resuelto') && ticketDetalle.correo_contacto) {
        console.log('[notify-ticket-status] invocando para', ticketDetalle.correo_contacto, editEstado)
        supabase.functions.invoke('notify-ticket-status', {
          body: {
            correo: ticketDetalle.correo_contacto,
            nombre: ticketDetalle.creado_por_nombre,
            area:   areaLabel(ticketDetalle),
            estado: editEstado,
            notas:  notasVal,
          },
        }).then(({ data, error }) => {
          if (error) console.error('[notify-ticket-status] error:', JSON.stringify(error))
          else console.log('[notify-ticket-status] OK', data)
        })
      }
      cerrarDetalle()
    }
    setGuardandoEdit(false)
  }

  const eliminarTicket = async (id) => {
    await supabase.from('tickets').delete().eq('id', id)
    setTickets(prev => prev.filter(t => t.id !== id))
    setConfirmarEliminar(false)
    cerrarDetalle()
  }

  const toggleSeleccion = (id) => setSeleccionados(prev => {
    const s = new Set(prev)
    s.has(id) ? s.delete(id) : s.add(id)
    return s
  })
  const toggleTodos = () => setSeleccionados(
    seleccionados.size === filtrados.length ? new Set() : new Set(filtrados.map(t => t.id))
  )
  const salirSeleccion = () => { setModoSeleccion(false); setSeleccionados(new Set()); setConfirmandoBulk(false) }
  const eliminarSeleccionados = async () => {
    await supabase.from('tickets').delete().in('id', [...seleccionados])
    setTickets(prev => prev.filter(t => !seleccionados.has(t.id)))
    salirSeleccion()
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

      <div className="tickets-page-header">
        <p className="tickets-page-title">🎫 Tickets de soporte</p>
        <p className="tickets-page-sub">{esAdmin ? 'Gestiona y resuelve los reportes del equipo' : 'Reporta fallas o incidencias del establecimiento'}</p>
      </div>

      {/* KPIs — solo admin */}
      {esAdmin && <div className="tickets-kpis">
        {['Abierto', 'En proceso', 'Resuelto'].map(e => {
          const n = tickets.filter(t => t.estado === e).length
          const est = ESTADO[e]
          return (
            <div key={e} className={`tickets-kpi ${filtroEstado === e ? 'activo' : ''}`}
              onClick={() => setFiltroEstado(filtroEstado === e ? '' : e)}>
              <span className="tickets-kpi-icon">{est.icon}</span>
              <div><p className="tickets-kpi-val">{n}</p><p className="tickets-kpi-lbl">{e}</p></div>
            </div>
          )
        })}
      </div>}

      {/* Toolbar */}
      <div className={`tickets-toolbar ${!esAdmin ? 'tickets-toolbar-center' : ''}`}>
        {esAdmin && (
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
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          {esAdmin && filtrados.length > 0 && !modoSeleccion && (
            <button style={{ padding: '9px 16px', borderRadius: 10, border: '1.5px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.75)', fontSize: '0.85rem', cursor: 'pointer' }}
              onClick={() => setModoSeleccion(true)}>☑ Seleccionar</button>
          )}
          <button className="btn-nuevo-ticket" onClick={abrirNuevo}>+ Nuevo ticket</button>
        </div>
      </div>

      {/* Barra de selección masiva */}
      {modoSeleccion && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem', background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '10px 16px', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', color: 'rgba(255,255,255,0.85)', fontSize: '0.85rem', fontWeight: 600 }}>
            <input type="checkbox" checked={seleccionados.size === filtrados.length && filtrados.length > 0} onChange={toggleTodos} style={{ width: 16, height: 16, cursor: 'pointer' }} />
            Seleccionar todos ({filtrados.length})
          </label>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>{seleccionados.size} seleccionados</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', cursor: 'pointer' }} onClick={salirSeleccion}>Cancelar</button>
            {seleccionados.size > 0 && !confirmandoBulk && (
              <button style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #fca5a5', background: 'rgba(239,68,68,0.15)', color: '#fca5a5', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}
                onClick={() => setConfirmandoBulk(true)}>🗑 Eliminar {seleccionados.size}</button>
            )}
            {confirmandoBulk && (
              <>
                <span style={{ color: '#fca5a5', fontSize: '0.82rem', alignSelf: 'center' }}>¿Confirmar?</span>
                <button style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', cursor: 'pointer' }} onClick={() => setConfirmandoBulk(false)}>No</button>
                <button style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
                  onClick={eliminarSeleccionados}>Sí, eliminar</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Lista */}
      {filtrados.length === 0 ? (
        <div className="tickets-empty">
          <div className="tickets-empty-icon">🎫</div>
          <p>{tickets.length === 0 ? 'Aún no hay tickets registrados' : 'No hay tickets con estos filtros'}</p>
        </div>
      ) : (
        <div className="tickets-lista">
          {filtrados.map(t => {
            const e = ESTADO[t.estado]
            const p = t.prioridad ? PRIORIDAD[t.prioridad] : null
            return (
              <div key={t.id} className={`ticket-card ${modoSeleccion && seleccionados.has(t.id) ? 'ticket-card-sel' : ''}`}
                onClick={() => modoSeleccion ? toggleSeleccion(t.id) : abrirDetalle(t)}>
                <div className="ticket-card-body">
                  {modoSeleccion && (
                    <input type="checkbox" checked={seleccionados.has(t.id)} onChange={() => toggleSeleccion(t.id)}
                      onClick={e => e.stopPropagation()}
                      style={{ width: 18, height: 18, flexShrink: 0, cursor: 'pointer', marginTop: 2 }} />
                  )}
                  <div className="ticket-card-info">
                    <p className="ticket-titulo">{areaLabel(t)}</p>
                    <p className="ticket-bien">📍 {t.lugar_falla || '—'}</p>
                    {t.descripcion && <p className="ticket-desc">{t.descripcion}</p>}
                    <p className="ticket-meta">Por {t.creado_por_nombre}{t.rol_solicitante ? ` · ${t.rol_solicitante}` : ''} · {fmt(t.creado_en)}</p>
                  </div>
                  <div className="ticket-badges">
                    <span className="badge-estado" style={{ background: e.bg, color: e.color }}>{t.estado}</span>
                    {p && <span className="badge-prio" style={{ background: p.bg, color: p.color }}>{p.label}</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal: Nuevo ticket ── */}
      {modalNuevo && (
        <div className="modal-tickets-overlay" onClick={cerrarNuevo}>
          <div className="modal-tickets" onClick={e => e.stopPropagation()}>
            <div className="modal-tickets-header">
              <h2 className="modal-tickets-title">🎫 Nuevo ticket</h2>
              <button className="modal-tickets-close" onClick={cerrarNuevo}>✕</button>
            </div>

            {/* ── Sección 1: Contacto ── */}
            <p className="modal-seccion-label">Información de contacto</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="modal-field">
                  <label className="modal-label">Nombre *</label>
                  <input className="modal-input" value={form.nombre} onChange={e => setF('nombre', e.target.value)} placeholder="Nombre" />
                </div>
                <div className="modal-field">
                  <label className="modal-label">Apellidos *</label>
                  <input className="modal-input" value={form.apellidos} onChange={e => setF('apellidos', e.target.value)} placeholder="Apellidos" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="modal-field">
                  <label className="modal-label">Rol *</label>
                  <select className="modal-select" value={form.rol_solicitante} onChange={e => setF('rol_solicitante', e.target.value)}>
                    <option value="">Seleccionar…</option>
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="modal-field">
                  <label className="modal-label">Correo electrónico *</label>
                  <input className="modal-input" type="email" value={form.correo_contacto} onChange={e => setF('correo_contacto', e.target.value)} placeholder="correo@liceo.cl" />
                </div>
              </div>
            </div>

            {/* ── Sección 2: Reporte ── */}
            <p className="modal-seccion-label" style={{ marginTop: 18 }}>Reporte de falla o incidencia</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="modal-field">
                <label className="modal-label">Área del reporte *</label>
                <select className="modal-select" value={form.area_reporte} onChange={e => setF('area_reporte', e.target.value)}>
                  <option value="">Seleccionar…</option>
                  {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              {form.area_reporte === 'Otro' && (
                <div className="modal-field">
                  <label className="modal-label">¿Cuál?</label>
                  <input className="modal-input" value={form.area_otro} onChange={e => setF('area_otro', e.target.value)} placeholder="Especifica el área…" />
                </div>
              )}
              <div className="modal-field">
                <label className="modal-label">Marca y modelo del dispositivo con falla <span style={{ color: '#9ca3af', fontWeight: 400 }}>(si corresponde)</span></label>
                <input className="modal-input" value={form.marca_modelo_falla} onChange={e => setF('marca_modelo_falla', e.target.value)} placeholder="Ej: HP ProBook 440 G7" />
              </div>
              <div className="modal-field">
                <label className="modal-label">Lugar donde se detecta la falla *</label>
                <input className="modal-input" value={form.lugar_falla} onChange={e => setF('lugar_falla', e.target.value)} placeholder="Nº de sala, curso, oficina, etc." />
              </div>
              <div className="modal-field">
                <label className="modal-label">Describe la falla o incidencia *</label>
                <textarea className="modal-textarea" value={form.descripcion} onChange={e => setF('descripcion', e.target.value)} placeholder="Detalla el problema…" />
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn-modal-cancel" onClick={cerrarNuevo}>Cancelar</button>
              <button className="btn-modal-save" onClick={crearTicket} disabled={guardando || !formValido}>
                {guardando ? 'Guardando…' : 'Crear ticket'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Ver / Actualizar ticket ── */}
      {ticketDetalle && (
        <div className="modal-tickets-overlay" onClick={cerrarDetalle}>
          <div className="modal-tickets" onClick={e => e.stopPropagation()}>
            <div className="modal-tickets-header">
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem', color: '#111827' }}>{areaLabel(ticketDetalle)}</p>
                <p style={{ margin: '2px 0 0', fontSize: '0.73rem', color: '#9ca3af' }}>{fmt(ticketDetalle.creado_en)}</p>
              </div>
              <button className="modal-tickets-close" onClick={cerrarDetalle}>✕</button>
            </div>

            {/* Datos del solicitante */}
            <div className="ticket-detalle-bien" style={{ marginBottom: 10 }}>
              <p className="modal-seccion-label" style={{ margin: '0 0 8px' }}>Solicitante</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 16px', fontSize: '0.82rem' }}>
                <span>👤 {ticketDetalle.creado_por_nombre}</span>
                {ticketDetalle.rol_solicitante && <span>🏷️ {ticketDetalle.rol_solicitante}</span>}
                {ticketDetalle.correo_contacto && <span style={{ gridColumn: '1/-1' }}>✉️ {ticketDetalle.correo_contacto}</span>}
              </div>
            </div>

            {/* Datos del reporte */}
            <div className="ticket-detalle-bien" style={{ marginBottom: 10 }}>
              <p className="modal-seccion-label" style={{ margin: '0 0 8px' }}>Reporte</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 16px', fontSize: '0.82rem' }}>
                <span style={{ gridColumn: '1/-1' }}>🖥️ Área: {areaLabel(ticketDetalle)}</span>
                {ticketDetalle.lugar_falla && <span style={{ gridColumn: '1/-1' }}>📍 {ticketDetalle.lugar_falla}</span>}
                {ticketDetalle.marca_modelo_falla && <span style={{ gridColumn: '1/-1' }}>🔧 {ticketDetalle.marca_modelo_falla}</span>}
              </div>
            </div>

            {ticketDetalle.descripcion && (
              <div className="ticket-detalle-desc">{ticketDetalle.descripcion}</div>
            )}
            {ticketDetalle.notas && (
              <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '9px 12px', fontSize: '0.83rem', color: '#166534', marginBottom: 14 }}>
                📝 <strong>Notas:</strong> {ticketDetalle.notas}
              </div>
            )}

            {esAdmin ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="modal-field">
                      <label className="modal-label">Estado</label>
                      <select className="modal-select" value={editEstado} onChange={e => setEditEstado(e.target.value)}>
                        <option value="Abierto">🔵 Abierto</option>
                        <option value="En proceso">🟡 En proceso</option>
                        <option value="Resuelto">🟢 Resuelto</option>
                      </select>
                    </div>
                    <div className="modal-field">
                      <label className="modal-label">Prioridad</label>
                      <select className="modal-select" value={editPrioridad ?? ''} onChange={e => setEditPrioridad(e.target.value || null)}>
                        <option value="">Sin asignar</option>
                        <option value="alta">🔴 Alta</option>
                        <option value="media">🟡 Media</option>
                        <option value="baja">🟢 Baja</option>
                      </select>
                    </div>
                  </div>
                  <div className="modal-field">
                    <label className="modal-label">Notas / Resolución {(editEstado === 'En proceso' || editEstado === 'Resuelto') && <span style={{ color: '#d4a017', fontWeight: 400 }}>(se enviará por correo al solicitante)</span>}</label>
                    <textarea className="modal-textarea" value={editNotas} onChange={e => setEditNotas(e.target.value)} placeholder="Agrega observaciones o cómo se resolvió…" />
                  </div>
                </div>
                {confirmarEliminar ? (
                  <div style={{ marginTop: '1.5rem', background: '#fff1f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '14px 16px' }}>
                    <p style={{ margin: '0 0 12px', fontSize: '0.88rem', fontWeight: 600, color: '#b91c1c' }}>¿Eliminar este ticket? Esta acción no se puede deshacer.</p>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button className="btn-modal-cancel" onClick={() => setConfirmarEliminar(false)}>Cancelar</button>
                      <button className="btn-modal-del" onClick={() => eliminarTicket(ticketDetalle.id)}>Sí, eliminar</button>
                    </div>
                  </div>
                ) : (
                  <div className="modal-actions-split">
                    <button className="btn-modal-del" onClick={() => setConfirmarEliminar(true)}>Eliminar</button>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn-modal-cancel" onClick={cerrarDetalle}>Cancelar</button>
                      <button className="btn-modal-save" onClick={guardarCambios} disabled={guardandoEdit}>
                        {guardandoEdit ? 'Guardando…' : 'Guardar cambios'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: ESTADO[ticketDetalle.estado].bg, color: ESTADO[ticketDetalle.estado].color, borderRadius: 8, padding: '6px 14px', fontWeight: 700, fontSize: '0.85rem' }}>
                    {ESTADO[ticketDetalle.estado].icon} {ticketDetalle.estado}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <button className="btn-modal-cancel" onClick={cerrarDetalle}>Cerrar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
