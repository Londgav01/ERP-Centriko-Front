import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { api } from '../lib/api'

interface Proyecto {
  proyecto_id: string
  nombre:      string
  estado:      string
}

interface ProyectoContextType {
  proyecto:    Proyecto | null
  setProyecto: (p: Proyecto | null) => void
  proyectos:   Proyecto[]
  cargando:    boolean
}

const ProyectoContext = createContext<ProyectoContextType>({
  proyecto:    null,
  setProyecto: () => {},
  proyectos:   [],
  cargando:    false,
})

export function ProyectoProvider({ children }: { children: ReactNode }) {
  const [proyecto,  setProyectoState] = useState<Proyecto | null>(null)
  const [proyectos, setProyectos]     = useState<Proyecto[]>([])
  const [cargando,  setCargando]      = useState(true)

  // Cargar proyectos al montar
  useEffect(() => {
    api.get('/api/proyectos')
      .then(res => {
        const data = res.data.data as Proyecto[]
        setProyectos(data)

        // Restaurar proyecto guardado en localStorage
        const guardado = localStorage.getItem('erp_proyecto_activo')
        if (guardado) {
          const parsed = JSON.parse(guardado)
          const existe = data.find(p => p.proyecto_id === parsed.proyecto_id)
          if (existe) setProyectoState(existe)
        }
      })
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [])

  const setProyecto = (p: Proyecto | null) => {
    setProyectoState(p)
    if (p) localStorage.setItem('erp_proyecto_activo', JSON.stringify(p))
    else   localStorage.removeItem('erp_proyecto_activo')
  }

  return (
    <ProyectoContext.Provider value={{ proyecto, setProyecto, proyectos, cargando }}>
      {children}
    </ProyectoContext.Provider>
  )
}

export const useProyecto = () => useContext(ProyectoContext)