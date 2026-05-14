function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

export function aplicarTema({ colorPrimario, colorAcento, colorBoton }) {
  const root = document.documentElement

  const [r, g, b] = hexToRgb(colorPrimario)
  // Variantes oscuras del primario para los gradientes del sidebar/layout
  const dk = [Math.round(r * 0.45), Math.round(g * 0.45), Math.round(b * 0.45)]
  const md = [Math.round(r * 0.62), Math.round(g * 0.62), Math.round(b * 0.62)]
  root.style.setProperty('--primary-rgb',      `${r}, ${g}, ${b}`)
  root.style.setProperty('--primary-dark-rgb', `${dk[0]}, ${dk[1]}, ${dk[2]}`)
  root.style.setProperty('--primary-mid-rgb',  `${md[0]}, ${md[1]}, ${md[2]}`)

  const [ar, ag, ab] = hexToRgb(colorAcento)
  root.style.setProperty('--acento-rgb', `${ar}, ${ag}, ${ab}`)
  // Versión más brillante del acento para texto activo en nav
  root.style.setProperty('--acento-bright', `rgb(${Math.min(255, Math.round(ar * 1.13))}, ${Math.min(255, Math.round(ag * 1.3))}, ${Math.min(255, ab + 73)})`)

  root.style.setProperty('--color-boton', colorBoton)
}
