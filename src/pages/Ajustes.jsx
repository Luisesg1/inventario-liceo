import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { aplicarTema } from '../utils/tema'

const DEFAULTS = { colorPrimario: '#1a237e', colorAcento: '#d4a017', colorBoton: '#6366f1' }

export default function Ajustes({ onLogoChange }) {
  const [colorPrimario, setColorPrimario] = useState(DEFAULTS.colorPrimario)
  const [colorAcento,   setColorAcento]   = useState(DEFAULTS.colorAcento)
  const [colorBoton,    setColorBoton]    = useState(DEFAULTS.colorBoton)
  const [logoPreview,   setLogoPreview]   = useState('/logo-liceo.png')
  const [logoFile,      setLogoFile]      = useState(null)
  const [guardando,     setGuardando]     = useState(false)
  const [exito,         setExito]         = useState(false)
  const [error,         setError]         = useState('')
  const fileRef = useRef()

  useEffect(() => { cargar() }, []) // eslint-disable-line

  async function cargar() {
    const { data } = await supabase.from('configuracion').select('clave, valor')
    if (!data) return
    const cfg = Object.fromEntries(data.map(r => [r.clave, r.valor]))
    const p = cfg.color_primario || DEFAULTS.colorPrimario
    const a = cfg.color_acento   || DEFAULTS.colorAcento
    const b = cfg.color_boton    || DEFAULTS.colorBoton
    setColorPrimario(p)
    setColorAcento(a)
    setColorBoton(b)
    if (cfg.logo_url) setLogoPreview(cfg.logo_url)
  }

  function handleColorChange(setter, key, value) {
    setter(value)
    aplicarTema({
      colorPrimario: key === 'color_primario' ? value : colorPrimario,
      colorAcento:   key === 'color_acento'   ? value : colorAcento,
      colorBoton:    key === 'color_boton'     ? value : colorBoton,
    })
  }

  function handleLogoFile(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { setError('El archivo no puede superar 2 MB'); return }
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
    setError('')
  }

  async function guardar() {
    setGuardando(true); setError(''); setExito(false)

    let logoUrl = null
    if (logoFile) {
      const ext  = logoFile.name.split('.').pop()
      const path = `logo-principal.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('logos')
        .upload(path, logoFile, { upsert: true, contentType: logoFile.type })
      if (uploadErr) { setError('Error al subir logo: ' + uploadErr.message); setGuardando(false); return }
      const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(path)
      logoUrl = publicUrl + '?t=' + Date.now()
    }

    const filas = [
      { clave: 'color_primario', valor: colorPrimario },
      { clave: 'color_acento',   valor: colorAcento   },
      { clave: 'color_boton',    valor: colorBoton     },
    ]
    if (logoUrl) filas.push({ clave: 'logo_url', valor: logoUrl })

    const { error: dbErr } = await supabase.from('configuracion').upsert(filas, { onConflict: 'clave' })
    if (dbErr) { setError('Error al guardar: ' + dbErr.message); setGuardando(false); return }

    if (logoUrl && onLogoChange) onLogoChange(logoUrl)
    setLogoFile(null)
    setGuardando(false)
    setExito(true)
    setTimeout(() => setExito(false), 3000)
  }

  async function restaurar() {
    setColorPrimario(DEFAULTS.colorPrimario)
    setColorAcento(DEFAULTS.colorAcento)
    setColorBoton(DEFAULTS.colorBoton)
    aplicarTema(DEFAULTS)
  }

  const swatch = (color) => (
    <div style={{ width: 28, height: 28, borderRadius: 6, background: color, border: '2px solid rgba(0,0,0,0.1)', flexShrink: 0 }} />
  )

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Logo */}
      <div style={{ background: '#fff', borderRadius: 14, padding: '22px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #e5e7eb' }}>
        <p style={{ margin: '0 0 16px', fontWeight: 800, fontSize: 14, color: '#111827' }}>Logo del sistema</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <img src={logoPreview} alt="Logo preview"
            style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '3px solid #e5e7eb', background: '#f3f4f6' }}
            onError={e => { e.target.src = '/logo-liceo.png' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={() => fileRef.current.click()}
              style={{ padding: '8px 18px', borderRadius: 8, border: '1.5px solid #6366f1', background: '#f5f3ff', color: '#6366f1', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Cambiar logo
            </button>
            <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>PNG, JPG o SVG · máx. 2 MB</p>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoFile} />
        </div>
        {logoFile && (
          <p style={{ margin: '10px 0 0', fontSize: 12, color: '#059669' }}>✓ {logoFile.name} seleccionado — guarda para aplicar</p>
        )}
      </div>

      {/* Colores */}
      <div style={{ background: '#fff', borderRadius: 14, padding: '22px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #e5e7eb' }}>
        <p style={{ margin: '0 0 16px', fontWeight: 800, fontSize: 14, color: '#111827' }}>Colores del tema</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {[
            { label: 'Color primario', desc: 'Sidebar y fondo principal', key: 'color_primario', value: colorPrimario, setter: setColorPrimario },
            { label: 'Color acento',   desc: 'Bordes dorados y elementos activos', key: 'color_acento', value: colorAcento, setter: setColorAcento },
            { label: 'Color botones',  desc: 'Botones de acción en el inventario', key: 'color_boton',  value: colorBoton,  setter: setColorBoton  },
          ].map(({ label, desc, key, value, setter }) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', borderRadius: 10, background: '#f9fafb', border: '1px solid #f3f4f6' }}>
              <label htmlFor={key} style={{ cursor: 'pointer', position: 'relative' }}>
                {swatch(value)}
                <input id={key} type="color" value={value}
                  onChange={e => handleColorChange(setter, key, e.target.value)}
                  style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
              </label>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#111827' }}>{label}</p>
                <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>{desc}</p>
              </div>
              <code style={{ fontSize: 12, color: '#6b7280', background: '#f3f4f6', padding: '3px 8px', borderRadius: 6 }}>{value}</code>
            </div>
          ))}
        </div>
      </div>

      {/* Acciones */}
      {error && <p style={{ margin: 0, fontSize: 13, color: '#dc2626', background: '#fef2f2', padding: '10px 14px', borderRadius: 8, border: '1px solid #fecaca' }}>⚠️ {error}</p>}
      {exito && <p style={{ margin: 0, fontSize: 13, color: '#059669', background: '#f0fdf4', padding: '10px 14px', borderRadius: 8, border: '1px solid #bbf7d0' }}>✓ Cambios guardados correctamente</p>}

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
