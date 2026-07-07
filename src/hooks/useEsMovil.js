import { useState, useEffect } from 'react'

// Hook simple para saber si el viewport es "móvil" (o cualquier breakpoint dado).
// Evita layouts de columnas fijas que se rompen en pantallas angostas.
export function useEsMovil(breakpoint = 768) {
  const consultar = () =>
    typeof window !== 'undefined' && window.innerWidth <= breakpoint

  const [esMovil, setEsMovil] = useState(consultar)

  useEffect(() => {
    const onResize = () => setEsMovil(consultar())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breakpoint])

  return esMovil
}
