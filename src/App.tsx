import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import LoginPage from './pages/auth/LoginPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import ProyectosPage from './pages/proyectos/ProyectosPage'
import EdificacionesPage from './pages/edificaciones/EdificacionesPage'
import CapitulosPage from './pages/capitulos/CapitulosPage'
import MaterialesPage from './pages/materiales/MaterialesPage'
import ProveedoresPage from './pages/proveedores/ProveedoresPage'
import ContratistasPage from './pages/contratistas/ContratistasPage'
import UsuariosPage from './pages/usuarios/UsuariosPage'
import CategoriasPage from './pages/admin/CategoriasPage'
import RSPage from './pages/rs/RSPage'
import CZPage from './pages/cz/CZPage'
import OCPage from './pages/oc/OCPage'
import EAPage from './pages/ea/EAPage'
import StockPage from './pages/stock/StockPage'
import SAPage from './pages/sa/SAPage'
import CTPage from './pages/ct/CTPage'
import ANPage from './pages/an/ANPage'
import AVPage from './pages/av/AVPage'



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
      <Route path="/edificaciones" element={<RutaProtegida><EdificacionesPage /></RutaProtegida>} />
      <Route path="/capitulos" element={<RutaProtegida><CapitulosPage /></RutaProtegida>} />
      <Route path="/materiales" element={<RutaProtegida><MaterialesPage /></RutaProtegida>} />
      <Route path="/proveedores" element={<RutaProtegida><ProveedoresPage /></RutaProtegida>} />
      <Route path="/contratistas" element={<RutaProtegida><ContratistasPage /></RutaProtegida>} />
      <Route path="/usuarios" element={<RutaProtegida><UsuariosPage /></RutaProtegida>} />
      <Route path="/categorias" element={<RutaProtegida><CategoriasPage /></RutaProtegida>} />
      <Route path="/requisiciones" element={<RutaProtegida><RSPage /></RutaProtegida>} />
      <Route path="/cotizaciones" element={<RutaProtegida><CZPage /></RutaProtegida>} />
      <Route path="/ordenes-compra" element={<RutaProtegida><OCPage /></RutaProtegida>} />
      <Route path="/entradas" element={<RutaProtegida><EAPage /></RutaProtegida>} />
      <Route path="/stock" element={<RutaProtegida><StockPage /></RutaProtegida>} />
      <Route path="/salidas" element={<RutaProtegida><SAPage /></RutaProtegida>} />
      <Route path="/contratos" element={<RutaProtegida><CTPage /></RutaProtegida>} />
      <Route path="/anticipos" element={<RutaProtegida><ANPage /></RutaProtegida>} />
      <Route path="/actas" element={<RutaProtegida><AVPage /></RutaProtegida>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}