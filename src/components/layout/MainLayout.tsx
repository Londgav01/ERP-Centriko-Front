import type { ReactNode } from 'react'
import { Building2, ChevronDown } from 'lucide-react'
import { useProyecto } from '../../context/ProyectoContext'
import Sidebar from './Sidebar'
import './MainLayout.css'
import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInactividad } from '../../hooks/useInactividad'
import ModalInactividad from '../ui/ModalInactividad'
import { useAuth } from '../../context/AuthContext'

export default function MainLayout({ children }: { children: ReactNode }) {
  const { proyecto, setProyecto, proyectos } = useProyecto()
  const { usuario, logout } = useAuth()
  const navigate            = useNavigate()
  const [mostrarModal, setMostrarModal] = useState(false)

  const handleAdvertencia = useCallback(() => {
    setMostrarModal(true)
  }, [])

  const handleLogoutInactividad = useCallback(async () => {
    setMostrarModal(false)
    await logout()
    navigate('/login')
  }, [logout, navigate])

  const handleContinuar = useCallback(() => {
    setMostrarModal(false)
    // El hook reinicia los timers automáticamente al detectar la interacción
  }, [])

  useInactividad({
    onAdvertencia: handleAdvertencia,
    onLogout:      handleLogoutInactividad,
    activo:        !!usuario,
  })

  return (
    <div className="main-layout-shell">
      <Sidebar />
      <main className="main-layout-content">
        <div className="main-layout-header">
          <div className="main-layout-project-block">
            <div className={`main-layout-project-icon ${proyecto ? 'is-active' : 'is-empty'}`}>
              <Building2 size={16} />
            </div>
            <div>
              <div className="main-layout-project-label">
                Proyecto activo
              </div>
              <div className="main-layout-project-select-wrap">
                <select
                  className={`main-layout-project-select ${proyecto ? 'is-active' : 'is-empty'}`}
                  value={proyecto?.proyecto_id || ''}
                  onChange={e => {
                    const sel = proyectos.find(p => p.proyecto_id === e.target.value) || null
                    setProyecto(sel)
                  }}
                  aria-label="Proyecto activo">
                  <option value="">Sin proyecto activo</option>
                  {proyectos.map(p => (
                    <option key={p.proyecto_id} value={p.proyecto_id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
                <ChevronDown size={13} className={`main-layout-project-chevron ${proyecto ? 'is-active' : 'is-empty'}`} />
              </div>
            </div>
          </div>
        </div>
        <div className="main-layout-page-content">
          {children}
        </div>
      </main>
      <ModalInactividad
      visible={mostrarModal}
      onContinuar={handleContinuar}
      onCerrarSesion={handleLogoutInactividad}
      />
    </div>
  )
}