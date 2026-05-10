import MainLayout from '../../components/layout/MainLayout'
import { useAuth } from '../../context/AuthContext'

export default function DashboardPage() {
  const { usuario } = useAuth()

  return (
    <MainLayout>
      <h1 style={{ margin: '0 0 8px', color: '#1e293b' }}>Tablero de Control</h1>
      <p style={{ color: '#64748b' }}>Bienvenido, <strong>{usuario?.nombre}</strong></p>
      <div style={{
        marginTop: 32,
        padding: 24,
        background: 'white',
        borderRadius: 8,
        border: '1px solid #e2e8f0',
        color: '#94a3b8'
      }}>
        Los módulos se habilitarán a medida que se implementen.
      </div>
    </MainLayout>
  )
}