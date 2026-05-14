import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { aplicarTema } from '../utils/tema'
import './Ajustes.css'

const DEFAULTS = {
  colorPrimario:    '#1a237e',
  colorAcento:      '#d4a017',
  colorBoton:       '#6366f1',
  nombreSistema:    'Inventario',
  nombreInstitucion:'Liceo JHJ',
}

const PALETAS = [
  { nombre: 'Azul marino',       primario: '#1a237e', acento: '#d4a017', boton: '#6366f1' },
  { nombre: 'Verde institucional',primario: '#14532d', acento: '#86efac', boton: '#16a34a' },
  { nombre: 'Borgoña',           primario: '#7f1d1d', acento: '#fca5a5', boton: '#dc2626' },
  { nombre: 'Gris corporativo',  primario: '#1f2937', acento: '#9ca3af', boton: '#3b82f6' },
  { nombre: 'Morado real',       primario: '#4c1d95', acento: '#c4b5fd', boton: '#7c3aed' },
]

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)]
}

function removerFondo(file) {
  return new Promise((resolve) => {
    const img = new Image()
    const blobUrl = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const d = imgData.data
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i+1], b = d[i+2]
        if (r > 230 && g > 230 && b > 230) d[i+3] = 0
        if (r < 25  && g < 25  && b < 25)  d[i+3] = 0
      }
      ctx.putImageData(imgData, 0, 0)
      canvas.toBlob(blob => { URL.revokeObjectURL(blobUrl); resolve(blob) }, 'image/png')
    }
    img.src = blobUrl
  })
}

function Preview({ colorPrimario, colorAcento, colorBoton, logoPreview, nombreSistema, nombreInstitucion }) {
  const [r, g, b] = hexToRgb(colorPrimario)
  const dk = `rgb(${Math.round(r*.45)},${Math.round(g*.45)},${Math.round(b*.45)})`
  const md = `rgb(${Math.round(r*.62)},${Math.round(g*.62)},${Math.round(b*.62)})`

  return (
    <div className="ajustes-preview" style={{ border: '1.5px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', height: 210, display: 'flex', userSelect: 'none', pointerEvents: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
      {/* Sidebar mini */}
      <div style={{ width: 130, background: `linear-gradient(180deg,${dk} 0%,${md} 100%)`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '10px 8px', borderBottom: `1px solid ${colorAcento}44` }}>
          <img src={logoPreview} alt="" style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover', border: `1.5px solid ${colorAcento}99`, flexShrink: 0 }} onError={e => { e.target.style.display = 'none' }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 7, fontWeight: 700, color: '#f5e9c0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombreSistema || 'Inventario'}</div>
            <div style={{ fontSize: 6, color: 'rgba(255,255,255,.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombreInstitucion || 'Liceo JHJ'}</div>
          </div>
        </div>
        <div style={{ padding: '6px 0', display: 'flex', flexDirection: 'column', gap: 1 }}>
          {['Inicio','Inventario','Usuarios','Tickets','⚙️ Ajustes'].map((item, i) => (
            <div key={item} style={{ padding: '4px 8px', fontSize: 7.5, color: i === 1 ? colorAcento : 'rgba(255,255,255,.5)', background: i === 1 ? `${colorAcento}22` : 'transparent', borderLeft: `2px solid ${i === 1 ? colorAcento : 'transparent'}` }}>
              {item}
            </div>
          ))}
        </div>
      </div>
      {/* Login mini */}
      <div style={{ flex: 1, background: `linear-gradient(160deg,${dk} 0%,${colorPrimario} 50%,${md} 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
        <div style={{ background: '#fff', borderRadius: 8, padding: '12px 14px', width: 140, boxShadow: '0 4px 16px rgba(0,0,0,0.25)' }}>
          <div style={{ textAlign: 'center', marginBottom: 10 }}>
            <img src={logoPreview} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${colorAcento}88`, display: 'block', margin: '0 auto 5px' }} onError={e => { e.target.style.display = 'none' }} />
            <div style={{ fontSize: 8, fontWeight: 700, color: '#111827' }}>Iniciar sesión</div>
            <div style={{ fontSize: 6.5, color: '#9ca3af', marginTop: 2 }}>{nombreInstitucion || 'Liceo JHJ'}</div>
          </div>
          <div style={{ height: 14, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 4, marginBottom: 5 }} />
          <div style={{ height: 14, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 4, marginBottom: 8 }} />
          <div style={{ height: 18, background: colorPrimario, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 7, color: '#fff', fontWeight: 700 }}>Ingresar</span>
          </div>
          <div style={{ marginTop: 6, display: 'flex', gap: 4 }}>
            <div style={{ flex: 1, height: 14, background: colorBoton, borderRadius: 4 }} />
            <div style={{ flex: 1, height: 14, background: '#f3f4f6', borderRadius: 4 }} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Ajustes({ onLogoChange, onNombreChange }) {
  const [colorPrimario,     setColorPrimario]     = useState(DEFAULTS.colorPrimario)
  const [colorAcento,       setColorAcento]       = useState(DEFAULTS.colorAcento)
  const [colorBoton,        setColorBoton]        = useState(DEFAULTS.colorBoton)
  const [logoPreview,       setLogoPreview]       = useState('/logo-liceo.png')
  const [logoFile,          setLogoFile]          = useState(null)
  const [sinFondo,          setSinFondo]          = useState(false)
  const [nombreSistema,     setNombreSistema]     = useState(DEFAULTS.nombreSistema)
  const [nombreInstitucion, setNombreInstitucion] = useState(DEFAULTS.nombreInstitucion)
  const [guardando,         setGuardando]         = useState(false)
  const [exito,             setExito]             = useState(false)
  const [error,             setError]             = useState('')
  const [confirm,           setConfirm]           = useState(null) // { titulo, mensaje, icono, onOk }
  const fileRef = useRef()

  useEffect(() => { cargar() }, []) // eslint-disable-line

  async function cargar() {
    const { data } = await supabase.from('configuracion').select('clave, valor')
    if (!data) return
    const cfg = Object.fromEntries(data.map(r => [r.clave, r.valor]))
    const p = cfg.color_primario || DEFAULTS.colorPrimario
    const a = cfg.color_acento   || DEFAULTS.colorAcento
    const b = cfg.color_boton    || DEFAULTS.colorBoton
    setColorPrimario(p); setColorAcento(a); setColorBoton(b)
    if (cfg.logo_url)              setLogoPreview(cfg.logo_url)
    if (cfg.logo_sin_fondo === 'true') setSinFondo(true)
    if (cfg.nombre_sistema)        setNombreSistema(cfg.nombre_sistema)
    if (cfg.nombre_institucion)    setNombreInstitucion(cfg.nombre_institucion)
  }

  function handleColorChange(setter, key, value) {
    setter(value)
    aplicarTema({
      colorPrimario: key === 'color_primario' ? value : colorPrimario,
      colorAcento:   key === 'color_acento'   ? value : colorAcento,
      colorBoton:    key === 'color_boton'     ? value : colorBoton,
    })
  }

  function aplicarPaleta({ primario, acento, boton, nombre }) {
    setConfirm({
      titulo: `¿Aplicar paleta "${nombre}"?`,
      mensaje: 'Se cambiarán los colores del tema en toda la aplicación. Recuerda guardar para que el cambio sea permanente.',
      icono: '🎨',
      onOk: () => {
        setColorPrimario(primario); setColorAcento(acento); setColorBoton(boton)
        aplicarTema({ colorPrimario: primario, colorAcento: acento, colorBoton: boton })
      },
    })
  }

  async function handleLogoFile(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { setError('El archivo no puede superar 2 MB'); return }
    setLogoFile(file); setError('')
    setLogoPreview(sinFondo
      ? URL.createObjectURL(await removerFondo(file))
      : URL.createObjectURL(file))
  }

  async function handleSinFondoChange(val) {
    setSinFondo(val)
    if (logoFile)
      setLogoPreview(val
        ? URL.createObjectURL(await removerFondo(logoFile))
        : URL.createObjectURL(logoFile))
  }

  async function guardar() {
    setGuardando(true); setError(''); setExito(false)

    let logoUrl = null
    if (logoFile) {
      const blob = sinFondo ? await removerFondo(logoFile) : logoFile
      const ext  = sinFondo ? 'png' : logoFile.name.split('.').pop()
      const { error: upErr } = await supabase.storage.from('logos')
        .upload(`logo-principal.${ext}`, blob, { upsert: true, contentType: sinFondo ? 'image/png' : logoFile.type })
      if (upErr) { setError('Error al subir logo: ' + upErr.message); setGuardando(false); return }
      const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(`logo-principal.${ext}`)
      logoUrl = publicUrl + '?t=' + Date.now()
    }

    const filas = [
      { clave: 'color_primario',    valor: colorPrimario     },
      { clave: 'color_acento',      valor: colorAcento       },
      { clave: 'color_boton',       valor: colorBoton        },
      { clave: 'logo_sin_fondo',    valor: String(sinFondo)  },
      { clave: 'nombre_sistema',    valor: nombreSistema.trim()     || DEFAULTS.nombreSistema     },
      { clave: 'nombre_institucion',valor: nombreInstitucion.trim() || DEFAULTS.nombreInstitucion },
    ]
    if (logoUrl) filas.push({ clave: 'logo_url', valor: logoUrl })

    const { error: dbErr } = await supabase.from('configuracion').upsert(filas, { onConflict: 'clave' })
    if (dbErr) { setError('Error al guardar: ' + dbErr.message); setGuardando(false); return }

    if (logoUrl && onLogoChange) onLogoChange(logoUrl)
    if (onNombreChange) onNombreChange(
      nombreSistema.trim()     || DEFAULTS.nombreSistema,
      nombreInstitucion.trim() || DEFAULTS.nombreInstitucion,
    )
    setLogoFile(null); setGuardando(false); setExito(true)
    setTimeout(() => setExito(false), 3000)
  }

  function restaurar() {
    setConfirm({
      titulo: '¿Restaurar colores por defecto?',
      mensaje: 'Se revertirán los colores del tema al estado original (azul marino). Recuerda guardar para que el cambio sea permanente.',
      icono: '↺',
      onOk: () => {
        setColorPrimario(DEFAULTS.colorPrimario)
        setColorAcento(DEFAULTS.colorAcento)
        setColorBoton(DEFAULTS.colorBoton)
        aplicarTema(DEFAULTS)
      },
    })
  }

  const [r1, g1, b1] = hexToRgb(colorPrimario)
  const primDark = `rgb(${Math.round(r1*.45)},${Math.round(g1*.45)},${Math.round(b1*.45)})`

  const card = { background: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #f1f1f3', overflow: 'hidden' }
  const sectionHeader = (icon, title, badge) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 22px 14px', borderBottom: '1px solid #f3f4f6' }}>
      <div style={{ width: 32, height: 32, borderRadius: 10, background: `linear-gradient(135deg,${colorPrimario},${primDark})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>{icon}</div>
      <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#111827', flex: 1 }}>{title}</p>
      {badge && <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: '#22c55e', padding: '2px 8px', borderRadius: 20 }}>{badge}</span>}
    </div>
  )

  return (
    <div className="ajustes-root">

      {/* ── Cabecera ──────────────────────────────────────── */}
      <div className="ajustes-header" style={{ background: `linear-gradient(135deg,${colorPrimario} 0%,${primDark} 100%)` }}>
        <div className="ajustes-header-bubble ajustes-header-bubble--1" />
        <div className="ajustes-header-bubble ajustes-header-bubble--2" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>⚙️</div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>Ajustes del sistema</h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Personaliza logo, nombre e identidad visual</p>
          </div>
        </div>
      </div>

      {/* ── Cuerpo dos columnas ───────────────────────────── */}
      <div className="ajustes-body">

        {/* Columna izquierda: formularios */}
        <div className="ajustes-col-left">

          {/* ── Identidad ─────────────────────────────────── */}
          <div style={card}>
            {sectionHeader('🏢', 'Identidad del sistema')}
            <div style={{ padding: '18px 22px', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {[
                { label: 'Nombre corto', placeholder: 'Ej: Inventario', value: nombreSistema,     setter: setNombreSistema,     desc: 'Sidebar junto al logo' },
                { label: 'Institución',  placeholder: 'Ej: Liceo JHJ',  value: nombreInstitucion, setter: setNombreInstitucion, desc: 'Panel de login' },
              ].map(({ label, placeholder, value, setter, desc }) => (
                <div key={label} style={{ flex: '1 1 180px', minWidth: 0 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
                  <input value={value} onChange={e => setter(e.target.value)} placeholder={placeholder} maxLength={60}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1.5px solid #e5e7eb', fontSize: 13, color: '#111827', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' }}
                    onFocus={e => e.target.style.borderColor = colorPrimario}
                    onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                  />
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: '#9ca3af' }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Logo ──────────────────────────────────────── */}
          <div style={card}>
            {sectionHeader('🖼️', 'Logo del sistema', logoFile ? 'Pendiente' : null)}
            <div style={{ padding: '18px 22px' }}>
              <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: 88, height: 88, borderRadius: '50%', border: `3px solid ${colorAcento}66`, overflow: 'hidden',
                    backgroundImage: 'linear-gradient(45deg,#d1d5db 25%,transparent 25%),linear-gradient(-45deg,#d1d5db 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#d1d5db 75%),linear-gradient(-45deg,transparent 75%,#d1d5db 75%)',
                    backgroundSize: '14px 14px', backgroundPosition: '0 0,0 7px,7px -7px,-7px 0',
                    boxShadow: `0 0 0 4px ${colorAcento}22, 0 4px 16px rgba(0,0,0,0.12)` }}>
                    <img src={logoPreview} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={e => { e.target.src = '/logo-liceo.png' }} />
                  </div>
                  {logoFile && (
                    <div style={{ position: 'absolute', bottom: 2, right: 2, width: 20, height: 20, borderRadius: '50%', background: '#22c55e', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>✓</div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <button onClick={() => fileRef.current.click()}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 9, border: `1.5px solid ${colorPrimario}`, background: `${colorPrimario}0f`, color: colorPrimario, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
                    onMouseOver={e => { e.currentTarget.style.background = `${colorPrimario}1a` }}
                    onMouseOut={e => { e.currentTarget.style.background = `${colorPrimario}0f` }}>
                    <span style={{ fontSize: 16 }}>📁</span> Seleccionar imagen
                  </button>
                  <p style={{ margin: '6px 0 0', fontSize: 11, color: '#9ca3af' }}>PNG, JPG o SVG · máx. 2 MB</p>
                  {logoFile && <p style={{ margin: '6px 0 0', fontSize: 11, color: '#059669', fontWeight: 600 }}>✓ {logoFile.name}</p>}
                </div>
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoFile} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, cursor: 'pointer', padding: '12px 14px', borderRadius: 10, background: sinFondo ? '#f0fdf4' : '#f9fafb', border: `1.5px solid ${sinFondo ? '#86efac' : '#f0f0f0'}`, transition: 'all 0.15s' }}>
                <input type="checkbox" checked={sinFondo} onChange={e => handleSinFondoChange(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#22c55e', cursor: 'pointer' }} />
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#111827' }}>Remover fondo blanco / negro</p>
                  <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>Hace el fondo del logo transparente automáticamente al subir</p>
                </div>
              </label>
            </div>
          </div>

          {/* ── Colores ───────────────────────────────────── */}
          <div style={card}>
            {sectionHeader('🎨', 'Colores del tema')}
            <div style={{ padding: '18px 22px' }}>
              <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Paletas predefinidas</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
                {PALETAS.map(p => {
                  const activa = p.primario === colorPrimario && p.acento === colorAcento && p.boton === colorBoton
                  return (
                    <button key={p.nombre} className="ajustes-paleta-card"
                      onClick={() => aplicarPaleta({ primario: p.primario, acento: p.acento, boton: p.boton, nombre: p.nombre })}
                      style={{ borderColor: activa ? p.primario : '#e5e7eb', background: activa ? `${p.primario}0d` : '#fff' }}>
                      <div className="ajustes-paleta-strip" style={{ background: `linear-gradient(90deg,${p.primario} 0%,${p.acento} 50%,${p.boton} 100%)` }} />
                      <div className="ajustes-paleta-dots">
                        {[p.primario, p.acento, p.boton].map((c, i) => (
                          <div key={i} className="ajustes-paleta-dot" style={{ background: c }} />
                        ))}
                      </div>
                      <span className="ajustes-paleta-label" style={{ fontWeight: activa ? 700 : 500, color: activa ? p.primario : '#6b7280' }}>{p.nombre}</span>
                    </button>
                  )
                })}
              </div>

              <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Personalizado</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'Primario',  desc: 'Sidebar y login',              key: 'color_primario', value: colorPrimario, setter: setColorPrimario },
                  { label: 'Acento',    desc: 'Elementos activos y bordes',   key: 'color_acento',   value: colorAcento,   setter: setColorAcento   },
                  { label: 'Botones',   desc: 'Acciones en el inventario',    key: 'color_boton',    value: colorBoton,    setter: setColorBoton    },
                ].map(({ label, desc, key, value, setter }) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, background: '#f9fafb', border: '1px solid #f0f0f2' }}>
                    <label htmlFor={key} style={{ cursor: 'pointer', position: 'relative', flexShrink: 0 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: value, boxShadow: `0 2px 8px ${value}66, inset 0 0 0 1.5px rgba(0,0,0,0.1)` }} />
                      <input id={key} type="color" value={value} onChange={e => handleColorChange(setter, key, e.target.value)}
                        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
                    </label>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#111827' }}>{label}</p>
                      <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>{desc}</p>
                    </div>
                    <input type="text" value={value} maxLength={7}
                      className="ajustes-hex-input"
                      onChange={e => { const v = e.target.value; if (/^#[0-9a-fA-F]{0,6}$/.test(v)) handleColorChange(setter, key, v) }}
                      onBlur={e => { if (!/^#[0-9a-fA-F]{6}$/.test(e.target.value)) setter(value); e.target.style.borderColor = '#e5e7eb' }}
                      onFocus={e => e.target.style.borderColor = colorPrimario}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* Columna derecha: vista previa sticky */}
        <div className="ajustes-col-right">
          <div className="ajustes-preview-sticky" style={card}>
            {sectionHeader('👁️', 'Vista previa', 'En vivo')}
            <div style={{ padding: '18px 22px' }}>
              <Preview
                colorPrimario={colorPrimario}
                colorAcento={colorAcento}
                colorBoton={colorBoton}
                logoPreview={logoPreview}
                nombreSistema={nombreSistema}
                nombreInstitucion={nombreInstitucion}
              />
              <p style={{ margin: '12px 0 0', fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>
                Refleja los cambios antes de guardar
              </p>

              {/* Mini botones de acción también en la columna derecha */}
              <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {error && <p style={{ margin: 0, fontSize: 12, color: '#dc2626', background: '#fef2f2', padding: '8px 12px', borderRadius: 8, border: '1px solid #fecaca' }}>⚠️ {error}</p>}
                {exito && <p style={{ margin: 0, fontSize: 12, color: '#059669', fontWeight: 600, background: '#f0fdf4', padding: '8px 12px', borderRadius: 8, border: '1px solid #bbf7d0' }}>✓ Cambios guardados</p>}
                <button className="ajustes-btn-save" onClick={guardar} disabled={guardando}
                  style={{ width: '100%', background: `linear-gradient(135deg,${colorPrimario},${primDark})`, opacity: guardando ? 0.75 : 1, cursor: guardando ? 'wait' : 'pointer', boxShadow: `0 4px 14px ${colorPrimario}55` }}>
                  {guardando ? '⏳ Guardando…' : '💾 Guardar cambios'}
                </button>
                <button className="ajustes-btn-rest" onClick={restaurar} style={{ width: '100%', textAlign: 'center' }}>
                  ↺ Restaurar defaults
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ── Barra de guardado fija (solo mobile) ─────────────── */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50, pointerEvents: 'none' }} className="ajustes-bar-mobile">
        <div className="ajustes-bar-wrap">
          <div className="ajustes-bar-inner">
            {error && <p style={{ margin: 0, fontSize: 12, color: '#dc2626', flex: 1 }}>⚠️ {error}</p>}
            {exito && <p style={{ margin: 0, fontSize: 12, color: '#059669', fontWeight: 600, flex: 1 }}>✓ Cambios guardados</p>}
            {!error && !exito && <p className="ajustes-bar-hint">Guarda para que los cambios sean permanentes</p>}
            <button className="ajustes-btn-rest" onClick={restaurar}>Restaurar defaults</button>
            <button className="ajustes-btn-save" onClick={guardar} disabled={guardando}
              style={{ background: `linear-gradient(135deg,${colorPrimario},${primDark})`, opacity: guardando ? 0.75 : 1, cursor: guardando ? 'wait' : 'pointer', boxShadow: `0 4px 14px ${colorPrimario}55` }}>
              {guardando ? '⏳ Guardando…' : '💾 Guardar cambios'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Modal confirmación ──────────────────────────────── */}
      {confirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,12,55,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 900 }}
          onClick={() => setConfirm(null)}>
          <div style={{ background: '#fff', borderRadius: 18, padding: '28px 28px 22px', boxShadow: '0 24px 64px rgba(0,0,0,0.25)', maxWidth: 380, width: '90%', display: 'flex', flexDirection: 'column', gap: 14 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ width: 46, height: 46, borderRadius: 12, background: `${colorPrimario}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>{confirm.icono}</div>
              <div>
                <p style={{ margin: '0 0 6px', fontWeight: 800, fontSize: 15, color: '#111827' }}>{confirm.titulo}</p>
                <p style={{ margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>{confirm.mensaje}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button onClick={() => setConfirm(null)}
                style={{ padding: '9px 18px', borderRadius: 9, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={() => { confirm.onOk(); setConfirm(null) }}
                style={{ padding: '9px 20px', borderRadius: 9, border: 'none', background: `linear-gradient(135deg,${colorPrimario},${primDark})`, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: `0 4px 12px ${colorPrimario}44` }}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
