import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import './Auditoria.css'

const ACCION_META = {
  crear:    { color: '#16a34a', bg: '#dcfce7', label: 'Creado',    icono: '➕' },
  editar:   { color: '#2563eb', bg: '#dbeafe', label: 'Editado',   icono: '✏️' },
  eliminar: { color: '#dc2626', bg: '#fee2e2', label: 'Eliminado', icono: '🗑️' },
}

const CAMPO_LABEL = {
  nombre: 'Nombre', estado: 'Estado', ubicacion: 'Ubicación', responsable: 'Responsable',
  categoria: 'Categoría', codigo: 'Código', cantidad: 'Cantidad', obs: 'Observaciones',
  tipo: 'Tipo', marca: 'Marca', modelo: 'Modelo', numero_serie: 'N° Serie',
  cpu: 'CPU', ram: 'RAM', ram_tipo: 'Tipo RAM', memoria: 'Almacenamiento',
  sistema_operativo: 'S.O.', pantalla: 'Pantalla', isbn: 'ISBN', autor: 'Autor', genero: 'Género',
  fecha_adquisicion: 'Fecha adquisición', proveedor: 'Proveedor',
  numero_factura: 'N° Factura', numero_orden: 'N° Orden', fondo: 'Fondo', garantia: 'Garantía',
}

const POR_PAGINA = 50

const secTitle = {
  fontSize: 11, fontWeight: 700, color: '#d4a017',
  textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 14px',
}

function tiempoRelativo(fecha) {
  const min = Math.floor((Date.now() - new Date(fecha)) / 60000)
  if (min < 1)  return 'ahora mismo'
  if (min < 60) return `hace ${min} min`
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return `hace ${hrs} h`
  const dias = Math.floor(hrs / 24)
  return `hace ${dias} día${dias > 1 ? 's' : ''}`
}

export default function Auditoria({ usuario }) {
  const [logs, setLogs]           = useState([])
  const [total, setTotal]         = useState(0)
  const [cargando, setCargando]   = useState(true)
  const [expandido, setExpandido] = useState(null)
  const [restaurando, setRestaurando] = useState(null)
  const [aviso, setAviso]         = useState('')
  const [pagina, setPagina]       = useState(0)
  const [errorTabla, setErrorTabla] = useState(false)

  const [buscar,       setBuscar]       = useState('')
  const [buscadorVal,  setBuscadorVal]  = useState('')
  const [filtroAccion, setFiltroAccion] = useState('')
  const [filtroDesde,  setFiltroDesde]  = useState('')
  const [filtroHasta,  setFiltroHasta]  = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    let q = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('creado_en', { ascending: false })
      .range(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA - 1)

    if (filtroAccion) q = q.eq('accion', filtroAccion)
    if (filtroDesde)  q = q.gte('creado_en', filtroDesde + 'T00:00:00')
    if (filtroHasta)  q = q.lte('creado_en', filtroHasta + 'T23:59:59')
    if (buscar)       q = q.or(`bien_nombre.ilike.%${buscar}%,usuario_nombre.ilike.%${buscar}%`)

    const { data, count, error } = await q
    if (error) { setErrorTabla(true); setCargando(false); return }
    setErrorTabla(false)
    setLogs(data ?? [])
    setTotal(count ?? 0)
    setCargando(false)
  }, [pagina, filtroAccion, filtroDesde, filtroHasta, buscar])

  useEffect(() => { cargar() }, [cargar])

  const aplicarBusqueda = () => { setBuscar(buscadorVal); setPagina(0) }
  const limpiarFiltros  = () => {
    setBuscadorVal(''); setBuscar(''); setFiltroAccion('')
    setFiltroDesde(''); setFiltroHasta(''); setPagina(0)
  }

  const restaurarCampo = async (logId, campo) => {
    const key = logId + campo
    setRestaurando(key)
    const { error } = await supabase.rpc('restaurar_campo_auditoria', { p_audit_id: logId, p_campo: campo })
    if (error) setAviso('Error al restaurar: ' + error.message)
    else { setAviso('✓ Campo restaurado correctamente'); cargar() }
    setRestaurando(null)
  }

  const formatFecha = (ts) => {
    const d = new Date(ts)
    return d.toLocaleDateString('es-CL') + ' · ' + d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
  }

  const detectarDispositivo = (ua) => {
    if (!ua) return null
    if (/Mobile|Android|iPhone/.test(ua)) return '📱'
    if (/iPad|Tablet/.test(ua)) return '📱'
    return '💻'
  }

  const totalPaginas = Math.ceil(total / POR_PAGINA)
  const hayFiltros = buscar || filtroAccion || filtroDesde || filtroHasta

  return (
    <div className="audit-wrap">

      {/* ── Error: tabla no configurada ── */}
      {errorTabla && (
        <div className="audit-card" style={{ background: '#fffbeb', borderLeft: '4px solid #f59e0b', marginBottom: 20 }}>
          <p style={{ margin: '0 0 4px', fontWeight: 700, color: '#92400e', fontSize: 14 }}>
            ⚠️ La tabla de auditoría no está configurada
          </p>
          <p style={{ margin: 0, fontSize: 13, color: '#78350f', lineHeight: 1.5 }}>
            Ejecuta el archivo <strong>supabase_auditoria.sql</strong> en el SQL Editor de Supabase para activar el sistema de auditoría.
          </p>
        </div>
      )}

      {/* ── Filtros ── */}
      <div className="audit-card audit-filtros-card">
        <p style={secTitle}>🔎 Filtros</p>
        <div className="audit-filtros">
          <div className="audit-search-row">
            <input
              className="audit-input"
              placeholder="Buscar por bien o usuario…"
              value={buscadorVal}
              onChange={e => setBuscadorVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && aplicarBusqueda()}
            />
            <button className="audit-btn-primary" onClick={aplicarBusqueda}>Buscar</button>
          </div>

          <div className="audit-filtros-row">
            <select
              className="audit-select"
              value={filtroAccion}
              onChange={e => { setFiltroAccion(e.target.value); setPagina(0) }}
            >
              <option value="">Todas las acciones</option>
              <option value="crear">Creados</option>
              <option value="editar">Editados</option>
              <option value="eliminar">Eliminados</option>
            </select>

            <div className="audit-fecha-row">
              <input type="date" className="audit-input audit-date"
                value={filtroDesde}
                onChange={e => { setFiltroDesde(e.target.value); setPagina(0) }} />
              <span className="audit-dash">—</span>
              <input type="date" className="audit-input audit-date"
                value={filtroHasta}
                onChange={e => { setFiltroHasta(e.target.value); setPagina(0) }} />
            </div>

            {hayFiltros && (
              <button className="audit-btn-ghost" onClick={limpiarFiltros}>✕ Limpiar</button>
            )}
          </div>
        </div>

        {!cargando && (
          <p className="audit-total-label">
            {total.toLocaleString('es-CL')} registro{total !== 1 ? 's' : ''} en total
          </p>
        )}
      </div>

      {/* ── Lista ── */}
      {cargando ? (
        <div className="audit-card audit-loading">
          <div className="audit-spinner" />
          Cargando auditoría…
        </div>
      ) : !logs.length ? (
        <div className="audit-card audit-empty">
          <div style={{ fontSize: 40, marginBottom: 10 }}>📭</div>
          <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>
            {hayFiltros ? 'No hay registros con los filtros aplicados.' : 'Aún no hay registros de auditoría.'}
          </p>
        </div>
      ) : (
        <div className="audit-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="audit-list">
            {logs.map((log, idx) => {
              const meta    = ACCION_META[log.accion] ?? { color: '#6b7280', bg: '#f3f4f6', label: log.accion, icono: '•' }
              const abierto = expandido === log.id
              const cambios = Array.isArray(log.cambios) ? log.cambios : []
              const disp    = detectarDispositivo(log.dispositivo)

              return (
                <div key={log.id} className={`audit-item ${idx !== 0 ? 'audit-item-border' : ''}`}
                  style={{ borderLeft: `3px solid ${meta.color}` }}>

                  {/* Fila principal */}
                  <div
                    className="audit-item-header"
                    style={{ cursor: cambios.length ? 'pointer' : 'default' }}
                    onClick={() => cambios.length && setExpandido(abierto ? null : log.id)}
                  >
                    <div className="audit-badge-icon" style={{ background: meta.bg, color: meta.color }}>
                      {meta.icono}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="audit-item-nombre">{log.bien_nombre}</p>
                      <p className="audit-item-meta">
                        <strong>{log.usuario_nombre}</strong>
                        {' · '}{formatFecha(log.creado_en)}
                        {disp && <span style={{ marginLeft: 6 }}>{disp}</span>}
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span className="audit-pill" style={{ background: meta.bg, color: meta.color }}>
                        {meta.label}
                      </span>
                      {cambios.length > 0 && (
                        <span className="audit-chevron">{abierto ? '▲' : '▼'}</span>
                      )}
                    </div>
                  </div>

                  {/* Cambios expandidos */}
                  {abierto && cambios.length > 0 && (
                    <div className="audit-cambios">
                      <p style={{ ...secTitle, margin: '0 0 10px' }}>Campos modificados</p>
                      {cambios.map((c, i) => (
                        <div key={i} className="audit-cambio-row">
                          <span className="audit-campo-label">
                            {CAMPO_LABEL[c.campo] ?? c.campo}
                          </span>
                          <span className="audit-valor audit-valor-old" title={c.anterior ?? '—'}>
                            {c.anterior ?? '—'}
                          </span>
                          <span className="audit-arrow">→</span>
                          <span className="audit-valor audit-valor-new" title={c.nuevo ?? '—'}>
                            {c.nuevo ?? '—'}
                          </span>
                          {usuario.rol === 'admin' && c.anterior != null && log.bien_id && (
                            <button
                              className="audit-btn-restore"
                              onClick={e => { e.stopPropagation(); restaurarCampo(log.id, c.campo) }}
                              disabled={!!restaurando}
                            >
                              {restaurando === log.id + c.campo ? '…' : '↩ Restaurar'}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Paginación ── */}
      {totalPaginas > 1 && (
        <div className="audit-paginacion">
          <button className="audit-page-btn" onClick={() => setPagina(0)} disabled={pagina === 0}>«</button>
          <button className="audit-page-btn" onClick={() => setPagina(p => Math.max(0, p - 1))} disabled={pagina === 0}>← Anterior</button>
          <span className="audit-page-label">Página {pagina + 1} de {totalPaginas}</span>
          <button className="audit-page-btn" onClick={() => setPagina(p => Math.min(totalPaginas - 1, p + 1))} disabled={pagina >= totalPaginas - 1}>Siguiente →</button>
          <button className="audit-page-btn" onClick={() => setPagina(totalPaginas - 1)} disabled={pagina >= totalPaginas - 1}>»</button>
        </div>
      )}

      {/* ── Aviso ── */}
      {aviso && (
        <div className="audit-aviso">
          {aviso}
          <button onClick={() => setAviso('')} className="audit-aviso-close">✕</button>
        </div>
      )}
    </div>
  )
}
