import { useState, useMemo } from 'react'

const ITEMS_POR_PAGINA = 10

export function usePagination<T>(items: T[], itemsPorPagina = ITEMS_POR_PAGINA) {
  const [pagina, setPagina] = useState(1)

  const totalPaginas = Math.max(1, Math.ceil(items.length / itemsPorPagina))

  // Si los datos cambian y la página actual queda fuera de rango, vuelve a 1
  const paginaActual = Math.min(pagina, totalPaginas)

  const itemsPagina = useMemo(() => {
    const inicio = (paginaActual - 1) * itemsPorPagina
    return items.slice(inicio, inicio + itemsPorPagina)
  }, [items, paginaActual, itemsPorPagina])

  const irA       = (p: number) => setPagina(Math.max(1, Math.min(p, totalPaginas)))
  const siguiente = () => irA(paginaActual + 1)
  const anterior  = () => irA(paginaActual - 1)
  const reset     = () => setPagina(1)

  return {
    itemsPagina,
    pagina:       paginaActual,
    totalPaginas,
    totalItems:   items.length,
    itemsPorPagina,
    irA, siguiente, anterior, reset,
    hayAnterior:  paginaActual > 1,
    haySiguiente: paginaActual < totalPaginas,
    inicio:       (paginaActual - 1) * itemsPorPagina + 1,
    fin:          Math.min(paginaActual * itemsPorPagina, items.length),
  }
}