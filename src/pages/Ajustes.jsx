import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { aplicarTema } from '../utils/tema'

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
    <div style={{ border: '2px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', height: 190, display: 'flex', userSelect: 'none', pointerEvents: 'none' }}>
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

  function aplicarPaleta({ primario, acento, boton }) {
    setColorPrimario(primario); setColorAcento(acento); setColorBoton(boton)
    aplicarTema({ colorPrimario: primario, colorAcento: acento, colorBoton: boton })
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
    setColorPrimario(DEFAULTS.colorPrimario)
    setColorAcento(DEFAULTS.colorAcento)
    setColorBoton(DEFAULTS.colorBoton)
    aplicarTema(DEFAULTS)
  }

  const swatch = (c) => (
    <div style={{ width: 28, height: 28, borderRadius: 6, background: c, border: '2px solid rgba(0,0,0,0.1)', flexShrink: 0 }} />
  )

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Nombre del sistema ─────────────────────────────── */}
      <div style={{ background: '#fff', borderRadius: 14, padding: '22px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #e5e7eb' }}>
        <p style={{ margin: '0 0 16px', fontWeight: 800, fontSize: 14, color: '#111827' }}>Nombre del sistema</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { label: 'Nombre corto', placeholder: 'Ej: Inventario', value: nombreSistema,     setter: setNombreSistema,     desc: 'Aparece en el sidebar junto al logo' },
            { label: 'Institución',  placeholder: 'Ej: Liceo JHJ',  value: nombreInstitucion, setter: setNombreInstitucion, desc: 'Aparece en el login y bajo el nombre corto' },
          ].map(({ label, placeholder, value, setter, desc }) => (
            <div key={label}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</label>
              <input value={value} onChange={e => setter(e.target.value)} placeholder={placeholder} maxLength={60}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, color: '#111827', outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = '#6366f1'}
                onBlur={e => e.target.style.borderColor = '#e5e7eb'}
              />
              <p style={{ margin: '4px 0 0', fontSize: 11, color: '#9ca3af' }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Logo ───────────────────────────────────────────── */}
      <div style={{ background: '#fff', borderRadius: 14, padding: '22px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #e5e7eb' }}>
        <p style={{ margin: '0 0 16px', fontWeight: 800, fontSize: 14, color: '#111827' }}>Logo del sistema</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', border: '3px solid #e5e7eb', overflow: 'hidden', flexShrink: 0,
            backgroundImage: 'linear-gradient(45deg,#ccc 25%,transparent 25%),linear-gradient(-45deg,#ccc 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ccc 75%),linear-gradient(-45deg,transparent 75%,#ccc 75%)',
            backgroundSize: '12px 12px', backgroundPosition: '0 0,0 6px,6px -6px,-6px 0' }}>
            <img src={logoPreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={e => { e.target.src = '/logo-liceo.png' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={() => fileRef.current.click()}
              style={{ padding: '8px 18px', borderRadius: 8, border: '1.5px solid #6366f1', background: '#f5f3ff', color: '#6366f1', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Cambiar logo
            </button>
            <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>PNG, JPG o SVG · máx. 2 MB</p>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoFile} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, cursor: 'pointer', padding: '10px 12px', borderRadius: 8, background: sinFondo ? '#f0fdf4' : '#f9fafb', border: `1px solid ${sinFondo ? '#86efac' : '#f3f4f6'}`, transition: 'all 0.15s' }}>
          <input type="checkbox" checked={sinFondo} onChange={e => handleSinFondoChange(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#22c55e', cursor: 'pointer' }} />
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#111827' }}>Remover fondo blanco/negro</p>
            <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>Hace transparente el fondo del logo automáticamente</p>
          </div>
        </label>
        {logoFile && <p style={{ margin: '10px 0 0', fontSize: 12, color: '#059669' }}>✓ {logoFile.name} seleccionado — guarda para aplicar</p>}
      </div>

      {/* ── Paletas + colores personalizados ───────────────── */}
      <div style={{ background: '#fff', borderRadius: 14, padding: '22px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #e5e7eb' }}>
        <p style={{ margin: '0 0 14px', fontWeight: 800, fontSize: 14, color: '#111827' }}>Colores del tema</p>

        {/* Paletas predefinidas */}
        <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Paletas predefinidas</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
          {PALETAS.map(p => {
            const activa = p.primario === colorPrimario && p.acento === colorAcento && p.boton === colorBoton
            return (
              <button key={p.nombre} onClick={() => aplicarPaleta(p)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 14px', borderRadius: 10, border: `2px solid ${activa ? p.primario : '#e5e7eb'}`, background: activa ? '#f8f9ff' : '#fff', cursor: 'pointer', transition: 'all 0.15s', minWidth: 88 }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: p.primario }} />
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: p.acento   }} />
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: p.boton    }} />
                </div>
                <span style={{ fontSize: 10.5, fontWeight: activa ? 700 : 500, color: activa ? p.primario : '#6b7280', textAlign: 'center' }}>{p.nombre}</span>
              </button>
            )
          })}
        </div>

        {/* Colores personalizados */}
        <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Personalizado</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { label: 'Color primario', desc: 'Sidebar y fondo de login',             key: 'color_primario', value: colorPrimario, setter: setColorPrimario },
            { label: 'Color acento',   desc: 'Bordes dorados y elementos activos',   key: 'color_acento',   value: colorAcento,   setter: setColorAcento   },
            { label: 'Color botones',  desc: 'Botones de acción en el inventario',   key: 'color_boton',    value: colorBoton,    setter: setColorBoton    },
          ].map(({ label, desc, key, value, setter }) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, background: '#f9fafb', border: '1px solid #f3f4f6' }}>
              {/* Swatch + color picker nativo */}
              <label htmlFor={key} style={{ cursor: 'pointer', position: 'relative', flexShrink: 0 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: value, border: '2px solid rgba(0,0,0,0.1)', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }} />
                <input id={key} type="color" value={value}
                  onChange={e => handleColorChange(setter, key, e.target.value)}
                  style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
              </label>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#111827' }}>{label}</p>
                <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>{desc}</p>
              </div>
              {/* Hex input editable */}
              <input
                type="text"
                value={value}
                maxLength={7}
                onChange={e => {
                  const v = e.target.value
                  if (/^#[0-9a-fA-F]{0,6}$/.test(v)) handleColorChange(setter, key, v)
                }}
                onBlur={e => {
                  if (!/^#[0-9a-fA-F]{6}$/.test(e.target.value)) setter(value)
                }}
                style={{ width: 76, padding: '5px 8px', borderRadius: 7, border: '1.5px solid #e5e7eb', fontSize: 12, fontFamily: 'monospace', color: '#374151', textAlign: 'center', outline: 'none', background: '#fff' }}
                onFocus={e => e.target.style.borderColor = '#6366f1'}
                onBlurCapture={e => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Vista previa ────────────────────────────────────── */}
      <div style={{ background: '#fff', borderRadius: 14, padding: '22px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #e5e7eb' }}>
        <p style={{ margin: '0 0 14px', fontWeight: 800, fontSize: 14, color: '#111827' }}>Vista previa</p>
        <Preview
          colorPrimario={colorPrimario}
          colorAcento={colorAcento}
          colorBoton={colorBoton}
          logoPreview={logoPreview}
          nombreSistema={nombreSistema}
          nombreInstitucion={nombreInstitucion}
        />
        <p style={{ margin: '8px 0 0', fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>Los cambios se aplican en tiempo real — guarda para que sean permanentes</p>
      </div>

      {/* ── Mensajes ────────────────────────────────────────── */}
      {error && <p style={{ margin: 0, fontSize: 13, color: '#dc2626', background: '#fef2f2', padding: '10px 14px', borderRadius: 8, border: '1px solid #fecaca' }}>⚠️ {error}</p>}
      {exito && <p style={{ margin: 0, fontSize: 13, color: '#059669', background: '#f0fdf4', padding: '10px 14px', borderRadius: 8, border: '1px solid #bbf7d0' }}>✓ Cambios guardados correctamente</p>}

      {/* ── Acciones ────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={restaurar}
          style={{ padding: '9px 18px', borderRadius: 8, border: '1.5px solid #d1d5db', background: '#fff', color: '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Restaurar defaults
        </button>
        <button onClick={guardar} disabled={guardando}
          style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontSize: 13, fontWeight: 700, cursor: guardando ? 'wait' : 'pointer', opacity: guardando ? 0.7 : 1 }}>
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  )
}
