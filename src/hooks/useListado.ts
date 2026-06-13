import { useState } from 'react'
import { api } from '../lib/api'
import { usePagination } from './usePagination'

// Lista de documentos/maestros con filtros y paginación integrada.
//
// IMPORTANTE: los filtros se pasan como PARÁMETROS directos a `cargar`
// (patrón cargarLista del proyecto). Nunca se leen del estado de React
// dentro del hook: los setState son asíncronos y leerlos aquí causaría
// cargas con filtros desactualizados.
//
// Uso típico en la página:
//   const { lista, cargando, pag, cargar } = useListado<RS>('/api/rs')
//   ...
//   onChange={e => { setFiltroEstado(e.target.value); cargar({ estado: e.target.value, proyecto_id: filtroProyecto }) }}
export function useListado<T>(url: string) {
  const [lista, setLista] = useState<T[]>([])
  const [cargando, setCargando] = useState(false)
  const pag = usePagination(lista)

  const cargar = async (filtros: Record<string, string | undefined> = {}) => {
    setCargando(true)
    try {
      const params = new URLSearchParams()
      for (const [k, v] of Object.entries(filtros)) {
        if (v !== undefined && v !== '') params.append(k, v)
      }
      const qs = params.toString()
      const res = await api.get(qs ? `${url}?${qs}` : url)
      setLista(res.data.data)
      pag.reset()
    } finally {
      setCargando(false)
    }
  }

  return { lista, setLista, cargando, pag, cargar }
}
