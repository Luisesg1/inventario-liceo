import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import './Auditoria.css'

const ACCION_BADGE = {
  crear:    { color: '#16a34a', bg: '#dcfce7', label: 'Creado'    },
  editar:   { color: '#2563eb', bg: '#dbeafe', label: 'Editado'   },
  eliminar: { color: '#dc2626', bg: '#fee2e2', label: 'Eliminado' },
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

export default function Auditoria({ usuario }) {
  const [logs, setLogs]           = useState([])
  const [total, setTotal]         = useState(0)
  const [cargando, setCargando]   = useState(true)
  const [expandido, setExpandido] = useState(null)
  const [restaurando, setRestaurando] = useState(null)
  const [aviso, setAviso]         = useState('')
  const [pagina, setPagina]       = useState(0)

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

    const { data, count } = await q
    setLogs(data ?? [])
    setTotal(count ?? 0)
    setCargando(false)
  }, [pagina, filtroAccion, filtroDesde, filtroHasta, buscar])

  useEffect(() => { cargar() }, [cargar])

  const aplicarBusqueda = () => { setBuscar(buscadorVal); setPagina(0) }

  const limpiarFiltros = () => {
    setBuscadorVal(''); setBuscar(''); setFiltroAccion('')
    setFiltroDesde(''); setFiltroHasta(''); setPagina(0)
  }

  const restaurarCampo = async (logId, campo) => {
    const key = logId + campo
    setRestaurando(key)
    const { error } = await supabase.rpc('restaurar_campo_auditoria', {
      p_audit_id: logId,
      p_campo: campo,
    })
    if (error) setAviso('Error al restaurar: ' + error.message)
    else { setAviso('✓ Campo restaurado correctamente'); cargar() }
    setRestaurando(null)
  }

  const formatFecha = (ts) => {
    const d = new Date(ts)
    return d.toLocaleDateString('es-CL') + ' ' + d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
  }

  const detectarDispositivo = (ua) => {
    if (!ua) return null
    if (/Mobile|Android|iPhone/.test(ua)) return '📱 Móvil'
    if (/iPad|Tablet/.test(ua)) return '📱 Tablet'
    return '💻 Escritorio'
  }

  const totalPaginas = Math.ceil(total / POR_PAGINA)

  return (
    <div style={{ padding: '0 0 40px' }}>

      {/* ── Filtros ── */}
      <div className="audit-filtros">
        <input
          placeholder="Buscar por bien o usuario…"
          value={buscadorVal}
          onChange={e => setBuscadorVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && aplicarBusqueda()}
          style={{ padding: '8px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 13, outline: 'none' }}
        />
        <button onClick={aplicarBusqueda} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#1e3a8a', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Buscar
        </button>
        <select value={filtroAccion} onChange={e => { setFiltroAccion(e.target.value); setPagina(0) }}
          style={{ padding: '8px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 13, outline: 'none' }}>
          <option value="">Todas las acciones</option>
          <option value="crear">Creados</option>
          <option value="editar">Editados</option>
          <option value="eliminar">Eliminados</option>
        </select>
        <div className="audit-fecha-row">
          <input type="date" value={filtroDesde} onChange={e => { setFiltroDesde(e.target.value); setPagina(0) }}
            style={{ padding: '8px 10px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 13, outline: 'none' }} />
          <span style={{ fontSize: 12, color: '#9ca3af', flexShrink: 0 }}>—</span>
          <input type="date" value={filtroHasta} onChange={e => { setFiltroHasta(e.target.value); setPagina(0) }}
            style={{ padding: '8px 10px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 13, outline: 'none' }} />
        </div>
        <button onClick={limpiarFiltros}
          style={{ padding: '8px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 13, cursor: 'pointer', background: '#f9fafb', color: '#6b7280' }}>
          Limpiar
        </button>
        {!cargando && (
          <span style={{ fontSize: 12, color: '#9ca3af' }}>
            {total.toLocaleString('es-CL')} registro{total !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* ── Lista ── */}
      {cargando ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
          <div style={{ width: 28, height: 28, border: '3px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 12px' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          Cargando auditoría…
        </div>
      ) : !logs.length ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af', fontSize: 14 }}>
          No hay registros con los filtros aplicados.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {logs.map(log => {
            const badge   = ACCION_BADGE[log.accion] ?? { color: '#6b7280', bg: '#f3f4f6', label: log.accion }
            const abierto = expandido === log.id
            const cambios = Array.isArray(log.cambios) ? log.cambios : []
            const disp    = detectarDispositivo(log.dispositivo)

            return (
              <div key={log.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', transition: 'box-shadow 0.15s' }}>

                {/* Fila principal */}
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', cursor: cambios.length ? 'pointer' : 'default' }}
                  onClick={() => cambios.length && setExpandido(abierto ? null : log.id)}
                >
                  <span style={{ background: badge.bg, color: badge.color, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, flexShrink: 0, minWidth: 64, textAlign: 'center' }}>
                    {badge.label}
                  </span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 13.5, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.bien_nombre}
                    </p>
                    <p style={{ margin: 0, fontSize: 11.5, color: '#6b7280', marginTop: 1 }}>
                      {log.usuario_nombre} · {formatFecha(log.creado_en)}
                      {disp && <span style={{ marginLeft: 6 }}>{disp}</span>}
                    </p>
                  </div>

                  {cambios.length > 0 && (
                    <span style={{ fontSize: 12, color: '#9ca3af', flexShrink: 0 }}>
                      {cambios.length} campo{cambios.length !== 1 ? 's' : ''} {abierto ? '▲' : '▼'}
                    </span>
                  )}
                </div>

                {/* Cambios expandidos */}
                {abierto && cambios.length > 0 && (
                  <div style={{ borderTop: '1px solid #f3f4f6', padding: '10px 16px 14px', display: 'flex', flexDirection: 'column', gap: 8, background: '#fafafa' }}>
                    {cambios.map((c, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', minWidth: 130 }}>
                          {CAMPO_LABEL[c.campo] ?? c.campo}
                        </span>
                        <span style={{ fontSize: 12, color: '#dc2626', background: '#fef2f2', padding: '2px 8px', borderRadius: 6, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.anterior ?? '—'}>
                          {c.anterior ?? '—'}
                        </span>
                        <span style={{ fontSize: 12, color: '#9ca3af' }}>→</span>
                        <span style={{ fontSize: 12, color: '#16a34a', background: '#f0fdf4', padding: '2px 8px', borderRadius: 6, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.nuevo ?? '—'}>
                          {c.nuevo ?? '—'}
                        </span>
                        {usuario.rol === 'admin' && c.anterior != null && log.bien_id && (
                          <button
                            onClick={e => { e.stopPropagation(); restaurarCampo(log.id, c.campo) }}
                            disabled={!!restaurando}
                            style={{ fontSize: 11, padding: '2px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: restaurando ? 'wait' : 'pointer', color: '#374151', marginLeft: 'auto', flexShrink: 0 }}
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
      )}

      {/* ── Paginación ── */}
      {totalPaginas > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 20 }}>
          <button onClick={() => setPagina(0)} disabled={pagina === 0}
            style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: pagina === 0 ? '#f9fafb' : '#fff', cursor: pagina === 0 ? 'default' : 'pointer', fontSize: 13, color: pagina === 0 ? '#d1d5db' : '#374151' }}>
            «
          </button>
          <button onClick={() => setPagina(p => Math.max(0, p - 1))} disabled={pagina === 0}
            style={{ padding: '6px 14px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: pagina === 0 ? '#f9fafb' : '#fff', cursor: pagina === 0 ? 'default' : 'pointer', fontSize: 13, color: pagina === 0 ? '#d1d5db' : '#374151' }}>
            ← Anterior
          </button>
          <span style={{ fontSize: 13, color: '#6b7280', padding: '0 4px' }}>
            Página {pagina + 1} de {totalPaginas}
          </span>
          <button onClick={() => setPagina(p => Math.min(totalPaginas - 1, p + 1))} disabled={pagina >= totalPaginas - 1}
            style={{ padding: '6px 14px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: pagina >= totalPaginas - 1 ? '#f9fafb' : '#fff', cursor: pagina >= totalPaginas - 1 ? 'default' : 'pointer', fontSize: 13, color: pagina >= totalPaginas - 1 ? '#d1d5db' : '#374151' }}>
            Siguiente →
          </button>
          <button onClick={() => setPagina(totalPaginas - 1)} disabled={pagina >= totalPaginas - 1}
            style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: pagina >= totalPaginas - 1 ? '#f9fafb' : '#fff', cursor: pagina >= totalPaginas - 1 ? 'default' : 'pointer', fontSize: 13, color: pagina >= totalPaginas - 1 ? '#d1d5db' : '#374151' }}>
            »
          </button>
        </div>
      )}

      {/* ── Aviso ── */}
      {aviso && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#1e3a8a', color: '#fff', padding: '12px 20px', borderRadius: 10, fontSize: 13, zIndex: 999, display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
          {aviso}
          <button onClick={() => setAviso('')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>✕</button>
        </div>
      )}
    </div>
  )
}
