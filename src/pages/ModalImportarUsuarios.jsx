// src/pages/ModalImportarUsuarios.jsx
import { useState, useRef, useCallback } from 'react'
import { supabase } from '../supabase'
import * as XLSX from 'xlsx'

// ── Mapeo de roles ────────────────────────────────────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────────────────────────
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
  return rut.replace(/[^0-9]/g, '').slice(0, 4)
}

// ── Descarga plantilla CSV ────────────────────────────────────────────────────
function descargarPlantilla() {
  const filas = [
    ['nombres', 'apellidos', 'rut', 'email', 'rol'],
    ['Luis', 'Soto González', '20469215-7', 'luis@correo.cl', 'administrador'],
    ['Ana', 'Gutierrez Morales', '11753330-1', 'ana@correo.cl', 'docente'],
    ['Jorge', 'Vera Fuentes', '17990020-3', 'jorge@correo.cl', 'soporte'],
  ]
  const csv = filas.map(r => r.join(';')).join('\r\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'plantilla_usuarios.csv'; a.click()
  URL.revokeObjectURL(url)
}

// ── Descarga CSV de credenciales ─────────────────────────────────────────────
function descargarCredenciales(creds) {
  const cabecera = ['nombre', 'email', 'rut', 'rol', 'password_temporal']
  const filas = creds.map(c => [c.nombre, c.email, c.rut, c.rol, c.password_temporal])
  const csv = [cabecera, ...filas].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `credenciales_usuarios_${new Date().toISOString().slice(0,10)}.csv`; a.click()
  URL.revokeObjectURL(url)
}

// ── Badges de estado ──────────────────────────────────────────────────────────
const BADGE = {
  nuevo:          { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0', label: '✅ Nuevo usuario' },
  existente:      { bg: '#fefce8', color: '#ca8a04', border: '#fef08a', label: '⚠️ Usuario ya existente' },
  rut_detectado:  { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe', label: '🔗 RUT existente detectado' },
  error:          { bg: '#fef2f2', color: '#dc2626', border: '#fecaca', label: '❌ Error de validación' },
}

// ── Componente ────────────────────────────────────────────────────────────────
export default function ModalImportarUsuarios({ onCerrar, onImportado }) {
  const [paso, setPaso]           = useState(1)
  const [drag, setDrag]           = useState(false)
  const [parseando, setParseando] = useState(false)
  const [archivoNombre, setArchivoNombre] = useState('')
  const [filas, setFilas]         = useState([])
  const [enviarCorreo, setEnviarCorreo] = useState(false)
  const [importando, setImportando] = useState(false)
  const [progreso, setProgreso]   = useState(0)
  const [resultado, setResultado] = useState(null)
  const [credenciales, setCredenciales] = useState([]) // para descarga CSV
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
        idx:       i,
        nombres:   col.nombres   >= 0 ? String(row[col.nombres]   ?? '').trim() : '',
        apellidos: col.apellidos >= 0 ? String(row[col.apellidos] ?? '').trim() : '',
        rut:       col.rut       >= 0 ? String(row[col.rut]       ?? '').trim() : '',
        email:     col.email     >= 0 ? String(row[col.email]     ?? '').trim().toLowerCase() : '',
        rol:       col.rol       >= 0 ? String(row[col.rol]       ?? '').trim().toLowerCase() : '',
      }))

      // Detectar emails duplicados dentro del archivo (solo el primero es válido)
      const emailPrimero = {}
      parsed.forEach(r => {
        if (r.email && emailPrimero[r.email] === undefined) emailPrimero[r.email] = r.idx
      })

      // Obtener TODOS los usuarios de la BD para comparar email y RUT
      const { data: todosUsuarios } = await supabase
        .from('usuarios').select('id, nombre, email, rut')

      const emailAUser = new Map()  // email → usuario
      const rutAUsers  = new Map()  // rutKey → [usuarios]
      ;(todosUsuarios ?? []).forEach(u => {
        if (u.email) emailAUser.set(u.email.toLowerCase(), u)
        if (u.rut) {
          const k = rutKey(u.rut)
          if (!rutAUsers.has(k)) rutAUsers.set(k, [])
          rutAUsers.get(k).push(u)
        }
      })

      // Validar fila a fila
      const validated = parsed.map(row => {
        const errores = []

        // Campos requeridos y formato
        if (!row.nombres)   errores.push('Nombres requerido')
        if (!row.apellidos) errores.push('Apellidos requerido')
        if (!row.rut)       errores.push('RUT requerido')
        else if (!validarRut(row.rut)) errores.push('RUT inválido')
        if (!row.email)     errores.push('Email requerido')
        else if (!validarEmail(row.email)) errores.push('Email con formato inválido')
        if (!row.rol)       errores.push('Rol requerido')
        else if (!ROLES_MAP[row.rol]) errores.push(`Rol "${row.rol}" no reconocido`)

        // Email duplicado dentro del archivo
        if (!errores.length && row.email && emailPrimero[row.email] !== row.idx) {
          errores.push('Email duplicado en el archivo')
        }

        if (errores.length) {
          return { ...row, rut: row.rut ? normalizarRut(row.rut) : '', rolInterno: ROLES_MAP[row.rol] ?? '', estado: 'error', errores, rutExistentes: null, decision: null }
        }

        const rutNorm    = normalizarRut(row.rut)
        const rutK       = rutKey(row.rut)
        const emailMatch = emailAUser.get(row.email)
        const rutMatches = rutAUsers.get(rutK) ?? []

        let estado = 'nuevo'
        let rutExistentes = null
        let decision = null

        if (emailMatch) {
          // El email ya está en la BD
          const mismoRut = rutMatches.some(u => u.id === emailMatch.id)
          if (mismoRut) {
            // Mismo email y mismo RUT → ya existe exactamente esta cuenta
            estado = 'existente'
          } else {
            // Email tomado por alguien con diferente RUT → error
            errores.push('Email ya registrado con un RUT diferente')
            estado = 'error'
          }
        } else if (rutMatches.length > 0) {
          // RUT existe en la BD pero con otro email → detectado
          estado = 'rut_detectado'
          rutExistentes = rutMatches
          decision = 'omitir'
        }
        // else: completamente nuevo

        return {
          ...row,
          rut: rutNorm,
          rolInterno: ROLES_MAP[row.rol] ?? '',
          estado,
          errores,
          rutExistentes,
          decision,
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

  function setDecision(rowIdx, decision) {
    setFilas(prev => prev.map(f => f.idx === rowIdx ? { ...f, decision } : f))
  }

  // Grupos de filas
  const filasNuevas       = filas.filter(f => f.estado === 'nuevo')
  const filasRutDetectado = filas.filter(f => f.estado === 'rut_detectado')
  const filasExistentes   = filas.filter(f => f.estado === 'existente')
  const filasError        = filas.filter(f => f.estado === 'error')

  const filasAImportar = [
    ...filasNuevas,
    ...filasRutDetectado.filter(f => f.decision === 'vincular' || f.decision === 'actualizar_correo'),
  ]

  // ── Importar ────────────────────────────────────────────────────────────────
  async function handleImportar() {
    if (!filasAImportar.length) return
    setPaso(3)
    setImportando(true)
    setProgreso(0)

    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token

    const detalles = []
    const creds = []
    let creados = 0, actualizados = 0, erroresCreacion = 0

    for (let i = 0; i < filasAImportar.length; i++) {
      const fila = filasAImportar[i]

      try {
        if (fila.estado === 'nuevo' || fila.decision === 'vincular') {
          const pass = passwordDesdeRut(fila.rut)
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
                passwordOverride: pass,
                skipEmail:        !enviarCorreo,
              }),
            }
          )
          const json = await res.json()
          if (!res.ok) {
            erroresCreacion++
            detalles.push({ ...fila, _resultado: 'error', _msg: json.error ?? 'Error desconocido' })
          } else {
            creados++
            const etiqueta = fila.decision === 'vincular' ? '🔗 Vinculado' : '✅ Creado'
            const emailMsg = enviarCorreo
              ? (json.emailEnviado ? ', email enviado' : ', email fallido')
              : ''
            detalles.push({ ...fila, _resultado: 'creado', _msg: `${etiqueta}${emailMsg}`, _emailEnviado: json.emailEnviado })
            creds.push({
              nombre: `${fila.nombres} ${fila.apellidos}`.trim(),
              email:  fila.email,
              rut:    fila.rut,
              rol:    fila.rolInterno,
              password_temporal: pass,
            })
          }

        } else if (fila.decision === 'actualizar_correo') {
          // Actualizar email del usuario existente (tabla + Auth)
          const existente = fila.rutExistentes[0]

          // 1. Actualizar tabla usuarios
          const { error: tablaError } = await supabase
            .from('usuarios')
            .update({ email: fila.email })
            .eq('id', existente.id)

          if (tablaError) {
            erroresCreacion++
            detalles.push({ ...fila, _resultado: 'error', _msg: `Error al actualizar tabla: ${tablaError.message}` })
            setProgreso(Math.round(((i + 1) / filasAImportar.length) * 100))
            continue
          }

          // 2. Actualizar email en Supabase Auth
          const authRes = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/editar-usuario`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ userId: existente.id, email: fila.email }),
            }
          )
          const authJson = await authRes.json()
          if (!authRes.ok) {
            actualizados++
            detalles.push({ ...fila, _resultado: 'advertencia', _msg: `Perfil actualizado, pero error en Auth: ${authJson.error}` })
          } else {
            actualizados++
            detalles.push({ ...fila, _resultado: 'actualizado', _msg: `Correo actualizado de ${existente.email} → ${fila.email}` })
          }
        }
      } catch {
        erroresCreacion++
        detalles.push({ ...fila, _resultado: 'error', _msg: 'Error de conexión' })
      }

      setProgreso(Math.round(((i + 1) / filasAImportar.length) * 100))
    }

    const emailsEnviados = detalles.filter(d => d._emailEnviado).length
    const emailsFallidos = enviarCorreo ? detalles.filter(d => d._resultado === 'creado' && !d._emailEnviado).length : 0

    setCredenciales(creds)
    setResultado({
      creados,
      actualizados,
      omitidos: filasExistentes.length + filasRutDetectado.filter(f => f.decision === 'omitir').length,
      errores: erroresCreacion,
      emailsEnviados,
      emailsFallidos,
      detalles,
    })
    setImportando(false)
    if (creados + actualizados > 0) onImportado?.()
  }

  // ── Estilos base ─────────────────────────────────────────────────────────
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
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(5,12,55,0.65)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, animation: 'fadeIn 0.15s ease' }}
      onClick={importando ? undefined : onCerrar}
    >
      <div
        style={{ background: '#fff', borderRadius: 14, padding: '28px 28px 24px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', border: '1px solid #e5e7eb', animation: 'slideUp 0.18s ease', width: '95%', maxWidth: paso === 2 ? 860 : 540, maxHeight: '92vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >

        {/* Encabezado */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>📥 Importar usuarios</p>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: '#6b7280' }}>
              {paso === 1 ? 'Sube un archivo CSV o XLSX con los datos'
                : paso === 2 ? 'Revisa y configura cada fila antes de importar'
                : 'Resultado de la importación'}
            </p>
          </div>
          {!importando && (
            <button onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 22, lineHeight: 1, padding: '0 0 0 12px', marginTop: -2 }}>×</button>
          )}
        </div>

        {/* Stepper */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
          {['Subir archivo', 'Revisar datos', 'Resultado'].map((label, i) => {
            const n = i + 1; const active = paso === n; const done = paso > n
            return (
              <div key={n} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, background: done ? '#16a34a' : active ? '#1a237e' : '#e5e7eb', color: done || active ? '#fff' : '#9ca3af' }}>
                    {done ? '✓' : n}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: active ? 700 : 500, color: active ? '#1a237e' : done ? '#16a34a' : '#9ca3af', whiteSpace: 'nowrap' }}>{label}</span>
                </div>
                {i < 2 && <div style={{ flex: 1, height: 1, background: '#e5e7eb', margin: '0 10px' }} />}
              </div>
            )
          })}
        </div>

        {/* ══ Paso 1: Subir ═════════════════════════════════════════════════ */}
        {paso === 1 && (
          <div>
            <div
              onDragOver={e => { e.preventDefault(); setDrag(true) }}
              onDragLeave={() => setDrag(false)}
              onDrop={handleDrop}
              onClick={() => !parseando && inputRef.current?.click()}
              style={{ border: `2px dashed ${drag ? '#1a237e' : '#d1d5db'}`, borderRadius: 12, padding: '38px 24px', textAlign: 'center', cursor: parseando ? 'default' : 'pointer', background: drag ? '#eef2ff' : '#f9fafb', transition: 'all 0.15s', marginBottom: 16 }}
            >
              {parseando ? (
                <div>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>⏳</div>
                  <p style={{ margin: 0, fontSize: 14, color: '#6b7280', fontWeight: 600 }}>Procesando {archivoNombre}…</p>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 38, marginBottom: 10 }}>📂</div>
                  <p style={{ margin: '0 0 5px', fontWeight: 700, color: '#374151', fontSize: 14.5 }}>Arrastra tu archivo aquí</p>
                  <p style={{ margin: '0 0 14px', fontSize: 13, color: '#9ca3af' }}>o haz clic para seleccionar</p>
                  <div style={{ display: 'inline-flex', gap: 8 }}>
                    <span style={{ background: '#e0e7ff', color: '#3730a3', borderRadius: 6, padding: '3px 11px', fontSize: 12, fontWeight: 700 }}>CSV</span>
                    <span style={{ background: '#dcfce7', color: '#15803d', borderRadius: 6, padding: '3px 11px', fontSize: 12, fontWeight: 700 }}>XLSX</span>
                  </div>
                </>
              )}
            </div>
            <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={handleFileInput} />

            <div style={{ background: '#f8faff', border: '1px solid #e0e7ff', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
              <p style={{ margin: '0 0 10px', fontSize: 11.5, fontWeight: 800, color: '#3730a3', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Columnas requeridas</p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'separate', borderSpacing: '0 2px', fontSize: 12, width: '100%' }}>
                  <thead>
                    <tr>{['nombres', 'apellidos', 'rut', 'email', 'rol'].map(h => (
                      <th key={h} style={{ background: '#e0e7ff', color: '#3730a3', padding: '5px 10px', fontWeight: 700, textAlign: 'left', borderRadius: 5 }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {[
                      ['Luis', 'Soto González', '20469215-7', 'luis@correo.cl', 'administrador'],
                      ['Ana', 'Gutierrez Morales', '11753330-1', 'ana@correo.cl', 'docente'],
                    ].map((row, i) => (
                      <tr key={i}>{row.map((c, j) => (
                        <td key={j} style={{ padding: '4px 10px', color: '#374151', fontFamily: 'monospace', fontSize: 11.5, background: i % 2 === 0 ? '#f0f4ff' : '#fff', borderRadius: j === 0 ? '5px 0 0 5px' : j === 4 ? '0 5px 5px 0' : 0 }}>{c}</td>
                      ))}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ margin: '10px 0 0', fontSize: 11, color: '#6b7280' }}>
                Roles válidos: <strong>administrador, directivo, coordinador, docente, asistente, administrativo, soporte</strong>
              </p>
            </div>

            <button onClick={descargarPlantilla} style={{ width: '100%', padding: '10px 0', borderRadius: 10, border: '1.5px solid #1a237e', background: 'transparent', color: '#1a237e', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
              ⬇️ Descargar plantilla CSV
            </button>
          </div>
        )}

        {/* ══ Paso 2: Revisar ═══════════════════════════════════════════════ */}
        {paso === 2 && (
          <div>
            {/* Resumen */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
              {[
                { n: filasNuevas.length,       label: 'Nuevos',    ...BADGE.nuevo },
                { n: filasRutDetectado.length, label: 'RUT exist.', ...BADGE.rut_detectado },
                { n: filasExistentes.length,   label: 'Ya existen', ...BADGE.existente },
                { n: filasError.length,        label: 'Con errores',...BADGE.error },
              ].map(({ n, label, bg, border, color }) => (
                <div key={label} style={{ flex: 1, minWidth: 80, background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: '9px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color }}>{n}</div>
                  <div style={{ fontSize: 11, color, fontWeight: 700, opacity: 0.85 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Tabla */}
            <div style={{ borderRadius: 10, border: '1px solid #e5e7eb', maxHeight: 420, overflowY: 'auto', marginBottom: 14 }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12.5 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr style={{ background: '#f9fafb' }}>
                    {['#', 'Nombre', 'RUT', 'Email', 'Rol', 'Estado / Acción'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filas.map((fila, i) => {
                    const badge = BADGE[fila.estado]
                    return (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa', borderBottom: '1px solid #f3f4f6', verticalAlign: 'top' }}>
                        <td style={{ padding: '8px 10px', color: '#9ca3af', fontWeight: 700, fontSize: 12 }}>{i + 1}</td>
                        <td style={{ padding: '8px 10px', color: '#111827', fontWeight: 500, whiteSpace: 'nowrap' }}>{fila.nombres} {fila.apellidos}</td>
                        <td style={{ padding: '8px 10px', color: '#374151', fontFamily: 'monospace', fontSize: 11.5, whiteSpace: 'nowrap' }}>{fila.rut || '—'}</td>
                        <td style={{ padding: '8px 10px', color: '#374151', maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fila.email || '—'}</td>
                        <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                          {fila.rolInterno
                            ? <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#e0e7ff', color: '#3730a3' }}>{ROL_LABEL_CORTO[fila.rolInterno] ?? fila.rolInterno}</span>
                            : <span style={{ color: '#d1d5db' }}>—</span>}
                        </td>
                        <td style={{ padding: '8px 10px', minWidth: 200 }}>
                          {/* Badge */}
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 6, background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, display: 'inline-block', marginBottom: fila.estado === 'rut_detectado' || fila.errores?.length ? 6 : 0 }}>
                            {badge.label}
                          </span>

                          {/* Errores */}
                          {fila.errores?.length > 0 && (
                            <div style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.5, marginTop: 2 }}>
                              {fila.errores.map((e, j) => <div key={j}>· {e}</div>)}
                            </div>
                          )}

                          {/* Acciones para RUT detectado */}
                          {fila.estado === 'rut_detectado' && (
                            <div style={{ marginTop: 8 }}>
                              {/* Info cuenta existente */}
                              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 7, padding: '6px 9px', marginBottom: 8, fontSize: 11.5, color: '#1e40af' }}>
                                <div style={{ fontWeight: 700, marginBottom: 2 }}>Cuenta existente con este RUT:</div>
                                {fila.rutExistentes.slice(0, 3).map((u, j) => (
                                  <div key={j} style={{ color: '#374151' }}>
                                    {u.nombre} · <span style={{ fontFamily: 'monospace' }}>{u.email}</span>
                                  </div>
                                ))}
                                {fila.rutExistentes.length > 3 && (
                                  <div style={{ color: '#6b7280' }}>…y {fila.rutExistentes.length - 3} más</div>
                                )}
                              </div>

                              {/* Botones de acción */}
                              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                {[
                                  { key: 'omitir',           label: 'Omitir',             title: 'No importar esta fila', style: { background: fila.decision === 'omitir' ? '#f3f4f6' : '#fff', color: '#374151', border: `1.5px solid ${fila.decision === 'omitir' ? '#9ca3af' : '#e5e7eb'}`, fontWeight: fila.decision === 'omitir' ? 700 : 600 } },
                                  { key: 'vincular',         label: '🔗 Vincular',         title: 'Crear nueva cuenta con el mismo RUT', style: { background: fila.decision === 'vincular' ? '#eff6ff' : '#fff', color: '#1d4ed8', border: `1.5px solid ${fila.decision === 'vincular' ? '#93c5fd' : '#bfdbfe'}`, fontWeight: fila.decision === 'vincular' ? 700 : 600 } },
                                  { key: 'actualizar_correo', label: '✏️ Actualizar correo', title: `Actualizar el correo de ${fila.rutExistentes[0]?.nombre} a ${fila.email}`, style: { background: fila.decision === 'actualizar_correo' ? '#f0fdf4' : '#fff', color: '#15803d', border: `1.5px solid ${fila.decision === 'actualizar_correo' ? '#86efac' : '#bbf7d0'}`, fontWeight: fila.decision === 'actualizar_correo' ? 700 : 600 } },
                                ].map(btn => (
                                  <button
                                    key={btn.key}
                                    onClick={() => setDecision(fila.idx, btn.key)}
                                    title={btn.title}
                                    style={{ padding: '4px 10px', borderRadius: 7, fontSize: 11, cursor: 'pointer', ...btn.style, transition: 'all 0.12s' }}
                                  >
                                    {btn.label}
                                  </button>
                                ))}
                              </div>

                              {fila.decision === 'actualizar_correo' && (
                                <div style={{ marginTop: 6, fontSize: 11, color: '#15803d', background: '#f0fdf4', borderRadius: 6, padding: '4px 8px' }}>
                                  Se actualizará: <strong>{fila.rutExistentes[0]?.email}</strong> → <strong>{fila.email}</strong>
                                </div>
                              )}
                              {fila.decision === 'vincular' && (
                                <div style={{ marginTop: 6, fontSize: 11, color: '#1d4ed8', background: '#eff6ff', borderRadius: 6, padding: '4px 8px' }}>
                                  Se creará una nueva cuenta vinculada al RUT {fila.rut}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Info de "ya existente" */}
                          {fila.estado === 'existente' && (
                            <div style={{ marginTop: 4, fontSize: 11, color: '#9ca3af' }}>
                              Esta combinación email + RUT ya está registrada. Se omitirá.
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Checkbox envío de correo */}
            <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 16px', marginBottom: 14 }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={enviarCorreo}
                  onChange={e => setEnviarCorreo(e.target.checked)}
                  style={{ marginTop: 2, width: 15, height: 15, flexShrink: 0, accentColor: '#1a237e', cursor: 'pointer' }}
                />
                <div>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: '#111827' }}>
                    Enviar credenciales por correo al crear usuarios
                  </span>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 3 }}>
                    ⚠️ Enviar correos puede consumir la cuota gratuita del servicio de email.
                    {!enviarCorreo && <span style={{ color: '#1a237e', fontWeight: 600 }}> Si no marcas esta opción, se descargará un CSV con las credenciales generadas.</span>}
                  </div>
                </div>
              </label>
            </div>

            {filasAImportar.length === 0 && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', marginBottom: 14, fontSize: 13, color: '#dc2626', textAlign: 'center' }}>
                No hay filas listas para importar. Revisa los errores o selecciona una acción para los RUTs detectados.
              </div>
            )}

            {filasAImportar.length > 0 && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#15803d' }}>
                Se procesarán <strong>{filasAImportar.length} fila{filasAImportar.length !== 1 ? 's' : ''}</strong>
                {filasNuevas.length > 0 && ` · ${filasNuevas.length} nuevos`}
                {filasRutDetectado.filter(f => f.decision === 'vincular').length > 0 && ` · ${filasRutDetectado.filter(f => f.decision === 'vincular').length} vinculados`}
                {filasRutDetectado.filter(f => f.decision === 'actualizar_correo').length > 0 && ` · ${filasRutDetectado.filter(f => f.decision === 'actualizar_correo').length} correos a actualizar`}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setPaso(1); setFilas([]) }} style={btnSecondary}>← Volver</button>
              <button onClick={handleImportar} disabled={filasAImportar.length === 0} style={btnPrimary(filasAImportar.length === 0)}>
                Procesar {filasAImportar.length > 0 ? filasAImportar.length : ''} →
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
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: '#374151' }}>Procesando usuarios…</span>
                  <span style={{ fontSize: 13.5, fontWeight: 800, color: '#1a237e' }}>{progreso}%</span>
                </div>
                <div style={{ height: 10, background: '#e5e7eb', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${progreso}%`, background: 'linear-gradient(90deg, #1a237e, #3b82f6)', borderRadius: 99, transition: 'width 0.4s ease' }} />
                </div>
                <p style={{ margin: '12px 0 0', fontSize: 12.5, color: '#9ca3af', textAlign: 'center' }}>Por favor espera. No cierres esta ventana.</p>
              </div>
            ) : resultado ? (
              <div>
                {/* Resumen */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
                  {[
                    { n: resultado.creados,      label: 'Creados',    bg: '#f0fdf4', border: '#bbf7d0', color: '#16a34a' },
                    { n: resultado.actualizados, label: 'Actualizados',bg: '#eff6ff', border: '#bfdbfe', color: '#2563eb' },
                    { n: resultado.omitidos,     label: 'Omitidos',   bg: '#fefce8', border: '#fef08a', color: '#ca8a04' },
                    { n: resultado.errores,      label: 'Con error',  bg: '#fef2f2', border: '#fecaca', color: '#dc2626' },
                  ].map(({ n, label, bg, border, color }) => (
                    <div key={label} style={{ flex: 1, minWidth: 80, background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: '12px 10px', textAlign: 'center' }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color }}>{n}</div>
                      <div style={{ fontSize: 11, color, fontWeight: 700, opacity: 0.85 }}>{label}</div>
                    </div>
                  ))}
                </div>

                {(resultado.creados + resultado.actualizados) > 0 && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#15803d', fontWeight: 600 }}>
                    ✅ Proceso completado. La contraseña temporal es los primeros 4 dígitos del RUT. Al primer ingreso deberán cambiarla.
                  </div>
                )}

                {/* Contadores de email (si se activó envío) */}
                {enviarCorreo && resultado.creados > 0 && (
                  <div style={{ background: '#f8faff', border: '1px solid #e0e7ff', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12.5, color: '#374151' }}>
                    <span style={{ fontWeight: 700, color: '#1a237e' }}>Correos: </span>
                    <span style={{ color: '#16a34a', fontWeight: 600 }}>✅ {resultado.emailsEnviados} enviados</span>
                    {resultado.emailsFallidos > 0 && <span style={{ color: '#dc2626', fontWeight: 600, marginLeft: 12 }}>❌ {resultado.emailsFallidos} fallidos</span>}
                    {resultado.omitidos > 0 && <span style={{ color: '#9ca3af', marginLeft: 12 }}>— {resultado.omitidos} omitidos</span>}
                  </div>
                )}

                {/* Descarga CSV de credenciales (si no se enviaron correos) */}
                {!enviarCorreo && credenciales.length > 0 && (
                  <button
                    onClick={() => descargarCredenciales(credenciales)}
                    style={{ width: '100%', padding: '11px 0', borderRadius: 10, border: '1.5px solid #1a237e', background: '#f0f4ff', color: '#1a237e', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', marginBottom: 14 }}
                  >
                    ⬇️ Descargar CSV con credenciales ({credenciales.length} usuarios)
                  </button>
                )}

                {/* Detalle */}
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
                          const ok = d._resultado === 'creado' || d._resultado === 'actualizado'
                          const warn = d._resultado === 'advertencia'
                          const badgeStyle = ok ? { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' }
                            : warn ? { bg: '#fefce8', color: '#ca8a04', border: '#fef08a' }
                            : { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' }
                          return (
                            <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
                              <td style={{ padding: '6px 10px', color: '#111827', fontWeight: 500, whiteSpace: 'nowrap' }}>{d.nombres} {d.apellidos}</td>
                              <td style={{ padding: '6px 10px', color: '#374151', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.email}</td>
                              <td style={{ padding: '6px 10px' }}>
                                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: badgeStyle.bg, color: badgeStyle.color, border: `1px solid ${badgeStyle.border}`, whiteSpace: 'nowrap' }}>
                                  {ok ? (d._resultado === 'actualizado' ? '✏️ Actualizado' : '✅ Creado') : warn ? '⚠️ Parcial' : '❌ Error'}
                                </span>
                                {d._msg && <span style={{ marginLeft: 7, fontSize: 11, color: '#6b7280' }}>{d._msg}</span>}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={onCerrar} style={btnPrimary(false)}>Cerrar</button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
