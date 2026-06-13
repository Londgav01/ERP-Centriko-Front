import { useState } from 'react'
import type { Edificacion, Capitulo } from '../types'

// Cascada Proyecto → Edificación → Capítulo filtrando en memoria sobre
// catálogos ya cargados (mismo patrón handleProyecto/handleEdificio de
// las páginas): al cambiar el padre se limpian los hijos.
//
// La página sigue siendo dueña del form: en el onChange del select llama
// alCambiarProyecto(id) y además set('proyecto_id', id), set('edificio_id', ''), etc.
export function useCascadaUbicacion(edificaciones: Edificacion[], capitulos: Capitulo[] = []) {
  const [edifFiltradas, setEdifFiltradas] = useState<Edificacion[]>([])
  const [capFiltrados, setCapFiltrados] = useState<Capitulo[]>([])

  const alCambiarProyecto = (proyectoId: string) => {
    setEdifFiltradas(proyectoId ? edificaciones.filter(e => e.proyecto_id === proyectoId) : [])
    setCapFiltrados([])
  }

  const alCambiarEdificio = (edificioId: string) => {
    setCapFiltrados(edificioId ? capitulos.filter(c => c.edificio_id === edificioId) : [])
  }

  const reset = () => {
    setEdifFiltradas([])
    setCapFiltrados([])
  }

  return { edifFiltradas, capFiltrados, alCambiarProyecto, alCambiarEdificio, reset }
}
