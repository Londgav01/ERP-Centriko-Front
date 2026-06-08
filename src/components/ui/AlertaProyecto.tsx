import { useProyecto } from '../../context/ProyectoContext'
import { AlertTriangle } from 'lucide-react'

export default function AlertaProyecto() {
  const { proyecto } = useProyecto()
  if (proyecto) return null

  return (
    <div style={{
      background:   'var(--color-warning-bg)',
      border:       '1px solid var(--color-warning)',
      borderRadius: 'var(--radius-md)',
      padding:      '10px 14px',
      marginBottom: 16,
      display:      'flex',
      alignItems:   'center',
      gap:          8,
      fontSize:     13,
    }}>
      <AlertTriangle size={15} style={{ color: 'var(--color-warning)', flexShrink: 0 }} />
      <span>
        <strong>Sin proyecto activo.</strong> Selecciona un proyecto en la barra superior
        para ver los datos correspondientes.
      </span>
    </div>
  )
}