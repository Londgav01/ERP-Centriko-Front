import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import LoginPage from './pages/auth/LoginPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import ProyectosPage from './pages/proyectos/ProyectosPage'


function RutaProtegida({ children }: { children: React.ReactNode }) {
  const { usuario, cargando } = useAuth()
  if (cargando) return <div style={{ padding: 32 }}>Cargando...</div>
  return usuario ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  const { usuario } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={usuario ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={<RutaProtegida><DashboardPage /></RutaProtegida>} />
      <Route path="/proyectos" element={<RutaProtegida><ProyectosPage /></RutaProtegida>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}