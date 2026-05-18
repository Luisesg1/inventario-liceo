import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'
import './Requerimientos.css'

const FONDOS = ['S.E.P.', 'P.I.E.', 'Sub. General', 'Mantenimiento', 'F.A.E.P.', 'Otro', 'Complementario TP', 'Aporte Municipal']
const DIMENSIONES = ['Gestión Pedagógica', 'Liderazgo', 'Convivencia Escolar', 'Recursos']
const SUB_DIMENSIONES = [
  'Enseñanza y aprendizaje en el aula',
  'Planificación y gestión de resultados',
  'Convivencia',
  'Participación y vida democrática',
  'Gestión del recurso educativo',
  'Gestión curricular',
]
const ACCIONES = [
  'Acompañamiento al aula PDP',
  'Mejoramiento de las prácticas docentes',
  'Talleres y planes de departamento',
  'Plan de fortalecimiento educativo',
  'Plan de trayectoria educativa',
  'Instrumentos de evaluación y medición',
  'Fortalecimiento del liderazgo directivo',
  'Plan de inclusión',
  'Plan de convivencia, bienestar y salud mental',
  'Actividades de formación ciudadana',
  'Trabajo en comunidad y participación',
  'Innovación y CRA',
  'Enseñanza Técnico Profesional',
]
const ESTADOS = [
  'En proceso', 'Enviado al DAEM', 'Revisión DAEM', 'En adquisiciones',
  'Comprado', 'Contratado', 'En ejecución', 'Reenviado',
  'Rechazado por DAEM', 'Rechazado por Liceo', 'Devuelto',
  'No comprado', 'No contratado', 'A la espera de presupuesto',
]
const EVIDENCIAS = ['No necesita', 'Entregada', 'Pendiente']

const ESTADO_STYLE = {
  'Comprado':                   { bg: '#dcfce7', color: '#16a34a' },
  'Contratado':                 { bg: '#dcfce7', color: '#16a34a' },
  'En ejecución':               { bg: '#dcfce7', color: '#16a34a' },
  'Enviado al DAEM':            { bg: '#dbeafe', color: '#1d4ed8' },
  'Reenviado':                  { bg: '#ede9fe', color: '#6d28d9' },
  'En proceso':                 { bg: '#fef9c3', color: '#854d0e' },
  'Revisión DAEM':              { bg: '#fef9c3', color: '#854d0e' },
  'En adquisiciones':           { bg: '#fef9c3', color: '#854d0e' },
  'A la espera de presupuesto': { bg: '#f3f4f6', color: '#6b7280' },
  'No comprado':                { bg: '#fee2e2', color: '#b91c1c' },
  'No contratado':              { bg: '#fee2e2', color: '#b91c1c' },
  'Rechazado por DAEM':         { bg: '#fee2e2', color: '#b91c1c' },
  'Rechazado por Liceo':        { bg: '#fee2e2', color: '#b91c1c' },
  'Devuelto':                   { bg: '#ffedd5', color: '#c2410c' },
}

const FORM_VACIO = {
  fecha: '', contenido: '', solicitante: '', fondo: '',
  dimension: '', sub_dimension: '', accion: '',
  monto_solicitado: '', monto_real: '', estado: 'En proceso',
  fecha_recepcion: '', orden_compra: '', rut_proveedor: '',
  numero_factura: '', evidencia: 'Pendiente', observacion: '',
}

function formatMonto(v) {
  if (v === null || v === undefined || v === '') return '—'
  return '$' + Number(v).toLocaleString('es-CL')
}

function formatFecha(d) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('es-CL')
}

export default function Requerimientos({ usuario }) {
  const esAdmin    = usuario.rol === 'admin'
  const puedeEditar = esAdmin || usuario.rol === 'editor' || usuario.rol === 'encargado'

  const [items,             setItems]             = useState([])
  const [cargando,          setCargando]          = useState(true)
  const [modal,             setModal]             = useState(false)
  const [form,              setForm]              = useState(FORM_VACIO)
  const [guardando,         setGuardando]         = useState(false)
  const [busqueda,          setBusqueda]          = useState('')
  const [filtroEstado,      setFiltroEstado]      = useState('')
  const [filtroFondo,       setFiltroFondo]       = useState('')
  const [confirmarEliminar, setConfirmarEliminar] = useState(false)

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    setCargando(true)
    const { data } = await supabase.from('requerimientos').select('*').order('id', { ascending: false })
    setItems(data ?? [])
    setCargando(false)
  }

  const filtrados = useMemo(() => items.filter(r => {
    if (filtroEstado && r.estado !== filtroEstado) return false
    if (filtroFondo  && r.fondo  !== filtroFondo)  return false
    if (busqueda.trim()) {
      const q   = busqueda.toLowerCase()
      const hay = s => (s ?? '').toLowerCase().includes(q)
      if (!hay(r.contenido) && !hay(r.solicitante) && !hay(r.accion) && !hay(r.orden_compra) && !hay(r.numero_factura)) return false
    }
    return true
  }), [items, filtroEstado, filtroFondo, busqueda])

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const abrirNuevo = () => { setForm(FORM_VACIO); setModal('nuevo') }
  const abrirDetalle = (item) => { setForm({ ...item }); setModal(item) }
  const cerrar = () => { setModal(false); setConfirmarEliminar(false) }

  const guardar = async () => {
    if (!form.contenido?.trim()) return
    setGuardando(true)
    const payload = {
      fecha:            form.fecha            || null,
      contenido:        form.contenido.trim(),
      solicitante:      form.solicitante,
      fondo:            form.fondo,
      dimension:        form.dimension,
      sub_dimension:    form.sub_dimension,
      accion:           form.accion,
      monto_solicitado: form.monto_solicitado !== '' ? Number(form.monto_solicitado) : null,
      monto_real:       form.monto_real       !== '' ? Number(form.monto_real)       : null,
      estado:           form.estado,
      fecha_recepcion:  form.fecha_recepcion  || null,
      orden_compra:     form.orden_compra,
      rut_proveedor:    form.rut_proveedor,
      numero_factura:   form.numero_factura,
      evidencia:        form.evidencia,
      observacion:      form.observacion,
    }
    if (modal === 'nuevo') {
      await supabase.from('requerimientos').insert(payload)
    } else {
      await supabase.from('requerimientos').update({ ...payload, actualizado_en: new Date().toISOString() }).eq('id', modal.id)
    }
    setGuardando(false)
    cerrar()
    cargar()
  }

  const eliminar = async () => {
    if (!modal?.id) return
    await supabase.from('requerimientos').delete().eq('id', modal.id)
    cerrar()
    cargar()
  }

  const kpis = useMemo(() => ({
    total:      items.length,
    enProceso:  items.filter(r => ['En proceso','Revisión DAEM','En adquisiciones','Enviado al DAEM','Reenviado'].includes(r.estado)).length,
    comprados:  items.filter(r => ['Comprado','Contratado','En ejecución'].includes(r.estado)).length,
    rechazados: items.filter(r => (r.estado ?? '').startsWith('Rechazado') || r.estado === 'Devuelto').length,
    montoTotal: items.reduce((acc, r) => acc + (Number(r.monto_solicitado) || 0), 0),
  }), [items])

  return (
    <div className="req-page">

      {/* KPIs */}
      <div className="req-kpis">
        <div className="req-kpi">
          <span className="req-kpi-num">{kpis.total}</span>
          <span className="req-kpi-label">Total</span>
        </div>
        <div className="req-kpi req-kpi--proceso">
          <span className="req-kpi-num">{kpis.enProceso}</span>
          <span className="req-kpi-label">En proceso</span>
        </div>
        <div className="req-kpi req-kpi--ok">
          <span className="req-kpi-num">{kpis.comprados}</span>
          <span className="req-kpi-label">Comprados</span>
        </div>
        <div className="req-kpi req-kpi--mal">
          <span className="req-kpi-num">{kpis.rechazados}</span>
          <span className="req-kpi-label">Rechazados</span>
        </div>
        <div className="req-kpi req-kpi--monto">
          <span className="req-kpi-num">{formatMonto(kpis.montoTotal)}</span>
          <span className="req-kpi-label">Monto solicitado</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="req-toolbar">
        <input
          className="req-search"
          placeholder="Buscar por contenido, solicitante, acción..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
        <select className="req-filter" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {ESTADOS.map(e => <option key={e}>{e}</option>)}
        </select>
        <select className="req-filter" value={filtroFondo} onChange={e => setFiltroFondo(e.target.value)}>
          <option value="">Todos los fondos</option>
          {FONDOS.map(f => <option key={f}>{f}</option>)}
        </select>
        {puedeEditar && (
          <button className="req-btn-nuevo" onClick={abrirNuevo}>+ Nuevo</button>
        )}
      </div>

      {/* Tabla */}
      {cargando ? (
        <div className="req-empty">Cargando...</div>
      ) : filtrados.length === 0 ? (
        <div className="req-empty">No hay requerimientos registrados.</div>
      ) : (
        <div className="req-table-wrap">
          <table className="req-table">
            <thead>
              <tr>
                <th>N°</th>
                <th>Fecha</th>
                <th>Contenido</th>
                <th>Solicitante</th>
                <th>Fondo</th>
                <th>Acción</th>
                <th>Monto Sol.</th>
                <th>Monto Real</th>
                <th>Estado</th>
                <th>Evidencia</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(r => {
                const st = ESTADO_STYLE[r.estado] || { bg: '#f3f4f6', color: '#6b7280' }
                return (
                  <tr key={r.id} onClick={() => abrirDetalle(r)} className="req-row">
                    <td className="req-num">#{r.id}</td>
                    <td className="req-nowrap">{formatFecha(r.fecha)}</td>
                    <td className="req-contenido">{r.contenido}</td>
                    <td>{r.solicitante || '—'}</td>
                    <td className="req-nowrap">{r.fondo || '—'}</td>
                    <td className="req-accion">{r.accion || '—'}</td>
                    <td className="req-nowrap">{formatMonto(r.monto_solicitado)}</td>
                    <td className="req-nowrap">{formatMonto(r.monto_real)}</td>
                    <td>
                      <span className="req-badge" style={{ background: st.bg, color: st.color }}>
                        {r.estado}
                      </span>
                    </td>
                    <td>{r.evidencia || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="req-modal-overlay" onClick={e => e.target === e.currentTarget && cerrar()}>
          <div className="req-modal">
            <div className="req-modal-header">
              <h2>{modal === 'nuevo' ? 'Nuevo requerimiento' : `Requerimiento #${modal.id}`}</h2>
              <button className="req-modal-close" onClick={cerrar}>✕</button>
            </div>

            <div className="req-modal-body">
              <div className="req-grid-2">
                <label>
                  <span>Fecha</span>
                  <input type="date" value={form.fecha || ''} onChange={e => setF('fecha', e.target.value)} disabled={!puedeEditar} />
                </label>
                <label>
                  <span>Solicitante</span>
                  <input type="text" value={form.solicitante || ''} onChange={e => setF('solicitante', e.target.value)} placeholder="Dirección / UTP..." disabled={!puedeEditar} />
                </label>
              </div>

              <label className="req-full">
                <span>Contenido</span>
                <textarea rows={3} value={form.contenido || ''} onChange={e => setF('contenido', e.target.value)} placeholder="Descripción de lo solicitado..." disabled={!puedeEditar} />
              </label>

              <div className="req-grid-3">
                <label>
                  <span>Fondo</span>
                  <select value={form.fondo || ''} onChange={e => setF('fondo', e.target.value)} disabled={!puedeEditar}>
                    <option value="">Seleccionar...</option>
                    {FONDOS.map(f => <option key={f}>{f}</option>)}
                  </select>
                </label>
                <label>
                  <span>Dimensión</span>
                  <select value={form.dimension || ''} onChange={e => setF('dimension', e.target.value)} disabled={!puedeEditar}>
                    <option value="">Seleccionar...</option>
                    {DIMENSIONES.map(d => <option key={d}>{d}</option>)}
                  </select>
                </label>
                <label>
                  <span>Sub-Dimensión</span>
                  <select value={form.sub_dimension || ''} onChange={e => setF('sub_dimension', e.target.value)} disabled={!puedeEditar}>
                    <option value="">Seleccionar...</option>
                    {SUB_DIMENSIONES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </label>
              </div>

              <label className="req-full">
                <span>Acción</span>
                <select value={form.accion || ''} onChange={e => setF('accion', e.target.value)} disabled={!puedeEditar}>
                  <option value="">Seleccionar...</option>
                  {ACCIONES.map(a => <option key={a}>{a}</option>)}
                </select>
              </label>

              <div className="req-grid-2">
                <label>
                  <span>Monto Solicitado ($)</span>
                  <input type="number" value={form.monto_solicitado || ''} onChange={e => setF('monto_solicitado', e.target.value)} placeholder="0" disabled={!puedeEditar} />
                </label>
                <label>
                  <span>Monto Real ($)</span>
                  <input type="number" value={form.monto_real || ''} onChange={e => setF('monto_real', e.target.value)} placeholder="0" disabled={!puedeEditar} />
                </label>
              </div>

              <div className="req-grid-2">
                <label>
                  <span>Estado</span>
                  <select value={form.estado || ''} onChange={e => setF('estado', e.target.value)} disabled={!puedeEditar}>
                    {ESTADOS.map(e => <option key={e}>{e}</option>)}
                  </select>
                </label>
                <label>
                  <span>Evidencia</span>
                  <select value={form.evidencia || ''} onChange={e => setF('evidencia', e.target.value)} disabled={!puedeEditar}>
                    <option value="">Seleccionar...</option>
                    {EVIDENCIAS.map(ev => <option key={ev}>{ev}</option>)}
                  </select>
                </label>
              </div>

              <div className="req-grid-2">
                <label>
                  <span>Fecha recepción</span>
                  <input type="date" value={form.fecha_recepcion || ''} onChange={e => setF('fecha_recepcion', e.target.value)} disabled={!puedeEditar} />
                </label>
                <label>
                  <span>Orden de Compra</span>
                  <input type="text" value={form.orden_compra || ''} onChange={e => setF('orden_compra', e.target.value)} disabled={!puedeEditar} />
                </label>
              </div>

              <div className="req-grid-2">
                <label>
                  <span>RUT Proveedor</span>
                  <input type="text" value={form.rut_proveedor || ''} onChange={e => setF('rut_proveedor', e.target.value)} placeholder="12.345.678-9" disabled={!puedeEditar} />
                </label>
                <label>
                  <span>N° Factura</span>
                  <input type="text" value={form.numero_factura || ''} onChange={e => setF('numero_factura', e.target.value)} disabled={!puedeEditar} />
                </label>
              </div>

              <label className="req-full">
                <span>Observación</span>
                <textarea rows={2} value={form.observacion || ''} onChange={e => setF('observacion', e.target.value)} disabled={!puedeEditar} />
              </label>
            </div>

            <div className="req-modal-footer">
              {puedeEditar && modal !== 'nuevo' && esAdmin && (
                confirmarEliminar ? (
                  <div className="req-confirm-del">
                    <span>¿Eliminar este requerimiento?</span>
                    <button className="req-btn-del" onClick={eliminar}>Sí, eliminar</button>
                    <button className="req-btn-cancel" onClick={() => setConfirmarEliminar(false)}>Cancelar</button>
                  </div>
                ) : (
                  <button className="req-btn-del-ghost" onClick={() => setConfirmarEliminar(true)}>Eliminar</button>
                )
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button className="req-btn-cancel" onClick={cerrar}>Cancelar</button>
                {puedeEditar && (
                  <button className="req-btn-guardar" onClick={guardar} disabled={guardando || !form.contenido?.trim()}>
                    {guardando ? 'Guardando…' : 'Guardar'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
