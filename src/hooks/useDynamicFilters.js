// src/hooks/useDynamicFilters.js
import { useState, useMemo, useCallback } from 'react'

/**
 * useDynamicFilters — filtros dependientes entre sí sobre un dataset.
 *
 * @param {object} opts
 * @param {Array}  opts.data    Dataset base (ya pre-filtrado si hay búsqueda/fechas/KPI)
 * @param {Array}  opts.campos  [{ campo: string, match?: (item, val) => bool }]
 *
 * @returns {{ filtrados, filtros, getOpciones, handleFiltroChange, resetFiltros, hayFiltros }}
 *
 * Uso en Inventario, Requerimientos u otras tablas:
 *   const { filtrados, filtros, getOpciones, handleFiltroChange, resetFiltros } =
 *     useDynamicFilters({ data: baseItems, campos: [{ campo: 'estado' }, { campo: 'fondo' }] })
 *
 *   // Opciones dinámicas para el selector de "estado" (excluyendo el propio filtro de estado):
 *   const opcionesEstado = getOpciones('estado') // → [['En proceso', 3], ['Comprado', 2], ...]
 */
export function useDynamicFilters({ data, campos }) {
  const [filtros, setFiltros] = useState({})

  // Aplica todos los campos filtro, opcionalmente excluyendo uno
  const aplicarCampos = useCallback((base, excluirCampo = null, overrides = null) => {
    const f = overrides ?? filtros
    let result = [...base]
    for (const { campo, match } of campos) {
      if (campo === excluirCampo) continue
      const val = f[campo]
      if (!val) continue
      result = result.filter(item =>
        match ? match(item, val) : String(item[campo] ?? '') === val
      )
    }
    return result
  }, [campos, filtros])

  // Dataset filtrado final
  const filtrados = useMemo(() => aplicarCampos(data), [aplicarCampos, data])

  // Opciones disponibles para un campo dado (aplicando todos los demás filtros)
  // Devuelve [valor, conteo][] ordenado alfabéticamente
  const getOpciones = useCallback((campo) => {
    const base = aplicarCampos(data, campo)
    const counts = {}
    base.forEach(item => {
      const v = item[campo]
      if (v) counts[v] = (counts[v] || 0) + 1
    })
    return Object.entries(counts).sort(([a], [b]) => a.localeCompare(b, 'es'))
  }, [aplicarCampos, data])

  // Cambia un filtro y resetea dependientes que ya no tendrían resultados
  const handleFiltroChange = useCallback((campo, valor) => {
    setFiltros(prev => {
      const next = { ...prev, [campo]: valor }
      for (const { campo: c } of campos) {
        if (c === campo || !next[c]) continue
        const base = aplicarCampos(data, c, next)
        const available = new Set(base.map(item => item[c]).filter(Boolean))
        if (!available.has(next[c])) next[c] = ''
      }
      return next
    })
  }, [campos, aplicarCampos, data])

  const resetFiltros = useCallback(() => setFiltros({}), [])

  const hayFiltros = campos.some(({ campo }) => Boolean(filtros[campo]))

  return { filtrados, filtros, getOpciones, handleFiltroChange, resetFiltros, hayFiltros }
}
