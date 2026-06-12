import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { api } from '../lib/api'

interface Proyecto {
  proyecto_id: string
  nombre:      string
  estado:      string
}

interface ProyectoContextType {
  proyecto:         Proyecto | null
  setProyecto:      (p: Proyecto | null) => void
  proyectos:        Proyecto[]
  cargando:         boolean
  recargarProyectos: () => void
}

const ProyectoContext = createContext<ProyectoContextType>({
  proyecto:          null,
  setProyecto:       () => {},
  proyectos:         [],
  cargando:          false,
  recargarProyectos: () => {},
})

export function ProyectoProvider({ children }: { children: ReactNode }) {
  const [proyecto,  setProyectoState] = useState<Proyecto | null>(null)
  const [proyectos, setProyectos]     = useState<Proyecto[]>([])
  const [cargando,  setCargando]      = useState(false)

  const cargarProyectos = () => {
    // ← Solo carga si hay token activo
    const token = localStorage.getItem('token')
    if (!token) { setCargando(false); return }

    setCargando(true)
    api.get('/api/proyectos')
      .then(res => {
        const data = res.data.data as Proyecto[]
        setProyectos(data)

        // Restaurar proyecto guardado en localStorage
        const guardado = localStorage.getItem('erp_proyecto_activo')
        if (guardado) {
          try {
            const parsed = JSON.parse(guardado)
            const existe = data.find(p => p.proyecto_id === parsed.proyecto_id)
            if (existe) setProyectoState(existe)
          } catch {}
        }
      })
      .catch(() => {})
      .finally(() => setCargando(false))
  }

  useEffect(() => {
    cargarProyectos()
  }, [])

  const setProyecto = (p: Proyecto | null) => {
    setProyectoState(p)
    if (p) localStorage.setItem('erp_proyecto_activo', JSON.stringify(p))
    else   localStorage.removeItem('erp_proyecto_activo')
  }

  return (
    <ProyectoContext.Provider value={{
      proyecto,
      setProyecto,
      proyectos,
      cargando,
      recargarProyectos: cargarProyectos,
    }}>
      {children}
    </ProyectoContext.Provider>
  )
}

export const useProyecto = () => useContext(ProyectoContext)