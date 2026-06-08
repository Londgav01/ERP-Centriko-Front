import { useEffect, useState } from 'react'
import { useProyecto } from '../context/ProyectoContext'
import { api } from '../lib/api'

export function useEdificacionesPorProyecto() {
  const { proyecto } = useProyecto()
  const [edificaciones, setEdificaciones] = useState<any[]>([])

  useEffect(() => {
    if (!proyecto) { setEdificaciones([]); return }
    api.get(`/api/edificaciones?proyecto_id=${proyecto.proyecto_id}`)
      .then(res => setEdificaciones(res.data.data))
      .catch(() => {})
  }, [proyecto?.proyecto_id])

  return edificaciones
}