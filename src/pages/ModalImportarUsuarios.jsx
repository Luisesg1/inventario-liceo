// src/pages/ModalImportarUsuarios.jsx
import { useState, useRef, useCallback } from 'react'
import { supabase } from '../supabase'
import * as XLSX from 'xlsx'

// ── Mapeo de roles (acepta nombres en español o claves internas) ──────────────
const ROLES_MAP = {
  'administrador': 'admin', 'admin': 'admin',
  'directivo': 'directivo',
  'coordinador': 'coordinador',
  'docente': 'docente',
  'asistente': 'asistente',
  'asistente de la educación': 'asistente',
  'asistente de la educacion': 'asistente',
  'administrativo': 'administrativo',
  'encargado_inventario': 'encargado_inventario',
  'encargado inventario': 'encargado_inventario',
  'encargado_soporte': 'encargado_soporte',
  'encargado soporte': 'encargado_soporte',
  'encargado_permisos': 'encargado_permisos',
  'encargado permisos': 'encargado_permisos',
  'editor': 'editor',
  'encargado': 'encargado',
  'soporte': 'soporte',
  'visor_requerimientos': 'visor_requerimientos',
  'visor requerimientos': 'visor_requerimientos',
}

const ROL_LABEL_CORTO = {
  admin: 'Administrador', directivo: 'Directivo', coordinador: 'Coordinador',
  docente: 'Docente', asistente: 'Asistente', administrativo: 'Administrativo',
  encargado_inventario: 'Enc. Inventario', encargado_soporte: 'Enc. Soporte',
  encargado_permisos: 'Enc. Permisos', editor: 'Editor',
  encargado: 'Encargado', soporte: 'Soporte', visor_requerimientos: 'Visor Req.',
}

// ── Validaciones ──────────────────────────────────────────────────────────────
function validarRut(rut) {
  const clean = rut.replace(/\./g, '').replace(/-/g, '').toUpperCase()
  if (clean.length < 2) return false
  const cuerpo = clean.slice(0, -1)
  const dv = clean.slice(-1)
  if (!/^\d+$/.test(cuerpo)) return false
  let suma = 0, multiplo = 2
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i]) * multiplo
    multiplo = multiplo < 7 ? multiplo + 1 : 2
  }
  const esperado = 11 - (suma % 11)
  const dvEsperado = esperado === 11 ? '0' : esperado === 10 ? 'K' : esperado.toString()
  return dv === dvEsperado
}

function normalizarRut(rut) {
  const clean = rut.replace(/[^0-9kK]/g, '').toUpperCase()
  if (!clean) return rut
  const body = clean.slice(0, -1)
  const dv = clean.slice(-1)
  return body.length > 0
    ? `${body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv}`
    : dv
}

function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function rutKey(rut) {
  return rut.replace(/[^0-9kK]/gi, '').toUpperCase()
}

function passwordDesdeRut(rut) {
  const soloDigitos = rut.replace(/[^0-9]/g, '')
  return soloDigitos.slice(0, 4)
}

// ── Descarga plantilla CSV ────────────────────────────────────────────────────
function descargarPlantilla() {
  const filas = [
    ['nombres', 'apellidos', 'rut', 'email', 'rol'],
    ['Luis', 'Soto González', '20469215-7', 'luis@correo.cl', 'administrador'],
    ['Ana', 'Gutierrez Morales', '11753330-1', 'ana@correo.cl', 'docente'],
    ['Jorge', 'Vera Fuentes', '17990020-3', 'jorge@correo.cl', 'soporte'],
  ]
  const csv = filas.map(r => r.join(',')).join('\r\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'plantilla_usuarios.csv'; a.click()
  URL.revokeObjectURL(url)
}

// ── Componente ────────────────────────────────────────────────────────────────
export default function ModalImportarUsuarios({ onCerrar, onImportado }) {
  const [paso, setPaso]         = useState(1)
  const [drag, setDrag]         = useState(false)
  const [parseando, setParseando] = useState(false)
  const [archivoNombre, setArchivoNombre] = useState('')
  const [filas, setFilas]       = useState([])
  const [importando, setImportando] = useState(false)
  const [progreso, setProgreso] = useState(0)
  const [resultado, setResultado] = useState(null)
  const inputRef = useRef(null)

  // ── Procesar archivo ────────────────────────────────────────────────────────
  const procesarArchivo = useCallback(async (file) => {
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      alert('Solo se permiten archivos .csv o .xlsx')
      return
    }
    setParseando(true)
    setArchivoNombre(file.name)

    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false })

      if (data.length < 2) {
        alert('El archivo no contiene datos.')
        setParseando(false)
        return
      }

      const headers = data[0].map(h => String(h).trim().toLowerCase())
      const col = {
        nombres:   headers.findIndex(h => ['nombres', 'nombre'].includes(h)),
        apellidos: headers.findIndex(h => ['apellidos', 'apellido'].includes(h)),
        rut:       headers.findIndex(h => h === 'rut'),
        email:     headers.findIndex(h => ['email', 'correo', 'e-mail'].includes(h)),
        rol:       headers.findIndex(h => h === 'rol'),
      }

      const rows = data.slice(1).filter(r => r.some(c => String(c).trim() !== ''))

      const parsed = rows.map((row, i) => ({
        idx: i,
        nombres:   col.nombres   >= 0 ? String(row[col.nombres]   ?? '').trim() : '',
        apellidos: col.apellidos >= 0 ? String(row[col.apellidos] ?? '').trim() : '',
        rut:       col.rut       >= 0 ? String(row[col.rut]       ?? '').trim() : '',
        email:     col.email     >= 0 ? String(row[col.email]     ?? '').trim().toLowerCase() : '',
        rol:       col.rol       >= 0 ? String(row[col.rol]       ?? '').trim().toLowerCase() : '',
      }))

      // Conteo de duplicados dentro del archivo
      const emailCount = {}, rutCount = {}
      parsed.forEach(r => {
        if (r.email) emailCount[r.email] = (emailCount[r.email] ?? 0) + 1
        if (r.rut)   rutCount[rutKey(r.rut)] = (rutCount[rutKey(r.rut)] ?? 0) + 1
      })

      // Emails ya registrados en la BD
      const emailsParaCheck = [...new Set(parsed.map(r => r.email).filter(Boolean))]
      let emailsDB = new Set()
      if (emailsParaCheck.length > 0) {
        const { data: dbUsers } = await supabase
          .from('usuarios').select('email').in('email', emailsParaCheck)
        emailsDB = new Set((dbUsers ?? []).map(u => u.email.toLowerCase()))
      }

      // Validación fila a fila
      const validated = parsed.map(row => {
        const errores = []

        if (!row.nombres)   errores.push('Nombres requerido')
        if (!row.apellidos) errores.push('Apellidos requerido')
        if (!row.rut)       errores.push('RUT requerido')
        else if (!validarRut(row.rut)) errores.push('RUT inválido')
        if (!row.email)     errores.push('Email requerido')
        else if (!validarEmail(row.email)) errores.push('Email con formato inválido')
        if (!row.rol)       errores.push('Rol requerido')
        else if (!ROLES_MAP[row.rol]) errores.push(`Rol "${row.rol}" no reconocido`)

        if (errores.length === 0) {
          if ((emailCount[row.email] ?? 0) > 1)      errores.push('Email duplicado en el archivo')
          if ((rutCount[rutKey(row.rut)] ?? 0) > 1)  errores.push('RUT duplicado en el archivo')
          if (emailsDB.has(row.email))               errores.push('Email ya registrado en el sistema')
        }

        const esDuplicado = errores.some(e =>
          e.includes('duplicado') || e.includes('registrado')
        )
        const estado = errores.length === 0 ? 'valido' : esDuplicado ? 'duplicado' : 'error'

        return {
          ...row,
          rut:       row.rut ? normalizarRut(row.rut) : '',
          rolInterno: ROLES_MAP[row.rol] ?? '',
          estado,
          errores,
        }
      })

      setFilas(validated)
      setPaso(2)
    } catch (err) {
      console.error('Error al procesar archivo:', err)
      alert('No se pudo leer el archivo. Verifica que sea un CSV o XLSX válido.')
    }
    setParseando(false)
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDrag(false)
    const file = e.dataTransfer.files[0]
    if (file) procesarArchivo(file)
  }, [procesarArchivo])

  const handleFileInput = (e) => {
    const file = e.target.files[0]
    if (file) procesarArchivo(file)
    e.target.value = ''
  }

  const filasValidas    = filas.filter(f => f.estado === 'valido')
  const filasDuplicadas = filas.filter(f => f.estado === 'duplicado')
  const filasError      = filas.filter(f => f.estado === 'error')

  // ── Importar ────────────────────────────────────────────────────────────────
  async function handleImportar() {
    if (!filasValidas.length) return
    setPaso(3)
    setImportando(true)
    setProgreso(0)

    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token

    const detalles = []
    let creados = 0, erroresCreacion = 0

    for (let i = 0; i < filasValidas.length; i++) {
      const fila = filasValidas[i]
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crear-usuario`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              nombre:           `${fila.nombres} ${fila.apellidos}`.trim(),
              rut:              fila.rut,
              email:            fila.email,
              rol:              fila.rolInterno,
              passwordOverride: passwordDesdeRut(fila.rut),
            }),
          }
        )
        const json = await res.json()
        if (!res.ok) {
          erroresCreacion++
          detalles.push({ ...fila, _resultado: 'error', _msg: json.error ?? 'Error desconocido' })
        } else {
          creados++
          detalles.push({
            ...fila,
            _resultado: 'creado',
            _msg: json.emailEnviado ? 'Creado, email enviado' : 'Creado (email no enviado)',
          })
        }
      } catch {
        erroresCreacion++
        detalles.push({ ...fila, _resultado: 'error', _msg: 'Error de conexión' })
      }
      setProgreso(Math.round(((i + 1) / filasValidas.length) * 100))
    }

    setResultado({ creados, omitidos: filasDuplicadas.length, errores: erroresCreacion, detalles })
    setImportando(false)
    if (creados > 0) onImportado?.()
  }

  // ── Estilos reutilizables ──────────────────────────────────────────────────
  const overlay = {
    position: 'fixed', inset: 0,
    background: 'rgba(5,12,55,0.65)',
    backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, animation: 'fadeIn 0.15s ease',
  }
  const modal = {
    background: '#fff', borderRadius: 14,
    padding: '28px 28px 24px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
    border: '1px solid #e5e7eb',
    animation: 'slideUp 0.18s ease',
    width: '95%',
    maxWidth: paso === 2 ? 820 : 540,
    maxHeight: '92vh',
    overflowY: 'auto',
  }
  const btnPrimary = (disabled) => ({
    padding: '9px 22px', borderRadius: 10, border: 'none',
    background: disabled ? '#e5e7eb' : '#1a237e',
    color: disabled ? '#9ca3af' : '#fff',
    fontSize: 13.5, fontWeight: 700,
    cursor: disabled ? 'default' : 'pointer',
  })
  const btnSecondary = {
    padding: '9px 18px', borderRadius: 10,
    border: '1.5px solid #e5e7eb', background: '#fff',
    color: '#374151', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={overlay} onClick={importando ? undefined : onCerrar}>
      <div style={modal} onClick={e => e.stopPropagation()}>

        {/* Encabezado */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>
              📥 Importar usuarios
            </p>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: '#6b7280' }}>
              {paso === 1 ? 'Sube un archivo CSV o XLSX con los datos'
                : paso === 2 ? 'Revisa los datos antes de importar'
                : 'Resultado de la importación'}
            </p>
          </div>
          {!importando && (
            <button onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 22, lineHeight: 1, padding: '0 0 0 12px', marginTop: -2 }}>×</button>
          )}
        </div>

        {/* Stepper */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 24 }}>
          {['Subir archivo', 'Revisar datos', 'Resultado'].map((label, i) => {
            const n = i + 1
            const active = paso === n, done = paso > n
            return (
              <div key={n} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 800, flexShrink: 0,
                    background: done ? '#16a34a' : active ? '#1a237e' : '#e5e7eb',
                    color: done || active ? '#fff' : '#9ca3af',
                  }}>
                    {done ? '✓' : n}
                  </div>
                  <span style={{
                    fontSize: 12, fontWeight: active ? 700 : 500,
                    color: active ? '#1a237e' : done ? '#16a34a' : '#9ca3af',
                    whiteSpace: 'nowrap',
                  }}>{label}</span>
                </div>
                {i < 2 && (
                  <div style={{ flex: 1, height: 1, background: '#e5e7eb', margin: '0 10px' }} />
                )}
              </div>
            )
          })}
        </div>

        {/* ══ Paso 1: Subir ══════════════════════════════════════════════════ */}
        {paso === 1 && (
          <div>
            {/* Zona drag & drop */}
            <div
              onDragOver={e => { e.preventDefault(); setDrag(true) }}
              onDragLeave={() => setDrag(false)}
              onDrop={handleDrop}
              onClick={() => !parseando && inputRef.current?.click()}
              style={{
                border: `2px dashed ${drag ? '#1a237e' : '#d1d5db'}`,
                borderRadius: 12, padding: '38px 24px', textAlign: 'center',
                cursor: parseando ? 'default' : 'pointer',
                background: drag ? '#eef2ff' : '#f9fafb',
                transition: 'all 0.15s', marginBottom: 16,
              }}
            >
              {parseando ? (
                <div>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>⏳</div>
                  <p style={{ margin: 0, fontSize: 14, color: '#6b7280', fontWeight: 600 }}>
                    Procesando {archivoNombre}…
                  </p>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 38, marginBottom: 10 }}>📂</div>
                  <p style={{ margin: '0 0 5px', fontWeight: 700, color: '#374151', fontSize: 14.5 }}>
                    Arrastra tu archivo aquí
                  </p>
                  <p style={{ margin: '0 0 14px', fontSize: 13, color: '#9ca3af' }}>
                    o haz clic para seleccionar
                  </p>
                  <div style={{ display: 'inline-flex', gap: 8 }}>
                    <span style={{ background: '#e0e7ff', color: '#3730a3', borderRadius: 6, padding: '3px 11px', fontSize: 12, fontWeight: 700 }}>CSV</span>
                    <span style={{ background: '#dcfce7', color: '#15803d', borderRadius: 6, padding: '3px 11px', fontSize: 12, fontWeight: 700 }}>XLSX</span>
                  </div>
                </>
              )}
            </div>
            <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={handleFileInput} />

            {/* Formato esperado */}
            <div style={{ background: '#f8faff', border: '1px solid #e0e7ff', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
              <p style={{ margin: '0 0 10px', fontSize: 11.5, fontWeight: 800, color: '#3730a3', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Columnas requeridas
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'separate', borderSpacing: '0 2px', fontSize: 12, width: '100%' }}>
                  <thead>
                    <tr>
                      {['nombres', 'apellidos', 'rut', 'email', 'rol'].map(h => (
                        <th key={h} style={{ background: '#e0e7ff', color: '#3730a3', padding: '5px 10px', fontWeight: 700, textAlign: 'left', borderRadius: 5 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Luis', 'Soto González', '20469215-7', 'luis@correo.cl', 'administrador'],
                      ['Ana', 'Gutierrez Morales', '11753330-1', 'ana@correo.cl', 'docente'],
                      ['Jorge', 'Vera Fuentes', '17990020-3', 'jorge@correo.cl', 'soporte'],
                    ].map((row, i) => (
                      <tr key={i}>
                        {row.map((c, j) => (
                          <td key={j} style={{ padding: '4px 10px', color: '#374151', fontFamily: 'monospace', fontSize: 11.5, background: i % 2 === 0 ? '#f0f4ff' : '#fff', borderRadius: j === 0 ? '5px 0 0 5px' : j === 4 ? '0 5px 5px 0' : 0 }}>{c}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ margin: '10px 0 0', fontSize: 11, color: '#6b7280' }}>
                Roles válidos: <strong>administrador, directivo, coordinador, docente, asistente, administrativo, soporte</strong>
              </p>
            </div>

            {/* Botón descargar plantilla */}
            <button
              onClick={descargarPlantilla}
              style={{ width: '100%', padding: '10px 0', borderRadius: 10, border: '1.5px solid #1a237e', background: 'transparent', color: '#1a237e', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', letterSpacing: '-0.01em' }}
            >
              ⬇️ Descargar plantilla CSV
            </button>
          </div>
        )}

        {/* ══ Paso 2: Revisar ════════════════════════════════════════════════ */}
        {paso === 2 && (
          <div>
            {/* Resumen */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
              {[
                { n: filasValidas.length,    label: 'Válidos',    icon: '✅', bg: '#f0fdf4', border: '#bbf7d0', color: '#16a34a', dark: '#15803d' },
                { n: filasDuplicadas.length, label: 'Duplicados', icon: '⚠️', bg: '#fefce8', border: '#fef08a', color: '#ca8a04', dark: '#a16207' },
                { n: filasError.length,      label: 'Con errores',icon: '❌', bg: '#fef2f2', border: '#fecaca', color: '#dc2626', dark: '#b91c1c' },
              ].map(({ n, label, icon, bg, border, color, dark }) => (
                <div key={label} style={{ flex: 1, minWidth: 90, background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color }}>{n}</div>
                  <div style={{ fontSize: 11, color: dark, fontWeight: 700 }}>{icon} {label}</div>
                </div>
              ))}
            </div>

            {/* Tabla de revisión */}
            <div style={{ overflowX: 'auto', marginBottom: 16, borderRadius: 10, border: '1px solid #e5e7eb', maxHeight: 380, overflowY: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12.5 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr style={{ background: '#f9fafb' }}>
                    {['#', 'Nombre', 'RUT', 'Email', 'Rol', 'Estado'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filas.map((fila, i) => {
                    const esBg = i % 2 === 0 ? '#fff' : '#f9fafb'
                    const badge = fila.estado === 'valido'
                      ? { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0', label: '✅ Válido' }
                      : fila.estado === 'duplicado'
                      ? { bg: '#fefce8', color: '#ca8a04', border: '#fef08a', label: '⚠️ Duplicado' }
                      : { bg: '#fef2f2', color: '#dc2626', border: '#fecaca', label: '❌ Error' }
                    return (
                      <tr key={i} style={{ background: esBg, borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '7px 10px', color: '#9ca3af', fontWeight: 700, fontSize: 12 }}>{i + 1}</td>
                        <td style={{ padding: '7px 10px', color: '#111827', fontWeight: 500, whiteSpace: 'nowrap' }}>
                          {fila.nombres} {fila.apellidos}
                        </td>
                        <td style={{ padding: '7px 10px', color: '#374151', fontFamily: 'monospace', fontSize: 11.5, whiteSpace: 'nowrap' }}>
                          {fila.rut || <span style={{ color: '#d1d5db' }}>—</span>}
                        </td>
                        <td style={{ padding: '7px 10px', color: '#374151', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {fila.email || <span style={{ color: '#d1d5db' }}>—</span>}
                        </td>
                        <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>
                          {fila.rolInterno
                            ? <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#e0e7ff', color: '#3730a3' }}>{ROL_LABEL_CORTO[fila.rolInterno] ?? fila.rolInterno}</span>
                            : <span style={{ color: '#d1d5db', fontSize: 12 }}>—</span>}
                        </td>
                        <td style={{ padding: '7px 10px', minWidth: 160 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 6, background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, whiteSpace: 'nowrap' }}>
                            {badge.label}
                          </span>
                          {fila.errores.length > 0 && (
                            <div style={{ marginTop: 3, fontSize: 11, color: '#9ca3af', lineHeight: 1.4 }}>
                              {fila.errores.map((e, j) => <div key={j}>· {e}</div>)}
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {filasValidas.length === 0 && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', marginBottom: 14, fontSize: 13, color: '#dc2626', textAlign: 'center' }}>
                No hay usuarios válidos. Corrige los errores en el archivo e intenta de nuevo.
              </div>
            )}

            {filasValidas.length > 0 && (filasDuplicadas.length > 0 || filasError.length > 0) && (
              <div style={{ background: '#fefce8', border: '1px solid #fef08a', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12.5, color: '#713f12' }}>
                ⚠️ Solo se importarán los <strong>{filasValidas.length} usuario{filasValidas.length !== 1 ? 's' : ''} válido{filasValidas.length !== 1 ? 's' : ''}</strong>. Las filas con errores o duplicados serán omitidas.
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setPaso(1); setFilas([]) }} style={btnSecondary}>
                ← Volver
              </button>
              <button
                onClick={handleImportar}
                disabled={filasValidas.length === 0}
                style={btnPrimary(filasValidas.length === 0)}
              >
                Importar {filasValidas.length > 0 ? `${filasValidas.length} ` : ''}usuario{filasValidas.length !== 1 ? 's' : ''} →
              </button>
            </div>
          </div>
        )}

        {/* ══ Paso 3: Resultado / Progreso ══════════════════════════════════ */}
        {paso === 3 && (
          <div>
            {importando ? (
              <div style={{ padding: '16px 0 8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: '#374151' }}>
                    Creando usuarios…
                  </span>
                  <span style={{ fontSize: 13.5, fontWeight: 800, color: '#1a237e' }}>{progreso}%</span>
                </div>
                <div style={{ height: 10, background: '#e5e7eb', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${progreso}%`, background: 'linear-gradient(90deg, #1a237e, #3b82f6)', borderRadius: 99, transition: 'width 0.4s ease' }} />
                </div>
                <p style={{ margin: '12px 0 0', fontSize: 12.5, color: '#9ca3af', textAlign: 'center' }}>
                  Por favor espera. No cierres esta ventana.
                </p>
              </div>
            ) : resultado ? (
              <div>
                {/* Resumen final */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
                  {[
                    { n: resultado.creados,  label: 'Creados',   icon: '✅', bg: '#f0fdf4', border: '#bbf7d0', color: '#16a34a', dark: '#15803d' },
                    { n: resultado.omitidos, label: 'Omitidos',  icon: '⚠️', bg: '#fefce8', border: '#fef08a', color: '#ca8a04', dark: '#a16207' },
                    { n: resultado.errores,  label: 'Con error', icon: '❌', bg: '#fef2f2', border: '#fecaca', color: '#dc2626', dark: '#b91c1c' },
                  ].map(({ n, label, icon, bg, border, color, dark }) => (
                    <div key={label} style={{ flex: 1, minWidth: 90, background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: '12px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 26, fontWeight: 800, color }}>{n}</div>
                      <div style={{ fontSize: 12, color: dark, fontWeight: 700 }}>{icon} {label}</div>
                    </div>
                  ))}
                </div>

                {resultado.creados > 0 && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#15803d', fontWeight: 600 }}>
                    ✅ Se crearon {resultado.creados} usuario{resultado.creados !== 1 ? 's' : ''} exitosamente. Cada uno recibirá un correo con su contraseña temporal y deberá cambiarla al primer ingreso.
                  </div>
                )}

                {/* Detalle por usuario */}
                {resultado.detalles.length > 0 && (
                  <div style={{ borderRadius: 10, border: '1px solid #e5e7eb', maxHeight: 280, overflowY: 'auto', marginBottom: 16 }}>
                    <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12.5 }}>
                      <thead style={{ position: 'sticky', top: 0 }}>
                        <tr style={{ background: '#f9fafb' }}>
                          {['Nombre', 'Email', 'Estado'].map(h => (
                            <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {resultado.detalles.map((d, i) => {
                          const ok = d._resultado === 'creado'
                          return (
                            <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
                              <td style={{ padding: '6px 10px', color: '#111827', fontWeight: 500, whiteSpace: 'nowrap' }}>
                                {d.nombres} {d.apellidos}
                              </td>
                              <td style={{ padding: '6px 10px', color: '#374151', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {d.email}
                              </td>
                              <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: ok ? '#f0fdf4' : '#fef2f2', color: ok ? '#16a34a' : '#dc2626', border: `1px solid ${ok ? '#bbf7d0' : '#fecaca'}` }}>
                                  {ok ? '✅ Creado' : '❌ Error'}
                                </span>
                                {!ok && d._msg && (
                                  <span style={{ marginLeft: 7, fontSize: 11, color: '#9ca3af' }}>{d._msg}</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={onCerrar} style={btnPrimary(false)}>
                    Cerrar
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
