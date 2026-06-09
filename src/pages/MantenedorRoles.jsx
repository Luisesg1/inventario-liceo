// src/pages/MantenedorRoles.jsx
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'

// ── Permisos y grupos (mismos que Usuarios.jsx) ────────────────────────────
const ACCIONES = [
  { key: 'ver_inventario',       label: 'Ver inventario',        desc: 'Permite visualizar todos los bienes registrados.' },
  { key: 'agregar_bien',         label: 'Agregar bien',          desc: 'Permite registrar nuevos bienes en el inventario.' },
  { key: 'editar_bien',          label: 'Editar bien',           desc: 'Permite modificar la información de bienes ya registrados.' },
  { key: 'eliminar_bien',        label: 'Eliminar bien',         desc: 'Permite eliminar bienes individuales del inventario.' },
  { key: 'eliminar_lote',        label: 'Eliminar en lote',      desc: 'Permite eliminar múltiples bienes al mismo tiempo.' },
  { key: 'gestionar_categorias', label: 'Gestionar categorías',  desc: 'Permite crear, editar y eliminar categorías de bienes.' },
  { key: 'importar_csv',         label: 'Importar CSV',          desc: 'Permite cargar bienes en masa desde un archivo CSV.' },
  { key: 'exportar',             label: 'Exportar inventario',   desc: 'Permite exportar el inventario completo a Excel o PDF.' },
  { key: 'registrar_prestamo',   label: 'Registrar préstamo',    desc: 'Permite registrar el préstamo de un bien.' },
  { key: 'registrar_incidencia', label: 'Registrar incidencia',  desc: 'Permite reportar fallas o daños en bienes.' },
  { key: 'ver_auditoria_inventario', label: 'Ver auditoría',     desc: 'Permite ver el historial de cambios en inventario.' },
  { key: 'ver_campos',           label: 'Ver campos inventario', desc: 'Permite acceder a la sección de campos inventario.' },
  { key: 'agregar_campo',        label: 'Agregar campos',        desc: 'Permite agregar nuevos campos personalizados.' },
  { key: 'editar_campo',         label: 'Editar campos',         desc: 'Permite renombrar y modificar campos existentes.' },
  { key: 'ocultar_campo',        label: 'Ocultar / mostrar campos', desc: 'Permite activar o desactivar visibilidad de campos.' },
  { key: 'eliminar_campo',       label: 'Eliminar campos',       desc: 'Permite eliminar campos personalizados.' },
  { key: 'reordenar_campos',     label: 'Reordenar campos',      desc: 'Permite cambiar el orden de los campos.' },
  { key: 'gestionar_campos_base',label: 'Gestionar campos base protegidos', desc: 'Permite editar campos protegidos del sistema.' },
  { key: 'ver_tickets',          label: 'Ver tickets propios',   desc: 'Permite ver los tickets creados por el usuario.' },
  { key: 'crear_ticket',         label: 'Crear nuevo ticket',    desc: 'Permite abrir solicitudes de soporte técnico.' },
  { key: 'editar_ticket',        label: 'Editar ticket propio',  desc: 'Permite editar un ticket propio mientras está abierto.' },
  { key: 'gestionar_tickets',    label: 'Gestionar todos los tickets', desc: 'Permite ver, responder y cambiar estado de cualquier ticket.' },
  { key: 'eliminar_ticket',      label: 'Eliminar tickets',      desc: 'Permite eliminar tickets del sistema.' },
  { key: 'ver_alertas_tickets',  label: 'Ver alertas de tickets', desc: 'Muestra banner de alertas con tickets abiertos.' },
  { key: 'exportar_tickets',     label: 'Exportar tickets',      desc: 'Permite exportar el listado de tickets.' },
  { key: 'ver_requerimientos',           label: 'Ver requerimientos',      desc: 'Permite consultar solicitudes de compra.' },
  { key: 'crear_requerimiento',          label: 'Crear requerimiento',     desc: 'Permite ingresar nuevas solicitudes de compra.' },
  { key: 'editar_requerimiento',         label: 'Editar requerimiento',    desc: 'Permite modificar requerimientos ya registrados.' },
  { key: 'eliminar_requerimiento',       label: 'Eliminar requerimiento',  desc: 'Permite eliminar requerimientos del sistema.' },
  { key: 'importar_requerimientos',      label: 'Importar requerimientos', desc: 'Permite cargar requerimientos en masa.' },
  { key: 'exportar_requerimientos',      label: 'Exportar requerimientos', desc: 'Permite exportar requerimientos.' },
  { key: 'ver_auditoria_requerimientos', label: 'Ver auditoría de compras', desc: 'Permite ver el historial de requerimientos.' },
  { key: 'ver_propias_ausencias', label: 'Ver propias ausencias',        desc: 'Permite ver el propio registro de ausencias.' },
  { key: 'ver_ausencias',         label: 'Ver ausencias del personal',   desc: 'Permite consultar ausencias de todo el personal.' },
  { key: 'crear_ausencias',       label: 'Registrar ausencias',          desc: 'Permite ingresar nuevas ausencias.' },
  { key: 'editar_ausencias',      label: 'Editar ausencias',             desc: 'Permite modificar ausencias ya registradas.' },
  { key: 'eliminar_ausencias',    label: 'Eliminar ausencias',           desc: 'Permite eliminar registros de ausencias.' },
  { key: 'aprobar_ausencias',     label: 'Aprobar / rechazar ausencias', desc: 'Permite cambiar estado de una ausencia.' },
  { key: 'exportar_ausencias',    label: 'Exportar ausencias',           desc: 'Permite exportar el registro de ausencias.' },
  { key: 'ver_auditoria_permisos',label: 'Ver auditoría de ausencias',   desc: 'Permite ver el historial de cambios en ausencias.' },
  { key: 'ver_compensatorios',       label: 'Ver días compensatorios',      desc: 'Permite consultar el registro de días compensatorios.' },
  { key: 'crear_compensatorios',     label: 'Registrar compensatorios',     desc: 'Permite ingresar nuevos días compensatorios.' },
  { key: 'editar_compensatorios',    label: 'Editar compensatorios',        desc: 'Permite modificar compensatorios ya registrados.' },
  { key: 'eliminar_compensatorios',  label: 'Eliminar compensatorios',      desc: 'Permite eliminar registros de compensatorios.' },
  { key: 'exportar_compensatorios',  label: 'Exportar compensatorios',      desc: 'Permite exportar el registro de compensatorios.' },
  { key: 'ver_auditoria_compensatorios', label: 'Ver auditoría de compensatorios', desc: 'Permite ver el historial de compensatorios.' },
  { key: 'invitar_usuario',            label: 'Invitar usuarios',              desc: 'Permite enviar invitaciones a nuevos usuarios.' },
  { key: 'editar_usuario',             label: 'Editar usuarios',               desc: 'Permite modificar datos, rol y permisos de usuarios.' },
  { key: 'eliminar_usuario',           label: 'Eliminar usuarios',             desc: 'Permite dar de baja cuentas de usuario.' },
  { key: 'notificar_ausencia_correo',  label: 'Notificar ausencia por correo', desc: 'Permite enviar notificaciones al registrar ausencias.' },
  { key: 'gestionar_ajustes',          label: 'Personalizar sistema',          desc: 'Permite acceder a la configuración visual del sistema.' },
  { key: 'ver_ajustes',                label: 'Ver ajustes',                   desc: 'Permite acceder y visualizar la sección de Ajustes.' },
  { key: 'gestionar_usuarios',         label: 'Gestionar usuarios',            desc: 'Permite ver y administrar la lista completa de usuarios.' },
  { key: 'editar_roles_permisos',      label: 'Editar roles/permisos',         desc: 'Permite modificar roles y permisos de usuarios.' },
  { key: 'guardar_cambios_ajustes',    label: 'Guardar cambios de ajustes',    desc: 'Permite guardar cambios en la configuración general.' },
  { key: 'gestionar_roles',            label: 'Gestionar roles del sistema',   desc: 'Permite administrar los permisos predeterminados de cada rol.' },
]

const GRUPOS = [
  { key: 'inventario',        label: 'Inventario',        icon: '📦',
    permisos: ['ver_inventario','agregar_bien','editar_bien','eliminar_bien','eliminar_lote','gestionar_categorias','importar_csv','exportar','registrar_prestamo','registrar_incidencia','ver_auditoria_inventario'] },
  { key: 'campos',            label: 'Campos inventario', icon: '🔧',
    permisos: ['ver_campos','agregar_campo','editar_campo','ocultar_campo','eliminar_campo','reordenar_campos','gestionar_campos_base'] },
  { key: 'tickets',           label: 'Tickets',           icon: '🎫',
    permisos: ['ver_tickets','crear_ticket','editar_ticket','gestionar_tickets','eliminar_ticket','ver_alertas_tickets','exportar_tickets'] },
  { key: 'requerimientos',    label: 'Requerimientos',    icon: '🛒',
    permisos: ['ver_requerimientos','crear_requerimiento','editar_requerimiento','eliminar_requerimiento','importar_requerimientos','exportar_requerimientos','ver_auditoria_requerimientos'] },
  { key: 'ausencias',         label: 'Ausencias',         icon: '📅',
    permisos: ['ver_propias_ausencias','ver_ausencias','crear_ausencias','editar_ausencias','eliminar_ausencias','aprobar_ausencias','exportar_ausencias','ver_auditoria_permisos'] },
  { key: 'compensatorios',    label: 'Compensatorios',    icon: '🗓️',
    permisos: ['ver_compensatorios','crear_compensatorios','editar_compensatorios','eliminar_compensatorios','exportar_compensatorios','ver_auditoria_compensatorios'] },
  { key: 'ajustes',           label: 'Ajustes y usuarios', icon: '⚙️',
    permisos: ['ver_ajustes','gestionar_ajustes','guardar_cambios_ajustes','gestionar_usuarios','invitar_usuario','editar_usuario','eliminar_usuario','notificar_ausencia_correo','editar_roles_permisos','gestionar_roles'] },
]

const PERMISOS_VACIO = Object.fromEntries(ACCIONES.map(a => [a.key, false]))

const ROL_LABEL = {
  admin: 'Administrador', directivo: 'Directivo', coordinador: 'Coordinador',
  docente: 'Docente', asistente: 'Asistente de la educación',
  administrativo: 'Administrativo', soporte: 'Soporte técnico',
  visor_requerimientos: 'Visor requerimientos',
}

const ROL_COLORES = {
  admin:          { bg: '#e8eaf6', color: '#1a237e', dot: '#1a237e' },
  directivo:      { bg: '#fce7f3', color: '#9d174d', dot: '#db2777' },
  coordinador:    { bg: '#ede9fe', color: '#5b21b6', dot: '#7c3aed' },
  docente:        { bg: '#fef3c7', color: '#92400e', dot: '#d97706' },
  asistente:      { bg: '#f3f4f6', color: '#374151', dot: '#6b7280' },
  administrativo: { bg: '#dcfce7', color: '#15803d', dot: '#16a34a' },
  soporte:        { bg: '#e0f2fe', color: '#0369a1', dot: '#0284c7' },
  visor_requerimientos: { bg: '#f3e8ff', color: '#6b21a8', dot: '#9333ea' },
}

const ROLES_BASE = ['admin','directivo','coordinador','docente','asistente','administrativo','soporte','visor_requerimientos']

function Toggle({ activo, onChange, disabled }) {
  const w = 38, h = 22, d = 16
  return (
    <div
      onClick={disabled ? undefined : onChange}
      style={{
        width: w, height: h, borderRadius: h / 2,
        background: activo ? 'rgb(var(--primary-rgb))' : '#d1d5db',
        position: 'relative', flexShrink: 0,
        transition: 'background 0.2s',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span style={{
        position: 'absolute',
        top: (h - d) / 2,
        left: activo ? w - d - (h - d) / 2 : (h - d) / 2,
        width: d, height: d, borderRadius: '50%',
        background: '#fff', transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
      }} />
    </div>
  )
}

export default function MantenedorRoles() {
  const [roles,          setRoles]          = useState([])
  const [conteos,        setConteos]        = useState({})
  const [rolSeleccionado, setRolSeleccionado] = useState(null)
  const [draft,          setDraft]          = useState(null)
  const [savedDraft,     setSavedDraft]     = useState(null)
  const [guardando,      setGuardando]      = useState(false)
  const [mensaje,        setMensaje]        = useState({ tipo: '', texto: '' })
  const [confirmar,      setConfirmar]      = useState(false)
  const [modalNuevoRol,  setModalNuevoRol]  = useState(false)
  const [modalEliminar,  setModalEliminar]  = useState(false)
  const [gruposAbiertos, setGruposAbiertos] = useState(() =>
    Object.fromEntries(GRUPOS.map(g => [g.key, true]))
  )
  const [cargando, setCargando] = useState(true)

  const hayaCambios = useMemo(() => {
    if (!draft || !savedDraft) return false
    return JSON.stringify(draft) !== JSON.stringify(savedDraft)
  }, [draft, savedDraft])

  useEffect(() => { cargarTodo() }, [])

  async function cargarTodo() {
    setCargando(true)
    const [{ data: rData }, { data: uData }] = await Promise.all([
      supabase.from('permisos_rol').select('*'),
      supabase.from('usuarios').select('rol'),
    ])

    const dbRoles = rData ?? []
    const dbRoleKeys = new Set(dbRoles.map(r => r.rol))

    // Roles base siempre presentes, en orden definido, con datos de BD si existen
    const baseOrdenados = ROLES_BASE.map(r =>
      dbRoles.find(d => d.rol === r) ?? { rol: r, permisos: { ...PERMISOS_VACIO }, descripcion: '' }
    )
    // Roles personalizados que no son base
    const customRoles = dbRoles.filter(r => !ROLES_BASE.includes(r.rol))

    const listaRoles = [...baseOrdenados, ...customRoles]
    setRoles(listaRoles)

    // Conteos de usuarios por rol
    const cnt = {}
    ;(uData ?? []).forEach(u => { cnt[u.rol] = (cnt[u.rol] ?? 0) + 1 })
    setConteos(cnt)

    // Seleccionar primer rol por defecto
    if (listaRoles.length > 0 && !rolSeleccionado) {
      seleccionarRol(listaRoles[0])
    }
    setCargando(false)
  }

  function seleccionarRol(rol) {
    setRolSeleccionado(rol)
    const d = { permisos: { ...PERMISOS_VACIO, ...(rol.permisos ?? {}) }, descripcion: rol.descripcion ?? '' }
    setDraft(d)
    setSavedDraft(d)
    setMensaje({ tipo: '', texto: '' })
    setConfirmar(false)
  }

  function togglePermiso(key) {
    setDraft(prev => ({
      ...prev,
      permisos: { ...prev.permisos, [key]: !prev.permisos[key] },
    }))
  }

  function toggleGrupo(grupoKey) {
    setGruposAbiertos(prev => ({ ...prev, [grupoKey]: !prev[grupoKey] }))
  }

  function activarTodosGrupo(grupoKey, valor) {
    const grupo = GRUPOS.find(g => g.key === grupoKey)
    if (!grupo) return
    const updates = Object.fromEntries(grupo.permisos.map(k => [k, valor]))
    setDraft(prev => ({ ...prev, permisos: { ...prev.permisos, ...updates } }))
  }

  async function guardar() {
    setGuardando(true)
    setMensaje({ tipo: '', texto: '' })

    const { error } = await supabase
      .from('permisos_rol')
      .upsert({
        rol: rolSeleccionado.rol,
        permisos: draft.permisos,
        descripcion: draft.descripcion,
      }, { onConflict: 'rol' })

    setGuardando(false)
    setConfirmar(false)

    if (error) {
      setMensaje({ tipo: 'error', texto: 'Error al guardar: ' + error.message })
    } else {
      const actualizado = { ...rolSeleccionado, permisos: draft.permisos, descripcion: draft.descripcion }
      setSavedDraft(draft)
      setRoles(prev => prev.map(r => r.rol === rolSeleccionado.rol ? actualizado : r))
      setRolSeleccionado(actualizado)
      setMensaje({ tipo: 'exito', texto: '¡Permisos del rol guardados! Los usuarios heredarán estos permisos.' })
      setTimeout(() => setMensaje({ tipo: '', texto: '' }), 3500)
    }
  }

  async function restaurarDefecto() {
    const defecto = { ...PERMISOS_VACIO }
    setDraft(prev => ({ ...prev, permisos: defecto }))
    setMensaje({ tipo: 'info', texto: 'Permisos restablecidos. Haz clic en «Guardar» para aplicar.' })
    setTimeout(() => setMensaje({ tipo: '', texto: '' }), 3000)
  }

  async function duplicarRol() {
    if (!rolSeleccionado) return
    const nuevoRol = rolSeleccionado.rol + '_copia'
    const { error } = await supabase.from('permisos_rol').insert({
      rol: nuevoRol,
      permisos: draft.permisos,
      descripcion: `Copia de ${rolSeleccionado.descripcion || rolSeleccionado.rol}`,
    })
    if (error) {
      setMensaje({ tipo: 'error', texto: 'Error: ' + error.message })
    } else {
      setMensaje({ tipo: 'exito', texto: `Rol duplicado como «${nuevoRol}». Puedes renombrarlo.` })
      setTimeout(() => setMensaje({ tipo: '', texto: '' }), 3000)
      await cargarTodo()
    }
  }

  async function eliminarRol() {
    if (!rolSeleccionado) return
    const cant = conteos[rolSeleccionado.rol] ?? 0
    if (cant > 0) return
    const { error } = await supabase.from('permisos_rol').delete().eq('rol', rolSeleccionado.rol)
    setModalEliminar(false)
    if (error) {
      setMensaje({ tipo: 'error', texto: 'Error: ' + error.message })
    } else {
      const nuevos = roles.filter(r => r.rol !== rolSeleccionado.rol)
      setRoles(nuevos)
      if (nuevos.length > 0) seleccionarRol(nuevos[0])
      else { setRolSeleccionado(null); setDraft(null); setSavedDraft(null) }
    }
  }

  const puedeEliminar = rolSeleccionado && !ROLES_BASE.includes(rolSeleccionado.rol) && (conteos[rolSeleccionado.rol] ?? 0) === 0

  // ── Conteo de permisos activos por grupo ──
  function contarActivos(grupoKey) {
    const grupo = GRUPOS.find(g => g.key === grupoKey)
    if (!grupo || !draft) return { activos: 0, total: grupo?.permisos?.length ?? 0 }
    const activos = grupo.permisos.filter(k => draft.permisos[k]).length
    return { activos, total: grupo.permisos.length }
  }

  const st = {
    page: { display: 'flex', gap: 0, height: '100%', background: '#f1f5f9', minHeight: 0, overflow: 'hidden' },
    leftPanel: {
      width: 260, flexShrink: 0, background: '#fff',
      borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    },
    leftHeader: {
      padding: '20px 16px 14px', borderBottom: '1px solid #f3f4f6',
    },
    leftTitle: { margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' },
    leftSub:   { margin: '3px 0 0', fontSize: 12, color: '#9ca3af' },
    rolesList: { flex: 1, overflowY: 'auto', padding: '8px 0' },
    roleItem: (sel, rol) => ({
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 16px', cursor: 'pointer', userSelect: 'none',
      background: sel ? 'rgba(var(--primary-rgb),0.07)' : 'transparent',
      borderLeft: `3px solid ${sel ? 'rgb(var(--primary-rgb))' : 'transparent'}`,
      transition: 'all 0.15s',
    }),
    roleDot: (rol) => ({
      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
      background: ROL_COLORES[rol]?.dot ?? '#9ca3af',
    }),
    roleName:  { fontSize: 13, fontWeight: 600, color: '#111827', flex: 1 },
    roleCount: { fontSize: 11, color: '#9ca3af', background: '#f3f4f6', borderRadius: 99, padding: '1px 7px', fontWeight: 500 },
    addRoleBtn: {
      margin: '8px 12px 12px', padding: '9px 12px',
      border: '1.5px dashed #d1d5db', borderRadius: 9,
      background: 'transparent', cursor: 'pointer', color: '#6b7280',
      fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
      transition: 'all 0.15s',
    },
    rightPanel: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    rightHeader: {
      padding: '20px 24px 16px', background: '#fff',
      borderBottom: '1px solid #e5e7eb',
      display: 'flex', alignItems: 'flex-start', gap: 16,
    },
    rightBody: { flex: 1, overflowY: 'auto', padding: '20px 24px' },
    grupoCard: {
      background: '#fff', borderRadius: 12,
      border: '1px solid #e5e7eb', marginBottom: 12, overflow: 'hidden',
    },
    grupoHeader: {
      display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
      cursor: 'pointer', userSelect: 'none',
      background: '#fafafa', borderBottom: '1px solid #f3f4f6',
    },
    permisoRow: (activo) => ({
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 16px', cursor: 'pointer', userSelect: 'none',
      background: activo ? 'rgba(var(--primary-rgb),0.025)' : '#fff',
      borderBottom: '1px solid #f9fafb',
      transition: 'background 0.12s', gap: 12,
    }),
  }

  if (cargando) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ textAlign: 'center', color: '#9ca3af' }}>
        <div style={{ width: 28, height: 28, border: '3px solid #e5e7eb', borderTopColor: 'rgb(var(--primary-rgb))', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 10px' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        Cargando roles…
      </div>
    </div>
  )

  return (
    <div style={st.page}>

      {/* ── Panel izquierdo: lista de roles ── */}
      <div style={st.leftPanel}>
        <div style={st.leftHeader}>
          <p style={st.leftTitle}>Roles del sistema</p>
          <p style={st.leftSub}>{roles.length} roles configurados</p>
        </div>

        <div style={st.rolesList}>
          {roles.map(r => {
            const sel = rolSeleccionado?.rol === r.rol
            const cant = conteos[r.rol] ?? 0
            return (
              <div
                key={r.rol}
                style={st.roleItem(sel, r.rol)}
                onClick={() => { if (!sel) seleccionarRol(r) }}
              >
                <span style={st.roleDot(r.rol)} />
                <span style={st.roleName}>{ROL_LABEL[r.rol] ?? r.rol}</span>
                <span style={st.roleCount}>{cant}</span>
              </div>
            )
          })}
        </div>

        <button
          style={st.addRoleBtn}
          onClick={() => setModalNuevoRol(true)}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgb(var(--primary-rgb))'; e.currentTarget.style.color = 'rgb(var(--primary-rgb))' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.color = '#6b7280' }}
        >
          + Crear nuevo rol
        </button>
      </div>

      {/* ── Panel derecho ── */}
      <div style={st.rightPanel}>
        {!rolSeleccionado ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <p style={{ color: '#9ca3af', fontSize: 14 }}>Selecciona un rol para configurarlo</p>
          </div>
        ) : (
          <>
            {/* Header del rol */}
            <div style={st.rightHeader}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{
                    display: 'inline-block', padding: '3px 12px', borderRadius: 99, fontSize: 12.5, fontWeight: 700,
                    background: ROL_COLORES[rolSeleccionado.rol]?.bg ?? '#f3f4f6',
                    color:      ROL_COLORES[rolSeleccionado.rol]?.color ?? '#374151',
                  }}>
                    {ROL_LABEL[rolSeleccionado.rol] ?? rolSeleccionado.rol}
                  </span>
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>
                    {conteos[rolSeleccionado.rol] ?? 0} {(conteos[rolSeleccionado.rol] ?? 0) === 1 ? 'usuario' : 'usuarios'}
                  </span>
                  {ROLES_BASE.includes(rolSeleccionado.rol) && (
                    <span style={{
                      fontSize: 11, color: '#6b7280', background: '#f3f4f6',
                      borderRadius: 6, padding: '2px 8px', fontWeight: 500,
                    }}>
                      Rol base del sistema
                    </span>
                  )}
                </div>

                <input
                  value={draft?.descripcion ?? ''}
                  onChange={e => setDraft(prev => ({ ...prev, descripcion: e.target.value }))}
                  placeholder="Descripción del rol (opcional)…"
                  style={{
                    width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8,
                    padding: '7px 11px', fontSize: 13, color: '#374151',
                    outline: 'none', background: '#fafafa', boxSizing: 'border-box',
                    maxWidth: 500,
                  }}
                  onFocus={e => e.target.style.borderColor = 'rgba(var(--primary-rgb),0.5)'}
                  onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>

              {/* Botones acción */}
              <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button
                  onClick={restaurarDefecto}
                  style={{ padding: '7px 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: '1.5px solid #e5e7eb', background: '#fff', color: '#6b7280' }}
                >
                  Restaurar
                </button>
                <button
                  onClick={duplicarRol}
                  style={{ padding: '7px 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: '1.5px solid #e5e7eb', background: '#fff', color: '#6b7280' }}
                >
                  Duplicar
                </button>
                {puedeEliminar && (
                  <button
                    onClick={() => setModalEliminar(true)}
                    style={{ padding: '7px 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: '1.5px solid #fca5a5', background: '#fff7f7', color: '#dc2626' }}
                  >
                    Eliminar
                  </button>
                )}
                <button
                  onClick={() => setConfirmar(true)}
                  disabled={!hayaCambios || guardando}
                  style={{
                    padding: '7px 16px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: hayaCambios ? 'pointer' : 'default',
                    border: 'none', background: hayaCambios ? 'rgb(var(--primary-rgb))' : '#e5e7eb',
                    color: hayaCambios ? '#fff' : '#9ca3af',
                    boxShadow: hayaCambios ? '0 0 0 3px rgba(var(--primary-rgb),0.18)' : 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  {guardando ? 'Guardando…' : hayaCambios ? 'Guardar cambios ✓' : 'Sin cambios'}
                </button>
              </div>
            </div>

            {/* Mensaje feedback */}
            {mensaje.texto && (
              <div style={{
                margin: '12px 24px 0',
                padding: '10px 14px', borderRadius: 9, fontSize: 13, fontWeight: 500,
                ...(mensaje.tipo === 'exito' ? { background: '#f0fdf4', border: '1px solid #86efac', color: '#15803d' }
                  : mensaje.tipo === 'error' ? { background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626' }
                  : { background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8' }),
              }}>
                {mensaje.texto}
              </div>
            )}

            {/* Advertencia impacto */}
            {hayaCambios && (
              <div style={{
                margin: '12px 24px 0', padding: '10px 14px', borderRadius: 9,
                background: '#fffbeb', border: '1px solid #fbbf24',
                fontSize: 12.5, color: '#92400e', fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                ⚠️ Los cambios afectarán automáticamente a todos los usuarios con este rol al guardar.
              </div>
            )}

            {/* Matriz de permisos */}
            <div style={st.rightBody}>
              {GRUPOS.map(grupo => {
                const { activos, total } = contarActivos(grupo.key)
                const abierto = gruposAbiertos[grupo.key]
                const todosActivos = activos === total

                return (
                  <div key={grupo.key} style={st.grupoCard}>
                    {/* Cabecera del grupo */}
                    <div style={st.grupoHeader} onClick={() => toggleGrupo(grupo.key)}>
                      <span style={{ fontSize: 16 }}>{grupo.icon}</span>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: '#111827', flex: 1 }}>
                        {grupo.label}
                      </span>
                      <span style={{
                        fontSize: 11.5, fontWeight: 600, padding: '2px 9px', borderRadius: 99,
                        background: activos > 0 ? 'rgba(var(--primary-rgb),0.1)' : '#f3f4f6',
                        color:      activos > 0 ? 'rgb(var(--primary-rgb))' : '#9ca3af',
                        marginRight: 8,
                      }}>
                        {activos}/{total}
                      </span>
                      {/* Toggle todo el grupo */}
                      <button
                        onClick={e => { e.stopPropagation(); activarTodosGrupo(grupo.key, !todosActivos) }}
                        style={{
                          fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 6,
                          border: '1.5px solid', marginRight: 8, cursor: 'pointer',
                          borderColor: todosActivos ? 'rgba(var(--primary-rgb),0.3)' : '#d1d5db',
                          background:  todosActivos ? 'rgba(var(--primary-rgb),0.06)' : '#fff',
                          color:       todosActivos ? 'rgb(var(--primary-rgb))' : '#6b7280',
                        }}
                      >
                        {todosActivos ? '✓ Todos' : 'Todos'}
                      </button>
                      <span style={{ fontSize: 12, color: '#9ca3af', transform: abierto ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>▶</span>
                    </div>

                    {/* Filas de permisos */}
                    {abierto && (
                      <div>
                        {ACCIONES.filter(a => grupo.permisos.includes(a.key)).map((a, idx) => {
                          const activo = draft?.permisos?.[a.key] ?? false
                          const esUltimo = idx === ACCIONES.filter(x => grupo.permisos.includes(x.key)).length - 1
                          return (
                            <div
                              key={a.key}
                              style={{ ...st.permisoRow(activo), borderBottom: esUltimo ? 'none' : '1px solid #f3f4f6' }}
                              onClick={() => togglePermiso(a.key)}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#111827' }}>{a.label}</p>
                                {a.desc && <p style={{ margin: '2px 0 0', fontSize: 11.5, color: '#9ca3af', lineHeight: 1.4 }}>{a.desc}</p>}
                              </div>
                              <Toggle activo={activo} onChange={() => togglePermiso(a.key)} />
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Modal confirmación guardar ── */}
      {confirmar && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setConfirmar(false)}>
          <div style={{
            background: '#fff', borderRadius: 14, padding: 24, maxWidth: 420, width: '90%',
            boxShadow: '0 20px 50px rgba(0,0,0,0.15)',
          }} onClick={e => e.stopPropagation()}>
            <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 16, color: '#111827' }}>
              ¿Confirmar cambios?
            </p>
            <p style={{ margin: '0 0 10px', fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
              Los cambios realizados en <strong>{ROL_LABEL[rolSeleccionado?.rol] ?? rolSeleccionado?.rol}</strong> afectarán automáticamente a todos los usuarios que utilizan este rol.
            </p>
            <div style={{
              background: '#fffbeb', border: '1px solid #fbbf24', borderRadius: 8,
              padding: '9px 13px', marginBottom: 20, fontSize: 12.5, color: '#92400e',
            }}>
              {conteos[rolSeleccionado?.rol] ?? 0} usuario(s) serán afectados al guardar.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmar(false)}
                style={{ padding: '9px 18px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151' }}
              >
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={guardando}
                style={{ padding: '9px 22px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', background: 'rgb(var(--primary-rgb))', color: '#fff', minWidth: 110 }}
              >
                {guardando ? 'Guardando…' : 'Sí, guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal eliminar rol ── */}
      {modalEliminar && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setModalEliminar(false)}>
          <div style={{
            background: '#fff', borderRadius: 14, padding: 24, maxWidth: 400, width: '90%',
            boxShadow: '0 20px 50px rgba(0,0,0,0.15)',
          }} onClick={e => e.stopPropagation()}>
            <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 16, color: '#111827' }}>
              Eliminar rol
            </p>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7280' }}>
              ¿Estás seguro de que deseas eliminar el rol <strong>{ROL_LABEL[rolSeleccionado?.rol] ?? rolSeleccionado?.rol}</strong>? Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setModalEliminar(false)}
                style={{ padding: '9px 18px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151' }}
              >
                Cancelar
              </button>
              <button
                onClick={eliminarRol}
                style={{ padding: '9px 20px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', background: '#dc2626', color: '#fff' }}
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal crear nuevo rol ── */}
      {modalNuevoRol && (
        <ModalNuevoRol
          onCerrar={() => setModalNuevoRol(false)}
          onCreado={async () => { setModalNuevoRol(false); await cargarTodo() }}
          rolesExistentes={roles.map(r => r.rol)}
        />
      )}
    </div>
  )
}

// ── Modal crear nuevo rol ──────────────────────────────────────────────────
function ModalNuevoRol({ onCerrar, onCreado, rolesExistentes }) {
  const [nombre,      setNombre]      = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [baseRol,     setBaseRol]     = useState('')
  const [guardando,   setGuardando]   = useState(false)
  const [error,       setError]       = useState('')

  const claveRol = nombre.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
  const yaExiste = rolesExistentes.includes(claveRol)

  async function crear() {
    if (!nombre.trim()) { setError('El nombre del rol es obligatorio.'); return }
    if (yaExiste) { setError('Ya existe un rol con esa clave.'); return }
    setGuardando(true)
    setError('')

    // Copiar permisos del rol base si se eligió uno
    let permisos = { ...PERMISOS_VACIO }
    if (baseRol) {
      const { data } = await supabase.from('permisos_rol').select('permisos').eq('rol', baseRol).maybeSingle()
      if (data?.permisos) permisos = { ...PERMISOS_VACIO, ...data.permisos }
    }

    const { error: err } = await supabase.from('permisos_rol').insert({
      rol: claveRol,
      permisos,
      descripcion: descripcion.trim(),
    })

    setGuardando(false)
    if (err) {
      setError('Error: ' + err.message)
    } else {
      onCreado()
    }
  }

  const inp = {
    width: '100%', boxSizing: 'border-box',
    border: '1.5px solid #e5e7eb', borderRadius: 8,
    padding: '9px 12px', fontSize: 13, outline: 'none', color: '#111827',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={onCerrar}>
      <div style={{
        background: '#fff', borderRadius: 14, padding: 24, maxWidth: 440, width: '90%',
        boxShadow: '0 20px 50px rgba(0,0,0,0.15)',
      }} onClick={e => e.stopPropagation()}>
        <p style={{ margin: '0 0 18px', fontWeight: 700, fontSize: 16, color: '#111827' }}>
          Crear nuevo rol
        </p>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>
            Nombre del rol *
          </label>
          <input
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder="Ej: Encargado biblioteca"
            style={inp}
            onFocus={e => e.target.style.borderColor = 'rgba(var(--primary-rgb),0.5)'}
            onBlur={e => e.target.style.borderColor = '#e5e7eb'}
            autoFocus
          />
          {nombre && (
            <p style={{ margin: '4px 0 0', fontSize: 11.5, color: yaExiste ? '#dc2626' : '#9ca3af' }}>
              Clave: <code style={{ background: '#f3f4f6', padding: '1px 5px', borderRadius: 4 }}>{claveRol}</code>
              {yaExiste && ' — ya existe'}
            </p>
          )}
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>
            Descripción (opcional)
          </label>
          <input
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            placeholder="Describe brevemente este rol…"
            style={inp}
            onFocus={e => e.target.style.borderColor = 'rgba(var(--primary-rgb),0.5)'}
            onBlur={e => e.target.style.borderColor = '#e5e7eb'}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>
            Basado en (opcional)
          </label>
          <select
            value={baseRol}
            onChange={e => setBaseRol(e.target.value)}
            style={{ ...inp, background: '#fff' }}
          >
            <option value="">— Sin base (todo desactivado) —</option>
            {rolesExistentes.map(r => (
              <option key={r} value={r}>{ROL_LABEL[r] ?? r}</option>
            ))}
          </select>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '9px 12px', marginBottom: 14, fontSize: 13, color: '#dc2626' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCerrar}
            style={{ padding: '9px 18px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151' }}
          >
            Cancelar
          </button>
          <button
            onClick={crear}
            disabled={guardando || !nombre.trim() || yaExiste}
            style={{
              padding: '9px 22px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              border: 'none', background: 'rgb(var(--primary-rgb))', color: '#fff',
              opacity: (!nombre.trim() || yaExiste) ? 0.5 : 1,
            }}
          >
            {guardando ? 'Creando…' : 'Crear rol'}
          </button>
        </div>
      </div>
    </div>
  )
}
