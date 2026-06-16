// src/pages/Compensatorios.jsx
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Gift, Plus, X, Search, Pencil, Trash2,
  CalendarDays, ChevronDown, Loader2, AlertTriangle,
  TrendingUp, CheckCircle2, Clock, Eye,
  ChevronLeft, ChevronRight as ChevronRightIcon, Download,
} from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase } from '../supabase'
import './Compensatorios.css'

// ── Constantes ────────────────────────────────────────────

const TIPOS = [
  { value: 'desfile',                  label: 'Desfile',                   icon: '' },
  { value: 'trabajo_verano',           label: 'Trabajo en vacaciones',     icon: '' },
  { value: 'actividad_institucional',  label: 'Actividad institucional',   icon: '' },
  { value: 'reemplazo',                label: 'Reemplazo',                 icon: '' },
  { value: 'otro',                     label: 'Otro',                      icon: '' },
]

const TIPO_MAP = Object.fromEntries(TIPOS.map(t => [t.value, t]))

const CANTIDADES_PRESET = [
  { value: 0.5, label: 'Medio día',  sub: '0.5 días' },
  { value: 1,   label: '1 día',      sub: '1.0 días' },
  { value: 2,   label: '2 días',     sub: '2.0 días' },
  { value: null, label: 'Personalizado', sub: 'Ingresar valor' },
]

const AVATAR_COLORS = [
  '#4f46e5','#7c3aed','#0284c7','#0891b2',
  '#059669','#16a34a','#d97706','#dc2626',
]

const overlayV = { hidden: { opacity: 0 }, visible: { opacity: 1 }, exit: { opacity: 0 } }
const modalV   = {
  hidden:  { opacity: 0, scale: 0.95, y: 12 },
  visible: { opacity: 1, scale: 1,    y: 0,  transition: { type: 'spring', stiffness: 400, damping: 30 } },
  exit:    { opacity: 0, scale: 0.95, y: 8,  transition: { duration: 0.15 } },
}

// ── Helpers ───────────────────────────────────────────────

function avatarColor(name = '') {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join('')
}

function fmtFecha(d) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtDias(n) {
  if (n === 0.5) return '½'
  if (n % 1 === 0) return String(n)
  return n.toFixed(1)
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function estadoEfectivo(rec) {
  if (rec.estado === 'usado') return 'usado'
  if (rec.vence_en && rec.vence_en < todayStr()) return 'vencido'
  return 'disponible'
}

// ── Componente principal ──────────────────────────────────

export default function Compensatorios({ usuario, permisos = {} }) {
  const esAdmin      = usuario?.rol === 'admin'
  const puedeCrear    = esAdmin || !!permisos.crear
  const puedeEditar   = esAdmin || !!permisos.editar
  const puedeElim     = esAdmin || !!permisos.eliminar
  const puedeExportar = esAdmin || !!permisos.exportar

  const [registros,  setRegistros]  = useState([])
  const [usuarios,   setUsuarios]   = useState([])
  const [cargando,   setCargando]   = useState(true)

  // Filtros
  const [busq,       setBusq]       = useState('')
  const [filtTipo,   setFiltTipo]   = useState('')
  const [filtEstado, setFiltEstado] = useState('')

  // Modales
  const [modalOpen,  setModalOpen]  = useState(false)
  const [editData,   setEditData]   = useState(null)
  const [eliminar,   setEliminar]   = useState(null)
  const [eliminando, setEliminando] = useState(false)
  const [verDetalle, setVerDetalle] = useState(null)

  // Paginación
  const POR_PAGINA = 10
  const [pagActual, setPagActual]   = useState(1)

  // Exportación
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [seleccionados,  setSeleccionados]  = useState(new Set())
  const exportMenuRef = useRef(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    const [{ data: us }, { data: rs }] = await Promise.all([
      supabase.from('usuarios').select('id, nombre, rut, rol').order('nombre'),
      supabase.from('dias_compensatorios')
        .select('*, usuario:usuario_id(id, nombre, rut, rol)')
        .eq('is_deleted', false)
        .order('fecha_ganado', { ascending: false }),
    ])
    setUsuarios(us ?? [])
    setRegistros(rs ?? [])
    setCargando(false)
  }

  // ── KPIs ──────────────────────────────────────────────
  const thisYear = new Date().getFullYear()
  const misReg   = esAdmin ? registros : registros.filter(r => r.usuario_id === usuario?.id)

  const generadosAnio = misReg
    .filter(r => r.fecha_ganado?.startsWith(String(thisYear)))
    .reduce((sum, r) => sum + r.cantidad, 0)

  const usadosAnio = registros
    .filter(r => r.fecha_ganado?.startsWith(String(thisYear)) && r.estado === 'usado'
      && (!esAdmin ? r.usuario_id === usuario?.id : true))
    .reduce((sum, r) => sum + (r.cantidad - (r.saldo_restante ?? 0)), 0)

  // ── Filtrado ──────────────────────────────────────────
  const norm = s => s?.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') ?? ''

  // Cierra menú de exportación al hacer click fuera
  useEffect(() => {
    function handler(e) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) setExportMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Reset página y selección al filtrar
  useEffect(() => { setPagActual(1) }, [busq, filtTipo, filtEstado])
  useEffect(() => { setSeleccionados(new Set()) }, [busq, filtTipo, filtEstado])

  const filas = registros.filter(r => {
    if (!esAdmin && r.usuario_id !== usuario?.id) return false
    const u    = r.usuario
    const q    = norm(busq)
    if (q) {
      const match = norm(u?.nombre ?? '').includes(q) || norm(u?.rut ?? '').includes(q)
        || norm(r.motivo ?? '').includes(q)
      if (!match) return false
    }
    if (filtTipo   && r.tipo   !== filtTipo)        return false
    if (filtEstado && estadoEfectivo(r) !== filtEstado) return false
    return true
  })

  // ── CRUD ──────────────────────────────────────────────
  async function handleGuardar(datos) {
    if (datos.id ? !puedeEditar : !puedeCrear) return
    const { id, usuarioId, tipo, cantidad, fechaGanado, venceEn, motivo, observaciones } = datos
    const payload = {
      usuario_id:    usuarioId,
      tipo, cantidad,
      saldo_restante: id ? undefined : cantidad,
      fecha_ganado:  fechaGanado,
      vence_en:      venceEn || null,
      motivo:        motivo  || null,
      observaciones: observaciones || null,
      estado:        'disponible',
      created_by:    usuario?.id ?? null,
    }
    if (id) {
      delete payload.saldo_restante
      delete payload.created_by
      await supabase.from('dias_compensatorios').update(payload).eq('id', id)
    } else {
      await supabase.from('dias_compensatorios').insert(payload)
    }
    setModalOpen(false)
    setEditData(null)
    await cargar()
  }

  async function handleEliminar() {
    if (!eliminar || !puedeElim) return
    setEliminando(true)
    const ahora = new Date().toISOString()
    await supabase.from('dias_compensatorios').update({
      is_deleted: true, deleted_at: ahora,
      deleted_by: usuario.id, deleted_by_nombre: usuario.nombre,
    }).eq('id', eliminar.id)
    supabase.rpc('log_accion_papelera', {
      p_registro_id: String(eliminar.id),
      p_nombre: 'Compensatorio — ' + (eliminar.fecha_ganado ?? eliminar.id),
      p_accion: 'enviado_a_papelera',
      p_usuario_id: usuario.id,
      p_usuario_nombre: usuario.nombre,
      p_usuario_rol: usuario.rol,
      p_modulo: 'compensatorios',
    }).then(null, () => {})
    setEliminando(false)
    setEliminar(null)
    await cargar()
  }

  const totalPags  = Math.max(1, Math.ceil(filas.length / POR_PAGINA))
  const pagSegura  = Math.min(pagActual, totalPags)
  const filasPag   = filas.slice((pagSegura - 1) * POR_PAGINA, pagSegura * POR_PAGINA)

  function toggleSeleccion(id) {
    setSeleccionados(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleTodos() {
    const todosVisibles = filas.every(r => seleccionados.has(r.id))
    setSeleccionados(prev => {
      const next = new Set(prev)
      if (todosVisibles) filas.forEach(r => next.delete(r.id))
      else filas.forEach(r => next.add(r.id))
      return next
    })
  }

  function exportarCompensatorios(formato) {
    setExportMenuOpen(false)
    const datos = seleccionados.size > 0
      ? filas.filter(r => seleccionados.has(r.id))
      : filas
    if (datos.length === 0) return

    const headers = ['Usuario', 'RUT', 'Tipo', 'Días generados', 'Saldo restante', 'Fecha ganado', 'Vencimiento', 'Estado', 'Motivo', 'Observaciones']
    const rows = datos.map(r => {
      const u      = r.usuario
      const estado = estadoEfectivo(r)
      return {
        'Usuario':          u?.nombre ?? '—',
        'RUT':              u?.rut ?? '—',
        'Tipo':             TIPO_MAP[r.tipo]?.label ?? r.tipo,
        'Días generados':   String(r.cantidad),
        'Saldo restante':   String(r.saldo_restante ?? r.cantidad),
        'Fecha ganado':     fmtFecha(r.fecha_ganado),
        'Vencimiento':      r.vence_en ? fmtFecha(r.vence_en) : 'Sin vencimiento',
        'Estado':           { disponible: 'Disponible', usado: 'Usado', vencido: 'Vencido' }[estado] ?? estado,
        'Motivo':           r.motivo ?? '—',
        'Observaciones':    r.observaciones ?? '—',
      }
    })

    if (formato === 'csv') {
      const csv = [
        headers.map(h => `"${h}"`).join(','),
        ...rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')),
      ].join('\n')
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = 'compensatorios.csv'; a.click()
      URL.revokeObjectURL(url)

    } else if (formato === 'excel') {
      const table = `<table><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>${
        rows.map(r => `<tr>${headers.map(h => `<td>${r[h] ?? ''}</td>`).join('')}</tr>`).join('')
      }</table>`
      const blob = new Blob([table], { type: 'application/vnd.ms-excel;charset=utf-8;' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = 'compensatorios.xls'; a.click()
      URL.revokeObjectURL(url)

    } else if (formato === 'pdf') {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.setTextColor(79, 70, 229)
      doc.text('Días Compensatorios', 14, 16)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(100, 116, 139)
      doc.text(
        `Exportado el ${new Date().toLocaleDateString('es-CL')} · ${datos.length} ${datos.length === 1 ? 'registro' : 'registros'}`,
        14, 22,
      )
      autoTable(doc, {
        startY: 27,
        head: [headers],
        body: rows.map(r => headers.map(h => r[h] ?? '')),
        styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
        headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 0: { cellWidth: 34 }, 1: { cellWidth: 22 }, 8: { cellWidth: 38 }, 9: { cellWidth: 38 } },
        margin: { left: 14, right: 14 },
        didDrawPage: (data) => {
          doc.setFontSize(7.5)
          doc.setTextColor(148, 163, 184)
          doc.text(`Pág. ${data.pageNumber}`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' })
        },
      })
      doc.save('compensatorios.pdf')
    }
  }

  return (
    <div className="comp-page">
      {/* Header */}
      <div className="comp-header">
        <div>
          <h1 className="comp-title">Días Compensatorios</h1>
          <p className="comp-subtitle">
            Saldo de días ganados por desfiles, trabajo de verano y actividades institucionales
          </p>
        </div>
        {puedeCrear && (
          <button className="comp-btn-primary" onClick={() => { setEditData(null); setModalOpen(true) }}>
            <Plus size={15} strokeWidth={2.5} />
            Registrar compensación
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="comp-kpi-grid">
        <KPICard
          icon={<TrendingUp size={18} />} variant="violet"
          value={fmtDias(generadosAnio)} label={`Generados ${thisYear}`}
        />
        <KPICard
          icon={<CheckCircle2 size={18} />} variant="emerald"
          value={fmtDias(usadosAnio)} label={`Usados ${thisYear}`}
        />
        <KPICard
          icon={<Clock size={18} />} variant="slate"
          value={misReg.length} label="Total registros"
        />
      </div>

      {/* Tabla */}
      <div className="comp-card">
        <div className="comp-card-header">
          <div>
            <p className="comp-card-title">Historial de días compensatorios</p>
            <p className="comp-card-desc">
              {filas.length} registro{filas.length !== 1 ? 's' : ''} encontrado{filas.length !== 1 ? 's' : ''}
              {seleccionados.size > 0 && ` · ${seleccionados.size} seleccionado${seleccionados.size !== 1 ? 's' : ''}`}
            </p>
          </div>
          {puedeExportar && filas.length > 0 && (
            <div style={{ position: 'relative' }} ref={exportMenuRef}>
              <button
                className="comp-btn-secondary"
                onClick={() => setExportMenuOpen(prev => !prev)}
                style={seleccionados.size > 0
                  ? { display: 'flex', alignItems: 'center', gap: 6, background: '#f0fdf4', border: '1.5px solid #86efac', color: '#15803d' }
                  : { display: 'flex', alignItems: 'center', gap: 6 }}
                title={seleccionados.size > 0
                  ? `Exportar ${seleccionados.size} seleccionado${seleccionados.size !== 1 ? 's' : ''}`
                  : `Exportar ${filas.length} registro${filas.length !== 1 ? 's' : ''}`}
              >
                <Download size={13} strokeWidth={2.5} />
                {seleccionados.size > 0 ? `Exportar (${seleccionados.size})` : 'Exportar'}
                <ChevronDown size={12} strokeWidth={2.5} style={{ transition: 'transform 0.18s', transform: exportMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
              </button>
              {exportMenuOpen && (
                <div style={{
                  position: 'absolute', right: 0, top: 'calc(100% + 4px)',
                  background: '#fff', border: '1px solid #e2e8f0', borderRadius: 9,
                  boxShadow: '0 6px 24px rgba(0,0,0,0.10)', zIndex: 200,
                  minWidth: 164, overflow: 'hidden', padding: '4px 0',
                }}>
                  <div style={{ padding: '7px 14px 5px', fontSize: 11, color: '#94a3b8', borderBottom: '1px solid #f1f5f9', marginBottom: 2 }}>
                    {seleccionados.size > 0
                      ? `${seleccionados.size} seleccionado${seleccionados.size !== 1 ? 's' : ''}`
                      : `${filas.length} registro${filas.length !== 1 ? 's' : ''} filtrados`}
                  </div>
                  {[
                    { label: 'PDF',   fmt: 'pdf',   icon: '📄' },
                    { label: 'Excel', fmt: 'excel', icon: '📊' },
                    { label: 'CSV',   fmt: 'csv',   icon: '📋' },
                  ].map(({ label, fmt, icon }) => (
                    <button key={fmt} onClick={() => exportarCompensatorios(fmt)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                        padding: '9px 14px', background: 'none', border: 'none',
                        cursor: 'pointer', fontSize: 13, color: '#374151', textAlign: 'left',
                        fontFamily: 'inherit', transition: 'background 0.12s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <span>{icon}</span>{label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Filtros */}
        <div className="comp-filters">
          <div className="comp-search-wrap">
            <Search size={13} className="comp-search-icon" />
            <input
              className="comp-search"
              placeholder="Buscar por usuario, RUT o motivo…"
              value={busq} onChange={e => setBusq(e.target.value)}
            />
          </div>
          <select className="comp-select-filter" value={filtTipo} onChange={e => setFiltTipo(e.target.value)}>
            <option value="">Todos los tipos</option>
            {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select className="comp-select-filter" value={filtEstado} onChange={e => setFiltEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="disponible">Disponible</option>
            <option value="usado">Usado</option>
            <option value="vencido">Vencido</option>
          </select>
        </div>

        {/* Contenido */}
        {cargando ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
            <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 10px', display: 'block' }} />
            Cargando…
          </div>
        ) : filas.length === 0 ? (
          <div className="comp-empty">
            <div className="comp-empty-icon"><Gift size={24} /></div>
            <p className="comp-empty-title">Sin registros</p>
            <p className="comp-empty-desc">
              {busq || filtTipo || filtEstado
                ? 'Ningún registro coincide con los filtros.'
                : puedeCrear ? 'Registra el primer día compensatorio.' : 'Aún no tienes días compensatorios.'}
            </p>
          </div>
        ) : (
          <>
            <div className="comp-table-wrap">
              <table className="comp-table">
                <thead>
                  <tr>
                    {puedeExportar && (
                      <th style={{ width: 36, textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={filas.length > 0 && filas.every(r => seleccionados.has(r.id))}
                          ref={el => { if (el) el.indeterminate = seleccionados.size > 0 && !filas.every(r => seleccionados.has(r.id)) }}
                          onChange={toggleTodos}
                          title="Seleccionar todos"
                          style={{ width: 14, height: 14, cursor: 'pointer', accentColor: '#4f46e5' }}
                        />
                      </th>
                    )}
                    {esAdmin && <th>Usuario</th>}
                    <th>Tipo</th>
                    <th>Días</th>
                    <th>Fecha ganado</th>
                    <th>Vence</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence initial={false}>
                    {filasPag.map(r => (
                      <FilaRegistro
                        key={r.id}
                        r={r}
                        esAdmin={esAdmin}
                        puedeEditar={puedeEditar}
                        puedeElim={puedeElim}
                        puedeExportar={puedeExportar}
                        seleccionado={seleccionados.has(r.id)}
                        onToggle={() => toggleSeleccion(r.id)}
                        onVer={() => setVerDetalle(r)}
                        onEditar={() => { setEditData(r); setModalOpen(true) }}
                        onEliminar={() => setEliminar(r)}
                      />
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {totalPags > 1 && (
              <div className="comp-pagination">
                <span className="comp-pagination-info">
                  {(pagSegura - 1) * POR_PAGINA + 1}–{Math.min(pagSegura * POR_PAGINA, filas.length)} de {filas.length}
                </span>
                <div className="comp-pagination-btns">
                  <button
                    className="comp-pag-btn"
                    onClick={() => setPagActual(p => Math.max(1, p - 1))}
                    disabled={pagSegura === 1}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  {Array.from({ length: totalPags }, (_, i) => i + 1).map(n => (
                    <button
                      key={n}
                      className={`comp-pag-btn${n === pagSegura ? ' comp-pag-btn--active' : ''}`}
                      onClick={() => setPagActual(n)}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    className="comp-pag-btn"
                    onClick={() => setPagActual(p => Math.min(totalPags, p + 1))}
                    disabled={pagSegura === totalPags}
                  >
                    <ChevronRightIcon size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal detalle */}
      <AnimatePresence>
        {verDetalle && (
          <ModalDetalle
            r={verDetalle}
            puedeEditar={puedeEditar}
            puedeElim={puedeElim}
            onClose={() => setVerDetalle(null)}
            onEditar={() => { setEditData(verDetalle); setVerDetalle(null); setModalOpen(true) }}
            onEliminar={() => { setEliminar(verDetalle); setVerDetalle(null) }}
          />
        )}
      </AnimatePresence>

      {/* Modal registrar/editar */}
      <AnimatePresence>
        {modalOpen && (
          <ModalCompensatorio
            usuarios={usuarios}
            editData={editData}
            usuarioActual={usuario}
            esAdmin={esAdmin}
            onClose={() => { setModalOpen(false); setEditData(null) }}
            onGuardar={handleGuardar}
          />
        )}
      </AnimatePresence>

      {/* Modal confirmar eliminar */}
      <AnimatePresence>
        {eliminar && (
          <motion.div className="comp-overlay" variants={overlayV} initial="hidden" animate="visible" exit="exit">
            <motion.div
              variants={modalV} initial="hidden" animate="visible" exit="exit"
              style={{ background: '#fff', borderRadius: 18, padding: '28px 28px 24px', maxWidth: 380, width: '100%',
                boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}
            >
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 20 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(239,68,68,0.1)',
                  color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <p style={{ margin: '0 0 5px', fontWeight: 700, fontSize: 15, color: '#0f172a' }}>
                    Eliminar registro
                  </p>
                  <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
                    ¿Eliminar el compensatorio de {fmtDias(eliminar.cantidad)} día(s) del {fmtFecha(eliminar.fecha_ganado)}?
                    Esta acción no se puede deshacer.
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button className="comp-btn-secondary" onClick={() => setEliminar(null)} disabled={eliminando}>
                  Cancelar
                </button>
                <button
                  onClick={handleEliminar} disabled={eliminando}
                  style={{ padding: '8px 16px', borderRadius: 9, border: 'none',
                    background: '#dc2626', color: '#fff', fontSize: 13, fontWeight: 700,
                    cursor: eliminando ? 'not-allowed' : 'pointer', opacity: eliminando ? 0.6 : 1,
                    display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}
                >
                  {eliminando && <Loader2 size={13} className="animate-spin" />}
                  Eliminar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────

function KPICard({ icon, variant, value, label }) {
  return (
    <motion.div className="comp-kpi" whileHover={{ y: -2 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }}>
      <div className={`comp-kpi-accent comp-kpi-accent--${variant}`} />
      <div className={`comp-kpi-icon comp-kpi-icon--${variant}`}>{icon}</div>
      <p className="comp-kpi-value">{value}</p>
      <p className="comp-kpi-label">{label}</p>
    </motion.div>
  )
}

// ── Fila tabla ────────────────────────────────────────────

function FilaRegistro({ r, esAdmin, puedeEditar, puedeElim, puedeExportar, seleccionado, onToggle, onVer, onEditar, onEliminar }) {
  const u      = r.usuario
  const estado = estadoEfectivo(r)
  const tipo   = TIPO_MAP[r.tipo]

  const estadoStyle = {
    disponible: { bg: 'rgba(16,185,129,0.1)',  color: '#059669', label: 'Disponible' },
    usado:      { bg: 'rgba(100,116,139,0.1)', color: '#475569', label: 'Usado' },
    vencido:    { bg: 'rgba(239,68,68,0.1)',   color: '#dc2626', label: 'Vencido' },
  }[estado]

  const tipoStyle = {
    desfile:                 { bg: 'rgba(79,70,229,0.1)',  color: '#4f46e5' },
    trabajo_verano:          { bg: 'rgba(245,158,11,0.1)', color: '#d97706' },
    actividad_institucional: { bg: 'rgba(16,185,129,0.1)', color: '#059669' },
    reemplazo:               { bg: 'rgba(14,165,233,0.1)', color: '#0284c7' },
    otro:                    { bg: 'rgba(100,116,139,0.1)',color: '#475569' },
  }[r.tipo] ?? { bg: '#f1f5f9', color: '#475569' }

  return (
    <motion.tr
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      style={{ display: 'table-row', background: seleccionado ? 'rgba(99,102,241,0.04)' : undefined }}
    >
      {puedeExportar && (
        <td style={{ textAlign: 'center', paddingLeft: 8 }}>
          <input
            type="checkbox"
            checked={!!seleccionado}
            onChange={onToggle}
            onClick={e => e.stopPropagation()}
            title="Seleccionar para exportar"
            style={{ width: 14, height: 14, cursor: 'pointer', accentColor: '#4f46e5' }}
          />
        </td>
      )}
      {esAdmin && (
        <td>
          <div className="comp-user-cell">
            <div className="comp-avatar" style={{ background: avatarColor(u?.nombre ?? '') }}>
              {initials(u?.nombre ?? '?')}
            </div>
            <div>
              <p className="comp-user-name">{u?.nombre ?? '—'}</p>
              {u?.rut && <p className="comp-user-rut">{u.rut}</p>}
            </div>
          </div>
        </td>
      )}
      <td>
        <span className="comp-tipo-badge" style={{ background: tipoStyle.bg, color: tipoStyle.color }}>
          {tipo?.label ?? r.tipo}
        </span>
        {r.motivo && (
          <p style={{ margin: '3px 0 0', fontSize: 11.5, color: '#94a3b8', maxWidth: 200 }}
            title={r.motivo}>
            {r.motivo.length > 45 ? r.motivo.slice(0, 45) + '…' : r.motivo}
          </p>
        )}
      </td>
      <td>
        <p className="comp-dias-num">{fmtDias(r.cantidad)}</p>
        {r.saldo_restante !== r.cantidad && r.saldo_restante > 0 && (
          <p className="comp-dias-restante">{fmtDias(r.saldo_restante)} restante</p>
        )}
      </td>
      <td style={{ fontSize: 13, color: '#475569', whiteSpace: 'nowrap' }}>
        {fmtFecha(r.fecha_ganado)}
      </td>
      <td style={{ fontSize: 13, color: r.vence_en && r.vence_en < todayStr() ? '#dc2626' : '#475569', whiteSpace: 'nowrap' }}>
        {r.vence_en ? fmtFecha(r.vence_en) : <span style={{ color: '#cbd5e1' }}>Sin vencimiento</span>}
      </td>
      <td>
        <span className="comp-estado" style={{ background: estadoStyle.bg, color: estadoStyle.color }}>
          {estadoStyle.label}
        </span>
      </td>
      <td>
        <div className="comp-actions">
          <button className="comp-action-btn comp-action-btn--view" onClick={onVer} title="Ver detalle">
            <Eye size={13} />
          </button>
          {puedeEditar && (
            <button className="comp-action-btn comp-action-btn--edit" onClick={onEditar} title="Editar">
              <Pencil size={13} />
            </button>
          )}
          {puedeElim && (
            <button className="comp-action-btn comp-action-btn--delete" onClick={onEliminar} title="Eliminar">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </td>
    </motion.tr>
  )
}

// ── Modal detalle ─────────────────────────────────────────

function ModalDetalle({ r, puedeEditar, puedeElim, onClose, onEditar, onEliminar }) {
  const u      = r.usuario
  const estado = estadoEfectivo(r)
  const tipo   = TIPO_MAP[r.tipo]

  const estadoStyle = {
    disponible: { bg: 'rgba(16,185,129,0.1)',  color: '#059669', label: 'Disponible' },
    usado:      { bg: 'rgba(100,116,139,0.1)', color: '#475569', label: 'Usado' },
    vencido:    { bg: 'rgba(239,68,68,0.1)',   color: '#dc2626', label: 'Vencido' },
  }[estado]

  const tipoStyle = {
    desfile:                 { bg: 'rgba(79,70,229,0.1)',  color: '#4f46e5' },
    trabajo_verano:          { bg: 'rgba(245,158,11,0.1)', color: '#d97706' },
    actividad_institucional: { bg: 'rgba(16,185,129,0.1)', color: '#059669' },
    reemplazo:               { bg: 'rgba(14,165,233,0.1)', color: '#0284c7' },
    otro:                    { bg: 'rgba(100,116,139,0.1)',color: '#475569' },
  }[r.tipo] ?? { bg: '#f1f5f9', color: '#475569' }

  const Row = ({ label, value, highlight }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
      <span style={{ fontSize: 12.5, color: '#64748b', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: highlight ? 800 : 600, color: highlight ? '#4f46e5' : '#0f172a' }}>
        {value}
      </span>
    </div>
  )

  return (
    <motion.div className="comp-overlay" variants={overlayV} initial="hidden" animate="visible" exit="exit"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <motion.div className="comp-modal" style={{ maxWidth: 460 }} variants={modalV} initial="hidden" animate="visible" exit="exit">

        {/* Header */}
        <div className="comp-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(79,70,229,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' }}>
              <Eye size={16} />
            </div>
            <p className="comp-modal-title">Detalle del compensatorio</p>
          </div>
          <button className="comp-modal-close" onClick={onClose}><X size={15} /></button>
        </div>

        <div className="comp-modal-body">

          {/* Usuario */}
          {u && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
              background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <div className="comp-avatar" style={{ background: avatarColor(u.nombre), width: 42, height: 42, fontSize: 15 }}>
                {initials(u.nombre)}
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{u.nombre}</p>
                {u.rut && <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>{u.rut}</p>}
              </div>
            </div>
          )}

          {/* Datos */}
          <div>
            <Row label="Tipo"
              value={<span className="comp-tipo-badge" style={{ background: tipoStyle.bg, color: tipoStyle.color }}>
                {tipo?.label ?? r.tipo}
              </span>}
            />
            <Row label="Días ganados"
              value={<span style={{ color: '#4f46e5', fontWeight: 800, fontSize: 16 }}>{fmtDias(r.cantidad)}</span>}
            />
            {r.saldo_restante !== r.cantidad && (
              <Row label="Saldo restante"
                value={<span style={{ fontWeight: 700, color: r.saldo_restante > 0 ? '#059669' : '#94a3b8' }}>
                  {fmtDias(r.saldo_restante ?? 0)} día{r.saldo_restante !== 1 ? 's' : ''}
                </span>}
              />
            )}
            <Row label="Fecha ganado" value={fmtFecha(r.fecha_ganado)} />
            <Row label="Vencimiento"
              value={r.vence_en
                ? <span style={{ color: r.vence_en < todayStr() ? '#dc2626' : '#0f172a' }}>{fmtFecha(r.vence_en)}</span>
                : <span style={{ color: '#cbd5e1' }}>Sin vencimiento</span>}
            />
            <Row label="Estado"
              value={<span className="comp-estado" style={{ background: estadoStyle.bg, color: estadoStyle.color }}>
                {estadoStyle.label}
              </span>}
            />
          </div>

          {/* Motivo */}
          {r.motivo && (
            <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 14px',
              border: '1px solid #e2e8f0' }}>
              <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#94a3b8',
                textTransform: 'uppercase', letterSpacing: '0.06em' }}>Motivo</p>
              <p style={{ margin: 0, fontSize: 13.5, color: '#374151', lineHeight: 1.5 }}>{r.motivo}</p>
            </div>
          )}

          {/* Observaciones */}
          {r.observaciones && (
            <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 14px',
              border: '1px solid #e2e8f0' }}>
              <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#94a3b8',
                textTransform: 'uppercase', letterSpacing: '0.06em' }}>Observaciones</p>
              <p style={{ margin: 0, fontSize: 13.5, color: '#374151', lineHeight: 1.5 }}>{r.observaciones}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="comp-modal-footer" style={{ justifyContent: 'space-between' }}>
          <button className="comp-btn-secondary" onClick={onClose}>Cerrar</button>
          {(puedeEditar || puedeElim) && (
            <div style={{ display: 'flex', gap: 8 }}>
              {puedeEditar && (
                <button className="comp-btn-secondary" onClick={onEditar}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Pencil size={13} /> Editar
                </button>
              )}
              {puedeElim && (
                <button onClick={onEliminar}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                    borderRadius: 10, border: 'none', background: 'rgba(239,68,68,0.08)',
                    color: '#dc2626', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <Trash2 size={13} /> Eliminar
                </button>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Modal registrar/editar ────────────────────────────────

function ModalCompensatorio({ usuarios, editData, usuarioActual, esAdmin, onClose, onGuardar }) {
  const isEdit = !!editData

  const [usuarioId,    setUsuarioId]    = useState(isEdit ? editData.usuario_id : (esAdmin ? '' : usuarioActual?.id ?? ''))
  const [tipo,         setTipo]         = useState(isEdit ? editData.tipo          : '')
  const [cantPreset,   setCantPreset]   = useState(() => {
    if (!isEdit) return null
    const p = CANTIDADES_PRESET.find(c => c.value === editData.cantidad)
    return p ? p.value : null
  })
  const [cantCustom,   setCantCustom]   = useState(isEdit && !CANTIDADES_PRESET.find(c => c.value === editData.cantidad)
    ? String(editData.cantidad) : '')
  const [fechaGanado,  setFechaGanado]  = useState(isEdit ? editData.fecha_ganado : '')
  const [venceEn,      setVenceEn]      = useState(isEdit ? (editData.vence_en ?? '') : '')
  const [motivo,       setMotivo]       = useState(isEdit ? (editData.motivo ?? '') : '')
  const [observaciones,setObservaciones]= useState(isEdit ? (editData.observaciones ?? '') : '')
  const [guardando,    setGuardando]    = useState(false)
  const [errores,      setErrores]      = useState({})

  // Dropdown usuario
  const [dropOpen,   setDropOpen]   = useState(false)
  const [busqUser,   setBusqUser]   = useState('')
  const dropRef = useRef(null)

  useEffect(() => {
    const h = e => { if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const cantidadFinal = cantPreset !== null
    ? cantPreset
    : (parseFloat(cantCustom) || 0)

  const usuarioSel = usuarios.find(u => u.id === usuarioId) ?? null

  const norm = s => s?.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') ?? ''
  const usuariosFilt = usuarios.filter(u => {
    if (!busqUser.trim()) return true
    const q = norm(busqUser)
    return norm(u.nombre).includes(q) || norm(u.rut ?? '').includes(q)
  })

  function validar() {
    const e = {}
    if (!usuarioId)           e.usuario    = 'Selecciona un usuario'
    if (!tipo)                e.tipo       = 'Selecciona un tipo'
    if (!cantidadFinal || cantidadFinal <= 0) e.cantidad = 'Ingresa una cantidad válida'
    if (!motivo.trim())       e.motivo     = 'El motivo es obligatorio'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  async function handleGuardar() {
    if (!validar()) return
    setGuardando(true)
    await onGuardar({
      id: editData?.id ?? null,
      usuarioId, tipo, cantidad: cantidadFinal,
      // fecha en que se ganó = fecha de registro (hoy); sin vencimiento
      fechaGanado: fechaGanado || todayStr(),
      venceEn: venceEn || null,
      motivo, observaciones,
    })
    setGuardando(false)
  }

  const tipoObj = TIPOS.find(t => t.value === tipo)

  return (
    <motion.div className="comp-overlay" variants={overlayV} initial="hidden" animate="visible" exit="exit"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div className="comp-modal" variants={modalV} initial="hidden" animate="visible" exit="exit">
        {/* Header */}
        <div className="comp-modal-header">
          <p className="comp-modal-title">
            {isEdit ? 'Editar compensatorio' : 'Registrar compensación'}
          </p>
          <button className="comp-modal-close" onClick={onClose}><X size={15} /></button>
        </div>

        <div className="comp-modal-body">
          {/* Usuario */}
          {esAdmin && (
            <div className="comp-field">
              <label className="comp-label">Usuario</label>
              <div ref={dropRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setDropOpen(o => !o)}
                  style={{
                    width: '100%', padding: '10px 12px', border: `1.5px solid ${errores.usuario ? '#f87171' : '#e2e8f0'}`,
                    borderRadius: 10, background: '#f8fafc', cursor: 'pointer', textAlign: 'left',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    fontSize: 13.5, fontFamily: 'inherit', color: usuarioSel ? '#0f172a' : '#94a3b8',
                    transition: 'border-color 0.15s',
                  }}
                >
                  {usuarioSel
                    ? <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 22, height: 22, borderRadius: '50%', background: avatarColor(usuarioSel.nombre),
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 9, fontWeight: 700, color: '#fff' }}>
                          {initials(usuarioSel.nombre)}
                        </span>
                        {usuarioSel.nombre}
                      </span>
                    : 'Seleccionar usuario…'}
                  <ChevronDown size={14} style={{ color: '#94a3b8', transition: 'transform 0.2s', transform: dropOpen ? 'rotate(180deg)' : '' }} />
                </button>

                <AnimatePresence>
                  {dropOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0,  scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.97 }}
                      transition={{ duration: 0.14 }}
                      style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
                        background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12,
                        boxShadow: '0 10px 32px rgba(0,0,0,0.12)', zIndex: 100, overflow: 'hidden' }}
                    >
                      <div style={{ padding: '8px 8px 4px' }}>
                        <input
                          autoFocus
                          placeholder="Buscar usuario…"
                          value={busqUser} onChange={e => setBusqUser(e.target.value)}
                          style={{ width: '100%', padding: '7px 10px', border: '1.5px solid #e2e8f0',
                            borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none',
                            boxSizing: 'border-box' }}
                        />
                      </div>
                      <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                        {usuariosFilt.length === 0
                          ? <p style={{ padding: '12px 14px', fontSize: 13, color: '#94a3b8', margin: 0 }}>Sin resultados</p>
                          : usuariosFilt.map(u => (
                            <div key={u.id}
                              onClick={() => { setUsuarioId(u.id); setDropOpen(false); setBusqUser(''); setErrores(p => ({ ...p, usuario: '' })) }}
                              style={{ padding: '9px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9,
                                background: u.id === usuarioId ? 'rgba(99,102,241,0.07)' : '',
                                transition: 'background 0.1s', fontSize: 13, color: '#0f172a',
                                fontWeight: u.id === usuarioId ? 600 : 400 }}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.05)'}
                              onMouseLeave={e => e.currentTarget.style.background = u.id === usuarioId ? 'rgba(99,102,241,0.07)' : ''}
                            >
                              <span style={{ width: 24, height: 24, borderRadius: '50%', background: avatarColor(u.nombre),
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                                {initials(u.nombre)}
                              </span>
                              <span>
                                <span>{u.nombre}</span>
                                {u.rut && <span style={{ color: '#94a3b8', fontSize: 11.5, marginLeft: 6 }}>{u.rut}</span>}
                              </span>
                            </div>
                          ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {errores.usuario && <span className="comp-error">{errores.usuario}</span>}
            </div>
          )}

          {/* Tipo */}
          <div className="comp-field">
            <label className="comp-label">Tipo / Motivo</label>
            <select
              className={`comp-select${errores.tipo ? ' comp-select--error' : ''}`}
              value={tipo} onChange={e => { setTipo(e.target.value); setErrores(p => ({ ...p, tipo: '' })) }}
            >
              <option value="">Seleccionar tipo…</option>
              {TIPOS.map(t => (
                <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
              ))}
            </select>
            {errores.tipo && <span className="comp-error">{errores.tipo}</span>}
          </div>

          {/* Cantidad */}
          <div className="comp-field">
            <label className="comp-label">Cantidad de días</label>
            <div className="comp-cantidad-grid">
              {CANTIDADES_PRESET.map(opt => (
                <div
                  key={opt.value ?? 'custom'}
                  className={`comp-cantidad-opt${cantPreset === opt.value && opt.value !== null ? ' comp-cantidad-opt--active' : ''}${opt.value === null && cantPreset === null ? ' comp-cantidad-opt--active' : ''}`}
                  onClick={() => {
                    setCantPreset(opt.value)
                    if (opt.value !== null) setCantCustom('')
                    setErrores(p => ({ ...p, cantidad: '' }))
                  }}
                >
                  <span className="comp-cantidad-dot" />
                  <div>
                    <p className="comp-cantidad-label">{opt.label}</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>{opt.sub}</p>
                  </div>
                </div>
              ))}
            </div>
            {cantPreset === null && (
              <input
                className={`comp-input${errores.cantidad ? ' comp-input--error' : ''}`}
                type="number" min="0.5" step="0.5" placeholder="Ej: 1.5"
                value={cantCustom}
                onChange={e => { setCantCustom(e.target.value); setErrores(p => ({ ...p, cantidad: '' })) }}
                style={{ marginTop: 8 }}
              />
            )}
            {errores.cantidad && <span className="comp-error">{errores.cantidad}</span>}
          </div>

          {/* Motivo */}
          <div className="comp-field">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <label className="comp-label">Motivo detallado <span style={{ color: '#ef4444', fontWeight: 700 }}>*</span></label>
              <span style={{ fontSize: 11, color: motivo.length > 180 ? '#f59e0b' : '#cbd5e1', fontVariantNumeric: 'tabular-nums' }}>
                {motivo.length}/200
              </span>
            </div>
            <input
              className={`comp-input${errores.motivo ? ' comp-input--error' : ''}`}
              placeholder="Ej: Desfile 18 de septiembre, turno mañana"
              maxLength={200}
              value={motivo} onChange={e => { setMotivo(e.target.value); setErrores(p => ({ ...p, motivo: '' })) }}
            />
            {errores.motivo && <span className="comp-error">{errores.motivo}</span>}
          </div>

          {/* Observaciones */}
          <div className="comp-field">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <label className="comp-label">Observaciones <span style={{ color: '#94a3b8', fontWeight: 400, textTransform: 'none' }}>(opcional)</span></label>
              <span style={{ fontSize: 11, color: observaciones.length > 360 ? '#f59e0b' : '#cbd5e1', fontVariantNumeric: 'tabular-nums' }}>
                {observaciones.length}/400
              </span>
            </div>
            <textarea
              className="comp-textarea" placeholder="Notas adicionales…"
              maxLength={400}
              value={observaciones} onChange={e => setObservaciones(e.target.value)}
            />
          </div>

          {/* Resumen */}
          {(cantidadFinal > 0 || tipo) && (
            <motion.div
              className="comp-resumen"
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <p className="comp-resumen-title">Resumen</p>
              {usuarioSel && (
                <div className="comp-resumen-row">
                  <span>Usuario</span>
                  <span className="comp-resumen-row-val">{usuarioSel.nombre}</span>
                </div>
              )}
              {tipoObj && (
                <div className="comp-resumen-row">
                  <span>Tipo</span>
                  <span className="comp-resumen-row-val">{tipoObj.label}</span>
                </div>
              )}
              {cantidadFinal > 0 && (
                <div className="comp-resumen-row">
                  <span>Días a agregar</span>
                  <span className="comp-resumen-row-val" style={{ color: '#4f46e5', fontSize: 16 }}>
                    +{fmtDias(cantidadFinal)} día{cantidadFinal !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </motion.div>
          )}
        </div>

        {/* Footer */}
        <div className="comp-modal-footer">
          <button className="comp-btn-secondary" onClick={onClose} disabled={guardando}>Cancelar</button>
          <button className="comp-btn-primary" onClick={handleGuardar} disabled={guardando}>
            {guardando && <Loader2 size={13} className="animate-spin" />}
            {isEdit ? 'Guardar cambios' : 'Registrar'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// Exportar helper para uso en Permisos.jsx
// extraIds: IDs adicionales con el mismo RUT (misma persona, cuentas distintas)
export async function getSaldoCompensatorio(usuarioId, extraIds = []) {
  const hoy    = new Date().toISOString().slice(0, 10)
  const allIds = [...new Set([usuarioId, ...extraIds].filter(Boolean))]
  const { data } = await supabase
    .from('dias_compensatorios')
    .select('id, cantidad, saldo_restante, fecha_ganado, vence_en')
    .in('usuario_id', allIds)
    .eq('estado', 'disponible')
    .order('fecha_ganado', { ascending: true })
  const records = (data ?? []).filter(r => !r.vence_en || r.vence_en >= hoy)
  const disponible = records.reduce((sum, r) => sum + (r.saldo_restante ?? r.cantidad), 0)
  return { disponible, records }
}

// Descuenta dias de saldo_restante (FIFO por fecha_ganado)
export async function descontarCompensatorios(usuarioId, diasADescontar, extraIds = []) {
  const { records } = await getSaldoCompensatorio(usuarioId, extraIds)
  let restante = diasADescontar
  for (const r of records) {
    if (restante <= 0) break
    const saldo   = r.saldo_restante ?? r.cantidad
    const usar    = Math.min(saldo, restante)
    const nuevo   = parseFloat((saldo - usar).toFixed(1))
    const estado  = nuevo === 0 ? 'usado' : 'disponible'
    await supabase.from('dias_compensatorios')
      .update({ saldo_restante: nuevo, estado })
      .eq('id', r.id)
    restante = parseFloat((restante - usar).toFixed(1))
  }
}

// Restaura (re-acredita) días al saldo — inverso de descontar.
// Se usa al borrar/anular una ausencia de tipo compensatorios.
// Restaura LIFO (al registro usado más reciente primero) para revertir el FIFO.
export async function restaurarCompensatorios(usuarioId, diasARestaurar, extraIds = []) {
  const hoy    = new Date().toISOString().slice(0, 10)
  const allIds = [...new Set([usuarioId, ...extraIds].filter(Boolean))]
  const { data } = await supabase
    .from('dias_compensatorios')
    .select('id, cantidad, saldo_restante, fecha_ganado, vence_en')
    .in('usuario_id', allIds)
    .order('fecha_ganado', { ascending: false })
  let restante = diasARestaurar
  for (const r of (data ?? [])) {
    if (restante <= 0) break
    const saldo = r.saldo_restante ?? r.cantidad
    const usado = parseFloat((r.cantidad - saldo).toFixed(1))
    if (usado <= 0) continue
    const restaurar = Math.min(usado, restante)
    const nuevo     = parseFloat((saldo + restaurar).toFixed(1))
    const vencido   = r.vence_en && r.vence_en < hoy
    const estado    = vencido ? 'vencido' : (nuevo > 0 ? 'disponible' : 'usado')
    await supabase.from('dias_compensatorios')
      .update({ saldo_restante: nuevo, estado })
      .eq('id', r.id)
    restante = parseFloat((restante - restaurar).toFixed(1))
  }
}
